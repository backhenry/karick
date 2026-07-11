import { useEffect, useState } from 'react';
import type { Brand } from '@karick/shared';
import { QRCodeView } from './QRCode.js';
import { api } from './lib/api.js';

interface Stats {
  quizzes: number;
  games: number;
  players: number;
}

/** Área de perfil: identidade, estatísticas, PIN fixo (com QR e link) e ações da conta. */
export function ProfileModal({
  email,
  brand,
  stats,
  onBranding,
  onLogout,
  onClose,
}: {
  email: string;
  brand?: Brand;
  stats: Stats;
  onBranding: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const [fixedPin, setFixedPin] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .profile()
      .then((p) => setFixedPin(p.fixedPin))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const joinUrl = fixedPin ? `${window.location.origin}/?pin=${fixedPin}` : '';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-800 p-6 text-slate-100">
        <div className="mb-5 flex items-center gap-3">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-black text-white"
            style={{ background: brand?.primary ?? '#6366f1' }}
          >
            {(email[0] ?? '?').toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold" title={email}>{email}</p>
            <p className="text-sm text-white/50">Apresentador</p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20">✕</button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          {[
            [stats.quizzes, 'quizzes'],
            [stats.games, 'partidas'],
            [stats.players, 'jogadores'],
          ].map(([n, label]) => (
            <div key={label} className="rounded-xl bg-white/5 p-3">
              <p className="text-2xl font-black" style={{ color: brand?.primary ?? '#a5b4fc' }}>{n}</p>
              <p className="text-xs text-white/50">{label}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 rounded-xl bg-white/5 p-4">
          <p className="mb-2 font-bold">📌 Minha sala permanente</p>
          {!loaded ? (
            <p className="text-sm text-white/50">Carregando…</p>
          ) : fixedPin ? (
            <div className="flex items-center gap-4">
              <div className="shrink-0 rounded-lg bg-white p-1">
                <QRCodeView text={joinUrl} size={96} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-3xl font-black tracking-widest" style={{ color: brand?.primary ?? '#a5b4fc' }}>{fixedPin}</p>
                <p className="mb-2 truncate text-xs text-white/40" title={joinUrl}>{joinUrl}</p>
                <button onClick={copyLink} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">
                  {copied ? '✓ Link copiado!' : '📋 Copiar link'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/60">
              Você ainda não tem um PIN fixo. Ao criar uma sala, marque{' '}
              <b>📌 Sala permanente</b> — o mesmo código e link valerão para todas as suas partidas.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onBranding}
            className="flex-1 rounded-lg bg-white/10 p-3 font-bold hover:bg-white/20"
          >
            🎨 Personalizar marca
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg bg-red-500/20 px-4 py-3 font-bold text-red-300 hover:bg-red-500/30"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
