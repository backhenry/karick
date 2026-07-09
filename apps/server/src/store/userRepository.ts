import type pg from 'pg';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(email: string, passwordHash: string): Promise<User>;
}

const genId = () => 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export class PostgresUserRepository implements UserRepository {
  constructor(private pool: pg.Pool) {}

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query(
      `SELECT id, email, password_hash FROM users WHERE email = $1`,
      [email],
    );
    return rows[0] ? row(rows[0]) : null;
  }
  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query(`SELECT id, email, password_hash FROM users WHERE id = $1`, [id]);
    return rows[0] ? row(rows[0]) : null;
  }
  async create(email: string, passwordHash: string): Promise<User> {
    const id = genId();
    const { rows } = await this.pool.query(
      `INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, email, password_hash`,
      [id, email, passwordHash],
    );
    return row(rows[0]);
  }
}

function row(r: { id: string; email: string; password_hash: string }): User {
  return { id: r.id, email: r.email, passwordHash: r.password_hash };
}

export class InMemoryUserRepository implements UserRepository {
  private byId = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    return [...this.byId.values()].find((u) => u.email === email) ?? null;
  }
  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }
  async create(email: string, passwordHash: string): Promise<User> {
    const user: User = { id: genId(), email, passwordHash };
    this.byId.set(user.id, user);
    return user;
  }
}
