/**
 * Multi-user load test env helpers (Playwright suite).
 *
 * The plan moves these settings into the admin DB but the Playwright test process
 * runs out-of-band so we read them from env first; admin DB is only the source of
 * truth for the running app server. Use scripts/load to seed the DB and then export
 * the same settings via env when invoking Playwright if you want them mirrored.
 */
import { DEFAULT_SCENARIO_MIX, parseScenarioMixEnv, type WeightedScenario } from './scenarios.js';

export type LoadUserDef = {
	id: string;
	email: string;
	password: string;
	tier: 'free' | 'pro' | 'admin';
};

export const LOAD_TEST_USER_PASSWORD = 'LoadPass1!';

export function buildLoadUserPool(count: number): LoadUserDef[] {
	const out: LoadUserDef[] = [];
	for (let i = 0; i < count; i++) {
		out.push({
			id: `e2e-load-user-${i}`,
			email: `e2e-load-${i}@postplan.test`,
			password: LOAD_TEST_USER_PASSWORD,
			tier: i === 0 ? 'admin' : 'free'
		});
	}
	return out;
}

export type LoadTestRunConfig = {
	runId: string;
	uiUsers: number;
	maxUiUsers: number;
	scenarioMix: WeightedScenario[];
	iterationsPerUser: number;
	thinkTimeMinMs: number;
	thinkTimeMaxMs: number;
	resultsDir: string;
};

function intEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) return fallback;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function readLoadRunConfig(defaultMaxUiUsers = 200): LoadTestRunConfig {
	const uiUsers = intEnv('UI_USERS', 10);
	const maxUiUsers = intEnv('UI_USERS_CAP', defaultMaxUiUsers);
	const iterationsPerUser = intEnv('UI_ITERATIONS', 3);
	const thinkTimeMinMs = intEnv('UI_THINK_MIN_MS', 200);
	const thinkTimeMaxMs = Math.max(thinkTimeMinMs, intEnv('UI_THINK_MAX_MS', 1500));
	const scenarioMix = parseScenarioMixEnv(process.env.SCENARIO_MIX, DEFAULT_SCENARIO_MIX);
	const runId =
		process.env.LOAD_TEST_RUN_ID ||
		`loadtest-pw-${new Date().toISOString().replace(/[-:.]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
	const resultsDir = process.env.LOAD_RESULTS_DIR || `loadtest_results/${runId}`;
	return {
		runId,
		uiUsers: Math.min(uiUsers, maxUiUsers),
		maxUiUsers,
		scenarioMix,
		iterationsPerUser,
		thinkTimeMinMs,
		thinkTimeMaxMs,
		resultsDir
	};
}

export function thinkTime(cfg: LoadTestRunConfig): number {
	const span = Math.max(0, cfg.thinkTimeMaxMs - cfg.thinkTimeMinMs);
	return cfg.thinkTimeMinMs + Math.floor(Math.random() * (span + 1));
}
