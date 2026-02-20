import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomTailwindPostColor } from '$lib/postColors.js';
import { schema } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'postplan.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
	if (!db) {
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
				setColor.run(randomTailwindPostColor(), row.id);
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
	webhook_id: string;
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
