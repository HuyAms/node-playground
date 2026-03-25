import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service.js';
import { CreateUserInput, UpdateUserInput, PaginationQuery } from './users.schema.js';

const FORCED_ERROR_MESSAGE = 'Forced post-processing error via ?error=true';

function shouldForceError(req: Request): boolean {
  const value = req.query.error;

  if (Array.isArray(value)) {
    return value.includes('true');
  }

  return value === 'true';
}

/**
 * Controllers are intentionally thin. Their only responsibilities:
 * - Extract validated data from req (already parsed by validate middleware)
 * - Delegate to the service
 * - Map the result to an HTTP response
 *
 * No business logic. No direct repository access. No try/catch —
 * async errors propagate to the centralized errorHandler via next().
 */
export class UsersController {
  constructor(private readonly service: UsersService) {}

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as PaginationQuery;
      const result = await this.service.listUsers(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { user, profile } = await this.service.getUserWithProfile(id);
      res.status(200).json({ data: { ...user, profile } });
    } catch (err) {
      next(err);
    }
  };

  getUserInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { user, profile } = await this.service.getUserWithProfile(id);

      if (shouldForceError(req)) {
        throw new Error(FORCED_ERROR_MESSAGE);
      }

      res.status(200).json({ data: { ...user, profile } });
    } catch (err) {
      next(err);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreateUserInput;
      const user = await this.service.createUser(input);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const input = req.body as UpdateUserInput;
      const user = await this.service.updateUser(id, input);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.deleteUser(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
