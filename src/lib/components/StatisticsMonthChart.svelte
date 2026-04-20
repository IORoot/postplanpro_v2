<script lang="ts">
	import type { StatsDailyPoint } from '$lib/types/statsChart.js';

	let {
		points,
		monthLabel,
		prevHref,
		nextHref,
		timezoneLabel
	}: {
		points: StatsDailyPoint[];
		monthLabel: string;
		prevHref: string;
		nextHref: string;
		timezoneLabel: string;
	} = $props();

	let showSent = $state(true);
	let showScheduled = $state(true);

	let tip = $state<{
		clientX: number;
		clientY: number;
		dayLabel: string;
		sent: number;
		scheduled: number;
	} | null>(null);

	const padR = 12;
	const padT = 20;
	/** Space below x-axis for angled day labels (tight to axis). */
	const padB = 30;
	/** Min horizontal pixels between days so every label can fit (scrolls on small screens). */
	const pxPerDay = 13;
	const H = 176;

	/** Full-data max so Y scale does not jump when toggling series. */
	const scaleMax = $derived.by(() => {
		let m = 0;
		for (const p of points) m = Math.max(m, p.sent, p.scheduled);
		if (m <= 0) return 5;
		const padded = Math.ceil(m * 1.12);
		const step = padded <= 10 ? 2 : padded <= 30 ? 5 : 10;
		return Math.max(step, Math.ceil(padded / step) * step);
	});

	/** Y tick labels + gap to axis; scales with digit count of scaleMax. */
	const padL = $derived(
		Math.max(18, Math.min(36, 6 + Math.ceil(String(scaleMax).length * 6.2) + 8))
	);

	const chartWidth = $derived.by(() => {
		const n = points.length;
		const inner = n <= 1 ? 560 : Math.max(560, (n - 1) * pxPerDay);
		return padL + inner + padR;
	});

	const plotW = $derived(chartWidth - padL - padR);
	const yBase = $derived(padT + (H - padT - padB));

	function xAt(i: number): number {
		const n = points.length;
		const pw = plotW;
		if (n <= 1) return padL + pw / 2;
		return padL + (i / (n - 1)) * pw;
	}

	function yAt(v: number): number {
		const top = scaleMax;
		const plotH = H - padT - padB;
		return padT + plotH - (v / top) * plotH;
	}

	/** When max Y is small enough, label every integer (no skipped counts). */
	const yIntegerEveryMax = 40;

	function ceilingNiceStep(x: number): number {
		if (x <= 0) return 1;
		const exp = Math.floor(Math.log10(x));
		const fraction = x / 10 ** exp;
		let nice: number;
		if (fraction <= 1) nice = 1;
		else if (fraction <= 2) nice = 2;
		else if (fraction <= 5) nice = 5;
		else nice = 10;
		return nice * 10 ** exp;
	}

	const yTicks = $derived.by(() => {
		const top = scaleMax;
		const ticks: number[] = [];

		if (top <= yIntegerEveryMax) {
			for (let v = 0; v <= top; v++) ticks.push(v);
			return ticks;
		}

		const maxTickCount = 18;
		const step = ceilingNiceStep(top / (maxTickCount - 1));
		for (let v = 0; v <= top; v += step) ticks.push(v);
		if (ticks[ticks.length - 1]! < top) ticks.push(top);
		return ticks;
	});

	const hitBandW = $derived.by(() => {
		const n = points.length;
		if (n <= 1) return plotW;
		return Math.max(10, plotW / (n - 1));
	});

	type Pt = { x: number; y: number };

	function smoothLinePath(pts: Pt[]): string {
		const n = pts.length;
		if (n === 0) return '';
		if (n === 1) return `M ${pts[0].x} ${pts[0].y}`;
		let d = `M ${pts[0].x} ${pts[0].y}`;
		for (let i = 0; i < n - 1; i++) {
			const p0 = i > 0 ? pts[i - 1] : pts[0];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = i + 2 < n ? pts[i + 2] : pts[i + 1];
			const c1x = p1.x + (p2.x - p0.x) / 6;
			const c1y = p1.y + (p2.y - p0.y) / 6;
			const c2x = p2.x - (p3.x - p1.x) / 6;
			const c2y = p2.y - (p3.y - p1.y) / 6;
			d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
		}
		return d;
	}

	function smoothAreaPath(pts: Pt[], baseY: number): string {
		if (pts.length === 0) return '';
		const line = smoothLinePath(pts);
		const last = pts[pts.length - 1];
		const first = pts[0];
		return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
	}

	const sentPts = $derived.by((): Pt[] =>
		points.map((p, i) => ({ x: xAt(i), y: yAt(p.sent) }))
	);
	const schedPts = $derived.by((): Pt[] =>
		points.map((p, i) => ({ x: xAt(i), y: yAt(p.scheduled) }))
	);

	const sentLineD = $derived(showSent && points.length ? smoothLinePath(sentPts) : '');
	const schedLineD = $derived(showScheduled && points.length ? smoothLinePath(schedPts) : '');
	const sentAreaD = $derived(showSent && points.length ? smoothAreaPath(sentPts, yBase) : '');
	const schedAreaD = $derived(showScheduled && points.length ? smoothAreaPath(schedPts, yBase) : '');

	function dayNum(date: string): string {
		return String(Number(date.slice(8, 10)));
	}

	function formatDayLabel(isoDate: string): string {
		const [y, mo, d] = isoDate.split('-').map(Number);
		if (!y || !mo || !d) return isoDate;
		const dt = new Date(y, mo - 1, d);
		return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function showTip(e: PointerEvent, p: StatsDailyPoint) {
		tip = {
			clientX: e.clientX,
			clientY: e.clientY,
			dayLabel: formatDayLabel(p.date),
			sent: p.sent,
			scheduled: p.scheduled
		};
	}

	function moveTip(e: PointerEvent) {
		if (!tip) return;
		tip = { ...tip, clientX: e.clientX, clientY: e.clientY };
	}

	function hideTip() {
		tip = null;
	}
</script>

<div class="content-card rounded-xl border border-[var(--border)] p-4 shadow-sm">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<div>
			<h3 class="text-base font-semibold text-[var(--text)]">Activity by day</h3>
			<p class="mt-0.5 text-xs text-[var(--text-muted)]">
				Month in {timezoneLabel}. Hover a day for counts. Toggle the key to show or hide each line.
			</p>
		</div>
		<div class="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-0.5">
			<a
				href={prevHref}
				class="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md px-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] touch-manipulation"
				aria-label="Previous month"
			>←</a>
			<span class="min-w-[10rem] px-2 text-center text-sm font-semibold text-[var(--text)] tabular-nums">{monthLabel}</span>
			<a
				href={nextHref}
				class="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md px-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] touch-manipulation"
				aria-label="Next month"
			>→</a>
		</div>
	</div>

	<div class="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="Series visibility">
		<button
			type="button"
			aria-pressed={showSent}
			aria-label="Toggle sent posts line"
			class="inline-flex select-none items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors touch-manipulation {showSent
				? 'border-green-600/50 bg-green-600/10 text-green-800 dark:border-green-500/40 dark:bg-green-500/15 dark:text-green-100'
				: 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] opacity-55'}"
			onclick={() => (showSent = !showSent)}
		>
			<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-green-600" aria-hidden="true"></span>
			Sent
		</button>
		<button
			type="button"
			aria-pressed={showScheduled}
			aria-label="Toggle scheduled posts line"
			class="inline-flex select-none items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors touch-manipulation {showScheduled
				? 'border-blue-600/50 bg-blue-600/10 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-100'
				: 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] opacity-55'}"
			onclick={() => (showScheduled = !showScheduled)}
		>
			<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true"></span>
			Scheduled
		</button>
	</div>

	{#if tip}
		<div
			class="pointer-events-none fixed z-[100] max-w-[14rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] shadow-lg"
			style:left="{tip.clientX}px"
			style:top="{tip.clientY}px"
			style:transform="translate(-50%, calc(-100% - 8px))"
			role="tooltip"
		>
			<p class="font-semibold text-[var(--text)]">{tip.dayLabel}</p>
			<p class="mt-1 tabular-nums text-[var(--text-muted)]">
				<span class="text-green-700 dark:text-green-400">Sent: {tip.sent}</span>
				<span class="mx-1.5 text-[var(--border)]">·</span>
				<span class="text-blue-800 dark:text-blue-400">Scheduled: {tip.scheduled}</span>
			</p>
		</div>
	{/if}

	<div class="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
		<svg
			class="mx-auto block max-w-full touch-manipulation text-[var(--text)]"
			style:min-width="min(100%, {chartWidth}px)"
			viewBox="0 0 {chartWidth} {H}"
			role="img"
			aria-label="Line chart of posts sent and scheduled per day"
			onpointerleave={hideTip}
		>
			<defs>
				<linearGradient id="statsChartSentFill" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
					<stop offset="0%" stop-color="rgb(22 163 74)" stop-opacity="0.32" />
					<stop offset="100%" stop-color="rgb(22 163 74)" stop-opacity="0.03" />
				</linearGradient>
				<linearGradient id="statsChartSchedFill" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
					<stop offset="0%" stop-color="rgb(37 99 235)" stop-opacity="0.26" />
					<stop offset="100%" stop-color="rgb(37 99 235)" stop-opacity="0.03" />
				</linearGradient>
			</defs>

			{#each yTicks as tick}
				{@const yy = yAt(tick)}
				<line
					x1={padL}
					y1={yy}
					x2={chartWidth - padR}
					y2={yy}
					class="stroke-[var(--border)]/70 dark:stroke-[var(--border)]/50"
					stroke-width="1"
				/>
				<text x={padL - 3} y={yy + 4} text-anchor="end" class="fill-[var(--text-muted)] text-[9px] tabular-nums">{tick}</text>
			{/each}

			{#each points as _, i}
				{@const vx = xAt(i)}
				<line
					x1={vx}
					y1={padT}
					x2={vx}
					y2={yBase}
					class="stroke-[var(--border)]/50 dark:stroke-[var(--border)]/35"
					stroke-width="1"
					stroke-dasharray="2 3"
				/>
			{/each}

			<line x1={padL} y1={padT} x2={padL} y2={yBase} class="stroke-[var(--border)]" stroke-width="1.5" />
			<line x1={padL} y1={yBase} x2={chartWidth - padR} y2={yBase} class="stroke-[var(--border)]" stroke-width="1.5" />

			{#if sentAreaD}
				<path d={sentAreaD} fill="url(#statsChartSentFill)" class="pointer-events-none" />
			{/if}
			{#if schedAreaD}
				<path d={schedAreaD} fill="url(#statsChartSchedFill)" class="pointer-events-none" />
			{/if}

			{#if sentLineD}
				<path
					d={sentLineD}
					fill="none"
					stroke="rgb(22 163 74)"
					stroke-width="1"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="pointer-events-none"
				/>
			{/if}
			{#if schedLineD}
				<path
					d={schedLineD}
					fill="none"
					stroke="rgb(37 99 235)"
					stroke-width="1"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="pointer-events-none"
				/>
			{/if}

			{#each points as p, i}
				{@const cx = xAt(i)}
				{@const ys = yAt(p.sent)}
				{@const yc = yAt(p.scheduled)}
				{#if showSent}
					<circle cx={cx} cy={ys} r="2.25" fill="rgb(22 163 74)" class="pointer-events-none" />
				{/if}
				{#if showScheduled}
					<circle cx={cx} cy={yc} r="2.25" fill="rgb(37 99 235)" class="pointer-events-none" />
				{/if}
			{/each}

			{#each points as p, i}
				{@const cx = xAt(i)}
				{@const labelY = yBase + 9}
				<text
					x={cx}
					y={labelY}
					transform="rotate(-42 {cx} {labelY})"
					text-anchor="end"
					dominant-baseline="middle"
					class="pointer-events-none fill-[var(--text-muted)] text-[8px]"
				>{dayNum(p.date)}</text>
			{/each}

			{#each points as p, i}
				{@const cx = xAt(i)}
				{@const bw = hitBandW}
				<rect
					x={cx - bw / 2}
					y={padT}
					width={bw}
					height={yBase - padT}
					fill="transparent"
					role="presentation"
					class="cursor-crosshair"
					onpointerenter={(e) => showTip(e, p)}
					onpointermove={moveTip}
				/>
			{/each}
		</svg>
	</div>
</div>
