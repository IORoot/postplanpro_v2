<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Reset password – PostPlan</title>
</svelte:head>

<div class="mx-auto max-w-md">
	<div class="content-card rounded-xl p-6 shadow-sm">
		<PageSectionHeading title="Reset password" description="Set a new password for your account." />
		{#if !data.token}
			<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">
				Missing reset token. Open the full link from your email — it looks like
				<code class="rounded bg-[var(--surface)] px-1 text-xs">/auth/reset-password?token=…</code>.
			</p>
			{#if data.looksLikeFormActionUrl}
				<p class="mt-2 text-sm text-[var(--text-muted)]">
					This URL looks like a form action (<code class="text-xs">?/reset</code>), not the email link. Request a new
					reset from sign-in → Forgot password.
				</p>
			{/if}
		{:else}
			{#if form?.error}
				<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
			{/if}
			<form method="POST" action="/auth/reset-password?/reset" class="mt-4 space-y-3">
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
				<button type="submit" class="btn-primary btn-touch w-full text-white">Update password</button>
			</form>
		{/if}
	</div>
</div>
