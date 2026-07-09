import { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

/**
 * Ativa o adapter Redis do Socket.IO (broadcast entre instâncias) se REDIS_URL
 * existir e o Redis estiver acessível. Caso contrário, segue sem adapter (uma
 * instância). Nunca derruba o boot por causa do Redis.
 *
 * IMPORTANTE: isto é só a camada de mensagens. O estado das salas ainda vive em
 * memória — rodar VÁRIAS instâncias com segurança exige também externalizar o
 * estado (com escrita atômica). Até lá: mantenha 1 instância.
 */
export async function setupRedisAdapter(io: Server): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) return false;

  try {
    const pub = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 4000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // não fica retentando no boot
    });
    const sub = pub.duplicate();
    pub.on('error', (e) => console.error('Redis (pub):', e.message));
    sub.on('error', (e) => console.error('Redis (sub):', e.message));
    await pub.connect();
    await sub.connect();
    io.adapter(createAdapter(pub, sub));
    return true;
  } catch (e) {
    console.error('⚠️  Falha ao conectar no Redis — seguindo sem adapter:', (e as Error).message);
    return false;
  }
}
