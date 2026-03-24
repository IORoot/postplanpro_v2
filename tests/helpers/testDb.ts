/**
 * Integration test DB helpers. Prefer strong assertions (exact rows, DB before/after), not only HTTP status.
 * See project testing plan: falsifiable expectations and IDOR checks.
 */
import path from 'node:path';
import { mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { getDatabase, closeDatabaseForTesting } from '$lib/db/index.js';
import { hashPasswordForTest } from './hashCredentials.js';

const TEST_DB_DIR = path.join(process.cwd(), '.tmp');

/**
 * Each integration test file must pass a **unique** `fileKey` so parallel Vitest runs do not share one SQLite file.
 */
export function setTestDatabasePath(fileKey: string = 'shared'): void {
	if (!existsSync(TEST_DB_DIR)) {
		mkdirSync(TEST_DB_DIR, { recursive: true });
	}
	process.env.DATABASE_PATH = path.join(TEST_DB_DIR, `vitest-${fileKey}.db`);
}

function unlinkSqliteArtifacts(basePath: string): void {
	for (const suf of ['', '-wal', '-shm']) {
		const f = basePath + (suf === '' ? '' : suf);
		if (existsSync(f)) {
			try {
				unlinkSync(f);
			} catch {
				// ignore
			}
		}
	}
}

export function resetTestDatabase(fileKey: string): void {
	closeDatabaseForTesting();
	const p = path.join(TEST_DB_DIR, `vitest-${fileKey}.db`);
	unlinkSqliteArtifacts(p);
	setTestDatabasePath(fileKey);
	getDatabase();
}

export const TEST_USER_ID = 'test-user-id';
export const TEST_CALLBACK_TOKEN = 'test-callback-token';
export const TEST_WEBHOOK_ID = 'test-webhook-id';
export const OTHER_USER_ID = 'other-user-id';
export const OTHER_CALLBACK_TOKEN = 'other-callback-token';
export const OTHER_WEBHOOK_ID = 'other-webhook-id';
export const ADMIN_USER_ID = 'admin-user-id';

/**
 * Seed the test DB with a user (with callback_token, tier) and one webhook_config.
 */
export function seedCallbackTestData(tier: string = 'free'): void {
	const db = getDatabase();
	db.prepare(
		"INSERT OR REPLACE INTO user (id, email, email_verified_at, callback_token, tier) VALUES (?, 'test@test.com', datetime('now'), ?, ?)"
	).run(TEST_USER_ID, TEST_CALLBACK_TOKEN, tier);
	db.prepare(
		'INSERT OR REPLACE INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)'
	).run(TEST_WEBHOOK_ID, TEST_USER_ID, 'Test Webhook', 'https://example.com/webhook');
}

export function seedOtherUserWithWebhook(): void {
	const db = getDatabase();
	db.prepare(
		"INSERT OR REPLACE INTO user (id, email, email_verified_at, callback_token, tier) VALUES (?, 'other@test.com', datetime('now'), ?, 'free')"
	).run(OTHER_USER_ID, OTHER_CALLBACK_TOKEN);
	db.prepare(
		'INSERT OR REPLACE INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)'
	).run(OTHER_WEBHOOK_ID, OTHER_USER_ID, 'Other Webhook', 'https://other.example.com/hook');
}

export function seedAdminUser(): void {
	const db = getDatabase();
	const hash = hashPasswordForTest('AdminPass1!');
	db.prepare(
		`INSERT OR REPLACE INTO user (id, email, email_verified_at, password_hash, callback_token, tier)
     VALUES (?, 'admin@test.com', datetime('now'), ?, 'admin-callback-token', 'admin')`
	).run(ADMIN_USER_ID, hash);
}

export const TEST_POST_ID = 'test-post-id';

export function seedPostForStage(postId: string = TEST_POST_ID): string {
	const db = getDatabase();
	db.prepare(
		'INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, status) VALUES (?, ?, ?, ?, ?)'
	).run(postId, TEST_USER_ID, TEST_WEBHOOK_ID, 'Test Post', 'draft');
	return postId;
}

export type SeedPostOpts = {
	id: string;
	accountId?: string;
	webhookId?: string;
	title?: string;
	status?: string;
	scheduled_at?: string | null;
	schedule_id?: string | null;
	color?: string | null;
};

export function insertPostRow(opts: SeedPostOpts): void {
	const db = getDatabase();
	const accountId = opts.accountId ?? TEST_USER_ID;
	const webhookId = opts.webhookId ?? TEST_WEBHOOK_ID;
	db.prepare(
		`INSERT OR REPLACE INTO post (id, account_id, webhook_id, schedule_id, title, content, scheduled_at, status, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, datetime('now'), datetime('now'))`
	).run(
		opts.id,
		accountId,
		webhookId,
		opts.schedule_id ?? null,
		opts.title ?? 'Post',
		opts.scheduled_at ?? null,
		opts.status ?? 'draft',
		opts.color ?? null
	);
}

export function insertScheduleWithSlots(
	scheduleId: string,
	accountId: string,
	slots: string[],
	opts?: { name?: string; color?: string | null }
): void {
	const db = getDatabase();
	db.prepare('INSERT OR REPLACE INTO schedule (id, account_id, name, description, color) VALUES (?, ?, ?, NULL, ?)').run(
		scheduleId,
		accountId,
		opts?.name ?? 'Test Schedule',
		opts?.color ?? null
	);
	db.prepare('DELETE FROM schedule_slot WHERE schedule_id = ?').run(scheduleId);
	slots.forEach((scheduled_at, i) => {
		db.prepare('INSERT INTO schedule_slot (id, schedule_id, scheduled_at, order_index) VALUES (?, ?, ?, ?)').run(
			randomBytes(8).toString('hex'),
			scheduleId,
			scheduled_at,
			i
		);
	});
}

export function insertScheduleRule(
	scheduleId: string,
	type: string,
	config: Record<string, unknown>,
	orderIndex: number,
	start_at?: string | null,
	end_at?: string | null
): string {
	const db = getDatabase();
	const id = randomBytes(8).toString('hex');
	db.prepare(
		'INSERT INTO schedule_rule (id, schedule_id, type, config, start_at, end_at, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
	).run(id, scheduleId, type, JSON.stringify(config), start_at ?? null, end_at ?? null, orderIndex);
	return id;
}

export function insertSendLog(opts: {
	id: string;
	accountId: string;
	postId: string;
	sent_at?: string;
	request_json?: string;
	success?: number;
}): void {
	const db = getDatabase();
	db.prepare(
		`INSERT OR REPLACE INTO send_log (id, account_id, post_id, sent_at, request_json, response_status, response_body, success)
     VALUES (?, ?, ?, COALESCE(?, datetime('now')), ?, NULL, NULL, ?)`
	).run(
		opts.id,
		opts.accountId,
		opts.postId,
		opts.sent_at ?? null,
		opts.request_json ?? '{}',
		opts.success ?? 1
	);
}

export function insertPostStage(postId: string, stage: string, status: string, completed_at: string): void {
	const db = getDatabase();
	const id = randomBytes(8).toString('hex');
	db.prepare(
		'INSERT OR REPLACE INTO post_stage (id, post_id, stage, status, completed_at) VALUES (?, ?, ?, ?, ?)'
	).run(id, postId, stage, status, completed_at);
}

/** Raw token and DB hash for auth_token rows (matches auth.ts). */
export function insertAuthTokenRow(
	userId: string,
	purpose: 'verify_email' | 'reset_password',
	rawToken: string,
	ttlMinutes: number = 60
): void {
	const tokenHash = createHash('sha256').update(rawToken).digest('hex');
	const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
	getDatabase()
		.prepare(
			"INSERT INTO auth_token (id, user_id, purpose, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, datetime('now'))"
		)
		.run(randomBytes(8).toString('hex'), userId, purpose, tokenHash, expiresAt);
}

export function insertResetPasswordToken(userId: string): { rawToken: string } {
	const rawToken = randomBytes(32).toString('hex');
	insertAuthTokenRow(userId, 'reset_password', rawToken);
	return { rawToken };
}

export function seedVerifiedUserWithPassword(
	userId: string,
	email: string,
	password: string,
	tier: string = 'free'
): void {
	const db = getDatabase();
	db.prepare(
		`INSERT OR REPLACE INTO user (id, email, email_verified_at, password_hash, tier, callback_token)
     VALUES (?, ?, datetime('now'), ?, ?, ?)`
	).run(userId, email, hashPasswordForTest(password), tier, `${userId}-cb`);
}
