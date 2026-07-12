import { useState } from 'react';
import type { Brand } from '@karick/shared';
import { BrandMark } from './BrandMark.js';
import { useI18n, LangSwitcher } from './i18n.js';
import { api, type AuthUser } from './lib/api.js';

/** Tela de login/cadastro do apresentador. */
export function Auth({ onAuthed, brand }: { onAuthed: (user: AuthUser) => void; brand?: Brand }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null); // mensagem de "e-mail enviado" (+ link em dev)

  const switchMode = (m: 'login' | 'signup' | 'forgot') => {
    setMode(m);
    setError(null);
    setSent(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const res = await api.forgotPassword(email);
        setSent(res.devLink ?? '');
      } else {
        const user = mode === 'login' ? await api.login(email, password) : await api.signup(email, password);
        onAuthed(user);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-slate-100" style={{ background: brand?.bg }}>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <BrandMark brand={brand} imgClass="mx-auto max-h-20" nameClass="text-center text-4xl font-black" />
        <p className="text-center text-white/60">
          {mode === 'login' ? t('loginSubtitle') : mode === 'signup' ? t('signupSubtitle') : t('forgotSubtitle')}
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('email')}
          autoComplete="email"
          className="w-full rounded-lg bg-white/10 p-4 outline-none placeholder:text-white/40"
        />
        {mode !== 'forgot' && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? t('passwordSignup') : t('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full rounded-lg bg-white/10 p-4 outline-none placeholder:text-white/40"
          />
        )}

        {error && <p className="rounded-lg bg-red-500/20 p-3 text-center text-sm text-red-300">{error}</p>}
        {sent !== null && (
          <div className="rounded-lg bg-emerald-500/20 p-3 text-center text-sm text-emerald-200">
            <p>{t('forgotSent')}</p>
            {sent && (
              <a href={sent} className="mt-1 block break-all text-xs text-emerald-300 underline">
                {t('forgotDevLink')}
              </a>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{ background: brand?.primary }}
          className="w-full rounded-lg p-4 text-lg font-bold text-white disabled:opacity-50"
        >
          {busy ? '…' : mode === 'login' ? t('login') : mode === 'signup' ? t('signup') : t('forgotSubmit')}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => switchMode('forgot')}
            className="w-full text-center text-sm text-white/50 hover:text-white"
          >
            {t('forgotLink')}
          </button>
        )}

        <button
          type="button"
          onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          className="w-full text-center text-sm text-white/60 hover:text-white"
        >
          {mode === 'login' ? t('toSignup') : mode === 'signup' ? t('toLogin') : t('backToLogin')}
        </button>

        <LangSwitcher className="justify-center" />
      </form>
    </div>
  );
}
