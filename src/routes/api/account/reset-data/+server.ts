import { getDatabase } from '$lib/db/index.js';
import { deleteAccountAppData } from '$lib/server/accountBackup.js';
import { ACCOUNT_RESET_CONFIRM_PHRASE } from '$lib/accountBackupConstants.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const accountId = locals.userId;
	if (!accountId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be JSON.' }, { status: 400 });
	}
	if (!body || typeof body !== 'object') {
		return json({ error: 'Invalid request body.' }, { status: 400 });
	}

	const rec = body as Record<string, unknown>;
	if (rec.acknowledge !== true) {
		return json(
			{ error: 'Check the box confirming you understand this cannot be undone.' },
			{ status: 400 }
		);
	}
	if (rec.confirmReset !== ACCOUNT_RESET_CONFIRM_PHRASE) {
		return json(
			{ error: `Type the exact phrase: ${ACCOUNT_RESET_CONFIRM_PHRASE}` },
			{ status: 400 }
		);
	}

	const db = getDatabase();
	try {
		db.transaction(() => {
			deleteAccountAppData(db, accountId);
		})();
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Reset failed.';
		return json({ error: msg }, { status: 500 });
	}

	return json({ success: true });
};
