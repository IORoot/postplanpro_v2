import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SCENARIOS_PATH = path.join(process.cwd(), 'static', 'scenarios.json');
const OG_IMAGE_RE = /<meta\s+property="og:image"\s+content="([^"]+)"/i;
const MAKE_SHARED_SCENARIO_RE = /make\.com\/public\/shared-scenario\//i;
const CACHE_TTL_MS = 60 * 60 * 1000;

type ScenarioBase = {
	image: string;
	title: string;
	author: string;
	description: string;
	link: string;
	target: 'make' | 'zapier' | 'n8n' | 'ifttt';
	tags: string[];
};

export type ScenarioWithPreview = ScenarioBase & { makePreviewUrl?: string };

const previewCache = new Map<string, { url: string | null; expires: number }>();

async function fetchMakeScenarioPreviewUrl(link: string): Promise<string | null> {
	const now = Date.now();
	const hit = previewCache.get(link);
	if (hit && hit.expires > now) return hit.url;

	let url: string | null = null;
	try {
		const res = await fetch(link, {
			redirect: 'follow',
			headers: { 'User-Agent': 'PostPlanPresets/1.0' },
			signal: AbortSignal.timeout(12_000)
		});
		if (!res.ok) {
			previewCache.set(link, { url: null, expires: now + 5 * 60 * 1000 });
			return null;
		}
		const html = await res.text();
		const m = html.match(OG_IMAGE_RE);
		url = m?.[1]?.trim() ?? null;
	} catch {
		previewCache.set(link, { url: null, expires: now + 5 * 60 * 1000 });
		return null;
	}

	previewCache.set(link, { url, expires: now + CACHE_TTL_MS });
	return url;
}

export async function load(): Promise<{ scenarios: ScenarioWithPreview[] }> {
	const raw = await readFile(SCENARIOS_PATH, 'utf-8');
	const scenarios: ScenarioBase[] = JSON.parse(raw) as ScenarioBase[];

	const makeLinks = scenarios
		.filter((s) => s.target === 'make' && MAKE_SHARED_SCENARIO_RE.test(s.link))
		.map((s) => s.link);

	const uniqueLinks = [...new Set(makeLinks)];
	const previewByLink = new Map<string, string | null>();
	await Promise.all(
		uniqueLinks.map(async (link) => {
			const url = await fetchMakeScenarioPreviewUrl(link);
			previewByLink.set(link, url);
		})
	);

	const enriched: ScenarioWithPreview[] = scenarios.map((s) => {
		if (s.target !== 'make' || !MAKE_SHARED_SCENARIO_RE.test(s.link)) return s;
		const makePreviewUrl = previewByLink.get(s.link) ?? null;
		if (!makePreviewUrl) return s;
		return { ...s, makePreviewUrl };
	});

	return { scenarios: enriched };
}
