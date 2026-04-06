/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { load } from '../../src/routes/+page.server.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

describe('Root +page.server', () => {
	it('returns empty data for unauthenticated visitors (homepage)', async () => {
		const result = await load(
			mockRequestEvent({ userId: null }, 'http://test/') as Parameters<typeof load>[0]
		);
		expect(result).toEqual({});
	});

	it('redirects signed-in users to /calendar', async () => {
		await expect(
			load(mockRequestEvent({ userId: 'user-1' }, 'http://test/') as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/calendar' });
	});
});
