import type Database from 'better-sqlite3';
import { getDatabase } from '$lib/db/index.js';
import { getWebhookIdsForPost } from '$lib/db/postWebhooks.js';
import { buildPostPayload } from '$lib/payload.js';
import { env } from '$env/dynamic/private';
import { utcNowIso } from '$lib/server/timezone.js';
import { currentMonthKey, isOutputSendQuotaBlockedForMonth } from '$lib/usage.js';
import { getTierLimits } from '$lib/tiers.js';
import { readSenderSettingsWithFallback } from '$lib/server/senderSettings.js';

const MAX_RESPONSE_BODY = 50000;
const WEBHOOK_REQUEST_FAILED = 'Webhook request failed';

async function runWithConcurrency<T, R>(
	items: T[],
	limit: number,
	worker: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let cursor = 0;
	const lanes = Math.min(Math.max(1, limit), items.length);
	const runners: Promise<void>[] = [];
	for (let i = 0; i < lanes; i++) {
		runners.push(
			(async () => {
				while (true) {
					const idx = cursor++;
					if (idx >= items.length) return;
					results[idx] = await worker(items[idx]);
				}
			})()
		);
	}
	await Promise.all(runners);
	return results;
}

/**
 * Per-account async mutex so quota checks + send_log writes for the same
 * account remain strictly sequential. Different accounts still run in
 * parallel, preserving throughput on multi-tenant load.
 */
function createAccountMutex() {
	const tail = new Map<string, Promise<void>>();
	return async function withAccountLock<R>(accountId: string, fn: () => Promise<R>): Promise<R> {
		const previous = tail.get(accountId) ?? Promise.resolve();
		let release!: () => void;
		const next = new Promise<void>((resolve) => {
			release = resolve;
		});
		tail.set(accountId, previous.then(() => next));
		await previous;
		try {
			return await fn();
		} finally {
			release();
			if (tail.get(accountId) === previous.then(() => next)) {
				// Best-effort cleanup; if a newer entry took over since, leave it.
				tail.delete(accountId);
			}
		}
	};
}

function isLocalhostBaseUrl(url: string): boolean {
	try {
		const u = new URL(url);
		const host = u.hostname.toLowerCase();
		return host === 'localhost' || host === '127.0.0.1';
	} catch {
		return true;
	}
}

/** Display name for webhooks: `user.name` when set, otherwise `user.email`. */
function accountNameForWebhook(
	db: ReturnType<typeof getDatabase>,
	accountId: string
): string {
	const row = db.prepare('SELECT name, email FROM user WHERE id = ?').get(accountId) as
		| { name: string | null; email: string | null }
		| undefined;
	const trimmed = row?.name?.trim();
	if (trimmed) return trimmed;
	return row?.email ?? '';
}

/** Adds `account_name` on every outbound webhook body (after payload / override). */
function mergeAccountNameIntoBody(
	db: ReturnType<typeof getDatabase>,
	body: Record<string, unknown>,
	accountId: string
): Record<string, unknown> {
	return { ...body, account_name: accountNameForWebhook(db, accountId) };
}

/** Merge id and optional callback_url into the body sent to Make.com. */
function injectCallbackPayload(
	db: ReturnType<typeof getDatabase>,
	body: Record<string, unknown>,
	postId: string,
	accountId: string
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...body, id: postId };
	const baseUrl = env.APP_BASE_URL?.trim();
	if (!baseUrl) return out;
	if (isLocalhostBaseUrl(baseUrl)) return out;
	const user = db.prepare('SELECT callback_token FROM user WHERE id = ?').get(accountId) as {
		callback_token: string | null;
	} | undefined;
	const token = user?.callback_token?.trim();
	if (!token) return out;
	out.callback_url = baseUrl.replace(/\/$/, '') + '/api/callbacks/stage';
	return out;
}

function insertSendLog(
	db: ReturnType<typeof getDatabase>,
	accountId: string,
	postId: string,
	requestJson: string,
	responseStatus: number | null,
	responseBody: string | null,
	success: boolean
) {
	const id = crypto.randomUUID();
	db.prepare(
		`INSERT INTO send_log (id, account_id, post_id, sent_at, request_json, response_status, response_body, success)
     VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)`
	).run(
		id,
		accountId,
		postId,
		requestJson,
		responseStatus ?? null,
		responseBody != null ? responseBody.slice(0, MAX_RESPONSE_BODY) : null,
		success ? 1 : 0
	);
}

