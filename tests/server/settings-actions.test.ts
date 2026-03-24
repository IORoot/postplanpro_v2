/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { load as settingsLoad, actions } from '../../src/routes/settings/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	TEST_USER_ID,
	TEST_WEBHOOK_ID,
	insertPostRow
} from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

beforeAll(() => {
	resetTestDatabase('settings-actions');
	seedCallbackTestData();
});

describe('settings/+page.server load', () => {
	it('returns webhooks and masks api_key', async () => {
		const r = await settingsLoad(
			mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/settings?section=outputs') as Parameters<typeof settingsLoad>[0]
		);
		expect(r.webhooks.length).toBe(1);
		expect(r.webhooks[0].name).toBe('Test Webhook');
	});
});

describe('settings/+page.server actions', () => {
	it('createWebhook inserts row and headers from JSON array', async () => {
		const headersJson = JSON.stringify([{ key: 'X-Test', value: '1' }]);
		const res = await actions.createWebhook?.({
			request: formRequest('http://test/settings', {
				name: 'Hook2',
				url: 'https://example.com/h2',
				api_key: 'secret',
				headers_json: headersJson
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createWebhook>>[0]);
		expect(res).toEqual({ success: true });
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

	it('createGlobal and updateGlobal', async () => {
		await actions.createGlobal?.({
			request: formRequest('http://test/settings', { key: 'g1', value: 'v1', type: 'string' }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createGlobal>>[0]);
		const id = (getDatabase().prepare('SELECT id FROM global_variable WHERE key = ?').get('g1') as { id: string }).id;
		await actions.updateGlobal?.({
			request: formRequest('http://test/settings', { id, key: 'g1', value: 'v2', type: 'number' }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateGlobal>>[0]);
		const v = (getDatabase().prepare('SELECT value, type FROM global_variable WHERE id = ?').get(id) as { value: string; type: string })
			.value;
		expect(v).toBe('v2');
	});

	it('createTemplate requires at least one field', async () => {
		const res = await actions.createTemplate?.({
			request: formRequest('http://test/settings', { name: 'Empty', fields_json: '[]' }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createTemplate>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('createTemplate stores dotted keys and types', async () => {
		const fields = JSON.stringify([
			{ key: 'meta.author', type: 'string', value: 'Ann' },
			{ key: 'meta.count', type: 'number', value: '3' }
		]);
		const res = await actions.createTemplate?.({
			request: formRequest('http://test/settings', { name: 'Tmpl', fields_json: fields }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createTemplate>>[0]);
		expect(res).toEqual({ success: true });
		const tid = (getDatabase().prepare('SELECT id FROM field_template WHERE name = ? AND account_id = ?').get('Tmpl', TEST_USER_ID) as {
			id: string;
		}).id;
		const keys = getDatabase()
			.prepare('SELECT key, type FROM field_template_field WHERE template_id = ? ORDER BY key')
			.all(tid) as { key: string; type: string }[];
		expect(keys).toContainEqual({ key: 'meta.author', type: 'string' });
		expect(keys).toContainEqual({ key: 'meta.count', type: 'number' });
	});

	it('generateCallbackToken updates user row', async () => {
		const res = await actions.generateCallbackToken?.({
			request: new Request('http://test'),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.generateCallbackToken>>[0]);
		expect(res && 'token' in res && typeof (res as { token: string }).token).toBe('string');
		const tok = (res as { token: string }).token;
		const dbTok = (getDatabase().prepare('SELECT callback_token FROM user WHERE id = ?').get(TEST_USER_ID) as { callback_token: string })
			.callback_token;
		expect(dbTok).toBe(tok);
	});

	it('updateWebhook replaces headers', async () => {
		const wid = (
			getDatabase().prepare('SELECT id FROM webhook_config WHERE account_id = ? LIMIT 1').get(TEST_USER_ID) as { id: string }
		).id;
		const headersJson = JSON.stringify([{ key: 'X-New', value: '2' }]);
		const res = await actions.updateWebhook?.({
			request: formRequest('http://test', {
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
			request: formRequest('http://test', { id }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deleteWebhook>>[0]);
		expect(res).toEqual({ success: true });
		expect(getDatabase().prepare('SELECT id FROM webhook_config WHERE id = ?').get(id)).toBeUndefined();
	});

	it('deleteWebhook rejects when post uses webhook', async () => {
		insertPostRow({ id: 'settings-wh-guard', title: 'Guard', status: 'draft', webhookId: TEST_WEBHOOK_ID });
		const res = await actions.deleteWebhook?.({
			request: formRequest('http://test', { id: TEST_WEBHOOK_ID }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deleteWebhook>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('deleteGlobal removes row', async () => {
		await actions.createGlobal?.({
			request: formRequest('http://test', { key: 'to-del', value: 'x', type: 'string' }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createGlobal>>[0]);
		const gid = (getDatabase().prepare('SELECT id FROM global_variable WHERE key = ?').get('to-del') as { id: string }).id;
		await actions.deleteGlobal?.({
			request: formRequest('http://test', { id: gid }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deleteGlobal>>[0]);
		expect(getDatabase().prepare('SELECT id FROM global_variable WHERE key = ?').get('to-del')).toBeUndefined();
	});

	it('revokeCallbackToken clears token', async () => {
		await actions.generateCallbackToken?.({
			request: new Request('http://test'),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.generateCallbackToken>>[0]);
		await actions.revokeCallbackToken?.({
			request: new Request('http://test'),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.revokeCallbackToken>>[0]);
		const t = (getDatabase().prepare('SELECT callback_token FROM user WHERE id = ?').get(TEST_USER_ID) as { callback_token: string | null })
			.callback_token;
		expect(t).toBeNull();
	});

	it('updateTemplate updates user-owned template', async () => {
		const fields = JSON.stringify([{ key: 'a', type: 'string', value: '1' }]);
		await actions.createTemplate?.({
			request: formRequest('http://test', { name: 'MyT', fields_json: fields }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.createTemplate>>[0]);
		const tid = (getDatabase().prepare('SELECT id FROM field_template WHERE name = ? AND account_id = ?').get('MyT', TEST_USER_ID) as {
			id: string;
		}).id;
		const res = await actions.updateTemplate?.({
			request: formRequest('http://test', {
				id: tid,
				name: 'MyT2',
				fields_json: JSON.stringify([{ key: 'b', type: 'string', value: '2' }])
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateTemplate>>[0]);
		expect(res).toEqual({ success: true });
		const keys = getDatabase()
			.prepare('SELECT key FROM field_template_field WHERE template_id = ?')
			.all(tid) as { key: string }[];
		expect(keys.map((k) => k.key)).toContain('b');
	});

	it('updateTemplate returns 403 for default template', async () => {
		const row = getDatabase().prepare('SELECT id FROM field_template WHERE is_default = 1 LIMIT 1').get() as { id: string };
		const res = await actions.updateTemplate?.({
			request: formRequest('http://test', {
				id: row.id,
				name: 'X',
				fields_json: JSON.stringify([{ key: 'z', type: 'string', value: '' }])
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.updateTemplate>>[0]);
		expect(res).toMatchObject({ status: 403 });
	});

	it('deleteTemplate returns 403 for default template', async () => {
		const row = getDatabase().prepare('SELECT id FROM field_template WHERE is_default = 1 LIMIT 1').get() as { id: string };
		const res = await actions.deleteTemplate?.({
			request: formRequest('http://test', { id: row.id }),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.deleteTemplate>>[0]);
		expect(res).toMatchObject({ status: 403 });
	});
});
