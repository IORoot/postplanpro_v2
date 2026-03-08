import path from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { getDatabase } from '$lib/db/index.js';

const TEST_DB_DIR = path.join(process.cwd(), '.tmp');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'vitest-api-test.db');

export function setTestDatabasePath(): void {
	if (!existsSync(TEST_DB_DIR)) {
		mkdirSync(TEST_DB_DIR, { recursive: true });
	}
	process.env.DATABASE_PATH = TEST_DB_PATH;
}

export const TEST_USER_ID = 'test-user-id';
export const TEST_CALLBACK_TOKEN = 'test-callback-token';
export const TEST_WEBHOOK_ID = 'test-webhook-id';

/**
 * Seed the test DB with a user (with callback_token, tier) and one webhook_config.
 * Call setTestDatabasePath() and getDatabase() first (e.g. in beforeAll).
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

export const TEST_POST_ID = 'test-post-id';

/** Seed a post for stage callback tests. Call seedCallbackTestData first. Returns the post id used. */
export function seedPostForStage(postId: string = TEST_POST_ID): string {
	const db = getDatabase();
	db.prepare(
		'INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, status) VALUES (?, ?, ?, ?, ?)'
	).run(postId, TEST_USER_ID, TEST_WEBHOOK_ID, 'Test Post', 'draft');
	return postId;
}
