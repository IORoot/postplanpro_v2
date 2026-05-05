<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { ECharts, EChartsOption } from 'echarts';

	type Series = { name: string; data: number[]; color: string };

	let {
		title,
		dates,
		series,
		height = 240
	}: {
		title: string;
		dates: string[];
		series: Series[];
		height?: number;
	} = $props();

	let chartEl = $state<HTMLDivElement | null>(null);
	let chart = $state<ECharts | null>(null);
	let resizeObserver = $state<ResizeObserver | null>(null);

	const dayLabels = $derived(dates.map((d) => d.slice(5)));
	const fullDateLabels = $derived(
		dates.map((d) =>
			new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
			grid: { left: 40, right: 20, top: 34, bottom: 40 },
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
					const lines = rows.map((r) => `${r.seriesName}: ${r.value}`).join('<br/>');
					return `${label}<br/>${lines}`;
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
			series: series.map((s) => ({
				name: s.name,
				type: 'line',
				smooth: true,
				symbol: 'circle',
				symbolSize: 4,
				lineStyle: { width: 2, color: s.color },
				itemStyle: { color: s.color },
				areaStyle: { color: s.color, opacity: 0.12 },
				data: s.data
			}))
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
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text)]">{title}</h3>
	</div>
	<div bind:this={chartEl} class="w-full" style="height: {height}px" role="img" aria-label={title}></div>
</div>
