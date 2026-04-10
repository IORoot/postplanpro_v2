import { sendDuePosts } from '$lib/scheduler/sendDuePosts.js';

let started = false;

function parseIntervalMs(): number {
	const raw = process.env.INTERNAL_CRON_INTERVAL_MS;
	const n = raw ? Number.parseInt(raw, 10) : NaN;
	if (!Number.isFinite(n) || n < 10_000) return 60_000;
	return n;
}

/** When ENABLE_INTERNAL_CRON is set, poll for due posts inside this process (for single-container Docker, etc.). */
export function startInternalCronIfEnabled(): void {
	if (started) return;
	const v = process.env.ENABLE_INTERNAL_CRON;
	if (v !== '1' && v !== 'true') return;
	started = true;
	const intervalMs = parseIntervalMs();
	const run = () => {
		void sendDuePosts().catch((err) => {
			console.error('[cron] sendDuePosts failed:', err instanceof Error ? err.message : err);
		});
	};
	run();
	setInterval(run, intervalMs);
	console.log(`[cron] internal scheduler enabled (every ${intervalMs}ms)`);
}
