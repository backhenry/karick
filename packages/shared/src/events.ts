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
  'game:reveal': (data: {
    correctIndex: number;
    correctText: string;
    /** Quantos jogadores escolheram cada opção (mesmo índice das opções). */
    distribution: number[];
    leaderboard: LeaderboardRow[];
  }) => void;
  'game:over': (data: { podium: LeaderboardRow[] }) => void;
  'game:hostLeft': () => void;
  /** Tempo restante mudou (ex.: host adicionou tempo) — clientes re-sincronizam o cronômetro. */
  'game:timer': (data: { remainingSec: number }) => void;
  /** Este jogador foi removido pelo host. */
  'player:kicked': () => void;
  'error:msg': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'host:createRoom': (payload: { quiz: QuizDraft }, ack: Ack<{ pin: string }>) => void;
  'host:startGame': () => void;
  'host:nextQuestion': () => void;
  /** Revela a resposta imediatamente, sem esperar o tempo. */
  'host:revealNow': () => void;
  /** Adiciona tempo à pergunta atual. */
  'host:addTime': () => void;
  /** Remove um jogador da sala (pelo apelido). */
  'host:kickPlayer': (payload: { nickname: string }) => void;
  'player:join': (payload: { pin: string; nickname: string; avatar?: string }, ack: Ack) => void;
  'player:submitAnswer': (payload: { optionIndex: number }, ack: Ack<AnswerResult>) => void;
}

/** Dados anexados a cada socket no servidor. */
export interface SocketData {
  pin?: string;
  role?: 'host' | 'player';
}
