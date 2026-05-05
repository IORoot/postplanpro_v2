/**
 * @vitest-environment node
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { actions, load } from '../../src/routes/admin/status/+page.server.js';
import { getDatabase } from '$lib/db/index.js';
import { ADMIN_USER_ID, resetTestDatabase, seedAdminUser, seedVerifiedUserWithPassword } from '../helpers/testDb.js';
import { formRequest, mockRequestEvent } from '../helpers/mockRequest.js';

const NON_ADMIN_ID = 'load-test-non-admin';

beforeAll(() => {
	resetTestDatabase('admin-load-test-settings');
	seedAdminUser();
	seedVerifiedUserWithPassword(NON_ADMIN_ID, 'member-load@test.com', 'MemberPass1!', 'free');
});

describe('admin/status load test settings', () => {
	it('exposes load test settings to admin load', async () => {
		const result = (await load(
			mockRequestEvent({ userId: ADMIN_USER_ID }, 'http://test/admin/status') as Parameters<typeof load>[0]
		)) as { loadTestSettings: { effective: { uiUsers: number } } };
		expect(result.loadTestSettings.effective.uiUsers).toBeGreaterThanOrEqual(1);
	});

	it('blocks non-admin from saving load test settings', async () => {
		await expect(
			actions.saveLoadTestSettings?.({
				request: formRequest('http://test/admin/status', {
					uiUsers: '50',
					scenarioMix: '[{"name":"browse_calendar","weight":1}]'
				}),
				locals: { userId: NON_ADMIN_ID },
				params: {},
				...({} as never)
			} as Parameters<NonNullable<typeof actions.saveLoadTestSettings>>[0])
		).rejects.toMatchObject({ status: 303, location: '/calendar' });
	});

	it('admin can save and clear load test settings', async () => {
		const saveResult = await actions.saveLoadTestSettings?.({
			request: formRequest('http://test/admin/status', {
				allowProdLoadTest: 'on',
				uiUsers: '250',
				scenarioMix: '[{"name":"browse_calendar","weight":2},{"name":"create_draft_post","weight":1}]'
			}),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.saveLoadTestSettings>>[0]);
		expect(saveResult).toMatchObject({ loadTestSettingsSaved: true });

		const db = getDatabase();
		const allow = db.prepare('SELECT value FROM app_setting WHERE key = ?').get('loadtest:allow_prod') as
			| { value: string }
			| undefined;
		const users = db.prepare('SELECT value FROM app_setting WHERE key = ?').get('loadtest:ui_users') as
			| { value: string }
			| undefined;
		const mix = db.prepare('SELECT value FROM app_setting WHERE key = ?').get('loadtest:scenario_mix') as
			| { value: string }
			| undefined;
		expect(allow?.value).toBe('true');
		expect(users?.value).toBe('250');
		expect(mix?.value).toContain('browse_calendar');

		const clearResult = await actions.clearLoadTestSettings?.({
			request: formRequest('http://test/admin/status', {}),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.clearLoadTestSettings>>[0]);
		expect(clearResult).toMatchObject({ loadTestSettingsCleared: true });
		const remaining = db
			.prepare(
				"SELECT COUNT(*) AS n FROM app_setting WHERE key IN ('loadtest:allow_prod','loadtest:ui_users','loadtest:scenario_mix')"
			)
			.get() as { n: number };
		expect(remaining.n).toBe(0);
	});

	it('rejects invalid scenario mix JSON', async () => {
		const result = await actions.saveLoadTestSettings?.({
			request: formRequest('http://test/admin/status', {
				uiUsers: '10',
				scenarioMix: 'not-json'
			}),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.saveLoadTestSettings>>[0]);
		expect(result).toMatchObject({ status: 400 });
	});

	it('rejects out-of-range uiUsers', async () => {
		const result = await actions.saveLoadTestSettings?.({
			request: formRequest('http://test/admin/status', {
				uiUsers: '0',
				scenarioMix: '[{"name":"browse_calendar","weight":1}]'
			}),
			locals: { userId: ADMIN_USER_ID },
			params: {},
			...({} as never)
		} as Parameters<NonNullable<typeof actions.saveLoadTestSettings>>[0]);
		expect(result).toMatchObject({ status: 400 });
	});
});
