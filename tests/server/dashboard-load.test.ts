/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { load } from '../../src/routes/+page.server.js';
import { mockRequestEvent } from '../helpers/mockRequest.js';

describe('Root +page.server', () => {
	it('redirects to /calendar', async () => {
		await expect(
			load(mockRequestEvent({ userId: null }, 'http://test/') as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/calendar' });
	});
});
