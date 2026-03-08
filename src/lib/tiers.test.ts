import { describe, it, expect } from 'vitest';
import { getTierLimits, isUnlimitedTier, canAccessApp } from './tiers.js';

describe('tiers', () => {
	describe('getTierLimits', () => {
		it('returns free limits', () => {
			const limits = getTierLimits('free');
			expect(limits.postsSentPerMonth).toBe(20);
			expect(limits.callbackInputsPerMonth).toBe(100);
			expect(limits.importOperationsPerMonth).toBe(100);
		});
		it('returns pro limits', () => {
			const limits = getTierLimits('pro');
			expect(limits.postsSentPerMonth).toBe(500);
			expect(limits.callbackInputsPerMonth).toBe(2000);
			expect(limits.importOperationsPerMonth).toBe(2000);
		});
		it('returns unlimited for enterprise and admin', () => {
			expect(getTierLimits('enterprise').postsSentPerMonth).toBeNull();
			expect(getTierLimits('admin').postsSentPerMonth).toBeNull();
		});
		it('returns free for unknown tier', () => {
			const limits = getTierLimits('unknown');
			expect(limits.postsSentPerMonth).toBe(20);
		});
	});
	describe('isUnlimitedTier', () => {
		it('returns false for free and pro', () => {
			expect(isUnlimitedTier('free')).toBe(false);
			expect(isUnlimitedTier('pro')).toBe(false);
		});
		it('returns true for enterprise and admin', () => {
			expect(isUnlimitedTier('enterprise')).toBe(true);
			expect(isUnlimitedTier('admin')).toBe(true);
		});
	});
	describe('canAccessApp', () => {
		it('returns false for blocked', () => {
			expect(canAccessApp('blocked')).toBe(false);
		});
		it('returns true for free, pro, enterprise, admin', () => {
			expect(canAccessApp('free')).toBe(true);
			expect(canAccessApp('pro')).toBe(true);
			expect(canAccessApp('enterprise')).toBe(true);
			expect(canAccessApp('admin')).toBe(true);
		});
	});
});
