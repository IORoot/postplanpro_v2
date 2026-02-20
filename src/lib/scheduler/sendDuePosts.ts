import { getDatabase } from '$lib/db/index.js';

const MAX_RESPONSE_BODY = 50000;

function insertSendLog(
	db: ReturnType<typeof getDatabase>,
	postId: string,
	requestJson: string,
	responseStatus: number | null,
	responseBody: string | null,
	success: boolean
) {
	const id = crypto.randomUUID();
	db.prepare(
		`INSERT INTO send_log (id, post_id, sent_at, request_json, response_status, response_body, success)
     VALUES (?, ?, datetime('now'), ?, ?, ?, ?)`
	).run(
		id,
		postId,
		requestJson,
		responseStatus ?? null,
		responseBody != null ? responseBody.slice(0, MAX_RESPONSE_BODY) : null,
		success ? 1 : 0
	);
}

function parseValue(type: string, value: string | null): unknown {
	if (value == null || value === '') return value;
	switch (type) {
		case 'number':
			return Number(value);
		case 'boolean':
			return value === 'true' || value === '1';
		case 'json':
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		default:
			return value;
	}
}

export async function sendDuePosts(): Promise<{ sent: number; failed: number; errors: string[] }> {
	const db = getDatabase();
	const now = new Date().toISOString().slice(0, 19);
	const due = db
		.prepare(
			`SELECT id, webhook_id, title, content, scheduled_at, status
       FROM post
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
       ORDER BY scheduled_at`
		)
		.all(now) as {
		id: string;
		webhook_id: string;
		title: string;
		content: string | null;
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
		const webhook = db.prepare('SELECT url, api_key FROM webhook_config WHERE id = ?').get(post.webhook_id) as {
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
		const globals = db.prepare('SELECT key, type, value FROM global_variable').all() as {
			key: string;
			type: string;
			value: string | null;
		}[];

		const body: Record<string, unknown> = {
			title: post.title,
			content: post.content,
			scheduled_at: post.scheduled_at
		};
		for (const f of postFields) {
			body[f.key] = parseValue(f.type, f.value);
		}
		for (const g of globals) {
			body[g.key] = parseValue(g.type, g.value);
		}

		const requestJson = JSON.stringify(body);
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
			insertSendLog(db, post.id, requestJson, res.status, responseBody, res.ok);
		} catch (e) {
			const errMsg = e instanceof Error ? e.message : 'Request failed';
			updateFailed.run(errMsg, post.id);
			failed++;
			errors.push(`Post ${post.id}: ${errMsg}`);
			insertSendLog(db, post.id, requestJson, null, errMsg, false);
		}
	}

	return { sent, failed, errors };
}

export type SendPostResult = { success: true } | { success: false; error: string };

export async function sendPost(postId: string): Promise<SendPostResult> {
	const db = getDatabase();
	const post = db
		.prepare(
			`SELECT id, webhook_id, title, content, scheduled_at, status FROM post WHERE id = ?`
		)
		.get(postId) as
		| {
				id: string;
				webhook_id: string;
				title: string;
				content: string | null;
				scheduled_at: string | null;
				status: string;
		  }
		| undefined;
	if (!post) return { success: false, error: 'Post not found' };

	const webhook = db.prepare('SELECT url, api_key FROM webhook_config WHERE id = ?').get(post.webhook_id) as
		| { url: string; api_key: string | null }
		| undefined;
	if (!webhook) {
		db.prepare(
			"UPDATE post SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
		).run('Webhook not found', post.id);
		return { success: false, error: 'Webhook not found' };
	}

	const postFields = db.prepare('SELECT key, type, value FROM post_field WHERE post_id = ?').all(post.id) as {
		key: string;
		type: string;
		value: string | null;
	}[];
	const globals = db.prepare('SELECT key, type, value FROM global_variable').all() as {
		key: string;
		type: string;
		value: string | null;
	}[];

	const body: Record<string, unknown> = {
		title: post.title,
		content: post.content,
		scheduled_at: post.scheduled_at
	};
	for (const f of postFields) body[f.key] = parseValue(f.type, f.value);
	for (const g of globals) body[g.key] = parseValue(g.type, g.value);

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (webhook.api_key) {
		headers['x-make-apikey'] = webhook.api_key;
	}
	const extraHeaders = db.prepare('SELECT key, value FROM webhook_header WHERE webhook_id = ?').all(post.webhook_id) as { key: string; value: string }[];
	for (const h of extraHeaders) {
		if (h.key.trim()) headers[h.key.trim()] = h.value;
	}

	const requestJson = JSON.stringify(body);
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
			insertSendLog(db, post.id, requestJson, res.status, responseBody, true);
			return { success: true };
		}
		const errMsg = `${res.status} ${res.statusText}: ${responseBody.slice(0, 200)}`;
		updateFailed.run(errMsg, post.id);
		insertSendLog(db, post.id, requestJson, res.status, responseBody, false);
		return { success: false, error: errMsg };
	} catch (e) {
		const errMsg = e instanceof Error ? e.message : 'Request failed';
		updateFailed.run(errMsg, post.id);
		insertSendLog(db, post.id, requestJson, null, errMsg, false);
		return { success: false, error: errMsg };
	}
}
