import type Database from 'better-sqlite3';
import {
	ACCOUNT_BACKUP_FORMAT,
	ACCOUNT_BACKUP_VERSION,
	ACCOUNT_IMPORT_CONFIRM_PHRASE
} from '$lib/accountBackupConstants.js';

export { ACCOUNT_BACKUP_FORMAT, ACCOUNT_IMPORT_CONFIRM_PHRASE };

const POST_STATUSES = new Set(['draft', 'scheduled', 'sent', 'failed']);

type AccountBackupUserSnapshot = {
	timezone: string | null;
	email: string | null;
	name: string | null;
	callback_token: string | null;
	tier: string | null;
};

type AccountBackupPayload = {
	format: typeof ACCOUNT_BACKUP_FORMAT;
	version: typeof ACCOUNT_BACKUP_VERSION;
	exportedAt: string;
	user: AccountBackupUserSnapshot;
	webhook_config: {
		id: string;
		name: string;
		url: string;
		api_token: string | null;
		api_key: string | null;
	}[];
	webhook_header: { id: string; webhook_id: string; key: string; value: string }[];
	import_webhook: {
		id: string;
		path_token: string;
		secret_key: string;
		webhook_id: string;
		created_at: string | null;
		last_used_at: string | null;
	}[];
	global_variable: {
		id: string;
		key: string;
		value: string | null;
		type: string | null;
	}[];
	schedule: {
		id: string;
		name: string;
		description: string | null;
		color: string | null;
		created_at: string | null;
	}[];
	schedule_slot: { id: string; schedule_id: string; scheduled_at: string; order_index: number }[];
	schedule_rule: {
		id: string;
		schedule_id: string;
		type: string;
		config: string;
		start_at: string | null;
		end_at: string | null;
		order_index: number;
	}[];
	schedule_field: { id: string; schedule_id: string; key: string; type: string; value: string | null }[];
	field_template: { id: string; name: string; is_default: number; created_at: string | null }[];
	field_template_field: {
		id: string;
		template_id: string;
		key: string;
		type: string;
		value: string | null;
		order_index: number;
	}[];
	post: {
		id: string;
		webhook_id: string;
		schedule_id: string | null;
		title: string;
		content: string | null;
		image_url: string | null;
		color: string | null;
		payload_override: string | null;
		scheduled_at: string | null;
		status: string;
		sent_at: string | null;
		error_message: string | null;
		import_source_id: string | null;
		created_at: string | null;
		updated_at: string | null;
	}[];
	post_field: { id: string; post_id: string; key: string; type: string; value: string | null }[];
	post_webhook: { post_id: string; webhook_id: string }[];
	post_stage: { id: string; post_id: string; stage: string; status: string; completed_at: string }[];
	send_log: {
		id: string;
		post_id: string;
		sent_at: string;
		request_json: string;
		response_status: number | null;
		response_body: string | null;
		success: number;
	}[];
	usage_month: { month: string; callback_inputs: number; import_operations: number }[];
	/** Optional: merged client-side on export / applied after import. */
	clientPreferences?: { theme?: string; showInputAnimations?: boolean };
};

type ExportAccountDataOptions = {
	includeSendLog?: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
	return v != null && typeof v === 'object' && !Array.isArray(v);
}

