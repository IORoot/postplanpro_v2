<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { TAILWIND_POST_COLORS, normalizePostColor } from '$lib/postColors';
	import { buildPostPayload } from '$lib/payload';

	let { data, form } = $props();
	let fieldRows = $state<{ key: string; type: string; value: string }[]>([]);
	let sending = $state(false);
	let sendError = $state<string | null>(null);
	let selectedColor = $state<string>(TAILWIND_POST_COLORS[0]);
	let hexColorInput = $state<string>(TAILWIND_POST_COLORS[0]);
	let titleInput = $state('');
	let contentInput = $state('');
	let imageUrlInput = $state('');
	let scheduledAtInput = $state('');
	let scheduleByInput = $state<'none' | 'datetime' | 'schedule'>('none');
	let overrideEnabled = $state(false);
	let overrideText = $state('');
	$effect(() => {
		fieldRows =
			(data.fields?.length ?? 0) > 0
				? data.fields.map((f) => ({ key: f.key, type: f.type, value: f.value ?? '' }))
				: [{ key: '', type: 'string', value: '' }];
		const resolvedColor = normalizePostColor(data.post.color) ?? TAILWIND_POST_COLORS[0];
		selectedColor = resolvedColor;
		hexColorInput = resolvedColor;
		titleInput = data.post.title;
		contentInput = data.post.content ?? '';
		imageUrlInput = data.post.image_url ?? '';
		scheduledAtInput = data.post.scheduled_at ? new Date(data.post.scheduled_at).toISOString().slice(0, 16) : '';
		scheduleByInput = data.post.schedule_id
			? 'schedule'
			: data.post.scheduled_at
				? 'datetime'
				: 'none';
		overrideEnabled = !!data.post.payload_override;
		if (data.post.payload_override) {
			try {
				overrideText = JSON.stringify(JSON.parse(data.post.payload_override), null, 2);
			} catch {
				overrideText = data.post.payload_override;
			}
		} else {
			overrideText = '';
		}
	});

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

	const generatedPayload = $derived.by(() =>
		buildPostPayload(
			{
				title: titleInput,
				content: contentInput || null,
				image_url: imageUrlInput || null,
				scheduled_at: scheduleByInput === 'datetime' ? scheduledAtInput || null : null
			},
			fieldRows
				.filter((f) => f.key.trim().length > 0)
				.map((f) => ({ key: f.key.trim(), type: f.type, value: f.value })),
			data.globals
		)
	);
	const overrideError = $derived.by(() => {
		if (!overrideEnabled || !overrideText.trim()) return null;
		try {
			JSON.parse(overrideText);
			return null;
		} catch {
			return 'Override JSON is invalid.';
		}
	});
	const liveJson = $derived.by(() => {
		if (overrideEnabled) {
			try {
				return JSON.stringify(JSON.parse(overrideText), null, 2);
			} catch {
				return overrideText;
			}
		}
		return JSON.stringify(generatedPayload, null, 2);
	});

	async function sendNow() {
		sending = true;
		sendError = null;
		try {
			const res = await fetch(`/api/posts/${data.post.id}/send`, { method: 'POST' });
			const result = await res.json();
			if (result.success) {
				invalidateAll();
			} else {
				sendError = result.error ?? 'Send failed';
			}
		} catch (e) {
			sendError = e instanceof Error ? e.message : 'Request failed';
		} finally {
			sending = false;
		}
	}
</script>

<svelte:head>
	<title>Edit: {data.post.title} – PostPlan</title>
</svelte:head>

<h1 class="text-2xl font-bold text-[var(--text)]">Edit post</h1>

