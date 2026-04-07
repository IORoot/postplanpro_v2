<script lang="ts">
	import type { ScenarioWithPreview } from './+page.server';

	type Scenario = ScenarioWithPreview;

	const TARGET_LABELS: Record<string, string> = {
		make: 'Make',
		zapier: 'Zapier',
		n8n: 'n8n',
		ifttt: 'IFTTT'
	};

	let { data } = $props();
	const scenarios = $derived(data.scenarios);
	let search = $state('');
	let selectedTarget = $state<string>('all');
	let selectedTags = $state<Set<string>>(new Set());
	let sortKey = $state<'default' | 'az' | 'za'>('default');
	let viewMode = $state<'card' | 'list'>('card');

	const targets = $derived.by(() => {
		const seen = new Set<string>();
		for (const s of scenarios) {
			if (s.target) seen.add(s.target);
		}
		return Array.from(seen).sort();
	});

	const allTags = $derived.by(() => {
		const seen = new Set<string>();
		for (const s of scenarios) {
			for (const t of s.tags ?? []) seen.add(t);
		}
		return Array.from(seen).sort();
	});

	function toggleTag(tag: string) {
		const next = new Set(selectedTags);
		if (next.has(tag)) next.delete(tag);
		else next.add(tag);
		selectedTags = next;
	}

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		let result = scenarios.filter((s) => {
			if (q) {
				const haystack = [s.title, s.description, s.author, s.target, ...(s.tags ?? [])].join(' ').toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			if (selectedTarget !== 'all' && s.target !== selectedTarget) return false;
			if (selectedTags.size > 0) {
				const hasSomeTag = (s.tags ?? []).some((t) => selectedTags.has(t));
				if (!hasSomeTag) return false;
			}
			return true;
		});

		if (sortKey === 'az') result = [...result].sort((a, b) => a.title.localeCompare(b.title));
		else if (sortKey === 'za') result = [...result].sort((a, b) => b.title.localeCompare(a.title));

		return result;
	});

	function clearAllFilters() {
		search = '';
		selectedTarget = 'all';
		selectedTags = new Set();
	}

	function openScenario(link: string) {
		window.open(link, '_blank', 'noopener,noreferrer');
	}

	function tagIconSrc(tag: string): string {
		return `/${tag}.svg`;
	}

	let tagIconErrors = $state<Set<string>>(new Set());

	function onTagIconError(tag: string) {
		tagIconErrors = new Set([...tagIconErrors, tag]);
	}

	/** Make.com og:image failed to load; use inline scenario.image instead */
	let makePreviewFailed = $state<Set<string>>(new Set());

	function onMakePreviewError(link: string) {
		makePreviewFailed = new Set([...makePreviewFailed, link]);
	}

	function useMakePreview(scenario: Scenario): boolean {
		return !!scenario.makePreviewUrl && !makePreviewFailed.has(scenario.link);
	}
</script>

<svelte:head>
	<title>Presets – PostPlan</title>
</svelte:head>

