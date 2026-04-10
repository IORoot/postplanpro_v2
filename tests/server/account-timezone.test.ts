/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID, TEST_WEBHOOK_ID, insertPostRow } from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

vi.mock('../../src/auth.js', () => ({
	sendResetPasswordEmail: vi.fn(),
	signOut: vi.fn()
}));

const { load, actions } = await import('../../src/routes/account/+page.server.js');

beforeAll(() => {
	resetTestDatabase('account-timezone');
	seedCallbackTestData();
	insertPostRow({
		id: 'legacy-scheduled',
		accountId: TEST_USER_ID,
		webhookId: TEST_WEBHOOK_ID,
		title: 'Legacy',
		status: 'scheduled',
		scheduled_at: '2026-01-15T09:00:00'
	});
});

describe('account timezone', () => {
	it('load returns timezone and supported list', async () => {
		const r = await load(mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/account?section=settings') as Parameters<typeof load>[0]);
		expect(r.timezone).toBeTruthy();
		expect(Array.isArray(r.supportedTimezones)).toBe(true);
		expect(r.supportedTimezones.length).toBeGreaterThan(0);
	});

	it('rejects invalid timezone', async () => {
		const res = await actions.updateTimezone?.({
			request: formRequest('http://test/account', { timezone: 'Not/AZone' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateTimezone>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('persists timezone and migrates legacy scheduled_at once', async () => {
		const res = await actions.updateTimezone?.({
			request: formRequest('http://test/account', { timezone: 'America/New_York' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateTimezone>>[0]);
		expect(res).toEqual({ success: true });

		const db = getDatabase();
		const user = db
			.prepare('SELECT timezone, timezone_migrated_at FROM user WHERE id = ?')
			.get(TEST_USER_ID) as { timezone: string; timezone_migrated_at: string | null };
		expect(user.timezone).toBe('America/New_York');
		expect(user.timezone_migrated_at).toBeTruthy();

		const post = db
			.prepare('SELECT scheduled_at FROM post WHERE id = ?')
			.get('legacy-scheduled') as { scheduled_at: string };
		expect(post.scheduled_at).toBe('2026-01-15T14:00:00.000Z');
	});

	it('changing timezone later keeps existing scheduled absolute instant', async () => {
		const db = getDatabase();
		const before = (db.prepare('SELECT scheduled_at FROM post WHERE id = ?').get('legacy-scheduled') as { scheduled_at: string }).scheduled_at;

		const res = await actions.updateTimezone?.({
			request: formRequest('http://test/account', { timezone: 'Europe/London' }),
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals,
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateTimezone>>[0]);
		expect(res).toEqual({ success: true });

		const after = (db.prepare('SELECT scheduled_at FROM post WHERE id = ?').get('legacy-scheduled') as { scheduled_at: string }).scheduled_at;
		expect(after).toBe(before);
	});
});
