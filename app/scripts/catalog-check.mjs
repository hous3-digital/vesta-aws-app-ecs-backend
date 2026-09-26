#!/usr/bin/env node
/**
 * Keeps docs/__test__/cenarios.md honest: every CT id automated under __tests__ must have a
 * row whose "Hoje" column is not "—". Part of `yarn lint` through `yarn harness:test`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TESTS_DIR = new URL("../__tests__", import.meta.url).pathname;
const CATALOG = new URL("../docs/__test__/cenarios.md", import.meta.url).pathname;

function specFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? specFiles(full) : full.endsWith(".ts") ? [full] : [];
  });
}

const automated = new Set();
for (const file of specFiles(TESTS_DIR)) {
  for (const id of readFileSync(file, "utf8").match(/CT-VESTA-[A-Z]+-\d{3}/g) ?? []) automated.add(id);
}

const rows = new Map();
for (const line of readFileSync(CATALOG, "utf8").split("\n")) {
  const match = /^\| ([A-Z]+-\d{3}) /.exec(line);
  if (!match) continue;
  const cells = line.split("|");
  rows.set(`CT-VESTA-${match[1]}`, cells[cells.length - 2].trim());
}

const problems = [];
for (const id of [...automated].sort()) {
  const today = rows.get(id);
  if (today === undefined) problems.push(`${id} is automated but has no row in cenarios.md`);
  else if (today === "—") problems.push(`${id} is automated but its "Hoje" column still says —`);
}

if (problems.length) {
  console.error(`catalog check: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`catalog check: ${automated.size} automated CT ids all present in cenarios.md`);
