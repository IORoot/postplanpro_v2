import { getDatabase } from '$lib/db/index.js';
import { randomTailwindPostColor } from '$lib/postColors.js';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const accountId = locals.userId;
	if (!accountId) return { webhooks: [], schedules: [] };
	const db = getDatabase();
	const webhooks = db.prepare('SELECT id, name FROM webhook_config WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];
	const schedules = db.prepare('SELECT id, name FROM schedule WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];
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

type FilterRule = { path: string; operator: string; value?: string };
type FilterConfig = { combine: 'and' | 'or'; rules: FilterRule[] };

function evaluateRule(item: Record<string, unknown>, rule: FilterRule): boolean {
	const raw = getAtPath(item, rule.path);
	const str = stringValue(raw);
	const val = (rule.value ?? '').trim();
	try {
		switch (rule.operator) {
			case 'eq':
				return str === val;
			case 'neq':
				return str !== val;
			case 'contains':
				return str.includes(val);
			case 'not_contains':
				return !str.includes(val);
			case 'regex':
				return val ? new RegExp(val).test(str) : false;
			case 'not_regex':
				return val ? !new RegExp(val).test(str) : true;
			case 'array_contains':
				return Array.isArray(raw) && raw.some((x) => String(x) === val);
			case 'array_not_contains':
				return !Array.isArray(raw) || !raw.some((x) => String(x) === val);
			case 'null':
				return raw === null || raw === undefined;
			case 'not_null':
				return raw !== null && raw !== undefined;
			case 'empty':
				return (
					raw === null ||
					raw === undefined ||
					raw === '' ||
					(Array.isArray(raw) && raw.length === 0) ||
					(typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Object.keys(raw).length === 0)
				);
			case 'not_empty':
				return !(
					raw === null ||
					raw === undefined ||
					raw === '' ||
					(Array.isArray(raw) && raw.length === 0) ||
					(typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Object.keys(raw).length === 0)
				);
			case 'exists':
				return getAtPath(item, rule.path) !== undefined;
			case 'not_exists':
				return getAtPath(item, rule.path) === undefined;
			default:
				return true;
		}
	} catch {
		return false;
	}
}

function evaluateFilter(item: Record<string, unknown>, config: FilterConfig | null): boolean {
	if (!config?.rules?.length) return true;
	const results = config.rules
		.filter((r) => (r.path ?? '').trim() !== '')
		.map((r) => evaluateRule(item, r));
	if (results.length === 0) return true;
	return config.combine === 'and' ? results.every(Boolean) : results.some(Boolean);
}

/** Parse path or transform expression: "path" or "fn(path, ...args)". Returns path and optional transform. */
function parsePathOrTransform(expr: string): { path: string; fn?: string; args?: string[] } {
	expr = expr.trim();
	const fnMatch = expr.match(/^(\w+)\((.*)\)\s*$/s);
	if (!fnMatch) return { path: expr };
	const fn = fnMatch[1];
	const inner = fnMatch[2].trim();
	const args: string[] = [];
	let current = '';
	let inQuote = false;
	let i = 0;
	while (i < inner.length) {
		const c = inner[i];
		if (c === '"' && (i === 0 || inner[i - 1] !== '\\')) {
			inQuote = !inQuote;
			if (!inQuote) {
				args.push(current);
				current = '';
			}
			i++;
		} else if (!inQuote && c === ',') {
			args.push(current.trim());
			current = '';
			i++;
		} else {
			current += c;
			i++;
		}
	}
	if (current.trim()) args.push(current.trim());
	if (args.length === 0) return { path: expr };
	const path = args[0];
	return { path, fn, args: args.slice(1) };
}

function applyTransform(raw: string, fn: string | undefined, args: string[] | undefined): string {
	if (!fn || !args) return raw;
	try {
		switch (fn) {
			case 'removeHtml':
				return raw.replace(/<[^>]*>/g, '');
			case 'regex': {
				const pattern = args[0] ?? '';
				const replacement = args[1];
				const re = new RegExp(pattern, 'g');
				if (replacement !== undefined && replacement !== '') {
					return raw.replace(re, (match, ...groups) => {
						let r = replacement.replace(/\$&/g, match);
						groups.forEach((g, i) => {
							r = r.replace(new RegExp(`\\$${i + 1}`, 'g'), g ?? '');
						});
						return r;
					});
				}
				const m = raw.match(new RegExp(pattern));
				return m ? (m[1] ?? m[0]) : '';
			}
			case 'substring': {
				const start = Math.max(0, parseInt(args[0] ?? '0', 10));
				const lenArg = args[1];
				if (lenArg === undefined || lenArg === '') return raw.slice(start);
				const len = Math.max(0, parseInt(lenArg, 10));
				return raw.slice(start, start + len);
			}
			case 'replace': {
				const search = (args[0] ?? '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
				const replacement = (args[1] ?? '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
				return raw.split(search).join(replacement);
			}
			default:
				return raw;
		}
	} catch {
		return raw;
	}
}

function unescapeNewlines(s: string): string {
	return s.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
}

/** Decode HTML entities (e.g. &#8211; → –, &amp; → &) to proper Unicode characters. */
function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, '\u00A0')
		.replace(/&[#\w]+;/g, (match) => {
			const known: Record<string, string> = {
				'&mdash;': '\u2014',
				'&ndash;': '\u2013',
				'&hellip;': '\u2026',
				'&lsquo;': '\u2018',
				'&rsquo;': '\u2019',
				'&ldquo;': '\u201C',
				'&rdquo;': '\u201D',
				'&copy;': '\u00A9',
				'&reg;': '\u00AE',
				'&trade;': '\u2122',
				'&bull;': '\u2022',
				'&rarr;': '\u2192',
				'&larr;': '\u2190'
			};
			return known[match] ?? match;
		});
}

/** Resolve a path or transform expression against an item and return final string. */
function resolveValue(
	item: Record<string, unknown>,
	expr: string,
	unescapeNewlinesFlag: boolean,
	type: 'string' | 'json'
): string {
	const { path, fn, args } = parsePathOrTransform(expr);
	const raw = getAtPath(item, path);
	let str: string;
	if (type === 'json' && raw != null) {
		str = typeof raw === 'string' ? raw : JSON.stringify(raw);
	} else {
		str = stringValue(raw);
	}
	str = applyTransform(str, fn, args);
	str = decodeHtmlEntities(str);
	if (unescapeNewlinesFlag) str = unescapeNewlines(str);
	return str;
}

/** Normalize site URL: strip /wp-json and trailing slash for consistent API base */
function normalizeSiteUrl(input: string): string {
	return input.trim().replace(/\/wp-json\/?$/i, '').replace(/\/$/, '') || input.trim();
}

type PostTypeOption = { slug: string; name: string; route: string };

/** Fetch wp-json index and return list of post type collection routes. Used so step 2 stays visible after fetch. */
async function discoverPostTypes(siteUrl: string, auth: string): Promise<PostTypeOption[]> {
	const indexUrl = `${siteUrl}/wp-json/`;
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (auth) headers['Authorization'] = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;
	const res = await fetch(indexUrl, { headers });
	if (!res.ok) return [];
	const index = (await res.json()) as { routes?: Record<string, { methods?: string[] }> };
	const routes = index.routes ?? {};
	const postTypes: PostTypeOption[] = [];
	for (const path of Object.keys(routes)) {
		const match = path.match(/^\/wp\/v2\/([^/(]+)$/);
		if (!match) continue;
		const info = routes[path];
		const methods = info?.methods ?? [];
		if (!methods.includes('GET')) continue;
		const slug = match[1];
		const name = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, ' ');
		postTypes.push({ slug, name, route: path });
	}
	postTypes.sort((a, b) => a.slug.localeCompare(b.slug));
	return postTypes;
}

/** Discover post types from WordPress REST API index (GET /wp-json/) */
export const actions: Actions = {
	discoverWordPress: async ({ request, locals }) => {
		if (!locals.userId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const siteUrl = normalizeSiteUrl((data.get('site_url') as string) ?? '');
		const auth = (data.get('auth') as string)?.trim() || '';
		if (!siteUrl) return fail(400, { error: 'Site URL is required' });
		try {
			const postTypes = await discoverPostTypes(siteUrl, auth);
			return {
				discovered: true,
				site_url: siteUrl,
				post_types: postTypes,
				auth
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to fetch';
			return fail(400, { error: msg });
		}
	},
	/** Step 2: Fetch only the first entry from the post type endpoint to discover structure. */
	fetchWordPress: async ({ request, locals }) => {
		if (!locals.userId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const siteUrl = normalizeSiteUrl((data.get('site_url') as string) ?? '');
		const auth = (data.get('auth') as string)?.trim() || '';
		const postTypeRoute = (data.get('post_type_route') as string)?.trim() || '/wp/v2/posts';
		if (!siteUrl) return fail(400, { error: 'Site URL is required' });
		if (!postTypeRoute.startsWith('/wp/v2/')) return fail(400, { error: 'Invalid post type route' });
		const baseUrl = `${siteUrl}/wp-json${postTypeRoute}`;
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (auth) headers['Authorization'] = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;
		try {
			const listUrl = `${baseUrl}?per_page=1&page=1`;
			const res = await fetch(listUrl, { headers });
			if (!res.ok) return fail(400, { error: `WordPress API error: ${res.status} ${res.statusText}` });
			const json = (await res.json()) as unknown[];
			const sample = json[0] ?? null;
			const postTypes = await discoverPostTypes(siteUrl, auth);
			return {
				fetched: true,
				sample,
				site_url: siteUrl,
				auth,
				post_type_route: postTypeRoute,
				discovered: true,
				post_types: postTypes
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to fetch';
			return fail(400, { error: msg });
		}
	},
	importFromWordPress: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const siteUrl = normalizeSiteUrl((data.get('site_url') as string) ?? '');
		const auth = (data.get('auth') as string)?.trim() || '';
		const postTypeRoute = (data.get('post_type_route') as string)?.trim() || '/wp/v2/posts';
		const webhookId = data.get('webhook_id') as string;
		const scheduleId = (data.get('schedule_id') as string)?.trim() || null;
		const titlePath = (data.get('title_path') as string)?.trim() || 'title.rendered';
		const contentPath = (data.get('content_path') as string)?.trim() || 'content.rendered';
		const titleUnescapeNewlines = (data.get('title_unescape_newlines') as string) === 'on';
		const contentUnescapeNewlines = (data.get('content_unescape_newlines') as string) === 'on';
		const customMappingJson = (data.get('custom_mapping') as string)?.trim() || '[]';
		const perPage = Math.min(100, Math.max(1, parseInt((data.get('per_page') as string) || '20', 10)));
		const fetchFullPerItem = (data.get('fetch_full_per_item') as string) !== 'off';
		if (!siteUrl || !webhookId) return fail(400, { error: 'Site URL and webhook are required' });
		if (!postTypeRoute.startsWith('/wp/v2/')) return fail(400, { error: 'Invalid post type route' });

		let customMapping: { path: string; key: string; type: string; unescapeNewlines?: boolean }[];
		try {
			customMapping = JSON.parse(customMappingJson) as { path: string; key: string; type: string; unescapeNewlines?: boolean }[];
		} catch {
			customMapping = [];
		}

		const filterJson = (data.get('filter_rules') as string)?.trim() || '';
		let filterConfig: FilterConfig | null = null;
		if (filterJson) {
			try {
				const parsed = JSON.parse(filterJson) as FilterConfig;
				if (parsed?.rules?.length) {
					filterConfig = {
						combine: parsed.combine === 'or' ? 'or' : 'and',
						rules: parsed.rules.filter((r: FilterRule) => (r.path ?? '').trim() !== '')
					};
				}
			} catch {
				// ignore invalid filter JSON
			}
		}

		const baseUrl = `${siteUrl}/wp-json${postTypeRoute}`;
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (auth) headers['Authorization'] = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;

		let items: unknown[];
		try {
			const listUrl = `${baseUrl}?per_page=${perPage}&page=1`;
			const res = await fetch(listUrl, { headers });
			if (!res.ok) return fail(400, { error: `WordPress API error: ${res.status}` });
			items = (await res.json()) as unknown[];
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Fetch failed' });
		}

		if (fetchFullPerItem && items.length > 0) {
			const fullItems: unknown[] = [];
			for (const item of items as Record<string, unknown>[]) {
				const id = item?.id;
				if (id == null) {
					fullItems.push(item);
					continue;
				}
				try {
					const singleRes = await fetch(`${baseUrl}/${id}`, { headers });
					if (singleRes.ok) {
						fullItems.push((await singleRes.json()) as unknown);
					} else {
						fullItems.push(item);
					}
				} catch {
					fullItems.push(item);
				}
			}
			items = fullItems;
		}

		const db = getDatabase();
		const webhook = db
			.prepare('SELECT id FROM webhook_config WHERE id = ? AND account_id = ?')
			.get(webhookId, accountId) as { id: string } | undefined;
		if (!webhook) return fail(400, { error: 'Invalid webhook' });
		if (scheduleId) {
			const schedule = db
				.prepare('SELECT id FROM schedule WHERE id = ? AND account_id = ?')
				.get(scheduleId, accountId) as { id: string } | undefined;
			if (!schedule) return fail(400, { error: 'Invalid schedule' });
		}
		const insertPost = db.prepare(
			'INSERT INTO post (id, account_id, webhook_id, title, content, color, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
		);
		const insertField = db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)');

		const createdIds: string[] = [];
		const transaction = db.transaction(() => {
			for (const item of items as Record<string, unknown>[]) {
				if (!evaluateFilter(item, filterConfig)) continue;
				const title = resolveValue(item, titlePath, titleUnescapeNewlines, 'string');
				const content = resolveValue(item, contentPath, contentUnescapeNewlines, 'string');
				const id = crypto.randomUUID();
				insertPost.run(
					id,
					accountId,
					webhookId,
					title || '(no title)',
					content,
					randomTailwindPostColor(),
					'draft'
				);
				createdIds.push(id);
				for (const m of customMapping) {
					if (!m.path.trim() || !m.key.trim()) continue;
					const value = resolveValue(
						item,
						m.path,
						Boolean(m.unescapeNewlines),
						m.type === 'json' ? 'json' : 'string'
					);
					const fieldId = crypto.randomUUID();
					insertField.run(fieldId, id, m.key, m.type, value);
				}
			}
		});
		transaction();

		// Optionally apply schedule
		if (scheduleId && createdIds.length > 0) {
			const slots = db
				.prepare(
					'SELECT id, scheduled_at, order_index FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index'
				)
				.all(scheduleId) as { id: string; scheduled_at: string; order_index: number }[];
			const scheduleFields = db
				.prepare('SELECT key, type, value FROM schedule_field WHERE schedule_id = ?')
				.all(scheduleId) as { key: string; type: string; value: string | null }[];
			const updatePost = db.prepare("UPDATE post SET scheduled_at = ?, schedule_id = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			for (let i = 0; i < Math.min(createdIds.length, slots.length); i++) {
				updatePost.run(slots[i].scheduled_at, scheduleId, 'scheduled', createdIds[i], accountId);
				for (const sf of scheduleFields) {
					const fieldId = crypto.randomUUID();
					db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, createdIds[i], sf.key, sf.type, sf.value ?? '');
				}
			}
		}

		throw redirect(303, `/posts?imported=${createdIds.length}`);
	}
};
