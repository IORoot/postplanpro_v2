import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy URL; import webhook UI lives under Inputs → Webhooks. */
export const load: PageServerLoad = () => {
	throw redirect(303, '/inputs/webhooks');
};