function resolveRequestBody(
	post: { id: string; payload_override: string | null },
	fallback: Record<string, unknown>
): { body: unknown; error: string | null } {
	if (!post.payload_override) return { body: fallback, error: null };
	try {
		return { body: JSON.parse(post.payload_override), error: null };
	} catch {
		return { body: fallback, error: 'Payload override is invalid JSON' };
	}
}

type DuePost = {
	id: string;
	account_id: string;
	webhook_id: string | null;
	title: string;
	content: string | null;
	image_url: string | null;
	payload_override: string | null;
	scheduled_at: string | null;
	status: string;
};

/**
 * Atomically claim up to `limit` due posts by flipping their status from
 * 'scheduled' to 'sending' inside a single immediate transaction. Returns the
 * full row data needed to dispatch each post.
 */
function claimDuePostsBatch(
	db: ReturnType<typeof getDatabase>,
	now: string,
	limit: number
): DuePost[] {
	const selectIds = db.prepare(
		`SELECT id FROM post
     WHERE status = 'scheduled'
       AND scheduled_at IS NOT NULL
       AND datetime(scheduled_at) <= datetime(?)
     ORDER BY datetime(scheduled_at)
     LIMIT ?`
	);

	let claimed: DuePost[] = [];
	db.exec('BEGIN IMMEDIATE');
	try {
		const rows = selectIds.all(now, limit) as { id: string }[];
		if (rows.length === 0) {
			db.exec('COMMIT');
			return [];
		}
		const placeholders = rows.map(() => '?').join(',');
		const ids = rows.map((r) => r.id);
		db.prepare(
			`UPDATE post SET status = 'sending', updated_at = datetime('now')
       WHERE status = 'scheduled' AND id IN (${placeholders})`
		).run(...ids);
		claimed = db
			.prepare(
				`SELECT id, account_id, webhook_id, title, content, image_url, payload_override, scheduled_at, status
         FROM post
         WHERE id IN (${placeholders}) AND status = 'sending'`
			)
			.all(...ids) as DuePost[];
		db.exec('COMMIT');
	} catch (e) {
		try {
			db.exec('ROLLBACK');
		} catch {
			/* ignore */
		}
		throw e;
	}
	return claimed;
}

async function dispatchPost(
	db: ReturnType<typeof getDatabase>,
	post: DuePost,
	sendQuotaMonth: string,
	tierFor: (accountId: string) => string,
	updateSent: Database.Statement,
	updateFailed: Database.Statement,
	revertScheduled: Database.Statement
): Promise<{ sent: boolean; failed: boolean; quotaBlocked: boolean; error?: string }> {
	if (isOutputSendQuotaBlockedForMonth(db, post.account_id, sendQuotaMonth, tierFor(post.account_id))) {
		revertScheduled.run(post.id);
		return {
			sent: false,
			failed: false,
			quotaBlocked: true,
			error: `Post ${post.id}: Monthly output send limit reached for ${sendQuotaMonth}; post left scheduled until quota resets or plan upgrades.`
		};
	}
	const webhookIds = getWebhookIdsForPost(db, post.id, post.webhook_id);
	if (webhookIds.length === 0) {
		updateFailed.run('No webhook configured', post.id);
		return { sent: false, failed: true, quotaBlocked: false, error: `Post ${post.id}: No webhook configured` };
	}

	const postFields = db.prepare('SELECT key, type, value FROM post_field WHERE post_id = ?').all(post.id) as {
		key: string;
		type: string;
		value: string | null;
	}[];
	const globals = db.prepare('SELECT key, type, value FROM global_variable WHERE account_id = ?').all(post.account_id) as {
		key: string;
		type: string;
		value: string | null;
	}[];

	const fallbackBody = buildPostPayload(
		{
			title: post.title,
			content: post.content,
			image_url: post.image_url,
			scheduled_at: post.scheduled_at
		},
		postFields,
		globals
	);
	const resolved = resolveRequestBody(post, fallbackBody);
	if (resolved.error) {
		updateFailed.run(resolved.error, post.id);
		insertSendLog(db, post.account_id, post.id, post.payload_override ?? '', null, resolved.error, false);
		return { sent: false, failed: true, quotaBlocked: false, error: `Post ${post.id}: ${resolved.error}` };
	}
	const withAccount = mergeAccountNameIntoBody(db, resolved.body as Record<string, unknown>, post.account_id);
	const bodyWithCallback = injectCallbackPayload(db, withAccount, post.id, post.account_id);
	const requestJson = JSON.stringify(bodyWithCallback);

	let lastError: string | null = null;
	let anySuccess = false;
	for (const wid of webhookIds) {
		const webhook = db.prepare('SELECT url, api_key FROM webhook_config WHERE id = ? AND account_id = ?').get(wid, post.account_id) as {
			url: string;
			api_key: string | null;
		} | undefined;
		if (!webhook) {
			lastError = 'Webhook not found';
			insertSendLog(db, post.account_id, post.id, requestJson, null, lastError, false);
			continue;
		}
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (webhook.api_key) headers['x-make-apikey'] = webhook.api_key;
		const extraHeaders = db.prepare('SELECT key, value FROM webhook_header WHERE webhook_id = ?').all(wid) as { key: string; value: string }[];
		for (const h of extraHeaders) {
			if (h.key.trim()) headers[h.key.trim()] = h.value;
		}
		try {
			const res = await fetch(webhook.url, { method: 'POST', headers, body: requestJson });
			const responseBody = await res.text();
			if (res.ok) anySuccess = true;
			else lastError = WEBHOOK_REQUEST_FAILED;
			insertSendLog(db, post.account_id, post.id, requestJson, res.status, responseBody, res.ok);
		} catch (e) {
			const internalError = e instanceof Error ? e.message : 'Request failed';
			lastError = WEBHOOK_REQUEST_FAILED;
			insertSendLog(db, post.account_id, post.id, requestJson, null, internalError, false);
		}
	}
	if (lastError && !anySuccess) {
		updateFailed.run(lastError, post.id);
		return { sent: false, failed: true, quotaBlocked: false, error: `Post ${post.id}: ${lastError}` };
	}
	updateSent.run(post.id);
	return { sent: true, failed: false, quotaBlocked: false };
}

