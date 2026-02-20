<script lang="ts">
	let { data, form } = $props();
	let authTab = $state<'signin' | 'register' | 'forgot'>('signin');
</script>

<svelte:head>
	<title>Sign in – PostPlan</title>
</svelte:head>

<div class="mx-auto max-w-md">
	<div class="content-card rounded-xl p-6 shadow-sm space-y-6">
		<div>
			<h1 class="text-2xl font-bold text-[var(--text)]">Sign in</h1>
			<p class="mt-1 text-sm text-[var(--text-muted)]">
				Use email/password or a social account to access PostPlan.
			</p>
		</div>
		{#if data.verified}
			<p class="rounded-lg px-3 py-2 text-sm alert-success">
				Email verified. You can now sign in.
			</p>
		{/if}
		{#if data.passwordReset}
			<p class="rounded-lg px-3 py-2 text-sm alert-success">
				Password updated. Sign in with your new password.
			</p>
		{/if}
		<div class="grid grid-cols-3 gap-2">
			<button
				type="button"
				class="rounded-lg border px-3 py-2 text-sm font-medium min-h-[44px] {authTab === 'signin'
					? 'border-[var(--primary)] bg-[var(--primary)] text-white'
					: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'}"
				onclick={() => (authTab = 'signin')}
			>
				Sign in
			</button>
			<button
				type="button"
				class="rounded-lg border px-3 py-2 text-sm font-medium min-h-[44px] {authTab === 'register'
					? 'border-[var(--primary)] bg-[var(--primary)] text-white'
					: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'}"
				onclick={() => (authTab = 'register')}
			>
				Create account
			</button>
			<button
				type="button"
				class="rounded-lg border px-3 py-2 text-sm font-medium min-h-[44px] {authTab === 'forgot'
					? 'border-[var(--primary)] bg-[var(--primary)] text-white'
					: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)]'}"
				onclick={() => (authTab = 'forgot')}
			>
				Forgot password
			</button>
		</div>

		{#if authTab === 'signin'}
			<form method="POST" action="?/signin" class="space-y-3">
				<input type="hidden" name="providerId" value="credentials" />
				<input type="hidden" name="options.redirectTo" value="/calendar" />
				<div>
					<label class="block text-sm font-medium text-[var(--text)]" for="login-email">Email</label>
					<input
						id="login-email"
						name="email"
						type="email"
						required
						class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-[var(--text)]" for="login-password">Password</label>
					<input
						id="login-password"
						name="password"
						type="password"
						required
						class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
					/>
				</div>
				<button
					type="submit"
					class="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95 min-h-[44px]"
				>
					Sign in with email
				</button>
			</form>
		{:else if authTab === 'forgot'}
			<div class="border-t border-[var(--border)] pt-4">
				<h2 class="text-sm font-semibold text-[var(--text)]">Forgot password?</h2>
				{#if form?.forgotError}
					<p class="mt-2 rounded-lg px-3 py-2 text-sm alert-error">{form.forgotError}</p>
				{:else if form?.forgotSent}
					<p class="mt-2 rounded-lg px-3 py-2 text-sm alert-success">{form.forgotMessage}</p>
				{/if}
				<form method="POST" action="?/forgotPassword" class="mt-3 flex gap-2">
					<input
						name="email"
						type="email"
						required
						placeholder="you@example.com"
						class="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
					/>
					<button
						type="submit"
						class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
					>
						Send link
					</button>
				</form>
			</div>
		{:else}
			<div class="border-t border-[var(--border)] pt-4">
				<h2 class="text-sm font-semibold text-[var(--text)]">Create account</h2>
				{#if form?.registerError}
					<p class="mt-2 rounded-lg px-3 py-2 text-sm alert-error">{form.registerError}</p>
				{:else if form?.registered}
					<p class="mt-2 rounded-lg px-3 py-2 text-sm alert-success">
						{form.registerMessage}
					</p>
				{/if}
				<form method="POST" action="?/register" class="mt-3 space-y-3">
					<div>
						<label class="block text-sm font-medium text-[var(--text)]" for="register-name">Name (optional)</label>
						<input
							id="register-name"
							name="name"
							type="text"
							value={form?.registerName ?? ''}
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-[var(--text)]" for="register-email">Email</label>
						<input
							id="register-email"
							name="email"
							type="email"
							required
							value={form?.registerEmail ?? ''}
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-[var(--text)]" for="register-password">Password</label>
						<input
							id="register-password"
							name="password"
							type="password"
							minlength="8"
							required
							class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
						/>
					</div>
					<button
						type="submit"
						class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
					>
						Register
					</button>
				</form>
			</div>
		{/if}

		{#if authTab !== 'forgot'}
			<div class="border-t border-[var(--border)] pt-4">
				<h2 class="text-sm font-semibold text-[var(--text)]">Or continue with social</h2>
				{#if data.providers.length === 0}
					<p class="mt-2 rounded-lg px-3 py-2 text-sm alert-error">
						No social providers are configured. Set provider credentials in `.env`.
					</p>
				{:else}
					<div class="mt-3 space-y-2">
						{#each data.providers as provider}
							<form method="POST" action="?/signin">
								<input type="hidden" name="providerId" value={provider.id} />
								<input type="hidden" name="options.redirectTo" value="/calendar" />
								<button
									type="submit"
									class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px] inline-flex items-center justify-center gap-2"
								>
									{#if provider.id === 'github'}
										<svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
											<path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.49 7.49 0 014 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
										</svg>
									{:else if provider.id === 'google'}
										<svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
											<path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.6-2.5C16.9 3.4 14.6 2.5 12 2.5A9.5 9.5 0 1021.5 12c0-.6-.1-1.1-.2-1.8H12z"/>
										</svg>
									{:else if provider.id === 'apple'}
										<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
											<path d="M16.37 12.45c.02 2.14 1.9 2.85 1.92 2.86-.02.05-.3 1.03-1 2.03-.61.87-1.24 1.73-2.24 1.75-.99.02-1.31-.59-2.45-.59-1.15 0-1.5.57-2.43.6-.95.04-1.67-.95-2.28-1.81-1.24-1.79-2.2-5.06-.92-7.28.64-1.1 1.78-1.8 3.02-1.82.94-.02 1.83.64 2.45.64.61 0 1.76-.79 2.96-.67.5.02 1.9.2 2.8 1.52-.07.05-1.67.98-1.65 2.77zM14.35 6.18c.5-.61.84-1.46.75-2.31-.72.03-1.59.48-2.11 1.09-.47.54-.88 1.41-.77 2.24.8.06 1.62-.41 2.13-1.02z"/>
										</svg>
									{:else if provider.id === 'facebook'}
										<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
											<path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.87.25-1.47 1.5-1.47h1.6V5c-.28-.04-1.23-.12-2.33-.12-2.3 0-3.87 1.4-3.87 3.98V11H8v3h2.33v8h3.17z"/>
										</svg>
									{/if}
									Continue with {provider.label}
								</button>
							</form>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		{#if data.session}
			<div class="mt-6 border-t border-[var(--border)] pt-4">
				<p class="text-sm text-[var(--text-muted)]">
					Signed in as {data.session.user?.email ?? data.session.user?.name ?? 'user'}
				</p>
				<form method="POST" action="?/signout" class="mt-2">
					<input type="hidden" name="options.redirectTo" value="/auth/login" />
					<button
						type="submit"
						class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
					>
						Sign out
					</button>
				</form>
			</div>
		{/if}
	</div>
</div>
