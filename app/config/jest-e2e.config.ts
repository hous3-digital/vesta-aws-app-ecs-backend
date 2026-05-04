import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "..",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["<rootDir>/__tests__/@e2e/**/*.spec.ts", "<rootDir>/__tests__/@e2e/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: { module: "commonjs", target: "ES2021", isolatedModules: true } }],
    "^.+\\.js$": ["ts-jest", { tsconfig: { module: "commonjs", target: "ES2021", isolatedModules: true } }],
  },
  moduleNameMapper: {
    "^@prisma/client$": "<rootDir>/src/infra/database/@prisma/generated/client",
    "^@src/(.*)$": "<rootDir>/src/$1",
    "^@core/(.*)$": "<rootDir>/src/modules/$1",
    "^@supporting/(.*)$": "<rootDir>/src/supporting/$1",
    "^@generic/(.*)$": "<rootDir>/src/generic/$1",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@providers/(.*)$": "<rootDir>/src/providers/$1",
    "^@infra/(.*)$": "<rootDir>/src/infra/$1",
    "^@test/(.*)$": "<rootDir>/__tests__/$1",
    "^@artifacts/(.*)$": "<rootDir>/artifacts/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/config/test-setup.ts"],
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  transformIgnorePatterns: ["node_modules/(?!@faker-js)"],
};

export default config;