export function parseAccountBackupPayload(raw: unknown): { ok: true; payload: AccountBackupPayload } | { ok: false; error: string } {
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw) as unknown;
		} catch {
			return { ok: false, error: 'Backup must be valid JSON.' };
		}
	}
	if (!isRecord(raw)) {
		return { ok: false, error: 'Backup root must be a JSON object.' };
	}
	if (raw.format !== ACCOUNT_BACKUP_FORMAT) {
		return { ok: false, error: 'Unrecognized backup format.' };
	}
	if (raw.version !== ACCOUNT_BACKUP_VERSION) {
		return { ok: false, error: `Unsupported backup version (expected ${ACCOUNT_BACKUP_VERSION}).` };
	}
	if (typeof raw.exportedAt !== 'string' || !raw.exportedAt) {
		return { ok: false, error: 'Backup is missing exportedAt.' };
	}
	if (!isRecord(raw.user)) {
		return { ok: false, error: 'Backup is missing user snapshot.' };
	}

	const arr = (name: string, v: unknown): unknown[] => {
		if (v === undefined) return [];
		if (!Array.isArray(v)) {
			throw new Error(`${name} must be an array`);
		}
		return v;
	};

	try {
		const payload: AccountBackupPayload = {
			format: ACCOUNT_BACKUP_FORMAT,
			version: ACCOUNT_BACKUP_VERSION,
			exportedAt: raw.exportedAt,
			user: {
				timezone: typeof raw.user.timezone === 'string' || raw.user.timezone === null ? (raw.user.timezone as string | null) : null,
				email: typeof raw.user.email === 'string' || raw.user.email === null ? (raw.user.email as string | null) : null,
				name: typeof raw.user.name === 'string' || raw.user.name === null ? (raw.user.name as string | null) : null,
				callback_token:
					typeof raw.user.callback_token === 'string' || raw.user.callback_token === null
						? (raw.user.callback_token as string | null)
						: null,
				tier: typeof raw.user.tier === 'string' || raw.user.tier === null ? (raw.user.tier as string | null) : null
			},
			webhook_config: arr('webhook_config', raw.webhook_config) as AccountBackupPayload['webhook_config'],
			webhook_header: arr('webhook_header', raw.webhook_header) as AccountBackupPayload['webhook_header'],
			import_webhook: arr('import_webhook', raw.import_webhook) as AccountBackupPayload['import_webhook'],
			global_variable: arr('global_variable', raw.global_variable) as AccountBackupPayload['global_variable'],
			schedule: arr('schedule', raw.schedule) as AccountBackupPayload['schedule'],
			schedule_slot: arr('schedule_slot', raw.schedule_slot) as AccountBackupPayload['schedule_slot'],
			schedule_rule: arr('schedule_rule', raw.schedule_rule) as AccountBackupPayload['schedule_rule'],
			schedule_field: arr('schedule_field', raw.schedule_field) as AccountBackupPayload['schedule_field'],
			field_template: arr('field_template', raw.field_template) as AccountBackupPayload['field_template'],
			field_template_field: arr('field_template_field', raw.field_template_field) as AccountBackupPayload['field_template_field'],
			post: arr('post', raw.post) as AccountBackupPayload['post'],
			post_field: arr('post_field', raw.post_field) as AccountBackupPayload['post_field'],
			post_webhook: arr('post_webhook', raw.post_webhook) as AccountBackupPayload['post_webhook'],
			post_stage: arr('post_stage', raw.post_stage) as AccountBackupPayload['post_stage'],
			send_log: arr('send_log', raw.send_log) as AccountBackupPayload['send_log'],
			usage_month: arr('usage_month', raw.usage_month) as AccountBackupPayload['usage_month']
		};
		if (raw.clientPreferences !== undefined) {
			if (!isRecord(raw.clientPreferences)) {
				return { ok: false, error: 'clientPreferences must be an object if present.' };
			}
			const cp = raw.clientPreferences;
			const theme = cp.theme;
			const showInputAnimations = cp.showInputAnimations;
			payload.clientPreferences = {
				...(typeof theme === 'string' ? { theme } : {}),
				...(typeof showInputAnimations === 'boolean' ? { showInputAnimations } : {})
			};
		}
		return { ok: true, payload };
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Invalid backup structure.';
		return { ok: false, error: msg };
	}
}

