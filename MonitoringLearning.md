# Prometheus & Grafana — Learning Project

## Goal

Learn Prometheus and Grafana by building real observability into this Node.js/Express app from scratch — no shortcuts, no copy-paste configs. Every metric we add teaches a concept. Every PromQL query we write answers a real question about the running system.

## What you will be able to do after this

- Explain what Prometheus is and how it scrapes metrics from an app
- Explain what Grafana is and how it connects to Prometheus
- Know the 4 metric types (Counter, Gauge, Histogram, Summary) and when to use each
- Write PromQL queries: `rate()`, `histogram_quantile()`, `sum by()`, label filtering
- Build a Grafana dashboard from scratch with Time Series, Stat, Gauge, and Heatmap panels
- Write Prometheus alert rules and understand the PENDING → FIRING lifecycle
- Know what you get for free vs what you need to instrument yourself

---

## Project context

**Stack:** Node.js + Express + TypeScript  
**Current state:** Phase 4 ✅ complete. Cache layer + simulate routes built — cache hit/miss/size metrics, ratio PromQL, `histogram_quantile()` with `sum by(le)` mastered.  
**Next:** Phase 5 — PromQL mastery + recording rules.

**Services:** Two apps — **app** (user-management) and **user-info**. Both expose `/metrics` with the same metric names (`http_requests_total`, `http_request_duration_seconds`, etc.). Prometheus scrapes both; the `job` label from the scrape config (`user-management`, `user-info`) distinguishes them. Dashboards and recording rules can aggregate across jobs or filter by `job`.

```
user/                        ← Main app (user-management)
  src/app.ts, server.ts, shared/, modules/users/, ...
user-info/                  ← Second service
  src/app.ts, metrics, routes (e.g. /user/:id/profile), ...
docker-compose.yml           ← app (user-management), user-info, Loki, Prometheus, Grafana
prometheus/prometheus.yml    ← scrape_configs: user-management (app:3000), user-info (user-info:3000)
prometheus/rules/            ← recording_rules.yml (aggregates by job)
grafana/                     ← provisioning, dashboards
```

---

## How Prometheus + Grafana work together

```
Express App (:3000/metrics)  ──scrape every 5s──▶  Prometheus (:9090)
                                                          │
                                               PromQL queries
                                                          │
                                                          ▼
                                                  Grafana (:3001)
```

- **Prometheus** pulls (scrapes) `GET /metrics` from your app on a schedule and stores the time-series data in its own TSDB.
- **Grafana** is a dashboard UI. It sends PromQL queries to Prometheus and renders the results as panels.
- You write PromQL in both places: the Prometheus UI (for exploration) and Grafana (for dashboards).

---

## The 4 metric types

| Type          | Goes down? | Use for                                    | PromQL                                  |
| ------------- | ---------- | ------------------------------------------ | --------------------------------------- |
| **Counter**   | Never      | Total requests, errors, cache misses       | `rate()`, `increase()`                  |
| **Gauge**     | Yes        | Heap used, in-flight requests, queue depth | Raw value, no `rate()` needed           |
| **Histogram** | N/A        | Request duration, DB query time            | `histogram_quantile()`                  |
| **Summary**   | N/A        | Client-side quantiles                      | Avoid — can't aggregate across replicas |

---

## Histogram vs Summary

Both measure distributions (latency, size). The difference is **who computes the percentiles**.

Given 5 requests: `10ms, 20ms, 30ms, 80ms, 100ms`

**Summary** — app computes percentiles internally, exports pre-baked numbers:

```
http_request_duration_seconds{quantile="0.5", route="/users"}  0.030
http_request_duration_seconds{quantile="0.95",route="/users"}  0.100
http_request_duration_seconds{quantile="0.99",route="/users"}  0.100
http_request_duration_seconds_sum{route="/users"}              0.240
http_request_duration_seconds_count{route="/users"}            5
```

**Histogram** — app exports raw bucket counts, Prometheus computes percentiles at query time:

```
http_request_duration_seconds_bucket{le="0.005",route="/users"}  0
http_request_duration_seconds_bucket{le="0.01", route="/users"}  1
http_request_duration_seconds_bucket{le="0.025",route="/users"}  2
http_request_duration_seconds_bucket{le="0.05", route="/users"}  3
http_request_duration_seconds_bucket{le="0.1",  route="/users"}  5
http_request_duration_seconds_bucket{le="+Inf", route="/users"}  5
http_request_duration_seconds_sum{route="/users"}                0.240
http_request_duration_seconds_count{route="/users"}              5
```

