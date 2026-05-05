<script lang="ts">
	import PageSectionHeading from '$lib/components/PageSectionHeading.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Status – PostPlan</title>
</svelte:head>

<PageSectionHeading
	title="Status"
	description="Host and scheduler hints for this server process (admin only)."
/>

{#if form?.error}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-error">{form.error}</p>
{/if}
{#if form?.senderSettingsSaved}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">Sender settings saved.</p>
{/if}
{#if form?.senderSettingsCleared}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">Sender settings reset to environment defaults.</p>
{/if}
{#if form?.loadTestSettingsSaved}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">Load-test settings saved.</p>
{/if}
{#if form?.loadTestSettingsCleared}
	<p class="mt-4 rounded-lg px-3 py-2 text-sm alert-success">Load-test settings reset to environment defaults.</p>
{/if}

<div class="mt-6 space-y-6">
	<section class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
		<h2 class="text-base font-semibold text-[var(--text)]">Sender tuning</h2>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			These values control scheduler throughput and lock behavior. Database values override environment variables.
		</p>
		<form method="POST" action="?/saveSenderSettings" class="mt-4 grid gap-4 md:grid-cols-3" use:enhance={() => invalidateAll()}>
			<div>
				<label for="claim-batch" class="mb-1 block text-sm font-medium text-[var(--text)]">Claim batch</label>
				<p class="mb-1 text-xs text-[var(--text-muted)]">
					How many due posts the sender grabs from the database in one pass before it starts sending.
				</p>
				<input
					id="claim-batch"
					name="claimBatch"
					type="number"
					min="1"
					max="5000"
					required
					value={data.senderSettings.effective.claimBatch}
					class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
				/>
			</div>
			<div>
				<label for="concurrency" class="mb-1 block text-sm font-medium text-[var(--text)]">Concurrency</label>
				<p class="mb-1 text-xs text-[var(--text-muted)]">
					How many posts can be sent at the same time.
				</p>
				<input
					id="concurrency"
					name="concurrency"
					type="number"
					min="1"
					max="200"
					required
					value={data.senderSettings.effective.concurrency}
					class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
				/>
			</div>
			<div>
				<label for="lock-ttl" class="mb-1 block text-sm font-medium text-[var(--text)]">Lock TTL (ms)</label>
				<p class="mb-1 text-xs text-[var(--text-muted)]">
					How long a send run keeps its lock before another run is allowed to take over if it gets stuck.
				</p>
				<input
					id="lock-ttl"
					name="lockTtlMs"
					type="number"
					min="1000"
					max="3600000"
					required
					value={data.senderSettings.effective.lockTtlMs}
					class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
				/>
			</div>
			<div class="md:col-span-3 flex flex-wrap items-center gap-3">
				<button type="submit" class="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
					Save sender settings
				</button>
			</div>
		</form>
		<div class="mt-4 text-xs text-[var(--text-muted)]">
			<p>
				DB overrides:
				claim batch <strong class="text-[var(--text)]">{data.senderSettings.dbOverrides.claimBatch ?? 'none'}</strong>,
				concurrency <strong class="text-[var(--text)]">{data.senderSettings.dbOverrides.concurrency ?? 'none'}</strong>,
				lock TTL <strong class="text-[var(--text)]">{data.senderSettings.dbOverrides.lockTtlMs ?? 'none'}</strong>.
			</p>
		</div>
		<form method="POST" action="?/clearSenderSettings" class="mt-3" use:enhance={() => invalidateAll()}>
			<button
				type="submit"
				class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
			>
				Clear DB overrides (use env)
			</button>
		</form>
	</section>

	<section class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
		<h2 class="text-base font-semibold text-[var(--text)]">Multi-user load test settings</h2>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			These values control the multi-user load suite (Playwright UI scenarios + k6 virtual users). Database values override environment variables.
		</p>
		<form
			method="POST"
			action="?/saveLoadTestSettings"
			class="mt-4 grid gap-4 md:grid-cols-2"
			use:enhance={() => invalidateAll()}
		>
			<div class="md:col-span-2">
				<label class="flex items-start gap-3 text-sm text-[var(--text)]">
					<input
						type="checkbox"
						name="allowProdLoadTest"
						checked={data.loadTestSettings.effective.allowProdLoadTest}
						class="mt-0.5"
					/>
					<span>
						<span class="font-medium">Allow load tests against production</span>
						<span class="mt-1 block text-xs text-[var(--text-muted)]">
							Master switch read by load scripts. When off, scripts targeting a production-looking URL must refuse to run unless an explicit override flag is also passed.
						</span>
					</span>
				</label>
			</div>
			<div>
				<label for="ui-users" class="mb-1 block text-sm font-medium text-[var(--text)]">UI users</label>
				<p class="mb-1 text-xs text-[var(--text-muted)]">
					How many simulated browser users the Playwright multi-user suite spins up at the same time.
				</p>
				<input
					id="ui-users"
					name="uiUsers"
					type="number"
					min={data.loadTestSettings.limits.uiUsersMin}
					max={data.loadTestSettings.limits.uiUsersMax}
					required
					value={data.loadTestSettings.effective.uiUsers}
					class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
				/>
			</div>
			<div>
				<label for="scenario-mix" class="mb-1 block text-sm font-medium text-[var(--text)]">Scenario mix (JSON)</label>
				<p class="mb-1 text-xs text-[var(--text-muted)]">
					Weighted list of named scenarios that virtual users randomly pick from. Higher weight = more frequent.
				</p>
				<textarea
					id="scenario-mix"
					name="scenarioMix"
					rows="6"
					required
					class="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-mono text-[var(--text)]"
					>{JSON.stringify(data.loadTestSettings.effective.scenarioMix, null, 2)}</textarea
				>
			</div>
			<div class="md:col-span-2 flex flex-wrap items-center gap-3">
				<button
					type="submit"
					class="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
				>
					Save load-test settings
				</button>
			</div>
		</form>
		<div class="mt-4 text-xs text-[var(--text-muted)]">
			<p>
				DB overrides:
				allow prod
				<strong class="text-[var(--text)]"
					>{data.loadTestSettings.dbOverrides.allowProdLoadTest === null
						? 'none'
						: data.loadTestSettings.dbOverrides.allowProdLoadTest
							? 'true'
							: 'false'}</strong
				>,
				UI users <strong class="text-[var(--text)]">{data.loadTestSettings.dbOverrides.uiUsers ?? 'none'}</strong>,
				scenario mix <strong class="text-[var(--text)]"
					>{data.loadTestSettings.dbOverrides.scenarioMix === null ? 'none' : 'set'}</strong
				>.
			</p>
		</div>
		<form method="POST" action="?/clearLoadTestSettings" class="mt-3" use:enhance={() => invalidateAll()}>
			<button
				type="submit"
				class="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
			>
				Clear DB overrides (use env)
			</button>
		</form>
	</section>

	<section class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
		<h2 class="text-base font-semibold text-[var(--text)]">System cron daemon</h2>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			This checks whether a traditional <code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">cron</code> or
			<code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">crond</code> process is running in this container or
			host. The production Docker image does not start a cron daemon by default.
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<span
				class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium {data.cronDaemon.running
					? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
					: 'bg-amber-500/15 text-amber-800 dark:text-amber-200'}"
			>
				{data.cronDaemon.running ? 'Running' : 'Not detected'}
			</span>
		</div>
		<p class="mt-3 text-sm text-[var(--text)]">
			<span class="font-medium">Check:</span>
			{data.cronDaemon.method}
		</p>
		{#if data.cronDaemon.detail}
			<p class="mt-2 text-sm text-[var(--text-muted)]">{data.cronDaemon.detail}</p>
		{/if}
	</section>

	<section class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
		<h2 class="text-base font-semibold text-[var(--text)]">PostPlan scheduled posts</h2>
		<p class="mt-2 text-sm text-[var(--text-muted)]">
			Due posts are sent when something calls the HTTP endpoint
			<code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">GET /api/cron/send-due-posts</code> with the
			<code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">x-cron-secret</code> header (see
			<code class="rounded bg-[var(--sidebar-bg)] px-1 py-0.5 text-xs">CRON_SECRET</code>). That is usually wired from
			the host, Kubernetes CronJob, or an external scheduler—not from in-container system cron unless you add it.
		</p>
	</section>
</div>
