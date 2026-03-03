import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const DURATION = __ENV.DURATION || '999h'; // run until Ctrl+C by default

// IDs from InMemoryUserRepository SEED_USERS (users.repository.ts)
const userIds = new SharedArray('userIds', function () {
  return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
});

// Non-existent IDs — GET /users/:id returns 404, route label = "unknown" in metrics
const notFoundIds = new SharedArray('notFoundIds', function () {
  return ['999', '998', '000', 'nonexistent', 'deleted', 'invalid-id'];
});

// ---------------------------------------------------------------------------
// Traffic shape — ramping VUs creates visible waves in Grafana:
//
//   0-2m:   ramp up to baseline (normal business hours start)
//   2-8m:   steady baseline     (normal load)
//   8-10m:  traffic spike       (sale / viral event)
//   10-12m: ramp back down      (peak subsides)
//   12m+:   low steady state    (off-peak / night)
//
// Each scenario has its own ramp so topk() clearly shows winner routes.
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    // Highest volume — GET /users/:id with cache hits (read-heavy like production)
    get_by_id: {
      executor: 'ramping-vus',
      exec: 'getUserById',
      stages: [
        { duration: '2m',  target: 10 }, // ramp up
        { duration: '6m',  target: 10 }, // steady
        { duration: '2m',  target: 25 }, // spike — watch cache_hit_rate hold up
        { duration: '2m',  target: 10 }, // recover
        { duration: DURATION, target: 10 }, // hold until stopped
      ],
    },

    // Second busiest — list users (no cache, always hits DB)
    list_users: {
      executor: 'ramping-vus',
      exec: 'listUsers',
      stages: [
        { duration: '2m',  target: 5 },
        { duration: '6m',  target: 5 },
        { duration: '2m',  target: 12 }, // spike
        { duration: '2m',  target: 5 },
        { duration: DURATION, target: 5 },
      ],
    },

    // Low volume writes — creates new users so get_by_id has fresh IDs too
    create_user: {
      executor: 'ramping-vus',
      exec: 'createUser',
      stages: [
        { duration: '2m',  target: 1 },
        { duration: '10m', target: 1 },
        { duration: DURATION, target: 1 },
      ],
    },

    // Slow requests — kept deliberately low so P95 is elevated but not overwhelming
    // Watch: histogram_quantile(0.95, ...) sits around 300ms
    slow_requests: {
      executor: 'ramping-vus',
      exec: 'slowRequest',
      stages: [
        { duration: '4m',  target: 0 },  // delay start — let baseline establish first
        { duration: '1m',  target: 3 },  // introduce slow traffic
        { duration: '6m',  target: 3 },  // hold — P95 visibly rises in Grafana
        { duration: '1m',  target: 0 },  // stop — watch P95 drop back
        { duration: DURATION, target: 0 },
      ],
    },

    // Error injection — 10% error rate, low volume
    // Watch: error rate % query spikes to ~10%, alert fires in Phase 7
    error_requests: {
      executor: 'ramping-vus',
      exec: 'errorRequest',
      stages: [
        { duration: '6m',  target: 0 },  // no errors during baseline
        { duration: '1m',  target: 4 },  // incident starts
        { duration: '3m',  target: 4 },  // incident sustained — alert should FIRE
        { duration: '1m',  target: 0 },  // incident resolved
        { duration: DURATION, target: 0 },
      ],
    },

    // Background noise — health checks, like a load balancer probe
    health_probe: {
      executor: 'constant-vus',
      exec: 'healthCheck',
      vus: 2,
      duration: DURATION,
    },

    // 404s — GET /users/:id with non-existent IDs (route="unknown", status_code="404" in Prometheus)
    get_404: {
      executor: 'ramping-vus',
      exec: 'getUserByIdNotFound',
      stages: [
        { duration: '3m', target: 0 },
        { duration: '1m', target: 2 },
        { duration: '6m', target: 2 },
        { duration: DURATION, target: 2 },
      ],
    },
  },

  thresholds: {
    // These surface in k6 terminal output — green = passing, red = failing
    http_req_duration:                    ['p(95)<500'],  // P95 under 500ms
    'http_req_duration{scenario:get_by_id}': ['p(95)<100'],  // cache hits should be fast
    http_req_failed:                      ['rate<0.15'],  // less than 15% errors overall
  },
};

// ---------------------------------------------------------------------------
// Scenario functions
// ---------------------------------------------------------------------------

export function getUserById() {
  const id = userIds[Math.floor(Math.random() * userIds.length)];
  const res = http.get(`${BASE_URL}/users/${id}`);
  check(res, { 'get_by_id ok': r => r.status === 200 || r.status === 404 });
  sleep(0.1 + Math.random() * 0.2);
}

export function getUserByIdNotFound() {
  const id = notFoundIds[Math.floor(Math.random() * notFoundIds.length)];
  const res = http.get(`${BASE_URL}/users/${id}`);
  check(res, { 'get_404 ok': r => r.status === 404 });
  sleep(0.2 + Math.random() * 0.3);
}

export function listUsers() {
  const page = Math.ceil(Math.random() * 3); // pages 1-3
  const res = http.get(`${BASE_URL}/users?page=${page}&limit=10`);
  check(res, { 'list ok': r => r.status === 200 });
  sleep(0.5 + Math.random() * 0.5); // 500ms-1s think time
}

export function createUser() {
  const rand = Math.random().toString(36).slice(2, 8);
  const res = http.post(
    `${BASE_URL}/users`,
    JSON.stringify({ name: `Load User ${rand}`, email: `${rand}@load.test`, role: 'viewer' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'create ok': r => r.status === 201 });
  sleep(3 + Math.random() * 2); // writes are infrequent — 3-5s between requests
}

export function slowRequest() {
  // Vary the delay: 200-500ms — makes P95 more realistic than a flat 300ms spike
  const ms = 200 + Math.floor(Math.random() * 300);
  const res = http.get(`${BASE_URL}/simulate/slow?ms=${ms}`);
  check(res, { 'slow ok': r => r.status === 200 });
  sleep(0.5);
}

export function errorRequest() {
  const res = http.get(`${BASE_URL}/simulate/error?rate=0.1`);
  // 500s are expected — don't count as check failures
  check(res, { 'error scenario': r => r.status === 200 || r.status === 500 });
  sleep(0.3 + Math.random() * 0.2);
}

export function healthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'health ok': r => r.status === 200 });
  sleep(2);
}
