import { Router, type Response } from 'express';
import { validateQuiz } from '@karick/shared';
import type { Question } from '@karick/shared';
import type { QuizRepository } from '../store/quizRepository.js';
import type { HistoryRepository } from '../store/historyRepository.js';
import type { BankRepository } from '../store/bankRepository.js';
import { requireAuth } from '../auth/authMiddleware.js';

/**
 * API REST da biblioteca de quizzes e do histórico — tudo escopado ao usuário
 * autenticado (res.locals.userId, injetado por requireAuth).
 */
export function createApiRouter(
  quizzes: QuizRepository,
  history: HistoryRepository,
  bank: BankRepository,
  dbEnabled: boolean,
): Router {
  const r = Router();

  r.get('/status', (_req, res) => res.json({ dbEnabled }));

  // Daqui em diante exige login.
  r.use(requireAuth);
  const uid = (res: Response): string => res.locals.userId;

  r.get('/quizzes', async (_req, res, next) => {
    try {
      res.json(await quizzes.list(uid(res)));
    } catch (e) {
      next(e);
    }
  });

  r.get('/quizzes/:id', async (req, res, next) => {
    try {
      const quiz = await quizzes.get(req.params.id, uid(res));
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
      res.status(201).json(await quizzes.create(req.body, uid(res)));
    } catch (e) {
      next(e);
    }
  });

  r.put('/quizzes/:id', async (req, res, next) => {
    try {
      const err = validateQuiz(req.body);
      if (err) return res.status(400).json({ error: err });
      const updated = await quizzes.update(req.params.id, req.body, uid(res));
      if (!updated) return res.status(404).json({ error: 'Quiz não encontrado' });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  r.delete('/quizzes/:id', async (req, res, next) => {
    try {
      const ok = await quizzes.remove(req.params.id, uid(res));
      if (!ok) return res.status(404).json({ error: 'Quiz não encontrado' });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  r.get('/history', async (_req, res, next) => {
    try {
      res.json(await history.recent(uid(res)));
    } catch (e) {
      next(e);
    }
  });

  // ─── Galeria pública ───
  r.get('/gallery', async (_req, res, next) => {
    try {
      res.json(await quizzes.listPublic());
    } catch (e) {
      next(e);
    }
  });

  r.get('/gallery/:id', async (req, res, next) => {
    try {
      const quiz = await quizzes.getPublic(req.params.id);
      if (!quiz) return res.status(404).json({ error: 'Quiz não encontrado' });
      res.json(quiz);
    } catch (e) {
      next(e);
    }
  });

  // ─── Banco de perguntas ───
  r.get('/bank', async (_req, res, next) => {
    try {
      res.json(await bank.list(uid(res)));
    } catch (e) {
      next(e);
    }
  });

  r.post('/bank', async (req, res, next) => {
    try {
      const questions: Question[] = Array.isArray(req.body?.questions) ? req.body.questions : [];
      const tags: string[] = Array.isArray(req.body?.tags) ? req.body.tags : [];
      if (questions.length === 0) return res.status(400).json({ error: 'Nenhuma pergunta enviada.' });
      // Valida cada pergunta reaproveitando validateQuiz (um quiz de 1 pergunta).
      for (let i = 0; i < questions.length; i++) {
        const err = validateQuiz({ title: 'x', questions: [questions[i]] });
        if (err) return res.status(400).json({ error: `Pergunta ${i + 1}: ${err}` });
      }
      const added = [];
      for (const q of questions) added.push(await bank.add(uid(res), q, tags));
      res.status(201).json(added);
    } catch (e) {
      next(e);
    }
  });

  r.delete('/bank/:id', async (req, res, next) => {
    try {
      const okDel = await bank.remove(req.params.id, uid(res));
      if (!okDel) return res.status(404).json({ error: 'Pergunta não encontrada' });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  return r;
}
