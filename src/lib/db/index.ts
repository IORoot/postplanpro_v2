import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
		db.exec(schema);
		// Migration: add api_key to existing webhook_config
		try {
			db.exec('ALTER TABLE webhook_config ADD COLUMN api_key TEXT');
		} catch {
			// Column already exists
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
	name: string;
	url: string;
	api_token: string | null;
};

export type GlobalVariable = {
	id: string;
	key: string;
	value: string | null;
	type: string;
};

export type Schedule = {
	id: string;
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
	webhook_id: string;
	schedule_id: string | null;
	title: string;
	content: string | null;
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
