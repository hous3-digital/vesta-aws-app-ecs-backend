#!/usr/bin/env node
"use strict";

/**
 * Gate hook: blocks destructive or irreversible shell commands and shell-based reads of secrets.
 * Fail closed.
 */

const fs = require("fs");
const path = require("path");
const {
  APP_DIR,
  readStdin,
  normalize,
  allow,
  deny,
  ask,
} = require("./lib/agent");

// Shell readers followed by a real env file (not a template) or key material.
const SECRET_READ = [
  /\b(cat|less|more|head|tail|bat|grep|rg|sed|awk|cut|sort|strings|xxd|base64|source)\b[^|;&\n]*?(^|[\s\/'"])\.env(\.(local|test|staging|production|development))?(?=$|[\s;|&)'"])/,
  /\b(cat|less|more|head|tail|bat|grep|rg|sed|awk|strings|xxd|base64)\b[^|;&\n]*\.(pem|p12|pfx|key)(?=$|[\s;|&)'"])/,
  /(^|[\s;&|])(printenv|env)\s*($|\|)/,
];

const DB_RESET = [
  /prisma:reset/i,
  /\bprisma\s+migrate\s+reset\b/i,
  /\bprisma\s+db\s+(reset|push\b.*--force-reset)/i,
  /\bdrop\s+(table|database|schema)\b/i,
  /\btruncate\s+(table\s+)?\w/i,
];

const DESTRUCTIVE = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf|-fr)\s+[\/~]/,
  /\bgit\s+push\s+.*(--force(-\w+)?|-f)\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-[a-zA-Z]*f/,
  /\bgit\s+filter-(branch|repo)\b/,
  /\bgit\s+branch\s+-D\b/,
  /\bdocker\s+(system|volume)\s+prune\b/,
  /\bdocker\s+compose\s+down\b.*(-v|--volumes)/,
];

// The only reset forms that read app/.env.local instead of app/.env (staging).
const LOCAL_RESET =
  /\b(make\s+db-reset|(yarn|npm\s+run|pnpm)\s+db:reset:local)\b/;
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
  "host.docker.internal",
]);

/** True only when app/.env.local exists and its DATABASE_URL points to a local host. Never prints the file. */
function localDatabaseIsLocal() {
  try {
    const envLocal = fs.readFileSync(path.join(APP_DIR, ".env.local"), "utf8");
    const line = envLocal
      .split(/\r?\n/)
      .find((l) => /^\s*DATABASE_URL\s*=/.test(l));
    if (!line) return false;
    const value = line
      .replace(/^\s*DATABASE_URL\s*=\s*/, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

// Prisma commands load app/.env (staging) through prisma.config.ts unless the call is
// wrapped in `dotenv -e .env.local` or `.env.test`. `migrate dev` may offer a reset on
// drift, so it is denied outright; deploy and seed are the documented manual staging
// procedure and only ask.
const ENV_OVERRIDE = /\bdotenv\s+-e\s+\.env\.(local|test)\b/;
const PRISMA_MIGRATE_DEV =
  /\b(prisma\s+migrate\s+dev\b|(yarn|npm\s+run|pnpm)\s+prisma:migrate(?![:\w]))/;
const PRISMA_STAGING_WRITE =
  /\b(prisma\s+(migrate\s+deploy|db\s+(seed|push|execute))\b|(yarn|npm\s+run|pnpm)\s+prisma:deploy(?![:\w]))/;

const CONFIRM = [
  /\b(npm|yarn|pnpm)\s+publish\b/,
  /\b(gh|git)\s+release\b/,
  /\bterraform\s+(apply|destroy)\b/,
  /\bdocker\s+push\b/,
  /\bgit\s+push\b/,
];

readStdin().then((raw) => {
  const ctx = normalize(raw);
  if (!ctx.ok)
    deny(
      ctx,
      "Blocked: invalid shell hook payload.",
      "The shell gate could not parse the payload; command denied.",
    );

  const command = ctx.command;

  if (SECRET_READ.some((re) => re.test(command))) {
    deny(
      ctx,
      "Blocked: shell read of a secret-bearing file.",
      "app/.env is staging and real env files never enter the agent context. Read .env.local.example instead or ask the user for the value. Do not retry with another tool.",
    );
  }

  if (LOCAL_RESET.test(command)) {
    if (!localDatabaseIsLocal()) {
      deny(
        ctx,
        "Blocked: app/.env.local is missing or its DATABASE_URL is not a local host.",
        "make db-reset only runs against a local Postgres. Ask the user to fix app/.env.local (run make env) before retrying.",
      );
    }
    ask(
      ctx,
      "Confirm: this drops and recreates the LOCAL database.",
      "Wait for the user to confirm the local reset.",
    );
  }

  if (DB_RESET.some((re) => re.test(command))) {
    deny(
      ctx,
      "Blocked: database reset or drop is manual-only.",
      "Never run prisma:reset, prisma migrate reset, db push --force-reset, DROP or TRUNCATE. Tell the user which command to run and let them run it. Do not retry.",
    );
  }

  if (!ENV_OVERRIDE.test(command)) {
    if (PRISMA_MIGRATE_DEV.test(command)) {
      deny(
        ctx,
        "Blocked: prisma migrate dev would read app/.env (staging).",
        "Create and apply dev migrations only against the local database: run `yarn prisma:migrate:local` from app/. Do not retry the bare form.",
      );
    }
    if (PRISMA_STAGING_WRITE.test(command)) {
      ask(
        ctx,
        "Confirm: this Prisma command reads app/.env (staging), not the local database.",
        "prisma migrate deploy and db seed without `dotenv -e .env.local` run against staging. Wait for the user to confirm, or use `yarn db:local` for the local database.",
      );
    }
  }

  if (DESTRUCTIVE.some((re) => re.test(command))) {
    deny(
      ctx,
      "Blocked: destructive or irreversible shell command.",
      "The shell gate denied this command. Use a safer alternative or ask the user to run it manually.",
    );
  }

  if (CONFIRM.some((re) => re.test(command))) {
    ask(
      ctx,
      "Confirm: this command publishes, deploys or pushes.",
      "Wait for the user's confirmation before running it.",
    );
  }

  allow(ctx);
});
