import type { QuizDraft } from './types.js';
import { MIN_OPTIONS, MAX_OPTIONS, MIN_TIME_LIMIT, MAX_TIME_LIMIT } from './constants.js';

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
  }
  return null;
}
