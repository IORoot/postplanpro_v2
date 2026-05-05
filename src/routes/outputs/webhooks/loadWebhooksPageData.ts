import { getDatabase } from '$lib/db/index.js';

const VALID_PAGE_SIZES = [20, 50, 100, 200] as const;
type PageSize = (typeof VALID_PAGE_SIZES)[number];

function parsePageSize(raw: string | null): PageSize {
	const n = Number(raw);
	return (VALID_PAGE_SIZES.includes(n as PageSize) ? n : 50) as PageSize;
}

function parsePage(raw: string | null): number {
	const n = Number(raw);
	return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Shared with `/outputs` when Vitest or test URLs call that route’s `load` directly. */
export async function loadWebhooksPageData(locals: App.Locals, url?: URL) {
	const accountId = locals.userId;
	if (!accountId) return { webhooks: [], page: 1, pageSize: 50 as PageSize, total: 0 };
	const db = getDatabase();
	const page = parsePage(url?.searchParams.get('page') ?? null);
	const pageSize = parsePageSize(url?.searchParams.get('pageSize') ?? null);
	const total =
		(db.prepare('SELECT COUNT(*) as count FROM webhook_config WHERE account_id = ?').get(accountId) as
			| { count: number }
			| undefined)?.count ?? 0;
	const offset = (page - 1) * pageSize;
	const webhooks = db
		.prepare('SELECT id, name, url, api_key FROM webhook_config WHERE account_id = ? ORDER BY name LIMIT ? OFFSET ?')
		.all(accountId, pageSize, offset) as { id: string; name: string; url: string; api_key: string | null }[];
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
		})),
		page,
		pageSize,
		total
	};
}
