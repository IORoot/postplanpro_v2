/**
 * Seeds a dedicated SQLite DB with an admin user, starts the dev server briefly,
 * captures PNG screenshots (Playwright), writes WebP thumbnails (sharp), and
 * updates `src/routes/welcome/technical/screenshots.manifest.json`.
 *
 * Run from repo root (Node + tsx — not Bun: better-sqlite3 is native):
 *   npm run screenshots:capture
 *
 * Requires Chromium (e.g. `npx playwright install chromium`) and network access
 * for the WordPress discover/fetch steps (londonparkour.com).
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, type Page } from 'playwright';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DB_PATH = path.join(ROOT, '.tmp', 'screenshot-capture.db');
const PORT = process.env.SCREENSHOT_PORT ?? '5180';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = process.env.AUTH_SECRET ?? 'screenshot-capture-auth-secret-min-32-chars!!';
const ADMIN_EMAIL = 'screenshots-admin@postplan.test';
const ADMIN_PASSWORD = 'ScreenshotPass1!';
const ADMIN_ID = 'screenshot-admin-id';
const MEMBER_ID = 'screenshot-member-id';

/** Stable IDs referenced by capture URLs */
const SCHEDULE_ID = 'screenshot-schedule-1';
const POST_DRAFT_ID = 'screenshot-post-draft';
const WEBHOOK_ID = 'screenshot-webhook-1';

const STATIC_FULL = path.join(ROOT, 'static', 'screenshots', 'full');
const STATIC_THUMB = path.join(ROOT, 'static', 'screenshots', 'thumb');
const MANIFEST_PATH = path.join(ROOT, 'src', 'routes', 'welcome', 'technical', 'screenshots.manifest.json');

const CALENDAR_ANCHOR = '2026-06-15';
const WP_DEMO_SITE = 'https://londonparkour.com';

type ManifestShot = { thumb: string; full: string; caption: string };
type Manifest = Record<string, ManifestShot[]>;

function shot(id: string, caption: string): ManifestShot {
	return {
		thumb: `/screenshots/thumb/${id}.webp`,
		full: `/screenshots/full/${id}.png`,
		caption
	};
}

/** Matches `screenshots.manifest.json` / filenames under static/screenshots/full. */
function buildManifest(): Manifest {
	return {
		'1': [
			shot('calendar-day', 'Calendar — Day view'),
			shot('calendar-week', 'Calendar — Week view'),
			shot('calendar-month', 'Calendar — Month view'),
			shot('calendar-year', 'Calendar — Year view'),
			shot('calendar-agenda', 'Calendar — Agenda view'),
			shot('calendar-schedule', 'Calendar — Schedule view')
		],
		'2': [
			shot('schedules-list', 'Schedules — list and recurrence overview'),
			shot('schedule-edit', 'Schedule editor — rules, custom fields, apply to posts')
		],
		'3': [
			shot('post-list', 'Posts — list, filters, and bulk actions'),
			shot('post-edit', 'Post editor — payload, schedule, custom fields, JSON override')
		],
		'4': [
			shot('import-wordpress-wizard', 'Inputs — WordPress import wizard'),
			shot('import-squarespace-wizard', 'Inputs — Squarespace import wizard'),
			shot('import-rss-wizard', 'Inputs — RSS / Atom feed import'),
			shot('import-csv-wizard', 'Inputs — CSV import wizard'),
			shot('import-webhook', 'Inputs — inbound import webhook (API)'),
			shot('import-callback', 'Inputs — post notification callbacks')
		],
		'5': [
			shot('output-webhooks', 'Outputs — outbound webhooks'),
			shot('output-presets', 'Outputs — automation presets marketplace')
		],
		'6': [
			shot('report-statistics', 'Reports — statistics'),
			shot('report-request-response', 'Reports — request / response log'),
			shot('report-callback-stages', 'Reports — callback stages')
		],
		'7': [],
		plans: [],
		sending: [],
		limits: []
	};
}

function rmDbArtifacts(base: string): void {
	for (const suf of ['', '-wal', '-shm']) {
		const f = base + (suf || '');
		if (existsSync(f)) {
			try {
				unlinkSync(f);
			} catch {
				// ignore
			}
		}
	}
}

async function importHash(): Promise<(p: string) => string> {
	const { hashPasswordForTest } = await import('../tests/helpers/hashCredentials.js');
	return hashPasswordForTest;
}

async function importDb() {
	process.env.DATABASE_PATH = DB_PATH;
	return import('../src/lib/db/index.js');
}

