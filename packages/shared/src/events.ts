/**
 * Contrato de eventos Socket.IO — tipado nos dois lados.
 * Passar estes tipos como generics para `Server<...>` (back) e `io<...>()` (front)
 * faz um payload errado quebrar o build em vez de falhar em produção.
 */
import type {
  PublicPlayer,
  HostQuestionPayload,
  PlayerQuestionPayload,
  LeaderboardRow,
  AnswerResult,
  QuizDraft,
} from './types.js';

/** Callback de confirmação (ACK) padrão dos eventos cliente→servidor. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Ack<T = {}> = (
  res: { ok: boolean; error?: string } & Partial<T>,
) => void;

export interface ServerToClientEvents {
  'lobby:updated': (data: { players: PublicPlayer[]; count: number }) => void;
  /** O Host recebe o payload completo; cada Player recebe o reduzido. */
  'game:question:host': (data: HostQuestionPayload) => void;
  'game:question:player': (data: PlayerQuestionPayload) => void;
  /** Quantos jogadores já responderam a pergunta atual (para o Host mostrar progresso). */
  'game:answerCount': (data: { answered: number; total: number }) => void;
  'game:reveal': (data: { correctIndex: number; leaderboard: LeaderboardRow[] }) => void;
  'game:over': (data: { podium: LeaderboardRow[] }) => void;
  'game:hostLeft': () => void;
  'error:msg': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'host:createRoom': (payload: { quiz: QuizDraft }, ack: Ack<{ pin: string }>) => void;
  'host:startGame': () => void;
  'host:nextQuestion': () => void;
  'player:join': (payload: { pin: string; nickname: string }, ack: Ack) => void;
  'player:submitAnswer': (payload: { optionIndex: number }, ack: Ack<AnswerResult>) => void;
}

/** Dados anexados a cada socket no servidor. */
export interface SocketData {
  pin?: string;
  role?: 'host' | 'player';
}
