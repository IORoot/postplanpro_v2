/**
 * Cleanup synthetic multi-user load test data by run id.
 *
 * Removes ONLY rows tagged with the given run id (post_field.key='load_test_run_id'),
 * the seeded users (id LIKE '<run_id>-user-%'), and their webhooks.
 *
 * Usage
 *   tsx scripts/load/cleanup-multi-user-load-data.ts --run-id <id> [--dry-run]
 *   tsx scripts/load/cleanup-multi-user-load-data.ts --all [--dry-run]
 *
 * `--all` removes every row whose id pattern starts with `loadtest-` (defensive default).
 */
import { closeDatabaseForTesting, getDatabase } from '../../src/lib/db/index.js';
import { readBoolEnv } from './lib/guardrails.mjs';

type Args = { runId?: string; all?: boolean; dryRun?: boolean };

function parseArgs(argv: string[]): Args {
	const out: Args = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const next = () => argv[++i];
		switch (a) {
			case '--run-id':
				out.runId = String(next());
				break;
			case '--all':
				out.all = true;
				break;
			case '--dry-run':
				out.dryRun = true;
				break;
			case '-h':
			case '--help':
				console.log(
					'Usage: tsx scripts/load/cleanup-multi-user-load-data.ts (--run-id <id> | --all) [--dry-run]'
				);
				process.exit(0);
				break;
			default:
				console.error(`Unknown arg: ${a}`);
				process.exit(1);
		}
	}
	if (!out.runId && !out.all) throw new Error('Must pass --run-id <id> or --all');
	return out;
}

function isProductionDb(): boolean {
	const p = (process.env.DATABASE_PATH ?? '').toLowerCase();
	return p.includes('postplanpro') || p.includes('/var/lib/docker/volumes/');
}

function assertProdSafe(): void {
	if (!isProductionDb()) return;
	const allow = readBoolEnv('ALLOW_PROD_LOAD_TEST');
	const force = readBoolEnv('FORCE_PROD_LOAD_TEST');
	if (!allow || !force) {
		throw new Error(
			'Production-looking DATABASE_PATH detected. Set ALLOW_PROD_LOAD_TEST=1 AND FORCE_PROD_LOAD_TEST=1 to clean here.'
		);
	}
}

function cleanupRun(runId: string, dryRun: boolean): Record<string, number> {
	const db = getDatabase();
	const userPattern = `${runId}-user-%`;
	const webhookPattern = `${runId}-wh-%`;
	const postPattern = `${runId}-post-%`;

	const counts: Record<string, number> = {
		posts_with_field: 0,
		posts_by_pattern: 0,
		send_logs: 0,
		post_fields: 0,
		post_stages: 0,
		webhooks: 0,
		users: 0
	};

	const taggedPostIds = db
		.prepare("SELECT DISTINCT post_id FROM post_field WHERE key = 'load_test_run_id' AND value = ?")
		.all(runId) as { post_id: string }[];
	const idSet = new Set<string>(taggedPostIds.map((r) => r.post_id));
	const patternPosts = db.prepare('SELECT id FROM post WHERE id LIKE ?').all(postPattern) as { id: string }[];
	for (const r of patternPosts) idSet.add(r.id);
	const postIds = Array.from(idSet);
	counts.posts_with_field = taggedPostIds.length;
	counts.posts_by_pattern = patternPosts.length;

	if (dryRun) {
		counts.send_logs = (
			db
				.prepare(
					`SELECT COUNT(*) AS n FROM send_log WHERE post_id IN (${postIds.map(() => '?').join(',') || 'NULL'})`
				)
				.get(...postIds) as { n: number }
		).n;
		counts.post_fields = (
			db
				.prepare(
					`SELECT COUNT(*) AS n FROM post_field WHERE post_id IN (${postIds.map(() => '?').join(',') || 'NULL'})`
				)
				.get(...postIds) as { n: number }
		).n;
		counts.post_stages = (
			db
				.prepare(
					`SELECT COUNT(*) AS n FROM post_stage WHERE post_id IN (${postIds.map(() => '?').join(',') || 'NULL'})`
				)
				.get(...postIds) as { n: number }
		).n;
		counts.webhooks = (
			db.prepare('SELECT COUNT(*) AS n FROM webhook_config WHERE id LIKE ?').get(webhookPattern) as {
				n: number;
			}
		).n;
		counts.users = (
			db.prepare('SELECT COUNT(*) AS n FROM user WHERE id LIKE ?').get(userPattern) as { n: number }
		).n;
		return counts;
	}

	db.exec('BEGIN');
	try {
		if (postIds.length > 0) {
			const placeholders = postIds.map(() => '?').join(',');
			counts.send_logs = db.prepare(`DELETE FROM send_log WHERE post_id IN (${placeholders})`).run(...postIds).changes;
			counts.post_fields = db
				.prepare(`DELETE FROM post_field WHERE post_id IN (${placeholders})`)
				.run(...postIds).changes;
			counts.post_stages = db
				.prepare(`DELETE FROM post_stage WHERE post_id IN (${placeholders})`)
				.run(...postIds).changes;
			db.prepare(`DELETE FROM post WHERE id IN (${placeholders})`).run(...postIds);
		}
		counts.webhooks = db
			.prepare('DELETE FROM webhook_config WHERE id LIKE ?')
			.run(webhookPattern).changes;
		counts.users = db.prepare('DELETE FROM user WHERE id LIKE ?').run(userPattern).changes;
		db.exec('COMMIT');
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
	return counts;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	assertProdSafe();
	const db = getDatabase();
	let runIds: string[] = [];
	if (args.all) {
		runIds = (
			db
				.prepare("SELECT DISTINCT value FROM post_field WHERE key = 'load_test_run_id' AND value LIKE 'loadtest-%'")
				.all() as { value: string }[]
		).map((r) => r.value);
		const userBased = (
			db
				.prepare("SELECT DISTINCT substr(id, 1, instr(id, '-user-') - 1) AS rid FROM user WHERE id LIKE 'loadtest-%-user-%'")
				.all() as { rid: string }[]
		).map((r) => r.rid);
		runIds = Array.from(new Set([...runIds, ...userBased].filter(Boolean)));
	} else if (args.runId) {
		runIds = [args.runId];
	}

	const summary: Record<string, Record<string, number>> = {};
	for (const id of runIds) summary[id] = cleanupRun(id, args.dryRun ?? false);
	console.log(JSON.stringify({ dryRun: !!args.dryRun, run_ids: runIds, counts: summary }, null, 2));
	closeDatabaseForTesting();
}

try {
	main();
} catch (e) {
	console.error(e);
	process.exit(1);
}
