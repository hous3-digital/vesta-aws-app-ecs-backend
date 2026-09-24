#!/usr/bin/env node
"use strict";

/**
 * Feedback sensor: after every edit, format the file with Prettier and, for TypeScript
 * under app/src or app/__tests__, run ESLint with autofix. Unfixable lint errors are
 * reported back to the agent (Claude Code reads stderr on exit 2; Cursor's afterFileEdit
 * has no feedback channel, so it only formats). Fail open: tooling problems never block.
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

function bin(name) {
  const file = path.join(APP_DIR, "node_modules", ".bin", name);
  return fs.existsSync(file) ? file : null;
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

  if (result.status === 0 || result.status === null) process.exit(0);

  const output = (result.stdout || "").trim() || (result.stderr || "").trim();
  feedback(
    ctx,
    `ESLint found problems that autofix could not solve in ${relToApp}. Fix them at the source, never with eslint-disable:\n${output}\n`,
  );
});
