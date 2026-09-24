#!/usr/bin/env node
"use strict";

/**
 * Agent-agnostic adapter for hook scripts.
 *
 * Cursor sends { hook_event_name, workspace_roots, file_path | command, ... } and
 * expects a JSON decision on stdout: { permission: "allow" | "deny" | "ask" }.
 *
 * Claude Code sends { hook_event_name, tool_name, tool_input: { file_path | command } }
 * and expects either nothing (allow) or a JSON decision on stdout:
 * { hookSpecificOutput: { hookEventName, permissionDecision, permissionDecisionReason } }.
 * For post-edit feedback it reads stderr when the script exits with code 2.
 *
 * `node .cursor/hooks/selftest.js` feeds both payload shapes to every hook and is
 * part of `yarn lint`, so a detection regression fails the gate instead of silently
 * allowing everything.
 */

const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const APP_DIR = path.join(REPO_ROOT, "app");

function readStdin() {
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
    process.stdin.resume();
  });
}

function normalize(raw) {
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return { ok: false, agent: "unknown", filePath: "", command: "" };
  }

  // Both agents send hook_event_name. Only Claude Code wraps the tool arguments
  // in tool_input; Cursor puts file_path / command at the root next to workspace_roots.
  const isClaude =
    payload.tool_input !== null && typeof payload.tool_input === "object";
  const source = isClaude ? payload.tool_input : payload;

  return {
    ok: true,
    agent: isClaude ? "claude" : "cursor",
    event: payload.hook_event_name || "",
    filePath: source.file_path || "",
    command: source.command || "",
  };
}

function allow(ctx) {
  if (ctx.agent === "cursor")
    process.stdout.write(JSON.stringify({ permission: "allow" }));
  process.exit(0);
}

function deny(ctx, userMessage, agentMessage) {
  if (ctx.agent === "claude") {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `${userMessage} ${agentMessage}`,
        },
      }),
    );
    process.exit(0);
  }
  process.stdout.write(
    JSON.stringify({
      permission: "deny",
      user_message: userMessage,
      agent_message: agentMessage,
    }),
  );
  process.exit(0);
}

function ask(ctx, userMessage, agentMessage) {
  if (ctx.agent === "claude") {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: `${userMessage} ${agentMessage}`,
        },
      }),
    );
    process.exit(0);
  }
  process.stdout.write(
    JSON.stringify({
      permission: "ask",
      user_message: userMessage,
      agent_message: agentMessage,
    }),
  );
  process.exit(0);
}

/** Post-action feedback. Claude reads stderr on exit 2; Cursor's afterFileEdit is fire-and-forget. */
function feedback(ctx, message) {
  if (ctx.agent === "claude") {
    process.stderr.write(message);
    process.exit(2);
  }
  process.exit(0);
}

module.exports = {
  REPO_ROOT,
  APP_DIR,
  readStdin,
  normalize,
  allow,
  deny,
  ask,
  feedback,
};