function validateBackupRows(p: AccountBackupPayload): { ok: true } | { ok: false; error: string } {
	const webhookIds = new Set(p.webhook_config.map((w) => w.id));
	const scheduleIds = new Set(p.schedule.map((s) => s.id));
	const postIds = new Set(p.post.map((x) => x.id));
	const templateIds = new Set(p.field_template.map((t) => t.id));

	for (const h of p.webhook_header) {
		if (!webhookIds.has(h.webhook_id)) {
			return { ok: false, error: `Webhook header references missing webhook ${h.webhook_id}.` };
		}
	}
	for (const iw of p.import_webhook) {
		if (!webhookIds.has(iw.webhook_id)) {
			return { ok: false, error: `Import webhook references missing webhook ${iw.webhook_id}.` };
		}
	}
	for (const row of p.schedule_slot) {
		if (!scheduleIds.has(row.schedule_id)) {
			return { ok: false, error: `Schedule slot references missing schedule ${row.schedule_id}.` };
		}
	}
	for (const row of p.schedule_rule) {
		if (!scheduleIds.has(row.schedule_id)) {
			return { ok: false, error: `Schedule rule references missing schedule ${row.schedule_id}.` };
		}
	}
	for (const row of p.schedule_field) {
		if (!scheduleIds.has(row.schedule_id)) {
			return { ok: false, error: `Schedule field references missing schedule ${row.schedule_id}.` };
		}
	}
	for (const row of p.field_template_field) {
		if (!templateIds.has(row.template_id)) {
			return { ok: false, error: `Template field references missing template ${row.template_id}.` };
		}
	}
	for (const row of p.post) {
		if (!webhookIds.has(row.webhook_id)) {
			return { ok: false, error: `Post ${row.id} references missing webhook ${row.webhook_id}.` };
		}
		if (row.schedule_id != null && !scheduleIds.has(row.schedule_id)) {
			return { ok: false, error: `Post ${row.id} references missing schedule ${row.schedule_id}.` };
		}
		if (!POST_STATUSES.has(row.status)) {
			return { ok: false, error: `Post ${row.id} has invalid status.` };
		}
	}
	for (const row of p.post_field) {
		if (!postIds.has(row.post_id)) {
			return { ok: false, error: `Post field references missing post ${row.post_id}.` };
		}
	}
	for (const row of p.post_webhook) {
		if (!postIds.has(row.post_id)) {
			return { ok: false, error: `post_webhook references missing post ${row.post_id}.` };
		}
		if (!webhookIds.has(row.webhook_id)) {
			return { ok: false, error: `post_webhook references missing webhook ${row.webhook_id}.` };
		}
	}
	for (const row of p.post_stage) {
		if (!postIds.has(row.post_id)) {
			return { ok: false, error: `post_stage references missing post ${row.post_id}.` };
		}
	}
	for (const row of p.send_log) {
		if (!postIds.has(row.post_id)) {
			return { ok: false, error: `send_log references missing post ${row.post_id}.` };
		}
	}
	return { ok: true };
}

export function deleteAccountAppData(db: Database.Database, userId: string): void {
	db.prepare('DELETE FROM send_log WHERE account_id = ?').run(userId);
	const postIds = db.prepare('SELECT id FROM post WHERE account_id = ?').all(userId) as { id: string }[];
	for (const { id: postId } of postIds) {
		db.prepare('DELETE FROM post_stage WHERE post_id = ?').run(postId);
		db.prepare('DELETE FROM post_field WHERE post_id = ?').run(postId);
		db.prepare('DELETE FROM post_webhook WHERE post_id = ?').run(postId);
	}
	db.prepare('DELETE FROM post WHERE account_id = ?').run(userId);
	const scheduleIds = db.prepare('SELECT id FROM schedule WHERE account_id = ?').all(userId) as { id: string }[];
	for (const { id: scheduleId } of scheduleIds) {
		db.prepare('DELETE FROM schedule_rule WHERE schedule_id = ?').run(scheduleId);
		db.prepare('DELETE FROM schedule_slot WHERE schedule_id = ?').run(scheduleId);
		db.prepare('DELETE FROM schedule_field WHERE schedule_id = ?').run(scheduleId);
	}
	db.prepare('DELETE FROM schedule WHERE account_id = ?').run(userId);
	const webhookIds = db.prepare('SELECT id FROM webhook_config WHERE account_id = ?').all(userId) as { id: string }[];
	for (const { id: webhookId } of webhookIds) {
		db.prepare('DELETE FROM webhook_header WHERE webhook_id = ?').run(webhookId);
	}
	db.prepare('DELETE FROM import_webhook WHERE account_id = ?').run(userId);
	db.prepare('DELETE FROM webhook_config WHERE account_id = ?').run(userId);
	db.prepare('DELETE FROM global_variable WHERE account_id = ?').run(userId);
	const templateIds = db.prepare('SELECT id FROM field_template WHERE account_id = ?').all(userId) as { id: string }[];
	for (const { id: templateId } of templateIds) {
		db.prepare('DELETE FROM field_template_field WHERE template_id = ?').run(templateId);
	}
	db.prepare('DELETE FROM field_template WHERE account_id = ?').run(userId);
	db.prepare('DELETE FROM usage_month WHERE account_id = ?').run(userId);
}

