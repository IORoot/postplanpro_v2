/**
 * @vitest-environment node
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actions, load } from '../../src/routes/admin/testing/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import { ADMIN_USER_ID, resetTestDatabase, seedAdminUser, seedVerifiedUserWithPassword } from '../helpers/testDb.js';
import { formRequest, mockRequestEvent } from '../helpers/mockRequest.js';

const NON_ADMIN_USER_ID = 'non-admin-load-user';

beforeAll(() => {
	resetTestDatabase('admin-testing');
	seedAdminUser();
	seedVerifiedUserWithPassword(NON_ADMIN_USER_ID, 'member@test.com', 'MemberPass1!', 'free');
});

describe('admin/testing +page.server', () => {
	it('redirects non-admin from load', async () => {
		await expect(
			load(mockRequestEvent({ userId: NON_ADMIN_USER_ID }, 'http://test/admin/testing') as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/calendar' });
	});

	it('rejects invalid webhook URL', async () => {
		const res = await actions.createRun?.({
			request: formRequest('http://test/admin/testing', {
				webhookUrl: 'not-a-url',
				postCount: '5',
				startAt: '2099-01-01T00:00',
				intervalSeconds: '0'
			}),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createRun>>[0]);

		expect(res).toMatchObject({ status: 400 });
	});

	it('requires explicit confirm for large runs', async () => {
		const res = await actions.createRun?.({
			request: formRequest('http://test/admin/testing', {
				webhookUrl: 'https://listener.example.com/webhook',
				postCount: '1000',
				startAt: '2099-01-01T00:00',
				intervalSeconds: '0',
				highVolumeConfirm: ''
			}),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createRun>>[0]);

		expect(res).toMatchObject({ status: 400 });
	});

	it('creates scheduled load test posts with marker fields', async () => {
		const res = await actions.createRun?.({
			request: formRequest('http://test/admin/testing', {
				webhookUrl: 'https://listener.example.com/webhook',
				postCount: '3',
				startAt: '2099-01-01T00:00',
				intervalSeconds: '2'
			}),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createRun>>[0]);

		expect(res).toMatchObject({ created: true, postCount: 3, intervalSeconds: 2 });
		const runId = (res as { runId: string }).runId;

		const db = getDatabase();
		const webhook = db
			.prepare('SELECT id FROM webhook_config WHERE account_id = ? AND url = ?')
			.get(ADMIN_USER_ID, 'https://listener.example.com/webhook') as { id: string } | undefined;
		expect(webhook?.id).toBeTruthy();

		const posts = db
			.prepare(
				`SELECT id, status, scheduled_at
         FROM post
         WHERE account_id = ? AND title LIKE ?
         ORDER BY scheduled_at ASC`
			)
			.all(ADMIN_USER_ID, `Load Test ${runId}%`) as { id: string; status: string; scheduled_at: string }[];
		expect(posts.length).toBe(3);
		expect(posts.every((p) => p.status === 'scheduled')).toBe(true);

		const firstTs = Date.parse(posts[0].scheduled_at);
		const secondTs = Date.parse(posts[1].scheduled_at);
		expect(secondTs - firstTs).toBe(2000);

		const markers = db
			.prepare(
				`SELECT key, value
         FROM post_field
         WHERE post_id = ? AND key IN ('load_test_run_id', 'load_test_sequence', 'load_test_total')
         ORDER BY key ASC`
			)
			.all(posts[0].id) as { key: string; value: string }[];
		expect(markers).toEqual([
			{ key: 'load_test_run_id', value: runId },
			{ key: 'load_test_sequence', value: '1' },
			{ key: 'load_test_total', value: '3' }
		]);
	});
});
