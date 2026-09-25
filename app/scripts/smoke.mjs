#!/usr/bin/env node
// Vesta local smoke: health -> backoffice login -> issue -> verify -> challenge -> prepare (real ZK) -> submit (mocked Stellar).
// Uses the fixtures from src/infra/database/seeds/local-fixtures.sql. Needs neither Privy nor a real contract.
//   BASE_URL=http://localhost:3000 API_KEY=... node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const API_KEY = process.env.API_KEY ?? "vesta_live_local_dev_do_not_use_in_production";
const BO_EMAIL = process.env.BO_EMAIL ?? "dev@localhost";
const BO_PASSWORD = process.env.BO_PASSWORD ?? "vesta_local";
const VERIFIER_ID = process.env.VERIFIER_ID ?? "verifier_local";

const steps = [];
let failed = false;

function randomValidCpf() {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (nums, start) => {
    const sum = nums.reduce((acc, n, i) => acc + n * (start - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(d, 10));
  d.push(dv(d, 11));
  return d.join("");
}

async function call(name, path, { method = "GET", body, headers = {} } = {}) {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  // ApiTransformInterceptor wraps every successful response in { data: ... }
  if (json && typeof json === "object" && "data" in json && Object.keys(json).length === 1) json = json.data;
  return { res, json, ms: Date.now() - started, name };
}

function record(name, ok, detail) {
  steps.push({ name, ok, detail });
  if (!ok) failed = true;
  console.log(`${ok ? "OK " : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function main() {
  console.log(`smoke -> ${BASE_URL}\n`);

  const health = await call("health", "/health");
  record(
    "GET /health",
    health.res.status === 200 && health.json?.status === "ok",
    `${health.res.status} ${health.ms}ms`,
  );
  if (health.res.status !== 200) return;

  const login = await call("login", "/backoffice/auth/login", {
    method: "POST",
    body: { email: BO_EMAIL, password: BO_PASSWORD },
  });
  const token = login.json?.accessToken ?? login.json?.token ?? login.json?.access_token;
  record("POST /backoffice/auth/login", login.res.status < 300 && !!token, `${login.res.status}`);

  if (token) {
    const me = await call("me", "/backoffice/auth/me", { headers: { authorization: `Bearer ${token}` } });
    record("GET /backoffice/auth/me", me.res.status === 200, `${me.res.status} ${me.json?.user?.email ?? ""}`);
  }

  const apiKey = { "x-api-key": API_KEY };
  const cpf = randomValidCpf();
  const person = { cpf, fullName: "Smoke Local", birthDate: "1990-05-20" };

  const issue = await call("issue", "/public/credential", {
    method: "POST",
    headers: apiKey,
    body: { ...person, kycLevel: "complete", kycMethod: "document_ocr" },
  });
  record(
    "POST /public/credential (issue)",
    issue.res.status < 300 && !!issue.json?.vcHash,
    `${issue.res.status} vcHash=${String(issue.json?.vcHash ?? "").slice(0, 12)}`,
  );
  if (!issue.json?.vcHash) return finish();

  const verify = await call("verify", "/public/credential/verify", {
    method: "POST",
    headers: apiKey,
    body: { vcHash: issue.json.vcHash },
  });
  record(
    "POST /public/credential/verify",
    verify.res.status < 300,
    `${verify.res.status} status=${verify.json?.status ?? verify.json?.valid}`,
  );

  const challenge = await call("challenge", "/public/auth/challenge", { headers: apiKey });
  record(
    "GET /public/auth/challenge",
    challenge.res.status === 200 && !!challenge.json?.challenge,
    `${challenge.res.status}`,
  );
  if (!challenge.json?.challenge) return finish();

  const prepare = await call("prepare", "/public/proof/prepare", {
    method: "POST",
    headers: apiKey,
    body: {
      vc: issue.json.vc,
      privateInputs: { cpf, birthDate: "19900520", fullName: person.fullName },
      verifierId: VERIFIER_ID,
      minKycLevel: 1,
      challenge: challenge.json.challenge,
    },
  });
  record(
    "POST /public/proof/prepare (ZK)",
    prepare.res.status < 300 && !!prepare.json?.prepareSessionId,
    `${prepare.res.status} ${prepare.ms}ms zkMock=${prepare.json?.zkProof?.mock}${prepare.res.status >= 300 ? " " + JSON.stringify(prepare.json).slice(0, 200) : ""}`,
  );
  if (!prepare.json?.prepareSessionId) return finish();

  const submit = await call("submit", "/public/proof/submit-signed", {
    method: "POST",
    headers: apiKey,
    body: { prepareSessionId: prepare.json.prepareSessionId, signedTxXdr: prepare.json.unsignedTxXdr },
  });
  record(
    "POST /public/proof/submit-signed (Stellar mock)",
    submit.res.status < 300 && !!submit.json?.attestation?.id,
    `${submit.res.status} stellarMock=${submit.json?.stellar?.mock}${submit.res.status >= 300 ? " " + JSON.stringify(submit.json).slice(0, 200) : ""}`,
  );

  finish();
}

function finish() {
  const ok = steps.filter((s) => s.ok).length;
  console.log(`\n${ok}/${steps.length} steps OK`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("smoke aborted:", err.message);
  process.exit(1);
});
