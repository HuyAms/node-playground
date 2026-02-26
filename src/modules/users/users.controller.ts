import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service.js';
import { CreateUserInput, UpdateUserInput, PaginationQuery } from './users.schema.js';

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
      const requestId = req.headers['x-request-id'] as string | undefined;
      const result = await this.service.listUsers(query, requestId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const requestId = req.headers['x-request-id'] as string | undefined;
      const user = await this.service.getUserById(id, requestId);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreateUserInput;
      const requestId = req.headers['x-request-id'] as string | undefined;
      const user = await this.service.createUser(input, requestId);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const input = req.body as UpdateUserInput;
      const requestId = req.headers['x-request-id'] as string | undefined;
      const user = await this.service.updateUser(id, input, requestId);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const requestId = req.headers['x-request-id'] as string | undefined;
      await this.service.deleteUser(id, requestId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
