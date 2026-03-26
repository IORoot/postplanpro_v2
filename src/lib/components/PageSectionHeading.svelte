<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Shared page title + optional lead + optional trailing actions (toolbar). */
	let {
		title,
		description,
		describeBelow = false,
		trail
	}: {
		title: string;
		description?: string;
		describeBelow?: boolean;
		trail?: Snippet;
	} = $props();
</script>

{#if trail}
	{#if describeBelow}
		<div class="mb-6 space-y-1">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 class="page-title">{title}</h1>
				{@render trail()}
			</div>
			{#if description}
				<p class="page-lead">{description}</p>
			{/if}
		</div>
	{:else}
		<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0">
				<h1 class="page-title">{title}</h1>
				{#if description}
					<p class="page-lead">{description}</p>
				{/if}
			</div>
			{@render trail()}
		</div>
	{/if}
{:else if description}
	<div class="mb-6">
		<h1 class="page-title">{title}</h1>
		<p class="page-lead">{description}</p>
	</div>
{:else}
	<h1 class="page-title mb-6">{title}</h1>
{/if}
