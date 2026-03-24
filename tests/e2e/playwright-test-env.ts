import path from 'node:path';

/** Dedicated SQLite file for Playwright (must match `webServer.env.DATABASE_PATH`). */
export const PLAYWRIGHT_E2E_DB = path.join(process.cwd(), '.tmp', 'playwright-e2e.db');

export const PLAYWRIGHT_AUTH_SECRET = 'playwright-e2e-auth-secret-at-least-32-characters-long';

export const E2E_USER_EMAIL = 'e2e@postplan.test';
export const E2E_USER_PASSWORD = 'TestPassw0rd!';
