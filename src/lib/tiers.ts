type Tier = 'free' | 'pro' | 'enterprise' | 'admin' | 'blocked';

interface TierLimits {
	postsSentPerMonth: number | null; // null = unlimited
	callbackInputsPerMonth: number | null;
	importOperationsPerMonth: number | null;
}

const LIMITS: Record<Tier, TierLimits> = {
	free: { postsSentPerMonth: 20, callbackInputsPerMonth: 100, importOperationsPerMonth: 100 },
	pro: { postsSentPerMonth: 500, callbackInputsPerMonth: 2000, importOperationsPerMonth: 2000 },
	enterprise: { postsSentPerMonth: null, callbackInputsPerMonth: null, importOperationsPerMonth: null },
	admin: { postsSentPerMonth: null, callbackInputsPerMonth: null, importOperationsPerMonth: null },
	blocked: { postsSentPerMonth: 0, callbackInputsPerMonth: 0, importOperationsPerMonth: 0 }
};

export function getTierLimits(tier: string): TierLimits {
	const t = tier as Tier;
	return LIMITS[t] ?? LIMITS.free;
}

export function isUnlimitedTier(tier: string): boolean {
	const limits = getTierLimits(tier);
	return limits.postsSentPerMonth === null;
}

export function canAccessApp(tier: string): boolean {
	return tier !== 'blocked';
}
