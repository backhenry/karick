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
  QuestionStat,
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
    explanation?: string;
  }) => void;
  /** Uma reação (emoji) enviada por um jogador — o Host faz flutuar na tela. */
  'game:reaction': (data: { emoji: string }) => void;
  'game:over': (data: { podium: LeaderboardRow[]; stats: QuestionStat[] }) => void;
  'game:hostLeft': () => void;
  /** Tempo restante mudou (ex.: host adicionou tempo) — clientes re-sincronizam o cronômetro. */
  'game:timer': (data: { remainingSec: number }) => void;
  /** Este jogador foi removido pelo host. */
  'player:kicked': () => void;
  /** Re-sincroniza o estado do jogador ao (re)conectar no meio do jogo. */
  'game:sync': (data: {
    screen: 'LOBBY' | 'QUESTION' | 'ANSWERED' | 'FEEDBACK' | 'OVER';
    question?: PlayerQuestionPayload;
    remainingSec?: number;
    reveal?: { correctIndex: number; correctText: string; rank?: number; gained?: number; score?: number; explanation?: string };
    answered?: { isCorrect: boolean };
  }) => void;
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
  'player:join': (payload: { pin: string; nickname: string; avatar?: string; playerId: string }, ack: Ack) => void;
  'player:submitAnswer': (payload: { optionIndex: number }, ack: Ack<AnswerResult>) => void;
  /** Jogador envia uma reação (emoji) que aparece na tela do Host. */
  'player:react': (payload: { emoji: string }) => void;
}

/** Dados anexados a cada socket no servidor. */
export interface SocketData {
  pin?: string;
  role?: 'host' | 'player';
  playerId?: string;
}
