<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();

	type AdminUser = PageData['users'][number];

	let selected = $state<AdminUser | null>(null);
	let editTier = $state('');
	let usageCallbacksStr = $state('0');
	let usageImportsStr = $state('0');
	/** Empty = quota follows send_log; otherwise whole number = monthly post-send override. */
	let usagePostOverride = $state('');
	let modalTitleId = 'admin-user-modal-title';

	function capLabel(n: number | null): string {
		return n === null ? '∞' : String(n);
	}

	function formatWhen(iso: string | null | undefined): string {
		if (iso == null || iso === '') return '—';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	}

	function openUser(u: AdminUser) {
		selected = u;
		editTier = u.tier;
		usageCallbacksStr = String(u.usageMonthAccount.callback_inputs);
		usageImportsStr = String(u.usageMonthAccount.import_operations);
		const o = u.usageMonthAccount.post_sends_override;
		usagePostOverride = o !== null ? String(o) : '';
		void tick().then(() => document.getElementById('admin-user-tier-select')?.focus());
	}

	async function resyncSelectedAfterSave() {
		await tick();
		const id = selected?.id;
		if (!id) return;
		const next = data.users.find((u) => u.id === id);
		if (next) openUser(next);
	}

	function closeModal() {
		selected = null;
	}

	function onModalKeydown(e: KeyboardEvent) {
		if (!selected) return;
		if (e.key === 'Escape') closeModal();
	}

	function tierBadgeClass(tier: string): string {
		if (tier === 'blocked') return 'bg-red-500/15 text-red-700 dark:text-red-300';
		if (tier === 'admin') return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
		if (tier === 'pro') return 'bg-sky-500/15 text-sky-800 dark:text-sky-200';
		if (tier === 'enterprise') return 'bg-amber-500/15 text-amber-900 dark:text-amber-200';
		return 'bg-[var(--surface-hover)] text-[var(--text-muted)]';
	}
</script>

<svelte:window onkeydown={onModalKeydown} />

<svelte:head>
	<title>Users – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Users"
	description="Open a user to view activity, change tier, adjust monthly usage, or remove the account."
/>

{#if form?.error}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
{/if}
{#if form?.updated}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">Tier updated.</p>
{/if}
{#if form?.updatedUsage}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">Usage updated for {data.usageMonthKey}.</p>
{/if}
{#if form?.removed}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">User removed and all their content deleted.</p>
{/if}

<div class="mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
	<div class="overflow-x-auto">
		<table class="w-full min-w-[640px] text-left text-sm">
			<thead>
				<tr class="border-b border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text)]">
					<th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider">User</th>
					<th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Tier</th>
					<th class="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider sm:table-cell">Joined</th>
					<th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider">This month</th>
					<th class="w-10 px-2 py-3" aria-hidden="true"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--border)]">
				{#each data.users as user (user.id)}
					<tr
						class="cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
						role="button"
						tabindex="0"
						onclick={() => openUser(user)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								openUser(user);
							}
						}}
					>
						<td class="px-4 py-3">
							<div class="font-medium text-[var(--text)]">{user.email ?? user.name ?? 'No email'}</div>
							{#if user.name && user.email}
								<div class="mt-0.5 text-xs text-[var(--text-muted)]">{user.name}</div>
							{/if}
						</td>
						<td class="px-4 py-3">
							<span
								class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize {tierBadgeClass(
									user.tier
								)}">{user.tier}</span
							>
						</td>
						<td class="hidden px-4 py-3 text-[var(--text-muted)] sm:table-cell">
							{formatWhen(user.created_at)}
						</td>
						<td class="px-4 py-3 text-[var(--text-muted)] tabular-nums">
							<span class="text-[var(--text)]">{user.usage.postsTotal}</span> sends ·
							<span class="text-[var(--text)]">{user.usage.callbackInputs}</span> cb ·
							<span class="text-[var(--text)]">{user.usage.importOperations}</span> imp
						</td>
						<td class="px-2 py-3 text-[var(--text-muted)]" aria-hidden="true">→</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--text-muted)]">
		Usage totals are for billing month <strong class="text-[var(--text)]">{data.usageMonthKey}</strong> (includes email
		carryover where applicable). Optional post field in the user dialog pins send count for quota; blank uses send log.
	</p>
</div>

