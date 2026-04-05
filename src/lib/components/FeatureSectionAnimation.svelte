<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import gsap from 'gsap';

	interface Props {
		section: 1 | 2 | 3 | 4 | 5 | 6 | 7;
		class?: string;
	}

	let { section, class: className = '' }: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let timelines: gsap.core.Timeline[] = [];

	// Tailwind neutral + green palette — matches app's --primary: #16a34a
	const GREEN      = '#16a34a'; // green-700 — primary
	const GREEN_LITE = '#22c55e'; // green-500
	const GREEN_DIM  = '#166534'; // green-800 — dark fill accent
	const GREEN_900  = '#14532d'; // green-900 — deepest fill
	const BG         = '#0a0a0a'; // neutral-950
	const SURFACE    = '#171717'; // neutral-900
	const SURFACE2   = '#262626'; // neutral-800
	const BORDER     = '#404040'; // neutral-700
	const BORDER_DIM = '#262626'; // neutral-800
	const TEXT       = '#fafafa'; // neutral-50
	const TEXT_DIM   = '#a3a3a3'; // neutral-400
	const TEXT_MUTED = '#525252'; // neutral-600
	const RED        = '#ef4444'; // red-500
	const AMBER      = '#f59e0b'; // amber-500

	function prefersReducedMotion(): boolean {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	// ─── ANIMATION 1: Calendar ───────────────────────────────────────────────
	function mountCalendar(el: HTMLDivElement) {
		el.innerHTML = '';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 320 240');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		el.appendChild(svg);

		const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
		const cols = 7;
		const rows = 5;
		const cellW = 42;
		const cellH = 38;
		const startX = 8;
		const startY = 36;

		// Header bar
		const header = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		header.setAttribute('x', '0'); header.setAttribute('y', '0');
		header.setAttribute('width', '320'); header.setAttribute('height', '28');
		header.setAttribute('fill', BORDER_DIM);
		svg.appendChild(header);

		const monthLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		monthLabel.setAttribute('x', '12'); monthLabel.setAttribute('y', '18');
		monthLabel.setAttribute('fill', TEXT); monthLabel.setAttribute('font-size', '11');
		monthLabel.setAttribute('font-weight', '600'); monthLabel.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
		monthLabel.textContent = 'April 2026';
		svg.appendChild(monthLabel);

		// Day headers
		days.forEach((d, i) => {
			const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			t.setAttribute('x', String(startX + i * cellW + cellW / 2));
			t.setAttribute('y', '34');
			t.setAttribute('text-anchor', 'middle');
			t.setAttribute('fill', TEXT_MUTED); t.setAttribute('font-size', '8');
			t.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
			t.textContent = d;
			svg.appendChild(t);
		});

		// Grid cells
		const cells: SVGRectElement[] = [];
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
				rect.setAttribute('x', String(startX + c * cellW));
				rect.setAttribute('y', String(startY + r * cellH));
				rect.setAttribute('width', String(cellW - 2));
				rect.setAttribute('height', String(cellH - 2));
				rect.setAttribute('fill', SURFACE);
				rect.setAttribute('rx', '3');
				svg.appendChild(rect);
				cells.push(rect);
			}
		}

		// Day numbers
		for (let i = 0; i < 30; i++) {
			const r = Math.floor(i / cols);
			const c = i % cols;
			const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			t.setAttribute('x', String(startX + c * cellW + 5));
			t.setAttribute('y', String(startY + r * cellH + 12));
			t.setAttribute('fill', TEXT_MUTED); t.setAttribute('font-size', '7');
			t.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
			t.textContent = String(i + 1);
			svg.appendChild(t);
		}

		// Post bars — colour-coded by type
		const postData = [
			{ idx: 2, color: GREEN }, { idx: 4, color: AMBER },
			{ idx: 7, color: GREEN }, { idx: 9, color: GREEN_LITE },
			{ idx: 11, color: GREEN_DIM }, { idx: 14, color: AMBER },
			{ idx: 16, color: GREEN }, { idx: 18, color: RED },
			{ idx: 21, color: GREEN_LITE }, { idx: 23, color: GREEN },
			{ idx: 25, color: GREEN_DIM }, { idx: 28, color: AMBER },
		];

		const postEls: SVGGElement[] = [];
		postData.forEach(({ idx, color }) => {
			const r = Math.floor(idx / cols);
			const c = idx % cols;
			const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			g.setAttribute('opacity', '0');

			const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			bar.setAttribute('x', String(startX + c * cellW + 2));
			bar.setAttribute('y', String(startY + r * cellH + 14));
			bar.setAttribute('width', String(cellW - 8));
			bar.setAttribute('height', '6');
			bar.setAttribute('fill', color);
			bar.setAttribute('rx', '2');
			bar.setAttribute('opacity', '0.9');
			g.appendChild(bar);

			svg.appendChild(g);
			postEls.push(g);
		});

		// Drag ghost
		const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		ghost.setAttribute('width', '38'); ghost.setAttribute('height', '34');
		ghost.setAttribute('fill', GREEN); ghost.setAttribute('rx', '4');
		ghost.setAttribute('opacity', '0');
		ghost.setAttribute('x', String(startX + 2 * cellW));
		ghost.setAttribute('y', String(startY));
		svg.appendChild(ghost);

		const ghostLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		ghostLabel.setAttribute('fill', '#fff'); ghostLabel.setAttribute('font-size', '7');
		ghostLabel.setAttribute('font-weight', '600'); ghostLabel.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
		ghostLabel.setAttribute('opacity', '0');
		ghostLabel.setAttribute('x', String(startX + 2 * cellW + 4));
		ghostLabel.setAttribute('y', String(startY + 12));
		ghostLabel.textContent = 'Post';
		svg.appendChild(ghostLabel);

		// Today highlight
		const todayRect = cells[9];
		todayRect.setAttribute('stroke', GREEN); todayRect.setAttribute('stroke-width', '1.5');

		if (prefersReducedMotion()) return;

		const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });

		postEls.forEach((el, i) => {
			tl.to(el, { opacity: 1, duration: 0.3, ease: 'power2.out' }, i * 0.12);
		});

		tl.to([ghost, ghostLabel], { opacity: 0.9, duration: 0.2 }, 2.0);
		tl.to([ghost, ghostLabel], {
			x: (14 - 2) * cellW,
			y: (Math.floor(16 / cols) - 0) * cellH,
			duration: 0.7, ease: 'power2.inOut'
		}, 2.2);
		tl.to([ghost, ghostLabel], { opacity: 0, duration: 0.2 }, 2.9);

		tl.to(todayRect, { attr: { stroke: GREEN_LITE }, duration: 0.4, yoyo: true, repeat: 3 }, 3.2);
		tl.to(postEls, { opacity: 0, duration: 0.4, stagger: 0.04 }, 4.5);

		timelines.push(tl);
	}

	// ─── ANIMATION 2: Schedules ───────────────────────────────────────────────
	// Clock hands are drawn as lines pivoting around the clock centre (cx, cy).
	// GSAP `rotation` on SVG elements rotates around the element's own bounding box centre,
	// not the clock centre — so we animate the hand tip position using gsap.to with
	// a custom update function instead, converting clock angle to x2/y2 coordinates.
	function mountSchedules(el: HTMLDivElement) {
		el.innerHTML = '';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 320 240');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		el.appendChild(svg);

		const cx = 160, cy = 118, r = 78;

		// Clock face
		const face = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		face.setAttribute('cx', String(cx)); face.setAttribute('cy', String(cy));
		face.setAttribute('r', String(r));
		face.setAttribute('fill', SURFACE); face.setAttribute('stroke', BORDER);
		face.setAttribute('stroke-width', '1.5');
		svg.appendChild(face);

		// Inner ring
		const innerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		innerRing.setAttribute('cx', String(cx)); innerRing.setAttribute('cy', String(cy));
		innerRing.setAttribute('r', String(r - 10));
		innerRing.setAttribute('fill', 'none'); innerRing.setAttribute('stroke', BORDER_DIM);
		innerRing.setAttribute('stroke-width', '1');
		svg.appendChild(innerRing);

		// Hour ticks
		for (let i = 0; i < 12; i++) {
			const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
			const isMajor = i % 3 === 0;
			const inner = isMajor ? r - 16 : r - 9;
			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', String(cx + Math.cos(angle) * inner));
			line.setAttribute('y1', String(cy + Math.sin(angle) * inner));
			line.setAttribute('x2', String(cx + Math.cos(angle) * (r - 3)));
			line.setAttribute('y2', String(cy + Math.sin(angle) * (r - 3)));
			line.setAttribute('stroke', isMajor ? BORDER : BORDER_DIM);
			line.setAttribute('stroke-width', isMajor ? '2' : '1');
			svg.appendChild(line);

			if (isMajor) {
				const hourNum = document.createElementNS('http://www.w3.org/2000/svg', 'text');
				const label = i === 0 ? '12' : String(i);
				hourNum.setAttribute('x', String(cx + Math.cos(angle) * (r - 28)));
				hourNum.setAttribute('y', String(cy + Math.sin(angle) * (r - 28) + 4));
				hourNum.setAttribute('text-anchor', 'middle');
				hourNum.setAttribute('fill', TEXT_MUTED); hourNum.setAttribute('font-size', '9');
				hourNum.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
				hourNum.textContent = label;
				svg.appendChild(hourNum);
			}
		}

		// Hour hand — we animate by updating x2/y2 from angle state
		const hourHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		const minuteHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');

		// Starting angles: 10:10 position (looks good on clocks)
		const startHourAngle  = (10 / 12) * Math.PI * 2 - Math.PI / 2; // 10 o'clock
		const startMinAngle   = (2  / 12) * Math.PI * 2 - Math.PI / 2; // 10 min

		const hourLen = 46, minLen = 64;

		function setHand(hand: SVGLineElement, angle: number, len: number) {
			hand.setAttribute('x1', String(cx));
			hand.setAttribute('y1', String(cy));
			hand.setAttribute('x2', String(cx + Math.cos(angle) * len));
			hand.setAttribute('y2', String(cy + Math.sin(angle) * len));
		}

		setHand(hourHand, startHourAngle, hourLen);
		hourHand.setAttribute('stroke', TEXT); hourHand.setAttribute('stroke-width', '4');
		hourHand.setAttribute('stroke-linecap', 'round');
		svg.appendChild(hourHand);

		setHand(minuteHand, startMinAngle, minLen);
		minuteHand.setAttribute('stroke', GREEN); minuteHand.setAttribute('stroke-width', '2.5');
		minuteHand.setAttribute('stroke-linecap', 'round');
		svg.appendChild(minuteHand);

		// Second hand (thin green)
		const secondHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		const startSecAngle = -Math.PI / 2;
		setHand(secondHand, startSecAngle, 70);
		secondHand.setAttribute('stroke', GREEN_LITE); secondHand.setAttribute('stroke-width', '1');
		secondHand.setAttribute('stroke-linecap', 'round');
		svg.appendChild(secondHand);

		// Center dot
		const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		centerDot.setAttribute('cx', String(cx)); centerDot.setAttribute('cy', String(cy));
		centerDot.setAttribute('r', '5'); centerDot.setAttribute('fill', GREEN);
		svg.appendChild(centerDot);
		const centerDotInner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		centerDotInner.setAttribute('cx', String(cx)); centerDotInner.setAttribute('cy', String(cy));
		centerDotInner.setAttribute('r', '2'); centerDotInner.setAttribute('fill', BG);
		svg.appendChild(centerDotInner);

		// Rule tokens around the outside
		const ruleLabels = ['Daily 9am', 'Mon 10am', '1st/month', '0 9 * * 1', 'Every 6h'];
		const ruleColors = [GREEN, GREEN_LITE, AMBER, GREEN_DIM, GREEN];
		const ruleTokens: SVGGElement[] = [];
		ruleLabels.forEach((label, i) => {
			const angle = (i / ruleLabels.length) * Math.PI * 2 - Math.PI / 2;
			const orbitR = r + 34;
			const gx = cx + Math.cos(angle) * orbitR;
			const gy = cy + Math.sin(angle) * orbitR;

			const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			g.setAttribute('opacity', '0');

			const tw = label.length * 5.0 + 12;
			const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			bg.setAttribute('x', String(gx - tw / 2)); bg.setAttribute('y', String(gy - 9));
			bg.setAttribute('width', String(tw)); bg.setAttribute('height', '17');
			bg.setAttribute('fill', GREEN_900); bg.setAttribute('rx', '3');
			bg.setAttribute('stroke', ruleColors[i]); bg.setAttribute('stroke-width', '0.75');
			g.appendChild(bg);

			const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			t.setAttribute('x', String(gx)); t.setAttribute('y', String(gy + 3));
			t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', ruleColors[i]);
			t.setAttribute('font-size', '7'); t.setAttribute('font-family', 'ui-monospace,monospace');
			t.textContent = label;
			g.appendChild(t);

			svg.appendChild(g);
			ruleTokens.push(g);
		});

		if (prefersReducedMotion()) return;

		// Animate hand angles using proxy objects so we get smooth interpolation
		const hourProxy  = { angle: startHourAngle };
		const minProxy   = { angle: startMinAngle };
		const secProxy   = { angle: startSecAngle };

		const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });

		// Minute hand: one full revolution over 7s
		tl.to(minProxy, {
			angle: startMinAngle + Math.PI * 2,
			duration: 7,
			ease: 'none',
			onUpdate: () => setHand(minuteHand, minProxy.angle, minLen),
		}, 0);

		// Hour hand: 1/12 revolution (one hour tick) over 7s
		tl.to(hourProxy, {
			angle: startHourAngle + (Math.PI * 2) / 12,
			duration: 7,
			ease: 'none',
			onUpdate: () => setHand(hourHand, hourProxy.angle, hourLen),
		}, 0);

		// Second hand: two full revolutions over 7s
		tl.to(secProxy, {
			angle: startSecAngle + Math.PI * 4,
			duration: 7,
			ease: 'none',
			onUpdate: () => setHand(secondHand, secProxy.angle, 70),
		}, 0);

		// Tokens fade in staggered
		ruleTokens.forEach((token, i) => {
			tl.to(token, { opacity: 1, duration: 0.35, ease: 'power2.out' }, 0.4 + i * 0.45);
		});

		// Tokens pulse
		ruleTokens.forEach((token, i) => {
			tl.to(token, { opacity: 0.35, duration: 0.25, yoyo: true, repeat: 1 }, 3.0 + i * 0.25);
		});

		// Fade out tokens
		tl.to(ruleTokens, { opacity: 0, duration: 0.4, stagger: 0.07 }, 6.2);

		timelines.push(tl);
	}

	// ─── ANIMATION 3: Posts ───────────────────────────────────────────────────
	function mountPosts(el: HTMLDivElement) {
		el.innerHTML = '';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 320 240');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		el.appendChild(svg);

		const cardColors = [GREEN, AMBER, GREEN_LITE, RED, GREEN_DIM];
		const cards: SVGGElement[] = [];

		cardColors.forEach((color, i) => {
			const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			g.setAttribute('opacity', i === 0 ? '1' : '0');

			const offsetY = i * 6;
			const card = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			card.setAttribute('x', '32'); card.setAttribute('y', String(28 + offsetY));
			card.setAttribute('width', '256'); card.setAttribute('height', '180');
			card.setAttribute('fill', SURFACE); card.setAttribute('rx', '8');
			card.setAttribute('stroke', BORDER); card.setAttribute('stroke-width', '1');
			g.appendChild(card);

			// Colour band
			const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			band.setAttribute('x', '32'); band.setAttribute('y', String(28 + offsetY));
			band.setAttribute('width', '256'); band.setAttribute('height', '6');
			band.setAttribute('fill', color); band.setAttribute('rx', '8');
			g.appendChild(band);
			const bandCover = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			bandCover.setAttribute('x', '32'); bandCover.setAttribute('y', String(31 + offsetY));
			bandCover.setAttribute('width', '256'); bandCover.setAttribute('height', '5');
			bandCover.setAttribute('fill', SURFACE);
			g.appendChild(bandCover);

			svg.insertBefore(g, svg.firstChild);
			cards.unshift(g);
		});

		// Field labels
		const fieldLabels = ['Title', 'Body', 'Schedule', 'Webhook', 'Custom fields'];
		const fieldValues = ['Q2 Campaign Launch', 'Check out our new features...', 'Mondays @ 9am', 'https://hook.make.com/...', '{ "source": "postplan" }'];
		const fieldEls: { label: SVGTextElement, value: SVGTextElement }[] = [];

		fieldLabels.forEach((label, i) => {
			const ly = 56 + i * 32;

			const labelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			labelEl.setAttribute('x', '48'); labelEl.setAttribute('y', String(ly));
			labelEl.setAttribute('fill', TEXT_MUTED); labelEl.setAttribute('font-size', '8');
			labelEl.setAttribute('font-weight', '600'); labelEl.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
			labelEl.setAttribute('opacity', '0');
			labelEl.textContent = label.toUpperCase();
			svg.appendChild(labelEl);

			const valueEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			valueEl.setAttribute('x', '48'); valueEl.setAttribute('y', String(ly + 13));
			valueEl.setAttribute('fill', TEXT); valueEl.setAttribute('font-size', '9');
			valueEl.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
			valueEl.setAttribute('opacity', '0');
			valueEl.textContent = fieldValues[i];
			svg.appendChild(valueEl);

			fieldEls.push({ label: labelEl, value: valueEl });
		});

		// Multi-select checkboxes
		const checkEls: SVGRectElement[] = [];
		[0, 1, 2].forEach(i => {
			const cb = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			cb.setAttribute('x', '270'); cb.setAttribute('y', String(56 + i * 32));
			cb.setAttribute('width', '10'); cb.setAttribute('height', '10');
			cb.setAttribute('fill', GREEN_DIM); cb.setAttribute('rx', '2');
			cb.setAttribute('stroke', GREEN); cb.setAttribute('stroke-width', '0.75');
			cb.setAttribute('opacity', '0');
			svg.appendChild(cb);
			checkEls.push(cb);
		});

		if (prefersReducedMotion()) return;

		const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });

		fieldEls.forEach(({ label, value }, i) => {
			tl.to(label, { opacity: 1, duration: 0.2 }, 0.2 + i * 0.35);
			tl.to(value, { opacity: 1, duration: 0.3 }, 0.35 + i * 0.35);
		});

		checkEls.forEach((cb, i) => {
			tl.to(cb, { opacity: 1, duration: 0.2 }, 1.8 + i * 0.2);
		});

		cardColors.forEach((_, i) => {
			if (i === 0) return;
			tl.to(cards[0], { opacity: 0, duration: 0.3, y: -8 }, 3.5 + i * 0.6);
			tl.to(cards[i], { opacity: 1, duration: 0.3 }, 3.5 + i * 0.6);
		});

		tl.to([...fieldEls.map(f => f.label), ...fieldEls.map(f => f.value), ...checkEls], {
			opacity: 0, duration: 0.4, stagger: 0.03
		}, 7.0);
		tl.to(cards, { opacity: 0, duration: 0.3 }, 7.5);
		tl.set(cards[0], { opacity: 1, y: 0 }, 8.0);

		timelines.push(tl);
	}

	// Helper: append a nested <svg> icon inside a parent SVG at (cx,cy) with given size
	function addBrandIcon(parent: SVGSVGElement, cx: number, cy: number, size: number, pathData: string, fillColor: string, viewBox = '0 0 24 24') {
		const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		iconSvg.setAttribute('x', String(cx - size / 2));
		iconSvg.setAttribute('y', String(cy - size / 2));
		iconSvg.setAttribute('width', String(size));
		iconSvg.setAttribute('height', String(size));
		iconSvg.setAttribute('viewBox', viewBox);
		iconSvg.setAttribute('overflow', 'visible');

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('d', pathData);
		path.setAttribute('fill', fillColor);
		iconSvg.appendChild(path);
		parent.appendChild(iconSvg);
		return iconSvg;
	}

	// Brand icon path data extracted from WorkflowAnimation.svelte
	const BRAND_ICONS = {
		wordpress:   { d: 'M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0', color: '#22c55e' },
		squarespace: { d: 'M22.655 8.719c-1.802-1.801-4.726-1.801-6.564 0l-7.351 7.35c-.45.45-.45 1.2 0 1.65.45.449 1.2.449 1.65 0l7.351-7.351c.899-.899 2.362-.899 3.264 0 .9.9.9 2.364 0 3.264l-7.239 7.239c.9.899 2.362.899 3.263 0l5.589-5.589c1.836-1.838 1.836-4.763.037-6.563zm-2.475 2.437c-.451-.45-1.201-.45-1.65 0l-7.354 7.389c-.9.899-2.361.899-3.262 0-.45-.45-1.2-.45-1.65 0s-.45 1.2 0 1.649c1.801 1.801 4.726 1.801 6.564 0l7.351-7.35c.449-.487.449-1.239.001-1.688zm-2.439-7.35c-1.801-1.801-4.726-1.801-6.564 0l-7.351 7.351c-.45.449-.45 1.199 0 1.649s1.2.45 1.65 0l7.395-7.351c.9-.899 2.371-.899 3.27 0 .451.45 1.201.45 1.65 0 .421-.487.421-1.199-.029-1.649h-.021zm-2.475 2.437c-.45-.45-1.2-.45-1.65 0l-7.351 7.389c-.899.9-2.363.9-3.265 0-.9-.899-.9-2.363 0-3.264l7.239-7.239c-.9-.9-2.362-.9-3.263 0L1.35 8.719c-1.8 1.8-1.8 4.725 0 6.563 1.801 1.801 4.725 1.801 6.564 0l7.35-7.351c.451-.488.451-1.238 0-1.688h.002z', color: '#a3a3a3' },
		rss:         { d: 'M4.12008 10.4267C4.50553 10.4267 4.87519 10.5798 5.14774 10.8524C5.4203 11.1249 5.57341 11.4946 5.57341 11.88C5.57341 12.6667 4.92008 13.3334 4.12008 13.3334C3.33341 13.3334 2.66675 12.6667 2.66675 11.88C2.66675 11.4946 2.81987 11.1249 3.09242 10.8524C3.36497 10.5798 3.73463 10.4267 4.12008 10.4267ZM2.66675 2.96002C5.41793 2.96002 8.05643 4.05292 10.0018 5.9983C11.9472 7.94368 13.0401 10.5822 13.0401 13.3334H11.1534C11.1534 11.0826 10.2593 8.92393 8.66773 7.33238C7.07617 5.74082 4.91755 4.84669 2.66675 4.84669V2.96002ZM2.66675 6.73336C4.41718 6.73336 6.09591 7.42871 7.33365 8.66645C8.57139 9.90419 9.26675 11.5829 9.26675 13.3334H7.38008C7.38008 12.0833 6.8835 10.8844 5.99958 10.0005C5.11566 9.1166 3.9168 8.62002 2.66675 8.62002V6.73336Z', color: '#f59e0b', vb: '0 0 16 16' },
		webhook:     { d: 'M4.66659 14C3.74436 14 2.95836 13.6749 2.30859 13.0246C1.65881 12.3744 1.3337 11.5884 1.33325 10.6666C1.33325 9.85554 1.58614 9.14731 2.09192 8.54198C2.5977 7.93665 3.2337 7.55598 3.99992 7.39998V8.78331C3.61103 8.91665 3.2917 9.15554 3.04192 9.49998C2.79214 9.84443 2.66703 10.2333 2.66659 10.6666C2.66659 11.2222 2.86103 11.6944 3.24992 12.0833C3.63881 12.4722 4.11103 12.6666 4.66659 12.6666C5.22214 12.6666 5.69436 12.4722 6.08325 12.0833C6.47214 11.6944 6.66659 11.2222 6.66659 10.6666V9.99998H10.5833C10.6721 9.89998 10.7806 9.81931 10.9086 9.75798C11.0366 9.69665 11.1781 9.6662 11.3333 9.66665C11.611 9.66665 11.8473 9.76398 12.0419 9.95865C12.2366 10.1533 12.3337 10.3893 12.3333 10.6666C12.3328 10.944 12.2357 11.1802 12.0419 11.3753C11.8481 11.5704 11.6119 11.6675 11.3333 11.6666C11.1777 11.6666 11.0359 11.6362 10.9079 11.5753C10.7799 11.5144 10.6719 11.4338 10.5839 11.3333H7.93325C7.7777 12.1 7.39703 12.7362 6.79125 13.242C6.18547 13.7478 5.47725 14.0004 4.66659 14ZM11.3333 14C10.711 14 10.1473 13.8473 9.64192 13.542C9.13659 13.2366 8.73925 12.8338 8.44992 12.3333H10.2333C10.3888 12.4444 10.561 12.5278 10.7499 12.5833C10.9388 12.6389 11.1333 12.6666 11.3333 12.6666C11.8888 12.6666 12.361 12.4722 12.7499 12.0833C13.1388 11.6944 13.3333 11.2222 13.3333 10.6666C13.3333 10.1111 13.1388 9.63887 12.7499 9.24998C12.361 8.86109 11.8888 8.66665 11.3333 8.66665C11.111 8.66665 10.9055 8.69731 10.7166 8.75865C10.5277 8.81998 10.3499 8.91154 10.1833 9.03331L8.14992 5.64998C7.91659 5.60554 7.72214 5.49442 7.56659 5.31665C7.41103 5.13887 7.33325 4.9222 7.33325 4.66665C7.33325 4.38887 7.43059 4.15287 7.62525 3.95865C7.81992 3.76442 8.05592 3.66709 8.33325 3.66665C8.61059 3.6662 8.84681 3.76354 9.04192 3.95865C9.23703 4.15376 9.33414 4.38976 9.33325 4.66665V4.80865C9.33325 4.84731 9.32214 4.89442 9.29992 4.94998L10.7499 7.38331C10.8388 7.36109 10.9333 7.34731 11.0333 7.34198C11.1333 7.33665 11.2333 7.33376 11.3333 7.33331C12.2555 7.33331 13.0417 7.65843 13.6919 8.30865C14.3421 8.95887 14.667 9.74487 14.6666 10.6666C14.6661 11.5884 14.341 12.3746 13.6913 13.0253C13.0415 13.676 12.2555 14.0009 11.3333 14ZM4.66659 11.6666C4.38881 11.6666 4.15281 11.5695 3.95859 11.3753C3.76436 11.1811 3.66703 10.9449 3.66659 10.6666C3.66659 10.4222 3.74436 10.2111 3.89992 10.0333C4.05547 9.85554 4.24436 9.73887 4.46659 9.68331L6.03325 7.08331C5.71103 6.78331 5.45814 6.42509 5.27459 6.00865C5.09103 5.5922 4.99947 5.14487 4.99992 4.66665C4.99992 3.74442 5.32503 2.95842 5.97525 2.30865C6.62547 1.65887 7.41147 1.33376 8.33325 1.33331C9.25503 1.33287 10.0413 1.65798 10.6919 2.30865C11.3426 2.95931 11.6675 3.74531 11.6666 4.66665H10.3333C10.3333 4.11109 10.1388 3.63887 9.74992 3.24998C9.36103 2.86109 8.88881 2.66665 8.33325 2.66665C7.7777 2.66665 7.30547 2.86109 6.91659 3.24998C6.5277 3.63887 6.33325 4.11109 6.33325 4.66665C6.33325 5.14442 6.4777 5.56398 6.76659 5.92531C7.05547 6.28665 7.42214 6.51709 7.86659 6.61665L5.61659 10.3666C5.63881 10.4222 5.65281 10.4722 5.65859 10.5166C5.66436 10.5611 5.66703 10.6111 5.66659 10.6666C5.66659 10.9444 5.56947 11.1806 5.37525 11.3753C5.18103 11.57 4.94481 11.6671 4.66659 11.6666Z', color: '#16a34a', vb: '0 0 16 16' },
		csv:         { d: 'M3.83325 10H5.83325V9.00002H4.16659V7.00002H5.83325V6.00002H3.83325C3.64436 6.00002 3.48614 6.06402 3.35859 6.19202C3.23103 6.32002 3.16703 6.47824 3.16659 6.66669V9.33335C3.16659 9.52224 3.23059 9.68069 3.35859 9.80869C3.48659 9.93669 3.64481 10.0005 3.83325 10ZM6.43325 10H8.43325C8.62214 10 8.78059 9.93602 8.90859 9.80802C9.03659 9.68002 9.10036 9.5218 9.09992 9.33335V8.33335C9.09992 8.14446 9.03592 7.96935 8.90792 7.80802C8.77992 7.64669 8.6217 7.56624 8.43325 7.56669H7.43325V7.00002H9.09992V6.00002H7.09992C6.91103 6.00002 6.75281 6.06402 6.62525 6.19202C6.4977 6.32002 6.4337 6.47824 6.43325 6.66669V7.66669C6.43325 7.85558 6.49725 8.02513 6.62525 8.17535C6.75325 8.32558 6.91147 8.40047 7.09992 8.40002H8.09992V9.00002H6.43325V10ZM10.8333 10H11.8333L12.9999 6.00002H11.9999L11.3333 8.30002L10.6666 6.00002H9.66659L10.8333 10ZM2.66659 13.3334C2.29992 13.3334 1.98614 13.2029 1.72525 12.942C1.46436 12.6811 1.3337 12.3671 1.33325 12V4.00002C1.33325 3.63335 1.46392 3.31958 1.72525 3.05869C1.98659 2.7978 2.30036 2.66713 2.66659 2.66669H13.3333C13.6999 2.66669 14.0139 2.79735 14.2753 3.05869C14.5366 3.32002 14.667 3.6338 14.6666 4.00002V12C14.6666 12.3667 14.5361 12.6807 14.2753 12.942C14.0144 13.2034 13.7004 13.3338 13.3333 13.3334H2.66659Z', color: '#a3a3a3', vb: '0 0 16 16' },
		make:        { d: 'M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z', color: '#6D00CC' },
		n8n:         { d: 'M21.4737 5.6842c-1.1772 0-2.1663.8051-2.4468 1.8947h-2.8955c-1.235 0-2.289.893-2.492 2.111l-.1038.623a1.263 1.263 0 0 1-1.246 1.0555H11.289c-.2805-1.0896-1.2696-1.8947-2.4468-1.8947s-2.1663.8051-2.4467 1.8947H4.973c-.2805-1.0896-1.2696-1.8947-2.4468-1.8947C1.1311 9.4737 0 10.6047 0 12s1.131 2.5263 2.5263 2.5263c1.1772 0 2.1663-.8051 2.4468-1.8947h1.4223c.2804 1.0896 1.2696 1.8947 2.4467 1.8947 1.1772 0 2.1663-.8051 2.4468-1.8947h1.0008a1.263 1.263 0 0 1 1.2459 1.0555l.1038.623c.203 1.218 1.257 2.111 2.492 2.111h.3692c.2804 1.0895 1.2696 1.8947 2.4468 1.8947 1.3952 0 2.5263-1.131 2.5263-2.5263s-1.131-2.5263-2.5263-2.5263c-1.1772 0-2.1664.805-2.4468 1.8947h-.3692a1.263 1.263 0 0 1-1.246-1.0555l-.1037-.623A2.52 2.52 0 0 0 13.9607 12a2.52 2.52 0 0 0 .821-1.4794l.1038-.623a1.263 1.263 0 0 1 1.2459-1.0555h2.8955c.2805 1.0896 1.2696 1.8947 2.4468 1.8947 1.3952 0 2.5263-1.131 2.5263-2.5263s-1.131-2.5263-2.5263-2.5263m0 1.2632a1.263 1.263 0 0 1 1.2631 1.2631 1.263 1.263 0 0 1-1.2631 1.2632 1.263 1.263 0 0 1-1.2632-1.2632 1.263 1.263 0 0 1 1.2632-1.2631M2.5263 10.7368A1.263 1.263 0 0 1 3.7895 12a1.263 1.263 0 0 1-1.2632 1.2632A1.263 1.263 0 0 1 1.2632 12a1.263 1.263 0 0 1 1.2631-1.2632m6.3158 0A1.263 1.263 0 0 1 10.1053 12a1.263 1.263 0 0 1-1.2632 1.2632A1.263 1.263 0 0 1 7.579 12a1.263 1.263 0 0 1 1.2632-1.2632m10.1053 3.7895a1.263 1.263 0 0 1 1.2631 1.2632 1.263 1.263 0 0 1-1.2631 1.2631 1.263 1.263 0 0 1-1.2632-1.2631 1.263 1.263 0 0 1 1.2632-1.2632', color: '#EA4B71' },
		zapier:      { d: 'M4.157 0A4.151 4.151 0 0 0 0 4.161v15.678A4.151 4.151 0 0 0 4.157 24h15.682A4.152 4.152 0 0 0 24 19.839V4.161A4.152 4.152 0 0 0 19.839 0H4.157Zm10.61 8.761h.03a.577.577 0 0 1 .23.038.585.585 0 0 1 .201.124.63.63 0 0 1 .162.431.612.612 0 0 1-.162.435.58.58 0 0 1-.201.128.58.58 0 0 1-.23.042.529.529 0 0 1-.235-.042.585.585 0 0 1-.332-.328.559.559 0 0 1-.038-.235.613.613 0 0 1 .17-.431.59.59 0 0 1 .405-.162Zm2.853 1.572c.03.004.061.004.095.004.325-.011.646.064.937.219.238.144.431.355.552.609.128.279.189.582.185.888v.193a2 2 0 0 1 0 .219h-2.498c.003.227.075.45.204.642a.78.78 0 0 0 .646.265.714.714 0 0 0 .484-.136.642.642 0 0 0 .23-.318l.915.257a1.398 1.398 0 0 1-.28.537c-.14.159-.321.284-.521.355a2.234 2.234 0 0 1-.836.136 1.923 1.923 0 0 1-1.001-.245 1.618 1.618 0 0 1-.665-.703 2.221 2.221 0 0 1-.227-1.036 1.95 1.95 0 0 1 .48-1.398 1.9 1.9 0 0 1 1.3-.488Zm-9.607.023c.162.004.325.026.48.079.207.065.4.174.563.314.26.302.393.692.366 1.088v2.276H8.53l-.109-.711h-.065c-.064.163-.155.31-.272.439a1.122 1.122 0 0 1-.374.264 1.023 1.023 0 0 1-.453.083 1.334 1.334 0 0 1-.866-.264.965.965 0 0 1-.329-.801.993.993 0 0 1 .076-.431 1.02 1.02 0 0 1 .242-.363 1.478 1.478 0 0 1 1.043-.303h.952v-.181a.696.696 0 0 0-.136-.454.553.553 0 0 0-.438-.154.695.695 0 0 0-.378.086.48.48 0 0 0-.193.254l-.99-.144a1.26 1.26 0 0 1 .257-.563c.14-.174.321-.302.533-.378.261-.091.54-.136.82-.129.053-.003.106-.007.163-.007Zm4.384.007c.174 0 .347.038.506.114.182.083.34.211.458.374.257.423.377.911.351 1.406a2.53 2.53 0 0 1-.355 1.448 1.148 1.148 0 0 1-1.009.517c-.204 0-.401-.045-.582-.136a1.052 1.052 0 0 1-.48-.457 1.298 1.298 0 0 1-.114-.234h-.045l.004 1.784h-1.059v-4.713h.904l.117.805h.057c.068-.208.177-.401.328-.56a1.129 1.129 0 0 1 .843-.344h.076v-.004Zm7.559.084h.903l.113.805h.053a1.37 1.37 0 0 1 .235-.484.813.813 0 0 1 .313-.242.82.82 0 0 1 .39-.076h.234v1.051h-.401a.662.662 0 0 0-.313.008.623.623 0 0 0-.272.155.663.663 0 0 0-.174.26.683.683 0 0 0-.027.314v1.875h-1.054v-3.666Zm-17.515.003h3.262v.896L3.73 13.104l.034.113h1.973l.042.9H2.4v-.9l1.931-1.754-.045-.117H2.441v-.896Zm11.815 0h1.055v3.659h-1.055V10.45Zm3.443.684.019.016a.69.69 0 0 0-.351.045.756.756 0 0 0-.287.204c-.11.155-.174.336-.189.522h1.545c-.034-.526-.257-.787-.74-.787h.003Zm-5.718.163c-.026 0-.057 0-.083.004a.78.78 0 0 0-.31.053.746.746 0 0 0-.257.189 1.016 1.016 0 0 0-.204.695v.064c-.015.257.057.507.204.711a.634.634 0 0 0 .253.196.638.638 0 0 0 .314.061.644.644 0 0 0 .578-.265c.14-.223.204-.48.189-.74a1.216 1.216 0 0 0-.181-.711.677.677 0 0 0-.503-.257Zm-4.509 1.266a.464.464 0 0 0-.268.102.373.373 0 0 0-.114.276c0 .053.008.106.027.155a.375.375 0 0 0 .087.132.576.576 0 0 0 .397.11v.004a.863.863 0 0 0 .563-.182.573.573 0 0 0 .211-.457v-.14h-.903Z', color: '#FF4F00' },
		ifttt:       { d: 'M0 8.82h2.024v6.36H0zm11.566 0h-3.47v2.024h1.446v4.337h2.024v-4.337h1.446V8.82zm5.494 0h-3.47v2.024h1.446v4.337h2.024v-4.337h1.446V8.82zm5.494 0h-3.47v2.024h1.446v4.337h2.024v-4.337H24V8.82zM7.518 10.843V8.82H2.892v6.36h2.024v-1.734H6.65v-2.024H4.916v-.578z', color: '#ffffff' },
	};

	// ─── ANIMATION 4: Inputs ─────────────────────────────────────────────────
	function mountInputs(el: HTMLDivElement) {
		el.innerHTML = '';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 320 240');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		el.appendChild(svg);

		const sources = [
			{ x: 50,  y: 44,  key: 'wordpress'  as keyof typeof BRAND_ICONS },
			{ x: 50,  y: 120, key: 'rss'         as keyof typeof BRAND_ICONS },
			{ x: 50,  y: 196, key: 'squarespace' as keyof typeof BRAND_ICONS },
			{ x: 160, y: 44,  key: 'webhook'     as keyof typeof BRAND_ICONS },
			{ x: 160, y: 196, key: 'csv'         as keyof typeof BRAND_ICONS },
		];

		const destX = 270, destY = 120;

		// Destination node
		const destCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		destCircle.setAttribute('cx', String(destX)); destCircle.setAttribute('cy', String(destY));
		destCircle.setAttribute('r', '24'); destCircle.setAttribute('fill', GREEN_900);
		destCircle.setAttribute('stroke', GREEN); destCircle.setAttribute('stroke-width', '1.5');
		svg.appendChild(destCircle);

		// PostPlan label
		const destLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		destLabel.setAttribute('x', String(destX)); destLabel.setAttribute('y', String(destY + 4));
		destLabel.setAttribute('text-anchor', 'middle'); destLabel.setAttribute('fill', GREEN_LITE);
		destLabel.setAttribute('font-size', '7'); destLabel.setAttribute('font-weight', '700');
		destLabel.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
		destLabel.textContent = 'PostPlan';
		svg.appendChild(destLabel);

		const particles: SVGCircleElement[][] = [];

		sources.forEach(({ x, y, key }) => {
			const icon = BRAND_ICONS[key];
			const color = icon.color;
			const vb = ('vb' in icon) ? icon.vb as string : '0 0 24 24';

			// Background circle
			const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', String(x)); circle.setAttribute('cy', String(y));
			circle.setAttribute('r', '20'); circle.setAttribute('fill', SURFACE2);
			circle.setAttribute('stroke', color); circle.setAttribute('stroke-width', '1.5');
			svg.appendChild(circle);

			// Brand icon centered in circle
			addBrandIcon(svg, x, y, 18, icon.d, color, vb);

			// Particles
			const srcParticles: SVGCircleElement[] = [];
			for (let p = 0; p < 4; p++) {
				const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
				dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y));
				dot.setAttribute('r', '3'); dot.setAttribute('fill', color);
				dot.setAttribute('opacity', '0');
				svg.appendChild(dot);
				srcParticles.push(dot);
			}
			particles.push(srcParticles);
		});

		if (prefersReducedMotion()) return;

		const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });

		sources.forEach(({ x, y }, si) => {
			particles[si].forEach((dot, pi) => {
				const delay = si * 0.3 + pi * 0.25;
				tl.to(dot, { opacity: 0.9, duration: 0.2 }, delay);
				tl.to(dot, { attr: { cx: destX, cy: destY }, duration: 0.8 + pi * 0.1, ease: 'power2.in' }, delay + 0.1);
				tl.to(dot, { opacity: 0, duration: 0.15 }, delay + 0.8);
			});
		});

		sources.forEach((_, si) => {
			tl.to(destCircle, { attr: { r: 28 }, duration: 0.15, yoyo: true, repeat: 1 }, si * 0.3 + 1.0);
		});

		sources.forEach(({ x, y }, si) => {
			particles[si].forEach((dot) => {
				tl.set(dot, { attr: { cx: x, cy: y } }, 4.5);
			});
		});

		timelines.push(tl);
	}

	// ─── ANIMATION 5: Outputs ─────────────────────────────────────────────────
	function mountOutputs(el: HTMLDivElement) {
		el.innerHTML = '';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 320 240');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		el.appendChild(svg);

		const centerX = 80, centerY = 120;

		// Central PostPlan node
		const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		centerCircle.setAttribute('cx', String(centerX)); centerCircle.setAttribute('cy', String(centerY));
		centerCircle.setAttribute('r', '26'); centerCircle.setAttribute('fill', GREEN_900);
		centerCircle.setAttribute('stroke', GREEN); centerCircle.setAttribute('stroke-width', '2');
		svg.appendChild(centerCircle);

		const centerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		centerText.setAttribute('x', String(centerX)); centerText.setAttribute('y', String(centerY + 4));
		centerText.setAttribute('text-anchor', 'middle'); centerText.setAttribute('fill', GREEN_LITE);
		centerText.setAttribute('font-size', '7'); centerText.setAttribute('font-weight', '700');
		centerText.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
		centerText.textContent = 'PostPlan';
		svg.appendChild(centerText);

		const endpoints = [
			{ x: 228, y: 28,  key: 'make'   as keyof typeof BRAND_ICONS },
			{ x: 285, y: 88,  key: 'zapier' as keyof typeof BRAND_ICONS },
			{ x: 292, y: 152, key: 'n8n'    as keyof typeof BRAND_ICONS },
			{ x: 245, y: 212, key: 'ifttt'  as keyof typeof BRAND_ICONS },
			{ x: 168, y: 216, key: 'webhook' as keyof typeof BRAND_ICONS },
		];

		const beams: SVGLineElement[] = [];
		const endpointEls: SVGGElement[] = [];
		const beamParticles: SVGCircleElement[] = [];

		endpoints.forEach(({ x, y, key }) => {
			const icon = BRAND_ICONS[key];
			const color = icon.color;
			const vb = ('vb' in icon) ? icon.vb as string : '0 0 24 24';

			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', String(centerX)); line.setAttribute('y1', String(centerY));
			line.setAttribute('x2', String(x)); line.setAttribute('y2', String(y));
			line.setAttribute('stroke', BORDER_DIM); line.setAttribute('stroke-width', '1');
			line.setAttribute('stroke-dasharray', '4 3');
			svg.appendChild(line);
			beams.push(line);

			const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			g.setAttribute('opacity', '0.35');

			const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', String(x)); circle.setAttribute('cy', String(y));
			circle.setAttribute('r', '20'); circle.setAttribute('fill', SURFACE2);
			circle.setAttribute('stroke', color); circle.setAttribute('stroke-width', '1.5');
			g.appendChild(circle);

			// Brand icon inside endpoint circle
			const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			iconSvg.setAttribute('x', String(x - 9));
			iconSvg.setAttribute('y', String(y - 9));
			iconSvg.setAttribute('width', '18');
			iconSvg.setAttribute('height', '18');
			iconSvg.setAttribute('viewBox', vb);
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', icon.d);
			path.setAttribute('fill', color);
			iconSvg.appendChild(path);
			g.appendChild(iconSvg);

			svg.appendChild(g);
			endpointEls.push(g);

			const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			dot.setAttribute('cx', String(centerX)); dot.setAttribute('cy', String(centerY));
			dot.setAttribute('r', '4'); dot.setAttribute('fill', color);
			dot.setAttribute('opacity', '0');
			svg.appendChild(dot);
			beamParticles.push(dot);
		});

		if (prefersReducedMotion()) return;

		const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });

		tl.to(beams, { attr: { stroke: GREEN_DIM }, duration: 0.5, stagger: 0.15 }, 0);

		endpoints.forEach(({ x, y }, i) => {
			const delay = 0.8 + i * 0.3;
			tl.to(beamParticles[i], { opacity: 1, duration: 0.1 }, delay);
			tl.to(beamParticles[i], { attr: { cx: x, cy: y }, duration: 0.5, ease: 'power2.in' }, delay + 0.05);
			tl.to(beamParticles[i], { opacity: 0, duration: 0.1 }, delay + 0.5);
			tl.to(endpointEls[i], { opacity: 1, duration: 0.2 }, delay + 0.5);
			tl.to(endpointEls[i], { scale: 1.1, duration: 0.15, yoyo: true, repeat: 1, transformOrigin: 'center center' }, delay + 0.5);
		});

		tl.to(beamParticles, { attr: { cx: centerX, cy: centerY }, duration: 0 }, 4.0);
		tl.to(endpointEls, { opacity: 0.35, duration: 0.4, stagger: 0.1 }, 4.2);
		tl.to(beams, { attr: { stroke: BORDER_DIM }, duration: 0.4, stagger: 0.1 }, 4.6);

		timelines.push(tl);
	}

	// ─── ANIMATION 6: Reports ─────────────────────────────────────────────────
	function mountReports(el: HTMLDivElement) {
		el.innerHTML = '';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 320 240');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		el.appendChild(svg);

		// Terminal window
		const termBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		termBg.setAttribute('x', '16'); termBg.setAttribute('y', '16');
		termBg.setAttribute('width', '288'); termBg.setAttribute('height', '208');
		termBg.setAttribute('fill', SURFACE); termBg.setAttribute('rx', '8');
		termBg.setAttribute('stroke', BORDER); termBg.setAttribute('stroke-width', '1');
		svg.appendChild(termBg);

		const titleBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		titleBar.setAttribute('x', '16'); titleBar.setAttribute('y', '16');
		titleBar.setAttribute('width', '288'); titleBar.setAttribute('height', '22');
		titleBar.setAttribute('fill', SURFACE2); titleBar.setAttribute('rx', '8');
		svg.appendChild(titleBar);
		const titleCover = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		titleCover.setAttribute('x', '16'); titleCover.setAttribute('y', '30');
		titleCover.setAttribute('width', '288'); titleCover.setAttribute('height', '8');
		titleCover.setAttribute('fill', SURFACE2);
		svg.appendChild(titleCover);

		// Traffic lights
		[[28, 27, RED], [40, 27, AMBER], [52, 27, GREEN_LITE]].forEach(([x, y, c]) => {
			const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y));
			dot.setAttribute('r', '4'); dot.setAttribute('fill', String(c));
			svg.appendChild(dot);
		});

		const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		titleText.setAttribute('x', '160'); titleText.setAttribute('y', '31');
		titleText.setAttribute('text-anchor', 'middle'); titleText.setAttribute('fill', TEXT_MUTED);
		titleText.setAttribute('font-size', '8'); titleText.setAttribute('font-family', 'ui-monospace,monospace');
		titleText.textContent = 'Reports — Debug Log';
		svg.appendChild(titleText);

		const logLines = [
			{ text: '[09:00:01] POST → Make.com/hook/abc123', status: 'info' },
			{ text: '[09:00:01] ✓ 200 OK  stage=publish', status: 'ok' },
			{ text: '[09:15:00] POST → Make.com/hook/abc123', status: 'info' },
			{ text: '[09:15:01] ✗ 422 Unprocessable Entity', status: 'fail' },
			{ text: '[10:00:00] POST → Zapier/catch/xyz', status: 'info' },
			{ text: '[10:00:01] ✓ 200 OK  stage=done', status: 'ok' },
		];

		const logEls: SVGTextElement[] = [];
		logLines.forEach((line, i) => {
			const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			t.setAttribute('x', '26');
			t.setAttribute('y', String(56 + i * 26));
			t.setAttribute('fill', line.status === 'fail' ? RED : line.status === 'ok' ? GREEN_LITE : TEXT_DIM);
			t.setAttribute('font-size', '7.5');
			t.setAttribute('font-family', 'ui-monospace,monospace');
			t.setAttribute('opacity', '0');
			t.textContent = line.text;
			svg.appendChild(t);
			logEls.push(t);
		});

		const statLabels = [
			{ label: 'Sent',    value: '248', color: GREEN_LITE },
			{ label: 'Failed',  value: '3',   color: RED },
			{ label: 'Pending', value: '12',  color: AMBER },
		];
		const statEls: SVGTextElement[] = [];
		statLabels.forEach(({ label, value, color }, i) => {
			const gx = 40 + i * 90;
			const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			t.setAttribute('x', String(gx)); t.setAttribute('y', '218');
			t.setAttribute('fill', color); t.setAttribute('font-size', '9');
			t.setAttribute('font-weight', '700'); t.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
			t.setAttribute('opacity', '0');
			t.textContent = `${value} ${label}`;
			svg.appendChild(t);
			statEls.push(t);
		});

		if (prefersReducedMotion()) return;

		const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });

		logEls.forEach((el, i) => {
			tl.to(el, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0.2 + i * 0.45);
		});

		statEls.forEach((el, i) => {
			tl.to(el, { opacity: 1, duration: 0.3 }, 1.5 + i * 0.3);
		});

		const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		cursor.setAttribute('x', '26'); cursor.setAttribute('y', String(56 + logLines.length * 26));
		cursor.setAttribute('width', '7'); cursor.setAttribute('height', '9');
		cursor.setAttribute('fill', GREEN); cursor.setAttribute('opacity', '0');
		svg.appendChild(cursor);
		tl.to(cursor, { opacity: 1, duration: 0.5, yoyo: true, repeat: 5 }, 3.0);

		tl.to([...logEls, ...statEls, cursor], { opacity: 0, duration: 0.4, stagger: 0.04 }, 6.5);

		timelines.push(tl);
	}

	// ─── ANIMATION 7: Accounts ────────────────────────────────────────────────
	function mountAccounts(el: HTMLDivElement) {
		el.innerHTML = '';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 320 240');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		el.appendChild(svg);

		const cardDefs = [
			{ title: 'Templates',        subtitle: 'Reusable field structures',    color: GREEN,      y: 120, fields: ['{ "source": "postplan" }', '{ "author": "{{author}}" }'] },
			{ title: 'Global Variables', subtitle: 'Injected into every payload',  color: AMBER,      y: 76,  fields: ['API_KEY = sk_live_xxx', 'ENV = production'] },
			{ title: 'Theme & Billing',  subtitle: 'Pro plan · Stripe managed',    color: GREEN_LITE, y: 32,  fields: ['Dark mode ●', 'Plan: Pro · £5/mo'] },
		];

		const cardEls: SVGGElement[] = [];

		cardDefs.forEach(({ title, subtitle, color, y, fields }) => {
			const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			g.setAttribute('opacity', '0');
			g.style.transform = `translateY(20px)`;

			const card = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			card.setAttribute('x', '24'); card.setAttribute('y', String(y));
			card.setAttribute('width', '272'); card.setAttribute('height', '86');
			card.setAttribute('fill', SURFACE); card.setAttribute('rx', '8');
			card.setAttribute('stroke', BORDER); card.setAttribute('stroke-width', '1');
			g.appendChild(card);

			const accent = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			accent.setAttribute('x', '24'); accent.setAttribute('y', String(y));
			accent.setAttribute('width', '272'); accent.setAttribute('height', '5');
			accent.setAttribute('fill', color); accent.setAttribute('rx', '8');
			g.appendChild(accent);
			const accentCover = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			accentCover.setAttribute('x', '24'); accentCover.setAttribute('y', String(y + 3));
			accentCover.setAttribute('width', '272'); accentCover.setAttribute('height', '4');
			accentCover.setAttribute('fill', SURFACE);
			g.appendChild(accentCover);

			// Left accent bar
			const leftBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			leftBar.setAttribute('x', '24'); leftBar.setAttribute('y', String(y + 5));
			leftBar.setAttribute('width', '3'); leftBar.setAttribute('height', '81');
			leftBar.setAttribute('fill', color);
			g.appendChild(leftBar);

			const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			titleEl.setAttribute('x', '38'); titleEl.setAttribute('y', String(y + 22));
			titleEl.setAttribute('fill', color); titleEl.setAttribute('font-size', '10');
			titleEl.setAttribute('font-weight', '700'); titleEl.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
			titleEl.textContent = title;
			g.appendChild(titleEl);

			const subEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			subEl.setAttribute('x', '38'); subEl.setAttribute('y', String(y + 34));
			subEl.setAttribute('fill', TEXT_MUTED); subEl.setAttribute('font-size', '7.5');
			subEl.setAttribute('font-family', 'ui-sans-serif,system-ui,sans-serif');
			subEl.textContent = subtitle;
			g.appendChild(subEl);

			fields.forEach((field, fi) => {
				const ft = document.createElementNS('http://www.w3.org/2000/svg', 'text');
				ft.setAttribute('x', '38'); ft.setAttribute('y', String(y + 52 + fi * 18));
				ft.setAttribute('fill', TEXT_DIM); ft.setAttribute('font-size', '8');
				ft.setAttribute('font-family', 'ui-monospace,monospace');
				ft.textContent = field;
				g.appendChild(ft);
			});

			svg.appendChild(g);
			cardEls.push(g);
		});

		if (prefersReducedMotion()) return;

		const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });

		cardEls.forEach((g, i) => {
			tl.to(g, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.2 + i * 0.4);
		});

		cardEls.forEach((g, i) => {
			tl.to(g, { scale: 1.02, duration: 0.2, yoyo: true, repeat: 1, transformOrigin: 'center center' }, 2.0 + i * 0.8);
		});

		tl.to(cardEls, { opacity: 0, y: -10, duration: 0.4, stagger: 0.15 }, 5.5);

		timelines.push(tl);
	}

	onMount(() => {
		if (!container) return;
		const mountFns = { 1: mountCalendar, 2: mountSchedules, 3: mountPosts, 4: mountInputs, 5: mountOutputs, 6: mountReports, 7: mountAccounts };
		mountFns[section]?.(container);
	});

	onDestroy(() => {
		timelines.forEach(tl => tl.kill());
		timelines = [];
	});
</script>

<div
	bind:this={container}
	class="w-full h-full {className}"
	style="background: {BG}; border-radius: inherit;"
	aria-hidden="true"
></div>
