<script lang="ts">
	import { enhance } from '$app/forms';
	import SampleJsonViewer from '$lib/components/SampleJsonViewer.svelte';
	import AddOutputWebhookModal from '$lib/components/importers/AddOutputWebhookModal.svelte';
	import ImportStepPills from '$lib/components/importers/ImportStepPills.svelte';
	import {
		FILTER_OPERATORS,
		filterRulesJson as filterRulesJsonUtil,
		customMappingJson as customMappingJsonUtil,
		type CustomMapping,
		type FilterRule
	} from '$lib/importers/importerUtils.js';

	let { data, form } = $props();

	let csvImportId = $state('');
	let csvDelimiter = $state(',');
	let csvHasHeader = $state(true);
	let csvHeaders = $state<string[]>([]);
	let csvTitleColumn = $state('');
	let csvContentColumn = $state('');
	let csvImageUrlColumn = $state('');
	let perPage = $state(10);
	let importStart = $state(1);
	let customMappings = $state<CustomMapping[]>([]);
	let filterCombine = $state<'and' | 'or'>('and');
	let filterRules = $state<FilterRule[]>([]);
	let webhookIds = $state<string[]>([]);
	let scheduleId = $state('');
	let importStatus = $state<'draft' | 'scheduled'>('draft');
	let skipDuplicates = $state(false);
	let submittingUpload = $state(false);
	let submittingPreview = $state(false);
	let submittingImport = $state(false);
	let showCopiedToast = $state(false);
	let copyToastTimeout: ReturnType<typeof setTimeout> | null = null;
	let addWebhookModalOpen = $state(false);
	let inlineHeadersJson = $state('[]');
	let importFlowUnlocked = $state<3 | 4 | 5 | 6>(3);
	let importFlowSeenSample = $state(false);

	function handleCopiedToClipboard() {
		if (copyToastTimeout) clearTimeout(copyToastTimeout);
		showCopiedToast = true;
		copyToastTimeout = setTimeout(() => {
			showCopiedToast = false;
			copyToastTimeout = null;
		}, 2000);
	}

	const csvRawLines = $derived(((form as { csv_raw_lines?: string[] })?.csv_raw_lines ?? []) as string[]);
	const sampleRows = $derived(((form as { csv_sample_rows?: Record<string, string>[] })?.csv_sample_rows ?? []) as Record<string, string>[]);
	const hasSampleRows = $derived(Boolean(csvImportId && sampleRows.length > 0));
	const headers = $derived(csvHeaders.length > 0 ? csvHeaders : Object.keys(sampleRows[0] ?? {}));

	const importFocusStep = $derived(
		!csvImportId ? 1 : !hasSampleRows ? 2 : importFlowUnlocked
	) as 1 | 2 | 3 | 4 | 5 | 6;

	$effect(() => {
		const f = form as { csv_import_id?: string; csv_delimiter?: string; csv_has_header?: boolean; csv_headers?: string[] };
		if (f?.csv_import_id != null) csvImportId = f.csv_import_id;
		if (f?.csv_delimiter != null) csvDelimiter = f.csv_delimiter;
		if (f?.csv_has_header != null) csvHasHeader = Boolean(f.csv_has_header);
		if (Array.isArray(f?.csv_headers)) csvHeaders = f.csv_headers;
	});

	$effect(() => {
		if (!hasSampleRows) {
			importFlowSeenSample = false;
			return;
		}
		if (!importFlowSeenSample) {
			importFlowUnlocked = 3;
			importFlowSeenSample = true;
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

<section id="csv-import-step-1" class="scroll-mt-8 mt-8">
	<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
		<ImportStepPills sectionStep={1} focusStep={importFocusStep} totalSteps={6} />
		<span>Upload CSV</span>
	</div>
	<h2 class="mt-4 text-lg font-medium text-[var(--text)]">1. Choose file</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Upload a CSV file to import. You can then adjust the delimiter and header settings and preview the first few rows.</p>
	<form
		method="POST"
		action="?/discoverCsv"
		enctype="multipart/form-data"
		use:enhance={() => {
			submittingUpload = true;
			return async ({ update }) => {
				await update();
				submittingUpload = false;
			};
		}}
		class="mt-4 max-w-2xl space-y-4"
	>
		<input type="hidden" name="csv_import_id" value={csvImportId} />
		<div>
			<label for="csv_file" class="block text-sm font-medium text-[var(--text)]">CSV file {csvImportId ? '(optional to replace)' : '*'}</label>
			<input
				id="csv_file"
				type="file"
				name="csv_file"
				accept=".csv,text/csv"
				class="mt-1 block w-full text-sm text-[var(--text)] file:mr-3 file:rounded-lg file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--text)] hover:file:bg-[var(--surface-hover)]"
			/>
			<p class="mt-1 text-xs text-[var(--text-muted)]">UTF-8 CSV. Max a few MB.</p>
		</div>
		<button type="submit" disabled={submittingUpload} class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
			{#if submittingUpload}
				<span class="bulk-create-spinner" aria-hidden="true"></span>
				<span>Uploading…</span>
			{:else}
				{csvImportId ? 'Replace file' : 'Upload file'}
			{/if}
		</button>
	</form>
</section>

{#if csvImportId && csvRawLines.length}
	<section id="csv-import-step-2" class="scroll-mt-8 mt-10 border-t border-[var(--border)] pt-8">
		<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
			<ImportStepPills sectionStep={2} focusStep={importFocusStep} totalSteps={6} />
			<span>Choose delimiter and header row</span>
		</div>
		<h2 class="mt-4 text-lg font-medium text-[var(--text)]">2. Delimiter & headers</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Check how the first two lines look, then pick the delimiter and whether the first row is column headers.</p>
		<div class="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs font-mono text-[var(--text)]">
			{#each csvRawLines as line, i}
				<p class="truncate"><span class="mr-2 text-[var(--text-muted)]">{i + 1}:</span>{line}</p>
			{/each}
		</div>
		<form
			method="POST"
			action="?/discoverCsv"
			use:enhance={() => {
				submittingPreview = true;
				return async ({ update }) => {
					await update();
					submittingPreview = false;
				};
			}}
			class="mt-4 max-w-2xl space-y-4"
		>
			<input type="hidden" name="csv_import_id" value={csvImportId} />
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="csv_delimiter" class="block text-sm font-medium text-[var(--text)]">Delimiter</label>
					<select
						id="csv_delimiter"
						name="csv_delimiter_choice"
						bind:value={csvDelimiter}
						class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"
					>
						<option value=",">Comma (,)</option>
						<option value=";">Semicolon (;)</option>
						<option value="\t">Tab</option>
					</select>
					<p class="mt-1 text-xs text-[var(--text-muted)]">Or enter a custom delimiter below.</p>
					<input type="text" name="delimiter" bind:value={csvDelimiter} maxlength="4" class="mt-1 w-full min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)]" placeholder="," />
				</div>
				<div class="flex items-end">
					<label class="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
						<input type="checkbox" name="has_header" bind:checked={csvHasHeader} class="rounded border-[var(--border)]" />
						First row is column headers
					</label>
				</div>
			</div>
			<button type="submit" disabled={submittingPreview} class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-wait min-h-[44px] inline-flex items-center justify-center gap-2">
				{#if submittingPreview}
					<span class="bulk-create-spinner" aria-hidden="true"></span>
					<span>Preview columns</span>
				{:else}
					Preview columns
				{/if}
			</button>
		</form>
	</section>
{/if}

{#if hasSampleRows}
	<div class="mt-10 border-t border-[var(--border)] pt-8">
		<p class="text-sm text-[var(--text-muted)]">Preview</p>
		<div class="mt-2 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
			<table class="min-w-full text-left text-xs text-[var(--text)]">
				<thead class="bg-[var(--surface-hover)]">
					<tr>
						{#each headers as h}
							<th class="px-3 py-2 font-semibold border-b border-[var(--border)]">{h}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sampleRows.slice(0, 5) as row}
						<tr>
							{#each headers as h}
								<td class="px-3 py-1 border-b border-[var(--border)] text-[var(--text-muted)] truncate max-w-[200px]">{row[h]}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<form
		method="POST"
		action="?/importFromCsv"
		use:enhance={() => {
			submittingImport = true;
			return async ({ update }) => {
				await update();
				submittingImport = false;
			};
		}}
		class="mt-10 space-y-10 border-t border-[var(--border)] pt-8"
	>
		<input type="hidden" name="csv_import_id" value={csvImportId} />
		<input type="hidden" name="delimiter" value={csvDelimiter} />
		<input type="hidden" name="has_header" value={csvHasHeader ? 'true' : 'false'} />
		<input type="hidden" name="custom_mapping" value={customMappingJson()} />
		<input type="hidden" name="filter_rules" value={filterRulesJson()} />

		<section id="csv-import-step-3" class="scroll-mt-8">
			<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
				<ImportStepPills sectionStep={3} focusStep={importFocusStep} totalSteps={6} />
				<span>Map fields</span>
			</div>
			<h2 class="mt-4 text-lg font-medium text-[var(--text)]">3. Map fields</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Map CSV columns to your post fields. Use the reference panel for column paths.</p>
			<div class="bulk-create-step3-grid mt-6 gap-8">
				<div class="min-w-0 space-y-6">
					<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
						<h3 class="text-sm font-semibold text-[var(--text)]">Field mapping</h3>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							<div>
								<label for="csv_title_column" class="block text-sm font-medium text-[var(--text)]">Title column</label>
								<select id="csv_title_column" name="title_column" bind:value={csvTitleColumn} required class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
									<option value="">Select column</option>
									{#each headers as h}
										<option value={h}>{h}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="csv_content_column" class="block text-sm font-medium text-[var(--text)]">Content column</label>
								<select id="csv_content_column" name="content_column" bind:value={csvContentColumn} class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
									<option value="">(optional)</option>
									{#each headers as h}
										<option value={h}>{h}</option>
									{/each}
								</select>
							</div>
						</div>
						<div class="mt-4">
							<label for="csv_image_url_column" class="block text-sm font-medium text-[var(--text)]">Image URL column (optional)</label>
							<select id="csv_image_url_column" name="image_url_column" bind:value={csvImageUrlColumn} class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
								<option value="">(none)</option>
								{#each headers as h}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>
						<div class="mt-8 pt-6 border-t border-[var(--border)]">
							<p class="text-sm font-medium text-[var(--text)]">Custom fields (column → key)</p>
							<div class="mt-2 space-y-3">
								{#each customMappings as m, i}
									<div class="flex flex-wrap items-end gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2">
										<input type="text" bind:value={m.path} placeholder="column name or expression" list="csv_custom_paths" class="min-w-[180px] min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
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
							<datalist id="csv_custom_paths">
								{#each headers as h}
									<option value={h}></option>
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
					{#if sampleRows.length}
						<div class="space-y-2">
							<p class="font-medium text-[var(--text)]">Example row (JSON)</p>
							<div class="relative">
								<div class="max-h-[600px] overflow-auto rounded-lg bg-neutral-950 p-3 text-xs font-mono text-neutral-50">
									<SampleJsonViewer data={sampleRows[0]} onCopied={handleCopiedToClipboard} />
								</div>
								{#if showCopiedToast}
									<p class="mt-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-center text-xs font-medium text-white shadow-sm" role="status">Copied to clipboard</p>
								{/if}
							</div>
						</div>
					{/if}
					<div class="pt-2 border-t border-[var(--border)]">
						<p class="font-medium text-[var(--text)]">How to reference</p>
						<p class="mt-1 text-xs text-[var(--text-muted)]">Use column names from the header row, or <code class="rounded bg-[var(--surface)] px-1">col_1</code> when there is no header.</p>
					</div>
				</aside>
			</div>
			<div class="mt-6 flex flex-wrap gap-2">
				<button
					type="button"
					class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
					onclick={() => {
						importFlowUnlocked = 4;
						document.getElementById('csv-import-step-4')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}}
				>
					Continue to import filters
				</button>
			</div>
		</section>

		<section id="csv-import-step-4" class="scroll-mt-8" hidden={importFlowUnlocked < 4}>
			<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
				<ImportStepPills sectionStep={4} focusStep={importFocusStep} totalSteps={6} />
				<span>Import filters</span>
			</div>
			<h2 class="mt-4 text-lg font-medium text-[var(--text)]">4. Import filters</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Only rows that pass these checks are imported.</p>
			<div class="importer-panel-filters mt-4">
				<div class="mt-1 flex flex-wrap items-center gap-2">
					<label for="csv_filter_combine" class="text-sm text-[var(--text-muted)]">Match</label>
					<select id="csv_filter_combine" bind:value={filterCombine} class="min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
						<option value="and">all rules (AND)</option>
						<option value="or">any rule (OR)</option>
					</select>
				</div>
				<div class="mt-3 space-y-2">
					{#each filterRules as rule, i}
						<div class="flex flex-wrap items-end gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2">
							<input type="text" bind:value={rule.path} placeholder="Column name" list="csv_filter_paths" class="min-w-[160px] min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
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
				<datalist id="csv_filter_paths">
					{#each headers as h}
						<option value={h}></option>
					{/each}
				</datalist>
				<button type="button" onclick={addFilterRule} class="mt-2 min-h-[40px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">+ Add filter rule</button>
			</div>
			<div class="mt-6 flex flex-wrap gap-2">
				<button type="button" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]" onclick={() => document.getElementById('csv-import-step-3')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Back to map fields</button>
				<button
					type="button"
					class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
					onclick={() => {
						importFlowUnlocked = 5;
						document.getElementById('csv-import-step-5')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}}
				>
					Continue to import range
				</button>
			</div>
		</section>

		<section id="csv-import-step-5" class="scroll-mt-8" hidden={importFlowUnlocked < 5}>
			<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
				<ImportStepPills sectionStep={5} focusStep={importFocusStep} totalSteps={6} />
				<span>Import range</span>
			</div>
			<h2 class="mt-4 text-lg font-medium text-[var(--text)]">5. Import range</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Choose which rows to import.</p>
			<div class="importer-panel-filters mt-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="csv_import_start" class="block text-sm font-medium text-[var(--text)]">Start at row</label>
						<input id="csv_import_start" type="number" name="import_start" bind:value={importStart} min="1" max="500" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
					</div>
					<div>
						<label for="csv_import_count" class="block text-sm font-medium text-[var(--text)]">Number of rows</label>
						<input id="csv_import_count" type="number" name="per_page" bind:value={perPage} min="1" max="500" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
						<p class="mt-0.5 text-xs text-[var(--text-muted)]">Imports rows {importStart}–{Math.min(500, importStart + perPage - 1)}</p>
					</div>
				</div>
				<label class="mt-5 flex cursor-pointer items-center gap-2 border-t border-[var(--border)] pt-4 text-sm text-[var(--text)]">
					<input type="checkbox" name="skip_duplicates" bind:checked={skipDuplicates} value="on" class="rounded border-[var(--border)]" />
					Skip duplicates (don't import if already imported from this CSV)
				</label>
			</div>
			<div class="mt-6 flex flex-wrap gap-2">
				<button type="button" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]" onclick={() => document.getElementById('csv-import-step-4')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Back to import filters</button>
				<button
					type="button"
					class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white min-h-[44px]"
					onclick={() => {
						importFlowUnlocked = 6;
						document.getElementById('csv-import-step-6')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}}
				>
					Continue to destination
				</button>
			</div>
		</section>

		<section id="csv-import-step-6" class="scroll-mt-8" hidden={importFlowUnlocked < 6}>
			<div class="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
				<ImportStepPills sectionStep={6} focusStep={importFocusStep} totalSteps={6} />
				<span>Destination and after import</span>
			</div>
			<h2 class="mt-4 text-lg font-medium text-[var(--text)]">6. Destination and after import</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Optional webhooks, schedule, and status.</p>
			<div class="mt-6 space-y-6">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Destination</h3>
					<div class="mt-4 space-y-3">
						<p class="block text-sm font-medium text-[var(--text)]">Target webhooks (optional)</p>
						{#if webhookIds.length === 0}
							<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
								No webhook selected: posts stay in PostPlan until you attach an output webhook.
							</p>
						{/if}
						<div class="flex flex-wrap gap-2">
							<button type="button" onclick={() => (addWebhookModalOpen = true)} class="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]">Add webhook</button>
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
					<label for="csv_schedule_id" class="mt-3 block text-sm font-medium text-[var(--text)]">Schedule</label>
					<select id="csv_schedule_id" name="schedule_id" bind:value={scheduleId} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
						<option value="">None</option>
						{#each data.schedules as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
				</div>
				<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
					<h3 class="text-sm font-semibold text-[var(--text)]">Status after import</h3>
					<label for="csv_import_status" class="mt-3 block text-sm font-medium text-[var(--text)]">Status</label>
					<select id="csv_import_status" name="import_status" bind:value={importStatus} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
						<option value="draft">Draft</option>
						<option value="scheduled">Scheduled</option>
					</select>
				</div>
				<button type="button" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]" onclick={() => document.getElementById('csv-import-step-5')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Back to import range</button>
				<button type="submit" disabled={submittingImport} class="w-full rounded-lg btn-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait min-h-[48px] inline-flex items-center justify-center gap-2 sm:w-auto">
					{#if submittingImport}
						<span class="bulk-create-spinner" aria-hidden="true"></span>
						<span>Importing…</span>
					{:else}
						Import rows
					{/if}
				</button>
			</div>
		</section>
	</form>

	<AddOutputWebhookModal
		bind:open={addWebhookModalOpen}
		bind:headersJson={inlineHeadersJson}
		idPrefix="csv"
		onCreated={(id) => {
			webhookIds = [...webhookIds, id];
		}}
	/>
{/if}
