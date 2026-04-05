// @ts-nocheck
/* Generated from static/animation_responsive.html — run: node scripts/build-responsive-workflow-animation-module.mjs */
import gsap from 'gsap';

/** Responsive GSAP workflow; host must contain #intro_animation and #timeline (see WorkflowAnimation.svelte). */
export function mountResponsiveWorkflowAnimation(host: HTMLElement): () => void {
	const ctx = gsap.context(() => {
let introRunId = 0;
let introPaused = false;
const pipeStreamIntervals = new Set();

const clockState = { t: 9 * 60 };

function clearAllPipeStreamIntervals() {
	pipeStreamIntervals.forEach((id) => clearInterval(id));
	pipeStreamIntervals.clear();
}

function syncIntroPauseToggle() {
	const btn = host.querySelector('#intro_pause_toggle');
	if (!btn) return;
	const pauseIcon = btn.querySelector('.intro-pause-icon');
	const playIcon = btn.querySelector('.intro-play-icon');
	if (pauseIcon && playIcon) {
		pauseIcon.classList.toggle('hidden', introPaused);
		playIcon.classList.toggle('hidden', !introPaused);
		pauseIcon.setAttribute('aria-hidden', introPaused ? 'true' : 'false');
		playIcon.setAttribute('aria-hidden', introPaused ? 'false' : 'true');
	}
	btn.setAttribute('aria-pressed', introPaused ? 'true' : 'false');
	btn.setAttribute('aria-label', introPaused ? 'Resume intro animation' : 'Pause intro animation');
	btn.classList.toggle('intro-paused', introPaused);
}

function setIntroPaused(paused) {
	introPaused = paused;
	if (paused) {
		clearAllPipeStreamIntervals();
		gsap.globalTimeline.pause();
	} else {
		gsap.globalTimeline.resume();
		const stage =
			host.querySelector('#timeline .timeline-btn.timeline-active')?.dataset.stage;
		if (stage) {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => scrollIntroToStage(stage));
			});
		}
	}
	syncIntroPauseToggle();
}

function resumeIntroIfPaused() {
	if (introPaused) setIntroPaused(false);
}

function bumpIntroRunId() {
	introRunId += 1;
	return introRunId;
}

function syncClockFromState() {
	const timeEl = host.querySelector('#clock_time');
	if (timeEl) timeEl.textContent = formatClockFromTotalMinutes(clockState.t);
}

function setTimelineActive(stageId, opts = {}) {
	const syncCarousel = opts.scroll !== false && !introPaused;
	host.querySelectorAll('#timeline .timeline-btn').forEach((btn) => {
		btn.classList.toggle('timeline-active', btn.dataset.stage === stageId);
	});
	if (syncCarousel) {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => scrollIntroToStage(stageId));
		});
	}
}

let introLayoutKey = '';

/** While true, ignore scroll-based timeline sync (avoids fighting smooth scroll from setTimelineActive). */
let introCarouselScrollSyncSuppressed = false;
let introCarouselScrollSyncTimer = 0;

function beginIntroCarouselProgrammaticScroll(track) {
	introCarouselScrollSyncSuppressed = true;
	window.clearTimeout(introCarouselScrollSyncTimer);
	let settled = false;
	const end = () => {
		if (settled) return;
		settled = true;
		window.clearTimeout(introCarouselScrollSyncTimer);
		introCarouselScrollSyncSuppressed = false;
		if (track && track.isConnected && getIntroLayoutKey() !== 'xl') {
			const i = getIntroSlideIndexFromScroll(track);
			setTimelineActive(slideIndexToStage(i, getIntroLayoutKey()), { scroll: false });
			scheduleLayoutIntroPipesOverlay();
		}
	};
	track.addEventListener('scrollend', end, { once: true });
	introCarouselScrollSyncTimer = window.setTimeout(end, 520);
}

/** Snap index for carousel scroll position (handles last slide + subpixel scroll width). */
function getIntroSlideIndexFromScroll(track) {
	const slides = track.children;
	if (!slides.length) return 0;
	const w = track.clientWidth;
	if (w <= 0) return 0;
	const left = track.scrollLeft;
	const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
	if (maxScroll > 0 && left >= maxScroll - 2) return slides.length - 1;
	let best = 0;
	let bestDist = Infinity;
	for (let i = 0; i < slides.length; i++) {
		const slide = slides[i];
		const center = slide.offsetLeft + slide.offsetWidth * 0.5;
		const viewCenter = left + w * 0.5;
		const d = Math.abs(center - viewCenter);
		if (d < bestDist) {
			bestDist = d;
			best = i;
		}
	}
	return best;
}

function getIntroLayoutKey() {
	const w = window.innerWidth;
	if (w >= 1280) return 'xl';
	if (w >= 768) return 'tablet';
	return 'mobile';
}

/** Connector lines are hidden below the `md` breakpoint (see `getIntroLayoutKey` → `mobile`). */
function introPipesEnabled() {
	return getIntroLayoutKey() !== 'mobile';
}

function stageToSlideIndex(stage, layoutKey) {
	if (layoutKey === 'xl') return null;
	if (layoutKey === 'mobile') {
		const m = {
			website_posts:    0,
			import_data:      1,
			schedule_calendar: 2,
			send_webhook:     3,
			run_automation:   4
		};
		return m[stage] ?? 0;
	}
	/* tablet: four slides — outputs and platforms are separate so Send vs Automate each has its own view */
	if (stage === 'website_posts' || stage === 'import_data') return 0;
	if (stage === 'schedule_calendar') return 1;
	if (stage === 'send_webhook') return 2;
	if (stage === 'run_automation') return 3;
	return 0;
}

function slideIndexToStage(index, layoutKey) {
	if (layoutKey === 'mobile') {
		const s = ['website_posts', 'import_data', 'schedule_calendar', 'send_webhook', 'run_automation'];
		return s[Math.max(0, Math.min(s.length - 1, index))];
	}
	if (layoutKey === 'tablet') {
		const s = ['import_data', 'schedule_calendar', 'send_webhook', 'run_automation'];
		return s[Math.max(0, Math.min(s.length - 1, index))];
	}
	return 'website_posts';
}

