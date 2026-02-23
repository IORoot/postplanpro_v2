<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	type PostTypeOption = { slug: string; name: string; route: string };

	let siteUrl = $state('');
	let auth = $state('');
	let perPage = $state(10);
	let importStart = $state(1);
	let titlePath = $state('title.rendered');
	let contentPath = $state('content.rendered');
	let titleUnescapeNewlines = $state(true);
	let contentUnescapeNewlines = $state(true);
	let customMappings = $state<{ path: string; key: string; type: string; unescapeNewlines?: boolean }[]>([]);
	let filterCombine = $state<'and' | 'or'>('and');
	let filterRules = $state<{ path: string; operator: string; value: string }[]>([]);
	let webhookId = $state('');
	let scheduleId = $state('');
	let importStatus = $state<'draft' | 'scheduled'>('draft');
	let skipDuplicates = $state(false);
	let selectedPostTypeRoute = $state('');
	let selectedSource = $state<'wordpress' | null>(null);
	let submittingDiscover = $state(false);
	let submittingFetch = $state(false);
	let submittingImport = $state(false);

	// Post types from discover action (reactive to form)
	const discovered = $derived(Boolean((form as { discovered?: boolean })?.discovered));
	const postTypes = $derived(
		(form as { post_types?: PostTypeOption[] })?.post_types ?? []
	);

	// Sync URL/auth/post type from discover or fetch result; default selected post type when discovered
	$effect(() => {
		const f = form as { site_url?: string; auth?: string; post_type_route?: string } | undefined;
		if (f?.site_url != null) siteUrl = f.site_url;
		if (f?.auth != null) auth = f.auth;
		if (f?.post_type_route != null) selectedPostTypeRoute = f.post_type_route;
		if (discovered && postTypes.length > 0 && !selectedPostTypeRoute) selectedPostTypeRoute = postTypes[0].route;
	});

	function addCustomMapping() {
		customMappings = [...customMappings, { path: '', key: '', type: 'string', unescapeNewlines: false }];
	}
	const FILTER_OPERATORS = [
		{ value: 'eq', label: 'equals', needsValue: true },
		{ value: 'neq', label: 'does not equal', needsValue: true },
		{ value: 'contains', label: 'contains', needsValue: true },
		{ value: 'not_contains', label: 'does not contain', needsValue: true },
		{ value: 'regex', label: 'matches regex', needsValue: true },
		{ value: 'not_regex', label: 'does not match regex', needsValue: true },
		{ value: 'array_contains', label: 'array contains', needsValue: true },
		{ value: 'array_not_contains', label: 'array does not contain', needsValue: true },
		{ value: 'null', label: 'is null', needsValue: false },
		{ value: 'not_null', label: 'is not null', needsValue: false },
		{ value: 'empty', label: 'is empty', needsValue: false },
		{ value: 'not_empty', label: 'is not empty', needsValue: false },
		{ value: 'exists', label: 'exists', needsValue: false },
		{ value: 'not_exists', label: 'does not exist', needsValue: false }
	] as const;
	function addFilterRule() {
		filterRules = [...filterRules, { path: '', operator: 'eq', value: '' }];
	}
	function removeFilterRule(i: number) {
		filterRules = filterRules.filter((_, idx) => idx !== i);
	}
	function filterRulesJson() {
		return JSON.stringify({
			combine: filterCombine,
			rules: filterRules.filter((r) => r.path.trim()).map((r) => ({ path: r.path.trim(), operator: r.operator, value: r.value?.trim() ?? '' }))
		});
	}
	function removeCustomMapping(i: number) {
		customMappings = customMappings.filter((_, idx) => idx !== i);
	}
	function customMappingJson() {
		return JSON.stringify(
			customMappings.filter((m) => m.path.trim() && m.key.trim()).map((m) => ({
				path: m.path,
				key: m.key,
				type: m.type,
				unescapeNewlines: Boolean(m.unescapeNewlines)
			}))
		);
	}

	function sampleKeys(sample: unknown): string[] {
		if (sample == null || typeof sample !== 'object') return [];
		const keys: string[] = [];
		function walk(obj: unknown, prefix: string) {
			if (obj == null) return;
			if (Array.isArray(obj)) {
				obj.slice(0, 2).forEach((item, i) => walk(item, `${prefix}[${i}]`));
				return;
			}
			if (typeof obj === 'object') {
				for (const [k, v] of Object.entries(obj)) {
					const path = prefix ? `${prefix}.${k}` : k;
					keys.push(path);
					if (typeof v === 'object' && v !== null && !Array.isArray(v)) walk(v, path);
				}
			}
		}
		walk(sample, '');
		return keys;
	}

	/** Build a copy of the sample with long strings truncated for readable preview (import uses full data) */
	const MAX_STRING_LENGTH = 400;
	function sampleForPreview(obj: unknown): unknown {
		if (obj == null) return obj;
		if (typeof obj === 'string') {
			return obj.length <= MAX_STRING_LENGTH ? obj : obj.slice(0, MAX_STRING_LENGTH) + '… [truncated]';
		}
		if (Array.isArray(obj)) {
			return obj.slice(0, 5).map(sampleForPreview);
		}
		if (typeof obj === 'object') {
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(obj)) {
				out[k] = sampleForPreview(v);
			}
			return out;
		}
		return obj;
	}

	const fetched = $derived(Boolean((form as { fetched?: boolean })?.fetched));
	const sample = $derived((form as { sample?: unknown })?.sample ?? null);
	const keys = $derived(sample ? sampleKeys(sample) : []);
	const samplePreviewJson = $derived(
		sample != null ? JSON.stringify(sampleForPreview(sample), null, 2) : ''
	);
	const postTypeRouteForImport = $derived(
		fetched
			? ((form as { post_type_route?: string }).post_type_route || selectedPostTypeRoute || '/wp/v2/posts')
			: '/wp/v2/posts'
	);
