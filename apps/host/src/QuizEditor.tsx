import { useRef, useState } from 'react';
import type { QuizDraft, Question } from '@karick/shared';
import {
  OPTION_COLORS,
  OPTION_SHAPES,
  MIN_OPTIONS,
  MAX_OPTIONS,
  MIN_TIME_LIMIT,
  MAX_TIME_LIMIT,
  validateQuiz,
  parseQuizImport,
  normalizeTags,
  imageUrlFromQuery,
} from '@karick/shared';
import { emptyQuestion, exampleQuiz, trueFalseQuestion } from './lib/quizStorage.js';
import { api } from './lib/api.js';
import { QuizPreview } from './QuizPreview.js';

const AI_PROMPT = `Crie um quiz no formato JSON EXATO abaixo (responda só com o JSON, sem texto extra).
Regras: "correctIndex" é o índice 0-based da opção correta; use 2 a 4 opções por pergunta;
"timeLimitSec" e "points" são opcionais.
Para imagens, NÃO invente URLs: use "imageQuery" com 1 a 3 palavras-chave (de preferência
em inglês) que descrevam uma imagem relevante — o app gera a imagem a partir disso.
(Se você tiver uma URL de imagem real e pública, pode usar "imageUrl" no lugar.)
Tema do quiz: [DESCREVA O TEMA] com [N] perguntas.

{
  "title": "Título do quiz",
  "questions": [
    {
      "text": "Qual planeta é conhecido como Planeta Vermelho?",
      "options": ["Vênus", "Marte", "Júpiter", "Saturno"],
      "correctIndex": 1,
      "imageQuery": "mars planet",
      "timeLimitSec": 20,
      "points": 1000
    }
  ]
}`;

interface Props {
  connected: boolean;
  initialDraft: QuizDraft;
  quizId: string | null;
  onStart: (quiz: QuizDraft) => Promise<string | null>;
  onBack: () => void;
  onSavedId: (id: string) => void;
}

