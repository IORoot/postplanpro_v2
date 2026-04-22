<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Stripe – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Stripe"
	description="Choose test or live Stripe keys for checkout, portal, and webhooks. Override is stored in the database; clearing it uses STRIPE_MODE from the server environment."
/>

{#if form?.error}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
{/if}
{#if form?.updated}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">Stripe mode saved.</p>
{/if}
{#if form?.cleared}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">Override removed. Effective mode follows STRIPE_MODE in the environment.</p>
{/if}

<div class="mt-6 space-y-6">
	<section class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
		<h2 class="text-base font-semibold text-[var(--text)]">Active mode</h2>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			Environment default (when no DB override):
			<span class="font-medium text-[var(--text)]">{data.envDefaultMode}</span>
			<span class="text-[var(--text-muted)]"> · </span>
			Effective mode now:
			<span
				class="font-medium {data.effectiveMode === 'live' ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--text)]'}"
				>{data.effectiveMode}</span
			>
		</p>
		{#if data.dbOverride}
			<p class="mt-2 text-sm text-[var(--text-muted)]">
				Database override is set to <span class="font-medium text-[var(--text)]">{data.dbOverride}</span>.
			</p>
		{:else}
			<p class="mt-2 text-sm text-[var(--text-muted)]">No database override — STRIPE_MODE env controls the default.</p>
		{/if}

		<div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
			<form method="POST" action="?/setMode" use:enhance={() => invalidateAll()}>
				<input type="hidden" name="mode" value="test" />
				<button
					type="submit"
					class="min-h-[44px] w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors sm:w-auto {data.effectiveMode ===
					'test'
						? 'border-[var(--primary)] bg-[var(--primary)] text-white'
						: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'}"
				>
					Use test keys
				</button>
			</form>
			<form method="POST" action="?/setMode" use:enhance={() => invalidateAll()}>
				<input type="hidden" name="mode" value="live" />
				<button
					type="submit"
					class="min-h-[44px] w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors sm:w-auto {data.effectiveMode ===
					'live'
						? 'border-amber-600 bg-amber-600 text-white dark:border-amber-500 dark:bg-amber-600'
						: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'}"
				>
					Use live keys
				</button>
			</form>
			{#if data.dbOverride}
				<form method="POST" action="?/clearOverride" use:enhance={() => invalidateAll()}>
					<button
						type="submit"
						class="min-h-[44px] w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] sm:w-auto"
					>
						Clear override (use env)
					</button>
				</form>
			{/if}
		</div>

		<p class="mt-4 text-sm text-amber-800 dark:text-amber-200/90">
			Live mode uses real cards and payouts. Point the Stripe dashboard webhook at this app’s live endpoint and use the
			matching signing secret.
		</p>
	</section>

	<section class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
		<h2 class="text-base font-semibold text-[var(--text)]">Configured credentials (masked)</h2>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			Values come from environment variables. Switching mode only changes which set is used at runtime.
		</p>
		<div class="mt-4 grid gap-4 md:grid-cols-2">
			<div class="rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)]/30 p-4">
				<h3 class="text-sm font-semibold text-[var(--text)]">Test (<code class="text-xs">STRIPE_*_TEST</code>)</h3>
				<ul class="mt-3 space-y-2 text-xs text-[var(--text-muted)]">
					<li><span class="font-medium text-[var(--text)]">Secret key:</span> {data.keysPreview.test.secretKey ?? '—'}</li>
					<li><span class="font-medium text-[var(--text)]">Price ID:</span> {data.keysPreview.test.priceId ?? '—'}</li>
					<li><span class="font-medium text-[var(--text)]">Webhook secret:</span> {data.keysPreview.test.webhookSecret ?? '—'}</li>
				</ul>
			</div>
			<div class="rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)]/30 p-4">
				<h3 class="text-sm font-semibold text-[var(--text)]">Live (<code class="text-xs">STRIPE_*</code>)</h3>
				<ul class="mt-3 space-y-2 text-xs text-[var(--text-muted)]">
					<li><span class="font-medium text-[var(--text)]">Secret key:</span> {data.keysPreview.live.secretKey ?? '—'}</li>
					<li><span class="font-medium text-[var(--text)]">Price ID:</span> {data.keysPreview.live.priceId ?? '—'}</li>
					<li><span class="font-medium text-[var(--text)]">Webhook secret:</span> {data.keysPreview.live.webhookSecret ?? '—'}</li>
				</ul>
			</div>
		</div>
	</section>
</div>
