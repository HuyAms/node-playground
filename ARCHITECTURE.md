# Architecture

This document explains the decisions behind each structural choice in this codebase. The intended audience is a backend engineer joining this project who wants to understand _why_ things are the way they are, not just _what_ they are.

---

## Why Feature-Based Structure Instead of Role-Based

The alternative — `controllers/`, `services/`, `repositories/` at the root — collapses all domains into flat directories that scale poorly. Once you have 10 features, every file in `services/` is unrelated to the file next to it. Finding everything belonging to a feature requires grepping across three directories.

Feature-based structure (`modules/users/`) keeps cohesion local. Every file that handles a user lives in one folder. When you need to add, modify, or remove the users feature, you touch one directory. When you onboard a new engineer to work on a feature, you hand them one folder.

The cost is that shared utilities (`errors/`, `middleware/`, `types/`) need an explicit `shared/` home. That boundary is intentional: anything in `shared/` is cross-cutting; anything in `modules/` is domain-specific. If you find yourself importing from one feature module into another, that is a signal to promote the abstraction to `shared/` or to reconsider the domain boundary.

---

## Why a Service Layer

Controllers know about HTTP. Repositories know about data. Neither should know about business rules.

The service layer is where rules live:

- "You cannot create a user with a duplicate email" is a business rule. It is not a database constraint (we have no database). It is not an HTTP concern. It lives in `UsersService.createUser`.
- "When updating an email, check for conflicts with _other_ users, not the same user" — again, pure business logic.

Without a service layer, that logic bleeds into controllers (untestable without HTTP) or repositories (wrong abstraction level). The service layer is also where structured logging decisions are made: `logger.warn` on expected failures, `logger.info` on success. The controller does not need to know about that either.

Testing services in isolation — injecting a mock repository — is straightforward. Testing controllers requires spinning up HTTP. The boundary earns its keep.

---

## Why a Repository Abstraction Without a Real Database

The repository interface (`UserRepository`) defines a contract:

```typescript
interface UserRepository {
  findAll(pagination: PaginationQuery): Promise<{ users: User[]; total: number }>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(id: string, input: CreateUserInput, now: string): Promise<User>;
  update(id: string, input: UpdateUserInput, updatedAt: string): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}
```

The service depends on this interface, not on `InMemoryUserRepository`. When you add Postgres tomorrow, you write `PostgresUserRepository implements UserRepository` and swap the binding in `users.routes.ts`. The service, controller, and tests do not change.

This is not over-engineering for its own sake. The in-memory implementation is genuinely useful now: it makes tests fast (no connection pools, no cleanup), it makes local development zero-dependency, and it forces the interface to be defined explicitly rather than inferred from whatever the ORM happens to expose.

The decision to pass `id` and `now` into `create()` (rather than generating them inside the repository) is deliberate. It keeps the repository a pure data layer: it stores what it is given. UUID generation and timestamp creation are service-layer concerns because they may need to be testably controlled.

---

## Why Centralized Error Handling

The alternative is try/catch in every controller with local serialization. That pattern fails in three ways:

1. **Inconsistency**: different engineers write different error shapes. The client has to handle six different error formats.
2. **Duplication**: `logger.error()` gets called in 12 places with varying fields. You have no single source of truth about what an unhandled error log looks like.
3. **Missing errors**: async route handlers that throw outside a try/catch silently drop the error unless Express is configured to forward it.

The centralized `errorHandler` middleware enforces a single serialization path. Every `AppError` subclass defines its own status code and error code. Unexpected errors (non-`AppError`) always become 500 with a safe message and a full stack log. There is exactly one call to `logger.error()` in the entire codebase, and it is in the error handler.

The key invariant: **if it is expected, it is an `AppError`. If it is not an `AppError`, it is unexpected.** That binary keeps the error taxonomy clean.

---

## Why Pino Instead of Morgan or Winston

**Morgan** is a request logger only. It cannot emit structured business events. You would need a second logger alongside it.

**Winston** is flexible but verbose. Setting up JSON output, log levels, transports, and redaction requires significant configuration. The output is not natively compatible with standard log aggregators (Datadog, CloudWatch, Loki) without a custom formatter.

**Pino** is fast (the benchmark difference matters at request volume), emits newline-delimited JSON by default, and ships with `pino-http` for request logging built on the same instance. The `req.log` child logger created by `pino-http` automatically inherits the `requestId` — you don't have to thread it manually through every function call.

The `pino-pretty` transport is used in development only. In production, raw JSON goes to stdout for log aggregators to consume. Switching is a config check (`config.env !== 'production'`), not a code change.

---

## Logging Level Strategy

| Level   | When to use                                                                       |
| ------- | --------------------------------------------------------------------------------- |
| `info`  | Successful business operations: user created, user retrieved, user deleted.       |
| `warn`  | Expected abnormal outcomes: user not found, duplicate email conflict.             |
| `error` | Unexpected failures only. Emitted exclusively from the centralized error handler. |