export function exportAccountData(
	db: Database.Database,
	userId: string,
	options: ExportAccountDataOptions = {}
): AccountBackupPayload {
	const includeSendLog = options.includeSendLog === true;

	const user = db.prepare('SELECT timezone, email, name, callback_token, tier FROM user WHERE id = ?').get(userId) as
		| {
				timezone: string | null;
				email: string | null;
				name: string | null;
				callback_token: string | null;
				tier: string | null;
		  }
		| undefined;

	const webhook_config = db
		.prepare('SELECT id, name, url, api_token, api_key FROM webhook_config WHERE account_id = ? ORDER BY name')
		.all(userId) as AccountBackupPayload['webhook_config'];

	const whIds = webhook_config.map((w) => w.id);
	const webhook_header =
		whIds.length === 0
			? []
			: (db
					.prepare(
						`SELECT h.id, h.webhook_id, h.key, h.value FROM webhook_header h
           WHERE h.webhook_id IN (${whIds.map(() => '?').join(',')}) ORDER BY h.webhook_id, h.key`
					)
					.all(...whIds) as AccountBackupPayload['webhook_header']);

	const import_webhook = db
		.prepare(
			'SELECT id, path_token, secret_key, webhook_id, created_at, last_used_at FROM import_webhook WHERE account_id = ? ORDER BY id'
		)
		.all(userId) as AccountBackupPayload['import_webhook'];

	const global_variable = db
		.prepare('SELECT id, key, value, type FROM global_variable WHERE account_id = ? ORDER BY key')
		.all(userId) as AccountBackupPayload['global_variable'];

	const schedule = db
		.prepare('SELECT id, name, description, color, created_at FROM schedule WHERE account_id = ? ORDER BY name')
		.all(userId) as AccountBackupPayload['schedule'];

	const scheduleIds = schedule.map((s) => s.id);
	const schedule_slot =
		scheduleIds.length === 0
			? []
			: (db
					.prepare(
						`SELECT id, schedule_id, scheduled_at, order_index FROM schedule_slot WHERE schedule_id IN (${scheduleIds.map(() => '?').join(',')}) ORDER BY schedule_id, order_index`
					)
					.all(...scheduleIds) as AccountBackupPayload['schedule_slot']);

	const schedule_rule =
		scheduleIds.length === 0
			? []
			: (db
					.prepare(
						`SELECT id, schedule_id, type, config, start_at, end_at, order_index FROM schedule_rule WHERE schedule_id IN (${scheduleIds.map(() => '?').join(',')}) ORDER BY schedule_id, order_index`
					)
					.all(...scheduleIds) as AccountBackupPayload['schedule_rule']);

	const schedule_field =
		scheduleIds.length === 0
			? []
			: (db
					.prepare(
						`SELECT id, schedule_id, key, type, value FROM schedule_field WHERE schedule_id IN (${scheduleIds.map(() => '?').join(',')}) ORDER BY schedule_id, key`
					)
					.all(...scheduleIds) as AccountBackupPayload['schedule_field']);

	const field_template = db
		.prepare('SELECT id, name, is_default, created_at FROM field_template WHERE account_id = ? ORDER BY name')
		.all(userId) as AccountBackupPayload['field_template'];

	const templateIds = field_template.map((t) => t.id);
	const field_template_field =
		templateIds.length === 0
			? []
			: (db
					.prepare(
						`SELECT id, template_id, key, type, value, order_index FROM field_template_field WHERE template_id IN (${templateIds.map(() => '?').join(',')}) ORDER BY template_id, order_index`
					)
					.all(...templateIds) as AccountBackupPayload['field_template_field']);

	const post = db
		.prepare(
			`SELECT id, webhook_id, schedule_id, title, content, image_url, color, payload_override, scheduled_at, status, sent_at, error_message, import_source_id, created_at, updated_at
       FROM post WHERE account_id = ? ORDER BY created_at DESC`
		)
		.all(userId) as AccountBackupPayload['post'];

	const postIds = post.map((p) => p.id);
	const post_field =
		postIds.length === 0
			? []
			: (db
					.prepare(
						`SELECT id, post_id, key, type, value FROM post_field WHERE post_id IN (${postIds.map(() => '?').join(',')}) ORDER BY post_id, key`
					)
					.all(...postIds) as AccountBackupPayload['post_field']);

	const post_webhook =
		postIds.length === 0
			? []
			: (db
					.prepare(
						`SELECT post_id, webhook_id FROM post_webhook WHERE post_id IN (${postIds.map(() => '?').join(',')})`
					)
					.all(...postIds) as AccountBackupPayload['post_webhook']);

	const post_stage =
		postIds.length === 0
			? []
			: (db
					.prepare(
						`SELECT id, post_id, stage, status, completed_at FROM post_stage WHERE post_id IN (${postIds.map(() => '?').join(',')}) ORDER BY post_id, completed_at`
					)
					.all(...postIds) as AccountBackupPayload['post_stage']);

	const send_log =
		includeSendLog && postIds.length > 0
			? (db
					.prepare(
						`SELECT id, post_id, sent_at, request_json, response_status, response_body, success FROM send_log
           WHERE account_id = ? AND post_id IN (${postIds.map(() => '?').join(',')}) ORDER BY sent_at`
					)
					.all(userId, ...postIds) as AccountBackupPayload['send_log'])
			: [];

	const usage_month = db
		.prepare('SELECT month, callback_inputs, import_operations FROM usage_month WHERE account_id = ? ORDER BY month')
		.all(userId) as AccountBackupPayload['usage_month'];

	return {
		format: ACCOUNT_BACKUP_FORMAT,
		version: ACCOUNT_BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		user: {
			timezone: user?.timezone ?? null,
			email: user?.email ?? null,
			name: user?.name ?? null,
			callback_token: user?.callback_token ?? null,
			tier: user?.tier ?? null
		},
		webhook_config,
		webhook_header,
		import_webhook,
		global_variable,
		schedule,
		schedule_slot,
		schedule_rule,
		schedule_field,
		field_template,
		field_template_field,
		post,
		post_field,
		post_webhook,
		post_stage,
		send_log,
		usage_month
	};
}

