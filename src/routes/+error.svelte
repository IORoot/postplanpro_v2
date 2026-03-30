<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Problem loading page – PostPlan</title>
</svelte:head>

<div class="content-card mx-auto max-w-lg rounded-xl p-8 text-center">
	<p class="text-sm font-medium text-[var(--text-muted)]">Error {$page.status}</p>
	<h1 class="mt-2 text-xl font-bold text-[var(--text)]">We couldn’t load this page</h1>
	<p class="mx-auto mt-3 max-w-md overflow-wrap-anywhere text-sm leading-relaxed text-[var(--text-muted)]">
		{$page.error?.message ??
			'Something unexpected happened. Use the buttons below to go back or return to the calendar.'}
	</p>
	<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
		<button
			type="button"
			class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
			onclick={() => history.back()}
		>
			Previous page
		</button>
		<a href="/calendar" class="btn-primary btn-touch text-white">Calendar</a>
	</div>
</div>
