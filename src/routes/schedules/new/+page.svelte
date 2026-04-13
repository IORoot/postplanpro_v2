<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
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

<div class="w-full">
	<form method="POST" action="?/create" use:enhance class="space-y-4">
		{#if form?.error}
			<p class="rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
		{/if}

		<input type="hidden" name="rules_json" value={rules.length > 0 ? rulesJson() : ''} />

		<PageSectionHeading title="New schedule" />

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
			<div class="min-w-0">
				<div class="mt-6">
					<label for="name" class="block text-sm font-medium text-[var(--text)]">Name *</label>
					<input id="name" type="text" name="name" required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
				</div>
				<div class="mt-4">
					<label for="description" class="block text-sm font-medium text-[var(--text)]">Description</label>
					<textarea id="description" name="description" rows="2" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"></textarea>
				</div>
				<div class="mt-4">
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
			<p class="mt-1 text-sm text-[var(--text-muted)]">
				Add multiple rules; slots are merged and sorted. Start = immediately if empty; End = forever if empty. Or use fixed
				slots below when you have no rules.
			</p>
			<div class="mt-4 space-y-6">
				{#each rules as rule, i}
					<div
						class="rounded-xl border border-[var(--border)] border-l-4 bg-[var(--surface)] shadow-sm overflow-hidden"
						style="border-left-color: {ruleColor(i)}"
					>
						<div class="border-b border-[var(--border)] bg-[var(--surface-hover)]/50 px-4 py-3 grid grid-cols-1 md:grid-cols-3 items-center gap-3">
							<div class="text-sm font-semibold text-[var(--text)] md:justify-self-start">Rule {i + 1}</div>
							<div class="md:justify-self-center">
								<label for="rule-type-{i}" class="sr-only">Rule type</label>
								<select
									id="rule-type-{i}"
									class="w-full md:w-auto rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-base font-semibold text-[var(--text)] min-h-[46px] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
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
							</div>
							<div class="md:justify-self-end">
								<button
									type="button"
									onclick={() => removeRule(i)}
									class="w-full md:w-auto rounded-lg border border-red-400/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/60 dark:bg-red-950/30 dark:text-red-300 min-h-[40px] hover:bg-red-100 dark:hover:bg-red-950/50"
									aria-label="Remove rule"
								>
									Remove
								</button>
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
													value={rule.config.at ? String(rule.config.at).slice(0, 16) : ''}
													oninput={(e) =>
														updateRuleConfig(
															i,
															'at',
															e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : ''
														)}
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
												value={rule.start_at ? String(rule.start_at).slice(0, 16) : ''}
												oninput={(e) => {
													rules = rules.map((r, idx) =>
														idx === i
															? {
																	...r,
																	start_at: e.currentTarget.value
																		? new Date(e.currentTarget.value).toISOString()
																		: null
																}
															: r
													);
												}}
												class="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] min-h-[44px]"
											/>
										</div>
										<div>
											<label for="rule-{i}-end" class="block text-sm font-medium text-[var(--text-muted)]">End (empty = forever)</label>
											<input
												id="rule-{i}-end"
												type="datetime-local"
												value={rule.end_at ? String(rule.end_at).slice(0, 16) : ''}
												oninput={(e) => {
													rules = rules.map((r, idx) =>
														idx === i
															? {
																	...r,
																	end_at: e.currentTarget.value
																		? new Date(e.currentTarget.value).toISOString()
																		: null
																}
															: r
													);
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
			<button
				type="button"
				onclick={addRule}
				class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
			>
				+ Add rule
			</button>
		</div>

		<!-- Fixed slots (when no rules) -->
		{#if rules.length === 0}
			<div>
				<p class="text-sm font-medium text-[var(--text)]">Fixed slots (or add rules above)</p>
				<div class="mt-2 space-y-2">
					{#each Array(slotCount) as _, i}
						<div>
							<label for="slot_{i}" class="sr-only">Slot {i + 1}</label>
							<input
								id="slot_{i}"
								type="datetime-local"
								name="slot_{i}"
								class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]"
							/>
						</div>
					{/each}
				</div>
				<button
					type="button"
					onclick={() => slotCount++}
					class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
				>
					+ Add slot
				</button>
			</div>
		{/if}

		<section
			class="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
			aria-labelledby="custom-fields-heading-new"
		>
			<h2 id="custom-fields-heading-new" class="text-lg font-semibold text-[var(--text)]">Schedule custom fields</h2>
			<p class="mt-1 text-sm text-[var(--text-muted)]">
				Key/value pairs merged into each post when this schedule is applied. Optional.
			</p>
			<div class="mt-4 space-y-3">
				{#each fieldIndices as idx}
					<div class="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
						<input
							type="text"
							name="field_key_{idx}"
							placeholder="Key"
							class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-w-[100px] min-h-[44px]"
						/>
						<select
							name="field_type_{idx}"
							class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]"
						>
							<option value="string">string</option>
							<option value="number">number</option>
							<option value="boolean">boolean</option>
							<option value="json">json</option>
						</select>
						<input
							type="text"
							name="field_value_{idx}"
							placeholder="Value"
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
			<button
				type="button"
				onclick={addField}
				class="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
			>
				+ Add field
			</button>
		</section>

		<div class="flex gap-2 pt-6">
			<button type="submit" class="btn-primary btn-touch text-white shadow-sm">Create schedule</button>
			<a
				href="/schedules"
				class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center"
			>
				Cancel
			</a>
		</div>
	</form>
</div>
