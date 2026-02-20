<script lang="ts">
	import { RULE_COLORS } from '$lib/calendarColors.js';

	/**
	 * Mini calendar showing which days have slots (from ISO datetime strings).
	 * Single-rule mode: pass `slots`. Multi-rule mode: pass `slotSeries` for one coloured dot per rule.
	 */
	interface Props {
		/** ISO datetime strings (single-rule mode) */
		slots?: string[];
		/** One array of slot strings per rule (multi-rule mode: coloured dots per rule) */
		slotSeries?: string[][];
		/** Accent colour for single-rule mode dot (hex); matches main calendar rule colour */
		accentColor?: string;
		/** Number of weeks to show from today (default 6). Ignored when showMonthNav is true. */
		weeks?: number;
		/** Show times on hover in single-rule mode (default true) */
		showTimes?: boolean;
		/** Full width so day cells stretch (default false) */
		fullWidth?: boolean;
		/** Show prev/next month navigation (default false for small per-rule calendar) */
		showMonthNav?: boolean;
	}
	let { slots = [], slotSeries, accentColor, weeks = 6, showTimes = true, fullWidth = false, showMonthNav = false }: Props = $props();

	let viewYear = $state(new Date().getFullYear());
	let viewMonth = $state(new Date().getMonth()); // 0-indexed

	function localDateKey(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	function localDateKeyFromISO(iso: string): string {
		return localDateKey(new Date(iso));
	}

	const slotsByDate = $derived.by(() => {
		const byDate: Record<string, string[]> = {};
		const list = slotSeries ? slotSeries.flat() : slots;
		for (const iso of list) {
			const key = localDateKeyFromISO(iso);
			if (!byDate[key]) byDate[key] = [];
			byDate[key].push(iso);
		}
		for (const arr of Object.values(byDate)) arr.sort();
		return byDate;
	});

	const seriesTimesByDate = $derived.by(() => {
		if (!slotSeries?.length) return null;
		return slotSeries.map((series) => {
			const map: Record<string, string[]> = {};
			for (const iso of series) {
				const key = localDateKeyFromISO(iso);
				if (!map[key]) map[key] = [];
				map[key].push(iso);
			}
			for (const arr of Object.values(map)) arr.sort();
			return map;
		});
	});

	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	const cells = $derived.by(() => {
		const today = new Date();
		const todayKey = localDateKey(today);
		let start: Date;
		let lastCell: Date;
		let rangeStart: Date;
		let rangeEnd: Date;
		if (showMonthNav) {
			start = new Date(viewYear, viewMonth, 1);
			const lastDay = new Date(viewYear, viewMonth + 1, 0);
			lastCell = new Date(lastDay);
			lastCell.setDate(lastCell.getDate() + (6 - lastCell.getDay()));
			start.setDate(start.getDate() - start.getDay());
			rangeStart = new Date(viewYear, viewMonth, 1);
			rangeEnd = new Date(viewYear, viewMonth + 1, 0);
		} else {
			start = new Date(today);
			start.setHours(0, 0, 0, 0);
			rangeStart = new Date(start);
			rangeEnd = new Date(start);
			rangeEnd.setDate(rangeEnd.getDate() + weeks * 7);
			lastCell = new Date(rangeEnd);
			lastCell.setDate(lastCell.getDate() + (6 - lastCell.getDay()));
			start.setDate(start.getDate() - start.getDay());
		}
		const list: {
			date: Date;
			key: string;
			inRange: boolean;
			isToday: boolean;
			count: number;
			times: string[];
			seriesDots: { index: number; times: string[] }[];
		}[] = [];
		const cur = new Date(start);
		while (cur <= lastCell) {
			const key = localDateKey(cur);
			const inRange = cur >= rangeStart && cur <= rangeEnd;
			const isToday = key === todayKey;
			const times = slotsByDate[key] ?? [];
			const seriesDots =
				seriesTimesByDate
					?.map((map, i) => ({ index: i, times: map[key] ?? [] }))
					.filter((d) => d.times.length > 0) ?? [];
			list.push({
				date: new Date(cur),
				key,
				inRange,
				isToday,
				count: times.length,
				times,
				seriesDots
			});
			cur.setDate(cur.getDate() + 1);
		}
		return list;
	});

	const hasSlots = $derived(slotSeries ? slotSeries.some((s) => s.length > 0) : slots.length > 0);

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}
	/** Short time for inside markers, e.g. "9:00" or "9a" */
	function formatTimeShort(iso: string): string {
		const d = new Date(iso);
		const h = d.getHours();
		const m = d.getMinutes();
		if (m === 0) return `${h === 0 ? '12' : h > 12 ? h - 12 : h}${h >= 12 ? 'p' : 'a'}`;
		return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')}${h >= 12 ? 'p' : 'a'}`;
	}
