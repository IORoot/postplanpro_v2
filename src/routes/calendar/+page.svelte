<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let sendingId = $state<string | null>(null);
	let sendError = $state<string | null>(null);
	let sendSuccess = $state<string | null>(null);

	type CalendarView = 'day' | 'week' | 'month' | 'year' | 'agenda' | 'schedule';
	type SendNowResult = {
		success: boolean;
		error?: string;
		responseStatus?: number | null;
		responseBody?: string | null;
	};
	type CalendarPost = {
		id: string;
		title: string;
		image_url: string | null;
		color: string | null;
		scheduled_at: string;
		status: string;
		webhook_name: string;
	};

	function trimResponse(body: string | null | undefined): string {
		if (!body) return '';
		return body.length > 500 ? `${body.slice(0, 500)}...` : body;
	}

	async function sendNow(postId: string, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		sendingId = postId;
		sendError = null;
		sendSuccess = null;
		try {
			const res = await fetch(`/api/posts/${postId}/send`, { method: 'POST' });
			const result = (await res.json()) as SendNowResult;
			const responseText = trimResponse(result.responseBody);
			if (result.success) {
				sendSuccess = `Post sent successfully (HTTP ${result.responseStatus ?? 200})${
					responseText ? `: ${responseText}` : ''
				}`;
				invalidateAll();
			} else {
				sendError = `${result.error ?? 'Send failed'}${
					responseText ? ` | Response: ${responseText}` : ''
				}`;
			}
		} catch (err) {
			sendError = err instanceof Error ? err.message : 'Request failed';
		} finally {
			sendingId = null;
		}
	}

	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const WEEK_HOUR_SLOT_PX = 56;
	const WEEK_POST_HEIGHT_PX = 44;
	const weekHours = Array.from({ length: 24 }, (_, hour) => hour);

	const view = $derived(data.view as CalendarView);
	const anchor = $derived(new Date(data.anchorDate + 'T00:00:00'));
	const posts = $derived(
		[...(data.posts as CalendarPost[])].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
	);
	const postsByDate = $derived.by(() => {
		const byDate = new Map<string, CalendarPost[]>();
		for (const post of posts) {
			const key = post.scheduled_at.slice(0, 10);
			const list = byDate.get(key) ?? [];
			list.push(post);
			byDate.set(key, list);
		}
		return byDate;
	});
	const postsByMonth = $derived.by(() => {
		const byMonth = new Map<number, CalendarPost[]>();
		for (const post of posts) {
			const month = new Date(post.scheduled_at).getMonth();
			const monthList = byMonth.get(month) ?? [];
			monthList.push(post);
			byMonth.set(month, monthList);
		}
		return byMonth;
	});

	function localDateKey(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function withOffset(source: Date, viewName: CalendarView, dir: -1 | 1): Date {
		const next = new Date(source);
		if (viewName === 'day') next.setDate(next.getDate() + dir);
		else if (viewName === 'week') next.setDate(next.getDate() + dir * 7);
		else if (viewName === 'month') next.setMonth(next.getMonth() + dir);
		else if (viewName === 'year') next.setFullYear(next.getFullYear() + dir);
		else next.setDate(next.getDate() + dir * 14);
		return next;
	}

	function hrefFor(viewName: CalendarView, date: Date): string {
		return `/calendar?view=${viewName}&date=${localDateKey(date)}`;
	}

	function rangeLabel(): string {
		if (view === 'day') return anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
		if (view === 'week') {
			const monday = weekDays()[0];
			const sunday = weekDays()[6];
			return `${monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
		}
		if (view === 'month') return `${monthNames[anchor.getMonth()]} ${anchor.getFullYear()}`;
		if (view === 'year') return String(anchor.getFullYear());
		return `${new Date(data.rangeStart + 'T00:00:00').toLocaleDateString()} - ${new Date(data.rangeEnd + 'T00:00:00').toLocaleDateString()}`;
	}

	function weekDays(): Date[] {
		const start = new Date(anchor);
		const offsetToMonday = (start.getDay() + 6) % 7;
		start.setDate(start.getDate() - offsetToMonday);
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(start.getDate() + i);
			return d;
		});
	}

	function monthGridDays(): Array<{ date: Date; inMonth: boolean }> {
		const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
		const offsetToMonday = (monthStart.getDay() + 6) % 7;
		const gridStart = new Date(monthStart);
		gridStart.setDate(monthStart.getDate() - offsetToMonday);
		const days: Array<{ date: Date; inMonth: boolean }> = [];
		for (let i = 0; i < 42; i++) {
			const date = new Date(gridStart);
			date.setDate(gridStart.getDate() + i);
			days.push({
				date,
				inMonth: date >= monthStart && date <= monthEnd
			});
		}
		return days;
	}

	function yearMonths(): Date[] {
		return Array.from({ length: 12 }, (_, i) => new Date(anchor.getFullYear(), i, 1));
	}

	function postsForDay(date: Date): CalendarPost[] {
		return postsByDate.get(localDateKey(date)) ?? [];
	}

	function postsForMonth(month: number): CalendarPost[] {
		return postsByMonth.get(month) ?? [];
	}

	function groupedAgenda(): Array<{ date: string; posts: CalendarPost[] }> {
		return [...postsByDate.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, dayPosts]) => ({
				date,
				posts: [...dayPosts].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
			}));
	}

	function formatTime(iso: string) {
		return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	function formatHourLabel(hour: number): string {
		const period = hour >= 12 ? 'PM' : 'AM';
		const normalized = hour % 12 || 12;
		return `${normalized} ${period}`;
	}

	function minuteOfDay(iso: string): number {
		const d = new Date(iso);
		return d.getHours() * 60 + d.getMinutes();
	}

	function weekPostTopPx(iso: string): number {
		const maxTop = 24 * WEEK_HOUR_SLOT_PX - WEEK_POST_HEIGHT_PX;
		const rawTop = (minuteOfDay(iso) / 60) * WEEK_HOUR_SLOT_PX;
		return Math.max(0, Math.min(maxTop, rawTop));
	}

	function weekPostsForDay(date: Date): CalendarPost[] {
		return [...postsForDay(date)].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
	}

	function statusClass(status: string): string {
		if (status === 'draft') return 'status-draft';
		if (status === 'scheduled') return 'status-scheduled';
		if (status === 'sent') return 'status-sent';
		return 'status-failed';
	}

	const viewButtons: Array<{ id: CalendarView; label: string }> = [
		{ id: 'day', label: 'Day' },
		{ id: 'week', label: 'Week' },
		{ id: 'month', label: 'Month' },
		{ id: 'year', label: 'Year' },
		{ id: 'agenda', label: 'Agenda' },
		{ id: 'schedule', label: 'Schedule' }
	];
</script>

<svelte:head>
	<title>Calendar – PostPlan</title>
</svelte:head>

<h1 class="text-2xl font-bold text-[var(--text)]">Calendar</h1>
<p class="mt-1 text-sm text-[var(--text-muted)]">Modern multi-view calendar for scheduled posts.</p>
{#if sendError}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{sendError}</p>
{/if}
{#if sendSuccess}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">{sendSuccess}</p>
{/if}

<div class="content-card mt-6 rounded-xl p-4 md:p-5" data-sveltekit-preload-data="tap">
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div class="inline-flex rounded-xl bg-[var(--surface)] p-1">
			{#each viewButtons as v}
				<a
					href={hrefFor(v.id, anchor)}
					class="rounded-lg px-3 py-2 text-xs font-medium min-h-[36px] inline-flex items-center {view === v.id
						? 'bg-[var(--primary)] text-white'
						: 'text-[var(--text-muted)] hover:text-[var(--text)]'}"
				>
					{v.label}
				</a>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			<a href={hrefFor(view, withOffset(anchor, view, -1))} class="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">←</a>
			<div class="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text)] min-w-[210px] text-center">
				{rangeLabel()}
			</div>
			<a href={hrefFor(view, withOffset(anchor, view, 1))} class="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">→</a>
			<a href={hrefFor(view, new Date())} class="rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]">Today</a>
		</div>
	</div>
</div>

{#if view === 'month'}
	<div class="content-card mt-4 overflow-hidden rounded-xl">
		<div class="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)]">
			{#each dayNames as day}
				<div class="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{day}</div>
			{/each}
		</div>
		<div class="grid grid-cols-7">
			{#each monthGridDays() as cell}
				<div class="min-h-[130px] border-r border-b border-[var(--border)] p-2 last:border-r-0">
					<div class="text-right text-xs {cell.inMonth ? 'text-[var(--text)]' : 'text-[var(--text-muted)] opacity-50'}">
						{cell.date.getDate()}
					</div>
					<div class="mt-2 space-y-1">
						{#each postsForDay(cell.date) as post (post.id)}
							<div class="rounded-lg px-2 py-2" style={`background-color: ${post.color ?? 'var(--surface)'}; border-left: 3px solid ${post.color ?? 'var(--surface)'};`}>
								<div class="flex items-center gap-1">
									{#if post.image_url}
										<img src={post.image_url} alt={"Preview for " + post.title} class="h-5 w-5 rounded object-cover border border-[var(--border)]" loading="lazy" />
									{/if}
									<a href={"/posts/" + post.id} class="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text)] hover:underline">
										{formatTime(post.scheduled_at)} {post.title}
									</a>
								</div>
								<div class="mt-1 flex items-center justify-between gap-2">
									<span class={"rounded px-1.5 py-0.5 text-[10px] font-medium " + statusClass(post.status)}>{post.status}</span>
									<button
										type="button"
										disabled={sendingId === post.id}
										onclick={(e) => sendNow(post.id, e)}
										class="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
									>
										{sendingId === post.id ? '…' : 'Send'}
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
{:else if view === 'week'}
	<div class="content-card mt-4 rounded-xl p-3">
		<div class="overflow-x-auto">
			<div class="min-w-[980px]">
				<div
					class="grid"
					style={`grid-template-columns: 72px repeat(7, minmax(0, 1fr));`}
				>
					<div class="border-b border-[var(--border)] bg-[var(--surface)]"></div>
					{#each weekDays() as d}
						<div class="border-b border-l border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-center">
							<p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{d.toLocaleDateString(undefined, { weekday: 'short' })}</p>
							<p class="text-sm font-semibold text-[var(--text)]">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
						</div>
					{/each}

					<div class="relative bg-[var(--surface)]" style={`height: ${24 * WEEK_HOUR_SLOT_PX}px;`}>
						{#each weekHours as hour}
							<div
								class="absolute left-0 right-0 border-t border-dashed border-[var(--border)]/70 px-2"
								style={`top: ${hour * WEEK_HOUR_SLOT_PX}px; height: ${WEEK_HOUR_SLOT_PX}px;`}
							>
								<span class="relative -top-2 text-[10px] font-medium text-[var(--text-muted)]">{formatHourLabel(hour)}</span>
							</div>
						{/each}
					</div>

					{#each weekDays() as d}
						<div class="relative border-l border-[var(--border)] bg-[var(--bg)]" style={`height: ${24 * WEEK_HOUR_SLOT_PX}px;`}>
							{#each weekHours as hour}
								<div
									class="absolute left-0 right-0 border-t border-dashed border-[var(--border)]/70"
									style={`top: ${hour * WEEK_HOUR_SLOT_PX}px;`}
								></div>
							{/each}

							{#each weekPostsForDay(d) as post (post.id)}
								<div
									class="absolute left-1 right-1 rounded-lg px-2 py-2 shadow-sm"
									style={`top: ${weekPostTopPx(post.scheduled_at)}px; height: ${WEEK_POST_HEIGHT_PX}px; background-color: ${post.color ?? 'var(--surface)'}; border-left: 3px solid ${post.color ?? 'var(--surface)'};`}
								>
									<div class="flex items-center gap-2">
										{#if post.image_url}
											<img src={post.image_url} alt={"Preview for " + post.title} class="h-6 w-6 rounded object-cover border border-[var(--border)]" loading="lazy" />
										{/if}
										<a href={"/posts/" + post.id} class="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text)] hover:underline">
											{formatTime(post.scheduled_at)} {post.title}
										</a>
										<button
											type="button"
											class="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)]"
											disabled={sendingId === post.id}
											onclick={(e) => sendNow(post.id, e)}
										>
											{sendingId === post.id ? '…' : 'Send'}
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{:else if view === 'day'}
	<div class="content-card mt-4 rounded-xl p-4">
		<div class="space-y-3">
			{#if postsForDay(anchor).length === 0}
				<p class="text-sm text-[var(--text-muted)]">No posts scheduled for this day.</p>
			{:else}
				{#each postsForDay(anchor) as post (post.id)}
					<div class="rounded-xl p-3" style={`background-color: ${post.color ?? 'var(--surface)'}; border-left: 3px solid ${post.color ?? 'var(--surface)'};`}>
						<div class="flex items-center gap-3">
							{#if post.image_url}
								<img src={post.image_url} alt={"Preview for " + post.title} class="h-12 w-12 rounded-lg object-cover border border-[var(--border)]" loading="lazy" />
							{/if}
							<div class="min-w-0 flex-1">
								<a href={"/posts/" + post.id} class="block truncate font-semibold text-[var(--text)] hover:underline">{post.title}</a>
								<p class="text-sm text-[var(--text-muted)]">{formatTime(post.scheduled_at)} · {post.webhook_name}</p>
							</div>
							<span class={"rounded px-2 py-1 text-xs font-medium " + statusClass(post.status)}>{post.status}</span>
							<button type="button" class="rounded-lg bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)]" disabled={sendingId === post.id} onclick={(e) => sendNow(post.id, e)}>
								{sendingId === post.id ? 'Sending…' : 'Send'}
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
{:else if view === 'year'}
	<div class="content-card mt-4 rounded-xl p-4">
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
			{#each yearMonths() as monthDate}
				{@const monthPosts = postsForMonth(monthDate.getMonth())}
				<div class="rounded-xl bg-[var(--surface)] p-3">
					<p class="text-sm font-semibold text-[var(--text)]">{monthNames[monthDate.getMonth()]}</p>
					<p class="mt-1 text-xs text-[var(--text-muted)]">{monthPosts.length} post(s)</p>
					<div class="mt-2 space-y-1">
						{#each monthPosts.slice(0, 4) as post (post.id)}
							<a
								href={"/posts/" + post.id}
								class="block truncate rounded-md px-2 py-1 text-xs text-[var(--text)] hover:underline"
								style={`background-color: ${post.color ?? 'var(--bg)'}; border-left: 3px solid ${post.color ?? 'var(--bg)'};`}
							>
								{new Date(post.scheduled_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · {post.title}
							</a>
						{/each}
						{#if monthPosts.length > 4}
							<p class="text-xs text-[var(--text-muted)]">+{monthPosts.length - 4} more</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{:else if view === 'agenda'}
	<div class="content-card mt-4 rounded-xl p-4">
		{#if posts.length === 0}
			<p class="text-sm text-[var(--text-muted)]">No scheduled posts in this range.</p>
		{:else}
			<div class="space-y-4">
				{#each groupedAgenda() as day}
					<div>
						<h3 class="text-sm font-semibold text-[var(--text)]">{new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
						<div class="mt-2 space-y-2">
							{#each day.posts as post (post.id)}
								<div class="rounded-lg p-2" style={`background-color: ${post.color ?? 'var(--surface)'}; border-left: 3px solid ${post.color ?? 'var(--surface)'};`}>
									<div class="flex items-center gap-2">
										{#if post.image_url}
											<img src={post.image_url} alt={"Preview for " + post.title} class="h-8 w-8 rounded object-cover border border-[var(--border)]" loading="lazy" />
										{/if}
										<a href={"/posts/" + post.id} class="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)] hover:underline">
											{formatTime(post.scheduled_at)} · {post.title}
										</a>
										<button type="button" class="rounded px-2 py-1 text-xs font-medium text-[var(--primary)]" disabled={sendingId === post.id} onclick={(e) => sendNow(post.id, e)}>
											{sendingId === post.id ? '…' : 'Send'}
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<div class="content-card mt-4 rounded-xl p-4">
		{#if posts.length === 0}
			<p class="text-sm text-[var(--text-muted)]">No scheduled posts in this range.</p>
		{:else}
			<div class="space-y-3">
				{#each posts as post (post.id)}
					<div class="rounded-xl p-3" style={`background-color: ${post.color ?? 'var(--surface)'}; border-left: 3px solid ${post.color ?? 'var(--surface)'};`}>
						<div class="flex items-center gap-3">
							{#if post.image_url}
								<img src={post.image_url} alt={"Preview for " + post.title} class="h-10 w-10 rounded-lg object-cover border border-[var(--border)]" loading="lazy" />
							{/if}
							<div class="min-w-0 flex-1">
								<a href={"/posts/" + post.id} class="block truncate font-medium text-[var(--text)] hover:underline">{post.title}</a>
								<p class="text-xs text-[var(--text-muted)]">{new Date(post.scheduled_at).toLocaleString()} · {post.webhook_name}</p>
							</div>
							<span class={"rounded px-2 py-1 text-xs font-medium " + statusClass(post.status)}>{post.status}</span>
							<button type="button" class="rounded-lg bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)]" disabled={sendingId === post.id} onclick={(e) => sendNow(post.id, e)}>
								{sendingId === post.id ? 'Sending…' : 'Send'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