</script>

<style>
	@keyframes bulk-create-spin {
		to { transform: rotate(360deg); }
	}
	.bulk-create-spinner {
		display: inline-block;
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: bulk-create-spin 0.6s linear infinite;
		vertical-align: -0.2em;
	}
	.bulk-create-step-pill {
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
	.bulk-create-step-pill.active {
		background: var(--primary);
		border-color: var(--primary);
		color: white;
	}
	.bulk-create-step-pill.done {
		background: var(--surface);
		border-color: var(--border);
		color: var(--text);
	}
	@media (min-width: 1024px) {
		.bulk-create-step3-grid {
			display: grid;
			grid-template-columns: 1fr minmax(420px, 520px);
			gap: 2rem;
			align-items: start;
		}
		.bulk-create-step3-sidebar {
			position: sticky;
			top: 1.5rem;
		}
	}
</style>

<svelte:head>
	<title>Bulk create – PostPlan</title>
</svelte:head>

<h1 class="text-2xl font-bold text-[var(--text)]">Bulk create</h1>
<p class="mt-1 text-sm text-[var(--text-muted)]">
	{#if selectedSource === 'wordpress'}
		Import posts from a WordPress site’s REST API. Discover post types, map fields, then import.
	{:else}
		Choose a source to import content from. More options coming soon.
	{/if}
</p>

{#if form?.error && !form?.discovered && !form?.fetched}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form?.error}</p>
{/if}

<!-- Step 0: Choose source (only when none selected) -->
{#if selectedSource === null}
	<section class="mt-8">
		<h2 class="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">Choose source</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Select where to import posts from.</p>
		<div class="mt-6 flex flex-wrap gap-4">
			<button
				type="button"
				onclick={() => (selectedSource = 'wordpress')}
				class="flex min-h-[140px] min-w-[200px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] px-8 py-6 text-[var(--text)] transition hover:border-[var(--primary)] hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
			>
				<!-- WordPress logo SVG (W mark) -->
				<svg role="img" viewBox="0 0 24 24" class="w-20 h-20" xmlns="http://www.w3.org/2000/svg"><title>WordPress</title><path fill="#21759B" d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/></svg>
				<span class="font-semibold text-[var(--text)]">WordPress</span>
				<span class="text-center text-xs text-[var(--text-muted)]">Import from a WordPress site REST API</span>
			</button>
		</div>
	</section>
{/if}

<!-- Step 1: Connect and discover (WordPress) -->
{#if selectedSource === 'wordpress'}
<section class="mt-8">
	<div class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
		<span class="bulk-create-step-pill active">1</span>
		<span>Connect and discover post types</span>
	</div>
	<h2 class="mt-4 text-lg font-medium text-[var(--text)]">1. Connect and discover post types</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Enter your WordPress site URL (or its <code class="rounded bg-[var(--surface)] px-1 py-0.5 text-xs">/wp-json</code> URL). The app will analyse the API to list available post types.</p>
	<form
		method="POST"
		action="?/discoverWordPress"
		use:enhance={() => {
			submittingDiscover = true;
			return async ({ update }) => {
				await update();
				submittingDiscover = false;
			};
		}}
		class="mt-4 max-w-2xl space-y-4"
	>
		<div>
			<label for="site_url" class="block text-sm font-medium text-[var(--text)]">WordPress site URL *</label>
			<input
				id="site_url"
				type="url"
				name="site_url"
				bind:value={siteUrl}
				required
				placeholder="https://yoursite.com or https://yoursite.com/wp-json"
				class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
			/>
		</div>
		<div>
			<label for="auth_discover" class="block text-sm font-medium text-[var(--text)]">Authorization (optional)</label>
			<input
				id="auth_discover"
				type="password"
				name="auth"
				bind:value={auth}
				placeholder="Application password or Bearer token"
				autocomplete="off"
				class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
			/>
		</div>
		<button type="submit" disabled={submittingDiscover} class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-70 disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
			{#if submittingDiscover}
				<span class="bulk-create-spinner" aria-hidden="true"></span>
				<span>Discovering…</span>
			{:else}
				Discover post types
			{/if}
		</button>
	</form>
</section>

<!-- Step 2: Discover post type structure (one sample only) -->
{#if discovered && postTypes.length > 0}
	<section class="mt-10 border-t border-[var(--border)] pt-8">
		<div class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
			<span class="bulk-create-step-pill done">1</span>
			<span class="bulk-create-step-pill active">2</span>
			<span>Discover post type structure</span>
		</div>
		<h2 class="mt-4 text-lg font-medium text-[var(--text)]">2. Discover post type structure</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Choose a post type and retrieve the first entry from the JSON endpoint so you can see the field structure for mapping.</p>

		<form
			method="POST"
			action="?/fetchWordPress"
			use:enhance={() => {
				submittingFetch = true;
				return async ({ update }) => {
					await update();
					submittingFetch = false;
				};
			}}
			class="mt-4 max-w-2xl space-y-4"
		>
			<input type="hidden" name="site_url" value={siteUrl} />
			<input type="hidden" name="auth" value={auth} />
			<div>
				<label for="post_type" class="block text-sm font-medium text-[var(--text)]">Post type *</label>
				<select
					id="post_type"
					name="post_type_route"
					bind:value={selectedPostTypeRoute}
					required
					class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
				>
					{#each postTypes as pt}
						<option value={pt.route}>{pt.name} ({pt.slug})</option>
					{/each}
				</select>
			</div>
			<div class="flex flex-wrap gap-2">
				<button type="submit" disabled={submittingFetch} class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-70 disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
					{#if submittingFetch}
						<span class="bulk-create-spinner" aria-hidden="true"></span>
						<span>Retrieving first entry…</span>
					{:else}
						Retrieve first entry
					{/if}
				</button>
				{#if fetched}
					<button type="submit" disabled={submittingFetch} class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-70 disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
						{#if submittingFetch}
							<span class="bulk-create-spinner" aria-hidden="true"></span>
							<span>Refreshing…</span>
						{:else}
							Refresh sample
						{/if}
					</button>
				{/if}
			</div>
		</form>
	</section>
{/if}

<!-- Step 3: Map fields, set number to import, then fetch and import -->
{#if fetched}
	<section class="mt-10 border-t border-[var(--border)] pt-8">
		<div class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
			<span class="bulk-create-step-pill done">1</span>
			<span class="bulk-create-step-pill done">2</span>
			<span class="bulk-create-step-pill active">3</span>
			<span>Map fields and import</span>
		</div>
		<h2 class="mt-4 text-lg font-medium text-[var(--text)]">3. Map fields and import</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Set how each WordPress field maps into your posts, choose how many posts to import, then run the import.</p>


		<form
			method="POST"
			action="?/importFromWordPress"
			use:enhance={() => {
				submittingImport = true;
				return async ({ update }) => {
					await update();
					submittingImport = false;
				};
			}}
			class="bulk-create-step3-grid mt-6 gap-8"
		>
			<input type="hidden" name="site_url" value={siteUrl} />
			<input type="hidden" name="auth" value={auth} />
			<input type="hidden" name="post_type_route" value={postTypeRouteForImport} />
			<input type="hidden" name="custom_mapping" value={customMappingJson()} />
			<input type="hidden" name="filter_rules" value={filterRulesJson()} />

			<div class="min-w-0 space-y-6">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Field mapping</h3>
					<p class="mt-1 text-xs text-[var(--text-muted)]">Map WordPress fields to your post. Use the reference panel on the right for path syntax.</p>
			<div class="mt-4">
				<label for="title_path" class="block text-sm font-medium text-[var(--text)]">Title</label>
				<input id="title_path" type="text" name="title_path" bind:value={titlePath} list="title_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. title.rendered or removeHtml(title.rendered)" />
				<datalist id="title_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
				<label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
					<input type="checkbox" name="title_unescape_newlines" bind:checked={titleUnescapeNewlines} value="on" class="rounded border-[var(--border)]" />
					Convert <code class="rounded bg-[var(--surface)] px-1">\n</code> to newlines
				</label>
			</div>
			<div class="mt-6">
				<label for="content_path" class="block text-sm font-medium text-[var(--text)]">Content path or expression</label>
				<input id="content_path" type="text" name="content_path" bind:value={contentPath} list="content_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. content.rendered or removeHtml(content.rendered)" />
				<datalist id="content_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
				<label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
					<input type="checkbox" name="content_unescape_newlines" bind:checked={contentUnescapeNewlines} value="on" class="rounded border-[var(--border)]" />
					Convert <code class="rounded bg-[var(--surface)] px-1">\n</code> to newlines
				</label>
			</div>

			<div class="mt-8 pt-6 border-t border-[var(--border)]">
				<p class="text-sm font-medium text-[var(--text)]">Custom fields (response path → key)</p>
				<p class="mt-1 text-xs text-[var(--text-muted)]">To import all WordPress post metadata, add a field with path <code class="rounded bg-[var(--surface)] px-1">meta</code>, type <code class="rounded bg-[var(--surface)] px-1">json</code>, and key e.g. <code class="rounded bg-[var(--surface)] px-1">meta</code>. Metadata is usually complete when “Fetch full content per item” is enabled.</p>
				<div class="mt-2 space-y-3">
					{#each customMappings as m, i}
						<div class="flex flex-wrap items-end gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2">
							<input type="text" bind:value={m.path} placeholder="path or expression" list="custom_paths" class="min-w-[180px] min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
							<input type="text" bind:value={m.key} placeholder="Key" class="min-w-[100px] min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
							<select bind:value={m.type} class="min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
								<option value="string">string</option>
								<option value="number">number</option>
								<option value="boolean">boolean</option>
								<option value="json">json</option>
							</select>
							<label class="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
								<input type="checkbox" bind:checked={m.unescapeNewlines} class="rounded border-[var(--border)]" />
								<code class="text-xs">\n</code>→newline
							</label>
							<button type="button" onclick={() => removeCustomMapping(i)} class="min-h-[44px] rounded border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">Remove</button>
						</div>
					{/each}
				</div>
				<datalist id="custom_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
				<div class="mt-2 flex flex-wrap gap-2">
					<button type="button" onclick={addCustomMapping} class="min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">+ Add custom field</button>
				</div>
			</div>
				</div>

				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Import range</h3>
					<p class="mt-1 text-xs text-[var(--text-muted)]">Choose which posts to import by start position and count (e.g. start 37, count 10 → posts 37–46).</p>
					<div class="mt-4 grid gap-4 sm:grid-cols-2">
						<div>
							<label for="import_start" class="block text-sm font-medium text-[var(--text)]">Start at post</label>
							<input
								id="import_start"
								type="number"
								name="import_start"
								bind:value={importStart}
								min="1"
								max="100"
								class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
							/>
							<p class="mt-0.5 text-xs text-[var(--text-muted)]">1-based index of first post</p>
						</div>
						<div>
							<label for="import_count" class="block text-sm font-medium text-[var(--text)]">Number of posts</label>
							<input
								id="import_count"
								type="number"
								name="per_page"
								bind:value={perPage}
								min="1"
								max="100"
								class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
							/>
							<p class="mt-0.5 text-xs text-[var(--text-muted)]">Imports posts {importStart}–{Math.min(100, importStart + perPage - 1)} (start + count ≤ 100)</p>
						</div>
					</div>
				</div>

			<div class="rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]/50">
				<div class="flex items-center gap-2">
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)] text-sm font-semibold text-[var(--text-muted)]" aria-hidden="true">◇</span>
					<h3 class="text-sm font-semibold text-[var(--text)]">Import filters</h3>
				</div>
				<p class="mt-2 text-xs text-[var(--text-muted)]">Only posts that pass these checks are imported. Leave empty to import all. Use JSON paths (e.g. <code class="rounded bg-[var(--surface)] px-1">title.rendered</code>, <code class="rounded bg-[var(--surface)] px-1">status</code>).</p>
				<div class="mt-3 flex flex-wrap items-center gap-2">
					<label for="filter_combine" class="text-sm text-[var(--text-muted)]">Match</label>
					<select id="filter_combine" bind:value={filterCombine} class="min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
						<option value="and">all rules (AND)</option>
						<option value="or">any rule (OR)</option>
					</select>
				</div>
				<div class="mt-3 space-y-2">
					{#each filterRules as rule, i}
						<div class="flex flex-wrap items-end gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2">
							<input type="text" bind:value={rule.path} placeholder="Field path" list="filter_paths" class="min-w-[160px] min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
							<select bind:value={rule.operator} class="min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
								{#each FILTER_OPERATORS as op}
									<option value={op.value}>{op.label}</option>
								{/each}
							</select>
							{#if FILTER_OPERATORS.find((o) => o.value === rule.operator)?.needsValue}
								<input type="text" bind:value={rule.value} placeholder="Value" class="min-w-[120px] min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
							{/if}
							<button type="button" onclick={() => removeFilterRule(i)} class="min-h-[40px] rounded border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">Remove</button>
						</div>
					{/each}
				</div>
				<datalist id="filter_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
				<button type="button" onclick={addFilterRule} class="mt-2 min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">+ Add filter rule</button>
			</div>

				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Destination</h3>
					<div class="mt-4 space-y-4">
						<div>
							<label for="webhook_id" class="block text-sm font-medium text-[var(--text)]">Target webhook *</label>
							<select id="webhook_id" name="webhook_id" bind:value={webhookId} required class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
								<option value="">Select webhook</option>
								{#each data.webhooks as w}
									<option value={w.id}>{w.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="schedule_id" class="block text-sm font-medium text-[var(--text)]">Apply schedule after import (optional)</label>
							<select id="schedule_id" name="schedule_id" bind:value={scheduleId} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
								<option value="">None</option>
								{#each data.schedules as s}
									<option value={s.id}>{s.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="import_status" class="block text-sm font-medium text-[var(--text)]">Status after import</label>
							<select id="import_status" name="import_status" bind:value={importStatus} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
								<option value="draft">Draft</option>
								<option value="scheduled">Scheduled</option>
							</select>
							<p class="mt-1 text-xs text-[var(--text-muted)]">Choose “Scheduled” to have imported posts assigned to the next available slots and marked scheduled when you apply a schedule above.</p>
						</div>
						<label class="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
							<input type="checkbox" name="skip_duplicates" bind:checked={skipDuplicates} value="on" class="rounded border-[var(--border)]" />
							Skip duplicates (don’t import if already imported from this source)
						</label>
					</div>
					<button type="submit" disabled={submittingImport} class="mt-6 w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-70 disabled:cursor-wait min-h-[48px] inline-flex items-center justify-center gap-2 sm:w-auto">
						{#if submittingImport}
							<span class="bulk-create-spinner" aria-hidden="true"></span>
							<span>Importing…</span>
						{:else}
							Import posts
						{/if}
					</button>
				</div>
			</div>

			<aside class="bulk-create-step3-sidebar space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
				<h3 class="text-sm font-semibold text-[var(--text)]">Reference</h3>
				{#if samplePreviewJson}
					<div class="space-y-2">
						<p class="font-medium text-[var(--text)]">Example item (JSON)</p>
						<pre class="max-h-[600px] overflow-auto rounded-lg bg-black p-3 text-xs text-white whitespace-pre font-mono">{samplePreviewJson}</pre>
					</div>
				{/if}
				<div class="pt-2 border-t border-[var(--border)]">
					<p class="font-medium text-[var(--text)]">Path expressions</p>
					<p class="mt-1 text-xs text-[var(--text-muted)]">Use a path (e.g. <code class="rounded bg-[var(--surface)] px-1">title.rendered</code>) or a function:</p>
					<ul class="mt-2 list-inside list-disc space-y-1 text-xs text-[var(--text-muted)]">
						<li><code class="rounded bg-[var(--surface)] px-1">removeHtml(path)</code></li>
						<li><code class="rounded bg-[var(--surface)] px-1">regex(path, "pattern")</code> or <code class="rounded bg-[var(--surface)] px-1">regex(path, "p", "repl")</code></li>
						<li><code class="rounded bg-[var(--surface)] px-1">substring(path, start, length)</code></li>
						<li><code class="rounded bg-[var(--surface)] px-1">replace(path, "find", "repl")</code></li>
					</ul>
				</div>
				<div>
					<p class="font-medium text-[var(--text)]">How to reference</p>
					<ul class="mt-1 list-inside list-disc space-y-0.5 text-xs text-[var(--text-muted)]">
						<li>Dot paths: <code class="rounded bg-[var(--surface)] px-1">title.rendered</code>, <code class="rounded bg-[var(--surface)] px-1">content.rendered</code></li>
						<li>Meta: path <code class="rounded bg-[var(--surface)] px-1">meta</code> or <code class="rounded bg-[var(--surface)] px-1">meta.key</code></li>
					</ul>
				</div>
			</aside>
		</form>
	</section>
{/if}
{/if}
