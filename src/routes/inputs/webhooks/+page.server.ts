import { loadInboundAuthFields } from '$lib/server/inboundAuthLoad.js';
import { callbackTokenFormActions } from '$lib/server/callbackTokenFormActions.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const accountId = locals.userId;
	return loadInboundAuthFields(accountId);
};

export const actions: Actions = callbackTokenFormActions;
