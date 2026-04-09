import { execFileSync } from 'node:child_process';

export type CronDaemonStatus = {
	running: boolean;
	method: string;
	detail?: string;
};

function pgrepFound(args: string[]): boolean {
	try {
		execFileSync('pgrep', args, { timeout: 3000, stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Best-effort check for a traditional cron daemon (cron/crond) in the current OS namespace.
 * Docker images often omit this; scheduled posting still works if something calls GET /api/cron/send-due-posts.
 */
export function getCronDaemonStatus(): CronDaemonStatus {
	if (process.platform === 'win32') {
		return { running: false, method: 'not checked', detail: 'Windows hosts are not checked for a cron daemon.' };
	}
	if (pgrepFound(['-x', 'cron'])) {
		return { running: true, method: 'Found process named cron (pgrep -x cron).' };
	}
	if (pgrepFound(['-x', 'crond'])) {
		return { running: true, method: 'Found process named crond (pgrep -x crond).' };
	}
	if (pgrepFound(['-f', '/usr/sbin/cron'])) {
		return { running: true, method: 'Matched cron via pgrep -f /usr/sbin/cron.' };
	}
	return {
		running: false,
		method: 'pgrep cron / crond',
		detail:
			'No cron or crond process was found. That is common in slim Docker images unless you install and start a scheduler in the container.'
	};
}
