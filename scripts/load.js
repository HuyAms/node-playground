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
        { duration: '2m', target: 25 }, // ramp up
        { duration: '6m', target: 25 }, // steady baseline
        { duration: '2m', target: 55 }, // spike
        { duration: '2m', target: 25 }, // recover
        { duration: DURATION, target: 25 },
      ],
    },

    // Second busiest — list users (no cache, always hits DB)
    list_users: {
      executor: 'ramping-vus',
      exec: 'listUsers',
      stages: [
        { duration: '2m', target: 12 },
        { duration: '6m', target: 12 },
        { duration: '2m', target: 28 }, // spike
        { duration: '2m', target: 12 },
        { duration: DURATION, target: 12 },
      ],
    },

    // Low volume writes — creates new users so get_by_id has fresh IDs too
    create_user: {
      executor: 'ramping-vus',
      exec: 'createUser',
      stages: [
        { duration: '2m', target: 2 },
        { duration: '6m', target: 2 },
        { duration: '2m', target: 4 }, // spike
        { duration: '2m', target: 2 },
        { duration: DURATION, target: 2 },
      ],
    },

    // Low volume updates — PATCH /users/:id (real-world mid-popular mix)
    update_user: {
      executor: 'ramping-vus',
      exec: 'updateUser',
      stages: [
        { duration: '2m', target: 1 },
        { duration: '6m', target: 1 },
        { duration: '2m', target: 3 }, // spike
        { duration: '2m', target: 1 },
        { duration: DURATION, target: 1 },
      ],
    },

    // Background noise — health checks, like a load balancer probe
    health_probe: {
      executor: 'constant-vus',
      exec: 'healthCheck',
      vus: 3,
      duration: DURATION,
    },

    // 404s — GET /users/:id with non-existent IDs (~1–2% of GET traffic)
    get_404: {
      executor: 'ramping-vus',
      exec: 'getUserByIdNotFound',
      stages: [
        { duration: '2m', target: 2 },
        { duration: '6m', target: 2 },
        { duration: '2m', target: 4 }, // spike
        { duration: '2m', target: 2 },
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
  sleep(0.2 + Math.random() * 0.3); // 200–500ms think time
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
  sleep(0.8 + Math.random() * 0.7); // 800ms–1.5s browsing
}

export function createUser() {
  const rand = Math.random().toString(36).slice(2, 8);
  const res = http.post(
    `${BASE_URL}/users`,
    JSON.stringify({ name: `Load User ${rand}`, email: `${rand}@load.test`, role: 'viewer' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'create ok': r => r.status === 201 });
  sleep(3 + Math.random() * 2); // 3–5s between writes
}

export function updateUser() {
  const id = userIds[Math.floor(Math.random() * userIds.length)];
  const rand = Math.random().toString(36).slice(2, 6);
  const res = http.patch(
    `${BASE_URL}/users/${id}`,
    JSON.stringify({ name: `Updated ${rand}` }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'update ok': r => r.status === 200 });
  sleep(2 + Math.random() * 2); // 2–4s between updates
}

export function healthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'health ok': r => r.status === 200 });
  sleep(2);
}
