import { User, CreateUserInput, UpdateUserInput } from './users.schema.js';
import { PaginationQuery } from '../../shared/types/pagination.js';

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
export const SEED_USERS: User[] = [
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

