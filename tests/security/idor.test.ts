/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { actions as postListActions } from '../../src/routes/posts/+page.server.js';
import { actions as calendarActions } from '../../src/routes/calendar/+page.server.js';
import { load as postEditLoad, actions as postEditActions } from '../../src/routes/posts/[id]/+page.server.js';
import { actions as settingsActions } from '../../src/routes/settings/+page.server.js';
import { POST as postSend } from '../../src/routes/api/posts/[id]/send/+server.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	seedOtherUserWithWebhook,
	TEST_USER_ID,
	TEST_WEBHOOK_ID,
	OTHER_USER_ID,
	OTHER_WEBHOOK_ID,
	insertPostRow
} from '../helpers/testDb.js';
import { formRequest, mockRequestEvent } from '../helpers/mockRequest.js';

beforeAll(() => {
	resetTestDatabase('idor');
	seedCallbackTestData();
	seedOtherUserWithWebhook();
	insertPostRow({
		id: 'victim-post',
		accountId: OTHER_USER_ID,
		webhookId: OTHER_WEBHOOK_ID,
		title: 'Victim',
		status: 'draft'
	});
});

describe('IDOR: posts list actions as attacker', () => {
	it('bulkDelete does not delete other account post', async () => {
		await postListActions.bulkDelete?.({
			request: formRequest('http://test/posts', { ids: ['victim-post'] }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof postListActions.bulkDelete>>[0]);
		const row = getDatabase().prepare('SELECT id FROM post WHERE id = ?').get('victim-post');
		expect(row).toEqual({ id: 'victim-post' });
	});

	it('bulkUpdateWebhook does not change other account post', async () => {
		await postListActions.bulkUpdateWebhook?.({
			request: formRequest('http://test/posts', {
				ids: ['victim-post'],
				webhook_id: TEST_WEBHOOK_ID
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof postListActions.bulkUpdateWebhook>>[0]);
		const wid = (
			getDatabase().prepare('SELECT webhook_id FROM post WHERE id = ?').get('victim-post') as { webhook_id: string }
		).webhook_id;
		expect(wid).toBe(OTHER_WEBHOOK_ID);
	});
});

describe('IDOR: calendar reschedule as attacker', () => {
	it('does not reschedule other user post', async () => {
		await calendarActions.reschedulePost?.({
			request: formRequest('http://test/calendar', {
				post_id: 'victim-post',
				scheduled_at: '2031-01-01T12:00:00'
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof calendarActions.reschedulePost>>[0]);
		const at = getDatabase().prepare('SELECT scheduled_at FROM post WHERE id = ?').get('victim-post') as {
			scheduled_at: string | null;
		};
		expect(at.scheduled_at).toBeNull();
	});
});

describe('IDOR: post edit load and update', () => {
	it('load redirects when post belongs to another user', async () => {
		const event = {
			...mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/posts/victim-post'),
			params: { id: 'victim-post' }
		} as Parameters<typeof postEditLoad>[0];
		await expect(postEditLoad(event)).rejects.toMatchObject({ status: 303 });
	});

	it('update does not mutate other user post', async () => {
		const res = await postEditActions.update?.({
			request: formRequest('http://test/posts/victim-post', {
				title: 'Hacked',
				content: '',
				webhook_ids: [TEST_WEBHOOK_ID],
				schedule_by: 'none'
			}),
			locals: { userId: TEST_USER_ID },
			params: { id: 'victim-post' },
			...({} as never)
		} as Parameters<NonNullable<typeof postEditActions.update>>[0]);
		expect(res).toMatchObject({ status: 404 });
		const title = (getDatabase().prepare('SELECT title FROM post WHERE id = ?').get('victim-post') as { title: string }).title;
		expect(title).toBe('Victim');
	});
});

describe('IDOR: settings deleteWebhook', () => {
	it('cannot delete webhook owned by another user', async () => {
		const res = await settingsActions.deleteWebhook?.({
			request: formRequest('http://test/settings', { id: OTHER_WEBHOOK_ID }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof settingsActions.deleteWebhook>>[0]);
		expect(res).toMatchObject({ success: true });
		const row = getDatabase().prepare('SELECT id FROM webhook_config WHERE id = ?').get(OTHER_WEBHOOK_ID);
		expect(row).toEqual({ id: OTHER_WEBHOOK_ID });
	});
});

describe('IDOR: POST /api/posts/[id]/send', () => {
	it('returns 400 and leaves other user post as draft', async () => {
		const response = await postSend({
			params: { id: 'victim-post' },
			locals: { userId: TEST_USER_ID },
			request: new Request('http://test/api/posts/victim-post/send', { method: 'POST' })
		} as Parameters<typeof postSend>[0]);
		expect(response.status).toBe(400);
		const body = (await response.json()) as { success: boolean; error?: string };
		expect(body.success).toBe(false);
		expect(body.error).toMatch(/not found/i);
		const st = (getDatabase().prepare('SELECT status FROM post WHERE id = ?').get('victim-post') as { status: string }).status;
		expect(st).toBe('draft');
	});
});
