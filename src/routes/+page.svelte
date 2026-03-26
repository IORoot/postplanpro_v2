<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();

	const QUICK_PATH_KEY = 'postplan-dismiss-dashboard-path';
	let showQuickPath = $state(false);

	onMount(() => {
		if (typeof localStorage === 'undefined') return;
		if (localStorage.getItem(QUICK_PATH_KEY) === '1') return;
		showQuickPath = true;
	});

	function dismissQuickPath() {
		localStorage.setItem(QUICK_PATH_KEY, '1');
		showQuickPath = false;
	}

	function formatDateTime(iso: string) {
		return new Date(iso).toLocaleString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Dashboard – PostPlan</title>
</svelte:head>

<div class="page-stack">
	<!-- Header first: establishes hierarchy before decorative diagram -->
	<div>
		<h1 class="page-title">Dashboard</h1>
		<p class="page-lead">Overview of your schedules, calendar, and posts.</p>
	</div>

	{#if data.stats}
		{#if showQuickPath && data.stats.totalPosts === 0 && data.stats.scheduleCount === 0}
			<aside
				class="alert-info empty-state-in rounded-xl px-4 py-4 sm:px-5 sm:py-5"
				aria-labelledby="dashboard-quick-path-title"
			>
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div class="min-w-0">
						<h2 id="dashboard-quick-path-title" class="text-sm font-semibold text-[var(--text)]">
							First-time checklist
						</h2>
						<p class="mt-1 max-w-[65ch] text-sm leading-relaxed text-[var(--text-muted)]">
							Three steps to your first automated send — you can do them in any order, but this is the usual path.
						</p>
						<ol class="mt-3 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-[var(--text-muted)]">
							<li>
								Add a <a href="/settings" class="font-medium text-[var(--primary)] hover:underline">webhook</a> (Settings → Outputs) so PostPlan knows where to POST.
							</li>
							<li>
								<a href="/posts/new" class="font-medium text-[var(--primary)] hover:underline">Create a post</a> or
								<a href="/bulk-create" class="font-medium text-[var(--primary)] hover:underline">import</a> content with a payload.
							</li>
							<li>
								<a href="/schedules/new" class="font-medium text-[var(--primary)] hover:underline">Create a schedule</a>, then attach it to the post so sends follow your rules.
							</li>
						</ol>
					</div>
					<button
						type="button"
						class="shrink-0 rounded-lg border border-[var(--primary-border-soft)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
						onclick={dismissQuickPath}
					>
						Dismiss
					</button>
				</div>
			</aside>
		{/if}

		<!-- Stats: fluid columns, tighter internal gap than section gaps -->
		<div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 sm:gap-4">
			<a
				href="/posts"
				class="content-card rounded-xl border border-[var(--primary-border-soft)] p-4 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
			>
				<p class="text-sm font-medium text-[var(--text-muted)]">Total posts</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{data.stats.totalPosts}</p>
			</a>
			<a
				href="/posts?status=draft"
				class="content-card rounded-xl border border-[var(--primary-border-soft)] p-4 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
			>
				<p class="text-sm font-medium text-[var(--text-muted)]">Drafts</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{data.stats.draft}</p>
			</a>
			<a
				href="/posts?status=scheduled"
				class="content-card rounded-xl border border-[var(--primary-border-soft)] p-4 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
			>
				<p class="text-sm font-medium text-[var(--text-muted)]">Scheduled</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{data.stats.scheduled}</p>
			</a>
			<a
				href="/posts?status=sent"
				class="content-card rounded-xl border border-[var(--primary-border-soft)] p-4 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
			>
				<p class="text-sm font-medium text-[var(--text-muted)]">Sent</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{data.stats.sent}</p>
			</a>
			<a
				href="/posts?status=failed"
				class="content-card rounded-xl border border-[var(--primary-border-soft)] p-4 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
			>
				<p class="text-sm font-medium text-[var(--text-muted)]">Failed</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{data.stats.failed}</p>
			</a>
			<a
				href="/schedules"
				class="content-card rounded-xl border border-[var(--primary-border-soft)] p-4 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
			>
				<p class="text-sm font-medium text-[var(--text-muted)]">Schedules</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{data.stats.scheduleCount}</p>
			</a>
			<a
				href="/settings"
				class="content-card rounded-xl border border-[var(--primary-border-soft)] p-4 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
			>
				<p class="text-sm font-medium text-[var(--text-muted)]">Webhooks</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{data.stats.webhookCount}</p>
			</a>
			<div class="content-card rounded-xl border border-[var(--primary-border-soft)] p-4">
				<p class="text-sm font-medium text-[var(--text-muted)]">Sent this week</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{data.sentThisWeek}</p>
			</div>
			<a
				href="/reports?report=callback-stages"
				class="content-card rounded-xl border border-[var(--primary-border-soft)] p-4 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
			>
				<p class="text-sm font-medium text-[var(--text-muted)]">Make.com stages</p>
				<p class="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">
					<span class="text-green-600 dark:text-green-400">{data.stagePasses ?? 0}</span>
					<span class="mx-1.5 text-[var(--text-muted)]">/</span>
					<span class="text-red-600 dark:text-red-400">{data.stageFails ?? 0}</span>
				</p>
				<p class="mt-0.5 text-xs text-[var(--text-muted)]">passes / fails</p>
			</a>
		</div>

		<!-- Workflow diagram: supporting context after KPIs -->
		<div
			class="w-full overflow-hidden rounded-xl border border-[var(--primary-border-soft)] bg-[var(--bg)] px-4 py-6 sm:px-8 sm:py-8 md:px-10 lg:px-14 xl:px-20 2xl:px-28"
		>
			<img
				src="/workflow.svg"
				alt="PostPlanPro workflow: import from various sources into Manager, Importer, Scheduler, Publisher; publish to APIs and integrations"
				class="block h-auto w-full max-w-full object-contain"
			/>
		</div>

		<!-- Upcoming posts + Quick actions -->
		<div class="grid gap-8 lg:grid-cols-3 lg:gap-10">
			<div class="lg:col-span-2">
				<div class="mb-4 flex items-center justify-between gap-3">
					<h2 class="heading-accent text-lg font-semibold text-[var(--text)]">Upcoming posts</h2>
					<a
						href="/calendar"
						class="text-sm font-medium text-[var(--primary)] hover:underline"
					>
						View calendar →
					</a>
				</div>
				<div class="content-card rounded-xl border border-[var(--primary-border-soft)] overflow-hidden">
					{#if data.upcomingPosts.length === 0}
						<div class="p-6 text-center text-[var(--text-muted)]">
							<p>No upcoming posts. Schedule some from the <a href="/posts" class="text-[var(--primary)] hover:underline">Posts</a> or <a href="/calendar" class="text-[var(--primary)] hover:underline">Calendar</a> page.</p>
						</div>
					{:else}
						<ul class="divide-y divide-[var(--primary-border-soft)]">
							{#each data.upcomingPosts as post}
								<li>
									<a
										href="/posts/{post.id}"
										class="flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
									>
										<div class="min-w-0 flex-1">
											<p class="font-medium text-[var(--text)] truncate">{post.title || 'Untitled'}</p>
											<p class="text-xs text-[var(--text-muted)]">{post.webhook_name} · {formatDateTime(post.scheduled_at)}</p>
										</div>
										<span class="status-scheduled shrink-0 rounded px-2 py-1 text-xs font-medium">Scheduled</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<div>
				<h2 class="heading-accent mb-4 text-lg font-semibold text-[var(--text)]">Quick actions</h2>
				<div class="flex flex-col gap-3">
					<a
						href="/posts/new"
						class="flex items-center gap-3 rounded-xl border border-[var(--primary-border-soft)] bg-[var(--surface)] px-4 py-3 font-medium text-[var(--text)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]"
					>
						<span class="flex h-9 w-9 items-center justify-center rounded-lg btn-primary text-white">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
						</span>
						New post
					</a>
					<a
						href="/calendar"
						class="flex items-center gap-3 rounded-xl border border-[var(--primary-border-soft)] bg-[var(--surface)] px-4 py-3 font-medium text-[var(--text)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]"
					>
						<span class="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
						</span>
						Calendar
					</a>
					<a
						href="/schedules"
						class="flex items-center gap-3 rounded-xl border border-[var(--primary-border-soft)] bg-[var(--surface)] px-4 py-3 font-medium text-[var(--text)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]"
					>
						<span class="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</span>
						Schedules
					</a>
					<a
						href="/bulk-create"
						class="flex items-center gap-3 rounded-xl border border-[var(--primary-border-soft)] bg-[var(--surface)] px-4 py-3 font-medium text-[var(--text)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-hover)]"
					>
						<span class="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
							</svg>
						</span>
						Import
					</a>
				</div>
			</div>
		</div>

		<!-- Last 10 published, Failed posts, Posts with failed stages -->
		<div class="grid gap-8 lg:grid-cols-3 lg:gap-10">
			<div>
				<div class="mb-4 flex items-center justify-between gap-3">
					<h2 class="heading-accent text-lg font-semibold text-[var(--text)]">Last 10 published</h2>
					<a href="/posts?status=sent" class="text-sm font-medium text-[var(--primary)] hover:underline">View all →</a>
				</div>
				<div class="content-card rounded-xl border border-[var(--primary-border-soft)] overflow-hidden">
					{#if (data.lastPublishedPosts?.length ?? 0) === 0}
						<div class="p-6 text-center text-[var(--text-muted)]">
							<p>No published posts yet.</p>
						</div>
					{:else}
						<ul class="divide-y divide-[var(--primary-border-soft)]">
							{#each data.lastPublishedPosts ?? [] as post}
								<li>
									<a
										href="/posts/{post.id}"
										class="flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
									>
										<div class="min-w-0 flex-1">
											<p class="font-medium text-[var(--text)] truncate">{post.title || 'Untitled'}</p>
											<p class="text-xs text-[var(--text-muted)]">{post.webhook_name} · {post.sent_at ? formatDateTime(post.sent_at) : '—'}</p>
										</div>
										<span class="status-sent shrink-0 rounded px-2 py-1 text-xs font-medium">Sent</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<div>
				<div class="mb-4 flex items-center justify-between gap-3">
					<h2 class="heading-accent text-lg font-semibold text-[var(--text)]">Failed posts</h2>
					{#if (data.failedPosts?.length ?? 0) > 0}
						<a href="/posts?status=failed" class="text-sm font-medium text-[var(--primary)] hover:underline">View all →</a>
					{/if}
				</div>
				<div class="content-card rounded-xl border border-[var(--primary-border-soft)] overflow-hidden">
					{#if (data.failedPosts?.length ?? 0) === 0}
						<div class="p-6 text-center text-[var(--text-muted)]">
							<p>No failed posts.</p>
						</div>
					{:else}
						<ul class="divide-y divide-[var(--primary-border-soft)]">
							{#each data.failedPosts ?? [] as post}
								<li>
									<a
										href="/posts/{post.id}"
										class="block px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]"
									>
										<p class="font-medium text-[var(--text)] truncate">{post.title || 'Untitled'}</p>
										{#if post.error_message}
											<p class="mt-0.5 truncate text-xs text-[var(--text-muted)]" title={post.error_message}>{post.error_message}</p>
										{/if}
										<p class="mt-0.5 text-xs text-[var(--text-muted)]">{formatDateTime(post.updated_at)}</p>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<div>
				<div class="mb-4 flex items-center justify-between gap-3">
					<h2 class="heading-accent text-lg font-semibold text-[var(--text)]">Posts with failed stages</h2>
					{#if (data.postsWithFailedStages?.length ?? 0) > 0}
						<a href="/reports?report=callback-stages&filterStatus=fail" class="text-sm font-medium text-[var(--primary)] hover:underline">View report →</a>
					{/if}
				</div>
				<div class="content-card rounded-xl border border-[var(--primary-border-soft)] overflow-hidden">
					{#if (data.postsWithFailedStages?.length ?? 0) === 0}
						<div class="p-6 text-center text-[var(--text-muted)]">
							<p>No posts with failed Make.com stages.</p>
						</div>
					{:else}
						<ul class="divide-y divide-[var(--primary-border-soft)]">
							{#each data.postsWithFailedStages ?? [] as post}
								<li>
									<a
										href="/posts/{post.id}"
										class="flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
									>
										<div class="min-w-0 flex-1">
											<p class="font-medium text-[var(--text)] truncate">{post.title || 'Untitled'}</p>
											<p class="text-xs text-[var(--text-muted)]">{post.sent_at ? formatDateTime(post.sent_at) : '—'}</p>
										</div>
										<span class="status-failed shrink-0 rounded px-2 py-1 text-xs font-medium">Stage failed</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="content-card rounded-xl border border-[var(--primary-border-soft)] p-8 text-center">
			<p class="text-[var(--text-muted)]">Sign in to see your dashboard.</p>
		</div>
	{/if}
</div>
