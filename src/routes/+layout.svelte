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
			class="fixed left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow sm md:hidden"
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
			<div class="mx-2 pt-2 mb-4 md:mx-4 md:pt-4 md:mb-4 flex min-h-[calc(100vh-2rem)] flex-col md:min-h-[calc(100vh-3rem)]">
				<div class="content-area flex flex-1 flex-col rounded-xl border border-[var(--sidebar-border)] bg-[var(--surface)]">
					<div class="flex-1 px-4 pb-8 pt-16 md:px-6 md:pt-6">
						{@render children()}
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>
