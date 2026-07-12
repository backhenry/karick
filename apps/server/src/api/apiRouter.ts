import { Router, type Response } from 'express';
import { validateQuiz, sanitizeBrand } from '@karick/shared';
import type { Question } from '@karick/shared';
import type { QuizRepository } from '../store/quizRepository.js';
import type { HistoryRepository } from '../store/historyRepository.js';
import type { BankRepository } from '../store/bankRepository.js';
import type { UserRepository } from '../store/userRepository.js';
import { requireAuth } from '../auth/authMiddleware.js';
import { SESSION_COOKIE } from '../auth/session.js';

/**
 * API REST da biblioteca de quizzes e do histórico — tudo escopado ao usuário
 * autenticado (res.locals.userId, injetado por requireAuth).
 */
export function createApiRouter(
  quizzes: QuizRepository,
  history: HistoryRepository,
  bank: BankRepository,
  users: UserRepository,
  dbEnabled: boolean,
): Router {
  const r = Router();

  r.get('/status', (_req, res) => res.json({ dbEnabled }));

  // Daqui em diante exige login.
  r.use(requireAuth);
  const uid = (res: Response): string => res.locals.userId;

  // ─── Excluir a conta (apaga quizzes, banco, histórico e o usuário) ───
  r.delete('/account', async (_req, res, next) => {
    try {
      const id = uid(res);
      await Promise.all([quizzes.removeAllByOwner(id), bank.removeAllByOwner(id), history.clear(id)]);
      await users.deleteAccount(id);
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ─── Perfil do usuário (e-mail + PIN fixo da sala permanente + foto) ───
  r.get('/profile', async (_req, res, next) => {
    try {
      const user = await users.findById(uid(res));
      res.json({
        email: user?.email ?? '',
        fixedPin: await users.getFixedPin(uid(res)),
        photo: await users.getPhoto(uid(res)),
      });
    } catch (e) {
      next(e);
    }
  });

  // Foto de perfil: data URL de imagem, já redimensionada no cliente (limite ~200KB).
  r.put('/profile/photo', async (req, res, next) => {
    try {
      const photo = req.body?.photo;
      if (photo === null || photo === '') {
        await users.setPhoto(uid(res), null);
        return res.json({ photo: null });
      }
      if (typeof photo !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(photo) || photo.length > 200_000) {
        return res.status(400).json({ error: 'Imagem inválida (use PNG/JPEG/WebP até ~150KB).' });
      }
      await users.setPhoto(uid(res), photo);
      res.json({ photo });
    } catch (e) {
      next(e);
    }
  });

  // ─── Marca (identidade visual) persistida por usuário ───
  r.get('/brand', async (_req, res, next) => {
    try {
      res.json(await users.getBrand(uid(res)));
    } catch (e) {
      next(e);
    }
  });
  r.put('/brand', async (req, res, next) => {
    try {
      const brand = sanitizeBrand(req.body);
      if (!brand) return res.status(400).json({ error: 'Marca inválida' });
      await users.setBrand(uid(res), brand);
      res.json(brand);
    } catch (e) {
      next(e);
    }
  });

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

  r.delete('/history', async (_req, res, next) => {
    try {
      await history.clear(uid(res));
      res.status(204).end();
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
