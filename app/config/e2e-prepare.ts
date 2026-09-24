/**
 * Creates the e2e database named in DATABASE_URL when it does not exist.
 * Runs before `prisma migrate deploy` in `yarn test:e2e`. Local Postgres only:
 * refuses any host that is not localhost so it can never touch staging.
 */
import { Client } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

async function main(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`e2e-prepare refuses a non-local database host: ${url.hostname}`);
  }
  const database = url.pathname.replace(/^\//, "");
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const existing = await client.query("select 1 from pg_database where datname = $1", [database]);
    if (existing.rowCount === 0) {
      await client.query(`create database "${database}"`);
      process.stdout.write(`created database ${database}\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
