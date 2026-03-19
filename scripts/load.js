import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const DURATION = __ENV.DURATION || '999h'; // run until Ctrl+C by default
const ERROR_RATE = Number(__ENV.ERROR_RATE || '0.05');

// IDs from SqliteUserRepository SEED_USERS (users.repository.ts)
const userIds = new SharedArray('userIds', function () {
  return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
});

// Non-existent IDs — GET /users/:id returns 404, route label = "unknown" in metrics
const notFoundIds = new SharedArray('notFoundIds', function () {
  return ['999', '998', '000', 'nonexistent', 'deleted', 'invalid-id'];
});

// ---------------------------------------------------------------------------
// Medium ecommerce profile — traffic mix and shape:
//
//   Browse (catalog/list) ~55% | PDP (product detail) ~25–30% | PDP rich ~10–12%
//   404 (broken link) ~1–2%   | Registration ~1–2%           | Profile update <1% | Health constant
//
//   Stages: 0–2m ramp → 2–8m baseline → 8–10m spike (sale) → 10–12m recover → 12m+ steady
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    browse_catalog: {
      executor: 'ramping-vus',
      exec: 'listUsers',
      stages: [
        { duration: '2m', target: 55 },
        { duration: '6m', target: 55 },
        { duration: '2m', target: 120 }, // spike
        { duration: '2m', target: 55 },
        { duration: DURATION, target: 55 },
      ],
    },

    pdp: {
      executor: 'ramping-vus',
      exec: 'getUserById',
      stages: [
        { duration: '2m', target: 28 },
        { duration: '6m', target: 28 },
        { duration: '2m', target: 60 },
        { duration: '2m', target: 28 },
        { duration: DURATION, target: 28 },
      ],
    },

    pdp_rich: {
      executor: 'ramping-vus',
      exec: 'getUserInfo',
      stages: [
        { duration: '2m', target: 12 },
        { duration: '6m', target: 12 },
        { duration: '2m', target: 28 },
        { duration: '2m', target: 12 },
        { duration: DURATION, target: 12 },
      ],
    },

    broken_link: {
      executor: 'ramping-vus',
      exec: 'getUserByIdNotFound',
      stages: [
        { duration: '2m', target: 2 },
        { duration: '6m', target: 2 },
        { duration: '2m', target: 5 },
        { duration: '2m', target: 2 },
        { duration: DURATION, target: 2 },
      ],
    },

    registration: {
      executor: 'ramping-vus',
      exec: 'createUser',
      stages: [
        { duration: '2m', target: 2 },
        { duration: '6m', target: 2 },
        { duration: '2m', target: 5 },
        { duration: '2m', target: 2 },
        { duration: DURATION, target: 2 },
      ],
    },

    profile_update: {
      executor: 'ramping-vus',
      exec: 'updateUser',
      stages: [
        { duration: '2m', target: 1 },
        { duration: '6m', target: 1 },
        { duration: '2m', target: 3 },
        { duration: '2m', target: 1 },
        { duration: DURATION, target: 1 },
      ],
    },

    health_probe: {
      executor: 'constant-vus',
      exec: 'healthCheck',
      vus: 3,
      duration: DURATION,
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500'],
    'http_req_duration{scenario:pdp}': ['p(95)<100'],
    'http_req_duration{scenario:browse_catalog}': ['p(95)<300'],
    http_req_failed: ['rate<0.15'],
  },
};

// ---------------------------------------------------------------------------
// Scenario functions
// ---------------------------------------------------------------------------

export function getUserById() {
  const id = userIds[Math.floor(Math.random() * userIds.length)];
  const res = http.get(`${BASE_URL}/users/${id}`);
  check(res, { 'get_by_id ok': r => r.status === 200 || r.status === 404 });
  sleep(0.4 + Math.random() * 0.8); // 0.4–1.2s PDP think time
}

export function getUserInfo() {
  const id = userIds[Math.floor(Math.random() * userIds.length)];
  const shouldForceError = Math.random() < ERROR_RATE;
  const suffix = shouldForceError ? '?error=true' : '';
  const res = http.get(`${BASE_URL}/user/${id}/info${suffix}`);
  check(res, { 'get_user_info ok': r => r.status === 200 || r.status === 500 });
  sleep(0.4 + Math.random() * 0.8); // 0.4–1.2s PDP rich think time
}

export function getUserByIdNotFound() {
  const id = notFoundIds[Math.floor(Math.random() * notFoundIds.length)];
  const res = http.get(`${BASE_URL}/users/${id}`);
  check(res, { 'get_404 ok': r => r.status === 404 });
  sleep(0.2 + Math.random() * 0.3); // quick bounce
}

export function listUsers() {
  const page = Math.ceil(Math.random() * 3); // pages 1-3
  const res = http.get(`${BASE_URL}/users?page=${page}&limit=10`);
  check(res, { 'list ok': r => r.status === 200 });
  sleep(1.5 + Math.random() * 2.5); // 1.5–4s browse (catalog/list)
}

export function createUser() {
  const rand = Math.random().toString(36).slice(2, 8);
  const res = http.post(
    `${BASE_URL}/users`,
    JSON.stringify({ name: `Load User ${rand}`, email: `${rand}@load.test`, role: 'viewer' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'create ok': r => r.status === 201 });
  sleep(8 + Math.random() * 7); // 8–15s between sign-ups
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
  sleep(15 + Math.random() * 30); // 15–45s between profile edits
}

export function healthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'health ok': r => r.status === 200 });
  sleep(2);
}
