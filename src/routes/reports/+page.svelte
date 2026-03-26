<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString();
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
	<title>Reports – PostPlan</title>
</svelte:head>

<div class="flex flex-col gap-6 lg:flex-row">
	<nav class="flex shrink-0 flex-col gap-1 lg:w-52" aria-label="Report types">
		<a
			href="/reports"
			class="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors touch-manipulation {data.reportType === 'logs'
				? 'bg-[var(--primary)]/15 text-[var(--primary)]'
				: 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H5.25a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H5.25a1.125 1.125 0 00-1.125 1.125v7.5c0 .621.504 1.125 1.125 1.125h7.5a1.125 1.125 0 001.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25z" />
			</svg>
			Request / Response
		</a>
		<a
			href="/reports?report=callback-stages"
			class="flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors touch-manipulation {data.reportType === 'callback-stages'
				? 'bg-[var(--primary)]/15 text-[var(--primary)]'
				: 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			Callback stages
		</a>
	</nav>

	<main class="min-w-0 flex-1 space-y-4">
		{#if data.reportType === 'logs'}
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 class="text-2xl font-bold text-[var(--text)]">Request / Response</h1>
					<p class="mt-1 text-sm text-[var(--text-muted)]">
						For each send: the JSON we posted to your webhook and the response we got back—useful when a send fails or returns an error.
					</p>
				</div>
				{#if data.reports.length > 0}
					<form method="POST" action="?/clearLogs" use:enhance={({ cancel }) => { if (!confirm('Clear all send logs? You will lose this request/response history. This cannot be undone.')) cancel(); return () => invalidateAll(); }} class="inline">
						<button type="submit" class="btn-danger-outline min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-medium">Clear logs</button>
					</form>
				{/if}
			</div>

			{#if data.reports.length === 0}
				<div class="content-card rounded-xl p-6 text-center">
					<p class="text-[var(--text-muted)]">
						No send history yet. When a post is sent to a webhook, the request and response will show up here. Use
						<span class="font-medium text-[var(--text)]">Send now</span> on the Posts page, or wait for a scheduled send.
					</p>
				</div>
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
			{/if}
		{:else}
			<!-- Callback stages report -->
			<div>
				<h1 class="text-2xl font-bold text-[var(--text)]">Callback stages</h1>
				<p class="mt-1 text-sm text-[var(--text-muted)]">All post callback stages reported by Make.com (stage_passed / stage_failed).</p>
			</div>

			<form method="GET" action="/reports" class="content-card rounded-xl border border-[var(--border)] p-4">
				<input type="hidden" name="report" value="callback-stages" />
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
						<button type="submit" class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white min-h-[44px]">Apply filters</button>
						<a href="/reports?report=callback-stages" class="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center">Reset</a>
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
			{/if}
		{/if}
	</main>
</div>
