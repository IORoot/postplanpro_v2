import { getDatabase } from '$lib/db/index.js';

export function parseHeadersJson(json: string | null | undefined): { key: string; value: string }[] {
	if (!json?.trim()) return [];
	try {
		const arr = JSON.parse(json) as unknown;
		return Array.isArray(arr)
			? arr
					.filter((h): h is { key: string; value: string } => h != null && typeof h === 'object' && typeof (h as { key?: string }).key === 'string')
					.map((h) => ({ key: (h as { key: string }).key, value: String((h as { value?: string }).value ?? '') }))
			: [];
	} catch {
		return [];
	}
}

export function insertWebhookRecord(
	accountId: string,
	name: string,
	url: string,
	api_key: string | null,
	headersJson: string | null | undefined
): { ok: true; id: string } | { ok: false; error: string } {
	const id = crypto.randomUUID();
	const db = getDatabase();
	try {
		db.prepare('INSERT INTO webhook_config (id, account_id, name, url, api_key) VALUES (?, ?, ?, ?, ?)').run(id, accountId, name, url, api_key);
		const headers = parseHeadersJson(headersJson);
		const insertHeader = db.prepare('INSERT INTO webhook_header (id, webhook_id, key, value) VALUES (?, ?, ?, ?)');
		for (const { key, value } of headers) {
			if (key.trim()) insertHeader.run(crypto.randomUUID(), id, key.trim(), value?.trim() ?? '');
		}
	} catch {
		return { ok: false, error: 'Failed to create webhook' };
	}
	return { ok: true, id };
}
