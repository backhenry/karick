import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Sessão sem estado: token = base64url(payload).assinaturaHMAC.
 * Guardado num cookie HttpOnly. Sem tabela de sessões (revogação só por expiração).
 */
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET não definido — usando segredo efêmero (sessões caem no restart).');
}

export const SESSION_COOKIE = 'karick_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function signSession(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + SESSION_MAX_AGE_MS })).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token?: string): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { userId, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof userId !== 'string' || typeof exp !== 'number' || Date.now() > exp) return null;
    return userId;
  } catch {
    return null;
  }
}

/** Extrai o userId a partir do cabeçalho Cookie bruto (usado no HTTP e no socket). */
export function userIdFromCookieHeader(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return verifySession(decodeURIComponent(rest.join('=')));
  }
  return null;
}
