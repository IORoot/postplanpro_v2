<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let {
		callbackTokenMasked,
		form,
		help
	}: {
		callbackTokenMasked: string | null;
		form: unknown;
		help: Snippet;
	} = $props();

	let generatedCallbackToken = $state<string | null>(null);

	$effect(() => {
		const token = (form as { token?: string } | null)?.token;
		if (typeof token === 'string') generatedCallbackToken = token;
	});
</script>

<div class="mt-8">
	<h3 class="text-base font-medium text-[var(--text)]">Webhook token</h3>
	<div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
		<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
			<p class="mb-2 text-xs font-medium text-[var(--text-muted)]">Token</p>
			{#if generatedCallbackToken}
				<p class="text-xs text-[var(--text-muted)]">Save this token; it won’t be shown again.</p>
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<code
						class="min-w-0 flex-1 break-all rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)]"
						>{generatedCallbackToken}</code
					>
					<button
						type="button"
						onclick={() =>
							navigator.clipboard.writeText(generatedCallbackToken ?? '').then(() => alert('Copied to clipboard'))}
						class="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
					>
						Copy
					</button>
					<button
						type="button"
						onclick={() => (generatedCallbackToken = null)}
						class="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
						>Dismiss</button
					>
				</div>
			{:else if callbackTokenMasked}
				<div class="flex flex-wrap items-center gap-2">
					<code class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)]"
						>{callbackTokenMasked}</code
					>
					<form
						method="POST"
						action="?/revokeCallbackToken"
						use:enhance={({ cancel }) => {
							if (
								!confirm(
									'Revoke the webhook token? Tools using it (import webhook and post notifications) will stop until you generate a new one.'
								)
							)
								cancel();
							return async () => {
								generatedCallbackToken = null;
								await invalidateAll();
							};
						}}
						class="inline"
					>
						<button
							type="submit"
							class="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
							>Revoke</button
						>
					</form>
					<form
						method="POST"
						action="?/generateCallbackToken"
						use:enhance={() =>
							async ({ result }) => {
								if (
									result.type === 'success' &&
									result.data &&
									typeof (result.data as { token?: string }).token === 'string'
								) {
									generatedCallbackToken = (result.data as { token: string }).token;
								}
								await invalidateAll();
							}}
						class="inline"
					>
						<button
							type="submit"
							class="min-h-[44px] rounded-lg border border-amber-500 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
							>Regenerate</button
						>
					</form>
				</div>
				<p class="mt-1 text-xs text-[var(--text-muted)]">Regenerating invalidates the previous token.</p>
			{:else}
				<form
					method="POST"
					action="?/generateCallbackToken"
					use:enhance={() =>
						async ({ result }) => {
							if (
								result.type === 'success' &&
								result.data &&
								typeof (result.data as { token?: string }).token === 'string'
							) {
								generatedCallbackToken = (result.data as { token: string }).token;
							}
							await invalidateAll();
						}}
					class="inline"
				>
					<button type="submit" class="btn-primary min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white"
						>Generate webhook token</button
					>
				</form>
				<p class="mt-1 text-xs text-[var(--text-muted)]">
					The payload sent to Make.com will include <code>callback_url</code> and <code>callback_token</code> when set.
				</p>
			{/if}
		</div>
		<div class="text-sm text-[var(--text-muted)]">
			{@render help()}
		</div>
	</div>
</div>
