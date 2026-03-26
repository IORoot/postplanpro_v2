<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	const currentSection = $derived(
		((data as { section?: string }).section ?? 'outputs') as
			| 'outputs'
			| 'inputs'
			| 'templates'
			| 'globals'
	);

	// callback: show full token once after generation
	let generatedCallbackToken = $state<string | null>(null);

	// Example tabs: JSON vs curl for each callback
	let importExampleTab = $state<'json' | 'curl'>('json');
	let postNotificationExampleTab = $state<'json' | 'curl'>('json');

	// When form action returns a token (e.g. after redirect), show it
	$effect(() => {
		const token = (form as { token?: string } | null)?.token;
		if (typeof token === 'string') generatedCallbackToken = token;
	});

	// Webhook edit state
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

	// Global edit state
	let editingGlobalId = $state<string | null>(null);
	let newGlobal = $state(false);

	// Template edit state
	let editingTemplateId = $state<string | null>(null);
	let newTemplate = $state(false);
	let editingTemplateFields = $state<{ key: string; type: string; value: string }[]>([]);
	let newTemplateFields = $state<{ key: string; type: string; value: string }[]>([
		{ key: '', type: 'string', value: '' }
	]);

	function openEditTemplate(template: { id: string; fields?: { key: string; type: string; value: string }[] }) {
		editingTemplateId = template.id;
		editingTemplateFields = (template.fields ?? []).map((f) => ({
			key: f.key,
			type: f.type,
			value: f.value
		}));
		if (editingTemplateFields.length === 0) {
			editingTemplateFields = [{ key: '', type: 'string', value: '' }];
		}
	}
	function openNewTemplate() {
		newTemplate = true;
		newTemplateFields = [{ key: '', type: 'string', value: '' }];
	}
</script>

<svelte:head>
	<title>Settings – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Settings"
	description="Configure outputs, inputs, templates, and global variables."
/>

<div class="settings-layout">
	<aside class="settings-sidebar">
		<nav class="settings-nav">
			<a href="/settings?section=outputs" class="settings-nav-link {currentSection === 'outputs' ? 'settings-nav-link-active' : ''}">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
				</svg>
				Outputs
			</a>
			<a href="/settings?section=inputs" class="settings-nav-link {currentSection === 'inputs' ? 'settings-nav-link-active' : ''}">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
				</svg>
				Inputs
			</a>
			<a href="/settings?section=templates" class="settings-nav-link {currentSection === 'templates' ? 'settings-nav-link-active' : ''}">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5v-7.5H8.25v7.5z" />
				</svg>
				Templates
			</a>
			<a href="/settings?section=globals" class="settings-nav-link {currentSection === 'globals' ? 'settings-nav-link-active' : ''}">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
				</svg>
				Globals
			</a>
		</nav>
	</aside>
	<div class="settings-content">

