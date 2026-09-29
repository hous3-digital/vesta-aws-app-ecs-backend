#!/usr/bin/env node
/**
 * Compares the variables the app validates (src/infra/env/env.schema.ts) with what each
 * deployed environment actually receives (infra/terraform/envs/{staging,prod}/variables.tfvars).
 * No AWS access needed: it reads the repo only. Part of `yarn deploy:check`.
 *
 * Errors (exit 1): a required variable missing from an environment; a name declared twice.
 * Warnings: a tfvars name the schema does not know (dead variable), an optional variable
 * left to its default.
 *
 * Usage: node scripts/env-diff.mjs [staging|prod]
 */
import { readFileSync } from "node:fs";

const APP_ROOT = new URL("..", import.meta.url).pathname;
const SCHEMA = `${APP_ROOT}src/infra/env/env.schema.ts`;
const ENVS = process.argv[2] ? [process.argv[2]] : ["staging", "prod"];

function schemaVariables() {
  const source = readFileSync(SCHEMA, "utf8");
  const body = source.slice(source.indexOf("z.object({"), source.lastIndexOf("});"));
  const entries = body.split(/\n(?=  [A-Z_]+: )/).slice(1);
  return entries.map((entry) => {
    const name = /^  ([A-Z_]+):/.exec(entry)[1];
    const required = !/\.optional\(|\.default\(/.test(entry);
    return { name, required };
  });
}

function tfvarsVariables(env) {
  const source = readFileSync(`${APP_ROOT}../infra/terraform/envs/${env}/variables.tfvars`, "utf8");
  const declared = [];
  let section = "root";
  for (const line of source.split("\n")) {
    const header = /^(environment|secrets)\s*=\s*\[/.exec(line);
    if (header) section = header[1];
    const named = /^\s*name\s*=\s*"([A-Z_]+)"/.exec(line);
    if (named) declared.push({ name: named[1], section });
    const privy = /^\s*(private_key|key_id)\s*=\s*"([A-Z_]+)"/.exec(line);
    if (privy) declared.push({ name: privy[2], section: "privy_custom_auth_secret_names" });
  }
  const nodeEnv = /name\s*=\s*"NODE_ENV",\s*\n\s*value\s*=\s*"([^"]+)"/.exec(source)?.[1] ?? "(not set)";
  return { declared, nodeEnv };
}

const schema = schemaVariables();
let errors = 0;

for (const env of ENVS) {
  const { declared, nodeEnv } = tfvarsVariables(env);
  const names = new Map();
  for (const { name, section } of declared) names.set(name, [...(names.get(name) ?? []), section]);

  console.log(`\n${env} (NODE_ENV=${nodeEnv})`);

  for (const { name, required } of schema) {
    if (names.has(name)) continue;
    if (required) {
      errors++;
      console.log(`  ERROR  ${name} is required by env.schema.ts and absent from ${env}`);
    } else {
      console.log(`  info   ${name} not set, app uses its default`);
    }
  }
  for (const [name, sections] of names) {
    if (sections.length > 1) {
      errors++;
      console.log(
        `  ERROR  ${name} declared twice (${sections.join(", ")}); decide which one wins and remove the other`,
      );
    }
    if (!schema.some((v) => v.name === name)) {
      console.log(`  warn   ${name} is set in ${env} but env.schema.ts does not read it`);
    }
  }
}

console.log(errors ? `\nenv diff: ${errors} error(s)` : "\nenv diff: no errors");
process.exit(errors ? 1 : 0);
