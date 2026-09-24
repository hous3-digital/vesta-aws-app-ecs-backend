/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["build", "chore", "ci", "docs", "feat", "fix", "perf", "refactor", "revert", "style", "test"],
    ],
    "header-max-length": [2, "always", 100],
    "subject-min-length": [2, "always", 15],
    "body-max-line-length": [1, "always", 100],
  },
};
