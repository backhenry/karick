import { Router, type Response } from 'express';
import type { UserRepository } from '../store/userRepository.js';
import { hashPassword, verifyPassword } from './password.js';
import { signSession, verifySession, SESSION_COOKIE, SESSION_MAX_AGE_MS } from './session.js';
import { RateLimiter } from '../util/rateLimiter.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const authLimiter = new RateLimiter(10, 60_000); // 10 tentativas/min por IP

export function createAuthRouter(users: UserRepository): Router {
  const r = Router();
  const isProd = process.env.NODE_ENV === 'production';

  const setCookie = (res: Response, userId: string) =>
    res.cookie(SESSION_COOKIE, signSession(userId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });

  r.post('/signup', async (req, res, next) => {
    try {
      if (!authLimiter.allow(req.ip ?? 'x')) return res.status(429).json({ error: 'Muitas tentativas, aguarde.' });
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
      if (password.length < MIN_PASSWORD) return res.status(400).json({ error: `A senha precisa de ao menos ${MIN_PASSWORD} caracteres.` });
      if (await users.findByEmail(email)) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });

      const user = await users.create(email, hashPassword(password));
      setCookie(res, user.id);
      res.status(201).json({ id: user.id, email: user.email });
    } catch (e) {
      next(e);
    }
  });

  r.post('/login', async (req, res, next) => {
    try {
      if (!authLimiter.allow(req.ip ?? 'x')) return res.status(429).json({ error: 'Muitas tentativas, aguarde.' });
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      const user = await users.findByEmail(email);
      // Mensagem genérica (não revela se o e-mail existe).
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      }
      setCookie(res, user.id);
      res.json({ id: user.id, email: user.email });
    } catch (e) {
      next(e);
    }
  });

  r.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  r.get('/me', async (req, res, next) => {
    try {
      const cookie = req.headers.cookie ?? '';
      const token = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
      const userId = verifySession(token && decodeURIComponent(token));
      if (!userId) return res.status(401).json({ error: 'Não autenticado' });
      const user = await users.findById(userId);
      if (!user) return res.status(401).json({ error: 'Não autenticado' });
      res.json({ id: user.id, email: user.email });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
