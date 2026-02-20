<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Reset password – PostPlan</title>
</svelte:head>

<div class="mx-auto max-w-md">
	<div class="content-card rounded-xl p-6 shadow-sm">
		<h1 class="text-2xl font-bold text-[var(--text)]">Reset password</h1>
		<p class="mt-1 text-sm text-[var(--text-muted)]">
			Set a new password for your account.
		</p>
		{#if !data.token}
			<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">
				Missing reset token.
			</p>
		{:else}
			{#if form?.error}
				<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
			{/if}
			<form method="POST" action="?/reset" class="mt-4 space-y-3">
				<input type="hidden" name="token" value={data.token} />
				<div>
					<label for="password" class="block text-sm font-medium text-[var(--text)]">New password</label>
					<input
						id="password"
						name="password"
						type="password"
						minlength="8"
						required
						class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
					/>
				</div>
				<div>
					<label for="confirmPassword" class="block text-sm font-medium text-[var(--text)]">Confirm password</label>
					<input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						minlength="8"
						required
						class="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
					/>
				</div>
				<button
					type="submit"
					class="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-95 min-h-[44px]"
				>
					Update password
				</button>
			</form>
		{/if}
	</div>
</div>
