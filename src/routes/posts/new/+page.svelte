<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let fieldCount = $state(0);
</script>

<svelte:head>
	<title>New post – PostPlan</title>
</svelte:head>

<h1 class="text-2xl font-bold text-[var(--text)]">New post</h1>

<div class="content-card mt-6 max-w-2xl rounded-xl p-6 shadow-sm">
	<form method="POST" action="?/create" use:enhance class="space-y-4">
	{#if form?.error}
		<p class="rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
	{/if}

	<div>
		<label for="title" class="block text-sm font-medium text-[var(--text)]">Title *</label>
		<input id="title" type="text" name="title" required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
	</div>

	<div>
		<label for="content" class="block text-sm font-medium text-[var(--text)]">Content</label>
		<textarea id="content" name="content" rows="5" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)]"></textarea>
	</div>

	<div>
		<label for="webhook_id" class="block text-sm font-medium text-[var(--text)]">Webhook *</label>
		<select id="webhook_id" name="webhook_id" required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
			<option value="">Select webhook</option>
			{#each data.webhooks as w}
				<option value={w.id}>{w.name}</option>
			{/each}
		</select>
	</div>

	<div>
		<p class="block text-sm font-medium text-[var(--text)]">Schedule</p>
		<p class="mt-0.5 text-xs text-[var(--text-muted)]">Leave unscheduled (draft), pick a date/time, or assign the next free slot from a schedule.</p>
		<div class="mt-2 space-y-3">
			<label class="flex items-center gap-2">
				<input type="radio" name="schedule_by" value="none" class="rounded border-[var(--border)]" checked />
				<span class="text-sm text-[var(--text)]">No schedule (draft)</span>
			</label>
			<label class="flex items-center gap-2">
				<input type="radio" name="schedule_by" value="datetime" class="rounded border-[var(--border)]" />
				<span class="text-sm text-[var(--text)]">Specific date & time</span>
			</label>
			<div class="ml-6 mt-1">
				<input id="scheduled_at" type="datetime-local" name="scheduled_at" class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
			</div>
			<label class="flex items-center gap-2">
				<input type="radio" name="schedule_by" value="schedule" class="rounded border-[var(--border)]" />
				<span class="text-sm text-[var(--text)]">Next free slot on a schedule</span>
			</label>
			<div class="ml-6 mt-1">
				<select id="schedule_id" name="schedule_id" class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
					<option value="">Select schedule</option>
					{#each data.schedules as s}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-[var(--text-muted)]">The first slot not already taken by another post on this schedule.</p>
			</div>
		</div>
	</div>

	<div>
		<p class="text-sm font-medium text-[var(--text)]">Custom fields</p>
		<p class="text-xs text-[var(--text-muted)]">Key-value pairs included in the webhook JSON.</p>
		<div class="mt-2 space-y-2" id="custom-fields">
			{#each Array(fieldCount) as _, i}
				<div class="flex flex-wrap gap-2">
					<input type="text" name="field_key_{i}" placeholder="Key" class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-w-[100px] min-h-[44px]" />
					<select name="field_type_{i}" class="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]">
						<option value="string">string</option>
						<option value="number">number</option>
						<option value="boolean">boolean</option>
						<option value="json">json</option>
					</select>
					<input type="text" name="field_value_{i}" placeholder="Value" class="flex-1 min-w-[120px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]" />
				</div>
			{/each}
		</div>
		<button type="button" onclick={() => fieldCount++} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add field</button>
	</div>

	<div class="flex gap-2 pt-4">
		<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)] shadow-sm min-h-[44px]">Create post</button>
		<a href="/posts" class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center">Cancel</a>
	</div>
	</form>
</div>
