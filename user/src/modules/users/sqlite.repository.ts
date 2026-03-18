import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { User, CreateUserInput, UpdateUserInput } from './users.schema.js';
import { UserRepository } from './users.repository.js';
import { PaginationQuery, toOffset } from '../../shared/types/pagination.js';
import { config } from '../../config.js';
import { delay } from '../../utils/delay.js';
import { SEED_USERS } from './users.repository.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

function rowToUser(row: { id: string; name: string; email: string; role: string; createdAt: string; updatedAt: string }): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as User['role'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SqliteUserRepository implements UserRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.initDb();
  }

  private initDb(): void {
    this.db.exec(SCHEMA);
    const count = this.db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number };
    if (count.n === 0) {
      const insert = this.db.prepare(
        'INSERT INTO users (id, name, email, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      );
      for (const u of SEED_USERS) {
        insert.run(u.id, u.name, u.email, u.role, u.createdAt, u.updatedAt);
      }
    }
  }

  async findAll(pagination: PaginationQuery): Promise<{ users: User[]; total: number }> {
    const total = (this.db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
    const offset = toOffset(pagination.page, pagination.limit);
    const rows = this.db
      .prepare('SELECT id, name, email, role, createdAt, updatedAt FROM users ORDER BY id LIMIT ? OFFSET ?')
      .all(pagination.limit, offset) as { id: string; name: string; email: string; role: string; createdAt: string; updatedAt: string }[];
    const users = rows.map(rowToUser);
    return { users, total };
  }

  async findById(id: string): Promise<User | null> {
    if (config.enableFakeSlowness) {
      await delay(50 + Math.random() * 100);
    }
    const row = this.db
      .prepare('SELECT id, name, email, role, createdAt, updatedAt FROM users WHERE id = ?')
      .get(id) as { id: string; name: string; email: string; role: string; createdAt: string; updatedAt: string } | undefined;
    return row ? rowToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db
      .prepare('SELECT id, name, email, role, createdAt, updatedAt FROM users WHERE email = ?')
      .get(email) as { id: string; name: string; email: string; role: string; createdAt: string; updatedAt: string } | undefined;
    return row ? rowToUser(row) : null;
  }

  async create(id: string, input: CreateUserInput, now: string): Promise<User> {
    this.db
      .prepare('INSERT INTO users (id, name, email, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.name, input.email, input.role, now, now);
    return {
      id,
      name: input.name,
      email: input.email,
      role: input.role,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, input: UpdateUserInput, updatedAt: string): Promise<User | null> {
    const existing = this.db.prepare('SELECT id, name, email, role, createdAt FROM users WHERE id = ?').get(id) as
      | { id: string; name: string; email: string; role: string; createdAt: string }
      | undefined;
    if (!existing) return null;

    const name = input.name !== undefined ? input.name : existing.name;
    const email = input.email !== undefined ? input.email : existing.email;
    const role = input.role !== undefined ? input.role : existing.role;

    this.db.prepare('UPDATE users SET name = ?, email = ?, role = ?, updatedAt = ? WHERE id = ?').run(name, email, role, updatedAt, id);
    return {
      id,
      name,
      email,
      role: role as User['role'],
      createdAt: existing.createdAt,
      updatedAt,
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
