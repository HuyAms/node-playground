# Phase 6 — Grafana Dashboard from Scratch

Build one dashboard entirely in the Grafana UI. No JSON import. Each step ends with a **Verify** so you can build and confirm before moving on.

---

## Before you start

- **Stack running:** `docker compose up` (app, Loki, Prometheus, Grafana).
- **Phase 5 done:** Recording rules exist in `prometheus/rules/recording_rules.yml` and Prometheus has loaded them (`curl -s http://localhost:9090/api/v1/rules` shows the rules).
- **Some traffic:** Hit the app so metrics exist (e.g. `curl http://localhost:3000/health`, `curl http://localhost:3000/users`). Otherwise `$route` and some panels may be empty.

**Variable “All”:** When you enable “Include All option” for `$route`, set the All value to `.*` so one query works for both “All” and a single route.

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
- Dropdown lists routes (e.g. `/users`, `/health`, `/simulate/slow`) and an “All” option.
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

- Both series show (request rate and error rate). If no traffic, zoom to “Last 5 minutes” and hit a few endpoints.
- Trigger errors: `curl "http://localhost:3000/simulate/error?rate=1.0"` a few times; error rate line should increase.

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

## Optional: Node and cache rows

**Row — Node (USE-style)**  
Add a Time series with:

- `nodejs_heap_size_used_bytes`
- `nodejs_eventloop_lag_p99_seconds`
- `rate(process_cpu_seconds_total[1m])`

Useful to see effect of `GET /simulate/cpu?duration=2000`.

**Row — Cache**  
Add:

- **Stat:** Cache hit rate:  
  `rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))`
- **Stat:** `cache_size{cache="users"}`

---

## Logs (Loki)

The app sends logs directly to Loki via **pino-loki** when `LOKI_URL` is set (e.g. `http://loki:3100` in Docker). Without `LOKI_URL`, the app only logs to stdout and/or file.

**View logs in Grafana:**

1. Open **Explore** (compass icon) → select data source **Loki**.
2. Use **LogQL** to query. Examples:
   - All app logs: `{job="node-playground"}`.
   - Filter by text: `{job="node-playground"} |= "requestId"` or `|= "error"`.
   - By level: `{job="node-playground"} | json | level="error"` (if the log line is JSON).
   - Any labels: try `{}` and check which labels exist (e.g. `level`, `hostname`).
3. Set time range and run query. You can correlate with metrics by time or by `requestId` in the log body.

**Tip:** To see logs, generate traffic (e.g. `curl http://localhost:3000/users`) and ensure the app container has `LOKI_URL` set so pino-loki is active.

---

## Concepts

- **Panel types:** Time series (trends), Gauge (single value + thresholds), Stat (value + sparkline), Heatmap (distribution over time).
- **$__rate_interval:** Grafana’s rate window for Prometheus; use in `rate(...[$__rate_interval])` unless you need a fixed window.
- **Variables:** `label_values(metric, label)` fills the dropdown; use `label=~"$var"` in queries. All = `.*` for “all values”.
- **Recording rules:** `job:http_request_duration_p95:5m` is aggregated (no `route`); for per-route P95 use the raw `histogram_quantile(...)` with `route=~"$route"`.
