import {trace, SpanStatusCode} from '@opentelemetry/api';
import {v4 as uuidv4} from 'uuid';
import {enrichWideEvent, getWideEvent} from '@node-playground/observability';
import {UserRepository} from './users.repository.js';
import {User, CreateUserInput, UpdateUserInput} from './users.schema.js';
import {
  PaginationQuery,
  PaginatedResult,
  buildPaginationMeta,
} from '../../shared/types/pagination.js';
import {NotFoundError, ConflictError} from '../../shared/errors/index.js';
import {cacheHitsTotal, cacheMissesTotal, cacheSize} from '../../shared/metrics.js';
import {getUserProfile, UserProfilePayload} from '../../shared/userInfoClient.js';

const tracer = trace.getTracer('users-service', '1.0');
const CACHE_NAME = 'users';
const CACHE_TTL_MS = 10_000;

interface CacheEntry {
  user: User;
  expiresAt: number;
}

export class UsersService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly repo: UserRepository) {}

  async listUsers(pagination: PaginationQuery): Promise<PaginatedResult<User>> {
    return tracer.startActiveSpan(
      'list users',
      {attributes: {page: pagination.page, limit: pagination.limit}},
      async (span) => {
        try {
          const {users, total} = await this.repo.findAll(pagination);
          span.setAttribute('total', total);
          const meta = buildPaginationMeta(total, pagination.page, pagination.limit);

          enrichWideEvent({
            pagination: {page: pagination.page, limit: pagination.limit, total},
          });

          return {data: users, meta};
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({code: SpanStatusCode.ERROR});
          throw err;
        } finally {
          span.end();
        }
      }
    );
  }

  async getUserById(id: string): Promise<User> {
    return tracer.startActiveSpan(
      'get user',
      {attributes: {'user.id': id}},
      async (span) => {
        try {
          const cached = this.cache.get(id);
          if (cached && cached.expiresAt > Date.now()) {
            cacheHitsTotal.inc({cache: CACHE_NAME});
            span.setAttribute('cache.hit', true);
            enrichWideEvent({user: {id}, cache: {hit: true}});
            return cached.user;
          }

          span.setAttribute('cache.hit', false);
          cacheMissesTotal.inc({cache: CACHE_NAME});
          const user = await this.repo.findById(id);

          if (!user) {
            enrichWideEvent({user: {id}, cache: {hit: false}, notFound: true});
            throw new NotFoundError('User', id);
          }

          this.cache.set(id, {user, expiresAt: Date.now() + CACHE_TTL_MS});
          cacheSize.set({cache: CACHE_NAME}, this.cache.size);
          enrichWideEvent({user: {id}, cache: {hit: false}});
          return user;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({code: SpanStatusCode.ERROR});
          throw err;
        } finally {
          span.end();
        }
      }
    );
  }

  async getUserWithProfile(
    id: string
  ): Promise<{user: User; profile: UserProfilePayload}> {
    return tracer.startActiveSpan(
      'get user profile',
      {attributes: {'user.id': id}},
      async (span) => {
        try {
          const user = await this.getUserById(id);
          const requestId = (getWideEvent()?.requestId as string) ?? undefined;
          const profile = await getUserProfile(id, requestId);
          return {user, profile};
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({code: SpanStatusCode.ERROR});
          throw err;
        } finally {
          span.end();
        }
      }
    );
  }

  async createUser(input: CreateUserInput): Promise<User> {
    return tracer.startActiveSpan(
      'create user',
      {attributes: {'user.email': input.email, 'user.role': input.role}},
      async (span) => {
        try {
          const existing = await this.repo.findByEmail(input.email);
          if (existing) {
            enrichWideEvent({conflict: {email: input.email}});
            throw new ConflictError(`A user with email '${input.email}' already exists`);
          }

          const id = uuidv4();
          const now = new Date().toISOString();
          const user = await this.repo.create(id, input, now);
          span.setAttribute('user.id', user.id);

          enrichWideEvent({user: {id: user.id, role: input.role}});
          return user;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({code: SpanStatusCode.ERROR});
          throw err;
        } finally {
          span.end();
        }
      }
    );
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    return tracer.startActiveSpan(
      'update user',
      {attributes: {'user.id': id}},
      async (span) => {
        try {
          if (input.email) {
            const existing = await this.repo.findByEmail(input.email);
            if (existing && existing.id !== id) {
              enrichWideEvent({conflict: {email: input.email}});
              throw new ConflictError(`A user with email '${input.email}' already exists`);
            }
          }

          const updatedAt = new Date().toISOString();
          const user = await this.repo.update(id, input, updatedAt);

          if (!user) {
            enrichWideEvent({user: {id}, notFound: true});
            throw new NotFoundError('User', id);
          }

          this.cache.delete(id);
          cacheSize.set({cache: CACHE_NAME}, this.cache.size);
          enrichWideEvent({user: {id}, updatedFields: Object.keys(input)});
          return user;
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({code: SpanStatusCode.ERROR});
          throw err;
        } finally {
          span.end();
        }
      }
    );
  }

  async deleteUser(id: string): Promise<void> {
    return tracer.startActiveSpan(
      'delete user',
      {attributes: {'user.id': id}},
      async (span) => {
        try {
          const deleted = await this.repo.delete(id);

          if (!deleted) {
            enrichWideEvent({user: {id}, notFound: true});
            throw new NotFoundError('User', id);
          }

          this.cache.delete(id);
          cacheSize.set({cache: CACHE_NAME}, this.cache.size);
          enrichWideEvent({user: {id}});
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({code: SpanStatusCode.ERROR});
          throw err;
        } finally {
          span.end();
        }
      }
    );
  }
}
