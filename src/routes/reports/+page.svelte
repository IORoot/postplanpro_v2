<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import StatisticsMonthChart from '$lib/components/StatisticsMonthChart.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	function parseUtcLike(iso: string): Date {
		const normalized = iso.trim().replace(' ', 'T');
		if (/[zZ]$/.test(normalized) || /[+-]\d{2}:?\d{2}$/.test(normalized)) return new Date(normalized);
		return new Date(`${normalized}Z`);
	}

	function formatDate(iso: string) {
		return new Intl.DateTimeFormat(undefined, {
			timeZone: data.timezone,
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(parseUtcLike(iso));
	}

	function formatDateTime(iso: string) {
		return new Intl.DateTimeFormat(undefined, {
			timeZone: data.timezone,
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(parseUtcLike(iso));
	}

	function tryPrettyJson(raw: string): string {
		try {
			const parsed = JSON.parse(raw);
			return JSON.stringify(parsed, null, 2);
		} catch {
			return raw;
		}
	}
</script>

<svelte:head>
	<title>{data.reportType === 'statistics' ? 'Statistics' : 'Reports'} – PostPlan</title>
</svelte:head>

<div class="flex flex-col gap-6 lg:flex-row">
	<nav class="flex shrink-0 flex-col gap-1 lg:w-52" aria-label="Report types">
		<a
			href={data.statsChartMonth
				? `/reports?report=statistics&statsMonth=${encodeURIComponent(data.statsChartMonth)}`
				: '/reports?report=statistics'}
			class="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors touch-manipulation {data.reportType === 'statistics'
				? 'bg-[var(--primary)]/15 text-[var(--primary)]'
				: 'text-[var(--text-muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--text)]'}"
		>
			<span
				class="inline-block h-5 w-5 shrink-0 bg-current"
				style:mask-image="url('/statistics.svg')"
				style:mask-size="contain"
				style:mask-repeat="no-repeat"
				style:mask-position="center"
				style:-webkit-mask-image="url('/statistics.svg')"
				style:-webkit-mask-size="contain"
				style:-webkit-mask-repeat="no-repeat"
				style:-webkit-mask-position="center"
				aria-hidden="true"
			></span>
			Statistics
		</a>
		<a
			href="/reports"
			class="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors touch-manipulation {data.reportType === 'logs'
				? 'bg-[var(--primary)]/15 text-[var(--primary)]'
				: 'text-[var(--text-muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--text)]'}"
		>
			<span
				class="inline-block h-5 w-5 shrink-0 bg-current"
				style:mask-image="url('/request_response.svg')"
				style:mask-size="contain"
				style:mask-repeat="no-repeat"
				style:mask-position="center"
				style:-webkit-mask-image="url('/request_response.svg')"
				style:-webkit-mask-size="contain"
				style:-webkit-mask-repeat="no-repeat"
				style:-webkit-mask-position="center"
				aria-hidden="true"
			></span>
			Request / Response
		</a>
		<a
			href="/reports?report=callback-stages"
			class="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors touch-manipulation {data.reportType === 'callback-stages'
				? 'bg-[var(--primary)]/15 text-[var(--primary)]'
				: 'text-[var(--text-muted)] hover:bg-[var(--primary-soft)] hover:text-[var(--text)]'}"
		>
			<span
				class="inline-block h-5 w-5 shrink-0 bg-current"
				style:mask-image="url('/callback.svg')"
				style:mask-size="contain"
				style:mask-repeat="no-repeat"
				style:mask-position="center"
				style:-webkit-mask-image="url('/callback.svg')"
				style:-webkit-mask-size="contain"
				style:-webkit-mask-repeat="no-repeat"
				style:-webkit-mask-position="center"
				aria-hidden="true"
			></span>
			Callback stages
		</a>
	</nav>

	<main class="min-w-0 flex-1 space-y-6">
		{#if data.reportType === 'statistics'}
			<PageSectionHeading
				title="Statistics"
				description="Counts and pipeline health at a glance; upcoming posts, recent publishes, failures, and posts with failed Make.com callback stages."
			/>
			{#if data.statsChartSeries.length > 0}
				<StatisticsMonthChart
					points={data.statsChartSeries}
					monthLabel={data.statsChartTitle}
					prevHref={`/reports?report=statistics&statsMonth=${encodeURIComponent(data.statsChartPrevMonth)}`}
					nextHref={`/reports?report=statistics&statsMonth=${encodeURIComponent(data.statsChartNextMonth)}`}
					timezoneLabel={data.timezone}
				/>
			{/if}
			{#if data.stats}
				<div class="mb-6 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:overflow-visible">
					<div class="flex w-max max-w-full flex-wrap gap-1.5 md:w-auto md:max-w-none">
						<a
							href="/posts"
							title="Total posts"
							class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
						>
							<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Total</p>
							<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.totalPosts}</p>
						</a>
						<a
							href="/posts?status=draft"
							title="Draft posts"
							class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
						>
							<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Drafts</p>
							<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.draft}</p>
						</a>
						<a
							href="/posts?status=scheduled"
							title="Scheduled posts"
							class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
						>
							<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sched.</p>
							<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.scheduled}</p>
						</a>
						<a
							href="/posts?status=sent"
							title="Sent posts"
							class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
						>
							<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sent</p>
							<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.sent}</p>
						</a>
						<a
							href="/posts?status=failed"
							title="Failed posts"
							class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
						>
							<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Failed</p>
							<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.failed}</p>
						</a>
						<a
							href="/schedules"
							title="Schedules"
							class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
						>
							<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sched.</p>
							<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.scheduleCount}</p>
						</a>
						<a
							href="/account?section=globals"
							title="Webhooks"
							class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
						>
							<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Hooks</p>
							<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.webhookCount}</p>
						</a>
						<div class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5" title="Posts sent this week">
							<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Week</p>
							<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.sentThisWeek}</p>
						</div>
						<a
							href="/reports?report=callback-stages"
							title="Make.com callback stages (pass / fail)"
							class="content-card min-w-[5.25rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
						>
							<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Stages</p>
							<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">
								<span class="text-green-600 dark:text-green-400">{data.stagePasses ?? 0}</span>
								<span class="mx-0.5 text-[var(--text-muted)] font-normal text-sm">/</span>
								<span class="text-red-600 dark:text-red-400">{data.stageFails ?? 0}</span>
							</p>
						</a>
					</div>
				</div>
			{/if}
			<div>
				<div class="mb-4 flex items-center justify-between gap-3">
					<h3 class="text-base font-semibold text-[var(--text)]">Upcoming posts</h3>
					<a href="/calendar" class="text-sm font-medium text-[var(--primary)] hover:underline">View calendar →</a>
				</div>
				<div class="content-card rounded-xl border border-[var(--primary-border-soft)] overflow-hidden">
					{#if data.upcomingPosts.length === 0}
						<div class="p-6 text-center text-[var(--text-muted)]">
							<p>
								No upcoming posts. Schedule some from the
								<a href="/posts" class="text-[var(--primary)] hover:underline">Posts</a> or
								<a href="/calendar" class="text-[var(--primary)] hover:underline">Calendar</a> page.
							</p>
						</div>
					{:else}
						<ul class="divide-y divide-[var(--primary-border-soft)]">
							{#each data.upcomingPosts as post}
								<li>
									<a
										href="/posts/{post.id}"
										class="flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
									>
										<div class="min-w-0 flex-1">
											<p class="font-medium text-[var(--text)] truncate">{post.title || 'Untitled'}</p>
											<p class="text-xs text-[var(--text-muted)]">{post.webhook_name} · {formatDateTime(post.scheduled_at)}</p>
										</div>
										<span class="status-scheduled shrink-0 rounded px-2 py-1 text-xs font-medium">Scheduled</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
			<div class="grid gap-8 lg:grid-cols-3 lg:gap-10">
				<div>
					<div class="mb-4 flex items-center justify-between gap-3">
						<h3 class="text-base font-semibold text-[var(--text)]">Last 10 published</h3>
						<a href="/posts?status=sent" class="text-sm font-medium text-[var(--primary)] hover:underline">View all →</a>
					</div>
					<div class="content-card rounded-xl border border-[var(--primary-border-soft)] overflow-hidden">
						{#if (data.lastPublishedPosts?.length ?? 0) === 0}
							<div class="p-6 text-center text-[var(--text-muted)]">
								<p>No published posts yet.</p>
							</div>
						{:else}
							<ul class="divide-y divide-[var(--primary-border-soft)]">
								{#each data.lastPublishedPosts ?? [] as post}
									<li>
										<a
											href="/posts/{post.id}"
											class="flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
										>
											<div class="min-w-0 flex-1">
												<p class="font-medium text-[var(--text)] truncate">{post.title || 'Untitled'}</p>
												<p class="text-xs text-[var(--text-muted)]">{post.webhook_name} · {post.sent_at ? formatDateTime(post.sent_at) : '—'}</p>
											</div>
											<span class="status-sent shrink-0 rounded px-2 py-1 text-xs font-medium">Sent</span>
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
				<div>
					<div class="mb-4 flex items-center justify-between gap-3">
						<h3 class="text-base font-semibold text-[var(--text)]">Failed posts</h3>
						{#if (data.failedPosts?.length ?? 0) > 0}
							<a href="/posts?status=failed" class="text-sm font-medium text-[var(--primary)] hover:underline">View all →</a>
						{/if}
					</div>
					<div class="content-card rounded-xl border border-[var(--primary-border-soft)] overflow-hidden">
						{#if (data.failedPosts?.length ?? 0) === 0}
							<div class="p-6 text-center text-[var(--text-muted)]">
								<p>No failed posts.</p>
							</div>
						{:else}
							<ul class="divide-y divide-[var(--primary-border-soft)]">
								{#each data.failedPosts ?? [] as post}
									<li>
										<a
											href="/posts/{post.id}"
											class="block px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]"
										>
											<p class="font-medium text-[var(--text)] truncate">{post.title || 'Untitled'}</p>
											{#if post.error_message}
												<p class="mt-0.5 truncate text-xs text-[var(--text-muted)]" title={post.error_message}>{post.error_message}</p>
											{/if}
											<p class="mt-0.5 text-xs text-[var(--text-muted)]">{formatDateTime(post.updated_at)}</p>
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
				<div>
					<div class="mb-4 flex items-center justify-between gap-3">
						<h3 class="text-base font-semibold text-[var(--text)]">Posts with failed stages</h3>
						{#if (data.postsWithFailedStages?.length ?? 0) > 0}
							<a href="/reports?report=callback-stages&filterStatus=fail" class="text-sm font-medium text-[var(--primary)] hover:underline">View report →</a>
						{/if}
					</div>
					<div class="content-card rounded-xl border border-[var(--primary-border-soft)] overflow-hidden">
						{#if (data.postsWithFailedStages?.length ?? 0) === 0}
							<div class="p-6 text-center text-[var(--text-muted)]">
								<p>No posts with failed Make.com stages.</p>
							</div>
						{:else}
							<ul class="divide-y divide-[var(--primary-border-soft)]">
								{#each data.postsWithFailedStages ?? [] as post}
									<li>
										<a
											href="/posts/{post.id}"
											class="flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
										>
											<div class="min-w-0 flex-1">
												<p class="font-medium text-[var(--text)] truncate">{post.title || 'Untitled'}</p>
												<p class="text-xs text-[var(--text-muted)]">{post.sent_at ? formatDateTime(post.sent_at) : '—'}</p>
											</div>
											<span class="status-failed shrink-0 rounded px-2 py-1 text-xs font-medium">Stage failed</span>
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			</div>
		{:else if data.reportType === 'logs'}
			<PageSectionHeading
				title="Request / Response"
				description="For each send: the JSON we posted to your webhook and the response we got back—useful when a send fails or returns an error."
			>
				{#snippet trail()}
					{#if data.reports.length > 0}
						<form method="POST" action="?/clearLogs" use:enhance={({ cancel }) => { if (!confirm('Clear all send logs? You will lose this request/response history. This cannot be undone.')) cancel(); return () => invalidateAll(); }} class="inline">
							<button type="submit" class="btn-danger-outline btn-touch">Clear logs</button>
						</form>
					{/if}
				{/snippet}
			</PageSectionHeading>

			{#if data.reports.length === 0}
				<EmptyState title="No send history yet">
					<p>
						Each delivery logs the JSON we POSTed and what came back—handy when debugging webhooks or Make.com scenarios. Trigger a
						<span class="font-medium text-[var(--text)]">Send now</span> from
						<a href="/posts" class="font-medium text-[var(--primary)] hover:underline">Posts</a>, or wait for the next scheduled run.
					</p>
				</EmptyState>
			{:else}
				{#each data.reports as report}
					<div class="content-card content-card-accent rounded-xl overflow-hidden shadow-sm">
						<div class="border-b border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="min-w-0">
									<a
										href="/posts/{report.post_id}"
										class="block min-w-0 overflow-wrap-anywhere font-semibold text-[var(--primary)] hover:underline sm:truncate"
										title={report.post_title}>{report.post_title}</a>
									<p class="text-sm text-[var(--text-muted)]">
										{report.webhook_name} · {formatDate(report.sent_at)}
									</p>
								</div>
								<div class="flex items-center gap-2">
									{#if report.success}
										<span class="status-sent rounded px-2 py-1 text-xs font-medium">Sent</span>
									{:else}
										<span class="status-failed rounded px-2 py-1 text-xs font-medium">Failed</span>
									{/if}
									{#if report.response_status != null}
										<span class="rounded bg-[var(--surface)] px-2 py-1 text-xs font-mono text-[var(--text-muted)]">{report.response_status}</span>
									{/if}
									<form method="POST" action="?/deleteReport" use:enhance={({ cancel }) => { if (!confirm('Remove this log entry? The post itself stays; only this history row is deleted.')) cancel(); return () => invalidateAll(); }} class="inline">
										<input type="hidden" name="id" value={report.id} />
										<button type="submit" class="btn-danger-outline min-h-[36px] rounded border px-2 py-1 text-xs font-medium">Remove</button>
									</form>
								</div>
							</div>
						</div>
						<div class="grid gap-0 md:grid-cols-2">
							<details class="group border-b border-[var(--border)] md:border-b-0 md:border-r border-[var(--border)]" open={data.reports.length <= 3}>
								<summary class="cursor-pointer list-none px-4 py-2 text-sm font-medium text-[var(--text)] bg-[var(--surface-hover)] hover:bg-[var(--border)]/30 select-none">
									<span class="inline-flex items-center gap-1">Request JSON</span>
								</summary>
								<div class="max-h-[320px] overflow-auto p-4">
									<pre class="whitespace-pre-wrap break-words font-mono text-xs text-[var(--text)]">{tryPrettyJson(report.request_json)}</pre>
								</div>
							</details>
							<details class="group" open={data.reports.length <= 3}>
								<summary class="cursor-pointer list-none px-4 py-2 text-sm font-medium text-[var(--text)] bg-[var(--surface-hover)] hover:bg-[var(--border)]/30 select-none">
									<span class="inline-flex items-center gap-1">Response</span>
									{#if report.response_status != null}
										<span class="ml-1 font-mono text-[var(--text-muted)]">{report.response_status}</span>
									{/if}
								</summary>
								<div class="max-h-[320px] overflow-auto p-4">
									{#if report.response_body != null && report.response_body !== ''}
										<pre class="whitespace-pre-wrap break-words font-mono text-xs text-[var(--text)]">{tryPrettyJson(report.response_body)}</pre>
									{:else}
										<p class="text-xs text-[var(--text-muted)]">No response body</p>
									{/if}
								</div>
							</details>
						</div>
					</div>
				{/each}

				{#if (data.logsTotalPages ?? 1) > 1}
					<div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
						<p class="text-sm text-[var(--text-muted)]">
							Page {data.logsPage} of {data.logsTotalPages}
							<span class="mx-1">·</span>
							{data.logsTotal} total logs
						</p>
						<div class="flex items-center gap-2">
							<a
								href={`/reports?report=logs&page=${Math.max(1, (data.logsPage ?? 1) - 1)}`}
								aria-disabled={(data.logsPage ?? 1) <= 1}
								class="inline-flex min-h-[36px] items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors {(data.logsPage ?? 1) <= 1
									? 'pointer-events-none cursor-not-allowed opacity-50'
									: 'hover:bg-[var(--surface-hover)]'}"
							>
								← Prev
							</a>
							<a
								href={`/reports?report=logs&page=${Math.min((data.logsTotalPages ?? 1), (data.logsPage ?? 1) + 1)}`}
								aria-disabled={(data.logsPage ?? 1) >= (data.logsTotalPages ?? 1)}
								class="inline-flex min-h-[36px] items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors {(data.logsPage ?? 1) >= (data.logsTotalPages ?? 1)
									? 'pointer-events-none cursor-not-allowed opacity-50'
									: 'hover:bg-[var(--surface-hover)]'}"
							>
								Next →
							</a>
						</div>
					</div>
				{/if}
			{/if}
		{:else}
			<!-- Callback stages (reportType === 'callback-stages') -->
			<PageSectionHeading
				title="Callback stages"
				description="All post callback stages reported by Make.com (stage_passed / stage_failed)."
			/>

			<form method="GET" action="/reports" class="content-card rounded-xl border border-[var(--border)] p-4">
				<input type="hidden" name="report" value="callback-stages" />
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					<div>
						<label for="filterTitle" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Post title</label>
						<input
							id="filterTitle"
							type="text"
							name="filterTitle"
							value={data.callbackFilters?.title ?? ''}
							placeholder="Filter by title..."
							class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
						/>
					</div>
					<div>
						<label for="filterStage" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Stage</label>
						<input
							id="filterStage"
							type="text"
							name="filterStage"
							value={data.callbackFilters?.stage ?? ''}
							placeholder="Filter by stage..."
							class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
						/>
					</div>
					<div>
						<label for="filterStatus" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Status</label>
						<select
							id="filterStatus"
							name="filterStatus"
							value={data.callbackFilters?.status ?? ''}
							class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
						>
							<option value="">All</option>
							<option value="pass">Pass</option>
							<option value="fail">Fail</option>
						</select>
					</div>
					<div class="flex items-end gap-2">
						<button type="submit" class="btn-primary btn-touch">Apply filters</button>
						<a href="/reports?report=callback-stages" class="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center">Reset</a>
					</div>
					<div>
						<label for="cbPageSize" class="mb-1 block text-xs font-medium text-[var(--text-muted)]">Rows per page</label>
						<select
							id="cbPageSize"
							name="pageSize"
							class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
						>
							<option value="20" selected={(data.callbackPageSize ?? 50) === 20}>20</option>
							<option value="50" selected={(data.callbackPageSize ?? 50) === 50}>50</option>
							<option value="100" selected={(data.callbackPageSize ?? 50) === 100}>100</option>
							<option value="200" selected={(data.callbackPageSize ?? 50) === 200}>200</option>
						</select>
					</div>
				</div>
				<div class="mt-4 flex flex-wrap items-center gap-4">
					<label class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
						Order by
						<select
							name="orderBy"
							value={data.callbackOrderBy ?? 'date'}
							class="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)]"
						>
							<option value="date">Date / time</option>
							<option value="title">Title</option>
							<option value="stage">Stage</option>
							<option value="status">Status</option>
						</select>
					</label>
					<label class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
						Direction
						<select
							name="orderDir"
							value={data.callbackOrderDir ?? 'desc'}
							class="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)]"
						>
							<option value="desc">Descending</option>
							<option value="asc">Ascending</option>
						</select>
					</label>
				</div>
				<input type="hidden" name="page" value="1" />
			</form>

			{#if data.callbackStages.length === 0}
				<div class="content-card rounded-xl p-6 text-center">
					<p class="text-[var(--text-muted)]">No callback stages match the filters. Report stages from Make.com using the callback URL.</p>
				</div>
			{:else}
				<div class="content-card overflow-hidden rounded-xl border border-[var(--border)]">
					<div class="overflow-x-auto">
						<table class="w-full min-w-[520px] text-left text-sm">
							<thead>
								<tr class="border-b border-[var(--border)] bg-[var(--surface-hover)]">
									<th class="px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">Post title</th>
									<th class="px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">Post ID</th>
									<th class="px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">Stage</th>
									<th class="px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">Status</th>
									<th class="px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">Date / time</th>
									<th class="w-8 px-2 py-3" aria-hidden="true"></th>
								</tr>
							</thead>
							<tbody>
								{#each data.callbackStages as row}
									{@const isPass = (row.status ?? 'pass') === 'pass'}
									<tr class="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]/50">
										<td class="px-4 py-3">
											<a href="/posts/{row.post_id}" class="font-medium text-[var(--primary)] hover:underline">{row.post_title || '—'}</a>
										</td>
										<td class="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{row.post_id}</td>
										<td class="px-4 py-3 text-[var(--text)]">{row.stage}</td>
										<td class="px-4 py-3 text-[var(--text-muted)]">{isPass ? 'pass' : 'fail'}</td>
										<td class="px-4 py-3 text-[var(--text-muted)]">{formatDate(row.completed_at)}</td>
										<td class="px-2 py-3">
											<span
												class="inline-block h-2 w-2 rounded-full {isPass ? 'bg-green-500' : 'bg-red-500'}"
												title={isPass ? 'Passed' : 'Failed'}
												aria-hidden="true"
											></span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
				{#if (data.callbackTotalPages ?? 1) > 1}
					<div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
						<p class="text-sm text-[var(--text-muted)]">
							Page {data.callbackPage} of {data.callbackTotalPages}
							<span class="mx-1">·</span>
							{data.callbackTotal} total rows
						</p>
						<div class="flex items-center gap-2">
							<a
								href={`/reports?report=callback-stages&page=${Math.max(1, (data.callbackPage ?? 1) - 1)}&pageSize=${data.callbackPageSize ?? 50}&orderBy=${encodeURIComponent(data.callbackOrderBy ?? 'date')}&orderDir=${encodeURIComponent(data.callbackOrderDir ?? 'desc')}&filterTitle=${encodeURIComponent(data.callbackFilters?.title ?? '')}&filterStage=${encodeURIComponent(data.callbackFilters?.stage ?? '')}&filterStatus=${encodeURIComponent(data.callbackFilters?.status ?? '')}`}
								aria-disabled={(data.callbackPage ?? 1) <= 1}
								class="inline-flex min-h-[36px] items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors {(data.callbackPage ?? 1) <= 1
									? 'pointer-events-none cursor-not-allowed opacity-50'
									: 'hover:bg-[var(--surface-hover)]'}"
							>
								← Prev
							</a>
							<a
								href={`/reports?report=callback-stages&page=${Math.min((data.callbackTotalPages ?? 1), (data.callbackPage ?? 1) + 1)}&pageSize=${data.callbackPageSize ?? 50}&orderBy=${encodeURIComponent(data.callbackOrderBy ?? 'date')}&orderDir=${encodeURIComponent(data.callbackOrderDir ?? 'desc')}&filterTitle=${encodeURIComponent(data.callbackFilters?.title ?? '')}&filterStage=${encodeURIComponent(data.callbackFilters?.stage ?? '')}&filterStatus=${encodeURIComponent(data.callbackFilters?.status ?? '')}`}
								aria-disabled={(data.callbackPage ?? 1) >= (data.callbackTotalPages ?? 1)}
								class="inline-flex min-h-[36px] items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors {(data.callbackPage ?? 1) >= (data.callbackTotalPages ?? 1)
									? 'pointer-events-none cursor-not-allowed opacity-50'
									: 'hover:bg-[var(--surface-hover)]'}"
							>
								Next →
							</a>
						</div>
					</div>
				{/if}
			{/if}
		{/if}
	</main>
</div>
