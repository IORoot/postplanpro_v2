import { getDatabase } from '$lib/db/index.js';
import { getUsageForMonth, currentMonthKey } from '$lib/usage.js';
import { getTierLimits } from '$lib/tiers.js';
import { sendResetPasswordEmail, signOut } from '../../auth.js';
import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type AccountSection = 'billing' | 'account' | 'templates' | 'globals' | 'settings';

function parseTemplateFieldsJson(
	json: string | null | undefined
): { key: string; type: string; value: string }[] {
	if (!json?.trim()) return [];
	try {
		const arr = JSON.parse(json) as unknown;
		if (!Array.isArray(arr)) return [];
		return arr
			.filter((f): f is { key: string; type?: string; value?: unknown } => {
				return f != null && typeof f === 'object' && typeof (f as { key?: string }).key === 'string';
			})
			.map((f) => ({
				key: f.key.trim(),
				type:
					f.type === 'number' || f.type === 'boolean' || f.type === 'json' || f.type === 'string'
						? f.type
						: 'string',
				value: String(f.value ?? '')
			}))
			.filter((f) => f.key.length > 0);
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw redirect(303, '/auth/login?callbackUrl=' + encodeURIComponent(url.pathname + url.search));
	}
	const userId = session.user.id as string;

	const sectionRaw = url.searchParams.get('section') ?? 'account';
	if (sectionRaw === 'outputs' || sectionRaw === 'targets') {
		throw redirect(303, '/outputs');
	}
	if (sectionRaw === 'inputs' || sectionRaw === 'imports' || sectionRaw === 'callbacks') {
		throw redirect(303, '/inputs?section=callbacks');
	}
	const section: AccountSection =
		sectionRaw === 'account' ||
		sectionRaw === 'templates' ||
		sectionRaw === 'globals' ||
		sectionRaw === 'billing' ||
		sectionRaw === 'settings'
			? sectionRaw
			: 'account';

	const db = getDatabase();

	const user = db
		.prepare('SELECT email, password_hash, tier FROM user WHERE id = ?')
		.get(userId) as { email: string | null; password_hash: string | null; tier: string } | undefined;
	if (!user) {
		throw redirect(303, '/auth/login');
	}

	const tier = user.tier ?? 'free';
	const limits = getTierLimits(tier);
	const month = currentMonthKey();
	const usage = getUsageForMonth(db, userId, month);
	const postsTotal = usage.postsSent + usage.postsScheduled;

	const oauthAccounts = db
		.prepare('SELECT id, provider, provider_account_id, created_at FROM oauth_account WHERE user_id = ? ORDER BY provider')
		.all(userId) as { id: string; provider: string; provider_account_id: string; created_at: string }[];
	const providerLabels: Record<string, string> = {
		credentials: 'Email and password',
		google: 'Google',
		github: 'GitHub',
		apple: 'Apple',
		facebook: 'Facebook'
	};

	const templates = db
		.prepare(
			'SELECT id, name, is_default FROM field_template WHERE account_id = ? OR account_id IS NULL ORDER BY is_default DESC, name'
		)
		.all(userId) as { id: string; name: string; is_default: number }[];
	const templateFieldsRows = db
		.prepare(
			`SELECT f.template_id, f.key, f.type, f.value, f.order_index
       FROM field_template_field f
       JOIN field_template t ON t.id = f.template_id
       WHERE t.account_id = ? OR t.account_id IS NULL
       ORDER BY t.name, f.order_index`
		)
		.all(userId) as {
			template_id: string;
			key: string;
			type: string;
			value: string | null;
			order_index: number;
		}[];
	const fieldsByTemplate = new Map<string, { key: string; type: string; value: string }[]>();
	for (const row of templateFieldsRows) {
		const list = fieldsByTemplate.get(row.template_id) ?? [];
		list.push({ key: row.key, type: row.type, value: row.value ?? '' });
		fieldsByTemplate.set(row.template_id, list);
	}

	const globals = db
		.prepare('SELECT id, key, value, type FROM global_variable WHERE account_id = ? ORDER BY key')
		.all(userId) as { id: string; key: string; value: string | null; type: string }[];

	return {
		section,
		globals,
		templates: templates.map((t) => ({
			...t,
			is_default: t.is_default === 1,
			fields: fieldsByTemplate.get(t.id) ?? []
		})),
		email: user.email ?? null,
		hasPassword: !!user.password_hash,
		tier,
		usage: {
			postsSent: usage.postsSent,
			postsScheduled: usage.postsScheduled,
			postsTotal,
			callbackInputs: usage.callbackInputs,
			importOperations: usage.importOperations
		},
		limits: {
			postsSentPerMonth: limits.postsSentPerMonth,
			callbackInputsPerMonth: limits.callbackInputsPerMonth,
			importOperationsPerMonth: limits.importOperationsPerMonth
		},
		oauthAccounts: oauthAccounts.map((o) => ({
			id: o.id,
			provider: o.provider,
			label: providerLabels[o.provider] ?? o.provider,
			created_at: o.created_at,
			canDisconnect:
				o.provider !== 'credentials' &&
				(user.password_hash != null || oauthAccounts.length > 1)
		})),
		canDisconnectOAuth: user.password_hash != null || oauthAccounts.length > 1
	};
};

