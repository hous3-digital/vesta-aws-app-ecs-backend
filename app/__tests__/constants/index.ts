/** Values from src/infra/database/seeds/local-fixtures.sql, loaded by yarn test:e2e. */
export const FIXTURE_ISSUER_ID = "issuer_local_dev";
export const FIXTURE_ISSUER_EXTERNAL_ID = "local_bank";
export const FIXTURE_API_KEY = "vesta_live_local_dev_do_not_use_in_production";
export const FIXTURE_BACKOFFICE_EMAIL = "dev@localhost";
export const FIXTURE_BACKOFFICE_PASSWORD = "vesta_local";
export const FIXTURE_VERIFIER_ID = "verifier_local";

/** Origin the e2e app allows in CORS (createTestApp); a neutral example, never a deployed domain. */
export const E2E_CORS_ORIGIN = "https://backoffice.example.com";
