/**
 * @vitest-environment node
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actions, load } from '../../src/routes/admin/status/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import { ADMIN_USER_ID, resetTestDatabase, seedAdminUser, seedVerifiedUserWithPassword } from '../helpers/testDb.js';
import { formRequest, mockRequestEvent } from '../helpers/mockRequest.js';

const NON_ADMIN_ID = 'status-non-admin';

beforeAll(() => {
	resetTestDatabase('admin-status-settings');
	seedAdminUser();
	seedVerifiedUserWithPassword(NON_ADMIN_ID, 'member@test.com', 'MemberPass1!', 'free');
});

describe('admin/status sender settings', () => {
	it('blocks non-admin load', async () => {
		await expect(
			load(mockRequestEvent({ userId: NON_ADMIN_ID }, 'http://test/admin/status') as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/calendar' });
	});

	it('admin can save and clear sender settings', async () => {
		const saveResult = await actions.saveSenderSettings?.({
			request: formRequest('http://test/admin/status', {
				claimBatch: '900',
				concurrency: '50',
				lockTtlMs: '240000'
			}),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.saveSenderSettings>>[0]);
		expect(saveResult).toMatchObject({ senderSettingsSaved: true });

		const db = getDatabase();
		const claim = db.prepare('SELECT value FROM app_setting WHERE key = ?').get('sender:claim_batch') as
			| { value: string }
			| undefined;
		const concurrency = db.prepare('SELECT value FROM app_setting WHERE key = ?').get('sender:concurrency') as
			| { value: string }
			| undefined;
		const ttl = db.prepare('SELECT value FROM app_setting WHERE key = ?').get('sender:lock_ttl_ms') as
			| { value: string }
			| undefined;
		expect(claim?.value).toBe('900');
		expect(concurrency?.value).toBe('50');
		expect(ttl?.value).toBe('240000');

		const clearResult = await actions.clearSenderSettings?.({
			request: formRequest('http://test/admin/status', {}),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.clearSenderSettings>>[0]);
		expect(clearResult).toMatchObject({ senderSettingsCleared: true });
		const remaining = db
			.prepare("SELECT COUNT(*) AS n FROM app_setting WHERE key IN ('sender:claim_batch','sender:concurrency','sender:lock_ttl_ms')")
			.get() as { n: number };
		expect(remaining.n).toBe(0);
	});
});
