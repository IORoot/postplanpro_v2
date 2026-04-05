<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { theme, toggleTheme } from '$lib/stores/theme.js';

	let { data, form } = $props();

	const section = $derived(
		(data.section as 'billing' | 'account' | 'templates' | 'globals' | 'settings' | undefined) ?? 'account'
	);

	let deleteConfirm = $state('');

	let editingGlobalId = $state<string | null>(null);
	let newGlobal = $state(false);

	let editingTemplateId = $state<string | null>(null);
	let newTemplate = $state(false);
	let editingTemplateFields = $state<{ key: string; type: string; value: string }[]>([]);
	let newTemplateFields = $state<{ key: string; type: string; value: string }[]>([
		{ key: '', type: 'string', value: '' }
	]);

	const pageTitle = $derived.by(() => {
		switch (section) {
			case 'billing':
				return 'Plan & billing';
			case 'account':
				return 'Account';
			case 'templates':
				return 'Templates';
			case 'globals':
				return 'Globals';
			case 'settings':
				return 'Settings';
			default:
				return 'Account';
		}
	});

	const pageDescription = $derived.by(() => {
		switch (section) {
			case 'billing':
				return 'Your subscription, usage, and billing.';
			case 'account':
				return 'Profile, sign-in, security, and account deletion.';
			case 'templates':
				return 'Reusable custom field structures for posts and webhooks.';
			case 'globals':
				return 'Key-value pairs merged into every webhook JSON payload.';
			case 'settings':
				return 'Appearance and preferences for this device.';
			default:
				return '';
		}
	});

	function openEditTemplate(template: { id: string; fields?: { key: string; type: string; value: string }[] }) {
		editingTemplateId = template.id;
		editingTemplateFields = (template.fields ?? []).map((f) => ({
			key: f.key,
			type: f.type,
			value: f.value
		}));
		if (editingTemplateFields.length === 0) {
			editingTemplateFields = [{ key: '', type: 'string', value: '' }];
		}
	}
	function openNewTemplate() {
		newTemplate = true;
		newTemplateFields = [{ key: '', type: 'string', value: '' }];
	}
</script>

<svelte:head>
	<title>{pageTitle} – PostPlan</title>
</svelte:head>

<PageSectionHeading title={pageTitle} description={pageDescription} />

