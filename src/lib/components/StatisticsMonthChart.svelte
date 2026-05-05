<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { ECharts, EChartsOption } from 'echarts';
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

	let chartEl = $state<HTMLDivElement | null>(null);
	let chart = $state<ECharts | null>(null);
	let resizeObserver = $state<ResizeObserver | null>(null);

	const dayLabels = $derived(points.map((p) => String(Number(p.date.slice(8, 10)))));
	const fullDateLabels = $derived(
		points.map((p) =>
			new Date(`${p.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
		)
	);

	function cssVar(name: string, fallback: string): string {
		if (typeof window === 'undefined') return fallback;
		const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		return raw || fallback;
	}

	function buildOptions(): EChartsOption {
		const textMuted = cssVar('--text-muted', '#7c8393');
		const text = cssVar('--text', '#dbe0ea');
		const border = cssVar('--border', '#2f3645');
		const bg = cssVar('--surface', '#121826');

		return {
			animation: true,
			grid: { left: 40, right: 20, top: 34, bottom: 58 },
			dataZoom: [
				{
					type: 'inside',
					xAxisIndex: 0,
					filterMode: 'none',
					zoomOnMouseWheel: true,
					moveOnMouseMove: true,
					moveOnMouseWheel: true
				},
				{
					type: 'slider',
					xAxisIndex: 0,
					filterMode: 'none',
					height: 16,
					bottom: 6,
					borderColor: border,
					backgroundColor: 'transparent',
					fillerColor: 'rgba(59,130,246,0.18)',
					handleStyle: {
						color: 'rgba(59,130,246,0.65)',
						borderColor: 'rgba(59,130,246,0.9)'
					},
					moveHandleSize: 18,
					textStyle: { color: textMuted }
				}
			],
			legend: {
				top: 0,
				textStyle: { color: text },
				itemWidth: 14,
				itemHeight: 8
			},
			tooltip: {
				trigger: 'axis',
				backgroundColor: bg,
				borderColor: border,
				borderWidth: 1,
				textStyle: { color: text },
				formatter(params) {
					const rows = Array.isArray(params) ? params : [params];
					const idx = rows[0]?.dataIndex ?? 0;
					const label = fullDateLabels[idx] ?? dayLabels[idx] ?? '';
					const sentRow = rows.find((row) => row.seriesName === 'Sent');
					const scheduledRow = rows.find((row) => row.seriesName === 'Scheduled');
					const sent = Number(sentRow?.value ?? 0);
					const scheduled = Number(scheduledRow?.value ?? 0);
					return `${label}<br/>Sent: ${sent}<br/>Scheduled: ${scheduled}`;
				}
			},
			xAxis: {
				type: 'category',
				boundaryGap: false,
				data: dayLabels,
				axisLabel: { color: textMuted, fontSize: 10 },
				axisLine: { lineStyle: { color: border } }
			},
			yAxis: {
				type: 'value',
				minInterval: 1,
				axisLabel: { color: textMuted, fontSize: 10 },
				splitLine: { lineStyle: { color: border, opacity: 0.5 } },
				axisLine: { show: true, lineStyle: { color: border } }
			},
			series: [
				{
					name: 'Sent',
					type: 'line',
					smooth: true,
					symbol: 'circle',
					symbolSize: 5,
					lineStyle: { width: 2, color: 'rgb(22 163 74)' },
					itemStyle: { color: 'rgb(22 163 74)' },
					areaStyle: { color: 'rgba(22,163,74,0.16)' },
					data: points.map((p) => p.sent)
				},
				{
					name: 'Scheduled',
					type: 'line',
					smooth: true,
					symbol: 'circle',
					symbolSize: 5,
					lineStyle: { width: 2, color: 'rgb(37 99 235)' },
					itemStyle: { color: 'rgb(37 99 235)' },
					areaStyle: { color: 'rgba(37,99,235,0.14)' },
					data: points.map((p) => p.scheduled)
				}
			]
		};
	}

	async function initChart() {
		if (!chartEl || typeof window === 'undefined') return;
		const echarts = await import('echarts');
		chart = echarts.init(chartEl);
		chart.setOption(buildOptions());

		resizeObserver = new ResizeObserver(() => chart?.resize());
		resizeObserver.observe(chartEl);
	}

	onMount(() => {
		void initChart();
	});

	$effect(() => {
		if (!chart) return;
		chart.setOption(buildOptions(), true);
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		chart?.dispose();
	});
</script>

<div class="content-card rounded-xl border border-[var(--border)] p-4 shadow-sm">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<div>
			<h3 class="text-base font-semibold text-[var(--text)]">Activity by day</h3>
			<p class="mt-0.5 text-xs text-[var(--text-muted)]">
				Month in {timezoneLabel}. Hover day for counts. Wheel or pinch to zoom, drag to pan.
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

	<div
		bind:this={chartEl}
		class="h-[220px] w-full"
		role="img"
		aria-label="Line chart of posts sent and scheduled per day"
	></div>
</div>
