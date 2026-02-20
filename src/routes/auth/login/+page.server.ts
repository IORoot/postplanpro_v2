import { fail } from '@sveltejs/kit';
import {
	enabledProviders,
	registerWithEmailPassword,
	requestPasswordReset,
	sendVerificationEmail,
	signIn,
	signOut
} from '../../../auth.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	return {
		session: await locals.auth(),
		providers: enabledProviders,
		verified: url.searchParams.get('verified') === '1',
		passwordReset: url.searchParams.get('passwordReset') === '1'
	};
};

export const actions: Actions = {
	signin: signIn,
	signout: signOut,
	register: async ({ request, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');
		const name = String(data.get('name') ?? '').trim() || null;
		const result = registerWithEmailPassword({ email, password, name });
		if (!result.ok) {
			return fail(400, {
				registerError: result.error,
				registerEmail: email,
				registerName: name ?? ''
			});
		}
		const verifyResult = await sendVerificationEmail(result.userId, result.email, url.origin);
		if (!verifyResult.ok) {
			return fail(500, {
				registerError: `Account was created, but we could not send verification email: ${verifyResult.error}`,
				registerEmail: email,
				registerName: name ?? ''
			});
		}
		return {
			registered: true,
			registerEmail: email,
			registerMessage:
				'Account created. Check your email for a one-time verification link before signing in.'
		};
	},
	forgotPassword: async ({ request, url }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '');
		if (!email) {
			return fail(400, { forgotError: 'Email is required.' });
		}
		const result = await requestPasswordReset({ email, originHint: url.origin });
		if (!result.ok) {
			return fail(500, { forgotError: result.error });
		}
		return {
			forgotSent: true,
			forgotMessage:
				'If an account exists for that email, a one-time reset link has been sent.'
		};
	}
};
