import { getDatabase } from '$lib/db/index.js';
import { insertWebhookRecord } from '$lib/db/webhookMutations.js';
import { setPostWebhooks } from '$lib/db/postWebhooks.js';
import { generateSlots } from '$lib/scheduler/generateSlots.js';
import {
	currentMonthKey,
	canRunImportOperation,
	incrementUsageMonth,
	getPostsSentAndScheduledForMonth,
	monthKeyFromDate
} from '$lib/usage.js';
import { getTierLimits } from '$lib/tiers.js';
import Parser from 'rss-parser';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseCsv } from 'csv-parse/sync';
import { loadInboundAuthFields } from '$lib/server/inboundAuthLoad.js';
import { callbackTokenFormActions } from '$lib/server/callbackTokenFormActions.js';

const rssParser = new Parser({ timeout: 10000 });

const INPUT_SECTIONS = ['cms', 'spreadsheets', 'feeds', 'callbacks'] as const;
type InputSection = (typeof INPUT_SECTIONS)[number];

export const load: PageServerLoad = async ({ locals, url }) => {
	const accountId = locals.userId;
	const sectionRaw = url.searchParams.get('section') ?? 'cms';
	const section = (INPUT_SECTIONS.includes(sectionRaw as InputSection)
		? sectionRaw
		: 'cms') as InputSection;

	if (!accountId) {
		return {
			webhooks: [],
			schedules: [],
			section,
			...loadInboundAuthFields(null)
		};
	}
	const db = getDatabase();
	const webhooks = db.prepare('SELECT id, name FROM webhook_config WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];
	const schedules = db.prepare('SELECT id, name FROM schedule WHERE account_id = ? ORDER BY name').all(accountId) as { id: string; name: string }[];

	return {
		webhooks,
		schedules,
		section,
		...loadInboundAuthFields(accountId)
	};
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

const MAX_REGEX_SOURCE_LENGTH = 256;

function isRegexSourceSafe(source: string): boolean {
	if (!source || source.length > MAX_REGEX_SOURCE_LENGTH) return false;
	// Reject common catastrophic patterns and risky features.
	if (/\\[1-9]/.test(source)) return false; // backreferences
	if (/\(\?<[=!]/.test(source)) return false; // lookbehind
	if (/\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/.test(source)) return false; // nested quantifiers
	if (/\(\.\*\)\+|\(\.\+\)\+/.test(source)) return false; // broad nested wildcards
	return true;
}

function compileUserRegex(source: string, flags = ''): RegExp | null {
	if (!isRegexSourceSafe(source)) return null;
	try {
		return new RegExp(source, flags);
	} catch {
		return null;
	}
}

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
				if (!val) return false;
				return compileUserRegex(val)?.test(str) ?? false;
			case 'not_regex':
				if (!val) return true;
				return !(compileUserRegex(val)?.test(str) ?? false);
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
				const regexSource = args[0] ?? '';
				const replacement = args[1];
				const re = compileUserRegex(regexSource, 'g');
				if (!re) return raw;
				if (replacement !== undefined && replacement !== '') {
					return raw.replace(re, (match, ...groups) => {
						let r = replacement.replace(/\$&/g, match);
						groups.forEach((g, i) => {
							r = r.replace(new RegExp(`\\$${i + 1}`, 'g'), g ?? '');
						});
						return r;
					});
				}
				const singleMatchRegex = compileUserRegex(regexSource);
				if (!singleMatchRegex) return '';
				const m = raw.match(singleMatchRegex);
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

/** Normalize feed URL for consistent import_source_id (strip fragment, default https) */
function normalizeFeedUrl(input: string): string {
	let url = input.trim();
	if (!url) return url;
	try {
		const u = new URL(url);
		u.hash = '';
		if (u.protocol !== 'http:' && u.protocol !== 'https:') u.protocol = 'https:';
		return u.toString().replace(/\/$/, '') || u.toString();
	} catch {
		return url;
	}
}

/** Normalize Squarespace blog URL and build URL for JSON (append ?format=json-pretty or &format=json-pretty) */
function squarespaceJsonUrl(blogUrl: string): string {
	let url = blogUrl.trim();
	if (!url) return url;
	try {
		const u = new URL(url);
		u.hash = '';
		if (u.protocol !== 'http:' && u.protocol !== 'https:') u.protocol = 'https:';
		const base = u.toString().replace(/\/$/, '') || u.toString();
		return base.includes('?') ? `${base}&format=json-pretty` : `${base}?format=json-pretty`;
	} catch {
		return blogUrl.includes('?') ? `${blogUrl}&format=json-pretty` : `${blogUrl}?format=json-pretty`;
	}
}

function normalizeSquarespaceBlogUrl(blogUrl: string): string {
	let url = blogUrl.trim();
	if (!url) return url;
	try {
		const u = new URL(url);
		u.hash = '';
		if (u.protocol !== 'http:' && u.protocol !== 'https:') u.protocol = 'https:';
		return u.toString().replace(/\/$/, '') || u.toString();
	} catch {
		return url;
	}
}

/** Convert rss-parser item to plain object for mapping/filtering */
function rssItemToPlain(item: Parser.Item & Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of Object.keys(item)) {
		const v = item[key];
		if (v !== undefined && v !== null) out[key] = v;
	}
	return out;
}

/** Directory where temporary CSV uploads are stored between steps. */
const CSV_IMPORT_DIR = path.join(process.cwd(), 'data', 'csv-imports');

async function ensureCsvDir() {
	await fs.mkdir(CSV_IMPORT_DIR, { recursive: true });
}

async function csvPath(importId: string): Promise<string> {
	await ensureCsvDir();
	return path.join(CSV_IMPORT_DIR, `${importId}.csv`);
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
	discoverCsv: async ({ request, locals }) => {
		if (!locals.userId) return fail(401, { error: 'Unauthorized' });
		const formData = await request.formData();

		// Either we have a new file upload (stage 1) or we're configuring an existing import (stage 2)
		let importId = (formData.get('csv_import_id') as string)?.trim() || '';
		const uploaded = formData.get('csv_file') as File | null;

		let delimiter = (formData.get('delimiter') as string) ?? '';
		if (delimiter === '\\t') delimiter = '\t';
		const hasHeaderRaw = formData.get('has_header') as string;
		const hasHeader =
			hasHeaderRaw === 'on' ||
			hasHeaderRaw === 'true';

		try {
			if (uploaded && uploaded.size > 0) {
				// New upload: create an import id and persist the file
				importId = crypto.randomUUID();
				const p = await csvPath(importId);
				const buf = Buffer.from(await uploaded.arrayBuffer());
				await fs.writeFile(p, buf);
			}

			if (!importId) return fail(400, { error: 'CSV file is required', action: 'discoverCsv' });

			const p = await csvPath(importId);
			const content = await fs.readFile(p, 'utf8');

			// Always return the first couple of raw lines for inspection
			const rawLines = content.split(/\r?\n/).filter((l) => l.length > 0).slice(0, 2);

			// If no delimiter provided yet, this is stage 1: just upload + raw preview
			if (!delimiter) {
				return {
					csv_import_id: importId,
					csv_raw_lines: rawLines
				};
			}

			// Parse a small sample
			const records: unknown[] = parseCsv(content, {
				delimiter: delimiter,
				columns: hasHeader,
				relax_column_count: true,
				skip_empty_lines: true,
				from_line: 1,
				to_line: 20
			}) as unknown[];

			let headers: string[] = [];
			let rows: Record<string, string>[] = [];

			if (Array.isArray(records) && records.length > 0) {
				if (hasHeader && records[0] && typeof records[0] === 'object' && !Array.isArray(records[0])) {
					// columns: true -> array of objects
					rows = records as Record<string, string>[];
					headers = Object.keys(rows[0] ?? {});
				} else if (!hasHeader && Array.isArray(records[0])) {
					const first = records[0] as string[];
					const cols = first.length;
					headers = Array.from({ length: cols }, (_, i) => `col_${i + 1}`);
					rows = (records as string[][]).map((r) => {
						const obj: Record<string, string> = {};
						headers.forEach((h, i) => {
							obj[h] = r[i] ?? '';
						});
						return obj;
					});
				}
			}

			return {
				csv_import_id: importId,
				csv_delimiter: delimiter,
				csv_has_header: hasHeader,
				csv_raw_lines: rawLines,
				csv_headers: headers,
				csv_sample_rows: rows
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to read CSV file';
			return fail(400, { error: msg, action: 'discoverCsv' });
		}
	},
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
	/** Discover Squarespace blog: fetch URL with ?format=json-pretty, use "items" array and first entry as sample. */
	discoverSquarespace: async ({ request, locals }) => {
		if (!locals.userId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const blogUrl = (data.get('blog_url') as string)?.trim() ?? '';
		if (!blogUrl) return fail(400, { error: 'Blog URL is required' });
		const normalized = normalizeSquarespaceBlogUrl(blogUrl);
		const jsonUrl = squarespaceJsonUrl(normalized);
		try {
			const res = await fetch(jsonUrl, { headers: { Accept: 'application/json' } });
			if (!res.ok) return fail(400, { error: `Failed to fetch: ${res.status} ${res.statusText}` });
			const body = (await res.json()) as Record<string, unknown>;
			const items = body?.items;
			if (!Array.isArray(items) || items.length === 0) {
				return fail(400, { error: 'No "items" array found in the JSON, or it is empty. Make sure the URL is a Squarespace blog or collection page.' });
			}
			const sample = items[0] ?? null;
			return {
				squarespace_discovered: true,
				blog_url: normalized,
				item_count: items.length,
				sample
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to fetch or parse JSON';
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
		const includeFeaturedImage = (data.get('include_featured_image') as string) === 'on';
		if (!siteUrl) return fail(400, { error: 'Site URL is required' });
		if (!postTypeRoute.startsWith('/wp/v2/')) return fail(400, { error: 'Invalid post type route' });
		const baseUrl = `${siteUrl}/wp-json${postTypeRoute}`;
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (auth) headers['Authorization'] = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;
		try {
			const listUrl = includeFeaturedImage ? `${baseUrl}?per_page=1&page=1&_embed` : `${baseUrl}?per_page=1&page=1`;
			const res = await fetch(listUrl, { headers });
			if (!res.ok) return fail(400, { error: `WordPress API error: ${res.status} ${res.statusText}` });
			const totalHeader = res.headers.get('X-WP-Total');
			let wp_collection_total: number | null = null;
			if (totalHeader != null && totalHeader !== '') {
				const n = parseInt(totalHeader, 10);
				if (!Number.isNaN(n)) wp_collection_total = n;
			}
			const json = (await res.json()) as unknown[];
			let sample = json[0] ?? null;
			if (includeFeaturedImage && sample != null && typeof sample === 'object') {
				const embedded = (sample as Record<string, unknown>)._embedded as Record<string, unknown[]> | undefined;
				const featuredMedia = embedded?.['wp:featuredmedia'];
				const sourceUrl =
					Array.isArray(featuredMedia) && featuredMedia[0] != null && typeof featuredMedia[0] === 'object'
						? (featuredMedia[0] as Record<string, unknown>).source_url as string | undefined
						: undefined;
				sample = { ...(sample as Record<string, unknown>), featured_image_url: sourceUrl ?? '' };
			}
			const postTypes = await discoverPostTypes(siteUrl, auth);
			return {
				fetched: true,
				sample,
				site_url: siteUrl,
				auth,
				post_type_route: postTypeRoute,
				discovered: true,
				post_types: postTypes,
				include_featured_image: includeFeaturedImage,
				wp_collection_total
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
		const webhookIds = data.getAll('webhook_ids').filter((v): v is string => typeof v === 'string' && v.trim() !== '');
		const scheduleId = (data.get('schedule_id') as string)?.trim() || null;
		const importStatus = ((data.get('import_status') as string) || 'draft').trim() === 'scheduled' ? 'scheduled' : 'draft';
		const titlePath = (data.get('title_path') as string)?.trim() || 'title.rendered';
		const contentPath = (data.get('content_path') as string)?.trim() || 'content.rendered';
		const imageUrlPath = (data.get('image_url_path') as string)?.trim() || '';
		const titleUnescapeNewlines = (data.get('title_unescape_newlines') as string) === 'on';
		const contentUnescapeNewlines = (data.get('content_unescape_newlines') as string) === 'on';
		const customMappingJson = (data.get('custom_mapping') as string)?.trim() || '[]';
		const importStart = Math.max(1, parseInt((data.get('import_start') as string) || '1', 10));
		const importCount = Math.min(100, Math.max(1, parseInt((data.get('per_page') as string) || '20', 10)));
		if (importStart + importCount - 1 > 100) {
			return fail(400, { error: 'Start + count cannot exceed 100 (WordPress API limit per request). Use start ≤ 100 − count + 1.' });
		}
		const fetchFullPerItem = (data.get('fetch_full_per_item') as string) !== 'off';
		const skipDuplicates = (data.get('skip_duplicates') as string) === 'on';
		const includeFeaturedImage = (data.get('include_featured_image') as string) === 'on';
		if (!siteUrl) return fail(400, { error: 'Site URL is required' });
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

		const embedSuffix = includeFeaturedImage ? '&_embed' : '';
		let items: unknown[];
		try {
			const fetchCount = Math.min(100, importStart + importCount - 1);
			const listUrl = `${baseUrl}?per_page=${fetchCount}&page=1${embedSuffix}`;
			const res = await fetch(listUrl, { headers });
			if (!res.ok) return fail(400, { error: `WordPress API error: ${res.status}` });
			const raw = (await res.json()) as unknown[];
			items = raw.slice(importStart - 1, importStart - 1 + importCount);
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
					const singleUrl = includeFeaturedImage ? `${baseUrl}/${id}?_embed` : `${baseUrl}/${id}`;
					const singleRes = await fetch(singleUrl, { headers });
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

		// Inject featured_image_url into each item when requested so mapping path "featured_image_url" works
		if (includeFeaturedImage && items.length > 0) {
			items = (items as Record<string, unknown>[]).map((item) => {
				const embedded = item._embedded as Record<string, unknown[]> | undefined;
				const featuredMedia = embedded?.['wp:featuredmedia'];
				const sourceUrl =
					Array.isArray(featuredMedia) && featuredMedia[0] != null && typeof featuredMedia[0] === 'object'
						? (featuredMedia[0] as Record<string, unknown>).source_url as string | undefined
						: undefined;
				return { ...item, featured_image_url: sourceUrl ?? '' };
			});
		}

		const db = getDatabase();
		const tierRow = db.prepare('SELECT tier FROM user WHERE id = ?').get(accountId) as { tier: string } | undefined;
		const tier = tierRow?.tier ?? 'free';
		const month = currentMonthKey();
		const importCheck = canRunImportOperation(db, accountId, month, tier);
		if (!importCheck.allowed) return fail(403, { error: importCheck.reason ?? 'Import limit exceeded for this month.' });

		for (const wid of webhookIds) {
			const webhook = db
				.prepare('SELECT id FROM webhook_config WHERE id = ? AND account_id = ?')
				.get(wid, accountId) as { id: string } | undefined;
			if (!webhook) return fail(400, { error: 'Invalid webhook selected' });
		}
		if (scheduleId) {
			const schedule = db
				.prepare('SELECT id FROM schedule WHERE id = ? AND account_id = ?')
				.get(scheduleId, accountId) as { id: string } | undefined;
			if (!schedule) return fail(400, { error: 'Invalid schedule' });
		}
		const insertPost = db.prepare(
			'INSERT INTO post (id, account_id, webhook_id, title, content, image_url, color, status, import_source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
		);
		const insertField = db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)');
		const existingBySource =
			skipDuplicates
				? db.prepare('SELECT 1 FROM post WHERE account_id = ? AND import_source_id = ? LIMIT 1')
				: null;

		function importSourceId(item: Record<string, unknown>): string | null {
			const id = item?.id;
			if (id == null) return null;
			return `wordpress:${siteUrl}:${id}`;
		}

		const createdIds: string[] = [];
		const transaction = db.transaction(() => {
			for (const item of items as Record<string, unknown>[]) {
				if (!evaluateFilter(item, filterConfig)) continue;
				const sourceId = importSourceId(item);
				if (skipDuplicates && sourceId && existingBySource?.get(accountId, sourceId)) continue;
				const title = resolveValue(item, titlePath, titleUnescapeNewlines, 'string');
				const content = resolveValue(item, contentPath, contentUnescapeNewlines, 'string');
				const imageUrl = imageUrlPath ? (resolveValue(item, imageUrlPath, false, 'string') as string)?.trim() || null : null;
				const id = crypto.randomUUID();
				const primaryWebhookId = webhookIds.length > 0 ? webhookIds[0] : null;
				insertPost.run(
					id,
					accountId,
					primaryWebhookId,
					title || '(no title)',
					content,
					imageUrl,
					null,
					'draft',
					sourceId
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

		if (webhookIds.length > 0) {
			for (const postId of createdIds) {
				setPostWebhooks(db, postId, accountId, webhookIds);
			}
		}

		// Optionally apply schedule to all created posts
		const limits = getTierLimits(tier);
		const postsPerMonthInBatch = new Map<string, number>();
		if (scheduleId && createdIds.length > 0) {
			const scheduleRow = db.prepare('SELECT color FROM schedule WHERE id = ? AND account_id = ?').get(scheduleId, accountId) as { color: string | null } | undefined;
			const scheduleColor = scheduleRow?.color ?? null;
			const ruleCount = db.prepare('SELECT COUNT(*) as n FROM schedule_rule WHERE schedule_id = ?').get(scheduleId) as { n: number };
			let slotDatetimes: string[];
			if (ruleCount.n > 0) {
				slotDatetimes = generateSlots(scheduleId, createdIds.length, undefined, accountId);
			} else {
				const fixedSlots = db
					.prepare('SELECT scheduled_at FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index')
					.all(scheduleId) as { scheduled_at: string }[];
				slotDatetimes = fixedSlots.map((s) => s.scheduled_at);
			}
			const scheduleFields = db
				.prepare('SELECT key, type, value FROM schedule_field WHERE schedule_id = ?')
				.all(scheduleId) as { key: string; type: string; value: string | null }[];
			const setScheduleOnly = db.prepare("UPDATE post SET schedule_id = ?, color = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			const setScheduleAndSlot = db.prepare("UPDATE post SET scheduled_at = ?, schedule_id = ?, status = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			for (let i = 0; i < createdIds.length; i++) {
				const postId = createdIds[i];
				const slot = slotDatetimes[i];
				const status = importStatus === 'scheduled' && slot ? 'scheduled' : 'draft';
				if (slot) {
					if (limits.postsSentPerMonth != null) {
						const slotMonth = monthKeyFromDate(slot);
						if (slotMonth) {
							const { sent, scheduled } = getPostsSentAndScheduledForMonth(db, accountId, slotMonth);
							const batchInMonth = postsPerMonthInBatch.get(slotMonth) ?? 0;
							if (sent + scheduled + batchInMonth + 1 > limits.postsSentPerMonth) {
								return fail(403, {
									error: `Post limit for ${slotMonth} (${limits.postsSentPerMonth}) would be exceeded.`
								});
							}
							postsPerMonthInBatch.set(slotMonth, batchInMonth + 1);
						}
					}
					setScheduleAndSlot.run(slot, scheduleId, status, scheduleColor, postId, accountId);
				} else {
					setScheduleOnly.run(scheduleId, scheduleColor, status, postId, accountId);
				}
				for (const sf of scheduleFields) {
					const fieldId = crypto.randomUUID();
					db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, postId, sf.key, sf.type, sf.value ?? '');
				}
			}
		}

		incrementUsageMonth(db, accountId, month, { importOperations: 1 });
		throw redirect(303, `/posts?imported=${createdIds.length}`);
	},
	importFromSquarespace: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const blogUrl = normalizeSquarespaceBlogUrl((data.get('blog_url') as string) ?? '');
		const webhookIds = data.getAll('webhook_ids').filter((v): v is string => typeof v === 'string' && v.trim() !== '');
		const scheduleId = (data.get('schedule_id') as string)?.trim() || null;
		const importStatus = ((data.get('import_status') as string) || 'draft').trim() === 'scheduled' ? 'scheduled' : 'draft';
		const titlePath = (data.get('title_path') as string)?.trim() || 'title';
		const contentPath = (data.get('content_path') as string)?.trim() || 'body';
		const imageUrlPath = (data.get('image_url_path') as string)?.trim() || '';
		const titleUnescapeNewlines = (data.get('title_unescape_newlines') as string) === 'on';
		const contentUnescapeNewlines = (data.get('content_unescape_newlines') as string) === 'on';
		const customMappingJson = (data.get('custom_mapping') as string)?.trim() || '[]';
		const importStart = Math.max(1, parseInt((data.get('import_start') as string) || '1', 10));
		const importCount = Math.min(500, Math.max(1, parseInt((data.get('per_page') as string) || '20', 10)));
		const skipDuplicates = (data.get('skip_duplicates') as string) === 'on';
		if (!blogUrl) return fail(400, { error: 'Blog URL is required' });

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
				// ignore
			}
		}

		const jsonUrl = squarespaceJsonUrl(blogUrl);
		let items: Record<string, unknown>[];
		try {
			const res = await fetch(jsonUrl, { headers: { Accept: 'application/json' } });
			if (!res.ok) return fail(400, { error: `Failed to fetch Squarespace JSON: ${res.status}` });
			const body = (await res.json()) as Record<string, unknown>;
			const raw = (body?.items ?? []) as Record<string, unknown>[];
			const start = importStart - 1;
			items = raw.slice(start, start + importCount);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Fetch failed' });
		}

		const db = getDatabase();
		const tierRow = db.prepare('SELECT tier FROM user WHERE id = ?').get(accountId) as { tier: string } | undefined;
		const tier = tierRow?.tier ?? 'free';
		const month = currentMonthKey();
		const importCheck = canRunImportOperation(db, accountId, month, tier);
		if (!importCheck.allowed) return fail(403, { error: importCheck.reason ?? 'Import limit exceeded for this month.' });

		for (const wid of webhookIds) {
			const webhook = db
				.prepare('SELECT id FROM webhook_config WHERE id = ? AND account_id = ?')
				.get(wid, accountId) as { id: string } | undefined;
			if (!webhook) return fail(400, { error: 'Invalid webhook selected' });
		}
		if (scheduleId) {
			const schedule = db
				.prepare('SELECT id FROM schedule WHERE id = ? AND account_id = ?')
				.get(scheduleId, accountId) as { id: string } | undefined;
			if (!schedule) return fail(400, { error: 'Invalid schedule' });
		}
		const insertPost = db.prepare(
			'INSERT INTO post (id, account_id, webhook_id, title, content, image_url, color, status, import_source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
		);
		const insertField = db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)');
		const existingBySource = skipDuplicates
			? db.prepare('SELECT 1 FROM post WHERE account_id = ? AND import_source_id = ? LIMIT 1')
			: null;

		function squarespaceImportSourceId(item: Record<string, unknown>, index: number): string {
			const id = item?.id ?? item?.url ?? item?.fullUrl;
			if (id != null && String(id).trim()) return `squarespace:${blogUrl}:${String(id).trim()}`;
			return `squarespace:${blogUrl}:${importStart + index}`;
		}

		const createdIds: string[] = [];
		const transaction = db.transaction(() => {
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (!evaluateFilter(item, filterConfig)) continue;
				const sourceId = squarespaceImportSourceId(item, i);
				if (skipDuplicates && existingBySource?.get(accountId, sourceId)) continue;
				const title = resolveValue(item, titlePath, titleUnescapeNewlines, 'string');
				const content = resolveValue(item, contentPath, contentUnescapeNewlines, 'string');
				const imageUrl = imageUrlPath ? (resolveValue(item, imageUrlPath, false, 'string') as string)?.trim() || null : null;
				const id = crypto.randomUUID();
				const primaryWebhookId = webhookIds.length > 0 ? webhookIds[0] : null;
				insertPost.run(id, accountId, primaryWebhookId, title || '(no title)', content, imageUrl, null, 'draft', sourceId);
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

		if (webhookIds.length > 0) {
			for (const postId of createdIds) {
				setPostWebhooks(db, postId, accountId, webhookIds);
			}
		}

		const limitsSq = getTierLimits(tier);
		const postsPerMonthSq = new Map<string, number>();
		if (scheduleId && createdIds.length > 0) {
			const scheduleRow = db.prepare('SELECT color FROM schedule WHERE id = ? AND account_id = ?').get(scheduleId, accountId) as { color: string | null } | undefined;
			const scheduleColor = scheduleRow?.color ?? null;
			const ruleCount = db.prepare('SELECT COUNT(*) as n FROM schedule_rule WHERE schedule_id = ?').get(scheduleId) as { n: number };
			let slotDatetimes: string[];
			if (ruleCount.n > 0) {
				slotDatetimes = generateSlots(scheduleId, createdIds.length, undefined, accountId);
			} else {
				const fixedSlots = db
					.prepare('SELECT scheduled_at FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index')
					.all(scheduleId) as { scheduled_at: string }[];
				slotDatetimes = fixedSlots.map((s) => s.scheduled_at);
			}
			const scheduleFields = db
				.prepare('SELECT key, type, value FROM schedule_field WHERE schedule_id = ?')
				.all(scheduleId) as { key: string; type: string; value: string | null }[];
			const setScheduleOnly = db.prepare("UPDATE post SET schedule_id = ?, color = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			const setScheduleAndSlot = db.prepare("UPDATE post SET scheduled_at = ?, schedule_id = ?, status = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			for (let i = 0; i < createdIds.length; i++) {
				const postId = createdIds[i];
				const slot = slotDatetimes[i];
				const status = importStatus === 'scheduled' && slot ? 'scheduled' : 'draft';
				if (slot) {
					if (limitsSq.postsSentPerMonth != null) {
						const slotMonth = monthKeyFromDate(slot);
						if (slotMonth) {
							const { sent, scheduled } = getPostsSentAndScheduledForMonth(db, accountId, slotMonth);
							const batchInMonth = postsPerMonthSq.get(slotMonth) ?? 0;
							if (sent + scheduled + batchInMonth + 1 > limitsSq.postsSentPerMonth) {
								return fail(403, {
									error: `Post limit for ${slotMonth} (${limitsSq.postsSentPerMonth}) would be exceeded.`
								});
							}
							postsPerMonthSq.set(slotMonth, batchInMonth + 1);
						}
					}
					setScheduleAndSlot.run(slot, scheduleId, status, scheduleColor, postId, accountId);
				} else {
					setScheduleOnly.run(scheduleId, scheduleColor, status, postId, accountId);
				}
				for (const sf of scheduleFields) {
					const fieldId = crypto.randomUUID();
					db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, postId, sf.key, sf.type, sf.value ?? '');
				}
			}
		}

		incrementUsageMonth(db, accountId, month, { importOperations: 1 });
		throw redirect(303, `/posts?imported=${createdIds.length}`);
	},
	discoverRss: async ({ request, locals }) => {
		if (!locals.userId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const feedUrl = (data.get('feed_url') as string)?.trim() ?? '';
		if (!feedUrl) return fail(400, { error: 'Feed URL is required' });
		const normalized = normalizeFeedUrl(feedUrl);
		try {
			const feed = await rssParser.parseURL(normalized);
			const itemCount = feed.items?.length ?? 0;
			const firstItem = feed.items?.[0];
			const rss_sample = firstItem ? rssItemToPlain(firstItem) : null;
			return {
				rss_discovered: true,
				feed_url: normalized,
				feed_title: feed.title?.trim() || null,
				item_count: itemCount,
				rss_sample
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to fetch or parse feed';
			return fail(400, { error: msg });
		}
	},
	importFromRss: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();
		const feedUrl = (data.get('feed_url') as string)?.trim() ?? '';
		const webhookIds = data.getAll('webhook_ids').filter((v): v is string => typeof v === 'string' && v.trim() !== '');
		const scheduleId = (data.get('schedule_id') as string)?.trim() || null;
		const importStatus = ((data.get('import_status') as string) || 'draft').trim() === 'scheduled' ? 'scheduled' : 'draft';
		const titlePath = (data.get('title_path') as string)?.trim() || 'title';
		const contentPath = (data.get('content_path') as string)?.trim() || 'content';
		const imageUrlPath = (data.get('image_url_path') as string)?.trim() || '';
		const titleUnescapeNewlines = (data.get('title_unescape_newlines') as string) === 'on';
		const contentUnescapeNewlines = (data.get('content_unescape_newlines') as string) === 'on';
		const customMappingJson = (data.get('custom_mapping') as string)?.trim() || '[]';
		const importStart = Math.max(1, parseInt((data.get('import_start') as string) || '1', 10));
		const importCount = Math.min(500, Math.max(1, parseInt((data.get('per_page') as string) || '20', 10)));
		const skipDuplicates = (data.get('skip_duplicates') as string) === 'on';
		if (!feedUrl) return fail(400, { error: 'Feed URL is required' });

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

		const normalized = normalizeFeedUrl(feedUrl);
		let items: Record<string, unknown>[];
		try {
			const feed = await rssParser.parseURL(normalized);
			const raw = (feed.items ?? []).map((item) => rssItemToPlain(item));
			const start = importStart - 1;
			items = raw.slice(start, start + importCount);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to fetch feed' });
		}

		const db = getDatabase();
		const tierRowRss = db.prepare('SELECT tier FROM user WHERE id = ?').get(accountId) as { tier: string } | undefined;
		const tierRss = tierRowRss?.tier ?? 'free';
		const monthRss = currentMonthKey();
		const importCheckRss = canRunImportOperation(db, accountId, monthRss, tierRss);
		if (!importCheckRss.allowed) return fail(403, { error: importCheckRss.reason ?? 'Import limit exceeded for this month.' });

		for (const wid of webhookIds) {
			const webhook = db
				.prepare('SELECT id FROM webhook_config WHERE id = ? AND account_id = ?')
				.get(wid, accountId) as { id: string } | undefined;
			if (!webhook) return fail(400, { error: 'Invalid webhook selected' });
		}
		if (scheduleId) {
			const schedule = db
				.prepare('SELECT id FROM schedule WHERE id = ? AND account_id = ?')
				.get(scheduleId, accountId) as { id: string } | undefined;
			if (!schedule) return fail(400, { error: 'Invalid schedule' });
		}
		const insertPost = db.prepare(
			'INSERT INTO post (id, account_id, webhook_id, title, content, image_url, color, status, import_source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
		);
		const insertField = db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)');
		const existingBySource = skipDuplicates
			? db.prepare('SELECT 1 FROM post WHERE account_id = ? AND import_source_id = ? LIMIT 1')
			: null;

		function rssImportSourceId(item: Record<string, unknown>, index: number): string {
			const guid = item?.guid;
			const link = item?.link;
			if (typeof guid === 'string' && guid.trim()) return `rss:${normalized}:${guid.trim()}`;
			if (typeof link === 'string' && link.trim()) return `rss:${normalized}:${link.trim()}`;
			return `rss:${normalized}:${importStart + index}`;
		}

		const createdIds: string[] = [];
		const transaction = db.transaction(() => {
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (!evaluateFilter(item, filterConfig)) continue;
				const sourceId = rssImportSourceId(item, i);
				if (skipDuplicates && existingBySource?.get(accountId, sourceId)) continue;
				const title = resolveValue(item, titlePath, titleUnescapeNewlines, 'string');
				const content = resolveValue(item, contentPath, contentUnescapeNewlines, 'string');
				const imageUrl = imageUrlPath ? (resolveValue(item, imageUrlPath, false, 'string') as string)?.trim() || null : null;
				const id = crypto.randomUUID();
				const primaryWebhookId = webhookIds.length > 0 ? webhookIds[0] : null;
				insertPost.run(id, accountId, primaryWebhookId, title || '(no title)', content, imageUrl, null, 'draft', sourceId);
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

		if (webhookIds.length > 0) {
			for (const postId of createdIds) {
				setPostWebhooks(db, postId, accountId, webhookIds);
			}
		}

		const limitsRss = getTierLimits(tierRss);
		const postsPerMonthRss = new Map<string, number>();
		if (scheduleId && createdIds.length > 0) {
			const scheduleRow = db.prepare('SELECT color FROM schedule WHERE id = ? AND account_id = ?').get(scheduleId, accountId) as { color: string | null } | undefined;
			const scheduleColor = scheduleRow?.color ?? null;
			const ruleCount = db.prepare('SELECT COUNT(*) as n FROM schedule_rule WHERE schedule_id = ?').get(scheduleId) as { n: number };
			let slotDatetimes: string[];
			if (ruleCount.n > 0) {
				slotDatetimes = generateSlots(scheduleId, createdIds.length, undefined, accountId);
			} else {
				const fixedSlots = db
					.prepare('SELECT scheduled_at FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index')
					.all(scheduleId) as { scheduled_at: string }[];
				slotDatetimes = fixedSlots.map((s) => s.scheduled_at);
			}
			const scheduleFields = db
				.prepare('SELECT key, type, value FROM schedule_field WHERE schedule_id = ?')
				.all(scheduleId) as { key: string; type: string; value: string | null }[];
			const setScheduleOnly = db.prepare("UPDATE post SET schedule_id = ?, color = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			const setScheduleAndSlot = db.prepare("UPDATE post SET scheduled_at = ?, schedule_id = ?, status = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			for (let i = 0; i < createdIds.length; i++) {
				const postId = createdIds[i];
				const slot = slotDatetimes[i];
				const status = importStatus === 'scheduled' && slot ? 'scheduled' : 'draft';
				if (slot) {
					if (limitsRss.postsSentPerMonth != null) {
						const slotMonth = monthKeyFromDate(slot);
						if (slotMonth) {
							const { sent, scheduled } = getPostsSentAndScheduledForMonth(db, accountId, slotMonth);
							const batchInMonth = postsPerMonthRss.get(slotMonth) ?? 0;
							if (sent + scheduled + batchInMonth + 1 > limitsRss.postsSentPerMonth) {
								return fail(403, {
									error: `Post limit for ${slotMonth} (${limitsRss.postsSentPerMonth}) would be exceeded.`
								});
							}
							postsPerMonthRss.set(slotMonth, batchInMonth + 1);
						}
					}
					setScheduleAndSlot.run(slot, scheduleId, status, scheduleColor, postId, accountId);
				} else {
					setScheduleOnly.run(scheduleId, scheduleColor, status, postId, accountId);
				}
				for (const sf of scheduleFields) {
					const fieldId = crypto.randomUUID();
					db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, postId, sf.key, sf.type, sf.value ?? '');
				}
			}
		}

		incrementUsageMonth(db, accountId, monthRss, { importOperations: 1 });
		throw redirect(303, `/posts?imported=${createdIds.length}`);
	},
	importFromCsv: async ({ request, locals }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const data = await request.formData();

		const importId = (data.get('csv_import_id') as string)?.trim() || '';
		if (!importId) return fail(400, { error: 'Missing CSV import id', action: 'importFromCsv' });

		let delimiter = (data.get('delimiter') as string) ?? ',';
		if (delimiter === '\\t') delimiter = '\t';
		const hasHeader =
			(data.get('has_header') as string) === 'on' ||
			(data.get('has_header') as string) === 'true';

		const webhookIds = data.getAll('webhook_ids').filter((v): v is string => typeof v === 'string' && v.trim() !== '');
		const scheduleId = (data.get('schedule_id') as string)?.trim() || null;
		const importStatus = ((data.get('import_status') as string) || 'draft').trim() === 'scheduled' ? 'scheduled' : 'draft';
		const titleColumn = (data.get('title_column') as string)?.trim() || '';
		const contentColumn = (data.get('content_column') as string)?.trim() || '';
		const imageUrlColumn = (data.get('image_url_column') as string)?.trim() || '';

		const customMappingJson = (data.get('custom_mapping') as string)?.trim() || '[]';
		const importStart = Math.max(1, parseInt((data.get('import_start') as string) || '1', 10));
		const importCount = Math.min(500, Math.max(1, parseInt((data.get('per_page') as string) || '20', 10)));
		const skipDuplicates = (data.get('skip_duplicates') as string) === 'on';

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

		// Load CSV rows
		const p = await csvPath(importId);
		let content: string;
		try {
			content = await fs.readFile(p, 'utf8');
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to read CSV file';
			return fail(400, { error: msg, action: 'importFromCsv' });
		}

		let rows: Record<string, unknown>[];
		try {
			const parsed = parseCsv(content, {
				delimiter: delimiter || ',',
				columns: hasHeader,
				relax_column_count: true,
				skip_empty_lines: true
			}) as unknown;

			if (hasHeader && Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object' && !Array.isArray(parsed[0])) {
				rows = parsed as Record<string, unknown>[];
			} else if (!hasHeader && Array.isArray(parsed)) {
				const arr = parsed as string[][];
				const cols = arr[0]?.length ?? 0;
				const headers = Array.from({ length: cols }, (_, i) => `col_${i + 1}`);
				rows = arr.map((r) => {
					const obj: Record<string, unknown> = {};
					headers.forEach((h, i) => {
						obj[h] = r[i] ?? '';
					});
					return obj;
				});
			} else {
				rows = [];
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Failed to parse CSV';
			return fail(400, { error: msg, action: 'importFromCsv' });
		}

		const startIndex = Math.max(0, importStart - 1);
		const endIndex = Math.min(rows.length, startIndex + importCount);
		const slice = rows.slice(startIndex, endIndex);

		const db = getDatabase();
		const tierRowCsv = db.prepare('SELECT tier FROM user WHERE id = ?').get(accountId) as { tier: string } | undefined;
		const tierCsv = tierRowCsv?.tier ?? 'free';
		const monthCsv = currentMonthKey();
		const importCheckCsv = canRunImportOperation(db, accountId, monthCsv, tierCsv);
		if (!importCheckCsv.allowed) return fail(403, { error: importCheckCsv.reason ?? 'Import limit exceeded for this month.', action: 'importFromCsv' });

		for (const wid of webhookIds) {
			const webhook = db
				.prepare('SELECT id FROM webhook_config WHERE id = ? AND account_id = ?')
				.get(wid, accountId) as { id: string } | undefined;
			if (!webhook) return fail(400, { error: 'Invalid webhook selected', action: 'importFromCsv' });
		}
		if (scheduleId) {
			const schedule = db
				.prepare('SELECT id FROM schedule WHERE id = ? AND account_id = ?')
				.get(scheduleId, accountId) as { id: string } | undefined;
			if (!schedule) return fail(400, { error: 'Invalid schedule', action: 'importFromCsv' });
		}

		const insertPost = db.prepare(
			'INSERT INTO post (id, account_id, webhook_id, title, content, image_url, color, status, import_source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
		);
		const insertField = db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)');
		const existingBySource =
			skipDuplicates
				? db.prepare('SELECT 1 FROM post WHERE account_id = ? AND import_source_id = ? LIMIT 1')
				: null;

		function csvImportSourceId(row: Record<string, unknown>, index: number): string {
			const id = (row.id as string)?.trim();
			if (id) return `csv:${importId}:${id}`;
			return `csv:${importId}:${importStart + index}`;
		}

		const createdIds: string[] = [];
		const transaction = db.transaction(() => {
			for (let i = 0; i < slice.length; i++) {
				const row = slice[i];
				if (!evaluateFilter(row, filterConfig)) continue;
				const sourceId = csvImportSourceId(row, i);
				if (skipDuplicates && existingBySource?.get(accountId, sourceId)) continue;

				const titleRaw = titleColumn ? getAtPath(row, titleColumn) : undefined;
				const contentRaw = contentColumn ? getAtPath(row, contentColumn) : undefined;
				const imageRaw = imageUrlColumn ? getAtPath(row, imageUrlColumn) : undefined;

				const title = stringValue(titleRaw) || '(no title)';
				const content = stringValue(contentRaw);
				const imageUrl = imageRaw != null ? stringValue(imageRaw).trim() || null : null;

				const id = crypto.randomUUID();
				const primaryWebhookId = webhookIds.length > 0 ? webhookIds[0] : null;
				insertPost.run(id, accountId, primaryWebhookId, title, content, imageUrl, null, 'draft', sourceId);
				createdIds.push(id);

				for (const m of customMapping) {
					if (!m.path.trim() || !m.key.trim()) continue;
					const value = resolveValue(
						row,
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

		if (webhookIds.length > 0) {
			for (const postId of createdIds) {
				setPostWebhooks(db, postId, accountId, webhookIds);
			}
		}

		const limitsCsv = getTierLimits(tierCsv);
		const postsPerMonthCsv = new Map<string, number>();
		if (scheduleId && createdIds.length > 0) {
			const scheduleRow = db.prepare('SELECT color FROM schedule WHERE id = ? AND account_id = ?').get(scheduleId, accountId) as { color: string | null } | undefined;
			const scheduleColor = scheduleRow?.color ?? null;
			const ruleCount = db.prepare('SELECT COUNT(*) as n FROM schedule_rule WHERE schedule_id = ?').get(scheduleId) as { n: number };
			let slotDatetimes: string[];
			if (ruleCount.n > 0) {
				slotDatetimes = generateSlots(scheduleId, createdIds.length, undefined, accountId);
			} else {
				const fixedSlots = db
					.prepare('SELECT scheduled_at FROM schedule_slot WHERE schedule_id = ? ORDER BY order_index')
					.all(scheduleId) as { scheduled_at: string }[];
				slotDatetimes = fixedSlots.map((s) => s.scheduled_at);
			}
			const scheduleFields = db
				.prepare('SELECT key, type, value FROM schedule_field WHERE schedule_id = ?')
				.all(scheduleId) as { key: string; type: string; value: string | null }[];
			const setScheduleOnly = db.prepare("UPDATE post SET schedule_id = ?, color = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			const setScheduleAndSlot = db.prepare("UPDATE post SET scheduled_at = ?, schedule_id = ?, status = ?, color = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?");
			for (let i = 0; i < createdIds.length; i++) {
				const postId = createdIds[i];
				const slot = slotDatetimes[i];
				const status = importStatus === 'scheduled' && slot ? 'scheduled' : 'draft';
				if (slot) {
					if (limitsCsv.postsSentPerMonth != null) {
						const slotMonth = monthKeyFromDate(slot);
						if (slotMonth) {
							const { sent, scheduled } = getPostsSentAndScheduledForMonth(db, accountId, slotMonth);
							const batchInMonth = postsPerMonthCsv.get(slotMonth) ?? 0;
							if (sent + scheduled + batchInMonth + 1 > limitsCsv.postsSentPerMonth) {
								return fail(403, {
									error: `Post limit for ${slotMonth} (${limitsCsv.postsSentPerMonth}) would be exceeded.`,
									action: 'importFromCsv'
								});
							}
							postsPerMonthCsv.set(slotMonth, batchInMonth + 1);
						}
					}
					setScheduleAndSlot.run(slot, scheduleId, status, scheduleColor, postId, accountId);
				} else {
					setScheduleOnly.run(scheduleId, scheduleColor, status, postId, accountId);
				}
				for (const sf of scheduleFields) {
					const fieldId = crypto.randomUUID();
					db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)').run(fieldId, postId, sf.key, sf.type, sf.value ?? '');
				}
			}
		}

		incrementUsageMonth(db, accountId, monthCsv, { importOperations: 1 });
		throw redirect(303, `/posts?imported=${createdIds.length}`);
	},
	...callbackTokenFormActions
};
