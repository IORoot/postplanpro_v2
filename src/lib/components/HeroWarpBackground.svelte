<script lang="ts">
	import { onMount } from 'svelte';
	import gsap from 'gsap';

	interface Props {
		class?: string;
	}
	let { class: className = '' }: Props = $props();

	let host = $state<HTMLDivElement | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);

	/** Straight bar in screen space: tail (near VP) → head (toward edge), built from pixel squares. */
	type Bar = {
		/** Leading edge (smaller z = closer / toward viewport edge). */
		zHead: number;
		/** Depth extent in z; tail = zHead + zSpan. */
		zSpan: number;
		angle: number;
		color: string;
		speed: number;
		/** Parallel lines of squares, offset perpendicular to motion. */
		stripes: number;
	};

	/** Tailwind default palette only: `green-*` + `neutral-*` (v3/v4 defaults). */
	const COLORS = [
		// green
		'#bbf7d0',
		'#86efac',
		'#4ade80',
		'#22c55e',
		'#16a34a',
		'#15803d',
		'#166534',
		// neutral (visible on dark bg with screen blend)
		'#d4d4d4',
		'#a3a3a3',
		'#737373',
		'#525252'
	];

	/** Fewer, much larger bars than the old particle cloud. */
	const POOL = 56;

	function randAngle(): number {
		const roll = Math.random();
		if (roll < 0.36) return (Math.random() - 0.5) * 1.15;
		if (roll < 0.72) return Math.PI + (Math.random() - 0.5) * 1.15;
		let a = Math.random() * Math.PI * 2;
		if (Math.abs(Math.sin(a)) > 0.9 && Math.random() > 0.25) return randAngle();
		return a;
	}

	function spawn(b: Bar): void {
		b.zHead = 1.2 + Math.random() * 5.2;
		b.zSpan = 1.15 + Math.random() * 3.1;
		b.angle = randAngle();
		b.color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
		b.speed = 0.42 + Math.random() * 0.95;
		b.stripes = 5 + Math.floor(Math.random() * 10);
	}

	onMount(() => {
		if (!host || !canvas) return;
		const maybeCtx = canvas.getContext('2d', { alpha: false });
		if (!maybeCtx) return;
		const c2d: CanvasRenderingContext2D = maybeCtx;

		let reduceMotion = false;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotion = () => {
			reduceMotion = mq.matches;
		};
		syncMotion();
		mq.addEventListener('change', syncMotion);

		const pool: Bar[] = [];
		for (let i = 0; i < POOL; i++) {
			const b: Bar = {
				zHead: 1,
				zSpan: 1,
				angle: 0,
				color: COLORS[0]!,
				speed: 1,
				stripes: 6
			};
			spawn(b);
			b.zHead = 0.25 + Math.random() * 5.5;
			pool.push(b);
		}

		let w = 0;
		let h = 0;
		let cx = 0;
		let cy = 0;
		let diag = 1;
		let k = 1;

		function measure(): void {
			const r = host!.getBoundingClientRect();
			w = Math.max(1, r.width);
			h = Math.max(1, r.height);
			diag = Math.hypot(w, h);
			cx = w * 0.5;
			cy = h * 0.36;
			k = diag * 0.44;
		}

		function drawStatic(): void {
			c2d.fillStyle = '#030308';
			c2d.fillRect(0, 0, w, h);
		}

		function draw(): void {
			c2d.globalCompositeOperation = 'source-over';
			c2d.fillStyle = '#030308';
			c2d.fillRect(0, 0, w, h);
			c2d.globalCompositeOperation = 'screen';

			/* Draw far (large z) first, near last — correct overlap for bright cores. */
			pool.sort((a, b) => b.zHead - a.zHead);

			for (const b of pool) {
				const zTail = b.zHead + b.zSpan;
				const mx = Math.cos(b.angle);
				const my = Math.sin(b.angle);
				const px = -my;
				const py = mx;

				const invH = 1 / Math.max(b.zHead, 0.055);
				const invT = 1 / Math.max(zTail, 0.055);
				const xh = cx + mx * k * invH;
				const yh = cy + my * k * invH;
				const xt = cx + mx * k * invT;
				const yt = cy + my * k * invT;

				const dx = xh - xt;
				const dy = yh - yt;
				const len = Math.hypot(dx, dy);
				if (len < 6) continue;

				/* One straight segment tail→head; squares stepped along it (no per-z wobble). */
				const invAvg = (invH + invT) * 0.5;
				const cellStep = Math.max(4, Math.min(11, Math.floor(3.5 + invAvg * 2.8)));
				const nCells = Math.min(180, Math.max(12, Math.ceil(len / cellStep)));

				c2d.fillStyle = b.color;

				for (let i = 0; i <= nCells; i++) {
					const t = i / nCells;
					const z = zTail - t * (zTail - b.zHead);
					const invZ = 1 / Math.max(z, 0.052);
					const sq = Math.max(3, Math.min(18, Math.floor(3 + invZ * 6.2)));
					const bx = xt + dx * t;
					const by = yt + dy * t;

					if (bx < -220 || by < -220 || bx > w + 220 || by > h + 220) continue;

					const nearF = 1 - b.zHead / 6.5;
					const alpha = Math.min(
						0.88,
						Math.pow(Math.max(0, nearF + 0.1), 0.92) * (0.2 + invZ * 0.078)
					);
					if (alpha < 0.032) continue;

					const pitch = sq + Math.max(1, Math.min(6, Math.floor(1 + invZ * 2.4)));
					c2d.globalAlpha = alpha;

					for (let s = 0; s < b.stripes; s++) {
						const off = (s - (b.stripes - 1) / 2) * pitch;
						const ox = bx + px * off;
						const oy = by + py * off;
						const left = Math.round(ox - sq * 0.5);
						const top = Math.round(oy - sq * 0.5);
						c2d.fillRect(left, top, sq, sq);
					}
				}
			}

			c2d.globalAlpha = 1;
			c2d.globalCompositeOperation = 'source-over';
		}

		function resize(): void {
			measure();
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas!.width = Math.floor(w * dpr);
			canvas!.height = Math.floor(h * dpr);
			canvas!.style.width = `${w}px`;
			canvas!.style.height = `${h}px`;
			c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
			if (reduceMotion) drawStatic();
		}

		const ro = new ResizeObserver(() => resize());
		ro.observe(host);
		resize();

		const tick = (_time: number, delta: number): void => {
			if (reduceMotion) {
				drawStatic();
				return;
			}
			const dt = delta / 1000;
			for (const b of pool) {
				b.zHead -= b.speed * dt;
				if (b.zHead < 0.08) spawn(b);
			}
			draw();
		};

		if (reduceMotion) {
			drawStatic();
		} else {
			gsap.ticker.add(tick);
		}

		return () => {
			mq.removeEventListener('change', syncMotion);
			gsap.ticker.remove(tick);
			ro.disconnect();
		};
	});
</script>

<div
	class="pointer-events-none absolute inset-0 z-0 overflow-hidden {className ?? ''}"
	aria-hidden="true"
>
	<div bind:this={host} class="absolute inset-0">
		<canvas bind:this={canvas} class="hero-warp-canvas block h-full w-full"></canvas>
	</div>
	<!-- Keeps headline readable like Composio — center falls off to particles on the sides -->
	<div
		class="absolute inset-0 bg-[radial-gradient(ellipse_58%_52%_at_50%_30%,rgba(3,3,8,0.88)_0%,rgba(3,3,8,0.35)_45%,transparent_72%)]"
	></div>
</div>

<style>
	.hero-warp-canvas {
		image-rendering: pixelated;
		image-rendering: crisp-edges;
	}
</style>
