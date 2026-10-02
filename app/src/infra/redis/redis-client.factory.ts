import Redis from "ioredis";

/**
 * Connects now, not on first command, so a Redis that is configured and unreachable fails the
 * boot with the cause instead of degrading in silence (`standard-security`: present and broken
 * configuration is an error, not a fallback). The message never carries the URL: it may hold a password.
 */
export async function connectRedis(url: string): Promise<Redis> {
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
  try {
    await client.connect();
  } catch (cause) {
    client.disconnect();
    throw new Error(`Redis at REDIS_URL is not reachable: ${(cause as Error).message}`, { cause });
  }
  return client;
}
