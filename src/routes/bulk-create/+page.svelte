<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let siteUrl = $state('');
	let auth = $state('');
	let perPage = $state(10);
	let titlePath = $state('title.rendered');
	let contentPath = $state('content.rendered');
	let customMappings = $state<{ path: string; key: string; type: string }[]>([]);
	let webhookId = $state('');
	let scheduleId = $state('');

	// After fetch, sync URL/auth/per_page from action result so import form has them
	$effect(() => {
		if (form?.fetched) {
			const f = form as { site_url?: string; auth?: string; per_page?: number };
			if (f.site_url != null) siteUrl = f.site_url;
			if (f.auth != null) auth = f.auth;
			if (f.per_page != null) perPage = f.per_page;
		}
	});

	function addCustomMapping() {
		customMappings = [...customMappings, { path: '', key: '', type: 'string' }];
	}
	function removeCustomMapping(i: number) {
		customMappings = customMappings.filter((_, idx) => idx !== i);
	}
	function customMappingJson() {
		return JSON.stringify(customMappings.filter((m) => m.path.trim() && m.key.trim()));
	}

	// Flatten keys from sample for suggestions
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
	const sample = form?.fetched && (form as { sample?: unknown }).sample ? (form as { sample: unknown }).sample : null;
	const keys = $derived(sample ? sampleKeys(sample) : []);
</script>

<svelte:head>
	<title>Bulk create – PostPlan</title>
</svelte:head>

<h1 class="text-2xl font-bold text-[var(--text)]">Bulk create from WordPress</h1>
<p class="mt-1 text-sm text-[var(--text-muted)]">Connect to a WordPress REST API, map fields, then import posts.</p>

{#if form?.error && !form?.fetched}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
{/if}

<!-- Step 1: Fetch -->
<section class="mt-8">
	<h2 class="text-lg font-medium text-[var(--text)]">1. Connect and fetch</h2>
	<form method="POST" action="?/fetchWordPress" use:enhance class="mt-4 max-w-2xl space-y-4">
		<div>
			<label for="site_url" class="block text-sm font-medium text-[var(--text)]">WordPress site URL *</label>
			<input id="site_url" type="url" name="site_url" bind:value={siteUrl} required placeholder="https://yoursite.com" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
		</div>
		<div>
			<label for="auth" class="block text-sm font-medium text-[var(--text)]">Authorization (optional)</label>
			<input id="auth" type="password" name="auth" bind:value={auth} placeholder="Application password or Bearer token" autocomplete="off" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
		</div>
		<div>
			<label for="per_page" class="block text-sm font-medium text-[var(--text)]">Posts to fetch</label>
			<input id="per_page" type="number" name="per_page" bind:value={perPage} min="1" max="100" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
		</div>
		<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]">Fetch posts</button>
	</form>
</section>

<!-- Step 2: Mapping and import (after fetch) -->
{#if form?.fetched}
	<section class="mt-10 border-t border-[var(--border)] pt-8">
		<h2 class="text-lg font-medium text-[var(--text)]">2. Map fields and import</h2>
		{#if (form as { posts?: number })?.posts != null}
			<p class="mt-1 text-sm text-[var(--text-muted)]">Fetched {(form as { posts: number }).posts} post(s). Set paths (e.g. title.rendered) and choose webhook.</p>
		{/if}

		<form method="POST" action="?/importFromWordPress" use:enhance class="mt-4 max-w-2xl space-y-4">
			<input type="hidden" name="site_url" value={siteUrl} />
			<input type="hidden" name="auth" value={auth} />
			<input type="hidden" name="per_page" value={perPage} />
			<input type="hidden" name="custom_mapping" value={customMappingJson()} />

			<div>
				<label for="title_path" class="block text-sm font-medium text-[var(--text)]">Title path</label>
				<input id="title_path" type="text" name="title_path" bind:value={titlePath} list="title_paths" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
				<datalist id="title_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
			</div>
			<div>
				<label for="content_path" class="block text-sm font-medium text-[var(--text)]">Content path</label>
				<input id="content_path" type="text" name="content_path" bind:value={contentPath} list="content_paths" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
				<datalist id="content_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
			</div>

			<div>
				<p class="text-sm font-medium text-[var(--text)]">Custom fields (response path → key)</p>
				<div class="mt-2 space-y-2">
					{#each customMappings as m, i}
						<div class="flex flex-wrap gap-2">
							<input type="text" bind:value={m.path} placeholder="e.g. excerpt.rendered" list="custom_paths" class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-w-[140px] min-h-[44px]" />
							<input type="text" bind:value={m.key} placeholder="Key" class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-w-[100px] min-h-[44px]" />
							<select bind:value={m.type} class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
								<option value="string">string</option>
								<option value="number">number</option>
								<option value="boolean">boolean</option>
								<option value="json">json</option>
							</select>
							<button type="button" onclick={() => removeCustomMapping(i)} class="rounded border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] min-h-[44px]">Remove</button>
						</div>
					{/each}
				</div>
				<datalist id="custom_paths">
					{#each keys as k}
						<option value={k}></option>
					{/each}
				</datalist>
				<button type="button" onclick={addCustomMapping} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add custom field</button>
			</div>

			<div>
				<label for="webhook_id" class="block text-sm font-medium text-[var(--text)]">Target webhook *</label>
				<select id="webhook_id" name="webhook_id" bind:value={webhookId} required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
					<option value="">Select webhook</option>
					{#each data.webhooks as w}
						<option value={w.id}>{w.name}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="schedule_id" class="block text-sm font-medium text-[var(--text)]">Apply schedule after import (optional)</label>
				<select id="schedule_id" name="schedule_id" bind:value={scheduleId} class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
					<option value="">None</option>
					{#each data.schedules as s}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
			</div>

			<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]">Import posts</button>
		</form>
	</section>
{/if}
