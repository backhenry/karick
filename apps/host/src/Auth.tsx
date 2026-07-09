import { useState } from 'react';
import { api, type AuthUser } from './lib/api.js';

/** Tela de login/cadastro do apresentador. */
export function Auth({ onAuthed }: { onAuthed: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = mode === 'login' ? await api.login(email, password) : await api.signup(email, password);
      onAuthed(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-4xl font-black text-indigo-400">Karick</h1>
        <p className="text-center text-white/60">
          {mode === 'login' ? 'Entre para gerenciar seus quizzes' : 'Crie sua conta'}
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          autoComplete="email"
          className="w-full rounded-lg bg-white/10 p-4 outline-none placeholder:text-white/40"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'signup' ? 'Senha (mín. 8 caracteres)' : 'Senha'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="w-full rounded-lg bg-white/10 p-4 outline-none placeholder:text-white/40"
        />

        {error && <p className="rounded-lg bg-red-500/20 p-3 text-center text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-indigo-600 p-4 text-lg font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? '…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'signup' : 'login'));
            setError(null);
          }}
          className="w-full text-center text-sm text-white/60 hover:text-white"
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  );
}
