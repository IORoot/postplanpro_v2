import { fail } from '@sveltejs/kit';
import { CredentialsSignin } from '@auth/sveltekit';
import {
	enabledProviders,
	registerWithEmailPassword,
	requestPasswordReset,
	sendVerificationEmail,
	signIn,
	signOut
} from '../../../auth.js';
import type { Actions, PageServerLoad } from './$types';

/** Auth.js redirects here with ?error=… after OAuth cancel, AccessDenied, etc. */
const AUTH_URL_ERROR_MESSAGES: Record<string, string> = {
	AccessDenied: 'Sign-in was not completed or you do not have permission to sign in.',
	OAuthCallbackError:
		'Sign-in was cancelled or the provider could not finish signing you in. Try again.',
	OAuthAccountNotLinked:
		'This social account is not linked to your PostPlan user. Sign in with the method you used when you registered.',
	AccountNotLinked:
		'This social account is not linked to your PostPlan user. Sign in with the method you used when you registered.',
	Verification: 'The sign-in link is invalid or has expired.',
	Configuration: 'Sign-in could not be completed. Check server configuration or try again later.',
	MissingCSRF: 'Your session expired. Please try signing in again.',
	InvalidCallbackUrl: 'The return address was not valid. Start sign-in from the app again.'
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const errorParam = url.searchParams.get('error');
	const authError =
		errorParam && AUTH_URL_ERROR_MESSAGES[errorParam]
			? AUTH_URL_ERROR_MESSAGES[errorParam]
			: errorParam
				? 'Sign-in failed. Please try again.'
				: null;

	return {
		session: await locals.auth(),
		providers: enabledProviders,
		verified: url.searchParams.get('verified') === '1',
		passwordReset: url.searchParams.get('passwordReset') === '1',
		authError
	};
};

export const actions: Actions = {
	signin: async (event) => {
		try {
			return await signIn(event);
		} catch (e) {
			if (e instanceof CredentialsSignin) {
				return fail(401, {
					signinError: 'Invalid email or password, or your email is not verified yet. Check your inbox for the verification link.'
				});
			}
			throw e;
		}
	},
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
