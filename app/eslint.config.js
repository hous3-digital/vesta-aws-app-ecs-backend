// @ts-nocheck
const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
// @ts-ignore - parser types resolution issue
const tsparser = require("@typescript-eslint/parser");
const unusedImports = require("eslint-plugin-unused-imports");

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
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "./*"],
              message: "Use imports absolutos com @src/ ou @artifacts/ ao invés de imports relativos.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.js"],
  },
];
