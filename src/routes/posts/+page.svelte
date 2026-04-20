<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data } = $props();
	let sendingId = $state<string | null>(null);
	let sendError = $state<string | null>(null);
	let selectedIds = $state<Set<string>>(new Set());
	let bulkActionError = $state<string | null>(null);
	let searchQuery = $state('');
	let copiedId = $state<string | null>(null);
	let copyFailedId = $state<string | null>(null);

	function parseScheduledUtc(value: string): Date {
		const normalized = value.trim().replace(' ', 'T');
		if (/[zZ]$/.test(normalized) || /[+-]\d{2}:?\d{2}$/.test(normalized)) return new Date(normalized);
		return new Date(`${normalized}Z`);
	}

	function formatScheduledAt(value: string): string {
		const d = parseScheduledUtc(value);
		return new Intl.DateTimeFormat(undefined, {
			timeZone: data.timezone,
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(d);
	}

	async function copyPostId(id: string) {
		copyFailedId = null;
		try {
			await navigator.clipboard.writeText(id);
			copiedId = id;
			setTimeout(() => (copiedId = null), 2000);
		} catch {
			copyFailedId = id;
			setTimeout(() => (copyFailedId = null), 4000);
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
				sendError = result.error ?? "We couldn't send this post to your webhook. Check the webhook URL and try again.";
			}
		} catch (e) {
			sendError = e instanceof Error ? e.message : "We couldn't reach the server. Check your connection and try again.";
		} finally {
			sendingId = null;
		}
	}

	onMount(() => {
		const id = setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			void invalidateAll();
		}, 10000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>Posts – PostPlan</title>
</svelte:head>

<PageSectionHeading title="Posts">
	{#snippet trail()}
		<a href="/posts/new" class="btn-primary btn-touch text-white shadow-sm">New post</a>
	{/snippet}
</PageSectionHeading>

<div class="page-stack">
<!-- Toolbar: filters + search grouped tightly -->
<div class="flex flex-col gap-3">
<form method="get" action="/posts" class="flex flex-wrap gap-2">
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
<div>
	<input
		id="posts-search"
		type="search"
		aria-label="Search posts"
		placeholder="Search by title, webhook, content, or status"
		bind:value={searchQuery}
		class="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] min-h-[44px] shadow-sm"
		autocomplete="off"
	/>
	{#if searchQuery.trim()}
		<p class="mt-1 text-xs text-[var(--text-muted)]">
			{filteredPosts.length} of {data.posts.length}
			{data.posts.length === 1 ? 'post' : 'posts'}
			{#if filteredPosts.length !== data.posts.length}
				<span class="text-[var(--text-muted)]"> matching your search</span>
			{/if}
		</p>
	{/if}
</div>
</div>

{#if sendError}
	<p class="rounded-lg px-3 py-2 text-sm alert-error">{sendError}</p>
{/if}

{#if someSelected}
	<div class="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
		<span class="text-sm font-medium text-[var(--text)]">{selectedIds.size} selected</span>
		<button type="button" class="text-sm text-[var(--text-muted)] hover:underline" onclick={clearSelection}>Clear selection</button>
		<form method="post" action="?/bulkDelete" use:enhance={({ cancel }) => { const n = selectedIds.size; if (!confirm(`Delete ${n} post${n === 1 ? '' : 's'} permanently? You can't undo this.`)) cancel(); bulkActionError = null; return async ({ result }) => { if (result.type === 'success') { clearSelection(); await invalidateAll(); } else if (result.type === 'failure' && result.data && typeof (result.data as { error?: string }).error === 'string') bulkActionError = (result.data as { error: string }).error; }; }} class="inline-flex items-center gap-2">
			{#each [...selectedIds] as id}<input type="hidden" name="ids" value={id} />{/each}
			<button type="submit" class="rounded-lg btn-danger-outline px-3 py-2 text-sm font-medium">Delete</button>
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
	{#if bulkActionError}<p class="alert-error mt-2 rounded-lg px-3 py-2 text-sm">{bulkActionError}</p>{/if}
{/if}

<!-- List as cards -->
<div class="flex flex-col gap-4">
	{#if data.posts.length === 0}
		<EmptyState title="No posts yet" titleId="posts-empty-list">
			<p>
				Add a webhook in
				<a href="/outputs" class="font-medium text-[var(--primary)] hover:underline">Outputs</a>, then
				<a href="/posts/new" class="font-medium text-[var(--primary)] hover:underline">create a post</a>
				or
				<a href="/inputs/webhooks" class="font-medium text-[var(--primary)] hover:underline">import</a>
				— attach a schedule when you’re ready to send on a timer.
			</p>
		</EmptyState>
	{:else if filteredPosts.length === 0}
		<EmptyState title="No matches" titleId="posts-empty-search">
			<p>
				Try another term, or adjust filters above.
				{#if searchQuery.trim()}
					<button
						type="button"
						class="font-medium text-[var(--primary)] hover:underline"
						onclick={() => (searchQuery = '')}>Clear search</button>
				{/if}
			</p>
		</EmptyState>
	{:else}
		<div class="flex items-center gap-3 pb-2">
			<label class="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
				<input type="checkbox" checked={allSelected} onchange={toggleAll} class="rounded border-[var(--border)]" />
				Select all in this list
			</label>
		</div>
		{#each filteredPosts as post}
			{@const statusClass = post.status === 'draft' ? 'status-draft' : post.status === 'scheduled' ? 'status-scheduled' : post.status === 'sent' ? 'status-sent' : 'status-failed'}
			<div
				class="content-card content-card-accent rounded-xl p-4 {!post.has_output_webhook
					? '!border-l-zinc-300 !bg-zinc-100 dark:!border-l-zinc-600 dark:!bg-zinc-800/55'
					: ''}"
				style={post.has_output_webhook
					? `background-color: ${post.color ?? '#fafafa'}; border-left-color: ${post.color ?? 'var(--primary)'};`
					: undefined}
			>
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0 flex flex-1 items-start gap-3">
						<label class="flex items-center shrink-0 cursor-pointer" title="Select for bulk actions">
							<input type="checkbox" checked={selectedIds.has(post.id)} onchange={() => toggleSelection(post.id)} class="rounded border-[var(--border)]" />
						</label>
						{#if post.image_url}
							<img src={post.image_url} alt={"Preview for " + post.title} class="h-14 w-14 rounded object-cover border border-[var(--border)]" loading="lazy" />
						{/if}
						<div class="min-w-0 flex-1">
							<a
								href="/posts/{post.id}"
								class="block min-w-0 overflow-wrap-anywhere font-semibold text-[var(--primary)] hover:underline sm:truncate"
								title={post.title}>{post.title}</a>
							<div class="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
								<span
									class="min-w-0 max-w-full break-words sm:max-w-[min(100%,20rem)] sm:truncate"
									title={post.webhook_name ?? ''}>{post.webhook_name}</span>
								<span class="min-w-0 shrink-0">{post.scheduled_at ? formatScheduledAt(post.scheduled_at) : '—'}</span>
								<span class="inline-flex shrink-0 items-center gap-2">
									<span class="rounded px-2 py-0.5 text-xs font-medium {statusClass}">{post.status}</span>
									{#if !post.has_output_webhook}
										<span
											class="shrink-0 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
											role="status"
											>No output webhook</span>
									{/if}
								</span>
							</div>
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onclick={() => copyPostId(post.id)}
							class="font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded px-2 py-1.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
							title={copyFailedId === post.id
								? "Your browser blocked clipboard access. Copy the ID manually or allow clipboard permissions for this site."
								: 'Copy post ID to clipboard'}
						>
							{copyFailedId === post.id ? "Can't copy" : copiedId === post.id ? 'Copied' : post.id}
						</button>
						{#if post.has_output_webhook}
							<button
								type="button"
								disabled={sendingId === post.id}
								onclick={() => sendNow(post.id)}
								class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 min-h-[44px]"
								title="Send this post's payload to its webhook now (does not wait for the scheduled time)"
							>
								{sendingId === post.id ? 'Sending…' : 'Send'}
							</button>
						{/if}
						<a href="/posts/{post.id}" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center">Edit</a>
						<form method="POST" action="?/deletePost" use:enhance={({ cancel }) => { if (!confirm("Delete this post permanently? You can't undo this.")) cancel(); return () => invalidateAll(); }} class="inline">
							<input type="hidden" name="id" value={post.id} />
							<button type="submit" class="btn-danger-outline min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium">Delete</button>
						</form>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
</div>
