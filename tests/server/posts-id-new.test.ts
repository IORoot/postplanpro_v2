/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load as postEditLoad, actions as postEditActions } from '../../src/routes/posts/[id]/+page.server.js';
import { actions as newPostActions } from '../../src/routes/posts/new/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID, TEST_WEBHOOK_ID, insertPostRow } from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

beforeAll(() => {
	resetTestDatabase('posts-id-new');
	seedCallbackTestData();
	insertPostRow({ id: 'edit-me', title: 'Original', status: 'draft', content: 'c0' });
});

describe('posts/[id]/+page.server', () => {
	it('load returns post and webhook_ids', async () => {
		const r = await postEditLoad({
			...mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/posts/edit-me'),
			params: { id: 'edit-me' }
		} as Parameters<typeof postEditLoad>[0]);
		expect(r.post.title).toBe('Original');
		expect(r.webhook_ids).toContain(TEST_WEBHOOK_ID);
	});

	it('update rejects invalid override JSON', async () => {
		const res = await postEditActions.update?.({
			request: formRequest('http://test/posts/edit-me', {
				title: 'T',
				content: '',
				webhook_ids: [TEST_WEBHOOK_ID],
				schedule_by: 'none',
				payload_override_enabled: '1',
				payload_override: '{bad'
			}),
			locals: { userId: TEST_USER_ID },
			params: { id: 'edit-me' },
			...({} as never)
		} as Parameters<NonNullable<typeof postEditActions.update>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('update stores normalized override JSON', async () => {
		try {
			await postEditActions.update?.({
				request: formRequest('http://test/posts/edit-me', {
					title: 'Updated Title',
					content: 'body',
					webhook_ids: [TEST_WEBHOOK_ID],
					schedule_by: 'none',
					payload_override_enabled: '1',
					payload_override: '{"a": 1}'
				}),
				locals: { userId: TEST_USER_ID },
				params: { id: 'edit-me' },
				...({} as never)
			} as Parameters<NonNullable<typeof postEditActions.update>>[0]);
		} catch {
			// redirect
		}
		const po = (
			getDatabase().prepare('SELECT payload_override, title FROM post WHERE id = ?').get('edit-me') as {
				payload_override: string;
				title: string;
			}
		).payload_override;
		expect(po).toBe('{"a":1}');
	});

	it('update writes dotted post_field keys', async () => {
		insertPostRow({ id: 'fld-post', title: 'F', status: 'draft' });
		try {
			await postEditActions.update?.({
				request: formRequest('http://test/posts/fld-post', {
					title: 'F',
					content: '',
					webhook_ids: [TEST_WEBHOOK_ID],
					schedule_by: 'none',
					field_key_0: 'x.y',
					field_type_0: 'json',
					field_value_0: '{"k":true}'
				}),
				locals: { userId: TEST_USER_ID },
				params: { id: 'fld-post' },
				...({} as never)
			} as Parameters<NonNullable<typeof postEditActions.update>>[0]);
		} catch {
			// redirect
		}
		const row = getDatabase().prepare('SELECT key, type, value FROM post_field WHERE post_id = ?').get('fld-post') as {
			key: string;
			type: string;
			value: string;
		};
		expect(row).toEqual({ key: 'x.y', type: 'json', value: '{"k":true}' });
	});
});

describe('posts/new/+page.server', () => {
	it('create rejects without webhooks', async () => {
		const res = await newPostActions.create?.({
			request: formRequest('http://test/posts/new', { title: 'N', schedule_by: 'none' }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof newPostActions.create>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('create inserts draft post', async () => {
		try {
			await newPostActions.create?.({
				request: formRequest('http://test/posts/new', {
					title: 'Brand New',
					content: 'hello',
					webhook_ids: [TEST_WEBHOOK_ID],
					schedule_by: 'none'
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof newPostActions.create>>[0]);
		} catch {
			// redirect
		}
		const row = getDatabase().prepare('SELECT title, status FROM post WHERE title = ?').get('Brand New') as {
			title: string;
			status: string;
		};
		expect(row.status).toBe('draft');
	});
});
