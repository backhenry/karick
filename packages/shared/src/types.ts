/**
 * Modelos de domínio compartilhados entre servidor e clientes.
 * Estes tipos são a "fonte da verdade" do formato dos dados que trafegam.
 */

export type GameStatus = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'FINISHED';

export interface Question {
  text: string;
  options: string[];
  /** Índice (0-based) da opção correta. Nunca enviado ao Player durante a pergunta. */
  correctIndex: number;
  timeLimitSec: number;
  /** Pontuação-base da pergunta; o valor final varia com a velocidade da resposta. */
  points: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
}

/** Quiz montado pelo Host no navegador e enviado ao criar a sala (sem id). */
export interface QuizDraft {
  title: string;
  questions: Question[];
}

export interface PlayerAnswer {
  optionIndex: number;
  answeredAt: number;
  isCorrect: boolean;
  pointsAwarded: number;
}

export interface Player {
  socketId: string;
  nickname: string;
  score: number;
  /** Resposta da pergunta atual; resetada a cada nova pergunta. */
  currentAnswer: PlayerAnswer | null;
}

/** Estado vivo da sala (em memória / Redis). Não é persistido no banco relacional. */
export interface GameRoom {
  pin: string;
  hostSocketId: string;
  quiz: Quiz;
  status: GameStatus;
  currentQuestionIndex: number;
  /** Timestamp (ms) em que a pergunta atual começou — base do cálculo de velocidade. */
  questionStartedAt: number | null;
  players: Record<string, Player>;
}

/* ─── Projeções públicas (o que sai para os clientes) ─── */

export interface PublicPlayer {
  nickname: string;
  score: number;
}

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  score: number;
}

/** Pergunta como o HOST a vê (inclui a resposta certa). */
export interface HostQuestionPayload {
  index: number;
  total: number;
  text: string;
  options: string[];
  timeLimitSec: number;
  correctIndex: number;
}

/** Pergunta como o PLAYER a vê (sem texto nem resposta — só os botões). */
export interface PlayerQuestionPayload {
  index: number;
  total: number;
  optionsCount: number;
  timeLimitSec: number;
}

export interface AnswerResult {
  isCorrect: boolean;
  pointsAwarded: number;
  totalScore: number;
}
