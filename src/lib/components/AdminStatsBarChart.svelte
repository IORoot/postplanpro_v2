<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { ECharts, EChartsOption } from 'echarts';

	let {
		title,
		categories,
		values,
		color = 'rgb(37 99 235)',
		height = 220
	}: {
		title: string;
		categories: string[];
		values: number[];
		color?: string;
		height?: number;
	} = $props();

	let chartEl = $state<HTMLDivElement | null>(null);
	let chart = $state<ECharts | null>(null);
	let resizeObserver = $state<ResizeObserver | null>(null);

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
			grid: { left: 50, right: 20, top: 16, bottom: 36 },
			tooltip: {
				trigger: 'axis',
				backgroundColor: bg,
				borderColor: border,
				borderWidth: 1,
				textStyle: { color: text }
			},
			xAxis: {
				type: 'category',
				data: categories,
				axisLabel: { color: textMuted, fontSize: 11, interval: 0 },
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
					type: 'bar',
					data: values,
					itemStyle: { color, borderRadius: 4 }
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
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text)]">{title}</h3>
	</div>
	<div bind:this={chartEl} class="w-full" style="height: {height}px" role="img" aria-label={title}></div>
</div>
