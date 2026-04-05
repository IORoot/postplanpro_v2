// @ts-nocheck
/* Generated from static/animation.html — run: node scripts/build-workflow-animation-module.mjs */
import gsap from 'gsap';

/** GSAP workflow diagram; host element must contain #intro_animation and #timeline (see WorkflowAnimation.svelte). */
export function mountWorkflowAnimation(host: HTMLElement): () => void {
	let updateClockFloatState: () => void = () => {};
	const clockFloatMq = window.matchMedia('(max-width: 1279px)');

	const ctx = gsap.context(() => {
let introRunId = 0;

const clockState = { t: 9 * 60 };

function bumpIntroRunId() {
	introRunId += 1;
	return introRunId;
}

function syncClockFromState() {
	const timeEl = host.querySelector('#clock_time');
	if (timeEl) timeEl.textContent = formatClockFromTotalMinutes(clockState.t);
}

function setTimelineActive(stageId) {
	host.querySelectorAll('#timeline .timeline-btn').forEach((btn) => {
		btn.classList.toggle('timeline-active', btn.dataset.stage === stageId);
	});
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

function getPipeForViewport(desktopId, mobileId) {
	return window.matchMedia('(min-width: 1280px)').matches
		? host.querySelector('#' + desktopId)
				: host.querySelector('#' + mobileId);
}

function getWebsiteToInputsSvg() {
	return window.matchMedia('(min-width: 768px)').matches
		? host.querySelector('#website_to_inputs')
		: host.querySelector('#website_to_inputs_mobile');
}

function getInputsToSchedulesSvg() {
	return getPipeForViewport('inputs_to_schedules', 'inputs_to_schedules_mobile');
}

function getCalendarToOutputsSvg() {
	return getPipeForViewport('calendar_to_outputs', 'calendar_to_outputs_mobile');
}

function getOutputsToPlatformsSvg() {
	return window.matchMedia('(min-width: 768px)').matches
		? host.querySelector('#outputs_to_platforms')
		: host.querySelector('#outputs_to_platforms_mobile');
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
	resetPipeSvg(host.querySelector('#schedules_to_calendar'), true);
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
	const introAnimEl = host.querySelector('#intro_animation');
	if (introAnimEl) {
		gsap.killTweensOf(introAnimEl);
		introAnimEl.querySelectorAll('*').forEach((el) => gsap.killTweensOf(el));
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
			setTimeout(() => {
				if (runId !== introRunId) return;
				onComplete();
			}, STREAM_DUR * 1000);
		}

		const intervalId = setInterval(() => {
			if (runId !== introRunId) {
				clearInterval(intervalId);
				return;
			}
			if (performance.now() - startTime > STREAM_DUR * 1000) {
				clearInterval(intervalId);
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
				animatePipe(getWebsiteToInputsSvg(), 0, {
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

function pipeStreamPair(calSvg, outSvg, onDone) {
	const runId = introRunId;
	let n    = 0;
	const need = (calSvg ? 1 : 0) + (outSvg ? 1 : 0);
	if (need === 0) {
		onDone();
		return;
	}
	const gate = () => {
		if (runId !== introRunId) return;
		if (++n >= need) onDone();
	};
	if (calSvg) animatePipe(calSvg, 0, { streamOnly: true, onComplete: gate });
	if (outSvg) {
		animatePipe(outSvg, 0, {
			streamOnly:    true,
			onComplete:    gate,
			onStreamStart: flashPlatformBoxesInOrder
		});
	}
}

/** Milestone days for the five scheduled posts (Feb 1, 8, 15, 22, 29). */
const PUBLISH_DAYS = [1, 8, 15, 22, 29];

/**
 * After calendar chips are visible: Feb 1 full publish, then step days 1→8→15→22→29
 * with stream-only rounds on 8th, 15th, 22nd, 29th.
 */
function runPublishSequence() {
	const runId = introRunId;
	setTimelineActive('send_webhook');

	const posts  = [...host.querySelectorAll('#calendar .calendar_animated_post')];
	const calP   = getCalendarToOutputsSvg();
	const outP   = getOutputsToPlatformsSvg();
	const makeEl = host.querySelector('#output_make');

	applyCalendarDay(1);

	function runStreamRound(postIndex) {
		if (runId !== introRunId) return;
		if (postIndex >= posts.length) return;
		flashCalendarPostChip(posts[postIndex], () => {
			if (runId !== introRunId) return;
			pipeStreamPair(calP, outP, () => {
				if (runId !== introRunId) return;
				if (postIndex + 1 >= posts.length) return;
				advanceFebruaryDays(
					PUBLISH_DAYS[postIndex],
					PUBLISH_DAYS[postIndex + 1],
					() => runStreamRound(postIndex + 1)
				);
			});
		});
	}

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
						animatePipe(calP, 0, {
							onComplete: () => {
								if (runId !== introRunId) return;
								gsap.to('#platforms', {
									opacity:    1,
									duration:   0.5,
									ease:       'power2.out',
									onComplete: () => {
										if (runId !== introRunId) return;
										setTimelineActive('run_automation');
										animatePipe(outP, 0, {
											onDrawStart: flashPlatformBoxesInOrder,
											onComplete:  () => {
												if (runId !== introRunId) return;
												advanceFebruaryDays(1, 8, () => runStreamRound(1));
											}
										});
									}
								});
							}
						});
					},
					{ keepGreen: true }
				);
			});
		}
	});
}

/** Continue from Feb 8 stream round (checkpoint automation_entry is Feb 1 + first pipes done). */
function runAutomationFromSecondPost() {
	const runId = introRunId;
	setTimelineActive('run_automation');
	const posts = [...host.querySelectorAll('#calendar .calendar_animated_post')];
	const calP  = getCalendarToOutputsSvg();
	const outP  = getOutputsToPlatformsSvg();

	function runStreamRound(postIndex) {
		if (runId !== introRunId) return;
		if (postIndex >= posts.length) return;
		flashCalendarPostChip(posts[postIndex], () => {
			if (runId !== introRunId) return;
			pipeStreamPair(calP, outP, () => {
				if (runId !== introRunId) return;
				if (postIndex + 1 >= posts.length) return;
				advanceFebruaryDays(
					PUBLISH_DAYS[postIndex],
					PUBLISH_DAYS[postIndex + 1],
					() => runStreamRound(postIndex + 1)
				);
			});
		});
	}
	runStreamRound(1);
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
	const pipeSch = host.querySelector('#schedules_to_calendar');
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
					animatePipe(pipeIn, 0, {
						onComplete: () => {
							if (runId !== introRunId) return;
							gsap.to(['#calendar', '#calendar .grid > div'], {
								opacity:    1,
								duration:   0.5,
								ease:       'power2.out',
								onComplete: () => {
									if (runId !== introRunId) return;
									if (pipeSch) {
										animatePipe(pipeSch, 0, { onComplete: showPosts });
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
							if (pipeSch) animatePipe(pipeSch, 0, { onComplete: showPosts });
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

/* ── Wire up on DOM ready ───────────────────────────────── */
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

	gsap.delayedCall(0, () => playFromStage('website_posts'));

	/* Mobile: corner clock only mid–intro_animation; otherwise clock is hidden (never in-flow in the grid) */
	updateClockFloatState = () => {
		const clock = host.querySelector('#clock');
		const intro = host.querySelector('#intro_animation');
		if (!clock || !intro) return;
		if (!clockFloatMq.matches) {
			clock.classList.remove('clock--floating', 'clock--mobile-hidden');
			return;
		}
		const r = intro.getBoundingClientRect();
		const vh = window.innerHeight;
		const inView = r.bottom > 0 && r.top < vh;
		const reachedEnd = r.bottom <= vh + 2;
		if (inView && !reachedEnd) {
			clock.classList.add('clock--floating');
			clock.classList.remove('clock--mobile-hidden');
		} else {
			clock.classList.remove('clock--floating');
			clock.classList.add('clock--mobile-hidden');
		}
	};
	window.addEventListener('scroll', updateClockFloatState, { passive: true });
	window.addEventListener('resize', updateClockFloatState);
	clockFloatMq.addEventListener('change', updateClockFloatState);
	updateClockFloatState();
	gsap.delayedCall(0.05, updateClockFloatState);
	}, host);

	return () => {
		window.removeEventListener('scroll', updateClockFloatState);
		window.removeEventListener('resize', updateClockFloatState);
		clockFloatMq.removeEventListener('change', updateClockFloatState);
		ctx.revert();
	};
}