**Why Histogram wins with multiple replicas:**

```
App1 (fast):  P95 = 30ms
App2 (slow):  P95 = 580ms

Summary:  avg(30, 580) = 216ms  ← mathematically wrong
Histogram: bucket counts add up → histogram_quantile() gives correct fleet-wide P95
```

| | Summary | Histogram |
| --- | --- | --- |
| Who computes P95 | App (pre-baked) | Prometheus at query time |
| Aggregatable across replicas | No | Yes |
| Accuracy | Exact | Approximate (interpolated between buckets) |
| Extra lines in /metrics | `quantile=` | `_bucket` with `le=` |
| Use for HTTP latency | Avoid | Always |

**When Summary is acceptable:** single replica + need exact quantiles + cardinality cost of Histogram matters.

---

## What's free vs what we build

`collectDefaultMetrics` (one function call) gives 30+ metrics with zero instrumentation:

| Free metric                         | Type      | Good for learning                         |
| ----------------------------------- | --------- | ----------------------------------------- |
| `nodejs_heap_size_used_bytes`       | Gauge     | Gauge concept — snapshot of current state |
| `nodejs_eventloop_lag_p99_seconds`  | Gauge     | Event loop blocking detection             |
| `nodejs_gc_duration_seconds_bucket` | Histogram | Histogram bucket structure                |
| `process_cpu_seconds_total`         | Counter   | Counter + `rate()` concept                |

**We build only what's missing** — there are no HTTP-level metrics out of the box:

| Custom metric                                   | Type      | Phase   |
| ----------------------------------------------- | --------- | ------- |
| `http_requests_total{method,route,status_code}` | Counter   | Phase 2 |
| `http_requests_in_flight{method}`               | Gauge     | Phase 2 |
| `http_request_duration_seconds`                 | Histogram | Phase 3 |
| `cache_hits_total{cache}`                       | Counter   | Phase 4 |
| `cache_misses_total{cache}`                     | Counter   | Phase 4 |
| `cache_size{cache}`                             | Gauge     | Phase 4 |

---

## Build plan

### Task 0 — Setup ✅ DONE

Install `prom-client`, expose `GET /metrics`, add Prometheus + Grafana to Docker Compose.

Files to create:

- `src/shared/metrics.ts` — Registry + `collectDefaultMetrics` only
- Add `/metrics` route to `src/app.ts`
- Add `prometheus` + `grafana` services to `docker-compose.yml`
- `prometheus/prometheus.yml` — scrape config (target: `app:3000`, interval: 15s)
- `grafana/provisioning/datasources/prometheus.yml` — auto-wire Grafana → Prometheus
- `docker compose up --build`

**Verify:**

```bash
# Raw metric output from the app
curl http://localhost:3000/metrics | grep nodejs_heap

# Prometheus scraped it successfully — should show state="up"
curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool | grep '"health"'

# Grafana is reachable
curl -s http://localhost:3001/api/health
```

Open `http://localhost:9090/targets` — the `user-management` target must show **State: UP** (green). If it shows DOWN, Prometheus can't reach the app.

---

### Phase 1 — Explore free metrics + PromQL basics (no new code) ✅ DONE

Use the 30+ free default metrics to learn PromQL syntax before writing any custom instrumentation.

Key queries to run in `http://localhost:9090`:

```promql
nodejs_heap_size_used_bytes
nodejs_eventloop_lag_p99_seconds
rate(process_cpu_seconds_total[1m])
histogram_quantile(0.99, rate(nodejs_gc_duration_seconds_bucket[5m]))
```

Build first Grafana Stat panel: live heap usage.

**Learn:** Gauge vs Counter vs Histogram syntax. Why `rate()` transforms a Counter into something useful. How `histogram_quantile()` works on the free GC histogram.

**Verify:**

- Run each of the 4 queries above in the Prometheus UI — all must return a numeric result (not empty)
- `nodejs_gc_duration_seconds_bucket` — click the **Table** tab, confirm you see multiple rows with different `le` values (those are the buckets)
- Grafana `http://localhost:3001` → Explore → select Prometheus datasource → run `nodejs_heap_size_used_bytes` → graph should update every 15s
- First Grafana Stat panel shows a number (bytes), refreshes automatically

---

