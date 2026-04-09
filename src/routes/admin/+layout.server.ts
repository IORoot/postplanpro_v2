import { requireAdmin } from '$lib/admin.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	requireAdmin(event);
	return {};
};
