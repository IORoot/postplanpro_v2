<script lang="ts">
	export type TechnicalShot = { thumb: string; full: string; caption: string };

	let { items = [] }: { items: TechnicalShot[] } = $props();
</script>

{#if items.length > 0}
	<div
		class="technical-shot-grid grid gap-4 {items.length > 4
			? 'sm:grid-cols-2 lg:grid-cols-3'
			: items.length > 1
				? 'sm:grid-cols-2'
				: ''}"
		aria-label="Interface screenshots"
	>
		{#each items as item}
			<a
				href={item.full}
				target="_blank"
				rel="noopener noreferrer"
				class="group block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-sm transition-[border-color,box-shadow] hover:border-[var(--primary-border-soft)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
			>
				<img
					src={item.thumb}
					alt={item.caption}
					loading="lazy"
					decoding="async"
					class="block w-full h-auto object-cover object-top"
				/>
				<div
					class="border-t border-[var(--border)] px-3 py-2.5 text-xs text-[var(--text-muted)] group-hover:text-[var(--text)]"
					style="line-height: 1.45;"
				>
					<span class="font-medium text-[var(--text)]">{item.caption}</span>
					<span class="text-[var(--text-muted)]"> — open full size</span>
				</div>
			</a>
		{/each}
	</div>
{/if}
