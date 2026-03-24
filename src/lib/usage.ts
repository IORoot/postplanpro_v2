import type { Database } from 'better-sqlite3';
import { getTierLimits, type Tier } from '$lib/tiers.js';

export type UsageForMonth = {
	postsSent: number;
	postsScheduled: number;
	callbackInputs: number;
	importOperations: number;
};

/** Current calendar month key (e.g. '2025-03'). */
export function currentMonthKey(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
}

/** Get month key from a date (ISO date or scheduled_at string). */
export function monthKeyFromDate(dateStr: string | null): string | null {
	if (!dateStr) return null;
	const d = new Date(dateStr);
	if (Number.isNaN(d.getTime())) return null;
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
}

/**
 * Get posts sent + scheduled for an account in a given month (from post table).
 * Counts: status='sent' with sent_at in month, plus scheduled_at in month (draft/scheduled).
 */
export function getPostsSentAndScheduledForMonth(
	db: Database,
	accountId: string,
	month: string
): { sent: number; scheduled: number } {
	const start = `${month}-01T00:00:00.000Z`;
	const [y, m] = month.split('-');
	const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
	const end = `${month}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

	const sent = (db
		.prepare(
			`SELECT COUNT(*) as n FROM post WHERE account_id = ? AND status = 'sent' AND sent_at >= ? AND sent_at <= ?`
		)
		.get(accountId, start, end) as { n: number }).n;

	const scheduled = (db
		.prepare(
			`SELECT COUNT(*) as n FROM post WHERE account_id = ? AND scheduled_at >= ? AND scheduled_at <= ?`
		)
		.get(accountId, start, end) as { n: number }).n;

	return { sent, scheduled };
}

/**
 * Get callback_inputs and import_operations for account + month from usage_month table.
 */
export function getUsageMonthRow(
	db: Database,
	accountId: string,
	month: string
): { callback_inputs: number; import_operations: number } {
	const row = db
		.prepare('SELECT callback_inputs, import_operations FROM usage_month WHERE account_id = ? AND month = ?')
		.get(accountId, month) as { callback_inputs: number; import_operations: number } | undefined;
	return {
		callback_inputs: row?.callback_inputs ?? 0,
		import_operations: row?.import_operations ?? 0
	};
}

/**
 * Get full usage for an account for a given month.
 */
export function getUsageForMonth(
	db: Database,
	accountId: string,
	month: string
): UsageForMonth {
	const { sent, scheduled } = getPostsSentAndScheduledForMonth(db, accountId, month);
	const { callback_inputs, import_operations } = getUsageMonthRow(db, accountId, month);
	return {
		postsSent: sent,
		postsScheduled: scheduled,
		callbackInputs: callback_inputs,
		importOperations: import_operations
	};
}

/**
 * Increment callback_inputs and/or import_operations for account + month.
 * Creates row if not exists.
 */
export function incrementUsageMonth(
	db: Database,
	accountId: string,
	month: string,
	delta: { callbackInputs?: number; importOperations?: number }
): void {
	const cb = delta.callbackInputs ?? 0;
	const imp = delta.importOperations ?? 0;
	if (cb === 0 && imp === 0) return;

	db.prepare(
		`INSERT INTO usage_month (account_id, month, callback_inputs, import_operations)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(account_id, month) DO UPDATE SET
       callback_inputs = callback_inputs + excluded.callback_inputs,
       import_operations = import_operations + excluded.import_operations`
	).run(accountId, month, cb, imp);
}

/**
 * Check if account can add one more post scheduled for the given month (sent + scheduled + 1 <= limit).
 */
export function canSchedulePostInMonth(
	db: Database,
	accountId: string,
	month: string,
	tier: string
): { allowed: boolean; reason?: string } {
	const limits = getTierLimits(tier);
	if (limits.postsSentPerMonth === null) return { allowed: true };
	const { sent, scheduled } = getPostsSentAndScheduledForMonth(db, accountId, month);
	const total = sent + scheduled + 1;
	if (total > limits.postsSentPerMonth) {
		return {
			allowed: false,
			reason: `Post limit for this month (${limits.postsSentPerMonth}) would be exceeded (${sent} sent, ${scheduled} scheduled).`
		};
	}
	return { allowed: true };
}

/**
 * Check if account can add callback_inputs and one import operation this month.
 */
export function canUseCallbackImport(
	db: Database,
	accountId: string,
	month: string,
	tier: string,
	itemCount: number
): { allowed: boolean; reason?: string } {
	const limits = getTierLimits(tier);
	if (limits.callbackInputsPerMonth === null && limits.importOperationsPerMonth === null) {
		return { allowed: true };
	}
	const { callback_inputs, import_operations } = getUsageMonthRow(db, accountId, month);
	if (limits.callbackInputsPerMonth !== null && callback_inputs + itemCount > limits.callbackInputsPerMonth) {
		return {
			allowed: false,
			reason: `Callback inputs limit for this month (${limits.callbackInputsPerMonth}) would be exceeded.`
		};
	}
	if (limits.importOperationsPerMonth !== null && import_operations + 1 > limits.importOperationsPerMonth) {
		return {
			allowed: false,
			reason: `Import operations limit for this month (${limits.importOperationsPerMonth}) would be exceeded.`
		};
	}
	return { allowed: true };
}

/**
 * Check if account can run one more import operation this month (bulk or callback).
 */
export function canRunImportOperation(
	db: Database,
	accountId: string,
	month: string,
	tier: string
): { allowed: boolean; reason?: string } {
	const limits = getTierLimits(tier);
	if (limits.importOperationsPerMonth === null) return { allowed: true };
	const { import_operations } = getUsageMonthRow(db, accountId, month);
	if (import_operations + 1 > limits.importOperationsPerMonth) {
		return {
			allowed: false,
			reason: `Import operations limit for this month (${limits.importOperationsPerMonth}) would be exceeded.`
		};
	}
	return { allowed: true };
}

/**
 * For bulk create: check import operation limit and posts limit per month.
 * newPostsByMonth: map of month key -> count of new posts that will be scheduled in that month.
 */
export function canBulkCreate(
	db: Database,
	accountId: string,
	tier: string,
	newPostsByMonth: Record<string, number>
): { allowed: boolean; reason?: string } {
	const limits = getTierLimits(tier);
	const month = currentMonthKey();

	if (limits.importOperationsPerMonth !== null) {
		const { import_operations } = getUsageMonthRow(db, accountId, month);
		if (import_operations + 1 > limits.importOperationsPerMonth) {
			return {
				allowed: false,
				reason: `Import operations limit for this month (${limits.importOperationsPerMonth}) would be exceeded.`
			};
		}
	}

	if (limits.postsSentPerMonth === null) return { allowed: true };
	for (const [m, addCount] of Object.entries(newPostsByMonth)) {
		if (addCount <= 0) continue;
		const { sent, scheduled } = getPostsSentAndScheduledForMonth(db, accountId, m);
		if (sent + scheduled + addCount > limits.postsSentPerMonth) {
			return {
				allowed: false,
				reason: `Post limit for ${m} (${limits.postsSentPerMonth}) would be exceeded (${sent} sent, ${scheduled} scheduled, +${addCount} new).`
			};
		}
	}
	return { allowed: true };
}
