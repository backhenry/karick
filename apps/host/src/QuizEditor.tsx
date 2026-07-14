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
import { useI18n } from './i18n.js';

const AI_PROMPT = `TEMA DO QUIZ: [DESCREVA O TEMA] — [N] perguntas.
(👆 troque o tema acima antes de enviar.)

Crie um quiz no formato JSON EXATO mostrado no fim deste texto.

Formato da resposta (IMPORTANTE, para o texto colar sem erro):
- Responda SÓ com o JSON: comece com { e termine com }. Nada antes nem depois.
- NÃO use blocos de código, crases (\`\`\`) nem markdown. Use só aspas retas (").
- Em "latex" e "code", cada barra invertida precisa vir DUPLICADA (\\\\).
  Ex.: "latex": "x = \\\\frac{-b}{2a}", "\\\\sqrt{2}", "\\\\alpha". Nunca use uma barra sozinha.

Regras de conteúdo:
- "correctIndex" é o índice 0-based da opção correta; use 2 a 4 opções por pergunta.
- "timeLimitSec" e "points" são opcionais.
- Para imagens, NÃO invente URLs: use "imageQuery" com 1 a 3 palavras-chave (de preferência
  em inglês) que descrevam uma imagem relevante — o app gera a imagem a partir disso.
  (Se você tiver uma URL de imagem real e pública, pode usar "imageUrl" no lugar.)
- Inclua "explanation": uma frase curta explicando por que a resposta certa está certa.
- Campos opcionais por pergunta: "latex" (fórmula LaTeX) e "code" (trecho de código) —
  use quando o tema pedir. No topo, "tags": ["tema", "nível"].
- Tipos: o padrão é alternativas; "type": "text" + "acceptedAnswers": ["resposta", "variação"]
  faz o jogador DIGITAR a resposta (sem "options"); "type": "poll" é enquete sem resposta
  certa (tem "options", dispensa "correctIndex"). Misture os tipos quando fizer sentido.
- Efeitos opcionais: "imageReveal": true faz a imagem começar borrada e abrir com o tempo;
  "hints": ["dica 1", "dica 2", …] cria um "Quem sou eu?" com dicas progressivas no telão
  (até 6 — combine com type "text" para o jogador digitar quem/o que é).

{
  "title": "Título do quiz",
  "questions": [
    {
      "text": "Qual planeta é conhecido como Planeta Vermelho?",
      "options": ["Vênus", "Marte", "Júpiter", "Saturno"],
      "correctIndex": 1,
      "explanation": "Marte parece vermelho por causa do óxido de ferro na superfície.",
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
  /** Modo clássico: esconde mídia, tipos, tags e demais campos avançados. */
  simple?: boolean;
}

export function QuizEditor({ connected, initialDraft, quizId, onStart, onBack, onSavedId, simple = false }: Props) {
  const { t } = useI18n();
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
    setSavedMsg(t('imported', { n: result.draft.questions.length }));
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

  const effectiveDraft = (): QuizDraft => ({
    ...draft,
    tags: normalizeTags(tagsInput),
    // Normaliza campos "digitados solto": respostas aceitas (vírgulas) e dicas (linhas).
    questions: draft.questions.map((q) => {
      const hints = (q.hints ?? []).map((h) => h.trim()).filter(Boolean).slice(0, 6);
      const base = { ...q, hints: hints.length ? hints : undefined };
      return (q.type ?? 'choice') === 'text'
        ? { ...base, acceptedAnswers: (q.acceptedAnswers ?? []).map((a) => a.trim()).filter(Boolean) }
        : base;
    }),
  });

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
      setSavedMsg(t('savedToLibrary'));
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sendToBank = async () => {
    const payload = effectiveDraft();
    const err = validateQuiz(payload);
    if (err) return setError(err);
    setError(null);
    try {
      await api.addBank(payload.questions, payload.tags ?? []);
      setSavedMsg(t('sentToBank', { n: payload.questions.length }));
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (e) {
      setError((e as Error).message);
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
          {t('backToLibrary')}
        </button>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setShowPreview(true)}
            disabled={draft.questions.length === 0}
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/20 disabled:opacity-40"
          >
            {t('preview')}
          </button>
          {!simple && (
            <>
              <button
                onClick={() => setShowImport((s) => !s)}
                className="rounded bg-indigo-500/80 px-3 py-2 font-semibold hover:bg-indigo-500"
              >
                {t('importJson')}
              </button>
              <button onClick={sendToBank} className="rounded bg-white/10 px-3 py-2 hover:bg-white/20">
                {t('sendToBank')}
              </button>
            </>
          )}
          <button onClick={() => setDraft(exampleQuiz())} className="rounded bg-white/10 px-3 py-2 hover:bg-white/20">
            {t('loadExample')}
          </button>
          <button
            onClick={() => setDraft({ title: '', questions: [emptyQuestion()] })}
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            {t('clear')}
          </button>
        </div>
      </header>

      {showImport && (
        <div className="mb-6 rounded-xl border border-indigo-500/40 bg-indigo-500/5 p-4">
          <p className="mb-2 text-sm text-white/70">{t('importHint')}</p>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
            >
              {t('chooseFile')}
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(AI_PROMPT);
                setSavedMsg(t('promptCopied'));
                setTimeout(() => setSavedMsg(null), 3000);
              }}
              className="rounded bg-white/10 px-3 py-2 hover:bg-white/20"
            >
              {t('copyAiPrompt')}
            </button>
          </div>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={t('importTextarea')}
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
              {t('importFromText')}
            </button>
            <button onClick={() => setShowImport(false)} className="rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
              {t('close')}
            </button>
          </div>
        </div>
      )}

      <input
        value={draft.title}
        onChange={(e) => update((d) => (d.title = e.target.value))}
        placeholder={t('quizTitle')}
        className="mb-3 w-full rounded-lg bg-white/10 p-4 text-2xl font-bold outline-none placeholder:text-white/40"
      />
      {!simple && (
        <>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={t('tagsPlaceholder')}
            className="mb-3 w-full rounded-lg bg-white/10 p-3 text-sm outline-none placeholder:text-white/40"
          />
          <label className="mb-6 flex cursor-pointer items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={!!draft.isPublic}
              onChange={(e) => update((d) => (d.isPublic = e.target.checked || undefined))}
            />
            {t('publicToggle')}
          </label>
        </>
      )}
      {simple && <div className="mb-6" />}

      <div className="space-y-6">
        {draft.questions.map((q, qi) => (
          <div key={qi} className="rounded-xl bg-white/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-bold text-white/70">{t('questionN', { n: qi + 1 })}</span>
              <div className="flex items-center gap-2 text-sm">
                <span className="mr-1 text-white/40">{q.timeLimitSec}s · {q.points} pts</span>
                <button
                  onClick={() => moveQuestion(qi, -1)}
                  disabled={qi === 0}
                  title={t('moveUp')}
                  className="rounded bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveQuestion(qi, 1)}
                  disabled={qi === draft.questions.length - 1}
                  title={t('moveDown')}
                  className="rounded bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => duplicateQuestion(qi)}
                  title={t('duplicateQuestion')}
                  className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
                >
                  {t('duplicate')}
                </button>
                {draft.questions.length > 1 && (
                  <button
                    onClick={() => update((d) => d.questions.splice(qi, 1))}
                    className="rounded bg-red-500/20 px-2 py-1 text-red-300 hover:bg-red-500/30"
                  >
                    {t('remove')}
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={q.text}
              onChange={(e) => patchQuestion(qi, (qq) => (qq.text = e.target.value))}
              placeholder={t('questionPlaceholder')}
              rows={2}
              className="mb-3 w-full resize-none rounded-lg bg-white/10 p-3 outline-none placeholder:text-white/40"
            />

            {!simple && (
            <div className="mb-3 flex flex-wrap gap-2 text-sm">
              {([
                ['choice', t('typeChoice')],
                ['text', t('typeText')],
                ['poll', t('typePoll')],
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() =>
                    patchQuestion(qi, (qq) => {
                      qq.type = type === 'choice' ? undefined : type;
                      if (type === 'text' && !qq.acceptedAnswers?.length) qq.acceptedAnswers = [];
                    })
                  }
                  className={`rounded-full px-3 py-1 ${(q.type ?? 'choice') === type ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            )}

            {!simple && (<>
            <div className="mb-3 flex items-center gap-3">
              <input
                value={q.imageUrl ?? ''}
                onChange={(e) => patchQuestion(qi, (qq) => (qq.imageUrl = e.target.value || undefined))}
                placeholder={t('imagePlaceholder')}
                className="flex-1 rounded-lg bg-white/10 p-2 text-sm outline-none placeholder:text-white/40"
              />
              <button
                type="button"
                title={t('byKeyword')}
                onClick={() => {
                  const kw = window.prompt(t('keywordPrompt'));
                  if (kw && kw.trim()) patchQuestion(qi, (qq) => (qq.imageUrl = imageUrlFromQuery(kw)));
                }}
                className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              >
                {t('byKeyword')}
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

            {q.imageUrl && /^https?:\/\//i.test(q.imageUrl) && (
              <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={!!q.imageReveal}
                  onChange={(e) => patchQuestion(qi, (qq) => (qq.imageReveal = e.target.checked || undefined))}
                />
                {t('imageRevealToggle')}
              </label>
            )}

            <textarea
              value={(q.hints ?? []).join('\n')}
              onChange={(e) => patchQuestion(qi, (qq) => (qq.hints = e.target.value ? e.target.value.split('\n') : undefined))}
              placeholder={t('hintsPlaceholder')}
              rows={2}
              className="mb-3 w-full resize-y rounded-lg bg-white/10 p-2 text-sm outline-none placeholder:text-white/40"
            />

            <input
              value={q.explanation ?? ''}
              onChange={(e) => patchQuestion(qi, (qq) => (qq.explanation = e.target.value || undefined))}
              placeholder={t('explanationPlaceholder')}
              className="mb-3 w-full rounded-lg bg-white/10 p-2 text-sm outline-none placeholder:text-white/40"
            />

            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <input
                value={q.audioUrl ?? ''}
                onChange={(e) => patchQuestion(qi, (qq) => (qq.audioUrl = e.target.value || undefined))}
                placeholder={t('audioPlaceholder')}
                className="rounded-lg bg-white/10 p-2 text-sm outline-none placeholder:text-white/40"
              />
              <input
                value={q.videoUrl ?? ''}
                onChange={(e) => patchQuestion(qi, (qq) => (qq.videoUrl = e.target.value || undefined))}
                placeholder={t('videoPlaceholder')}
                className="rounded-lg bg-white/10 p-2 text-sm outline-none placeholder:text-white/40"
              />
            </div>
            {q.videoUrl && (
              <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={!!q.audioOnly}
                  onChange={(e) => patchQuestion(qi, (qq) => (qq.audioOnly = e.target.checked || undefined))}
                />
                {t('audioOnlyToggle')}
              </label>
            )}
            <textarea
              value={q.code ?? ''}
              onChange={(e) => patchQuestion(qi, (qq) => (qq.code = e.target.value || undefined))}
              placeholder={t('codePlaceholder')}
              rows={2}
              spellCheck={false}
              className="mb-3 w-full resize-y rounded-lg bg-black/30 p-2 font-mono text-xs outline-none placeholder:text-white/40"
            />
            <input
              value={q.latex ?? ''}
              onChange={(e) => patchQuestion(qi, (qq) => (qq.latex = e.target.value || undefined))}
              placeholder={t('latexPlaceholder')}
              spellCheck={false}
              className="mb-3 w-full rounded-lg bg-black/30 p-2 font-mono text-xs outline-none placeholder:text-white/40"
            />
            </>)}

            {(q.type ?? 'choice') === 'text' && (
              <div className="rounded-lg bg-white/10 p-3">
                <p className="mb-1 text-sm text-white/70">{t('acceptedHint')}</p>
                <input
                  value={(q.acceptedAnswers ?? []).join(',')}
                  onChange={(e) => patchQuestion(qi, (qq) => (qq.acceptedAnswers = e.target.value.split(',')))}
                  placeholder={t('acceptedPlaceholder')}
                  className="w-full rounded bg-white/10 p-2 outline-none placeholder:text-white/40"
                />
              </div>
            )}

            <div className={`grid gap-2 sm:grid-cols-2 ${(q.type ?? 'choice') === 'text' ? 'hidden' : ''}`}>
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2 rounded-lg p-2" style={{ background: OPTION_COLORS[oi] + '33' }}>
                  <span className="text-xl" style={{ color: OPTION_COLORS[oi] }}>{OPTION_SHAPES[oi]}</span>
                  <input
                    value={opt}
                    onChange={(e) => patchQuestion(qi, (qq) => (qq.options[oi] = e.target.value))}
                    placeholder={t('optionN', { n: oi + 1 })}
                    className="flex-1 bg-transparent outline-none placeholder:text-white/40"
                  />
                  {(q.type ?? 'choice') === 'choice' && (
                    <label className="flex items-center gap-1 text-xs text-white/70">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correctIndex === oi}
                        onChange={() => patchQuestion(qi, (qq) => (qq.correctIndex = oi))}
                      />
                      {t('correctOption')}
                    </label>
                  )}
                  {q.options.length > MIN_OPTIONS && (
                    <button
                      onClick={() =>
                        patchQuestion(qi, (qq) => {
                          qq.options.splice(oi, 1);
                          if (qq.correctIndex >= qq.options.length) qq.correctIndex = 0;
                        })
                      }
                      className="text-white/40 hover:text-red-300"
                      title={t('removeOption')}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              {(q.type ?? 'choice') !== 'text' && q.options.length < MAX_OPTIONS && (
                <button onClick={() => patchQuestion(qi, (qq) => qq.options.push(''))} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
                  {t('addOption')}
                </button>
              )}
              <label className="flex items-center gap-2">
                {t('timeSec')}
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
                {t('points')}
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
          {t('addQuestion')}
        </button>
        <button
          onClick={() => update((d) => d.questions.push(trueFalseQuestion()))}
          className="flex-1 rounded-xl border-2 border-dashed border-white/20 py-4 text-white/60 hover:border-white/40 hover:text-white"
        >
          {t('addTrueFalse')}
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
          {saving ? t('saving') : id ? t('saveChanges') : t('saveToLibrary')}
        </button>
        <button
          onClick={start}
          disabled={starting || !connected}
          className="flex-1 rounded-xl bg-green-500 py-4 text-xl font-bold text-white hover:bg-green-400 disabled:opacity-40"
        >
          {!connected ? t('loading') : starting ? t('loading') : t('startHosting')}
        </button>
      </div>

      {showPreview && <QuizPreview draft={draft} onClose={() => setShowPreview(false)} />}
    </div>
  );
}
