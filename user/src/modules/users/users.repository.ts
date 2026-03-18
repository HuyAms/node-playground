import { trace, SpanStatusCode } from '@opentelemetry/api';
import { ATTR_DB_OPERATION_NAME, ATTR_DB_COLLECTION_NAME } from '@opentelemetry/semantic-conventions';
import { User, CreateUserInput, UpdateUserInput } from './users.schema.js';
import { PaginationQuery, toOffset } from '../../shared/types/pagination.js';
import { config } from '../../config.js';
import { delay } from '../../utils/delay.js';

const tracer = trace.getTracer('users-repository', '1.0');
const DB_COLLECTION = 'users';

export interface UserRepository {
  findAll(pagination: PaginationQuery): Promise<{ users: User[]; total: number }>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(id: string, input: CreateUserInput, now: string): Promise<User>;
  update(id: string, input: UpdateUserInput, updatedAt: string): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Seed data — covers all roles and provides enough records for pagination tests
// ---------------------------------------------------------------------------
const SEED_USERS: User[] = [
  {
    id: '1',
    name: 'Alice Nguyen',
    email: 'alice@example.com',
    role: 'admin',
    createdAt: '2024-01-10T08:00:00.000Z',
    updatedAt: '2024-01-10T08:00:00.000Z',
  },
  {
    id: '2',
    name: 'Bob Chen',
    email: 'bob@example.com',
    role: 'editor',
    createdAt: '2024-01-11T09:15:00.000Z',
    updatedAt: '2024-01-11T09:15:00.000Z',
  },
  {
    id: '3',
    name: 'Carol Smith',
    email: 'carol@example.com',
    role: 'viewer',
    createdAt: '2024-01-12T10:30:00.000Z',
    updatedAt: '2024-01-12T10:30:00.000Z',
  },
  {
    id: '4',
    name: 'David Kim',
    email: 'david@example.com',
    role: 'editor',
    createdAt: '2024-01-13T11:00:00.000Z',
    updatedAt: '2024-01-13T11:00:00.000Z',
  },
  {
    id: '5',
    name: 'Eva Martinez',
    email: 'eva@example.com',
    role: 'viewer',
    createdAt: '2024-01-14T12:00:00.000Z',
    updatedAt: '2024-01-14T12:00:00.000Z',
  },
  {
    id: '6',
    name: 'Frank Obi',
    email: 'frank@example.com',
    role: 'admin',
    createdAt: '2024-01-15T13:00:00.000Z',
    updatedAt: '2024-01-15T13:00:00.000Z',
  },
  {
    id: '7',
    name: 'Grace Lee',
    email: 'grace@example.com',
    role: 'viewer',
    createdAt: '2024-01-16T14:00:00.000Z',
    updatedAt: '2024-01-16T14:00:00.000Z',
  },
  {
    id: '8',
    name: 'Henry Park',
    email: 'henry@example.com',
    role: 'editor',
    createdAt: '2024-01-17T15:00:00.000Z',
    updatedAt: '2024-01-17T15:00:00.000Z',
  },
  {
    id: '9',
    name: 'Irene Walsh',
    email: 'irene@example.com',
    role: 'viewer',
    createdAt: '2024-01-18T16:00:00.000Z',
    updatedAt: '2024-01-18T16:00:00.000Z',
  },
  {
    id: '10',
    name: 'James Torres',
    email: 'james@example.com',
    role: 'editor',
    createdAt: '2024-01-19T17:00:00.000Z',
    updatedAt: '2024-01-19T17:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------
export class InMemoryUserRepository implements UserRepository {
  // Shallow-copy seed so tests that reset module state start clean
  private store: User[] = SEED_USERS.map((u) => ({ ...u }));
  private nextId = SEED_USERS.length + 1;

  async findAll(pagination: PaginationQuery): Promise<{ users: User[]; total: number }> {
    return tracer.startActiveSpan(
      'db.users.findAll',
      {
        attributes: {
          [ATTR_DB_OPERATION_NAME]: 'findAll',
          [ATTR_DB_COLLECTION_NAME]: DB_COLLECTION,
        },
      },
      async (span) => {
        try {
          const total = this.store.length;
          const offset = toOffset(pagination.page, pagination.limit);
          const users = this.store.slice(offset, offset + pagination.limit);
          return { users, total };
        } finally {
          span.end();
        }
      },
    );
  }

  async findById(id: string): Promise<User | null> {
    return tracer.startActiveSpan(
      'db.users.findById',
      {
        attributes: {
          [ATTR_DB_OPERATION_NAME]: 'findById',
          [ATTR_DB_COLLECTION_NAME]: DB_COLLECTION,
          'user.id': id,
        },
      },
      async (span) => {
        try {
          if (config.enableFakeSlowness) {
            await delay(50 + Math.random() * 100);
          }
          return this.store.find((u) => u.id === id) ?? null;
        } finally {
          span.end();
        }
      },
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return tracer.startActiveSpan(
      'db.users.findByEmail',
      {
        attributes: {
          [ATTR_DB_OPERATION_NAME]: 'findByEmail',
          [ATTR_DB_COLLECTION_NAME]: DB_COLLECTION,
          'user.email': email,
        },
      },
      async (span) => {
        try {
          return this.store.find((u) => u.email === email) ?? null;
        } finally {
          span.end();
        }
      },
    );
  }

  async create(_id: string, input: CreateUserInput, now: string): Promise<User> {
    return tracer.startActiveSpan(
      'db.users.create',
      {
        attributes: {
          [ATTR_DB_OPERATION_NAME]: 'create',
          [ATTR_DB_COLLECTION_NAME]: DB_COLLECTION,
        },
      },
      async (span) => {
        try {
          const user: User = {
            id: String(this.nextId++),
            name: input.name,
            email: input.email,
            role: input.role,
            createdAt: now,
            updatedAt: now,
          };
          span.setAttribute('user.id', user.id);
          this.store.push(user);
          return user;
        } finally {
          span.end();
        }
      },
    );
  }

  async update(id: string, input: UpdateUserInput, updatedAt: string): Promise<User | null> {
    return tracer.startActiveSpan(
      'db.users.update',
      {
        attributes: {
          [ATTR_DB_OPERATION_NAME]: 'update',
          [ATTR_DB_COLLECTION_NAME]: DB_COLLECTION,
          'user.id': id,
        },
      },
      async (span) => {
        try {
          const index = this.store.findIndex((u) => u.id === id);
          if (index === -1) return null;

          const existing = this.store[index];
          const updated: User = {
            ...existing,
            ...(input.name !== undefined && { name: input.name }),
            ...(input.email !== undefined && { email: input.email }),
            ...(input.role !== undefined && { role: input.role }),
            updatedAt,
          };
          this.store[index] = updated;
          return updated;
        } finally {
          span.end();
        }
      },
    );
  }

  async delete(id: string): Promise<boolean> {
    return tracer.startActiveSpan(
      'db.users.delete',
      {
        attributes: {
          [ATTR_DB_OPERATION_NAME]: 'delete',
          [ATTR_DB_COLLECTION_NAME]: DB_COLLECTION,
          'user.id': id,
        },
      },
      async (span) => {
        try {
          const before = this.store.length;
          this.store = this.store.filter((u) => u.id !== id);
          return this.store.length < before;
        } finally {
          span.end();
        }
      },
    );
  }
}

export const userRepository = new InMemoryUserRepository();
