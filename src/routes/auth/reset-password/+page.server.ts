import { fail, redirect } from '@sveltejs/kit';
import { resetPasswordWithToken } from '../../../auth.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	return { token };
};

export const actions: Actions = {
	reset: async ({ request }) => {
		const data = await request.formData();
		const token = String(data.get('token') ?? '');
		const password = String(data.get('password') ?? '');
		const confirmPassword = String(data.get('confirmPassword') ?? '');
		if (!token) return fail(400, { error: 'Missing token.' });
		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match.', token });
		}
		const result = resetPasswordWithToken({ token, password });
		if (!result.ok) return fail(400, { error: result.error, token });
		throw redirect(303, '/auth/login?passwordReset=1');
	}
};