<div class="presets-page">
	<div class="presets-header">
		<div>
			<h1 class="presets-title">Presets</h1>
			<p class="presets-subtitle">Ready-made automation scenarios for Make, Zapier, n8n, and IFTTT.</p>
		</div>
	</div>

	<!-- Toolbar -->
	<div class="presets-toolbar">
		<div class="presets-search-wrap">
			<svg class="presets-search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<circle cx="9" cy="9" r="5.5" stroke="currentColor" stroke-width="1.5"/>
				<line x1="13.2" y1="13.2" x2="17" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
			</svg>
			<input
				class="presets-search"
				type="search"
				placeholder="Search presets…"
				bind:value={search}
				aria-label="Search presets"
			/>
		</div>

		<div class="presets-toolbar-right">
			<select
				class="presets-sort"
				bind:value={sortKey}
				aria-label="Sort order"
			>
				<option value="default">Default</option>
				<option value="az">A–Z</option>
				<option value="za">Z–A</option>
			</select>

			<div class="view-toggle" role="group" aria-label="View mode">
				<button
					class="view-btn {viewMode === 'card' ? 'view-btn-active' : ''}"
					onclick={() => (viewMode = 'card')}
					title="Card view"
					aria-pressed={viewMode === 'card'}
				>
					<svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true">
						<rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
						<rect x="11" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
						<rect x="1" y="11" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
						<rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
					</svg>
				</button>
				<button
					class="view-btn {viewMode === 'list' ? 'view-btn-active' : ''}"
					onclick={() => (viewMode = 'list')}
					title="List view"
					aria-pressed={viewMode === 'list'}
				>
					<svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true">
						<line x1="1" y1="4.5" x2="17" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						<line x1="1" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						<line x1="1" y1="13.5" x2="17" y2="13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			</div>
		</div>
	</div>

	<!-- Filter rows -->
	<div class="presets-filter-rows">
		<div class="presets-filter-row">
			<span class="filter-row-label">Platform</span>
			<div class="presets-filters">
				<button
					class="filter-pill {selectedTarget === 'all' ? 'filter-pill-active' : ''}"
					onclick={() => (selectedTarget = 'all')}
				>
					All
				</button>
				{#each targets as target}
					<button
						class="filter-pill {selectedTarget === target ? 'filter-pill-active' : ''}"
						onclick={() => (selectedTarget = target)}
					>
						<img
							src={`/${target}.svg`}
							alt={TARGET_LABELS[target] ?? target}
							class="filter-pill-icon"
							width="14"
							height="14"
						/>
						{TARGET_LABELS[target] ?? target}
					</button>
				{/each}
			</div>
		</div>

		{#if allTags.length > 0}
			<div class="presets-filter-row">
				<span class="filter-row-label">Tags</span>
				<div class="presets-filters">
					{#each allTags as tag}
						<button
							class="filter-pill filter-pill-tag {selectedTags.has(tag) ? 'filter-pill-active' : ''}"
							onclick={() => toggleTag(tag)}
						>
							{#if !tagIconErrors.has(tag)}
								<img
									src={tagIconSrc(tag)}
									alt={tag}
									class="filter-pill-icon"
									width="14"
									height="14"
									onerror={() => onTagIconError(tag)}
								/>
							{/if}
							{tag}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Results -->
	{#if scenarios.length === 0}
		<div class="presets-empty">
			<p>No presets are configured yet.</p>
		</div>
	{:else if filtered.length === 0}
		<div class="presets-empty">
			<p>No presets match your search.</p>
			<button class="preset-reset-btn" onclick={clearAllFilters}>
				Clear filters
			</button>
		</div>
	{:else if viewMode === 'card'}
		<div class="preset-grid">
			{#each filtered as scenario}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="preset-card" onclick={() => openScenario(scenario.link)} role="button" tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && openScenario(scenario.link)}>
					<div class="preset-card-image" class:preset-card-image-preview={useMakePreview(scenario)}>
						{#if useMakePreview(scenario)}
							<img
								class="preset-make-preview"
								src={scenario.makePreviewUrl}
								alt=""
								loading="lazy"
								decoding="async"
								onerror={() => onMakePreviewError(scenario.link)}
							/>
						{:else}
							{@html scenario.image}
						{/if}
						<div class="preset-target-badge" title={TARGET_LABELS[scenario.target] ?? scenario.target}>
							<img src={`/${scenario.target}.svg`} alt={TARGET_LABELS[scenario.target] ?? scenario.target} width="20" height="20" />
						</div>
					</div>
					<div class="preset-card-body">
						<h3 class="preset-card-title">{scenario.title}</h3>
						<p class="preset-card-desc">{scenario.description}</p>
					</div>
					<div class="preset-card-footer">
						<div class="preset-tags">
							{#each scenario.tags ?? [] as tag}
								{#if !tagIconErrors.has(tag)}
									<span class="preset-tag-icon" title={tag}>
										<img
											src={tagIconSrc(tag)}
											alt={tag}
											width="16"
											height="16"
											onerror={() => onTagIconError(tag)}
										/>
									</span>
								{:else}
									<span class="preset-tag">{tag}</span>
								{/if}
							{/each}
						</div>
						<span class="preset-author">{scenario.author}</span>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="preset-list">
			{#each filtered as scenario}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="preset-list-item" onclick={() => openScenario(scenario.link)} role="button" tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && openScenario(scenario.link)}>
					<div class="preset-list-thumb" class:preset-list-thumb-preview={useMakePreview(scenario)}>
						{#if useMakePreview(scenario)}
							<img
								class="preset-make-preview"
								src={scenario.makePreviewUrl}
								alt=""
								loading="lazy"
								decoding="async"
								onerror={() => onMakePreviewError(scenario.link)}
							/>
						{:else}
							{@html scenario.image}
						{/if}
					</div>
					<div class="preset-list-body">
						<div class="preset-list-header">
							<h3 class="preset-list-title">{scenario.title}</h3>
							<div class="preset-target-badge preset-target-badge-list" title={TARGET_LABELS[scenario.target] ?? scenario.target}>
								<img src={`/${scenario.target}.svg`} alt={TARGET_LABELS[scenario.target] ?? scenario.target} width="20" height="20" />
							</div>
						</div>
						<p class="preset-list-desc">{scenario.description}</p>
						<div class="preset-card-footer">
							<div class="preset-tags">
								{#each scenario.tags ?? [] as tag}
									{#if !tagIconErrors.has(tag)}
										<span class="preset-tag-icon" title={tag}>
											<img
												src={tagIconSrc(tag)}
												alt={tag}
												width="16"
												height="16"
												onerror={() => onTagIconError(tag)}
											/>
										</span>
									{:else}
										<span class="preset-tag">{tag}</span>
									{/if}
								{/each}
							</div>
							<span class="preset-author">{scenario.author}</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.presets-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.presets-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.presets-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text);
		margin: 0;
	}

	.presets-subtitle {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin: 0.25rem 0 0;
	}

	/* Toolbar */
	.presets-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}

	.presets-search-wrap {
		position: relative;
		flex: 1;
		min-width: 180px;
	}

	.presets-search-icon {
		position: absolute;
		left: 0.625rem;
		top: 50%;
		transform: translateY(-50%);
		width: 1rem;
		height: 1rem;
		color: var(--text-muted);
		pointer-events: none;
	}

	.presets-search {
		width: 100%;
		padding: 0.5rem 0.75rem 0.5rem 2rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg);
		color: var(--text);
		font-size: 0.875rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.presets-search:focus {
		border-color: var(--primary);
	}

	.presets-filter-rows {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.presets-filter-row {
		display: flex;
		align-items: flex-start;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.filter-row-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding-top: 0.35rem;
		white-space: nowrap;
		min-width: 4.5rem;
	}

	.presets-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		flex: 1;
	}

	.filter-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text-muted);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.12s, color 0.12s, border-color 0.12s;
		white-space: nowrap;
	}

	.filter-pill:hover {
		color: var(--text);
		background: var(--surface-hover);
		border-color: var(--primary-border-soft);
	}

	.filter-pill-active {
		color: var(--primary);
		background: var(--primary-soft);
		border-color: var(--primary-border-soft);
	}

	.filter-pill-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		object-fit: contain;
	}

	.presets-toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.presets-sort {
		padding: 0.4rem 0.625rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--surface);
		color: var(--text);
		font-size: 0.8125rem;
		cursor: pointer;
		outline: none;
	}

	.view-toggle {
		display: flex;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.view-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 0.5rem;
		background: var(--surface);
		color: var(--text-muted);
		border: none;
		cursor: pointer;
		transition: background 0.12s, color 0.12s;
	}

	.view-btn:first-child {
		border-right: 1px solid var(--border);
	}

	.view-btn:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	.view-btn-active {
		background: var(--primary-soft);
		color: var(--primary);
	}

	/* Empty state */
	.presets-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem 1rem;
		color: var(--text-muted);
		font-size: 0.9375rem;
		text-align: center;
	}

	.preset-reset-btn {
		padding: 0.4rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		font-size: 0.875rem;
		cursor: pointer;
	}

	/* Card grid */
	.preset-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
	}

	@media (min-width: 640px) {
		.preset-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1280px) {
		.preset-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.preset-card {
		display: flex;
		flex-direction: column;
		border-radius: 0.875rem;
		border: 1px solid var(--border);
		background: var(--surface);
		overflow: hidden;
		cursor: pointer;
		transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
		outline: none;
	}

	.preset-card:hover,
	.preset-card:focus-visible {
		border-color: var(--primary-border-soft);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		transform: translateY(-2px);
	}

	.preset-card-image {
		position: relative;
		aspect-ratio: 16 / 9;
		background: var(--bg);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 0.875rem;
		box-sizing: border-box;
	}

	.preset-card-image-preview {
		padding: 0;
		background: #fff;
	}

	.preset-make-preview {
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
	}

	.preset-card-image :global(svg) {
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.preset-target-badge {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.preset-target-badge img {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}

	.preset-card-body {
		flex: 1;
		padding: 0.875rem 1rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.preset-card-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		-webkit-box-orient: vertical;
	}

	.preset-card-desc {
		font-size: 0.8125rem;
		color: var(--text-muted);
		margin: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		line-height: 1.5;
	}

	.preset-card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem 0.875rem;
		gap: 0.5rem;
	}

	.preset-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
	}

	.preset-tag-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 0.375rem;
		background: var(--bg);
		border: 1px solid var(--border);
		flex-shrink: 0;
	}

	.preset-tag-icon img {
		width: 14px;
		height: 14px;
		object-fit: contain;
	}

	.preset-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: var(--bg);
		border: 1px solid var(--border);
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.preset-author {
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* List view */
	.preset-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.preset-list-item {
		display: flex;
		gap: 1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--border);
		background: var(--surface);
		padding: 0.875rem;
		cursor: pointer;
		transition: box-shadow 0.15s, border-color 0.15s;
		outline: none;
		align-items: flex-start;
	}

	.preset-list-item:hover,
	.preset-list-item:focus-visible {
		border-color: var(--primary-border-soft);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
	}

	.preset-list-thumb {
		width: 80px;
		height: 80px;
		border-radius: 0.5rem;
		background: var(--bg);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		flex-shrink: 0;
		border: 1px solid var(--border);
	}

	.preset-list-thumb :global(svg) {
		width: 80px;
		height: 80px;
	}

	.preset-list-thumb-preview {
		padding: 0;
		background: #fff;
	}

	.preset-list-thumb .preset-make-preview {
		object-fit: cover;
	}

	.preset-list-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.preset-list-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.preset-list-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}

	.preset-target-badge-list {
		position: static;
		flex-shrink: 0;
	}

	.preset-list-desc {
		font-size: 0.8125rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.6;
	}

	.preset-list-item .preset-card-footer {
		padding: 0.25rem 0 0;
	}
</style>
