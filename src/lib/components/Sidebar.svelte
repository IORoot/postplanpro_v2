<script lang="ts">
	import { fade } from 'svelte/transition';
	import { sidebarOpen, closeSidebar } from '$lib/stores/sidebar.js';
	import { page } from '$app/stores';

	const baseNavItems = [
		{ href: '/calendar', label: 'Calendar', icon: 'calendar' },
		{ href: '/posts', label: 'Posts', icon: 'doc' },
		{ href: '/schedules', label: 'Schedules', icon: 'clock' },
		{ href: '/inputs', label: 'Inputs', icon: 'stack' },
		{ href: '/outputs', label: 'Outputs', icon: 'send' },
		{ href: '/reports', label: 'Reports', icon: 'chart' }
	];
	const userTier = $page.data.userTier as string | null | undefined;
	const userTimezone = $derived(($page.data.userTimezone as string | null | undefined) ?? 'Europe/London');
	const sidebarPlanUsage = $page.data.sidebarPlanUsage as
		| {
				posts: { used: number; limit: number | null };
				imports: { used: number; limit: number | null };
				callbacks: { used: number; limit: number | null };
		  }
		| null
		| undefined;

	const postsQuotaAtLimit = $derived(
		Boolean(
			sidebarPlanUsage &&
				sidebarPlanUsage.posts.limit != null &&
				sidebarPlanUsage.posts.limit > 0 &&
				sidebarPlanUsage.posts.used >= sidebarPlanUsage.posts.limit
		)
	);

	function capStr(limit: number | null): string {
		return limit === null ? '∞' : String(limit);
	}
	const navItems = $derived(
		userTier === 'admin'
			? [...baseNavItems, { href: '/admin', label: 'Admin', icon: 'gear' as const }]
			: baseNavItems
	);
	let clockNow = $state(new Date());

	$effect(() => {
		const id = setInterval(() => {
			clockNow = new Date();
		}, 1000);
		return () => clearInterval(id);
	});

	const clockDate = $derived(
		new Intl.DateTimeFormat(undefined, {
			timeZone: userTimezone,
			weekday: 'short',
			month: 'short',
			day: '2-digit',
			year: 'numeric'
		}).format(clockNow)
	);
	const clockTime = $derived(
		new Intl.DateTimeFormat(undefined, {
			timeZone: userTimezone,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).format(clockNow)
	);

	function iconPath(icon: string) {
		const paths: Record<string, string> = {
			calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
			doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
			clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
			stack: 'M4 6h16M4 10h16M4 14h16M4 18h16',
			send: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
			chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
			gear: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
			users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
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
	let miniLoadError = $state<string | null>(null);

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

	function isMiniToday(date: Date): boolean {
		const t = new Date();
		return (
			date.getFullYear() === t.getFullYear() &&
			date.getMonth() === t.getMonth() &&
			date.getDate() === t.getDate()
		);
	}

	const miniMonthCells = $derived.by(() => {
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
	});

	async function loadMiniMonth(year: number, month: number) {
		miniLoading = true;
		miniLoadError = null;
		try {
			const res = await fetch(`/api/sidebar-calendar?year=${year}&month=${month}`);
			if (!res.ok) {
				miniLoadError = `Couldn't load this month (${res.status}).`;
				return;
			}
			const payload = (await res.json()) as {
				year: number;
				month: number;
				markers: Record<string, number>;
			};
			miniYear = payload.year;
			miniMonth = payload.month;
			miniMarkers = payload.markers;
		} catch {
			miniLoadError = "Can't reach the server. Check your connection and try again.";
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
		class="fixed inset-0 z-40 bg-neutral-950/50 md:hidden"
		aria-label="Close menu"
		transition:fade={{ duration: 180 }}
		onclick={closeSidebar}
	></button>
{/if}

<aside
	class="sidebar fixed left-0 top-0 z-50 h-full w-[280px] -translate-x-full transition-transform md:translate-x-0 [transition-duration:var(--motion-panel)] [transition-timing-function:var(--ease-out-quart)]"
	class:translate-x-0={$sidebarOpen}
	aria-label="Main navigation"
>
	<div class="flex h-full flex-col">
		<!-- Header: logo + collapse -->
		<div class="flex h-24 items-center justify-between border-b border-[var(--sidebar-border)] px-8 ">
			<a href="/calendar" class="flex items-center gap-2 font-semibold text-[var(--sidebar-text)] w-full">
				<img src="/logo_text.svg" alt="PostPlan" class="mx-auto h-10 w-auto max-w-[200px] object-contain" />
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
			{#if sidebarPlanUsage}
				<a
					href="/account?section=billing"
					class="mb-2 block border-b border-[var(--sidebar-border)]/70 px-1 pb-2 transition-colors hover:opacity-95"
					title="Plan and usage (account)"
					aria-label="Monthly plan usage: posts, imports, and callbacks. Opens billing."
					onclick={closeSidebar}
				>
					<div class="flex flex-row gap-1">
						<span
							class="flex min-h-[2.5rem] min-w-0 flex-1 basis-0 flex-col items-center justify-center rounded-md border px-0.5 py-1 {postsQuotaAtLimit
								? 'border-red-500/60 bg-red-950/45 text-red-50'
								: 'border-[var(--sidebar-border)] bg-[var(--sidebar-hover)]/35 text-[var(--sidebar-text)]'}"
						>
							<span class="text-[10px] font-medium leading-none tabular-nums">
								{sidebarPlanUsage.posts.used}{' '}/{' '}{capStr(sidebarPlanUsage.posts.limit)}
							</span>
							<span
								class="mt-0.5 text-[8px] font-normal leading-none {postsQuotaAtLimit
									? 'text-red-200/90'
									: 'text-[var(--sidebar-text-muted)]'}">posts</span
							>
						</span>
						<span
							class="flex min-h-[2.5rem] min-w-0 flex-1 basis-0 flex-col items-center justify-center rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)]/35 px-0.5 py-1 text-[var(--sidebar-text)]"
						>
							<span class="text-[10px] font-medium leading-none tabular-nums">
								{sidebarPlanUsage.imports.used}{' '}/{' '}{capStr(sidebarPlanUsage.imports.limit)}
							</span>
							<span class="mt-0.5 text-[8px] font-normal leading-none text-[var(--sidebar-text-muted)]">imports</span>
						</span>
						<span
							class="flex min-h-[2.5rem] min-w-0 flex-1 basis-0 flex-col items-center justify-center rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)]/35 px-0.5 py-1 text-[var(--sidebar-text)]"
						>
							<span class="text-[10px] font-medium leading-none tabular-nums">
								{sidebarPlanUsage.callbacks.used}{' '}/{' '}{capStr(sidebarPlanUsage.callbacks.limit)}
							</span>
							<span class="mt-0.5 text-[8px] font-normal leading-none text-[var(--sidebar-text-muted)]">callbacks</span>
						</span>
					</div>
				</a>
			{/if}
			<div class="sidebar-mini-cal mb-4 rounded-lg border bg-neutral-950/10 p-2">
				<div class="mb-2 flex items-center justify-between px-1">
					<button
						type="button"
						onclick={() => moveMiniMonth(-1)}
						class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] touch-manipulation md:h-7 md:min-h-[1.75rem] md:min-w-[1.75rem] md:w-7"
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
						class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] touch-manipulation md:h-7 md:min-h-[1.75rem] md:min-w-[1.75rem] md:w-7"
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
					{#each miniMonthCells as cell}
						<a
							href={`/calendar?view=day&date=${localDateKey(cell.date)}`}
							class="relative flex h-7 items-center justify-center rounded text-[11px] {cell.inMonth ? 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]' : 'text-[var(--sidebar-text-muted)] opacity-50 hover:bg-[var(--sidebar-hover)]'} {isMiniToday(cell.date) ? 'sidebar-mini-calendar-today' : ''}"
							title={cell.count > 0 ? (cell.count === 1 ? '1 post this day' : `${cell.count} posts this day`) : undefined}
							aria-current={isMiniToday(cell.date) ? 'date' : undefined}
							onclick={closeSidebar}
						>
							{cell.date.getDate()}
							{#if cell.hasPost}
								<span
									class="absolute bottom-0.5 h-1.5 w-1.5 rounded-full"
									style="background-color: var(--sidebar-calendar-marker)"
									aria-hidden="true"
								></span>
							{/if}
						</a>
					{/each}
				</div>
				{#if miniLoading}
					<p class="mt-1 px-1 text-[10px] text-[var(--sidebar-text-muted)]">Updating month…</p>
				{:else if miniLoadError}
					<div class="mt-1 space-y-1 px-1">
						<p class="text-[10px] text-[var(--sidebar-text-muted)]">{miniLoadError}</p>
						<button
							type="button"
							class="text-[10px] font-medium text-[var(--sidebar-text)] underline hover:opacity-90"
							onclick={() => loadMiniMonth(miniYear, miniMonth)}
						>
							Try again
						</button>
					</div>
				{/if}
			</div>
			<p class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-text-muted)]">
				{userTier === 'admin' ? 'Admin' : 'Main menu'}
			</p>
			<ul class="space-y-0.5">
				{#each navItems as item}
					{@const isActive =
						item.href === '/admin'
							? $page.url.pathname.startsWith('/admin')
							: $page.url.pathname === item.href ||
								(item.href === '/inputs' && $page.url.pathname === '/inputs/webhooks') ||
								(item.href !== '/calendar' && $page.url.pathname.startsWith(item.href + '/'))}
					<li>
						<a
							href={item.href}
							class="nav-item flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium {isActive
								? 'sidebar-nav-item-active'
								: 'sidebar-nav-idle text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]'}"
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
		{#if $page.data.session}
			<div class="border-t border-[var(--sidebar-border)] pl-3">
				<div class="px-3">
					{#if userTier === 'free'}
						<div class="mb-3 rounded-lg border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)]/40 p-3">
							<div class="mt-2 flex flex-col items-start gap-2">
								<a
									href="/api/stripe/checkout"
									class="inline-flex min-h-[36px] w-full items-center justify-center rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
									onclick={closeSidebar}
								>
									Upgrade to Pro
								</a>
							</div>
						</div>
					{/if}
					<a
						href="/account"
						class="flex items-center gap-2 rounded-lg py-1 pr-2 -ml-2 pl-2 transition-[background-color,color] [transition-duration:var(--motion-snappy)] [transition-timing-function:var(--ease-out-quart)] hover:bg-[var(--sidebar-hover)]"
					>
						{#if $page.data.session.user?.image}
							<img
								src={$page.data.session.user.image}
								alt=""
								referrerpolicy="no-referrer"
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
						<p class="truncate text-xs text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]">
							{$page.data.session.user?.email ?? $page.data.session.user?.name ?? 'Signed in'}
						</p>
					</a>
				</div>
			</div>
		{/if}
		<div class="border-t border-[var(--sidebar-border)] px-3 py-2.5">
			<a
				href="/account?section=settings"
				class="block rounded-lg px-3 py-1.5 text-[11px] text-[var(--sidebar-text-muted)] tabular-nums transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] truncate"
				title="Open settings to change timezone"
				onclick={closeSidebar}
			>
				{clockDate} {clockTime} {userTimezone}
			</a>
		</div>
	</div>
</aside>
