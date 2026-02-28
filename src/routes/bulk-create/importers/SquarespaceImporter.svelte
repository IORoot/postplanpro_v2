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

	let blogUrl = $state('');
	let perPage = $state(10);
	let importStart = $state(1);
	let titlePath = $state('title');
	let contentPath = $state('body');
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
	let submittingDiscover = $state(false);
	let submittingImport = $state(false);
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

	const discovered = $derived(Boolean((form as { squarespace_discovered?: boolean })?.squarespace_discovered));
	const itemCount = $derived((form as { item_count?: number })?.item_count ?? 0);
	const sample = $derived(discovered ? ((form as { sample?: unknown })?.sample ?? null) : null);
	const keys = $derived(sample ? sampleKeys(sample) : []);
	const samplePreviewData = $derived(sample != null ? sampleForPreview(sample) : null);

	$effect(() => {
		const f = form as { blog_url?: string };
		if (f?.blog_url != null) blogUrl = f.blog_url;
		if (discovered && sample != null) {
			if (titlePath === 'title.rendered' || !titlePath) titlePath = 'title';
			if (contentPath === 'content.rendered' || !contentPath) contentPath = 'body';
		}
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
		<span>Enter blog URL and discover</span>
	</div>
	<h2 class="mt-4 text-lg font-medium text-[var(--text)]">1. Enter blog URL and discover</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">
		Enter the full URL of your Squarespace <strong>blog</strong> or collection page (e.g. <code class="rounded bg-[var(--surface)] px-1 py-0.5 text-xs">https://yoursite.squarespace.com/blog</code>). Squarespace can return the same page as JSON instead of HTML: we append <code class="rounded bg-[var(--surface)] px-1 py-0.5 text-xs">?format=json-pretty</code> to your URL and fetch that. The response is a JSON object; we look for an <code class="rounded bg-[var(--surface)] px-1 py-0.5 text-xs">items</code> array (each item is a blog post or entry). The first entry is used as the example for mapping fields in the next step.
	</p>
	<form
		method="POST"
		action="?/discoverSquarespace"
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
			<label for="sq_blog_url" class="block text-sm font-medium text-[var(--text)]">Blog or collection page URL *</label>
			<input
				id="sq_blog_url"
				type="url"
				name="blog_url"
				bind:value={blogUrl}
				required
				placeholder="https://yoursite.squarespace.com/blog"
				class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
			/>
		</div>
		<button type="submit" disabled={submittingDiscover} class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
			{#if submittingDiscover}
				<span class="bulk-create-spinner" aria-hidden="true"></span>
				<span>Discovering…</span>
			{:else}
				Discover blog
			{/if}
		</button>
	</form>
	{#if discovered}
		<div class="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
			<p class="text-sm font-medium text-[var(--text)]">Blog discovered</p>
			<p class="mt-1 text-xs text-[var(--text-muted)]">{itemCount} item(s) · <code class="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">{blogUrl}</code></p>
		</div>
	{/if}
</section>

{#if discovered}
	<section class="mt-10 border-t border-[var(--border)] pt-8">
		<div class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
			<span class="bulk-create-step-pill done">1</span>
			<span class="bulk-create-step-pill active">2</span>
			<span>Map fields and import</span>
		</div>
		<h2 class="mt-4 text-lg font-medium text-[var(--text)]">2. Map fields and import</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Set how each Squarespace item field maps into your posts, choose how many items to import, then run the import.</p>
		<form
			method="POST"
			action="?/importFromSquarespace"
			use:enhance={() => {
				submittingImport = true;
				return async ({ update }) => {
					await update();
					submittingImport = false;
				};
			}}
			class="bulk-create-step3-grid mt-6 gap-8"
		>
			<input type="hidden" name="blog_url" value={blogUrl} />
			<input type="hidden" name="custom_mapping" value={customMappingJson()} />
			<input type="hidden" name="filter_rules" value={filterRulesJson()} />

			<div class="min-w-0 space-y-6">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Field mapping</h3>
					<p class="mt-1 text-xs text-[var(--text-muted)]">Map Squarespace item fields to your post. Use the reference panel on the right for path syntax.</p>
					<div class="mt-4">
						<label for="sq_title_path" class="block text-sm font-medium text-[var(--text)]">Title</label>
						<input id="sq_title_path" type="text" name="title_path" bind:value={titlePath} list="sq_title_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. title or title.rendered" />
						<datalist id="sq_title_paths">
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
						<label for="sq_content_path" class="block text-sm font-medium text-[var(--text)]">Content path or expression</label>
						<input id="sq_content_path" type="text" name="content_path" bind:value={contentPath} list="sq_content_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. body or body.rendered" />
						<datalist id="sq_content_paths">
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
						<label for="sq_image_url_path" class="block text-sm font-medium text-[var(--text)]">Image URL (optional)</label>
						<input id="sq_image_url_path" type="text" name="image_url_path" bind:value={imageUrlPath} list="sq_image_url_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. assetUrl or imageUrl" />
						<datalist id="sq_image_url_paths">
							{#each keys as k}
								<option value={k}></option>
							{/each}
						</datalist>
					</div>
					<div class="mt-8 pt-6 border-t border-[var(--border)]">
						<p class="text-sm font-medium text-[var(--text)]">Custom fields (response path → key)</p>
						<div class="mt-2 space-y-3">
							{#each customMappings as m, i}
								<div class="flex flex-wrap items-end gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2">
									<input type="text" bind:value={m.path} placeholder="path or expression" list="sq_custom_paths" class="min-w-[180px] min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
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
						<datalist id="sq_custom_paths">
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
					<p class="mt-1 text-xs text-[var(--text-muted)]">Choose which items to import by start position and count. Max 500 per import.</p>
					<div class="mt-4 grid gap-4 sm:grid-cols-2">
						<div>
							<label for="sq_import_start" class="block text-sm font-medium text-[var(--text)]">Start at item</label>
							<input id="sq_import_start" type="number" name="import_start" bind:value={importStart} min="1" max="500" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
						</div>
						<div>
							<label for="sq_import_count" class="block text-sm font-medium text-[var(--text)]">Number of items</label>
							<input id="sq_import_count" type="number" name="per_page" bind:value={perPage} min="1" max="500" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
							<p class="mt-0.5 text-xs text-[var(--text-muted)]">Imports items {importStart}–{Math.min(500, importStart + perPage - 1)}</p>
						</div>
					</div>
				</div>
				<div class="rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]/50">
					<div class="flex items-center gap-2">
						<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)] text-sm font-semibold text-[var(--text-muted)]" aria-hidden="true">◇</span>
						<h3 class="text-sm font-semibold text-[var(--text)]">Import filters</h3>
					</div>
					<p class="mt-2 text-xs text-[var(--text-muted)]">Only items that pass these checks are imported. Leave empty to import all.</p>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<label for="sq_filter_combine" class="text-sm text-[var(--text-muted)]">Match</label>
						<select id="sq_filter_combine" bind:value={filterCombine} class="min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
							<option value="and">all rules (AND)</option>
							<option value="or">any rule (OR)</option>
						</select>
					</div>
					<div class="mt-3 space-y-2">
						{#each filterRules as rule, i}
							<div class="flex flex-wrap items-end gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2">
								<input type="text" bind:value={rule.path} placeholder="Field path" list="sq_filter_paths" class="min-w-[160px] min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
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
					<datalist id="sq_filter_paths">
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
							<label for="sq_schedule_id" class="block text-sm font-medium text-[var(--text)]">Apply schedule after import (optional)</label>
							<select id="sq_schedule_id" name="schedule_id" bind:value={scheduleId} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
								<option value="">None</option>
								{#each data.schedules as s}
									<option value={s.id}>{s.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="sq_import_status" class="block text-sm font-medium text-[var(--text)]">Status after import</label>
							<select id="sq_import_status" name="import_status" bind:value={importStatus} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
								<option value="draft">Draft</option>
								<option value="scheduled">Scheduled</option>
							</select>
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
						<p class="font-medium text-[var(--text)]">Example item (first entry from <code class="rounded bg-[var(--surface)] px-1">items</code>)</p>
						<p class="text-xs text-[var(--text-muted)]">Click any key to copy its path to the clipboard.</p>
						<div class="relative">
							<div class="max-h-[600px] overflow-auto rounded-lg bg-black p-3 text-xs font-mono text-white">
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
					<p class="mt-1 text-xs text-[var(--text-muted)]">Use a path (e.g. <code class="rounded bg-[var(--surface)] px-1">title</code>, <code class="rounded bg-[var(--surface)] px-1">body</code>) or a function:</p>
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
