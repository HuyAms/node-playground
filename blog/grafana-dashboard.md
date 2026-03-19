# Grafana Dashboard Best Practices (RED API)

> **Context:** How to build and maintain a Grafana dashboard for services with many endpoints, following Grafana’s guidance so one dashboard scales to many routes and microservices without sprawl. This repo’s RED API dashboard (`grafana/dashboards/red-api-dashboard.json`) is the reference; the tips below apply when building or extending it.

---

## 1. One templated dashboard, not one per service or route

**Avoid dashboard sprawl.** Grafana recommends using **template variables** so you don’t need a separate dashboard per node (or per service/route). For microservices, apply the **RED method** (Rate, Errors, Duration) “for each of your services” from a **single dashboard** where users pick service and optionally route via dropdowns.

- **Single dashboard + dropdowns:** One dashboard with variables (e.g. `$job`, `$route`). All panels filter with `job=~"$job"` and `route=~"$route"`. One place to maintain, scales to N services and many routes.
- **Hierarchical drill-down:** Keep an overview (e.g. one row per service or per route) and add **links** to the same dashboard with a pre-set `$route` or `$job` for a focused, deep-dive view.

**References:** [Grafana: Build dashboards best practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices), [Variables](https://grafana.com/docs/grafana/latest/dashboards/variables), [Prometheus template variables](https://grafana.com/docs/grafana/latest/datasources/prometheus/template-variables).

---

## 2. Add template variables: job and route

**Two variables cover most RED API dashboards:**

- **`$job` (service selector)**  
  - Type: **Query** (Prometheus).  
  - Query: `label_values(http_requests_total, job)` or `label_values(job:http_requests_total:rate5m, job)` if you use a recording rule.  
  - Multi-value: **on**. Include “All” so users can see every service.  
  - Refresh: **On time range change** (or On dashboard load).

- **`$route` (route filter, chained to job)**  
  - Type: **Query**.  
  - Query: `label_values(http_requests_total{job=~"$job"}, route)` so options depend on selected job(s).  
  - Multi-value: **on**. Include “All”.  
  - Refresh: **On time range change** (or On dashboard load).

Use `job=~"$job"` and `route=~"$route"` in every panel that should respect the selection. This matches the pattern already anticipated in this repo’s recording rules (`prometheus/rules/recording_rules.yml`).

**References:** [Prometheus template variables – Label values](https://grafana.com/docs/grafana/latest/datasources/prometheus/template-variables), chained variables in the same doc.

---

## 3. RED: one section, variable-driven

**RED = Rate, Errors, Duration** — the standard pattern for request-based services and a proxy for user experience. Keep **one RED section** whose panels are driven by `$job` and `$route`, instead of duplicating a full row per service.

- **Service health (Up):** `up{job=~"$job"}` — one stat or a small table per selected job.
- **Rate:** e.g. `sum(rate(http_requests_total{job=~"$job",route=~"$route"}[5m]))` or the recording rule `job:http_requests_total:rate5m{job=~"$job",route=~"$route"}`.
- **Error rate (5xx):** same filters; ratio of 5xx to total.
- **Duration (e.g. p99):** `histogram_quantile(...){job=~"$job",route=~"$route"}`.

When “All” is selected for route, you see service-level aggregates; when one or more routes are selected, you compare like to like and avoid a single noisy graph with 50+ lines.

**References:** [Grafana: RED method (best practices)](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices), [The RED Method (Grafana Labs blog)](https://www.grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/).

---

## 4. Rate / errors / duration by route: reduce noise

- **All routes:** Use `sum by (job) (...)` for a service-level view, or `sum by (route) (...)` to compare routes in one graph. With many routes, the “by route” graph can get noisy.
- **Selected routes only:** Use `route=~"$route"` so only chosen routes appear — “compare like to like; split when the magnitude differs.”
- **Top N:** Use `topk(10, sum by (route) (job:http_requests_total:rate5m{job=~"$job"}))` so the rate-by-route panel doesn’t explode with dozens of series.

**Reference:** [Grafana best practices: “Compare like to like”](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices).

---

## 5. Optional: drill-down to route detail

Add a **dashboard link** (or panel link) that opens the same dashboard with `var-route=<specific_route>` (and optionally `var-job=<job>`) so users can jump from an overview to a focused view on one route.

**Reference:** [Grafana: Hierarchical dashboards with drill-downs](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices).

---

## 6. Small UX and documentation details

- **Default variable values:** Set `$job` default to “All” or to your main services (e.g. both `user-management` and `user-info`) so the first load is useful without extra clicks.
- **Text panel:** Add a short text panel at the top describing what the dashboard shows and how to use the job/route dropdowns — aligns with Grafana’s documentation best practice.
- **Datasource UID:** When provisioning, ensure the Prometheus datasource has a stable **UID** (e.g. `prometheus`) and that panel JSON uses it; otherwise “datasource not found” appears after import.
- **Recording rules:** Prefer recording rules in panels (e.g. `job:http_requests_total:rate5m`) where they exist so Prometheus does the work once and panels stay cheap.

---

## 7. Where this repo’s dashboard lives

| Item | Path |
|------|------|
| Dashboard JSON | `grafana/dashboards/red-api-dashboard.json` |
| Recording rules | `prometheus/rules/recording_rules.yml` |
| Metrics (app) | `packages/observability`; apps expose `/metrics` |

The current dashboard uses fixed `job="user-management"` and `job="user-info"` and no variables. Applying the steps above (add `$job` and `$route`, unify RED into one variable-driven section, optional top N and drill-down) will align it with the best practices in this post. Grafana can load the JSON via [provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards) or by importing the file manually.

---

## Useful resources

- **[Grafana: Build dashboards best practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices)** — Template variables, RED, hierarchical drill-downs, compare like to like.
- **[Grafana: Prometheus template variables](https://grafana.com/docs/grafana/latest/datasources/prometheus/template-variables)** — `label_values`, chained variables.
- **[The RED Method: How to Instrument Your Services](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/)** — Grafana Labs; RED and instrumentation.
- **[Tom Wilkie — The RED Method (PDF)](https://grafana.com/files/grafanacon_eu_2018/Tom_Wilkie_GrafanaCon_EU_2018.pdf)** — GrafanaCon EU 2018; PromQL patterns.
- **[Prometheus Querying Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)** — `rate()`, `histogram_quantile()`.
- **[Grafana Provisioning — Dashboards](https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards)** — Ship dashboards as code.
- **In this repo:** [blog/red-metrics.md](red-metrics.md) — RED formulas and PromQL; [blog/Observability.md](Observability.md) — Stack overview.
