# Phase 6 — Grafana Dashboard from Scratch

Build one dashboard entirely in the Grafana UI. No JSON import. Each step ends with a **Verify** so you can build and confirm before moving on.

---

## What you will learn

- **Panel types:** Time series (trends), Gauge (single value + thresholds), Stat (value + sparkline), Heatmap (distribution over time).
- **PromQL:** `rate()`, `histogram_quantile()`, `$__rate_interval`, label matchers (`=~`, `.*`).
- **Variables:** `label_values(metric, label)` to fill dropdowns; `route=~"$route"` in queries; “All” = `.*`.
- **Microservices:** The `job` label (e.g. `user-management`, `user-info`) from Prometheus scrape config; per-service vs aggregate queries; when to add a `$job` variable to filter or compare services.

---

## Before you start

- **Stack running:** `docker compose up` — app (user-management), user-info, Loki, Prometheus, Grafana.
- **Phase 5 done:** Recording rules exist in `prometheus/rules/recording_rules.yml` and Prometheus has loaded them (`curl -s http://localhost:9090/api/v1/rules` shows the rules). Both jobs are scraped: `up{job=~"user-management|user-info"}` = 1 in Prometheus.
- **Some traffic:** Hit both services so metrics exist. User-management: `curl http://localhost:3000/health`, `curl http://localhost:3000/users`. User-info: `curl http://localhost:3002/health`, `curl http://localhost:3002/user/1/profile`. Otherwise `$route` and some panels may be empty.

**Variable “All”:** When you enable “Include All option” for `$route`, set the All value to `.*` so one query works for both “All” and a single route.

---

## Phase A — Dashboard and one variable (Steps 1–2)

**Goal:** Create the dashboard, add `$route`, and build the first panel (Time Series: request rate + error rate).  
**Verify:** Dropdown and panel show data; changing `$route` filters the panel.

---

## Step 1 — Create dashboard and variable `$route`

1. Open **http://localhost:3001** → **Dashboards** → **New** → **New dashboard**.
2. **Settings** (gear icon) → **Variables** → **Add variable**:
   - **Name:** `route`
   - **Type:** Query
   - **Data source:** Prometheus
   - **Query:** `label_values(http_requests_total, route)`
   - **Refresh:** On dashboard load (or On time range change)
   - **Include All option:** On
   - **Custom all value:** `.*`
   - Save.
3. Save the dashboard (e.g. name: **Node Playground — Observability**).

**Verify:**

- Top of dashboard shows a **route** dropdown.
- Dropdown lists routes from both services (e.g. `/users`, `/health`, `/simulate/slow`, `/user/:id/profile`) and an “All” option.
- Changing the selection updates the variable (you’ll use it in later steps).

---

## Step 2 — Time Series: request rate and error rate (RED: Rate + Errors)

1. **Add** → **Visualization** → **Time series**.
2. **Query A** — request rate (RED: Rate):
   - `sum by(route) (rate(http_requests_total{route=~"$route"}[$__rate_interval]))`
   - Legend: `Request rate`.
3. **Query B** — 5xx error rate (RED: Errors):
   - `sum(rate(http_requests_total{status_code=~"5..",route=~"$route"}[$__rate_interval]))`
   - Legend: `Error rate (5xx)`.
4. Panel title: e.g. **Traffic & errors**.

**Verify:**

- Both series show (request rate and error rate). If no traffic, zoom to “Last 5 minutes” and hit a few endpoints (e.g. `curl http://localhost:3000/users`, `curl http://localhost:3002/user/1/profile`).
- Trigger errors: `curl "http://localhost:3000/simulate/error?rate=1.0"` a few times; error rate line should increase.

---

## Phase B — RED + saturation (Steps 3–4)

**Goal:** Add Gauge (P95 latency) and Stat (in-flight). Optionally use the recording rule for P95 where it fits.  
**Verify:** Thresholds and sparkline behave; Gauge turns yellow/red after slow requests; Stat shows 1+ during a long request.

---

## Step 3 — Gauge: P95 latency (RED: Duration)

