import { requireAdmin } from '$lib/admin.js';
import { getDatabase } from '$lib/db/index.js';
import { DEFAULT_MANUAL_POST_COLOR } from '$lib/postColors.js';
import { ensureValidTimeZone, localDateTimeToUtcIso } from '$lib/server/timezone.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const MAX_POST_COUNT = 100000;
const HIGH_VOLUME_CONFIRM_THRESHOLD = 1000;
const MIN_START_OFFSET_MS = 60_000;
const MAX_INTERVAL_SECONDS = 3600;
const LOAD_TEST_WEBHOOK_NAME = 'Load Test Target';
const HIGH_VOLUME_CONFIRM_TEXT = 'RUN LOAD TEST';

function formatLocalDateTimeInput(date: Date): string {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, '0');
	const dd = String(date.getDate()).padStart(2, '0');
	const hh = String(date.getHours()).padStart(2, '0');
	const min = String(date.getMinutes()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function isValidWebhookUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

function parseWholeInt(raw: FormDataEntryValue | null): number | null {
	const text = String(raw ?? '').trim();
	if (!text) return null;
	const n = Number(text);
	if (!Number.isInteger(n)) return null;
	return n;
}

export const load: PageServerLoad = async (event) => {
	const accountId = requireAdmin(event);
	const db = getDatabase();
	const userRow = db.prepare('SELECT timezone FROM user WHERE id = ?').get(accountId) as { timezone: string | null } | undefined;
	const userTimezone = ensureValidTimeZone(userRow?.timezone);

	const minStartAt = formatLocalDateTimeInput(new Date(Date.now() + MIN_START_OFFSET_MS));
	return {
		userTimezone,
		minStartAt,
		defaults: {
			postCount: '100',
			intervalSeconds: '0'
		},
		constraints: {
			maxPostCount: MAX_POST_COUNT,
			highVolumeThreshold: HIGH_VOLUME_CONFIRM_THRESHOLD,
			highVolumeConfirmText: HIGH_VOLUME_CONFIRM_TEXT,
			maxIntervalSeconds: MAX_INTERVAL_SECONDS
		}
	};
};

export const actions: Actions = {
	createRun: async (event) => {
		const accountId = requireAdmin(event);
		const db = getDatabase();
		const userRow = db.prepare('SELECT timezone FROM user WHERE id = ?').get(accountId) as { timezone: string | null } | undefined;
		const userTimezone = ensureValidTimeZone(userRow?.timezone);

		const form = await event.request.formData();
		const webhookUrl = String(form.get('webhookUrl') ?? '').trim();
		const postCount = parseWholeInt(form.get('postCount'));
		const intervalSeconds = parseWholeInt(form.get('intervalSeconds')) ?? 0;
		const startAtLocal = String(form.get('startAt') ?? '').trim();
		const highVolumeConfirm = String(form.get('highVolumeConfirm') ?? '').trim();

		if (!isValidWebhookUrl(webhookUrl)) {
			return fail(400, { error: 'Enter a valid webhook URL (http/https).' });
		}
		if (postCount === null || postCount < 1 || postCount > MAX_POST_COUNT) {
			return fail(400, { error: `Post count must be between 1 and ${MAX_POST_COUNT}.` });
		}
		if (intervalSeconds < 0 || intervalSeconds > MAX_INTERVAL_SECONDS) {
			return fail(400, { error: `Interval must be between 0 and ${MAX_INTERVAL_SECONDS} seconds.` });
		}
		if (!startAtLocal) {
			return fail(400, { error: 'Start date/time is required.' });
		}

		const startAtUtc = localDateTimeToUtcIso(startAtLocal, userTimezone);
		if (!startAtUtc) {
			return fail(400, { error: 'Invalid start date/time for your timezone.' });
		}
		const startAtMs = Date.parse(startAtUtc);
		if (!Number.isFinite(startAtMs)) {
			return fail(400, { error: 'Invalid start date/time.' });
		}
		if (startAtMs < Date.now() + MIN_START_OFFSET_MS) {
			return fail(400, { error: 'Start date/time must be at least 1 minute in the future.' });
		}
		if (postCount >= HIGH_VOLUME_CONFIRM_THRESHOLD && highVolumeConfirm !== HIGH_VOLUME_CONFIRM_TEXT) {
			return fail(400, {
				error: `For ${HIGH_VOLUME_CONFIRM_THRESHOLD}+ posts, type "${HIGH_VOLUME_CONFIRM_TEXT}" to confirm.`
			});
		}

		const existingWebhook = db
			.prepare('SELECT id FROM webhook_config WHERE account_id = ? AND url = ? ORDER BY name = ? DESC, name ASC LIMIT 1')
			.get(accountId, webhookUrl, LOAD_TEST_WEBHOOK_NAME) as { id: string } | undefined;
		const webhookId = existingWebhook?.id ?? crypto.randomUUID();
		if (!existingWebhook) {
			db.prepare('INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)').run(
				webhookId,
				accountId,
				LOAD_TEST_WEBHOOK_NAME,
				webhookUrl
			);
		}

		const nowIso = new Date().toISOString();
		const runId = `loadtest-${nowIso.replaceAll(':', '').replaceAll('.', '')}-${crypto.randomUUID().slice(0, 8)}`;
		const insertPost = db.prepare(
			`INSERT INTO post (id, account_id, webhook_id, schedule_id, title, content, image_url, color, scheduled_at, status)
       VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, ?, 'scheduled')`
		);
		const insertPostWebhook = db.prepare('INSERT OR IGNORE INTO post_webhook (post_id, webhook_id) VALUES (?, ?)');
		const insertField = db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)');

		db.exec('BEGIN TRANSACTION');
		try {
			for (let i = 0; i < postCount; i += 1) {
				const scheduledAt = new Date(startAtMs + i * intervalSeconds * 1000).toISOString();
				const sequence = i + 1;
				const postId = crypto.randomUUID();
				insertPost.run(
					postId,
					accountId,
					webhookId,
					`Load Test ${runId} #${sequence}`,
					`Automated load test post ${sequence} of ${postCount}.`,
					DEFAULT_MANUAL_POST_COLOR,
					scheduledAt
				);
				insertPostWebhook.run(postId, webhookId);
				insertField.run(crypto.randomUUID(), postId, 'load_test_run_id', 'string', runId);
				insertField.run(crypto.randomUUID(), postId, 'load_test_sequence', 'number', String(sequence));
				insertField.run(crypto.randomUUID(), postId, 'load_test_total', 'number', String(postCount));
				insertField.run(crypto.randomUUID(), postId, 'load_test_created_at', 'string', nowIso);
			}
			db.exec('COMMIT');
		} catch (error) {
			db.exec('ROLLBACK');
			throw error;
		}

		const lastScheduledAt = new Date(startAtMs + (postCount - 1) * intervalSeconds * 1000).toISOString();
		return {
			created: true,
			runId,
			postCount,
			webhookUrl,
			intervalSeconds,
			firstScheduledAt: new Date(startAtMs).toISOString(),
			lastScheduledAt
		};
	}
};
