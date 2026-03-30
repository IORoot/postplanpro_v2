import { env } from '$env/dynamic/private';

export type StripeMode = 'test' | 'live';

/** When `STRIPE_MODE=test`, use `STRIPE_*_TEST` vars; otherwise use live `STRIPE_*` vars. */
export function getStripeMode(): StripeMode {
	const raw = env.STRIPE_MODE?.trim().toLowerCase();
	return raw === 'test' ? 'test' : 'live';
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
