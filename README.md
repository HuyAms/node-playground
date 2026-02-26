# Node Playground — Enterprise Node.js REST API

A production-structured REST API built with Node.js, Express, and TypeScript. Feature-based modular architecture, Zod validation, Pino structured logging, Swagger documentation, and Vitest integration tests — all backed by an in-memory store.

---

## Requirements

- Node.js 20+
- npm 9+

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env

# 3. Start the development server (hot-reload via tsx)
npm run dev
```

The server starts on `http://localhost:3000` by default.

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed.

| Variable               | Default       | Description                          |
| ---------------------- | ------------- | ------------------------------------ |
| `NODE_ENV`             | `development` | `development`, `production`, or `test` |
| `PORT`                 | `3000`        | HTTP port                            |
| `LOG_LEVEL`            | `info`        | Pino log level (`debug`, `info`, `warn`, `error`) |
| `RATE_LIMIT_WINDOW_MS` | `60000`       | Rate limit window in milliseconds    |
| `RATE_LIMIT_MAX`       | `100`         | Max requests per window per IP       |
| `CORS_ORIGIN`          | `*`           | Allowed CORS origin                  |

---

## Available Scripts

| Script               | Description                                 |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | Start with hot-reload (tsx watch)           |
| `npm run build`      | Compile TypeScript to `dist/`               |
| `npm start`          | Run compiled output (`dist/server.js`)      |
| `npm test`           | Run all tests (Vitest)                      |
| `npm run test:watch` | Run tests in watch mode                     |
| `npm run test:coverage` | Run tests with coverage report           |

---

## API Reference

### Base URL

```
http://localhost:3000
```

### Endpoints

| Method   | Path          | Description              |
| -------- | ------------- | ------------------------ |
| `GET`    | `/users`      | List users (paginated)   |
| `GET`    | `/users/:id`  | Get user by ID           |
| `POST`   | `/users`      | Create a user            |
| `PATCH`  | `/users/:id`  | Partially update a user  |
| `DELETE` | `/users/:id`  | Delete a user            |
| `GET`    | `/health`     | Health check             |
| `GET`    | `/docs`       | Swagger UI               |
| `GET`    | `/docs.json`  | Raw OpenAPI JSON spec    |

### Pagination

```
GET /users?page=2&limit=5
```

| Param   | Type    | Default | Max | Description       |
| ------- | ------- | ------- | --- | ----------------- |
| `page`  | integer | `1`     | —   | Page number       |
| `limit` | integer | `10`    | `100` | Items per page  |

---

## Example Requests

### List users

```bash
curl http://localhost:3000/users
```

```json
{
  "data": [
    {
      "id": "11111111-0000-0000-0000-000000000001",
      "name": "Alice Nguyen",
      "email": "alice@example.com",
      "role": "admin",
      "createdAt": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-10T08:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 10,
    "totalPages": 1
  }
}
```

### Get user by ID

```bash
curl http://localhost:3000/users/11111111-0000-0000-0000-000000000001
```

```json
{
  "data": {
    "id": "11111111-0000-0000-0000-000000000001",
    "name": "Alice Nguyen",
    "email": "alice@example.com",
    "role": "admin",
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-10T08:00:00.000Z"
  }
}
```

### Create a user

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe", "email": "jane@example.com", "role": "editor"}'
```

```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "editor",
    "createdAt": "2024-06-01T12:00:00.000Z",
    "updatedAt": "2024-06-01T12:00:00.000Z"
  }
}
```

### Partially update a user

```bash
curl -X PATCH http://localhost:3000/users/11111111-0000-0000-0000-000000000002 \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob Updated"}'
```

### Delete a user

```bash
curl -X DELETE http://localhost:3000/users/11111111-0000-0000-0000-000000000001
# HTTP 204 No Content
```

### Error responses

All errors follow a consistent shape:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User with id 'xyz' not found",
    "requestId": "e3b0c442-98fc-1234-b473-c0a8c0d0e001"
  }
}
```

| HTTP Status | Code                   | Trigger                          |
| ----------- | ---------------------- | -------------------------------- |
| 404         | `RESOURCE_NOT_FOUND`   | User ID not found                |
| 409         | `CONFLICT`             | Duplicate email                  |
| 422         | `VALIDATION_ERROR`     | Invalid request body/query       |
| 500         | `INTERNAL_SERVER_ERROR`| Unexpected server failure        |

Validation errors include a `details` array:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "email must be a valid email address" }
    ],
    "requestId": "..."
  }
}
```

---

## Request Correlation

Every request gets an `x-request-id` header in the response. Pass it in the request to reuse your own correlation ID (useful for distributed tracing):

```bash
curl http://localhost:3000/users \
  -H "x-request-id: my-trace-id-001"
```

The same ID appears in all log lines generated for that request.

---

## Seed Data

The in-memory store is pre-seeded with 10 users (roles: `admin`, `editor`, `viewer`). The store resets every time the server restarts — there is no persistence.

---

## Running Tests

```bash
npm test
```

The test suite covers:

- Paginated list (default and custom page/limit)
- Get user by ID (found and not found)
- Create user (success, validation error, duplicate email, invalid role)
- Partial update (success, not found, conflict, empty body)
- Delete user (success and not found)
- Simulated repository failure → 500 with safe message

---

## API Documentation

Swagger UI is available at:

```
http://localhost:3000/docs
```

Raw OpenAPI JSON spec:

```
http://localhost:3000/docs.json
```

---

## Project Structure

```
src/
  config.ts                   # Typed environment config
  app.ts                      # Express app factory
  server.ts                   # HTTP server + graceful shutdown
  shared/
    logger.ts                 # Pino instance (redacts sensitive fields)
    errors/
      AppError.ts             # Base operational error
      NotFoundError.ts
      ValidationError.ts
      ConflictError.ts
    middleware/
      requestId.ts            # x-request-id reuse/generation
      validate.ts             # Zod validation middleware factory
      errorHandler.ts         # Centralized error serialization
    types/
      pagination.ts           # PaginatedResult<T>, buildPaginationMeta
  modules/
    users/
      users.schema.ts         # Zod schemas + inferred types
      users.repository.ts     # In-memory store + seed data
      users.service.ts        # Business logic + logging
      users.controller.ts     # Thin HTTP handlers
      users.routes.ts         # Route registration + middleware wiring
docs/
  swagger.ts                  # Full OpenAPI 3.0.3 spec
tests/
  users/
    users.test.ts             # 24 integration tests
ARCHITECTURE.md               # Engineering decision log
```
