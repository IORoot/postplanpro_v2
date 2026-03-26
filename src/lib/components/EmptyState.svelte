<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Centered empty state: optional title, icon, subtle entrance (respects reduced motion). */
	let {
		title,
		titleId = 'empty-state-title',
		children
	}: {
		title?: string;
		/** Unique when multiple empty states exist on one page (a11y). */
		titleId?: string;
		children: Snippet;
	} = $props();
</script>

<div
	class="empty-state-in content-card rounded-xl border border-dashed border-[var(--primary-border-soft)] bg-[var(--surface)] p-8 text-center md:p-10"
	role="status"
	aria-labelledby={title ? titleId : undefined}
>
	<div
		class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"
		aria-hidden="true"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
		</svg>
	</div>
	{#if title}
		<h2 class="text-base font-semibold tracking-tight text-[var(--text)]" id={titleId}>{title}</h2>
	{/if}
	<div class="type-empty-body mx-auto mt-2 max-w-md text-[var(--text-muted)]">
		{@render children()}
	</div>
</div>
