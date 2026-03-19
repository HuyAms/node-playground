# Load Testing with k6

## What is k6

k6 is a load testing CLI tool written in Go. It runs JavaScript test scripts but uses its **own JS runtime** — not Node.js. This means:

- `import http from 'k6/http'` — built into k6, not an npm package
- You cannot run `load.js` with `node` or `tsx`
- No `package.json` dependency — install k6 separately

## How to run

### Option A — Docker (no install needed)

```bash
# Run indefinitely (Ctrl+C to stop)
docker compose --profile load run --rm k6

# Run for a fixed duration
DURATION=5m docker compose --profile load run --rm k6
```

### Option B — Local CLI

```bash
brew install k6

k6 run scripts/load.js

# Fixed duration override
DURATION=10m k6 run scripts/load.js

# Force ~5% of /user/:id/info traffic to return 500
ERROR_RATE=0.05 k6 run scripts/load.js
```

`pdp` (product detail) uses the same user IDs as the in-memory repo seed in `users.repository.ts` (IDs `1`–`10`). No seeding step required.

### Medium ecommerce profile

The script simulates a **medium-size ecommerce** traffic mix: browse-heavy (~55% catalog/list), product-detail and PDP-rich views (~35% combined), rare writes (registration ~1–2%, profile update &lt;1%), a small share of 404s (broken links), and a ~2× traffic spike for sale events. Think times are tuned for ecommerce: longer between catalog pages (1.5–4s), shorter on PDP (0.4–1.2s), and long gaps between sign-ups (8–15s) and profile edits (15–45s). Use it to stress caches, DB, and RED dashboards under realistic ecommerce-style load.

---

## What k6 concepts are used

### Virtual Users (VUs)

A VU is a simulated user that loops through a function continuously. 55 VUs on `listUsers` (browse_catalog) means 55 concurrent users each calling `GET /users` in a loop with a browse think time (1.5–4s) between requests.

### Scenarios

Each scenario runs one `exec` function with its own VU count and ramp shape, independently of others. All scenarios run **concurrently** — that's what makes the total traffic realistic.

```js
scenarios: {
  browse_catalog: { executor: 'ramping-vus', exec: 'listUsers', stages: [...] },
  pdp:            { executor: 'ramping-vus', exec: 'getUserById', stages: [...] },
}
```

### Executors

We use two executor types:

| Executor       | Behaviour                                                             |
| -------------- | --------------------------------------------------------------------- |
| `ramping-vus`  | VU count changes over time following `stages` — creates traffic waves |
| `constant-vus` | Fixed VU count for a fixed duration — flat baseline                   |

### Stages

Stages define how VUs ramp up/down over time for `ramping-vus`:

```js
stages: [
  {duration: '2m', target: 55},  // ramp to baseline VUs
  {duration: '6m', target: 55},  // hold baseline
  {duration: '2m', target: 120}, // spike (sale event)
  {duration: '2m', target: 55},  // ramp back down
  {duration: DURATION, target: 55}, // hold until stopped
];
```

This creates visible waves in Grafana — you can see request rate rise and fall in real time.

### Thresholds

Thresholds are pass/fail criteria printed at the end:

```js
thresholds: {
  http_req_duration: ['p(95)<500'],  // P95 must be under 500ms
  http_req_failed:   ['rate<0.15'],  // less than 15% errors
}
```

Green = passing, red = failing in terminal output.

### SharedArray

`SharedArray` loads data once and shares it across all VUs (memory-efficient). We use it for the fixed list of user IDs (`1`–`10`) so every VU can pick a random ID without duplicating the array per VU.

---

## Traffic scenario design

| Scenario          | VUs (baseline → spike) | Route                               | Ecommerce role / Prometheus                                      |
| ----------------- | ---------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| `browse_catalog`  | 55→120                 | `GET /users`                        | Catalog/list ~55%; always hits DB, `topk()`                       |
| `pdp`             | 28→60                  | `GET /users/:id` (existing IDs)     | Product detail ~25–30%; cache hit rate                            |
| `pdp_rich`       | 12→28                  | `GET /user/:id/info`                | PDP with extra info ~10–12%; ~5% forced 500s with `?error=true`   |
| `broken_link`     | 2→5                    | `GET /users/:id` (non-existent IDs) | 404s ~1–2%; `route="unknown"`, `status_code="404"`                |
| `registration`    | 2→5                    | `POST /users`                       | Sign-up ~1–2%; long think time (8–15s)                            |
| `profile_update`  | 1→3                    | `PATCH /users/:id`                  | Profile edit &lt;1%; very long think time (15–45s)                 |
| `health_probe`    | 3 (constant)           | `GET /health`                       | Load balancer probe, flat baseline                               |

### Timeline

```
t=0m   All scenarios start
t=2m   Baseline established — check sum by(route) in Prometheus
t=8m   Spike — VUs ramp up (~2–2.5×), watch RPS and cache in Grafana
t=10m  Ramp back down
t=12m+ Steady — run until Ctrl+C
```

---

## Useful PromQL to watch while k6 runs

```promql
# Traffic breakdown by route
sum by(route) (rate(http_requests_total[1m]))

# Top 3 busiest routes
topk(3, sum by(route) (rate(http_requests_total[1m])))

# P95 latency — rises during spike (t=8–10m)
histogram_quantile(0.95, sum by(le) (rate(http_request_duration_seconds_bucket[1m])))

# Error rate %
sum(rate(http_requests_total{status_code=~"5.."}[1m])) / sum(rate(http_requests_total[1m])) * 100

# Cache hit rate
rate(cache_hits_total[1m]) / (rate(cache_hits_total[1m]) + rate(cache_misses_total[1m]))
```

> Tip: use `[1m]` instead of `[5m]` while k6 is running — tighter window reacts faster so you see changes in real time.
