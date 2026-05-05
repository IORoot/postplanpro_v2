<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let copiedId = $state<string | null>(null);
	const totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
	const showingFrom = $derived((data.page - 1) * data.pageSize + 1);
	const showingTo = $derived(Math.min(data.page * data.pageSize, data.total));

	function pageHref(page: number): string {
		const params = new URLSearchParams();
		params.set('page', String(page));
		params.set('pageSize', String(data.pageSize));
		return `/schedules?${params.toString()}`;
	}

	async function copyScheduleId(id: string) {
		try {
			await navigator.clipboard.writeText(id);
			copiedId = id;
			setTimeout(() => (copiedId = null), 2000);
		} catch {
			// ignore
		}
	}
</script>

<svelte:head>
	<title>Schedules – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Schedules"
	description="Create schedules with time slots, then apply them to posts to set when they send."
	describeBelow={true}
>
	{#snippet trail()}
		<a href="/schedules/new" class="btn-primary btn-touch text-white shadow-sm">New schedule</a>
	{/snippet}
</PageSectionHeading>

<div class="flex flex-col gap-5">
	<form method="get" action="/schedules" class="flex flex-wrap items-center gap-2">
		<select name="pageSize" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] min-h-[44px] shadow-sm">
			<option value="20" selected={data.pageSize === 20}>20 per page</option>
			<option value="50" selected={data.pageSize === 50}>50 per page</option>
			<option value="100" selected={data.pageSize === 100}>100 per page</option>
			<option value="200" selected={data.pageSize === 200}>200 per page</option>
		</select>
		<input type="hidden" name="page" value="1" />
		<button type="submit" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] shadow-sm">Apply</button>
		{#if data.total > 0}
			<p class="text-xs text-[var(--text-muted)]">
				Showing {showingFrom.toLocaleString()}-{showingTo.toLocaleString()} of {data.total.toLocaleString()}
			</p>
		{/if}
	</form>
	{#if data.schedules.length === 0}
		<EmptyState title="No schedules yet">
			<p>
				Schedules hold rules (or fixed slots) that decide when posts fire.
				<a href="/schedules/new" class="font-medium text-[var(--primary)] hover:underline">Create a schedule</a>, then apply it from a post or the schedule’s edit page.
			</p>
		</EmptyState>
	{:else}
		{#each data.schedules as schedule}
			<div
				class="content-card content-card-accent rounded-xl p-4 shadow-sm border-l-4"
				style="border-left-color: {schedule.color ?? '#e5e5e5'}; background-color: {schedule.color ?? 'var(--surface)'};"
			>
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
					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onclick={() => copyScheduleId(schedule.id)}
							class="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded px-2 py-1.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
							title="Copy schedule ID"
						>
							{copiedId === schedule.id ? 'Copied!' : schedule.id}
						</button>
						<a href="/schedules/{schedule.id}" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center justify-center shadow-sm">Edit</a>
						<form method="POST" action="?/deleteSchedule" use:enhance={({ cancel }) => { if (!confirm('Delete this schedule? Posts that use it will no longer be tied to these rules (they stay as posts).')) cancel(); return () => invalidateAll(); }} class="inline">
							<input type="hidden" name="id" value={schedule.id} />
							<button type="submit" class="btn-danger-outline min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium">Delete</button>
						</form>
					</div>
				</div>
			</div>
		{/each}
	{/if}
	{#if totalPages > 1}
		<div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
			<p class="text-sm text-[var(--text-muted)]">Page {data.page} of {totalPages}</p>
			<div class="flex items-center gap-2">
				<a
					href={pageHref(Math.max(1, data.page - 1))}
					aria-disabled={data.page <= 1}
					class="inline-flex min-h-[36px] items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors {data.page <= 1
						? 'pointer-events-none cursor-not-allowed opacity-50'
						: 'hover:bg-[var(--surface-hover)]'}"
				>Prev</a>
				<a
					href={pageHref(Math.min(totalPages, data.page + 1))}
					aria-disabled={data.page >= totalPages}
					class="inline-flex min-h-[36px] items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors {data.page >= totalPages
						? 'pointer-events-none cursor-not-allowed opacity-50'
						: 'hover:bg-[var(--surface-hover)]'}"
				>Next</a>
			</div>
		</div>
	{/if}
</div>
