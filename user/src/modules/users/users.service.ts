import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from './users.repository.js';
import { User, CreateUserInput, UpdateUserInput } from './users.schema.js';
import { PaginationQuery, PaginatedResult, buildPaginationMeta } from '../../shared/types/pagination.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';
import { logger } from '../../shared/logger.js';
import { cacheHitsTotal, cacheMissesTotal, cacheSize } from '../../shared/metrics.js';
import { getUserProfile, UserProfilePayload } from '../../shared/userInfoClient.js';

const CACHE_NAME = 'users';
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  user: User;
  expiresAt: number;
}

export class UsersService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly repo: UserRepository) {}

  async listUsers(
    pagination: PaginationQuery,
    requestId?: string,
  ): Promise<PaginatedResult<User>> {
    const { users, total } = await this.repo.findAll(pagination);
    const meta = buildPaginationMeta(total, pagination.page, pagination.limit);

    logger.debug({ requestId, total, page: pagination.page, limit: pagination.limit }, 'Users listed');

    return { data: users, meta };
  }

  async getUserById(id: string, requestId?: string): Promise<User> {
    logger.debug({ requestId, userId: id }, 'Looking up user by id');

    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      cacheHitsTotal.inc({ cache: CACHE_NAME });
      logger.debug({ requestId, userId: id }, 'User cache hit');
      return cached.user;
    }

    cacheMissesTotal.inc({ cache: CACHE_NAME });
    const user = await this.repo.findById(id);

    if (!user) {
      logger.warn({ requestId, userId: id }, 'User not found');
      throw new NotFoundError('User', id);
    }

    this.cache.set(id, { user, expiresAt: Date.now() + CACHE_TTL_MS });
    cacheSize.set({ cache: CACHE_NAME }, this.cache.size);
    logger.debug({ requestId, userId: id }, 'User retrieved and cached');
    return user;
  }

  async getUserWithProfile(
    id: string,
    requestId?: string,
  ): Promise<{ user: User; profile: UserProfilePayload | null }> {
    const user = await this.getUserById(id, requestId);
    let profile: UserProfilePayload | null = null;
    try {
      profile = await getUserProfile(id, requestId);
    } catch (err) {
      logger.warn({ requestId, userId: id, err }, 'user-info service unavailable, returning user without profile');
    }
    return { user, profile };
  }

  async createUser(input: CreateUserInput, requestId?: string): Promise<User> {
    logger.debug({ requestId, email: input.email }, 'Checking email uniqueness');
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      logger.warn({ requestId, email: input.email }, 'User creation conflict — email already exists');
      throw new ConflictError(`A user with email '${input.email}' already exists`);
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    logger.debug({ requestId, userId: id, email: input.email, role: input.role }, 'Persisting new user');
    const user = await this.repo.create(id, input, now);

    logger.info({ requestId, userId: user.id }, 'User created');
    return user;
  }

  async updateUser(id: string, input: UpdateUserInput, requestId?: string): Promise<User> {
    if (input.email) {
      logger.debug({ requestId, userId: id, email: input.email }, 'Checking email uniqueness for update');
      const existing = await this.repo.findByEmail(input.email);
      if (existing && existing.id !== id) {
        logger.warn({ requestId, email: input.email }, 'User update conflict — email already exists');
        throw new ConflictError(`A user with email '${input.email}' already exists`);
      }
    }

    logger.debug({ requestId, userId: id, fields: Object.keys(input) }, 'Updating user');
    const updatedAt = new Date().toISOString();
    const user = await this.repo.update(id, input, updatedAt);

    if (!user) {
      logger.warn({ requestId, userId: id }, 'User not found for update');
      throw new NotFoundError('User', id);
    }

    this.cache.delete(id);
    cacheSize.set({ cache: CACHE_NAME }, this.cache.size);
    logger.info({ requestId, userId: id }, 'User updated');
    return user;
  }

  async deleteUser(id: string, requestId?: string): Promise<void> {
    logger.debug({ requestId, userId: id }, 'Deleting user');
    const deleted = await this.repo.delete(id);

    if (!deleted) {
      logger.warn({ requestId, userId: id }, 'User not found for deletion');
      throw new NotFoundError('User', id);
    }

    this.cache.delete(id);
    cacheSize.set({ cache: CACHE_NAME }, this.cache.size);
    logger.info({ requestId, userId: id }, 'User deleted');
  }
}
