import { useState } from 'react';
import { MIN_TEAMS, MAX_TEAMS, MAX_TEAM_NAME_LENGTH, normalizeTeams, type GameMode } from '@karick/shared';

const MODES: { id: GameMode; label: string; desc: string }[] = [
  { id: 'individual', label: 'Individual', desc: 'Cada um por si (padrão)' },
  { id: 'teams', label: 'Equipes', desc: 'Placar somado por time' },
  { id: 'betting', label: 'Aposta', desc: 'Aposte pontos antes de responder' },
  { id: 'survival', label: 'Sobrevivência', desc: 'Errou, está eliminado' },
];

/** Modal de opções ao iniciar a partida: escolha do modo de jogo. */
export function GameSetup({ onConfirm, onCancel }: { onConfirm: (mode: GameMode, teams: string[], shuffle: boolean) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<GameMode>('individual');
  const [names, setNames] = useState<string[]>(['Time A', 'Time B']);
  const [shuffle, setShuffle] = useState(false);

  const setName = (i: number, v: string) => setNames((n) => n.map((x, j) => (j === i ? v : x)));
  const valid = mode !== 'teams' || normalizeTeams(names).length >= MIN_TEAMS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 text-slate-100">
        <h2 className="mb-4 text-2xl font-bold">Modo de jogo</h2>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-lg p-3 text-left ${mode === m.id ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <div className="font-bold">{m.label}</div>
              <div className="text-xs text-white/60">{m.desc}</div>
            </button>
          ))}
        </div>

        {mode === 'teams' && (
          <div className="mb-4 space-y-2">
            {names.map((n, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={n}
                  maxLength={MAX_TEAM_NAME_LENGTH}
                  onChange={(e) => setName(i, e.target.value)}
                  placeholder={`Equipe ${i + 1}`}
                  className="flex-1 rounded-lg bg-white/10 p-2 outline-none placeholder:text-white/40"
                />
                {names.length > MIN_TEAMS && (
                  <button onClick={() => setNames((x) => x.filter((_, j) => j !== i))} className="rounded bg-red-500/20 px-3 text-red-300">
                    ✕
                  </button>
                )}
              </div>
            ))}
            {names.length < MAX_TEAMS && (
              <button onClick={() => setNames((x) => [...x, ''])} className="rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
                + equipe
              </button>
            )}
          </div>
        )}

        <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          Anti-cola: embaralhar as opções por jogador (mostra o texto no celular)
        </label>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg bg-white/10 p-3 hover:bg-white/20">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(mode, mode === 'teams' ? normalizeTeams(names) : [], shuffle)}
            disabled={!valid}
            className="flex-1 rounded-lg bg-green-500 p-3 font-bold text-white hover:bg-green-400 disabled:opacity-40"
          >
            Criar sala →
          </button>
        </div>
      </div>
    </div>
  );
}
