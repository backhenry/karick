import type pg from 'pg';
import type { Brand } from '@karick/shared';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(email: string, passwordHash: string): Promise<User>;
  /** Identidade visual persistida do usuário (null = nunca configurou). */
  getBrand(userId: string): Promise<Brand | null>;
  setBrand(userId: string, brand: Brand): Promise<void>;
  /** PIN fixo da "sala permanente" do usuário (null = nunca usado). */
  getFixedPin(userId: string): Promise<string | null>;
  setFixedPin(userId: string, pin: string): Promise<void>;
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
  async getBrand(userId: string): Promise<Brand | null> {
    const { rows } = await this.pool.query(`SELECT brand FROM users WHERE id = $1`, [userId]);
    const b = rows[0]?.brand;
    return b ? (typeof b === 'string' ? (JSON.parse(b) as Brand) : (b as Brand)) : null;
  }
  async setBrand(userId: string, brand: Brand): Promise<void> {
    await this.pool.query(`UPDATE users SET brand = $2 WHERE id = $1`, [userId, JSON.stringify(brand)]);
  }
  async getFixedPin(userId: string): Promise<string | null> {
    const { rows } = await this.pool.query(`SELECT fixed_pin FROM users WHERE id = $1`, [userId]);
    return rows[0]?.fixed_pin ?? null;
  }
  async setFixedPin(userId: string, pin: string): Promise<void> {
    await this.pool.query(`UPDATE users SET fixed_pin = $2 WHERE id = $1`, [userId, pin]);
  }
}

function row(r: { id: string; email: string; password_hash: string }): User {
  return { id: r.id, email: r.email, passwordHash: r.password_hash };
}

export class InMemoryUserRepository implements UserRepository {
  private byId = new Map<string, User>();
  private brands = new Map<string, Brand>();
  private pins = new Map<string, string>();

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
  async getBrand(userId: string): Promise<Brand | null> {
    return this.brands.get(userId) ?? null;
  }
  async setBrand(userId: string, brand: Brand): Promise<void> {
    this.brands.set(userId, brand);
  }
  async getFixedPin(userId: string): Promise<string | null> {
    return this.pins.get(userId) ?? null;
  }
  async setFixedPin(userId: string, pin: string): Promise<void> {
    this.pins.set(userId, pin);
  }
}