export async function sendDuePosts(): Promise<{ sent: number; failed: number; errors: string[] }> {
	const db = getDatabase();
	const now = utcNowIso();
	const senderSettings = readSenderSettingsWithFallback();
	const claimLimit = senderSettings.claimBatch;
	const concurrency = senderSettings.concurrency;

	const updateSent = db.prepare(
		"UPDATE post SET status = 'sent', sent_at = datetime('now'), error_message = NULL, updated_at = datetime('now') WHERE id = ?"
	);
	const updateFailed = db.prepare(
		"UPDATE post SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
	);
	const revertScheduled = db.prepare(
		"UPDATE post SET status = 'scheduled', updated_at = datetime('now') WHERE id = ? AND status = 'sending'"
	);
	const tierStmt = db.prepare('SELECT tier FROM user WHERE id = ?');
	function tierFor(accountId: string): string {
		const row = tierStmt.get(accountId) as { tier: string | null } | undefined;
		return row?.tier ?? 'free';
	}
	const sendQuotaMonth = currentMonthKey();

	let sent = 0;
	let failed = 0;
	const errors: string[] = [];

	const withAccountLock = createAccountMutex();
	const unlimitedCache = new Map<string, boolean>();
	function isUnlimitedTier(accountId: string): boolean {
		const cached = unlimitedCache.get(accountId);
		if (cached !== undefined) return cached;
		const limits = getTierLimits(tierFor(accountId));
		const unlimited = limits.postsSentPerMonth === null;
		unlimitedCache.set(accountId, unlimited);
		return unlimited;
	}

	while (true) {
		const claimed = claimDuePostsBatch(db, now, claimLimit);
		if (claimed.length === 0) break;
		const results = await runWithConcurrency(claimed, concurrency, (post) => {
			const dispatch = () =>
				dispatchPost(db, post, sendQuotaMonth, tierFor, updateSent, updateFailed, revertScheduled);
			return isUnlimitedTier(post.account_id) ? dispatch() : withAccountLock(post.account_id, dispatch);
		});
		for (const r of results) {
			if (r.sent) sent++;
			if (r.failed) failed++;
			if (r.error) errors.push(r.error);
		}
		if (claimed.length < claimLimit) break;
	}

	return { sent, failed, errors };
}

type SendPostResult =
	| { success: true; responseStatus: number; responseBody: string | null }
	| {
			success: false;
			error: string;
			responseStatus: number | null;
			responseBody: string | null;
	  };

