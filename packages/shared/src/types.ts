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
  /** URL http(s) de uma imagem opcional exibida com a pergunta. */
  imageUrl?: string;
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
  tags?: string[];
}

/** Quiz salvo na biblioteca (banco de dados). */
export interface SavedQuiz {
  id: string;
  title: string;
  questions: Question[];
  tags: string[];
  updatedAt: string; // ISO
}

/** Resumo para listar a biblioteca sem carregar todas as perguntas. */
export interface QuizSummary {
  id: string;
  title: string;
  questionCount: number;
  tags: string[];
  updatedAt: string; // ISO
}

/** Estatística de uma pergunta (mostrada ao fim do jogo). */
export interface QuestionStat {
  text: string;
  correctCount: number;
  answered: number;
  total: number;
}

/** Uma partida registrada no histórico. */
export interface GameHistoryEntry {
  id: string;
  quizTitle: string;
  pin: string;
  playedAt: string; // ISO
  players: LeaderboardRow[];
}

export interface PlayerAnswer {
  optionIndex: number;
  answeredAt: number;
  isCorrect: boolean;
  pointsAwarded: number;
}

export interface Player {
  /** Identidade persistente do jogador (gerada no cliente, sobrevive a reconexões). */
  id: string;
  socketId: string;
  nickname: string;
  score: number;
  /** Emoji escolhido pelo jogador. */
  avatar: string;
  /** Acertos consecutivos (para o bônus de sequência). */
  streak: number;
  /** Se o jogador está conectado agora (false enquanto caído, mantendo a pontuação). */
  connected: boolean;
  /** Resposta da pergunta atual; resetada a cada nova pergunta. */
  currentAnswer: PlayerAnswer | null;
  /** Posição no ranking na última revelação (para calcular a variação). */
  previousRank?: number;
}

/** Estado vivo da sala (em memória / Redis). Não é persistido no banco relacional. */
export interface GameRoom {
  pin: string;
  hostSocketId: string;
  /** Usuário dono da sala (do cookie de sessão do host), para o histórico. */
  hostUserId: string | null;
  quiz: Quiz;
  status: GameStatus;
  currentQuestionIndex: number;
  /** Timestamp (ms) em que a pergunta atual começou — base do cálculo de velocidade. */
  questionStartedAt: number | null;
  /** Timestamp (ms) em que a pergunta atual expira (pode ser estendido pelo host). */
  questionEndsAt: number | null;
  /** Última revelação (para re-sincronizar quem reconecta durante o REVEAL). */
  lastReveal?: { correctIndex: number; correctText: string; distribution: number[]; leaderboard: LeaderboardRow[] };
  /** Estatística acumulada por pergunta revelada. */
  stats: QuestionStat[];
  players: Record<string, Player>;
}

/* ─── Projeções públicas (o que sai para os clientes) ─── */

export interface PublicPlayer {
  nickname: string;
  score: number;
  avatar?: string;
}

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  score: number;
  avatar?: string;
  /** Pontos ganhos na pergunta que acabou de ser revelada. */
  gained?: number;
  /** Variação de posição vs. rodada anterior (positivo = subiu; undefined = 1ª rodada). */
  rankDelta?: number;
}

/** Pergunta como o HOST a vê (inclui a resposta certa). */
export interface HostQuestionPayload {
  index: number;
  total: number;
  text: string;
  options: string[];
  timeLimitSec: number;
  correctIndex: number;
  imageUrl?: string;
}

/** Pergunta como o PLAYER a vê (sem texto nem resposta — só os botões). */
export interface PlayerQuestionPayload {
  index: number;
  total: number;
  optionsCount: number;
  timeLimitSec: number;
  imageUrl?: string;
}

export interface AnswerResult {
  isCorrect: boolean;
  pointsAwarded: number;
  totalScore: number;
  /** Acertos consecutivos após esta resposta (0 se errou). */
  streak: number;
  /** Parte de `pointsAwarded` que veio do bônus de sequência. */
  streakBonus: number;
}
