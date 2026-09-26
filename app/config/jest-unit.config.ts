import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "..",
  roots: ["<rootDir>/src", "<rootDir>/__tests__"],
  testMatch: ["<rootDir>/__tests__/@unit/**/*.spec.ts", "<rootDir>/__tests__/@unit/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          target: "ES2021",
          isolatedModules: true,
        },
      },
    ],
    "^.+\\.js$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          target: "ES2021",
          isolatedModules: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@prisma/client$": "<rootDir>/src/infra/database/@prisma/generated/client",
    "^@src/(.*)$": "<rootDir>/src/$1",
    "^@test/(.*)$": "<rootDir>/__tests__/$1",
  },
  collectCoverageFrom: ["src/**/domain/**/*.ts", "!src/**/*.d.ts", "!src/**/*.spec.ts", "!src/**/*.test.ts"],
  // Floor of the domain coverage measured on 2026-09-25; only goes up, one task at a time.
  coverageThreshold: { global: { statements: 83, branches: 96, functions: 68, lines: 82 } },
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  setupFilesAfterEnv: ["<rootDir>/config/test-setup.ts"],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  transformIgnorePatterns: ["node_modules/(?!@faker-js)"],
};
export default config;
