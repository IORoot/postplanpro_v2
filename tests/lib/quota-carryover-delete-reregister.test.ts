/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedVerifiedUserWithPassword } from '../helpers/testDb.js';
import { sendPost } from '$lib/scheduler/sendDuePosts.js';
import { mergeAccountUsageIntoEmailCarryover, normalizeQuotaEmail } from '$lib/server/emailQuotaCarryover.js';
import {
	currentMonthKey,
	getSuccessfulOutputSendCountForMonth,
	isOutputSendQuotaBlockedForMonth,
	getUsageForMonth
} from '$lib/usage.js';

vi.mock('$env/dynamic/private', () => ({
	env: {
		APP_BASE_URL: 'https://production.example.com'
	}
}));

const USER1 = 'quota-rereg-user-1';
const USER2 = 'quota-rereg-user-2';
const EMAIL = 'quota-rereg-vitest@test.com';
const PASSWORD = 'Secret1!Pass';

beforeAll(() => {
	resetTestDatabase('quota-rereg-vitest');
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('quota carryover after delete and same-email re-register', () => {
	it('20 sends then delete; new user same email sees 20/20 cap and cannot send', async () => {
		seedVerifiedUserWithPassword(USER1, EMAIL, PASSWORD, 'free');
		const db = getDatabase();
		const wh1 = randomUUID();
		db.prepare('INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)').run(
			wh1,
			USER1,
			'Out',
			'https://example.com/hook'
		);
		const ins = db.prepare(
			`INSERT INTO post (id, account_id, webhook_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
		);
		for (let i = 0; i < 21; i++) {
			ins.run(`rq-p-${i}`, USER1, wh1, `R ${i}`);
		}

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () => '{}'
			})
		);

		const month = currentMonthKey();
		for (let i = 0; i < 20; i++) {
			const r = await sendPost(`rq-p-${i}`, USER1);
			expect(r.success).toBe(true);
		}
		const blockedAt20 = await sendPost('rq-p-20', USER1);
		expect(blockedAt20.success).toBe(false);
		if (!blockedAt20.success) {
			expect(blockedAt20.error).toMatch(/Monthly output send limit reached/);
		}
		expect(getSuccessfulOutputSendCountForMonth(db, USER1, month)).toBe(20);

		const emailNorm = normalizeQuotaEmail(EMAIL);
		db.transaction(() => {
			mergeAccountUsageIntoEmailCarryover(db, USER1, emailNorm);
			db.prepare('DELETE FROM user WHERE id = ?').run(USER1);
		})();

		seedVerifiedUserWithPassword(USER2, EMAIL, PASSWORD, 'free');
		const wh2 = randomUUID();
		db.prepare('INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)').run(
			wh2,
			USER2,
			'Out',
			'https://example.com/hook'
		);
		db.prepare(
			`INSERT INTO post (id, account_id, webhook_id, title, status, created_at, updated_at)
       VALUES ('rq2-p-0', ?, ?, 'After rereg', 'draft', datetime('now'), datetime('now'))`
		).run(USER2, wh2);

		expect(getSuccessfulOutputSendCountForMonth(db, USER2, month)).toBe(20);
		expect(isOutputSendQuotaBlockedForMonth(db, USER2, month, 'free')).toBe(true);
		const usage = getUsageForMonth(db, USER2, month);
		expect(usage.postOutputSends).toBe(20);

		const firstSendAfterRereg = await sendPost('rq2-p-0', USER2);
		expect(firstSendAfterRereg.success).toBe(false);
		if (!firstSendAfterRereg.success) {
			expect(firstSendAfterRereg.error).toMatch(/Monthly output send limit reached/);
		}
		expect(getSuccessfulOutputSendCountForMonth(db, USER2, month)).toBe(20);
	});
});
