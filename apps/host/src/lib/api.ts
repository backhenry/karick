import type { QuizDraft, QuizSummary, SavedQuiz, GameHistoryEntry } from '@karick/shared';

const API_BASE =
  (import.meta.env.VITE_SERVER_URL ??
    (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin)) + '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  return body as T;
}

export const api = {
  status: () => req<{ dbEnabled: boolean }>('/status'),
  listQuizzes: () => req<QuizSummary[]>('/quizzes'),
  getQuiz: (id: string) => req<SavedQuiz>(`/quizzes/${id}`),
  createQuiz: (draft: QuizDraft) => req<SavedQuiz>('/quizzes', { method: 'POST', body: JSON.stringify(draft) }),
  updateQuiz: (id: string, draft: QuizDraft) =>
    req<SavedQuiz>(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(draft) }),
  deleteQuiz: (id: string) => req<void>(`/quizzes/${id}`, { method: 'DELETE' }),
  history: () => req<GameHistoryEntry[]>('/history'),
};
