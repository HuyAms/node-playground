# OpenTelemetry Instrumentation Guidelines

> Span naming, what to instrument, and avoiding over-instrumentation.

---

## Table of Contents

1. [Span Naming](#1-span-naming)
2. [What to Instrument](#2-what-to-instrument)
3. [What NOT to Instrument](#3-what-not-to-instrument)
4. [Decision Tree](#4-decision-tree)
5. [Target Span Count](#5-target-span-count)
6. [Resources](#6-resources)

---

## 1. Span Naming

**Rule:** Use `{verb} {object}` — a verb describing the work, and a noun describing what is acted upon.

- **Low cardinality:** Keep span names aggregable. Put unique IDs in attributes, not in the span name.
- **Examples:** `get user`, `list users`, `create user`, `fetch profile`, `simulate cpu`

| Bad | Good |
|-----|------|
| `users.getById` | `get user` |
| `process_payment_for_user_jane_doe` | `process payment` |
| `sendinvoice#98765` | `send invoice` |

**Source:** [How to Name Your Spans](https://opentelemetry.io/blog/2025/how-to-name-your-spans/) (OpenTelemetry Blog)

---

## 2. What to Instrument

Create spans for operations that are:

1. **Independently failing** — Operations that can fail for their own reasons
2. **Cross-service boundaries** — Any call to another service (HTTP, gRPC)
3. **Potentially slow** — Operations that could take variable time
4. **Business-critical steps** — Payment processing, order validation, inventory checks
5. **I/O bound** — Database queries, HTTP calls, cache lookups, file reads, message queues

**Source:** [Avoid Instrumenting Every Function](https://oneuptime.com/blog/post/2026-02-06-avoid-instrumenting-every-function/view) (OneUptime)

---

## 3. What NOT to Instrument

Skip spans for:

1. **Sub-millisecond operations** — Anything faster than 1ms is noise
2. **Utility functions** — Logging, formatting, type conversions
3. **Simple getters/setters** — Property access, configuration lookups
4. **Pure computation** — String formatting, JSON parsing, math
5. **In-memory data access** — Array lookups, in-memory caches (when no real I/O)

**Source:** [Avoid Instrumenting Every Function](https://oneuptime.com/blog/post/2026-02-06-avoid-instrumenting-every-function/view)

---

## 4. Decision Tree

For each function you are considering instrumenting:

```
Does it involve I/O (network, disk, database)?
  YES -> Create a span
  NO  -> Does it represent a meaningful business step?
    YES -> Create a span
    NO  -> Does it take more than 5ms typically?
      YES -> Create a span
      NO  -> Use attributes or events on the parent span
```

**Source:** [Avoid Instrumenting Every Function](https://oneuptime.com/blog/post/2026-02-06-avoid-instrumenting-every-function/view)

---

## 5. Target Span Count

**Aim for 3 to 15 spans per request** in a typical web service.

- Enough detail to identify bottlenecks
- Not so many that traces become noisy and expensive
- If you need to investigate a specific slow operation, add spans temporarily and remove after

**Source:** [Avoid Instrumenting Every Function](https://oneuptime.com/blog/post/2026-02-06-avoid-instrumenting-every-function/view)

---

## 6. Resources

| Topic | Resource | URL |
|-------|----------|-----|
| Span naming | How to Name Your Spans | https://opentelemetry.io/blog/2025/how-to-name-your-spans/ |
| Over-instrumentation | Avoid Instrumenting Every Function | https://oneuptime.com/blog/post/2026-02-06-avoid-instrumenting-every-function/view |
| Span attributes | How to Name Your Span Attributes | https://opentelemetry.io/blog/2025/how-to-name-your-span-attributes/ |
| Library instrumentation | OTel Instrumentation (Libraries) | https://opentelemetry.io/docs/concepts/instrumentation/libraries |
| Manual instrumentation (JS) | OTel Instrumentation (JS) | https://opentelemetry.io/docs/languages/js/instrumentation/ |
| Trace conventions | Trace Semantic Conventions | https://opentelemetry.io/docs/specs/semconv/general/trace/ |
| HTTP spans | HTTP Span Conventions | https://opentelemetry.io/docs/specs/semconv/http/http-spans/ |
| Trace API | OTel Trace API Spec | https://opentelemetry.io/docs/specs/otel/trace/api/ |
