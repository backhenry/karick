import { useEffect, useState } from 'react';
import type { QuizDraft, QuizSummary, GameHistoryEntry } from '@karick/shared';
import { api } from './lib/api.js';

interface Props {
  onNew: () => void;
  onEdit: (id: string, draft: QuizDraft) => void;
  onHost: (draft: QuizDraft) => void;
}

export function Library({ onNew, onEdit, onHost }: Props) {
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [dbEnabled, setDbEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [status, list, hist] = await Promise.all([api.status(), api.listQuizzes(), api.history()]);
      setDbEnabled(status.dbEnabled);
      setQuizzes(list);
      setHistory(hist);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setQuizzes([]);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const withQuiz = async (id: string, fn: (draft: QuizDraft) => void) => {
    setBusyId(id);
    try {
      const quiz = await api.getQuiz(id);
      fn({ title: quiz.title, questions: quiz.questions, tags: quiz.tags });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (id: string) => {
    setBusyId(id);
    try {
      const quiz = await api.getQuiz(id);
      await api.createQuiz({ title: `Cópia de ${quiz.title}`, questions: quiz.questions, tags: quiz.tags });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este quiz?')) return;
    try {
      await api.deleteQuiz(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const allTags = [...new Set((quizzes ?? []).flatMap((q) => q.tags))].sort();
  const shown = (quizzes ?? []).filter((q) => !activeTag || q.tags.includes(activeTag));

  const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ['Quiz', 'PIN', 'Data', 'Posição', 'Jogador', 'Pontos'];
    const rows = history.flatMap((h) =>
      h.players.map((p) => [h.quizTitle, h.pin, fmt(h.playedAt), p.rank, p.nickname, p.score].map(esc).join(',')),
    );
    const csv = '﻿' + [header.map(esc).join(','), ...rows].join('\r\n'); // BOM p/ acentos no Excel
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `karick-historico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl p-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-black text-indigo-400">Karick</h1>
        <button onClick={onNew} className="rounded-lg bg-green-500 px-5 py-3 font-bold text-white hover:bg-green-400">
          + Novo quiz
        </button>
      </header>

      {!dbEnabled && (
        <p className="mb-4 rounded-lg bg-amber-500/20 p-3 text-sm text-amber-200">
          ⚠️ Banco de dados não configurado — os quizzes salvos não persistem entre reinícios do servidor.
          Configure a variável <code>DATABASE_URL</code> para ativar a persistência.
        </p>
      )}
      {error && <p className="mb-4 rounded-lg bg-red-500/20 p-3 text-red-300">{error}</p>}

      <h2 className="mb-3 text-lg font-bold text-white/70">Meus quizzes</h2>

      {allTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`rounded-full px-3 py-1 text-sm ${activeTag === null ? 'bg-indigo-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
          >
            Todos
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(t)}
              className={`rounded-full px-3 py-1 text-sm ${activeTag === t ? 'bg-indigo-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {quizzes === null ? (
        <p className="text-white/50">Carregando…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-lg bg-white/5 p-6 text-center text-white/50">
          {quizzes.length === 0 ? (
            <>Nenhum quiz salvo ainda. Clique em <b>Novo quiz</b> para começar.</>
          ) : (
            <>Nenhum quiz com a tag <b>#{activeTag}</b>.</>
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 p-4">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{q.title}</p>
                <p className="text-sm text-white/40">
                  {q.questionCount} pergunta{q.questionCount !== 1 ? 's' : ''} · {fmt(q.updatedAt)}
                </p>
                {q.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.tags.map((t) => (
                      <span key={t} className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-200">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2 text-sm">
                <button
                  onClick={() => withQuiz(q.id, onHost)}
                  disabled={busyId === q.id}
                  className="rounded bg-green-500 px-3 py-2 font-bold text-white hover:bg-green-400 disabled:opacity-50"
                >
                  Hospedar
                </button>
                <button
                  onClick={() => withQuiz(q.id, (d) => onEdit(q.id, d))}
                  disabled={busyId === q.id}
                  className="rounded bg-white/10 px-3 py-2 hover:bg-white/20 disabled:opacity-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => duplicate(q.id)}
                  disabled={busyId === q.id}
                  className="rounded bg-white/10 px-3 py-2 hover:bg-white/20 disabled:opacity-50"
                >
                  Duplicar
                </button>
                <button
                  onClick={() => remove(q.id)}
                  className="rounded bg-red-500/20 px-3 py-2 text-red-300 hover:bg-red-500/30"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white/70">Últimas partidas</h2>
            <button onClick={exportCsv} className="rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
              ⬇ Exportar CSV
            </button>
          </div>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm">
                <span className="truncate">
                  <b>{h.quizTitle}</b> · PIN {h.pin}
                </span>
                <span className="shrink-0 text-white/50">
                  🥇 {h.players[0]?.nickname ?? '—'} ({h.players[0]?.score ?? 0}) · {fmt(h.playedAt)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
