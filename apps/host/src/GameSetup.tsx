import { useState } from 'react';
import { MIN_TEAMS, MAX_TEAMS, MAX_TEAM_NAME_LENGTH, normalizeTeams } from '@karick/shared';

/** Modal de opções ao iniciar a partida: individual ou em equipes. */
export function GameSetup({ onConfirm, onCancel }: { onConfirm: (teams: string[]) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'individual' | 'teams'>('individual');
  const [names, setNames] = useState<string[]>(['Time A', 'Time B']);

  const setName = (i: number, v: string) => setNames((n) => n.map((x, j) => (j === i ? v : x)));
  const valid = mode === 'individual' || normalizeTeams(names).length >= MIN_TEAMS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 text-slate-100">
        <h2 className="mb-4 text-2xl font-bold">Opções da partida</h2>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setMode('individual')}
            className={`flex-1 rounded-lg p-3 font-bold ${mode === 'individual' ? 'bg-indigo-600' : 'bg-white/10'}`}
          >
            Individual
          </button>
          <button
            onClick={() => setMode('teams')}
            className={`flex-1 rounded-lg p-3 font-bold ${mode === 'teams' ? 'bg-indigo-600' : 'bg-white/10'}`}
          >
            Em equipes
          </button>
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

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg bg-white/10 p-3 hover:bg-white/20">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(mode === 'teams' ? normalizeTeams(names) : [])}
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
