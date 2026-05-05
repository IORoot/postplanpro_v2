import type { Page } from '@playwright/test';

/**
 * Scenarios used by the multi-user UI suite. Each scenario performs a small,
 * realistic interaction sequence and records timings via `record`.
 *
 * Names must match the keys in admin "Scenario mix" (see loadTestSettings.ts).
 */

export type ScenarioContext = {
	page: Page;
	persona: string;
	runId: string;
	record: (event: ScenarioEvent) => void;
};

export type ScenarioEvent = {
	scenario: string;
	step: string;
	durationMs: number;
	ok: boolean;
	error?: string;
};

export type ScenarioFn = (ctx: ScenarioContext) => Promise<void>;

async function timed<T>(
	ctx: ScenarioContext,
	scenario: string,
	step: string,
	fn: () => Promise<T>
): Promise<T> {
	const t0 = Date.now();
	try {
		const result = await fn();
		ctx.record({ scenario, step, durationMs: Date.now() - t0, ok: true });
		return result;
	} catch (e) {
		ctx.record({
			scenario,
			step,
			durationMs: Date.now() - t0,
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		});
		throw e;
	}
}

const browseCalendar: ScenarioFn = async (ctx) => {
	await timed(ctx, 'browse_calendar', 'goto', () => ctx.page.goto('/calendar'));
	await timed(ctx, 'browse_calendar', 'wait_heading', () =>
		ctx.page.getByRole('heading', { name: /^Calendar$/i }).waitFor({ timeout: 10_000 })
	);
};

const browsePosts: ScenarioFn = async (ctx) => {
	await timed(ctx, 'browse_posts', 'goto', () => ctx.page.goto('/posts'));
	await timed(ctx, 'browse_posts', 'wait_heading', () =>
		ctx.page.getByRole('heading', { name: 'Posts', exact: true }).waitFor({ timeout: 10_000 })
	);
};

const browseReports: ScenarioFn = async (ctx) => {
	await timed(ctx, 'browse_reports', 'goto', () => ctx.page.goto('/reports'));
	await timed(ctx, 'browse_reports', 'wait_heading', () =>
		ctx.page
			.getByRole('heading', { name: /request|response|callback stages/i })
			.first()
			.waitFor({ timeout: 10_000 })
	);
};

const browseOutputs: ScenarioFn = async (ctx) => {
	await timed(ctx, 'browse_outputs', 'goto', () => ctx.page.goto('/outputs/webhooks'));
	await timed(ctx, 'browse_outputs', 'wait_url', () =>
		ctx.page.waitForURL(/\/outputs\/webhooks/, { timeout: 10_000 })
	);
};

const createDraftPost: ScenarioFn = async (ctx) => {
	await timed(ctx, 'create_draft_post', 'goto', () => ctx.page.goto('/posts/new'));
	const title = `LT ${ctx.runId.slice(-8)} ${ctx.persona} ${Date.now()}`;
	await timed(ctx, 'create_draft_post', 'fill_title', async () => {
		const titleField = ctx.page.getByLabel(/title/i).first();
		await titleField.waitFor({ timeout: 10_000 });
		await titleField.fill(title);
	});
	await timed(ctx, 'create_draft_post', 'submit', async () => {
		const saveBtn = ctx.page.getByRole('button', { name: /save|create/i }).first();
		if (await saveBtn.isVisible().catch(() => false)) {
			await saveBtn.click();
		}
	});
};

const editPost: ScenarioFn = async (ctx) => {
	await timed(ctx, 'edit_post', 'goto_list', () => ctx.page.goto('/posts'));
	await timed(ctx, 'edit_post', 'open_first', async () => {
		const firstLink = ctx.page.locator('a[href^="/posts/"]').first();
		if (await firstLink.isVisible().catch(() => false)) {
			await firstLink.click();
			await ctx.page.waitForLoadState('domcontentloaded');
		}
	});
};

export const SCENARIOS: Record<string, ScenarioFn> = {
	browse_calendar: browseCalendar,
	browse_posts: browsePosts,
	browse_reports: browseReports,
	browse_outputs: browseOutputs,
	create_draft_post: createDraftPost,
	edit_post: editPost
};

export type WeightedScenario = { name: string; weight: number };

export function pickScenario(mix: WeightedScenario[], rand: () => number = Math.random): string {
	const total = mix.reduce((sum, m) => sum + Math.max(0, m.weight), 0);
	if (total <= 0) return mix[0]?.name ?? 'browse_calendar';
	let r = rand() * total;
	for (const entry of mix) {
		r -= Math.max(0, entry.weight);
		if (r <= 0) return entry.name;
	}
	return mix[mix.length - 1]?.name ?? 'browse_calendar';
}

export function parseScenarioMixEnv(raw: string | undefined, fallback: WeightedScenario[]): WeightedScenario[] {
	if (!raw) return fallback;
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return fallback;
		const out: WeightedScenario[] = [];
		for (const item of parsed) {
			if (!item || typeof item !== 'object') return fallback;
			const cand = item as { name?: unknown; weight?: unknown };
			if (typeof cand.name !== 'string' || typeof cand.weight !== 'number') return fallback;
			if (!SCENARIOS[cand.name]) continue;
			out.push({ name: cand.name, weight: cand.weight });
		}
		return out.length > 0 ? out : fallback;
	} catch {
		return fallback;
	}
}

export const DEFAULT_SCENARIO_MIX: WeightedScenario[] = [
	{ name: 'browse_calendar', weight: 30 },
	{ name: 'browse_posts', weight: 25 },
	{ name: 'create_draft_post', weight: 15 },
	{ name: 'edit_post', weight: 10 },
	{ name: 'browse_reports', weight: 10 },
	{ name: 'browse_outputs', weight: 10 }
];
