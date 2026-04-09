/**
 * @vitest-environment node
 *
 * Intentionally strict security tests for CRITICAL/HIGH findings in vulns.md.
 * These are expected to fail until each vulnerability is remediated.
 */
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { getDatabase } from '$lib/db/index.js';
import {
	resetTestDatabase,
	seedCallbackTestData,
	insertPostRow,
	TEST_USER_ID,
	TEST_WEBHOOK_ID,
	TEST_CALLBACK_TOKEN
} from '../helpers/testDb.js';

const CRON_SECRET = 'test-cron-secret';

vi.mock('$env/dynamic/private', () => ({
	env: {
		CRON_SECRET,
		APP_BASE_URL: 'https://production.example.com'
	}
}));

const { GET } = await import('../../src/routes/api/cron/send-due-posts/+server');
const { sendDuePosts, sendPost } = await import('../../src/lib/scheduler/sendDuePosts.js');
const { POST: importCallbackPost } = await import('../../src/routes/api/callbacks/import/+server');

beforeAll(() => {
	resetTestDatabase('critical-high-vulns');
	seedCallbackTestData();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('CRITICAL: ReDoS hardening', () => {
	it('does not compile user-controlled regex directly in inputs server logic', async () => {
		const src = await readFile('src/routes/inputs/+page.server.ts', 'utf8');
		expect(src).not.toMatch(/new RegExp\(val\)/);
		expect(src).not.toMatch(/new RegExp\(pattern/);
	});
});

describe('HIGH: dependency version gate', () => {
	it('does not pin package versions flagged in vulns.md', async () => {
		const raw = await readFile('package.json', 'utf8');
		const pkg = JSON.parse(raw) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};

		expect(pkg.devDependencies?.vite).not.toBe('7.3.1');
		expect(pkg.devDependencies?.svelte).not.toBe('5.53.0');
		expect(pkg.dependencies?.nodemailer).not.toBe('7.0.13');
		expect(pkg.devDependencies?.['@sveltejs/kit']).not.toBe('2.52.2');
	});

	it('forces a patched cookie version via overrides', async () => {
		const raw = await readFile('package.json', 'utf8');
		const pkg = JSON.parse(raw) as { overrides?: Record<string, string> };
		expect(pkg.overrides?.cookie).toBe('1.1.1');
	});
});

describe('HIGH: cron auth secret handling', () => {
	it('rejects cron secret in query string', async () => {
		const request = new Request(`http://test/api/cron/send-due-posts?secret=${CRON_SECRET}`, {
			method: 'GET'
		});
		const response = await GET({ request, url: new URL(request.url) });
		expect(response.status).toBe(401);
	});
});

describe('HIGH: callback token exposure in outbound payload', () => {
	it('does not send callback_token in outbound webhook body', async () => {
		insertPostRow({
			id: 'vuln-sendpost-no-callback-token',
			accountId: TEST_USER_ID,
			webhookId: TEST_WEBHOOK_ID,
			title: 'Payload token check',
			status: 'draft'
		});

		let postedBody: Record<string, unknown> | null = null;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
				postedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
				return {
					ok: true,
					status: 200,
					statusText: 'OK',
					text: async () => '{"ok":true}'
				};
			})
		);

		const result = await sendPost('vuln-sendpost-no-callback-token', TEST_USER_ID);
		expect(result.success).toBe(true);
		expect(postedBody).toBeTruthy();
		expect(postedBody).not.toHaveProperty('callback_token');
	});
});

describe('HIGH: raw error disclosure', () => {
	it('returns generic callback import errors to clients', async () => {
		const request = new Request('http://test/api/callbacks/import', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${TEST_CALLBACK_TOKEN}`
			},
			body: JSON.stringify({
				posts: [{ title: 'Bad schedule', webhook_id: TEST_WEBHOOK_ID, schedule_ids: ['does-not-exist'] }]
			})
		});
		const response = await importCallbackPost({ request });
		expect(response.status).toBe(400);
		const data = (await response.json()) as { error?: string };
		expect(data.error).toBe('Operation failed.');
	});

	it('does not leak raw internal fetch errors from scheduler', async () => {
		const db = getDatabase();
		insertPostRow({
			id: 'vuln-senddueposts-hide-error',
			accountId: TEST_USER_ID,
			webhookId: TEST_WEBHOOK_ID,
			title: 'Due post internal error leak test',
			status: 'scheduled',
			scheduled_at: '2000-01-01T00:00:00'
		});

		vi.stubGlobal(
			'fetch',
			vi.fn().mockRejectedValue(new Error('internal socket path /srv/app/private should not leak'))
		);

		const result = await sendDuePosts();
		expect(result.failed).toBeGreaterThan(0);
		expect(result.errors.join('\n')).not.toMatch(/\/srv\/app\/private|internal socket path/i);

		const row = db.prepare('SELECT error_message FROM post WHERE id = ?').get('vuln-senddueposts-hide-error') as
			| { error_message: string | null }
			| undefined;
		expect(row?.error_message ?? '').not.toMatch(/\/srv\/app\/private|internal socket path/i);
	});
});
