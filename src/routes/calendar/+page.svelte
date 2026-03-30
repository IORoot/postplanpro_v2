<script lang="ts">
	import { onMount } from 'svelte';
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { invalidateAll } from '$app/navigation';

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
	let sendingId = $state<string | null>(null);
	let sendError = $state<string | null>(null);
	let sendSuccess = $state<string | null>(null);
	let dragPostId = $state<string | null>(null);
	let reschedulePending = $state(false);
	let dragPreviewText = $state<string | null>(null);
	let dragPreviewPos = $state<{ x: number; y: number } | null>(null);
	let expandedYearMonths = $state<Set<string>>(new Set());

	function yearMonthKey(year: number, monthIndex: number): string {
		return `${year}-${monthIndex}`;
	}

	function toggleYearMonthExpanded(year: number, monthIndex: number) {
		const key = yearMonthKey(year, monthIndex);
		expandedYearMonths = new Set(expandedYearMonths);
		if (expandedYearMonths.has(key)) {
			expandedYearMonths.delete(key);
		} else {
			expandedYearMonths.add(key);
		}
	}

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
				sendSuccess = `Sent to webhook (HTTP ${result.responseStatus ?? 200})${
					responseText ? `: ${responseText}` : ''
				}`;
				invalidateAll();
			} else {
				sendError = `${result.error ?? "We couldn't send this post to your webhook."}${
					responseText ? ` · Response: ${responseText}` : ''
				}`;
			}
		} catch (err) {
			sendError = err instanceof Error ? err.message : "We couldn't reach the server. Check your connection and try again.";
		} finally {
			sendingId = null;
		}
	}

	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
	/** Year-scoped month buckets for month-year strip + year view only (avoids extra work on other views). */
	const postsByYearMonth = $derived.by(() => {
		const map = new Map<string, CalendarPost[]>();
		if (view !== 'month' && view !== 'year') return map;
		for (const post of posts) {
			const d = new Date(post.scheduled_at);
			const key = `${d.getFullYear()}-${d.getMonth()}`;
			const list = map.get(key) ?? [];
			list.push(post);
			map.set(key, list);
		}
		return map;
	});

	const emptyMonthAnchors: Date[] = [];
	const yearMonthAnchors = $derived.by(() => {
		if (view !== 'year' && view !== 'schedule') return emptyMonthAnchors;
		return Array.from({ length: 12 }, (_, i) => new Date(anchor.getFullYear(), i, 1));
	});

	const scheduleMiniMonthGrids = $derived.by(() => {
		if (view !== 'schedule') return null;
		const y = anchor.getFullYear();
		const grids = new Map<number, Array<{ date: Date; inMonth: boolean }>>();
		for (let m = 0; m < 12; m++) {
			grids.set(m, buildMiniMonthGrid(new Date(y, m, 1)));
		}
		return grids;
	});

	function localDateKey(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function isToday(date: Date): boolean {
		const t = new Date();
		return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
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

	function weekStart(date: Date): Date {
		const start = new Date(date);
		const offsetToMonday = (start.getDay() + 6) % 7;
		start.setDate(start.getDate() - offsetToMonday);
		start.setHours(0, 0, 0, 0);
		return start;
	}

	function monthWeekStarts(): Date[] {
		const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
		const firstWeek = weekStart(monthStart);
		const lastWeek = weekStart(monthEnd);
		const weeks: Date[] = [];
		for (const d = new Date(firstWeek); d <= lastWeek; d.setDate(d.getDate() + 7)) {
			weeks.push(new Date(d));
		}
		return weeks;
	}

	function weekChipLabel(weekStartDate: Date): string {
		const end = new Date(weekStartDate);
		end.setDate(end.getDate() + 6);
		return `${weekStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
	}

	function weekNumberOfYear(date: Date): number {
		// ISO week number (Monday-first). Clamp to 52 for display consistency.
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		const day = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - day);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
		return Math.min(52, Math.max(1, week));
	}

	function weekPostCount(weekStartDate: Date): number {
		let count = 0;
		for (let i = 0; i < 7; i++) {
			const d = new Date(weekStartDate);
			d.setDate(weekStartDate.getDate() + i);
			count += postsForDay(d).length;
		}
		return count;
	}

	function monthWeekCount(): number {
		return monthWeekStarts().length;
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

	function buildMiniMonthGrid(anchorMonth: Date): Array<{ date: Date; inMonth: boolean }> {
		const monthStart = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth(), 1);
		const monthEnd = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 0);
		const offsetToMonday = (monthStart.getDay() + 6) % 7;
		const gridStart = new Date(monthStart);
		gridStart.setDate(monthStart.getDate() - offsetToMonday);
		return Array.from({ length: 42 }, (_, i) => {
			const date = new Date(gridStart);
			date.setDate(gridStart.getDate() + i);
			return {
				date,
				inMonth: date >= monthStart && date <= monthEnd
			};
		});
	}

	function postsForDay(date: Date): CalendarPost[] {
		return postsByDate.get(localDateKey(date)) ?? [];
	}

	function postsForYearMonth(year: number, monthIndex: number): CalendarPost[] {
		return postsByYearMonth.get(`${year}-${monthIndex}`) ?? [];
	}

	function formatTime(iso: string) {
		return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	function formatHourLabel(hour: number): string {
		const period = hour >= 12 ? 'PM' : 'AM';
		const normalized = hour % 12 || 12;
		return `${normalized} ${period}`;
	}

	function darkenMarkerColor(hex: string | null): string {
		if (!hex) return 'var(--primary)';
		const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
		if (!m) return 'var(--primary)';
		const n = Number.parseInt(m[1], 16);
		const r = ((n >> 16) & 255) / 255;
		const g = ((n >> 8) & 255) / 255;
		const b = (n & 255) / 255;

		const cMax = Math.max(r, g, b);
		const cMin = Math.min(r, g, b);
		const delta = cMax - cMin;
		let h = 0;
		if (delta !== 0) {
			if (cMax === r) h = ((g - b) / delta) % 6;
			else if (cMax === g) h = (b - r) / delta + 2;
			else h = (r - g) / delta + 4;
		}
		h = Math.round((h * 60 + 360) % 360);
		const l = (cMax + cMin) / 2;
		const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

		// Keep hue/saturation, lower lightness for high-contrast marker dots.
		const darkerL = Math.max(0.16, Math.min(0.42, l * 0.42));

		const c = (1 - Math.abs(2 * darkerL - 1)) * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m2 = darkerL - c / 2;
		let r1 = 0;
		let g1 = 0;
		let b1 = 0;
		if (h < 60) [r1, g1, b1] = [c, x, 0];
		else if (h < 120) [r1, g1, b1] = [x, c, 0];
		else if (h < 180) [r1, g1, b1] = [0, c, x];
		else if (h < 240) [r1, g1, b1] = [0, x, c];
		else if (h < 300) [r1, g1, b1] = [x, 0, c];
		else [r1, g1, b1] = [c, 0, x];

		const rr = Math.round((r1 + m2) * 255)
			.toString(16)
			.padStart(2, '0');
		const gg = Math.round((g1 + m2) * 255)
			.toString(16)
			.padStart(2, '0');
		const bb = Math.round((b1 + m2) * 255)
			.toString(16)
			.padStart(2, '0');
		return `#${rr}${gg}${bb}`;
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

	/** Posts for the selected day, sorted by time (for day view hour grid). */
	function dayViewPosts(): CalendarPost[] {
		return [...postsForDay(anchor)].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
	}

	/** Posts at a given hour for the selected day (for day overview markers). */
	function postsAtHour(hour: number): CalendarPost[] {
		return dayViewPosts().filter((p) => new Date(p.scheduled_at).getHours() === hour);
	}

	function statusClass(status: string): string {
		if (status === 'draft') return 'status-draft';
		if (status === 'scheduled') return 'status-scheduled';
		if (status === 'sent') return 'status-sent';
		return 'status-failed';
	}

	const DRAG_TYPE = 'application/x-postplan-reschedule';

	function toIsoLocal(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		const h = String(d.getHours()).padStart(2, '0');
		const min = String(d.getMinutes()).padStart(2, '0');
		const s = String(d.getSeconds()).padStart(2, '0');
		return `${y}-${m}-${day}T${h}:${min}:${s}`;
	}

	async function reschedulePost(postId: string, newScheduledAt: string) {
		reschedulePending = true;
		try {
			const fd = new FormData();
			fd.set('post_id', postId);
			fd.set('scheduled_at', newScheduledAt);
			const r = await fetch('?/reschedulePost', { method: 'POST', body: fd, redirect: 'manual' });
			if (r.type === 'opaqueredirect' || r.status === 303) {
				await invalidateAll();
			} else if (r.status === 200) {
				const result = await r.json().catch(() => ({}));
				if (result?.type === 'failure') throw new Error((result.data as { error?: string })?.error ?? 'Failed');
				await invalidateAll();
			} else {
				throw new Error('Reschedule failed');
			}
		} finally {
			reschedulePending = false;
			dragPostId = null;
		}
	}

	function handleDragStart(e: DragEvent, post: CalendarPost) {
		if (!e.dataTransfer) return;
		dragPostId = post.id;
		e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ postId: post.id, scheduled_at: post.scheduled_at }));
		e.dataTransfer.effectAllowed = 'move';
		dragPreviewText = formatTime(post.scheduled_at);
		dragPreviewPos = { x: e.clientX, y: e.clientY };
	}

	function handleDragEnd() {
		dragPostId = null;
		dragPreviewText = null;
		dragPreviewPos = null;
	}

	function setDragPreview(text: string, e: DragEvent) {
		dragPreviewText = text;
		dragPreviewPos = { x: e.clientX, y: e.clientY };
	}

	function allowDrop(e: DragEvent) {
		if (e.dataTransfer?.types.includes(DRAG_TYPE)) e.preventDefault();
	}

	// Day view: drop on hour cell; minute from x position (1-min granularity)
	function dayDrop(e: DragEvent, hour: number) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData(DRAG_TYPE);
		if (!raw) return;
		const { postId } = JSON.parse(raw) as { postId: string; scheduled_at: string };
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const fraction = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
		const minute = Math.min(59, Math.max(0, Math.floor(fraction * 60)));
		const d = new Date(anchor);
		d.setHours(hour, minute, 0, 0);
		reschedulePost(postId, toIsoLocal(d));
	}

	function dayDragOver(e: DragEvent, hour: number) {
		if (e.dataTransfer?.types.includes(DRAG_TYPE)) e.preventDefault();
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const fraction = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
		const minute = Math.min(59, Math.max(0, Math.floor(fraction * 60)));
		const d = new Date(anchor);
		d.setHours(hour, minute, 0, 0);
		setDragPreview(d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }), e);
	}

	// Week view: drop on day column; hour/minute from y position
	function weekDrop(e: DragEvent, dayIndex: number) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData(DRAG_TYPE);
		if (!raw) return;
		const { postId } = JSON.parse(raw) as { postId: string; scheduled_at: string };
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const totalMinutes = 24 * 60;
		const fraction = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;
		const minuteOfDay = Math.min(totalMinutes - 1, Math.max(0, Math.floor(fraction * totalMinutes)));
		const hour = Math.floor(minuteOfDay / 60);
		const minute = minuteOfDay % 60;
		const dayDate = weekDays()[dayIndex];
		const d = new Date(dayDate);
		d.setHours(hour, minute, 0, 0);
		reschedulePost(postId, toIsoLocal(d));
	}

	function weekDragOver(e: DragEvent, dayIndex: number) {
		if (e.dataTransfer?.types.includes(DRAG_TYPE)) e.preventDefault();
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const totalMinutes = 24 * 60;
		const fraction = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;
		const minuteOfDay = Math.min(totalMinutes - 1, Math.max(0, Math.floor(fraction * totalMinutes)));
		const hour = Math.floor(minuteOfDay / 60);
		const minute = minuteOfDay % 60;
		const dayDate = weekDays()[dayIndex];
		const d = new Date(dayDate);
		d.setHours(hour, minute, 0, 0);
		setDragPreview(
			d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
				', ' +
				d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
			e
		);
	}

	// Month view: drop on date cell; keep time from post
	function monthDrop(e: DragEvent, cellDate: Date) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData(DRAG_TYPE);
		if (!raw) return;
		const { postId, scheduled_at } = JSON.parse(raw) as { postId: string; scheduled_at: string };
		const postDate = new Date(scheduled_at);
		const d = new Date(cellDate);
		d.setHours(postDate.getHours(), postDate.getMinutes(), postDate.getSeconds(), 0);
		reschedulePost(postId, toIsoLocal(d));
	}

	function monthDragOver(e: DragEvent, cellDate: Date) {
		if (!e.dataTransfer?.types.includes(DRAG_TYPE)) return;
		e.preventDefault();
		const raw = e.dataTransfer.getData(DRAG_TYPE);
		if (!raw) return;
		const { scheduled_at } = JSON.parse(raw) as { postId: string; scheduled_at: string };
		const postDate = new Date(scheduled_at);
		const d = new Date(cellDate);
		d.setHours(postDate.getHours(), postDate.getMinutes(), postDate.getSeconds(), 0);
		setDragPreview(
			d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
				', ' +
				d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
			e
		);
	}

	// Year view: drop on month; keep day (clamp to month) and time
	function yearDrop(e: DragEvent, monthIndex: number) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData(DRAG_TYPE);
		if (!raw) return;
		const { postId, scheduled_at } = JSON.parse(raw) as { postId: string; scheduled_at: string };
		const postDate = new Date(scheduled_at);
		const y = anchor.getFullYear();
		const lastDay = new Date(y, monthIndex + 1, 0).getDate();
		const day = Math.min(postDate.getDate(), lastDay);
		const d = new Date(y, monthIndex, day, postDate.getHours(), postDate.getMinutes(), postDate.getSeconds(), 0);
		reschedulePost(postId, toIsoLocal(d));
	}

	function yearDragOver(e: DragEvent, monthIndex: number) {
		if (!e.dataTransfer?.types.includes(DRAG_TYPE)) return;
		e.preventDefault();
		const raw = e.dataTransfer.getData(DRAG_TYPE);
		if (!raw) return;
		const { scheduled_at } = JSON.parse(raw) as { postId: string; scheduled_at: string };
		const postDate = new Date(scheduled_at);
		const y = anchor.getFullYear();
		const lastDay = new Date(y, monthIndex + 1, 0).getDate();
		const day = Math.min(postDate.getDate(), lastDay);
		const d = new Date(y, monthIndex, day, postDate.getHours(), postDate.getMinutes(), postDate.getSeconds(), 0);
		setDragPreview(
			d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
				', ' +
				d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
			e
		);
	}

	const viewButtons: Array<{ id: CalendarView; label: string }> = [
		{ id: 'day', label: 'Day' },
		{ id: 'week', label: 'Week' },
		{ id: 'month', label: 'Month' },
		{ id: 'year', label: 'Year' },
		{ id: 'agenda', label: 'Agenda' },
		{ id: 'schedule', label: 'Schedule' }
	];
	const showDateControls = $derived(view !== 'agenda');
