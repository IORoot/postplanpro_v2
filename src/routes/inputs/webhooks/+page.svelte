<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import InboundAuthTokenCard from '$lib/components/InboundAuthTokenCard.svelte';
	import { syncDiagramDefaultWithViewport } from '$lib/syncDiagramDefaultWithViewport.js';
	import { showInputAnimations } from '$lib/stores/uiPrefs.js';

	let { data, form } = $props();

	let importExampleTab = $state<'json' | 'curl'>('json');
	let showAnimImportWebhook = $state(false);

	syncDiagramDefaultWithViewport((open) => {
		showAnimImportWebhook = open;
	});
</script>

<svelte:head>
	<title>Webhooks – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Webhooks"
	description="Inbound import webhook: send JSON to create posts from Make.com, n8n, or your own scripts. Same webhook token as post notifications under Callbacks in the Inputs sidebar."
/>

{#if $showInputAnimations}
	<div class="mt-6">
		<div class="flex items-start justify-between gap-4">
			<h2 class="text-sm font-medium text-[var(--text-muted)]">How imports flow</h2>
			<button
				type="button"
				onclick={() => (showAnimImportWebhook = !showAnimImportWebhook)}
				class="shrink-0 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
			>
				{showAnimImportWebhook ? 'Hide' : 'Show'} diagram
			</button>
		</div>
		{#if showAnimImportWebhook}
			<div class="mt-3 overflow-hidden rounded-lg border border-[var(--border)] bg-black shadow-sm">
				<iframe
					title="Animated diagram: webhook import from spreadsheet to calendar"
					class="block h-[min(40vh,520px)] w-full min-h-[200px] border-0"
					src="/animation_import_webhook.html"
					loading="eager"
				></iframe>
			</div>
		{/if}
	</div>
{/if}

<InboundAuthTokenCard callbackTokenMasked={data.callbackTokenMasked} {form}>
	{#snippet help()}
		<p class="mt-0">
			Used to authenticate this <strong>import webhook</strong> and
			<strong>post notification callbacks</strong> on
			<a href="/inputs?section=callbacks" class="font-medium text-[var(--primary)] hover:underline">Inputs → Callbacks</a>.
		</p>
		<p class="mt-2">Send in requests as:</p>
		<ul class="mt-1 list-inside list-disc space-y-0.5">
			<li><code class="rounded bg-[var(--bg)] px-1 text-xs">X-API-KEY: &lt;token&gt;</code></li>
		</ul>
	{/snippet}
</InboundAuthTokenCard>

<div class="mt-8">
	<h2 class="text-lg font-medium text-[var(--text)]">Import webhook</h2>
	<p class="mt-1 text-sm text-[var(--text-muted)]">
		One HTTPS endpoint that accepts JSON and creates posts in your account.
	</p>
	<div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
		<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
			<p class="mb-2 text-xs font-medium text-[var(--text-muted)]">Webhook URL</p>
			{#if data.importCallbackUrl}
				<div class="flex flex-wrap items-center gap-2">
					<code class="min-w-0 flex-1 break-all rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
						>{data.importCallbackUrl}</code
					>
					<button
						type="button"
						onclick={() =>
							navigator.clipboard.writeText(data.importCallbackUrl ?? '').then(() => alert('Copied to clipboard'))}
						class="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
					>
						Copy
					</button>
				</div>
				<p class="mt-2 text-xs text-[var(--text-muted)]">
					Send <code class="rounded bg-[var(--bg)] px-1 text-xs">POST</code> with
					<code class="rounded bg-[var(--bg)] px-1 text-xs">Content-Type: application/json</code>.
				</p>
			{:else}
				<p class="text-xs text-[var(--text-muted)]">Set <code>APP_BASE_URL</code> to see the webhook URL.</p>
			{/if}
		</div>
		<div class="text-sm text-[var(--text-muted)]">
			<p class="mt-0">
				Create posts from external tools by sending JSON. Use the webhook token above to authenticate.
			</p>
			<p class="mt-2">
				Send <code class="rounded bg-[var(--bg)] px-1 text-xs">X-API-KEY: &lt;token&gt;</code>.
			</p>
			<p class="mt-3 font-medium text-[var(--text)]">Example request</p>
			<p class="mt-1 text-xs">
				Send an object with a <code class="rounded bg-[var(--bg)] px-1">posts</code> array. Each post must include
				<code class="rounded bg-[var(--bg)] px-1">webhook_id</code> or
				<code class="rounded bg-[var(--bg)] px-1">webhook_ids</code>. Webhook IDs are on the
				<a href="/outputs" class="font-medium text-[var(--primary)] hover:underline">Outputs</a> page.
			</p>
			<div class="mt-2 flex gap-1 border-b border-[var(--border)]">
				<button
					type="button"
					class="min-h-[44px] rounded-t border border-[var(--border)] border-b-0 px-3 py-1.5 text-xs font-medium {importExampleTab ===
					'json'
						? 'bg-[var(--surface)] text-[var(--text)]'
						: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}"
					onclick={() => (importExampleTab = 'json')}>JSON</button
				>
				<button
					type="button"
					class="min-h-[44px] rounded-t border border-[var(--border)] border-b-0 px-3 py-1.5 text-xs font-medium {importExampleTab ===
					'curl'
						? 'bg-[var(--surface)] text-[var(--text)]'
						: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}"
					onclick={() => (importExampleTab = 'curl')}>curl</button
				>
			</div>
			{#if importExampleTab === 'json'}
				<div class="relative">
					<button
						type="button"
						class="absolute right-2 top-2 min-h-[44px] min-w-[44px] rounded border border-neutral-50/30 bg-neutral-950/80 px-2 py-1 text-xs text-neutral-50 hover:bg-neutral-50/10"
						onclick={(e) => {
							const code = (e.currentTarget as HTMLButtonElement).parentElement?.querySelector('pre code');
							if (code) navigator.clipboard.writeText(code.textContent ?? '').then(() => alert('Copied to clipboard'));
						}}>Copy</button
					>
					<pre
						class="overflow-x-auto rounded rounded-t-none border border-[var(--border)] bg-neutral-950 p-3 pr-16 text-xs text-neutral-50"><code
							>{`{
  "posts": [
    {
      "title": "My post title",
      "webhook_id": "<webhook-id>",
      "content": "Optional post body text.",
      "image_url": "https://example.com/image.jpg",
      "external_id": "external-123",
      "colour": "#f5f5f5",
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
}`}</code
						></pre>
				</div>
			{:else}
				<div class="relative">
					<button
						type="button"
						class="absolute right-2 top-2 min-h-[44px] min-w-[44px] rounded border border-neutral-50/30 bg-neutral-950/80 px-2 py-1 text-xs text-neutral-50 hover:bg-neutral-50/10"
						onclick={(e) => {
							const code = (e.currentTarget as HTMLButtonElement).parentElement?.querySelector('pre code');
							if (code) navigator.clipboard.writeText(code.textContent ?? '').then(() => alert('Copied to clipboard'));
						}}>Copy</button
					>
					<pre
						class="overflow-x-auto rounded rounded-t-none border border-[var(--border)] bg-neutral-950 p-3 pr-16 text-xs text-neutral-50"><code
							>{`curl -X POST "${data.importCallbackUrl ?? 'https://your-app.com/api/callbacks/import'}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: YOUR_WEBHOOK_TOKEN" \\
  -d '{"posts":[{"title":"My post title","webhook_id":"<webhook-id>","content":"Optional post body."}]}'`}</code
						></pre>
				</div>
			{/if}
			<p class="mt-2 text-xs text-[var(--text-muted)]">
				<code class="rounded bg-[var(--bg)] px-1 text-xs">external_id</code> is an optional stable ID from your system (e.g. a post or
				item ID); when you send the same value again for the same webhook, PostPlan skips creating a duplicate draft.
			</p>
			<p class="mt-1 text-xs text-[var(--text-muted)]">
				<code class="rounded bg-[var(--bg)] px-1 text-xs">colour</code> (or
				<code class="rounded bg-[var(--bg)] px-1 text-xs">color</code>) is an optional hex colour for the post; if omitted or invalid,
				it defaults to <code class="rounded bg-[var(--bg)] px-1 text-xs">#f5f5f5</code>.
				<code class="rounded bg-[var(--bg)] px-1 text-xs">schedule_ids</code> is an optional array of schedule IDs – one post is
				created per schedule using the same content – and
				<code class="rounded bg-[var(--bg)] px-1 text-xs">schedule_specific</code> is an optional ISO datetime to schedule a single post
				at an exact time; if neither is set, the post is imported as an unscheduled draft.
			</p>
			<ul class="mt-2 list-inside list-disc space-y-0.5 text-xs">
				<li><code>posts[].title</code> – required</li>
				<li><code>posts[].webhook_id</code> or <code>webhook_ids</code></li>
				<li>
					<code>posts[].content</code>, <code>image_url</code>, <code>external_id</code>, <code>colour</code>/<code>color</code>,
					<code>schedule_ids</code>, <code>schedule_specific</code>, <code>fields</code> – optional
				</li>
			</ul>
		</div>
	</div>
</div>
