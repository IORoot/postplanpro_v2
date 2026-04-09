import { getDatabase } from '$lib/db/index.js';

/** Shared with `/outputs` when Vitest or test URLs call that route’s `load` directly. */
export async function loadWebhooksPageData(locals: App.Locals) {
	const accountId = locals.userId;
	if (!accountId) return { webhooks: [] };
	const db = getDatabase();
	const webhooks = db
		.prepare('SELECT id, name, url, api_key FROM webhook_config WHERE account_id = ? ORDER BY name')
		.all(accountId) as { id: string; name: string; url: string; api_key: string | null }[];
	const headerRows = db
		.prepare(
			'SELECT h.id, h.webhook_id, h.key, h.value FROM webhook_header h JOIN webhook_config w ON w.id = h.webhook_id WHERE w.account_id = ? ORDER BY h.key'
		)
		.all(accountId) as { id: string; webhook_id: string; key: string; value: string }[];
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
		}))
	};
}