</script>

<svelte:head>
	<title>Calendar – PostPlan</title>
</svelte:head>

{#if data.stats}
	{#if showQuickPath && data.stats.totalPosts === 0 && data.stats.scheduleCount === 0}
		<aside
			class="alert-info empty-state-in mb-6 rounded-xl px-4 py-4 sm:px-5 sm:py-5"
			aria-labelledby="calendar-quick-path-title"
		>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div class="min-w-0">
					<h2 id="calendar-quick-path-title" class="text-sm font-semibold text-[var(--text)]">
						First-time checklist
					</h2>
					<p class="mt-1 max-w-[65ch] text-sm leading-relaxed text-[var(--text-muted)]">
						Three steps to your first automated send — you can do them in any order, but this is the usual path.
					</p>
					<ol class="mt-3 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-[var(--text-muted)]">
						<li>
							Add a <a href="/outputs" class="font-medium text-[var(--primary)] hover:underline">webhook</a> on the Outputs page so PostPlan knows where to POST.
						</li>
						<li>
							<a href="/posts/new" class="font-medium text-[var(--primary)] hover:underline">Create a post</a> or
							<a href="/inputs" class="font-medium text-[var(--primary)] hover:underline">import</a> content with a payload.
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

	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
		<div class="min-w-0 flex-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:overflow-visible">
			<div class="flex w-max max-w-full flex-wrap gap-1.5 md:w-auto md:max-w-none">
				<a
					href="/posts"
					title="Total posts"
					class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
				>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Total</p>
					<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.totalPosts}</p>
				</a>
				<a
					href="/posts?status=draft"
					title="Draft posts"
					class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
				>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Drafts</p>
					<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.draft}</p>
				</a>
				<a
					href="/posts?status=scheduled"
					title="Scheduled posts"
					class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
				>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sched.</p>
					<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.scheduled}</p>
				</a>
				<a
					href="/posts?status=sent"
					title="Sent posts"
					class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
				>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sent</p>
					<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.sent}</p>
				</a>
				<a
					href="/posts?status=failed"
					title="Failed posts"
					class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
				>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Failed</p>
					<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.failed}</p>
				</a>
				<a
					href="/schedules"
					title="Schedules"
					class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
				>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sched.</p>
					<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.scheduleCount}</p>
				</a>
				<a
					href="/account?section=globals"
					title="Webhooks"
					class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
				>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Hooks</p>
					<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.stats.webhookCount}</p>
				</a>
				<div class="content-card min-w-[4.75rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5" title="Posts sent this week">
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Week</p>
					<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">{data.sentThisWeek}</p>
				</div>
				<a
					href="/reports?report=callback-stages"
					title="Make.com callback stages (pass / fail)"
					class="content-card min-w-[5.25rem] rounded-lg border border-[var(--primary-border-soft)] px-2 py-1.5 transition-colors hover:border-[var(--primary)]/50 hover:bg-[var(--surface-hover)]"
				>
					<p class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Stages</p>
					<p class="mt-0.5 text-base font-semibold tabular-nums leading-none text-[var(--text)]">
						<span class="text-green-600 dark:text-green-400">{data.stagePasses ?? 0}</span>
						<span class="mx-0.5 text-[var(--text-muted)] font-normal text-sm">/</span>
						<span class="text-red-600 dark:text-red-400">{data.stageFails ?? 0}</span>
					</p>
				</a>
			</div>
		</div>
		<div class="shrink-0">
			<a href="/posts/new" class="btn-primary btn-touch inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				New post
			</a>
		</div>
	</div>
{:else}
	<p class="mb-6 text-sm text-[var(--text-muted)]">Sign in to see your overview.</p>
{/if}

