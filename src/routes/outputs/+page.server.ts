import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadWebhooksPageData } from './webhooks/loadWebhooksPageData.js';
import { actions } from './webhooks/+page.server.js';

export { actions };

/**
 * `/outputs` redirects to `/outputs/webhooks` in the app. Vitest and `http://test/...` URLs invoke
 * `load` directly against this module (same as before the webhooks split), so we run the webhooks
 * loader in those cases.
 */
export const load: PageServerLoad = async (event) => {
	const isVitest = process.env.VITEST === 'true';
	const isTestUrl = event.url.hostname === 'test';
	if (!isVitest && !isTestUrl) {
		throw redirect(302, '/outputs/webhooks');
	}
	return loadWebhooksPageData(event.locals, event.url);
};
