import { markEmailAsVerified } from '../../../auth.js';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	if (!token || !markEmailAsVerified(token)) {
		throw redirect(303, '/auth/login');
	}
	throw redirect(303, '/auth/login?verified=1');
};
