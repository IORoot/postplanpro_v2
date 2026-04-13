import { getDatabase } from '$lib/db/index.js';
import { exportAccountData } from '$lib/server/accountBackup.js';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const accountId = locals.userId;
	if (!accountId) {
		return error(401, 'Unauthorized');
	}

	const includeSendLog = url.searchParams.get('includeSendLog') === '1' || url.searchParams.get('includeSendLog') === 'true';

	const db = getDatabase();
	const payload = exportAccountData(db, accountId, { includeSendLog });

	const date = new Date().toISOString().slice(0, 10);
	const filename = `postplan-backup-${date}.json`;
	const body = JSON.stringify(payload, null, 2);

	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'no-store'
		}
	});
};
