import type { GameRoom } from '@karick/shared';
import { PIN_LENGTH } from '@karick/shared';

/**
 * Abstração de persistência da sala (assíncrona para suportar Redis).
 *
 * `update` é o ponto-chave: lê → aplica o `mutator` → grava de forma ATÔMICA.
 * Na implementação Redis isso usa WATCH/MULTI com retry (concorrência
 * otimística), evitando que duas escritas concorrentes (ex.: dois jogadores
 * respondendo em instâncias diferentes) percam dados.
 */
export interface RoomStore {
  create(room: GameRoom): Promise<void>;
  get(pin: string): Promise<GameRoom | null>;
  update(pin: string, mutator: (room: GameRoom) => void): Promise<GameRoom | null>;
  delete(pin: string): Promise<void>;
  has(pin: string): Promise<boolean>;
}

/* ─── Em memória (instância única / dev) ─── */

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, GameRoom>();

  async create(room: GameRoom): Promise<void> {
    this.rooms.set(room.pin, room);
  }
  async get(pin: string): Promise<GameRoom | null> {
    return this.rooms.get(pin) ?? null;
  }
  async update(pin: string, mutator: (room: GameRoom) => void): Promise<GameRoom | null> {
    const room = this.rooms.get(pin);
    if (!room) return null;
    mutator(room); // referência viva — Node é single-thread, sem corrida aqui
    return room;
  }
  async delete(pin: string): Promise<void> {
    this.rooms.delete(pin);
  }
  async has(pin: string): Promise<boolean> {
    return this.rooms.has(pin);
  }
}

const MIN = 10 ** (PIN_LENGTH - 1);
const MAX = 10 ** PIN_LENGTH - 1;

/** Gera um PIN numérico único (que ainda não exista no store). */
export async function generatePin(store: RoomStore): Promise<string> {
  let pin: string;
  do {
    pin = Math.floor(MIN + Math.random() * (MAX - MIN)).toString();
  } while (await store.has(pin));
  return pin;
}
