import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { schema } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

function resolveDbPath(): string {
	const fromEnv = process.env.DATABASE_PATH?.trim();
	return fromEnv && fromEnv.length > 0 ? fromEnv : path.join(process.cwd(), 'data', 'postplan.db');
}

/** Rebuild post + post_webhook so post.webhook_id can be NULL (imports without destination webhook). */
function migratePostWebhookIdNullable(database: Database.Database) {
	const cols = database.prepare('PRAGMA table_info(post)').all() as { name: string; notnull: number }[];
	const whCol = cols.find((c) => c.name === 'webhook_id');
	if (!whCol || whCol.notnull !== 1) return;

	database.pragma('foreign_keys = OFF');
	database.exec('BEGIN');
	try {
		database.exec('DROP TABLE IF EXISTS post_webhook_mig_backup');
		database.exec(
			'CREATE TEMP TABLE post_webhook_mig_backup AS SELECT post_id, webhook_id FROM post_webhook'
		);
		database.exec('DROP TABLE post_webhook');
		database.exec(`CREATE TABLE post__webhook_nullable (
			id TEXT PRIMARY KEY,
			account_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
			webhook_id TEXT REFERENCES webhook_config(id),
			schedule_id TEXT REFERENCES schedule(id),
			title TEXT NOT NULL,
			content TEXT,
			image_url TEXT,
			color TEXT,
			payload_override TEXT,
			scheduled_at TEXT,
			status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
			sent_at TEXT,
			error_message TEXT,
			import_source_id TEXT,
			created_at TEXT DEFAULT (datetime('now')),
			updated_at TEXT DEFAULT (datetime('now'))
		)`);
		database.exec(
			`INSERT INTO post__webhook_nullable SELECT id, account_id, webhook_id, schedule_id, title, content, image_url, color, payload_override, scheduled_at, status, sent_at, error_message, import_source_id, created_at, updated_at FROM post`
		);
		database.exec('DROP TABLE post');
		database.exec('ALTER TABLE post__webhook_nullable RENAME TO post');
		database.exec(`CREATE TABLE post_webhook (
			post_id TEXT NOT NULL REFERENCES post(id) ON DELETE CASCADE,
			webhook_id TEXT NOT NULL REFERENCES webhook_config(id),
			PRIMARY KEY (post_id, webhook_id)
		)`);
		database.exec('CREATE INDEX IF NOT EXISTS idx_post_webhook_post ON post_webhook(post_id)');
		database.exec(
			'INSERT OR IGNORE INTO post_webhook SELECT post_id, webhook_id FROM post_webhook_mig_backup'
		);
		database.exec('DROP TABLE post_webhook_mig_backup');
		const postIdx = [
			'CREATE INDEX IF NOT EXISTS idx_post_webhook ON post(webhook_id)',
			'CREATE INDEX IF NOT EXISTS idx_post_scheduled_at ON post(scheduled_at)',
			'CREATE INDEX IF NOT EXISTS idx_post_status ON post(status)',
			'CREATE INDEX IF NOT EXISTS idx_post_import_source ON post(account_id, import_source_id)',
			'CREATE INDEX IF NOT EXISTS idx_post_account ON post(account_id)',
			'CREATE INDEX IF NOT EXISTS idx_post_account_scheduled_at ON post(account_id, scheduled_at)'
		];
		for (const sql of postIdx) database.exec(sql);
		database.exec('COMMIT');
	} catch (e) {
		try {
			database.exec('ROLLBACK');
		} catch {
			/* ignore */
		}
		throw e;
	} finally {
		database.pragma('foreign_keys = ON');
	}
}

