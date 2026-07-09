import type { Request, Response, NextFunction } from 'express';
import { userIdFromCookieHeader } from './session.js';

/** Middleware: exige sessão válida; expõe o userId em res.locals.userId. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = userIdFromCookieHeader(req.headers.cookie);
  if (!userId) return res.status(401).json({ error: 'Não autenticado' });
  res.locals.userId = userId;
  next();
}
