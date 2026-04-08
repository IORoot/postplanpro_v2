<script lang="ts">
	import { enhance } from '$app/forms';
	import SampleJsonViewer from '$lib/components/SampleJsonViewer.svelte';
	import {
		FILTER_OPERATORS,
		sampleKeys,
		sampleForPreview,
		filterRulesJson as filterRulesJsonUtil,
		customMappingJson as customMappingJsonUtil,
		type CustomMapping,
		type FilterRule
	} from '$lib/importers/importerUtils.js';

	let { data, form } = $props();

	type PostTypeOption = { slug: string; name: string; route: string };

	let siteUrl = $state('');
	let auth = $state('');
	let perPage = $state(10);
	let importStart = $state(1);
	let titlePath = $state('title.rendered');
	let contentPath = $state('content.rendered');
	let imageUrlPath = $state('');
	let titleUnescapeNewlines = $state(true);
	let contentUnescapeNewlines = $state(true);
	let customMappings = $state<CustomMapping[]>([]);
	let filterCombine = $state<'and' | 'or'>('and');
	let filterRules = $state<FilterRule[]>([]);
	let webhookIds = $state<string[]>([]);
	let scheduleId = $state('');
	let importStatus = $state<'draft' | 'scheduled'>('draft');
	let skipDuplicates = $state(false);
	let selectedPostTypeRoute = $state('');
	let submittingDiscover = $state(false);
	let submittingFetch = $state(false);
	let submittingImport = $state(false);
	let includeFeaturedImage = $state(false);
	let showCopiedToast = $state(false);
	let copyToastTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleCopiedToClipboard() {
		if (copyToastTimeout) clearTimeout(copyToastTimeout);
		showCopiedToast = true;
		copyToastTimeout = setTimeout(() => {
			showCopiedToast = false;
			copyToastTimeout = null;
		}, 2000);
	}

	const discovered = $derived(Boolean((form as { discovered?: boolean })?.discovered));
	const postTypes = $derived(((form as { post_types?: PostTypeOption[] })?.post_types ?? []) as PostTypeOption[]);
	const fetched = $derived(Boolean((form as { fetched?: boolean })?.fetched));
	const sample = $derived((form as { sample?: unknown })?.sample ?? null);
	const keys = $derived(sample ? sampleKeys(sample) : []);
	const samplePreviewData = $derived(sample != null ? sampleForPreview(sample) : null);
	const postTypeRouteForImport = $derived(
		fetched
			? ((form as { post_type_route?: string }).post_type_route || selectedPostTypeRoute || '/wp/v2/posts')
			: '/wp/v2/posts'
	);
	const wpCollectionTotal = $derived(
		(form as { wp_collection_total?: number | null })?.wp_collection_total ?? null
	);

	$effect(() => {
		const f = form as { site_url?: string; auth?: string; post_type_route?: string; include_featured_image?: boolean };
		if (f?.site_url != null) siteUrl = f.site_url;
		if (f?.auth != null) auth = f.auth;
		if (f?.post_type_route != null) selectedPostTypeRoute = f.post_type_route;
		if (f?.include_featured_image != null) includeFeaturedImage = Boolean(f.include_featured_image);
		if (discovered && postTypes.length > 0 && !selectedPostTypeRoute) selectedPostTypeRoute = postTypes[0].route;
	});

	function addCustomMapping() {
		customMappings = [...customMappings, { path: '', key: '', type: 'string', unescapeNewlines: false }];
	}
	function removeCustomMapping(i: number) {
		customMappings = customMappings.filter((_, idx) => idx !== i);
	}
	function addFilterRule() {
		filterRules = [...filterRules, { path: '', operator: 'eq', value: '' }];
	}
	function removeFilterRule(i: number) {
		filterRules = filterRules.filter((_, idx) => idx !== i);
	}
	function filterRulesJson() {
		return filterRulesJsonUtil(filterCombine, filterRules);
	}
	function customMappingJson() {
		return customMappingJsonUtil(customMappings);
	}
