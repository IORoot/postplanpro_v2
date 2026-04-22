/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { resetTestDatabase } from '../helpers/testDb.js';
import { getDatabase } from '$lib/db/index.js';
import { STRIPE_MODE_SETTING_KEY } from '$lib/server/stripeEnv.js';

vi.mock('$env/dynamic/private', () => ({
	env: {
		STRIPE_MODE: 'live'
	}
}));

beforeAll(() => {
	resetTestDatabase('stripe-mode-db-override');
	const db = getDatabase();
	db.prepare(
		`INSERT INTO app_setting (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
	).run(STRIPE_MODE_SETTING_KEY, 'test');
});

describe('stripe mode DB override', () => {
	it('app_setting stripe_mode overrides STRIPE_MODE env', async () => {
		const { getStripeMode, getStripeModeFromEnv } = await import('../../src/lib/server/stripeEnv.js');
		expect(getStripeModeFromEnv()).toBe('live');
		expect(getStripeMode()).toBe('test');
	});
});
