<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { tick } from 'svelte';

	let {
		open = $bindable(false),
		idPrefix,
		headersJson = $bindable('[]'),
		onCreated
	}: {
		open?: boolean;
		idPrefix: string;
		headersJson?: string;
		onCreated: (webhookId: string) => void;
	} = $props();

	const titleId = $derived(`${idPrefix}-add-output-webhook-title`);
	const nameId = $derived(`${idPrefix}-modal-wh-name`);
	const urlId = $derived(`${idPrefix}-modal-wh-url`);
	const apikeyId = $derived(`${idPrefix}-modal-wh-apikey`);
	const headersId = $derived(`${idPrefix}-modal-wh-headers`);

	function onBackdropClick() {
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') open = false;
	}

	$effect(() => {
		if (!open) return;
		void tick().then(() => document.getElementById(nameId)?.focus());
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			aria-label="Close dialog"
			onclick={onBackdropClick}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			tabindex="-1"
			class="relative z-10 max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl outline-none"
		>
			<div class="mb-4 flex items-start justify-between gap-3">
				<h3 id={titleId} class="text-base font-semibold text-[var(--text)]">Add output webhook</h3>
				<button
					type="button"
					onclick={() => (open = false)}
					class="shrink-0 rounded-lg border border-transparent px-2 py-1 text-sm text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] min-h-[44px] min-w-[44px]"
					aria-label="Close"
				>
					×
				</button>
			</div>
			<p class="mb-4 text-sm text-[var(--text-muted)]">
				Destination URL for your automation (e.g. Make.com). You can select it for this import after saving.
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
							onCreated((result.data as { webhookId: string }).webhookId);
							open = false;
						}
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="headers_json" value={headersJson} />
				<div class="grid gap-3 sm:grid-cols-2">
					<div>
						<label for={nameId} class="block text-sm font-medium text-[var(--text)]">Name</label>
						<input
							id={nameId}
							type="text"
							name="name"
							required
							placeholder="e.g. Make.com"
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
						/>
					</div>
					<div>
						<label for={urlId} class="block text-sm font-medium text-[var(--text)]">URL</label>
						<input
							id={urlId}
							type="url"
							name="url"
							required
							placeholder="https://..."
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
						/>
					</div>
				</div>
				<div>
					<label for={apikeyId} class="block text-sm font-medium text-[var(--text)]">API key (x-make-apikey, optional)</label>
					<input
						id={apikeyId}
						type="password"
						name="api_key"
						autocomplete="off"
						class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)] min-h-[44px]"
					/>
				</div>
				<div>
					<label for={headersId} class="block text-sm font-medium text-[var(--text)]">Optional headers (JSON array)</label>
					<p class="mt-0.5 text-xs text-[var(--text-muted)]">{'e.g. [{"key":"X-Custom","value":"..."}]'}</p>
					<textarea
						id={headersId}
						bind:value={headersJson}
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
						onclick={() => (open = false)}
						class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] transition-colors"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
