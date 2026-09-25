#!/usr/bin/env node
"use strict";

/**
 * Feedback sensor: after every edit, format the file with Prettier and, for TypeScript
 * under app/src or app/__tests__, run ESLint with autofix and then the spec related to
 * the file (same basename under __tests__/@unit or __tests__/@integration, with or
 * without the type suffix: credential.entity.ts -> credential.spec.ts,
 * wallet.service.ts -> wallet.service.spec.ts; a spec runs itself). Unfixable lint
 * errors and failing tests are reported back to the agent (Claude Code reads stderr on
 * exit 2; Cursor's afterFileEdit has no feedback channel, so it only formats and lints).
 * Fail open: tooling problems (jest missing, database down) never block.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  REPO_ROOT,
  APP_DIR,
  readStdin,
  normalize,
  feedback,
} = require("./lib/agent");

const FORMATTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdc|yml|yaml)$/i;
const LINTABLE = /\.ts$/i;
const IGNORED =
  /(^|\/)(node_modules|dist|coverage|target|@prisma\/generated|zk-artifacts)(\/|$)/;
const LAYERS = {
  "@unit": "config/jest-unit.config.ts",
  "@integration": "config/jest-integration.config.ts",
};
const MAX_REPORT = 4000;

function bin(name) {
  const file = path.join(APP_DIR, "node_modules", ".bin", name);
  return fs.existsSync(file) ? file : null;
}

function walk(dir, visit) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, visit);
    else visit(file);
  }
}

/** Specs to run for an edited file, grouped by layer, as paths relative to app/. */
function relatedSpecs(relToApp) {
  const own = relToApp.match(/^__tests__\/(@unit|@integration)\/.*\.spec\.ts$/);
  if (own) return { [own[1]]: [relToApp] };
  if (!/^src\//.test(relToApp)) return {};

  const base = path.basename(relToApp, ".ts");
  const stem = base.replace(/\.[^.]+$/, "");
  const names = new Set([`${base}.spec.ts`, `${stem}.spec.ts`]);
  const found = {};
  for (const layer of Object.keys(LAYERS)) {
    walk(path.join(APP_DIR, "__tests__", layer), (file) => {
      if (!names.has(path.basename(file))) return;
      (found[layer] ||= []).push(path.relative(APP_DIR, file));
    });
  }
  return found;
}

/** Runs the specs of one layer; returns the failure report, or null when green or when jest itself could not run. */
function runSpecs(jest, layer, specs) {
  const result = spawnSync(
    jest,
    ["--config", LAYERS[layer], "--silent", "--colors=false", ...specs],
    {
      cwd: APP_DIR,
      encoding: "utf8",
      env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
    },
  );
  if (result.status === 0 || result.status === null) return null;

  const output = `${result.stderr || ""}\n${result.stdout || ""}`;
  const failed = /Tests:\s+(\d+) failed/.test(output);
  const suiteBroken = /Test suite failed to run/.test(output);
  // A database or Redis that is down is a tooling problem, not the agent's edit.
  const infraDown = /ECONNREFUSED|Can't reach database server/.test(output);
  if ((!failed && !suiteBroken) || infraDown) return null;

  const trimmed = output.trim();
  return trimmed.length > MAX_REPORT
    ? `${trimmed.slice(0, MAX_REPORT)}\n[...]`
    : trimmed;
}

readStdin().then((raw) => {
  const ctx = normalize(raw);
  if (!ctx.ok || !ctx.filePath) process.exit(0);

  const filePath = path.resolve(REPO_ROOT, ctx.filePath);
  const inRepo = filePath.startsWith(REPO_ROOT + path.sep);
  if (
    !inRepo ||
    IGNORED.test(filePath) ||
    !FORMATTABLE.test(filePath) ||
    !fs.existsSync(filePath)
  )
    process.exit(0);

  const prettier = bin("prettier");
  if (prettier) {
    spawnSync(prettier, ["--write", "--log-level", "warn", filePath], {
      cwd: APP_DIR,
      stdio: "ignore",
    });
  }

  const relToApp = path.relative(APP_DIR, filePath);
  const lintable =
    LINTABLE.test(filePath) && /^(src|__tests__)\//.test(relToApp);
  const eslint = bin("eslint");
  if (!lintable || !eslint) process.exit(0);

  const result = spawnSync(eslint, ["--fix", "--no-warn-ignored", relToApp], {
    cwd: APP_DIR,
    encoding: "utf8",
  });

  if (result.status !== 0 && result.status !== null) {
    const output = (result.stdout || "").trim() || (result.stderr || "").trim();
    feedback(
      ctx,
      `ESLint found problems that autofix could not solve in ${relToApp}. Fix them at the source, never with eslint-disable:\n${output}\n`,
    );
  }

  // Related spec: only where the result can reach the agent.
  const jest = bin("jest");
  if (ctx.agent !== "claude" || !jest) process.exit(0);

  const reports = [];
  for (const [layer, specs] of Object.entries(relatedSpecs(relToApp))) {
    const report = runSpecs(jest, layer, specs);
    if (report) reports.push(`${layer}: ${specs.join(", ")}\n${report}`);
  }
  if (reports.length === 0) process.exit(0);

  feedback(
    ctx,
    `The spec related to ${relToApp} fails after this edit. Fix the code or the test at the source; never skip the test:\n${reports.join("\n\n")}\n`,
  );
});