<div class="settings-layout">
	<aside class="settings-sidebar">
		<nav class="settings-nav" aria-label="Account sections">
			<a
				href="/account?section=account"
				class="settings-nav-link {section === 'account' ? 'settings-nav-link-active' : ''}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
					/>
				</svg>
				Account
			</a>
			<a
				href="/account?section=billing"
				class="settings-nav-link {section === 'billing' ? 'settings-nav-link-active' : ''}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
					/>
				</svg>
				Plan & billing
			</a>
			<a
				href="/account?section=templates"
				class="settings-nav-link {section === 'templates' ? 'settings-nav-link-active' : ''}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5v-7.5H8.25v7.5z"
					/>
				</svg>
				Templates
			</a>
			<a
				href="/account?section=globals"
				class="settings-nav-link {section === 'globals' ? 'settings-nav-link-active' : ''}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
					/>
				</svg>
				Globals
			</a>
			<a
				href="/account?section=settings"
				class="settings-nav-link {section === 'settings' ? 'settings-nav-link-active' : ''}"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7.723 7.723 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
					/>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				Settings
			</a>
		</nav>
	</aside>

	<div class="settings-content">
		{#if form?.error}
			<p class="mb-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
		{/if}
		{#if form?.resetSent}
			<p class="mb-4 rounded-lg px-3 py-2 text-sm alert-success">{form.message}</p>
		{/if}
		{#if form?.disconnectOk}
			<p class="mb-4 rounded-lg px-3 py-2 text-sm alert-success">OAuth account disconnected.</p>
		{/if}

		{#if section === 'account'}
			<div class="mt-6 space-y-8 lg:mt-0">
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
								<span
									class="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg)] text-2xl font-semibold text-[var(--text-muted)]"
								>
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

				<section class="content-card rounded-xl p-6 shadow-sm">
					<h2 class="text-base font-semibold text-[var(--text)]">Log out</h2>
					<p class="mt-1 text-sm text-[var(--text-muted)]">Sign out of PostPlan on this device.</p>
					<form method="POST" action="/auth/login?/signout" class="mt-4">
						<input type="hidden" name="options.redirectTo" value="/" />
						<button
							type="submit"
							class="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] min-h-[44px]"
						>
							Log out
						</button>
					</form>
				</section>

				<section class="content-card rounded-xl p-6 shadow-sm">
					<h2 class="text-base font-semibold text-[var(--text)]">Reset password</h2>
					<p class="mt-1 text-sm text-[var(--text-muted)]">
						{#if data.email}
							We'll send a one-time reset link to <strong>{data.email}</strong>. Use it to set a new password.
						{:else}
							Your account has no email on file. Add an email (e.g. by signing in with email/password or linking a
							provider that shares email) to use password reset.
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

				<section class="content-card rounded-xl p-6 shadow-sm">
					<h2 class="text-base font-semibold text-[var(--text)]">Connected accounts</h2>
					<p class="mt-1 text-sm text-[var(--text-muted)]">
						Sign-in methods linked to your account. Disconnecting does not delete the provider account.
					</p>
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
											disabled={!oauth.canDisconnect}
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
						<p class="mt-2 text-xs text-[var(--text-muted)]">
							Set a password first (via reset link above) to disconnect your last sign-in method.
						</p>
					{/if}
					{#if data.oauthAccounts.some((o) => o.provider === 'credentials')}
						<p class="mt-2 text-xs text-[var(--text-muted)]">
							Email and password is your primary sign-in method and cannot be disconnected. Use password reset to change your
							password.
						</p>
					{/if}
				</section>

				<section class="content-card rounded-xl p-6 shadow-sm border-red-500/30">
					<h2 class="text-base font-semibold text-red-600 dark:text-red-400">Delete account</h2>
					<p class="mt-1 text-sm text-[var(--text-muted)]">
						Permanently delete your account and all your data (posts, schedules, webhooks). This cannot be undone.
					</p>
					<form method="POST" action="?/deleteAccount" use:enhance class="mt-4">
						<label for="delete-confirm" class="block text-sm font-medium text-[var(--text)]"
							>Type <strong>DELETE</strong> to confirm</label
						>
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
		{:else if section === 'billing'}
			<div class="mt-6 space-y-8 lg:mt-0">
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
						<p class="mt-4 text-sm text-[var(--text-muted)]">
							You're on the Free plan. Upgrade for more posts, callback inputs, and imports.
						</p>
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
			</div>
		{:else if section === 'templates'}
			<section class="mt-6 lg:mt-0" id="account-templates">
				<h2 class="text-lg font-medium text-[var(--text)]">Custom field templates</h2>
				<p class="mt-1 text-sm text-[var(--text-muted)]">
					Reusable field structures for post custom fields. Use dotted keys for nested output (e.g. instagram.title).
				</p>

				<div class="mt-4 space-y-3">
					{#each data.templates as t}
						{#if editingTemplateId === t.id}
							<form
								method="POST"
								action="?/updateTemplate"
								use:enhance={() => {
									editingTemplateId = null;
									return invalidateAll();
								}}
								class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
							>
								<input type="hidden" name="id" value={t.id} />
								<input type="hidden" name="fields_json" value={JSON.stringify(editingTemplateFields)} />
								<div>
									<label for="edit-template-name" class="block text-sm font-medium text-[var(--text)]">Template name</label>
									<input
										id="edit-template-name"
										type="text"
										name="name"
										value={t.name}
										required
										class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
									/>
								</div>
								<div class="mt-3 space-y-2">
									{#each editingTemplateFields as _, i}
										<div class="flex flex-wrap gap-2">
											<input
												type="text"
												bind:value={editingTemplateFields[i].key}
												placeholder="field.path or array[0]"
												class="min-w-[180px] rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
											/>
											<select
												bind:value={editingTemplateFields[i].type}
												class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
											>
												<option value="string">string</option>
												<option value="number">number</option>
												<option value="boolean">boolean</option>
												<option value="json">json</option>
											</select>
											<input
												type="text"
												bind:value={editingTemplateFields[i].value}
												placeholder="Value (JSON for json type)"
												class="min-w-[200px] flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
											/>
											<button
												type="button"
												onclick={() => (editingTemplateFields = editingTemplateFields.filter((_, j) => j !== i))}
												class="btn-danger-outline min-h-[44px] rounded border px-2 py-1 text-sm">Remove</button
											>
										</div>
									{/each}
								</div>
								<button
									type="button"
									onclick={() =>
										(editingTemplateFields = [...editingTemplateFields, { key: '', type: 'string', value: '' }])}
									class="mt-2 min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
									>+ Add field</button
								>
								<div class="mt-3 flex gap-2">
									<button type="submit" class="btn-primary min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white"
										>Save</button
									>
									<button
										type="button"
										onclick={() => (editingTemplateId = null)}
										class="min-h-[44px] rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
										>Cancel</button
									>
								</div>
							</form>
						{:else}
							<div class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p class="font-medium text-[var(--text)]">{t.name}</p>
										<p class="text-xs text-[var(--text-muted)]">{t.is_default ? 'Default template' : 'User template'}</p>
									</div>
									<div class="flex gap-2">
										{#if !t.is_default}
											<button
												type="button"
												onclick={() => openEditTemplate(t)}
												class="min-h-[44px] min-w-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
												>Edit</button
											>
											<form
												method="POST"
												action="?/deleteTemplate"
												use:enhance={({ cancel }) => {
													if (!confirm('Delete this template? This cannot be undone.')) cancel();
													return () => invalidateAll();
												}}
												class="inline"
											>
												<input type="hidden" name="id" value={t.id} />
												<button type="submit" class="btn-danger-outline min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm"
													>Delete</button
												>
											</form>
										{/if}
									</div>
								</div>
								<div class="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
									{#each t.fields as field}
										<div><code>{field.key}</code> ({field.type})</div>
									{/each}
								</div>
							</div>
						{/if}
					{/each}

					{#if newTemplate}
						<form
							method="POST"
							action="?/createTemplate"
							use:enhance={() => {
								newTemplate = false;
								return invalidateAll();
							}}
							class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
						>
							<input type="hidden" name="fields_json" value={JSON.stringify(newTemplateFields)} />
							<div>
								<label for="new-template-name" class="block text-sm font-medium text-[var(--text)]">Template name</label>
								<input
									id="new-template-name"
									type="text"
									name="name"
									required
									placeholder="e.g. Instagram Reel"
									class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
								/>
							</div>
							<div class="mt-3 space-y-2">
								{#each newTemplateFields as _, i}
									<div class="flex flex-wrap gap-2">
										<input
											type="text"
											bind:value={newTemplateFields[i].key}
											placeholder="field.path or array[0]"
											class="min-w-[180px] rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
										/>
										<select
											bind:value={newTemplateFields[i].type}
											class="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
										>
											<option value="string">string</option>
											<option value="number">number</option>
											<option value="boolean">boolean</option>
											<option value="json">json</option>
										</select>
										<input
											type="text"
											bind:value={newTemplateFields[i].value}
											placeholder="Value (JSON for json type)"
											class="min-w-[200px] flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
										/>
										<button
											type="button"
											onclick={() => (newTemplateFields = newTemplateFields.filter((_, j) => j !== i))}
											class="btn-danger-outline min-h-[44px] rounded border px-2 py-1 text-sm">Remove</button
										>
									</div>
								{/each}
							</div>
							<button
								type="button"
								onclick={() => (newTemplateFields = [...newTemplateFields, { key: '', type: 'string', value: '' }])}
								class="mt-2 min-h-[44px] rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
								>+ Add field</button
							>
							<div class="mt-3 flex gap-2">
								<button type="submit" class="btn-primary min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white"
									>Add template</button
								>
								<button
									type="button"
									onclick={() => (newTemplate = false)}
									class="min-h-[44px] rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
									>Cancel</button
								>
							</div>
						</form>
					{/if}
				</div>

				{#if !newTemplate}
					<button
						type="button"
						onclick={openNewTemplate}
						class="mt-3 min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
						>+ Add template</button
					>
				{/if}
			</section>
		{:else if section === 'globals'}
			<section class="mt-6 lg:mt-0" id="account-globals">
				<h2 class="text-lg font-medium text-[var(--text)]">Global variables</h2>
				<p class="mt-1 text-sm text-[var(--text-muted)]">Key-value pairs merged into every webhook JSON payload.</p>

				<div class="mt-4 space-y-3">
					{#each data.globals as g}
						{#if editingGlobalId === g.id}
							<form
								method="POST"
								action="?/updateGlobal"
								use:enhance={() => {
									editingGlobalId = null;
									return invalidateAll();
								}}
								class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
							>
								<input type="hidden" name="id" value={g.id} />
								<div class="grid gap-3 sm:grid-cols-3">
									<div>
										<label for="edit-global-key" class="block text-sm font-medium text-[var(--text)]">Key</label>
										<input
											id="edit-global-key"
											type="text"
											name="key"
											value={g.key}
											required
											class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
										/>
									</div>
									<div>
										<label for="edit-global-value" class="block text-sm font-medium text-[var(--text)]">Value</label>
										<input
											id="edit-global-value"
											type="text"
											name="value"
											value={g.value ?? ''}
											class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
										/>
									</div>
									<div>
										<label for="edit-global-type" class="block text-sm font-medium text-[var(--text)]">Type</label>
										<select
											id="edit-global-type"
											name="type"
											class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
										>
											<option value="string" selected={g.type === 'string'}>string</option>
											<option value="number" selected={g.type === 'number'}>number</option>
											<option value="boolean" selected={g.type === 'boolean'}>boolean</option>
											<option value="json" selected={g.type === 'json'}>json</option>
										</select>
									</div>
								</div>
								<div class="mt-3 flex gap-2">
									<button type="submit" class="btn-primary min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white"
										>Save</button
									>
									<button
										type="button"
										onclick={() => (editingGlobalId = null)}
										class="min-h-[44px] rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
										>Cancel</button
									>
								</div>
							</form>
						{:else}
							<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
								<div class="min-w-0">
									<p class="font-medium text-[var(--text)]">{g.key}</p>
									<p class="truncate text-sm text-[var(--text-muted)]">{g.value ?? '(empty)'}</p>
								</div>
								<div class="flex gap-2">
									<button
										type="button"
										onclick={() => (editingGlobalId = g.id)}
										class="min-h-[44px] min-w-[44px] rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-hover)]"
										>Edit</button
									>
									<form
										method="POST"
										action="?/deleteGlobal"
										use:enhance={({ cancel }) => {
											if (
												!confirm(
													`Delete global variable "${g.key}"? Templates or payloads that use it may show wrong values until you update them.`
												)
											)
												cancel();
											return () => invalidateAll();
										}}
										class="inline"
									>
										<input type="hidden" name="id" value={g.id} />
										<button type="submit" class="btn-danger-outline min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm"
											>Delete</button
										>
									</form>
								</div>
							</div>
						{/if}
					{/each}

					{#if newGlobal}
						<form
							method="POST"
							action="?/createGlobal"
							use:enhance={() => {
								newGlobal = false;
								return invalidateAll();
							}}
							class="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
						>
							<div class="grid gap-3 sm:grid-cols-3">
								<div>
									<label for="new-global-key" class="block text-sm font-medium text-[var(--text)]">Key</label>
									<input
										id="new-global-key"
										type="text"
										name="key"
										required
										placeholder="e.g. source"
										class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
									/>
								</div>
								<div>
									<label for="new-global-value" class="block text-sm font-medium text-[var(--text)]">Value</label>
									<input
										id="new-global-value"
										type="text"
										name="value"
										placeholder="e.g. postplan"
										class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
									/>
								</div>
								<div>
									<label for="new-global-type" class="block text-sm font-medium text-[var(--text)]">Type</label>
									<select
										id="new-global-type"
										name="type"
										class="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
									>
										<option value="string">string</option>
										<option value="number">number</option>
										<option value="boolean">boolean</option>
										<option value="json">json</option>
									</select>
								</div>
							</div>
							<div class="mt-3 flex gap-2">
								<button type="submit" class="btn-primary min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white"
									>Add variable</button
								>
								<button
									type="button"
									onclick={() => (newGlobal = false)}
									class="min-h-[44px] rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
									>Cancel</button
								>
							</div>
						</form>
					{/if}
				</div>
				{#if !newGlobal}
					<button
						type="button"
						onclick={() => (newGlobal = true)}
						class="mt-3 min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
						>+ Add variable</button
					>
				{/if}
			</section>
		{:else if section === 'settings'}
			<section class="mt-6 lg:mt-0" id="account-settings">
				<div class="content-card rounded-xl p-6 shadow-sm">
					<h2 class="text-base font-semibold text-[var(--text)]">Theme</h2>
					<p class="mt-1 text-sm text-[var(--text-muted)]">
						Light or dark appearance. Your choice is remembered in this browser.
					</p>
					<div class="mt-4 flex flex-wrap items-center gap-4">
						<p class="text-sm text-[var(--text)]">
							Currently using <span class="font-medium capitalize">{$theme}</span> mode.
						</p>
						<button
							type="button"
							class="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
							onclick={toggleTheme}
							aria-label={$theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
						>
							{#if $theme === 'dark'}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
									/>
								</svg>
								Use light mode
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
									/>
								</svg>
								Use dark mode
							{/if}
						</button>
					</div>
				</div>
			</section>
		{/if}
	</div>
</div>