export const actions: Actions = {
	sendResetPassword: async ({ request, locals, url }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Not signed in.' });
		const userId = session.user.id as string;
		const db = getDatabase();
		const row = db.prepare('SELECT email FROM user WHERE id = ?').get(userId) as { email: string | null } | undefined;
		if (!row?.email) {
			return fail(400, { error: 'No email on file. Add an email to your account to use password reset.' });
		}
		const result = await sendResetPasswordEmail(userId, row.email, url.origin);
		if (result.ok === false) return fail(500, { error: result.error ?? 'Failed to send email.' });
		return { resetSent: true, message: 'A password reset link has been sent to your email.' };
	},

	disconnectOAuth: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Not signed in.' });
		const userId = session.user.id as string;
		const data = await request.formData();
		const oauthId = (data.get('oauth_id') as string)?.trim();
		if (!oauthId) return fail(400, { error: 'Missing oauth account id.' });
		const db = getDatabase();
		const row = db
			.prepare('SELECT id, provider FROM oauth_account WHERE id = ? AND user_id = ?')
			.get(oauthId, userId) as { id: string; provider: string } | undefined;
		if (!row) return fail(404, { error: 'OAuth account not found.' });
		if (row.provider === 'credentials') {
			return fail(400, {
				error: 'Email and password sign-in cannot be disconnected here. Use password reset to change your password.'
			});
		}
		const hasPassword = db.prepare('SELECT 1 FROM user WHERE id = ? AND password_hash IS NOT NULL').get(userId);
		const oauthCount = db.prepare('SELECT COUNT(*) as n FROM oauth_account WHERE user_id = ?').get(userId) as { n: number };
		if (!hasPassword && oauthCount.n <= 1) {
			return fail(400, { error: 'Cannot disconnect the only sign-in method. Set a password first, or add another provider.' });
		}
		db.prepare('DELETE FROM oauth_account WHERE id = ? AND user_id = ?').run(oauthId, userId);
		return { disconnectOk: true };
	},

	deleteAccount: async (event) => {
		const session = await event.locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Not signed in.' });
		const userId = session.user.id as string;
		const data = await event.request.formData();
		const confirm = (data.get('confirm') as string)?.trim()?.toLowerCase();
		if (confirm !== 'delete') {
			return fail(400, { error: 'Type DELETE to confirm account deletion.' });
		}
		const db = getDatabase();
		db.prepare('DELETE FROM user WHERE id = ?').run(userId);
		return signOut(event);
	},

	createGlobal: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Unauthorized' });
		const accountId = session.user.id as string;
		const data = await request.formData();
		const key = (data.get('key') as string)?.trim();
		const value = (data.get('value') as string)?.trim() ?? '';
		const type = (data.get('type') as string) || 'string';
		if (!key) return fail(400, { error: 'Key is required' });
		const id = crypto.randomUUID();
		try {
			getDatabase()
				.prepare('INSERT INTO global_variable (id, account_id, key, value, type) VALUES (?, ?, ?, ?, ?)')
				.run(id, accountId, key, value, type);
		} catch {
			return fail(500, { error: 'Failed to create variable' });
		}
		return { success: true };
	},
	updateGlobal: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Unauthorized' });
		const accountId = session.user.id as string;
		const data = await request.formData();
		const id = data.get('id') as string;
		const key = (data.get('key') as string)?.trim();
		const value = (data.get('value') as string)?.trim() ?? '';
		const type = (data.get('type') as string) || 'string';
		if (!id || !key) return fail(400, { error: 'ID and key are required' });
		getDatabase()
			.prepare('UPDATE global_variable SET key = ?, value = ?, type = ? WHERE id = ? AND account_id = ?')
			.run(key, value, type, id, accountId);
		return { success: true };
	},
	deleteGlobal: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Unauthorized' });
		const accountId = session.user.id as string;
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });
		getDatabase().prepare('DELETE FROM global_variable WHERE id = ? AND account_id = ?').run(id, accountId);
		return { success: true };
	},
	createTemplate: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Unauthorized' });
		const accountId = session.user.id as string;
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const fieldsJson = String(data.get('fields_json') ?? '[]');
		if (!name) return fail(400, { error: 'Template name is required' });
		const fields = parseTemplateFieldsJson(fieldsJson);
		if (fields.length === 0) return fail(400, { error: 'Add at least one template field' });

		const db = getDatabase();
		const templateId = crypto.randomUUID();
		db.prepare(
			'INSERT INTO field_template (id, account_id, name, is_default, created_at) VALUES (?, ?, ?, 0, datetime(\'now\'))'
		).run(templateId, accountId, name);
		const insertField = db.prepare(
			'INSERT INTO field_template_field (id, template_id, key, type, value, order_index) VALUES (?, ?, ?, ?, ?, ?)'
		);
		fields.forEach((field, index) => {
			insertField.run(crypto.randomUUID(), templateId, field.key, field.type, field.value, index);
		});
		return { success: true };
	},
	updateTemplate: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Unauthorized' });
		const accountId = session.user.id as string;
		const data = await request.formData();
		const id = String(data.get('id') ?? '').trim();
		const name = String(data.get('name') ?? '').trim();
		const fieldsJson = String(data.get('fields_json') ?? '[]');
		if (!id || !name) return fail(400, { error: 'Template ID and name are required' });
		const fields = parseTemplateFieldsJson(fieldsJson);
		if (fields.length === 0) return fail(400, { error: 'Add at least one template field' });

		const db = getDatabase();
		const template = db
			.prepare('SELECT id, is_default FROM field_template WHERE id = ? AND (account_id = ? OR account_id IS NULL)')
			.get(id, accountId) as { id: string; is_default: number } | undefined;
		if (!template) return fail(404, { error: 'Template not found' });
		if (template.is_default === 1) {
			return fail(403, { error: 'Default templates cannot be edited.' });
		}

		db.prepare('UPDATE field_template SET name = ? WHERE id = ? AND account_id = ?').run(name, id, accountId);
		db.prepare('DELETE FROM field_template_field WHERE template_id = ?').run(id);
		const insertField = db.prepare(
			'INSERT INTO field_template_field (id, template_id, key, type, value, order_index) VALUES (?, ?, ?, ?, ?, ?)'
		);
		fields.forEach((field, index) => {
			insertField.run(crypto.randomUUID(), id, field.key, field.type, field.value, index);
		});
		return { success: true };
	},
	deleteTemplate: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { error: 'Unauthorized' });
		const accountId = session.user.id as string;
		const id = String((await request.formData()).get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'Template ID is required' });
		const db = getDatabase();
		const row = db
			.prepare('SELECT is_default FROM field_template WHERE id = ? AND (account_id = ? OR account_id IS NULL)')
			.get(id, accountId) as { is_default: number } | undefined;
		if (!row) return fail(404, { error: 'Template not found' });
		if (row.is_default === 1) return fail(403, { error: 'Default templates cannot be deleted.' });
		db.prepare('DELETE FROM field_template WHERE id = ? AND account_id = ?').run(id, accountId);
		return { success: true };
	}
};
