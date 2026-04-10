/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { load } from '../../src/routes/outputs/presets/+page.server.js';

describe('outputs/presets load', () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
			ok: true,
			text: async () => '<html><head></head><body></body></html>'
		}) as Response);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it('returns scenarios from bundled JSON without reading static/ from cwd', async () => {
		const { scenarios } = await load();
		expect(Array.isArray(scenarios)).toBe(true);
		expect(scenarios.length).toBeGreaterThan(0);
		const first = scenarios[0];
		expect(first).toMatchObject({
			title: expect.any(String),
			link: expect.stringMatching(/^https?:\/\//),
			target: expect.stringMatching(/make|zapier|n8n|ifttt/)
		});
	});
});
