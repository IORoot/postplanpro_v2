import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy `/settings` URLs redirect into Account. */
export const load: PageServerLoad = ({ url }) => {
	const sectionRaw = url.searchParams.get('section') ?? '';
	if (sectionRaw === 'outputs' || sectionRaw === 'targets') {
		throw redirect(303, '/outputs');
	}
	if (sectionRaw === 'inputs' || sectionRaw === 'imports') {
		throw redirect(303, '/inputs/webhooks');
	}
	if (sectionRaw === 'callbacks') {
		throw redirect(303, '/inputs?section=callbacks');
	}
	if (sectionRaw === 'globals') {
		throw redirect(303, '/account?section=globals');
	}
	if (sectionRaw === 'templates') {
		throw redirect(303, '/account?section=templates');
	}
	throw redirect(303, '/account');
};
