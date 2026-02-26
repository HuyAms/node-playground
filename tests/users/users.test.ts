import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { InMemoryUserRepository } from '../../src/modules/users/users.repository.js';
import { UsersService } from '../../src/modules/users/users.service.js';
import { UsersController } from '../../src/modules/users/users.controller.js';
import { errorHandler } from '../../src/shared/middleware/errorHandler.js';
import { requestId } from '../../src/shared/middleware/requestId.js';

const app = createApp();

// Seed IDs we can rely on across all tests
const SEED_ID_1 = '11111111-0000-0000-0000-000000000001'; // Alice Nguyen / admin
const SEED_ID_2 = '11111111-0000-0000-0000-000000000002'; // Bob Chen / editor

// ---------------------------------------------------------------------------
// GET /users — list + pagination
// ---------------------------------------------------------------------------
describe('GET /users', () => {
  it('returns a paginated list with meta', async () => {
    const res = await request(app).get('/users');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it('respects page and limit query params', async () => {
    const res = await request(app).get('/users?page=2&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(2);
  });

  it('returns first page when page=1&limit=3', async () => {
    const res = await request(app).get('/users?page=1&limit=3');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta.page).toBe(1);
  });

  it('returns 422 for invalid page param', async () => {
    const res = await request(app).get('/users?page=abc');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeInstanceOf(Array);
  });

  it('returns 422 when limit exceeds 100', async () => {
    const res = await request(app).get('/users?limit=999');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('reflects x-request-id header in response', async () => {
    const id = 'test-correlation-id';
    const res = await request(app).get('/users').set('x-request-id', id);

    expect(res.headers['x-request-id']).toBe(id);
  });

  it('generates x-request-id when not provided', async () => {
    const res = await request(app).get('/users');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// GET /users/:id
// ---------------------------------------------------------------------------
describe('GET /users/:id', () => {
  it('returns the user when found', async () => {
    const res = await request(app).get(`/users/${SEED_ID_1}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: SEED_ID_1,
      name: 'Alice Nguyen',
      email: 'alice@example.com',
      role: 'admin',
    });
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await request(app).get('/users/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.error.message).toContain('nonexistent-id');
  });
});

// ---------------------------------------------------------------------------
// POST /users
// ---------------------------------------------------------------------------
describe('POST /users', () => {
  it('creates a user and returns 201', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Test User', email: 'testuser@example.com', role: 'viewer' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Test User',
      email: 'testuser@example.com',
      role: 'viewer',
    });
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
  });

  it('defaults role to viewer when omitted', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'No Role User', email: 'norole@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('viewer');
  });

  it('lowercases email on create', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Case Test', email: 'CaseTest@EXAMPLE.COM' });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('casetest@example.com');
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'noname@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((d: { field: string }) => d.field === 'name')).toBe(true);
  });

  it('returns 422 when email is invalid', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Bad Email', email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when name is shorter than 2 characters', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'X', email: 'short@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 on duplicate email', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Duplicate Alice', email: 'alice@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 422 for invalid role', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Bad Role', email: 'badrole@example.com', role: 'superadmin' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// PATCH /users/:id
// ---------------------------------------------------------------------------
describe('PATCH /users/:id', () => {
  it('partially updates a user', async () => {
    const res = await request(app)
      .patch(`/users/${SEED_ID_2}`)
      .send({ name: 'Bob Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Bob Updated');
    expect(res.body.data.email).toBe('bob@example.com'); // unchanged
  });

  it('returns 404 for a non-existent user', async () => {
    const res = await request(app)
      .patch('/users/does-not-exist')
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 409 when updating to an email that already exists', async () => {
    const res = await request(app)
      .patch(`/users/${SEED_ID_2}`)
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 422 when body is empty', async () => {
    const res = await request(app)
      .patch(`/users/${SEED_ID_1}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// DELETE /users/:id
// ---------------------------------------------------------------------------
describe('DELETE /users/:id', () => {
  it('deletes the user and returns 204', async () => {
    // Create a throwaway user to delete
    const createRes = await request(app)
      .post('/users')
      .send({ name: 'To Delete', email: 'todelete@example.com' });

    const userId = createRes.body.data.id;

    const deleteRes = await request(app).delete(`/users/${userId}`);
    expect(deleteRes.status).toBe(204);

    // Confirm it's actually gone
    const getRes = await request(app).get(`/users/${userId}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 when deleting a non-existent user', async () => {
    const res = await request(app).delete('/users/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Simulated repository failure — 500 error path
// ---------------------------------------------------------------------------
describe('Simulated repository failure', () => {
  it('returns 500 when the repository throws an unexpected error', async () => {
    const brokenRepo = new InMemoryUserRepository();
    vi.spyOn(brokenRepo, 'findAll').mockRejectedValueOnce(new Error('Storage exploded'));

    const brokenService = new UsersService(brokenRepo);
    const brokenController = new UsersController(brokenService);

    // Build a minimal isolated app — routes are added BEFORE the error handler
    const isolatedApp = express();
    isolatedApp.use(express.json());
    isolatedApp.use(requestId);
    isolatedApp.get('/users', (req, res, next) => {
      brokenController.listUsers(req, res, next);
    });
    // Error handler must be last
    isolatedApp.use(errorHandler);

    const res = await request(isolatedApp).get('/users');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    // Must NOT expose internal error message to clients
    expect(res.body.error.message).toBe('An unexpected error occurred');
  });
});
