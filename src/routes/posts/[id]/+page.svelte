<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();
	let fieldCount = $state(0);
	let sending = $state(false);
	let sendError = $state<string | null>(null);
	$effect(() => {
		const n = data.fields?.length ?? 0;
		if (n > fieldCount) fieldCount = n;
		if (fieldCount === 0 && n === 0) fieldCount = 1;
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

<div class="content-card mt-6 max-w-2xl rounded-xl p-6 shadow-sm">
	<form method="POST" action="?/update" use:enhance class="space-y-4">
	{#if form?.error}
		<p class="rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
	{/if}
	{#if sendError}
		<p class="rounded-lg px-3 py-2 text-sm alert-error">{sendError}</p>
	{/if}

	<div>
		<label for="title" class="block text-sm font-medium text-[var(--text)]">Title *</label>
		<input id="title" type="text" name="title" value={data.post.title} required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
	</div>

	<div>
		<label for="content" class="block text-sm font-medium text-[var(--text)]">Content</label>
		<textarea id="content" name="content" rows="5" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]">{data.post.content ?? ''}</textarea>
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
				<input type="radio" name="schedule_by" value="none" class="rounded border-[var(--border)]" checked={!data.post.scheduled_at && !data.post.schedule_id} />
				<span class="text-sm text-[var(--text)]">No schedule (draft)</span>
			</label>
			<label class="flex items-center gap-2">
				<input type="radio" name="schedule_by" value="datetime" class="rounded border-[var(--border)]" checked={data.post.scheduled_at != null && !data.post.schedule_id} />
				<span class="text-sm text-[var(--text)]">Specific date & time</span>
			</label>
			<div class="ml-6 mt-1">
				<input
					id="scheduled_at"
					type="datetime-local"
					name="scheduled_at"
					value={data.post.scheduled_at ? new Date(data.post.scheduled_at).toISOString().slice(0, 16) : ''}
					class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]"
				/>
			</div>
			<label class="flex items-center gap-2">
				<input type="radio" name="schedule_by" value="schedule" class="rounded border-[var(--border)]" checked={data.post.schedule_id != null} />
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
		<div class="mt-2 space-y-2">
			{#each Array(fieldCount) as _, i}
				<div class="flex flex-wrap gap-2">
					<input
						type="text"
						name="field_key_{i}"
						placeholder="Key"
						value={data.fields[i]?.key ?? ''}
						class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-w-[100px] min-h-[44px]"
					/>
					<select name="field_type_{i}" class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
						<option value="string" selected={data.fields[i]?.type === 'string'}>string</option>
						<option value="number" selected={data.fields[i]?.type === 'number'}>number</option>
						<option value="boolean" selected={data.fields[i]?.type === 'boolean'}>boolean</option>
						<option value="json" selected={data.fields[i]?.type === 'json'}>json</option>
					</select>
					<input
						type="text"
						name="field_value_{i}"
						placeholder="Value"
						value={data.fields[i]?.value ?? ''}
						class="flex-1 min-w-[120px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]"
					/>
				</div>
			{/each}
		</div>
		<button type="button" onclick={() => fieldCount++} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add field</button>
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
