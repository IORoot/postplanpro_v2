import { getDatabase } from '$lib/db/index.js';
import { env } from '$env/dynamic/private';

type InboundAuthLoad = {
	callbackTokenMasked: string | null;
	callbackUrl: string | null;
	importCallbackUrl: string | null;
};

export function loadInboundAuthFields(accountId: string | null): InboundAuthLoad {
	const base = env.APP_BASE_URL?.trim();
	const importCallbackUrl = base ? base.replace(/\/$/, '') + '/api/callbacks/import' : null;
	const callbackUrl = base ? base.replace(/\/$/, '') + '/api/callbacks/stage' : null;

	if (!accountId) {
		return { callbackTokenMasked: null, callbackUrl, importCallbackUrl };
	}

	const db = getDatabase();
	const callbackTokenMasked = (() => {
		const row = db.prepare('SELECT callback_token FROM user WHERE id = ?').get(accountId) as
			| { callback_token: string | null }
			| undefined;
		const t = row?.callback_token?.trim();
		if (!t) return null;
		return '••••••••••••' + t.slice(-4);
	})();

	return { callbackTokenMasked, callbackUrl, importCallbackUrl };
}