function getDb(): Database.Database {
	if (!db) {
		const dbPath = resolveDbPath();
		const dir = path.dirname(dbPath);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		db = new Database(dbPath);
		db.pragma('journal_mode = WAL');

		// Fresh-start auth rollout: if old tables exist without account ownership, stop early
		// with a clear error before running schema/index DDL that expects account_id columns.
		const hasPostTable = db
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'post'")
			.get() as { name: string } | undefined;
		if (hasPostTable) {
			const postColsBefore = db.prepare('PRAGMA table_info(post)').all() as {
				name: string;
			}[];
			if (!postColsBefore.some((c) => c.name === 'account_id')) {
				throw new Error(
					'Database schema is from a pre-auth version. Delete data/postplan.db (or set DATABASE_PATH to a new file) and restart.'
				);
			}
		}

		db.exec(schema);
		try {
			db.exec('ALTER TABLE user ADD COLUMN password_hash TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE user ADD COLUMN email_verified_at TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE user ADD COLUMN callback_token TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec("ALTER TABLE user ADD COLUMN timezone TEXT DEFAULT 'Europe/London'");
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE user ADD COLUMN timezone_migrated_at TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE post ADD COLUMN image_url TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE post ADD COLUMN color TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE post ADD COLUMN payload_override TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE post ADD COLUMN import_source_id TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('CREATE INDEX IF NOT EXISTS idx_post_import_source ON post(account_id, import_source_id)');
		} catch {
			// Index already exists
		}
		try {
			db.exec('ALTER TABLE schedule ADD COLUMN color TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec("ALTER TABLE post_stage ADD COLUMN status TEXT NOT NULL DEFAULT 'pass'");
		} catch {
			// Column already exists
		}
		try {
			db.exec("ALTER TABLE user ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'");
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE user ADD COLUMN stripe_customer_id TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE user ADD COLUMN stripe_subscription_id TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE user ADD COLUMN last_login_at TEXT');
		} catch {
			// Column already exists
		}
		try {
			db.exec('ALTER TABLE usage_month ADD COLUMN post_sends_override INTEGER');
		} catch {
			// Column already exists
		}
		// Backfill tier once: when tier exists but some users have null/empty, set first user admin, rest free
		try {
			const userCols = db.prepare('PRAGMA table_info(user)').all() as { name: string }[];
			if (userCols.some((c) => c.name === 'tier')) {
				const needsBackfill = db
					.prepare("SELECT 1 FROM user WHERE tier IS NULL OR tier = '' LIMIT 1")
					.get() as { '1': number } | undefined;
				if (needsBackfill) {
					db.prepare("UPDATE user SET tier = 'free' WHERE tier IS NULL OR tier = ''").run();
					const firstUser = db
						.prepare('SELECT id FROM user ORDER BY created_at ASC LIMIT 1')
						.get() as { id: string } | undefined;
					if (firstUser) {
						db.prepare("UPDATE user SET tier = 'admin' WHERE id = ?").run(firstUser.id);
					}
				}
			}
			if (userCols.some((c) => c.name === 'timezone')) {
				db.prepare("UPDATE user SET timezone = 'Europe/London' WHERE timezone IS NULL OR TRIM(timezone) = ''").run();
			}
		} catch {
			// Ignore
		}
		// Safety check after schema init.
		const postCols = db
			.prepare('PRAGMA table_info(post)')
			.all() as { name: string }[];
		if (!postCols.some((c) => c.name === 'account_id')) {
			throw new Error(
				'Database schema is from a pre-auth version. Delete data/postplan.db (or set DATABASE_PATH to a new file) and restart.'
			);
		}
		if (postCols.some((c) => c.name === 'color')) {
			const postsMissingColor = db.prepare("SELECT id FROM post WHERE color IS NULL OR TRIM(color) = ''").all() as {
				id: string;
			}[];
			const setColor = db.prepare('UPDATE post SET color = ? WHERE id = ?');
			for (const row of postsMissingColor) {
				setColor.run('#fafafa', row.id);
			}
			const legacyColorMap: Record<string, string> = {
				'#fecaca': '#fee2e2',
				'#fed7aa': '#ffedd5',
				'#fde68a': '#fef3c7',
				'#fef08a': '#fef9c3',
				'#bbf7d0': '#dcfce7',
				'#99f6e4': '#ccfbf1',
				'#a5f3fc': '#cffafe',
				'#bfdbfe': '#dbeafe',
				'#c7d2fe': '#e0e7ff',
				'#ddd6fe': '#ede9fe',
				'#e9d5ff': '#f3e8ff',
				'#fbcfe8': '#fce7f3'
			};
			const upgradeLegacyColor = db.prepare('UPDATE post SET color = ? WHERE color = ?');
			for (const [oldColor, newColor] of Object.entries(legacyColorMap)) {
				upgradeLegacyColor.run(newColor, oldColor);
			}
		}

		try {
			migratePostWebhookIdNullable(db);
		} catch (e) {
			console.error('[db] migratePostWebhookIdNullable failed:', e);
			throw e;
		}

		// Seed immutable default custom-field template if missing.
		const hasDefaultInstagramTemplate = db
			.prepare("SELECT id FROM field_template WHERE is_default = 1 AND name = 'Instagram'")
			.get() as { id: string } | undefined;
		if (!hasDefaultInstagramTemplate) {
			const templateId = crypto.randomUUID();
			db.prepare(
				"INSERT INTO field_template (id, account_id, name, is_default, created_at) VALUES (?, NULL, 'Instagram', 1, datetime('now'))"
			).run(templateId);
			const insertField = db.prepare(
				'INSERT INTO field_template_field (id, template_id, key, type, value, order_index) VALUES (?, ?, ?, ?, ?, ?)'
			);
			const defaults: Array<{ key: string; type: string; value: string }> = [
				{ key: 'instagram.title', type: 'string', value: '' },
				{ key: 'instagram.content', type: 'string', value: '' },
				{ key: 'instagram.tags', type: 'json', value: '[]' },
				{ key: 'instagram.image_url', type: 'string', value: '' },
				{ key: 'instagram.video_url', type: 'string', value: '' }
			];
			defaults.forEach((field, index) => {
				insertField.run(
					crypto.randomUUID(),
					templateId,
					field.key,
					field.type,
					field.value,
					index
				);
			});
		}
	}
	return db;
}

/** Use in server load/actions only. Returns the singleton DB instance. */
export function getDatabase(): Database.Database {
	return getDb();
}

/** Test-only: close singleton so a new DATABASE_PATH can open a fresh file. */
export function closeDatabaseForTesting(): void {
	if (db) {
		db.close();
		db = null;
	}
}

export type WebhookConfig = {
	id: string;
	account_id: string;
	name: string;
	url: string;
	api_token: string | null;
	api_key: string | null;
};

export type GlobalVariable = {
	id: string;
	account_id: string;
	key: string;
	value: string | null;
	type: string;
};

export type Schedule = {
	id: string;
	account_id: string;
	name: string;
	description: string | null;
	created_at: string;
};

export type ScheduleSlot = {
	id: string;
	schedule_id: string;
	scheduled_at: string;
	order_index: number;
};

export type ScheduleRule = {
	id: string;
	schedule_id: string;
	type: 'cron' | 'weekly' | 'daily' | 'monthly' | 'yearly' | 'interval' | 'once';
	config: string;
	start_at: string | null;
	end_at: string | null;
	order_index: number;
};

export type ScheduleField = {
	id: string;
	schedule_id: string;
	key: string;
	type: string;
	value: string | null;
};

export type Post = {
	id: string;
	account_id: string;
	webhook_id: string | null;
	schedule_id: string | null;
	title: string;
	content: string | null;
	image_url: string | null;
	color: string | null;
	payload_override: string | null;
	scheduled_at: string | null;
	status: 'draft' | 'scheduled' | 'sent' | 'failed';
	sent_at: string | null;
	error_message: string | null;
	created_at: string;
	updated_at: string;
};

export type PostField = {
	id: string;
	post_id: string;
	key: string;
	type: string;
	value: string | null;
};

export { schema };
