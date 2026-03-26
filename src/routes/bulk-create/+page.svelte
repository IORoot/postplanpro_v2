<script lang="ts">
	import WordPressImporter from './importers/WordPressImporter.svelte';
	import SquarespaceImporter from './importers/SquarespaceImporter.svelte';
	import RssImporter from './importers/RssImporter.svelte';
	import CsvImporter from './importers/CsvImporter.svelte';

	let { data, form } = $props();

	let selectedSource = $state<'wordpress' | 'rss' | 'csv' | 'squarespace' | null>(null);

	const showError = $derived(
		Boolean(form?.error) &&
		!(form as { discovered?: boolean })?.discovered &&
		!(form as { fetched?: boolean })?.fetched &&
		!(form as { rss_discovered?: boolean })?.rss_discovered &&
		!(form as { squarespace_discovered?: boolean })?.squarespace_discovered &&
		!(form as { csv_import_id?: string })?.csv_import_id
	);
</script>

<svelte:head>
	<title>Import – PostPlan</title>
</svelte:head>

<h1 class="page-title mb-6">Import</h1>
<p class="page-lead">
	{#if selectedSource === 'wordpress'}
		Import posts from a WordPress site's REST API. Discover post types, map fields, then import.
	{:else if selectedSource === 'squarespace'}
		Import posts from a Squarespace blog. Enter the blog page URL; we request JSON using <code class="rounded bg-[var(--surface)] px-1">?format=json-pretty</code>, then map fields and import.
	{:else if selectedSource === 'rss'}
		Import posts from an RSS or Atom feed. Enter the feed URL, then map fields and import.
	{:else if selectedSource === 'csv'}
		Import posts from a CSV file. Upload a file, set delimiter and headers, then map columns and import.
	{:else}
		Choose a source to import content from.
	{/if}
</p>

{#if showError}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form?.error}</p>
{/if}

<!-- Step 0: Choose source (only when none selected) -->
{#if selectedSource === null}
	<section class="mt-8">
		<h2 class="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">Choose source</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Select where to import posts from.</p>

		<!-- CMS -->
		<h3 class="mt-8 text-sm font-medium text-[var(--text-muted)]">CMS</h3>
		<div class="mt-3 flex flex-wrap gap-4">
			<button
				type="button"
				onclick={() => (selectedSource = 'wordpress')}
				class="importer-card"
			>
				<svg role="img" viewBox="0 0 24 24" class="w-20 h-20" xmlns="http://www.w3.org/2000/svg"><title>WordPress</title><path fill="#21759B" d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/></svg>
				<span class="font-semibold text-[var(--text)]">WordPress</span>
				<span class="text-center text-xs text-[var(--text-muted)]">Import from a WordPress site REST API</span>
			</button>
			<button
				type="button"
				onclick={() => (selectedSource = 'squarespace')}
				class="importer-card"
			>
				<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 text-black" fill="currentColor" aria-hidden="true"><title>Squarespace</title><path d="M22.655 8.719c-1.802-1.801-4.726-1.801-6.564 0l-7.351 7.35c-.45.45-.45 1.2 0 1.65.45.449 1.2.449 1.65 0l7.351-7.351c.899-.899 2.362-.899 3.264 0 .9.9.9 2.364 0 3.264l-7.239 7.239c.9.899 2.362.899 3.263 0l5.589-5.589c1.836-1.838 1.836-4.763.037-6.563zm-2.475 2.437c-.451-.45-1.201-.45-1.65 0l-7.354 7.389c-.9.899-2.361.899-3.262 0-.45-.45-1.2-.45-1.65 0s-.45 1.2 0 1.649c1.801 1.801 4.726 1.801 6.564 0l7.351-7.35c.449-.487.449-1.239.001-1.688zm-2.439-7.35c-1.801-1.801-4.726-1.801-6.564 0l-7.351 7.351c-.45.449-.45 1.199 0 1.649s1.2.45 1.65 0l7.395-7.351c.9-.899 2.371-.899 3.27 0 .451.45 1.201.45 1.65 0 .421-.487.421-1.199-.029-1.649h-.021zm-2.475 2.437c-.45-.45-1.2-.45-1.65 0l-7.351 7.389c-.899.9-2.363.9-3.265 0-.9-.899-.9-2.363 0-3.264l7.239-7.239c-.9-.9-2.362-.9-3.263 0L1.35 8.719c-1.8 1.8-1.8 4.725 0 6.563 1.801 1.801 4.725 1.801 6.564 0l7.35-7.351c.451-.488.451-1.238 0-1.688h.002z"/></svg>
				<span class="font-semibold text-[var(--text)]">Squarespace</span>
				<span class="text-center text-xs text-[var(--text-muted)]">Import from a Squarespace blog (JSON)</span>
			</button>
		</div>

		<!-- Spreadsheets -->
		<h3 class="mt-8 text-sm font-medium text-[var(--text-muted)]">Spreadsheets</h3>
		<div class="mt-3 flex flex-wrap gap-4">
			<button
				type="button"
				onclick={() => (selectedSource = 'csv')}
				class="importer-card"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
					<path d="M9 4v16"></path>
					<path d="M3 10h18"></path>
				</svg>
				<span class="font-semibold text-[var(--text)]">CSV file</span>
				<span class="text-center text-xs text-[var(--text-muted)]">Upload and map columns from a CSV</span>
			</button>
		</div>

		<!-- Feeds -->
		<h3 class="mt-8 text-sm font-medium text-[var(--text-muted)]">Feeds</h3>
		<div class="mt-3 flex flex-wrap gap-4">
			<button
				type="button"
				onclick={() => (selectedSource = 'rss')}
				class="importer-card"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.14 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/></svg>
				<span class="font-semibold text-[var(--text)]">RSS Feed</span>
				<span class="text-center text-xs text-[var(--text-muted)]">Import from an RSS or Atom feed</span>
			</button>
		</div>
	</section>
{:else}
	<div class="mt-6">
		<button
			type="button"
			onclick={() => (selectedSource = null)}
			class="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
		>
			← Change source
		</button>
	</div>
{/if}

{#if selectedSource === 'wordpress'}
	<WordPressImporter data={data} form={form} />
{:else if selectedSource === 'squarespace'}
	<SquarespaceImporter data={data} form={form} />
{:else if selectedSource === 'rss'}
	<RssImporter data={data} form={form} />
{:else if selectedSource === 'csv'}
	<CsvImporter data={data} form={form} />
{/if}

<style>
	/* Global so importer components can use these classes */
	:global(.bulk-create-spinner) {
		display: inline-block;
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: bulk-create-spin 0.6s linear infinite;
		vertical-align: -0.2em;
	}
	@keyframes bulk-create-spin {
		to { transform: rotate(360deg); }
	}
	:global(.bulk-create-step-pill) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-muted);
	}
	:global(.bulk-create-step-pill.active) {
		background: var(--primary);
		border-color: var(--primary);
		color: white;
	}
	:global(.bulk-create-step-pill.done) {
		background: var(--surface);
		border-color: var(--border);
		color: var(--text);
	}
	@media (min-width: 1024px) {
		:global(.bulk-create-step3-grid) {
			display: grid;
			grid-template-columns: 1fr minmax(420px, 520px);
			gap: 2rem;
			align-items: start;
		}
		:global(.bulk-create-step3-sidebar) {
			position: sticky;
			top: 1.5rem;
		}
	}
	.importer-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		min-height: 140px;
		min-width: 200px;
		padding: 1.5rem 2rem;
		border-radius: 0.75rem;
		border: 2px solid var(--border);
		background: var(--surface);
		color: var(--text);
		transition: border-color 0.15s, background 0.15s;
		cursor: pointer;
	}
	.importer-card:hover {
		border-color: var(--primary);
		background: var(--surface-hover);
	}
	.importer-card:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--primary);
	}
</style>
