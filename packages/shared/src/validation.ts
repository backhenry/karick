import type { QuizDraft } from './types.js';
import { MIN_OPTIONS, MAX_OPTIONS, MIN_TIME_LIMIT, MAX_TIME_LIMIT, MAX_TAGS, MAX_TAG_LENGTH, MAX_TEAMS, MAX_TEAM_NAME_LENGTH } from './constants.js';

/** Normaliza nomes de equipes: apara, remove vazias/duplicadas, limita. */
export function normalizeTeams(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const t = item.trim().slice(0, MAX_TEAM_NAME_LENGTH);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_TEAMS) break;
  }
  return out;
}

/**
 * Normaliza tags: aceita array ou string separada por vírgula; apara, remove
 * vazias/duplicadas (case-insensitive), limita tamanho e quantidade.
 */
export function normalizeTags(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().slice(0, MAX_TAG_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/**
 * Valida um quiz montado pelo Host. Retorna uma mensagem de erro (string)
 * ou `null` se estiver válido. Usada no cliente (feedback imediato) e no
 * servidor (nunca confiar só no cliente).
 */
export function validateQuiz(quiz: QuizDraft): string | null {
  if (!quiz || typeof quiz.title !== 'string' || !quiz.title.trim()) {
    return 'O quiz precisa de um título.';
  }
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return 'Adicione pelo menos uma pergunta.';
  }
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    const n = i + 1;
    if (!q.text?.trim()) return `Pergunta ${n}: falta o enunciado.`;
    if (!Array.isArray(q.options) || q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS) {
      return `Pergunta ${n}: precisa de ${MIN_OPTIONS} a ${MAX_OPTIONS} opções.`;
    }
    if (q.options.some((o) => !o?.trim())) return `Pergunta ${n}: há opção em branco.`;
    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      return `Pergunta ${n}: marque a opção correta.`;
    }
    if (typeof q.timeLimitSec !== 'number' || q.timeLimitSec < MIN_TIME_LIMIT || q.timeLimitSec > MAX_TIME_LIMIT) {
      return `Pergunta ${n}: tempo deve ficar entre ${MIN_TIME_LIMIT} e ${MAX_TIME_LIMIT}s.`;
    }
    if (typeof q.points !== 'number' || q.points <= 0) {
      return `Pergunta ${n}: pontuação inválida.`;
    }
    if (q.imageUrl !== undefined && q.imageUrl !== '') {
      if (typeof q.imageUrl !== 'string' || !/^https?:\/\//i.test(q.imageUrl.trim())) {
        return `Pergunta ${n}: a imagem deve ser uma URL começando com http(s).`;
      }
    }
    if (q.audioUrl !== undefined && q.audioUrl !== '') {
      if (typeof q.audioUrl !== 'string' || !/^https?:\/\//i.test(q.audioUrl.trim())) {
        return `Pergunta ${n}: o áudio deve ser uma URL começando com http(s).`;
      }
    }
    if (q.videoUrl !== undefined && q.videoUrl !== '') {
      if (typeof q.videoUrl !== 'string' || !/^https?:\/\//i.test(q.videoUrl.trim())) {
        return `Pergunta ${n}: o vídeo deve ser uma URL começando com http(s).`;
      }
    }
  }
  return null;
}
