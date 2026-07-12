import type { QuizDraft, QuizSummary, SavedQuiz, GameHistoryEntry, BankQuestion, Question, Brand } from '@karick/shared';

const API_BASE =
  (import.meta.env.VITE_SERVER_URL ??
    (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin)) + '/api';

export class AuthError extends Error {}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    credentials: 'include', // envia/recebe o cookie de sessão
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new AuthError(body.error ?? 'Não autenticado');
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return body as T;
}

export interface AuthUser {
  id: string;
  email: string;
}

export const api = {
  status: () => req<{ dbEnabled: boolean }>('/status'),
  me: () => req<AuthUser>('/auth/me'),
  signup: (email: string, password: string) =>
    req<AuthUser>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    req<AuthUser>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => req<void>('/auth/logout', { method: 'POST' }),
  deleteAccount: () => req<void>('/account', { method: 'DELETE' }),
  listQuizzes: () => req<QuizSummary[]>('/quizzes'),
  getQuiz: (id: string) => req<SavedQuiz>(`/quizzes/${id}`),
  createQuiz: (draft: QuizDraft) => req<SavedQuiz>('/quizzes', { method: 'POST', body: JSON.stringify(draft) }),
  updateQuiz: (id: string, draft: QuizDraft) =>
    req<SavedQuiz>(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(draft) }),
  deleteQuiz: (id: string) => req<void>(`/quizzes/${id}`, { method: 'DELETE' }),
  history: () => req<GameHistoryEntry[]>('/history'),
  clearHistory: () => req<void>('/history', { method: 'DELETE' }),
  gallery: () => req<QuizSummary[]>('/gallery'),
  galleryQuiz: (id: string) => req<SavedQuiz>(`/gallery/${id}`),
  listBank: () => req<BankQuestion[]>('/bank'),
  addBank: (questions: Question[], tags: string[]) =>
    req<BankQuestion[]>('/bank', { method: 'POST', body: JSON.stringify({ questions, tags }) }),
  removeBank: (id: string) => req<void>(`/bank/${id}`, { method: 'DELETE' }),
  profile: () => req<{ email: string; fixedPin: string | null; photo: string | null }>('/profile'),
  setPhoto: (photo: string | null) => req<{ photo: string | null }>('/profile/photo', { method: 'PUT', body: JSON.stringify({ photo }) }),
  getBrand: () => req<Brand | null>('/brand'),
  setBrand: (brand: Brand) => req<Brand>('/brand', { method: 'PUT', body: JSON.stringify(brand) }),
};
