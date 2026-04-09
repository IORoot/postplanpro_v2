import { requireAdmin } from '$lib/admin.js';
import { getCronDaemonStatus } from '$lib/server/cronDaemonStatus.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	return { cronDaemon: getCronDaemonStatus() };
};
