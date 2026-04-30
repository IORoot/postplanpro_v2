import { getDatabase } from '$lib/db/index.js';

const LOCK_KEY = 'cron:send_due_posts:lock';
const DEFAULT_TTL_MS = 120_000;

let inProcessHeld = false;

type LockRecord = {
	holder: string;
	acquired_at: number;
	ttl_ms: number;
};

function readTtlMs(): number {
	const raw = process.env.SENDER_LOCK_TTL_MS;
	const n = raw ? Number.parseInt(raw, 10) : NaN;
	if (!Number.isFinite(n) || n < 1_000) return DEFAULT_TTL_MS;
	return n;
}

function parseLockRecord(value: string | null | undefined): LockRecord | null {
	if (!value) return null;
	try {
		const obj = JSON.parse(value) as Partial<LockRecord>;
		if (typeof obj?.acquired_at === 'number' && typeof obj?.ttl_ms === 'number' && typeof obj?.holder === 'string') {
			return { holder: obj.holder, acquired_at: obj.acquired_at, ttl_ms: obj.ttl_ms };
		}
		return null;
	} catch {
		return null;
	}
}

export type SendLockHandle = { release: () => void };
export type AcquireResult =
	| { ok: true; handle: SendLockHandle }
	| { ok: false; reason: 'in_process_busy' | 'db_busy' };

/**
 * Try to acquire a single-flight lock for `sendDuePosts`. Combines an
 * in-process flag with an `app_setting` row that has a TTL so a crashed run
 * cannot wedge the lock forever, and so two nodes never both run at once.
 */
export function tryAcquireSendLock(holder: string = `pid:${process.pid}`): AcquireResult {
	if (inProcessHeld) {
		return { ok: false, reason: 'in_process_busy' };
	}
	const ttlMs = readTtlMs();
	const db = getDatabase();
	const now = Date.now();

	let acquired = false;
	db.exec('BEGIN IMMEDIATE');
	try {
		const row = db.prepare('SELECT value FROM app_setting WHERE key = ?').get(LOCK_KEY) as
			| { value: string }
			| undefined;
		const existing = parseLockRecord(row?.value);
		const isExpired = !existing || now - existing.acquired_at > existing.ttl_ms;
		if (existing && !isExpired) {
			db.exec('COMMIT');
			return { ok: false, reason: 'db_busy' };
		}
		const record: LockRecord = { holder, acquired_at: now, ttl_ms: ttlMs };
		db.prepare(
			`INSERT INTO app_setting (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
		).run(LOCK_KEY, JSON.stringify(record));
		db.exec('COMMIT');
		acquired = true;
	} catch (e) {
		try {
			db.exec('ROLLBACK');
		} catch {
			/* ignore */
		}
		throw e;
	}

	if (!acquired) return { ok: false, reason: 'db_busy' };
	inProcessHeld = true;

	const release = () => {
		if (!inProcessHeld) return;
		inProcessHeld = false;
		try {
			db.prepare('DELETE FROM app_setting WHERE key = ? AND value LIKE ?').run(
				LOCK_KEY,
				`%"holder":"${holder.replace(/"/g, '\\"')}"%`
			);
		} catch {
			// ignore: lock will TTL-expire if delete fails
		}
	};

	return { ok: true, handle: { release } };
}

/** Test-only: forcibly clear in-process lock (e.g., between vitest cases). */
export function resetSendLockForTesting(): void {
	inProcessHeld = false;
	try {
		const db = getDatabase();
		db.prepare('DELETE FROM app_setting WHERE key = ?').run(LOCK_KEY);
	} catch {
		// ignore
	}
}
