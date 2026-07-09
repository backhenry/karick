import type { QuizDraft, Question } from './types.js';
import { DEFAULT_TIME_LIMIT, DEFAULT_POINTS } from './constants.js';
import { validateQuiz, normalizeTags } from './validation.js';

export type ImportResult = { ok: true; draft: QuizDraft } | { ok: false; error: string };

/**
 * Formato CANÔNICO esperado (o que pedir para a IA gerar):
 *
 * {
 *   "title": "Nome do quiz",
 *   "questions": [
 *     {
 *       "text": "Enunciado da pergunta?",
 *       "options": ["A", "B", "C", "D"],
 *       "correctIndex": 1,          // índice 0-based da opção correta
 *       "timeLimitSec": 20,          // opcional (padrão 20)
 *       "points": 1000               // opcional (padrão 1000)
 *     }
 *   ]
 * }
 *
 * Também aceita, para ser tolerante:
 *  - lista de perguntas no topo (sem envelope { title, questions });
 *  - apelidos: "pergunta"/"question" p/ text, "opcoes"/"alternativas" p/ options,
 *    "tempo"/"time" p/ timeLimitSec, "pontos" p/ points;
 *  - resposta certa por texto: "correctAnswer"/"correct"/"answer"/"resposta"
 *    (deve casar exatamente com uma das opções).
 */
export function parseQuizImport(raw: string | unknown): ImportResult {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return { ok: false, error: 'JSON inválido: ' + (e as Error).message };
    }
  }

  let title: unknown = 'Quiz importado';
  let list: unknown;
  let tags: string[] = [];

  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    title = o.title ?? o.titulo ?? 'Quiz importado';
    list = o.questions ?? o.perguntas;
    tags = normalizeTags(o.tags);
  } else {
    return { ok: false, error: 'O JSON deve ser um objeto { title, questions } ou uma lista de perguntas.' };
  }

  if (!Array.isArray(list)) {
    return { ok: false, error: 'Campo "questions" deve ser uma lista de perguntas.' };
  }

  const err = (n: number, msg: string): ImportResult => ({ ok: false, error: `Pergunta ${n}: ${msg}` });
  const questions: Question[] = [];

  for (let i = 0; i < list.length; i++) {
    const q = list[i] as Record<string, unknown>;
    const n = i + 1;
    if (!q || typeof q !== 'object') return err(n, 'não é um objeto.');

    const text = q.text ?? q.question ?? q.enunciado ?? q.pergunta;
    if (typeof text !== 'string' || !text.trim()) return err(n, 'falta o campo "text".');

    const options = q.options ?? q.opcoes ?? q.alternativas;
    if (!Array.isArray(options) || options.some((o) => typeof o !== 'string')) {
      return err(n, '"options" deve ser uma lista de textos.');
    }
    const opts = options as string[];

    let correctIndex: number | undefined;
    if (typeof q.correctIndex === 'number') {
      correctIndex = q.correctIndex;
    } else {
      const ca = q.correctAnswer ?? q.correct ?? q.answer ?? q.resposta ?? q.correta;
      if (typeof ca === 'string') {
        correctIndex = opts.findIndex((o) => o.trim().toLowerCase() === ca.trim().toLowerCase());
        if (correctIndex < 0) return err(n, `resposta correta "${ca}" não corresponde a nenhuma opção.`);
      }
    }
    if (correctIndex === undefined) {
      return err(n, 'informe a resposta certa via "correctIndex" (0-based) ou "correctAnswer" (texto da opção).');
    }

    // Imagem: URL direta tem prioridade; senão, palavras-chave viram uma URL real.
    const explicitImage = q.imageUrl ?? q.image ?? q.imagem;
    const imageQuery = q.imageQuery ?? q.imagemBusca ?? q.imageKeywords ?? q.busca;
    let imageUrl: string | undefined;
    if (typeof explicitImage === 'string' && explicitImage.trim()) {
      imageUrl = explicitImage.trim();
    } else if (typeof imageQuery === 'string' && imageQuery.trim()) {
      imageUrl = imageUrlFromQuery(imageQuery);
    }

    questions.push({
      text: text.trim(),
      options: opts.map((o) => o.trim()),
      correctIndex,
      timeLimitSec: toNum(q.timeLimitSec ?? q.tempo ?? q.time, DEFAULT_TIME_LIMIT),
      points: toNum(q.points ?? q.pontos, DEFAULT_POINTS),
      ...(imageUrl ? { imageUrl } : {}),
    });
  }

  const draft: QuizDraft = { title: String(title).trim() || 'Quiz importado', questions, tags };
  const vErr = validateQuiz(draft);
  if (vErr) return { ok: false, error: vErr };
  return { ok: true, draft };
}

function toNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

/**
 * Constrói uma URL de imagem REAL a partir de palavras-chave, via LoremFlickr
 * (imagens Creative Commons do Flickr). O `lock` deriva das palavras para que a
 * imagem seja a MESMA em todas as telas (Host, Player, reveal).
 */
export function imageUrlFromQuery(query: string): string {
  const keywords = query
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(',');
  let hash = 0;
  for (let i = 0; i < query.length; i++) hash = (hash * 31 + query.charCodeAt(i)) | 0;
  const lock = Math.abs(hash) % 100000;
  return `https://loremflickr.com/800/600/${encodeURIComponent(keywords)}?lock=${lock}`;
}
