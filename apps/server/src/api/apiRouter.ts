import { Router } from 'express';
import { validateQuiz } from '@karick/shared';
import type { QuizRepository } from '../store/quizRepository.js';
import type { HistoryRepository } from '../store/historyRepository.js';

/**
 * API REST da biblioteca de quizzes e do histórico de partidas.
 * `dbEnabled` indica se há Postgres real por trás (senão, é em memória e não
 * persiste entre reinícios) — o front usa isso para avisar o usuário.
 */
export function createApiRouter(
  quizzes: QuizRepository,
  history: HistoryRepository,
  dbEnabled: boolean,
): Router {
  const r = Router();

  r.get('/status', (_req, res) => res.json({ dbEnabled }));

  // ─── Biblioteca de quizzes ───
  r.get('/quizzes', async (_req, res, next) => {
    try {
      res.json(await quizzes.list());
    } catch (e) {
      next(e);
    }
  });

  r.get('/quizzes/:id', async (req, res, next) => {
    try {
      const quiz = await quizzes.get(req.params.id);
      if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado' });
      res.json(quiz);
    } catch (e) {
      next(e);
    }
  });

  r.post('/quizzes', async (req, res, next) => {
    try {
      const err = validateQuiz(req.body);
      if (err) return res.status(400).json({ error: err });
      res.status(201).json(await quizzes.create(req.body));
    } catch (e) {
      next(e);
    }
  });

  r.put('/quizzes/:id', async (req, res, next) => {
    try {
      const err = validateQuiz(req.body);
      if (err) return res.status(400).json({ error: err });
      const updated = await quizzes.update(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Quiz não encontrado' });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  r.delete('/quizzes/:id', async (req, res, next) => {
    try {
      const ok = await quizzes.remove(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Quiz não encontrado' });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ─── Histórico ───
  r.get('/history', async (_req, res, next) => {
    try {
      res.json(await history.recent());
    } catch (e) {
      next(e);
    }
  });

  return r;
}
