# RED Metrics: Rate, Errors, Duration

> **Summary of:** [The RED Method](https://grafana.com/files/grafanacon_eu_2018/Tom_Wilkie_GrafanaCon_EU_2018.pdf) — Tom Wilkie (GrafanaCon EU 2018). Pattern for instrumenting and monitoring **services** (as opposed to resources).

---

## Why RED?

The **USE Method** (Utilisation, Saturation, Errors) fits **resources** — CPU, memory, disk, network. For **services** that serve requests, you care about traffic and latency, not “CPU utilisation” per se. RED gives a consistent, user-centric view: high error rate or high duration directly affects users.

---

## The three signals

| Signal    | What to monitor                          | Why |
|-----------|------------------------------------------|-----|
| **Rate**  | Requests per second                       | Capacity and anomaly detection; sudden drop = down or traffic lost. |
| **Errors**| Number (or rate) of failing requests     | Direct proxy for user-visible failures; primary SLO signal. |
| **Duration** | Time those requests take (e.g. p95)   | User-perceived slowness; averages hide tail latency. |

Model every service the same way so dashboards and alerts are consistent across the stack.

---

## Quick formulas (Prometheus)

Assume a counter `http_requests_total{method, route, status_code}` and a histogram `http_request_duration_seconds_bucket` (or the convention from the slides: `request_duration_seconds` with `_count` and `_bucket`).

| Metric   | PromQL (per job/service) |
|----------|---------------------------|
| **Rate** | `sum(rate(http_requests_total{job="my-service"}[5m]))` |
| **Errors** | `sum(rate(http_requests_total{job="my-service", status_code=~"5.."}[5m]))` (5xx rate) or **error ratio**: `sum(rate(...{status_code=~"5.."}[5m])) / sum(rate(...[5m]))` |
| **Duration** | `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job="my-service"}[5m])))` (p95) |

**Slide convention** (using histogram `_count`):  
- Rate: `sum(rate(request_duration_seconds_count{job="..."}[1m]))`  
- Errors: `sum(rate(request_duration_seconds_count{job="...", status_code!~"2.."}[1m]))`  
- Duration: `histogram_quantile(0.99, sum(rate(request_duration_seconds_bucket{job="..."}[1m])) by (le))`

Use `[5m]` (or your recording-rule window) for stability; use p50/p95/p99 as needed.

---

## Relation to Golden Signals

RED maps to the first three of the **Four Golden Signals** (Google SRE): **Latency** (Duration), **Traffic** (Rate), **Errors**. The fourth — **Saturation** (how “full” the service is) — is RED + saturation for a complete picture.

---

## References

- [The RED Method: How to Instrument Your Services](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/) — Grafana Labs  
- [Tom Wilkie — The RED Method (PDF)](https://grafana.com/files/grafanacon_eu_2018/Tom_Wilkie_GrafanaCon_EU_2018.pdf) — GrafanaCon EU 2018  
- USE Method — [Brendan Gregg](http://www.brendangregg.com/usemethod.html)  
- Four Golden Signals — *The Google SRE Book*
