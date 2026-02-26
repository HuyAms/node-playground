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

## Logging

### Level Strategy

| Level   | When to use | Examples |
| ------- | ----------- | -------- |
| `debug` | Internal mechanics only an engineer debugging would care about — pre-condition checks, lookup starts, mid-operation state | `Looking up user by id`, `Checking email uniqueness`, `Persisting new user` |
| `info`  | Completed state mutations worth counting in a dashboard — irreversible writes with an audit trail | `User created`, `User updated`, `User deleted` |
| `warn`  | Expected failures — caller mistakes or domain conflicts that are normal operating conditions | `User not found`, `User creation conflict — email already exists` |
| `error` | Unexpected crashes only. Emitted exclusively from the centralized error handler. | `Unhandled error` |

`warn` is not `error`. A 404 is not a system failure — it is a caller mistake. Logging it at `error` level drowns real alerts in noise. In production, error-level logs should be rare enough to be worth a PagerDuty page.

### Where Logs Belong by Layer

| Layer | Logs? | Reason |
| ----- | ----- | ------ |
| Repository | No | Pure data layer with no business context. Logging here duplicates the service and conflates storage mechanics with outcomes. |
| Controller | No | `pino-http` already records every request/response (method, url, statusCode, responseTime) automatically. |
| Service | Yes — `debug`, `info`, `warn` | The only correct home for business logs. Never calls `logger.error()`. |
| Error handler | Yes — `error` only | The single call site for unexpected failures. |

This constraint matters: if `logger.error` appears outside the error handler, it is a sign that an expected failure is being misclassified.

### `info` vs `debug` in the Service Layer

The rule: **`info` is for writes, `debug` is for reads.**

Read operations (`listUsers`, `getUserById`) log at `debug` on success. A successful GET fires constantly under normal load and carries no business signal — it is not an event worth counting. Write operations (`createUser`, `updateUser`, `deleteUser`) log at `info` on success. These are irreversible state changes that belong in an audit trail.

In production at `logLevel=info`, the log stream contains exactly: every write outcome, every expected failure, every unexpected crash, and every HTTP request/response from `pino-http`. Read internals are suppressed.

### What Over-Logging Looks Like

```typescript
// BAD: every internal step of a GET logged at info
async getUserById(id: string): Promise<User> {
  logger.info({ userId: id }, 'Looking up user');  // noise — fires on every GET
  const user = await this.repo.findById(id);
  logger.info({ userId: id }, 'User retrieved');   // noise — doubles the volume
  return user;
}
```

At 1,000 req/s this generates 2,000 `info` lines per second of low-signal noise, doubles log ingestion cost in Datadog/CloudWatch, and buries the writes that actually matter.

### What Good Logging Looks Like

```typescript
// GOOD: reads are debug-only on success, warn on failure
async getUserById(id: string): Promise<User> {
  logger.debug({ requestId, userId: id }, 'Looking up user by id'); // suppressed in prod
  const user = await this.repo.findById(id);
  if (!user) {
    logger.warn({ requestId, userId: id }, 'User not found');        // expected failure
    throw new NotFoundError('User', id);
  }
  logger.debug({ requestId, userId: id }, 'User retrieved');         // suppressed in prod
  return user;
}

// GOOD: write emits exactly one info line on success
async createUser(input: CreateUserInput): Promise<User> {
  logger.debug({ requestId, email: input.email }, 'Checking email uniqueness');
  // ...conflict check emits warn + throws on conflict...
  const user = await this.repo.create(id, input, now);
  logger.info({ requestId, userId: user.id }, 'User created');       // one info, on success
  return user;
}
```

Structured fields (`userId`, `email`, `requestId`) — never string interpolation. Every log line is machine-queryable in a log aggregator without parsing.

### Other Anti-Patterns to Avoid

- **Logging full request or response bodies** — exposes PII and secrets even with field-level redaction configured elsewhere
- **`console.log` anywhere** — bypasses the structured logger and produces unindexed plaintext
- **`logger.error` for 404s or 409s** — poisons alerting thresholds; error-level logs should correlate with pages, not user mistakes
- **String interpolation in log messages** — `logger.info(\`User ${id} not found\`)` is unsearchable; pass `id` as a field instead

### Redaction

`authorization`, `cookie`, `password`, and `token` are stripped globally in `src/shared/logger.ts` via Pino's `redact` option. This applies to every log statement in the process — there is no per-call discipline required. If a new sensitive field is added to the data model, it is registered once in the `redact.paths` array.

### Transport Configuration

In development, logs are piped through `pino-pretty` (colorized, human-readable timestamps). In production, the logger emits raw newline-delimited JSON to stdout for consumption by log aggregators (Datadog, CloudWatch, Loki). Switching is a config check on `config.env` — no code change. An optional `logFile` destination can be enabled via `config.logFile` without touching application logic.

### Debugging Scenarios

**Scenario 1 — Duplicate email 409 reported by a client**

Filter your log aggregator by `requestId` from the response header. You'll find a `warn` line with `{ email, code: "CONFLICT" }` emitted by `UsersService.createUser` immediately before the HTTP response. The conflicting email is in the structured field — no log parsing needed.

**Scenario 2 — `PATCH /users/:id` returns 404 unexpectedly**

The `warn` log from `UsersService.updateUser` includes `{ userId }`. If the `userId` field matches the ID in the URL, the record genuinely does not exist. If it doesn't match, you have a routing or param-parsing bug — and you know that before touching the repository or database.

**Scenario 3 — Intermittent 500 with no reproduction steps**

The `error` log in `errorHandler` includes `{ err, method, url, requestId }` — full stack trace, the exact endpoint, and the request correlation ID. Filter by `requestId` to see the full request lifecycle: what pino-http recorded on entry, what the service was doing before the crash, and the stack at the point of failure. No additional instrumentation required.

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

## What Can Be Improved

**Real database.** Swap `InMemoryUserRepository` for a `PostgresUserRepository implements UserRepository`. The service, controller, and tests do not change — the interface contract absorbs the swap. Migration tooling (Flyway, node-pg-migrate) and a connection pool (pg, postgres.js) would be added at that point.

**AsyncLocalStorage for `requestId`.** Currently `requestId` is threaded as an explicit function parameter through every service method. Node's `AsyncLocalStorage` makes it ambient: set it once in middleware, read it anywhere in the call tree without touching signatures. The explicit parameter is clearer at this scale; `AsyncLocalStorage` is the correct choice when call trees are deep or when third-party code sits between middleware and service.

**Authentication and authorization.** A JWT verification middleware (`auth`) and a `requireRole` guard applied per route. The `User` type gains a `passwordHash` field that is excluded from all API responses and never appears in any log line (registered in `redact.paths`).

**OpenTelemetry tracing.** The existing `requestId` provides intra-service correlation. Distributed tracing (OTel + a collector) would extend that across service boundaries, providing span-level timing and dependency graphs. The structured log fields (`requestId`, `userId`) map cleanly onto OTel span attributes.

**Dependency injection container.** Dependencies are wired manually in `users.routes.ts`. A container (tsyringe, inversify) becomes worthwhile when there are multiple feature modules with overlapping dependencies. At current scale, manual wiring is more transparent.

**Input sanitization.** Zod validates structure and types; it does not strip HTML. If user-provided strings are ever rendered in a browser context, a server-side sanitization pass (DOMPurify/jsdom, or a strip-tags library) would be added before persistence.

**Cursor-based pagination.** Offset pagination is correct for static admin lists. If the user list becomes a high-write, real-time feed where rows are inserted between page loads, cursor-based pagination eliminates the skipped-row problem that offset pagination cannot solve.
