<script lang="ts">
	import CalendarPostBadges from './CalendarPostBadges.svelte';

	type Post = {
		id: string;
		title: string;
		image_url: string | null;
		color: string | null;
		scheduled_at: string;
		status: string;
		webhook_name: string;
		has_output_webhook: number;
	};

	let {
		heading,
		posts,
		highlightPostId,
		sendingId,
		formatTime,
		sendNow
	}: {
		heading: string;
		posts: Post[];
		highlightPostId: string | null;
		sendingId: string | null;
		formatTime: (iso: string) => string;
		sendNow: (postId: string, e: MouseEvent) => void;
	} = $props();
</script>

<section class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" aria-labelledby="compact-day-posts-heading">
	<h2 id="compact-day-posts-heading" class="text-sm font-semibold text-[var(--text)]">{heading}</h2>
	<p class="mt-0.5 text-xs text-[var(--text-muted)]">Tap a post below to open it.</p>
	{#if posts.length === 0}
		<p class="mt-3 text-sm text-[var(--text-muted)]">No posts on this day.</p>
	{:else}
		<ul class="mt-3 space-y-2">
			{#each posts as post (post.id)}
				<li
					id={'touch-post-' + post.id}
					class="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 transition-shadow {highlightPostId === post.id
						? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg)]'
						: ''}"
				>
					<div
						class="calendar-post-accent rounded-lg p-2"
						style={`background-color: ${post.color ?? '#fafafa'}; border-left-color: ${post.color ?? 'var(--border)'};`}
					>
						<div class="flex min-w-0 gap-2">
							{#if post.image_url}
								<img
									src={post.image_url}
									alt=""
									class="h-12 w-12 shrink-0 rounded border border-[var(--border)] object-cover"
									loading="lazy"
								/>
							{/if}
							<div class="min-w-0 flex-1">
								<a
									href={'/posts/' + post.id}
									class="touch-manipulation text-sm font-medium text-neutral-900 hover:underline"
								>
									{post.title}
								</a>
								<p class="mt-0.5 text-[10px] text-neutral-600">
									{formatTime(post.scheduled_at)} · {post.webhook_name}
								</p>
								<div class="mt-2 flex flex-wrap items-center gap-1">
									<CalendarPostBadges
										status={post.status}
										hasOutputWebhook={post.has_output_webhook}
										textOnly={true}
										hideStatus={false}
									/>
									{#if post.has_output_webhook}
										<button
											type="button"
											class="touch-manipulation rounded bg-[var(--surface)] px-2 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
											disabled={sendingId === post.id}
											onclick={(e) => sendNow(post.id, e)}
										>
											{sendingId === post.id ? '…' : 'Send'}
										</button>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
