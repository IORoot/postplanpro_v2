<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let sendingId = $state<string | null>(null);
	let sendError = $state<string | null>(null);

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
	<a href="/posts/new" class="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] shadow-sm min-h-[44px] inline-flex items-center justify-center w-fit">+ New post</a>
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

{#if sendError}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{sendError}</p>
{/if}

<!-- List as cards -->
<div class="mt-6 space-y-4">
	{#if data.posts.length === 0}
		<div class="content-card rounded-xl p-6 text-center">
			<p class="text-[var(--text-muted)]">No posts yet. <a href="/posts/new" class="font-medium text-[var(--primary)] hover:underline">Create one</a>.</p>
		</div>
	{:else}
		{#each data.posts as post}
			{@const statusClass = post.status === 'draft' ? 'status-draft' : post.status === 'scheduled' ? 'status-scheduled' : post.status === 'sent' ? 'status-sent' : 'status-failed'}
			<div class="content-card content-card-accent rounded-xl p-4 shadow-sm">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div class="min-w-0 flex-1">
						<a href="/posts/{post.id}" class="font-semibold text-[var(--primary)] hover:underline">{post.title}</a>
						<div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
							<span>{post.webhook_name}</span>
							<span>{post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : '—'}</span>
							<span class="rounded px-2 py-0.5 text-xs font-medium {statusClass}">{post.status}</span>
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-2">
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
						<form method="POST" action="?/deletePost" use:enhance={() => invalidateAll()} class="inline">
							<input type="hidden" name="id" value={post.id} />
							<button type="submit" class="rounded-lg border border-red-400 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/30 min-h-[44px]">Delete</button>
						</form>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
