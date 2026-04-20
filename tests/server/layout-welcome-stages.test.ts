/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load as layoutLoad } from '../../src/routes/+layout.server.js';
import { isRedirect } from '@sveltejs/kit';
import { load as welcomeLoad } from '../../src/routes/welcome/+page.server.js';
import { GET as stagesGET } from '../../src/routes/api/posts/[id]/stages/+server.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	TEST_USER_ID,
	TEST_WEBHOOK_ID,
	insertPostRow,
	insertPostStage
} from '../helpers/testDb.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

beforeAll(() => {
	resetTestDatabase('layout-welcome-stages');
	seedCallbackTestData();
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	insertPostRow({
		id: 'layout-cal-post',
		title: 'Cal',
		status: 'scheduled',
		scheduled_at: `${y}-${m}-${day}T12:00:00`
	});
	// Sidebar posts pill shows sent count only; mark one send in the current month.
	getDatabase()
		.prepare("UPDATE post SET status = 'sent', sent_at = ? WHERE id = 'layout-cal-post'")
		.run(`${y}-${m}-${day}T12:00:00.000Z`);
});

describe('+layout.server load', () => {
	it('returns null sidebar and tier when logged out', async () => {
		const r = await layoutLoad(mockRequestEvent({ userId: null }, 'http://test/') as Parameters<typeof layoutLoad>[0]);
		expect(r.sidebarCalendar).toBeNull();
		expect(r.sidebarPlanUsage).toBeNull();
		expect(r.userTier).toBeNull();
		expect(r.session).toBeNull();
	});

	it('returns sidebar markers and tier when logged in', async () => {
		const r = await layoutLoad(mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/') as Parameters<typeof layoutLoad>[0]);
		expect(r.userTier).toBeTruthy();
		expect(r.sidebarCalendar).not.toBeNull();
		expect(r.sidebarCalendar?.markers).toBeDefined();
		const keys = Object.keys(r.sidebarCalendar?.markers ?? {});
		expect(keys.length).toBeGreaterThanOrEqual(1);
		expect(r.sidebarPlanUsage).not.toBeNull();
		expect(r.sidebarPlanUsage?.posts.used).toBeGreaterThanOrEqual(1);
		expect(r.sidebarPlanUsage?.posts.limit).toBeGreaterThan(0);
		expect(r.sidebarPlanUsage?.imports.limit).toBeGreaterThan(0);
		expect(r.sidebarPlanUsage?.callbacks.limit).toBeGreaterThan(0);
	});
});

describe('welcome/+page.server', () => {
	it('redirects /welcome to /', async () => {
		try {
			await welcomeLoad(mockRequestEvent({ userId: null }, 'http://test/welcome') as Parameters<typeof welcomeLoad>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(isRedirect(e)).toBe(true);
			expect((e as { status: number; location: string }).status).toBe(308);
			expect((e as { location: string }).location).toBe('/');
		}
	});
});

describe('GET /api/posts/[id]/stages', () => {
	it('returns 401 when unauthenticated', async () => {
		const res = await stagesGET({
			params: { id: 'layout-cal-post' },
			locals: mockRequestEvent({ userId: null }, 'http://test').locals
		} as Parameters<typeof stagesGET>[0]);
		expect(res.status).toBe(401);
	});

	it('returns 404 for other user post', async () => {
		const res = await stagesGET({
			params: { id: 'missing-post-xyz' },
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals
		} as Parameters<typeof stagesGET>[0]);
		expect(res.status).toBe(404);
	});

	it('returns stages for owned post', async () => {
		const db = getDatabase();
		const id = crypto.randomUUID();
		db.prepare(
			'INSERT OR REPLACE INTO post (id, account_id, webhook_id, title, status) VALUES (?, ?, ?, ?, ?)'
		).run(id, TEST_USER_ID, TEST_WEBHOOK_ID, 'St', 'draft');
		insertPostStage(id, 'review', 'pass', '2030-01-01T10:00:00');
		const res = await stagesGET({
			params: { id },
			locals: mockRequestEvent({ userId: TEST_USER_ID }, 'http://test').locals
		} as Parameters<typeof stagesGET>[0]);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { stages: { stage: string }[] };
		expect(body.stages.some((s) => s.stage === 'review')).toBe(true);
	});
});