1. **Add** → **Visualization** → **Gauge**.
2. **Query** — P95 latency (our recording rule is job-level only, so use raw query for per-route):
   - `histogram_quantile(0.95, sum by(le) (rate(http_request_duration_seconds_bucket{route=~"$route"}[$__rate_interval])))`
3. **Standard options** → **Unit:** seconds (s) or milliseconds (ms).
4. **Thresholds:** Base green, then:
   - Green: 0–0.1 (0–100 ms)
   - Yellow: 0.1–0.5 (100–500 ms)
   - Red: > 0.5 (> 500 ms)
5. **Min:** 0, **Max:** 1 (or 2 if you test with very slow simulate).
6. Panel title: e.g. **P95 latency**.

**Verify:**

- Gauge shows a value (e.g. &lt; 0.1 s when idle).
- Run: `curl "http://localhost:3000/simulate/slow?ms=800"` a few times. Within a couple of minutes the gauge should move into yellow/red.

---

## Step 4 — Stat: in-flight requests (Golden signal: Saturation)

1. **Add** → **Visualization** → **Stat**.
2. **Query:** `sum(http_requests_in_flight)`
   - (This metric has only `method`, not `route`, so we don’t add `$route` here.)
3. **Panel options** → enable **Graph mode** / **Sparkline**.
4. Panel title: e.g. **In-flight requests**.

**Verify:**

- Idle: value 0. Start a slow request in another terminal: `curl "http://localhost:3000/simulate/slow?ms=5000"`. While it runs, the stat should show 1 (or more). When it finishes, it drops back.

---

## Phase C — Distribution and wiring (Steps 5–6)

**Goal:** Add the Heatmap, then ensure `$route` is applied to all panels that support it.  
**Verify:** Heatmap shows a band of activity; changing `$route` filters Traffic, P95, and Heatmap; final checklist passes.

---

## Step 5 — Heatmap: latency distribution

1. **Add** → **Visualization** → **Heatmap**.
2. **Query:** `sum by(le) (rate(http_request_duration_seconds_bucket{route=~"$route"}[$__rate_interval]))`
3. In the panel, set **Format:** **Time series buckets** (so Grafana treats the result as heatmap buckets).
4. Panel title: e.g. **Latency distribution**.

**Verify:**

- You see a band of activity over time. More traffic or `/simulate/slow` calls should change the shape (e.g. more mass in higher buckets).

---

## Step 6 — Wire `$route` to all panels that support it

Go through each panel and ensure any metric with a `route` label uses `route=~"$route"` in the selector.

| Panel              | Uses `$route`? | Notes                                                                 |
|--------------------|----------------|-----------------------------------------------------------------------|
| Traffic & errors   | Yes            | Already has `route=~"$route"` in both queries.                       |
| P95 latency        | Yes            | Already has `route=~"$route"`.                                        |
| In-flight requests | No             | Metric has no `route` label; leave as-is.                             |
| Latency heatmap    | Yes            | Already has `route=~"$route"`.                                        |

If you added any other panels that use `http_requests_total`, `http_request_duration_seconds_*`, or `job:http_requests_total:rate5m` / `job:http_request_errors:rate5m`, add `route=~"$route"` to their query.

**Verify:**

- Set time range to **Last 15 minutes**.
- Select **All** in `$route`: all panels show data (or no data consistently).
- Select a single route (e.g. `/simulate/slow`): Traffic, P95, and Heatmap panels only reflect that route. In-flight still shows global count (expected).

---

## Step 7 — Final dashboard check

- [ ] Variable **route** exists, populates from `label_values(http_requests_total, route)`, and has All = `.*`.
- [ ] **Time Series:** Request rate + error rate overlaid; no “No data” with recent traffic.
- [ ] **Gauge:** P95 with green/yellow/red; turns yellow/red after `curl "http://localhost:3000/simulate/slow?ms=800"`.
- [ ] **Stat:** In-flight with sparkline; goes to 1+ during a long `/simulate/slow` request.
- [ ] **Heatmap:** Latency distribution visible; shape changes with traffic/slow requests.
- [ ] **Time range** “Last 15 minutes” updates all panels.
- [ ] Changing **$route** filters Traffic, P95, and Heatmap; In-flight is unchanged (by design).

