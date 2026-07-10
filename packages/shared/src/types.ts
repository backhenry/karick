/**
 * Modelos de domínio compartilhados entre servidor e clientes.
 * Estes tipos são a "fonte da verdade" do formato dos dados que trafegam.
 */

export type GameStatus = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'FINISHED';

export type PowerupType = 'fiftyFifty' | 'double' | 'freeze';

export type GameMode = 'individual' | 'teams' | 'betting' | 'survival';

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
  /** URL http(s) de um áudio opcional (ex.: "adivinhe a música"). */
  audioUrl?: string;
  /** URL de vídeo (YouTube ou .mp4) opcional. */
  videoUrl?: string;
  /** Trecho de código exibido em fonte monoespaçada (perguntas de programação). */
  code?: string;
  /** Explicação da resposta certa, mostrada no reveal (opcional). */
  explanation?: string;
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

/** Pergunta avulsa no banco de perguntas (reutilizável, com tags). */
export interface BankQuestion {
  id: string;
  question: Question;
  tags: string[];
  updatedAt: string; // ISO
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
  stats?: QuestionStat[];
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
  /** Equipe do jogador (só no modo em equipes). */
  team?: string;
  /** Power-ups ainda disponíveis (um uso cada por partida). */
  powerups: { fiftyFifty: boolean; double: boolean; freeze: boolean };
  /** 50/50 acionado na pergunta atual (apenas exibição). */
  fiftyUsedQ?: boolean;
  /** Power-up de pontuação ativo na pergunta atual. */
  scoringPowerupQ?: 'double' | 'freeze' | null;
  /** Eliminado no modo sobrevivência (vira espectador). */
  eliminated?: boolean;
  /** Preferência: mostrar o texto do enunciado/opções no celular do jogador. */
  showText?: boolean;
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
  /** Modo de jogo. */
  mode: GameMode;
  /** Embaralhar as opções por jogador (anti-cola). */
  shuffle: boolean;
  /** Equipes do jogo (só quando mode === 'teams'). */
  teams: string[];
  /** Timestamp (ms) em que a pergunta atual começou — base do cálculo de velocidade. */
  questionStartedAt: number | null;
  /** Timestamp (ms) em que a pergunta atual expira (pode ser estendido pelo host). */
  questionEndsAt: number | null;
  /** Última revelação (para re-sincronizar quem reconecta durante o REVEAL). */
  lastReveal?: { correctIndex: number; correctText: string; distribution: number[]; leaderboard: LeaderboardRow[]; teamLeaderboard?: TeamRow[]; explanation?: string };
  /** Estatística acumulada por pergunta revelada. */
  stats: QuestionStat[];
  players: Record<string, Player>;
}

/* ─── Projeções públicas (o que sai para os clientes) ─── */

export interface PublicPlayer {
  nickname: string;
  score: number;
  avatar?: string;
  team?: string;
}

/** Linha do placar por equipe (soma das pontuações dos membros). */
export interface TeamRow {
  rank: number;
  name: string;
  score: number;
  players: number;
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
  audioUrl?: string;
  videoUrl?: string;
  code?: string;
  mode?: GameMode;
}

/** Pergunta como o PLAYER a vê (sem texto nem resposta — só os botões). */
export interface PlayerQuestionPayload {
  index: number;
  total: number;
  optionsCount: number;
  timeLimitSec: number;
  imageUrl?: string;
  mode: GameMode;
  /** Banco atual do jogador (modo aposta). */
  bank?: number;
  /** Textos das opções (anti-cola embaralha; preferência do jogador em ordem normal). Ausente = modo cor. */
  options?: string[];
  /** Enunciado, enviado quando o jogador optou por ver o texto no celular. */
  text?: string;
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