export function replaceAccountDataFromBackup(
	db: Database.Database,
	userId: string,
	payload: AccountBackupPayload
): { ok: true } | { ok: false; error: string } {
	const validated = validateBackupRows(payload);
	if (!validated.ok) {
		return validated;
	}

	const run = db.transaction(() => {
		deleteAccountAppData(db, userId);

		const insWh = db.prepare(
			'INSERT INTO webhook_config (id, account_id, name, url, api_token, api_key) VALUES (?, ?, ?, ?, ?, ?)'
		);
		for (const w of payload.webhook_config) {
			insWh.run(w.id, userId, w.name, w.url, w.api_token ?? null, w.api_key ?? null);
		}

		const insHdr = db.prepare('INSERT INTO webhook_header (id, webhook_id, key, value) VALUES (?, ?, ?, ?)');
		for (const h of payload.webhook_header) {
			insHdr.run(h.id, h.webhook_id, h.key, h.value);
		}

		const insIw = db.prepare(
			'INSERT INTO import_webhook (id, account_id, path_token, secret_key, webhook_id, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime(\'now\')), ?)'
		);
		for (const iw of payload.import_webhook) {
			insIw.run(iw.id, userId, iw.path_token, iw.secret_key, iw.webhook_id, iw.created_at ?? null, iw.last_used_at ?? null);
		}

		const insG = db.prepare('INSERT INTO global_variable (id, account_id, key, value, type) VALUES (?, ?, ?, ?, ?)');
		for (const g of payload.global_variable) {
			insG.run(g.id, userId, g.key, g.value ?? null, g.type ?? 'string');
		}

		const insSch = db.prepare(
			'INSERT INTO schedule (id, account_id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime(\'now\')))'
		);
		for (const s of payload.schedule) {
			insSch.run(s.id, userId, s.name, s.description ?? null, s.color ?? null, s.created_at);
		}

		const insSlot = db.prepare(
			'INSERT INTO schedule_slot (id, schedule_id, scheduled_at, order_index) VALUES (?, ?, ?, ?)'
		);
		for (const row of payload.schedule_slot) {
			insSlot.run(row.id, row.schedule_id, row.scheduled_at, row.order_index);
		}

		const insRule = db.prepare(
			'INSERT INTO schedule_rule (id, schedule_id, type, config, start_at, end_at, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
		);
		for (const row of payload.schedule_rule) {
			insRule.run(row.id, row.schedule_id, row.type, row.config, row.start_at ?? null, row.end_at ?? null, row.order_index);
		}

		const insSf = db.prepare('INSERT INTO schedule_field (id, schedule_id, key, type, value) VALUES (?, ?, ?, ?, ?)');
		for (const row of payload.schedule_field) {
			insSf.run(row.id, row.schedule_id, row.key, row.type, row.value ?? null);
		}

		const insTpl = db.prepare(
			'INSERT INTO field_template (id, account_id, name, is_default, created_at) VALUES (?, ?, ?, ?, COALESCE(?, datetime(\'now\')))'
		);
		for (const t of payload.field_template) {
			insTpl.run(t.id, userId, t.name, t.is_default, t.created_at);
		}

		const insTpf = db.prepare(
			'INSERT INTO field_template_field (id, template_id, key, type, value, order_index) VALUES (?, ?, ?, ?, ?, ?)'
		);
		for (const row of payload.field_template_field) {
			insTpf.run(row.id, row.template_id, row.key, row.type, row.value ?? null, row.order_index);
		}

		const insPost = db.prepare(
			`INSERT INTO post (id, account_id, webhook_id, schedule_id, title, content, image_url, color, payload_override, scheduled_at, status, sent_at, error_message, import_source_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`
		);
		for (const p of payload.post) {
			insPost.run(
				p.id,
				userId,
				p.webhook_id,
				p.schedule_id ?? null,
				p.title,
				p.content ?? null,
				p.image_url ?? null,
				p.color ?? null,
				p.payload_override ?? null,
				p.scheduled_at ?? null,
				p.status,
				p.sent_at ?? null,
				p.error_message ?? null,
				p.import_source_id ?? null,
				p.created_at,
				p.updated_at
			);
		}

		const insPf = db.prepare('INSERT INTO post_field (id, post_id, key, type, value) VALUES (?, ?, ?, ?, ?)');
		for (const row of payload.post_field) {
			insPf.run(row.id, row.post_id, row.key, row.type, row.value ?? null);
		}

		const insPwh = db.prepare('INSERT INTO post_webhook (post_id, webhook_id) VALUES (?, ?)');
		for (const row of payload.post_webhook) {
			insPwh.run(row.post_id, row.webhook_id);
		}

		const insPs = db.prepare(
			'INSERT INTO post_stage (id, post_id, stage, status, completed_at) VALUES (?, ?, ?, ?, ?)'
		);
		for (const row of payload.post_stage) {
			insPs.run(row.id, row.post_id, row.stage, row.status, row.completed_at);
		}

		const insLog = db.prepare(
			`INSERT INTO send_log (id, account_id, post_id, sent_at, request_json, response_status, response_body, success)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		);
		for (const row of payload.send_log) {
			insLog.run(
				row.id,
				userId,
				row.post_id,
				row.sent_at,
				row.request_json,
				row.response_status ?? null,
				row.response_body ?? null,
				row.success
			);
		}

		const insUm = db.prepare(
			'INSERT OR REPLACE INTO usage_month (account_id, month, callback_inputs, import_operations) VALUES (?, ?, ?, ?)'
		);
		for (const row of payload.usage_month) {
			insUm.run(userId, row.month, row.callback_inputs, row.import_operations);
		}

		db.prepare('UPDATE user SET timezone = ?, callback_token = ? WHERE id = ?').run(
			payload.user.timezone,
			payload.user.callback_token,
			userId
		);
	});

	try {
		run();
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Import failed.';
		return { ok: false, error: msg };
	}

	return { ok: true };
}