</script>

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
			<label for="wp_site_url" class="block text-sm font-medium text-[var(--text)]">WordPress site URL *</label>
			<input
				id="wp_site_url"
				type="url"
				name="site_url"
				bind:value={siteUrl}
				required
				placeholder="https://yoursite.com or https://yoursite.com/wp-json"
				class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
			/>
		</div>
		<div>
			<label for="wp_auth" class="block text-sm font-medium text-[var(--text)]">Authorization (optional)</label>
			<input
				id="wp_auth"
				type="password"
				name="auth"
				bind:value={auth}
				placeholder="Application password or Bearer token"
				autocomplete="off"
				class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
			/>
		</div>
		<button type="submit" disabled={submittingDiscover} class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
			{#if submittingDiscover}
				<span class="bulk-create-spinner" aria-hidden="true"></span>
				<span>Discovering…</span>
			{:else}
				Discover post types
			{/if}
		</button>
	</form>
</section>

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
				<label for="wp_post_type" class="block text-sm font-medium text-[var(--text)]">Post type *</label>
				<select
					id="wp_post_type"
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
			<div class="flex items-center gap-2">
				<input type="checkbox" id="wp_include_featured" name="include_featured_image" bind:checked={includeFeaturedImage} value="on" class="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]" />
				<label for="wp_include_featured" class="text-sm text-[var(--text)]">Include featured image in sample (adds <code class="rounded bg-[var(--surface)] px-1 py-0.5 text-xs">featured_image_url</code> to the JSON for mapping)</label>
			</div>
			<div class="flex flex-wrap gap-2">
				<button type="submit" disabled={submittingFetch} class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
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
			<input type="hidden" name="include_featured_image" value={includeFeaturedImage ? 'on' : ''} />
			<input type="hidden" name="custom_mapping" value={customMappingJson()} />
			<input type="hidden" name="filter_rules" value={filterRulesJson()} />

			<div class="min-w-0 space-y-6">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Field mapping</h3>
					<p class="mt-1 text-xs text-[var(--text-muted)]">Map WordPress fields to your post. Use the reference panel on the right for path syntax.</p>
					<div class="mt-4">
						<label for="wp_title_path" class="block text-sm font-medium text-[var(--text)]">Title</label>
						<input id="wp_title_path" type="text" name="title_path" bind:value={titlePath} list="wp_title_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. title.rendered or removeHtml(title.rendered)" />
						<datalist id="wp_title_paths">
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
						<label for="wp_content_path" class="block text-sm font-medium text-[var(--text)]">Content path or expression</label>
						<input id="wp_content_path" type="text" name="content_path" bind:value={contentPath} list="wp_content_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. content.rendered or removeHtml(content.rendered)" />
						<datalist id="wp_content_paths">
							{#each keys as k}
								<option value={k}></option>
							{/each}
						</datalist>
						<label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
							<input type="checkbox" name="content_unescape_newlines" bind:checked={contentUnescapeNewlines} value="on" class="rounded border-[var(--border)]" />
							Convert <code class="rounded bg-[var(--surface)] px-1">\n</code> to newlines
						</label>
					</div>
					<div class="mt-6">
						<label for="wp_image_url_path" class="block text-sm font-medium text-[var(--text)]">Image URL (optional)</label>
						<input id="wp_image_url_path" type="text" name="image_url_path" bind:value={imageUrlPath} list="wp_image_url_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. featured_image_url or leave empty" />
						<datalist id="wp_image_url_paths">
							{#each keys as k}
								<option value={k}></option>
							{/each}
						</datalist>
						<p class="mt-1 text-xs text-[var(--text-muted)]">Maps into the post's Image URL field. Use <code class="rounded bg-[var(--surface)] px-1">featured_image_url</code> if you enabled "Include featured image" in step 2.</p>
					</div>
					<div class="mt-8 pt-6 border-t border-[var(--border)]">
						<p class="text-sm font-medium text-[var(--text)]">Custom fields (response path → key)</p>
						<p class="mt-1 text-xs text-[var(--text-muted)]">To import all WordPress post metadata, add a field with path <code class="rounded bg-[var(--surface)] px-1">meta</code>, type <code class="rounded bg-[var(--surface)] px-1">json</code>. If you enabled "Include featured image", add path <code class="rounded bg-[var(--surface)] px-1">featured_image_url</code>.</p>
						<div class="mt-2 space-y-3">
							{#each customMappings as m, i}
								<div class="flex flex-wrap items-end gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2">
									<input type="text" bind:value={m.path} placeholder="path or expression" list="wp_custom_paths" class="min-w-[180px] min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
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
						<datalist id="wp_custom_paths">
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
							<label for="wp_import_start" class="block text-sm font-medium text-[var(--text)]">Start at post</label>
							<input id="wp_import_start" type="number" name="import_start" bind:value={importStart} min="1" max="100" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
							<p class="mt-0.5 text-xs text-[var(--text-muted)]">1-based index of first post</p>
						</div>
						<div>
							<label for="wp_import_count" class="block text-sm font-medium text-[var(--text)]">
								Number of posts{#if fetched && wpCollectionTotal != null}
									<span class="font-normal text-[var(--text-muted)]"> ({wpCollectionTotal})</span>{/if}
							</label>
							<input id="wp_import_count" type="number" name="per_page" bind:value={perPage} min="1" max="100" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
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
						<label for="wp_filter_combine" class="text-sm text-[var(--text-muted)]">Match</label>
						<select id="wp_filter_combine" bind:value={filterCombine} class="min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
							<option value="and">all rules (AND)</option>
							<option value="or">any rule (OR)</option>
						</select>
					</div>
					<div class="mt-3 space-y-2">
						{#each filterRules as rule, i}
							<div class="flex flex-wrap items-end gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2">
								<input type="text" bind:value={rule.path} placeholder="Field path" list="wp_filter_paths" class="min-w-[160px] min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
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
					<datalist id="wp_filter_paths">
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
							<p class="block text-sm font-medium text-[var(--text)]">Target webhooks *</p>
							<p class="mt-0.5 text-xs text-[var(--text-muted)]">Select at least one; all will receive each imported post when published.</p>
							<div class="mt-2 flex flex-wrap gap-x-4 gap-y-2">
								{#each data.webhooks as w}
									<label class="flex cursor-pointer items-center gap-2">
										<input
											type="checkbox"
											name="webhook_ids"
											value={w.id}
											checked={webhookIds.includes(w.id)}
											onchange={(e) => {
												const checked = (e.target as HTMLInputElement).checked;
												webhookIds = checked ? [...webhookIds, w.id] : webhookIds.filter((id) => id !== w.id);
											}}
											class="rounded border-[var(--border)]"
										/>
										<span class="text-sm text-[var(--text)]">{w.name}</span>
									</label>
								{/each}
							</div>
							{#if webhookIds.length === 0}
								<p class="mt-2 text-xs text-amber-600 dark:text-amber-400">Select at least one webhook.</p>
							{/if}
						</div>
						<div>
							<label for="wp_schedule_id" class="block text-sm font-medium text-[var(--text)]">Apply schedule after import (optional)</label>
							<select id="wp_schedule_id" name="schedule_id" bind:value={scheduleId} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
								<option value="">None</option>
								{#each data.schedules as s}
									<option value={s.id}>{s.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="wp_import_status" class="block text-sm font-medium text-[var(--text)]">Status after import</label>
							<select id="wp_import_status" name="import_status" bind:value={importStatus} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
								<option value="draft">Draft</option>
								<option value="scheduled">Scheduled</option>
							</select>
							<p class="mt-1 text-xs text-[var(--text-muted)]">Choose "Scheduled" to have imported posts assigned to the next available slots when you apply a schedule above.</p>
						</div>
						<label class="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
							<input type="checkbox" name="skip_duplicates" bind:checked={skipDuplicates} value="on" class="rounded border-[var(--border)]" />
							Skip duplicates (don't import if already imported from this source)
						</label>
					</div>
					<button type="submit" disabled={submittingImport} class="mt-6 w-full rounded-lg btn-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait min-h-[48px] inline-flex items-center justify-center gap-2 sm:w-auto">
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
				{#if samplePreviewData != null}
					<div class="space-y-2">
						<p class="font-medium text-[var(--text)]">Example item (JSON)</p>
						<p class="text-xs text-[var(--text-muted)]">Click any key to copy its path to the clipboard.</p>
						<div class="relative">
							<div class="max-h-[600px] overflow-auto rounded-lg bg-neutral-950 p-3 text-xs font-mono text-neutral-50">
								<SampleJsonViewer data={samplePreviewData} onCopied={handleCopiedToClipboard} />
							</div>
							{#if showCopiedToast}
								<p class="mt-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-center text-xs font-medium text-white shadow-sm" role="status">Copied to clipboard</p>
							{/if}
						</div>
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
			</aside>
		</form>
	</section>
{/if}
