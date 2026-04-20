<script lang="ts">
	/**
	 * Status + “no output webhook” for month/week calendar cells.
	 * Icons use MDI paths (see https://petershaggynoble.github.io/MDI-Sandbox/ ); text from `md` up.
	 */
	interface Props {
		status: string;
		hasOutputWebhook: boolean | number;
		/** When set, mobile icon row is one tap target to the post (avoids nested-link issues). */
		postHref?: string;
		/** Always show text pills (e.g. compact calendar list under grid). */
		textOnly: boolean;
		/** Hide draft/scheduled/sent/failed (week grid: only show no-webhook warning). */
		hideStatus: boolean;
	}

	let { status, hasOutputWebhook, postHref, textOnly, hideStatus }: Props = $props();

	const hooked = $derived(Boolean(hasOutputWebhook));

	function statusClass(s: string): string {
		if (s === 'draft') return 'status-draft';
		if (s === 'scheduled') return 'status-scheduled';
		if (s === 'sent') return 'status-sent';
		return 'status-failed';
	}

	function statusLabel(s: string): string {
		if (s === 'draft') return 'Draft';
		if (s === 'scheduled') return 'Scheduled';
		if (s === 'sent') return 'Sent';
		if (s === 'failed') return 'Failed';
		return s;
	}

	const noOutputClass =
		'shrink-0 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100';

	const iconWrap =
		'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-black/10 dark:border-white/10';

	const mobileRowClass = 'md:hidden inline-flex flex-wrap items-center gap-0.5 touch-manipulation';

	const mobileAria = $derived(
		hideStatus
			? !hooked
				? 'No output webhook, open post'
				: 'Open post'
			: `${statusLabel(status)}${!hooked ? ', No output webhook' : ''}, open post`
	);
</script>

<div class="inline-flex min-w-0 flex-wrap items-center gap-0.5 sm:gap-1">
	{#if !textOnly}
		{#snippet mobileIcons()}
			{#if !hideStatus}
				<span
					class={`${iconWrap} ${statusClass(status)}`}
					title={statusLabel(status)}
					role="img"
					aria-label={statusLabel(status)}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4 fill-current" aria-hidden="true">
						{#if status === 'draft'}
							<path
								d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
							/>
						{:else if status === 'scheduled'}
							<path
								d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12.5,7H11V13L16.25,16.15L17,14.92L12.5,12.25V7Z"
							/>
						{:else if status === 'sent'}
							<path
								d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M10.8,16.8L6.25,12.25L7.66,10.84L10.8,14L16.59,8.21L18,9.63L10.8,16.8Z"
							/>
						{:else if status === 'failed'}
							<path
								d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z"
							/>
						{:else}
							<path
								d="M11,15H13V13H11V15M11,11H13V7H11V11M12,2C6.47,2,2,6.5,2,12C2,17.5,6.47,22,12,22C17.5,22,22,17.5,22,12C22,6.5,17.5,2,12,2Z"
							/>
						{/if}
					</svg>
				</span>
			{/if}
			{#if !hooked}
				<span
					class="{iconWrap} border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
					title="No output webhook"
					role="img"
					aria-label="No output webhook"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4 fill-current" aria-hidden="true">
						<path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z" />
					</svg>
				</span>
			{/if}
		{/snippet}

		{#if !hideStatus || !hooked}
			{#if postHref}
				<a href={postHref} class={mobileRowClass} aria-label={mobileAria} tabindex="-1">{@render mobileIcons()}</a>
			{:else}
				<span class={mobileRowClass} role="group" aria-label={mobileAria}>{@render mobileIcons()}</span>
			{/if}
		{/if}
	{/if}

	{#if !hideStatus}
		<span
			class={(textOnly ? 'inline-flex ' : 'hidden md:inline ') +
				'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ' +
				statusClass(status)}
		>
			{status}
		</span>
	{/if}
	{#if !hooked}
		<span class={(textOnly ? 'inline-flex ' : 'hidden md:inline ') + noOutputClass} role="status">No output webhook</span>
	{/if}
</div>
