<script lang="ts">
	import { enhance } from '$app/forms';
	import SampleJsonViewer from '$lib/components/SampleJsonViewer.svelte';
	import AddOutputWebhookModal from '$lib/components/importers/AddOutputWebhookModal.svelte';
	import ImportStepPills from '$lib/components/importers/ImportStepPills.svelte';
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

	let feedUrl = $state('');
	let perPage = $state(10);
	let importStart = $state(1);
	let titlePath = $state('title');
	let contentPath = $state('content');
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
	let addWebhookModalOpen = $state(false);
	let inlineHeadersJson = $state('[]');
	let importFlowUnlocked = $state<2 | 3 | 4 | 5>(2);
	let importFlowSeenMap = $state(false);

	function handleCopiedToClipboard() {
		if (copyToastTimeout) clearTimeout(copyToastTimeout);
		showCopiedToast = true;
		copyToastTimeout = setTimeout(() => {
			showCopiedToast = false;
			copyToastTimeout = null;
		}, 2000);
	}

	const discovered = $derived(Boolean((form as { rss_discovered?: boolean })?.rss_discovered));
	const rssSample = $derived((form as { rss_sample?: unknown })?.rss_sample ?? null);
	const feedTitle = $derived((form as { feed_title?: string | null })?.feed_title ?? null);
	const itemCount = $derived((form as { item_count?: number })?.item_count ?? 0);
	const resolvedFeedUrl = $derived((form as { feed_url?: string })?.feed_url ?? feedUrl);
	const sample = $derived(rssSample);
	const keys = $derived(sample ? sampleKeys(sample) : []);
	const samplePreviewData = $derived(sample != null ? sampleForPreview(sample) : null);
	const showMapStep = $derived(discovered && rssSample != null);

	const importFocusStep = $derived(!discovered ? 1 : importFlowUnlocked) as 1 | 2 | 3 | 4 | 5;

	$effect(() => {
		const f = form as { feed_url?: string };
		if (f?.feed_url != null) feedUrl = f.feed_url;
		if (showMapStep && rssSample != null) {
			if (titlePath === 'title.rendered' || !titlePath) titlePath = 'title';
			if (contentPath === 'content.rendered' || !contentPath) contentPath = 'content';
		}
	});

	$effect(() => {
		if (!showMapStep) {
			importFlowSeenMap = false;
			return;
		}
		if (!importFlowSeenMap) {
			importFlowUnlocked = 2;
			importFlowSeenMap = true;
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

<section id="rss-import-step-1" class="scroll-mt-8 mt-8">
	<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
		<ImportStepPills sectionStep={1} focusStep={importFocusStep} totalSteps={5} />
		<span>Pick URL and discover</span>
	</div>
	<h2 class="mt-4 text-lg font-medium text-[var(--text)]">1. Pick URL and discover</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Enter the RSS or Atom feed URL. The app will fetch and parse the feed and show the first item so you can see the structure for mapping.</p>
	<form
		method="POST"
		action="?/discoverRss"
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
			<label for="rss_feed_url" class="block text-sm font-medium text-[var(--text)]">Feed URL *</label>
			<input
				id="rss_feed_url"
				type="url"
				name="feed_url"
				bind:value={feedUrl}
				required
				placeholder="https://example.com/feed.xml"
				class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
			/>
		</div>
		<button type="submit" disabled={submittingDiscover} class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
			{#if submittingDiscover}
				<span class="bulk-create-spinner" aria-hidden="true"></span>
				<span>Discovering…</span>
			{:else}
				Discover feed
			{/if}
		</button>
	</form>
	{#if discovered}
		<div class="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
			<p class="text-sm font-medium text-[var(--text)]">{feedTitle ?? 'Feed'}</p>
			<p class="mt-1 text-xs text-[var(--text-muted)]">{itemCount} item(s) · <code class="rounded bg-[var(--bg)] px-1 py-0.5 text-xs">{resolvedFeedUrl}</code></p>
		</div>
	{/if}
</section>

{#if showMapStep}
	<form
		method="POST"
		action="?/importFromRss"
		use:enhance={() => {
			submittingImport = true;
			return async ({ update }) => {
				await update();
				submittingImport = false;
			};
		}}
		class="mt-10 space-y-10 border-t border-[var(--border)] pt-8"
	>
		<input type="hidden" name="feed_url" value={resolvedFeedUrl} />
		<input type="hidden" name="custom_mapping" value={customMappingJson()} />
		<input type="hidden" name="filter_rules" value={filterRulesJson()} />

		<section id="rss-import-step-2" class="scroll-mt-8">
			<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
				<ImportStepPills sectionStep={2} focusStep={importFocusStep} totalSteps={5} />
				<span>Map fields</span>
			</div>
			<h2 class="mt-4 text-lg font-medium text-[var(--text)]">2. Map fields</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Set how each RSS item field maps into your posts. Use the reference panel for path syntax.</p>
			<div class="bulk-create-step3-grid mt-6 gap-8">
				<div class="min-w-0 space-y-6">
					<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
						<h3 class="text-sm font-semibold text-[var(--text)]">Field mapping</h3>
						<p class="mt-1 text-xs text-[var(--text-muted)]">Map RSS item fields to your post.</p>
						<div class="mt-4">
							<label for="rss_title_path" class="block text-sm font-medium text-[var(--text)]">Title</label>
							<input id="rss_title_path" type="text" name="title_path" bind:value={titlePath} list="rss_title_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. title" />
							<datalist id="rss_title_paths">
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
							<label for="rss_content_path" class="block text-sm font-medium text-[var(--text)]">Content path or expression</label>
							<input id="rss_content_path" type="text" name="content_path" bind:value={contentPath} list="rss_content_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. content" />
							<datalist id="rss_content_paths">
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
							<label for="rss_image_url_path" class="block text-sm font-medium text-[var(--text)]">Image URL (optional)</label>
							<input id="rss_image_url_path" type="text" name="image_url_path" bind:value={imageUrlPath} list="rss_image_url_paths" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" placeholder="e.g. enclosure.url" />
							<datalist id="rss_image_url_paths">
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
										<input type="text" bind:value={m.path} placeholder="path or expression" list="rss_custom_paths" class="min-w-[180px] min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
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
							<datalist id="rss_custom_paths">
								{#each keys as k}
									<option value={k}></option>
								{/each}
							</datalist>
							<div class="mt-2 flex flex-wrap gap-2">
								<button type="button" onclick={addCustomMapping} class="min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">+ Add custom field</button>
							</div>
						</div>
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
						<p class="mt-1 text-xs text-[var(--text-muted)]">Use a path or a function:</p>
						<ul class="mt-2 list-inside list-disc space-y-1 text-xs text-[var(--text-muted)]">
							<li><code class="rounded bg-[var(--surface)] px-1">removeHtml(path)</code></li>
							<li><code class="rounded bg-[var(--surface)] px-1">regex(path, "pattern")</code></li>
							<li><code class="rounded bg-[var(--surface)] px-1">substring(path, start, length)</code></li>
							<li><code class="rounded bg-[var(--surface)] px-1">replace(path, "find", "repl")</code></li>
						</ul>
					</div>
				</aside>
			</div>
			<div class="mt-6 flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white min-h-[44px] inline-flex items-center justify-center gap-2"
					onclick={() => {
						importFlowUnlocked = 3;
						document.getElementById('rss-import-step-3')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}}
				>
					Continue to import filters
				</button>
			</div>
		</section>

		<section id="rss-import-step-3" class="scroll-mt-8" hidden={importFlowUnlocked < 3}>
			<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
				<ImportStepPills sectionStep={3} focusStep={importFocusStep} totalSteps={5} />
				<span>Import filters</span>
			</div>
			<h2 class="mt-4 text-lg font-medium text-[var(--text)]">3. Import filters</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Only items that pass these checks are imported. Leave empty to import all.</p>
			<div class="importer-panel-filters mt-4">
				<div class="mt-1 flex flex-wrap items-center gap-2">
					<label for="rss_filter_combine" class="text-sm text-[var(--text-muted)]">Match</label>
					<select id="rss_filter_combine" bind:value={filterCombine} class="min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
						<option value="and">all rules (AND)</option>
						<option value="or">any rule (OR)</option>
					</select>
				</div>
				<div class="mt-3 space-y-2">
					{#each filterRules as rule, i}
						<div class="flex flex-wrap items-end gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2">
							<input type="text" bind:value={rule.path} placeholder="Field path" list="rss_filter_paths" class="min-w-[160px] min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
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
				<datalist id="rss_filter_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
				<button type="button" onclick={addFilterRule} class="mt-2 min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">+ Add filter rule</button>
			</div>
			<div class="mt-6 flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
					onclick={() => document.getElementById('rss-import-step-2')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
				>
					Back to map fields
				</button>
				<button
					type="button"
					class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
					onclick={() => {
						importFlowUnlocked = 4;
						document.getElementById('rss-import-step-4')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}}
				>
					Continue to import range
				</button>
			</div>
		</section>

		<section id="rss-import-step-4" class="scroll-mt-8" hidden={importFlowUnlocked < 4}>
			<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
				<ImportStepPills sectionStep={4} focusStep={importFocusStep} totalSteps={5} />
				<span>Import range</span>
			</div>
			<h2 class="mt-4 text-lg font-medium text-[var(--text)]">4. Import range</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Choose which items to import by start position and count. Max 500 per import.</p>
			<div class="importer-panel-filters mt-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="rss_import_start" class="block text-sm font-medium text-[var(--text)]">Start at item</label>
						<input id="rss_import_start" type="number" name="import_start" bind:value={importStart} min="1" max="500" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
						<p class="mt-0.5 text-xs text-[var(--text-muted)]">1-based index of first item</p>
					</div>
					<div>
						<label for="rss_import_count" class="block text-sm font-medium text-[var(--text)]">Number of items</label>
						<input id="rss_import_count" type="number" name="per_page" bind:value={perPage} min="1" max="500" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
						<p class="mt-0.5 text-xs text-[var(--text-muted)]">Imports items {importStart}–{Math.min(500, importStart + perPage - 1)}</p>
					</div>
				</div>
				<label class="mt-5 flex cursor-pointer items-center gap-2 border-t border-[var(--border)] pt-4 text-sm text-[var(--text)]">
					<input type="checkbox" name="skip_duplicates" bind:checked={skipDuplicates} value="on" class="rounded border-[var(--border)]" />
					Skip duplicates (don't import if already imported from this feed)
				</label>
			</div>
			<div class="mt-6 flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
					onclick={() => document.getElementById('rss-import-step-3')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
				>
					Back to import filters
				</button>
				<button
					type="button"
					class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
					onclick={() => {
						importFlowUnlocked = 5;
						document.getElementById('rss-import-step-5')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}}
				>
					Continue to destination
				</button>
			</div>
		</section>

		<section id="rss-import-step-5" class="scroll-mt-8" hidden={importFlowUnlocked < 5}>
			<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
				<ImportStepPills sectionStep={5} focusStep={importFocusStep} totalSteps={5} />
				<span>Destination and after import</span>
			</div>
			<h2 class="mt-4 text-lg font-medium text-[var(--text)]">5. Destination and after import</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Optional webhooks, schedule, and status for imported posts.</p>
			<div class="mt-6 space-y-6">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Destination</h3>
					<div class="mt-4 space-y-3">
						<p class="block text-sm font-medium text-[var(--text)]">Target webhooks (optional)</p>
						<p class="text-xs text-[var(--text-muted)]">When you publish, each selected webhook receives the post. You can import without any webhook.</p>
						{#if webhookIds.length === 0}
							<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
								No webhook selected: posts stay in PostPlan until you attach an output webhook.
							</p>
						{/if}
						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								onclick={() => (addWebhookModalOpen = true)}
								class="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
							>
								Add webhook
							</button>
						</div>
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
					</div>
				</div>
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Apply schedule after import</h3>
					<p class="mt-1 text-xs text-[var(--text-muted)]">Optional.</p>
					<label for="rss_schedule_id" class="mt-3 block text-sm font-medium text-[var(--text)]">Schedule</label>
					<select id="rss_schedule_id" name="schedule_id" bind:value={scheduleId} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
						<option value="">None</option>
						{#each data.schedules as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
				</div>
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Status after import</h3>
					<label for="rss_import_status" class="mt-3 block text-sm font-medium text-[var(--text)]">Status</label>
					<select id="rss_import_status" name="import_status" bind:value={importStatus} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
						<option value="draft">Draft</option>
						<option value="scheduled">Scheduled</option>
					</select>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
						onclick={() => document.getElementById('rss-import-step-4')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
					>
						Back to import range
					</button>
				</div>
				<button type="submit" disabled={submittingImport} class="w-full rounded-lg btn-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait min-h-[48px] inline-flex items-center justify-center gap-2 sm:w-auto">
					{#if submittingImport}
						<span class="bulk-create-spinner" aria-hidden="true"></span>
						<span>Importing…</span>
					{:else}
						Import posts
					{/if}
				</button>
			</div>
		</section>
	</form>

	<AddOutputWebhookModal
		bind:open={addWebhookModalOpen}
		bind:headersJson={inlineHeadersJson}
		idPrefix="rss"
		onCreated={(id) => {
			webhookIds = [...webhookIds, id];
		}}
	/>
{/if}
