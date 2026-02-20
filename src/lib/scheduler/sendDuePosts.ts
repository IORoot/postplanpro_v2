import { getDatabase } from '$lib/db/index.js';
import { buildPostPayload } from '$lib/payload.js';

const MAX_RESPONSE_BODY = 50000;

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
	const now = new Date().toISOString().slice(0, 19);
	const due = db
		.prepare(
			`SELECT id, account_id, webhook_id, title, content, image_url, payload_override, scheduled_at, status
       FROM post
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
       ORDER BY scheduled_at`
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
		const webhook = db.prepare('SELECT url, api_key FROM webhook_config WHERE id = ? AND account_id = ?').get(post.webhook_id, post.account_id) as {
			url: string;
			api_key: string | null;
		} | undefined;
		if (!webhook) {
			updateFailed.run('Webhook not found', post.id);
			failed++;
			errors.push(`Post ${post.id}: Webhook not found`);
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
		const requestJson = JSON.stringify(resolved.body);
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (webhook.api_key) {
			headers['x-make-apikey'] = webhook.api_key;
		}
		const extraHeaders = db.prepare('SELECT key, value FROM webhook_header WHERE webhook_id = ?').all(post.webhook_id) as { key: string; value: string }[];
		for (const h of extraHeaders) {
			if (h.key.trim()) headers[h.key.trim()] = h.value;
		}

		try {
			const res = await fetch(webhook.url, {
				method: 'POST',
				headers,
				body: requestJson
			});
			const responseBody = await res.text();
			if (res.ok) {
				updateSent.run(post.id);
				sent++;
			} else {
				const errMsg = `${res.status} ${res.statusText}: ${responseBody.slice(0, 200)}`;
				updateFailed.run(errMsg, post.id);
				failed++;
				errors.push(`Post ${post.id}: ${errMsg}`);
			}
			insertSendLog(db, post.account_id, post.id, requestJson, res.status, responseBody, res.ok);
		} catch (e) {
			const errMsg = e instanceof Error ? e.message : 'Request failed';
			updateFailed.run(errMsg, post.id);
			failed++;
			errors.push(`Post ${post.id}: ${errMsg}`);
			insertSendLog(db, post.account_id, post.id, requestJson, null, errMsg, false);
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

	const webhook = db.prepare('SELECT url, api_key FROM webhook_config WHERE id = ? AND account_id = ?').get(post.webhook_id, accountId) as
		| { url: string; api_key: string | null }
		| undefined;
	if (!webhook) {
		db.prepare(
			"UPDATE post SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
		).run('Webhook not found', post.id);
		return { success: false, error: 'Webhook not found', responseStatus: null, responseBody: null };
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

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (webhook.api_key) {
		headers['x-make-apikey'] = webhook.api_key;
	}
	const extraHeaders = db.prepare('SELECT key, value FROM webhook_header WHERE webhook_id = ?').all(post.webhook_id) as { key: string; value: string }[];
	for (const h of extraHeaders) {
		if (h.key.trim()) headers[h.key.trim()] = h.value;
	}

	const resolved = resolveRequestBody(post, fallbackBody);
	if (resolved.error) {
		db.prepare(
			"UPDATE post SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
		).run(resolved.error, post.id);
		insertSendLog(db, accountId, post.id, post.payload_override ?? '', null, resolved.error, false);
		return { success: false, error: resolved.error, responseStatus: null, responseBody: resolved.error };
	}
	const requestJson = JSON.stringify(resolved.body);
	const updateSent = db.prepare(
		"UPDATE post SET status = 'sent', sent_at = datetime('now'), error_message = NULL, updated_at = datetime('now') WHERE id = ?"
	);
	const updateFailed = db.prepare(
		"UPDATE post SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
	);

	try {
		const res = await fetch(webhook.url, { method: 'POST', headers, body: requestJson });
		const responseBody = await res.text();
		if (res.ok) {
			updateSent.run(post.id);
			insertSendLog(db, accountId, post.id, requestJson, res.status, responseBody, true);
			return { success: true, responseStatus: res.status, responseBody };
		}
		const errMsg = `${res.status} ${res.statusText}: ${responseBody.slice(0, 200)}`;
		updateFailed.run(errMsg, post.id);
		insertSendLog(db, accountId, post.id, requestJson, res.status, responseBody, false);
		return { success: false, error: errMsg, responseStatus: res.status, responseBody };
	} catch (e) {
		const errMsg = e instanceof Error ? e.message : 'Request failed';
		updateFailed.run(errMsg, post.id);
		insertSendLog(db, accountId, post.id, requestJson, null, errMsg, false);
		return { success: false, error: errMsg, responseStatus: null, responseBody: errMsg };
	}
}
