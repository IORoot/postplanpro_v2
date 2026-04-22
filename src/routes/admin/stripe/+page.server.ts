import { requireAdmin } from '$lib/admin.js';
import { getDatabase } from '$lib/db/index.js';
import {
	getStripeMode,
	getStripeModeFromEnv,
	STRIPE_MODE_SETTING_KEY
} from '$lib/server/stripeEnv.js';
import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function maskSecret(value: string | undefined): string | null {
	if (!value?.trim()) return null;
	const v = value.trim();
	if (v.length <= 8) return 'configured';
	return `…${v.slice(-6)}`;
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const db = getDatabase();
	const row = db
		.prepare('SELECT value FROM app_setting WHERE key = ?')
		.get(STRIPE_MODE_SETTING_KEY) as { value: string } | undefined;
	const raw = row?.value?.trim().toLowerCase();
	const dbOverride = raw === 'test' || raw === 'live' ? raw : null;

	return {
		effectiveMode: getStripeMode(),
		envDefaultMode: getStripeModeFromEnv(),
		dbOverride,
		keysPreview: {
			test: {
				secretKey: maskSecret(env.STRIPE_SECRET_KEY_TEST),
				priceId: maskSecret(env.STRIPE_PRICE_ID_PRO_MONTHLY_TEST),
				webhookSecret: maskSecret(env.STRIPE_WEBHOOK_SECRET_TEST)
			},
			live: {
				secretKey: maskSecret(env.STRIPE_SECRET_KEY),
				priceId: maskSecret(env.STRIPE_PRICE_ID_PRO_MONTHLY),
				webhookSecret: maskSecret(env.STRIPE_WEBHOOK_SECRET)
			}
		}
	};
};

export const actions: Actions = {
	setMode: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const mode = String(data.get('mode') ?? '').trim().toLowerCase();
		if (mode !== 'test' && mode !== 'live') {
			return fail(400, { error: 'Invalid mode.' });
		}
		const db = getDatabase();
		db.prepare(
			`INSERT INTO app_setting (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
		).run(STRIPE_MODE_SETTING_KEY, mode);
		return { updated: true as const };
	},
	clearOverride: async (event) => {
		requireAdmin(event);
		const db = getDatabase();
		db.prepare('DELETE FROM app_setting WHERE key = ?').run(STRIPE_MODE_SETTING_KEY);
		return { cleared: true as const };
	}
};
