<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import WordPressImporter from './importers/WordPressImporter.svelte';
	import SquarespaceImporter from './importers/SquarespaceImporter.svelte';
	import RssImporter from './importers/RssImporter.svelte';
	import CsvImporter from './importers/CsvImporter.svelte';
	import InboundAuthTokenCard from '$lib/components/InboundAuthTokenCard.svelte';
	import { syncDiagramDefaultWithViewport } from '$lib/syncDiagramDefaultWithViewport.js';
	import { showInputAnimations } from '$lib/stores/uiPrefs.js';

	let { data, form } = $props();

	const section = $derived(
		(data.section as 'cms' | 'spreadsheets' | 'feeds' | 'callbacks' | undefined) ?? 'cms'
	);

	let selectedSource = $state<'wordpress' | 'rss' | 'csv' | 'squarespace' | null>(null);
	let lastSection = $state<string | null>(null);

	$effect(() => {
		const s = section;
		if (lastSection !== null && lastSection !== s) selectedSource = null;
		lastSection = s;
	});

	let postNotificationExampleTab = $state<'json' | 'curl'>('json');
	let showAnimImportCms = $state(false);
	let showAnimImportSpreadsheets = $state(false);
	let showAnimImportFeeds = $state(false);
	let showAnimImportCallbacks = $state(false);

	syncDiagramDefaultWithViewport((open) => {
		showAnimImportCms = open;
		showAnimImportSpreadsheets = open;
		showAnimImportFeeds = open;
		showAnimImportCallbacks = open;
	});

	const inputDiagramIframe = $derived.by(() => {
		switch (section) {
			case 'cms':
				return {
					src: '/animation_import_cms.html',
					title: 'Animated diagram: CMS import flow'
				};
			case 'spreadsheets':
				return {
					src: '/animation_import_spreadsheets.html',
					title: 'Animated diagram: Spreadsheet import flow'
				};
			case 'feeds':
				return {
					src: '/animation_import_feeds.html',
					title: 'Animated diagram: RSS/Atom feed import flow'
				};
			default:
				return null;
		}
	});

	const showCurrentImportSectionDiagram = $derived.by(() => {
		switch (section) {
			case 'cms':
				return showAnimImportCms;
			case 'spreadsheets':
				return showAnimImportSpreadsheets;
			case 'feeds':
				return showAnimImportFeeds;
			default:
				return true;
		}
	});

	function toggleCurrentImportSectionDiagram() {
		switch (section) {
			case 'cms':
				showAnimImportCms = !showAnimImportCms;
				break;
			case 'spreadsheets':
				showAnimImportSpreadsheets = !showAnimImportSpreadsheets;
				break;
			case 'feeds':
				showAnimImportFeeds = !showAnimImportFeeds;
				break;
		}
	}

	const showError = $derived(
		section !== 'callbacks' &&
			Boolean(form?.error) &&
			!(form as { discovered?: boolean })?.discovered &&
			!(form as { fetched?: boolean })?.fetched &&
			!(form as { rss_discovered?: boolean })?.rss_discovered &&
			!(form as { squarespace_discovered?: boolean })?.squarespace_discovered &&
			!(form as { csv_import_id?: string })?.csv_import_id
	);

	const pageHeadingTitle = $derived.by(() => {
		switch (section) {
			case 'callbacks':
				return 'Callbacks';
			case 'spreadsheets':
				return 'Spreadsheets';
			case 'feeds':
				return 'Feeds';
			case 'cms':
			default:
				return 'CMS';
		}
	});

	const pageHeadingDescription = $derived.by(() => {
		switch (section) {
			case 'callbacks':
				return 'Post notification webhooks: tell PostPlan when a sent post reaches a stage in Make.com (or similar).';
			case 'spreadsheets':
				return 'Import posts from CSV files. Upload a spreadsheet, set delimiter and headers, map columns to PostPlan fields, and create posts in bulk.';
			case 'feeds':
				return 'Import posts from RSS or Atom feeds. Add a feed URL, map entries to your post model, and pull items into PostPlan.';
			case 'cms':
			default:
				return 'Import posts from WordPress, Squarespace, or other CMS sources. Connect your site, discover content, map fields, and import into PostPlan.';
		}
	});
</script>

<svelte:head>
	<title>{pageHeadingTitle} – Inputs – PostPlan</title>
</svelte:head>

<PageSectionHeading title={pageHeadingTitle} description={pageHeadingDescription} />

