/**
 * Seed synthetic users + webhooks + posts for multi-user load tests.
 *
 * All inserted rows are tagged with `load_test_run_id` so cleanup is targeted.
 *
 * Usage
 *   tsx scripts/load/seed-multi-user-load-data.ts \
 *     --users 1000 --posts-per-user 5 --target https://example.com/webhook \
 *     [--scheduled-at 2026-05-05T12:00:00Z] [--run-id <id>]
 *
 * Env
 *   DATABASE_PATH    SQLite db path (defaults to data/postplan.db).
 *   ALLOW_PROD_LOAD_TEST / FORCE_PROD_LOAD_TEST  Required when DATABASE_PATH points
 *     at a production-looking volume (matches /var/lib/docker/volumes/postplanpro/).
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDatabase, closeDatabaseForTesting } from '../../src/lib/db/index.js';
import { buildRunId, readBoolEnv, resolveRunDir, ensureRunDir } from './lib/guardrails.mjs';

type Args = {
	users: number;
	postsPerUser: number;
	target: string;
	scheduledAt?: string;
	runId?: string;
	tier: 'free' | 'pro' | 'admin';
};

function parseArgs(argv: string[]): Args {
	const out: Args = {
		users: 100,
		postsPerUser: 5,
		target: 'https://example.com/load-webhook',
		tier: 'admin'
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const next = () => argv[++i];
		switch (a) {
			case '--users':
				out.users = Number(next());
				break;
			case '--posts-per-user':
				out.postsPerUser = Number(next());
				break;
			case '--target':
				out.target = String(next());
				break;
			case '--scheduled-at':
				out.scheduledAt = String(next());
				break;
			case '--run-id':
				out.runId = String(next());
				break;
			case '--tier':
				out.tier = next() as Args['tier'];
				break;
			case '-h':
			case '--help':
				console.log(
					'Usage: tsx scripts/load/seed-multi-user-load-data.ts --users <n> --posts-per-user <n> --target <url> [--scheduled-at iso] [--run-id id] [--tier admin|pro|free]'
				);
				process.exit(0);
				break;
			default:
				console.error(`Unknown arg: ${a}`);
				process.exit(1);
		}
	}
	if (!Number.isFinite(out.users) || out.users < 1) throw new Error('--users must be >= 1');
	if (!Number.isFinite(out.postsPerUser) || out.postsPerUser < 1)
		throw new Error('--posts-per-user must be >= 1');
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
			'Production-looking DATABASE_PATH detected. Set ALLOW_PROD_LOAD_TEST=1 AND FORCE_PROD_LOAD_TEST=1 to seed data here.'
		);
	}
}

function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

function isoMinutesFromNow(minutes: number): string {
	return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	assertProdSafe();
	const runId = args.runId ?? buildRunId('seed');
	const runDir = resolveRunDir(runId);
	ensureRunDir(runDir);
	const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'postplan.db');
	mkdirSync(path.dirname(dbPath), { recursive: true });

	const db = getDatabase();
	const password = `LoadPass1!${runId.slice(-8)}`;
	const passwordHash = hashPassword(password);

	const upsertUser = db.prepare(
		`INSERT INTO user (id, email, email_verified_at, password_hash, tier, callback_token, created_at)
     VALUES (?, ?, datetime('now'), ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET tier = excluded.tier, password_hash = excluded.password_hash`
	);
	const insertWebhook = db.prepare(
		'INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)'
	);
	const insertPost = db.prepare(
		`INSERT INTO post (id, account_id, webhook_id, title, content, scheduled_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'scheduled', datetime('now'), datetime('now'))`
	);
	const insertPostField = db.prepare(
		'INSERT INTO post_field (id, post_id, key, value) VALUES (?, ?, ?, ?)'
	);

	const seedTx = db.transaction(() => {
		for (let u = 0; u < args.users; u++) {
			const userId = `${runId}-user-${u}`;
			const email = `${runId}-user-${u}@load.test`;
			upsertUser.run(userId, email, passwordHash, args.tier, `${userId}-cb`);
			const webhookId = `${runId}-wh-${u}`;
			db.prepare('DELETE FROM webhook_config WHERE id = ?').run(webhookId);
			insertWebhook.run(webhookId, userId, `Load Webhook ${u}`, args.target);
			for (let p = 0; p < args.postsPerUser; p++) {
				const postId = `${runId}-post-${u}-${p}`;
				const scheduledAt = args.scheduledAt ?? isoMinutesFromNow(2);
				insertPost.run(
					postId,
					userId,
					webhookId,
					`LT ${runId.slice(-8)} u${u} #${p}`,
					`Multi-user load post ${u}/${p}`,
					scheduledAt
				);
				insertPostField.run(randomBytes(8).toString('hex'), postId, 'load_test_run_id', runId);
				insertPostField.run(
					randomBytes(8).toString('hex'),
					postId,
					'load_test_persona',
					`persona-${u}`
				);
				insertPostField.run(
					randomBytes(8).toString('hex'),
					postId,
					'load_test_sequence',
					String(u * args.postsPerUser + p)
				);
			}
		}
	});

	seedTx();

	const totalPosts = args.users * args.postsPerUser;
	const summary = {
		run_id: runId,
		mode: 'seed',
		users: args.users,
		posts_per_user: args.postsPerUser,
		total_posts: totalPosts,
		tier: args.tier,
		target: args.target,
		scheduled_at: args.scheduledAt ?? '<now+2m>',
		password,
		seed_email_pattern: `${runId}-user-<i>@load.test`,
		db_path: dbPath,
		seeded_at: new Date().toISOString()
	};
	writeFileSync(path.join(runDir, 'seed-summary.json'), JSON.stringify(summary, null, 2));
	console.log(JSON.stringify(summary, null, 2));
	closeDatabaseForTesting();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
