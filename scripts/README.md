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
DURATION=20m docker compose --profile load run --rm k6
```

### Option B — Local CLI

```bash
brew install k6

k6 run scripts/load.js

# Fixed duration override
DURATION=10m k6 run scripts/load.js
```

`get_by_id` uses the same user IDs as the in-memory repo seed in `users.repository.ts` (IDs `1`–`10`). No seeding step required.

---

## What k6 concepts are used

### Virtual Users (VUs)

A VU is a simulated user that loops through a function continuously. 10 VUs on `getUserById` means 10 concurrent users each hammering `GET /users/:id` in a tight loop with a small sleep between requests.

### Scenarios

Each scenario runs one `exec` function with its own VU count and ramp shape, independently of others. All scenarios run **concurrently** — that's what makes the total traffic realistic.

```js
scenarios: {
  get_by_id: { executor: 'ramping-vus', exec: 'getUserById', stages: [...] },
  list_users: { executor: 'ramping-vus', exec: 'listUsers',  stages: [...] },
}
```

### Executors

We use two executor types:

| Executor | Behaviour |
|---|---|
| `ramping-vus` | VU count changes over time following `stages` — creates traffic waves |
| `constant-vus` | Fixed VU count for a fixed duration — flat baseline |

### Stages

Stages define how VUs ramp up/down over time for `ramping-vus`:

```js
stages: [
  { duration: '2m', target: 10 }, // ramp from 0 to 10 VUs over 2 minutes
  { duration: '6m', target: 10 }, // hold at 10 VUs for 6 minutes
  { duration: '2m', target: 25 }, // spike to 25 VUs (traffic surge)
  { duration: '2m', target: 10 }, // ramp back down
  { duration: DURATION, target: 10 }, // hold until stopped
]
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

| Scenario | VUs | Route | What it shows in Prometheus |
|---|---|---|---|
| `get_by_id` | 10→25 | `GET /users/:id` (existing IDs) | Highest volume in `topk()`, cache hit rate ratio |
| `list_users` | 5→12 | `GET /users` | Second in `topk()`, always hits DB |
| `create_user` | 1 | `POST /users` | Low-volume writes, long think time |
| `slow_requests` | 0→3→0 | `GET /simulate/slow` | P95 spike (starts at 4min, stops at 10min) |
| `error_requests` | 0→4→0 | `GET /simulate/error` | Error rate spike (starts at 6min, triggers alert in Phase 7) |
| `get_404` | 0→2 | `GET /users/:id` (non-existent IDs) | `route="unknown"`, `status_code="404"` — 404 rate in dashboards |
| `health_probe` | 2 | `GET /health` | Background noise, flat baseline |

### Timeline

```
t=0m   All scenarios start
t=2m   Baseline established — check sum by(route) in Prometheus
t=4m   Slow requests start — watch P95 rise
t=6m   Error injection starts — watch error rate climb
t=9m   Error injection stops — error rate drops, alert resolves
t=10m  Slow requests stop — P95 drops back
t=12m+ Low steady state — run until Ctrl+C
```

---

## Useful PromQL to watch while k6 runs

```promql
# Traffic breakdown by route
sum by(route) (rate(http_requests_total[1m]))

# Top 3 busiest routes
topk(3, sum by(route) (rate(http_requests_total[1m])))

# P95 latency — spikes between t=4m and t=10m
histogram_quantile(0.95, sum by(le) (rate(http_request_duration_seconds_bucket[1m])))

# Error rate % — spikes between t=6m and t=9m
sum(rate(http_requests_total{status_code=~"5.."}[1m])) / sum(rate(http_requests_total[1m])) * 100

# Cache hit rate
rate(cache_hits_total[1m]) / (rate(cache_hits_total[1m]) + rate(cache_misses_total[1m]))
```

> Tip: use `[1m]` instead of `[5m]` while k6 is running — tighter window reacts faster so you see changes in real time.