### Phase 2 — Counter + Gauge: HTTP traffic middleware ✅ DONE

**Why:** No default metric tracks requests per route/status or concurrent in-flight HTTP connections.

Files to create/modify:

- Add `http_requests_total` (Counter) + `http_requests_in_flight` (Gauge) to `src/shared/metrics.ts`
- Create `src/shared/middleware/httpMetrics.ts` — increment on request start/finish
- Mount in `src/app.ts`

Key PromQL:

```promql
rate(http_requests_total[5m])
rate(http_requests_total{status_code="404"}[5m])
http_requests_in_flight
```

**Learn:** Counter never goes down — `rate()` is what you alert on. Gauge is already a snapshot — query it raw. Label cardinality: use `req.route?.path` (Express pattern) not the real URL or you get one time series per user ID.

**Verify:**

```bash
# Generate some traffic
curl http://localhost:3000/users
curl http://localhost:3000/users/does-not-exist
curl http://localhost:3000/health

# Check the raw metric text
curl -s http://localhost:3000/metrics | grep http_requests_total
```

Expected output contains lines like:

```
http_requests_total{method="GET",route="/users",status_code="200",...} 1
http_requests_total{method="GET",route="unknown",status_code="404",...} 1
```

In Prometheus UI: `http_requests_total` must return at least 2 series with different `route` labels. `http_requests_in_flight` should show `0` between requests (spike to 1+ during a slow request).

---

### Phase 3 — Histogram: HTTP request latency ✅ DONE

**Why:** The free GC histogram rarely fires during dev — you can't experiment with it. HTTP latency fires on every request.

Extend `src/shared/middleware/httpMetrics.ts` — add `startTimer()` / `stopTimer()`. Add `http_request_duration_seconds` Histogram to `src/shared/metrics.ts` with buckets tuned for REST APIs.

