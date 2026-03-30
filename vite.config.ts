import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig, loadEnv } from 'vite';

// Node.js 25+ enables experimental Web Storage globally. Without `--localstorage-file`, each Vitest
// worker logs a warning and can shadow jsdom's localStorage. Prefer jsdom for tests.
// GitHub Actions (and similar) disallow `--no-webstorage` in NODE_OPTIONS, so skip there.
{
	const inCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
	const cur = process.env.NODE_OPTIONS ?? '';
	if (!inCi && !/\b--no-webstorage\b/.test(cur)) {
		process.env.NODE_OPTIONS = `${cur} --no-webstorage`.trim();
	}
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const baseUrl = env.APP_BASE_URL?.trim();
	let allowedHosts: string[] | true = true;
	if (baseUrl) {
		try {
			const host = new URL(baseUrl).host;
			allowedHosts = [host, 'localhost', '127.0.0.1'];
		} catch {
			// invalid URL, keep allow all
		}
	}

	return {
		plugins: [tailwindcss(), sveltekit(), svelteTesting()],
		server: {
			allowedHosts
		},
		test: {
			include: ['src/**/*.{test,spec}.{ts,svelte}', 'tests/**/*.{test,spec}.ts'],
			exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
			environment: 'jsdom',
			globals: true,
			setupFiles: ['tests/setup.ts'],
			coverage: {
				provider: 'v8',
				reporter: ['text', 'json', 'html'],
				include: ['src/lib/**/*.ts', 'src/routes/**/*.ts'],
				exclude: [
					'src/**/*.test.*',
					'src/**/*.spec.*',
					'src/**/$types*',
					'**/node_modules/**',
					// Comment-only barrel; no executable statements.
					'src/lib/index.ts',
					// Very large importer module: covered by importer unit tests, inputs server slice, and E2E.
					'src/routes/inputs/+page.server.ts'
				]
			}
		}
	};
});