function scrollIntroToStage(stage, opts = {}) {
	const layoutKey = getIntroLayoutKey();
	if (layoutKey === 'xl') return;
	const track = host.querySelector('#intro_slides_track');
	if (!track) return;
	const idx = stageToSlideIndex(stage, layoutKey);
	if (idx == null) return;
	const slide = track.children[idx];
	const w = track.clientWidth;
	if (w <= 0) return;
	const targetLeft = slide ? slide.offsetLeft : idx * w;
	beginIntroCarouselProgrammaticScroll(track);
	track.scrollTo({ left: targetLeft, behavior: opts.instant ? 'auto' : 'smooth' });
	requestAnimationFrame(() => {
		requestAnimationFrame(() => scheduleLayoutIntroPipesOverlay());
	});
}

function applyIntroLayout(opts = {}) {
	const root = host.querySelector('#intro_animation');
	const track = host.querySelector('#intro_slides_track');
	const stage = host.querySelector('#intro_carousel_stage');
	if (!root || !track) return;

	const layoutKey = getIntroLayoutKey();
	if (introLayoutKey === layoutKey && !opts.force) return;

	abortIntroScene();

	const panelIds = ['website', 'inputs', 'schedules', 'calendar', 'outputs', 'platforms'];
	const panels = {};
	panelIds.forEach((id) => {
		const el = host.querySelector('#' + (id));
		if (el) panels[id] = el;
	});

	panelIds.forEach((id) => {
		const el = panels[id];
		if (!el) return;
		el.classList.remove('intro-slide-panel');
	});

	track.replaceChildren();
	const clock = host.querySelector('#clock');
	if (!clock) return;

	function ensureTrackInsideStage() {
		if (!stage || track.parentElement === stage) return;
		const overlay = host.querySelector('#intro_pipes_overlay');
		stage.insertBefore(track, overlay || null);
	}

	if (layoutKey === 'xl') {
		root.classList.remove('intro--carousel-mode');
		const order = ['website', 'inputs', 'schedules', 'calendar', 'clock', 'outputs', 'platforms'];
		order.forEach((id) => {
			const el = id === 'clock' ? clock : panels[id];
			if (el) root.appendChild(el);
		});
		ensureTrackInsideStage();
		if (stage) root.appendChild(stage);
		else root.appendChild(track);
		reparentIntroPipesToPanels();
		introLayoutKey = layoutKey;
		return;
	}

	root.classList.add('intro--carousel-mode');
	root.appendChild(clock);
	ensureTrackInsideStage();
	if (stage) root.appendChild(stage);
	else root.appendChild(track);

	function addSlide(innerClass, ids, slideExtraClass = '') {
		const slide = document.createElement('div');
		slide.className = [
			'intro-slide box-border flex min-h-0 w-full min-w-full shrink-0 snap-center flex-col',
			slideExtraClass
		]
			.join(' ')
			.trim();
		const inner = document.createElement('div');
		inner.className = innerClass;
		ids.forEach((id) => {
			const el = panels[id];
			if (!el) return;
			el.classList.add('intro-slide-panel');
			inner.appendChild(el);
		});
		slide.appendChild(inner);
		track.appendChild(slide);
	}

	const schedCalInner = 'flex w-full min-w-0 flex-col gap-2 items-stretch';
	const panelColInner = 'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden';

	if (layoutKey === 'mobile') {
		addSlide(panelColInner, ['website']);
		addSlide(panelColInner, ['inputs']);
		addSlide(schedCalInner, ['schedules', 'calendar'], 'intro-slide--sched-cal');
		addSlide(panelColInner, ['outputs']);
		addSlide(panelColInner, ['platforms']);
	} else {
		addSlide('flex min-h-0 min-w-0 flex-1 flex-row gap-2 overflow-hidden', ['website', 'inputs']);
		addSlide(schedCalInner, ['schedules', 'calendar'], 'intro-slide--sched-cal');
		addSlide(panelColInner, ['outputs']);
		addSlide(panelColInner, ['platforms']);
	}

	reparentIntroPipesToOverlay();
	scheduleLayoutIntroPipesOverlay();

	introLayoutKey = layoutKey;
}

function pipeLineLength(line) {
	return line.getTotalLength
		? line.getTotalLength()
		: Math.hypot(
				line.x2.baseVal.value - line.x1.baseVal.value,
				line.y2.baseVal.value - line.y1.baseVal.value
		  );
}

