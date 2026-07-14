import type { GameHistoryEntry } from '@karick/shared';
import { useEscape } from './lib/useEscape.js';
import { useI18n } from './i18n.js';
import { Avatar } from './Avatar.js';

/**
 * Relatório individual pós-jogo: matriz jogador × pergunta (✓/✗/—),
 * com aproveitamento por jogador. Usa o detalhe `answers` das estatísticas.
 */
export function ReportModal({ entry, onClose }: { entry: GameHistoryEntry; onClose: () => void }) {
  const { t } = useI18n();
  useEscape(onClose);
  const stats = (entry.stats ?? []).filter((s) => s.answers?.length);
  // Linhas na ordem do ranking final; jogadores fora do pódio entram ao final.
  const ranked = entry.players.map((p) => p.nickname);
  const all = [...new Set([...ranked, ...stats.flatMap((s) => s.answers!.map((a) => a.nickname))])];

  const cell = (nick: string, qi: number) => {
    const a = stats[qi].answers!.find((x) => x.nickname === nick);
    if (!a || !a.answered) return <span className="text-white/30">—</span>;
    return a.correct ? <span className="font-bold text-green-400">✓</span> : <span className="font-bold text-red-400">✗</span>;
  };
  const accuracy = (nick: string) => {
    const answered = stats.filter((s) => s.answers!.some((x) => x.nickname === nick && x.answered));
    const correct = stats.filter((s) => s.answers!.some((x) => x.nickname === nick && x.correct));
    return stats.length ? `${correct.length}/${stats.length} (${Math.round((correct.length / stats.length) * 100)}%)` : '—';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-slate-800 p-6 text-slate-100">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{t('reportTitle', { title: entry.quizTitle })}</h2>
            <p className="text-sm text-white/50">{t('reportMeta', { pin: entry.pin, date: new Date(entry.playedAt).toLocaleString() })}</p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20">{t('closeX')}</button>
        </div>

        {stats.length === 0 ? (
          <p className="rounded-lg bg-white/5 p-6 text-center text-white/50">{t('reportNoDetail')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/50">
                  <th className="p-2">{t('colPlayer')}</th>
                  {stats.map((s, i) => (
                    <th key={i} className="p-2 text-center" title={s.text}>Q{i + 1}</th>
                  ))}
                  <th className="p-2 text-right">{t('colCorrect')}</th>
                </tr>
              </thead>
              <tbody>
                {all.map((nick) => {
                  const player = entry.players.find((p) => p.nickname === nick);
                  const avatar = stats.flatMap((s) => s.answers!).find((a) => a.nickname === nick)?.avatar;
                  return (
                    <tr key={nick} className="border-t border-white/10">
                      <td className="p-2">
                        <Avatar value={avatar} className="mr-1" />
                        <b>{nick}</b>
                        {player && <span className="ml-2 text-white/40">{player.rank}º · {player.score} pts</span>}
                      </td>
                      {stats.map((_, qi) => (
                        <td key={qi} className="p-2 text-center text-lg">{cell(nick, qi)}</td>
                      ))}
                      <td className="p-2 text-right font-bold">{accuracy(nick)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ol className="mt-4 space-y-1 text-xs text-white/50">
              {stats.map((s, i) => (
                <li key={i}><b>Q{i + 1}:</b> {s.text}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
