import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { PLAYWRIGHT_AUTH_SECRET, PLAYWRIGHT_E2E_DB } from './tests/e2e/playwright-test-env.js';

// Dedicated port so `bun run dev` on 5173 does not get reused without Playwright env (DATABASE_PATH / AUTH_SECRET).
const port = process.env.PLAYWRIGHT_PORT ?? '5174';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

const isLoadMode = process.env.PLAYWRIGHT_LOAD_MODE === '1';
// Load mode runs a separate suite; uses many workers. Cap to avoid host meltdown.
const loadWorkers = Math.min(
	Math.max(Number.parseInt(process.env.PLAYWRIGHT_LOAD_WORKERS ?? '8', 10) || 8, 1),
	64
);

export default defineConfig({
	testDir: isLoadMode ? 'tests/e2e/load' : 'tests/e2e',
	testIgnore: isLoadMode ? [] : ['**/load/**'],
	globalSetup: fileURLToPath(new URL('./tests/e2e/global-setup.ts', import.meta.url)),
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: isLoadMode ? loadWorkers : process.env.CI ? 1 : undefined,
	timeout: isLoadMode ? 5 * 60_000 : 30_000,
	reporter: isLoadMode ? [['list'], ['json', { outputFile: 'loadtest_results/playwright-report.json' }]] : 'html',
	use: {
		baseURL,
		trace: isLoadMode ? 'off' : 'on-first-retry',
		video: 'off',
		screenshot: 'off'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `npm run dev -- --port ${port}`,
		url: baseURL,
		// Must spawn with webServer.env so E2E DB + AUTH_SECRET match globalSetup.
		reuseExistingServer: false,
		env: {
			...process.env,
			DATABASE_PATH: PLAYWRIGHT_E2E_DB,
			AUTH_SECRET: PLAYWRIGHT_AUTH_SECRET,
			APP_BASE_URL: baseURL,
			AUTH_TRUST_HOST: 'true',
			// auth.spec.ts intentionally triggers failed credential sign-in; avoid scary server logs.
			SUPPRESS_AUTH_CREDENTIALS_ERROR_LOG: '1',
			// Forwarded so global-setup seeds load-test users when set.
			LOAD_TEST_SEED_USERS: process.env.LOAD_TEST_SEED_USERS ?? ''
		}
	}
});
