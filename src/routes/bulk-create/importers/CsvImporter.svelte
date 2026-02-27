<script lang="ts">
	import { enhance } from '$app/forms';
	import SampleJsonViewer from '$lib/components/SampleJsonViewer.svelte';
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
	let webhookId = $state('');
	let scheduleId = $state('');
	let importStatus = $state<'draft' | 'scheduled'>('draft');
	let skipDuplicates = $state(false);
	let submittingUpload = $state(false);
	let submittingPreview = $state(false);
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

	const csvRawLines = $derived(((form as { csv_raw_lines?: string[] })?.csv_raw_lines ?? []) as string[]);
	const sampleRows = $derived(((form as { csv_sample_rows?: Record<string, string>[] })?.csv_sample_rows ?? []) as Record<string, string>[]);
	const hasSampleRows = $derived(csvImportId && sampleRows.length > 0);
	const headers = $derived(csvHeaders.length > 0 ? csvHeaders : Object.keys(sampleRows[0] ?? {}));

	$effect(() => {
		const f = form as { csv_import_id?: string; csv_delimiter?: string; csv_has_header?: boolean; csv_headers?: string[] };
		if (f?.csv_import_id != null) csvImportId = f.csv_import_id;
		if (f?.csv_delimiter != null) csvDelimiter = f.csv_delimiter;
		if (f?.csv_has_header != null) csvHasHeader = Boolean(f.csv_has_header);
		if (Array.isArray(f?.csv_headers)) csvHeaders = f.csv_headers;
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

	{#if csvImportId && csvRawLines.length}
		<section class="mt-10 border-t border-[var(--border)] pt-8">
			<div class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
				<span class="bulk-create-step-pill done">1</span>
				<span class="bulk-create-step-pill active">2</span>
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
		<section class="mt-10 border-t border-[var(--border)] pt-8">
			<div class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
				<span class="bulk-create-step-pill done">1</span>
				<span class="bulk-create-step-pill done">2</span>
				<span class="bulk-create-step-pill active">3</span>
				<span>Map fields and import</span>
			</div>
			<h2 class="mt-4 text-lg font-medium text-[var(--text)]">3. Configure mapping</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">Review the first few rows and map columns to your post fields.</p>
			<div class="mt-4 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
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
			<section class="mt-8 border-t border-[var(--border)] pt-8">
				<h3 class="text-base font-medium text-[var(--text)]">Map fields and import</h3>
				<p class="mt-1 text-sm text-[var(--text-muted)]">Set how each CSV column maps into your posts, choose how many rows to import, then run the import.</p>
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
					class="bulk-create-step3-grid mt-6 gap-8"
				>
					<input type="hidden" name="csv_import_id" value={csvImportId} />
					<input type="hidden" name="delimiter" value={csvDelimiter} />
					<input type="hidden" name="has_header" value={csvHasHeader ? 'true' : 'false'} />
					<input type="hidden" name="custom_mapping" value={customMappingJson()} />
					<input type="hidden" name="filter_rules" value={filterRulesJson()} />

					<div class="min-w-0 space-y-6">
						<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
							<h3 class="text-sm font-semibold text-[var(--text)]">Field mapping</h3>
							<p class="mt-1 text-xs text-[var(--text-muted)]">Map CSV columns to your post fields.</p>
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
								<p class="mt-1 text-xs text-[var(--text-muted)]">Maps into the post's Image URL field.</p>
							</div>
							<div class="mt-8 pt-6 border-t border-[var(--border)]">
								<p class="text-sm font-medium text-[var(--text)]">Custom fields (column → key)</p>
								<p class="mt-1 text-xs text-[var(--text-muted)]">Add extra fields from the CSV row (e.g. <code class="rounded bg-[var(--surface)] px-1">slug</code>, <code class="rounded bg-[var(--surface)] px-1">category</code>).</p>
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
						<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
							<h3 class="text-sm font-semibold text-[var(--text)]">Import range</h3>
							<p class="mt-1 text-xs text-[var(--text-muted)]">Choose which rows to import by start position and count (e.g. start 1, count 10 → rows 1–10).</p>
							<div class="mt-4 grid gap-4 sm:grid-cols-2">
								<div>
									<label for="csv_import_start" class="block text-sm font-medium text-[var(--text)]">Start at row</label>
									<input id="csv_import_start" type="number" name="import_start" bind:value={importStart} min="1" max="500" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
									<p class="mt-0.5 text-xs text-[var(--text-muted)]">1-based index of first row</p>
								</div>
								<div>
									<label for="csv_import_count" class="block text-sm font-medium text-[var(--text)]">Number of rows</label>
									<input id="csv_import_count" type="number" name="per_page" bind:value={perPage} min="1" max="500" class="mt-1 w-full min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]" />
									<p class="mt-0.5 text-xs text-[var(--text-muted)]">Imports rows {importStart}–{Math.min(500, importStart + perPage - 1)}</p>
								</div>
							</div>
						</div>
						<div class="rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]/50">
							<div class="flex items-center gap-2">
								<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)] text-sm font-semibold text-[var(--text-muted)]" aria-hidden="true">◇</span>
								<h3 class="text-sm font-semibold text-[var(--text)]">Import filters</h3>
							</div>
							<p class="mt-2 text-xs text-[var(--text-muted)]">Only rows that pass these checks are imported. Paths are column names such as <code class="rounded bg-[var(--surface)] px-1">Title</code> or <code class="rounded bg-[var(--surface)] px-1">col_1</code>.</p>
							<div class="mt-3 flex flex-wrap items-center gap-2">
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
						<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
							<h3 class="text-sm font-semibold text-[var(--text)]">Destination</h3>
							<div class="mt-4 space-y-4">
								<div>
									<label for="csv_webhook_id" class="block text-sm font-medium text-[var(--text)]">Target webhook *</label>
									<select id="csv_webhook_id" name="webhook_id" bind:value={webhookId} required class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
										<option value="">Select webhook</option>
										{#each data.webhooks as w}
											<option value={w.id}>{w.name}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="csv_schedule_id" class="block text-sm font-medium text-[var(--text)]">Apply schedule after import (optional)</label>
									<select id="csv_schedule_id" name="schedule_id" bind:value={scheduleId} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
										<option value="">None</option>
										{#each data.schedules as s}
											<option value={s.id}>{s.name}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="csv_import_status" class="block text-sm font-medium text-[var(--text)]">Status after import</label>
									<select id="csv_import_status" name="import_status" bind:value={importStatus} class="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">
										<option value="draft">Draft</option>
										<option value="scheduled">Scheduled</option>
									</select>
								</div>
								<label class="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
									<input type="checkbox" name="skip_duplicates" bind:checked={skipDuplicates} value="on" class="rounded border-[var(--border)]" />
									Skip duplicates (don't import if already imported from this CSV)
								</label>
							</div>
							<button type="submit" disabled={submittingImport} class="mt-6 w-full rounded-lg btn-primary px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait min-h-[48px] inline-flex items-center justify-center gap-2 sm:w-auto">
								{#if submittingImport}
									<span class="bulk-create-spinner" aria-hidden="true"></span>
									<span>Importing…</span>
								{:else}
									Import rows
								{/if}
							</button>
						</div>
					</div>
					<aside class="bulk-create-step3-sidebar space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
						<h3 class="text-sm font-semibold text-[var(--text)]">Reference</h3>
						{#if sampleRows.length}
							<div class="space-y-2">
								<p class="font-medium text-[var(--text)]">Example row (JSON)</p>
								<p class="text-xs text-[var(--text-muted)]">Click any key to copy its path (column name) to the clipboard.</p>
								<div class="relative">
									<div class="max-h-[600px] overflow-auto rounded-lg bg-black p-3 text-xs font-mono text-white">
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
							<p class="mt-1 text-xs text-[var(--text-muted)]">Use column names exactly as shown in the header row, or <code class="rounded bg-[var(--surface)] px-1">col_1</code>, <code class="rounded bg-[var(--surface)] px-1">col_2</code> when there is no header.</p>
						</div>
					</aside>
				</form>
			</section>
		</section>
	{/if}
</section>
