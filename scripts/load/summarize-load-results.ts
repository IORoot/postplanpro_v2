/**
 * Aggregate Playwright + k6 + listener artifacts for a run id and emit a
 * consolidated summary.json + summary.md with pass/fail vs configured thresholds.
 *
 * Usage
 *   tsx scripts/load/summarize-load-results.ts --run-id <id> [--listener-dir <path>]
 *
 * Defaults
 *   --root        loadtest_results
 *   --listener-dir  loadtest_results/<run-id>/listener (or env LISTENER_LOG_DIR)
 *
 * Thresholds (env-overridable)
 *   ERROR_RATE_MAX             default 0.05
 *   UI_LATENCY_P95_MS_MAX      default 2000
 *   POST_LATENCY_P95_MS_MAX    default 2000
 *   POST_THROUGHPUT_MIN_RPS    default 100
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Args = { runId: string; root: string; listenerDir?: string };

function parseArgs(argv: string[]): Args {
	const out: Args = { runId: '', root: 'loadtest_results' };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const next = () => argv[++i];
		switch (a) {
			case '--run-id':
				out.runId = String(next());
				break;
			case '--root':
				out.root = String(next());
				break;
			case '--listener-dir':
				out.listenerDir = String(next());
				break;
			case '-h':
			case '--help':
				console.log(
					'Usage: tsx scripts/load/summarize-load-results.ts --run-id <id> [--root loadtest_results] [--listener-dir <path>]'
				);
				process.exit(0);
				break;
			default:
				console.error(`Unknown arg: ${a}`);
				process.exit(1);
		}
	}
	if (!out.runId) throw new Error('--run-id is required');
	return out;
}

function readJsonIfExists<T>(file: string): T | null {
	if (!existsSync(file)) return null;
	try {
		return JSON.parse(readFileSync(file, 'utf8')) as T;
	} catch (e) {
		console.error(`Failed to parse ${file}:`, e);
		return null;
	}
}

function readNdjson<T = unknown>(file: string): T[] {
	if (!existsSync(file)) return [];
	const text = readFileSync(file, 'utf8');
	const out: T[] = [];
	for (const line of text.split('\n')) {
		const t = line.trim();
		if (!t) continue;
		try {
			out.push(JSON.parse(t) as T);
		} catch {
			// skip malformed lines
		}
	}
	return out;
}

function envNumber(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) return fallback;
	const n = Number(raw);
	return Number.isFinite(n) ? n : fallback;
}

type Threshold = { name: string; value: number | null; limit: number; comparator: 'lt' | 'gt'; ok: boolean };

function evalThresholds(values: { errorRate: number | null; uiP95: number | null; postP95: number | null; postRps: number | null }): Threshold[] {
	const errorMax = envNumber('ERROR_RATE_MAX', 0.05);
	const uiMax = envNumber('UI_LATENCY_P95_MS_MAX', 2000);
	const postMax = envNumber('POST_LATENCY_P95_MS_MAX', 2000);
	const rpsMin = envNumber('POST_THROUGHPUT_MIN_RPS', 100);

	const list: Threshold[] = [
		{ name: 'error_rate', value: values.errorRate, limit: errorMax, comparator: 'lt', ok: false },
		{ name: 'ui_latency_p95_ms', value: values.uiP95, limit: uiMax, comparator: 'lt', ok: false },
		{ name: 'post_latency_p95_ms', value: values.postP95, limit: postMax, comparator: 'lt', ok: false },
		{ name: 'post_throughput_min_rps', value: values.postRps, limit: rpsMin, comparator: 'gt', ok: false }
	];
	for (const t of list) {
		if (t.value === null || t.value === undefined) {
			t.ok = true; // skipped (not collected)
			continue;
		}
		t.ok = t.comparator === 'lt' ? t.value < t.limit : t.value > t.limit;
	}
	return list;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const runDir = path.resolve(process.cwd(), args.root, args.runId);
	if (!existsSync(runDir)) {
		throw new Error(`Run dir not found: ${runDir}`);
	}

	const meta = readJsonIfExists<Record<string, unknown>>(path.join(runDir, 'run-metadata.json'));
	const playwrightSummary = readJsonIfExists<{
		total_steps: number;
		failed_steps: number;
		error_rate: number;
		step_duration_ms?: { p50: number; p95: number; p99: number };
		scenario_counts: Record<string, number>;
		scenario_failures: Record<string, number>;
	}>(path.join(runDir, 'playwright-summary.json'));
	const k6Ui = readJsonIfExists<{ metrics: Record<string, number | null> }>(path.join(runDir, 'k6-ui-summary.json'));
	const k6Posting = readJsonIfExists<{ metrics: Record<string, number | null>; users?: number; posts_per_user?: number }>(
		path.join(runDir, 'k6-posting-summary.json')
	);

	const listenerDir = args.listenerDir ?? process.env.LISTENER_LOG_DIR ?? path.join(runDir, 'listener');
	let listenerSummary: {
		total_received: number;
		duplicate_sequences: number;
		unique_personas: number;
		unique_scenarios: number;
		started_at?: string;
		last_update_at?: string;
	} | null = null;
	if (existsSync(listenerDir)) {
		const inner = path.join(listenerDir, args.runId, 'run-summary.json');
		listenerSummary = readJsonIfExists(inner);
		if (!listenerSummary && statSync(listenerDir).isDirectory()) {
			const candidates = readdirSync(listenerDir);
			for (const c of candidates) {
				const f = path.join(listenerDir, c, 'run-summary.json');
				if (existsSync(f)) {
					listenerSummary = readJsonIfExists(f);
					if (listenerSummary) break;
				}
			}
		}
	}

	const listenerRollups = listenerSummary
		? readNdjson<{ rate_per_second?: number; window_received?: number; window_seconds?: number }>(
				path.join(listenerDir, args.runId, 'rollups.ndjson')
			)
		: [];
	let listenerPeakRps: number | null = null;
	let listenerAvgRps: number | null = null;
	if (listenerRollups.length > 0) {
		let total = 0;
		let count = 0;
		for (const r of listenerRollups) {
			const rate = typeof r.rate_per_second === 'number' ? r.rate_per_second : null;
			if (rate !== null) {
				if (listenerPeakRps === null || rate > listenerPeakRps) listenerPeakRps = rate;
				total += rate;
				count += 1;
			}
		}
		if (count > 0) listenerAvgRps = total / count;
	}

	const errorRate =
		playwrightSummary?.error_rate ?? k6Ui?.metrics?.['ui_error_rate'] ?? k6Posting?.metrics?.['post_error_rate'] ?? null;
	const uiP95 =
		(playwrightSummary?.step_duration_ms?.p95 ?? null) ??
		(k6Ui?.metrics?.['ui_page_latency_ms_p95'] ?? null);
	const postP95 = k6Posting?.metrics?.['post_latency_ms_p95'] ?? null;
	const postRps = listenerPeakRps ?? null;

	const thresholds = evalThresholds({ errorRate, uiP95, postP95, postRps });
	const passed = thresholds.every((t) => t.ok);

	const summary = {
		run_id: args.runId,
		passed,
		thresholds,
		generated_at: new Date().toISOString(),
		metadata: meta,
		playwright: playwrightSummary,
		k6_ui: k6Ui,
		k6_posting: k6Posting,
		listener: {
			summary: listenerSummary,
			peak_rps: listenerPeakRps,
			avg_rps: listenerAvgRps,
			rollup_samples: listenerRollups.length
		}
	};

	mkdirSync(runDir, { recursive: true });
	writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));

	const lines: string[] = [];
	lines.push(`# Load run summary: ${args.runId}`);
	lines.push('');
	lines.push(`Status: ${passed ? 'PASS' : 'FAIL'}`);
	lines.push('');
	lines.push('## Thresholds');
	lines.push('');
	lines.push('| Metric | Value | Limit | Comparator | Result |');
	lines.push('| --- | --- | --- | --- | --- |');
	for (const t of thresholds) {
		const valStr = t.value === null ? 'n/a' : t.value.toString();
		lines.push(`| ${t.name} | ${valStr} | ${t.limit} | ${t.comparator} | ${t.ok ? 'PASS' : 'FAIL'} |`);
	}
	lines.push('');
	if (playwrightSummary) {
		lines.push('## Playwright (UI)');
		lines.push(
			`- Steps: ${playwrightSummary.total_steps}, failed: ${playwrightSummary.failed_steps}, error rate: ${playwrightSummary.error_rate.toFixed(4)}`
		);
		if (playwrightSummary.step_duration_ms) {
			lines.push(
				`- Step latency p50/p95/p99 ms: ${playwrightSummary.step_duration_ms.p50}/${playwrightSummary.step_duration_ms.p95}/${playwrightSummary.step_duration_ms.p99}`
			);
		}
		const failingScenarios = Object.entries(playwrightSummary.scenario_failures ?? {})
			.filter(([, v]) => v > 0)
			.map(([k, v]) => `${k}=${v}`)
			.join(', ');
		if (failingScenarios) lines.push(`- Failing scenarios: ${failingScenarios}`);
		lines.push('');
	}
	if (k6Ui) {
		lines.push('## k6 UI');
		lines.push(`- error_rate: ${k6Ui.metrics?.['ui_error_rate']}`);
		lines.push(`- p95 ms: ${k6Ui.metrics?.['ui_page_latency_ms_p95']}`);
		lines.push(`- p99 ms: ${k6Ui.metrics?.['ui_page_latency_ms_p99']}`);
		lines.push('');
	}
	if (k6Posting) {
		lines.push('## k6 posting');
		lines.push(`- users: ${k6Posting.users ?? 'n/a'} x ${k6Posting.posts_per_user ?? 'n/a'} posts`);
		lines.push(`- error_rate: ${k6Posting.metrics?.['post_error_rate']}`);
		lines.push(`- p95 ms: ${k6Posting.metrics?.['post_latency_ms_p95']}`);
		lines.push(`- p99 ms: ${k6Posting.metrics?.['post_latency_ms_p99']}`);
		lines.push('');
	}
	if (listenerSummary) {
		lines.push('## Listener');
		lines.push(`- total_received: ${listenerSummary.total_received}`);
		lines.push(`- duplicate_sequences: ${listenerSummary.duplicate_sequences}`);
		lines.push(`- unique_personas: ${listenerSummary.unique_personas}`);
		lines.push(`- peak rps: ${listenerPeakRps ?? 'n/a'}, avg rps: ${listenerAvgRps?.toFixed(2) ?? 'n/a'}`);
		lines.push('');
	}
	writeFileSync(path.join(runDir, 'summary.md'), lines.join('\n'));

	console.log(JSON.stringify(summary, null, 2));
	if (!passed) process.exit(2);
}

try {
	main();
} catch (e) {
	console.error(e);
	process.exit(1);
}
