export * from './types.js';
export * from './events.js';

/** Constantes de jogo partilhadas. */
export const PIN_LENGTH = 6;
export const MAX_NICKNAME_LENGTH = 15;
export const ROOM_TTL_SECONDS = 60 * 60 * 3;

/** Cores/formas das opções — devem ser idênticas em Host e Player. */
export const OPTION_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'] as const;
export const OPTION_SHAPES = ['▲', '◆', '●', '■'] as const;
