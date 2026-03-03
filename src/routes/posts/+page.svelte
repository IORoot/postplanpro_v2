<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let sendingId = $state<string | null>(null);
	let sendError = $state<string | null>(null);
	let selectedIds = $state<Set<string>>(new Set());
	let bulkActionError = $state<string | null>(null);
	let searchQuery = $state('');
	let copiedId = $state<string | null>(null);

	async function copyPostId(id: string) {
		try {
			await navigator.clipboard.writeText(id);
			copiedId = id;
			setTimeout(() => (copiedId = null), 2000);
		} catch {
			// ignore
		}
	}

	const searchLower = $derived(searchQuery.trim().toLowerCase());
	const filteredPosts = $derived(
		searchLower
			? data.posts.filter(
					(p) =>
						(p.title ?? '').toLowerCase().includes(searchLower) ||
						(p.webhook_name ?? '').toLowerCase().includes(searchLower) ||
						(p.content ?? '').toLowerCase().includes(searchLower) ||
						(p.status ?? '').toLowerCase().includes(searchLower)
				)
			: data.posts
	);

	function toggleSelection(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleAll() {
		if (selectedIds.size === filteredPosts.length && filteredPosts.length > 0) selectedIds = new Set();
		else selectedIds = new Set(filteredPosts.map((p) => p.id));
	}

	function clearSelection() {
		selectedIds = new Set();
	}

	const allSelected = $derived(filteredPosts.length > 0 && selectedIds.size === filteredPosts.length);
	const someSelected = $derived(selectedIds.size > 0);

	async function sendNow(postId: string) {
		sendingId = postId;
		sendError = null;
		try {
			const res = await fetch(`/api/posts/${postId}/send`, { method: 'POST' });
			const result = await res.json();
			if (result.success) {
				invalidateAll();
			} else {
				sendError = result.error ?? 'Send failed';
			}
		} catch (e) {
			sendError = e instanceof Error ? e.message : 'Request failed';
		} finally {
			sendingId = null;
		}
	}
</script>

<svelte:head>
	<title>Posts – PostPlan</title>
</svelte:head>

<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<h1 class="text-2xl font-bold text-[var(--text)]">Posts</h1>
	<a href="/posts/new" class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm min-h-[44px] inline-flex items-center justify-center w-fit">+ New post</a>
</div>

<!-- Filters -->
<form method="get" action="/posts" class="mt-4 flex flex-wrap gap-2">
	<select name="status" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] min-h-[44px] shadow-sm">
		<option value="">All statuses</option>
		<option value="draft" selected={data.filters.status === 'draft'}>Draft</option>
		<option value="scheduled" selected={data.filters.status === 'scheduled'}>Scheduled</option>
		<option value="sent" selected={data.filters.status === 'sent'}>Sent</option>
		<option value="failed" selected={data.filters.status === 'failed'}>Failed</option>
	</select>
	<select name="webhook" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] min-h-[44px] shadow-sm">
		<option value="">All webhooks</option>
		{#each data.webhooks as w}
			<option value={w.id} selected={data.filters.webhookId === w.id}>{w.name}</option>
		{/each}
	</select>
	<select name="scheduled" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] min-h-[44px] shadow-sm">
		<option value="">Any</option>
		<option value="yes" selected={data.filters.scheduled === 'yes'}>Scheduled</option>
		<option value="no" selected={data.filters.scheduled === 'no'}>Unscheduled</option>
	</select>
	<button type="submit" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] shadow-sm">Filter</button>
</form>

