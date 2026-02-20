import { getDatabase } from '$lib/db/index.js';
import { generateSlots, getNextFreeSlot } from '$lib/scheduler/generateSlots.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const accountId = locals.userId;
	if (!accountId) throw redirect(303, '/auth/login');
	const db = getDatabase();
	const schedule = db.prepare('SELECT * FROM schedule WHERE id = ? AND account_id = ?').get(params.id, accountId) as {
		id: string;
		name: string;
		description: string | null;
		created_at: string;
	} | undefined;
	if (!schedule) throw redirect(303, '/schedules');

	const slots = db.prepare('SELECT id, scheduled_at, order_index FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index').all(params.id) as {
		id: string;
		scheduled_at: string;
		order_index: number;
	}[];

	const rules = db.prepare('SELECT id, type, config, start_at, end_at, order_index FROM schedule_rule WHERE schedule_id = ? ORDER BY order_index').all(params.id) as {
		id: string;
		type: string;
		config: string;
		start_at: string | null;
		end_at: string | null;
		order_index: number;
	}[];

	const fields = db.prepare('SELECT id, key, type, value FROM schedule_field WHERE schedule_id = ? ORDER BY key').all(params.id) as {
		id: string;
		key: string;
		type: string;
		value: string | null;
	}[];

	const posts = db.prepare(`
		SELECT p.id, p.title, p.scheduled_at, p.status, w.name as webhook_name
		FROM post p
		JOIN webhook_config w ON p.webhook_id = w.id
		WHERE p.account_id = ?
		ORDER BY p.created_at DESC
	`).all(accountId) as { id: string; title: string; scheduled_at: string | null; status: string; webhook_name: string }[];

	// Preview next 10 slots from rules (for display)
	let previewSlots: string[] = [];
	if (rules.length > 0) {
		previewSlots = generateSlots(params.id, 10, undefined, accountId);
	}

	// Posts already attached to this schedule (for reschedule section)
	const schedulePosts = db.prepare(`
		SELECT id, title, scheduled_at FROM post WHERE schedule_id = ? AND account_id = ? ORDER BY scheduled_at IS NULL, scheduled_at ASC, created_at ASC
	`).all(params.id, accountId) as { id: string; title: string; scheduled_at: string | null }[];

	return { schedule, slots, rules, fields, posts, previewSlots, schedulePosts };
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const description = (data.get('description') as string)?.trim() || null;
		if (!name) return fail(400, { error: 'Name is required' });

		const db = getDatabase();
		const schedule = db
			.prepare('SELECT id FROM schedule WHERE id = ? AND account_id = ?')
			.get(params.id, accountId) as { id: string } | undefined;
		if (!schedule) return fail(404, { error: 'Schedule not found' });
		db.prepare('UPDATE schedule SET name = ?, description = ? WHERE id = ? AND account_id = ?').run(name, description, params.id, accountId);

		// Replace rules from JSON (when using recurring rules)
		const rulesJson = (data.get('rules_json') as string)?.trim();
		db.prepare('DELETE FROM schedule_rule WHERE schedule_id = ?').run(params.id);
		if (rulesJson) {
			try {
				const rules = JSON.parse(rulesJson) as { type: string; config: Record<string, unknown>; start_at?: string | null; end_at?: string | null }[];
				rules.forEach((r, i) => {
					if (!r.type || !r.config) return;
					const id = crypto.randomUUID();
					db.prepare('INSERT INTO schedule_rule (id, schedule_id, type, config, start_at, end_at, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
						id,
						params.id,
						r.type,
						JSON.stringify(r.config),
						r.start_at || null,
						r.end_at || null,
						i
					);
				});
			} catch {
				// invalid JSON, keep rules empty
			}
		}

		// Replace fixed slots (legacy) from form when no rules
		db.prepare('DELETE FROM schedule_slot WHERE schedule_id = ?').run(params.id);
		if (!rulesJson || rulesJson === '[]') {
			const slotKeys = [...data.entries()].filter(([k]) => k.startsWith('slot_')).map(([k]) => k.replace('slot_', ''));
			const sortedIndices = [...new Set(slotKeys)].map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
			sortedIndices.forEach((idx, i) => {
				const val = (data.get(`slot_${idx}`) as string)?.trim();
				if (!val) return;
				const slotId = crypto.randomUUID();
				db.prepare('INSERT INTO schedule_slot (id, schedule_id, scheduled_at, order_index) VALUES (?, ?, ?, ?)').run(slotId, params.id, val, i);
			});
		}

		// Replace schedule fields
		db.prepare('DELETE FROM schedule_field WHERE schedule_id = ?').run(params.id);
		const fieldKeys = [...data.entries()].filter(([k]) => k.startsWith('field_key_')).map(([k]) => k.replace('field_key_', ''));
		for (const idx of fieldKeys) {
			const key = (data.get(`field_key_${idx}`) as string)?.trim();
			if (!key) continue;
			const type = (data.get(`field_type_${idx}`) as string) || 'string';
			const value = (data.get(`field_value_${idx}`) as string) ?? '';
			const fieldId = crypto.randomUUID();
			db.prepare('INSERT INTO schedule_field (id, schedule_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, params.id, key, type, value);
		}

		throw redirect(303, '/schedules');
	},
	applySchedule: async ({ request, params, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized', action: 'apply' });
		const data = await request.formData();
		const postIdsRaw = data.get('post_ids') as string;
		const postIds = postIdsRaw ? (typeof postIdsRaw === 'string' ? postIdsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []) : [];
		if (postIds.length === 0) return fail(400, { error: 'Select at least one post', action: 'apply' });

		const db = getDatabase();
		const schedule = db
			.prepare('SELECT id FROM schedule WHERE id = ? AND account_id = ?')
			.get(params.id, accountId) as { id: string } | undefined;
		if (!schedule) return fail(404, { error: 'Schedule not found', action: 'apply' });
		const ownedPostCount = db
			.prepare(`SELECT COUNT(*) as n FROM post WHERE account_id = ? AND id IN (${postIds.map(() => '?').join(',')})`)
			.get(accountId, ...postIds) as { n: number };
		if (ownedPostCount.n !== postIds.length) return fail(403, { error: 'One or more selected posts are not accessible.', action: 'apply' });
		const ruleCount = db.prepare('SELECT COUNT(*) as n FROM schedule_rule WHERE schedule_id = ?').get(params.id) as { n: number };
		let slotDatetimes: string[];
		if (ruleCount.n > 0) {
			slotDatetimes = generateSlots(params.id, postIds.length, undefined, accountId);
		} else {
			const slots = db.prepare('SELECT scheduled_at FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index').all(params.id) as { scheduled_at: string }[];
			slotDatetimes = slots.map((s) => s.scheduled_at);
		}
		if (slotDatetimes.length < postIds.length) return fail(400, { error: `Schedule generates ${slotDatetimes.length} slot(s) but ${postIds.length} posts selected. Add more rules/slots or select fewer posts.`, action: 'apply' });

		const scheduleFields = db.prepare('SELECT key, type, value FROM schedule_field WHERE schedule_id = ?').all(params.id) as { key: string; type: string; value: string | null }[];

		const updatePost = db.prepare("UPDATE post SET scheduled_at = ?, schedule_id = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
		for (let i = 0; i < postIds.length; i++) {
			const postId = postIds[i];
			updatePost.run(slotDatetimes[i], params.id, 'scheduled', postId, accountId);
			// Merge schedule fields into post: insert or replace post_field for each schedule field
			for (const sf of scheduleFields) {
				const existing = db.prepare('SELECT id FROM post_field WHERE post_id = ? AND key = ?').get(postId, sf.key) as { id: string } | undefined;
				if (existing) {
					db.prepare('UPDATE post_field SET type = ?, value = ? WHERE id = ?').run(sf.type, sf.value ?? '', existing.id);
				} else {
					const fieldId = crypto.randomUUID();
					db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, postId, sf.key, sf.type, sf.value ?? '');
				}
			}
		}

		return { applied: true, count: postIds.length, action: 'apply' };
	},
	reschedulePosts: async ({ params, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized', action: 'reschedule' });
		const db = getDatabase();
		const schedule = db
			.prepare('SELECT id FROM schedule WHERE id = ? AND account_id = ?')
			.get(params.id, accountId) as { id: string } | undefined;
		if (!schedule) return fail(404, { error: 'Schedule not found.', action: 'reschedule' });
		const ruleCount = db.prepare('SELECT COUNT(*) as n FROM schedule_rule WHERE schedule_id = ?').get(params.id) as { n: number };
		if (ruleCount.n === 0) return fail(400, { error: 'Schedule has no rules. Add rules first, then reschedule.', action: 'reschedule' });

		const posts = db.prepare(`
			SELECT id FROM post WHERE schedule_id = ? AND account_id = ? ORDER BY scheduled_at IS NULL, scheduled_at ASC, created_at ASC
		`).all(params.id, accountId) as { id: string }[];
		if (posts.length === 0) return fail(400, { error: 'No posts are attached to this schedule.', action: 'reschedule' });

		const updatePost = db.prepare("UPDATE post SET scheduled_at = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
		let updated = 0;
		for (const post of posts) {
			const slot = getNextFreeSlot(params.id, post.id, accountId);
			if (slot) {
				updatePost.run(slot, post.id, accountId);
				updated++;
			} else {
				updatePost.run(null, post.id, accountId);
			}
		}
		return { rescheduled: true, count: updated, action: 'reschedule' };
	}
};
