import { useState } from 'react';
import { MIN_TEAMS, MAX_TEAMS, MAX_TEAM_NAME_LENGTH, normalizeTeams, type GameMode } from '@karick/shared';
import { useEscape } from './lib/useEscape.js';
import { useI18n } from './i18n.js';

const MODES: { id: GameMode; labelKey: 'modeIndividual' | 'modeTeams' | 'modeBetting' | 'modeSurvival'; descKey: 'modeIndividualDesc' | 'modeTeamsDesc' | 'modeBettingDesc' | 'modeSurvivalDesc' }[] = [
  { id: 'individual', labelKey: 'modeIndividual', descKey: 'modeIndividualDesc' },
  { id: 'teams', labelKey: 'modeTeams', descKey: 'modeTeamsDesc' },
  { id: 'betting', labelKey: 'modeBetting', descKey: 'modeBettingDesc' },
  { id: 'survival', labelKey: 'modeSurvival', descKey: 'modeSurvivalDesc' },
];

// Opções de quantos jogadores mostrar no ranking do telão (0 = todos).
export const LEADERBOARD_LIMITS: { value: number; labelKey: 'rankAll' | 'rankTop10' | 'rankTop5' | 'rankTop3' }[] = [
  { value: 0, labelKey: 'rankAll' },
  { value: 10, labelKey: 'rankTop10' },
  { value: 5, labelKey: 'rankTop5' },
  { value: 3, labelKey: 'rankTop3' },
];

/** Modal de opções ao iniciar a partida: escolha do modo de jogo. */
export function GameSetup({ onConfirm, onCancel, initialLimit = 0 }: { onConfirm: (mode: GameMode, teams: string[], shuffle: boolean, fixedPin: boolean, leaderboardLimit: number) => void; onCancel: () => void; initialLimit?: number }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<GameMode>('individual');
  const [names, setNames] = useState<string[]>(['Time A', 'Time B']);
  const [shuffle, setShuffle] = useState(false);
  const [fixedPin, setFixedPin] = useState(false);
  const [leaderboardLimit, setLeaderboardLimit] = useState(initialLimit);
  useEscape(onCancel);

  const setName = (i: number, v: string) => setNames((n) => n.map((x, j) => (j === i ? v : x)));
  const valid = mode !== 'teams' || normalizeTeams(names).length >= MIN_TEAMS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 text-slate-100">
        <h2 className="mb-4 text-2xl font-bold">{t('gameMode')}</h2>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-lg p-3 text-left ${mode === m.id ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <div className="font-bold">{t(m.labelKey)}</div>
              <div className="text-xs text-white/60">{t(m.descKey)}</div>
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
                  placeholder={t('teamN', { n: i + 1 })}
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
                {t('addTeam')}
              </button>
            )}
          </div>
        )}

        <div className="mb-4">
          <p className="mb-1 text-sm font-bold text-white/80">{t('rankVisibility')}</p>
          <p className="mb-2 text-xs text-white/50">{t('rankVisibilityHint')}</p>
          <div className="grid grid-cols-4 gap-2">
            {LEADERBOARD_LIMITS.map((o) => (
              <button
                key={o.value}
                onClick={() => setLeaderboardLimit(o.value)}
                className={`rounded-lg p-2 text-sm font-bold ${leaderboardLimit === o.value ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'}`}
              >
                {t(o.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          {t('antiCheat')}
        </label>

        <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={fixedPin} onChange={(e) => setFixedPin(e.target.checked)} />
          {t('permanentRoom')}
        </label>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg bg-white/10 p-3 hover:bg-white/20">
            {t('cancel')}
          </button>
          <button
            onClick={() => onConfirm(mode, mode === 'teams' ? normalizeTeams(names) : [], shuffle, fixedPin, leaderboardLimit)}
            disabled={!valid}
            className="flex-1 rounded-lg bg-green-500 p-3 font-bold text-white hover:bg-green-400 disabled:opacity-40"
          >
            {t('createRoom')}
          </button>
        </div>
      </div>
    </div>
  );
}
