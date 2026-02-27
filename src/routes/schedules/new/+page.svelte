<script lang="ts">
	import { enhance } from '$app/forms';
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

	let { form } = $props();
	let rules = $state<Rule[]>([]);
	let slotCount = $state(1);
	let fieldCount = $state(0);
	let fieldIndices = $state<number[]>([]);
	let selectedColor = $state<string>(TAILWIND_POST_COLORS[0]);
	let hexColorInput = $state<string>(TAILWIND_POST_COLORS[0]);

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
		rules = [...rules, { type: 'daily', config: { time: '09:00' }, start_at: null, end_at: null }];
	}

	function removeRule(i: number) {
		rules = rules.filter((_, idx) => idx !== i);
	}

	function updateRuleConfig(i: number, key: string, value: unknown) {
		rules = rules.map((r, idx) => (idx === i ? { ...r, config: { ...r.config, [key]: value } } : r));
	}

function getCronParts(expr: string | undefined): string[] {
	const fallback = (expr && expr.trim().length ? expr : '0 9 * * *').trim().split(/\s+/);
	const parts = [...fallback];
	while (parts.length < 5) parts.push('*');
	return parts.slice(0, 5);
}

function setCronPart(ruleIndex: number, partIndex: number, value: string) {
	const current = rules[ruleIndex]?.config.expression as string | undefined;
	const parts = getCronParts(current);
	parts[partIndex] = value.trim() || '*';
	updateRuleConfig(ruleIndex, 'expression', parts.join(' '));
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
	function chooseColor(color: string) {
		selectedColor = color;
		hexColorInput = color;
	}
	function onHexColorInput(value: string) {
		hexColorInput = value;
		selectedColor = normalizePostColor(value) ?? selectedColor;
	}
</script>

<svelte:head>
	<title>New schedule – PostPlan</title>
</svelte:head>

<h1 class="text-2xl font-bold text-[var(--text)]">New schedule</h1>

<div class="content-card mt-6 max-w-4xl rounded-xl p-6 shadow-sm">
	<form method="POST" action="?/create" use:enhance class="space-y-4">
	{#if form?.error}
		<p class="rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
	{/if}

	<input type="hidden" name="rules_json" value={rules.length > 0 ? rulesJson() : ''} />

	<div class="w-full">
		<p class="mb-2 text-xs font-medium text-[var(--text-muted)]">Schedule preview</p>
		<RulePreviewCalendar
			slotSeries={rules.length > 0 ? rules.map((r) => previewSlotsForRule(r, undefined, 365)) : []}
			weeks={6}
			fullWidth={true}
			showMonthNav={true}
		/>
	</div>

	<div>
		<label for="name" class="block text-sm font-medium text-[var(--text)]">Name *</label>
		<input id="name" type="text" name="name" required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
	</div>
	<div>
		<label for="description" class="block text-sm font-medium text-[var(--text)]">Description</label>
		<textarea id="description" name="description" rows="2" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"></textarea>
	</div>
	<div>
		<p class="block text-sm font-medium text-[var(--text)]">Schedule colour</p>
		<p class="mt-0.5 text-xs text-[var(--text-muted)]">Posts assigned to this schedule will use this colour.</p>
		<div class="mt-2 flex flex-wrap gap-2">
			{#each TAILWIND_POST_COLORS as color}
				<button
					type="button"
					onclick={() => chooseColor(color)}
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
				oninput={(e) => onHexColorInput((e.currentTarget as HTMLInputElement).value)}
				class="h-10 w-14 rounded border border-[var(--border)] bg-[var(--surface)]"
				aria-label="Pick custom colour"
			/>
			<input
				type="text"
				value={hexColorInput}
				oninput={(e) => onHexColorInput((e.currentTarget as HTMLInputElement).value)}
				placeholder="#aabbcc"
				class="w-32 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
			/>
			<span class="inline-block h-4 w-4 rounded border border-[var(--border)]" style={`background-color: ${selectedColor};`}></span>
		</div>
		<input type="hidden" name="color" value={selectedColor} />
	</div>

	<!-- Recurring rules -->
	<div>
		<p class="text-sm font-medium text-[var(--text)]">Recurring rules</p>
		<p class="text-xs text-[var(--text-muted)]">Add rules (CRON, weekly, daily, interval, or once). Start = immediately if empty; End = forever if empty. Or use fixed slots below.</p>
		<div class="mt-3 space-y-4">
			{#each rules as rule, i}
				<div
					class="rounded-lg border border-[var(--border)] border-l-4 bg-[var(--surface)] p-4"
					style="border-left-color: {ruleColor(i)}"
				>
					<div class="mb-3 flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1 flex flex-wrap items-center gap-2">
							<select
							class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] min-h-[44px]"
							onchange={(e) => {
								const t = e.currentTarget.value as Rule['type'];
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
							<button type="button" onclick={() => removeRule(i)} class="rounded border border-red-400 px-2 py-1 text-sm text-red-800 dark:border-red-500 dark:text-red-200 min-h-[44px]">Remove</button>
						</div>
						<div class="shrink-0">
							<RulePreviewCalendar
								slots={previewSlotsForRule(rule)}
								weeks={6}
								accentColor={ruleColor(i)}
							/>
						</div>
					</div>
					{#if rule.type === 'cron'}
						{@const cronParts = getCronParts(rule.config.expression as string)}
						<p class="text-xs font-medium text-[var(--text-muted)]">CRON notation</p>
						<p class="mt-0.5 text-[10px] text-[var(--text-muted)]">Minute, Hour, Day of month, Month, Day of week</p>
						<div class="mt-2 grid gap-2 sm:grid-cols-5">
							<div>
								<label for="rule-{i}-cron-min" class="block text-[10px] font-medium text-[var(--text-muted)]">Minute</label>
								<input
									id="rule-{i}-cron-min"
									type="text"
									value={cronParts[0]}
									oninput={(e) => setCronPart(i, 0, e.currentTarget.value)}
									placeholder="0"
									class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] min-h-[36px]"
								/>
							</div>
							<div>
								<label for="rule-{i}-cron-hour" class="block text-[10px] font-medium text-[var(--text-muted)]">Hour</label>
								<input
									id="rule-{i}-cron-hour"
									type="text"
									value={cronParts[1]}
									oninput={(e) => setCronPart(i, 1, e.currentTarget.value)}
									placeholder="9"
									class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] min-h-[36px]"
								/>
							</div>
							<div>
								<label for="rule-{i}-cron-dom" class="block text-[10px] font-medium text-[var(--text-muted)]">Day of month</label>
								<input
									id="rule-{i}-cron-dom"
									type="text"
									value={cronParts[2]}
									oninput={(e) => setCronPart(i, 2, e.currentTarget.value)}
									placeholder="*"
									class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] min-h-[36px]"
								/>
							</div>
							<div>
								<label for="rule-{i}-cron-mon" class="block text-[10px] font-medium text-[var(--text-muted)]">Month</label>
								<input
									id="rule-{i}-cron-mon"
									type="text"
									value={cronParts[3]}
									oninput={(e) => setCronPart(i, 3, e.currentTarget.value)}
									placeholder="*"
									class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] min-h-[36px]"
								/>
							</div>
							<div>
								<label for="rule-{i}-cron-dow" class="block text-[10px] font-medium text-[var(--text-muted)]">Day of week</label>
								<input
									id="rule-{i}-cron-dow"
									type="text"
									value={cronParts[4]}
									oninput={(e) => setCronPart(i, 4, e.currentTarget.value)}
									placeholder="1-5"
									class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--text)] min-h-[36px]"
								/>
							</div>
						</div>
						<p class="mt-1 text-[10px] text-[var(--text-muted)]">Example: <code class="rounded bg-[var(--surface)] px-1">0 18 * * 6</code> = Saturday at 18:00.</p>
					{:else if rule.type === 'daily'}
						<label for="rule-{i}-daily-time" class="block text-xs font-medium text-[var(--text-muted)]">Time</label>
						<input
							id="rule-{i}-daily-time"
							type="time"
							value={(rule.config.time as string) ?? '09:00'}
							oninput={(e) => updateRuleConfig(i, 'time', e.currentTarget.value)}
							class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
						/>
					{:else if rule.type === 'weekly'}
						<div class="flex flex-wrap gap-3">
							<div>
								<label for="rule-{i}-weekly-day" class="block text-xs font-medium text-[var(--text-muted)]">Day</label>
								<select
									id="rule-{i}-weekly-day"
									class="mt-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
									value={String(rule.config.dayOfWeek ?? 0)}
									onchange={(e) => updateRuleConfig(i, 'dayOfWeek', parseInt(e.currentTarget.value, 10))}
								>
									{#each DAYS as d}
										<option value={String(d.value)}>{d.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="rule-{i}-weekly-time" class="block text-xs font-medium text-[var(--text-muted)]">Time</label>
								<input
									id="rule-{i}-weekly-time"
									type="time"
									value={(rule.config.time as string) ?? '09:00'}
									oninput={(e) => updateRuleConfig(i, 'time', e.currentTarget.value)}
									class="mt-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
								/>
							</div>
						</div>
					{:else if rule.type === 'monthly'}
						<div class="flex flex-wrap gap-3">
							<div>
								<label for="rule-{i}-monthly-day" class="block text-xs font-medium text-[var(--text-muted)]">Day of month</label>
								<select
									id="rule-{i}-monthly-day"
									class="mt-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
									value={String(rule.config.dayOfMonth ?? 1)}
									onchange={(e) => updateRuleConfig(i, 'dayOfMonth', parseInt(e.currentTarget.value, 10))}
								>
									{#each DAY_NUMBERS as d}
										<option value={d.value}>{d.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="rule-{i}-monthly-time" class="block text-xs font-medium text-[var(--text-muted)]">Time</label>
								<input
									id="rule-{i}-monthly-time"
									type="time"
									value={(rule.config.time as string) ?? '09:00'}
									oninput={(e) => updateRuleConfig(i, 'time', e.currentTarget.value)}
									class="mt-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
								/>
							</div>
						</div>
					{:else if rule.type === 'yearly'}
						<div class="flex flex-wrap gap-3">
							<div>
								<label for="rule-{i}-yearly-month" class="block text-xs font-medium text-[var(--text-muted)]">Month</label>
								<select
									id="rule-{i}-yearly-month"
									class="mt-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
									value={String(rule.config.month ?? 1)}
									onchange={(e) => updateRuleConfig(i, 'month', parseInt(e.currentTarget.value, 10))}
								>
									{#each MONTHS as m}
										<option value={m.value}>{m.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="rule-{i}-yearly-day" class="block text-xs font-medium text-[var(--text-muted)]">Day</label>
								<select
									id="rule-{i}-yearly-day"
									class="mt-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
									value={String(rule.config.dayOfMonth ?? 1)}
									onchange={(e) => updateRuleConfig(i, 'dayOfMonth', parseInt(e.currentTarget.value, 10))}
								>
									{#each DAY_NUMBERS as d}
										<option value={d.value}>{d.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="rule-{i}-yearly-time" class="block text-xs font-medium text-[var(--text-muted)]">Time</label>
								<input
									id="rule-{i}-yearly-time"
									type="time"
									value={(rule.config.time as string) ?? '09:00'}
									oninput={(e) => updateRuleConfig(i, 'time', e.currentTarget.value)}
									class="mt-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
								/>
							</div>
						</div>
					{:else if rule.type === 'interval'}
						<div class="flex flex-wrap gap-3">
							<div>
								<label for="rule-{i}-interval-amount" class="block text-xs font-medium text-[var(--text-muted)]">Number</label>
								<input
									id="rule-{i}-interval-amount"
									type="number"
									min="1"
									value={Number(rule.config.amount ?? 1)}
									oninput={(e) => updateRuleConfig(i, 'amount', parseInt(e.currentTarget.value, 10) || 1)}
									class="mt-1 w-24 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
								/>
							</div>
							<div>
								<label for="rule-{i}-interval-unit" class="block text-xs font-medium text-[var(--text-muted)]">Period</label>
								<select
									id="rule-{i}-interval-unit"
									class="mt-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
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
						<label for="rule-{i}-once" class="block text-xs font-medium text-[var(--text-muted)]">Date and time</label>
						<input
							id="rule-{i}-once"
							type="datetime-local"
							value={rule.config.at ? String(rule.config.at).slice(0, 16) : ''}
							oninput={(e) => updateRuleConfig(i, 'at', e.currentTarget.value ? new Date(e.currentTarget.value).toISOString().slice(0, 19) : '')}
							class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
						/>
					{/if}
					<div class="mt-3 grid gap-2 sm:grid-cols-2">
						<div>
							<label for="rule-{i}-start" class="block text-xs text-[var(--text-muted)]">Start (empty = immediately)</label>
							<input
								id="rule-{i}-start"
								type="datetime-local"
								value={rule.start_at ? String(rule.start_at).slice(0, 16) : ''}
								oninput={(e) => {
									rules = rules.map((r, idx) => (idx === i ? { ...r, start_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString().slice(0, 19) : null } : r));
								}}
								class="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
							/>
						</div>
						<div>
							<label for="rule-{i}-end" class="block text-xs text-[var(--text-muted)]">End (empty = forever)</label>
							<input
								id="rule-{i}-end"
								type="datetime-local"
								value={rule.end_at ? String(rule.end_at).slice(0, 16) : ''}
								oninput={(e) => {
									rules = rules.map((r, idx) => (idx === i ? { ...r, end_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString().slice(0, 19) : null } : r));
								}}
								class="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
							/>
						</div>
					</div>
				</div>
			{/each}
		</div>
		<button type="button" onclick={addRule} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add rule</button>
	</div>

	<!-- Fixed slots (when no rules) -->
	{#if rules.length === 0}
		<div>
			<p class="text-sm font-medium text-[var(--text)]">Fixed slots (or add rules above)</p>
			<div class="mt-2 space-y-2">
				{#each Array(slotCount) as _, i}
					<div>
						<label for="slot_{i}" class="sr-only">Slot {i + 1}</label>
						<input id="slot_{i}" type="datetime-local" name="slot_{i}" class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
					</div>
				{/each}
			</div>
			<button type="button" onclick={() => slotCount++} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add slot</button>
		</div>
	{/if}

	<div>
		<p class="text-sm font-medium text-[var(--text)]">Schedule custom fields (optional)</p>
		<div class="mt-2 space-y-2">
			{#each fieldIndices as idx, i}
				<div class="flex flex-wrap items-center gap-2">
					<input type="text" name="field_key_{idx}" placeholder="Key" class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-w-[100px] min-h-[44px]" />
					<select name="field_type_{idx}" class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
						<option value="string">string</option>
						<option value="number">number</option>
						<option value="boolean">boolean</option>
						<option value="json">json</option>
					</select>
					<input type="text" name="field_value_{idx}" placeholder="Value" class="flex-1 min-w-[120px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
					<button
						type="button"
						class="rounded border border-red-400 px-2 py-1 text-xs text-red-800 dark:border-red-500 dark:text-red-200 min-h-[32px]"
						onclick={() => removeField(idx)}
					>
						Remove
					</button>
				</div>
			{/each}
		</div>
		<button type="button" onclick={addField} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add field</button>
	</div>

	<div class="flex gap-2 pt-4">
		<button type="submit" class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm min-h-[44px]">Create schedule</button>
		<a href="/schedules" class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center">Cancel</a>
	</div>
	</form>
</div>
