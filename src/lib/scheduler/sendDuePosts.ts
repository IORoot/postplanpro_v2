import { getDatabase } from '$lib/db/index.js';
import { getWebhookIdsForPost } from '$lib/db/postWebhooks.js';
import { buildPostPayload } from '$lib/payload.js';
import { env } from '$env/dynamic/private';
import { utcNowIso } from '$lib/server/timezone.js';

const MAX_RESPONSE_BODY = 50000;
const WEBHOOK_REQUEST_FAILED = 'Webhook request failed';

function isLocalhostBaseUrl(url: string): boolean {
	try {
		const u = new URL(url);
		const host = u.hostname.toLowerCase();
		return host === 'localhost' || host === '127.0.0.1';
	} catch {
		return true;
	}
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

export async function sendDuePosts(): Promise<{ sent: number; failed: number; errors: string[] }> {
	const db = getDatabase();
	const now = utcNowIso();
	const due = db
		.prepare(
			`SELECT id, account_id, webhook_id, title, content, image_url, payload_override, scheduled_at, status
       FROM post
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime(?)
       ORDER BY datetime(scheduled_at)`
		)
		.all(now) as {
		id: string;
		account_id: string;
		webhook_id: string;
		title: string;
		content: string | null;
		image_url: string | null;
		payload_override: string | null;
		scheduled_at: string | null;
		status: string;
	}[];

	const updateSent = db.prepare(
		"UPDATE post SET status = 'sent', sent_at = datetime('now'), error_message = NULL, updated_at = datetime('now') WHERE id = ?"
	);
	const updateFailed = db.prepare(
		"UPDATE post SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
	);

	let sent = 0;
	let failed = 0;
	const errors: string[] = [];

	for (const post of due) {
		const webhookIds = getWebhookIdsForPost(db, post.id, post.webhook_id);
		if (webhookIds.length === 0) {
			updateFailed.run('No webhook configured', post.id);
			failed++;
			errors.push(`Post ${post.id}: No webhook configured`);
			continue;
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
			failed++;
			errors.push(`Post ${post.id}: ${resolved.error}`);
			insertSendLog(db, post.account_id, post.id, post.payload_override ?? '', null, resolved.error, false);
			continue;
		}
		const bodyWithCallback = injectCallbackPayload(
			db,
			resolved.body as Record<string, unknown>,
			post.id,
			post.account_id
		);
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
		if (lastError) {
			updateFailed.run(lastError, post.id);
			failed++;
			errors.push(`Post ${post.id}: ${lastError}`);
		} else {
			updateSent.run(post.id);
			sent++;
		}
	}

	return { sent, failed, errors };
}

export type SendPostResult =
	| { success: true; responseStatus: number; responseBody: string | null }
	| {
			success: false;
			error: string;
			responseStatus: number | null;
			responseBody: string | null;
	  };

export async function sendPost(postId: string, accountId: string): Promise<SendPostResult> {
	const db = getDatabase();
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
	const bodyWithCallback = injectCallbackPayload(
		db,
		resolved.body as Record<string, unknown>,
		post.id,
		accountId
	);
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
