#!/usr/bin/env node
"use strict";

/**
 * Self-test for the hook sensors. Feeds every hook the payload shape of both agents
 * (Cursor: fields at the root next to workspace_roots; Claude Code: fields under
 * tool_input) and asserts the decision. Runs as part of `yarn lint` so a detection
 * regression fails the gate instead of silently allowing everything.
 *
 * Usage: node .cursor/hooks/selftest.js
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const HOOKS_DIR = __dirname;
const REPO_ROOT = path.resolve(HOOKS_DIR, "..", "..");

function cursorPayload(event, fields) {
  return {
    conversation_id: "selftest",
    generation_id: "selftest",
    hook_event_name: event,
    workspace_roots: [REPO_ROOT],
    ...fields,
  };
}

function claudePayload(event, toolName, fields) {
  return {
    session_id: "selftest",
    cwd: REPO_ROOT,
    hook_event_name: event,
    tool_name: toolName,
    tool_input: fields,
  };
}

function run(script, payload) {
  const result = spawnSync("node", [path.join(HOOKS_DIR, script)], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  return {
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

/** Reads the decision the agent would see: "allow" | "deny" | "ask". */
function decisionOf(agent, output) {
  if (!output.stdout) return agent === "claude" ? "allow" : "none";
  let json;
  try {
    json = JSON.parse(output.stdout);
  } catch {
    return `invalid-json(${output.stdout.slice(0, 40)})`;
  }
  if (agent === "claude") {
    return json.hookSpecificOutput
      ? json.hookSpecificOutput.permissionDecision
      : "allow";
  }
  return json.permission || "none";
}

// Commands are assembled from parts so this file never contains a literal secret read.
const ENV = "app/.env";
const SHELL_CASES = [
  [`cat ${ENV}`, "deny"],
  ["cat .env", "deny"],
  [`grep DATABASE_URL ${ENV}.local`, "deny"],
  [`sed -n 1,5p ${ENV}.test`, "deny"],
  [`source ${ENV} && yarn dev`, "deny"],
  ["printenv", "deny"],
  [`cat ${ENV}.local.example`, "allow"],
  ["yarn prisma:reset", "deny"],
  ["npx prisma migrate reset --force", "deny"],
  ["psql -c 'DROP DATABASE vesta'", "deny"],
  ["yarn prisma:migrate", "deny"],
  ["npx prisma migrate dev --name add_column", "deny"],
  ["yarn prisma:migrate:local", "allow"],
  ["yarn prisma:deploy", "ask"],
  ["npx prisma db seed", "ask"],
  ["dotenv -e .env.local -- npx prisma migrate deploy", "allow"],
  ["dotenv -e .env.test -- npx prisma db seed", "allow"],
  ["yarn db:local", "allow"],
  ["git push --force origin main", "deny"],
  ["git push origin chore/agent-harness", "ask"],
  ["rm -rf /", "deny"],
  ["yarn test:unit", "allow"],
  ["git status", "allow"],
];

const READ_CASES = [
  [ENV, "deny"],
  [`${ENV}.local`, "deny"],
  [`${ENV}.test`, "deny"],
  [`${ENV}.local.example`, "allow"],
  [`${ENV}.test.example`, "allow"],
  [path.join(process.env.HOME || "/home/x", ".ssh/id_rsa"), "deny"],
  ["app/zk-artifacts/vesta_kyc.zkey", "deny"],
  ["app/src/main.ts", "allow"],
  ["AGENTS.md", "allow"],
];

const failures = [];
function check(label, expected, actual) {
  if (expected !== actual)
    failures.push(`${label}: expected ${expected}, got ${actual}`);
}

for (const [command, expected] of SHELL_CASES) {
  const cursor = run(
    "guard-shell.js",
    cursorPayload("beforeShellExecution", { command, cwd: REPO_ROOT }),
  );
  check(`cursor shell "${command}"`, expected, decisionOf("cursor", cursor));
  const claude = run(
    "guard-shell.js",
    claudePayload("PreToolUse", "Bash", { command }),
  );
  check(`claude shell "${command}"`, expected, decisionOf("claude", claude));
}

