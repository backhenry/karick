import type { Quiz } from '@karick/shared';

/**
 * Quiz de exemplo. Em produção isto viria do PostgreSQL (via Prisma),
 * buscado pelo `quizId` recebido em `host:createRoom`.
 */
export const SAMPLE_QUIZZES: Record<string, Quiz> = {
  'quiz-123': {
    id: 'quiz-123',
    title: 'Cultura Geral',
    questions: [
      {
        text: 'Qual planeta é conhecido como Planeta Vermelho?',
        options: ['Vênus', 'Marte', 'Júpiter', 'Saturno'],
        correctIndex: 1,
        timeLimitSec: 20,
        points: 1000,
      },
      {
        text: 'Quantos lados tem um hexágono?',
        options: ['5', '6', '7', '8'],
        correctIndex: 1,
        timeLimitSec: 15,
        points: 1000,
      },
      {
        text: 'Quem pintou a Mona Lisa?',
        options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'],
        correctIndex: 2,
        timeLimitSec: 20,
        points: 1000,
      },
    ],
  },
};
