<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	type PostTypeOption = { slug: string; name: string; route: string };

	let siteUrl = $state('');
	let auth = $state('');
	let perPage = $state(10);
	let titlePath = $state('title.rendered');
	let contentPath = $state('content.rendered');
	let titleUnescapeNewlines = $state(false);
	let contentUnescapeNewlines = $state(false);
	let customMappings = $state<{ path: string; key: string; type: string; unescapeNewlines?: boolean }[]>([]);
	let filterCombine = $state<'and' | 'or'>('and');
	let filterRules = $state<{ path: string; operator: string; value: string }[]>([]);
	let webhookId = $state('');
	let scheduleId = $state('');
	let selectedPostTypeRoute = $state('');
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
	function addMetaMapping() {
		customMappings = [...customMappings, { path: 'meta', key: 'meta', type: 'json', unescapeNewlines: false }];
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
</style>

<svelte:head>
	<title>Bulk create – PostPlan</title>
</svelte:head>

<h1 class="text-2xl font-bold text-[var(--text)]">Bulk create from WordPress</h1>
<p class="mt-1 text-sm text-[var(--text-muted)]">Point to a WordPress site’s REST API, discover post types, then scrape and import content.</p>

{#if form?.error && !form?.discovered && !form?.fetched}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form?.error}</p>
{/if}

<!-- Step 1: Discover post types -->
<section class="mt-8">
	<h2 class="text-lg font-medium text-[var(--text)]">1. Connect and discover post types</h2>
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
		<h2 class="text-lg font-medium text-[var(--text)]">2. Discover post type structure</h2>
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
		<h2 class="text-lg font-medium text-[var(--text)]">3. Map fields and import</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Set how each WordPress field maps into your posts, choose how many posts to import, then run the import. The app will fetch that many WP posts and create app posts.</p>

		<!-- Example response so user can see which fields exist -->
		{#if samplePreviewJson}
			<div class="mt-4 max-w-4xl space-y-3">
				<details class="rounded-lg border border-[var(--border)] bg-[var(--surface)]" open>
					<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-[var(--text)]">Example item (structure from step 2) — click to collapse</summary>
					<pre class="max-h-[420px] overflow-auto border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text)] whitespace-pre-wrap break-words font-mono">{samplePreviewJson}</pre>
				</details>
				<p class="text-xs text-[var(--text-muted)]">Long strings are truncated in this preview only; import uses full data. The JSON above is exactly what WordPress returned for the first entry. If you don’t see <code class="rounded bg-[var(--surface)] px-1">meta</code> or it’s empty, WordPress only exposes custom fields that are registered for the REST API (<code class="rounded bg-[var(--surface)] px-1">show_in_rest</code>); the site may need theme or plugin changes to expose more meta.</p>
				<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text)]">
					<p class="font-medium text-[var(--text)]">How to reference values</p>
					<ul class="mt-1 list-inside list-disc space-y-0.5 text-[var(--text-muted)]">
						<li>Use dot paths for nested fields: <code class="rounded bg-[var(--surface)] px-1">title.rendered</code>, <code class="rounded bg-[var(--surface)] px-1">content.rendered</code>, <code class="rounded bg-[var(--surface)] px-1">excerpt.rendered</code>.</li>
						<li>For the whole meta object: path <code class="rounded bg-[var(--surface)] px-1">meta</code>, type <code class="rounded bg-[var(--surface)] px-1">json</code>, key e.g. <code class="rounded bg-[var(--surface)] px-1">meta</code>.</li>
						<li>For one meta field: path <code class="rounded bg-[var(--surface)] px-1">meta.your_meta_key</code>, key <code class="rounded bg-[var(--surface)] px-1">your_meta_key</code> (only if it appears in the example JSON above).</li>
					</ul>
				</div>
			</div>
		{/if}

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
			class="mt-6 max-w-2xl space-y-4"
		>
			<input type="hidden" name="site_url" value={siteUrl} />
			<input type="hidden" name="auth" value={auth} />
			<input type="hidden" name="post_type_route" value={postTypeRouteForImport} />
			<input type="hidden" name="custom_mapping" value={customMappingJson()} />
			<input type="hidden" name="filter_rules" value={filterRulesJson()} />

			<div>
				<label for="import_count" class="block text-sm font-medium text-[var(--text)]">Number of posts to import</label>
				<input
					id="import_count"
					type="number"
					name="per_page"
					bind:value={perPage}
					min="1"
					max="100"
					class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
				/>
				<p class="mt-1 text-xs text-[var(--text-muted)]">The app will fetch posts from WordPress and create them in the app using the mapping below.</p>
			</div>

			<details class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-muted)]">
				<summary class="cursor-pointer font-medium text-[var(--text)]">Path expressions (optional transforms)</summary>
				<p class="mt-2">You can use a path only (e.g. <code class="rounded bg-[var(--surface)] px-1">title.rendered</code>) or wrap it in a function:</p>
				<ul class="mt-1 list-inside list-disc space-y-0.5">
					<li><code class="rounded bg-[var(--surface)] px-1">removeHtml(path)</code> — strip HTML tags</li>
					<li><code class="rounded bg-[var(--surface)] px-1">regex(path, "pattern")</code> — extract first match (or first capture group)</li>
					<li><code class="rounded bg-[var(--surface)] px-1">regex(path, "pattern", "replacement")</code> — replace; use $1, $2, $& in replacement</li>
					<li><code class="rounded bg-[var(--surface)] px-1">substring(path, start, length)</code> — start 0-based; length optional</li>
					<li><code class="rounded bg-[var(--surface)] px-1">replace(path, "find", "replace")</code> — literal find/replace (all occurrences)</li>
				</ul>
			</details>

			<div>
				<label for="title_path" class="block text-sm font-medium text-[var(--text)]">Title path or expression</label>
				<input id="title_path" type="text" name="title_path" bind:value={titlePath} list="title_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. title.rendered or removeHtml(title.rendered)" />
				<datalist id="title_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
				<label class="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
					<input type="checkbox" name="title_unescape_newlines" bind:checked={titleUnescapeNewlines} value="on" class="rounded border-[var(--border)]" />
					Convert <code class="rounded bg-[var(--surface)] px-1">\n</code> to newlines
				</label>
			</div>
			<div>
				<label for="content_path" class="block text-sm font-medium text-[var(--text)]">Content path or expression</label>
				<input id="content_path" type="text" name="content_path" bind:value={contentPath} list="content_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. content.rendered or removeHtml(content.rendered)" />
				<datalist id="content_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
				<label class="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
					<input type="checkbox" name="content_unescape_newlines" bind:checked={contentUnescapeNewlines} value="on" class="rounded border-[var(--border)]" />
					Convert <code class="rounded bg-[var(--surface)] px-1">\n</code> to newlines
				</label>
			</div>

			<div>
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
					<button type="button" onclick={addMetaMapping} class="min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">+ Add WordPress meta</button>
				</div>
			</div>

			<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
				<p class="text-sm font-medium text-[var(--text)]">Import filters</p>
				<p class="mt-1 text-xs text-[var(--text-muted)]">Only posts that pass these checks are imported. Leave empty to import all. Use JSON paths (e.g. <code class="rounded bg-[var(--surface)] px-1">title.rendered</code>, <code class="rounded bg-[var(--surface)] px-1">status</code>, <code class="rounded bg-[var(--surface)] px-1">meta.my_key</code>).</p>
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

			<div>
				<label for="webhook_id" class="block text-sm font-medium text-[var(--text)]">Target webhook *</label>
				<select id="webhook_id" name="webhook_id" bind:value={webhookId} required class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
					<option value="">Select webhook</option>
					{#each data.webhooks as w}
						<option value={w.id}>{w.name}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="schedule_id" class="block text-sm font-medium text-[var(--text)]">Apply schedule after import (optional)</label>
				<select id="schedule_id" name="schedule_id" bind:value={scheduleId} class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
					<option value="">None</option>
					{#each data.schedules as s}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>

			<button type="submit" disabled={submittingImport} class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-70 disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
				{#if submittingImport}
					<span class="bulk-create-spinner" aria-hidden="true"></span>
					<span>Importing…</span>
				{:else}
					Import posts
				{/if}
			</button>
		</form>
	</section>
{/if}
