import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { closeDatabaseForTesting, getDatabase } from '../../src/lib/db/index.js';
import { hashPasswordForTest } from '../helpers/hashCredentials.js';
import {
	PLAYWRIGHT_E2E_DB,
	E2E_USER_EMAIL,
	E2E_USER_PASSWORD,
	E2E_RESET_USER_EMAIL,
	E2E_RESET_USER_ID,
	E2E_RESET_USER_PASSWORD,
	PLAYWRIGHT_AUTH_SECRET
} from './playwright-test-env.js';
import { buildLoadUserPool, LOAD_TEST_USER_PASSWORD } from './load/load-test-env.js';

function rmDbArtifacts(base: string): void {
	for (const suf of ['', '-wal', '-shm']) {
		const f = base + (suf || '');
		if (existsSync(f)) {
			try {
				unlinkSync(f);
			} catch {
				// ignore
			}
		}
	}
}

export default async function globalSetup(): Promise<void> {
	process.env.DATABASE_PATH = PLAYWRIGHT_E2E_DB;
	process.env.AUTH_SECRET = PLAYWRIGHT_AUTH_SECRET;

	mkdirSync(path.dirname(PLAYWRIGHT_E2E_DB), { recursive: true });

	closeDatabaseForTesting();
	rmDbArtifacts(PLAYWRIGHT_E2E_DB);

	getDatabase();
	const db = getDatabase();
	const userId = 'e2e-playwright-user';
	const whId = randomUUID();
	const hash = hashPasswordForTest(E2E_USER_PASSWORD);
	db.prepare('DELETE FROM webhook_config WHERE account_id = ?').run(userId);
	db.prepare('DELETE FROM user WHERE id = ? OR email = ?').run(userId, E2E_USER_EMAIL);
	db.prepare(
		`INSERT INTO user (id, email, email_verified_at, password_hash, tier, callback_token)
     VALUES (?, ?, datetime('now'), ?, 'free', 'e2e-callback')`
	).run(userId, E2E_USER_EMAIL, hash);
	db.prepare('INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)').run(
		whId,
		userId,
		'E2E Webhook',
		'https://example.com/e2e-webhook'
	);
	const resetHash = hashPasswordForTest(E2E_RESET_USER_PASSWORD);
	db.prepare('DELETE FROM user WHERE id = ? OR email = ?').run(E2E_RESET_USER_ID, E2E_RESET_USER_EMAIL);
	db.prepare(
		`INSERT INTO user (id, email, email_verified_at, password_hash, tier, callback_token)
     VALUES (?, ?, datetime('now'), ?, 'free', 'e2e-reset-callback')`
	).run(E2E_RESET_USER_ID, E2E_RESET_USER_EMAIL, resetHash);

	const seedCount = Number.parseInt(process.env.LOAD_TEST_SEED_USERS ?? '0', 10);
	if (Number.isFinite(seedCount) && seedCount > 0) {
		const pool = buildLoadUserPool(seedCount);
		const loadHash = hashPasswordForTest(LOAD_TEST_USER_PASSWORD);
		const insertUser = db.prepare(
			`INSERT INTO user (id, email, email_verified_at, password_hash, tier, callback_token)
       VALUES (?, ?, datetime('now'), ?, ?, ?)`
		);
		const insertWh = db.prepare(
			'INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)'
		);
		const tx = db.transaction((users: typeof pool) => {
			for (const u of users) {
				db.prepare('DELETE FROM webhook_config WHERE account_id = ?').run(u.id);
				db.prepare('DELETE FROM user WHERE id = ? OR email = ?').run(u.id, u.email);
				insertUser.run(u.id, u.email, loadHash, u.tier, `${u.id}-cb`);
				insertWh.run(randomUUID(), u.id, 'Load Webhook', 'https://example.com/load-webhook');
			}
		});
		tx(pool);
	}
	closeDatabaseForTesting();
}
