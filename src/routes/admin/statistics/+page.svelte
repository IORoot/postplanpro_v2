<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import AdminStatsLineChart from '$lib/components/AdminStatsLineChart.svelte';
	import AdminStatsBarChart from '$lib/components/AdminStatsBarChart.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function fmt(n: number): string {
		return n.toLocaleString();
	}

	function rangeHref(days: number): string {
		const params = new URLSearchParams();
		params.set('range', String(days));
		return `/admin/statistics?${params.toString()}`;
	}

	function formatPercent(n: number | null): string {
		if (n === null) return '—';
		return `${(n * 100).toFixed(1)}%`;
	}

	const tierCategories = $derived(data.tierBreakdown.map((t) => t.tier));
	const tierValues = $derived(data.tierBreakdown.map((t) => t.count));

	const RANGE_OPTIONS = [
		{ days: 7, label: '7d' },
		{ days: 30, label: '30d' },
		{ days: 90, label: '90d' },
		{ days: 180, label: '180d' },
		{ days: 365, label: '365d' }
	];
</script>

<svelte:head>
	<title>Statistics – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Statistics"
	description="Platform-wide totals and trends across all users."
/>

<div class="mb-4 flex flex-wrap items-center gap-2">
	<span class="text-xs text-[var(--text-muted)]">Range:</span>
	{#each RANGE_OPTIONS as opt}
		<a
			href={rangeHref(opt.days)}
			class="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition-colors {data.range === opt.days
				? 'bg-[var(--primary)] text-white'
				: 'text-[var(--text)] hover:bg-[var(--surface-hover)]'}"
		>
			{opt.label}
		</a>
	{/each}
	<span class="ml-auto text-xs text-[var(--text-muted)]">As of {new Date(data.generatedAt).toLocaleString()}</span>
</div>

<section class="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Users</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.totals.users)}</p>
		<p class="mt-1 text-[11px] text-[var(--text-muted)]">{fmt(data.totals.users_verified)} verified</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Active users ({data.range}d)</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.sinceTotals.active_users)}</p>
		<p class="mt-1 text-[11px] text-[var(--text-muted)]">{fmt(data.sinceTotals.new_users)} signed up</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Posts</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.totals.posts_total)}</p>
		<p class="mt-1 text-[11px] text-[var(--text-muted)]">
			{fmt(data.totals.posts_sent)} sent · {fmt(data.totals.posts_scheduled)} scheduled · {fmt(data.totals.posts_failed)} failed
		</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Send attempts ({data.range}d)</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.sinceTotals.send_attempts)}</p>
		<p class="mt-1 text-[11px] text-[var(--text-muted)]">
			Success rate {formatPercent(data.sinceTotals.success_rate)}
		</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Successful sends</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.totals.send_logs_success)}</p>
		<p class="mt-1 text-[11px] text-[var(--text-muted)]">of {fmt(data.totals.send_logs_total)} total</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Send failures</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.totals.send_logs_failed)}</p>
		<p class="mt-1 text-[11px] text-[var(--text-muted)]">{fmt(data.sinceTotals.send_failures)} in last {data.range}d</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Webhooks</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.totals.webhooks_total)}</p>
		<p class="mt-1 text-[11px] text-[var(--text-muted)]">{fmt(data.totals.oauth_accounts_total)} OAuth accounts</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Schedules</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.totals.schedules_total)}</p>
		<p class="mt-1 text-[11px] text-[var(--text-muted)]">
			{fmt(data.totals.schedule_slots_total)} slots · {fmt(data.totals.schedule_rules_total)} rules
		</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Callback inputs</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.totals.callback_inputs_total)}</p>
		<p class="mt-1 text-[11px] text-[var(--text-muted)]">
			{fmt(data.totals.post_stages_pass)} pass · {fmt(data.totals.post_stages_fail)} fail
		</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Import operations</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.totals.import_operations_total)}</p>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
		<p class="text-xs text-[var(--text-muted)]">Auth tokens</p>
		<p class="mt-1 text-xl font-semibold text-[var(--text)]">{fmt(data.totals.auth_tokens_total)}</p>
	</div>
</section>

<section class="mt-6 grid gap-4 lg:grid-cols-2">
	<AdminStatsLineChart
		title="Posts created per day ({data.range}d)"
		dates={data.series.dates}
		series={[
			{ name: 'Created', data: data.series.postsCreated, color: 'rgb(37 99 235)' },
			{ name: 'Scheduled', data: data.series.postsScheduled, color: 'rgb(168 85 247)' }
		]}
	/>
	<AdminStatsLineChart
		title="Send attempts per day ({data.range}d)"
		dates={data.series.dates}
		series={[
			{ name: 'Success', data: data.series.sendsSuccess, color: 'rgb(22 163 74)' },
			{ name: 'Failure', data: data.series.sendsFailed, color: 'rgb(220 38 38)' }
		]}
	/>
	<AdminStatsLineChart
		title="New users per day ({data.range}d)"
		dates={data.series.dates}
		series={[{ name: 'New users', data: data.series.newUsers, color: 'rgb(244 114 22)' }]}
	/>
	<AdminStatsBarChart title="Users by tier" categories={tierCategories} values={tierValues} />
</section>

<section class="mt-6 grid gap-4 lg:grid-cols-2">
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
		<h3 class="mb-3 text-sm font-semibold text-[var(--text)]">Top users by total posts</h3>
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="text-xs text-[var(--text-muted)]">
					<th class="py-2">User</th>
					<th class="py-2">Tier</th>
					<th class="py-2 text-right">Posts</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--border)]">
				{#each data.topUsersByPosts as u}
					<tr>
						<td class="py-2 text-[var(--text)]">{u.email ?? u.name ?? u.id}</td>
						<td class="py-2 text-[var(--text-muted)]">{u.tier}</td>
						<td class="py-2 text-right tabular-nums text-[var(--text)]">{fmt(u.post_count)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
		<h3 class="mb-3 text-sm font-semibold text-[var(--text)]">Top users by successful sends</h3>
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="text-xs text-[var(--text-muted)]">
					<th class="py-2">User</th>
					<th class="py-2">Tier</th>
					<th class="py-2 text-right">Sends</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--border)]">
				{#each data.topUsersBySends as u}
					<tr>
						<td class="py-2 text-[var(--text)]">{u.email ?? u.name ?? u.id}</td>
						<td class="py-2 text-[var(--text-muted)]">{u.tier}</td>
						<td class="py-2 text-right tabular-nums text-[var(--text)]">{fmt(u.send_count)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<section class="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
	<h3 class="mb-3 text-sm font-semibold text-[var(--text)]">Recent send failures by status ({data.range}d)</h3>
	{#if data.recentFailures.length === 0}
		<p class="text-sm text-[var(--text-muted)]">No failures in this range.</p>
	{:else}
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="text-xs text-[var(--text-muted)]">
					<th class="py-2">Status</th>
					<th class="py-2 text-right">Count</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-[var(--border)]">
				{#each data.recentFailures as f}
					<tr>
						<td class="py-2 text-[var(--text)]">{f.status ?? 'no response'}</td>
						<td class="py-2 text-right tabular-nums text-[var(--text)]">{fmt(f.n)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>
