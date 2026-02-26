import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from './users.repository.js';
import { User, CreateUserInput, UpdateUserInput } from './users.schema.js';
import { PaginationQuery, PaginatedResult, buildPaginationMeta } from '../../shared/types/pagination.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger.js';

export class UsersService {
  constructor(private readonly repo: UserRepository) {}

  async listUsers(
    pagination: PaginationQuery,
    requestId?: string,
  ): Promise<PaginatedResult<User>> {
    const { users, total } = await this.repo.findAll(pagination);
    const meta = buildPaginationMeta(total, pagination.page, pagination.limit);

    logger.info({ requestId, total, page: pagination.page, limit: pagination.limit }, 'Users listed');

    return { data: users, meta };
  }

  async getUserById(id: string, requestId?: string): Promise<User> {
    const user = await this.repo.findById(id);

    if (!user) {
      logger.warn({ requestId, userId: id }, 'User not found');
      throw new NotFoundError('User', id);
    }

    logger.info({ requestId, userId: id }, 'User retrieved');
    return user;
  }

  async createUser(input: CreateUserInput, requestId?: string): Promise<User> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      logger.warn({ requestId, email: input.email }, 'User creation conflict — email already exists');
      throw new ConflictError(`A user with email '${input.email}' already exists`);
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const user = await this.repo.create(id, input, now);

    logger.info({ requestId, userId: user.id }, 'User created');
    return user;
  }

  async updateUser(id: string, input: UpdateUserInput, requestId?: string): Promise<User> {
    // If updating email, check for conflicts with other users
    if (input.email) {
      const existing = await this.repo.findByEmail(input.email);
      if (existing && existing.id !== id) {
        logger.warn({ requestId, email: input.email }, 'User update conflict — email already exists');
        throw new ConflictError(`A user with email '${input.email}' already exists`);
      }
    }

    const updatedAt = new Date().toISOString();
    const user = await this.repo.update(id, input, updatedAt);

    if (!user) {
      logger.warn({ requestId, userId: id }, 'User not found for update');
      throw new NotFoundError('User', id);
    }

    logger.info({ requestId, userId: id }, 'User updated');
    return user;
  }

  async deleteUser(id: string, requestId?: string): Promise<void> {
    const deleted = await this.repo.delete(id);

    if (!deleted) {
      logger.warn({ requestId, userId: id }, 'User not found for deletion');
      throw new NotFoundError('User', id);
    }

    logger.info({ requestId, userId: id }, 'User deleted');
  }
}
