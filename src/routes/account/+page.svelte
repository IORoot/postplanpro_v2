<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();
	let deleteConfirm = $state('');
</script>

<svelte:head>
	<title>Account – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Account"
	description="Manage your account, sign-in methods, and security."
/>

{#if data.session?.user}
	<div class="content-card rounded-xl border border-[var(--border)] p-6 shadow-sm">
		<div class="flex flex-wrap items-center gap-4">
			{#if data.session.user.image}
				<img
					src={data.session.user.image}
					alt=""
					referrerpolicy="no-referrer"
					class="h-20 w-20 rounded-full border-2 border-[var(--border)] object-cover"
					loading="lazy"
				/>
			{:else}
				<span class="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg)] text-2xl font-semibold text-[var(--text-muted)]">
					{(data.session.user.email ?? data.session.user.name ?? '?').slice(0, 1).toUpperCase()}
				</span>
			{/if}
			<div class="min-w-0 flex-1 space-y-1">
				{#if data.session.user.name}
					<p class="text-lg font-semibold text-[var(--text)]">{data.session.user.name}</p>
				{/if}
				{#if data.session.user.email}
					<p class="text-sm text-[var(--text-muted)]">{data.session.user.email}</p>
				{/if}
				{#if !data.session.user.name && !data.session.user.email}
					<p class="text-sm text-[var(--text-muted)]">Signed in</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if form?.error}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
{/if}
{#if form?.resetSent}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">{form.message}</p>
{/if}
{#if form?.disconnectOk}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">OAuth account disconnected.</p>
{/if}

<div class="mt-8 space-y-8">
	<!-- Plan & usage -->
	<section class="content-card rounded-xl p-6 shadow-sm">
		<h2 class="text-base font-semibold text-[var(--text)]">Plan & usage</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Your current plan and usage for this month.</p>
		<dl class="mt-4 space-y-2">
			<div class="flex justify-between gap-4">
				<dt class="text-sm text-[var(--text-muted)]">Plan</dt>
				<dd class="text-sm font-medium text-[var(--text)] capitalize">{data.tier}</dd>
			</div>
			<div class="flex justify-between gap-4">
				<dt class="text-sm text-[var(--text-muted)]">Posts (sent + scheduled) this month</dt>
				<dd class="text-sm text-[var(--text)]">
					{data.usage.postsTotal}
					{#if data.limits.postsSentPerMonth != null}
						/ {data.limits.postsSentPerMonth}
					{:else}
						<span class="text-[var(--text-muted)]">(Unlimited)</span>
					{/if}
				</dd>
			</div>
			<div class="flex justify-between gap-4">
				<dt class="text-sm text-[var(--text-muted)]">Callback inputs this month</dt>
				<dd class="text-sm text-[var(--text)]">
					{data.usage.callbackInputs}
					{#if data.limits.callbackInputsPerMonth != null}
						/ {data.limits.callbackInputsPerMonth}
					{:else}
						<span class="text-[var(--text-muted)]">(Unlimited)</span>
					{/if}
				</dd>
			</div>
			<div class="flex justify-between gap-4">
				<dt class="text-sm text-[var(--text-muted)]">Imports this month</dt>
				<dd class="text-sm text-[var(--text)]">
					{data.usage.importOperations}
					{#if data.limits.importOperationsPerMonth != null}
						/ {data.limits.importOperationsPerMonth}
					{:else}
						<span class="text-[var(--text-muted)]">(Unlimited)</span>
					{/if}
				</dd>
			</div>
		</dl>
	</section>

	<!-- Billing & upgrade -->
	<section class="content-card rounded-xl p-6 shadow-sm">
		<h2 class="text-base font-semibold text-[var(--text)]">Billing</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Manage your subscription and plan.</p>
		{#if data.tier === 'admin'}
			<p class="mt-4 text-sm text-[var(--text-muted)]">You have full access as an admin. Plan limits do not apply.</p>
		{:else if data.tier === 'pro'}
			<p class="mt-4 text-sm text-[var(--text)]">Pro – £5/month</p>
			<p class="mt-2 text-sm text-[var(--text-muted)]">Manage your subscription or cancel your plan.</p>
			<a
				href="/api/stripe/portal"
				class="mt-3 inline-block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
			>
				Manage subscription
			</a>
		{:else if data.tier === 'enterprise'}
			<p class="mt-4 text-sm text-[var(--text)]">Enterprise – contact for billing.</p>
		{:else}
			<p class="mt-4 text-sm text-[var(--text-muted)]">You're on the Free plan. Upgrade for more posts, callback inputs, and imports.</p>
			<div class="mt-3 flex flex-wrap gap-3">
				<a
					href="/api/stripe/checkout"
					class="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 min-h-[44px]"
				>
					Upgrade to Pro (£5/month)
				</a>
				<span class="text-sm text-[var(--text-muted)]">or contact us for Enterprise.</span>
			</div>
		{/if}
	</section>

	<!-- Log out -->
	<section class="content-card rounded-xl p-6 shadow-sm">
		<h2 class="text-base font-semibold text-[var(--text)]">Log out</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Sign out of PostPlan on this device.</p>
		<form method="POST" action="/auth/login?/signout" class="mt-4">
			<input type="hidden" name="options.redirectTo" value="/welcome" />
			<button
				type="submit"
				class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
			>
				Log out
			</button>
		</form>
	</section>

	<!-- Reset password -->
	<section class="content-card rounded-xl p-6 shadow-sm">
		<h2 class="text-base font-semibold text-[var(--text)]">Reset password</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">
			{#if data.email}
				We'll send a one-time reset link to <strong>{data.email}</strong>. Use it to set a new password.
			{:else}
				Your account has no email on file. Add an email (e.g. by signing in with email/password or linking a provider that shares email) to use password reset.
			{/if}
		</p>
		{#if data.email}
			<form method="POST" action="?/sendResetPassword" use:enhance={() => invalidateAll()} class="mt-4">
				<button
					type="submit"
					class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
				>
					Send password reset email
				</button>
			</form>
		{/if}
	</section>

	<!-- Connected OAuth accounts -->
	<section class="content-card rounded-xl p-6 shadow-sm">
		<h2 class="text-base font-semibold text-[var(--text)]">Connected accounts</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">Sign-in methods linked to your account. Disconnecting does not delete the provider account.</p>
		{#if data.oauthAccounts.length === 0}
			<p class="mt-4 text-sm text-[var(--text-muted)]">No OAuth accounts connected. You sign in with email and password.</p>
		{:else}
			<ul class="mt-4 space-y-3">
				{#each data.oauthAccounts as oauth}
					<li class="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3">
						<div>
							<span class="font-medium text-[var(--text)]">{oauth.label}</span>
							<span class="ml-2 text-xs text-[var(--text-muted)]">Connected</span>
						</div>
						<form method="POST" action="?/disconnectOAuth" use:enhance={() => invalidateAll()}>
							<input type="hidden" name="oauth_id" value={oauth.id} />
							<button
								type="submit"
								disabled={!data.canDisconnectOAuth && data.oauthAccounts.length <= 1}
								class="rounded border border-red-500/60 bg-transparent px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed dark:text-red-400"
							>
								Disconnect
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		{#if !data.canDisconnectOAuth && data.oauthAccounts.length > 0}
			<p class="mt-2 text-xs text-[var(--text-muted)]">Set a password first (via reset link above) to disconnect your last sign-in method.</p>
		{/if}
	</section>

	<!-- Delete account -->
	<section class="content-card rounded-xl p-6 shadow-sm border-red-500/30">
		<h2 class="text-base font-semibold text-red-600 dark:text-red-400">Delete account</h2>
		<p class="mt-1 text-sm text-[var(--text-muted)]">
			Permanently delete your account and all your data (posts, schedules, webhooks). This cannot be undone.
		</p>
		<form method="POST" action="?/deleteAccount" use:enhance class="mt-4">
			<label for="delete-confirm" class="block text-sm font-medium text-[var(--text)]">Type <strong>DELETE</strong> to confirm</label>
			<input
				id="delete-confirm"
				type="text"
				name="confirm"
				bind:value={deleteConfirm}
				placeholder="DELETE"
				autocomplete="off"
				class="mt-1 w-full max-w-xs rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] min-h-[44px]"
			/>
			<button
				type="submit"
				class="mt-3 rounded-lg border border-red-500 bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
				disabled={deleteConfirm.trim().toLowerCase() !== 'delete'}
			>
				Delete my account
			</button>
		</form>
	</section>
</div>