{#if selected}
	<div class="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			aria-label="Close dialog"
			onclick={closeModal}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={modalTitleId}
			tabindex="-1"
			class="relative z-10 max-h-[min(92vh,800px)] w-full max-w-4xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl outline-none"
		>
			<div class="mb-5 flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h2 id={modalTitleId} class="text-lg font-semibold text-[var(--text)]">
						{selected.email ?? selected.name ?? 'User'}
					</h2>
					<p class="mt-1 truncate font-mono text-xs text-[var(--text-muted)]">{selected.id}</p>
				</div>
				<button
					type="button"
					onclick={closeModal}
					class="shrink-0 rounded-lg border border-transparent px-2 py-1 text-sm text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] min-h-[44px] min-w-[44px]"
					aria-label="Close"
				>
					×
				</button>
			</div>

			<dl class="mb-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
				<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
					<dt class="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Started</dt>
					<dd class="mt-0.5 text-[var(--text)]">{formatWhen(selected.created_at)}</dd>
				</div>
				<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
					<dt class="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Last sign-in</dt>
					<dd class="mt-0.5 text-[var(--text)]">{formatWhen(selected.last_login_at)}</dd>
				</div>
				<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
					<dt class="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Email verified</dt>
					<dd class="mt-0.5 text-[var(--text)]">{formatWhen(selected.email_verified_at)}</dd>
				</div>
				<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
					<dt class="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Timezone</dt>
					<dd class="mt-0.5 text-[var(--text)]">{selected.timezone ?? '—'}</dd>
				</div>
				<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
					<dt class="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Content</dt>
					<dd class="mt-0.5 text-[var(--text)]">
						{selected.post_count} posts · {selected.schedule_count} schedules · {selected.webhook_count} webhooks
					</dd>
				</div>
				<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
					<dt class="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Stripe</dt>
					<dd class="mt-0.5 break-all font-mono text-xs text-[var(--text)]">
						{#if selected.stripe_customer_id}
							<span class="block">cust: {selected.stripe_customer_id}</span>
						{/if}
						{#if selected.stripe_subscription_id}
							<span class="block">sub: {selected.stripe_subscription_id}</span>
						{/if}
						{#if !selected.stripe_customer_id && !selected.stripe_subscription_id}
							—
						{/if}
					</dd>
				</div>
			</dl>

			<section class="mb-6 rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)]/30 p-4">
				<h3 class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Plan limits (tier)</h3>
				<div class="mt-3 grid gap-2 sm:grid-cols-3">
					<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
						<p class="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Posts / month</p>
						<p class="mt-1 text-base font-semibold text-[var(--text)]">{capLabel(selected.limits.posts)}</p>
					</div>
					<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
						<p class="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Callbacks</p>
						<p class="mt-1 text-base font-semibold text-[var(--text)]">{capLabel(selected.limits.callbacks)}</p>
					</div>
					<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 px-3 py-2">
						<p class="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Imports</p>
						<p class="mt-1 text-base font-semibold text-[var(--text)]">{capLabel(selected.limits.imports)}</p>
					</div>
				</div>
				<div class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 p-3">
					<div class="mb-2 flex items-center justify-between gap-2">
						<p class="text-xs font-semibold text-[var(--text)]">Usage ({data.usageMonthKey})</p>
						<p class="text-[11px] text-[var(--text-muted)]">
							Send log: <strong class="text-[var(--text)]">{selected.postSendsFromLog}</strong>
							{#if selected.usageMonthAccount.post_sends_override != null}
								<span> · Override: <strong class="text-[var(--text)]">{selected.usageMonthAccount.post_sends_override}</strong></span>
							{/if}
						</p>
					</div>
					<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						<div class="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
							<p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Posts (quota)</p>
							<p class="mt-1 text-sm font-semibold text-[var(--text)]">{selected.usage.postsTotal}</p>
						</div>
						<div class="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
							<p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Queued</p>
							<p class="mt-1 text-sm font-semibold text-[var(--text)]">{selected.usage.postsQueued}</p>
						</div>
						<div class="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
							<p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Callbacks</p>
							<p class="mt-1 text-sm font-semibold text-[var(--text)]">{selected.usage.callbackInputs}</p>
						</div>
						<div class="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
							<p class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Imports</p>
							<p class="mt-1 text-sm font-semibold text-[var(--text)]">{selected.usage.importOperations}</p>
						</div>
					</div>
				</div>
			</section>

			<div class="space-y-6">
				<section>
					<h3 class="mb-2 text-sm font-semibold text-[var(--text)]">Tier</h3>
					<form
						method="POST"
						action="?/updateTier"
						class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
						use:enhance={() => {
							return async ({ result, update }) => {
								await update();
								if (result.type === 'success') await resyncSelectedAfterSave();
							};
						}}
					>
						<input type="hidden" name="user_id" value={selected.id} />
						<div class="min-w-0 flex-1">
							<label for="admin-user-tier-select" class="sr-only">Tier</label>
							<select
								id="admin-user-tier-select"
								name="tier"
								bind:value={editTier}
								class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]"
							>
								<option value="free">Free</option>
								<option value="pro">Pro</option>
								<option value="enterprise">Enterprise</option>
								<option value="admin">Admin</option>
								<option value="blocked">Blocked</option>
							</select>
						</div>
						<button
							type="submit"
							class="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
						>
							Save tier
						</button>
					</form>
					{#if selected.tier === 'blocked'}
						<div class="mt-3 flex flex-wrap gap-2">
							<form
								method="POST"
								action="?/updateTier"
								use:enhance={() => {
									return async ({ result, update }) => {
										await update();
										if (result.type === 'success') await resyncSelectedAfterSave();
									};
								}}
							>
								<input type="hidden" name="user_id" value={selected.id} />
								<input type="hidden" name="tier" value="free" />
								<button
									type="submit"
									class="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:opacity-95"
								>
									Enable account (free tier)
								</button>
							</form>
						</div>
					{/if}
				</section>

				<section>
					<h3 class="mb-2 text-sm font-semibold text-[var(--text)]">Monthly usage ({data.usageMonthKey})</h3>
					<p class="mb-3 text-xs text-[var(--text-muted)]">
						Callbacks and imports are stored on this account for {data.usageMonthKey}. For <strong>post sends</strong>,
						leave the field blank to use the real successful send count from logs (plus email carryover). Enter a
						number to pin the quota count to that value for the month.
					</p>
					<form
						method="POST"
						action="?/setUsage"
						class="space-y-3"
						novalidate
						use:enhance={() => {
							return async ({ result, update }) => {
								await update();
								if (result.type === 'success') await resyncSelectedAfterSave();
							};
						}}
					>
						<input type="hidden" name="user_id" value={selected.id} />
						<input type="hidden" name="month" value={data.usageMonthKey} />
						<div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
							<div>
								<label for="usage-cb" class="mb-1 block text-xs font-medium text-[var(--text-muted)]"
									>Callback inputs (stored)</label
								>
								<input
									id="usage-cb"
									name="callback_inputs"
									type="number"
									min="0"
									step="1"
									bind:value={usageCallbacksStr}
									class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
								/>
							</div>
							<div>
								<label for="usage-imp" class="mb-1 block text-xs font-medium text-[var(--text-muted)]"
									>Import operations (stored)</label
								>
								<input
									id="usage-imp"
									name="import_operations"
									type="number"
									min="0"
									step="1"
									bind:value={usageImportsStr}
									class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
								/>
							</div>
							<div>
								<label for="usage-post" class="mb-1 block text-xs font-medium text-[var(--text-muted)]"
									>Post sends for quota (optional)</label
								>
								<input
									id="usage-post"
									name="post_sends_override"
									type="text"
									inputmode="numeric"
									autocomplete="off"
									bind:value={usagePostOverride}
									placeholder="Blank = {selected.postSendsFromLog} from send log this month"
									class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--text)] tabular-nums"
								/>
							</div>
						</div>
						<button
							type="submit"
							class="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
						>
							Save usage
						</button>
					</form>
				</section>

				<section class="border-t border-[var(--border)] pt-4">
					<h3 class="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">Danger zone</h3>
					<form
						method="POST"
						action="?/removeUser"
						use:enhance={({ cancel }) => {
							if (
								!confirm(
									`Remove ${selected?.email ?? selected?.name ?? 'this user'}? This deletes the user and all their posts, schedules, webhooks, and other data.`
								)
							) {
								cancel();
							}
							return async ({ result, update }) => {
								await update();
								if (result.type === 'success') {
									await tick();
									selected = null;
								}
							};
						}}
					>
						<input type="hidden" name="user_id" value={selected.id} />
						<button
							type="submit"
							class="rounded-lg border border-red-500/50 bg-transparent px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
						>
							Remove account permanently
						</button>
					</form>
				</section>
			</div>
		</div>
	</div>
{/if}
