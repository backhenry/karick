import type { GameRoom } from '@karick/shared';
import { PIN_LENGTH } from '@karick/shared';

/**
 * Abstração de persistência da sala. A implementação atual é em memória.
 * Para escalar horizontalmente, trocar por uma versão baseada em Redis
 * mantendo esta mesma interface — o resto do código não muda.
 */
export interface RoomStore {
  create(room: GameRoom): void;
  get(pin: string): GameRoom | undefined;
  delete(pin: string): void;
  has(pin: string): boolean;
}

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, GameRoom>();

  create(room: GameRoom): void {
    this.rooms.set(room.pin, room);
  }
  get(pin: string): GameRoom | undefined {
    return this.rooms.get(pin);
  }
  delete(pin: string): void {
    this.rooms.delete(pin);
  }
  has(pin: string): boolean {
    return this.rooms.has(pin);
  }
}

const MIN = 10 ** (PIN_LENGTH - 1);
const MAX = 10 ** PIN_LENGTH - 1;

/** Gera um PIN numérico único (que ainda não exista no store). */
export function generatePin(store: RoomStore): string {
  let pin: string;
  do {
    pin = Math.floor(MIN + Math.random() * (MAX - MIN)).toString();
  } while (store.has(pin));
  return pin;
}
