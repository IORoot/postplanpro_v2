/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { actions as newPostActions, load as newPostLoad } from '../../src/routes/posts/new/+page.server.js';
import { actions as postEditActions, load as postEditLoad } from '../../src/routes/posts/[id]/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID, TEST_WEBHOOK_ID, insertPostRow } from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

beforeAll(() => {
	resetTestDatabase('posts-timezone');
	seedCallbackTestData();
	getDatabase().prepare('UPDATE user SET timezone = ? WHERE id = ?').run('America/New_York', TEST_USER_ID);
	insertPostRow({ id: 'tz-edit-post', accountId: TEST_USER_ID, webhookId: TEST_WEBHOOK_ID, title: 'Edit TZ', status: 'scheduled', scheduled_at: '2026-01-15T14:00:00.000Z' });
});

describe('posts timezone behavior', () => {
	it('new post load includes user timezone', async () => {
		const r = await newPostLoad(mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/posts/new') as Parameters<typeof newPostLoad>[0]);
		expect(r.userTimezone).toBe('America/New_York');
	});

	it('create converts local datetime to UTC before storing', async () => {
		try {
			await newPostActions.create?.({
				request: formRequest('http://test/posts/new', {
					title: 'TZ create',
					content: '',
					webhook_ids: [TEST_WEBHOOK_ID],
					schedule_by: 'datetime',
					scheduled_at: '2026-01-15T09:00'
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof newPostActions.create>>[0]);
		} catch {
			// redirect
		}
		const row = getDatabase().prepare('SELECT scheduled_at, status FROM post WHERE title = ?').get('TZ create') as {
			scheduled_at: string;
			status: string;
		};
		expect(row.status).toBe('scheduled');
		expect(row.scheduled_at).toBe('2026-01-15T14:00:00.000Z');
	});

	it('edit load returns local datetime projection for user timezone', async () => {
		const r = await postEditLoad({
			...mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/posts/tz-edit-post'),
			params: { id: 'tz-edit-post' }
		} as Parameters<typeof postEditLoad>[0]);
		expect(r.userTimezone).toBe('America/New_York');
		expect(r.scheduleLocal?.dateTime).toBe('2026-01-15T09:00');
	});

	it('edit update converts local datetime to UTC', async () => {
		try {
			await postEditActions.update?.({
				request: formRequest('http://test/posts/tz-edit-post', {
					title: 'Edit TZ',
					content: '',
					webhook_ids: [TEST_WEBHOOK_ID],
					schedule_by: 'datetime',
					scheduled_at: '2026-01-16T10:15'
				}),
				locals: { userId: TEST_USER_ID },
				params: { id: 'tz-edit-post' },
				...({} as never)
			} as Parameters<NonNullable<typeof postEditActions.update>>[0]);
		} catch {
			// redirect
		}
		const row = getDatabase().prepare('SELECT scheduled_at FROM post WHERE id = ?').get('tz-edit-post') as { scheduled_at: string };
		expect(row.scheduled_at).toBe('2026-01-16T15:15:00.000Z');
	});
});
