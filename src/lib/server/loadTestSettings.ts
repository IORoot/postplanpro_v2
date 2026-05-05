import { getDatabase } from '$lib/db/index.js';

export const LOAD_TEST_SETTING_KEYS = {
	allowProdLoadTest: 'loadtest:allow_prod',
	uiUsers: 'loadtest:ui_users',
	scenarioMix: 'loadtest:scenario_mix'
} as const;

export type ScenarioMixEntry = {
	name: string;
	weight: number;
};

export type LoadTestSettings = {
	allowProdLoadTest: boolean;
	uiUsers: number;
	scenarioMix: ScenarioMixEntry[];
};

const DEFAULT_SCENARIO_MIX: ScenarioMixEntry[] = [
	{ name: 'browse_calendar', weight: 30 },
	{ name: 'browse_posts', weight: 25 },
	{ name: 'create_draft_post', weight: 15 },
	{ name: 'edit_post', weight: 10 },
	{ name: 'browse_reports', weight: 10 },
	{ name: 'browse_outputs', weight: 10 }
];

export const DEFAULTS = {
	allowProdLoadTest: false,
	uiUsers: 10,
	scenarioMix: DEFAULT_SCENARIO_MIX
} as const;

const UI_USERS_MIN = 1;
const UI_USERS_MAX = 10_000;

function clamp(n: number, min: number, max: number): number {
	return Math.min(Math.max(n, min), max);
}

function parsePositiveInt(raw: string | null | undefined): number | null {
	if (!raw) return null;
	const n = Number.parseInt(String(raw).trim(), 10);
	if (!Number.isFinite(n) || n < 1) return null;
	return n;
}

function parseBoolean(raw: string | null | undefined): boolean | null {
	if (raw === null || raw === undefined) return null;
	const s = String(raw).trim().toLowerCase();
	if (s === '') return null;
	if (['1', 'true', 'yes', 'on'].includes(s)) return true;
	if (['0', 'false', 'no', 'off'].includes(s)) return false;
	return null;
}

export function parseScenarioMix(raw: string | null | undefined): ScenarioMixEntry[] | null {
	if (!raw) return null;
	const trimmed = String(raw).trim();
	if (!trimmed) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed)) return null;
	const entries: ScenarioMixEntry[] = [];
	for (const item of parsed) {
		if (!item || typeof item !== 'object') return null;
		const candidate = item as { name?: unknown; weight?: unknown };
		if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) return null;
		const weight = Number(candidate.weight);
		if (!Number.isFinite(weight) || weight <= 0) return null;
		entries.push({ name: candidate.name.trim(), weight });
	}
	if (entries.length === 0) return null;
	return entries;
}

function getSettingValue(key: string): string | null {
	const db = getDatabase();
	const row = db.prepare('SELECT value FROM app_setting WHERE key = ?').get(key) as
		| { value: string }
		| undefined;
	return row?.value ?? null;
}

export function readLoadTestSettingsWithFallback(): LoadTestSettings {
	const allowRaw =
		getSettingValue(LOAD_TEST_SETTING_KEYS.allowProdLoadTest) ?? process.env.ALLOW_PROD_LOAD_TEST ?? '';
	const uiUsersRaw =
		getSettingValue(LOAD_TEST_SETTING_KEYS.uiUsers) ?? process.env.UI_USERS ?? '';
	const scenarioRaw =
		getSettingValue(LOAD_TEST_SETTING_KEYS.scenarioMix) ?? process.env.SCENARIO_MIX ?? '';

	const allowProdLoadTest = parseBoolean(allowRaw) ?? DEFAULTS.allowProdLoadTest;
	const uiUsers = clamp(
		parsePositiveInt(uiUsersRaw) ?? DEFAULTS.uiUsers,
		UI_USERS_MIN,
		UI_USERS_MAX
	);
	const scenarioMix = parseScenarioMix(scenarioRaw) ?? DEFAULTS.scenarioMix;

	return { allowProdLoadTest, uiUsers, scenarioMix };
}

export function readLoadTestSettingsForAdmin(): {
	effective: LoadTestSettings;
	dbOverrides: {
		allowProdLoadTest: boolean | null;
		uiUsers: number | null;
		scenarioMix: ScenarioMixEntry[] | null;
		scenarioMixRaw: string | null;
	};
	limits: { uiUsersMin: number; uiUsersMax: number };
	defaultScenarioMix: ScenarioMixEntry[];
} {
	const dbAllow = parseBoolean(getSettingValue(LOAD_TEST_SETTING_KEYS.allowProdLoadTest));
	const dbUiUsers = parsePositiveInt(getSettingValue(LOAD_TEST_SETTING_KEYS.uiUsers));
	const scenarioMixRaw = getSettingValue(LOAD_TEST_SETTING_KEYS.scenarioMix);
	const dbScenarioMix = parseScenarioMix(scenarioMixRaw);
	return {
		effective: readLoadTestSettingsWithFallback(),
		dbOverrides: {
			allowProdLoadTest: dbAllow,
			uiUsers: dbUiUsers,
			scenarioMix: dbScenarioMix,
			scenarioMixRaw
		},
		limits: { uiUsersMin: UI_USERS_MIN, uiUsersMax: UI_USERS_MAX },
		defaultScenarioMix: DEFAULT_SCENARIO_MIX
	};
}

export function upsertLoadTestSettings(input: {
	allowProdLoadTest: boolean;
	uiUsers: number;
	scenarioMix: ScenarioMixEntry[];
}): void {
	const db = getDatabase();
	const upsert = db.prepare(
		`INSERT INTO app_setting (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
	);
	upsert.run(LOAD_TEST_SETTING_KEYS.allowProdLoadTest, input.allowProdLoadTest ? 'true' : 'false');
	upsert.run(LOAD_TEST_SETTING_KEYS.uiUsers, String(input.uiUsers));
	upsert.run(LOAD_TEST_SETTING_KEYS.scenarioMix, JSON.stringify(input.scenarioMix));
}

export function clearLoadTestSettingsOverrides(): void {
	const db = getDatabase();
	db.prepare('DELETE FROM app_setting WHERE key IN (?, ?, ?)').run(
		LOAD_TEST_SETTING_KEYS.allowProdLoadTest,
		LOAD_TEST_SETTING_KEYS.uiUsers,
		LOAD_TEST_SETTING_KEYS.scenarioMix
	);
}

export const LOAD_TEST_LIMITS = {
	uiUsersMin: UI_USERS_MIN,
	uiUsersMax: UI_USERS_MAX
} as const;
