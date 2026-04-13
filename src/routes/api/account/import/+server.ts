import { getDatabase } from '$lib/db/index.js';
import { ACCOUNT_IMPORT_CONFIRM_PHRASE } from '$lib/accountBackupConstants.js';
import { parseAccountBackupPayload, replaceAccountDataFromBackup } from '$lib/server/accountBackup.js';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const accountId = locals.userId;
	if (!accountId) {
		return error(401, 'Unauthorized');
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
	const confirmReplace = rec.confirmReplace;
	if (confirmReplace !== ACCOUNT_IMPORT_CONFIRM_PHRASE) {
		return json(
			{ error: `Type the exact confirmation phrase: ${ACCOUNT_IMPORT_CONFIRM_PHRASE}` },
			{ status: 400 }
		);
	}

	const parsed = parseAccountBackupPayload(rec.backup);
	if (!parsed.ok) {
		return json({ error: parsed.error }, { status: 400 });
	}

	const db = getDatabase();
	const result = replaceAccountDataFromBackup(db, accountId, parsed.payload);
	if (!result.ok) {
		return json({ error: result.error }, { status: 400 });
	}

	return json({
		success: true,
		clientPreferences: parsed.payload.clientPreferences ?? null
	});
};
