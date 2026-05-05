/**
 * Shared production safety + run-id helpers for the multi-user load suite.
 *
 * Goals
 * - Refuse to run against a production-looking host unless ALLOW_PROD_LOAD_TEST=1
 *   AND --confirm-prod / FORCE_PROD_LOAD_TEST=1 are set.
 * - Provide a single source of truth for run ids, run folders, and metadata.
 * - Cap accidental over-scaling per mode via concurrency sanity checks.
 *
 * Used by
 * - scripts/load/k6-multi-user-ui.js (via env-derived run id + folder)
 * - scripts/load/k6-multi-user-posting.js
 * - scripts/load/seed-multi-user-load-data.ts
 * - scripts/load/cleanup-multi-user-load-data.ts
 * - scripts/load/summarize-load-results.ts
 * - tests/e2e/load/* (Playwright multi-user runner)
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROD_HOST_PATTERNS = [/^https?:\/\/(www\.)?postplanpro\.com/i, /^https?:\/\/[^/]*\.postplanpro\.com/i];

export function looksLikeProductionUrl(url) {
	if (!url) return false;
	return PROD_HOST_PATTERNS.some((re) => re.test(String(url)));
}

export function readBoolEnv(name, fallback = false) {
	const raw = process.env[name];
	if (raw === undefined) return fallback;
	const s = String(raw).trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(s)) return true;
	if (['0', 'false', 'no', 'off', ''].includes(s)) return false;
	return fallback;
}

export function readIntEnv(name, fallback, { min, max } = {}) {
	const raw = process.env[name];
	if (!raw) return fallback;
	const n = Number.parseInt(String(raw).trim(), 10);
	if (!Number.isFinite(n)) return fallback;
	if (typeof min === 'number' && n < min) return min;
	if (typeof max === 'number' && n > max) return max;
	return n;
}

/**
 * Concurrency caps per load mode. Scripts pass `mode` and the requested concurrency.
 * Throws if requested exceeds cap unless OVERRIDE_LOAD_CAPS=1.
 */
const CONCURRENCY_CAPS = {
	'ui-playwright': 500,
	'ui-k6': 10_000,
	'posting-k6': 10_000
};

export function enforceConcurrencyCap(mode, requested) {
	const cap = CONCURRENCY_CAPS[mode];
	if (!cap) return;
	if (readBoolEnv('OVERRIDE_LOAD_CAPS')) return;
	if (requested > cap) {
		throw new Error(
			`Requested concurrency ${requested} exceeds ${mode} cap ${cap}. Set OVERRIDE_LOAD_CAPS=1 to bypass.`
		);
	}
}

/**
 * Build a stable run id of the form
 *   loadtest-<iso-utc-condensed>-<mode>-<rand>
 * e.g. loadtest-20260505T100432Z-ui-pw-7a3fbb
 */
export function buildRunId(mode) {
	const iso = new Date().toISOString().replace(/[-:.]/g, '').replace(/\.\d{3}Z$/, 'Z');
	const rand = randomBytes(3).toString('hex');
	const safeMode = String(mode).replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'load';
	return `loadtest-${iso}-${safeMode}-${rand}`;
}

export function resolveRunDir(runId, { rootEnv = 'LOAD_RESULTS_ROOT', defaultRoot = 'loadtest_results' } = {}) {
	const root = process.env[rootEnv] || defaultRoot;
	return resolve(process.cwd(), root, runId);
}

export function ensureRunDir(runDir) {
	mkdirSync(runDir, { recursive: true });
	return runDir;
}

export function writeRunMetadata(runDir, meta) {
	ensureRunDir(runDir);
	const file = resolve(runDir, 'run-metadata.json');
	writeFileSync(file, JSON.stringify({ ...meta, written_at: new Date().toISOString() }, null, 2));
	return file;
}

/**
 * Production guard.
 *
 * Returns { allowed, reason }. When `throwOnBlock` is true (default), throws on disallowed runs.
 *
 * Rules
 * - target URL not production-looking          -> always allowed
 * - target URL production-looking
 *      ALLOW_PROD_LOAD_TEST=1 and FORCE_PROD_LOAD_TEST=1 -> allowed
 *      otherwise                                          -> blocked
 */
export function assertProductionGuard({ targetUrl, throwOnBlock = true } = {}) {
	const isProd = looksLikeProductionUrl(targetUrl);
	if (!isProd) return { allowed: true, reason: 'non-production target' };
	const allowProd = readBoolEnv('ALLOW_PROD_LOAD_TEST');
	const forceProd = readBoolEnv('FORCE_PROD_LOAD_TEST');
	if (allowProd && forceProd) return { allowed: true, reason: 'prod allowed by env' };
	const reason = `Production target ${targetUrl} blocked. Set ALLOW_PROD_LOAD_TEST=1 AND FORCE_PROD_LOAD_TEST=1 to run.`;
	if (throwOnBlock) throw new Error(reason);
	return { allowed: false, reason };
}

/**
 * Build a complete run context: id, dir, metadata file, and concurrency check.
 * Used by Node-based scripts (seed/cleanup/summary) and Playwright runner.
 */
export function initLoadRun({ mode, targetUrl, requestedConcurrency, extraMeta = {} }) {
	assertProductionGuard({ targetUrl });
	if (typeof requestedConcurrency === 'number') {
		enforceConcurrencyCap(mode, requestedConcurrency);
	}
	const runId = process.env.LOAD_TEST_RUN_ID || buildRunId(mode);
	const runDir = resolveRunDir(runId);
	ensureRunDir(runDir);
	writeRunMetadata(runDir, {
		run_id: runId,
		mode,
		target_url: targetUrl ?? null,
		requested_concurrency: requestedConcurrency ?? null,
		allow_prod: readBoolEnv('ALLOW_PROD_LOAD_TEST'),
		force_prod: readBoolEnv('FORCE_PROD_LOAD_TEST'),
		override_caps: readBoolEnv('OVERRIDE_LOAD_CAPS'),
		host: targetUrl ? new URL(targetUrl).host : null,
		...extraMeta
	});
	return { runId, runDir };
}

export const LOAD_TEST_FIELD_KEYS = {
	runId: 'load_test_run_id',
	sequence: 'load_test_sequence',
	persona: 'load_test_persona',
	scenario: 'load_test_scenario'
};
