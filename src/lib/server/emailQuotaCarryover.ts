import type { Database } from 'better-sqlite3';

/** Same rules as `normalizeEmail` in auth (trim + lowercase). */
export function normalizeQuotaEmail(email: string | null | undefined): string | null {
	if (email == null) return null;
	const t = String(email).trim();
	if (t === '') return null;
	return t.toLowerCase();
}

export function getAccountEmailNorm(db: Database, accountId: string): string | null {
	const row = db.prepare('SELECT email FROM user WHERE id = ?').get(accountId) as { email: string | null } | undefined;
	return normalizeQuotaEmail(row?.email ?? null);
}

export function getEmailQuotaCarryoverForMonth(
	db: Database,
	emailNorm: string,
	month: string
): { output_sends: number; callback_inputs: number; import_operations: number } {
	const row = db
		.prepare(
			`SELECT output_sends, callback_inputs, import_operations
       FROM email_quota_carryover_month WHERE email_norm = ? AND month = ?`
		)
		.get(emailNorm, month) as
		| { output_sends: number; callback_inputs: number; import_operations: number }
		| undefined;
	return {
		output_sends: row?.output_sends ?? 0,
		callback_inputs: row?.callback_inputs ?? 0,
		import_operations: row?.import_operations ?? 0
	};
}

function countSuccessfulSendsInMonth(db: Database, accountId: string, month: string): number {
	return (
		db
			.prepare(
				`SELECT COUNT(*) as n FROM send_log
         WHERE account_id = ? AND success = 1 AND strftime('%Y-%m', sent_at) = ?`
			)
			.get(accountId, month) as { n: number }
	).n;
}

function getUsageMonthRowRaw(
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
 * Before removing a user row, add this account's usage for each affected month onto the normalized-email bucket
 * so re-registration with the same email cannot reset monthly limits.
 */
export function mergeAccountUsageIntoEmailCarryover(
	db: Database,
	accountId: string,
	emailNorm: string | null
): void {
	if (!emailNorm) return;
	const months = new Set<string>();
	const fromLog = db
		.prepare(
			`SELECT DISTINCT strftime('%Y-%m', sent_at) as m FROM send_log
       WHERE account_id = ? AND success = 1`
		)
		.all(accountId) as { m: string }[];
	for (const r of fromLog) {
		if (r.m) months.add(r.m);
	}
	const fromUsage = db
		.prepare('SELECT DISTINCT month as m FROM usage_month WHERE account_id = ?')
		.all(accountId) as { m: string }[];
	for (const r of fromUsage) {
		if (r.m) months.add(r.m);
	}
	const upsert = db.prepare(
		`INSERT INTO email_quota_carryover_month (email_norm, month, output_sends, callback_inputs, import_operations)
     VALUES (@email_norm, @month, @output_sends, @callback_inputs, @import_operations)
     ON CONFLICT(email_norm, month) DO UPDATE SET
       output_sends = email_quota_carryover_month.output_sends + excluded.output_sends,
       callback_inputs = email_quota_carryover_month.callback_inputs + excluded.callback_inputs,
       import_operations = email_quota_carryover_month.import_operations + excluded.import_operations`
	);
	for (const month of months) {
		const output_sends = countSuccessfulSendsInMonth(db, accountId, month);
		const { callback_inputs, import_operations } = getUsageMonthRowRaw(db, accountId, month);
		if (output_sends === 0 && callback_inputs === 0 && import_operations === 0) continue;
		upsert.run({ email_norm: emailNorm, month, output_sends, callback_inputs, import_operations });
	}
}
