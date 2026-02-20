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

<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h1 class="text-2xl font-bold text-[var(--text)]">Reports</h1>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Every sent post: request JSON and response from the target.</p>
	</div>
	{#if data.reports.length > 0}
		<form method="POST" action="?/clearLogs" use:enhance={({ cancel }) => { if (!confirm('Remove all send logs from the database?')) cancel(); return () => invalidateAll(); }} class="inline">
			<button type="submit" class="rounded-lg border border-red-400 px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/30 min-h-[44px]">Clear logs</button>
		</form>
	{/if}
</div>

<div class="mt-6 space-y-4">
	{#if data.reports.length === 0}
		<div class="content-card rounded-xl p-6 text-center">
			<p class="text-[var(--text-muted)]">No sent posts yet. Send a post from the Posts page or wait for a scheduled send.</p>
		</div>
	{:else}
		{#each data.reports as report}
			<div class="content-card content-card-accent rounded-xl overflow-hidden shadow-sm">
				<div class="border-b border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="min-w-0">
							<a href="/posts/{report.post_id}" class="font-semibold text-[var(--primary)] hover:underline">{report.post_title}</a>
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
							<form method="POST" action="?/deleteReport" use:enhance={() => invalidateAll()} class="inline">
								<input type="hidden" name="id" value={report.id} />
								<button type="submit" class="rounded border border-red-400 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/30 min-h-[36px]">Remove</button>
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
</div>
