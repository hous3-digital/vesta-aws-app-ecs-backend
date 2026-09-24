#!/usr/bin/env node
"use strict";

/**
 * Gate hook: keep real secrets out of model context.
 * Blocks .env files (except templates) and key material. Fail closed.
 */

const path = require("path");
const { readStdin, normalize, allow, deny } = require("./lib/agent");

const TEMPLATE = /\.(example|sample|template)$/i;
const ENV_FILE = /^\.env($|\.)/i;
const KEY_LIKE =
  /(^|\/)(id_rsa|id_ed25519|id_ecdsa|.*\.(pem|p12|pfx|key|zkey)|credentials\.json|service-account.*\.json|\.npmrc|\.netrc)$/i;

readStdin().then((raw) => {
  const ctx = normalize(raw);
  if (!ctx.ok)
    deny(
      ctx,
      "Blocked: invalid read hook payload.",
      "The secrets gate could not parse the payload; read denied.",
    );

  const base = path.basename(ctx.filePath);
  const isEnv = ENV_FILE.test(base) && !TEMPLATE.test(base);
  const isKey = KEY_LIKE.test(ctx.filePath);

  if (isEnv || isKey) {
    deny(
      ctx,
      `Blocked read of secret-bearing file: ${base}.`,
      "Real env files and key material never enter the agent context. Use .env.local.example as the template and ask the user for any value you need. Do not retry with cat, sed or another tool.",
    );
  }

  allow(ctx);
});