`warn` is not `error`. A 404 is not a system failure — it is a caller mistake. Logging it at `error` level would drown real alerts in noise. In production, error-level logs should be rare enough to be worth a PagerDuty alert. Treat them that way.

`info` is emitted by the service layer, not the controller. The service is where the business event happened. The controller is just the delivery mechanism.

Sensitive fields (`authorization`, `cookie`, `password`, `token`) are redacted at the logger level via Pino's `redact` option. This applies globally — there is no per-log-statement discipline required.

---

## Error Propagation Flow

```
HTTP Request
    │
    ▼
requestId middleware        ← assigns / reuses x-request-id
    │
    ▼
pino-http                   ← logs request start with requestId
    │
    ▼
validate middleware          ← throws ValidationError on bad input (AppError)
    │
    ▼
Controller                  ← delegates to service; catches and calls next(err)
    │
    ▼
Service                     ← throws NotFoundError / ConflictError (AppError)
                            ← logs warn for expected failures, info for success
    │
    ▼ (on error)
errorHandler middleware
    ├── AppError? → serialize, respond with statusCode (no logger.error)
    └── Unknown?  → logger.error with full err, respond 500 with safe message
```

Controllers use explicit `try/catch` with `next(err)` rather than relying on Express's async error detection for clarity and to ensure `next` is always called correctly regardless of Express version.

---

## Pagination Design Decisions

**Why query params instead of cursor-based pagination?**

Cursor-based pagination is correct for real-time feeds where rows are inserted frequently between pages. For a user management list, offset pagination is predictable, debuggable, and trivially implemented. It is the right tradeoff for this use case.

**Why coerce strings to numbers in Zod?**

Query parameters are always strings. `?page=2` arrives as `"2"`. Using `z.coerce.number()` handles this transparently and produces typed `number` output, so the rest of the stack never deals with strings in a numeric context.

**Why does the repository handle the slice?**

This mirrors what you would do with a real database (SQL `LIMIT`/`OFFSET`). When `InMemoryUserRepository` is replaced with a Postgres implementation, the slice logic stays in the repository layer — the service does not change. If pagination were done in the service, the repository would have to return the full dataset on every request, which would be a performance regression when the backing store is real.

**Why does `totalPages` compute to at least 1?**

`Math.ceil(0 / 10)` is `0`, which would tell the client there are zero pages — including the page they just got. When the store is empty, there is one page (page 1, with zero items). `|| 1` prevents the off-by-one.

---

## Tradeoffs Made

**No dependency injection container.** Dependencies are wired manually in `users.routes.ts`. A container (tsyringe, inversify) adds boilerplate and indirection for a single feature module. The manual wiring is explicit and testable by passing fake implementations directly.

**No request-scoped logger child.** The `requestId` is threaded as a function parameter rather than using AsyncLocalStorage to make it ambient. AsyncLocalStorage is the production-correct approach but adds complexity. The explicit parameter makes the dependency visible in function signatures, which is preferable at this scale.

**`userRepository` is a module singleton.** Tests share state between test cases unless they avoid mutating seed records. Test cases that create users use unique emails. Test cases that delete users create a throwaway user first. This is a deliberate tradeoff: keeping the repository a singleton avoids rebuilding the app per test, which keeps the suite fast.

**No authentication or authorization.** Out of scope for this exercise. Adding it would mean an `auth` middleware (JWT verification), a `requireRole` guard applied per route, and extending the `User` type with a `passwordHash` field that is never logged or returned in API responses.

**No input sanitization beyond Zod.** Zod validates structure and types; it does not sanitize HTML or prevent injection. With a real database, parameterized queries handle injection. With user-provided content that could be rendered as HTML, a sanitization step (DOMPurify server-side, or a strip-tags library) would be added before persistence.

---

## What Was Intentionally Not Implemented and Why

| Omission | Reason |
|---|---|
| Real database | Adds infrastructure dependency without changing the API's structural decisions |
| JWT authentication | Auth is a cross-cutting concern; adding it would obscure the architecture patterns being demonstrated |
| Migrations / schema management | No persistence layer |
| CI/CD pipeline | Infrastructure concern, outside scope |
| Docker / docker-compose | Same — infrastructure |
| Cursor-based pagination | Offset pagination is appropriate for static, admin-style lists |
| AsyncLocalStorage for requestId | Explicit threading is clearer at this scale; AsyncLocalStorage would be the production choice for deep call trees |
| Request ID in success response body | The ID is in the response header (`x-request-id`), which is the correct HTTP idiom. Embedding it in every response body would couple the client to infrastructure concerns |
| Compression middleware | A concern for the reverse proxy (nginx/ALB), not the application server |
| OpenTelemetry tracing | Correct for production but would double the complexity of this demonstration |
