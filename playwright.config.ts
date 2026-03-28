import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { PLAYWRIGHT_AUTH_SECRET, PLAYWRIGHT_E2E_DB } from './tests/e2e/playwright-test-env.js';

// Dedicated port so `bun run dev` on 5173 does not get reused without Playwright env (DATABASE_PATH / AUTH_SECRET).
const port = process.env.PLAYWRIGHT_PORT ?? '5174';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: fileURLToPath(new URL('./tests/e2e/global-setup.ts', import.meta.url)),
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL,
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `bun run dev -- --port ${port}`,
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
			SUPPRESS_AUTH_CREDENTIALS_ERROR_LOG: '1'
		}
	}
});