<div class="mt-3">
	<input
		id="posts-search"
		type="search"
		aria-label="Search posts"
		placeholder="Search posts by title, webhook, content, status…"
		bind:value={searchQuery}
		class="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] min-h-[44px] shadow-sm"
		autocomplete="off"
	/>
	{#if searchQuery.trim()}
		<p class="mt-1 text-xs text-[var(--text-muted)]">{filteredPosts.length} of {data.posts.length} post{data.posts.length === 1 ? '' : 's'}</p>
	{/if}
</div>

{#if sendError}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{sendError}</p>
{/if}

{#if someSelected}
	<div class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
		<span class="text-sm font-medium text-[var(--text)]">{selectedIds.size} selected</span>
		<button type="button" class="text-sm text-[var(--text-muted)] hover:underline" onclick={clearSelection}>Clear</button>
		<form method="post" action="?/bulkDelete" use:enhance={({ cancel }) => { if (!confirm('Permanently delete the selected posts?')) cancel(); bulkActionError = null; return async ({ result }) => { if (result.type === 'success') { clearSelection(); await invalidateAll(); } else if (result.type === 'failure' && result.data && typeof (result.data as { error?: string }).error === 'string') bulkActionError = (result.data as { error: string }).error; }; }} class="inline-flex items-center gap-2">
			{#each [...selectedIds] as id}<input type="hidden" name="ids" value={id} />{/each}
			<button type="submit" class="rounded-lg border border-red-400 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/30">Delete</button>
		</form>
		<form method="post" action="?/bulkUpdateSchedule" use:enhance={() => { bulkActionError = null; return async ({ result }) => { if (result.type === 'success') { clearSelection(); await invalidateAll(); } else if (result.type === 'failure' && result.data && typeof (result.data as { error?: string }).error === 'string') bulkActionError = (result.data as { error: string }).error; }; }} class="inline-flex items-center gap-2">
			{#each [...selectedIds] as id}<input type="hidden" name="ids" value={id} />{/each}
			<select name="schedule_id" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
				<option value="">No schedule</option>
				{#each data.schedules ?? [] as sched}
					<option value={sched.id}>{sched.name}</option>
				{/each}
			</select>
			<button type="submit" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]">Change schedule</button>
		</form>
		<form method="post" action="?/bulkUpdateWebhook" use:enhance={() => { bulkActionError = null; return async ({ result }) => { if (result.type === 'success') { clearSelection(); await invalidateAll(); } else if (result.type === 'failure' && result.data && typeof (result.data as { error?: string }).error === 'string') bulkActionError = (result.data as { error: string }).error; }; }} class="inline-flex items-center gap-2">
			{#each [...selectedIds] as id}<input type="hidden" name="ids" value={id} />{/each}
			<select name="webhook_id" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" required>
				<option value="">Choose webhook…</option>
				{#each data.webhooks ?? [] as wh}
					<option value={wh.id}>{wh.name}</option>
				{/each}
			</select>
			<button type="submit" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]">Change webhook</button>
		</form>
	</div>
	{#if bulkActionError}<p class="mt-2 text-sm text-red-600 dark:text-red-400">{bulkActionError}</p>{/if}
{/if}

<!-- List as cards -->
<div class="mt-6 space-y-4">
	{#if data.posts.length === 0}
		<div class="content-card rounded-xl p-6 text-center">
			<p class="text-[var(--text-muted)]">No posts yet. <a href="/posts/new" class="font-medium text-[var(--primary)] hover:underline">Create one</a>.</p>
		</div>
	{:else if filteredPosts.length === 0}
		<div class="content-card rounded-xl p-6 text-center">
			<p class="text-[var(--text-muted)]">No posts match your search.{#if searchQuery.trim()} <button type="button" class="font-medium text-[var(--primary)] hover:underline" onclick={() => (searchQuery = '')}>Clear search</button>{/if}</p>
		</div>
	{:else}
		<div class="flex items-center gap-3 pb-2">
			<label class="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
				<input type="checkbox" checked={allSelected} onchange={toggleAll} class="rounded border-[var(--border)]" />
				Select all
			</label>
		</div>
		{#each filteredPosts as post}
			{@const statusClass = post.status === 'draft' ? 'status-draft' : post.status === 'scheduled' ? 'status-scheduled' : post.status === 'sent' ? 'status-sent' : 'status-failed'}
			<div
				class="content-card content-card-accent rounded-xl p-4"
				style={`background-color: ${post.color ?? '#ffffff'}; border-left-color: ${post.color ?? 'var(--primary)'};`}
			>
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0 flex flex-1 items-start gap-3">
						<label class="flex items-center shrink-0 cursor-pointer" title="Select for bulk action">
							<input type="checkbox" checked={selectedIds.has(post.id)} onchange={() => toggleSelection(post.id)} class="rounded border-[var(--border)]" />
						</label>
						{#if post.image_url}
							<img src={post.image_url} alt={"Preview for " + post.title} class="h-14 w-14 rounded object-cover border border-[var(--border)]" loading="lazy" />
						{/if}
						<div class="min-w-0 flex-1">
						<a href="/posts/{post.id}" class="font-semibold text-[var(--primary)] hover:underline">{post.title}</a>
							<div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
							<span>{post.webhook_name}</span>
							<span>{post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : '—'}</span>
							<span class="rounded px-2 py-0.5 text-xs font-medium {statusClass}">{post.status}</span>
						</div>
					</div>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onclick={() => copyPostId(post.id)}
							class="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded px-2 py-1.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
							title="Copy post ID"
						>
							{copiedId === post.id ? 'Copied!' : post.id}
						</button>
						<button
							type="button"
							disabled={sendingId === post.id}
							onclick={() => sendNow(post.id)}
							class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 min-h-[44px]"
							title="Send post JSON to target now"
						>
							{sendingId === post.id ? 'Sending…' : 'Send'}
						</button>
						<a href="/posts/{post.id}" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center">Edit</a>
						<form method="POST" action="?/deletePost" use:enhance={({ cancel }) => { if (!confirm('Permanently delete this post?')) cancel(); return () => invalidateAll(); }} class="inline">
							<input type="hidden" name="id" value={post.id} />
							<button type="submit" class="rounded-lg border border-red-400 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/30 min-h-[44px]">Delete</button>
						</form>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
