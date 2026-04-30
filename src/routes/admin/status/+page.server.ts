import { requireAdmin } from '$lib/admin.js';
import { getCronDaemonStatus } from '$lib/server/cronDaemonStatus.js';
import {
	clearSenderSettingsOverrides,
	readSenderSettingsForAdmin,
	upsertSenderSettings
} from '$lib/server/senderSettings.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	return { cronDaemon: getCronDaemonStatus(), senderSettings: readSenderSettingsForAdmin() };
};

export const actions: Actions = {
	saveSenderSettings: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const claimBatch = Number.parseInt(String(data.get('claimBatch') ?? ''), 10);
		const concurrency = Number.parseInt(String(data.get('concurrency') ?? ''), 10);
		const lockTtlMs = Number.parseInt(String(data.get('lockTtlMs') ?? ''), 10);
		if (!Number.isFinite(claimBatch) || claimBatch < 1 || claimBatch > 5000) {
			return fail(400, { error: 'Claim batch must be between 1 and 5000.' });
		}
		if (!Number.isFinite(concurrency) || concurrency < 1 || concurrency > 200) {
			return fail(400, { error: 'Concurrency must be between 1 and 200.' });
		}
		if (!Number.isFinite(lockTtlMs) || lockTtlMs < 1000 || lockTtlMs > 3_600_000) {
			return fail(400, { error: 'Lock TTL must be between 1000 and 3600000 ms.' });
		}
		upsertSenderSettings({ claimBatch, concurrency, lockTtlMs });
		return { senderSettingsSaved: true as const };
	},
	clearSenderSettings: async (event) => {
		requireAdmin(event);
		clearSenderSettingsOverrides();
		return { senderSettingsCleared: true as const };
	}
};
