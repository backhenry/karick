import type { Redis } from 'ioredis';
import type { GameRoom } from '@karick/shared';
import { ROOM_TTL_SECONDS } from '@karick/shared';
import type { RoomStore } from './roomStore.js';

const key = (pin: string) => `room:${pin}`;

/**
 * Estado das salas no Redis. Escrita atômica via WATCH/MULTI: se a chave mudar
 * entre o WATCH e o EXEC (outra instância gravou), o EXEC é abortado e a
 * operação é refeita — sem perder atualizações concorrentes.
 */
export class RedisRoomStore implements RoomStore {
  constructor(private redis: Redis) {}

  async create(room: GameRoom): Promise<void> {
    await this.redis.set(key(room.pin), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS);
  }

  async get(pin: string): Promise<GameRoom | null> {
    const raw = await this.redis.get(key(pin));
    return raw ? (JSON.parse(raw) as GameRoom) : null;
  }

  async delete(pin: string): Promise<void> {
    await this.redis.del(key(pin));
  }

  async has(pin: string): Promise<boolean> {
    return (await this.redis.exists(key(pin))) === 1;
  }

  async update(pin: string, mutator: (room: GameRoom) => void): Promise<GameRoom | null> {
    const k = key(pin);
    for (let attempt = 0; attempt < 25; attempt++) {
      await this.redis.watch(k);
      const raw = await this.redis.get(k);
      if (!raw) {
        await this.redis.unwatch();
        return null;
      }
      const room = JSON.parse(raw) as GameRoom;
      mutator(room);
      // EXEC retorna null se o WATCH detectou alteração concorrente → refaz.
      const res = await this.redis.multi().set(k, JSON.stringify(room), 'EX', ROOM_TTL_SECONDS).exec();
      if (res) return room;
    }
    throw new Error(`RedisRoomStore.update: excesso de conflitos em ${pin}`);
  }
}
