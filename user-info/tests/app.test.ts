import {describe, expect, it} from 'vitest';
import request from 'supertest';
import {createApp} from '../src/app.js';

const app = createApp();

describe('route-local error trigger', () => {
  it('returns 500 for profile routes when ?error=true', async () => {
    const res = await request(app).get('/user/1/profile?error=true');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('keeps profile routes successful without ?error=true', async () => {
    const res = await request(app).get('/user/1/profile');

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('1');
  });

  it('does not force errors on unrelated routes', async () => {
    const res = await request(app).get('/health?error=true');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({status: 'ok'});
  });
});