async function seedDatabase(): Promise<void> {
	mkdirSync(path.dirname(DB_PATH), { recursive: true });
	rmDbArtifacts(DB_PATH);
	const { getDatabase, closeDatabaseForTesting } = await importDb();
	closeDatabaseForTesting();
	const hashPasswordForTest = await importHash();
	const db = getDatabase();
	const adminHash = hashPasswordForTest(ADMIN_PASSWORD);
	const dummyHash = hashPasswordForTest('UnusedMember1!');

	db.prepare('DELETE FROM user WHERE id IN (?, ?)').run(ADMIN_ID, MEMBER_ID);
	db.prepare(
		`INSERT INTO user (id, email, email_verified_at, password_hash, tier, callback_token)
     VALUES (?, ?, datetime('now'), ?, 'admin', 'screenshot-cb-admin')`
	).run(ADMIN_ID, ADMIN_EMAIL, adminHash);
	db.prepare(
		`INSERT INTO user (id, email, email_verified_at, password_hash, tier, callback_token)
     VALUES (?, ?, datetime('now'), ?, 'free', 'screenshot-cb-member')`
	).run(MEMBER_ID, 'member@postplan.test', dummyHash);

	db.prepare('DELETE FROM webhook_config WHERE account_id = ?').run(ADMIN_ID);
	db.prepare('INSERT INTO webhook_config (id, account_id, name, url) VALUES (?, ?, ?, ?)').run(
		WEBHOOK_ID,
		ADMIN_ID,
		'Make.com',
		'https://hook.make.com/example'
	);

	db.prepare('DELETE FROM schedule WHERE account_id = ?').run(ADMIN_ID);
	db.prepare('INSERT INTO schedule (id, account_id, name, description, color) VALUES (?, ?, ?, ?, ?)').run(
		SCHEDULE_ID,
		ADMIN_ID,
		'Weekday 9am + daily backup',
		'Multiple rules example',
		'#005f78'
	);
	db.prepare('DELETE FROM schedule_rule WHERE schedule_id = ?').run(SCHEDULE_ID);
	db.prepare(
		`INSERT INTO schedule_rule (id, schedule_id, type, config, start_at, end_at, order_index)
     VALUES (?, ?, 'weekly', ?, NULL, NULL, 0)`
	).run(randomUUID(), SCHEDULE_ID, JSON.stringify({ dayOfWeek: [1, 2, 3, 4, 5], time: '09:00' }));
	db.prepare(
		`INSERT INTO schedule_rule (id, schedule_id, type, config, start_at, end_at, order_index)
     VALUES (?, ?, 'daily', ?, NULL, NULL, 1)`
	).run(randomUUID(), SCHEDULE_ID, JSON.stringify({ time: '14:30' }));

	const postScheduled = 'screenshot-post-scheduled';
	db.prepare('DELETE FROM post WHERE account_id = ?').run(ADMIN_ID);
	db.prepare(
		`INSERT INTO post (id, account_id, webhook_id, schedule_id, title, content, scheduled_at, status, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
	).run(
		POST_DRAFT_ID,
		ADMIN_ID,
		WEBHOOK_ID,
		SCHEDULE_ID,
		'Q2 launch announcement',
		'Draft body for the campaign…',
		null,
		'draft',
		'#6D00CC'
	);
	db.prepare(
		`INSERT INTO post (id, account_id, webhook_id, schedule_id, title, content, scheduled_at, status, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
	).run(
		postScheduled,
		ADMIN_ID,
		WEBHOOK_ID,
		SCHEDULE_ID,
		'Weekly digest',
		'',
		'2026-06-20T14:00:00.000Z',
		'scheduled',
		'#EA4B71'
	);

	closeDatabaseForTesting();
}

function startServer(): ChildProcess {
	const env = {
		...process.env,
		DATABASE_PATH: DB_PATH,
		AUTH_SECRET,
		APP_BASE_URL: BASE_URL,
		AUTH_TRUST_HOST: 'true',
		SUPPRESS_AUTH_CREDENTIALS_ERROR_LOG: '1'
	};
	return spawn('npm', ['run', 'dev', '--', '--port', PORT, '--host', '127.0.0.1'], {
		cwd: ROOT,
		env,
		shell: false,
		stdio: ['ignore', 'pipe', 'pipe']
	});
}

async function waitForHttpOk(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const r = await fetch(url);
			if (r.ok) return;
		} catch {
			// retry
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error(`Server did not respond OK at ${url} within ${timeoutMs}ms`);
}

async function signIn(page: Page): Promise<void> {
	await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
	await page.getByLabel('Email', { exact: true }).fill(ADMIN_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
	await page.getByRole('button', { name: 'Sign in with email' }).click();
	await page.waitForURL(/\/calendar/, { timeout: 45_000 });
}

async function saveViewportPngWebp(page: Page, id: string): Promise<void> {
	const fullPng = path.join(STATIC_FULL, `${id}.png`);
	const thumbWebp = path.join(STATIC_THUMB, `${id}.webp`);
	await page.screenshot({ path: fullPng, type: 'png', fullPage: false });
	await sharp(fullPng).resize({ width: 960, withoutEnlargement: true }).webp({ quality: 86 }).toFile(thumbWebp);
}

/** WordPress wizard — saves final mapping step as import-wordpress-wizard (matches static asset name). */
async function captureWordPressWizard(page: Page): Promise<void> {
	await page.goto(`${BASE_URL}/inputs?section=cms`, { waitUntil: 'load' });
	await page.waitForTimeout(400);
	await page.getByRole('button', { name: 'WordPress' }).click();
	await page.waitForSelector('#wp_site_url', { timeout: 15_000 });
	await page.fill('#wp_site_url', WP_DEMO_SITE);
	await page.waitForTimeout(300);
	await page.getByRole('button', { name: 'Discover post types' }).click();
	await page.getByRole('heading', { name: /2\. Discover post type structure/i }).waitFor({ state: 'visible', timeout: 90_000 });
	await page.waitForTimeout(600);
	await page.getByRole('button', { name: 'Retrieve first entry' }).click();
	await page.getByRole('heading', { name: /3\. Map fields and import/i }).waitFor({ state: 'visible', timeout: 90_000 });
	await page.waitForTimeout(600);
	await saveViewportPngWebp(page, 'import-wordpress-wizard');
}

async function main(): Promise<void> {
	mkdirSync(STATIC_FULL, { recursive: true });
	mkdirSync(STATIC_THUMB, { recursive: true });

	console.log('Seeding screenshot database…');
	await seedDatabase();

	console.log(`Starting dev server on ${BASE_URL}…`);
	const proc = startServer();
	proc.stderr?.on('data', (d) => process.stderr.write(d));
	proc.stdout?.on('data', (d) => process.stdout.write(d));

	let exitCode = 1;
	try {
		await waitForHttpOk(`${BASE_URL}/`, 60_000);

		const browser = await chromium.launch({ headless: true });
		const context = await browser.newContext({
			viewport: { width: 1440, height: 900 },
			deviceScaleFactor: 1
		});
		const page = await context.newPage();

		console.log('Signing in as admin…');
		await signIn(page);

		const views = ['day', 'week', 'month', 'year', 'agenda', 'schedule'] as const;
		for (const v of views) {
			const id = `calendar-${v}`;
			console.log(`Capturing ${id}…`);
			await page.goto(`${BASE_URL}/calendar?view=${v}&date=${CALENDAR_ANCHOR}`, { waitUntil: 'load' });
			await page.waitForTimeout(500);
			await saveViewportPngWebp(page, id);
		}

		console.log('Capturing schedules-list…');
		await page.goto(`${BASE_URL}/schedules`, { waitUntil: 'load' });
		await page.waitForTimeout(400);
		await saveViewportPngWebp(page, 'schedules-list');

		console.log('Capturing schedule-edit…');
		await page.goto(`${BASE_URL}/schedules/${SCHEDULE_ID}`, { waitUntil: 'load' });
		await page.waitForTimeout(600);
		await saveViewportPngWebp(page, 'schedule-edit');

		console.log('Capturing post-list…');
		await page.goto(`${BASE_URL}/posts`, { waitUntil: 'load' });
		await page.waitForTimeout(400);
		await saveViewportPngWebp(page, 'post-list');

		console.log('Capturing post-edit…');
		await page.goto(`${BASE_URL}/posts/${POST_DRAFT_ID}`, { waitUntil: 'load' });
		await page.waitForTimeout(600);
		await saveViewportPngWebp(page, 'post-edit');

		console.log('Capturing WordPress wizard (live site)…');
		await captureWordPressWizard(page);

		console.log('Capturing import-webhook…');
		await page.goto(`${BASE_URL}/inputs/webhooks`, { waitUntil: 'load' });
		await page.waitForTimeout(400);
		await saveViewportPngWebp(page, 'import-webhook');

		console.log('Capturing import-callback…');
		await page.goto(`${BASE_URL}/inputs?section=callbacks`, { waitUntil: 'load' });
		await page.waitForTimeout(400);
		await saveViewportPngWebp(page, 'import-callback');

		console.log('Capturing output-webhooks…');
		await page.goto(`${BASE_URL}/outputs/webhooks`, { waitUntil: 'load' });
		await page.waitForTimeout(400);
		await saveViewportPngWebp(page, 'output-webhooks');

		console.log('Capturing output-presets…');
		await Promise.all([
			page.waitForResponse((res) => res.url().includes('scenarios.json') && res.ok(), { timeout: 20_000 }),
			page.goto(`${BASE_URL}/outputs/presets`, { waitUntil: 'domcontentloaded' })
		]);
		await page.waitForTimeout(800);
		await saveViewportPngWebp(page, 'output-presets');

		for (const [id, path] of [
			['report-statistics', '/reports?report=statistics'],
			['report-request-response', '/reports'],
			['report-callback-stages', '/reports?report=callback-stages']
		] as const) {
			console.log(`Capturing ${id}…`);
			await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load' });
			await page.waitForTimeout(500);
			await saveViewportPngWebp(page, id);
		}

		await browser.close();

		const manifest = buildManifest();
		writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
		console.log(`Wrote manifest → ${path.relative(ROOT, MANIFEST_PATH)}`);
		exitCode = 0;
	} finally {
		proc.kill('SIGTERM');
		await new Promise((r) => setTimeout(r, 500));
		if (proc.exitCode === null) proc.kill('SIGKILL');
	}

	process.exit(exitCode);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
