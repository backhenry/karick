import type { QuizDraft, Question } from '@karick/shared';
import { DEFAULT_TIME_LIMIT, DEFAULT_POINTS } from '@karick/shared';

export function emptyQuestion(): Question {
  return {
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    timeLimitSec: DEFAULT_TIME_LIMIT,
    points: DEFAULT_POINTS,
  };
}

export function emptyDraft(): QuizDraft {
  return { title: '', questions: [emptyQuestion()] };
}

export function exampleQuiz(): QuizDraft {
  return {
    title: 'Cultura Geral',
    questions: [
      { text: 'Qual planeta é conhecido como Planeta Vermelho?', options: ['Vênus', 'Marte', 'Júpiter', 'Saturno'], correctIndex: 1, timeLimitSec: 20, points: 1000 },
      { text: 'Quantos lados tem um hexágono?', options: ['5', '6', '7', '8'], correctIndex: 1, timeLimitSec: 15, points: 1000 },
      { text: 'Quem pintou a Mona Lisa?', options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'], correctIndex: 2, timeLimitSec: 20, points: 1000 },
    ],
  };
}
