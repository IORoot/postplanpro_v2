<script lang="ts">
	import { theme, toggleTheme } from '$lib/stores/theme.js';
	import { sidebarOpen, closeSidebar } from '$lib/stores/sidebar.js';
	import { page } from '$app/stores';

	const navItems = [
		{ href: '/calendar', label: 'Calendar', icon: 'calendar' },
		{ href: '/posts', label: 'Posts', icon: 'doc' },
		{ href: '/schedules', label: 'Schedules', icon: 'clock' },
		{ href: '/reports', label: 'Reports', icon: 'chart' },
		{ href: '/bulk-create', label: 'Bulk create', icon: 'stack' },
		{ href: '/settings', label: 'Settings', icon: 'gear' }
	];

	function iconPath(icon: string) {
		const paths: Record<string, string> = {
			calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
			doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
			clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
			stack: 'M4 6h16M4 10h16M4 14h16M4 18h16',
			chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
			gear: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
		};
		return paths[icon] ?? paths.doc;
	}

	const miniDayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const sidebarCalendarSeed = $page.data.sidebarCalendar as
		| { year: number; month: number; markers: Record<string, number> }
		| null
		| undefined;
	let miniYear = $state(sidebarCalendarSeed?.year ?? new Date().getFullYear());
	let miniMonth = $state(sidebarCalendarSeed?.month ?? new Date().getMonth());
	let miniMarkers = $state<Record<string, number>>(sidebarCalendarSeed?.markers ?? {});
	let miniLoading = $state(false);

	$effect(() => {
		const seed = $page.data.sidebarCalendar as
			| { year: number; month: number; markers: Record<string, number> }
			| null
			| undefined;
		if (!seed) return;
		miniYear = seed.year;
		miniMonth = seed.month;
		miniMarkers = seed.markers;
	});

	function localDateKey(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function miniMonthGrid(): Array<{ date: Date; inMonth: boolean; hasPost: boolean; count: number }> {
		const anchor = new Date(miniYear, miniMonth, 1);
		const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
		const offsetToMonday = (monthStart.getDay() + 6) % 7;
		const gridStart = new Date(monthStart);
		gridStart.setDate(monthStart.getDate() - offsetToMonday);
		return Array.from({ length: 42 }, (_, i) => {
			const date = new Date(gridStart);
			date.setDate(gridStart.getDate() + i);
			const key = localDateKey(date);
			const count = miniMarkers[key] ?? 0;
			return {
				date,
				inMonth: date >= monthStart && date <= monthEnd,
				hasPost: count > 0,
				count
			};
		});
	}

	async function loadMiniMonth(year: number, month: number) {
		miniLoading = true;
		try {
			const res = await fetch(`/api/sidebar-calendar?year=${year}&month=${month}`);
			if (!res.ok) return;
			const payload = (await res.json()) as {
				year: number;
				month: number;
				markers: Record<string, number>;
			};
			miniYear = payload.year;
			miniMonth = payload.month;
			miniMarkers = payload.markers;
		} finally {
			miniLoading = false;
		}
	}

	function moveMiniMonth(dir: -1 | 1) {
		const anchor = new Date(miniYear, miniMonth, 1);
		anchor.setMonth(anchor.getMonth() + dir);
		loadMiniMonth(anchor.getFullYear(), anchor.getMonth());
	}
</script>

<!-- Mobile backdrop (only when sidebar open) -->
{#if $sidebarOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/50 md:hidden"
		aria-label="Close menu"
		onclick={closeSidebar}
	></button>
{/if}

<aside
	class="sidebar fixed left-0 top-0 z-50 h-full w-[280px] -translate-x-full transition-transform duration-200 ease-out md:translate-x-0"
	class:translate-x-0={$sidebarOpen}
	aria-label="Main navigation"
>
	<div class="flex h-full flex-col">
		<!-- Header: logo + collapse -->
		<div class="flex h-14 items-center justify-between border-b border-[var(--sidebar-border)] px-4">
			<a href="/" class="flex items-center gap-2 font-semibold text-[var(--sidebar-text)]">
				<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold">P</span>
				PostPlan
			</a>
			<button
				type="button"
				class="rounded-lg p-2 text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] md:hidden"
				aria-label="Close menu"
				onclick={closeSidebar}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
		<!-- Main menu -->
		<nav class="flex-1 overflow-y-auto p-3">
			<div class="mb-4 rounded-lg border border-[var(--sidebar-border)] bg-black/10 p-2">
				<div class="mb-2 flex items-center justify-between px-1">
					<button
						type="button"
						onclick={() => moveMiniMonth(-1)}
						class="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
						aria-label="Previous month"
					>
						←
					</button>
					<p class="text-xs font-semibold text-[var(--sidebar-text)]">
						{monthNames[miniMonth]} {miniYear}
					</p>
					<button
						type="button"
						onclick={() => moveMiniMonth(1)}
						class="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
						aria-label="Next month"
					>
						→
					</button>
				</div>
				<div class="grid grid-cols-7 gap-1 px-1 pb-1">
					{#each miniDayNames as dayName}
						<div class="text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--sidebar-text-muted)]">
							{dayName}
						</div>
					{/each}
				</div>
				<div class="grid grid-cols-7 gap-1">
					{#each miniMonthGrid() as cell}
						<div
							class="relative flex h-7 items-center justify-center rounded text-[11px] {cell.inMonth ? 'text-[var(--sidebar-text)]' : 'text-[var(--sidebar-text-muted)] opacity-50'}"
							title={cell.count > 0 ? `${cell.count} post(s)` : undefined}
						>
							{cell.date.getDate()}
							{#if cell.hasPost}
								<span class="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-violet-300"></span>
							{/if}
						</div>
					{/each}
				</div>
				{#if miniLoading}
					<p class="mt-1 px-1 text-[10px] text-[var(--sidebar-text-muted)]">Loading…</p>
				{/if}
			</div>
			<p class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-text-muted)]">Main menu</p>
			<ul class="space-y-0.5">
				{#each navItems as item}
					{@const isActive = $page.url.pathname === item.href || (item.href !== '/' && $page.url.pathname.startsWith(item.href + '/'))}
					<li>
						<a
							href={item.href}
							class="nav-item flex min-h-[44px] items-center gap-3 rounded-r-lg px-3 py-2.5 text-sm font-medium transition-colors {isActive
								? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]'
								: 'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]'}"
							onclick={closeSidebar}
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d={iconPath(item.icon)} />
							</svg>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<div class="border-t border-[var(--sidebar-border)] p-3 space-y-2">
			{#if $page.data.session}
				<div class="px-3">
					<div class="flex items-center gap-2">
						{#if $page.data.session.user?.image}
							<img
								src={$page.data.session.user.image}
								alt="Profile"
								class="h-7 w-7 rounded-full border border-[var(--sidebar-border)] object-cover"
								loading="lazy"
							/>
						{:else}
							<span class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)] text-[11px] font-semibold text-[var(--sidebar-text)]">
								{($page.data.session.user?.email ?? $page.data.session.user?.name ?? 'U')
									.slice(0, 1)
									.toUpperCase()}
							</span>
						{/if}
						<p class="truncate text-xs text-[var(--sidebar-text-muted)]">
							{$page.data.session.user?.email ?? $page.data.session.user?.name ?? 'Signed in'}
						</p>
					</div>
				</div>
				<form method="POST" action="/auth/login?/signout" class="px-0">
					<input type="hidden" name="options.redirectTo" value="/auth/login" />
					<button
						type="submit"
						class="flex w-full items-center gap-3 rounded-r-lg px-3 py-2.5 text-sm font-medium text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] min-h-[44px]"
					>
						Sign out
					</button>
				</form>
			{/if}
			<button
				type="button"
				class="flex w-full items-center gap-3 rounded-r-lg px-3 py-2.5 text-sm font-medium text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] min-h-[44px]"
				onclick={toggleTheme}
				aria-label="Toggle theme"
			>
				{#if $theme === 'dark'}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
					</svg>
					Light
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
					</svg>
					Dark
				{/if}
			</button>
		</div>
	</div>
</aside>
