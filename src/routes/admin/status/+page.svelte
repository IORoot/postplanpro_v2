<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Status – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Status"
	description="Host and scheduler hints for this server process (admin only)."
/>

<div class="mt-6 space-y-6">
	<section class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
		<h2 class="text-base font-semibold text-[var(--text)]">System cron daemon</h2>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			This checks whether a traditional <code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">cron</code> or
			<code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">crond</code> process is running in this container or
			host. The production Docker image does not start a cron daemon by default.
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<span
				class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium {data.cronDaemon.running
					? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
					: 'bg-amber-500/15 text-amber-800 dark:text-amber-200'}"
			>
				{data.cronDaemon.running ? 'Running' : 'Not detected'}
			</span>
		</div>
		<p class="mt-3 text-sm text-[var(--text)]">
			<span class="font-medium">Check:</span>
			{data.cronDaemon.method}
		</p>
		{#if data.cronDaemon.detail}
			<p class="mt-2 text-sm text-[var(--text-muted)]">{data.cronDaemon.detail}</p>
		{/if}
	</section>

	<section class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
		<h2 class="text-base font-semibold text-[var(--text)]">PostPlan scheduled posts</h2>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			Due posts are sent when something calls the HTTP endpoint
			<code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">GET /api/cron/send-due-posts</code> with the
			<code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">x-cron-secret</code> header (see
			<code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">CRON_SECRET</code>). That is usually wired from
			the host, Kubernetes CronJob, or an external scheduler—not from in-container system cron unless you add it.
		</p>
	</section>
</div>
