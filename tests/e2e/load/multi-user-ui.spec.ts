import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LOAD_TEST_USER_PASSWORD, buildLoadUserPool, readLoadRunConfig, thinkTime } from './load-test-env.js';
import { SCENARIOS, pickScenario, type ScenarioEvent } from './scenarios.js';

/**
 * Multi-user UI suite.
 *
 * Run with:
 *   PLAYWRIGHT_LOAD_MODE=1 LOAD_TEST_SEED_USERS=10 UI_USERS=10 npx playwright test
 *
 * For higher counts, also raise PLAYWRIGHT_LOAD_WORKERS (browser-level concurrency).
 *
 * Each test ("user N") logs in with its own seeded credentials, then performs
 * `UI_ITERATIONS` random scenarios drawn from the configured mix. Per-step
 * timings + ok/fail are appended to NDJSON in the run results dir.
 */

const cfg = readLoadRunConfig();
const userPool = buildLoadUserPool(cfg.uiUsers);

mkdirSync(cfg.resultsDir, { recursive: true });
const eventsFile = path.join(cfg.resultsDir, 'playwright-events.ndjson');
const summaryFile = path.join(cfg.resultsDir, 'playwright-summary.json');
const metaFile = path.join(cfg.resultsDir, 'run-metadata.json');

writeFileSync(
	metaFile,
	JSON.stringify(
		{
			run_id: cfg.runId,
			mode: 'ui-playwright',
			ui_users: cfg.uiUsers,
			max_ui_users: cfg.maxUiUsers,
			scenario_mix: cfg.scenarioMix,
			iterations_per_user: cfg.iterationsPerUser,
			think_time_ms: { min: cfg.thinkTimeMinMs, max: cfg.thinkTimeMaxMs },
			started_at: new Date().toISOString()
		},
		null,
		2
	)
);

const aggregate = {
	totalSteps: 0,
	failedSteps: 0,
	scenarioCounts: {} as Record<string, number>,
	scenarioFailures: {} as Record<string, number>,
	stepDurationsMs: [] as number[]
};

function recordEvent(event: ScenarioEvent & { persona: string }): void {
	const line = JSON.stringify({ ...event, run_id: cfg.runId, ts: new Date().toISOString() });
	appendFileSync(eventsFile, line + '\n');
	aggregate.totalSteps += 1;
	if (!event.ok) {
		aggregate.failedSteps += 1;
		aggregate.scenarioFailures[event.scenario] = (aggregate.scenarioFailures[event.scenario] ?? 0) + 1;
	}
	aggregate.scenarioCounts[event.scenario] = (aggregate.scenarioCounts[event.scenario] ?? 0) + 1;
	aggregate.stepDurationsMs.push(event.durationMs);
}

async function signIn(page: Page, email: string): Promise<void> {
	await page.goto('/auth/login');
	await page.getByLabel(/email/i).fill(email);
	await page.getByLabel(/^password$/i).fill(LOAD_TEST_USER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in with email' }).click();
	await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 30_000 });
}

test.describe.configure({ mode: 'parallel' });

for (let i = 0; i < userPool.length; i++) {
	const persona = userPool[i];
	test(`load user ${i} (${persona.email})`, async ({ page }) => {
		await signIn(page, persona.email);

		for (let iter = 0; iter < cfg.iterationsPerUser; iter++) {
			const scenarioName = pickScenario(cfg.scenarioMix);
			const fn = SCENARIOS[scenarioName];
			if (!fn) continue;
			try {
				await fn({
					page,
					persona: persona.id,
					runId: cfg.runId,
					record: (event) => recordEvent({ ...event, persona: persona.id })
				});
			} catch (e) {
				recordEvent({
					persona: persona.id,
					scenario: scenarioName,
					step: 'scenario_root',
					durationMs: 0,
					ok: false,
					error: e instanceof Error ? e.message : String(e)
				});
			}
			await page.waitForTimeout(thinkTime(cfg));
		}
	});
}

test.afterAll(async () => {
	const sorted = aggregate.stepDurationsMs.slice().sort((a, b) => a - b);
	const pct = (q: number) =>
		sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
	const summary = {
		run_id: cfg.runId,
		mode: 'ui-playwright',
		ui_users: cfg.uiUsers,
		iterations_per_user: cfg.iterationsPerUser,
		total_steps: aggregate.totalSteps,
		failed_steps: aggregate.failedSteps,
		error_rate: aggregate.totalSteps === 0 ? 0 : aggregate.failedSteps / aggregate.totalSteps,
		scenario_counts: aggregate.scenarioCounts,
		scenario_failures: aggregate.scenarioFailures,
		step_duration_ms: {
			min: sorted[0] ?? 0,
			p50: pct(0.5),
			p95: pct(0.95),
			p99: pct(0.99),
			max: sorted[sorted.length - 1] ?? 0
		},
		ended_at: new Date().toISOString()
	};
	writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
});
