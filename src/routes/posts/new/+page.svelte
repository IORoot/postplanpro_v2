<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { DEFAULT_MANUAL_POST_COLOR, TAILWIND_POST_COLORS, normalizePostColor } from '$lib/postColors';

	let { data, form } = $props();
	let fieldRows = $state<{ key: string; type: string; value: string }[]>([
		{ key: '', type: 'string', value: '' }
	]);
	let selectedColor = $state<string>(DEFAULT_MANUAL_POST_COLOR);
	let hexColorInput = $state<string>(DEFAULT_MANUAL_POST_COLOR);
	let webhookIds = $state<string[]>([]);
	let scheduleBy = $state<'none' | 'datetime' | 'schedule'>('none');
	let scheduleDate = $state('');
	let scheduleTime = $state('');
	let inlineHeadersJson = $state('[]');
	let addWebhookModalOpen = $state(false);

	function zonedNow(timeZone: string): { date: string; time: string } {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).formatToParts(new Date());
		const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
		const date = `${get('year')}-${get('month')}-${get('day')}`;
		const time = `${get('hour')}:${get('minute')}`;
		return { date, time };
	}

	function setScheduleNow() {
		const now = zonedNow(data.userTimezone ?? 'Europe/London');
		if (!scheduleDate) scheduleDate = now.date;
		scheduleTime = now.time;
	}

	const scheduledAtCombined = $derived(
		scheduleBy === 'datetime' && scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}` : ''
	);

	function addField() {
		fieldRows = [...fieldRows, { key: '', type: 'string', value: '' }];
	}
	function removeField(idx: number) {
		fieldRows = fieldRows.filter((_, i) => i !== idx);
		if (fieldRows.length === 0) addField();
	}
	function appendTemplate(templateId: string) {
		const t = data.templates.find((x) => x.id === templateId);
		if (!t) return;
		const toAppend = t.fields.map((f) => ({ key: f.key, type: f.type, value: f.value }));
		fieldRows = [...fieldRows, ...toAppend];
	}
	function chooseColor(color: string) {
		selectedColor = color;
		hexColorInput = color;
	}
	function onHexColorInput(value: string) {
		hexColorInput = value;
		selectedColor = normalizePostColor(value) ?? selectedColor;
	}

	function onAddWebhookModalKeydown(e: KeyboardEvent) {
		if (!addWebhookModalOpen) return;
		if (e.key === 'Escape') addWebhookModalOpen = false;
	}

	$effect(() => {
		if (!addWebhookModalOpen) return;
		void tick().then(() => document.getElementById('modal-wh-name')?.focus());
	});
</script>

<svelte:window onkeydown={onAddWebhookModalKeydown} />

<svelte:head>
	<title>New post – PostPlan</title>
</svelte:head>

<PageSectionHeading title="New post" />

<div class="max-w-2xl space-y-6">
	<form id="new-post-form" method="POST" action="?/create" use:enhance class="space-y-6">
		{#if form?.error}
			<div class="content-card rounded-xl border border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30 p-4 shadow-sm">
				<p class="text-sm text-red-700 dark:text-red-300">{form.error}</p>
			</div>
		{/if}

		<!-- Post content: title, content, image, color -->
		<section class="content-card rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
			<h2 class="text-base font-semibold text-[var(--text)] mb-4">Content</h2>
			<div class="space-y-4">
				<div>
					<label for="title" class="block text-sm font-medium text-[var(--text)]">Title *</label>
					<input id="title" type="text" name="title" required class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
				</div>
				<div>
					<label for="content" class="block text-sm font-medium text-[var(--text)]">Content</label>
					<textarea id="content" name="content" rows="5" class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"></textarea>
				</div>
				<div>
					<label for="image_url" class="block text-sm font-medium text-[var(--text)]">Image URL (optional)</label>
					<input id="image_url" type="url" name="image_url" placeholder="https://..." class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
				</div>
				<div>
					<p class="block text-sm font-medium text-[var(--text)]">Post color</p>
					<p class="mt-0.5 text-xs text-[var(--text-muted)]">Default is light grey. Optionally choose a palette or HEX color.</p>
					<div class="mt-2 flex flex-wrap gap-2">
						{#each TAILWIND_POST_COLORS as color}
							<button
								type="button"
								onclick={() => chooseColor(color)}
								class="h-8 w-8 rounded-lg border-2 transition {selectedColor === color ? 'border-[var(--text)] ring-2 ring-[var(--border)]' : 'border-[var(--border)]'}"
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
							class="h-10 w-14 rounded-lg border border-[var(--border)] bg-[var(--bg)] cursor-pointer"
							aria-label="Pick custom color"
						/>
						<input
							type="text"
							value={hexColorInput}
							oninput={(e) => onHexColorInput((e.currentTarget as HTMLInputElement).value)}
							placeholder="#aabbcc"
							class="w-32 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
						/>
						<span class="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
							<span class="inline-block h-4 w-4 rounded border border-[var(--border)]" style={`background-color: ${selectedColor};`}></span>
							{selectedColor}
						</span>
					</div>
					<input type="hidden" name="color" value={selectedColor} />
				</div>
			</div>
		</section>

		<!-- Custom fields -->
		<section class="content-card rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
			<h2 class="text-base font-semibold text-[var(--text)] mb-1">Custom fields</h2>
			<p class="text-xs text-[var(--text-muted)] mb-4">Use dotted paths for nesting (e.g. <code class="rounded bg-[var(--bg)] px-1">instagram.title</code>). Use <code class="rounded bg-[var(--bg)] px-1">json</code> type for objects/arrays.</p>
			<div class="flex flex-wrap items-center gap-2 mb-4">
				{#each data.templates as t}
					<button
						type="button"
						onclick={() => appendTemplate(t.id)}
						class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] transition-colors"
					>
						+ {t.name}{t.is_default ? ' (default)' : ''}
					</button>
				{/each}
			</div>
			<div class="space-y-3" id="custom-fields">
				{#each fieldRows as _, i}
					<div class="flex flex-wrap items-center gap-2">
						<input type="text" name="field_key_{i}" bind:value={fieldRows[i].key} placeholder="field.path" class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-w-[140px] min-h-[44px]" />
						<select name="field_type_{i}" bind:value={fieldRows[i].type} class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]">
							<option value="string">string</option>
							<option value="number">number</option>
							<option value="boolean">boolean</option>
							<option value="json">json</option>
						</select>
						<input type="text" name="field_value_{i}" bind:value={fieldRows[i].value} placeholder="Value" class="flex-1 min-w-[120px] rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
						<button type="button" onclick={() => removeField(i)} class="btn-danger-outline min-h-[44px] rounded-lg px-3 py-2 text-sm transition-colors">Remove</button>
					</div>
				{/each}
			</div>
			<button type="button" onclick={addField} class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] transition-colors">+ Add field</button>
		</section>
	</form>

	<!-- Webhooks -->
	<section class="content-card rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
		<h2 class="text-base font-semibold text-[var(--text)] mb-1">Webhooks</h2>
		{#if data.webhooks.length === 0}
			<p class="text-sm text-[var(--text-muted)] mb-4">
				Posts must be linked to at least one output webhook. Create one using the button below, then select it in the list once it appears.
			</p>
			<button
				type="button"
				onclick={() => (addWebhookModalOpen = true)}
				class="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] transition-colors"
			>
				Add webhook
			</button>
		{:else}
			<p class="text-xs text-[var(--text-muted)] mb-4">Select at least one; all will receive the post when published.</p>
			<button
				type="button"
				onclick={() => (addWebhookModalOpen = true)}
				class="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] transition-colors"
			>
				Add webhook
			</button>
			<div class="flex flex-wrap gap-x-6 gap-y-2">
				{#each data.webhooks as w}
					<label class="flex items-center gap-2 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-hover)] transition-colors has-[:checked]:border-[var(--text)] has-[:checked]:bg-[var(--surface-hover)]">
						<input
							type="checkbox"
							form="new-post-form"
							name="webhook_ids"
							value={w.id}
							checked={webhookIds.includes(w.id)}
							onchange={(e) => {
								const checked = (e.target as HTMLInputElement).checked;
								webhookIds = checked ? [...webhookIds, w.id] : webhookIds.filter((id) => id !== w.id);
							}}
							class="rounded border-[var(--border)]"
						/>
						<span class="text-sm text-[var(--text)]">{w.name}</span>
					</label>
				{/each}
			</div>
		{/if}
		{#if webhookIds.length === 0 && data.webhooks.length > 0}
			<p class="mt-3 text-xs text-amber-600 dark:text-amber-400">Select at least one webhook.</p>
		{/if}
	</section>

	<!-- Schedule -->
	<section class="content-card rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
		<h2 class="text-base font-semibold text-[var(--text)] mb-1">Schedule</h2>
		<p class="text-xs text-[var(--text-muted)] mb-4">Leave unscheduled (draft), pick a date/time, or assign the next free slot from a schedule.</p>
		<div class="space-y-3">
			<label class="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors has-[:checked]:border-[var(--text)] has-[:checked]:bg-[var(--surface-hover)]">
				<input type="radio" form="new-post-form" name="schedule_by" value="none" class="rounded-full border-[var(--border)]" bind:group={scheduleBy} />
				<span class="text-sm text-[var(--text)]">No schedule (draft)</span>
			</label>
			<label class="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors has-[:checked]:border-[var(--text)] has-[:checked]:bg-[var(--surface-hover)]">
				<input type="radio" form="new-post-form" name="schedule_by" value="datetime" class="rounded-full border-[var(--border)]" bind:group={scheduleBy} />
				<span class="text-sm text-[var(--text)]">Specific date & time</span>
			</label>
			{#if scheduleBy === 'datetime'}
				<div class="ml-6 mt-1 space-y-3">
					<div class="flex flex-wrap items-end gap-2">
						<div class="min-w-[140px] flex-1">
							<label for="schedule_date" class="block text-xs font-medium text-[var(--text-muted)]">Date</label>
							<input
								id="schedule_date"
								form="new-post-form"
								type="date"
								bind:value={scheduleDate}
								class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
							/>
						</div>
						<div class="min-w-[120px] flex-1">
							<label for="schedule_time" class="block text-xs font-medium text-[var(--text-muted)]">Time</label>
							<input
								id="schedule_time"
								form="new-post-form"
								type="time"
								bind:value={scheduleTime}
								class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
							/>
						</div>
						<div class="flex flex-wrap gap-2 pb-0.5">
							<button type="button" onclick={setScheduleNow} class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">
								Now
							</button>
						</div>
					</div>
					<input form="new-post-form" type="hidden" name="scheduled_at" value={scheduledAtCombined} />
					<p class="text-xs text-[var(--text-muted)]">Timezone: {data.userTimezone}</p>
				</div>
			{/if}
			<label class="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors has-[:checked]:border-[var(--text)] has-[:checked]:bg-[var(--surface-hover)]">
				<input type="radio" form="new-post-form" name="schedule_by" value="schedule" class="rounded-full border-[var(--border)]" bind:group={scheduleBy} />
				<span class="text-sm text-[var(--text)]">Next free slot on a schedule</span>
			</label>
			<div class="ml-6 mt-1">
				<select id="schedule_id" form="new-post-form" name="schedule_id" class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]">
					<option value="">Select schedule</option>
					{#each data.schedules as s}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-[var(--text-muted)]">The first slot not already taken by another post on this schedule.</p>
			</div>
		</div>
	</section>

	<!-- Actions -->
	<div class="flex flex-wrap gap-2 pt-2">
		<button type="submit" form="new-post-form" class="btn-primary btn-touch text-white shadow-sm">Create post</button>
		<a href="/posts" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center transition-colors">Cancel</a>
	</div>

	{#if addWebhookModalOpen}
		<div class="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
			<button
				type="button"
				class="absolute inset-0 bg-black/50"
				aria-label="Close dialog"
				onclick={() => (addWebhookModalOpen = false)}
			></button>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="add-output-webhook-title"
				tabindex="-1"
				class="relative z-10 max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl outline-none"
			>
				<div class="mb-4 flex items-start justify-between gap-3">
					<h3 id="add-output-webhook-title" class="text-base font-semibold text-[var(--text)]">Add output webhook</h3>
					<button
						type="button"
						onclick={() => (addWebhookModalOpen = false)}
						class="shrink-0 rounded-lg border border-transparent px-2 py-1 text-sm text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] min-h-[44px] min-w-[44px]"
						aria-label="Close"
					>
						×
					</button>
				</div>
				<p class="mb-4 text-sm text-[var(--text-muted)]">
					Destination URL for your automation (e.g. Make.com). You can select it for this post after saving.
				</p>
				<form
					method="POST"
					action="?/createWebhook"
					use:enhance={() => {
						return async ({ result }) => {
							await invalidateAll();
							if (
								result.type === 'success' &&
								result.data &&
								typeof result.data === 'object' &&
								'webhookId' in result.data
							) {
								webhookIds = [...webhookIds, (result.data as { webhookId: string }).webhookId];
								addWebhookModalOpen = false;
							}
						};
					}}
					class="space-y-4"
				>
					<input type="hidden" name="headers_json" value={inlineHeadersJson} />
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<label for="modal-wh-name" class="block text-sm font-medium text-[var(--text)]">Name</label>
							<input
								id="modal-wh-name"
								type="text"
								name="name"
								required
								placeholder="e.g. Make.com"
								class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
							/>
						</div>
						<div>
							<label for="modal-wh-url" class="block text-sm font-medium text-[var(--text)]">URL</label>
							<input
								id="modal-wh-url"
								type="url"
								name="url"
								required
								placeholder="https://..."
								class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
							/>
						</div>
					</div>
					<div>
						<label for="modal-wh-apikey" class="block text-sm font-medium text-[var(--text)]"
							>API key (x-make-apikey, optional)</label
						>
						<input
							id="modal-wh-apikey"
							type="password"
							name="api_key"
							autocomplete="off"
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
						/>
					</div>
					<div>
						<label for="modal-wh-headers" class="block text-sm font-medium text-[var(--text)]"
							>Optional headers (JSON array)</label
						>
						<p class="mt-0.5 text-xs text-[var(--text-muted)]">
							{'e.g. [{"key":"X-Custom","value":"..."}]'}
						</p>
						<textarea
							id="modal-wh-headers"
							bind:value={inlineHeadersJson}
							rows="3"
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)]"
						></textarea>
					</div>
					<div class="flex flex-wrap gap-2 pt-2">
						<button type="submit" class="btn-primary btn-touch min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-medium text-white">
							Create webhook
						</button>
						<button
							type="button"
							onclick={() => (addWebhookModalOpen = false)}
							class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] transition-colors"
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
