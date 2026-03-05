# Shared Observability Package and npm Workspaces

> **Context:** Monorepo with `user`, `user-info`, and a shared `packages/observability` package. Node.js · Express · pino · prom-client · npm workspaces.

---

## Table of Contents

1. [What is the problem we are solving](#1-what-is-the-problem-we-are-solving)
2. [Solution](#2-solution)
3. [What is a Factory, and how do we use it here?](#3-what-is-a-factory-and-how-do-we-use-it-here)
4. [npm workspaces: how it works and how we utilize it](#4-npm-workspaces-how-it-works-and-how-we-utilize-it)
5. [Conclusion](#5-conclusion)

---

## 1. What is the problem we are solving

### Duplication

Each service (`user`, `user-info`) had its own copy of:

- **Logger setup** — pino, pino-http, pino-loki, with multistream (pretty / stdout / file / Loki), formatters, and redaction.
- **Metrics** — prom-client registry, default metrics, HTTP counters/gauges/histograms (`http_requests_total`, `http_request_duration_seconds`, etc.).
- **httpMetrics middleware** — identical Express middleware that records request count, in-flight gauge, and duration histogram.

So the same logic lived in `user/src/shared/logger.ts`, `user/src/shared/metrics.ts`, `user/src/shared/middleware/httpMetrics.ts` and again in `user-info/src/logger.ts`, `user-info/src/metrics.ts`, `user-info/src/middleware/httpMetrics.ts`.

### Drift risk

With two copies, behavior can diverge:

- **Redaction paths** — e.g. `req.headers.authorization`, `*.password` — might be updated in one service and forgotten in the other.
- **Log formatters and levels** — same risk.
- **Metric names, labels, or histogram buckets** — a change in one place breaks consistency for Prometheus/Grafana (e.g. different bucket boundaries).
- **Already present:** Different Loki `job` labels (`user-management` vs `user-info`), different `ignorePaths` for HTTP auto-logging (user ignored `/docs`, user-info did not), and only the user service had cache metrics (`cache_hits_total`, etc.).

### Outcome

Inconsistent observability across services, and every improvement or fix had to be applied in multiple places. Adding a third service would have meant another full copy and more drift.

---

## 2. Solution

### Single shared package

We introduced **`packages/observability`** (npm name: **`@node-playground/observability`**) as the single source of truth for logging and Prometheus metrics. Both apps depend on this package and call into it; they no longer implement their own logger/metrics/middleware from scratch.

### What is a Factory, and how do we use it here?

A **factory** is a function (or method) that **creates and returns** an instance of something — an object, a configured module, or a set of related instances — instead of exposing a single shared instance. Callers pass in options; the factory uses those options to build the right thing and return it. That way each caller gets its own configured instance without the library holding global state or reading from the environment.

In this package we use the factory pattern in two places:

- **createLogger(options)** — Builds a pino logger and an HTTP logging middleware from the options you pass (`env`, `logLevel`, `job`, `ignorePaths`, etc.). Each service calls it once at startup and gets a logger tailored to that service (e.g. different `job` for Loki). The package never reads `process.env`; the app owns config and passes it in.
- **createMetrics(options?)** — Builds a Prometheus registry and the standard HTTP metrics (counters, gauge, histogram), and optionally runs your `extraMetrics(registry)` to add service-specific metrics. Each service gets its own registry and metric instances. Again, no env inside the package; the app decides whether to pass `extraMetrics`.

So instead of importing a pre-made `logger` or `registry` from the package, each app calls **createLogger(...)** and **createMetrics(...)** and uses what they return. That keeps the library stateless and testable, and lets each service plug in its own `job`, `ignorePaths`, and extra metrics without the package needing to know about them.

### Factory API (no env inside the package)

The package does **not** read environment variables. The app passes in everything it needs, so each service keeps full control over config (e.g. from its own `config.ts` and `.env`).

- **createLogger(options)**
  - Options: `env`, `logLevel`, `logFile?`, `lokiUrl?`, `job` (Loki stream label), `ignorePaths?` (paths to skip for HTTP auto-logging).
  - Returns `{ logger, httpLogger }` with shared redaction, formatters, and multistream (pretty in non-production, stdout, optional file, optional Loki with the given `job`).
  - Example: user service uses `job: 'user-management'` and `ignorePaths: ['/health', '/metrics', '/docs']`; user-info uses `job: 'user-info'` and `ignorePaths: ['/health', '/metrics']`.

- **createMetrics(options?)**
  - Optional `extraMetrics(registry)` — a function that receives the shared registry and returns extra metrics (e.g. cache counters/gauges).
  - Returns `{ registry, httpRequestsTotal, httpRequestsInFlight, httpRequestDuration, ...extra }`.
  - User service passes `extraMetrics` that creates `cacheHitsTotal`, `cacheMissesTotal`, `cacheSize`; user-info calls `createMetrics()` with no options.

- **httpMetrics(metrics)**
  - Takes the three HTTP metric instances returned by `createMetrics` and returns Express middleware that records request count, in-flight gauge, and duration histogram.
  - Same logic everywhere; no per-service copy.

### Per-service usage

Each service keeps a **thin wrapper** that calls the package with service-specific config:

- **user:** `user/src/shared/logger.ts` and `user/src/shared/metrics.ts` call `createLogger` / `createMetrics` with `job: 'user-management'`, user’s `ignorePaths`, and cache `extraMetrics`. The app then uses `httpMetrics({ httpRequestsTotal, httpRequestsInFlight, httpRequestDuration })` from the package.
- **user-info:** Same pattern with `job: 'user-info'` and no `extraMetrics`.

Prometheus and Loki config do not change: same `job_name`s and metric names, so existing dashboards and alerts keep working.

---

## 4. npm workspaces: how it works and how we utilize it

### What npm workspaces do

In the **root** `package.json` we declare:

```json
"workspaces": ["user", "user-info", "packages/observability"]
```

This tells npm that `user/`, `user-info/`, and `packages/observability/` are workspace packages. When you run **`npm install`** at the repo root:

- npm installs dependencies for all workspaces and **hoists** shared dependencies where possible (one copy of `pino`, `express`, etc. at the root `node_modules` when versions align).
- Workspace packages are **symlinked** into the root `node_modules`. For example, `node_modules/@node-playground/observability` points at `packages/observability/`, so any package that depends on `@node-playground/observability` resolves to the local package instead of npm’s registry.
- No need to publish the observability package; the apps always use the local build.

### How we use it

- **Root** has no application code — only the `workspaces` array and scripts (e.g. `docker:up`, `docker:up:build`). All app and library code lives under the workspace directories.
- **packages/observability** is a buildable library: it has its own `package.json`, `tsconfig.json`, and `src/`. It builds to `dist/` (TypeScript → JavaScript + types). It does **not** depend on `user` or `user-info`; only the apps depend on it.
- **user** and **user-info** list `"@node-playground/observability": "1.0.0"` in their `dependencies`. npm resolves that to the workspace package, so at runtime they use the built `dist/` of the observability package (e.g. `dist/index.js`).

### Build order

Because the apps depend on the library, we build in this order:

1. From repo root: **`npm install`** (once).
2. **Build the library:** `cd packages/observability && npm run build`.
3. **Build the apps:** `cd user && npm run build` and `cd user-info && npm run build`.

Then run each service with `npm run dev` (or `npm start`) from its directory. The README “Workspace build” section documents this.

---

## 5. Conclusion

Introducing a **shared observability package** and **npm workspaces** gives us:

- **One place** to update redaction, histogram buckets, and metric names — consistent behavior across all services.
- **No change** to Prometheus or Loki config; same job names and metric names, so existing dashboards and alerts continue to work.
- **Clear dependency direction:** apps depend on the package; the package does not depend on the apps.

The trade-off is that the repo is now a **monorepo** with an explicit build step for the shared package. In return, adding a new service is a matter of depending on `@node-playground/observability` and wiring `createLogger` / `createMetrics` / `httpMetrics` with that service’s `job` and options — no copy-paste of logger or metrics code.

The same pattern can extend to other shared concerns later (e.g. a shared `requestId` middleware or common error types) by adding more packages under `packages/` and listing them in the root `workspaces` array.
