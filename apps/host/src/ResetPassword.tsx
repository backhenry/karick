import { useState } from 'react';
import type { Brand } from '@karick/shared';
import { BrandMark } from './BrandMark.js';
import { useI18n, LangSwitcher } from './i18n.js';
import { api, type AuthUser } from './lib/api.js';

/** Tela de redefinição de senha (aberta pelo link do e-mail: /host/?reset=TOKEN). */
export function ResetPassword({ token, onDone, brand }: { token: string; onDone: (user: AuthUser) => void; brand?: Brand }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await api.resetPassword(token, password);
      onDone(user);
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
        <p className="text-center text-white/60">{t('resetTitle')}</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('newPassword')}
          autoComplete="new-password"
          autoFocus
          className="w-full rounded-lg bg-white/10 p-4 outline-none placeholder:text-white/40"
        />

        {error && <p className="rounded-lg bg-red-500/20 p-3 text-center text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          style={{ background: brand?.primary }}
          className="w-full rounded-lg p-4 text-lg font-bold text-white disabled:opacity-50"
        >
          {busy ? '…' : t('resetSubmit')}
        </button>

        <a href="/host/" className="block w-full text-center text-sm text-white/60 hover:text-white">
          {t('backToLogin')}
        </a>

        <LangSwitcher className="justify-center" />
      </form>
    </div>
  );
}
