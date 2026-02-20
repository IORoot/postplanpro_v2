<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let sendingId = $state<string | null>(null);
	let sendError = $state<string | null>(null);

	async function sendNow(postId: string, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
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
		} catch (err) {
			sendError = err instanceof Error ? err.message : 'Request failed';
		} finally {
			sendingId = null;
		}
	}

	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	const year = data.year;
	const month = data.month;
	const first = new Date(year, month - 1, 1);
	const last = new Date(year, month, 0);
	const startPad = first.getDay();
	const daysInMonth = last.getDate();
	const totalCells = startPad + daysInMonth;
	const rows = Math.ceil(totalCells / 7);

	// Group posts by date (YYYY-MM-DD)
	const postsByDate: Record<string, typeof data.posts> = {};
	for (const post of data.posts) {
		const d = post.scheduled_at.slice(0, 10);
		if (!postsByDate[d]) postsByDate[d] = [];
		postsByDate[d].push(post);
	}

	function prevMonth() {
		let y = year;
		let m = month - 1;
		if (m < 1) {
			m = 12;
			y--;
		}
		return `/calendar?year=${y}&month=${m}`;
	}
	function nextMonth() {
		let y = year;
		let m = month + 1;
		if (m > 12) {
			m = 1;
			y++;
		}
		return `/calendar?year=${y}&month=${m}`;
	}
	function dateKey(day: number) {
		const d = new Date(year, month - 1, day);
		return d.toISOString().slice(0, 10);
	}
	function formatTime(iso: string) {
		return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Calendar – PostPlan</title>
</svelte:head>

<h1 class="text-2xl font-bold text-[var(--text)]">Calendar</h1>
<p class="mt-1 text-sm text-[var(--text-muted)]">Scheduled posts for this month.</p>
{#if sendError}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{sendError}</p>
{/if}

<div class="mt-6 flex items-center justify-between gap-4">
	<a href={prevMonth()} class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] shadow-sm min-h-[44px] inline-flex items-center">← Prev</a>
	<h2 class="text-lg font-semibold text-[var(--text)]">{monthNames[month - 1]} {year}</h2>
	<a href={nextMonth()} class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] shadow-sm min-h-[44px] inline-flex items-center">Next →</a>
</div>

<div class="content-card mt-4 overflow-hidden rounded-xl shadow-sm">
	<table class="w-full min-w-[400px] table-fixed border-collapse text-sm">
		<thead>
			<tr class="border-b border-[var(--border)]">
				{#each dayNames as day}
					<th class="border-r border-[var(--border)] py-2 font-medium text-[var(--text)] last:border-r-0">{day}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each Array(rows) as _, row}
				<tr class="border-b border-[var(--border)] last:border-b-0">
					{#each Array(7) as _, col}
						{@const cellIndex = row * 7 + col}
						{@const dayNum = cellIndex - startPad + 1}
						{@const isInMonth = dayNum >= 1 && dayNum <= daysInMonth}
						{@const key = isInMonth ? dateKey(dayNum) : ''}
						{@const dayPosts = key ? (postsByDate[key] ?? []) : []}
						<td class="align-top border-r border-[var(--border)] p-1 last:border-r-0 min-h-[80px]">
							{#if isInMonth}
								<div class="text-right text-[var(--text-muted)]">{dayNum}</div>
								<div class="mt-1 space-y-1">
									{#each dayPosts as post}
										<div class="flex items-center gap-0.5 rounded-lg px-2 py-1.5 group hover:bg-[var(--surface-hover)]">
											<a
												href="/posts/{post.id}"
												class="min-w-0 flex-1 truncate text-xs text-[var(--text)] hover:underline"
												title="{post.title} – {formatTime(post.scheduled_at)} – {post.webhook_name}"
											>
												{formatTime(post.scheduled_at)} {post.title}
											</a>
											<button
												type="button"
												disabled={sendingId === post.id}
												onclick={(e) => sendNow(post.id, e)}
												class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--surface)] disabled:opacity-50"
												title="Send now"
											>
												{sendingId === post.id ? '…' : 'Send'}
											</button>
										</div>
									{/each}
								</div>
							{:else}
								<span class="text-[var(--text-muted)] opacity-50">{cellIndex < startPad ? '' : dayNum > daysInMonth ? '' : ''}</span>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
