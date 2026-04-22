<script lang="ts">
	import { onMount, tick } from 'svelte';
	import CalendarPostBadges from '$lib/components/calendar/CalendarPostBadges.svelte';
	import CompactCalendarDayPostList from '$lib/components/calendar/CompactCalendarDayPostList.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const QUICK_PATH_KEY = 'postplan-dismiss-dashboard-path';
	let showQuickPath = $state(false);

	onMount(() => {
		if (typeof localStorage === 'undefined') return;
		if (localStorage.getItem(QUICK_PATH_KEY) === '1') return;
		showQuickPath = true;
	});

	onMount(() => {
		const id = setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			void invalidateAll();
		}, 10000);
		return () => clearInterval(id);
	});

	/** HTML5 drag breaks tap-to-follow-link on many touch browsers; only enable with fine pointer (mouse / trackpad). */
	let calendarDragEnabled = $state(false);
	onMount(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(pointer: fine)');
		const sync = () => {
			calendarDragEnabled = mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	/** Month view &lt;lg: selected day for list under grid; image taps set highlight id. */
	let touchListSelectedKey = $state<string | null>(null);
	let touchListHighlightPostId = $state<string | null>(null);
	/** Only sync list day from URL when anchor actually changes (not on `invalidateAll` post refresh). */
	let lastTouchListSyncedAnchor = $state<string | null>(null);

	function dateFromLocalKey(key: string): Date {
		const [y, m, d] = key.split('-').map(Number);
		return new Date(y, m - 1, d);
	}

	function selectTouchListDay(d: Date, postId?: string | null) {
		touchListSelectedKey = localDateKey(d);
		touchListHighlightPostId = postId ?? null;
	}

	$effect(() => {
		const v = data.view;
		const ad = data.anchorDate;
		if (v !== 'month') {
			lastTouchListSyncedAnchor = null;
			return;
		}
		if (lastTouchListSyncedAnchor !== ad) {
			lastTouchListSyncedAnchor = ad;
			touchListSelectedKey = ad;
			touchListHighlightPostId = null;
		}
	});

	$effect(() => {
		const id = touchListHighlightPostId;
		if (!id) return;
		void tick().then(() => {
			document.getElementById(`touch-post-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
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
		has_output_webhook: number;
	};

	/** Inline “no output webhook” pill (match posts list styling, calendar density). */
	const calendarNoOutputPillClass =
		'shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100';

	/** Light grey for unselected calendar buttons (tabs, arrows, chips). */
	const calendarUnselectedBtnClass =
		'bg-zinc-100 hover:bg-zinc-200/90 dark:bg-zinc-800/60 dark:hover:bg-zinc-700/80';
	/** Unselected day cell / compact grid cell (selected stays primary or surface). */
	const calendarUnselectedCellClass = 'bg-zinc-100 dark:bg-zinc-800/50';
	type LiveStatusRow = {
		id: string;
		status: string;
		scheduled_at: string | null;
	};

	function parseScheduledAt(value: string): Date {
		const normalized = value.trim().replace(' ', 'T');
		if (/[zZ]$/.test(normalized) || /[+-]\d{2}:?\d{2}$/.test(normalized)) return new Date(normalized);
		return new Date(`${normalized}Z`);
	}

	function formatScheduledAt(
		value: string,
		opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
	): string {
		return new Intl.DateTimeFormat(undefined, { timeZone: data.timezone, ...opts }).format(
			parseScheduledAt(value)
		);
	}

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
	const WEEK_HOUR_SLOT_PX = 64;
	const WEEK_POST_HEIGHT_PX = 80;
	const weekHours = Array.from({ length: 24 }, (_, hour) => hour);

	const view = $derived(data.view as CalendarView);
	const anchor = $derived(new Date(data.anchorDate + 'T00:00:00'));
	let livePosts = $state<CalendarPost[]>([]);
	$effect(() => {
		livePosts = [...(data.posts as CalendarPost[])];
	});
	const posts = $derived(
		[...livePosts].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
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

	const touchListPosts = $derived.by(() => {
		const key = touchListSelectedKey ?? data.anchorDate;
		return [...(postsByDate.get(key) ?? [])].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
	});

	const touchListHeading = $derived.by(() => {
		const key = touchListSelectedKey ?? data.anchorDate;
		const d = dateFromLocalKey(key);
		return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
	});
	/** Year-scoped month buckets for month-year strip + year view only (avoids extra work on other views). */
	const postsByYearMonth = $derived.by(() => {
		const map = new Map<string, CalendarPost[]>();
		if (view !== 'month' && view !== 'year') return map;
		for (const post of posts) {
			const d = parseScheduledAt(post.scheduled_at);
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

	/** Shorter range for narrow week chips (mobile). */
	function weekChipLabelCompact(weekStartDate: Date): string {
		const end = new Date(weekStartDate);
		end.setDate(end.getDate() + 6);
		const sameMonth =
			weekStartDate.getMonth() === end.getMonth() &&
			weekStartDate.getFullYear() === end.getFullYear();
		if (sameMonth) {
			const m = weekStartDate.toLocaleDateString(undefined, { month: 'short' });
			return `${weekStartDate.getDate()}–${end.getDate()} ${m}`;
		}
		const a = weekStartDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
		const b = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
		return `${a}–${b}`;
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
		return formatScheduledAt(iso, { hour: '2-digit', minute: '2-digit' });
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

	async function refreshLiveStatuses() {
		if (livePosts.length === 0) return;
		const ids = livePosts.map((p) => p.id);
		try {
			const res = await fetch('/api/posts/status', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids })
			});
			if (!res.ok) return;
			const body = (await res.json()) as { statuses?: LiveStatusRow[] };
			const updates = new Map((body.statuses ?? []).map((r) => [r.id, r] as const));
			if (updates.size === 0) return;
			livePosts = livePosts.map((p) => {
				const u = updates.get(p.id);
				if (!u) return p;
				return {
					...p,
					status: u.status,
					scheduled_at: u.scheduled_at ?? p.scheduled_at
				};
			});
		} catch {
			// Keep UI stable if polling fails transiently.
		}
	}

	onMount(() => {
		void refreshLiveStatuses();
		const id = setInterval(refreshLiveStatuses, 10000);
		return () => clearInterval(id);
	});

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
		const postDate = parseScheduledAt(scheduled_at);
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
		const postDate = parseScheduledAt(scheduled_at);
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
		const postDate = parseScheduledAt(scheduled_at);
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
		const postDate = parseScheduledAt(scheduled_at);
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

	/** MDI paths (@mdi/svg), Material Design Icons — see https://pictogrammers.com/library/mdi/ */
	const viewButtons: Array<{ id: CalendarView; label: string; iconPath: string }> = [
		{
			id: 'day',
			label: 'Day',
			iconPath:
				'M7,10H12V15H7M19,19H5V8H19M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3Z'
		},
		{
			id: 'week',
			label: 'Week',
			iconPath:
				'M6 1H8V3H16V1H18V3H19C20.11 3 21 3.9 21 5V19C21 20.11 20.11 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.89 3.89 3 5 3H6V1M5 8V19H19V8H5M7 10H17V12H7V10Z'
		},
		{
			id: 'month',
			label: 'Month',
			iconPath:
				'M9,10V12H7V10H9M13,10V12H11V10H13M17,10V12H15V10H17M19,3A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5C3.89,21 3,20.1 3,19V5A2,2 0 0,1 5,3H6V1H8V3H16V1H18V3H19M19,19V8H5V19H19M9,14V16H7V14H9M13,14V16H11V14H13M17,14V16H15V14H17Z'
		},
		{
			id: 'year',
			label: 'Year',
			iconPath:
				'M21,17V8H7V17H21M21,3A2,2 0 0,1 23,5V17A2,2 0 0,1 21,19H7C5.89,19 5,18.1 5,17V5A2,2 0 0,1 7,3H8V1H10V3H18V1H20V3H21M3,21H17V23H3C1.89,23 1,22.1 1,21V9H3V21M19,15H15V11H19V15Z'
		},
		{
			id: 'agenda',
			label: 'Agenda',
			iconPath:
				'M7,5H21V7H7V5M7,13V11H21V13H7M4,4.5A1.5,1.5 0 0,1 5.5,6A1.5,1.5 0 0,1 4,7.5A1.5,1.5 0 0,1 2.5,6A1.5,1.5 0 0,1 4,4.5M4,10.5A1.5,1.5 0 0,1 5.5,12A1.5,1.5 0 0,1 4,13.5A1.5,1.5 0 0,1 2.5,12A1.5,1.5 0 0,1 4,10.5M7,19V17H21V19H7M4,16.5A1.5,1.5 0 0,1 5.5,18A1.5,1.5 0 0,1 4,19.5A1.5,1.5 0 0,1 2.5,18A1.5,1.5 0 0,1 4,16.5Z'
		},
		{
			id: 'schedule',
			label: 'Schedule',
			iconPath:
				'M15,13H16.5V15.82L18.94,17.23L18.19,18.53L15,16.69V13M19,8H5V19H9.67C9.24,18.09 9,17.07 9,16A7,7 0 0,1 16,9C17.07,9 18.09,9.24 19,9.67V8M5,21C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H6V1H8V3H16V1H18V3H19A2,2 0 0,1 21,5V11.1C22.24,12.36 23,14.09 23,16A7,7 0 0,1 16,23C14.09,23 12.36,22.24 11.1,21H5M16,11.15A4.85,4.85 0 0,0 11.15,16C11.15,18.68 13.32,20.85 16,20.85A4.85,4.85 0 0,0 20.85,16C20.85,13.32 18.68,11.15 16,11.15Z'
		}
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
							<a href="/inputs/webhooks" class="font-medium text-[var(--primary)] hover:underline">import</a> content with a payload.
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
{:else}
	<p class="mb-6 text-sm text-[var(--text-muted)]">Sign in to see your overview.</p>
{/if}

<div class="mb-0 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
	<div class="min-w-0">
		<h1 class="truncate text-2xl font-semibold text-[var(--text)]">Calendar</h1>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Modern multi-view calendar for scheduled posts.</p>
	</div>
	<div
		class="row-start-1 col-start-2 ml-auto hidden min-w-0 max-w-[28rem] gap-1 overflow-x-auto overflow-y-hidden rounded-xl bg-[var(--surface)] p-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex md:justify-end [&::-webkit-scrollbar]:hidden"
	>
		{#each viewButtons as v}
			<a
				href={hrefFor(v.id, anchor)}
				class="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-2 py-2 text-xs font-medium touch-manipulation md:min-w-0 md:px-3 lg:min-h-[36px] {view === v.id
					? 'btn-primary text-white'
					: `${calendarUnselectedBtnClass} text-[var(--text-muted)] hover:text-[var(--text)]`}"
				aria-label={v.label}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-[1.35rem] w-[1.35rem] shrink-0 lg:hidden"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path fill="currentColor" d={v.iconPath} />
				</svg>
				<span class="hidden lg:inline">{v.label}</span>
			</a>
		{/each}
	</div>
</div>
<div
	class="fixed z-30 flex min-w-0 max-w-[65vw] gap-1 overflow-x-auto overflow-y-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 pb-2 shadow md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
	style="right: max(1rem, env(safe-area-inset-right, 0px)); top: max(1rem, env(safe-area-inset-top, 0px));"
>
	{#each viewButtons as v}
		<a
			href={hrefFor(v.id, anchor)}
			class="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-2 py-2 text-xs font-medium touch-manipulation {view === v.id
				? 'btn-primary text-white'
				: `${calendarUnselectedBtnClass} text-[var(--text-muted)] hover:text-[var(--text)]`}"
			aria-label={v.label}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-[1.35rem] w-[1.35rem] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
				<path fill="currentColor" d={v.iconPath} />
			</svg>
		</a>
	{/each}
</div>
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

<div class="content-card relative z-0 mt-0 min-w-0 overflow-x-clip rounded-xl p-4 md:p-5" data-sveltekit-preload-data="tap">
	{#if showDateControls}
		<div
			class="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:justify-center lg:w-auto lg:max-w-none lg:shrink-0"
		>
				<a
					href={hrefFor(view, withOffset(anchor, view, -1))}
					class="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text)] touch-manipulation {calendarUnselectedBtnClass}"
					aria-label="Previous range"
				>←</a>
				<div
					class="min-w-0 max-w-full flex-[1_1_14rem] rounded-lg px-2 py-2 text-center text-sm font-semibold text-[var(--text)] sm:flex-1 sm:basis-0 sm:px-3 md:max-w-md lg:max-w-lg {calendarUnselectedBtnClass}"
				>
					<span class="inline-block max-w-full min-w-0 break-words sm:truncate">{rangeLabel()}</span>
				</div>
				<a
					href={hrefFor(view, withOffset(anchor, view, 1))}
					class="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--text)] touch-manipulation {calendarUnselectedBtnClass}"
					aria-label="Next range"
				>→</a>
				<a
					href={hrefFor(view, new Date())}
					class="inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm text-[var(--text)] touch-manipulation {calendarUnselectedBtnClass}"
					>Today</a>
				{#if data.stats}
					<a
						href="/posts/new"
						class="btn-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm touch-manipulation"
						aria-label="New post"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
					</a>
				{/if}
		</div>
	{:else if data.stats}
		<div
			class="flex w-full min-w-0 shrink-0 justify-center lg:w-auto lg:flex-none lg:justify-end lg:self-center"
		>
				<a
					href="/posts/new"
					class="btn-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm touch-manipulation"
					aria-label="New post"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
				</a>
		</div>
	{/if}
</div>

{#if view === 'month'}
	<div class="content-card rounded-xl px-4 pb-4">
		<div class="mb-3 rounded-xl bg-[var(--surface)]">
			<div class="grid w-full grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
				{#each Array.from({ length: 12 }, (_, i) => i) as monthIndex}
					{@const isActiveMonth = anchor.getMonth() === monthIndex}
					{@const monthPostCount = postsForYearMonth(anchor.getFullYear(), monthIndex).length}
					{@const isCurrentMonth = new Date().getMonth() === monthIndex && new Date().getFullYear() === anchor.getFullYear()}
					<a
						href={hrefFor('month', new Date(anchor.getFullYear(), monthIndex, 1))}
						class="relative rounded-lg px-2 py-2 text-center text-xs transition {isActiveMonth
							? 'btn-primary text-white'
							: `${calendarUnselectedBtnClass} text-[var(--text)]`} {isCurrentMonth && !isActiveMonth ? 'calendar-today' : ''}"
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
		<div class="space-y-4 p-3 lg:hidden">
			<div class="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)]">
				{#each dayNames as day}
					<div class="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:px-2 sm:text-xs">
						{day}
					</div>
				{/each}
			</div>
			<div class="grid grid-cols-7 border-l border-[var(--border)] bg-[var(--surface)]">
				{#each monthGridDays() as cell}
					{@const cellKey = localDateKey(cell.date)}
					{@const listKey = touchListSelectedKey ?? data.anchorDate}
					<div
						class="min-h-[76px] border-r border-b border-[var(--border)] p-1 last:border-r-0 sm:min-h-[88px] sm:p-1.5 {isToday(cell.date)
							? 'calendar-today'
							: ''} {cellKey === listKey
							? 'bg-[var(--surface)] ring-2 ring-inset ring-[var(--primary)]'
							: calendarUnselectedCellClass}"
						role="group"
						aria-label="Drop to reschedule"
						ondragover={(e) => monthDragOver(e, cell.date)}
						ondrop={(e) => monthDrop(e, cell.date)}
					>
						<button
							type="button"
							class="flex w-full touch-manipulation justify-end text-xs {cell.inMonth
								? 'text-[var(--text)]'
								: 'text-[var(--text-muted)] opacity-50'}"
							onclick={() => selectTouchListDay(cell.date)}
							aria-label={`Select ${cellKey} to show posts below`}
						>
							<span class={isToday(cell.date) ? 'calendar-today-num' : ''}>{cell.date.getDate()}</span>
						</button>
						<div class="mt-1 flex flex-wrap justify-center gap-1">
							{#each postsForDay(cell.date) as post (post.id)}
								<button
									type="button"
									class="touch-manipulation overflow-hidden rounded-md border border-[var(--border)] shadow-sm outline-none ring-offset-1 {touchListHighlightPostId === post.id
										? 'ring-2 ring-[var(--primary)]'
										: calendarUnselectedCellClass}"
									onclick={() => selectTouchListDay(cell.date, post.id)}
									aria-label={`Show ${post.title} in the list below`}
								>
									{#if post.image_url}
										<img
											src={post.image_url}
											alt=""
											class="h-10 w-10 object-cover sm:h-11 sm:w-11"
											loading="lazy"
										/>
									{:else}
										<div
											class="flex h-10 w-10 items-center justify-center bg-[var(--surface-hover)] text-[10px] font-semibold text-[var(--text-muted)] sm:h-11 sm:w-11"
											aria-hidden="true"
										>
											{post.title.trim().slice(0, 1).toUpperCase() || '·'}
										</div>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<CompactCalendarDayPostList
				heading={`Posts for ${touchListHeading}`}
				posts={touchListPosts}
				highlightPostId={touchListHighlightPostId}
				sendingId={sendingId}
				{formatTime}
				{sendNow}
			/>
		</div>
		<div class="hidden lg:block">
			<div class="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)]">
				{#each dayNames as day}
					<div class="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{day}</div>
				{/each}
			</div>
			<div class="grid grid-cols-7 border-l border-[var(--border)] bg-[var(--surface)]">
				{#each monthGridDays() as cell}
					<div
						class="min-h-[88px] border-r border-b border-[var(--border)] p-1.5 last:border-r-0 sm:min-h-[130px] sm:p-2 {isToday(cell.date) ? 'calendar-today' : ''}"
						role="group"
						aria-label="Drop to reschedule"
						ondragover={(e) => monthDragOver(e, cell.date)}
						ondrop={(e) => monthDrop(e, cell.date)}
					>
						<div
							class="flex justify-end text-xs {cell.inMonth ? 'text-[var(--text)]' : 'text-[var(--text-muted)] opacity-50'}"
						>
							<span class={isToday(cell.date) ? 'calendar-today-num' : ''}>{cell.date.getDate()}</span>
						</div>
						<div class="mt-2 space-y-1">
							{#each postsForDay(cell.date) as post (post.id)}
								<div
									class="calendar-post-accent rounded-lg px-2 py-2 {calendarDragEnabled
										? 'cursor-grab active:cursor-grabbing'
										: ''} {dragPostId === post.id ? 'opacity-50' : ''}"
									style={`background-color: ${post.color ?? '#fafafa'}; border-left-color: ${post.color ?? '#fafafa'};`}
									role="button"
									tabindex="-1"
									aria-label={calendarDragEnabled ? 'Drag to reschedule' : 'Post'}
									draggable={calendarDragEnabled}
									ondragstart={(e) => handleDragStart(e, post)}
									ondragend={handleDragEnd}
								>
									<div class="flex items-center gap-1">
										{#if post.image_url}
											<img src={post.image_url} alt={"Preview for " + post.title} class="h-5 w-5 rounded object-cover border border-[var(--border)]" loading="lazy" />
										{/if}
										<a
											href={"/posts/" + post.id}
											class="relative z-[1] min-w-0 flex-1 touch-manipulation truncate text-xs font-medium text-neutral-900 hover:underline"
										>
											{formatTime(post.scheduled_at)} {post.title}
										</a>
									</div>
									<div class="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
										<CalendarPostBadges
											status={post.status}
											hasOutputWebhook={post.has_output_webhook}
											postHref={'/posts/' + post.id}
											textOnly={false}
											hideStatus={false}
										/>
										{#if post.has_output_webhook}
											<button
												type="button"
												disabled={sendingId === post.id}
												onclick={(e) => sendNow(post.id, e)}
												class="min-h-[36px] min-w-[44px] shrink-0 touch-manipulation rounded px-2 py-1 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50 sm:min-h-0 sm:min-w-0 sm:px-1.5 sm:py-0.5"
											>
												{sendingId === post.id ? '…' : 'Send'}
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else if view === 'week'}
	<div class="content-card mt-4 rounded-xl p-3">
		<div class="mb-6 rounded-xl bg-[var(--surface)]">
			<div
				class="grid w-full gap-1 sm:gap-2"
				style={`grid-template-columns: repeat(${monthWeekCount()}, minmax(0, 1fr));`}
			>
				{#each monthWeekStarts() as ws}
					{@const activeWeek = localDateKey(weekStart(ws)) === localDateKey(weekStart(anchor))}
					{@const weekCount = weekPostCount(ws)}
					{@const weekNo = weekNumberOfYear(ws)}
					<a
						href={hrefFor('week', ws)}
						class="min-w-0 rounded-lg px-1.5 py-2 text-center text-xs transition sm:px-2 {activeWeek
							? 'btn-primary text-white'
							: `${calendarUnselectedBtnClass} text-[var(--text)]`}"
						title={weekCount > 0 ? `Week ${weekNo}: ${weekChipLabel(ws)} — ${weekCount} post(s)` : `Week ${weekNo}: ${weekChipLabel(ws)}`}
					>
						<div
							class="font-semibold tabular-nums leading-none text-sm sm:text-base md:text-xl lg:text-4xl"
						>
							W{weekNo}
						</div>
						<div class="mt-1 text-[10px] leading-snug text-balance opacity-90 sm:text-xs md:text-sm lg:text-base">
							<span class="md:hidden">{weekChipLabelCompact(ws)}</span>
							<span class="hidden md:inline">{weekChipLabel(ws)}</span>
						</div>
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
									class="calendar-post-accent absolute left-1 right-1 rounded-lg px-2 py-1.5 shadow-sm sm:px-2.5 sm:py-2 {calendarDragEnabled
										? 'cursor-grab active:cursor-grabbing'
										: ''} {dragPostId === post.id ? 'opacity-50' : ''}"
									style={`top: ${weekPostTopPx(post.scheduled_at)}px; height: ${WEEK_POST_HEIGHT_PX}px; background-color: ${post.color ?? '#fafafa'}; border-left-color: ${post.color ?? '#fafafa'};`}
									role="button"
									tabindex="-1"
									aria-label={calendarDragEnabled ? 'Drag to reschedule' : 'Post'}
									draggable={calendarDragEnabled}
									ondragstart={(e) => handleDragStart(e, post)}
									ondragend={handleDragEnd}
								>
									<div class="flex h-full min-h-0 min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
										<div class="flex min-h-0 min-w-0 flex-1 items-start gap-2 sm:items-center">
											{#if post.image_url}
												<img
													src={post.image_url}
													alt={"Preview for " + post.title}
													class="h-9 w-9 shrink-0 rounded object-cover border border-[var(--border)] sm:h-10 sm:w-10"
													loading="lazy"
												/>
											{/if}
											<a
												href={"/posts/" + post.id}
												class="relative z-[1] min-h-0 min-w-0 flex-1 touch-manipulation text-xs font-medium leading-snug text-neutral-900 line-clamp-2 hover:underline sm:text-sm"
											>
												<span class="text-[var(--text-muted)]">{formatTime(post.scheduled_at)}</span>
												{' '}{post.title}
											</a>
										</div>
										<div class="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:ml-auto">
											<CalendarPostBadges
												status={post.status}
												hasOutputWebhook={post.has_output_webhook}
												postHref={'/posts/' + post.id}
												textOnly={false}
												hideStatus={true}
											/>
											{#if post.has_output_webhook}
												<button
													type="button"
													class="shrink-0 touch-manipulation rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)]"
													disabled={sendingId === post.id}
													onclick={(e) => sendNow(post.id, e)}
												>
													{sendingId === post.id ? '…' : 'Send'}
												</button>
											{/if}
										</div>
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
	<div class="content-card rounded-xl px-4 pb-4">
		<div class="mb-4 rounded-xl bg-[var(--surface)] p-3">
			<div class="grid grid-cols-7 gap-1 sm:gap-2">
				{#each weekDays() as d}
					{@const isActiveDay = localDateKey(d) === localDateKey(anchor)}
					{@const isTodayDay = isToday(d)}
					{@const dayPosts = postsForDay(d)}
					<a
						href={hrefFor('day', d)}
						class="relative min-w-0 rounded-lg px-1 py-1.5 text-center text-xs transition sm:px-2 sm:py-2 {isActiveDay
							? 'btn-primary text-white'
							: `${calendarUnselectedBtnClass} text-[var(--text)]`} {isTodayDay && !isActiveDay ? 'calendar-today' : ''}"
						title={dayPosts.length > 0 ? `${dayPosts.length} post(s)` : undefined}
					>
						<div
							class="text-[10px] font-semibold leading-tight sm:text-xs md:text-sm lg:text-2xl"
						>
							{d.toLocaleDateString(undefined, { weekday: 'short' })}
						</div>
						<div class="text-base font-semibold tabular-nums sm:text-lg md:text-2xl lg:text-6xl">
							{d.getDate()}
						</div>
						{#if dayPosts.length > 0}
							<div class="mt-1 flex items-center justify-center gap-1">
								{#each dayPosts.slice(0, 3) as p (p.id)}
									<span
										class="h-1.5 w-1.5 rounded-full {!p.has_output_webhook ? 'ring-1 ring-amber-500 ring-offset-1 ring-offset-transparent' : ''}"
										style={`background-color: ${isActiveDay ? 'white' : darkenMarkerColor(p.color)};`}
										title={!p.has_output_webhook ? 'No output webhook' : undefined}
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
									style={`background-color: ${post.color ?? '#fafafa'}; border-left-color: ${post.color ?? 'var(--border)'};`}
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
										<a href={"/posts/" + post.id} class="break-words text-sm font-medium text-neutral-900 hover:underline" title={post.title}>{post.title}</a>
										<p class="break-words text-[10px] text-neutral-600">{formatTime(post.scheduled_at)} · {post.webhook_name}</p>
										<div class="mt-1 flex flex-wrap items-center gap-1">
											<span class={"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium " + statusClass(post.status)}>{post.status}</span>
											{#if !post.has_output_webhook}
												<span class={calendarNoOutputPillClass} role="status">No output webhook</span>
											{/if}
											{#if post.has_output_webhook}
												<button
													type="button"
													class="shrink-0 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)]"
													disabled={sendingId === post.id}
													onclick={(e) => sendNow(post.id, e)}
												>
													{sendingId === post.id ? '…' : 'Send'}
												</button>
											{/if}
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
	<div class="content-card rounded-xl px-4 pb-4">
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
									class="calendar-post-accent flex min-w-0 touch-manipulation items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-900 hover:underline {calendarDragEnabled
										? 'cursor-grab active:cursor-grabbing'
										: ''} {dragPostId === post.id ? 'opacity-50' : ''}"
									style={`background-color: ${post.color ?? '#fafafa'}; border-left-color: ${post.color ?? '#fafafa'};`}
									title={`${formatScheduledAt(post.scheduled_at, { day: '2-digit', month: 'short' })} · ${post.title}${!post.has_output_webhook ? ' · No output webhook' : ''}`}
									draggable={calendarDragEnabled}
									ondragstart={(e) => handleDragStart(e, post)}
									ondragend={handleDragEnd}
								>
									<span class="min-w-0 truncate">{formatScheduledAt(post.scheduled_at, { day: '2-digit', month: 'short' })} · {post.title}</span>
									{#if !post.has_output_webhook}
										<span class={calendarNoOutputPillClass} role="status">No output webhook</span>
									{/if}
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
	<div class="content-card rounded-xl px-4 pb-4">
		{#if posts.length === 0}
			<p class="text-sm text-[var(--text-muted)]">
				No posts in this date range. Adjust the range above, or go to
				<a href="/posts" class="font-medium text-[var(--primary)] hover:underline">Posts</a>
				to schedule one.
			</p>
		{:else}
			<div class="space-y-2">
				{#each posts as post (post.id)}
					{@const postDate = parseScheduledAt(post.scheduled_at)}
					{@const isPostToday = isToday(postDate)}
					<div
						class="calendar-post-accent rounded-lg p-2 {isPostToday ? 'calendar-today' : ''}"
						style={`background-color: ${post.color ?? '#fafafa'}; border-left-color: ${post.color ?? '#fafafa'};`}
					>
						<div class="flex min-w-0 flex-wrap items-start gap-2">
							{#if post.image_url}
								<img src={post.image_url} alt={"Preview for " + post.title} class="h-8 w-8 shrink-0 rounded object-cover border border-[var(--border)]" loading="lazy" />
							{/if}
							<a
								href={"/posts/" + post.id}
								class="min-w-0 max-w-full flex-1 break-words text-sm font-medium leading-snug text-neutral-900 hover:underline md:truncate"
							>
								<span class="text-[var(--text-muted)]">{formatScheduledAt(post.scheduled_at)}</span>
								<span class="text-[var(--text-muted)]"> · </span>
								<span>{post.title}</span>
							</a>
							{#if !post.has_output_webhook}
								<span class={calendarNoOutputPillClass} role="status">No output webhook</span>
							{/if}
							{#if post.has_output_webhook}
								<button
									type="button"
									class="shrink-0 rounded px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
									disabled={sendingId === post.id}
									onclick={(e) => sendNow(post.id, e)}
								>
									{sendingId === post.id ? '…' : 'Send'}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{:else if view === 'schedule'}
	<div class="content-card rounded-xl px-4 pb-4">
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
											class="h-1.5 w-1.5 rounded-full {!post.has_output_webhook ? 'ring-1 ring-amber-500' : ''}"
											style={`background-color: ${darkenMarkerColor(post.color)};`}
											title={`${post.title} • ${formatScheduledAt(post.scheduled_at, { hour: '2-digit', minute: '2-digit' })}${!post.has_output_webhook ? ' • No output webhook' : ''}`}
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
	<div class="content-card rounded-xl px-4 pb-4">
		<p class="text-sm text-[var(--text-muted)]">Unsupported calendar view.</p>
	</div>
{/if}
