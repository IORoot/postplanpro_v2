/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { sendDuePosts, sendPost } from '$lib/scheduler/sendDuePosts.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase } from '../helpers/testDb.js';
import { currentMonthKey } from '$lib/usage.js';

vi.mock('$env/dynamic/private', () => ({
	env: {
		APP_BASE_URL: 'https://production.example.com'
	}
}));

const FREE_QUOTA_USER_ID = 'free-quota-user-21';
const FREE_QUOTA_WEBHOOK_ID = 'free-quota-webhook-21';

function seedFreeUserWithWebhook(): void {
	const db = getDatabase();
	db.prepare(
		`INSERT OR REPLACE INTO user (id, email, email_verified_at, callback_token, tier)
     VALUES (?, 'free-quota-21@test.com', datetime('now'), 'cb-quota-21', 'free')`
	).run(FREE_QUOTA_USER_ID);
	db.prepare(
		'INSERT OR REPLACE INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)'
	).run(FREE_QUOTA_WEBHOOK_ID, FREE_QUOTA_USER_ID, 'Fake output', 'https://example.com/fake-output-endpoint');
}

function insertTwentyOneDueScheduledPosts(): void {
	const db = getDatabase();
	const ins = db.prepare(
		`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, scheduled_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'scheduled', datetime('now'), datetime('now'))`
	);
	for (let i = 0; i < 21; i++) {
		const id = `quota-p-${i}`;
		const mm = String(i).padStart(2, '0');
		const scheduledAt = `2000-01-01T00:${mm}:00`;
		ins.run(id, FREE_QUOTA_USER_ID, FREE_QUOTA_WEBHOOK_ID, `Post ${i}`, scheduledAt);
	}
}

function insertTwentyOneDraftPosts(): void {
	const db = getDatabase();
	const ins = db.prepare(
		`INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))`
	);
	for (let i = 0; i < 21; i++) {
		ins.run(`quota-draft-${i}`, FREE_QUOTA_USER_ID, FREE_QUOTA_WEBHOOK_ID, `Draft ${i}`);
	}
}

beforeAll(() => {
	resetTestDatabase('send-due-free-quota-21');
	seedFreeUserWithWebhook();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('free tier post output quota (21 posts)', () => {
	it('sendDuePosts sends only 20; 21st stays scheduled with quota error', async () => {
		insertTwentyOneDueScheduledPosts();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK',
				text: async () => '{"ok":true}'
			})
		);

		const r = await sendDuePosts();
		expect(r.sent).toBe(20);

		const quotaErrors = r.errors.filter((e) => e.includes('Monthly output send limit reached'));
		expect(quotaErrors.length).toBe(1);
		expect(quotaErrors.some((e) => e.includes('quota-p-20'))).toBe(true);

		const db = getDatabase();
		const month = currentMonthKey();
		const successSends = (
			db
				.prepare(
					`SELECT COUNT(*) as n FROM send_log
         WHERE account_id = ? AND success = 1 AND strftime('%Y-%m', sent_at) = ?`
				)
				.get(FREE_QUOTA_USER_ID, month) as { n: number }
		).n;
		expect(successSends).toBe(20);

		const sentPosts = (
			db
				.prepare(`SELECT COUNT(*) as n FROM post WHERE account_id = ? AND status = 'sent'`)
				.get(FREE_QUOTA_USER_ID) as { n: number }
		).n;
		expect(sentPosts).toBe(20);

		const lastStillScheduled = (
			db.prepare(`SELECT status FROM post WHERE id = ?`).get('quota-p-20') as { status: string } | undefined
		)?.status;
		expect(lastStillScheduled).toBe('scheduled');
	});

	it('sendPost: 21st manual send is rejected after 20 successful sends', async () => {
		resetTestDatabase('send-post-free-quota-21');
		seedFreeUserWithWebhook();
		insertTwentyOneDraftPosts();

		const fetchOk = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK',
			text: async () => '{}'
		});
		vi.stubGlobal('fetch', fetchOk);

		for (let i = 0; i < 20; i++) {
			const res = await sendPost(`quota-draft-${i}`, FREE_QUOTA_USER_ID);
			expect(res.success).toBe(true);
		}
		expect(fetchOk).toHaveBeenCalledTimes(20);

		const last = await sendPost('quota-draft-20', FREE_QUOTA_USER_ID);
		expect(last.success).toBe(false);
		if (!last.success) {
			expect(last.error).toMatch(/Monthly output send limit reached/);
		}
		expect(fetchOk).toHaveBeenCalledTimes(20);

		const db = getDatabase();
		const month = currentMonthKey();
		const successSends = (
			db
				.prepare(
					`SELECT COUNT(*) as n FROM send_log
         WHERE account_id = ? AND success = 1 AND strftime('%Y-%m', sent_at) = ?`
				)
				.get(FREE_QUOTA_USER_ID, month) as { n: number }
		).n;
		expect(successSends).toBe(20);

		const lastStatus = (db.prepare(`SELECT status FROM post WHERE id = ?`).get('quota-draft-20') as { status: string })
			.status;
		expect(lastStatus).toBe('draft');
	});
});
