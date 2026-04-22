<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();

	const links = [
		{ href: '/admin/users', label: 'Users' },
		{ href: '/admin/stripe', label: 'Stripe' },
		{ href: '/admin/status', label: 'Status' }
	] as const;
</script>

<div class="flex flex-col gap-6 md:flex-row md:gap-8">
	<nav
		class="flex shrink-0 flex-row gap-1 rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)]/40 p-1 md:w-44 md:flex-col md:gap-0.5 md:border-0 md:bg-transparent md:p-0"
		aria-label="Admin sections"
	>
		{#each links as link}
			{@const active =
				$page.url.pathname === link.href || $page.url.pathname.startsWith(link.href + '/')}
			<a
				href={link.href}
				class="min-h-[44px] rounded-md px-3 py-2.5 text-center text-sm font-medium md:text-left {active
					? 'bg-[var(--primary)] text-white'
					: 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}"
			>
				{link.label}
			</a>
		{/each}
	</nav>
	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