{#if currentSection === 'outputs'}
<!-- Outputs (Webhook URLs) -->
<section class="mt-8 " id="settings-outputs">
	<div class="mb-6 w-full overflow-hidden rounded-xl bg-[var(--surface)]">
		<img src="/Send.svg" alt="Outputs: send content to webhooks" class="block max-w-full h-auto object-contain" />
	</div>
	<h2 class="text-lg font-medium text-[var(--text)]">Outputs</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Webhook endpoints for scheduled posts. Each can have an API key (x-make-apikey) and optional HTTP headers.</p>

	{#if (form as { error?: string })?.error}
		<div class="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" role="alert">
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
							<input id="edit-webhook-name" type="text" name="name" value={webhook.name} required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
						</div>
						<div>
							<label for="edit-webhook-url" class="block text-sm font-medium text-[var(--text)]">URL</label>
							<input id="edit-webhook-url" type="url" name="url" value={webhook.url} required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
						</div>
					</div>
					<div class="mt-3">
						<label for="edit-webhook-apikey" class="block text-sm font-medium text-[var(--text)]">API key (x-make-apikey header, leave blank to keep current)</label>
						<input id="edit-webhook-apikey" type="password" name="api_key" placeholder="••••••••" autocomplete="off" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
					</div>
					<div class="mt-3">
						<p class="block text-sm font-medium text-[var(--text)]">Optional headers</p>
						<p class="mt-0.5 text-xs text-[var(--text-muted)]">Extra HTTP headers sent with every request (e.g. X-Custom-Header).</p>
						<div class="mt-2 space-y-2">
							{#each editingHeaders as _, i}
								<div class="flex flex-wrap gap-2">
									<input type="text" bind:value={editingHeaders[i].key} placeholder="Header name" class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-w-[140px]" />
									<input type="text" bind:value={editingHeaders[i].value} placeholder="Value" class="flex-1 min-w-[120px] rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
									<button type="button" onclick={() => editingHeaders = editingHeaders.filter((_, j) => j !== i)} class="btn-danger-outline min-h-[44px] rounded border px-2 py-1 text-sm">Remove</button>
								</div>
							{/each}
						</div>
						<button type="button" onclick={() => editingHeaders = [...editingHeaders, { key: '', value: '' }]} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add header</button>
					</div>
					<div class="mt-3 flex gap-2">
						<button type="submit" class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white min-h-[44px]">Save</button>
						<button type="button" onclick={() => (editingWebhookId = null)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
					</div>
				</form>
			{:else}
				<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
					<div class="min-w-0 flex-1">
						<p class="font-medium text-[var(--text)]">{webhook.name}</p>
						<p class="truncate text-sm text-[var(--text-muted)]">{webhook.url}</p>
						<div class="mt-2 flex items-center gap-2">
							<span class="text-xs text-[var(--text-muted)]">ID:</span>
							<code class="rounded bg-[var(--bg)] px-1.5 py-0.5 text-xs font-mono text-[var(--text)]" title="Webhook ID for API and import callback">{webhook.id}</code>
							<button
								type="button"
								onclick={() => navigator.clipboard.writeText(webhook.id)}
								class="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
							>
								Copy
							</button>
						</div>
					</div>
					<div class="flex gap-2">
						<button type="button" onclick={() => openEditWebhook(webhook)} class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] min-w-[44px]">Edit</button>
						<form method="POST" action="?/deleteWebhook" use:enhance={({ cancel }) => { if (!confirm('Delete this webhook? Posts using it will need another webhook.')) cancel(); return () => invalidateAll(); }} class="inline">
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
						<input id="new-webhook-name" type="text" name="name" required placeholder="e.g. Slack" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
					</div>
					<div>
						<label for="new-webhook-url" class="block text-sm font-medium text-[var(--text)]">URL</label>
						<input id="new-webhook-url" type="url" name="url" required placeholder="https://..." class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
					</div>
				</div>
				<div class="mt-3">
					<label for="new-webhook-apikey" class="block text-sm font-medium text-[var(--text)]">API key (x-make-apikey header, optional)</label>
					<input id="new-webhook-apikey" type="password" name="api_key" autocomplete="off" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
				</div>
				<div class="mt-3">
					<p class="block text-sm font-medium text-[var(--text)]">Optional headers</p>
					<p class="mt-0.5 text-xs text-[var(--text-muted)]">Extra HTTP headers sent with every request.</p>
					<div class="mt-2 space-y-2">
						{#each newWebhookHeaders as _, i}
							<div class="flex flex-wrap gap-2">
								<input type="text" bind:value={newWebhookHeaders[i].key} placeholder="Header name" class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-w-[140px]" />
								<input type="text" bind:value={newWebhookHeaders[i].value} placeholder="Value" class="flex-1 min-w-[120px] rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
								<button type="button" onclick={() => newWebhookHeaders = newWebhookHeaders.filter((_, j) => j !== i)} class="btn-danger-outline min-h-[44px] rounded border px-2 py-1 text-sm">Remove</button>
							</div>
						{/each}
					</div>
					<button type="button" onclick={() => newWebhookHeaders = [...newWebhookHeaders, { key: '', value: '' }]} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add header</button>
				</div>
				<div class="mt-3 flex gap-2">
					<button type="submit" class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white min-h-[44px]">Add webhook</button>
					<button type="button" onclick={() => (newWebhook = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
				</div>
			</form>
		{/if}
	</div>
	{#if !newWebhook}
		<button type="button" onclick={openNewWebhook} class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add webhook</button>
	{/if}
</section>
{/if}

{#if currentSection === 'inputs'}
<!-- Inputs: Import callback + Post notification callbacks -->
<section class="mt-8" id="settings-inputs">
	<div class="mb-6 overflow-hidden rounded-xl bg-[var(--surface)]">
		<img src="/Receive.svg" alt="Inputs: receive callbacks" class="block h-auto object-contain" />
	</div>
	<h2 class="text-lg font-medium text-[var(--text)]">Inputs</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Inbound callbacks: import posts via JSON and receive post notifications from Make.com.</p>

	<!-- Callback token (shared by both inputs) -->
	<div class="mt-8">
		<h3 class="text-base font-medium text-[var(--text)]">Callback token</h3>
		<div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
			<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
				<p class="text-xs font-medium text-[var(--text-muted)] mb-2">Token</p>
			{#if generatedCallbackToken}
				<p class="text-xs text-[var(--text-muted)]">Save this token; it won’t be shown again.</p>
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<code class="flex-1 min-w-0 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] break-all font-mono">{generatedCallbackToken}</code>
					<button
						type="button"
						onclick={() => navigator.clipboard.writeText(generatedCallbackToken ?? '').then(() => alert('Copied to clipboard'))}
						class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
					>
						Copy
					</button>
					<button type="button" onclick={() => (generatedCallbackToken = null)} class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Dismiss</button>
				</div>
			{:else if data.callbackTokenMasked}
				<div class="flex flex-wrap items-center gap-2">
					<code class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] font-mono">{data.callbackTokenMasked}</code>
					<form method="POST" action="?/revokeCallbackToken" use:enhance={({ cancel }) => { if (!confirm('Revoke the callback token? Make.com scenarios using it will stop working until you generate a new one.')) cancel(); return async () => { generatedCallbackToken = null; await invalidateAll(); }; }} class="inline">
						<button type="submit" class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Revoke</button>
					</form>
					<form
						method="POST"
						action="?/generateCallbackToken"
						use:enhance={() => async ({ result }) => {
							if (result.type === 'success' && result.data && typeof (result.data as { token?: string }).token === 'string') {
								generatedCallbackToken = (result.data as { token: string }).token;
							}
							await invalidateAll();
						}}
						class="inline"
					>
						<button type="submit" class="rounded-lg border border-amber-500 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 min-h-[44px]">Regenerate</button>
					</form>
				</div>
				<p class="mt-1 text-xs text-[var(--text-muted)]">Regenerating invalidates the previous token.</p>
			{:else}
				<form
					method="POST"
					action="?/generateCallbackToken"
					use:enhance={() => async ({ result }) => {
						if (result.type === 'success' && result.data && typeof (result.data as { token?: string }).token === 'string') {
							generatedCallbackToken = (result.data as { token: string }).token;
						}
						await invalidateAll();
					}}
					class="inline"
				>
					<button type="submit" class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white min-h-[44px]">Generate callback token</button>
				</form>
				<p class="mt-1 text-xs text-[var(--text-muted)]">The payload sent to Make.com will include <code>callback_url</code> and <code>callback_token</code> when set.</p>
			{/if}
			</div>
			<div class="text-sm text-[var(--text-muted)]">
				<p class="mt-0">Used to authenticate the import callback and post notification callbacks below.</p>
				<p class="mt-2">Send in requests as:</p>
				<ul class="mt-1 list-disc list-inside space-y-0.5">
					<li><code class="rounded bg-[var(--bg)] px-1 text-xs">Authorization: Bearer &lt;token&gt;</code></li>
					<li>or <code class="rounded bg-[var(--bg)] px-1 text-xs">X-Callback-Token: &lt;token&gt;</code></li>
				</ul>
			</div>
		</div>
	</div>

	<!-- Import callback -->
	<div class="mt-8">
		<h3 class="text-base font-medium text-[var(--text)]">Import callback</h3>
		<div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
			<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">

				<div class="my-3 overflow-hidden rounded-lg bg-[var(--surface)]">
					<img src="/Callback_Import.svg" alt="Import callback setup" class="block h-auto object-contain" />
				</div>

				<p class="text-xs font-medium text-[var(--text-muted)] mb-2">Callback URL</p>
				{#if data.importCallbackUrl}
					<div class="flex flex-wrap items-center gap-2">
						<code class="flex-1 min-w-0 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] break-all">{data.importCallbackUrl}</code>
						<button
							type="button"
							onclick={() =>
								navigator.clipboard
									.writeText(data.importCallbackUrl ?? '')
									.then(() => alert('Copied to clipboard'))}
							class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
						>
							Copy
						</button>
					</div>
					<p class="mt-2 text-xs text-[var(--text-muted)]">
						Send <code class="rounded bg-[var(--bg)] px-1 text-xs">POST</code> with <code class="rounded bg-[var(--bg)] px-1 text-xs">Content-Type: application/json</code>.
					</p>
				{:else}
					<p class="text-xs text-[var(--text-muted)]">Set <code>APP_BASE_URL</code> to see the callback URL.</p>
				{/if}
			</div>
			<div class="text-sm text-[var(--text-muted)]">
				<p class="mt-0">Import posts from external tools (Make.com, n8n, custom scripts) by sending JSON. Use the callback token above to authenticate.</p>
				<p class="mt-2">Send <code class="rounded bg-[var(--bg)] px-1 text-xs">Authorization: Bearer &lt;token&gt;</code> or <code class="rounded bg-[var(--bg)] px-1 text-xs">X-Callback-Token: &lt;token&gt;</code>.</p>
				<p class="mt-3 font-medium text-[var(--text)]">Example request</p>
				<p class="mt-1 text-xs">Send an object with a <code class="rounded bg-[var(--bg)] px-1">posts</code> array. Each post must include <code class="rounded bg-[var(--bg)] px-1">webhook_id</code> or <code class="rounded bg-[var(--bg)] px-1">webhook_ids</code>. Webhook IDs are on the <strong>Outputs</strong> page.</p>
				<div class="mt-2 flex gap-1 border-b border-[var(--border)]">
					<button
						type="button"
						class="rounded-t border border-[var(--border)] border-b-0 px-3 py-1.5 text-xs font-medium min-h-[44px] {importExampleTab === 'json' ? 'bg-[var(--surface)] text-[var(--text)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}"
						onclick={() => (importExampleTab = 'json')}
					>JSON</button>
					<button
						type="button"
						class="rounded-t border border-[var(--border)] border-b-0 px-3 py-1.5 text-xs font-medium min-h-[44px] {importExampleTab === 'curl' ? 'bg-[var(--surface)] text-[var(--text)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}"
						onclick={() => (importExampleTab = 'curl')}
					>curl</button>
				</div>
				{#if importExampleTab === 'json'}
					<div class="relative">
						<button
							type="button"
							class="absolute top-2 right-2 rounded border border-white/30 bg-black/80 px-2 py-1 text-xs text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
							onclick={(e) => {
								const code = (e.currentTarget as HTMLButtonElement).parentElement?.querySelector('pre code');
								if (code) navigator.clipboard.writeText(code.textContent ?? '').then(() => alert('Copied to clipboard'));
							}}
						>Copy</button>
						<pre class="overflow-x-auto rounded rounded-t-none border border-[var(--border)] bg-black p-3 pr-16 text-xs text-white"><code>{`{
  "posts": [
    {
      "title": "My post title",
      "webhook_id": "<webhook-id>",
      "content": "Optional post body text.",
      "image_url": "https://example.com/image.jpg",
      "external_id": "external-123",
      "colour": "#F4F4F0",
      "schedule_ids": ["<schedule-id-1>", "<schedule-id-2>"],
      "schedule_specific": "2025-01-01T09:00:00Z",
      "fields": { "instagram.caption": "Custom caption" }
    },
    {
      "title": "Another post",
      "webhook_ids": ["<id1>", "<id2>"],
      "content": "..."
    }
  ]
}`}</code></pre>
					</div>
				{:else}
					<div class="relative">
						<button
							type="button"
							class="absolute top-2 right-2 rounded border border-white/30 bg-black/80 px-2 py-1 text-xs text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
							onclick={(e) => {
								const code = (e.currentTarget as HTMLButtonElement).parentElement?.querySelector('pre code');
								if (code) navigator.clipboard.writeText(code.textContent ?? '').then(() => alert('Copied to clipboard'));
							}}
						>Copy</button>
						<pre class="overflow-x-auto rounded rounded-t-none border border-[var(--border)] bg-black p-3 pr-16 text-xs text-white"><code>{`curl -X POST "${data.importCallbackUrl ?? 'https://your-app.com/api/callbacks/import'}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_CALLBACK_TOKEN" \\
  -d '{"posts":[{"title":"My post title","webhook_id":"<webhook-id>","content":"Optional post body."}]}'`}</code></pre>
					</div>
				{/if}
				<p class="mt-2 text-xs text-[var(--text-muted)]">
					<code class="rounded bg-[var(--bg)] px-1 text-xs">external_id</code> is an optional stable ID from your system (e.g. a post or item ID); when you send the same value again for the same webhook, PostPlan skips creating a duplicate draft.
				</p>
				<p class="mt-1 text-xs text-[var(--text-muted)]">
					<code class="rounded bg-[var(--bg)] px-1 text-xs">colour</code> (or <code class="rounded bg-[var(--bg)] px-1 text-xs">color</code>) is an optional hex colour for the post; if omitted or invalid, it defaults to <code class="rounded bg-[var(--bg)] px-1 text-xs">#F4F4F0</code>. <code class="rounded bg-[var(--bg)] px-1 text-xs">schedule_ids</code> is an optional array of schedule IDs – one post is created per schedule using the same content – and <code class="rounded bg-[var(--bg)] px-1 text-xs">schedule_specific</code> is an optional ISO datetime to schedule a single post at an exact time; if neither is set, the post is imported as an unscheduled draft.
				</p>
				<ul class="mt-2 list-disc list-inside space-y-0.5 text-xs">
					<li><code>posts[].title</code> – required</li>
					<li><code>posts[].webhook_id</code> or <code>webhook_ids</code></li>
					<li><code>posts[].content</code>, <code>image_url</code>, <code>external_id</code>, <code>colour</code>/<code>color</code>, <code>schedule_ids</code>, <code>schedule_specific</code>, <code>fields</code> – optional</li>
				</ul>
			</div>
		</div>
	</div>

	<!-- Post notification callbacks -->
	<div class="mt-10 pt-8 border-t border-[var(--border)]">
		<h3 class="text-base font-medium text-[var(--text)]">Post notification callbacks</h3>
		<div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
			<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
				<div class="my-3  overflow-hidden rounded-lg bg-[var(--surface)]">
					<img src="/Callback_Notification.svg" alt="Post notification callback setup" class="block h-auto object-contain" />
				</div>
				<p class="text-xs font-medium text-[var(--text-muted)] mb-2">Callback URL</p>
				{#if data.callbackUrl}
					<div class="flex flex-wrap items-center gap-2">
						<code class="flex-1 min-w-0 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] break-all">{data.callbackUrl}</code>
						<button
							type="button"
							onclick={() => navigator.clipboard.writeText(data.callbackUrl ?? '').then(() => alert('Copied to clipboard'))}
							class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
						>
							Copy
						</button>
					</div>
				{:else}
					<p class="text-xs text-[var(--text-muted)]">Set <code>APP_BASE_URL</code> in your environment to see the callback URL.</p>
				{/if}
				<p class="mt-2 text-xs text-[var(--text-muted)]">Use the callback token from the section above when calling this URL from Make.com.</p>
			</div>
			<div class="text-sm text-[var(--text-muted)]">
				<p class="mt-0">When a post is sent to Make.com/N8N/Zapier, your scenario can notify PostPlan that the post reached a certain step (e.g. published to Instagram). PostPlan records these stages on the post edit page.</p>
				<p class="mt-3 font-medium text-[var(--text)]">How to use in Make.com</p>
				<ol class="mt-2 list-decimal list-inside space-y-2 text-xs">
					<li>PostPlan sends <code class="rounded bg-[var(--bg)] px-1">callback_url</code>, <code class="rounded bg-[var(--bg)] px-1">callback_token</code>, and <code class="rounded bg-[var(--bg)] px-1">id</code> in the webhook payload.</li>
					<li>After your scenario runs (e.g. publishes the post), add <strong>HTTP – Make a request</strong>.</li>
					<li>URL: the <code class="rounded bg-[var(--bg)] px-1">callback_url</code> from the payload (or copy from the left).</li>
					<li>Method: <code class="rounded bg-[var(--bg)] px-1">POST</code>. Header: <code class="rounded bg-[var(--bg)] px-1">Authorization: Bearer {'{{callback_token}}'}</code>.</li>
					<li>Body (raw JSON): use <code class="rounded bg-[var(--bg)] px-1">post_id</code> (webhook <code class="rounded bg-[var(--bg)] px-1">id</code>) and any <code class="rounded bg-[var(--bg)] px-1">stage</code> label.</li>
					<li>Completed stages appear on the post edit page under Make.com stages.</li>
				</ol>
				<p class="mt-3 font-medium text-[var(--text)]">Example request</p>
				<div class="mt-2 flex gap-1 border-b border-[var(--border)]">
					<button
						type="button"
						class="rounded-t border border-[var(--border)] border-b-0 px-3 py-1.5 text-xs font-medium min-h-[44px] {postNotificationExampleTab === 'json' ? 'bg-[var(--surface)] text-[var(--text)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}"
						onclick={() => (postNotificationExampleTab = 'json')}
					>JSON</button>
					<button
						type="button"
						class="rounded-t border border-[var(--border)] border-b-0 px-3 py-1.5 text-xs font-medium min-h-[44px] {postNotificationExampleTab === 'curl' ? 'bg-[var(--surface)] text-[var(--text)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}"
						onclick={() => (postNotificationExampleTab = 'curl')}
					>curl</button>
				</div>
				{#if postNotificationExampleTab === 'json'}
					<div class="relative">
						<button
							type="button"
							class="absolute top-2 right-2 rounded border border-white/30 bg-black/80 px-2 py-1 text-xs text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
							onclick={(e) => {
								const code = (e.currentTarget as HTMLButtonElement).parentElement?.querySelector('pre code');
								if (code) navigator.clipboard.writeText(code.textContent ?? '').then(() => alert('Copied to clipboard'));
							}}
						>Copy</button>
						<pre class="overflow-x-auto rounded rounded-t-none border border-[var(--border)] bg-black p-3 pr-16 text-xs text-white"><code>{`{
  "post_id": "uuid-of-the-post",
  "stage": "instagram_published"
}`}</code></pre>
					</div>
				{:else}
					<div class="relative">
						<button
							type="button"
							class="absolute top-2 right-2 rounded border border-white/30 bg-black/80 px-2 py-1 text-xs text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
							onclick={(e) => {
								const code = (e.currentTarget as HTMLButtonElement).parentElement?.querySelector('pre code');
								if (code) navigator.clipboard.writeText(code.textContent ?? '').then(() => alert('Copied to clipboard'));
							}}
						>Copy</button>
						<pre class="overflow-x-auto rounded rounded-t-none border border-[var(--border)] bg-black p-3 pr-16 text-xs text-white"><code>{`curl -X POST "${data.callbackUrl ?? 'https://your-app.com/api/callbacks/stage'}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_CALLBACK_TOKEN" \\
  -d '{"post_id":"uuid-of-the-post","stage":"instagram_published"}'`}</code></pre>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
{/if}

{#if currentSection === 'templates'}
<!-- Custom field templates -->
<section class="mt-10" id="settings-templates">
	<h2 class="text-lg font-medium text-[var(--text)]">Custom field templates</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Reusable field structures for post custom fields. Use dotted keys for nested output (e.g. instagram.title).</p>

	<div class="mt-4 space-y-3">
		{#each data.templates as t}
			{#if editingTemplateId === t.id}
				<form
					method="POST"
					action="?/updateTemplate"
					use:enhance={() => {
						editingTemplateId = null;
						return invalidateAll();
					}}
					class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
				>
					<input type="hidden" name="id" value={t.id} />
					<input type="hidden" name="fields_json" value={JSON.stringify(editingTemplateFields)} />
					<div>
						<label for="edit-template-name" class="block text-sm font-medium text-[var(--text)]">Template name</label>
						<input id="edit-template-name" type="text" name="name" value={t.name} required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
					</div>
					<div class="mt-3 space-y-2">
						{#each editingTemplateFields as _, i}
							<div class="flex flex-wrap gap-2">
								<input type="text" bind:value={editingTemplateFields[i].key} placeholder="field.path or array[0]" class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-w-[180px]" />
								<select bind:value={editingTemplateFields[i].type} class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]">
									<option value="string">string</option>
									<option value="number">number</option>
									<option value="boolean">boolean</option>
									<option value="json">json</option>
								</select>
								<input type="text" bind:value={editingTemplateFields[i].value} placeholder="Value (JSON for json type)" class="flex-1 min-w-[200px] rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
								<button type="button" onclick={() => editingTemplateFields = editingTemplateFields.filter((_, j) => j !== i)} class="btn-danger-outline min-h-[44px] rounded border px-2 py-1 text-sm">Remove</button>
							</div>
						{/each}
					</div>
					<button type="button" onclick={() => editingTemplateFields = [...editingTemplateFields, { key: '', type: 'string', value: '' }]} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add field</button>
					<div class="mt-3 flex gap-2">
						<button type="submit" class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white min-h-[44px]">Save</button>
						<button type="button" onclick={() => (editingTemplateId = null)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
					</div>
				</form>
			{:else}
				<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p class="font-medium text-[var(--text)]">{t.name}</p>
							<p class="text-xs text-[var(--text-muted)]">{t.is_default ? 'Default template' : 'User template'}</p>
						</div>
						<div class="flex gap-2">
							{#if !t.is_default}
								<button type="button" onclick={() => openEditTemplate(t)} class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] min-w-[44px]">Edit</button>
								<form method="POST" action="?/deleteTemplate" use:enhance={({ cancel }) => { if (!confirm('Delete this template? This cannot be undone.')) cancel(); return () => invalidateAll(); }} class="inline">
									<input type="hidden" name="id" value={t.id} />
									<button type="submit" class="btn-danger-outline min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm">Delete</button>
								</form>
							{/if}
						</div>
					</div>
					<div class="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
						{#each t.fields as field}
							<div><code>{field.key}</code> ({field.type})</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}

		{#if newTemplate}
			<form
				method="POST"
				action="?/createTemplate"
				use:enhance={() => {
					newTemplate = false;
					return invalidateAll();
				}}
				class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
			>
				<input type="hidden" name="fields_json" value={JSON.stringify(newTemplateFields)} />
				<div>
					<label for="new-template-name" class="block text-sm font-medium text-[var(--text)]">Template name</label>
					<input id="new-template-name" type="text" name="name" required placeholder="e.g. Instagram Reel" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
				</div>
				<div class="mt-3 space-y-2">
					{#each newTemplateFields as _, i}
						<div class="flex flex-wrap gap-2">
							<input type="text" bind:value={newTemplateFields[i].key} placeholder="field.path or array[0]" class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-w-[180px]" />
							<select bind:value={newTemplateFields[i].type} class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]">
								<option value="string">string</option>
								<option value="number">number</option>
								<option value="boolean">boolean</option>
								<option value="json">json</option>
							</select>
							<input type="text" bind:value={newTemplateFields[i].value} placeholder="Value (JSON for json type)" class="flex-1 min-w-[200px] rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
							<button type="button" onclick={() => newTemplateFields = newTemplateFields.filter((_, j) => j !== i)} class="btn-danger-outline min-h-[44px] rounded border px-2 py-1 text-sm">Remove</button>
						</div>
					{/each}
				</div>
				<button type="button" onclick={() => newTemplateFields = [...newTemplateFields, { key: '', type: 'string', value: '' }]} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add field</button>
				<div class="mt-3 flex gap-2">
					<button type="submit" class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white min-h-[44px]">Add template</button>
					<button type="button" onclick={() => (newTemplate = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
				</div>
			</form>
		{/if}
	</div>

	{#if !newTemplate}
		<button type="button" onclick={openNewTemplate} class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add template</button>
	{/if}
</section>
{/if}

{#if currentSection === 'globals'}
<!-- Global variables -->
<section class="mt-10" id="settings-globals">
	<h2 class="text-lg font-medium text-[var(--text)]">Global variables</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Key-value pairs merged into every webhook JSON payload.</p>

	<div class="mt-4 space-y-3">
		{#each data.globals as g}
			{#if editingGlobalId === g.id}
				<form
					method="POST"
					action="?/updateGlobal"
					use:enhance={() => {
						editingGlobalId = null;
						return invalidateAll();
					}}
					class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
				>
					<input type="hidden" name="id" value={g.id} />
					<div class="grid gap-3 sm:grid-cols-3">
						<div>
							<label for="edit-global-key" class="block text-sm font-medium text-[var(--text)]">Key</label>
							<input id="edit-global-key" type="text" name="key" value={g.key} required class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
						</div>
						<div>
							<label for="edit-global-value" class="block text-sm font-medium text-[var(--text)]">Value</label>
							<input id="edit-global-value" type="text" name="value" value={g.value ?? ''} class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
						</div>
						<div>
							<label for="edit-global-type" class="block text-sm font-medium text-[var(--text)]">Type</label>
							<select id="edit-global-type" name="type" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]">
								<option value="string" selected={g.type === 'string'}>string</option>
								<option value="number" selected={g.type === 'number'}>number</option>
								<option value="boolean" selected={g.type === 'boolean'}>boolean</option>
								<option value="json" selected={g.type === 'json'}>json</option>
							</select>
						</div>
					</div>
					<div class="mt-3 flex gap-2">
						<button type="submit" class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white min-h-[44px]">Save</button>
						<button type="button" onclick={() => (editingGlobalId = null)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
					</div>
				</form>
			{:else}
				<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
					<div class="min-w-0">
						<p class="font-medium text-[var(--text)]">{g.key}</p>
						<p class="truncate text-sm text-[var(--text-muted)]">{g.value ?? '(empty)'}</p>
					</div>
					<div class="flex gap-2">
						<button type="button" onclick={() => (editingGlobalId = g.id)} class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] min-w-[44px]">Edit</button>
						<form method="POST" action="?/deleteGlobal" use:enhance={({ cancel }) => { if (!confirm(`Delete global variable "${g.key}"? Templates or payloads that use it may show wrong values until you update them.`)) cancel(); return () => invalidateAll(); }} class="inline">
							<input type="hidden" name="id" value={g.id} />
							<button type="submit" class="btn-danger-outline min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm">Delete</button>
						</form>
					</div>
				</div>
			{/if}
		{/each}

		{#if newGlobal}
			<form
				method="POST"
				action="?/createGlobal"
				use:enhance={() => {
					newGlobal = false;
					return invalidateAll();
				}}
				class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
			>
				<div class="grid gap-3 sm:grid-cols-3">
					<div>
						<label for="new-global-key" class="block text-sm font-medium text-[var(--text)]">Key</label>
						<input id="new-global-key" type="text" name="key" required placeholder="e.g. source" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
					</div>
					<div>
						<label for="new-global-value" class="block text-sm font-medium text-[var(--text)]">Value</label>
						<input id="new-global-value" type="text" name="value" placeholder="e.g. postplan" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]" />
					</div>
					<div>
						<label for="new-global-type" class="block text-sm font-medium text-[var(--text)]">Type</label>
						<select id="new-global-type" name="type" class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]">
							<option value="string">string</option>
							<option value="number">number</option>
							<option value="boolean">boolean</option>
							<option value="json">json</option>
						</select>
					</div>
				</div>
				<div class="mt-3 flex gap-2">
					<button type="submit" class="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white min-h-[44px]">Add variable</button>
					<button type="button" onclick={() => (newGlobal = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
				</div>
			</form>
		{/if}
	</div>
	{#if !newGlobal}
		<button type="button" onclick={() => (newGlobal = true)} class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add variable</button>
	{/if}
</section>
{/if}

	</div>
</div>

<style>
	.settings-layout {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	@media (min-width: 1024px) {
		.settings-layout {
			flex-direction: row;
			align-items: flex-start;
		}
		.settings-sidebar {
			width: 220px;
			flex-shrink: 0;
		}
		.settings-content {
			flex: 1;
			min-width: 0;
		}
	}
	.settings-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	@media (min-width: 1024px) {
		.settings-nav {
			flex-direction: column;
		}
	}
	.settings-nav-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: flex-start;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-muted);
		border: 1px solid transparent;
		text-decoration: none;
	}
	.settings-nav-link:hover {
		color: var(--text);
		border-color: var(--primary-border-soft);
		background: var(--primary-soft);
	}
	.settings-nav-link-active {
		color: var(--primary);
		border-color: var(--primary-border-soft);
		background: var(--primary-soft);
	}
</style>