export function QuizEditor({ connected, initialDraft, quizId, onStart, onBack, onSavedId }: Props) {
  const [draft, setDraft] = useState<QuizDraft>(initialDraft);
  const [tagsInput, setTagsInput] = useState((initialDraft.tags ?? []).join(', '));
  const [id, setId] = useState<string | null>(quizId);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runImport = (raw: string) => {
    const result = parseQuizImport(raw);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setDraft(result.draft);
    setTagsInput((result.draft.tags ?? []).join(', '));
    setImportError(null);
    setShowImport(false);
    setImportText('');
    setSavedMsg(`Importado: ${result.draft.questions.length} pergunta(s) ✓`);
    setTimeout(() => setSavedMsg(null), 3000);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    runImport(await file.text());
    e.target.value = ''; // permite reimportar o mesmo arquivo
  };

  const update = (fn: (d: QuizDraft) => void) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  const patchQuestion = (qi: number, fn: (q: Question) => void) => update((d) => fn(d.questions[qi]));
  const moveQuestion = (qi: number, dir: -1 | 1) =>
    update((d) => {
      const j = qi + dir;
      if (j < 0 || j >= d.questions.length) return;
      [d.questions[qi], d.questions[j]] = [d.questions[j], d.questions[qi]];
    });
  const duplicateQuestion = (qi: number) =>
    update((d) => d.questions.splice(qi + 1, 0, structuredClone(d.questions[qi])));

  const effectiveDraft = (): QuizDraft => ({ ...draft, tags: normalizeTags(tagsInput) });

  const save = async () => {
    const payload = effectiveDraft();
    const err = validateQuiz(payload);
    if (err) return setError(err);
    setError(null);
    setSaving(true);
    try {
      const saved = id ? await api.updateQuiz(id, payload) : await api.createQuiz(payload);
      setId(saved.id);
      onSavedId(saved.id);
      setSavedMsg('Salvo na biblioteca ✓');
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const start = async () => {
    const payload = effectiveDraft();
    const err = validateQuiz(payload);
    if (err) return setError(err);
    setError(null);
    setStarting(true);
    const serverErr = await onStart(payload);
    setStarting(false);
    if (serverErr) setError(serverErr);
  };

  return (
    <div className="mx-auto max-w-3xl p-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between gap-2">
        <button onClick={onBack} className="rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
          ← Biblioteca
        </button>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setShowPreview(true)}
            disabled={draft.questions.length === 0}
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/20 disabled:opacity-40"
          >
            👁 Prévia
          </button>
          <button
            onClick={() => setShowImport((s) => !s)}
            className="rounded bg-indigo-500/80 px-3 py-2 font-semibold hover:bg-indigo-500"
          >
            Importar JSON
          </button>
          <button onClick={() => setDraft(exampleQuiz())} className="rounded bg-white/10 px-3 py-2 hover:bg-white/20">
            Carregar exemplo
          </button>
          <button
            onClick={() => setDraft({ title: '', questions: [emptyQuestion()] })}
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            Limpar
          </button>
        </div>
      </header>

      {showImport && (
        <div className="mb-6 rounded-xl border border-indigo-500/40 bg-indigo-500/5 p-4">
          <p className="mb-2 text-sm text-white/70">
            Envie um arquivo <code>.json</code> ou cole o conteúdo abaixo. Peça para uma IA gerar no
            formato do exemplo — ela responde o JSON e você importa aqui.
          </p>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
            >
              📁 Escolher arquivo .json
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(AI_PROMPT);
                setSavedMsg('Prompt copiado — cole numa IA ✓');
                setTimeout(() => setSavedMsg(null), 3000);
              }}
              className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
            >
              📋 Copiar prompt para IA
            </button>
          </div>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Cole aqui o JSON — ex.: {"title":"...","questions":[{"text":"...","options":["A","B"],"correctIndex":0}]}'
            rows={6}
            className="w-full resize-y rounded-lg bg-black/30 p-3 font-mono text-xs outline-none placeholder:text-white/30"
          />
          {importError && <p className="mt-2 rounded bg-red-500/20 p-2 text-sm text-red-300">{importError}</p>}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => runImport(importText)}
              disabled={!importText.trim()}
              className="rounded bg-indigo-500 px-4 py-2 text-sm font-bold hover:bg-indigo-400 disabled:opacity-40"
            >
              Importar do texto
            </button>
            <button onClick={() => setShowImport(false)} className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
              Fechar
            </button>
          </div>
        </div>
      )}

      <input
        value={draft.title}
        onChange={(e) => update((d) => (d.title = e.target.value))}
        placeholder="Título do quiz"
        className="mb-3 w-full rounded-lg bg-white/10 p-4 text-2xl font-bold outline-none placeholder:text-white/40"
      />
      <input
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder="Tags (separadas por vírgula) — ex.: geografia, fácil"
        className="mb-6 w-full rounded-lg bg-white/10 p-3 text-sm outline-none placeholder:text-white/40"
      />

      <div className="space-y-6">
        {draft.questions.map((q, qi) => (
          <div key={qi} className="rounded-xl bg-white/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-bold text-white/70">Pergunta {qi + 1}</span>
              <div className="flex items-center gap-2 text-sm">
                <span className="mr-1 text-white/40">{q.timeLimitSec}s · {q.points} pts</span>
                <button
                  onClick={() => moveQuestion(qi, -1)}
                  disabled={qi === 0}
                  title="Mover para cima"
                  className="rounded bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveQuestion(qi, 1)}
                  disabled={qi === draft.questions.length - 1}
                  title="Mover para baixo"
                  className="rounded bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => duplicateQuestion(qi)}
                  title="Duplicar pergunta"
                  className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
                >
                  Duplicar
                </button>
                {draft.questions.length > 1 && (
                  <button
                    onClick={() => update((d) => d.questions.splice(qi, 1))}
                    className="rounded bg-red-500/20 px-2 py-1 text-red-300 hover:bg-red-500/30"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={q.text}
              onChange={(e) => patchQuestion(qi, (qq) => (qq.text = e.target.value))}
              placeholder="Enunciado da pergunta"
              rows={2}
              className="mb-3 w-full resize-none rounded-lg bg-white/10 p-3 outline-none placeholder:text-white/40"
            />

            <div className="mb-3 flex items-center gap-3">
              <input
                value={q.imageUrl ?? ''}
                onChange={(e) => patchQuestion(qi, (qq) => (qq.imageUrl = e.target.value || undefined))}
                placeholder="URL de imagem (opcional) — https://…"
                className="flex-1 rounded-lg bg-white/10 p-2 text-sm outline-none placeholder:text-white/40"
              />
              <button
                type="button"
                title="Gerar imagem a partir de palavras-chave"
                onClick={() => {
                  const kw = window.prompt('Palavras-chave da imagem (ex.: mars planet):');
                  if (kw && kw.trim()) patchQuestion(qi, (qq) => (qq.imageUrl = imageUrlFromQuery(kw)));
                }}
                className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              >
                🔎 por palavra-chave
              </button>
              {q.imageUrl && /^https?:\/\//i.test(q.imageUrl) && (
                <img
                  src={q.imageUrl}
                  alt="prévia"
                  className="h-12 w-12 rounded object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                  onLoad={(e) => (e.currentTarget.style.display = '')}
                />
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2 rounded-lg p-2" style={{ background: OPTION_COLORS[oi] + '33' }}>
                  <span className="text-xl" style={{ color: OPTION_COLORS[oi] }}>{OPTION_SHAPES[oi]}</span>
                  <input
                    value={opt}
                    onChange={(e) => patchQuestion(qi, (qq) => (qq.options[oi] = e.target.value))}
                    placeholder={`Opção ${oi + 1}`}
                    className="flex-1 bg-transparent outline-none placeholder:text-white/40"
                  />
                  <label className="flex items-center gap-1 text-xs text-white/70">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correctIndex === oi}
                      onChange={() => patchQuestion(qi, (qq) => (qq.correctIndex = oi))}
                    />
                    correta
                  </label>
                  {q.options.length > MIN_OPTIONS && (
                    <button
                      onClick={() =>
                        patchQuestion(qi, (qq) => {
                          qq.options.splice(oi, 1);
                          if (qq.correctIndex >= qq.options.length) qq.correctIndex = 0;
                        })
                      }
                      className="text-white/40 hover:text-red-300"
                      title="Remover opção"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              {q.options.length < MAX_OPTIONS && (
                <button onClick={() => patchQuestion(qi, (qq) => qq.options.push(''))} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
                  + opção
                </button>
              )}
              <label className="flex items-center gap-2">
                Tempo (s):
                <input
                  type="number"
                  min={MIN_TIME_LIMIT}
                  max={MAX_TIME_LIMIT}
                  value={q.timeLimitSec}
                  onChange={(e) => patchQuestion(qi, (qq) => (qq.timeLimitSec = Number(e.target.value)))}
                  className="w-16 rounded bg-white/10 p-1 text-center outline-none"
                />
              </label>
              <label className="flex items-center gap-2">
                Pontos:
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={q.points}
                  onChange={(e) => patchQuestion(qi, (qq) => (qq.points = Number(e.target.value)))}
                  className="w-20 rounded bg-white/10 p-1 text-center outline-none"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => update((d) => d.questions.push(emptyQuestion()))}
          className="flex-1 rounded-xl border-2 border-dashed border-white/20 py-4 text-white/60 hover:border-white/40 hover:text-white"
        >
          + Adicionar pergunta
        </button>
        <button
          onClick={() => update((d) => d.questions.push(trueFalseQuestion()))}
          className="flex-1 rounded-xl border-2 border-dashed border-white/20 py-4 text-white/60 hover:border-white/40 hover:text-white"
        >
          + Verdadeiro / Falso
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-500/20 p-3 text-center text-red-300">{error}</p>}
      {savedMsg && <p className="mt-4 rounded-lg bg-green-500/20 p-3 text-center text-green-300">{savedMsg}</p>}

      <div className="mt-4 flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-xl bg-white/10 py-4 text-xl font-bold text-white hover:bg-white/20 disabled:opacity-40"
        >
          {saving ? 'Salvando…' : id ? 'Salvar alterações' : 'Salvar na biblioteca'}
        </button>
        <button
          onClick={start}
          disabled={starting || !connected}
          className="flex-1 rounded-xl bg-green-500 py-4 text-xl font-bold text-white hover:bg-green-400 disabled:opacity-40"
        >
          {!connected ? 'Conectando…' : starting ? 'Criando sala…' : 'Iniciar hospedagem →'}
        </button>
      </div>

      {showPreview && <QuizPreview draft={draft} onClose={() => setShowPreview(false)} />}
    </div>
  );
}
