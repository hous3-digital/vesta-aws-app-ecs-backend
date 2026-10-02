import { Logger } from "@nestjs/common";
import Redis from "ioredis";

const logger = new Logger("Redis");

/**
 * Connects now, not on first command, so a Redis that is configured and unreachable fails the
 * boot with the cause instead of degrading in silence (`standard-security`: present and broken
 * configuration is an error, not a fallback). ioredis reports the network error (ECONNREFUSED,
 * ENOTFOUND) on the `error` event and rejects `connect()` with a generic message, so the first
 * event is kept as the cause; after the boot the same listener routes outages to the Logger
 * instead of ioredis' own console output. The message never carries the URL: it may hold a password.
 */
export async function connectRedis(url: string): Promise<Redis> {
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
  const seen: Error[] = [];
  client.on("error", (error: Error) => {
    seen.push(error);
    logger.warn(`Redis error: ${error.message}`);
  });
  try {
    await client.connect();
  } catch (cause) {
    client.disconnect();
    const detail = seen[0]?.message ?? (cause as Error).message;
    throw new Error(`Redis at REDIS_URL is not reachable: ${detail}`, { cause });
  }
  return client;
}
