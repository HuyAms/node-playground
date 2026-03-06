# Phase 6 — Grafana Dashboard from Scratch

Build one dashboard entirely in the Grafana UI. No JSON import. Each step ends with a **Verify** so you can build and confirm before moving on.

---

## Dashboard purpose and metrics

### What this dashboard is

**One-sentence definition:**  
A single **HTTP API health** dashboard that answers: *"Are my services up, how busy are they, how fast and how correct are the responses?"*

**Scope:**

- **Services:** `user-management` and `user-info` (the two scraped jobs).
- **Focus:** Request-level behavior (traffic, errors, latency, in-flight). Optional rows for Node/cache when you add them.
- **Audience:** You (learning), future you (debugging), or a teammate who needs to see "is the API healthy?" in one place.
- **Not:** Business KPIs, SLAs, or deep app logic—those would be separate dashboards.

**What it does:**

- Shows **traffic and errors** over time (RED: Rate, Errors).
- Shows **latency** (P95 and distribution) so you can spot slowness.
- Shows **in-flight requests** so you can see saturation/backlog.
- Lets you **filter by route** (and optionally by job) so you can narrow to "what's wrong with `/users`?" instead of "something is wrong."

So: **"HTTP API health for user-management and user-info, with route (and optional job) filtering."**

### What each panel answers

Keep only metrics that answer a clear question. Each panel should have an obvious meaning.


| Panel                    | Metric(s)                                                          | Question it answers                                                | Cognitive load note                                                                                                |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Traffic & errors**     | `rate(http_requests_total)`, 5xx rate                              | "How much traffic? Are we throwing errors?"                        | One time series: request rate; one: error rate. Titles like "Request rate" and "Error rate (5xx)" make it obvious. |
| **P95 latency**          | `histogram_quantile(0.95, ...)` on `http_request_duration_seconds` | "How slow are responses?"                                          | Single number + green/yellow/red. "P95 latency" in the title = "95% of requests are faster than this."             |
| **In-flight requests**   | `http_requests_in_flight`                                          | "How many requests are currently being processed?"                 | One number + sparkline. "In-flight" = "right now." High = saturation/backlog.                                      |
| **Latency distribution** | `http_request_duration_seconds` buckets                            | "Where does latency sit over time—mostly fast or with long tails?" | Heatmap: time vs latency bucket. No need to remember PromQL—title "Latency distribution" is enough.                |


**Optional (Phase D / extra rows):**

- **Per-service request rate** (when `$job` added): "Which service is getting the traffic?" — same RED rate, split by `job`.
- **Node (USE):** heap, event loop lag, CPU — "Is the process/Node healthy?" — only add if you care about resource health on this dashboard.
- **Cache:** hit rate, size — "Is the cache helping?" — user-management only; keep in a separate row so it's clear it's app-specific.

**What we're not putting on this dashboard:**  
Raw counters (e.g. `http_requests_total` without `rate()`), process memory from cAdvisor, or logs—those live in Explore or other dashboards to avoid clutter.

### Keeping cognitive load low

- **"What does each graph represent?"**  
Every panel has a **short, specific title** (e.g. "Traffic & errors", "P95 latency", "In-flight requests", "Latency distribution") and **legend text** that matches (e.g. "Request rate", "Error rate (5xx)"). No generic "Metric A" or "Series 1".
- **"How long until someone else gets it?"**  
Layout order: **traffic/errors first** (are we up and correct?), **then latency** (how fast?), **then in-flight** (are we saturated?), **then distribution** (where does latency sit?). Optional job/Node/cache below. One idea per panel; no combo panels that mix unrelated metrics.
- **"Why does In-flight not filter by route?"**  
The metric has no `route` label, so the panel stays global. Add a **short panel description** in Grafana (e.g. "Requests currently being handled across all routes") so 2 AM you doesn't wonder.
- **Variables:**  
`$route` = "which route do I care about?"; `$job` (optional) = "which service?". "All" = `.`*. No extra variables unless they answer a clear question.

---

## What you will learn

