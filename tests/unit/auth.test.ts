import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../apps/server/src/auth/password';
import { signSession, verifySession, SESSION_MAX_AGE_MS } from '../../apps/server/src/auth/session';

describe('password (scrypt)', () => {
  it('faz roundtrip da senha correta', () => {
    const h = hashPassword('senha-forte-1');
    expect(verifyPassword('senha-forte-1', h)).toBe(true);
  });
  it('rejeita senha errada', () => {
    expect(verifyPassword('errada', hashPassword('certa-123'))).toBe(false);
  });
  it('usa salt aleatório (hashes diferentes p/ mesma senha)', () => {
    expect(hashPassword('x1234567')).not.toBe(hashPassword('x1234567'));
  });
  it('formato salt:hash', () => {
    expect(hashPassword('abc12345')).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });
  it('não quebra com stored malformado', () => {
    expect(verifyPassword('x', 'lixo-sem-doispontos')).toBe(false);
  });
});

describe('session (cookie HMAC)', () => {
  it('faz roundtrip do userId', () => {
    const token = signSession('u_abc');
    expect(verifySession(token)).toBe('u_abc');
  });
  it('rejeita token adulterado', () => {
    const token = signSession('u_abc');
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect(verifySession(tampered)).toBeNull();
  });
  it('rejeita lixo e vazio', () => {
    expect(verifySession('nao-e-token')).toBeNull();
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession('')).toBeNull();
  });
  it('expira sessões antigas', () => {
    // Assina "no passado" manipulando a validade via idade máxima conhecida.
    // Como signSession usa Date.now, testamos que um exp já vencido é rejeitado:
    const realNow = Date.now;
    Date.now = () => realNow() - SESSION_MAX_AGE_MS - 60_000;
    const oldToken = signSession('u_old');
    Date.now = realNow;
    expect(verifySession(oldToken)).toBeNull();
  });
});
