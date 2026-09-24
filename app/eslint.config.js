// @ts-nocheck
const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
// @ts-ignore - parser types resolution issue
const tsparser = require("@typescript-eslint/parser");
const unusedImports = require("eslint-plugin-unused-imports");

const RELATIVE_IMPORTS = {
  group: ["../*", "./*"],
  message: "Use absolute imports with @src/ or @test/ instead of relative imports.",
};

const CHAIN_SDK = {
  name: "@stellar/stellar-sdk",
  message:
    "The chain SDK is imported only inside the adapter (src/modules/stellar, src/infra/gateways/chain). Talk to the chain through a port interface (AGENTS.md rule 2).",
};

const CHAIN_SDK_ALLOWLIST = [
  "src/modules/stellar/**",
  "src/infra/gateways/chain/**",
  // Specs of pure chain codecs and builders exercise SDK types by design.
  "__tests__/@unit/codecs/**",
  "__tests__/@unit/builders/**",
  // Legacy offenders, removed one by one as the chain boundary moves (tech-debt.md, F3).
  "src/modules/commission/soroban-commission-registration.gateway.ts",
  "src/modules/commission/soroban-payout-settlement.gateway.ts",
  "src/modules/issuer/domain/issuer-did.value-object.ts",
  "src/modules/issuer/soroban-issuer-registry.gateway.ts",
  "src/modules/wallet/wallet.service.ts",
  "src/scripts/deploy-payout-vault.ts",
  "__tests__/@integration/controllers/admin-issuers.controller.spec.ts",
  "__tests__/@integration/services/wallet.service.spec.ts",
];

/** @type {Array<import('eslint').Linter.Config>} */
module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 12,
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        URLSearchParams: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        structuredClone: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "unused-imports": unusedImports,
    },
    rules: {
      "prefer-const": "error",
      "no-var": "error",
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "off",
      "no-empty-pattern": "off",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-restricted-imports": ["error", { patterns: [RELATIVE_IMPORTS], paths: [CHAIN_SDK] }],
    },
  },
  {
    // AGENTS.md rule 2: the chain SDK lives only inside the adapter. This allowlist is the
    // legacy map for the chain boundary (tech-debt.md, F3) and only shrinks: a file leaves
    // it when its chain calls move behind a port, and no file is ever added.
    files: CHAIN_SDK_ALLOWLIST,
    rules: {
      "no-restricted-imports": ["error", { patterns: [RELATIVE_IMPORTS] }],
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.js"],
  },
];
