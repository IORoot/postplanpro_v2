<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();
	let open = $state(false);
</script>

<svelte:head>
	<title>PostPlan – Schedule and send posts to your webhooks</title>
</svelte:head>

<!-- Site header -->
<header
	class="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/80"
>
	<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<a href="/welcome" class="flex items-center gap-2">
			<img src="/logo.svg" alt="PostPlan" class="h-9 w-auto" />
			<span class="text-xl font-semibold text-[var(--text)]">PostPlan</span>
		</a>

		<nav class="hidden items-center gap-8 md:flex" aria-label="Main">
			<a
				href="/welcome"
				class="text-sm font-medium transition-colors { $page.url.pathname === '/welcome' ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]' }"
			>
				Home
			</a>
			<a
				href="/welcome/technical"
				class="text-sm font-medium transition-colors { $page.url.pathname === '/welcome/technical' ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]' }"
			>
				Technical details
			</a>
			<a href="/welcome#pricing" class="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
				Pricing
			</a>
			<div class="flex items-center gap-3">
				<a
					href="/auth/login"
					class="rounded-lg border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-hover)]"
				>
					Log in
				</a>
				<a
					href="/auth/login"
					class="btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-white"
				>
					Sign up
				</a>
			</div>
		</nav>

		<!-- Mobile menu button -->
		<button
			type="button"
			class="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text)] md:hidden"
			aria-label="Toggle menu"
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			{#if open}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			{/if}
		</button>
	</div>

	{#if open}
		<div class="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 md:hidden">
			<nav class="flex flex-col gap-2" aria-label="Mobile">
				<a href="/welcome" class="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)]">Home</a>
				<a href="/welcome/technical" class="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)]">Technical details</a>
				<a href="/welcome#pricing" class="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)]">Pricing</a>
				<a href="/auth/login" class="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)]">Log in</a>
				<a href="/auth/login" class="btn-primary mt-2 rounded-lg px-3 py-2 text-center text-sm font-semibold text-white">Sign up</a>
			</nav>
		</div>
	{/if}
</header>

<main class="min-h-screen">
	{@render children()}
</main>

<!-- Footer -->
<footer class="border-t border-[var(--border)] bg-[var(--surface)]">
	<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
		<div class="grid gap-10 lg:grid-cols-3">
			<div>
				<a href="/welcome" class="flex items-center gap-2">
					<img src="/logo.svg" alt="PostPlan" class="h-8 w-auto" />
					<span class="text-lg font-semibold text-[var(--text)]">PostPlan</span>
				</a>
				<p class="mt-3 text-sm text-[var(--text-muted)]">
					Schedule and send posts to your webhooks. Plan content, use schedules and bulk import, and fire posts when they're due.
				</p>
			</div>
			<div>
				<h3 class="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Product</h3>
				<ul class="mt-3 space-y-2">
					<li><a href="/welcome#pricing" class="text-sm text-[var(--text)] hover:text-[var(--primary)]">Pricing</a></li>
					<li><a href="/welcome/technical" class="text-sm text-[var(--text)] hover:text-[var(--primary)]">Technical details</a></li>
					<li><a href="/auth/login" class="text-sm text-[var(--text)] hover:text-[var(--primary)]">Log in</a></li>
					<li><a href="/auth/login" class="text-sm text-[var(--text)] hover:text-[var(--primary)]">Sign up</a></li>
				</ul>
			</div>
			<div>
				<h3 class="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Newsletter</h3>
				<p class="mt-3 text-sm text-[var(--text-muted)]">Get product updates and tips. No spam.</p>
				<!-- Mailchimp embed: replace action with your Mailchimp form action URL -->
				<form
					action="#"
					method="post"
					class="mt-3 flex gap-2"
					aria-label="Newsletter signup"
				>
					<input
						type="email"
						name="EMAIL"
						placeholder="you@example.com"
						required
						class="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
					/>
					<button type="submit" class="btn-primary shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white">
						Subscribe
					</button>
				</form>
				<p class="mt-2 text-xs text-[var(--text-muted)]">
					By subscribing you agree to receive updates. Add your Mailchimp form action URL to enable signups.
				</p>
			</div>
		</div>
		<div class="mt-10 border-t border-[var(--border)] pt-8 text-center text-sm text-[var(--text-muted)]">
			© {new Date().getFullYear()} PostPlan. All rights reserved.
		</div>
	</div>
</footer>
