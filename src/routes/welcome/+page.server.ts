import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Canonical marketing home is `/`; keep `/welcome` as a permanent redirect for old links. */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/');
};
