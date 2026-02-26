import { User, CreateUserInput, UpdateUserInput } from './users.schema.js';
import { PaginationQuery, toOffset } from '../../shared/types/pagination.js';

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
    id: '11111111-0000-0000-0000-000000000001',
    name: 'Alice Nguyen',
    email: 'alice@example.com',
    role: 'admin',
    createdAt: '2024-01-10T08:00:00.000Z',
    updatedAt: '2024-01-10T08:00:00.000Z',
  },
  {
    id: '11111111-0000-0000-0000-000000000002',
    name: 'Bob Chen',
    email: 'bob@example.com',
    role: 'editor',
    createdAt: '2024-01-11T09:15:00.000Z',
    updatedAt: '2024-01-11T09:15:00.000Z',
  },
  {
    id: '11111111-0000-0000-0000-000000000003',
    name: 'Carol Smith',
    email: 'carol@example.com',
    role: 'viewer',
    createdAt: '2024-01-12T10:30:00.000Z',
    updatedAt: '2024-01-12T10:30:00.000Z',
  },
  {
    id: '11111111-0000-0000-0000-000000000004',
    name: 'David Kim',
    email: 'david@example.com',
    role: 'editor',
    createdAt: '2024-01-13T11:00:00.000Z',
    updatedAt: '2024-01-13T11:00:00.000Z',
  },
  {
    id: '11111111-0000-0000-0000-000000000005',
    name: 'Eva Martinez',
    email: 'eva@example.com',
    role: 'viewer',
    createdAt: '2024-01-14T12:00:00.000Z',
    updatedAt: '2024-01-14T12:00:00.000Z',
  },
  {
    id: '11111111-0000-0000-0000-000000000006',
    name: 'Frank Obi',
    email: 'frank@example.com',
    role: 'admin',
    createdAt: '2024-01-15T13:00:00.000Z',
    updatedAt: '2024-01-15T13:00:00.000Z',
  },
  {
    id: '11111111-0000-0000-0000-000000000007',
    name: 'Grace Lee',
    email: 'grace@example.com',
    role: 'viewer',
    createdAt: '2024-01-16T14:00:00.000Z',
    updatedAt: '2024-01-16T14:00:00.000Z',
  },
  {
    id: '11111111-0000-0000-0000-000000000008',
    name: 'Henry Park',
    email: 'henry@example.com',
    role: 'editor',
    createdAt: '2024-01-17T15:00:00.000Z',
    updatedAt: '2024-01-17T15:00:00.000Z',
  },
  {
    id: '11111111-0000-0000-0000-000000000009',
    name: 'Irene Walsh',
    email: 'irene@example.com',
    role: 'viewer',
    createdAt: '2024-01-18T16:00:00.000Z',
    updatedAt: '2024-01-18T16:00:00.000Z',
  },
  {
    id: '11111111-0000-0000-0000-000000000010',
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

  async findAll(pagination: PaginationQuery): Promise<{ users: User[]; total: number }> {
    const total = this.store.length;
    const offset = toOffset(pagination.page, pagination.limit);
    const users = this.store.slice(offset, offset + pagination.limit);
    return { users, total };
  }

  async findById(id: string): Promise<User | null> {
    return this.store.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.store.find((u) => u.email === email) ?? null;
  }

  async create(id: string, input: CreateUserInput, now: string): Promise<User> {
    const user: User = {
      id,
      name: input.name,
      email: input.email,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    };
    this.store.push(user);
    return user;
  }

  async update(id: string, input: UpdateUserInput, updatedAt: string): Promise<User | null> {
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
  }

  async delete(id: string): Promise<boolean> {
    const before = this.store.length;
    this.store = this.store.filter((u) => u.id !== id);
    return this.store.length < before;
  }
}

export const userRepository = new InMemoryUserRepository();