Key PromQL:

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])
```

**Learn:** Prometheus auto-generates `_bucket`, `_sum`, `_count` from one Histogram definition. `le` is the bucket boundary label. P95 vs average — averages hide the worst 5% of your users.

**Verify:**

```bash
# Confirm all 3 auto-generated series exist
curl -s http://localhost:3000/metrics | grep http_request_duration_seconds | head -20
```

You must see lines with `_bucket`, `_sum`, and `_count` suffixes. In Prometheus UI:

- `http_request_duration_seconds_bucket` → Table view → multiple rows with `le="0.005"`, `le="0.01"`, etc.
- `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` → returns a number in seconds (e.g. `0.003`)
- Grafana Time Series panel shows three lines (P50 / P95 / P99) all rendering without errors

---

### Phase 4 — Cache layer + /simulate routes ✅ DONE

Add features that make all metrics interesting and controllable.

**In-memory cache on `GET /users/:id`:**

- `Map<string, {user, expiresAt}>` with 30s TTL in `src/modules/users/users.service.ts`
- Track `cache_hits_total`, `cache_misses_total` (Counters), `cache_size` (Gauge)

**New `/simulate` module (`src/modules/simulate/`):**

- `GET /simulate/slow?ms=500` — artificial delay, makes P95 spike visibly
- Append `?error=true` to `GET /user/:id/info` after normal request processing to force an HTTP 500, used to trigger alerts deterministically
- `GET /simulate/cpu?duration=2000` — CPU loop, makes `nodejs_eventloop_lag_p99_seconds` spike

Key PromQL (derived ratio metric):

```promql
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100
```

**Learn:** The most useful production metrics are ratios. PromQL computes the ratio at query time from two raw Counters — no pre-computation in application code needed.

**Verify:**

```bash
# Create a user and fetch it twice — first call misses cache, second hits
USER_ID=$(curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","role":"user"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl http://localhost:3000/users/$USER_ID   # miss
curl http://localhost:3000/users/$USER_ID   # hit

# Confirm both counters exist
curl -s http://localhost:3000/metrics | grep cache_

# Simulate a slow request and watch P95 jump
curl "http://localhost:3000/simulate/slow?ms=800"
# Then check P95 in Prometheus — should be near 0.8s

# Simulate errors
curl "http://localhost:3000/user/1/info?error=true"  # always 500
```

In Prometheus UI: `cache_hits_total` and `cache_misses_total` both have values. Cache hit rate query returns a number between 0 and 1. After hitting `/simulate/slow?ms=800`, P95 visibly increases in the Grafana Time Series panel.

---

### Phase 5 — PromQL mastery + recording rules

**PromQL exercises first** — run these in the Prometheus UI before touching recording rules:

```promql
# Request rate broken down by route
sum by(route) (rate(http_requests_total[5m]))

# Top 3 busiest routes
topk(3, sum by(route) (rate(http_requests_total[5m])))

# Error ratio (5xx / all)
sum(rate(http_requests_total{status_code=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))

# Fraction of requests under 100ms (poor man's Apdex)
sum(rate(http_request_duration_seconds_bucket{le="0.1"}[5m]))
  / sum(rate(http_request_duration_seconds_count[5m]))
```

**Learn:** `sum by()`, `without()`, `topk()`, label matchers (`=~`, `!=`), Apdex score.

---

#### Recording rules

**What they are:** Prometheus evaluates a PromQL expression on every scrape interval and saves the result as a brand-new metric. Grafana then queries that pre-computed metric instead of running the expensive expression on every dashboard load.

**When to use them:**
- Any `histogram_quantile()` call — computing percentiles fans out over every bucket label; pre-computing once and storing is dramatically cheaper at query time
- Any multi-label `sum by()` expression that appears in more than one dashboard panel or alert rule — don't repeat the computation, record it once
- Expressions that are slow in the Prometheus UI (>1s response) and are queried frequently
- Alert rule expressions that are complex — recording them first makes the alert rule simpler and easier to test independently

**When NOT to use them:**
- Simple counter or gauge reads (`http_requests_total`, `process_cpu_seconds_total`) — they're already cheap, recording them just creates noise
- One-off exploratory queries you run in the Prometheus UI — recording rules are for production, not investigation
- Metrics you only look at once a day — the overhead of computing and storing them every 15s is wasteful
- When the time window varies per query (e.g. sometimes `[5m]`, sometimes `[1h]`) — you'd need a separate rule per window, which defeats the purpose; just query raw
- Early in a project — add recording rules only when you can measure the problem (slow dashboard, high Prometheus CPU). Don't pre-optimise.

**Naming convention — always follow `level:metric:operation`:**

| Segment | Meaning | Example |
|---|---|---|
| `job` | aggregation level | `job` (aggregated across instances) |
| `http_requests_total` | base metric | the source metric name |
| `rate5m` | operation + window | `rate` over `5m` |

Full example: `job:http_requests_total:rate5m`

---

#### Step 1 — Wire the rules directory into prometheus.yml

Add to your `prometheus/prometheus.yml` (alongside the existing `scrape_configs`):

```yaml
rule_files:
  - "rules/*.yml"
```

---

#### Step 2 — Create `prometheus/rules/recording_rules.yml`

```yaml
groups:
  - name: http_request_rates
    interval: 15s   # evaluate every 15s; must be >= scrape_interval
    rules:
      # Pre-compute per-route request rate
      - record: job:http_requests_total:rate5m
        expr: sum by(job, route, method) (rate(http_requests_total[5m]))

      # Pre-compute per-route 5xx error rate
      - record: job:http_request_errors:rate5m
        expr: sum by(job, route) (rate(http_requests_total{status_code=~"5.."}[5m]))

      # Pre-compute P95 latency (the expensive histogram_quantile)
      - record: job:http_request_duration_p95:5m
        expr: >
          histogram_quantile(
            0.95,
            sum by(job, le) (rate(http_request_duration_seconds_bucket[5m]))
          )
```

---

#### Step 3 — Reload and verify

```bash
# Reload Prometheus so it picks up the new rule file
curl -X POST http://localhost:9090/-/reload

# Confirm rules loaded — should print three "name" entries
curl -s http://localhost:9090/api/v1/rules | python3 -m json.tool | grep '"name"'

# Query the pre-computed metrics directly (should return data immediately)
curl -s 'http://localhost:9090/api/v1/query?query=job:http_requests_total:rate5m' \
  | python3 -m json.tool | grep '"value"'

curl -s 'http://localhost:9090/api/v1/query?query=job:http_request_duration_p95:5m' \
  | python3 -m json.tool | grep '"value"'
```

---

#### Step 4 — Compare raw vs pre-computed in Prometheus UI

Open `http://localhost:9090` and run both queries side-by-side to feel the difference:

```promql
# Raw — Prometheus computes this on the fly every time
histogram_quantile(0.95, sum by(le) (rate(http_request_duration_seconds_bucket[5m])))

# Pre-computed — instant lookup, no fan-out
job:http_request_duration_p95:5m
```

Both must return the same value. The pre-computed one appears in autocomplete as a first-class metric.

---

#### Step 5 — Add a Grafana panel using the recording rule

In the Grafana dashboard from Phase 6 (or create a test panel now):

1. Add a new **Time Series** panel
2. Set the query to `job:http_request_duration_p95:5m`
3. Add a second query (series B) with the raw `histogram_quantile(...)` expression
4. Overlay both — they must be identical lines
5. Delete series B and save — the panel now uses the recording rule

This is how production dashboards are built: instrument → record → visualize.

---

**Verify:**

In Prometheus UI → **Status → Rules** — all three rules must show **State: ok** (not error).

- `job:http_requests_total:rate5m` returns data
- `job:http_request_errors:rate5m` returns data (may be 0 if no errors yet — trigger with `/user/1/info?error=true`)
- `job:http_request_duration_p95:5m` matches raw `histogram_quantile()` output
- Grafana panel using `job:http_request_duration_p95:5m` renders without "No data"

---

### Phase 6 — Grafana dashboard from scratch

Build entirely in the Grafana UI (no JSON files). One dashboard with:

- **Time Series** — request rate + error rate overlaid
- **Gauge visualization** — P95 latency with color thresholds (green/yellow/red)
- **Stat** — `http_requests_in_flight` with sparkline
- **Heatmap** — latency distribution (shows the shape, not just percentiles)
- **Dashboard variable** `$route` — filters all panels at once via `label_values()`

With multiple services, use the `job` label (and optionally a `$job` dashboard variable) to filter or compare per service; see the Phase 6 guide in `docs/Phase6-Grafana-Dashboard-Guide.md` for the multi-service steps (Phase D).

**Learn:** Panel types, time range controls, `$__rate_interval`, dashboard variables, color thresholds.

**Verify:**

- All 5 panel types render without "No data" or query errors (check the panel inspector)
- Change the time range to "Last 15 minutes" — all panels update
- Select a route from the `$route` dropdown — all panels filter to that route only
- The Gauge visualization changes color based on the P95 value (green when fast, red when slow — trigger `/simulate/slow` to confirm the red threshold works)
- The Heatmap shows a visible band of activity, not an empty grid

---

### Phase 7 — Alerting: write rules, trigger them, watch them fire

Create `prometheus/rules/alert_rules.yml`:

```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status_code=~"5.."}[1m]) / rate(http_requests_total[1m]) > 0.05
  for: 1m
  labels:
    severity: critical

- alert: HighP95Latency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
  for: 2m
  labels:
    severity: warning
```

Trigger intentionally:

```bash
while true; do curl -s "http://localhost:3000/user/1/info?error=true" > /dev/null; sleep 0.1; done
```

Watch `http://localhost:9090/alerts` cycle: **INACTIVE → PENDING → FIRING**

**Learn:** Alert rule anatomy (`expr`, `for`, `labels`, `annotations`). The `for` clause prevents flapping — the condition must be true for a full continuous window before firing. Without it, a single slow GC pause pages your on-call.

**Verify:**

```bash
# Reload rules after creating the file
curl -X POST http://localhost:9090/-/reload

# Check rules loaded cleanly
curl -s http://localhost:9090/api/v1/rules | python3 -m json.tool | grep -E '"name"|"state"'
```

In Prometheus UI → **Alerts**:

1. Before triggering: both alerts show **INACTIVE** (grey)
2. Start the error loop → within ~15s the alert shows **PENDING** (yellow) — condition is true but `for: 1m` not yet elapsed
3. After ~1 minute of sustained errors → alert turns **FIRING** (red)
4. Stop the loop → alert returns to INACTIVE within a few scrape cycles

Both state transitions (INACTIVE → PENDING and PENDING → FIRING) must be observed to consider this phase complete.

---

## Instruction for new agent session

> I am learning Prometheus and Grafana by building observability into a Node.js/Express app from scratch. The full plan is in `MonitoringLearning.md` at the root of this workspace.
>
> The app is a clean Express + TypeScript users CRUD API. `prom-client` is not installed yet. No Prometheus or Grafana config exists.
>
> Please read `MonitoringLearning.md` first, then help me execute the plan phase by phase, starting from Task 0. Teach me as we go — explain the "why" before writing code, and walk me through PromQL queries after each phase.
