import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError, FieldError } from '../errors/index.js';
import { logger } from '../logger.js';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Factory that returns an Express middleware which validates the specified
 * request part against a Zod schema. On success it replaces `req[part]`
 * with the parsed (and coerced) value so downstream handlers work with
 * the typed output, not the raw string input.
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const fields = mapZodError(result.error);
      const requestId = req.headers['x-request-id'] as string | undefined;
      logger.warn({ requestId, part, fields }, 'Request validation failed');
      return next(new ValidationError(fields));
    }

    // Mutate the request part with the coerced/transformed value
    (req as Record<string, unknown>)[part] = result.data;
    next();
  };
}

function mapZodError(error: ZodError): FieldError[] {
  return error.errors.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));
}
