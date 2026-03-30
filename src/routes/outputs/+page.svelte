<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	let editingWebhookId = $state<string | null>(null);
	let newWebhook = $state(false);
	let editingHeaders = $state<{ key: string; value: string }[]>([]);
	let newWebhookHeaders = $state<{ key: string; value: string }[]>([]);

	function openEditWebhook(webhook: { id: string; headers?: { key: string; value: string }[] }) {
		editingWebhookId = webhook.id;
		editingHeaders = (webhook.headers ?? []).map((h) => ({ key: h.key, value: h.value }));
	}
	function openNewWebhook() {
		newWebhook = true;
		newWebhookHeaders = [];
	}
</script>

<svelte:head>
	<title>Outputs – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Outputs"
	description="Webhook endpoints for scheduled posts. Each can have an API key (x-make-apikey) and optional HTTP headers."
/>

<section class="mt-8" id="outputs-webhooks">
	<div class="mb-6 w-full overflow-hidden rounded-xl bg-[var(--surface)]">
		<img src="/Send.svg" alt="Outputs: send content to webhooks" class="block h-auto max-w-full object-contain" />
	</div>

	{#if (form as { error?: string })?.error}
		<div
			class="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
			role="alert"
		>
			{(form as { error: string }).error}
		</div>
	{/if}

	<div class="mt-4 space-y-3">
		{#each data.webhooks as webhook}
			{#if editingWebhookId === webhook.id}
				<form
					method="POST"
					action="?/updateWebhook"
					use:enhance={() => {
						editingWebhookId = null;
						return invalidateAll();
					}}
					class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
				>
					<input type="hidden" name="id" value={webhook.id} />
					<input type="hidden" name="headers_json" value={JSON.stringify(editingHeaders)} />
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<label for="edit-webhook-name" class="block text-sm font-medium text-[var(--text)]">Name</label>
							<input
								id="edit-webhook-name"
								type="text"
								name="name"
								value={webhook.name}
								required
								class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
							/>
						</div>
						<div>
							<label for="edit-webhook-url" class="block text-sm font-medium text-[var(--text)]">URL</label>
							<input
								id="edit-webhook-url"
								type="url"
								name="url"
								value={webhook.url}
								required
								class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
							/>
						</div>
					</div>
					<div class="mt-3">
						<label for="edit-webhook-apikey" class="block text-sm font-medium text-[var(--text)]"
							>API key (x-make-apikey header, leave blank to keep current)</label
						>
						<input
							id="edit-webhook-apikey"
							type="password"
							name="api_key"
							placeholder="••••••••"
							autocomplete="off"
							class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
						/>
					</div>
					<div class="mt-3">
						<p class="block text-sm font-medium text-[var(--text)]">Optional headers</p>
						<p class="mt-0.5 text-xs text-[var(--text-muted)]">
							Extra HTTP headers sent with every request (e.g. X-Custom-Header).
						</p>
						<div class="mt-2 space-y-2">
							{#each editingHeaders as _, i}
								<div class="flex flex-wrap gap-2">
									<input
										type="text"
										bind:value={editingHeaders[i].key}
										placeholder="Header name"
										class="min-w-[140px] rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
									/>
									<input
										type="text"
										bind:value={editingHeaders[i].value}
										placeholder="Value"
										class="min-w-[120px] flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
									/>
									<button
										type="button"
										onclick={() => (editingHeaders = editingHeaders.filter((_, j) => j !== i))}
										class="btn-danger-outline min-h-[44px] rounded border px-2 py-1 text-sm">Remove</button
									>
								</div>
							{/each}
						</div>
						<button
							type="button"
							onclick={() => (editingHeaders = [...editingHeaders, { key: '', value: '' }])}
							class="mt-2 min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
							>+ Add header</button
						>
					</div>
					<div class="mt-3 flex gap-2">
						<button type="submit" class="btn-primary min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white">Save</button>
						<button
							type="button"
							onclick={() => (editingWebhookId = null)}
							class="min-h-[44px] rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
							>Cancel</button
						>
					</div>
				</form>
			{:else}
				<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
					<div class="min-w-0 flex-1">
						<p class="font-medium text-[var(--text)]">{webhook.name}</p>
						<p class="truncate text-sm text-[var(--text-muted)]">{webhook.url}</p>
						<div class="mt-2 flex items-center gap-2">
							<span class="text-xs text-[var(--text-muted)]">ID:</span>
							<code
								class="rounded bg-[var(--bg)] px-1.5 py-0.5 font-mono text-xs text-[var(--text)]"
								title="Webhook ID for API and import callback">{webhook.id}</code
							>
							<button
								type="button"
								onclick={() => navigator.clipboard.writeText(webhook.id)}
								class="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
							>
								Copy
							</button>
						</div>
					</div>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={() => openEditWebhook(webhook)}
							class="min-h-[44px] min-w-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
							>Edit</button
						>
						<form
							method="POST"
							action="?/deleteWebhook"
							use:enhance={({ cancel }) => {
								if (!confirm('Delete this webhook? Posts using it will need another webhook.')) cancel();
								return () => invalidateAll();
							}}
							class="inline"
						>
							<input type="hidden" name="id" value={webhook.id} />
							<button type="submit" class="btn-danger-outline min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm">Delete</button>
						</form>
					</div>
				</div>
			{/if}
		{/each}

		{#if newWebhook}
			<form
				method="POST"
				action="?/createWebhook"
				use:enhance={() => {
					newWebhook = false;
					return invalidateAll();
				}}
				class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
			>
				<input type="hidden" name="headers_json" value={JSON.stringify(newWebhookHeaders)} />
				<div class="grid gap-3 sm:grid-cols-2">
					<div>
						<label for="new-webhook-name" class="block text-sm font-medium text-[var(--text)]">Name</label>
						<input
							id="new-webhook-name"
							type="text"
							name="name"
							required
							placeholder="e.g. Slack"
							class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
						/>
					</div>
					<div>
						<label for="new-webhook-url" class="block text-sm font-medium text-[var(--text)]">URL</label>
						<input
							id="new-webhook-url"
							type="url"
							name="url"
							required
							placeholder="https://..."
							class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
						/>
					</div>
				</div>
				<div class="mt-3">
					<label for="new-webhook-apikey" class="block text-sm font-medium text-[var(--text)]"
						>API key (x-make-apikey header, optional)</label
					>
					<input
						id="new-webhook-apikey"
						type="password"
						name="api_key"
						autocomplete="off"
						class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
					/>
				</div>
				<div class="mt-3">
					<p class="block text-sm font-medium text-[var(--text)]">Optional headers</p>
					<p class="mt-0.5 text-xs text-[var(--text-muted)]">Extra HTTP headers sent with every request.</p>
					<div class="mt-2 space-y-2">
						{#each newWebhookHeaders as _, i}
							<div class="flex flex-wrap gap-2">
								<input
									type="text"
									bind:value={newWebhookHeaders[i].key}
									placeholder="Header name"
									class="min-w-[140px] rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
								/>
								<input
									type="text"
									bind:value={newWebhookHeaders[i].value}
									placeholder="Value"
									class="min-w-[120px] flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
								/>
								<button
									type="button"
									onclick={() => (newWebhookHeaders = newWebhookHeaders.filter((_, j) => j !== i))}
									class="btn-danger-outline min-h-[44px] rounded border px-2 py-1 text-sm">Remove</button
								>
							</div>
						{/each}
					</div>
					<button
						type="button"
						onclick={() => (newWebhookHeaders = [...newWebhookHeaders, { key: '', value: '' }])}
						class="mt-2 min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
						>+ Add header</button
					>
				</div>
				<div class="mt-3 flex gap-2">
					<button type="submit" class="btn-primary min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white">Add webhook</button>
					<button
						type="button"
						onclick={() => (newWebhook = false)}
						class="min-h-[44px] rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
						>Cancel</button
					>
				</div>
			</form>
		{/if}
	</div>
	{#if !newWebhook}
		<button
			type="button"
			onclick={openNewWebhook}
			class="mt-3 min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
			>+ Add webhook</button
		>
	{/if}
</section>
