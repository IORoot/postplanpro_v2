<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	// Make.com callback: show full token once after generation
	let generatedCallbackToken = $state<string | null>(null);

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

<h1 class="text-2xl font-bold text-[var(--text)]">Settings</h1>
<p class="mt-1 text-sm text-[var(--text-muted)]">Configure webhook URLs and global variables sent with every request.</p>

<!-- Webhooks -->
<section class="mt-8">
	<h2 class="text-lg font-medium text-[var(--text)]">Webhook URLs</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">Target endpoints for scheduled posts. Each can have an API key (x-make-apikey) and optional HTTP headers.</p>

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
									<button type="button" onclick={() => editingHeaders = editingHeaders.filter((_, j) => j !== i)} class="rounded border border-red-400 px-2 py-1 text-sm text-red-800 dark:border-red-500 dark:text-red-200 min-h-[44px]">Remove</button>
								</div>
							{/each}
						</div>
						<button type="button" onclick={() => editingHeaders = [...editingHeaders, { key: '', value: '' }]} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add header</button>
					</div>
					<div class="mt-3 flex gap-2">
						<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]">Save</button>
						<button type="button" onclick={() => (editingWebhookId = null)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
					</div>
				</form>
			{:else}
				<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
					<div class="min-w-0">
						<p class="font-medium text-[var(--text)]">{webhook.name}</p>
						<p class="truncate text-sm text-[var(--text-muted)]">{webhook.url}</p>
					</div>
					<div class="flex gap-2">
						<button type="button" onclick={() => openEditWebhook(webhook)} class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] min-w-[44px]">Edit</button>
						<form method="POST" action="?/deleteWebhook" use:enhance={({ cancel }) => { if (!confirm('Delete this webhook? Posts using it will need another webhook.')) cancel(); return () => invalidateAll(); }} class="inline">
							<input type="hidden" name="id" value={webhook.id} />
							<button type="submit" class="rounded-lg border border-red-400 px-3 py-2 text-sm text-red-800 hover:bg-red-100 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/40 min-h-[44px] min-w-[44px]">Delete</button>
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
								<button type="button" onclick={() => newWebhookHeaders = newWebhookHeaders.filter((_, j) => j !== i)} class="rounded border border-red-400 px-2 py-1 text-sm text-red-800 dark:border-red-500 dark:text-red-200 min-h-[44px]">Remove</button>
							</div>
						{/each}
					</div>
					<button type="button" onclick={() => newWebhookHeaders = [...newWebhookHeaders, { key: '', value: '' }]} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add header</button>
				</div>
				<div class="mt-3 flex gap-2">
					<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]">Add webhook</button>
					<button type="button" onclick={() => (newWebhook = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
				</div>
			</form>
		{/if}
	</div>
	{#if !newWebhook}
		<button type="button" onclick={openNewWebhook} class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add webhook</button>
	{/if}
</section>

<!-- Make.com callbacks -->
<section class="mt-10">
	<h2 class="text-lg font-medium text-[var(--text)]">Make.com callbacks</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">When a post is sent to Make.com, your scenario can notify PostPlan that the post reached a certain step (e.g. “published to Instagram”). PostPlan records these stages and shows them on the post’s edit page.</p>

	<div class="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
		{#if data.callbackUrl}
			<div>
				<p class="block text-sm font-medium text-[var(--text)]">Callback URL</p>
				<div class="mt-1 flex flex-wrap items-center gap-2">
					<code class="flex-1 min-w-0 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] break-all">{data.callbackUrl}</code>
					<button
						type="button"
						onclick={() => navigator.clipboard.writeText(data.callbackUrl ?? '').then(() => alert('Copied to clipboard'))}
						class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
					>
						Copy
					</button>
				</div>
			</div>
		{:else}
			<p class="text-sm text-[var(--text-muted)]">Set <code>APP_BASE_URL</code> in your environment to see the callback URL.</p>
		{/if}

		<div>
			<p class="block text-sm font-medium text-[var(--text)]">Callback token</p>
			{#if generatedCallbackToken}
				<p class="mt-1 text-xs text-[var(--text-muted)]">Save this token; it won’t be shown again. Use it in Make.com as <code>Authorization: Bearer &lt;token&gt;</code>.</p>
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<code class="flex-1 min-w-0 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] break-all font-mono">{generatedCallbackToken}</code>
					<button
						type="button"
						onclick={() => navigator.clipboard.writeText(generatedCallbackToken ?? '').then(() => alert('Copied to clipboard'))}
						class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
					>
						Copy
					</button>
					<button type="button" onclick={() => (generatedCallbackToken = null)} class="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Dismiss</button>
				</div>
			{:else if data.callbackTokenMasked}
				<div class="mt-2 flex flex-wrap items-center gap-2">
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
				<p class="mt-1 text-xs text-[var(--text-muted)]">Use this token in Make.com: <code>Authorization: Bearer &lt;token&gt;</code>. Regenerating invalidates the previous token.</p>
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
					class="mt-2"
				>
					<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]">Generate callback token</button>
				</form>
				<p class="mt-1 text-xs text-[var(--text-muted)]">Generate a token so Make.com can authenticate when calling the callback URL. The payload sent to Make.com will include <code>callback_url</code> and <code>callback_token</code> when set.</p>
			{/if}
		</div>

		<!-- How to use the callback -->
		<div class="mt-6 pt-4 border-t border-[var(--border)]">
			<h3 class="text-sm font-semibold text-[var(--text)]">How to use the callback in Make.com</h3>
			<ol class="mt-2 list-decimal list-inside space-y-2 text-sm text-[var(--text-muted)]">
				<li>When PostPlan sends a post to your webhook, the payload includes <code class="rounded bg-[var(--bg)] px-1 text-xs">callback_url</code>, <code class="rounded bg-[var(--bg)] px-1 text-xs">callback_token</code>, and <code class="rounded bg-[var(--bg)] px-1 text-xs">id</code> (the post ID).</li>
				<li>After your scenario does something with the post (e.g. publishes it), add an <strong>HTTP – Make a request</strong> module.</li>
				<li>Set <strong>URL</strong> to the <code class="rounded bg-[var(--bg)] px-1 text-xs">callback_url</code> from the webhook (or copy it from above).</li>
				<li>Set <strong>Method</strong> to <code class="rounded bg-[var(--bg)] px-1 text-xs">POST</code>.</li>
				<li>Add a header: <code class="rounded bg-[var(--bg)] px-1 text-xs">Authorization</code> = <code class="rounded bg-[var(--bg)] px-1 text-xs">Bearer {'{{callback_token}}'}</code> (use the token from the webhook payload).</li>
				<li>Set <strong>Body type</strong> to raw JSON and use:
					<pre class="mt-2 overflow-x-auto rounded border border-[var(--border)] bg-[var(--bg)] p-3 text-xs text-[var(--text)]"><code>{'{"post_id": "{{id}}",\n  "stage": "instagram_published"}'}</code></pre>
					Use the webhook’s <code class="rounded bg-[var(--bg)] px-1 text-xs">id</code> as <code class="rounded bg-[var(--bg)] px-1 text-xs">post_id</code>, and any label you like for <code class="rounded bg-[var(--bg)] px-1 text-xs">stage</code> (e.g. <code class="rounded bg-[var(--bg)] px-1 text-xs">facebook_published</code>, <code class="rounded bg-[var(--bg)] px-1 text-xs">reviewed</code>).
				</li>
				<li>Run the scenario. Completed stages appear on the post’s edit page under “Make.com stages”.</li>
			</ol>
		</div>
	</div>
</section>

<!-- Custom field templates -->
<section class="mt-10">
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
								<button type="button" onclick={() => editingTemplateFields = editingTemplateFields.filter((_, j) => j !== i)} class="rounded border border-red-400 px-2 py-1 text-sm text-red-800 dark:border-red-500 dark:text-red-200 min-h-[44px]">Remove</button>
							</div>
						{/each}
					</div>
					<button type="button" onclick={() => editingTemplateFields = [...editingTemplateFields, { key: '', type: 'string', value: '' }]} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add field</button>
					<div class="mt-3 flex gap-2">
						<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]">Save</button>
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
									<button type="submit" class="rounded-lg border border-red-400 px-3 py-2 text-sm text-red-800 hover:bg-red-100 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/40 min-h-[44px] min-w-[44px]">Delete</button>
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
							<button type="button" onclick={() => newTemplateFields = newTemplateFields.filter((_, j) => j !== i)} class="rounded border border-red-400 px-2 py-1 text-sm text-red-800 dark:border-red-500 dark:text-red-200 min-h-[44px]">Remove</button>
						</div>
					{/each}
				</div>
				<button type="button" onclick={() => newTemplateFields = [...newTemplateFields, { key: '', type: 'string', value: '' }]} class="mt-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add field</button>
				<div class="mt-3 flex gap-2">
					<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]">Add template</button>
					<button type="button" onclick={() => (newTemplate = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
				</div>
			</form>
		{/if}
	</div>

	{#if !newTemplate}
		<button type="button" onclick={openNewTemplate} class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add template</button>
	{/if}
</section>

<!-- Global variables -->
<section class="mt-10">
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
						<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]">Save</button>
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
						<form method="POST" action="?/deleteGlobal" use:enhance={({ cancel }) => { if (!confirm('Delete this global variable?')) cancel(); return () => invalidateAll(); }} class="inline">
							<input type="hidden" name="id" value={g.id} />
							<button type="submit" class="rounded-lg border border-red-400 px-3 py-2 text-sm text-red-800 hover:bg-red-100 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-900/40 min-h-[44px] min-w-[44px]">Delete</button>
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
					<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]">Add variable</button>
					<button type="button" onclick={() => (newGlobal = false)} class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">Cancel</button>
				</div>
			</form>
		{/if}
	</div>
	{#if !newGlobal}
		<button type="button" onclick={() => (newGlobal = true)} class="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]">+ Add variable</button>
	{/if}
</section>
