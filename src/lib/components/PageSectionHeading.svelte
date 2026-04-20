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
		<div class="mb-6 min-w-0 max-w-full space-y-1">
			<div class="flex min-w-0 max-w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 class="page-title min-w-0 break-words">{title}</h1>
				<div class="min-w-0 w-full max-w-full sm:w-auto sm:max-w-[min(100%,24rem)]">
					{@render trail()}
				</div>
			</div>
			{#if description}
				<p class="page-lead">{description}</p>
			{/if}
		</div>
	{:else}
		<div class="mb-6 flex min-w-0 max-w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0 flex-1">
				<h1 class="page-title break-words">{title}</h1>
				{#if description}
					<p class="page-lead">{description}</p>
				{/if}
			</div>
			<div class="min-w-0 w-full max-w-full sm:w-auto sm:max-w-[min(100%,24rem)]">
				{@render trail()}
			</div>
		</div>
	{/if}
{:else if description}
	<div class="mb-6 min-w-0 max-w-full">
		<h1 class="page-title break-words">{title}</h1>
		<p class="page-lead">{description}</p>
	</div>
{:else}
	<h1 class="page-title mb-6 min-w-0 max-w-full break-words">{title}</h1>
{/if}
