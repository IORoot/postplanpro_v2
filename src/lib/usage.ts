import type { Database } from 'better-sqlite3';
import { getTierLimits } from '$lib/tiers.js';
import { getAccountEmailNorm, getEmailQuotaCarryoverForMonth } from '$lib/server/emailQuotaCarryover.js';

export type UsageForMonth = {
	/** Successful outbound webhook deliveries (rows in send_log with success=1). */
	postOutputSends: number;
	/** Posts still queued for output this calendar month (scheduled_at in month, status scheduled|failed). */
	postsQueuedForSend: number;
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

function monthRangeIso(month: string): { start: string; end: string } {
	const start = `${month}-01T00:00:00.000Z`;
	const [y, m] = month.split('-');
	const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
	const end = `${month}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;
	return { start, end };
}

/**
 * Successful outbound HTTP deliveries this calendar month (send_log.success = 1).
 * Rescheduling a post does not remove past rows — quota reflects actual sends.
 */
function countSuccessfulSendLogRowsForMonth(db: Database, accountId: string, month: string): number {
	return (
		db
			.prepare(
				`SELECT COUNT(*) as n FROM send_log
         WHERE account_id = ? AND success = 1 AND strftime('%Y-%m', sent_at) = ?`
			)
			.get(accountId, month) as { n: number }
	).n;
}

/** Per-account `usage_month` row (no email carryover). `post_sends_override` replaces send_log count for quota when set. */
export type UsageMonthAccountRow = {
	callback_inputs: number;
	import_operations: number;
	post_sends_override: number | null;
};

export function getUsageMonthAccountRow(db: Database, accountId: string, month: string): UsageMonthAccountRow {
	const row = db
		.prepare(
			'SELECT callback_inputs, import_operations, post_sends_override FROM usage_month WHERE account_id = ? AND month = ?'
		)
		.get(accountId, month) as
			| { callback_inputs: number; import_operations: number; post_sends_override: number | null }
			| undefined;
	return {
		callback_inputs: row?.callback_inputs ?? 0,
		import_operations: row?.import_operations ?? 0,
		post_sends_override: row?.post_sends_override ?? null
	};
}

/** Successful sends this month for this account plus any carryover for the account email (after prior account deletes). */
export function getSuccessfulOutputSendCountForMonth(db: Database, accountId: string, month: string): number {
	const fromLog = countSuccessfulSendLogRowsForMonth(db, accountId, month);
	const acct = getUsageMonthAccountRow(db, accountId, month);
	const fromAccount = acct.post_sends_override !== null ? acct.post_sends_override : fromLog;
	const emailNorm = getAccountEmailNorm(db, accountId);
	if (!emailNorm) return fromAccount;
	const carry = getEmailQuotaCarryoverForMonth(db, emailNorm, month);
	return fromAccount + carry.output_sends;
}

/**
 * Posts committed to send in this calendar month but not yet completed (still scheduled or failed retry).
 */
export function getPostsQueuedForOutputSendInMonth(db: Database, accountId: string, month: string): number {
	const { start, end } = monthRangeIso(month);
	return (
		db
			.prepare(
				`SELECT COUNT(*) as n FROM post
         WHERE account_id = ? AND scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at <= ?
           AND status IN ('scheduled', 'failed')`
			)
			.get(accountId, start, end) as { n: number }
	).n;
}

export function getPostQuotaSnapshotForMonth(
	db: Database,
	accountId: string,
	month: string
): { outputSends: number; queuedInMonth: number } {
	return {
		outputSends: getSuccessfulOutputSendCountForMonth(db, accountId, month),
		queuedInMonth: getPostsQueuedForOutputSendInMonth(db, accountId, month)
	};
}

/**
 * @deprecated Prefer getSuccessfulOutputSendCountForMonth / getPostQuotaSnapshotForMonth.
 * Legacy post-table counts (not used for plan quota anymore).
 */
export function getPostsSentAndScheduledForMonth(
	db: Database,
	accountId: string,
	month: string
): { sent: number; scheduled: number } {
	const { start, end } = monthRangeIso(month);
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

function getUsageMonthRowAccountOnly(
	db: Database,
	accountId: string,
	month: string
): { callback_inputs: number; import_operations: number } {
	const r = getUsageMonthAccountRow(db, accountId, month);
	return { callback_inputs: r.callback_inputs, import_operations: r.import_operations };
}

/**
 * Callback/import counts for this account month, plus any carryover for the same normalized email.
 */
export function getUsageMonthRow(
	db: Database,
	accountId: string,
	month: string
): { callback_inputs: number; import_operations: number } {
	const base = getUsageMonthRowAccountOnly(db, accountId, month);
	const emailNorm = getAccountEmailNorm(db, accountId);
	if (!emailNorm) return base;
	const carry = getEmailQuotaCarryoverForMonth(db, emailNorm, month);
	return {
		callback_inputs: base.callback_inputs + carry.callback_inputs,
		import_operations: base.import_operations + carry.import_operations
	};
}

/**
 * Get full usage for an account for a given month.
 */
export function getUsageForMonth(db: Database, accountId: string, month: string): UsageForMonth {
	const postOutputSends = getSuccessfulOutputSendCountForMonth(db, accountId, month);
	const postsQueuedForSend = getPostsQueuedForOutputSendInMonth(db, accountId, month);
	const { callback_inputs, import_operations } = getUsageMonthRow(db, accountId, month);
	return {
		postOutputSends,
		postsQueuedForSend,
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
 * True when this account cannot run another successful output send in the given calendar month
 * (send_log successes already at tier cap).
 */
export function isOutputSendQuotaBlockedForMonth(
	db: Database,
	accountId: string,
	month: string,
	tier: string
): boolean {
	const limits = getTierLimits(tier);
	if (limits.postsSentPerMonth === null) return false;
	return getSuccessfulOutputSendCountForMonth(db, accountId, month) >= limits.postsSentPerMonth;
}

/**
 * Check if account can add one more post scheduled for the given month
 * (successful sends this month + already-queued posts for that month + 1 <= cap).
 */
export function canSchedulePostInMonth(
	db: Database,
	accountId: string,
	month: string,
	tier: string
): { allowed: boolean; reason?: string } {
	const limits = getTierLimits(tier);
	if (limits.postsSentPerMonth === null) return { allowed: true };
	const { outputSends, queuedInMonth } = getPostQuotaSnapshotForMonth(db, accountId, month);
	const total = outputSends + queuedInMonth + 1;
	if (total > limits.postsSentPerMonth) {
		return {
			allowed: false,
			reason: `Post limit for this month (${limits.postsSentPerMonth}) would be exceeded (${outputSends} sends used, ${queuedInMonth} queued).`
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
		const { outputSends, queuedInMonth } = getPostQuotaSnapshotForMonth(db, accountId, m);
		if (outputSends + queuedInMonth + addCount > limits.postsSentPerMonth) {
			return {
				allowed: false,
				reason: `Post limit for ${m} (${limits.postsSentPerMonth}) would be exceeded (${outputSends} sends used, ${queuedInMonth} queued, +${addCount} new).`
			};
		}
	}
	return { allowed: true };
}
