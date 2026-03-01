import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

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
		plugins: [tailwindcss(), sveltekit()],
		server: {
			allowedHosts
		}
	};
});