- **Panel types:** Time series (trends), Gauge (single value + thresholds), Stat (value + sparkline), Heatmap (distribution over time).
- **PromQL:** `rate()`, `histogram_quantile()`, `$__rate_interval`, label matchers (`=~`, `.`*).
- **Variables:** `label_values(metric, label)` to fill dropdowns; `route=~"$route"` in queries; "All" = `.`*.
- **Microservices:** The `job` label (e.g. `user-management`, `user-info`) from Prometheus scrape config; per-service vs aggregate queries; when to add a `$job` variable to filter or compare services.

---

## Available metrics

Metrics you can use in panels. Prometheus adds the `job` label from scrape config (`user-management`, `user-info`). Use **Explore** or query `{__name__=~".+"}` in Prometheus to see live names and labels.


| Metric                             | Type      | Labels                                          | Exposed by                                        |
| ---------------------------------- | --------- | ----------------------------------------------- | ------------------------------------------------- |
| `http_requests_total`              | Counter   | `method`, `route`, `status_code`                | user-management, user-info                        |
| `http_request_duration_seconds`    | Histogram | `method`, `route`, `status_code`, `le` (bucket) | user-management, user-info                        |
| `http_requests_in_flight`          | Gauge     | `method`                                        | user-management, user-info                        |
| `cache_hits_total`                 | Counter   | `cache`                                         | user-management only                              |
| `cache_misses_total`               | Counter   | `cache`                                         | user-management only                              |
| `cache_size`                       | Gauge     | `cache`                                         | user-management only                              |
| `process_cpu_seconds_total`        | Counter   | (process)                                       | user-management, user-info (default Node metrics) |
| `nodejs_heap_size_used_bytes`      | Gauge     | (Node)                                          | user-management, user-info                        |
| `nodejs_eventloop_lag_p99_seconds` | Gauge     | (Node)                                          | user-management, user-info                        |


**Recording rules** (pre-aggregated, from Phase 5): `job:http_requests_total:rate5m`, `job:http_request_errors:rate5m`, `job:http_request_duration_p95:5m` — these use `job` and optionally `route`/`method`; the P95 rule has no `route` (job-level only).

---

## Before you start

- **Stack running:** `docker compose up` — app (user-management), user-info, Loki, Prometheus, Grafana.
- **Phase 5 done:** Recording rules exist in `prometheus/rules/recording_rules.yml` and Prometheus has loaded them (`curl -s http://localhost:9090/api/v1/rules` shows the rules). Both jobs are scraped: `up{job=~"user-management|user-info"}` = 1 in Prometheus.
- **Some traffic:** Hit both services so metrics exist. User-management: `curl http://localhost:3000/health`, `curl http://localhost:3000/users`. User-info: `curl http://localhost:3002/health`, `curl http://localhost:3002/user/1/profile`. Otherwise some panels may be empty.
- **Flow:** Part 1 uses no variables; Part 2 adds `$route` and wires it.

**Variable "All":** When you enable "Include All option" for `$route` (in Part 2), set the All value to `.`* so one query works for both "All" and a single route.

---

## Part 1 — Dashboard and panels (hardcoded)

**Goal:** Create the dashboard and all panels using a hardcoded selector (`route=~".*"`) so you see data immediately. No variables yet.  
**Verify:** All five panels show data for "all routes" with recent traffic.

---

## Step 1 — Create dashboard (no variable yet)

