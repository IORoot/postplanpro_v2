/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { load, actions } from '../../src/routes/inputs/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resetTestDatabase, seedCallbackTestData, TEST_USER_ID, TEST_WEBHOOK_ID } from '../helpers/testDb.js';
import { mockRequestEvent, formRequest } from '../helpers/mockRequest.js';

const CSV_DIR = path.join(process.cwd(), 'data', 'csv-imports');
const importId = 'vitest-csv-import-1';

beforeAll(async () => {
	resetTestDatabase('inputs-server');
	seedCallbackTestData();
	await fs.mkdir(CSV_DIR, { recursive: true });
	await fs.writeFile(path.join(CSV_DIR, `${importId}.csv`), 'title,content\nHello CSV,Body line\n', 'utf8');
});

afterAll(async () => {
	try {
		await fs.unlink(path.join(CSV_DIR, `${importId}.csv`));
	} catch {
		// ignore
	}
});

describe('inputs/+page.server load', () => {
	it('returns empty when unauthenticated', async () => {
		const r = await load(mockRequestEvent({ userId: null }, 'http://test/inputs'));
		expect(r.webhooks).toEqual([]);
		expect(r.section).toBe('cms');
	});

	it('returns webhooks for user', async () => {
		const r = await load(mockRequestEvent({ userId: TEST_USER_ID }, 'http://test/inputs'));
		expect(r.webhooks.map((w) => w.name)).toEqual(['Test Webhook']);
		expect(r.section).toBe('cms');
	});
});

describe('inputs/+page.server actions', () => {
	it('discoverCsv returns 401 without user', async () => {
		const res = await actions.discoverCsv?.({
			request: formRequest('http://test/inputs', { csv_import_id: importId }),
			locals: { userId: null },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.discoverCsv>>[0]);
		expect(res).toMatchObject({ status: 401 });
	});

	it('importFromCsv creates posts from file', async () => {
		try {
			await actions.importFromCsv?.({
				request: formRequest('http://test/inputs', {
					csv_import_id: importId,
					delimiter: ',',
					has_header: 'on',
					webhook_ids: [TEST_WEBHOOK_ID],
					title_column: 'title',
					content_column: 'content',
					per_page: '10',
					import_start: '1',
					custom_mapping: '[]',
					filter_rules: ''
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof actions.importFromCsv>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
			expect(String((e as { location?: string }).location)).toContain('imported=1');
		}
		const row = getDatabase().prepare('SELECT title, content, status FROM post WHERE title = ?').get('Hello CSV') as {
			title: string;
			content: string;
			status: string;
		};
		expect(row.content).toBe('Body line');
		expect(row.status).toBe('draft');
	});

	it('importFromCsv returns 400 without import id', async () => {
		const res = await actions.importFromCsv?.({
			request: formRequest('http://test/inputs', {
				webhook_ids: [TEST_WEBHOOK_ID],
				title_column: 'title'
			}),
			locals: { userId: TEST_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.importFromCsv>>[0]);
		expect(res).toMatchObject({ status: 400 });
	});

	it('importFromCsv succeeds without webhooks and stores null webhook_id', async () => {
		try {
			await actions.importFromCsv?.({
				request: formRequest('http://test/inputs', {
					csv_import_id: importId,
					delimiter: ',',
					has_header: 'on',
					title_column: 'title',
					content_column: 'content',
					per_page: '10',
					import_start: '1',
					custom_mapping: '[]',
					filter_rules: ''
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof actions.importFromCsv>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
		}
		const row = getDatabase()
			.prepare('SELECT webhook_id, title FROM post WHERE title = ? AND webhook_id IS NULL LIMIT 1')
			.get('Hello CSV') as { webhook_id: string | null; title: string };
		expect(row.title).toBe('Hello CSV');
		expect(row.webhook_id).toBeNull();
	});

	it('importFromWordPress succeeds without webhooks and stores null webhook_id', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
			const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
			if (u.includes('/wp/v2/posts?') && u.includes('per_page=')) {
				return new Response(
					JSON.stringify([{ id: 991, title: { rendered: 'WP no webhook' }, content: { rendered: 'Body' } }]),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			if (/\/wp\/v2\/posts\/991(\?|$)/.test(u)) {
				return new Response(
					JSON.stringify({ id: 991, title: { rendered: 'WP no webhook' }, content: { rendered: 'Body' } }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			return new Response('not found', { status: 404 });
		});
		try {
			await actions.importFromWordPress?.({
				request: formRequest('http://test/inputs', {
					site_url: 'https://example.com',
					auth: '',
					post_type_route: '/wp/v2/posts',
					schedule_id: '',
					import_status: 'draft',
					title_path: 'title.rendered',
					content_path: 'content.rendered',
					image_url_path: '',
					custom_mapping: '[]',
					filter_rules: '',
					import_start: '1',
					per_page: '1',
					include_featured_image: ''
				}),
				locals: { userId: TEST_USER_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof actions.importFromWordPress>>[0]);
			expect.fail('expected redirect');
		} catch (e) {
			expect(e).toMatchObject({ status: 303 });
		} finally {
			globalThis.fetch = originalFetch;
		}
		const row = getDatabase()
			.prepare('SELECT webhook_id, title FROM post WHERE import_source_id = ?')
			.get('wordpress:https://example.com:991') as { webhook_id: string | null; title: string };
		expect(row.title).toBe('WP no webhook');
		expect(row.webhook_id).toBeNull();
	});
});
