<script lang="ts">
	// Blocked account page: user is logged in but tier is 'blocked'
</script>

<svelte:head>
	<title>Account blocked – PostPlan</title>
</svelte:head>

<div class="mx-auto max-w-md px-4 py-16 text-center">
	<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8">
		<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
			</svg>
		</div>
		<h1 class="mt-6 text-xl font-semibold text-[var(--text)]">Account blocked</h1>
		<p class="mt-3 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
			Your account has been blocked and you can no longer access PostPlan. If you believe this is an error, please contact support.
		</p>
		<form method="POST" action="/auth/login?/signout" class="mt-6">
			<input type="hidden" name="options.redirectTo" value="/" />
			<button
				type="submit"
				class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
			>
				Log out
			</button>
		</form>
	</div>
</div>
