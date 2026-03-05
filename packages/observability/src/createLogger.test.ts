import { describe, it, expect } from 'vitest';
import { createLogger } from './createLogger.js';

describe('createLogger', () => {
  it('returns logger and httpLogger', () => {
    const result = createLogger({
      env: 'test',
      logLevel: 'silent',
      job: 'test-job',
    });
    expect(result.logger).toBeDefined();
    expect(result.httpLogger).toBeDefined();
    expect(typeof result.httpLogger).toBe('function');
  });
});
