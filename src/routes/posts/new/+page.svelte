<script lang="ts">
	import { enhance } from '$app/forms';
	import { DEFAULT_MANUAL_POST_COLOR, TAILWIND_POST_COLORS, normalizePostColor } from '$lib/postColors';

	let { data, form } = $props();
	let fieldRows = $state<{ key: string; type: string; value: string }[]>([
		{ key: '', type: 'string', value: '' }
	]);
	let selectedColor = $state<string>(DEFAULT_MANUAL_POST_COLOR);
	let hexColorInput = $state<string>(DEFAULT_MANUAL_POST_COLOR);
	let webhookIds = $state<string[]>([]);

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
</script>

<svelte:head>
	<title>New post – PostPlan</title>
</svelte:head>

<h1 class="text-2xl font-bold text-[var(--text)]">New post</h1>

<form method="POST" action="?/create" use:enhance class="mt-6 max-w-2xl space-y-6">
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

	<!-- Webhooks -->
	<section class="content-card rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
		<h2 class="text-base font-semibold text-[var(--text)] mb-1">Webhooks</h2>
		<p class="text-xs text-[var(--text-muted)] mb-4">Select at least one; all will receive the post when published.</p>
		<div class="flex flex-wrap gap-x-6 gap-y-2">
			{#each data.webhooks as w}
				<label class="flex items-center gap-2 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-hover)] transition-colors has-[:checked]:border-[var(--text)] has-[:checked]:bg-[var(--surface-hover)]">
					<input
						type="checkbox"
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
		{#if webhookIds.length === 0}
			<p class="mt-3 text-xs text-amber-600 dark:text-amber-400">Select at least one webhook.</p>
		{/if}
	</section>

	<!-- Schedule -->
	<section class="content-card rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
		<h2 class="text-base font-semibold text-[var(--text)] mb-1">Schedule</h2>
		<p class="text-xs text-[var(--text-muted)] mb-4">Leave unscheduled (draft), pick a date/time, or assign the next free slot from a schedule.</p>
		<div class="space-y-3">
			<label class="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors has-[:checked]:border-[var(--text)] has-[:checked]:bg-[var(--surface-hover)]">
				<input type="radio" name="schedule_by" value="none" class="rounded-full border-[var(--border)]" checked />
				<span class="text-sm text-[var(--text)]">No schedule (draft)</span>
			</label>
			<label class="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors has-[:checked]:border-[var(--text)] has-[:checked]:bg-[var(--surface-hover)]">
				<input type="radio" name="schedule_by" value="datetime" class="rounded-full border-[var(--border)]" />
				<span class="text-sm text-[var(--text)]">Specific date & time</span>
			</label>
			<div class="ml-6 mt-1">
				<input id="scheduled_at" type="datetime-local" name="scheduled_at" class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
			</div>
			<label class="flex items-center gap-3 cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors has-[:checked]:border-[var(--text)] has-[:checked]:bg-[var(--surface-hover)]">
				<input type="radio" name="schedule_by" value="schedule" class="rounded-full border-[var(--border)]" />
				<span class="text-sm text-[var(--text)]">Next free slot on a schedule</span>
			</label>
			<div class="ml-6 mt-1">
				<select id="schedule_id" name="schedule_id" class="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]">
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
		<button type="submit" class="rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm min-h-[44px]">Create post</button>
		<a href="/posts" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center transition-colors">Cancel</a>
	</div>
</form>
