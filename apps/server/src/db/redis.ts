import { Redis } from 'ioredis';

/**
 * Conecta ao Redis se REDIS_URL existir e estiver acessível; senão retorna null
 * (o app segue com estado/broadcast em memória). Nunca derruba o boot.
 * O cliente retornado é usado tanto pela RedisRoomStore quanto pelo adapter.
 */
export async function connectRedis(): Promise<Redis | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const client = new Redis(url, { lazyConnect: true, connectTimeout: 4000, maxRetriesPerRequest: 2 });
  client.on('error', (e) => console.error('Redis:', e.message));
  try {
    await client.connect();
    return client;
  } catch (e) {
    console.error('⚠️  Falha ao conectar no Redis — seguindo em memória:', (e as Error).message);
    client.disconnect();
    return null;
  }
}
