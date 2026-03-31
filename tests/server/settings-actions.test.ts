/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { load as settingsRedirectLoad } from '../../src/routes/settings/+page.server.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

async function expectRedirect(run: () => unknown, expectedLocation: string) {
	try {
		await run();
		expect.fail('expected redirect');
	} catch (e: unknown) {
		expect((e as { status: number }).status).toBe(303);
		expect((e as { location: string }).location).toBe(expectedLocation);
	}
}

describe('settings/+page.server redirect', () => {
	it('redirects bare /settings to /account', () =>
		expectRedirect(
			() =>
				settingsRedirectLoad(
					mockRequestEvent({ userId: null }, 'http://test/settings') as Parameters<typeof settingsRedirectLoad>[0]
				),
			'/account'
		));

	it('redirects templates and globals sections', async () => {
		await expectRedirect(
			() =>
				settingsRedirectLoad(
					mockRequestEvent({ userId: null }, 'http://test/settings?section=templates') as Parameters<
						typeof settingsRedirectLoad
					>[0]
				),
			'/account?section=templates'
		);
		await expectRedirect(
			() =>
				settingsRedirectLoad(
					mockRequestEvent({ userId: null }, 'http://test/settings?section=globals') as Parameters<
						typeof settingsRedirectLoad
					>[0]
				),
			'/account?section=globals'
		);
	});

	it('redirects legacy outputs section to /outputs', () =>
		expectRedirect(
			() =>
				settingsRedirectLoad(
					mockRequestEvent({ userId: null }, 'http://test/settings?section=outputs') as Parameters<
						typeof settingsRedirectLoad
					>[0]
				),
			'/outputs'
		));

	it('redirects legacy inputs section to inputs webhooks', () =>
		expectRedirect(
			() =>
				settingsRedirectLoad(
					mockRequestEvent({ userId: null }, 'http://test/settings?section=inputs') as Parameters<
						typeof settingsRedirectLoad
					>[0]
				),
			'/inputs/webhooks'
		));

	it('redirects legacy callbacks section to inputs callbacks', () =>
		expectRedirect(
			() =>
				settingsRedirectLoad(
					mockRequestEvent({ userId: null }, 'http://test/settings?section=callbacks') as Parameters<
						typeof settingsRedirectLoad
					>[0]
				),
			'/inputs?section=callbacks'
		));
});