{#if section === 'cms' || section === 'spreadsheets' || section === 'feeds'}
	<nav class="inputs-sources-subnav mt-4 flex flex-wrap gap-2 border-b border-[var(--border)] pb-3" aria-label="Source type">
		<a href="/inputs?section=cms" class="settings-nav-link {section === 'cms' ? 'settings-nav-link-active' : ''}">CMS</a>
		<a href="/inputs?section=spreadsheets" class="settings-nav-link {section === 'spreadsheets' ? 'settings-nav-link-active' : ''}">Spreadsheets</a>
		<a href="/inputs?section=feeds" class="settings-nav-link {section === 'feeds' ? 'settings-nav-link-active' : ''}">Feeds</a>
	</nav>
{/if}

{#if section === 'callbacks'}
			<section class="mt-8" id="inputs-callbacks">
			{#if $showInputAnimations}
				<div class="mt-6">
					<div class="flex justify-end">
						<button
							type="button"
							onclick={() => (showAnimImportCallbacks = !showAnimImportCallbacks)}
							class="text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
						>
							{showAnimImportCallbacks ? 'Hide' : 'Show'} diagram
						</button>
					</div>
					{#if showAnimImportCallbacks}
						<div class="mt-2 overflow-hidden rounded-lg border border-[var(--border)] bg-black shadow-sm">
							<iframe
								title="Animated diagram: post notification callback loop"
								class="block h-[520px] w-full border-0"
								src="/animation_import_callbacks.html"
								loading="eager"
							></iframe>
						</div>
					{/if}
				</div>
			{/if}

				<InboundAuthTokenCard callbackTokenMasked={data.callbackTokenMasked} {form}>
					{#snippet help()}
						<p class="mt-0">
							Same token as the <strong>import webhook</strong> under
							<a href="/inputs/webhooks" class="font-medium text-[var(--primary)] hover:underline">Webhooks</a> in the Inputs sidebar.
						</p>
						<p class="mt-2">Send in requests as:</p>
						<ul class="mt-1 list-inside list-disc space-y-0.5">
							<li><code class="rounded bg-[var(--bg)] px-1 text-xs">X-API-KEY: &lt;token&gt;</code></li>
						</ul>
					{/snippet}
				</InboundAuthTokenCard>

				<div class="mt-10 border-t border-[var(--border)] pt-8">
					<h3 class="text-base font-medium text-[var(--text)]">Post notification callbacks</h3>
					<div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
						<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
							<p class="mb-2 text-xs font-medium text-[var(--text-muted)]">Callback URL</p>
							{#if data.callbackUrl}
								<div class="flex flex-wrap items-center gap-2">
									<code class="min-w-0 flex-1 break-all rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
										>{data.callbackUrl}</code
									>
									<button
										type="button"
										onclick={() => navigator.clipboard.writeText(data.callbackUrl ?? '').then(() => alert('Copied to clipboard'))}
										class="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
									>
										Copy
									</button>
								</div>
							{:else}
								<p class="text-xs text-[var(--text-muted)]">Set <code>APP_BASE_URL</code> in your environment to see the callback URL.</p>
							{/if}
							<p class="mt-2 text-xs text-[var(--text-muted)]">
								Use the webhook token from the section above when calling this URL from Make.com.
							</p>
						</div>
						<div class="text-sm text-[var(--text-muted)]">
							<p class="mt-0">
								When a post is sent to Make.com/N8N/Zapier, your scenario can notify PostPlan that the post reached a certain step (e.g.
								published to Instagram). PostPlan records these stages on the post edit page.
							</p>
							<p class="mt-3 font-medium text-[var(--text)]">How to use in Make.com</p>
							<ol class="mt-2 list-inside list-decimal space-y-2 text-xs">
								<li>
									PostPlan sends <code class="rounded bg-[var(--bg)] px-1">callback_url</code>,
									<code class="rounded bg-[var(--bg)] px-1">callback_token</code>, and <code class="rounded bg-[var(--bg)] px-1">id</code> in the
									webhook payload.
								</li>
								<li>After your scenario runs (e.g. publishes the post), add <strong>HTTP – Make a request</strong>.</li>
								<li>URL: the <code class="rounded bg-[var(--bg)] px-1">callback_url</code> from the payload (or copy from the left).</li>
								<li>
									Method: <code class="rounded bg-[var(--bg)] px-1">POST</code>. Header:
									<code class="rounded bg-[var(--bg)] px-1">X-API-KEY: {'{{callback_token}}'}</code>.
								</li>
								<li>
									Body (raw JSON): use <code class="rounded bg-[var(--bg)] px-1">post_id</code> (webhook
									<code class="rounded bg-[var(--bg)] px-1">id</code>) and any <code class="rounded bg-[var(--bg)] px-1">stage</code> label.
								</li>
								<li>Completed stages appear on the post edit page under Make.com stages.</li>
							</ol>
							<p class="mt-3 font-medium text-[var(--text)]">Example request</p>
							<div class="mt-2 flex gap-1 border-b border-[var(--border)]">
								<button
									type="button"
									class="min-h-[44px] rounded-t border border-[var(--border)] border-b-0 px-3 py-1.5 text-xs font-medium {postNotificationExampleTab ===
									'json'
										? 'bg-[var(--surface)] text-[var(--text)]'
										: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}"
									onclick={() => (postNotificationExampleTab = 'json')}>JSON</button
								>
								<button
									type="button"
									class="min-h-[44px] rounded-t border border-[var(--border)] border-b-0 px-3 py-1.5 text-xs font-medium {postNotificationExampleTab ===
									'curl'
										? 'bg-[var(--surface)] text-[var(--text)]'
										: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}"
									onclick={() => (postNotificationExampleTab = 'curl')}>curl</button
								>
							</div>
							{#if postNotificationExampleTab === 'json'}
								<div class="relative">
									<button
										type="button"
										class="absolute right-2 top-2 min-h-[44px] min-w-[44px] rounded border border-neutral-50/30 bg-neutral-950/80 px-2 py-1 text-xs text-neutral-50 hover:bg-neutral-50/10"
										onclick={(e) => {
											const code = (e.currentTarget as HTMLButtonElement).parentElement?.querySelector('pre code');
											if (code) navigator.clipboard.writeText(code.textContent ?? '').then(() => alert('Copied to clipboard'));
										}}>Copy</button
									>
									<pre
										class="overflow-x-auto rounded rounded-t-none border border-[var(--border)] bg-neutral-950 p-3 pr-16 text-xs text-neutral-50"><code
											>{`{
  "post_id": "uuid-of-the-post",
  "stage": "instagram_published"
}`}</code
										></pre>
								</div>
							{:else}
								<div class="relative">
									<button
										type="button"
										class="absolute right-2 top-2 min-h-[44px] min-w-[44px] rounded border border-neutral-50/30 bg-neutral-950/80 px-2 py-1 text-xs text-neutral-50 hover:bg-neutral-50/10"
										onclick={(e) => {
											const code = (e.currentTarget as HTMLButtonElement).parentElement?.querySelector('pre code');
											if (code) navigator.clipboard.writeText(code.textContent ?? '').then(() => alert('Copied to clipboard'));
										}}>Copy</button
									>
									<pre
										class="overflow-x-auto rounded rounded-t-none border border-[var(--border)] bg-neutral-950 p-3 pr-16 text-xs text-neutral-50"><code
											>{`curl -X POST "${data.callbackUrl ?? 'https://your-app.com/api/callbacks/stage'}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: YOUR_CALLBACK_TOKEN" \\
  -d '{"post_id":"uuid-of-the-post","stage":"instagram_published"}'`}</code
										></pre>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</section>
	{:else}
	{#if $showInputAnimations && selectedSource === null && inputDiagramIframe}
		<div class="mt-4">
			<div class="flex justify-end">
				<button
					type="button"
					onclick={toggleCurrentImportSectionDiagram}
					class="text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
				>
					{showCurrentImportSectionDiagram ? 'Hide' : 'Show'} diagram
				</button>
			</div>
			{#if showCurrentImportSectionDiagram}
				<div class="mt-2 overflow-hidden rounded-lg border border-[var(--border)] bg-black shadow-sm">
					<iframe
						title={inputDiagramIframe.title}
						class="block h-[520px] w-full border-0"
						src={inputDiagramIframe.src}
						loading="eager"
					></iframe>
				</div>
			{/if}
		</div>
	{/if}

		<p class="page-lead">
				{#if selectedSource === 'wordpress'}
					Import posts from a WordPress site's REST API. Discover post types, map fields, then import.
				{:else if selectedSource === 'squarespace'}
					Import posts from a Squarespace blog. Enter the blog page URL; we request JSON using
					<code class="rounded bg-[var(--surface)] px-1">?format=json-pretty</code>, then map fields and import.
				{:else if selectedSource === 'rss'}
					Import posts from an RSS or Atom feed. Enter the feed URL, then map fields and import.
				{:else if selectedSource === 'csv'}
					Import posts from a CSV file. Upload a file, set delimiter and headers, then map columns and import.
				{:else if section === 'cms'}
					Choose a CMS to import content from.
				{:else if section === 'spreadsheets'}
					Import from a spreadsheet file.
				{:else if section === 'feeds'}
					Import from a syndication feed.
				{/if}
			</p>

			{#if showError}
				<p class="alert-error mt-4 rounded-lg px-3 py-2 text-sm">{form?.error}</p>
			{/if}

			{#if selectedSource === null}
				<section class="mt-8">
					<h2 class="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">Choose source</h2>
					<p class="mt-1 text-sm text-[var(--text-muted)]">Select where to import posts from.</p>

					{#if section === 'cms'}
						<div class="mt-6 flex flex-wrap gap-4">
							<button type="button" onclick={() => (selectedSource = 'wordpress')} class="importer-card">
								<svg role="img" viewBox="0 0 24 24" class="h-20 w-20" xmlns="http://www.w3.org/2000/svg"
									><title>WordPress</title><path
										fill="#21759B"
										d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"
									/></svg
								>
								<span class="font-semibold text-[var(--text)]">WordPress</span>
								<span class="text-center text-xs text-[var(--text-muted)]">Import from a WordPress site REST API</span>
							</button>
							<button type="button" onclick={() => (selectedSource = 'squarespace')} class="importer-card">
								<svg
									role="img"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
									class="h-20 w-20 text-neutral-950"
									fill="currentColor"
									aria-hidden="true"
									><title>Squarespace</title><path
										d="M22.655 8.719c-1.802-1.801-4.726-1.801-6.564 0l-7.351 7.35c-.45.45-.45 1.2 0 1.65.45.449 1.2.449 1.65 0l7.351-7.351c.899-.899 2.362-.899 3.264 0 .9.9.9 2.364 0 3.264l-7.239 7.239c.9.899 2.362.899 3.263 0l5.589-5.589c1.836-1.838 1.836-4.763.037-6.563zm-2.475 2.437c-.451-.45-1.201-.45-1.65 0l-7.354 7.389c-.9.899-2.361.899-3.262 0-.45-.45-1.2-.45-1.65 0s-.45 1.2 0 1.649c1.801 1.801 4.726 1.801 6.564 0l7.351-7.35c.449-.487.449-1.239.001-1.688zm-2.439-7.35c-1.801-1.801-4.726-1.801-6.564 0l-7.351 7.351c-.45.449-.45 1.199 0 1.649s1.2.45 1.65 0l7.395-7.351c.9-.899 2.371-.899 3.27 0 .451.45 1.201.45 1.65 0 .421-.487.421-1.199-.029-1.649h-.021zm-2.475 2.437c-.45-.45-1.2-.45-1.65 0l-7.351 7.389c-.899.9-2.363.9-3.265 0-.9-.899-.9-2.363 0-3.264l7.239-7.239c-.9-.9-2.362-.9-3.263 0L1.35 8.719c-1.8 1.8-1.8 4.725 0 6.563 1.801 1.801 4.725 1.801 6.564 0l7.35-7.351c.451-.488.451-1.238 0-1.688h.002z"
									/></svg
								>
								<span class="font-semibold text-[var(--text)]">Squarespace</span>
								<span class="text-center text-xs text-[var(--text-muted)]">Import from a Squarespace blog (JSON)</span>
							</button>
						</div>
					{:else if section === 'spreadsheets'}
						<div class="mt-6 flex flex-wrap gap-4">
							<button type="button" onclick={() => (selectedSource = 'csv')} class="importer-card">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-20 w-20 text-[var(--text-muted)]"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
									<path d="M9 4v16"></path>
									<path d="M3 10h18"></path>
								</svg>
								<span class="font-semibold text-[var(--text)]">CSV file</span>
								<span class="text-center text-xs text-[var(--text-muted)]">Upload and map columns from a CSV</span>
							</button>
						</div>
					{:else if section === 'feeds'}
						<div class="mt-6 flex flex-wrap gap-4">
							<button type="button" onclick={() => (selectedSource = 'rss')} class="importer-card">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-20 w-20 text-[var(--text-muted)]"
									fill="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
									><path
										d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.14 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"
									/></svg
								>
								<span class="font-semibold text-[var(--text)]">RSS Feed</span>
								<span class="text-center text-xs text-[var(--text-muted)]">Import from an RSS or Atom feed</span>
							</button>
						</div>
					{/if}
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
		{/if}

<style>
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
		to {
			transform: rotate(360deg);
		}
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
	/* Muted panel for import filter steps (shared across importers) */
	:global(.importer-panel-filters) {
		border-radius: 0.75rem;
		border: 1px solid var(--border);
		background: rgb(245 245 245);
		padding: 1.25rem;
	}
	:global(.dark .importer-panel-filters) {
		background: rgb(23 23 23 / 0.35);
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
		transition:
			border-color 0.15s,
			background 0.15s;
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
