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

function parseTemplateFieldsJson(
	json: string | null | undefined
): { key: string; type: string; value: string }[] {
	if (!json?.trim()) return [];
	try {
		const arr = JSON.parse(json) as unknown;
		if (!Array.isArray(arr)) return [];
		return arr
			.filter((f): f is { key: string; type?: string; value?: unknown } => {
				return f != null && typeof f === 'object' && typeof (f as { key?: string }).key === 'string';
			})
			.map((f) => ({
				key: f.key.trim(),
				type:
					f.type === 'number' || f.type === 'boolean' || f.type === 'json' || f.type === 'string'
						? f.type
						: 'string',
				value: String(f.value ?? '')
			}))
			.filter((f) => f.key.length > 0);
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const accountId = locals.userId;
	if (!accountId) return { webhooks: [], globals: [], templates: [] };
	const db = getDatabase();
	const webhooks = db.prepare('SELECT id, name, url, api_key FROM webhook_config WHERE account_id = ? ORDER BY name').all(accountId) as {
		id: string;
		name: string;
		url: string;
		api_key: string | null;
	}[];
	const headerRows = db.prepare('SELECT h.id, h.webhook_id, h.key, h.value FROM webhook_header h JOIN webhook_config w ON w.id = h.webhook_id WHERE w.account_id = ? ORDER BY h.key').all(accountId) as {
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
	const templates = db
		.prepare(
			'SELECT id, name, is_default FROM field_template WHERE account_id = ? OR account_id IS NULL ORDER BY is_default DESC, name'
		)
		.all(accountId) as { id: string; name: string; is_default: number }[];
	const templateFieldsRows = db
		.prepare(
			`SELECT f.template_id, f.key, f.type, f.value, f.order_index
       FROM field_template_field f
       JOIN field_template t ON t.id = f.template_id
       WHERE t.account_id = ? OR t.account_id IS NULL
       ORDER BY t.name, f.order_index`
		)
		.all(accountId) as {
		template_id: string;
		key: string;
		type: string;
		value: string | null;
		order_index: number;
	}[];
	const fieldsByTemplate = new Map<string, { key: string; type: string; value: string }[]>();
	for (const row of templateFieldsRows) {
		const list = fieldsByTemplate.get(row.template_id) ?? [];
		list.push({ key: row.key, type: row.type, value: row.value ?? '' });
		fieldsByTemplate.set(row.template_id, list);
	}

	return {
		webhooks: webhooks.map((w) => ({
			...w,
			api_key: w.api_key ? '••••••••' : null,
			headers: headersByWebhook.get(w.id) ?? []
		})),
		globals: db.prepare('SELECT id, key, value, type FROM global_variable WHERE account_id = ? ORDER BY key').all(accountId) as {
			id: string;
			key: string;
			value: string | null;
			type: string;
		}[],
		templates: templates.map((t) => ({
			...t,
			is_default: t.is_default === 1,
			fields: fieldsByTemplate.get(t.id) ?? []
		}))
	};
};

export const actions: Actions = {
	// Webhooks
	createWebhook: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const url = (data.get('url') as string)?.trim();
		const api_key = (data.get('api_key') as string)?.trim() || null;
		const headersJson = data.get('headers_json') as string;
		if (!name || !url) return fail(400, { error: 'Name and URL are required' });
		const id = crypto.randomUUID();
		const db = getDatabase();
		try {
			db.prepare('INSERT INTO webhook_config (id, account_id, name, url, api_key) VALUES (?, ?, ?, ?, ?)').run(id, accountId, name, url, api_key);
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
		getDatabase().prepare('DELETE FROM webhook_config WHERE id = ? AND account_id = ?').run(id, accountId);
		return { success: true };
	},
	// Global variables
	createGlobal: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const key = (data.get('key') as string)?.trim();
		const value = (data.get('value') as string)?.trim() ?? '';
		const type = (data.get('type') as string) || 'string';
		if (!key) return fail(400, { error: 'Key is required' });
		const id = crypto.randomUUID();
		try {
			getDatabase().prepare('INSERT INTO global_variable (id, account_id, key, value, type) VALUES (?, ?, ?, ?, ?)').run(id, accountId, key, value, type);
		} catch (e) {
			return fail(500, { error: 'Failed to create variable' });
		}
		return { success: true };
	},
	updateGlobal: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const id = data.get('id') as string;
		const key = (data.get('key') as string)?.trim();
		const value = (data.get('value') as string)?.trim() ?? '';
		const type = (data.get('type') as string) || 'string';
		if (!id || !key) return fail(400, { error: 'ID and key are required' });
		getDatabase().prepare('UPDATE global_variable SET key = ?, value = ?, type = ? WHERE id = ? AND account_id = ?').run(key, value, type, id, accountId);
		return { success: true };
	},
	deleteGlobal: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		getDatabase().prepare('DELETE FROM global_variable WHERE id = ? AND account_id = ?').run(id, accountId);
		return { success: true };
	},
	// Custom-field templates
	createTemplate: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const fieldsJson = String(data.get('fields_json') ?? '[]');
		if (!name) return fail(400, { error: 'Template name is required' });
		const fields = parseTemplateFieldsJson(fieldsJson);
		if (fields.length === 0) return fail(400, { error: 'Add at least one template field' });

		const db = getDatabase();
		const templateId = crypto.randomUUID();
		db.prepare(
			'INSERT INTO field_template (id, account_id, name, is_default, created_at) VALUES (?, ?, ?, 0, datetime(\'now\'))'
		).run(templateId, accountId, name);
		const insertField = db.prepare(
			'INSERT INTO field_template_field (id, template_id, key, type, value, order_index) VALUES (?, ?, ?, ?, ?, ?)'
		);
		fields.forEach((field, index) => {
			insertField.run(crypto.randomUUID(), templateId, field.key, field.type, field.value, index);
		});
		return { success: true };
	},
	updateTemplate: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const id = String(data.get('id') ?? '').trim();
		const name = String(data.get('name') ?? '').trim();
		const fieldsJson = String(data.get('fields_json') ?? '[]');
		if (!id || !name) return fail(400, { error: 'Template ID and name are required' });
		const fields = parseTemplateFieldsJson(fieldsJson);
		if (fields.length === 0) return fail(400, { error: 'Add at least one template field' });

		const db = getDatabase();
		const template = db
			.prepare('SELECT id, is_default FROM field_template WHERE id = ? AND (account_id = ? OR account_id IS NULL)')
			.get(id, accountId) as { id: string; is_default: number } | undefined;
		if (!template) return fail(404, { error: 'Template not found' });
		if (template.is_default === 1) {
			return fail(403, { error: 'Default templates cannot be edited.' });
		}

		db.prepare('UPDATE field_template SET name = ? WHERE id = ? AND account_id = ?').run(
			name,
			id,
			accountId
		);
		db.prepare('DELETE FROM field_template_field WHERE template_id = ?').run(id);
		const insertField = db.prepare(
			'INSERT INTO field_template_field (id, template_id, key, type, value, order_index) VALUES (?, ?, ?, ?, ?, ?)'
		);
		fields.forEach((field, index) => {
			insertField.run(crypto.randomUUID(), id, field.key, field.type, field.value, index);
		});
		return { success: true };
	},
	deleteTemplate: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const id = String((await request.formData()).get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Template ID is required' });
		const db = getDatabase();
		const row = db
			.prepare('SELECT is_default FROM field_template WHERE id = ? AND (account_id = ? OR account_id IS NULL)')
			.get(id, accountId) as { is_default: number } | undefined;
		if (!row) return fail(404, { error: 'Template not found' });
		if (row.is_default === 1) return fail(403, { error: 'Default templates cannot be deleted.' });
		db.prepare('DELETE FROM field_template WHERE id = ? AND account_id = ?').run(id, accountId);
		return { success: true };
	}
};
