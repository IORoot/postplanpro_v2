/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
});
