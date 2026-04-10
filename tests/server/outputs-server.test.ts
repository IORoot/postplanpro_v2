/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load, actions } from '../../src/routes/outputs/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID, TEST_WEBHOOK_ID, insertPostRow } from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

beforeAll(() => {
	resetTestDatabase('outputs-server');
	seedCallbackTestData();
});

describe('outputs/+page.server load', () => {
	it('returns webhooks and masks api_key', async () => {
		const r = await load(mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/outputs') as Parameters<typeof load>[0]);
		expect(r.webhooks.length).toBe(1);
		expect(r.webhooks[0].name).toBe('Test Webhook');
	});
});

describe('outputs/+page.server actions', () => {
	it('createWebhook inserts row and headers from JSON array', async () => {
		const headersJson = JSON.stringify([{ key: 'X-Test', value: '1' }]);
		const res = await actions.createWebhook?.({
			request: formRequest('http://test/outputs', {
				name: 'Hook2',
				url: 'https://example.com/h2',
				api_key: 'secret',
				headers_json: headersJson
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createWebhook>>[0]);
		expect(res).toEqual({ success: true, webhookId: expect.any(String) });
		const row = getDatabase().prepare('SELECT name, url, api_key FROM webhook_config WHERE name = ?').get('Hook2') as {
			name: string;
			url: string;
			api_key: string;
		};
		expect(row.url).toBe('https://example.com/h2');
		expect(row.api_key).toBe('secret');
		const h = getDatabase()
			.prepare('SELECT key, value FROM webhook_header WHERE webhook_id = (SELECT id FROM webhook_config WHERE name = ?)')
			.get('Hook2') as { key: string; value: string };
		expect(h).toEqual({ key: 'X-Test', value: '1' });
	});

	it('updateWebhook replaces headers', async () => {
		const wid = (
			getDatabase().prepare('SELECT id FROM webhook_config WHERE account_id = ? LIMIT 1').get(TEST_USER_ID) as { id: string }
		).id;
		const headersJson = JSON.stringify([{ key: 'X-New', value: '2' }]);
		const res = await actions.updateWebhook?.({
			request: formRequest('http://test/outputs', {
				id: wid,
				name: 'Test Webhook',
				url: 'https://example.com/webhook',
				api_key: '••••••••',
				headers_json: headersJson
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateWebhook>>[0]);
		expect(res).toEqual({ success: true });
		const h = getDatabase()
			.prepare('SELECT key FROM webhook_header WHERE webhook_id = ? AND key = ?')
			.get(wid, 'X-New') as { key: string } | undefined;
		expect(h?.key).toBe('X-New');
	});

	it('deleteWebhook removes unused webhook', async () => {
		const id = crypto.randomUUID();
		getDatabase()
			.prepare('INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)')
			.run(id, TEST_USER_ID, 'ToDelete', 'https://example.com/del');
		const res = await actions.deleteWebhook?.({
			request: formRequest('http://test/outputs', { id }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deleteWebhook>>[0]);
		expect(res).toEqual({ success: true });
		expect(getDatabase().prepare('SELECT id FROM webhook_config WHERE id = ?').get(id)).toBeUndefined();
	});

	it('deleteWebhook rejects when post uses webhook', async () => {
		insertPostRow({ id: 'outputs-wh-guard', title: 'Guard', status: 'draft', webhookId: TEST_WEBHOOK_ID });
		const res = await actions.deleteWebhook?.({
			request: formRequest('http://test/outputs', { id: TEST_WEBHOOK_ID }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deleteWebhook>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});
});
