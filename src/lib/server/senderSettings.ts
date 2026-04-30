import { getDatabase } from '$lib/db/index.js';

export const SENDER_SETTING_KEYS = {
	claimBatch: 'sender:claim_batch',
	concurrency: 'sender:concurrency',
	lockTtlMs: 'sender:lock_ttl_ms'
} as const;

export type SenderSettings = {
	claimBatch: number;
	concurrency: number;
	lockTtlMs: number;
};

function parsePositiveInt(raw: string | null | undefined): number | null {
	if (!raw) return null;
	const n = Number.parseInt(raw.trim(), 10);
	if (!Number.isFinite(n) || n < 1) return null;
	return n;
}

function clamp(n: number, min: number, max: number): number {
	return Math.min(Math.max(n, min), max);
}

function getSettingValue(key: string): string | null {
	const db = getDatabase();
	const row = db.prepare('SELECT value FROM app_setting WHERE key = ?').get(key) as
		| { value: string }
		| undefined;
	return row?.value ?? null;
}

export function readSenderSettingsWithFallback(): SenderSettings {
	const claimBatchRaw = getSettingValue(SENDER_SETTING_KEYS.claimBatch) ?? process.env.SENDER_CLAIM_BATCH ?? '';
	const concurrencyRaw = getSettingValue(SENDER_SETTING_KEYS.concurrency) ?? process.env.SENDER_CONCURRENCY ?? '';
	const lockTtlRaw = getSettingValue(SENDER_SETTING_KEYS.lockTtlMs) ?? process.env.SENDER_LOCK_TTL_MS ?? '';

	const claimBatch = clamp(parsePositiveInt(claimBatchRaw) ?? 500, 1, 5000);
	const concurrency = clamp(parsePositiveInt(concurrencyRaw) ?? 25, 1, 200);
	const lockTtlMs = clamp(parsePositiveInt(lockTtlRaw) ?? 120_000, 1_000, 3_600_000);

	return { claimBatch, concurrency, lockTtlMs };
}

export function readSenderSettingsForAdmin(): {
	effective: SenderSettings;
	dbOverrides: { claimBatch: number | null; concurrency: number | null; lockTtlMs: number | null };
} {
	const dbClaimBatch = parsePositiveInt(getSettingValue(SENDER_SETTING_KEYS.claimBatch));
	const dbConcurrency = parsePositiveInt(getSettingValue(SENDER_SETTING_KEYS.concurrency));
	const dbLockTtl = parsePositiveInt(getSettingValue(SENDER_SETTING_KEYS.lockTtlMs));
	return {
		effective: readSenderSettingsWithFallback(),
		dbOverrides: {
			claimBatch: dbClaimBatch,
			concurrency: dbConcurrency,
			lockTtlMs: dbLockTtl
		}
	};
}

export function upsertSenderSettings(settings: SenderSettings): void {
	const db = getDatabase();
	const upsert = db.prepare(
		`INSERT INTO app_setting (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
	);
	upsert.run(SENDER_SETTING_KEYS.claimBatch, String(settings.claimBatch));
	upsert.run(SENDER_SETTING_KEYS.concurrency, String(settings.concurrency));
	upsert.run(SENDER_SETTING_KEYS.lockTtlMs, String(settings.lockTtlMs));
}

export function clearSenderSettingsOverrides(): void {
	const db = getDatabase();
	db.prepare('DELETE FROM app_setting WHERE key IN (?, ?, ?)').run(
		SENDER_SETTING_KEYS.claimBatch,
		SENDER_SETTING_KEYS.concurrency,
		SENDER_SETTING_KEYS.lockTtlMs
	);
}
