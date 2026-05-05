import { getDatabase } from '$lib/db/index.js';
import { insertWebhookRecord, parseHeadersJson } from '$lib/db/webhookMutations.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadWebhooksPageData } from './loadWebhooksPageData.js';

export const load: PageServerLoad = async ({ locals, url }) => loadWebhooksPageData(locals, url);

export const actions: Actions = {
	createWebhook: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const url = (data.get('url') as string)?.trim();
		const api_key = (data.get('api_key') as string)?.trim() || null;
		const headersJson = data.get('headers_json') as string;
		if (!name || !url) return fail(400, { error: 'Name and URL are required' });
		const result = insertWebhookRecord(accountId, name, url, api_key, headersJson);
		if (!result.ok) return fail(500, { error: result.error });
		return { success: true, webhookId: result.id };
	},
	updateWebhook: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const id = data.get('id') as string;
		const name = (data.get('name') as string)?.trim();
		const url = (data.get('url') as string)?.trim();
		const api_key_raw = data.get('api_key') as string;
		const headersJson = data.get('headers_json') as string;
		if (!id || !name || !url) return fail(400, { error: 'ID, name and URL are required' });
		const db = getDatabase();
		const updates: (string | null)[] = [name, url];
		const setParts = ['name = ?', 'url = ?'];
		if (api_key_raw !== '' && api_key_raw !== '••••••••') {
			updates.push(api_key_raw);
			setParts.push('api_key = ?');
		}
		updates.push(id);
		db.prepare(`UPDATE webhook_config SET ${setParts.join(', ')} WHERE id = ? AND account_id = ?`).run(...updates, accountId);
		db.prepare('DELETE FROM webhook_header WHERE webhook_id = ? AND webhook_id IN (SELECT id FROM webhook_config WHERE account_id = ?)').run(id, accountId);
		const headers = parseHeadersJson(headersJson);
		const insertHeader = db.prepare('INSERT INTO webhook_header (id, webhook_id, key, value) VALUES (?, ?, ?, ?)');
		for (const { key, value } of headers) {
			if (key.trim()) insertHeader.run(crypto.randomUUID(), id, key.trim(), value?.trim() ?? '');
		}
		return { success: true };
	},
	deleteWebhook: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		const db = getDatabase();
		const usedByPost = db
			.prepare(
				'SELECT 1 FROM post WHERE account_id = ? AND (webhook_id = ? OR id IN (SELECT post_id FROM post_webhook WHERE webhook_id = ?)) LIMIT 1'
			)
			.get(accountId, id, id);
		if (usedByPost) {
			return fail(400, {
				error: "This webhook can't be removed because it is used by one or more posts. Remove or reassign the webhook from those posts first."
			});
		}
		db.prepare('DELETE FROM webhook_config WHERE id = ? AND account_id = ?').run(id, accountId);
		return { success: true };
	}
};