export async function sendPost(postId: string, accountId: string): Promise<SendPostResult> {
	const db = getDatabase();
	const tierRow = db.prepare('SELECT tier FROM user WHERE id = ?').get(accountId) as { tier: string | null } | undefined;
	const tier = tierRow?.tier ?? 'free';
	const quotaMonth = currentMonthKey();
	if (isOutputSendQuotaBlockedForMonth(db, accountId, quotaMonth, tier)) {
		return {
			success: false,
			error: `Monthly output send limit reached for ${quotaMonth}. Upgrade your plan or wait until next month.`,
			responseStatus: null,
			responseBody: null
		};
	}
	const post = db
		.prepare(
			`SELECT id, account_id, webhook_id, title, content, image_url, payload_override, scheduled_at, status FROM post WHERE id = ? AND account_id = ?`
		)
		.get(postId, accountId) as
		| {
				id: string;
				account_id: string;
				webhook_id: string;
				title: string;
				content: string | null;
				image_url: string | null;
				payload_override: string | null;
				scheduled_at: string | null;
				status: string;
		  }
		| undefined;
	if (!post) return { success: false, error: 'Post not found', responseStatus: null, responseBody: null };

	const webhookIds = getWebhookIdsForPost(db, post.id, post.webhook_id);
	if (webhookIds.length === 0) {
		db.prepare(
			"UPDATE post SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
		).run('No webhook configured', post.id);
		return { success: false, error: 'No webhook configured', responseStatus: null, responseBody: null };
	}

	const postFields = db.prepare('SELECT key, type, value FROM post_field WHERE post_id = ?').all(post.id) as {
		key: string;
		type: string;
		value: string | null;
	}[];
	const globals = db.prepare('SELECT key, type, value FROM global_variable WHERE account_id = ?').all(accountId) as {
		key: string;
		type: string;
		value: string | null;
	}[];

	const fallbackBody = buildPostPayload(
		{
			title: post.title,
			content: post.content,
			image_url: post.image_url,
			scheduled_at: post.scheduled_at
		},
		postFields,
		globals
	);

	const resolved = resolveRequestBody(post, fallbackBody);
	if (resolved.error) {
		db.prepare(
			"UPDATE post SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
		).run(resolved.error, post.id);
		insertSendLog(db, accountId, post.id, post.payload_override ?? '', null, resolved.error, false);
		return { success: false, error: resolved.error, responseStatus: null, responseBody: resolved.error };
	}
	const withAccount = mergeAccountNameIntoBody(db, resolved.body as Record<string, unknown>, accountId);
	const bodyWithCallback = injectCallbackPayload(db, withAccount, post.id, accountId);
	const requestJson = JSON.stringify(bodyWithCallback);
	const updateSent = db.prepare(
		"UPDATE post SET status = 'sent', sent_at = datetime('now'), error_message = NULL, updated_at = datetime('now') WHERE id = ?"
	);
	const updateFailed = db.prepare(
		"UPDATE post SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
	);

	let lastStatus: number | null = null;
	let lastBody: string | null = null;
	let lastError: string | null = null;
	for (const wid of webhookIds) {
		const webhook = db.prepare('SELECT url, api_key FROM webhook_config WHERE id = ? AND account_id = ?').get(wid, accountId) as
			| { url: string; api_key: string | null }
			| undefined;
		if (!webhook) {
			lastError = 'Webhook not found';
			insertSendLog(db, accountId, post.id, requestJson, null, lastError, false);
			continue;
		}
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (webhook.api_key) headers['x-make-apikey'] = webhook.api_key;
		const extraHeaders = db.prepare('SELECT key, value FROM webhook_header WHERE webhook_id = ?').all(wid) as { key: string; value: string }[];
		for (const h of extraHeaders) {
			if (h.key.trim()) headers[h.key.trim()] = h.value;
		}
		try {
			const res = await fetch(webhook.url, { method: 'POST', headers, body: requestJson });
			const responseBody = await res.text();
			lastStatus = res.status;
			lastBody = responseBody;
			insertSendLog(db, accountId, post.id, requestJson, res.status, responseBody, res.ok);
			if (!res.ok) lastError = WEBHOOK_REQUEST_FAILED;
		} catch (e) {
			const internalError = e instanceof Error ? e.message : 'Request failed';
			lastError = WEBHOOK_REQUEST_FAILED;
			lastStatus = null;
			lastBody = null;
			insertSendLog(db, accountId, post.id, requestJson, null, internalError, false);
		}
	}
	if (lastError) {
		updateFailed.run(lastError, post.id);
		return { success: false, error: lastError, responseStatus: lastStatus, responseBody: lastBody };
	}
	updateSent.run(post.id);
	return { success: true, responseStatus: lastStatus ?? 200, responseBody: lastBody };
}
