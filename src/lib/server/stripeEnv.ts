import { env } from '$env/dynamic/private';
import { getDatabase } from '$lib/db/index.js';

export type StripeMode = 'test' | 'live';

export const STRIPE_MODE_SETTING_KEY = 'stripe_mode' as const;

/** Mode from `STRIPE_MODE` env only (ignores DB override). For admin UI labels. */
export function getStripeModeFromEnv(): StripeMode {
	const raw = env.STRIPE_MODE?.trim().toLowerCase();
	return raw === 'test' ? 'test' : 'live';
}

/**
 * Effective Stripe mode: `app_setting.stripe_mode` (`test` | `live`) wins if set; else `STRIPE_MODE` env.
 * When mode is `test`, Stripe calls use `STRIPE_*_TEST` vars; otherwise live `STRIPE_*`.
 */
export function getStripeMode(): StripeMode {
	const row = getDatabase()
		.prepare('SELECT value FROM app_setting WHERE key = ?')
		.get(STRIPE_MODE_SETTING_KEY) as { value: string } | undefined;
	const v = row?.value?.trim().toLowerCase();
	if (v === 'test' || v === 'live') return v;
	return getStripeModeFromEnv();
}

export function getStripeSecrets(): {
	mode: StripeMode;
	secretKey: string | undefined;
	webhookSecret: string | undefined;
	priceIdProMonthly: string | undefined;
} {
	const mode = getStripeMode();
	if (mode === 'test') {
		return {
			mode,
			secretKey: env.STRIPE_SECRET_KEY_TEST,
			webhookSecret: env.STRIPE_WEBHOOK_SECRET_TEST,
			priceIdProMonthly: env.STRIPE_PRICE_ID_PRO_MONTHLY_TEST
		};
	}
	return {
		mode,
		secretKey: env.STRIPE_SECRET_KEY,
		webhookSecret: env.STRIPE_WEBHOOK_SECRET,
		priceIdProMonthly: env.STRIPE_PRICE_ID_PRO_MONTHLY
	};
}
