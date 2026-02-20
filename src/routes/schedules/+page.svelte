<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
</script>

<svelte:head>
	<title>Schedules – PostPlan</title>
</svelte:head>

<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<h1 class="text-2xl font-bold text-[var(--text)]">Schedules</h1>
	<a href="/schedules/new" class="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] shadow-sm min-h-[44px] inline-flex items-center justify-center w-fit">+ New schedule</a>
</div>
<p class="mt-1 text-sm text-[var(--text-muted)]">Create schedules with time slots, then apply them to posts to set when they send.</p>

<div class="mt-6 space-y-4">
	{#if data.schedules.length === 0}
		<div class="content-card rounded-xl p-6 text-center">
			<p class="text-[var(--text-muted)]">No schedules yet. <a href="/schedules/new" class="font-medium text-[var(--primary)] hover:underline">Create one</a>.</p>
		</div>
	{:else}
		{#each data.schedules as schedule}
			<div class="content-card content-card-accent rounded-xl p-4 shadow-sm">
				<div class="flex flex-wrap items-center justify-between gap-4">
					<div class="min-w-0">
						<a href="/schedules/{schedule.id}" class="font-semibold text-[var(--primary)] hover:underline">{schedule.name}</a>
						{#if schedule.description}
							<p class="mt-0.5 text-sm text-[var(--text-muted)]">{schedule.description}</p>
						{/if}
						<p class="text-xs text-[var(--text-muted)]">
							{schedule.rule_count > 0 ? schedule.rule_count + ' rule(s)' : schedule.slot_count + ' slot(s)'}
						</p>
					</div>
					<div class="flex gap-2">
						<a href="/schedules/{schedule.id}" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center justify-center shadow-sm">Edit</a>
						<form method="POST" action="?/deleteSchedule" use:enhance={() => invalidateAll()} class="inline">
							<input type="hidden" name="id" value={schedule.id} />
							<button type="submit" class="rounded-lg border border-red-400 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/30 min-h-[44px]">Delete</button>
						</form>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
