<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();
	let editingId = $state<string | null>(null);
	let editTier = $state('');

	const tiers = [
		{ value: 'free', label: 'Free' },
		{ value: 'pro', label: 'Pro' },
		{ value: 'enterprise', label: 'Enterprise' },
		{ value: 'admin', label: 'Admin' },
		{ value: 'blocked', label: 'Blocked' }
	];

	function startEdit(user: { id: string; tier: string }) {
		editingId = user.id;
		editTier = user.tier;
	}

	function cancelEdit() {
		editingId = null;
	}
</script>

<svelte:head>
	<title>Users – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Users"
	description="Manage all users (admin only). Change tier to adjust limits."
/>

{#if form?.error}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
{/if}
{#if form?.updated}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">User updated.</p>
{/if}
{#if form?.removed}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">User removed and all their content deleted.</p>
{/if}

<div class="overflow-x-auto">
	<table class="w-full border-collapse border border-[var(--border)] rounded-lg overflow-hidden">
		<thead>
			<tr class="bg-[var(--sidebar-bg)]">
				<th class="border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Email / Name</th>
				<th class="border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Tier</th>
				<th class="border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Posts this month</th>
				<th class="border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Callback inputs</th>
				<th class="border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Imports</th>
				<th class="border border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each data.users as user}
				<tr class="bg-[var(--surface)]">
					<td class="border border-[var(--border)] px-4 py-3 text-sm text-[var(--text)]">
						{user.email ?? user.name ?? user.id.slice(0, 8)}
					</td>
					<td class="border border-[var(--border)] px-4 py-3">
						{#if editingId === user.id}
							<form
								method="POST"
								action="?/updateTier"
								use:enhance={() => invalidateAll()}
								class="flex items-center gap-2"
							>
								<input type="hidden" name="user_id" value={user.id} />
								<select
									name="tier"
									bind:value={editTier}
									class="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)]"
								>
									{#each tiers as t}
										<option value={t.value}>{t.label}</option>
									{/each}
								</select>
								<button
									type="submit"
									class="rounded border border-[var(--primary)] bg-[var(--primary)] px-2 py-1.5 text-sm text-white hover:opacity-90"
								>
									Save
								</button>
								<button
									type="button"
									onclick={cancelEdit}
									class="rounded border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
								>
									Cancel
								</button>
							</form>
						{:else}
							<span class="capitalize text-[var(--text)]">{user.tier}</span>
							<button
								type="button"
								onclick={() => startEdit(user)}
								class="ml-2 text-xs text-[var(--primary)] hover:underline"
							>
								Edit
							</button>
						{/if}
					</td>
					<td class="border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">
						{user.usage.postsTotal}
					</td>
					<td class="border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">
						{user.usage.callbackInputs}
					</td>
					<td class="border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">
						{user.usage.importOperations}
					</td>
					<td class="border border-[var(--border)] px-4 py-3 flex flex-wrap items-center gap-2">
						{#if editingId !== user.id}
							<button
								type="button"
								onclick={() => startEdit(user)}
								class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
							>
								Change tier
							</button>
							<form
								method="POST"
								action="?/removeUser"
								use:enhance={({ cancel }) => {
									if (!confirm(`Remove ${user.email ?? user.name ?? user.id}? This deletes the user and all their posts, schedules, webhooks, and other data.`)) {
										cancel();
									}
									return () => invalidateAll();
								}}
								class="inline"
							>
								<input type="hidden" name="user_id" value={user.id} />
								<button
									type="submit"
									class="rounded border border-red-500/50 bg-transparent px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
								>
									Remove
								</button>
							</form>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
