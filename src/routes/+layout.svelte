<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
import { page } from '$app/stores';
	import { initTheme } from '$lib/stores/theme.js';
	import { toggleSidebar } from '$lib/stores/sidebar.js';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { children } = $props();
	let mounted = $state(false);

	onMount(() => {
		initTheme();
		mounted = true;
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<title>PostPlan – Webhook Post Planner</title>
</svelte:head>

<div class="min-h-screen bg-[var(--bg)]">
	{#if !$page.url.pathname.startsWith('/auth') && !$page.url.pathname.startsWith('/welcome') && $page.url.pathname !== '/blocked'}
		<Sidebar />
	{/if}

	<!-- Mobile menu button -->
	{#if !$page.url.pathname.startsWith('/auth') && !$page.url.pathname.startsWith('/welcome') && $page.url.pathname !== '/blocked'}
		<button
			type="button"
			class="fixed z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow transition-[transform,background-color] [transition-duration:var(--motion-instant)] [transition-timing-function:var(--ease-out-quart)] hover:bg-[var(--surface-hover)] active:scale-95 md:hidden"
			style="left: max(1rem, env(safe-area-inset-left, 0px)); top: max(1rem, env(safe-area-inset-top, 0px));"
			aria-label="Open menu"
			onclick={toggleSidebar}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
			</svg>
		</button>
	{/if}

	<main
		class="min-h-screen { ($page.url.pathname.startsWith('/auth') || $page.url.pathname.startsWith('/welcome') || $page.url.pathname === '/blocked') ? 'bg-[var(--bg)]' : 'bg-[var(--sidebar-bg)] md:pl-[280px]' }"
	>
		{#if $page.url.pathname.startsWith('/welcome')}
			<div class="w-full">
				{@render children()}
			</div>
		{:else if $page.url.pathname.startsWith('/auth') || $page.url.pathname === '/blocked'}
			<div class="mx-auto max-w-md px-4 pb-8 pt-10">
				<div class="content-area flex flex-1 flex-col rounded-xl border border-[var(--sidebar-border)] bg-[var(--surface)]">
					<div class="flex-1 px-4 pb-8 pt-6">
						{@render children()}
					</div>
				</div>
			</div>
		{:else}
			<div class="mx-2 mb-4 flex min-h-[calc(100vh-2rem)] max-w-full min-w-0 flex-col pt-2 md:mx-4 md:mb-4 md:min-h-[calc(100vh-3rem)] md:pt-4">
				<div class="main-content-shell content-area flex min-w-0 flex-1 flex-col rounded-xl bg-[var(--surface)]">
					<div
						class="min-w-0 flex-1 px-4 pt-16 pb-[max(2rem,env(safe-area-inset-bottom,0px))] md:px-6 md:pt-6 md:pb-8"
					>
						{@render children()}
					</div>
				</div>
			</div>
		{/if}
	</main>

	<a
		href="/changelog"
		class="fixed z-40 text-[0.6875rem] tabular-nums text-[var(--text-muted)] underline-offset-2 transition-colors [transition-duration:var(--motion-instant)] hover:text-[var(--text)] hover:underline"
		style="right: max(1rem, env(safe-area-inset-right, 0px)); bottom: max(1rem, env(safe-area-inset-bottom, 0px));"
		aria-label="View changelog for version {$page.data.appVersion}"
	>
		v{$page.data.appVersion}
	</a>
</div>
