<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { ruleColor } from '$lib/calendarColors.js';
	import RulePreviewCalendar from '$lib/components/RulePreviewCalendar.svelte';
	import { TAILWIND_POST_COLORS, normalizePostColor } from '$lib/postColors.js';
	import { previewSlotsForRule } from '$lib/scheduler/previewSlots.js';

	type Rule = {
		type: 'cron' | 'weekly' | 'daily' | 'monthly' | 'yearly' | 'interval' | 'once';
		config: Record<string, unknown>;
		start_at: string | null;
		end_at: string | null;
	};

	let { data, form } = $props();
	let rules = $state<Rule[]>([]);
	let slotCount = $state(0);
	let fieldCount = $state(0);
	let fieldIndices = $state<number[]>([]);
	let selectedPostIds = $state<Set<string>>(new Set());
	let useLegacySlots = $state(false);
	let postsFilterStatus = $state('');
	let postsFilterWebhook = $state('');
	let postsSearchTitle = $state('');
	let postsSortBy = $state<'created_at' | 'title' | 'webhook_name' | 'status'>('created_at');

	const postsList = $derived.by(() => {
		let list = [...(data.posts ?? [])];
		if (postsFilterStatus) list = list.filter((p) => p.status === postsFilterStatus);
		if (postsFilterWebhook) list = list.filter((p) => p.webhook_name === postsFilterWebhook);
		if (postsSearchTitle.trim()) {
			const q = postsSearchTitle.trim().toLowerCase();
			list = list.filter((p) => (p.title ?? '').toLowerCase().includes(q));
		}
		list.sort((a, b) => {
			switch (postsSortBy) {
				case 'title':
					return (a.title ?? '').localeCompare(b.title ?? '');
				case 'webhook_name':
					return (a.webhook_name ?? '').localeCompare(b.webhook_name ?? '');
				case 'status':
					return (a.status ?? '').localeCompare(b.status ?? '');
				case 'created_at':
				default:
					return (b.created_at ?? '').localeCompare(a.created_at ?? '');
			}
		});
		return list;
	});

	const uniqueWebhooks = $derived([...new Set((data.posts ?? []).map((p) => p.webhook_name).filter(Boolean))].sort());

	function selectAllPosts() {
		selectedPostIds = new Set(postsList.map((p) => p.id));
	}
	function selectNonePosts() {
		selectedPostIds = new Set();
	}
	const scheduleColor = $derived(normalizePostColor(data.schedule?.color) ?? TAILWIND_POST_COLORS[0]);
	let selectedColor = $state<string>(TAILWIND_POST_COLORS[0]);
	let hexColorInput = $state<string>(TAILWIND_POST_COLORS[0]);
	$effect(() => {
		selectedColor = scheduleColor;
		hexColorInput = scheduleColor;
	});

	const DAYS = [
		{ value: 0, label: 'Sunday' },
		{ value: 1, label: 'Monday' },
		{ value: 2, label: 'Tuesday' },
		{ value: 3, label: 'Wednesday' },
		{ value: 4, label: 'Thursday' },
		{ value: 5, label: 'Friday' },
		{ value: 6, label: 'Saturday' }
	];
	const INTERVAL_UNITS = [
		{ value: 'seconds', label: 'seconds' },
		{ value: 'minutes', label: 'minutes' },
		{ value: 'hours', label: 'hours' },
		{ value: 'days', label: 'days' }
	];
	const MONTHS = [
		{ value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' }, { value: 4, label: 'April' },
		{ value: 5, label: 'May' }, { value: 6, label: 'June' }, { value: 7, label: 'July' }, { value: 8, label: 'August' },
		{ value: 9, label: 'September' }, { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
	];
	const DAY_NUMBERS = Array.from({ length: 31 }, (_, j) => ({ value: j + 1, label: String(j + 1) }));

	$effect(() => {
		const r = data.rules ?? [];
		if (r.length > 0 && rules.length === 0) {
			rules = r.map((row: { type: string; config: string; start_at: string | null; end_at: string | null }) => ({
				type: row.type as Rule['type'],
				config: (typeof row.config === 'string' ? JSON.parse(row.config || '{}') : row.config) as Record<string, unknown>,
				start_at: row.start_at,
				end_at: row.end_at
			}));
		}
		const n = data.slots?.length ?? 0;
		const f = data.fields?.length ?? 0;
		if (n > slotCount) slotCount = n;
		if (f > fieldCount) fieldCount = f;
		if (fieldIndices.length === 0 && f > 0) {
			fieldIndices = Array.from({ length: f }, (_, i) => i);
		}
		if (slotCount === 0 && n === 0 && rules.length === 0) slotCount = 1;
	});

	function rulesJson(): string {
		return JSON.stringify(
			rules.map((r) => ({
				type: r.type,
				config: r.config,
				start_at: r.start_at && r.start_at.trim() ? r.start_at.trim() : null,
				end_at: r.end_at && r.end_at.trim() ? r.end_at.trim() : null
			}))
		);
	}

	function addRule() {
		rules = [
			...rules,
			{ type: 'daily', config: { time: '09:00' }, start_at: null, end_at: null }
		];
	}

	function removeRule(i: number) {
		rules = rules.filter((_, idx) => idx !== i);
	}

	function updateRuleConfig(i: number, key: string, value: unknown) {
		rules = rules.map((r, idx) => (idx === i ? { ...r, config: { ...r.config, [key]: value } } : r));
	}

	function togglePost(id: string) {
		const next = new Set(selectedPostIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedPostIds = next;
	}

	function addField() {
		const nextIndex = fieldIndices.length > 0 ? Math.max(...fieldIndices) + 1 : 0;
		fieldIndices = [...fieldIndices, nextIndex];
		fieldCount = fieldIndices.length;
	}

	function removeField(index: number) {
		fieldIndices = fieldIndices.filter((i) => i !== index);
		fieldCount = fieldIndices.length;
	}

	/**
	 * Convert a UTC ISO string (with or without Z) to a "YYYY-MM-DDTHH:MM" string
	 * in the browser's local timezone, suitable for datetime-local inputs.
	 */
	function isoToLocalInputValue(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	let copyFeedback = $state(false);
	async function copyScheduleId() {
		const id = data.schedule?.id;
		if (!id) return;
		try {
			await navigator.clipboard.writeText(id);
			copyFeedback = true;
			setTimeout(() => (copyFeedback = false), 2000);
		} catch {
			// ignore
		}
	}
</script>

<svelte:head>
	<title>Edit: {data.schedule.name} – PostPlan</title>
</svelte:head>

<div class="w-full">
	<form method="POST" action="?/update" use:enhance class="space-y-4">
				{#if form?.error}
					<p class="rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
				{/if}

				<input type="hidden" name="rules_json" value={rules.length > 0 ? rulesJson() : ''} />


				<PageSectionHeading title="Edit schedule">
					{#snippet trail()}
						<button
							type="button"
							onclick={copyScheduleId}
							class="cursor-pointer rounded border border-[var(--border)] px-2 py-1.5 font-mono text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
							title="Copy schedule ID"
						>
							{#if copyFeedback}
								Copied!
							{:else}
								{data.schedule.id}
							{/if}
						</button>
					{/snippet}
				</PageSectionHeading>

				<div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
					<div class="min-w-0">
						<div class="mt-6">
							<label for="name" class="block text-sm font-medium text-[var(--text)]">Name *</label>
							<input id="name" type="text" name="name" value={data.schedule.name} required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
						</div>
						<div class="mt-4">
							<label for="description" class="block text-sm font-medium text-[var(--text)]">Description</label>
							<textarea id="description" name="description" rows="2" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">{data.schedule.description ?? ''}</textarea>
						</div>
						<div class="mt-4">
							<p class="block text-sm font-medium text-[var(--text)]">Schedule colour</p>
							<p class="mt-0.5 text-xs text-[var(--text-muted)]">Posts assigned to this schedule will use this colour.</p>
							<div class="mt-2 flex flex-wrap gap-2">
								{#each TAILWIND_POST_COLORS as color}
									<button
										type="button"
										onclick={() => { selectedColor = color; hexColorInput = color; }}
										class="h-8 w-8 rounded border-2 transition {selectedColor === color ? 'border-[var(--text)]' : 'border-[var(--border)]'}"
										style={`background-color: ${color};`}
										title={color}
										aria-label={`Pick ${color}`}
									></button>
								{/each}
							</div>
							<div class="mt-2 flex items-center gap-2">
								<input
									type="color"
									value={hexColorInput}
									oninput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; hexColorInput = v; selectedColor = normalizePostColor(v) ?? selectedColor; }}
									class="h-10 w-14 rounded border border-[var(--border)] bg-[var(--surface)]"
									aria-label="Pick custom colour"
								/>
								<input
									type="text"
									value={hexColorInput}
									oninput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; hexColorInput = v; selectedColor = normalizePostColor(v) ?? selectedColor; }}
									placeholder="#aabbcc"
									class="w-32 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
								/>
								<span class="inline-block h-4 w-4 rounded border border-[var(--border)]" style={`background-color: ${selectedColor};`}></span>
							</div>
							<input type="hidden" name="color" value={selectedColor} />
						</div>
					</div>
					<div class="min-w-0">
						<div class="lg:sticky lg:top-6">
							<p class="mb-2 text-sm font-medium text-[var(--text)]">Schedule preview</p>
							<RulePreviewCalendar
								slotSeries={rules.length > 0 ? rules.map((r) => previewSlotsForRule(r, undefined, 365)) : []}
								weeks={6}
								fullWidth={true}
								showMonthNav={true}
							/>
						</div>
					</div>
				</div>

	<!-- Recurring rules -->
	<div class="mt-8">
		<h2 class="text-lg font-semibold text-[var(--text)]">Recurring rules</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Add multiple rules; slots are merged and sorted. Start = immediately if empty; End = forever if empty.</p>
		<div class="mt-4 space-y-6">
			{#each rules as rule, i}
				<div
					class="rounded-xl border border-[var(--border)] border-l-4 bg-[var(--surface)] shadow-sm overflow-hidden"
					style="border-left-color: {ruleColor(i)}"
				>
					<div class="border-b border-[var(--border)] bg-[var(--surface-hover)]/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
						<span class="text-sm font-semibold text-[var(--text)]">Rule {i + 1}</span>
						<div class="flex flex-wrap items-center gap-2">
							<label for="rule-type-{i}" class="sr-only">Rule type</label>
							<select
								id="rule-type-{i}"
								class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-medium text-[var(--text)] min-h-[40px]"
								onchange={(e) => {
									const t = (e.currentTarget.value as Rule['type']);
									rules = rules.map((r, idx) =>
										idx === i
											? {
													type: t,
													config:
														t === 'cron'
															? { expression: '0 9 * * 1-5' }
															: t === 'weekly'
																? { dayOfWeek: 1, time: '09:00' }
																: t === 'daily'
																	? { time: '09:00' }
																	: t === 'monthly'
																		? { dayOfMonth: 1, time: '09:00' }
																		: t === 'yearly'
																			? { month: 1, dayOfMonth: 1, time: '09:00' }
																			: t === 'interval'
																				? { amount: 6, unit: 'hours' }
																				: { at: new Date().toISOString().slice(0, 16) },
													start_at: r.start_at,
													end_at: r.end_at
												}
											: r
									);
								}}
							>
								<option value="cron" selected={rule.type === 'cron'}>CRON notation</option>
								<option value="daily" selected={rule.type === 'daily'}>Daily</option>
								<option value="weekly" selected={rule.type === 'weekly'}>Weekly</option>
								<option value="monthly" selected={rule.type === 'monthly'}>Monthly</option>
								<option value="yearly" selected={rule.type === 'yearly'}>Yearly</option>
								<option value="interval" selected={rule.type === 'interval'}>Interval</option>
								<option value="once" selected={rule.type === 'once'}>Once</option>
							</select>
							<button type="button" onclick={() => removeRule(i)} class="rounded-lg border border-red-400/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/60 dark:bg-red-950/30 dark:text-red-300 min-h-[40px] hover:bg-red-100 dark:hover:bg-red-950/50" aria-label="Remove rule">Remove</button>
						</div>
					</div>

					<div class="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
						<div class="md:col-span-3 space-y-4 min-w-0">
							<div>
								<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Configuration</p>
								<div class="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
					{#if rule.type === 'cron'}
						<div>
							<label for="rule-{i}-cron" class="block text-sm font-medium text-[var(--text-muted)]">CRON expression</label>
							<p class="mt-0.5 text-xs text-[var(--text-muted)]">e.g. 0 18 * * 6 = Saturday 6pm</p>
							<input
								id="rule-{i}-cron"
								type="text"
								value={(rule.config.expression as string) ?? ''}
								oninput={(e) => updateRuleConfig(i, 'expression', e.currentTarget.value)}
								placeholder="0 18 * * 6"
								class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
							/>
						</div>
					{:else if rule.type === 'daily'}
						<div>
							<label for="rule-{i}-daily-time" class="block text-sm font-medium text-[var(--text-muted)]">Time</label>
							<input
								id="rule-{i}-daily-time"
								type="time"
								value={(rule.config.time as string) ?? '09:00'}
								oninput={(e) => updateRuleConfig(i, 'time', e.currentTarget.value)}
								class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
							/>
						</div>
					{:else if rule.type === 'weekly'}
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="rule-{i}-weekly-day" class="block text-sm font-medium text-[var(--text-muted)]">Day of week</label>
								<select
									id="rule-{i}-weekly-day"
									class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
									value={String(rule.config.dayOfWeek ?? 0)}
									onchange={(e) => updateRuleConfig(i, 'dayOfWeek', parseInt(e.currentTarget.value, 10))}
								>
									{#each DAYS as d}
										<option value={String(d.value)}>{d.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="rule-{i}-weekly-time" class="block text-sm font-medium text-[var(--text-muted)]">Time</label>
								<input
									id="rule-{i}-weekly-time"
									type="time"
									value={(rule.config.time as string) ?? '09:00'}
									oninput={(e) => updateRuleConfig(i, 'time', e.currentTarget.value)}
									class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
								/>
							</div>
						</div>
					{:else if rule.type === 'monthly'}
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="rule-{i}-monthly-day" class="block text-sm font-medium text-[var(--text-muted)]">Day of month</label>
								<select
									id="rule-{i}-monthly-day"
									class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
									value={String(Math.min(31, Math.max(1, Number(rule.config.dayOfMonth) || 1)))}
									onchange={(e) => updateRuleConfig(i, 'dayOfMonth', parseInt(e.currentTarget.value, 10))}
								>
									{#each DAY_NUMBERS as d}
										<option value={String(d.value)}>{d.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="rule-{i}-monthly-time" class="block text-sm font-medium text-[var(--text-muted)]">Time</label>
								<input
									id="rule-{i}-monthly-time"
									type="time"
									value={(rule.config.time as string) ?? '09:00'}
									oninput={(e) => updateRuleConfig(i, 'time', e.currentTarget.value)}
									class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
								/>
							</div>
						</div>
					{:else if rule.type === 'yearly'}
						<div class="grid gap-4 sm:grid-cols-3">
							<div>
								<label for="rule-{i}-yearly-month" class="block text-sm font-medium text-[var(--text-muted)]">Month</label>
								<select
									id="rule-{i}-yearly-month"
									class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
									value={String(Math.min(12, Math.max(1, Number(rule.config.month) || 1)))}
									onchange={(e) => updateRuleConfig(i, 'month', parseInt(e.currentTarget.value, 10))}
								>
									{#each MONTHS as m}
										<option value={String(m.value)}>{m.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="rule-{i}-yearly-day" class="block text-sm font-medium text-[var(--text-muted)]">Day</label>
								<select
									id="rule-{i}-yearly-day"
									class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
									value={String(Math.min(31, Math.max(1, Number(rule.config.dayOfMonth) || 1)))}
									onchange={(e) => updateRuleConfig(i, 'dayOfMonth', parseInt(e.currentTarget.value, 10))}
								>
									{#each DAY_NUMBERS as d}
										<option value={String(d.value)}>{d.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="rule-{i}-yearly-time" class="block text-sm font-medium text-[var(--text-muted)]">Time</label>
								<input
									id="rule-{i}-yearly-time"
									type="time"
									value={(rule.config.time as string) ?? '09:00'}
									oninput={(e) => updateRuleConfig(i, 'time', e.currentTarget.value)}
									class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
								/>
							</div>
						</div>
					{:else if rule.type === 'interval'}
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="rule-{i}-interval-amount" class="block text-sm font-medium text-[var(--text-muted)]">Every</label>
								<input
									id="rule-{i}-interval-amount"
									type="number"
									min="1"
									value={Number(rule.config.amount ?? 1)}
									oninput={(e) => updateRuleConfig(i, 'amount', parseInt(e.currentTarget.value, 10) || 1)}
									class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
								/>
							</div>
							<div>
								<label for="rule-{i}-interval-unit" class="block text-sm font-medium text-[var(--text-muted)]">Period</label>
								<select
									id="rule-{i}-interval-unit"
									class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
									value={String(rule.config.unit ?? 'hours')}
									onchange={(e) => updateRuleConfig(i, 'unit', e.currentTarget.value)}
								>
									{#each INTERVAL_UNITS as u}
										<option value={u.value}>{u.label}</option>
									{/each}
								</select>
							</div>
						</div>
					{:else if rule.type === 'once'}
						<div>
							<label for="rule-{i}-once" class="block text-sm font-medium text-[var(--text-muted)]">Date and time</label>
							<input
								id="rule-{i}-once"
								type="datetime-local"
								value={isoToLocalInputValue(rule.config.at as string)}
								oninput={(e) => updateRuleConfig(i, 'at', e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : '')}
								class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
							/>
						</div>
					{/if}
								</div>
							</div>

							<div>
								<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Active period</p>
								<p class="mb-2 text-xs text-[var(--text-muted)]">Leave empty for “from now” and “forever”.</p>
								<div class="grid gap-4 sm:grid-cols-2">
									<div>
										<label for="rule-{i}-start" class="block text-sm font-medium text-[var(--text-muted)]">Start (empty = immediately)</label>
										<input
											id="rule-{i}-start"
											type="datetime-local"
											value={isoToLocalInputValue(rule.start_at)}
											oninput={(e) => {
												rules = rules.map((r, idx) => (idx === i ? { ...r, start_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null } : r));
											}}
											class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
										/>
									</div>
									<div>
										<label for="rule-{i}-end" class="block text-sm font-medium text-[var(--text-muted)]">End (empty = forever)</label>
										<input
											id="rule-{i}-end"
											type="datetime-local"
											value={isoToLocalInputValue(rule.end_at)}
											oninput={(e) => {
												rules = rules.map((r, idx) => (idx === i ? { ...r, end_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null } : r));
											}}
											class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
										/>
									</div>
								</div>
							</div>
						</div>

						<div class="md:col-span-1 flex flex-col items-start">
							<p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Preview</p>
							<div class="w-full">
								<RulePreviewCalendar
									slots={previewSlotsForRule(rule)}
									accentColor={ruleColor(i)}
									fullWidth={true}
									compact={true}
									showMonthNav={true}
								/>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
		<button type="button" onclick={addRule} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add rule</button>
	</div>

	<!-- Legacy fixed slots (when no rules) -->
	{#if rules.length === 0}
		<div>
			<p class="text-sm font-medium text-[var(--text)]">Fixed slots (or add rules above)</p>
			<div class="mt-2 space-y-2">
				{#each Array(slotCount) as _, j}
					<div>
						<label for="slot_{j}" class="sr-only">Slot {j + 1}</label>
						<input
							id="slot_{j}"
							type="datetime-local"
							name="slot_{j}"
							value={data.slots[j] ? new Date(data.slots[j].scheduled_at).toISOString().slice(0, 16) : ''}
							class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]"
						/>
					</div>
				{/each}
			</div>
			<button type="button" onclick={() => slotCount++} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add slot</button>
		</div>
	{/if}

	<!-- Schedule custom fields -->
	<section class="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm" aria-labelledby="custom-fields-heading">
		<h2 id="custom-fields-heading" class="text-lg font-semibold text-[var(--text)]">Schedule custom fields</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Key/value pairs merged into each post when this schedule is applied. Optional.</p>
		<div class="mt-4 space-y-3">
			{#each fieldIndices as idx, k}
				<div class="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
					<input
						type="text"
						name="field_key_{idx}"
						placeholder="Key"
						value={data.fields[idx]?.key ?? ''}
						class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-w-[100px] min-h-[44px]"
					/>
					<select name="field_type_{idx}" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
						<option value="string" selected={data.fields[idx]?.type === 'string'}>string</option>
						<option value="number" selected={data.fields[idx]?.type === 'number'}>number</option>
						<option value="boolean" selected={data.fields[idx]?.type === 'boolean'}>boolean</option>
						<option value="json" selected={data.fields[idx]?.type === 'json'}>json</option>
					</select>
					<input
						type="text"
						name="field_value_{idx}"
						placeholder="Value"
						value={data.fields[idx]?.value ?? ''}
						class="flex-1 min-w-[120px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]"
					/>
					<button
						type="button"
						class="rounded-lg border border-red-400/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/60 dark:bg-red-950/30 dark:text-red-300 min-h-[40px] hover:bg-red-100 dark:hover:bg-red-950/50"
						onclick={() => removeField(idx)}
						aria-label="Remove field"
					>
						Remove
					</button>
				</div>
			{/each}
		</div>
		<button type="button" onclick={addField} class="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add field</button>
	</section>

				<div class="flex gap-2 pt-6">
					<button type="submit" class="btn-primary btn-touch text-white shadow-sm">Save schedule</button>
					<a href="/schedules" class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center">Cancel</a>
				</div>
			</form>

			<!-- Apply to posts -->
			<section class="mt-10 border-t border-[var(--border)] pt-8">
				<h2 class="text-lg font-medium text-[var(--text)]">Apply schedule to posts</h2>
				<p class="mt-1 text-sm text-[var(--text-muted)]">Select posts; the first selected gets the first generated slot, and so on. Schedule custom fields are merged into each post.</p>

				<form method="POST" action="?/applySchedule" use:enhance={() => () => invalidateAll()} class="mt-4">
					<input type="hidden" name="post_ids" value={[...selectedPostIds].join(',')} />
					<div class="mt-4 flex flex-wrap items-center gap-3">
						<button type="button" onclick={selectAllPosts} class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[40px]">Select all</button>
						<button type="button" onclick={selectNonePosts} class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[40px]">Select none</button>
					</div>
					<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div>
							<label for="posts_search" class="block text-xs font-medium text-[var(--text-muted)]">Search title</label>
							<input id="posts_search" type="text" bind:value={postsSearchTitle} placeholder="Filter by title…" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] min-h-[40px]" />
						</div>
						<div>
							<label for="posts_filter_status" class="block text-xs font-medium text-[var(--text-muted)]">Status</label>
							<select id="posts_filter_status" bind:value={postsFilterStatus} class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] min-h-[40px]">
								<option value="">All</option>
								<option value="draft">Draft</option>
								<option value="scheduled">Scheduled</option>
								<option value="sent">Sent</option>
								<option value="failed">Failed</option>
							</select>
						</div>
						<div>
							<label for="posts_filter_webhook" class="block text-xs font-medium text-[var(--text-muted)]">Webhook</label>
							<select id="posts_filter_webhook" bind:value={postsFilterWebhook} class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] min-h-[40px]">
								<option value="">All</option>
								{#each uniqueWebhooks as w}
									<option value={w}>{w}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="posts_sort" class="block text-xs font-medium text-[var(--text-muted)]">Sort by</label>
							<select id="posts_sort" bind:value={postsSortBy} class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] min-h-[40px]">
								<option value="created_at">Date imported</option>
								<option value="title">Title</option>
								<option value="webhook_name">Webhook</option>
								<option value="status">Status</option>
							</select>
						</div>
					</div>
					<div class="mt-3 space-y-2 max-h-64 overflow-y-auto rounded border border-[var(--border)] bg-[var(--surface)] p-3">
						{#each postsList as post}
							<label class="flex min-h-[44px] cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-[var(--surface-hover)]">
								<input type="checkbox" checked={selectedPostIds.has(post.id)} onchange={() => togglePost(post.id)} class="h-4 w-4 shrink-0 rounded border-[var(--border)]" />
								<span class="min-w-0 flex-1 font-medium text-[var(--text)] truncate" title={post.title}>{post.title || 'Untitled'}</span>
								<span class="shrink-0 text-xs text-[var(--text-muted)]">{post.webhook_name}</span>
								<span class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium status-{post.status}">{post.status}</span>
								<span class="shrink-0 text-xs text-[var(--text-muted)]">{post.created_at ? new Date(post.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
							</label>
						{/each}
					</div>
					{#if (data.posts?.length ?? 0) === 0}
						<p class="mt-2 text-sm text-[var(--text-muted)]">No posts yet. <a href="/posts/new" class="text-[var(--primary)] underline">Create posts</a> first.</p>
					{:else if postsList.length === 0}
						<p class="mt-2 text-sm text-[var(--text-muted)]">No posts match the current filters. Adjust search, status, or webhook.</p>
					{:else}
						<button type="submit" class="mt-3 rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white min-h-[44px]" disabled={selectedPostIds.size === 0}>
							Apply to {selectedPostIds.size} post(s)
						</button>
					{/if}
				</form>
				{#if form?.applied}
					<p class="mt-2 rounded-lg px-3 py-2 text-sm alert-success">Schedule applied to {form.count} post(s).</p>
				{/if}
				{#if form?.error && form?.error !== 'Name is required' && form?.action === 'apply'}
					<p class="mt-2 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
				{/if}
			</section>

			<!-- Reschedule posts on this schedule -->
			<section class="mt-8 border-t border-[var(--border)] pt-8">
				<h2 class="text-lg font-medium text-[var(--text)]">Reschedule posts</h2>
				<p class="mt-1 text-sm text-[var(--text-muted)]">Reassign all posts attached to this schedule to the next available slots using the current rules. Use this after adding or changing rules.</p>
				{#if data.schedulePosts.length > 0}
					<form method="POST" action="?/reschedulePosts" use:enhance={() => () => invalidateAll()} class="mt-4">
						<p class="text-sm text-[var(--text-muted)]">{data.schedulePosts.length} post(s) use this schedule.</p>
						<button type="submit" class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">
							Reschedule all
						</button>
					</form>
					{#if form?.rescheduled}
						<p class="mt-2 rounded-lg px-3 py-2 text-sm alert-success">Rescheduled {form.count} post(s) to the new slots.</p>
					{/if}
					{#if form?.error && form?.action === 'reschedule'}
						<p class="mt-2 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
					{/if}
				{:else}
					<p class="mt-2 text-sm text-[var(--text-muted)]">No posts are attached to this schedule. Apply the schedule to posts above first.</p>
				{/if}
			</section>
</div>
