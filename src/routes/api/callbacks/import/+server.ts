import { getDatabase } from '$lib/db/index.js';
import { setPostWebhooks } from '$lib/db/postWebhooks.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type ImportPost = {
	title?: unknown;
	content?: unknown;
	image_url?: unknown;
	external_id?: unknown;
	fields?: Record<string, unknown>;
	webhook_id?: unknown;
	webhook_ids?: unknown;
};

type ImportPayload = {
	posts?: unknown;
};

export const POST: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('Authorization');
	const headerToken = request.headers.get('X-Callback-Token') ?? request.headers.get('x-callback-token');
	const bearerToken =
		authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
	const token = (bearerToken || headerToken || '').trim();

	if (!token) {
		return json(
			{
				error:
					'Missing callback token. Use Authorization: Bearer <token> or X-Callback-Token: <token>.'
			},
			{ status: 401 }
		);
	}

	const db = getDatabase();
	const user = db
		.prepare('SELECT id FROM user WHERE callback_token = ?')
		.get(token) as { id: string } | undefined;
	if (!user) {
		return json({ error: 'Invalid callback token.' }, { status: 401 });
	}
	const accountId = user.id;

	let body: ImportPayload;
	try {
		body = (await request.json()) as ImportPayload;
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}

	if (!Array.isArray(body.posts) || body.posts.length === 0) {
		return json({ error: 'Body must include a non-empty "posts" array.' }, { status: 400 });
	}

	const posts: ImportPost[] = [];
	for (const raw of body.posts as unknown[]) {
		if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
			return json({ error: 'Each entry in "posts" must be an object.' }, { status: 400 });
		}
		posts.push(raw as ImportPost);
	}

	/** Resolve webhook IDs from a post (webhook_ids array or webhook_id string). */
	function resolvePostWebhookIds(post: ImportPost): string[] {
		const rawIds = post.webhook_ids;
		const rawId = post.webhook_id;
		if (Array.isArray(rawIds) && rawIds.length > 0) {
			return rawIds
				.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
				.map((v) => v.trim());
		}
		if (typeof rawId === 'string' && rawId.trim()) {
			return [rawId.trim()];
		}
		return [];
	}

	const postWebhookIds: string[][] = [];
	for (let i = 0; i < posts.length; i++) {
		const webhookIds = resolvePostWebhookIds(posts[i]);
		if (webhookIds.length === 0) {
			return json(
				{ error: `Post at index ${i} must include "webhook_id" (string) or "webhook_ids" (array of strings).` },
				{ status: 400 }
			);
		}
		for (const wid of webhookIds) {
			const webhook = db
				.prepare('SELECT id FROM webhook_config WHERE id = ? AND account_id = ?')
				.get(wid, accountId) as { id: string } | undefined;
			if (!webhook) {
				return json({ error: `Invalid webhook_id "${wid}" for this account (post index ${i}).` }, { status: 400 });
			}
		}
		postWebhookIds.push(webhookIds);
	}

	const insertPost = db.prepare(
		'INSERT INTO post (id, account_id, webhook_id, title, content, image_url, color, status, import_source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
	);
	const insertField = db.prepare(
		'INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)'
	);
	const existingBySource = db.prepare(
		'SELECT 1 FROM post WHERE account_id = ? AND import_source_id = ? LIMIT 1'
	);

	const createdIds: string[] = [];

	const tx = db.transaction(() => {
		for (let i = 0; i < posts.length; i++) {
			const post = posts[i];
			const webhookIds = postWebhookIds[i];
			const primaryWebhookId = webhookIds[0];

			const rawTitle = typeof post.title === 'string' ? post.title.trim() : '';
			if (!rawTitle) {
				throw new Error('Each post must include a non-empty "title" string.');
			}

			const content =
				typeof post.content === 'string'
					? post.content
					: post.content != null
						? JSON.stringify(post.content)
						: '';

			const imageUrl =
				typeof post.image_url === 'string' ? post.image_url.trim() || null : null;

			const externalId =
				typeof post.external_id === 'string' ? post.external_id.trim() || null : null;

			const importSourceId = externalId
				? `import-callback:${primaryWebhookId}:${externalId}`
				: null;

			if (importSourceId) {
				const exists = existingBySource.get(accountId, importSourceId) as
					| { 1: number }
					| undefined;
				if (exists) continue;
			}

			const id = crypto.randomUUID();
			insertPost.run(
				id,
				accountId,
				primaryWebhookId,
				rawTitle,
				content,
				imageUrl,
				null,
				'draft',
				importSourceId
			);
			createdIds.push(id);

			setPostWebhooks(db, id, accountId, webhookIds);

			const fields = post.fields;
			if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
				for (const [key, value] of Object.entries(fields)) {
					const fieldKey = key.trim();
					if (!fieldKey) continue;
					const fieldId = crypto.randomUUID();
					const valString =
						typeof value === 'string'
							? value
							: value == null
								? ''
								: JSON.stringify(value);
					insertField.run(fieldId, id, fieldKey, 'json', valString);
				}
			}
		}
	});

	try {
		tx();
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Failed to import posts.';
		return json({ error: msg }, { status: 400 });
	}

	return json({ ok: true, imported: createdIds.length, post_ids: createdIds });
};

