<script lang="ts">
	import SampleJsonViewer from './SampleJsonViewer.svelte';

	interface Props {
		data: unknown;
		pathPrefix?: string;
		onCopied?: () => void;
	}
	let { data, pathPrefix = '', onCopied }: Props = $props();

	async function copyPath(path: string) {
		try {
			await navigator.clipboard.writeText(path);
			onCopied?.();
		} catch {
			// ignore
		}
	}

	function pathForKey(key: string): string {
		return pathPrefix ? `${pathPrefix}.${key}` : key;
	}
	function pathForIndex(i: number): string {
		return `${pathPrefix}[${i}]`;
	}
</script>

{#if data === null}
	<span class="text-neutral-400">null</span>
{:else if typeof data === 'boolean'}
	<span class="text-orange-300">{data ? 'true' : 'false'}</span>
{:else if typeof data === 'number'}
	<span class="text-amber-300">{data}</span>
{:else if typeof data === 'string'}
	<span class="text-green-300">{JSON.stringify(data)}</span>
{:else if Array.isArray(data)}
	<span class="text-neutral-400">[</span>
	{#if data.length === 0}
		<span class="text-neutral-400">]</span>
	{:else}
		<div class="pl-4">
			{#each data as value, i}
				<div class="flex flex-wrap items-baseline gap-1">
					<button
						type="button"
						class="rounded bg-neutral-50/15 px-1.5 py-0.5 font-mono text-xs text-neutral-50 cursor-pointer hover:bg-neutral-50/25 focus:outline-none focus:ring-1 focus:ring-neutral-50/50"
						onclick={() => copyPath(pathForIndex(i))}
						title="Copy path: {pathForIndex(i)}"
					>
						[{i}]
					</button>
					<span class="text-neutral-400">:</span>
					<SampleJsonViewer data={value} pathPrefix={pathForIndex(i)} {onCopied} />
					{#if i < data.length - 1}
						<span class="text-neutral-400">,</span>
					{/if}
				</div>
			{/each}
		</div>
		<span class="text-neutral-400">]</span>
	{/if}
{:else if typeof data === 'object' && data !== null}
	<span class="text-neutral-400">{'{'}</span>
	{@const entries = Object.entries(data as Record<string, unknown>)}
	{#if entries.length === 0}
		<span class="text-neutral-400">{'}'}</span>
	{:else}
		<div class="pl-4">
			{#each entries as [key, value], i}
				<div class="flex flex-wrap items-baseline gap-1">
					<button
						type="button"
						class="rounded bg-neutral-50/15 px-1.5 py-0.5 font-mono text-xs text-neutral-50 cursor-pointer hover:bg-neutral-50/25 focus:outline-none focus:ring-1 focus:ring-neutral-50/50"
						onclick={() => copyPath(pathForKey(key))}
						title="Copy path: {pathForKey(key)}"
					>
						{key}
					</button>
					<span class="text-neutral-400">:</span>
					<SampleJsonViewer data={value} pathPrefix={pathForKey(key)} {onCopied} />
					{#if i < entries.length - 1}
						<span class="text-neutral-400">,</span>
					{/if}
				</div>
			{/each}
		</div>
		<span class="text-neutral-400">{'}'}</span>
	{/if}
{:else}
	<span class="text-neutral-400">{String(data)}</span>
{/if}