1. Open **[http://localhost:3001](http://localhost:3001)** → **Dashboards** → **New** → **New dashboard**.
2. Save the dashboard (e.g. name: **Node Playground — Observability**).

**Verify:**

- Dashboard exists and is saved.

---

## Step 2 — Time series: request rate and error rate (RED: Rate + Errors)

1. **Add** → **Visualization** → **Time series**.
2. **Query A** — request rate (RED: Rate):
  - `sum by(route) (rate(http_requests_total{route=~".*"}[$__rate_interval]))`
  - Legend: `Request rate`.
3. **Query B** — 5xx error rate (RED: Errors):
  - `sum(rate(http_requests_total{status_code=~"5..",route=~".*"}[$__rate_interval]))`
  - Legend: `Error rate (5xx)`.
4. Panel title: e.g. **Traffic & errors**.
5. **Panel description** (optional): In panel settings, add a short description (e.g. "Request rate and 5xx error rate over time") so the panel is self-explanatory.

**Verify:**

- Both series show (request rate and error rate). If no traffic, zoom to "Last 5 minutes" and hit a few endpoints (e.g. `curl http://localhost:3000/users`, `curl http://localhost:3002/user/1/profile`).
- Trigger errors: `curl "http://localhost:3000/simulate/error?rate=1.0"` a few times; error rate line should increase.

---

## Step 3 — Gauge: P95 latency (RED: Duration)

1. **Add** → **Visualization** → **Gauge**.
2. **Query** — P95 latency (our recording rule is job-level only, so use raw query for per-route):
  - `histogram_quantile(0.95, sum by(le) (rate(http_request_duration_seconds_bucket{route=~".*"}[$__rate_interval])))`
3. **Standard options** → **Unit:** seconds (s) or milliseconds (ms).
4. **Thresholds:** Base green, then:
  - Green: 0–0.1 (0–100 ms)
  - Yellow: 0.1–0.5 (100–500 ms)
  - Red: > 0.5 (> 500 ms)
5. **Min:** 0, **Max:** 1 (or 2 if you test with very slow simulate).
6. Panel title: e.g. **P95 latency**.
7. **Panel description** (optional): e.g. "95% of requests complete within this duration."

**Verify:**

- Gauge shows a value (e.g. < 0.1 s when idle).
- Run: `curl "http://localhost:3000/simulate/slow?ms=800"` a few times. Within a couple of minutes the gauge should move into yellow/red.

---

## Step 4 — Stat: in-flight requests (Golden signal: Saturation)

1. **Add** → **Visualization** → **Stat**.
2. **Query:** `sum(http_requests_in_flight)`
  - (This metric has only `method`, not `route`, so we don't add a route filter here.)
3. **Panel options** → enable **Graph mode** / **Sparkline**.
4. Panel title: e.g. **In-flight requests**.
5. **Panel description** (optional): e.g. "Requests currently being handled across all routes." (Explains why this panel doesn't filter by `$route`.)

**Verify:**

- Idle: value 0. Start a slow request in another terminal: `curl "http://localhost:3000/simulate/slow?ms=5000"`. While it runs, the stat should show 1 (or more). When it finishes, it drops back.

---

## Step 5 — Heatmap: latency distribution

1. **Add** → **Visualization** → **Heatmap**.
2. **Query:** `sum by(le) (rate(http_request_duration_seconds_bucket{route=~".*"}[$__rate_interval]))`
3. In the panel, set **Format:** **Time series buckets** (so Grafana treats the result as heatmap buckets).
4. Panel title: e.g. **Latency distribution**.
5. **Panel description** (optional): e.g. "How latency is distributed over time (buckets)."

**Verify:**

- You see a band of activity over time. More traffic or `/simulate/slow` calls should change the shape (e.g. more mass in higher buckets).

---

## Step 6 — Quick hardcoded check

- All five panels show data (or consistently no data) with time range **Last 15 minutes** and recent traffic.
- No variables exist yet.

---

## Part 2 — Add variable and wire it

**Goal:** Add the `$route` variable, then replace the hardcoded `route=~".*"` with `route=~"$route"` in each panel that supports it.  
**Verify:** Dropdown filters Traffic, P95, and Heatmap; In-flight is unchanged (by design).

---

## Step 7 — Add variable `$route`

1. **Settings** (gear icon) → **Variables** → **Add variable**:
  - **Name:** `route`
  - **Type:** Query
  - **Data source:** Prometheus
  - **Query:** `label_values(http_requests_total, route)`
  - **Refresh:** On dashboard load (or On time range change)
  - **Include All option:** On
  - **Custom all value:** `.`*
  - Save.

**Verify:**

- Top of dashboard shows a **route** dropdown.
- Dropdown lists routes from both services (e.g. `/users`, `/health`, `/simulate/slow`, `/user/:id/profile`) and an "All" option.

---

## Step 8 — Replace hardcoded with `$route`

In each panel that used `route=~".*"`, change it to `route=~"$route"`:


| Panel              | Use `$route`? | Change                                           |
| ------------------ | ------------- | ------------------------------------------------ |
| Traffic & errors   | Yes           | Both queries: `route=~".*"` → `route=~"$route"`. |
| P95 latency        | Yes           | `route=~".*"` → `route=~"$route"`.               |
| In-flight requests | No            | Metric has no `route` label; leave as-is.        |
| Latency heatmap    | Yes           | `route=~".*"` → `route=~"$route"`.               |


If you added any other panels that use `http_requests_total`, `http_request_duration_seconds_`*, or recording rules like `job:http_requests_total:rate5m`, add `route=~"$route"` to their query.

**Verify:**

- Set time range to **Last 15 minutes**.
- Select **All** in `$route`: panels show the same as before (all routes).
- Select a single route (e.g. `/simulate/slow`): Traffic, P95, and Heatmap only reflect that route. In-flight still shows global count (expected).

---

## Step 9 — Final dashboard check

- Variable **route** exists, populates from `label_values(http_requests_total, route)`, and has All = `.`*.
- **Time Series:** Request rate + error rate overlaid; no "No data" with recent traffic.
- **Gauge:** P95 with green/yellow/red; turns yellow/red after `curl "http://localhost:3000/simulate/slow?ms=800"`.
- **Stat:** In-flight with sparkline; goes to 1+ during a long `/simulate/slow` request.
- **Heatmap:** Latency distribution visible; shape changes with traffic/slow requests.
- **Time range** "Last 15 minutes" updates all panels.
- Changing **$route** filters Traffic, P95, and Heatmap; In-flight is unchanged (by design).

---

## Phase D — Multi-service (optional)

**Goal:** Understand the `job` label; add an optional panel and `$job` variable to filter or compare by service. First add the panel with hardcoded `job=~".*"`, verify both jobs show, then add `$job` and replace.  
**Verify:** You can switch "All" vs "user-management" vs "user-info" and see per-service series.

Prometheus adds the `job` label from the scrape config. The same metric name from different targets appears as different series (e.g. `http_requests_total{job="user-management",...}` vs `job="user-info"`).

### Optional: Panel with hardcoded job, then variable `$job`

1. Add a **Time series** panel with query (hardcoded first):
  - `sum by(job) (rate(http_requests_total{route=~"$route",job=~".*"}[$__rate_interval]))`
  - Verify both jobs (user-management, user-info) show.
2. **Settings** → **Variables** → **Add variable**:
  - **Name:** `job`
  - **Type:** Query
  - **Data source:** Prometheus
  - **Query:** `label_values(http_requests_total, job)`
  - **Refresh:** On dashboard load (or On time range change)
  - **Include All option:** On
  - **Custom all value:** `.`*
  - Save.
3. In that panel, replace `job=~".*"` with `job=~"$job"`.

This lets you compare user-management vs user-info request rates.

### Where to use `$job`

Add `job=~"$job"` to any query that should be filterable by service: Traffic & errors, P95 latency, Latency heatmap. In-flight can stay global, or add `job=~"$job"` if you want to filter it by service (both services expose it).

**Verify:** With "All" you see both jobs; selecting one job shows only that service's series.

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
- **$rate_interval:** Grafana's rate window for Prometheus; use in `rate(...[$__rate_interval])` unless you need a fixed window.
- **Variables:** `label_values(metric, label)` fills the dropdown; use `label=~"$var"` in queries. All = `.`* for "all values".
- **Recording rules:** `job:http_request_duration_p95:5m` is aggregated (no `route`); for per-route P95 use the raw `histogram_quantile(...)` with `route=~"$route"`.
- **Multi-service:** The `job` label comes from Prometheus scrape config; use `job=~"$job"` in queries when you have a `$job` variable to filter or compare services.