for (const [file, expected] of READ_CASES) {
  const absolute = path.isAbsolute(file) ? file : path.join(REPO_ROOT, file);
  const cursor = run(
    "guard-secrets.js",
    cursorPayload("beforeReadFile", { file_path: absolute, content: "" }),
  );
  check(`cursor read "${file}"`, expected, decisionOf("cursor", cursor));
  const claude = run(
    "guard-secrets.js",
    claudePayload("PreToolUse", "Read", { file_path: absolute }),
  );
  check(`claude read "${file}"`, expected, decisionOf("claude", claude));
}

// A malformed payload must fail closed on both gates.
for (const script of ["guard-shell.js", "guard-secrets.js"]) {
  const out = run(script, "not json");
  check(`${script} malformed payload`, "deny", decisionOf("cursor", out));
}

// format-on-edit must find the file path in both shapes and actually format it.
const tmp = path.join(HOOKS_DIR, ".selftest-tmp.json");
for (const agent of ["cursor", "claude"]) {
  fs.writeFileSync(tmp, '{"a":1,\n   "b":   [1,2]}\n');
  const payload =
    agent === "cursor"
      ? cursorPayload("afterFileEdit", { file_path: tmp, edits: [] })
      : claudePayload("PostToolUse", "Edit", {
          file_path: tmp,
          old_string: "",
          new_string: "",
        });
  run("format-on-edit.js", payload);
  const formatted = fs.readFileSync(tmp, "utf8");
  check(`${agent} format-on-edit`, '{ "a": 1, "b": [1, 2] }\n', formatted);
}
fs.rmSync(tmp, { force: true });

// For TypeScript under app/, format-on-edit also runs ESLint and reports what autofix
// could not solve: Claude Code reads stderr on exit 2, Cursor has no feedback channel.
const tmpTs = path.join(
  REPO_ROOT,
  "app",
  "__tests__",
  "helpers",
  ".selftest-tmp.ts",
);
try {
  fs.writeFileSync(
    tmpTs,
    'import { join } from "../constants";\nexport const unused = join;\n',
  );
  const out = run(
    "format-on-edit.js",
    claudePayload("PostToolUse", "Edit", {
      file_path: tmpTs,
      old_string: "",
      new_string: "",
    }),
  );
  check("claude format-on-edit eslint feedback exit code", 2, out.status);
  check(
    "claude format-on-edit eslint feedback names the rule",
    true,
    /no-restricted-imports/.test(out.stderr),
  );
  const cursorOut = run(
    "format-on-edit.js",
    cursorPayload("afterFileEdit", { file_path: tmpTs, edits: [] }),
  );
  check("cursor format-on-edit stays silent", 0, cursorOut.status);
} finally {
  fs.rmSync(tmpTs, { force: true });
}

// After lint, format-on-edit runs the spec related to the edited file (same basename under
// __tests__/@unit or @integration) and feeds a failure back to Claude Code. Cursor's
// afterFileEdit has no feedback channel, so there the sensor stays silent.
const tmpSrc = path.join(REPO_ROOT, "app", "src", "selftest-sensor-tmp.ts");
const tmpSpec = path.join(
  REPO_ROOT,
  "app",
  "__tests__",
  "@unit",
  "selftest-sensor-tmp.spec.ts",
);
try {
  fs.writeFileSync(tmpSrc, "export const sensorProbe = 1;\n");
  fs.writeFileSync(
    tmpSpec,
    'describe("sensor", () => {\n  it("fails on purpose", () => {\n    expect(1).toBe(2);\n  });\n});\n',
  );
  const out = run(
    "format-on-edit.js",
    claudePayload("PostToolUse", "Edit", {
      file_path: tmpSrc,
      old_string: "",
      new_string: "",
    }),
  );
  check("claude format-on-edit related spec exit code", 2, out.status);
  check(
    "claude format-on-edit related spec names the failing test",
    true,
    /selftest-sensor-tmp\.spec\.ts[\s\S]*fails on purpose/.test(out.stderr),
  );
  const cursorOut = run(
    "format-on-edit.js",
    cursorPayload("afterFileEdit", { file_path: tmpSrc, edits: [] }),
  );
  check("cursor format-on-edit related spec stays silent", 0, cursorOut.status);
} finally {
  fs.rmSync(tmpSrc, { force: true });
  fs.rmSync(tmpSpec, { force: true });
}

const total = SHELL_CASES.length * 2 + READ_CASES.length * 2 + 4 + 3 + 3;
if (failures.length) {
  console.error(`hooks selftest: ${failures.length} of ${total} checks failed`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `hooks selftest: ${total} checks passed (cursor + claude payloads)`,
);