<div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
	<div class="content-card rounded-xl p-6 shadow-sm">
		<form method="POST" action="?/update" use:enhance class="space-y-4">
	{#if form?.error}
		<p class="rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
	{/if}
	{#if sendError}
		<p class="rounded-lg px-3 py-2 text-sm alert-error">{sendError}</p>
	{/if}

	<div>
		<label for="title" class="block text-sm font-medium text-[var(--text)]">Title *</label>
		<input id="title" type="text" name="title" bind:value={titleInput} required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
	</div>

	<div>
		<label for="content" class="block text-sm font-medium text-[var(--text)]">Content</label>
		<textarea id="content" name="content" rows="5" bind:value={contentInput} class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"></textarea>
	</div>

	<div>
		<label for="image_url" class="block text-sm font-medium text-[var(--text)]">Image URL (optional)</label>
		<input id="image_url" type="url" name="image_url" bind:value={imageUrlInput} placeholder="https://..." class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
	</div>

	<div>
		<p class="block text-sm font-medium text-[var(--text)]">Post color</p>
		<p class="mt-0.5 text-xs text-[var(--text-muted)]">Choose a Tailwind palette color or enter a HEX color.</p>
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
				aria-label="Pick custom color"
			/>
			<input
				type="text"
				value={hexColorInput}
				oninput={(e) => onHexColorInput((e.currentTarget as HTMLInputElement).value)}
				placeholder="#aabbcc"
				class="w-32 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
			/>
			<span class="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
				<span class="inline-block h-4 w-4 rounded border border-[var(--border)]" style={`background-color: ${selectedColor};`}></span>
				{selectedColor}
			</span>
		</div>
		<input type="hidden" name="color" value={selectedColor} />
	</div>

	<div>
		<label for="webhook_id" class="block text-sm font-medium text-[var(--text)]">Webhook *</label>
		<select id="webhook_id" name="webhook_id" required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
			{#each data.webhooks as w}
				<option value={w.id} selected={w.id === data.post.webhook_id}>{w.name}</option>
			{/each}
		</select>
	</div>

	<div>
		<p class="block text-sm font-medium text-[var(--text)]">Schedule</p>
		<p class="mt-0.5 text-xs text-[var(--text-muted)]">Draft, pick a date/time, or assign the next free slot from a schedule.</p>
		<div class="mt-2 space-y-3">
			<label class="flex items-center gap-2">
				<input type="radio" name="schedule_by" value="none" class="rounded border-[var(--border)]" bind:group={scheduleByInput} />
				<span class="text-sm text-[var(--text)]">No schedule (draft)</span>
			</label>
			<label class="flex items-center gap-2">
				<input type="radio" name="schedule_by" value="datetime" class="rounded border-[var(--border)]" bind:group={scheduleByInput} />
				<span class="text-sm text-[var(--text)]">Specific date & time</span>
			</label>
			<div class="ml-6 mt-1">
				<input
					id="scheduled_at"
					type="datetime-local"
					name="scheduled_at"
					bind:value={scheduledAtInput}
					class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]"
				/>
			</div>
			<label class="flex items-center gap-2">
				<input type="radio" name="schedule_by" value="schedule" class="rounded border-[var(--border)]" bind:group={scheduleByInput} />
				<span class="text-sm text-[var(--text)]">Next free slot on a schedule</span>
			</label>
			<div class="ml-6 mt-1">
				<select id="schedule_id" name="schedule_id" class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
					<option value="">Select schedule</option>
					{#each data.schedules as s}
						<option value={s.id} selected={s.id === data.post.schedule_id}>{s.name}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-[var(--text-muted)]">The first slot not already taken by another post on this schedule.</p>
			</div>
		</div>
	</div>

	<div>
		<p class="text-sm font-medium text-[var(--text)]">Custom fields</p>
		<p class="text-xs text-[var(--text-muted)]">Use dotted paths for nesting (e.g. <code>instagram.title</code>). Use <code>json</code> type for arrays/objects.</p>
		<div class="mt-2 flex flex-wrap items-center gap-2">
			{#each data.templates as t}
				<button
					type="button"
					onclick={() => appendTemplate(t.id)}
					class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
				>
					+ {t.name}{t.is_default ? ' (default)' : ''}
				</button>
			{/each}
		</div>
		<div class="mt-2 space-y-2">
			{#each fieldRows as _, i}
				<div class="flex flex-wrap gap-2">
					<input
						type="text"
						name="field_key_{i}"
						placeholder="field.path"
						bind:value={fieldRows[i].key}
						class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-w-[140px] min-h-[44px]"
					/>
					<select name="field_type_{i}" bind:value={fieldRows[i].type} class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
						<option value="string">string</option>
						<option value="number">number</option>
						<option value="boolean">boolean</option>
						<option value="json">json</option>
					</select>
					<input
						type="text"
						name="field_value_{i}"
						placeholder="Value"
						bind:value={fieldRows[i].value}
						class="flex-1 min-w-[120px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]"
					/>
					<button type="button" onclick={() => removeField(i)} class="rounded border border-red-400 px-2 py-1 text-sm text-red-800 dark:border-red-500 dark:text-red-200 min-h-[44px]">Remove</button>
				</div>
			{/each}
		</div>
		<button type="button" onclick={addField} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add field</button>
	</div>

	<div>
		<div class="flex items-center justify-between gap-2">
			<p class="text-sm font-medium text-[var(--text)]">JSON override</p>
			<button
				type="button"
				onclick={() => (overrideEnabled = !overrideEnabled)}
				class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
			>
				{overrideEnabled ? 'Disable override' : 'Enable override'}
			</button>
		</div>
		<p class="mt-1 text-xs text-[var(--text-muted)]">When enabled and saved, this JSON is sent instead of generated output.</p>
		<input type="hidden" name="payload_override_enabled" value={overrideEnabled ? '1' : '0'} />
		<input type="hidden" name="payload_override" value={overrideText} />
		{#if overrideEnabled}
			<textarea
				bind:value={overrideText}
				rows="12"
				class="mt-2 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--text)]"
				spellcheck="false"
			></textarea>
			{#if overrideError}
				<p class="mt-2 rounded px-2 py-1 text-xs alert-error">{overrideError}</p>
			{/if}
		{/if}
	</div>

	<div class="flex flex-wrap gap-2 pt-4">
		<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] shadow-sm min-h-[44px]">Save</button>
		<button
			type="button"
			disabled={sending}
			onclick={sendNow}
			class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-50 min-h-[44px]"
			title="Send post JSON to target now"
		>
			{sending ? 'Sending…' : 'Send now'}
		</button>
		<a href="/posts" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center">Cancel</a>
	</div>
		</form>
	</div>

	<aside class="content-card rounded-xl p-4 shadow-sm xl:sticky xl:top-6 xl:h-fit">
		<div class="mb-2 flex items-center justify-between gap-2">
			<h2 class="text-sm font-semibold text-[var(--text)]">Live JSON output</h2>
			<span class="text-[11px] text-[var(--text-muted)]">{overrideEnabled ? 'Override active' : 'Generated'}</span>
		</div>
		<pre class="max-h-[70vh] overflow-auto rounded border border-[var(--border)] bg-[var(--bg)] p-3 text-xs leading-5 text-[var(--text)]"><code>{liveJson}</code></pre>
	</aside>
</div>
