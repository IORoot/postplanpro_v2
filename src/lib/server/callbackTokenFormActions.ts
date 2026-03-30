import { getDatabase } from '$lib/db/index.js';
import { fail } from '@sveltejs/kit';

export const callbackTokenFormActions = {
	generateCallbackToken: async ({ locals }: { locals: { userId: string | null } }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		const token = crypto.randomUUID();
		getDatabase().prepare('UPDATE user SET callback_token = ? WHERE id = ?').run(token, accountId);
		return { token };
	},
	revokeCallbackToken: async ({ locals }: { locals: { userId: string | null } }) => {
		const accountId = locals.userId;
		if (!accountId) return fail(401, { error: 'Unauthorized' });
		getDatabase().prepare('UPDATE user SET callback_token = NULL WHERE id = ?').run(accountId);
		return { success: true };
	}
};
