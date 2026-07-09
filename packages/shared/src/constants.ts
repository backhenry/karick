/** Constantes de jogo partilhadas entre servidor e clientes. */
export const PIN_LENGTH = 6;
export const MAX_NICKNAME_LENGTH = 15;
export const ROOM_TTL_SECONDS = 60 * 60 * 3;

/** Limites do editor de quiz (validados no cliente E no servidor). */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
export const MIN_TIME_LIMIT = 5;
export const MAX_TIME_LIMIT = 120;
export const DEFAULT_TIME_LIMIT = 20;
export const DEFAULT_POINTS = 1000;

/** Cores/formas das opções — devem ser idênticas em Host e Player. */
export const OPTION_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'] as const;
export const OPTION_SHAPES = ['▲', '◆', '●', '■'] as const;

/** Emojis disponíveis como avatar do jogador. */
export const AVATARS = ['🦊', '🐼', '🐸', '🦉', '🐙', '🦄', '🐝', '🐧', '🦁', '🐢', '🐺', '🐨', '🦖', '🐬', '🦋', '🐹'] as const;

/** Bônus de sequência: cada acerto consecutivo (a partir do 2º) soma este valor, com teto. */
export const STREAK_BONUS_STEP = 100;
export const STREAK_BONUS_MAX = 500;

/** Quantos segundos o botão "+tempo" do host adiciona à pergunta atual. */
export const ADD_TIME_SECONDS = 20;

/** Limites de tags por quiz. */
export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 24;
