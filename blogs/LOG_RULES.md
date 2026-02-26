# Production Logging Guide (Node.js / TypeScript)

A practical reference for high-throughput production services.

Goal:

- High signal
- Low noise
- Structured logs
- Production-safe observability
- Scalable under load

---

# 1. Core Principle

> Log based on **business significance**, not read vs write.

If you would not:

- Count it
- Alert on it
- Put it on a dashboard
- Use it for auditing

Then it should not be `info`.

---

# 2. Log Levels

## debug

Internal mechanics and high-frequency operations.

Use for:

- DB queries
- Cache hits/misses
- Service flow steps
- External API calls (before outcome)
- Data transformations
- Repository activity

These are implementation details.

Never business events.

---

## info

Business-significant domain events.

Use for:

- User registered
- Order placed
- Payment completed
- Subscription cancelled
- Report exported (rare/expensive read)
- Admin role changed

Info logs must be:

- Countable
- Auditable
- Dashboard-worthy

If you wouldn’t graph it, it’s probably not `info`.

---

## warn

Expected abnormal conditions.

Use for:

- Validation failures
- Meaningful 404s
- Inventory conflicts
- Duplicate entity attempts
- Recoverable downstream failures

Warn = abnormal but expected.

---

## error

Unexpected failures.

Use for:

- Unhandled exceptions
- Infrastructure outages
- External dependency crashes
- Bugs (undefined access, null reference, etc.)

Must preserve stack trace.
Must not leak sensitive data.

---

# 3. What NOT To Do

❌ Log every successful GET at `info`
❌ Log internal flow steps at `info`
❌ Log the same event in controller + service + repository
❌ Log raw request bodies
❌ Log passwords, tokens, PII
❌ Use `error` for validation failures
❌ Log string-concatenated messages instead of structured fields

Noise is operational debt.

---

# 4. Layer Responsibilities

## Controller Layer

Responsible for:

- Logging business events (`info`)
- Logging expected abnormal situations (`warn`)
- Returning responses

Should NOT:

- Log internal service mechanics
- Duplicate logs from service layer

### Controller Example

```ts
// order.controller.ts

async createOrder(req: Request, res: Response) {
  const order = await this.orderService.create(req.body);

  req.log.info(
    { orderId: order.id, userId: order.userId },
    "Order placed"
  );

  return res.status(201).json(order);
}
```

Bad example:

```ts
req.log.info('Entering createOrder');
req.log.info('Calling orderService');
```

That is noise.

---

## Service Layer

Responsible for:

- Internal flow logging (`debug`)
- Domain validation (`warn` when abnormal)
- Throwing errors
- NOT logging business success already logged in controller

### Service Example

```ts
// order.service.ts

async create(input: CreateOrderInput) {
  logger.debug("Validating order input");

  const stock = await this.inventory.check(input.itemId);

  if (!stock.available) {
    logger.warn(
      { itemId: input.itemId },
      "Inventory insufficient"
    );
    throw new ConflictError("Out of stock");
  }

  const order = await this.repo.create(input);

  logger.debug(
    { orderId: order.id },
    "Order stored in database"
  );

  return order;
}
```

Notice:

- No `info` here.
- Business event logged once in controller.
- Internal mechanics are `debug`.

---

## Repository Layer

Only `debug`.

Never `info`.

```ts
logger.debug({userId}, 'Fetching user from database');
```

Repository logs are for debugging, not business reporting.

---

# 5. Structured Logging Rules

All logs must be structured JSON.

Good:

```ts
logger.info({orderId, userId, amount}, 'Order placed');
```

Bad:

```ts
logger.info(`Order ${orderId} placed by ${userId}`);
```

Why structured:

- Filterable
- Aggregatable
- Queryable
- Correlatable via requestId

---

# 6. Request Context

Every log must include:

- requestId
- Relevant domain identifiers (userId, orderId, etc.)

Use request-scoped logger bindings.
Do not manually pass requestId everywhere.

Correlation across microservices depends on this.

---

# 7. Sensitive Data Rules

Never log:

- Passwords
- API keys
- Tokens
- Credit card numbers
- Full request bodies
- PII unless strictly necessary and approved

Use logger redaction configuration.

Production logs are discoverable and searchable.
Assume they will be read.

---

# 8. Quick Decision Checklist

Before logging at `info`, ask:

1. Is this a business domain event?
2. Would product care?
3. Would I graph or count this?
4. Would this matter in an audit?
5. Is this rare enough to deserve visibility?

If not → use `debug`.

---

# 9. Example: Correct End-to-End Flow

### Controller

```ts
async register(req: Request, res: Response) {
  const user = await this.userService.register(req.body);

  req.log.info(
    { userId: user.id },
    "User registered"
  );

  return res.status(201).json(user);
}
```

### Service

```ts
async register(input: CreateUserInput) {
  logger.debug(
    { email: input.email },
    "Validating user input"
  );

  const existing = await this.repo.findByEmail(input.email);

  if (existing) {
    logger.warn(
      { email: input.email },
      "User already exists"
    );
    throw new ConflictError("User already exists");
  }

  const user = await this.repo.create(input);

  logger.debug(
    { userId: user.id },
    "User persisted to database"
  );

  return user;
}
```

---

# Final Summary

- `debug` → internal mechanics
- `info` → business-significant domain events
- `warn` → expected abnormal conditions
- `error` → unexpected failures

High-throughput systems require strict signal discipline.
Info logs are lightweight domain events. Everything else is implementation detail.