</script>

<div
	class="rule-preview-calendar rounded border border-[var(--border)] bg-[var(--bg)] p-2 text-[var(--text)] {fullWidth
		? 'w-full'
		: ''}"
>
	{#if showMonthNav}
		<div class="mb-2 flex items-center justify-between gap-2">
			<button
				type="button"
				class="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[32px]"
				onclick={() => {
					if (viewMonth === 0) {
						viewMonth = 11;
						viewYear -= 1;
					} else {
						viewMonth -= 1;
					}
				}}
				aria-label="Previous month"
			>
				←
			</button>
			<span class="text-xs font-medium text-[var(--text)]">{monthNames[viewMonth]} {viewYear}</span>
			<button
				type="button"
				class="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[32px]"
				onclick={() => {
					if (viewMonth === 11) {
						viewMonth = 0;
						viewYear += 1;
					} else {
						viewMonth += 1;
					}
				}}
				aria-label="Next month"
			>
				→
			</button>
		</div>
	{/if}
	<div class="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-[var(--text-muted)]">
		{#each dayNames as day}
			<div class="min-w-0 py-0.5">{day}</div>
		{/each}
	</div>
	<div class="grid grid-cols-7 gap-0.5 text-[11px]">
		{#each cells as cell}
			<div
				class="relative flex min-h-5 min-w-0 flex-col items-center justify-center rounded leading-none transition-colors {fullWidth
					? 'aspect-square'
					: ''} {cell.inRange
					? 'text-[var(--text)]'
					: 'text-[var(--text-muted)] opacity-50'}
				{cell.isToday ? 'ring-1 ring-[var(--border)]' : ''}
				{cell.count > 0 ? 'font-medium' : ''}"
				style={cell.count > 0
					? slotSeries
						? 'background-color: color-mix(in srgb, var(--primary) 10%, transparent)'
						: accentColor
							? `background-color: ${accentColor}20`
							: 'background-color: color-mix(in srgb, var(--primary) 12%, transparent)'
					: ''}
				title={showTimes && cell.times.length ? cell.times.map(formatTime).join(', ') : cell.key}
			>
				<span class="text-[10px]">{cell.date.getDate()}</span>
				{#if cell.seriesDots.length > 0}
					<div class="mt-0.5 flex flex-wrap justify-center gap-0.5">
						{#each cell.seriesDots as dot}
							{#if fullWidth && dot.times.length > 0}
								<span
									class="inline-flex min-w-0 max-w-full items-center justify-center rounded px-1 py-0.5 text-[8px] font-medium text-white leading-none"
									style="background-color: {RULE_COLORS[dot.index % RULE_COLORS.length]}"
									title={dot.times.map(formatTime).join(', ')}
								>
									{dot.times.length === 1
										? formatTimeShort(dot.times[0])
										: dot.times.slice(0, 2).map(formatTimeShort).join(', ')}
									{#if dot.times.length > 2}
										+{dot.times.length - 2}
									{/if}
								</span>
							{:else}
								<span
									class="rounded-full shrink-0 {fullWidth ? 'h-2.5 w-2.5' : 'h-1 w-1'}"
									style="background-color: {RULE_COLORS[dot.index % RULE_COLORS.length]}"
									title={dot.times.map(formatTime).join(', ')}
								></span>
							{/if}
						{/each}
					</div>
				{:else if cell.count > 0 && !slotSeries}
					{#if cell.count < 10}
						<span
							class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
							style="background-color: {accentColor ?? 'var(--primary)'}"
							aria-hidden="true"
						></span>
					{:else}
						<span
							class="absolute -right-0.5 -top-0.5 rounded px-0.5 text-[8px] text-white"
							style="background-color: {accentColor ?? 'var(--primary)'}"
							aria-hidden="true"
						>{cell.count}</span>
					{/if}
				{/if}
			</div>
		{/each}
	</div>
	{#if slotSeries?.length && slotSeries.length > 0}
		<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--text-muted)]">
			{#each slotSeries as _, idx}
				<span class="inline-flex items-center gap-1">
					<span
						class="rounded-full shrink-0 {fullWidth ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5'}"
						style="background-color: {RULE_COLORS[idx % RULE_COLORS.length]}"
					></span>
					Rule {idx + 1}
				</span>
			{/each}
		</div>
	{/if}
	{#if !hasSlots && !showMonthNav}
		<p class="mt-1 text-[10px] text-[var(--text-muted)]">No slots in next {weeks} weeks</p>
	{:else if !hasSlots && showMonthNav}
		<p class="mt-1 text-[10px] text-[var(--text-muted)]">No slots this month</p>
	{/if}
</div>