function resetPipeSvg(svgEl, drawn = false) {
	if (!svgEl) return;
	svgEl.querySelectorAll('.pipe-stream-pixel').forEach((n) => n.remove());
	const line = svgEl.querySelector('.pipe-line');
	if (!line) return;
	const len = pipeLineLength(line);
	if (drawn) {
		gsap.set(line, { strokeDasharray: len, strokeDashoffset: 0, opacity: 1 });
		svgEl.classList.remove('opacity-0');
		svgEl.classList.add('opacity-100');
	} else {
		gsap.set(line, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
		svgEl.classList.remove('opacity-100');
		svgEl.classList.add('opacity-0');
	}
}

function introCarouselMode() {
	return host.querySelector('#intro_animation')?.classList.contains('intro--carousel-mode');
}

const INTRO_PIPE_HOST = {
	website_to_inputs: 'website',
	website_to_inputs_mobile: 'website',
	inputs_to_schedules: 'inputs',
	inputs_to_schedules_mobile: 'inputs',
	schedules_to_calendar: 'schedules',
	calendar_to_outputs: 'calendar',
	calendar_to_outputs_mobile: 'calendar',
	outputs_to_platforms: 'outputs',
	outputs_to_platforms_mobile: 'outputs'
};

const INTRO_PIPE_GEOM = [
	{ id: 'website_to_inputs', from: ['website', 'right'], to: ['inputs', 'left'] },
	{ id: 'website_to_inputs_mobile', from: ['website', 'bottom'], to: ['inputs', 'top'] },
	{ id: 'inputs_to_schedules', from: ['inputs', 'right'], to: ['schedules', 'left'] },
	{ id: 'inputs_to_schedules_mobile', from: ['inputs', 'bottom'], to: ['schedules', 'top'] },
	{ id: 'schedules_to_calendar', from: ['schedules', 'bottom'], to: ['calendar', 'top'] },
	{ id: 'calendar_to_outputs', from: ['calendar', 'right'], to: ['outputs', 'left'] },
	{ id: 'calendar_to_outputs_mobile', from: ['calendar', 'bottom'], to: ['outputs', 'top'] },
	{ id: 'outputs_to_platforms', from: ['outputs', 'right'], to: ['platforms', 'left'] },
	{ id: 'outputs_to_platforms_mobile', from: ['outputs', 'bottom'], to: ['platforms', 'top'] }
];

let introPipesLayoutRaf = 0;

function backupIntroPipeInlineStyles(svg) {
	if (!svg || svg.dataset.introPipeStyleBackup !== undefined) return;
	svg.dataset.introPipeStyleBackup = svg.getAttribute('style') || '';
}

function restoreIntroPipeInlineStyles(svg) {
	if (!svg || svg.dataset.introPipeStyleBackup === undefined) return;
	svg.setAttribute('style', svg.dataset.introPipeStyleBackup);
}

function reparentIntroPipesToOverlay() {
	const overlay = host.querySelector('#intro_pipes_overlay');
	if (!overlay) return;
	Object.keys(INTRO_PIPE_HOST).forEach((id) => {
		const el = host.querySelector('#' + (id));
		if (el) {
			backupIntroPipeInlineStyles(el);
			overlay.appendChild(el);
		}
	});
}

function reparentIntroPipesToPanels() {
	Object.entries(INTRO_PIPE_HOST).forEach(([pipeId, hostId]) => {
		const el = host.querySelector('#' + (pipeId));
		const panelHost = host.querySelector('#' + (hostId));
		if (el && panelHost) {
			panelHost.appendChild(el);
			restoreIntroPipeInlineStyles(el);
		}
	});
}

function introPipeEdgePoint(rect, edge) {
	if (!rect || (rect.width <= 0 && rect.height <= 0)) return null;
	const mx = rect.left + rect.width * 0.5;
	const my = rect.top + rect.height * 0.5;
	if (edge === 'right') return { x: rect.right, y: my };
	if (edge === 'left') return { x: rect.left, y: my };
	if (edge === 'bottom') return { x: mx, y: rect.bottom };
	if (edge === 'top') return { x: mx, y: rect.top };
	return null;
}

function syncPipeDashAfterLayout(svg) {
	const line = svg?.querySelector('.pipe-line');
	if (!line) return;
	const len = pipeLineLength(line);
	const drawn = svg.classList.contains('opacity-100');
	gsap.set(line, {
		strokeDasharray: len,
		strokeDashoffset: drawn ? 0 : len,
		opacity: 1
	});
}

function placePipeLineInOverlay(svg, overlay, p1, p2) {
	if (!svg || !overlay || !p1 || !p2) return;
	const ol = overlay.getBoundingClientRect();
	const ax = p1.x - ol.left;
	const ay = p1.y - ol.top;
	const bx = p2.x - ol.left;
	const by = p2.y - ol.top;
	const left = Math.min(ax, bx);
	const top = Math.min(ay, by);
	const w = Math.max(4, Math.ceil(Math.abs(bx - ax)));
	const h = Math.max(4, Math.ceil(Math.abs(by - ay)));
	svg.style.cssText = [
		'position:absolute',
		`left:${left}px`,
		`top:${top}px`,
		`width:${w}px`,
		`height:${h}px`,
		'overflow:visible',
		'transform:none'
	].join(';');
	const line = svg.querySelector('.pipe-line');
	if (!line) return;
	line.setAttribute('x1', String(ax - left));
	line.setAttribute('y1', String(ay - top));
	line.setAttribute('x2', String(bx - left));
	line.setAttribute('y2', String(by - top));
	svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
	svg.setAttribute('preserveAspectRatio', 'none');
	if (!gsap.isTweening(line)) syncPipeDashAfterLayout(svg);
	else {
		const len = pipeLineLength(line);
		gsap.set(line, { strokeDasharray: len });
	}
}

function layoutIntroPipesOverlay() {
	const overlay = host.querySelector('#intro_pipes_overlay');
	if (!overlay || !introCarouselMode() || !introPipesEnabled()) return;
	INTRO_PIPE_GEOM.forEach((spec) => {
		const svg = host.querySelector('#' + (spec.id));
		if (!svg || svg.parentElement !== overlay) return;
		const fromEl = host.querySelector('#' + (spec.from[0]));
		const toEl = host.querySelector('#' + (spec.to[0]));
		if (!fromEl || !toEl) return;
		const p1 = introPipeEdgePoint(fromEl.getBoundingClientRect(), spec.from[1]);
		const p2 = introPipeEdgePoint(toEl.getBoundingClientRect(), spec.to[1]);
		if (!p1 || !p2) return;
		placePipeLineInOverlay(svg, overlay, p1, p2);
	});
}

function scheduleLayoutIntroPipesOverlay() {
	if (!introCarouselMode() || !introPipesEnabled()) return;
	cancelAnimationFrame(introPipesLayoutRaf);
	introPipesLayoutRaf = requestAnimationFrame(() => {
		introPipesLayoutRaf = 0;
		layoutIntroPipesOverlay();
	});
}

function getWebsiteToInputsSvg() {
	if (!introPipesEnabled()) return null;
	if (introCarouselMode()) {
		return window.matchMedia('(min-width: 768px)').matches
			? host.querySelector('#website_to_inputs')
			: host.querySelector('#website_to_inputs_mobile');
	}
	return window.matchMedia('(min-width: 768px)').matches
		? host.querySelector('#website_to_inputs')
		: host.querySelector('#website_to_inputs_mobile');
}

function getInputsToSchedulesSvg() {
	if (!introPipesEnabled()) return null;
	if (window.matchMedia('(min-width: 1280px)').matches)
		return host.querySelector('#inputs_to_schedules');
	if (introCarouselMode()) {
		return window.matchMedia('(min-width: 768px)').matches
			? host.querySelector('#inputs_to_schedules')
			: host.querySelector('#inputs_to_schedules_mobile');
	}
	return host.querySelector('#inputs_to_schedules_mobile');
}

function getCalendarToOutputsSvg() {
	if (!introPipesEnabled()) return null;
	if (window.matchMedia('(min-width: 1280px)').matches)
		return host.querySelector('#calendar_to_outputs');
	if (introCarouselMode()) {
		return window.matchMedia('(min-width: 768px)').matches
			? host.querySelector('#calendar_to_outputs')
			: host.querySelector('#calendar_to_outputs_mobile');
	}
	return host.querySelector('#calendar_to_outputs_mobile');
}

function getOutputsToPlatformsSvg() {
	if (!introPipesEnabled()) return null;
	if (window.matchMedia('(min-width: 768px)').matches)
		return host.querySelector('#outputs_to_platforms');
	if (introCarouselMode()) {
		return window.matchMedia('(min-width: 768px)').matches
			? host.querySelector('#outputs_to_platforms')
			: host.querySelector('#outputs_to_platforms_mobile');
	}
	return host.querySelector('#outputs_to_platforms_mobile');
}

function getSchedulesToCalendarSvg() {
	if (!introPipesEnabled()) return null;
	return host.querySelector('#schedules_to_calendar');
}

function removeAllPipePixels() {
	host.querySelectorAll('#intro_animation .pipe-stream-pixel').forEach((n) => n.remove());
}

function resetCalendarToJanuary30() {
	host.querySelectorAll('#intro_animation #calendar .grid > div').forEach((el) => {
		el.classList.remove('current_date', 'border-green-500');
		el.classList.add('border-neutral-600');
	});
	const jan30 = host.querySelector('#calendar_jan_30');
	if (jan30) {
		jan30.classList.remove('border-neutral-600');
		jan30.classList.add('current_date', 'border-green-500');
	}
	gsap.set(host.querySelectorAll('#intro_animation #calendar .grid > div'), { clearProps: 'borderColor' });
}

function setClockFaceJanuary30() {
	const m = host.querySelector('#clock_month');
	const d = host.querySelector('#clock_day');
	const o = host.querySelector('#clock_ordinal');
	if (m) m.textContent = 'January';
	if (d) d.textContent = '30';
	if (o) o.textContent = 'th';
}

/**
 * Snap the intro scene to a checkpoint for timeline jumps.
 * initial | after_posts | after_import_pipe | calendar_ready | automation_entry
 */
function applyCheckpoint(checkpoint) {
	removeAllPipePixels();
	[
		'#website_to_inputs',
		'#website_to_inputs_mobile',
		'#inputs_to_schedules',
		'#inputs_to_schedules_mobile',
		'#schedules_to_calendar',
		'#calendar_to_outputs',
		'#calendar_to_outputs_mobile',
		'#outputs_to_platforms',
		'#outputs_to_platforms_mobile'
	].forEach((sel) => resetPipeSvg(host.querySelector(sel), false));

	gsap.set('.website_post', { opacity: 0, y: 12, clearProps: 'filter' });
	gsap.set('#input_wordpress', { clearProps: 'borderColor' });
	gsap.set('#schedule_daily_inspiration', { clearProps: 'borderColor' });
	gsap.set('#output_make', { clearProps: 'borderColor' });
	gsap.set('#inputs', { opacity: 0.2 });
	gsap.set('#schedules', { opacity: 0.2 });
	gsap.set('#calendar', { opacity: 0.2 });
	gsap.set('#calendar .grid > div', { opacity: 0.2 });
	gsap.set('#outputs', { opacity: 0.2 });
	gsap.set('#platforms', { opacity: 0.2 });
	gsap.set('#calendar .calendar_animated_post', { opacity: 0 });
	resetCalendarToJanuary30();
	setClockFaceJanuary30();
	clockState.t = 9 * 60;
	syncClockFromState();

	if (checkpoint === 'initial') return;

	gsap.set(
		['.post_one', '.post_two', '.post_three', '.post_four', '.post_five'],
		{ opacity: 1, y: 0 }
	);
	clockState.t = 11 * 60;
	syncClockFromState();

	if (checkpoint === 'after_posts') return;

	gsap.set('#inputs', { opacity: 1 });
	gsap.set('#input_wordpress', { borderColor: '#22c55e' });
	resetPipeSvg(getWebsiteToInputsSvg(), true);

	if (checkpoint === 'after_import_pipe') return;

	gsap.set('#schedules', { opacity: 1 });
	gsap.set('#schedule_daily_inspiration', { borderColor: '#22c55e' });
	resetPipeSvg(getInputsToSchedulesSvg(), true);
	gsap.set(['#calendar', '#calendar .grid > div'], { opacity: 1 });
	resetPipeSvg(getSchedulesToCalendarSvg(), true);
	gsap.set('#calendar .calendar_animated_post', { opacity: 1 });

	if (checkpoint === 'calendar_ready') return;

	/* First publish wave done; calendar stepped to Feb 8 before stream rounds continue */
	applyCalendarDay(8);
	gsap.set('#outputs', { opacity: 1 });
	gsap.set('#platforms', { opacity: 1 });
	gsap.set('#output_make', { borderColor: '#22c55e' });
	resetPipeSvg(getCalendarToOutputsSvg(), true);
	resetPipeSvg(getOutputsToPlatformsSvg(), true);
}

function abortIntroScene() {
	bumpIntroRunId();
	removeAllPipePixels();
	const root = host.querySelector('#intro_animation');
	if (root) {
		gsap.killTweensOf(root);
		root.querySelectorAll('*').forEach((el) => gsap.killTweensOf(el));
	}
	gsap.killTweensOf(clockState);
	gsap.killTweensOf('.website_post');
	gsap.killTweensOf('#inputs');
	gsap.killTweensOf('#schedules');
	gsap.killTweensOf('#calendar');
	gsap.killTweensOf('#calendar .grid > div');
	gsap.killTweensOf('#outputs');
	gsap.killTweensOf('#platforms');
	gsap.killTweensOf('#calendar .calendar_animated_post');
	gsap.killTweensOf('#input_wordpress');
	gsap.killTweensOf('#schedule_daily_inspiration');
	gsap.killTweensOf('#output_make');
	host.querySelectorAll('#platforms > div[id^="platform_"]').forEach((el) => gsap.killTweensOf(el));
}

/**
 * animatePipe(svgEl, delay)
 *
 * Animates a <line class="pipe-line"> inside svgEl:
 *   Full: hide line → draw (~0.6s) → stream pixels (~1s)
 *   streamOnly: line already drawn → stream only (opts.streamOnly)
 *
 * Works for both horizontal and vertical lines — detected automatically
 * from the <line> coordinates.
 *
 * @param {SVGSVGElement} svgEl  - the <svg> wrapper element
 * @param {number}        delay  - seconds (GSAP time) before the animation starts
 * @param {object|Function} opts - optional { onComplete, streamOnly, onDrawStart, onStreamStart }
 */
function animatePipe(svgEl, delay = 0, opts = {}) {
	if (!svgEl) return;
	const runId        = introRunId;
	const rawOpts      = typeof opts === 'function' ? { onComplete: opts } : opts;
	const onComplete   = rawOpts.onComplete;
	const onDrawStart  = rawOpts.onDrawStart;
	const onStreamStart = rawOpts.onStreamStart;
	const streamOnly   = rawOpts.streamOnly === true;
	const line       = svgEl.querySelector('.pipe-line');
	const lineLen    = line.getTotalLength
	                 ? line.getTotalLength()
	                 : Math.hypot(
	                     line.x2.baseVal.value - line.x1.baseVal.value,
	                     line.y2.baseVal.value - line.y1.baseVal.value
	                   );

	const dx         = Math.abs(line.x2.baseVal.value - line.x1.baseVal.value);
	const dy         = Math.abs(line.y2.baseVal.value - line.y1.baseVal.value);
	const isVertical = dy > dx;

	const PIXEL_COLOR    = '#22c55e';
	const PIXEL_LONG     = 4;
	const PIXEL_SHORT    = 3;
	const PIXEL_W        = isVertical ? PIXEL_SHORT : PIXEL_LONG;
	const PIXEL_H        = isVertical ? PIXEL_LONG  : PIXEL_SHORT;
	const STREAM_DUR     = 1;
	const PIXEL_SPEED    = 0.2;
	const SPAWN_INTERVAL = 60;

	const x0 = line.x1.baseVal.value - PIXEL_W / 2;
	const y0 = line.y1.baseVal.value - PIXEL_H / 2;

	svgEl.classList.remove('opacity-0');
	svgEl.classList.add('opacity-100');

	function runStreamPhase() {
		if (runId !== introRunId) return;
		onStreamStart?.();
		const startTime = performance.now();
		if (onComplete) {
			gsap.delayedCall(STREAM_DUR, () => {
				if (runId !== introRunId) return;
				onComplete();
			});
		}

		const intervalId = setInterval(() => {
			if (introPaused) {
				clearInterval(intervalId);
				pipeStreamIntervals.delete(intervalId);
				return;
			}
			if (runId !== introRunId) {
				clearInterval(intervalId);
				pipeStreamIntervals.delete(intervalId);
				return;
			}
			if (performance.now() - startTime > STREAM_DUR * 1000) {
				clearInterval(intervalId);
				pipeStreamIntervals.delete(intervalId);
				return;
			}

			const px = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			px.classList.add('pipe-stream-pixel');
			px.setAttribute('width', PIXEL_W);
			px.setAttribute('height', PIXEL_H);
			px.setAttribute('x', x0);
			px.setAttribute('y', y0);
			px.setAttribute('fill', PIXEL_COLOR);
			px.setAttribute('rx', 1);
			svgEl.appendChild(px);

			const travelProp = isVertical ? 'y' : 'x';
			const travelDist = lineLen - (isVertical ? PIXEL_H : PIXEL_W);
			const blurFilter = isVertical
				? 'blur(1px) drop-shadow(0 3px 4px #22c55e)'
				: 'blur(1px) drop-shadow(3px 0 4px #22c55e)';

			gsap.fromTo(
				px,
				{ [travelProp]: 0, opacity: 1 },
				{
					[travelProp]: travelDist,
					duration:     PIXEL_SPEED,
					ease:         'none',
					filter:       blurFilter,
					onComplete() {
						if (svgEl.contains(px)) svgEl.removeChild(px);
					}
				}
			);
		}, SPAWN_INTERVAL);
		pipeStreamIntervals.add(intervalId);
	}

	if (streamOnly) {
		gsap.set(line, {
			strokeDasharray:  lineLen,
			strokeDashoffset: 0,
			opacity:          1
		});
		if (delay > 0) gsap.delayedCall(delay, runStreamPhase);
		else runStreamPhase();
		return;
	}

	gsap.set(line, {
		strokeDasharray:  lineLen,
		strokeDashoffset: lineLen,
		opacity:          1
	});

	const tl = gsap.timeline({ delay });

	tl.to(line, {
		strokeDashoffset: 0,
		duration:       0.6,
		ease:           'power2.inOut',
		onStart:        () => onDrawStart?.()
	});

	tl.call(runStreamPhase);
}

/**
 * Like animatePipe, but when pipes are disabled (mobile) or svg is missing,
 * runs onDrawStart/onStreamStart/onComplete after `delay` so timelines keep working.
 */
/** Seconds to dwell on the Import slide when pipes are skipped (mobile). */
const PIPE_SKIP_DWELL_IMPORT_SEC = 1.8;
/** Seconds to dwell on the Automate slide when pipes are skipped (mobile). */
const PIPE_SKIP_DWELL_AUTOMATE_SEC = 2.5;

function animatePipeMaybe(svgEl, delay = 0, opts = {}) {
	if (!svgEl || !introPipesEnabled()) {
		const dwell = opts.mobileDwell != null ? opts.mobileDwell : 0;
		gsap.delayedCall(delay, () => {
			opts.onDrawStart?.();
			opts.onStreamStart?.();
			if (dwell > 0) gsap.delayedCall(dwell, () => opts.onComplete?.());
			else opts.onComplete?.();
		});
		return;
	}
	animatePipe(svgEl, delay, opts);
}

/**
 * animatePipeSequence(selectors, initialDelay)
 *
 * Chains multiple pipe SVGs so each one starts immediately after the previous
 * one finishes its draw + stream phases.
 *
 * @param {string[]} selectors    - CSS selectors for each .line SVG, in order
 * @param {number}   initialDelay - seconds (GSAP time) before the first pipe starts
 */
function animatePipeSequence(selectors, initialDelay = 0) {
	const DRAW_DUR   = 0.6;   /* seconds — must match animatePipe's draw duration */
	const STREAM_DUR = 1;     /* seconds — must match animatePipe's STREAM_DUR */
	const PIPE_TOTAL = DRAW_DUR + STREAM_DUR;

	selectors.forEach((sel, i) => {
		const el = host.querySelector(sel);
		if (!el) return;
		const pipeDelay = initialDelay + i * PIPE_TOTAL;
		animatePipe(el, pipeDelay);
	});
}

function formatClockFromTotalMinutes(totalMin) {
	const t  = Math.floor(totalMin + 1e-6);
	const h  = Math.floor(t / 60) % 24;
	const m  = t % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function flashBorderGreen(el, onComplete, opts = {}) {
	const runId = introRunId;
	if (!el) {
		onComplete?.();
		return;
	}
	const keepGreen = opts.keepGreen === true;
	if (opts.resetBorderBeforeFlash === true) {
		gsap.set(el, { clearProps: 'borderColor' });
	}
	const baseBorder = getComputedStyle(el).borderColor;
	gsap.fromTo(
		el,
		{ borderColor: baseBorder },
		{
			borderColor: '#22c55e',
			repeat: 5,
			yoyo: true,
			duration: 0.12,
			ease: 'power2.inOut',
			onComplete: () => {
				if (runId !== introRunId) return;
				if (keepGreen) gsap.set(el, { borderColor: '#22c55e' });
				onComplete?.();
			}
		}
	);
}

function flashWordpressBorder(onComplete) {
	flashBorderGreen(host.querySelector('#input_wordpress'), onComplete, { keepGreen: true });
}

/** Fade #inputs in, then WordPress flash and website→inputs pipe (runId-guarded). */
function fadeInInputsThenWebsiteToInputsPipe(runId, onPipeComplete) {
	gsap.to('#inputs', {
		opacity:    1,
		duration:   0.5,
		ease:       'power2.out',
		onComplete: () => {
			if (runId !== introRunId) return;
			flashWordpressBorder(() => {
				if (runId !== introRunId) return;
			animatePipeMaybe(getWebsiteToInputsSvg(), 0, {
				mobileDwell: PIPE_SKIP_DWELL_IMPORT_SEC,
				onComplete() {
					if (runId !== introRunId) return;
					onPipeComplete?.();
				}
			});
			});
		}
	});
}

/** One green ring flash per platform row, top to bottom (YouTube → …). */
function flashPlatformBoxesInOrder() {
	const boxes = [...host.querySelectorAll('#platforms > div[id^="platform_"]')];
	if (!boxes.length) return;
	const tl = gsap.timeline({
		onComplete: () => {
			boxes.forEach((el) => gsap.set(el, { clearProps: 'boxShadow' }));
		}
	});
	boxes.forEach((el, i) => {
		tl.fromTo(
			el,
			{ boxShadow: '0 0 0 0px transparent' },
			{
				boxShadow: '0 0 0 2px #22c55e',
				duration:  0.1,
				yoyo:      true,
				repeat:    1,
				ease:      'power2.inOut'
			},
			i === 0 ? 0 : '+=0.08'
		);
	});
}

function ordinalSuffix(day) {
	const j = day % 10;
	const k = day % 100;
	if (j === 1 && k !== 11) return 'st';
	if (j === 2 && k !== 12) return 'nd';
	if (j === 3 && k !== 13) return 'rd';
	return 'th';
}

function setClockDateFebruary(day) {
	const m = host.querySelector('#clock_month');
	const d = host.querySelector('#clock_day');
	const o = host.querySelector('#clock_ordinal');
	if (m) m.textContent = 'February';
	if (d) d.textContent = String(day);
	if (o) o.textContent = ordinalSuffix(day);
}

const FEB_DAY_ADVANCE_SEC = 0.5;

/** Jan 30 starts highlighted; once we’re on February, restore a neutral border on that cell. */
function neutralizeJanuary30Cell() {
	const jan30 = host.querySelector('#calendar_jan_30');
	if (!jan30) return;
	jan30.classList.remove('current_date', 'border-green-500');
	jan30.classList.add('border-neutral-600');
	gsap.set(jan30, { clearProps: 'borderColor' });
}

/** February date on clock + single highlighted calendar cell (`#calendar_feb_N`). */
function applyCalendarDay(day) {
	neutralizeJanuary30Cell();
	const d = Math.min(30, Math.max(1, Math.round(day)));
	setClockDateFebruary(d);
	host.querySelectorAll('#calendar .grid > div.current_date').forEach((el) => el.classList.remove('current_date'));
	const cell = host.querySelector(`#calendar_feb_${d}`);
	if (cell) cell.classList.add('current_date');
}

/**
 * Step the clock/calendar one day at a time from fromD to toD (inclusive end).
 * Caller should already be showing fromD.
 */
function advanceFebruaryDays(fromD, toD, onComplete) {
	const runId = introRunId;
	if (fromD >= toD) {
		if (runId !== introRunId) return;
		applyCalendarDay(toD);
		onComplete?.();
		return;
	}
	let d = fromD;
	function step() {
		if (runId !== introRunId) return;
		d++;
		applyCalendarDay(d);
		if (d >= toD) onComplete?.();
		else gsap.delayedCall(FEB_DAY_ADVANCE_SEC, step);
	}
	gsap.delayedCall(FEB_DAY_ADVANCE_SEC, step);
}

/** Quick highlight on a visible calendar post chip */
function flashCalendarPostChip(el, onComplete) {
	const runId = introRunId;
	if (!el) {
		onComplete?.();
		return;
	}
	gsap.fromTo(
		el,
		{ boxShadow: '0 0 0 0px transparent' },
		{
			boxShadow:  '0 0 0 2px #22c55e',
			duration:   0.1,
			yoyo:       true,
			repeat:     4,
			ease:       'power2.inOut',
			onComplete: () => {
				if (runId !== introRunId) return;
				gsap.set(el, { boxShadow: 'none' });
				onComplete?.();
			}
		}
	);
}

/** Milestone days for the five scheduled posts (Feb 1, 8, 15, 22, 29). */
const PUBLISH_DAYS = [1, 8, 15, 22, 29];

/** Show schedule/calendar slide, then step clock/calendar day-by-day (carousel follows timeline). */
function goToScheduleCalendarThenAdvance(runId, fromD, toD, onComplete) {
	setTimelineActive('schedule_calendar');
	advanceFebruaryDays(fromD, toD, () => {
		if (runId !== introRunId) return;
		onComplete?.();
	});
}

/**
 * Full send → automate wave for one post (timeline + pipes + platforms flash).
 * After posts[0]..posts[3], loops back to schedule/calendar while days advance to the next milestone,
 * then repeats. After posts[4] (Feb 29), stops on automate with no further advance.
 */
function runFullSendAutomateWave(runId, posts, postIndex, calP, outP, makeEl) {
	if (runId !== introRunId) return;
	if (postIndex < 0 || postIndex >= posts.length) return;

	setTimelineActive('send_webhook');

	flashCalendarPostChip(posts[postIndex], () => {
		if (runId !== introRunId) return;
		flashBorderGreen(
			makeEl,
			() => {
				if (runId !== introRunId) return;
				animatePipeMaybe(calP, 0, {
					onComplete: () => {
						if (runId !== introRunId) return;
						gsap.to('#platforms', {
							opacity:    1,
							duration:   0.35,
							ease:       'power2.out',
							onComplete: () => {
								if (runId !== introRunId) return;
								setTimelineActive('run_automation');
								animatePipeMaybe(outP, 0, {
									mobileDwell: PIPE_SKIP_DWELL_AUTOMATE_SEC,
									onDrawStart: flashPlatformBoxesInOrder,
									onComplete:  () => {
										if (runId !== introRunId) return;
										if (postIndex >= posts.length - 1) return;
										goToScheduleCalendarThenAdvance(
											runId,
											PUBLISH_DAYS[postIndex],
											PUBLISH_DAYS[postIndex + 1],
											() =>
												runFullSendAutomateWave(
													runId,
													posts,
													postIndex + 1,
													calP,
													outP,
													makeEl
												)
										);
									}
								});
							}
						});
					}
				});
			},
			{ keepGreen: true, resetBorderBeforeFlash: true }
		);
	});
}

/**
 * After calendar chips are visible: Feb 1 full publish, then for each next post
 * schedule/calendar (clock advances) → send → automate, until all five complete.
 */
function runPublishSequence() {
	const runId = introRunId;
	setTimelineActive('send_webhook');

	const posts  = [...host.querySelectorAll('#calendar .calendar_animated_post')];
	const calP   = getCalendarToOutputsSvg();
	const outP   = getOutputsToPlatformsSvg();
	const makeEl = host.querySelector('#output_make');

	applyCalendarDay(1);

	gsap.to('#outputs', {
		opacity:    1,
		duration:   0.5,
		ease:       'power2.out',
		onComplete: () => {
			if (runId !== introRunId) return;
			flashCalendarPostChip(posts[0], () => {
				if (runId !== introRunId) return;
				flashBorderGreen(
					makeEl,
					() => {
						if (runId !== introRunId) return;
						animatePipeMaybe(calP, 0, {
							onComplete: () => {
								if (runId !== introRunId) return;
								gsap.to('#platforms', {
									opacity:    1,
									duration:   0.5,
									ease:       'power2.out',
									onComplete: () => {
										if (runId !== introRunId) return;
										setTimelineActive('run_automation');
										animatePipeMaybe(outP, 0, {
											mobileDwell: PIPE_SKIP_DWELL_AUTOMATE_SEC,
											onDrawStart: flashPlatformBoxesInOrder,
											onComplete:  () => {
												if (runId !== introRunId) return;
												goToScheduleCalendarThenAdvance(runId, 1, 8, () =>
													runFullSendAutomateWave(runId, posts, 1, calP, outP, makeEl)
												);
											}
										});
									}
								});
							}
						});
					},
					{ keepGreen: true, resetBorderBeforeFlash: true }
				);
			});
		}
	});
}

/** Continue from automation_entry (Feb 8, first wave done): run send→automate loop from post 1. */
function runAutomationFromSecondPost() {
	const runId = introRunId;
	const posts = [...host.querySelectorAll('#calendar .calendar_animated_post')];
	const calP  = getCalendarToOutputsSvg();
	const outP  = getOutputsToPlatformsSvg();
	const makeEl = host.querySelector('#output_make');
	runFullSendAutomateWave(runId, posts, 1, calP, outP, makeEl);
}

/**
 * After website→inputs pipe finishes:
 * 1. Schedules panel fades in
 * 2. inputs→schedules line
 * 3. Calendar fades in
 * 4. schedules→calendar line
 * 5. Calendar post chips stagger in
 */
function runScheduleAndCalendarReveal() {
	const runId = introRunId;
	setTimelineActive('schedule_calendar');

	const pipeIn  = getInputsToSchedulesSvg();
	const pipeSch = getSchedulesToCalendarSvg();
	const posts   = host.querySelectorAll('#calendar .calendar_animated_post');

	const showPosts = () => {
		if (runId !== introRunId) return;
		gsap.to(posts, {
			opacity:    1,
			duration:   0.45,
			stagger:    0.5,
			ease:       'power2.out',
			onComplete: () => {
				if (runId !== introRunId) return;
				runPublishSequence();
			}
		});
	};

	gsap.to('#schedules', {
		opacity:    1,
		duration:   0.5,
		ease:       'power2.out',
		onComplete: () => {
			if (runId !== introRunId) return;
			const startInputsToSchedulesPipe = () => {
				if (runId !== introRunId) return;
				if (pipeIn) {
					animatePipeMaybe(pipeIn, 0, {
						onComplete: () => {
							if (runId !== introRunId) return;
							gsap.to(['#calendar', '#calendar .grid > div'], {
								opacity:    1,
								duration:   0.5,
								ease:       'power2.out',
								onComplete: () => {
									if (runId !== introRunId) return;
									if (pipeSch) {
										animatePipeMaybe(pipeSch, 0, { onComplete: showPosts });
									} else {
										showPosts();
									}
								}
							});
						}
					});
				} else {
					gsap.to(['#calendar', '#calendar .grid > div'], {
						opacity:    1,
						duration:   0.5,
						ease:       'power2.out',
						onComplete: () => {
							if (runId !== introRunId) return;
							if (pipeSch) animatePipeMaybe(pipeSch, 0, { onComplete: showPosts });
							else showPosts();
						}
					});
				}
			};

			flashBorderGreen(
				host.querySelector('#schedule_daily_inspiration'),
				startInputsToSchedulesPipe,
				{ keepGreen: true }
			);
		}
	});
}

/* Wired when mountResponsiveWorkflowAnimation(host) runs */
	function buildAndPlayIntroTimeline() {
		const runId = introRunId;
		setTimelineActive('website_posts');

		gsap.set('.website_post', { opacity: 0, y: 12 });
		syncClockFromState();

		const intro = gsap.timeline({ defaults: { ease: 'power2.out' } });

		intro.fromTo(
			'.post_one',
			{ opacity: 0, y: 12 },
			{ opacity: 1, y: 0, duration: 0.5 },
			0
		);

		intro.to(clockState, {
			t:          9 * 60 + 33,
			duration:   0.5,
			ease:       'none',
			onUpdate() {
				if (runId !== introRunId) return;
				syncClockFromState();
			}
		});
		intro.fromTo(
			'.post_two',
			{ opacity: 0, y: 12 },
			{ opacity: 1, y: 0, duration: 0.45 },
			'<'
		);

		intro.to(clockState, {
			t:          10 * 60 + 3,
			duration:   0.5,
			ease:       'none',
			onUpdate() {
				if (runId !== introRunId) return;
				syncClockFromState();
			}
		});
		intro.fromTo(
			'.post_three',
			{ opacity: 0, y: 12 },
			{ opacity: 1, y: 0, duration: 0.45 },
			'<'
		);

		intro.to(clockState, {
			t:          10 * 60 + 25,
			duration:   0.5,
			ease:       'none',
			onUpdate() {
				if (runId !== introRunId) return;
				syncClockFromState();
			}
		});
		intro.fromTo(
			'.post_four',
			{ opacity: 0, y: 12 },
			{ opacity: 1, y: 0, duration: 0.45 },
			'<'
		);

		intro.to(clockState, {
			t:          10 * 60 + 55,
			duration:   0.5,
			ease:       'none',
			onUpdate() {
				if (runId !== introRunId) return;
				syncClockFromState();
			}
		});
		intro.fromTo(
			'.post_five',
			{ opacity: 0, y: 12 },
			{ opacity: 1, y: 0, duration: 0.45 },
			'<'
		);

		intro.addLabel('afterPosts');

		intro.to(clockState, {
			t:          11 * 60,
			duration:   8,
			ease:       'none',
			onUpdate() {
				if (runId !== introRunId) return;
				syncClockFromState();
			}
		}, 'afterPosts');

		intro.call(
			() => {
				if (runId !== introRunId) return;
				setTimelineActive('import_data');
				fadeInInputsThenWebsiteToInputsPipe(runId, () => runScheduleAndCalendarReveal());
			},
			null,
			'afterPosts'
		);

		intro.play();
	}

	function playFromStage(stage) {
		resumeIntroIfPaused();
		abortIntroScene();
		const rid = introRunId;

		if (stage === 'website_posts') {
			applyCheckpoint('initial');
			if (rid !== introRunId) return;
			buildAndPlayIntroTimeline();
			return;
		}
		if (stage === 'import_data') {
			applyCheckpoint('after_posts');
			if (rid !== introRunId) return;
			setTimelineActive('import_data');
			fadeInInputsThenWebsiteToInputsPipe(rid, () => runScheduleAndCalendarReveal());
			return;
		}
		if (stage === 'schedule_calendar') {
			applyCheckpoint('after_import_pipe');
			if (rid !== introRunId) return;
			runScheduleAndCalendarReveal();
			return;
		}
		if (stage === 'send_webhook') {
			applyCheckpoint('calendar_ready');
			if (rid !== introRunId) return;
			runPublishSequence();
			return;
		}
		if (stage === 'run_automation') {
			applyCheckpoint('automation_entry');
			if (rid !== introRunId) return;
			runAutomationFromSecondPost();
		}
	}

	host.querySelectorAll('#timeline .timeline-btn').forEach((btn) => {
		btn.addEventListener('click', () => playFromStage(btn.dataset.stage));
	});

	const pauseToggle = host.querySelector('#intro_pause_toggle');
	if (pauseToggle) {
		pauseToggle.addEventListener('click', () => setIntroPaused(!introPaused));
		syncIntroPauseToggle();
	}

	applyIntroLayout({ force: true });

	const track = host.querySelector('#intro_slides_track');
	if (track) {
		let scrollEndTimer;
		track.addEventListener(
			'scroll',
			() => {
				if (getIntroLayoutKey() === 'xl') return;
				scheduleLayoutIntroPipesOverlay();
				window.clearTimeout(scrollEndTimer);
				scrollEndTimer = window.setTimeout(() => {
					if (introCarouselScrollSyncSuppressed) return;
					const w = track.clientWidth;
					if (w <= 0) return;
					const i = getIntroSlideIndexFromScroll(track);
					setTimelineActive(slideIndexToStage(i, getIntroLayoutKey()), { scroll: false });
					scheduleLayoutIntroPipesOverlay();
				}, 80);
			},
			{ passive: true }
		);
	}

	let resizeTimer;
	window.addEventListener('resize', () => {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			const before = introLayoutKey;
			const stage =
				host.querySelector('#timeline .timeline-btn.timeline-active')?.dataset.stage ||
				'website_posts';
			const keyNow = getIntroLayoutKey();
			if (keyNow !== before) {
				applyIntroLayout();
				playFromStage(stage);
			} else if (keyNow !== 'xl') {
				scrollIntroToStage(stage, { instant: true });
				scheduleLayoutIntroPipesOverlay();
			}
		}, 150);
	});

	gsap.delayedCall(0, () => playFromStage('website_posts'));

	}, host);

	return () => {
		ctx.revert();
	};
}
