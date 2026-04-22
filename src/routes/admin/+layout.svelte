<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();

	/**
	 * MDI path data (24×24) — browse names at [MDI Sandbox](https://petershaggynoble.github.io/MDI-Sandbox/)
	 * and [Pictogrammers / MDI](https://pictogrammers.com/library/mdi/).
	 */
	const mdiAccountMultiple =
		'M16 17V19H2V17S2 13 9 13 16 17 16 17M12.5 7.5A3.5 3.5 0 1 0 9 11A3.5 3.5 0 0 0 12.5 7.5M15.94 13A5.32 5.32 0 0 1 18 17V19H22V17S22 13.37 15.94 13M15 4A3.39 3.39 0 0 0 13.07 4.59A5 5 0 0 1 13.07 10.41A3.39 3.39 0 0 0 15 11A3.5 3.5 0 0 0 15 4Z';
	const mdiCreditCardOutline =
		'M20,8H4V6H20M20,18H4V12H20M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z';
	const mdiServer =
		'M4,1H20A1,1 0 0,1 21,2V6A1,1 0 0,1 20,7H4A1,1 0 0,1 3,6V2A1,1 0 0,1 4,1M4,9H20A1,1 0 0,1 21,10V14A1,1 0 0,1 20,15H4A1,1 0 0,1 3,14V10A1,1 0 0,1 4,9M4,17H20A1,1 0 0,1 21,18V22A1,1 0 0,1 20,23H4A1,1 0 0,1 3,22V18A1,1 0 0,1 4,17M9,5H10V3H9V5M9,13H10V11H9V13M9,21H10V19H9V21M5,3V5H7V3H5M5,11V13H7V11H5M5,19V21H7V19H5Z';

	const links = [
		{ href: '/admin/users', label: 'Users', icon: mdiAccountMultiple },
		{ href: '/admin/stripe', label: 'Stripe', icon: mdiCreditCardOutline },
		{ href: '/admin/status', label: 'Status', icon: mdiServer }
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
				class="flex min-h-[44px] items-center justify-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium md:justify-start {active
					? 'bg-[var(--primary)] text-white'
					: 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}"
			>
				<svg
					class="h-5 w-5 shrink-0 opacity-95"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<path fill="currentColor" d={link.icon} />
				</svg>
				{link.label}
			</a>
		{/each}
	</nav>
	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