<PageSectionHeading title="Calendar" description="Modern multi-view calendar for scheduled posts." />
{#if sendError}
	<p class="rounded-lg px-3 py-2 text-sm alert-error">{sendError}</p>
{/if}
{#if sendSuccess}
	<p class="rounded-lg px-3 py-2 text-sm alert-success">{sendSuccess}</p>
{/if}

{#if dragPostId && dragPreviewText != null && dragPreviewPos}
	<div
		class="pointer-events-none fixed z-[9999] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] shadow-lg"
		style="left: {dragPreviewPos.x + 12}px; top: {dragPreviewPos.y + 12}px;"
		aria-hidden="true"
	>
		Drop at {dragPreviewText}
	</div>
{/if}

<div class="content-card mt-0 rounded-xl p-4 md:p-5" data-sveltekit-preload-data="tap">
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div
			class="-mx-1 flex max-w-full gap-1 overflow-x-auto overflow-y-hidden rounded-xl bg-[var(--surface)] p-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:pb-1 [&::-webkit-scrollbar]:hidden"
		>
			{#each viewButtons as v}
				<a
					href={hrefFor(v.id, anchor)}
					class="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium touch-manipulation md:min-h-[36px] {view === v.id
						? 'btn-primary text-white'
						: 'text-[var(--text-muted)] hover:text-[var(--text)]'}"
				>
					{v.label}
				</a>
			{/each}
		</div>
		{#if showDateControls}
			<div class="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 sm:flex-nowrap md:w-auto md:justify-end">
				<a
					href={hrefFor(view, withOffset(anchor, view, -1))}
					class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] touch-manipulation"
					aria-label="Previous range"
				>←</a>
				<div
					class="min-w-0 max-w-full flex-1 rounded-lg bg-[var(--surface)] px-2 py-2 text-center text-sm font-semibold text-[var(--text)] sm:min-w-[12rem] sm:flex-none sm:px-3 md:min-w-[210px]"
				>
					<span class="inline-block break-words">{rangeLabel()}</span>
				</div>
				<a
					href={hrefFor(view, withOffset(anchor, view, 1))}
					class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] touch-manipulation"
					aria-label="Next range"
				>→</a>
				<a
					href={hrefFor(view, new Date())}
					class="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] touch-manipulation"
					>Today</a>
			</div>
		{/if}
	</div>
</div>

{#if view === 'month'}
	<div class="content-card mt-4 rounded-xl p-4">
		<div class="mb-3 rounded-xl bg-[var(--surface)] p-3">
			<div class="mb-3 flex items-center justify-center gap-2">
				<a
					href={hrefFor('month', new Date(anchor.getFullYear() - 1, anchor.getMonth(), 1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
					title="Previous year"
				>
					←
				</a>
				<span class="text-lg font-semibold text-[var(--text)]">{anchor.getFullYear()}</span>
				<a
					href={hrefFor('month', new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)]"
				>
					This year
				</a>
				<a
					href={hrefFor('month', new Date(anchor.getFullYear() + 1, anchor.getMonth(), 1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
					title="Next year"
				>
					→
				</a>
			</div>
			<div class="grid w-full grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
				{#each Array.from({ length: 12 }, (_, i) => i) as monthIndex}
					{@const isActiveMonth = anchor.getMonth() === monthIndex}
					{@const monthPostCount = postsForYearMonth(anchor.getFullYear(), monthIndex).length}
					{@const isCurrentMonth = new Date().getMonth() === monthIndex && new Date().getFullYear() === anchor.getFullYear()}
					<a
						href={hrefFor('month', new Date(anchor.getFullYear(), monthIndex, 1))}
						class="relative rounded-lg px-2 py-2 text-center text-xs transition {isActiveMonth
							? 'btn-primary text-white'
							: 'bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-hover)]'} {isCurrentMonth && !isActiveMonth ? 'calendar-today' : ''}"
						title={monthPostCount > 0 ? `${monthNames[monthIndex]}: ${monthPostCount} post(s)` : monthNames[monthIndex]}
					>
						<div class="truncate font-medium">{monthNamesShort[monthIndex]}</div>
						{#if monthPostCount > 0}
							<div class="mt-1 flex items-center justify-center gap-0.5">
								<span
									class="h-1.5 w-1.5 rounded-full"
									style={`background-color: ${isActiveMonth ? 'white' : 'var(--primary)'};`}
								></span>
								{#if monthPostCount > 1}
									<span class="text-[10px] opacity-90">{monthPostCount > 9 ? '9+' : monthPostCount}</span>
								{/if}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	</div>
	<div class="content-card mt-4 overflow-hidden rounded-xl">
		<div class="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)]">
			{#each dayNames as day}
				<div class="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{day}</div>
			{/each}
		</div>
		<div class="grid grid-cols-7">
			{#each monthGridDays() as cell}
				<div
					class="min-h-[88px] border-r border-b border-[var(--border)] p-1.5 last:border-r-0 sm:min-h-[130px] sm:p-2 {isToday(cell.date) ? 'calendar-today' : ''}"
					role="group"
					aria-label="Drop to reschedule"
					ondragover={(e) => monthDragOver(e, cell.date)}
					ondrop={(e) => monthDrop(e, cell.date)}
				>
					<div class="text-right text-xs {cell.inMonth ? 'text-[var(--text)]' : 'text-[var(--text-muted)] opacity-50'} {isToday(cell.date) ? 'calendar-today-num inline-block' : ''}">
						{cell.date.getDate()}
					</div>
					<div class="mt-2 space-y-1">
						{#each postsForDay(cell.date) as post (post.id)}
							<div
								class="calendar-post-accent rounded-lg px-2 py-2 cursor-grab active:cursor-grabbing {dragPostId === post.id ? 'opacity-50' : ''}"
								style={`background-color: ${post.color ?? '#ffffff'}; border-left-color: ${post.color ?? '#ffffff'};`}
								role="button"
								tabindex="-1"
								aria-label="Drag to reschedule"
								draggable={true}
								ondragstart={(e) => handleDragStart(e, post)}
								ondragend={handleDragEnd}
							>
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
										class="min-h-[36px] min-w-[44px] touch-manipulation rounded px-2 py-1 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 sm:min-h-0 sm:min-w-0 sm:px-1.5 sm:py-0.5"
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
		<div class="mb-3 rounded-xl bg-[var(--surface)] p-3">
			<div class="mb-2 flex items-center justify-between">
				<a
					href={hrefFor('week', new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
					title="Previous month"
				>
					←
				</a>
				<p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
					Weeks of {monthNames[anchor.getMonth()]} {anchor.getFullYear()}
				</p>
				<a
					href={hrefFor('week', new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
					title="Next month"
				>
					→
				</a>
			</div>
			<div
				class="grid w-full gap-2"
				style={`grid-template-columns: repeat(${monthWeekCount()}, minmax(0, 1fr));`}
			>
				{#each monthWeekStarts() as ws}
					{@const activeWeek = localDateKey(weekStart(ws)) === localDateKey(weekStart(anchor))}
					{@const weekCount = weekPostCount(ws)}
					{@const weekNo = weekNumberOfYear(ws)}
					<a
						href={hrefFor('week', ws)}
						class="rounded-lg px-2 py-2 text-xs text-center transition {activeWeek
							? 'btn-primary text-white'
							: 'bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-hover)]'}"
						title={weekCount > 0 ? `${weekCount} post(s) this week` : undefined}
					>
						<div class="truncate font-semibold text-4xl">W{weekNo}</div>
						<div class="truncate opacity-90">{weekChipLabel(ws)}</div>
						{#if weekCount > 0}
							<div class="mt-1 flex items-center justify-center gap-1">
								<span
									class="h-1.5 w-1.5 rounded-full"
									style={`background-color: ${activeWeek ? 'white' : 'var(--primary)'};`}
								></span>
								{#if weekCount > 9}
									<span class="text-[10px] opacity-80">9+</span>
								{/if}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		</div>
		<div class="overflow-x-auto">
			<div class="min-w-[980px]">
				<div
					class="grid"
					style={`grid-template-columns: 72px repeat(7, minmax(0, 1fr));`}
				>
					<div class="border-b border-[var(--border)] bg-[var(--surface)]"></div>
					{#each weekDays() as d}
					<div class="border-b border-l border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-center {isToday(d) ? 'calendar-today' : ''}">
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

					{#each weekDays() as d, dayIndex}
						<div
							class="relative border-l border-[var(--border)] bg-[var(--bg)] {isToday(d) ? 'calendar-today' : ''}"
							style={`height: ${24 * WEEK_HOUR_SLOT_PX}px;`}
							role="group"
							aria-label="Drop to reschedule"
							ondragover={(e) => weekDragOver(e, dayIndex)}
							ondrop={(e) => weekDrop(e, dayIndex)}
						>
							{#each weekHours as hour}
								<div
									class="absolute left-0 right-0 border-t border-dashed border-[var(--border)]/70"
									style={`top: ${hour * WEEK_HOUR_SLOT_PX}px;`}
								></div>
							{/each}

							{#each weekPostsForDay(d) as post (post.id)}
								<div
									class="calendar-post-accent absolute left-1 right-1 rounded-lg px-2 py-2 shadow-sm cursor-grab active:cursor-grabbing {dragPostId === post.id ? 'opacity-50' : ''}"
									style={`top: ${weekPostTopPx(post.scheduled_at)}px; height: ${WEEK_POST_HEIGHT_PX}px; background-color: ${post.color ?? '#ffffff'}; border-left-color: ${post.color ?? '#ffffff'};`}
									role="button"
									tabindex="-1"
									aria-label="Drag to reschedule"
									draggable={true}
									ondragstart={(e) => handleDragStart(e, post)}
									ondragend={handleDragEnd}
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
		<div class="mb-4 rounded-xl bg-[var(--surface)] p-3">
			<div class="mb-2 flex items-center justify-between">
				<a
					href={hrefFor('day', withOffset(anchor, 'week', -1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
				>
					←
				</a>
				<p class="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Day quick navigation</p>
				<a
					href={hrefFor('day', withOffset(anchor, 'week', 1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
				>
					→
				</a>
			</div>
			<div class="grid grid-cols-7 gap-2">
				{#each weekDays() as d}
					{@const isActiveDay = localDateKey(d) === localDateKey(anchor)}
					{@const isTodayDay = isToday(d)}
					{@const dayPosts = postsForDay(d)}
					<a
						href={hrefFor('day', d)}
						class="relative rounded-lg px-2 py-2 text-center text-xs transition {isActiveDay
							? 'btn-primary text-white'
							: 'bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-hover)]'} {isTodayDay && !isActiveDay ? 'calendar-today' : ''}"
						title={dayPosts.length > 0 ? `${dayPosts.length} post(s)` : undefined}
					>
						<div class="text-2xl">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
						<div class="text-2xl lg:text-6xl font-semibold">{d.getDate()}</div>
						{#if dayPosts.length > 0}
							<div class="mt-1 flex items-center justify-center gap-1">
								{#each dayPosts.slice(0, 3) as p (p.id)}
									<span
										class="h-1.5 w-1.5 rounded-full"
										style={`background-color: ${isActiveDay ? 'white' : darkenMarkerColor(p.color)};`}
									></span>
								{/each}
								{#if dayPosts.length > 3}
									<span class="text-[10px] opacity-80">+{dayPosts.length - 3}</span>
								{/if}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		</div>
		<!-- Day overview: full width, markers only -->
		<div class="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
			<p class="mb-2 text-xs font-medium text-[var(--text-muted)]">Day overview</p>
			<div
				class="grid w-full"
				style="grid-template-columns: repeat(24, minmax(0, 1fr));"
			>
				{#each weekHours as hour}
					<div class="border-r border-[var(--border)] px-0.5 py-1 text-center text-[10px] text-[var(--text-muted)] last:border-r-0">
						{formatHourLabel(hour)}
					</div>
				{/each}
				{#each weekHours as hour}
					<div class="flex min-h-[28px] flex-wrap items-center justify-center gap-0.5 border-r border-t border-[var(--border)] px-0.5 py-1 last:border-r-0">
						{#each postsAtHour(hour) as post (post.id)}
							<a
								href={"/posts/" + post.id}
								class="block h-2 w-2 rounded-full border border-[var(--border)] hover:scale-125"
								style={`background-color: ${post.color ?? '#e5e7eb'};`}
								title={post.title + ' — ' + formatTime(post.scheduled_at)}
							></a>
						{/each}
					</div>
				{/each}
			</div>
		</div>
		{#if dayViewPosts().length === 0}
			<p class="mb-3 text-sm text-[var(--text-muted)]">No posts scheduled for this day.</p>
		{/if}
		<div class="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
			<div class="divide-y divide-[var(--border)]">
				{#each weekHours as hour}
					<div class="grid min-h-[72px] grid-cols-[72px_1fr] bg-[var(--bg)]">
						<div class="flex items-start justify-end border-r border-[var(--border)] bg-[var(--surface)] px-2 py-3">
							<span class="text-right text-xs font-medium text-[var(--text-muted)]">{formatHourLabel(hour)}</span>
						</div>
						<div
							class="flex flex-wrap content-start gap-2 p-2"
							role="group"
							aria-label="Drop to reschedule"
							ondragover={(e) => dayDragOver(e, hour)}
							ondrop={(e) => dayDrop(e, hour)}
						>
							{#each postsAtHour(hour) as post (post.id)}
								<div
									class="calendar-post-accent min-w-0 max-w-sm flex-[1_1_240px] rounded-lg p-2 shadow-sm cursor-grab active:cursor-grabbing {dragPostId === post.id ? 'opacity-50' : ''}"
									style={`background-color: ${post.color ?? '#ffffff'}; border-left-color: ${post.color ?? 'var(--border)'};`}
									role="button"
									tabindex="-1"
									aria-label="Drag to reschedule"
									draggable={true}
									ondragstart={(e) => handleDragStart(e, post)}
									ondragend={handleDragEnd}
								>
									<div class="flex min-w-0 flex-col gap-1">
										{#if post.image_url}
											<img src={post.image_url} alt="" class="h-8 w-8 shrink-0 rounded border border-[var(--border)] object-cover" loading="lazy" />
										{/if}
										<a href={"/posts/" + post.id} class="break-words text-sm font-medium text-[var(--text)] hover:underline" title={post.title}>{post.title}</a>
										<p class="break-words text-[10px] text-[var(--text-muted)]">{formatTime(post.scheduled_at)} · {post.webhook_name}</p>
										<div class="mt-1 flex flex-wrap items-center gap-1">
											<span class={"rounded px-1.5 py-0.5 text-[10px] font-medium " + statusClass(post.status)}>{post.status}</span>
											<button
												type="button"
												class="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)]"
												disabled={sendingId === post.id}
												onclick={(e) => sendNow(post.id, e)}
											>
												{sendingId === post.id ? '…' : 'Send'}
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else if view === 'year'}
	<div class="content-card mt-4 rounded-xl p-4">
		<div class="mb-4 rounded-xl bg-[var(--surface)] p-3">
			<div class="flex items-center justify-center gap-2">
				<a
					href={hrefFor('year', new Date(anchor.getFullYear() - 1, 0, 1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
					title="Previous year"
				>
					←
				</a>
				<span class="text-lg font-semibold text-[var(--text)]">{anchor.getFullYear()}</span>
				<a
					href={hrefFor('year', new Date(new Date().getFullYear(), 0, 1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)]"
				>
					This year
				</a>
				<a
					href={hrefFor('year', new Date(anchor.getFullYear() + 1, 0, 1))}
					class="rounded-lg bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
					title="Next year"
				>
					→
				</a>
			</div>
		</div>
		<div class="overflow-hidden rounded-xl border border-[var(--border)]">
			<div class="grid grid-cols-1 gap-px bg-[var(--border)] md:grid-cols-2 xl:grid-cols-3">
				{#each yearMonthAnchors as monthDate}
					{@const monthIndex = monthDate.getMonth()}
					{@const monthPosts = postsForYearMonth(anchor.getFullYear(), monthIndex)}
					{@const isCurrentMonth = new Date().getMonth() === monthIndex && new Date().getFullYear() === anchor.getFullYear()}
					{@const yearMonth = yearMonthKey(anchor.getFullYear(), monthIndex)}
					{@const isExpanded = expandedYearMonths.has(yearMonth)}
					{@const postsToShow = isExpanded ? monthPosts : monthPosts.slice(0, 4)}
					<div
						class="min-h-[140px] bg-[var(--surface)] p-3 {isCurrentMonth ? 'calendar-today' : ''}"
						role="group"
						aria-label="Drop to reschedule"
						ondragover={(e) => yearDragOver(e, monthIndex)}
						ondrop={(e) => yearDrop(e, monthIndex)}
					>
						<p class="text-sm font-semibold text-[var(--text)]">{monthNames[monthIndex]}</p>
						<p class="mt-1 text-xs text-[var(--text-muted)]">
							{monthPosts.length} {monthPosts.length === 1 ? 'post' : 'posts'}
						</p>
						<div class="mt-2 space-y-1">
							{#each postsToShow as post (post.id)}
								<a
									href={"/posts/" + post.id}
									class="calendar-post-accent block min-w-0 cursor-grab truncate rounded-md px-2 py-1 text-xs text-[var(--text)] hover:underline active:cursor-grabbing {dragPostId === post.id ? 'opacity-50' : ''}"
									style={`background-color: ${post.color ?? '#ffffff'}; border-left-color: ${post.color ?? '#ffffff'};`}
									title={`${new Date(post.scheduled_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · ${post.title}`}
									draggable={true}
									ondragstart={(e) => handleDragStart(e, post)}
									ondragend={handleDragEnd}
								>
									{new Date(post.scheduled_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · {post.title}
								</a>
							{/each}
							{#if monthPosts.length > 4}
								<button
									type="button"
									onclick={() => toggleYearMonthExpanded(anchor.getFullYear(), monthIndex)}
									class="mt-0.5 text-xs font-medium text-[var(--primary)] hover:underline"
								>
									{isExpanded ? 'Show less' : `+${monthPosts.length - 4} more`}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else if view === 'agenda'}
	<div class="content-card mt-4 rounded-xl p-4">
		{#if posts.length === 0}
			<p class="text-sm text-[var(--text-muted)]">
				No posts in this date range. Adjust the range above, or go to
				<a href="/posts" class="font-medium text-[var(--primary)] hover:underline">Posts</a>
				to schedule one.
			</p>
		{:else}
			<div class="space-y-2">
				{#each posts as post (post.id)}
					{@const postDate = new Date(post.scheduled_at)}
					{@const isPostToday = isToday(postDate)}
					<div
						class="calendar-post-accent rounded-lg p-2 {isPostToday ? 'calendar-today' : ''}"
						style={`background-color: ${post.color ?? '#ffffff'}; border-left-color: ${post.color ?? '#ffffff'};`}
					>
						<div class="flex items-center gap-2">
							{#if post.image_url}
								<img src={post.image_url} alt={"Preview for " + post.title} class="h-8 w-8 rounded object-cover border border-[var(--border)]" loading="lazy" />
							{/if}
							<a href={"/posts/" + post.id} class="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)] hover:underline">
								{new Date(post.scheduled_at).toLocaleString()} · {post.title}
							</a>
							<button
								type="button"
								class="rounded px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
								disabled={sendingId === post.id}
								onclick={(e) => sendNow(post.id, e)}
							>
								{sendingId === post.id ? '…' : 'Send'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{:else if view === 'schedule'}
	<div class="content-card mt-4 rounded-xl p-4">
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
			{#each yearMonthAnchors as monthDate}
				<div class="rounded-xl bg-[var(--surface)] p-3">
					<p class="mb-2 text-sm font-semibold text-[var(--text)]">{monthNames[monthDate.getMonth()]}</p>
					<div class="mb-1 grid grid-cols-7 gap-1">
						{#each dayNames as day}
							<div class="text-center text-[10px] font-semibold text-[var(--text-muted)]">{day.slice(0, 1)}</div>
						{/each}
					</div>
					<div class="grid grid-cols-7 gap-1">
						{#each scheduleMiniMonthGrids?.get(monthDate.getMonth()) ?? [] as cell}
							{@const dayPosts = postsForDay(cell.date)}
							<div class="relative h-8 rounded bg-[var(--bg)]/60 px-1 pt-1 {cell.inMonth ? '' : 'opacity-35'} {isToday(cell.date) ? 'calendar-today' : ''}">
								<div class="text-[10px] leading-none text-[var(--text-muted)]">{cell.date.getDate()}</div>
								<div class="mt-0.5 flex flex-wrap gap-0.5">
									{#each dayPosts as post (post.id)}
										<a
											href={"/posts/" + post.id}
											class="h-1.5 w-1.5 rounded-full"
											style={`background-color: ${darkenMarkerColor(post.color)};`}
											title={`${post.title} • ${new Date(post.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}
										></a>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<div class="content-card mt-4 rounded-xl p-4">
		<p class="text-sm text-[var(--text-muted)]">Unsupported calendar view.</p>
	</div>
{/if}
