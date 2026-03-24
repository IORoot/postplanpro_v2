import { getDatabase } from '$lib/db/index.js';
import { setPostWebhooks } from '$lib/db/postWebhooks.js';
import { getNextFreeSlot } from '$lib/scheduler/generateSlots.js';
import { DEFAULT_MANUAL_POST_COLOR, normalizePostColor } from '$lib/postColors.js';
import {
	currentMonthKey,
	canUseCallbackImport,
	incrementUsageMonth,
	getPostsSentAndScheduledForMonth,
	monthKeyFromDate
} from '$lib/usage.js';
import { getTierLimits } from '$lib/tiers.js';
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
	color?: unknown;
	colour?: unknown;
	schedule_ids?: unknown;
	schedule_specific?: unknown;
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
		.prepare('SELECT id, tier FROM user WHERE callback_token = ?')
		.get(token) as { id: string; tier: string } | undefined;
	if (!user) {
		return json({ error: 'Invalid callback token.' }, { status: 401 });
	}
	const accountId = user.id;
	const tier = user.tier ?? 'free';

	let body: ImportPayload;
	try {
		body = (await request.json()) as ImportPayload;
	} catch {
		return json({ error: 'Invalid JSON body.' }, { status: 400 });
	}

	if (!Array.isArray(body.posts) || body.posts.length === 0) {
		return json({ error: 'Body must include a non-empty "posts" array.' }, { status: 400 });
	}

	const month = currentMonthKey();
	const limitCheck = canUseCallbackImport(db, accountId, month, tier, body.posts.length);
	if (!limitCheck.allowed) {
		return json({ error: limitCheck.reason ?? 'Usage limit exceeded for this month.' }, { status: 403 });
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
		'INSERT INTO post (id, account_id, webhook_id, schedule_id, title, content, image_url, color, scheduled_at, status, import_source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
	);
	const insertField = db.prepare(
		'INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)'
	);
	const existingBySource = db.prepare(
		'SELECT 1 FROM post WHERE account_id = ? AND import_source_id = ? LIMIT 1'
	);

	const createdIds: string[] = [];
	const limits = getTierLimits(tier);
	const postsPerMonthInBatch = new Map<string, number>();

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

			// Color: allow either "color" or "colour"; default to manual post color when missing/invalid.
			const rawColor =
				typeof post.color === 'string'
					? post.color
					: typeof post.colour === 'string'
						? post.colour
						: null;
			const baseColor = normalizePostColor(rawColor) ?? DEFAULT_MANUAL_POST_COLOR;

			const externalId =
				typeof post.external_id === 'string' ? post.external_id.trim() || null : null;

			// Optional scheduling fields
			let scheduleSpecific: string | null = null;
			if (typeof post.schedule_specific === 'string') {
				const trimmed = post.schedule_specific.trim();
				scheduleSpecific = trimmed || null;
			}

			let scheduleIds: string[] = [];
			if (Array.isArray(post.schedule_ids)) {
				scheduleIds = post.schedule_ids
					.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
					.map((v) => v.trim());
			} else if (typeof post.schedule_ids === 'string' && post.schedule_ids.trim()) {
				scheduleIds = [post.schedule_ids.trim()];
			}

			if (scheduleIds.length > 0 && scheduleSpecific) {
				throw new Error(
					`Post at index ${i} cannot have both "schedule_ids" and "schedule_specific".`
				);
			}

			// If scheduleIds is non-empty, we create one post per schedule.
			// Otherwise we create a single post (optionally using schedule_specific).
			const targetScheduleIds = scheduleIds.length > 0 ? scheduleIds : [null];

			for (const scheduleId of targetScheduleIds) {
				let resolvedScheduleId: string | null = null;
				let scheduledAt: string | null = null;
				let status: 'draft' | 'scheduled' = 'draft';
				let colorForPost: string | null = baseColor;

				if (scheduleId) {
					const scheduleRow = db
						.prepare('SELECT id, color FROM schedule WHERE id = ? AND account_id = ?')
						.get(scheduleId, accountId) as { id: string; color: string | null } | undefined;
					if (!scheduleRow) {
						throw new Error(
							`Invalid schedule_id "${scheduleId}" for this account (post index ${i}).`
						);
					}
					resolvedScheduleId = scheduleRow.id;
					if (scheduleRow.color) {
						colorForPost = scheduleRow.color;
					}
					const slot = getNextFreeSlot(scheduleRow.id, undefined, accountId);
					if (!slot) {
						throw new Error(
							`Schedule "${scheduleId}" has no available slots (post index ${i}).`
						);
					}
					scheduledAt = slot;
					status = 'scheduled';
				} else if (scheduleSpecific) {
					const dt = new Date(scheduleSpecific);
					if (Number.isNaN(dt.getTime())) {
						throw new Error(
							`Invalid schedule_specific datetime "${scheduleSpecific}" (post index ${i}).`
						);
					}
					// Store as ISO string; UI already expects ISO-like values for scheduled_at.
					scheduledAt = dt.toISOString();
					status = 'scheduled';
				}

				const importSourceIdForRow =
					externalId && scheduleIds.length > 0
						? `import-callback:${primaryWebhookId}:${externalId}:${resolvedScheduleId ?? 'no-schedule'}`
						: externalId
							? `import-callback:${primaryWebhookId}:${externalId}`
							: null;

				if (importSourceIdForRow) {
					const exists = existingBySource.get(accountId, importSourceIdForRow) as
						| { 1: number }
						| undefined;
					if (exists) continue;
				}

				if (limits.postsSentPerMonth != null && scheduledAt) {
					const month = monthKeyFromDate(scheduledAt);
					if (month) {
						const { sent, scheduled } = getPostsSentAndScheduledForMonth(db, accountId, month);
						const batchInMonth = postsPerMonthInBatch.get(month) ?? 0;
						if (sent + scheduled + batchInMonth + 1 > limits.postsSentPerMonth) {
							throw new Error(
								`Post limit for ${month} (${limits.postsSentPerMonth}) would be exceeded.`
							);
						}
						postsPerMonthInBatch.set(month, batchInMonth + 1);
					}
				}

				const id = crypto.randomUUID();
				insertPost.run(
					id,
					accountId,
					primaryWebhookId,
					resolvedScheduleId,
					rawTitle,
					content,
					imageUrl,
					colorForPost,
					scheduledAt,
					status,
					importSourceIdForRow
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
		}
	});

	try {
		tx();
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Failed to import posts.';
		return json({ error: msg }, { status: 400 });
	}

	incrementUsageMonth(db, accountId, month, {
		callbackInputs: createdIds.length,
		importOperations: 1
	});

	return json({ ok: true, imported: createdIds.length, post_ids: createdIds });
};

