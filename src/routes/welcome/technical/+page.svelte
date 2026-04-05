<script lang="ts">
	import FeatureSectionAnimation from '$lib/components/FeatureSectionAnimation.svelte';

	const planTableRows = [
		{ benefit: 'Posts sent per month', free: '20', pro: '500', enterprise: 'Unlimited' },
		{ benefit: 'Callback inputs per month', free: '100', pro: '2,000', enterprise: 'Unlimited' },
		{ benefit: 'Import operations per month', free: '100', pro: '2,000', enterprise: 'Unlimited' },
		{ benefit: 'Calendar (all views)', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Schedules — daily, weekly, monthly, yearly, CRON, interval', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Multi-rule schedules', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Posts — multi-edit, custom fields, colour, JSON override', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Callback stages per post', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Inputs — WordPress, Squarespace, RSS, CSV wizards', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Inbound webhook (import API)', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Outputs — unlimited webhook endpoints', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Custom headers & API keys per output', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Reports — request/response logs, callback stages, stats', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Templates & global variables', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'oAuth login providers', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Stripe billing & customer portal', free: '—', pro: '✓', enterprise: 'Contact' },
		{ benefit: 'Admin user management', free: '—', pro: '—', enterprise: '✓' },
	];

	const sections: {
		n: 1 | 2 | 3 | 4 | 5 | 6 | 7;
		eyebrow: string;
		heading: string;
		lead: string;
		detail: string;
		body: string;
	}[] = [
		{
			n: 1,
			eyebrow: 'Calendar',
			heading: 'The content calendar at the centre of everything',
			lead: `Six interchangeable views — day, week, month, year, agenda, and schedule — put every post in context the moment you log in.`,
			detail: `Drag any post to a new day to reschedule it instantly. PostPlan recomputes the send time and, if the post was assigned via a schedule rule, detaches it from the recurring pattern and pins it to the new date — so you can break the cadence for one-off changes without disrupting the rest of the series. A compact stats bar across the top shows post counts by status, active schedules, connected outputs, and sends this week.`,
			body: `Post colours flow from the calendar through to the post list and reports. The colour system is entirely user-defined — no fixed mapping — so you can use it to represent content type, campaign, author, destination, or urgency. New accounts see a dismissible first-time checklist that guides through connecting a webhook, creating a schedule, and adding a first post, so the calendar is never empty and confusing on day one.`,
		},
		{
			n: 2,
			eyebrow: 'Schedules',
			heading: 'Precise, composable recurrence rules',
			lead: `A schedule is a named, reusable set of recurrence rules that computes the next send time for every post assigned to it.`,
			detail: `Supported patterns include daily at a fixed time, weekly on chosen days, monthly by date or weekday position (e.g. "first Monday"), yearly, full CRON expressions, and interval-based rules like "every 6 hours". Multiple rules combine with union semantics — a schedule with both "weekday at 9am" and "first of month at noon" fires at all those times, merged and deduplicated. This makes complex editorial cadences manageable without separate schedules for every variation.`,
			body: `Bulk schedule edits let you reassign many posts to a different schedule in one operation, with PostPlan recomputing scheduled_at for all of them simultaneously. Schedules also support their own custom fields — key-value pairs that merge into every outbound payload alongside post-level fields and global variables, stamping schedule-level metadata like campaign ID or content tier onto every post that flows through without touching each post individually.`,
		},
		{
			n: 3,
			eyebrow: 'Posts',
			heading: 'Full control over every outbound payload',
			lead: `Every post is a named payload with a schedule, an output webhook, a status, and as many custom fields as your integration needs.`,
			detail: `Multi-post editing lets you select any number of posts and update status, schedule, output webhook, colour, or delete them all at once — essential for repricing a campaign, rerouting a content type, or clearing a backlog of drafts after a pivot. The JSON override field is a direct escape hatch: paste any valid JSON object and PostPlan sends exactly that, with no additional keys merged in, giving you total control when a downstream webhook has rigid payload expectations.`,
			body: `Callback stages close the loop on what happens after a post fires. When Make.com or your own system POSTs back to PostPlan's callback endpoint with a stage name and a pass/fail result, PostPlan records it against the post and surfaces it in the post detail view and in Reports. Each post can accumulate multiple stages — "published", "social_shared", "email_sent" — giving you a full audit trail of every step in the publishing pipeline, not just whether the initial HTTP send succeeded.`,
		},
		{
			n: 4,
			eyebrow: 'Inputs',
			heading: 'Every source your content already lives in',
			lead: `WordPress, Squarespace, RSS, CSV, and inbound webhooks all feed directly into PostPlan's scheduling queue.`,
			detail: `The CMS wizards for WordPress and Squarespace walk you through field mapping, schedule assignment, and bulk post creation in a single flow. RSS inputs poll any valid Atom or RSS URL on a configurable interval, creating a new post for each item not yet seen. Fields map automatically from standard RSS elements and any unmapped fields are captured as custom fields, making syndication from an external CMS entirely hands-off once configured.`,
			body: `The inbound webhook API at <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-xs text-[var(--text)]">POST /api/callbacks/import</code> accepts JSON and creates posts programmatically — authenticated with your account's webhook token. Each import request counts as one operation against your monthly quota and any posts created count against your posts limit. Callback inputs work in the reverse direction: your automation POSTs a stage result back to <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-xs text-[var(--text)]">/api/callbacks/stage</code> confirming that each step of your pipeline completed, closing the loop between scheduling and execution.`,
		},
		{
			n: 5,
			eyebrow: 'Outputs',
			heading: 'Route posts to exactly the right destination',
			lead: `An output is a named outbound webhook: a URL, an optional API key, and any custom HTTP headers your endpoint requires.`,
			detail: `You can create as many outputs as your workflow needs — one per platform, per environment, per team, or per content type. Beyond the convenience x-api-key field, you can add any HTTP header: Authorization Bearer tokens, X-Tenant-ID values, Content-Type overrides, or anything else. Headers are stored per output and applied automatically to every request sent through it, so authentication is configured once and never needs to be repeated per post.`,
			body: `The outbound payload is a JSON object merging the post's title, body, and custom fields with any schedule-level custom fields and the account's global variables. A JSON override on a post replaces the entire computed payload, giving the output's destination and authentication settings no bearing on the shape of what it receives. Output IDs are stable identifiers used by the import API and bulk import wizards for routing, enabling fully automated pipelines where an external system creates posts and PostPlan fires them to a different endpoint without any manual step.`,
		},
		{
			n: 6,
			eyebrow: 'Reports',
			heading: 'Complete visibility from send to stage confirmation',
			lead: `Every send is logged with its full request payload and raw HTTP response so you can debug any failure in seconds.`,
			detail: `The Request/Response panel stores the exact outbound JSON and the response body for every send, filterable by post, output, or status code. For a failed 422 or 5xx, this is where you see exactly what your webhook returned without needing to check external logs. The Statistics panel shows current-month sends, failed post counts, upcoming scheduled posts, and a Make.com stage pass/fail ratio — the first place to check when diagnosing whether automation is performing as expected.`,
			body: `Callback stage tracking gives you the downstream view: each stage report shows the name, pass/fail result, timestamp, and any response data included in the callback POST body, in the order received, so you can reconstruct the exact sequence of events for any post. Failed stages surface prominently in the Statistics panel for quick triage. Every send and every callback is stored in full — not aggregated or sampled — making Reports suitable for formal post-mortems. Logs for high-volume accounts are paginated and filterable by date range and status.`,
		},
		{
			n: 7,
			eyebrow: 'Accounts',
			heading: 'Defaults, variables, and plan management in one place',
			lead: `Templates, global variables, billing, oAuth, and themes are all managed from a single Account page.`,
			detail: `Templates are reusable custom-field structures — define a set of field names and optional default values once, then apply them to any post to pre-fill its custom fields instantly. Global variables are key-value pairs that PostPlan merges into the outbound payload of every post at send time, not at creation time, so updating a global variable immediately affects all future sends including already-scheduled posts. Both features enforce consistency across your payload structure without touching individual posts.`,
			body: `Plan and billing management shows current-month usage against your tier's limits. Pro accounts can upgrade, downgrade, or cancel through the Stripe customer portal link; Enterprise is configured by contacting the team. oAuth providers let you connect third-party login credentials — multiple providers can be active simultaneously, and you can log in without a password via any connected provider. Theme selection between light and dark persists per account globally. Password management and permanent account deletion also live here.`,
		},
	];
</script>

<svelte:head>
	<title>Technical details – PostPlan</title>
	<meta name="description" content="Full technical documentation for PostPlan: calendar, schedules, posts, inputs, outputs, reports, and accounts. Feature breakdown, payload reference, and plan comparison." />
</svelte:head>

<!-- Page header -->
<div class="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-12 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-6xl">
		<p class="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">Technical details</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl" style="letter-spacing: -0.02em;">
			How PostPlan works
		</h1>
		<p class="mt-4 max-w-2xl text-[var(--text-muted)]" style="line-height: 1.6;">
			In-depth documentation on every section of the application, how sending works end to end, the plan limits model, and a feature comparison table.
		</p>
		<div class="mt-6 flex flex-wrap gap-4">
			<a href="#plans" class="text-sm font-medium text-[var(--primary)] hover:underline">Plan comparison →</a>
			<a href="#sending" class="text-sm font-medium text-[var(--primary)] hover:underline">How sending works →</a>
			<a href="#limits" class="text-sm font-medium text-[var(--primary)] hover:underline">Limits model →</a>
		</div>
	</div>
</div>

<!-- Plan comparison table -->
<section id="plans" class="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
	<div class="mx-auto max-w-6xl">
		<h2 class="text-2xl font-semibold tracking-tight text-[var(--text)]" style="letter-spacing: -0.02em;">Plan comparison</h2>
		<p class="mt-3 max-w-2xl text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
			All plans include every feature. The only differences are the monthly usage quotas and access to admin and billing capabilities.
		</p>
		<div class="mt-8 overflow-x-auto">
			<table class="w-full min-w-[640px] border-collapse rounded-xl border border-[var(--border)] bg-[var(--surface)]">
				<thead>
					<tr class="border-b border-[var(--border)] bg-[var(--bg)]">
						<th class="px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Feature</th>
						<th class="border-l border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Free</th>
						<th class="border-l border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--primary)]">Pro</th>
						<th class="border-l border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Enterprise</th>
					</tr>
				</thead>
				<tbody>
					{#each planTableRows as row, i}
						<tr class="border-b border-[var(--border)] {i % 2 === 1 ? 'bg-[var(--bg)]/40' : ''}">
							<td class="px-4 py-3 text-sm text-[var(--text)]">{row.benefit}</td>
							<td class="border-l border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">{row.free}</td>
							<td class="border-l border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text)]">{row.pro}</td>
							<td class="border-l border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">{row.enterprise}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>

<!-- How sending works -->
<section id="sending" class="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
	<div class="mx-auto max-w-6xl">
		<h2 class="text-2xl font-semibold tracking-tight text-[var(--text)]" style="letter-spacing: -0.02em;">How sending works</h2>
		<div class="mt-6 grid gap-12 lg:grid-cols-2 lg:gap-16 items-start">
			<div class="space-y-5 text-sm text-[var(--text-muted)]" style="line-height: 1.75;">
				<p>
					PostPlan runs a cron job every minute that queries for posts whose <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-xs text-[var(--text)]">scheduled_at</code> timestamp is in the past and whose status is <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-xs text-[var(--text)]">scheduled</code>. For each matching post it builds the outbound JSON payload by merging: the post's own fields (title, body, custom fields), the schedule's custom fields if a schedule is assigned, the account's global variables, and — if a JSON override is set — replacing all of the above with the override JSON entirely. The result is sent as an HTTP POST to the output webhook's URL with the configured headers.
				</p>
				<p>
					A successful send (2xx response) transitions the post status to <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-xs text-[var(--text)]">sent</code> and increments the account's monthly sent count. A non-2xx response marks the post as <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-xs text-[var(--text)]">failed</code> and stores the response body in the request/response log for inspection in Reports. Failed posts do not retry automatically — you can manually trigger a resend from the post detail view after fixing the issue.
				</p>
				<p>
					After sending, if your automation system wants to report back on what happened, it can POST to <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-xs text-[var(--text)]">/api/callbacks/stage</code> with the post's ID, a stage name, and a pass/fail flag. PostPlan stores this against the post and makes it visible in Reports. The callback endpoint uses the same webhook token as the import API — you authenticate with <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-xs text-[var(--text)]">Authorization: Bearer &lt;token&gt;</code>.
				</p>
				<pre class="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 text-xs font-mono text-[var(--text)]">{`// Example outbound payload
{
  "id": "post_abc123",
  "title": "Q2 Campaign Launch",
  "body": "Check out our new features...",
  "scheduled_at": "2026-04-07T09:00:00Z",
  "color": "#005f78",
  "custom": {
    "source": "postplan",
    "campaign": "q2-2026"
  },
  "globals": {
    "env": "production",
    "api_key": "sk_live_xxx"
  }
}`}</pre>
			</div>
			<div class="space-y-4">
				<div class="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
					<div class="border-b border-[var(--border)] px-4 py-3">
						<span class="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Send flow</span>
					</div>
					<div class="p-4 space-y-3">
						{#each [
							{ step: '1', label: 'Cron trigger', detail: 'Every minute — finds due posts', color: 'var(--primary)' },
							{ step: '2', label: 'Payload built', detail: 'Post fields + schedule fields + globals merged', color: 'var(--primary)' },
							{ step: '3', label: 'HTTP POST fired', detail: 'To output webhook URL with headers', color: 'var(--primary)' },
							{ step: '4', label: 'Response stored', detail: 'Status code + body → Reports log', color: 'var(--primary)' },
							{ step: '5', label: 'Status updated', detail: 'sent or failed on the post', color: 'var(--primary)' },
							{ step: '6', label: 'Callback received', detail: 'Stage results POSTed back by your system', color: 'var(--primary)' },
						] as row}
							<div class="flex items-start gap-3">
								<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[10px] font-bold text-[var(--primary)]">{row.step}</span>
								<div>
									<span class="text-sm font-semibold text-[var(--text)]">{row.label}</span>
									<span class="text-sm text-[var(--text-muted)]"> — {row.detail}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Limits model -->
<section id="limits" class="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
	<div class="mx-auto max-w-6xl">
		<h2 class="text-2xl font-semibold tracking-tight text-[var(--text)]" style="letter-spacing: -0.02em;">Limits model</h2>
		<div class="mt-6 grid gap-8 lg:grid-cols-3">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<h3 class="text-sm font-semibold text-[var(--text)]">Posts per month</h3>
				<p class="mt-3 text-sm text-[var(--text-muted)]" style="line-height: 1.7;">
					The posts limit counts <em>sent plus scheduled</em> posts for the current calendar month. A post counts the moment it is scheduled (status becomes <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-[10px] text-[var(--text)]">scheduled</code>), not when it fires. This prevents exceeding the limit by scheduling far into the future. The count resets on the first day of each calendar month, not on a rolling 30-day window.
				</p>
			</div>
			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<h3 class="text-sm font-semibold text-[var(--text)]">Callback inputs per month</h3>
				<p class="mt-3 text-sm text-[var(--text-muted)]" style="line-height: 1.7;">
					Each POST to <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-[10px] text-[var(--text)]">/api/callbacks/import</code> counts as one callback input, regardless of how many posts it creates. If a single import request body creates five posts, that is one callback input consumed and five posts counted against your posts limit. Stage callback POSTs to <code class="rounded bg-[var(--bg)] px-1 py-0.5 font-mono text-[10px] text-[var(--text)]">/api/callbacks/stage</code> do not count against any limit.
				</p>
			</div>
			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<h3 class="text-sm font-semibold text-[var(--text)]">Import operations per month</h3>
				<p class="mt-3 text-sm text-[var(--text-muted)]" style="line-height: 1.7;">
					One import operation is consumed each time you run a wizard import (WordPress, Squarespace, RSS, CSV) or make a single inbound webhook API call. Import operations and callback inputs share the same monthly quota. The posts created by an import operation also count against your posts quota. All three limits — posts, callback inputs, imports — are enforced at the point of creation, not at the point of sending.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- 7 Feature sections — alternating layout with shared animations -->
{#each sections as s, idx}
	<section class="border-b border-[var(--border)] {idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--bg)]'} px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
		<div class="mx-auto max-w-6xl">
			<div class="grid items-start gap-12 lg:grid-cols-2 lg:gap-16 {idx % 2 === 1 ? 'lg:[&>*:first-child]:order-last' : ''}">
				<!-- Text column -->
				<div>
					<p class="text-xs font-medium uppercase tracking-widest text-[var(--primary)]">{s.eyebrow}</p>
					<h2 class="mt-3 text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl" style="letter-spacing: -0.02em; line-height: 1.2;">
						{s.heading}
					</h2>
					<!-- Lead: large, single sentence -->
					<p class="mt-5 text-lg font-medium text-[var(--text)]" style="line-height: 1.5; max-width: 44ch;">
						{s.lead}
					</p>
					<!-- Detail: smaller, mid-weight -->
					<p class="mt-4 text-sm font-normal text-[var(--text-muted)]" style="line-height: 1.75; max-width: 52ch;">
						{@html s.detail}
					</p>
					<!-- Body: standard size, most depth -->
					<p class="mt-4 text-sm text-[var(--text-muted)]" style="line-height: 1.8; max-width: 52ch; opacity: 0.85;">
						{@html s.body}
					</p>
				</div>
				<!-- Animation column -->
				<div class="overflow-hidden rounded-xl border border-[var(--border)] aspect-[4/3] lg:sticky lg:top-24">
					<FeatureSectionAnimation section={s.n} class="w-full h-full" />
				</div>
			</div>
		</div>
	</section>
{/each}

<!-- CTA -->
<section class="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
	<div class="mx-auto max-w-3xl text-center">
		<h2 class="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl" style="letter-spacing: -0.02em;">
			Ready to try PostPlan?
		</h2>
		<p class="mt-4 text-[var(--text-muted)]" style="line-height: 1.6;">
			Free accounts get 20 sends, 100 import operations, and 100 callback inputs per month. No credit card required.
		</p>
		<div class="mt-8 flex flex-wrap items-center justify-center gap-4">
			<a href="/auth/login" class="btn-primary inline-flex rounded-lg px-6 py-3 text-base font-semibold text-white">
				Get started free
			</a>
			<a href="/welcome#pricing" class="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-base font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]">
				View pricing
			</a>
		</div>
	</div>
</section>
