import { getDatabase } from '$lib/db/index.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = getDatabase();
	const webhooks = db.prepare('SELECT id, name FROM webhook_config ORDER BY name').all() as { id: string; name: string }[];
	const schedules = db.prepare('SELECT id, name FROM schedule ORDER BY name').all() as { id: string; name: string }[];
	return { webhooks, schedules };
};

function getAtPath(obj: unknown, path: string): unknown {
	const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
	let cur: unknown = obj;
	for (const p of parts) {
		if (cur == null) return undefined;
		cur = (cur as Record<string, unknown>)[p];
	}
	return cur;
}

function stringValue(v: unknown): string {
	if (v == null) return '';
	if (typeof v === 'string') return v;
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	return JSON.stringify(v);
}

export const actions: Actions = {
	fetchWordPress: async ({ request }) => {
		const data = await request.formData();
		const siteUrl = (data.get('site_url') as string)?.trim()?.replace(/\/$/, '');
		const auth = (data.get('auth') as string)?.trim() || '';
		const perPage = Math.min(100, Math.max(1, parseInt((data.get('per_page') as string) || '10', 10)));
		if (!siteUrl) return fail(400, { error: 'Site URL is required' });
		const apiUrl = `${siteUrl}/wp-json/wp/v2/posts?per_page=${perPage}&page=1`;
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (auth) headers['Authorization'] = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;
		try {
			const res = await fetch(apiUrl, { headers });
			if (!res.ok) return fail(400, { error: `WordPress API error: ${res.status} ${res.statusText}` });
			const json = (await res.json()) as unknown[];
			return { fetched: true, posts: json.length, sample: json[0] ?? null, site_url: siteUrl, auth, per_page: perPage };
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to fetch';
			return fail(400, { error: msg });
		}
	},
	importFromWordPress: async ({ request }) => {
		const data = await request.formData();
		const siteUrl = (data.get('site_url') as string)?.trim()?.replace(/\/$/, '');
		const auth = (data.get('auth') as string)?.trim() || '';
		const webhookId = data.get('webhook_id') as string;
		const scheduleId = (data.get('schedule_id') as string)?.trim() || null;
		const titlePath = (data.get('title_path') as string)?.trim() || 'title.rendered';
		const contentPath = (data.get('content_path') as string)?.trim() || 'content.rendered';
		const customMappingJson = (data.get('custom_mapping') as string)?.trim() || '[]';
		const perPage = Math.min(100, Math.max(1, parseInt((data.get('per_page') as string) || '20', 10)));
		if (!siteUrl || !webhookId) return fail(400, { error: 'Site URL and webhook are required' });

		let customMapping: { path: string; key: string; type: string }[];
		try {
			customMapping = JSON.parse(customMappingJson) as { path: string; key: string; type: string }[];
		} catch {
			customMapping = [];
		}

		const apiUrl = `${siteUrl}/wp-json/wp/v2/posts?per_page=${perPage}&page=1`;
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (auth) headers['Authorization'] = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;
		let items: unknown[];
		try {
			const res = await fetch(apiUrl, { headers });
			if (!res.ok) return fail(400, { error: `WordPress API error: ${res.status}` });
			items = (await res.json()) as unknown[];
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Fetch failed' });
		}

		const db = getDatabase();
		const insertPost = db.prepare(
			'INSERT INTO post (id, webhook_id, title, content, status) VALUES (?, ?, ?, ?, ?)'
		);
		const insertField = db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)');

		const createdIds: string[] = [];
		const transaction = db.transaction(() => {
			for (const item of items as Record<string, unknown>[]) {
				const title = stringValue(getAtPath(item, titlePath));
				const content = stringValue(getAtPath(item, contentPath));
				const id = crypto.randomUUID();
				insertPost.run(id, webhookId, title || '(no title)', content, 'draft');
				createdIds.push(id);
				for (const m of customMapping) {
					const val = getAtPath(item, m.path);
					const value = m.type === 'json' && val != null ? JSON.stringify(val) : stringValue(val);
					const fieldId = crypto.randomUUID();
					insertField.run(fieldId, id, m.key, m.type, value);
				}
			}
		});
		transaction();

		// Optionally apply schedule
		if (scheduleId && createdIds.length > 0) {
			const slots = db.prepare('SELECT id, scheduled_at, order_index FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index').all(scheduleId) as { id: string; scheduled_at: string; order_index: number }[];
			const scheduleFields = db.prepare('SELECT key, type, value FROM schedule_field WHERE schedule_id = ?').all(scheduleId) as { key: string; type: string; value: string | null }[];
			const updatePost = db.prepare('UPDATE post SET scheduled_at = ?, schedule_id = ?, status = ?, updated_at = datetime("now") WHERE id = ?');
			for (let i = 0; i < Math.min(createdIds.length, slots.length); i++) {
				updatePost.run(slots[i].scheduled_at, scheduleId, 'scheduled', createdIds[i]);
				for (const sf of scheduleFields) {
					const fieldId = crypto.randomUUID();
					db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, createdIds[i], sf.key, sf.type, sf.value ?? '');
				}
			}
		}

		throw redirect(303, `/posts?imported=${createdIds.length}`);
	}
};
