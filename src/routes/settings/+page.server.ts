import { getDatabase } from '$lib/db/index.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function parseHeadersJson(json: string | null | undefined): { key: string; value: string }[] {
	if (!json?.trim()) return [];
	try {
		const arr = JSON.parse(json) as unknown;
		return Array.isArray(arr) ? arr.filter((h): h is { key: string; value: string } => h != null && typeof h === 'object' && typeof (h as { key?: string }).key === 'string').map((h) => ({ key: (h as { key: string }).key, value: String((h as { value?: string }).value ?? '') })) : [];
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async () => {
	const db = getDatabase();
	const webhooks = db.prepare('SELECT id, name, url, api_key FROM webhook_config ORDER BY name').all() as {
		id: string;
		name: string;
		url: string;
		api_key: string | null;
	}[];
	const headerRows = db.prepare('SELECT id, webhook_id, key, value FROM webhook_header ORDER BY key').all() as {
		id: string;
		webhook_id: string;
		key: string;
		value: string;
	}[];
	const headersByWebhook = new Map<string, { id: string; key: string; value: string }[]>();
	for (const h of headerRows) {
		const list = headersByWebhook.get(h.webhook_id) ?? [];
		list.push({ id: h.id, key: h.key, value: h.value });
		headersByWebhook.set(h.webhook_id, list);
	}
	return {
		webhooks: webhooks.map((w) => ({
			...w,
			api_key: w.api_key ? '••••••••' : null,
			headers: headersByWebhook.get(w.id) ?? []
		})),
		globals: db.prepare('SELECT id, key, value, type FROM global_variable ORDER BY key').all() as {
			id: string;
			key: string;
			value: string | null;
			type: string;
		}[]
	};
};

export const actions: Actions = {
	// Webhooks
	createWebhook: async ({ request }) => {
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const url = (data.get('url') as string)?.trim();
		const api_key = (data.get('api_key') as string)?.trim() || null;
		const headersJson = data.get('headers_json') as string;
		if (!name || !url) return fail(400, { error: 'Name and URL are required' });
		const id = crypto.randomUUID();
		const db = getDatabase();
		try {
			db.prepare('INSERT INTO webhook_config (id, name, url, api_key) VALUES (?, ?, ?, ?)').run(id, name, url, api_key);
			const headers = parseHeadersJson(headersJson);
			const insertHeader = db.prepare('INSERT INTO webhook_header (id, webhook_id, key, value) VALUES (?, ?, ?, ?)');
			for (const { key, value } of headers) {
				if (key.trim()) insertHeader.run(crypto.randomUUID(), id, key.trim(), value?.trim() ?? '');
			}
		} catch (e) {
			return fail(500, { error: 'Failed to create webhook' });
		}
		return { success: true };
	},
	updateWebhook: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		const name = (data.get('name') as string)?.trim();
		const url = (data.get('url') as string)?.trim();
		const api_key_raw = data.get('api_key') as string;
		const headersJson = data.get('headers_json') as string;
		if (!id || !name || !url) return fail(400, { error: 'ID, name and URL are required' });
		const db = getDatabase();
		const updates: [string, unknown][] = [name, url];
		const setParts = ['name = ?', 'url = ?'];
		if (api_key_raw !== '' && api_key_raw !== '••••••••') {
			updates.push(api_key_raw);
			setParts.push('api_key = ?');
		}
		updates.push(id);
		db.prepare(`UPDATE webhook_config SET ${setParts.join(', ')} WHERE id = ?`).run(...updates);
		db.prepare('DELETE FROM webhook_header WHERE webhook_id = ?').run(id);
		const headers = parseHeadersJson(headersJson);
		const insertHeader = db.prepare('INSERT INTO webhook_header (id, webhook_id, key, value) VALUES (?, ?, ?, ?)');
		for (const { key, value } of headers) {
			if (key.trim()) insertHeader.run(crypto.randomUUID(), id, key.trim(), value?.trim() ?? '');
		}
		return { success: true };
	},
	deleteWebhook: async ({ request }) => {
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		getDatabase().prepare('DELETE FROM webhook_config WHERE id = ?').run(id);
		return { success: true };
	},
	// Global variables
	createGlobal: async ({ request }) => {
		const data = await request.formData();
		const key = (data.get('key') as string)?.trim();
		const value = (data.get('value') as string)?.trim() ?? '';
		const type = (data.get('type') as string) || 'string';
		if (!key) return fail(400, { error: 'Key is required' });
		const id = crypto.randomUUID();
		try {
			getDatabase().prepare('INSERT INTO global_variable (id, key, value, type) VALUES (?, ?, ?, ?)').run(id, key, value, type);
		} catch (e) {
			return fail(500, { error: 'Failed to create variable' });
		}
		return { success: true };
	},
	updateGlobal: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		const key = (data.get('key') as string)?.trim();
		const value = (data.get('value') as string)?.trim() ?? '';
		const type = (data.get('type') as string) || 'string';
		if (!id || !key) return fail(400, { error: 'ID and key are required' });
		getDatabase().prepare('UPDATE global_variable SET key = ?, value = ?, type = ? WHERE id = ?').run(key, value, type, id);
		return { success: true };
	},
	deleteGlobal: async ({ request }) => {
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		getDatabase().prepare('DELETE FROM global_variable WHERE id = ?').run(id);
		return { success: true };
	}
};
