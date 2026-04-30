<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form?: ActionData } = $props();
</script>

<svelte:head>
	<title>Load Testing - PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Load Testing"
	description="Create scheduled bulk test posts to a direct webhook URL and measure delivery throughput on your listener server."
/>

<div class="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
	Use cautiously on production. Large runs can increase DB load and outbound webhook traffic.
</div>

{#if form?.error}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
{/if}

{#if form?.created}
	<div class="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-900 dark:text-emerald-100">
		<p class="font-semibold">Load test run created.</p>
		<p class="mt-1">
			Run ID: <span class="font-mono">{form.runId}</span>
		</p>
		<p class="mt-1">
			Posts: {form.postCount} | Interval: {form.intervalSeconds}s
		</p>
		<p class="mt-1">Window: {form.firstScheduledAt} to {form.lastScheduledAt}</p>
	</div>
{/if}

<form
	method="POST"
	action="?/createRun"
	class="mt-6 space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
>
	<div>
		<label for="webhook-url" class="mb-1 block text-sm font-medium text-[var(--text)]">Target webhook URL</label>
		<input
			id="webhook-url"
			name="webhookUrl"
			type="url"
			required
			placeholder="https://listener.example.com/webhook"
			value={form?.webhookUrl ?? ''}
			class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
		/>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		<div>
			<label for="post-count" class="mb-1 block text-sm font-medium text-[var(--text)]">Post count</label>
			<input
				id="post-count"
				name="postCount"
				type="number"
				required
				min="1"
				max={data.constraints.maxPostCount}
				value={form?.postCount ?? data.defaults.postCount}
				class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
			/>
			<p class="mt-1 text-xs text-[var(--text-muted)]">Max {data.constraints.maxPostCount} per run.</p>
		</div>
		<div>
			<label for="start-at" class="mb-1 block text-sm font-medium text-[var(--text)]">Start at</label>
			<input
				id="start-at"
				name="startAt"
				type="datetime-local"
				required
				min={data.minStartAt}
				value={data.minStartAt}
				class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
			/>
			<p class="mt-1 text-xs text-[var(--text-muted)]">Timezone: {data.userTimezone}</p>
		</div>
		<div>
			<label for="interval-seconds" class="mb-1 block text-sm font-medium text-[var(--text)]">Interval seconds</label>
			<input
				id="interval-seconds"
				name="intervalSeconds"
				type="number"
				min="0"
				max={data.constraints.maxIntervalSeconds}
				value={form?.intervalSeconds ?? data.defaults.intervalSeconds}
				class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
			/>
			<p class="mt-1 text-xs text-[var(--text-muted)]">0 = burst at same start time.</p>
		</div>
	</div>

	<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 p-3">
		<label for="high-volume-confirm" class="mb-1 block text-sm font-medium text-[var(--text)]">
			High volume confirmation (only needed for {data.constraints.highVolumeThreshold}+ posts)
		</label>
		<input
			id="high-volume-confirm"
			name="highVolumeConfirm"
			type="text"
			placeholder={data.constraints.highVolumeConfirmText}
			class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--text)]"
		/>
	</div>

	<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
		Create load test run
	</button>
</form>