---

## Phase D — Multi-service (optional)

**Goal:** Understand the `job` label; add an optional `$job` variable and a panel that compares or filters by service.  
**Verify:** You can switch “All” vs “user-management” vs “user-info” and see per-service series.

Prometheus adds the `job` label from the scrape config. The same metric name from different targets appears as different series (e.g. `http_requests_total{job="user-management",...}` vs `job="user-info"`).

### Optional variable `$job`

1. **Settings** → **Variables** → **Add variable**:
   - **Name:** `job`
   - **Type:** Query
   - **Data source:** Prometheus
   - **Query:** `label_values(http_requests_total, job)`
   - **Refresh:** On dashboard load (or On time range change)
   - **Include All option:** On
   - **Custom all value:** `.*`
   - Save.

### Optional panel: Request rate by service

Add a **Time series** panel with query:

```promql
sum by(job) (rate(http_requests_total{route=~"$route",job=~"$job"}[$__rate_interval]))
```

This lets you compare user-management vs user-info request rates.

### Where to use `$job`

Add `job=~"$job"` to any query that should be filterable by service: Traffic & errors, P95 latency, Latency heatmap. In-flight can stay global, or add `job=~"$job"` if you want to filter it by service (both services expose it).

**Verify:** With “All” you see both jobs; selecting one job shows only that service’s series.

---

## Optional: Node and cache rows

With two jobs, Node and Cache metrics may exist only for **user-management** (the main app). If a query returns no data, scope it: e.g. `nodejs_heap_size_used_bytes{job="user-management"}`.

**Row — Node (USE-style)**  
Add a Time series with:

- `nodejs_heap_size_used_bytes` (add `{job="user-management"}` if needed)
- `nodejs_eventloop_lag_p99_seconds` (add `{job="user-management"}` if needed)
- `rate(process_cpu_seconds_total[1m])` (add `{job="user-management"}` if needed)

Useful to see effect of `GET /simulate/cpu?duration=2000`.

**Row — Cache** (user-management only; user-info has no cache)  
Add:

- **Stat:** Cache hit rate:  
  `rate(cache_hits_total{job="user-management"}[5m]) / (rate(cache_hits_total{job="user-management"}[5m]) + rate(cache_misses_total{job="user-management"}[5m]))`
- **Stat:** `cache_size{cache="users",job="user-management"}`

---

## Logs (Loki)

The app sends logs directly to Loki via **pino-loki** when `LOKI_URL` is set (e.g. `http://loki:3100` in Docker). Without `LOKI_URL`, the app only logs to stdout and/or file.

**View logs in Grafana:**

1. Open **Explore** (compass icon) → select data source **Loki**.
2. Use **LogQL** to query. Examples:
   - All app logs: `{job="user-management"}`.
   - Filter by text: `{job="user-management"} |= "requestId"` or `|= "error"`.
   - By level: `{job="user-management"} | json | level="error"` (if the log line is JSON).
   - Any labels: try `{}` and check which labels exist (e.g. `level`, `hostname`).
3. Set time range and run query. You can correlate with metrics by time or by `requestId` in the log body.

**Tip:** To see logs, generate traffic (e.g. `curl http://localhost:3000/users`) and ensure the app container has `LOKI_URL` set so pino-loki is active.

---

## Concepts

- **Panel types:** Time series (trends), Gauge (single value + thresholds), Stat (value + sparkline), Heatmap (distribution over time).
- **$__rate_interval:** Grafana’s rate window for Prometheus; use in `rate(...[$__rate_interval])` unless you need a fixed window.
- **Variables:** `label_values(metric, label)` fills the dropdown; use `label=~"$var"` in queries. All = `.*` for “all values”.
- **Recording rules:** `job:http_request_duration_p95:5m` is aggregated (no `route`); for per-route P95 use the raw `histogram_quantile(...)` with `route=~"$route"`.
- **Multi-service:** The `job` label comes from Prometheus scrape config; use `job=~"$job"` in queries when you have a `$job` variable to filter or compare services.
