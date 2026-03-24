<script lang="ts">
	// Benefits by plan for the comparison table
	const planTableRows = [
		{ benefit: 'Posts sent per month', free: '20', pro: '500', enterprise: 'Unlimited' },
		{ benefit: 'Callback inputs per month', free: '100', pro: '2,000', enterprise: 'Unlimited' },
		{ benefit: 'Import operations per month', free: '100', pro: '2,000', enterprise: 'Unlimited' },
		{ benefit: 'Calendar view', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Schedules & rules', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Bulk import (WordPress, RSS, CSV, Squarespace)', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Callback import (webhook)', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Webhooks (outputs)', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Reports & send logs', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Account & billing', free: '✓', pro: '✓', enterprise: '✓' },
		{ benefit: 'Upgrade / downgrade', free: '—', pro: 'Stripe', enterprise: 'Contact' }
	];
</script>

<svelte:head>
	<title>Technical details – PostPlan</title>
	<meta name="description" content="Plans comparison and full feature list for PostPlan: dashboard, calendar, posts, schedules, bulk import, callback import, webhooks, reports, settings." />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
	<p class="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">Technical details</p>
	<h1 class="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl" style="letter-spacing: -0.02em;">
		Plans and features
	</h1>
	<p class="mt-4 max-w-2xl text-[var(--text-muted)]" style="line-height: 1.6;">
		Below: how each plan compares, then a full list of what each part of the application does.
	</p>

	<!-- Plan comparison table: rows = benefits, columns = plans -->
	<section class="mt-12">
		<h2 class="text-xl font-semibold text-[var(--text)]">Plan comparison</h2>
		<div class="mt-4 overflow-x-auto">
			<table class="w-full min-w-[640px] border-collapse rounded-xl border border-[var(--border)] bg-[var(--surface)]">
				<thead>
					<tr class="border-b border-[var(--border)] bg-[var(--bg)]">
						<th class="px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Benefit</th>
						<th class="border-l border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Free</th>
						<th class="border-l border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Pro</th>
						<th class="border-l border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--text)]">Enterprise</th>
					</tr>
				</thead>
				<tbody>
					{#each planTableRows as row, i}
						<tr class="border-b border-[var(--border)] { i % 2 === 1 ? 'bg-[var(--bg)]/50' : '' }">
							<td class="px-4 py-3 text-sm text-[var(--text)]">{row.benefit}</td>
							<td class="border-l border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">{row.free}</td>
							<td class="border-l border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">{row.pro}</td>
							<td class="border-l border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">{row.enterprise}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- Detailed list of application features -->
	<section class="mt-16">
		<h2 class="text-xl font-semibold text-[var(--text)]">Application features (detailed)</h2>
		<p class="mt-2 text-sm text-[var(--text-muted)]">Every area of the app and what it does.</p>
		<dl class="mt-8 space-y-8">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Dashboard (Home)</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					The main landing page after login. Shows a workflow diagram, stats (total posts, drafts, scheduled, sent, failed, schedules, webhooks, sent this week, Make.com stage passes/fails), upcoming posts list, quick actions (New post, Calendar, Schedules, Import), and recent activity (last sent posts, failed posts, posts with failed stages). Gives an at-a-glance view of your account.
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Calendar</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					Month and week views of all posts. See which posts are scheduled or sent on which days. Drag and drop to reschedule. Color-coded by post type. Click a day to create a post for that date. Uses schedules to compute when a post will fire; you see the spread of sends across the month. Counts toward your plan’s posts-per-month limit (scheduled + sent in that month).
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Posts</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					List and manage all posts. Filter by status (draft, scheduled, sent, failed). Each post has a title, optional body, scheduled date/time (or schedule rule), webhook (output), and payload. You can create a new post, edit, duplicate, send now, or delete. Post creation enforces the monthly posts limit (sent + scheduled in that month). Status flows: draft → scheduled → sent (or failed).
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Schedules</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					Reusable time rules (e.g. “Mondays at 9am”, “First of month at noon”). When you assign a schedule to a post, the app computes the next run time and stores it as the post’s scheduled_at. You can create, edit, and delete schedules. The calendar and post list use these to show when posts will go out.
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Reports</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					Two report types. (1) Request / Response: for every sent post, the request JSON sent to the webhook and the response from the server. Lets you debug failed sends. (2) Callback stages: pass/fail counts for Make.com (or similar) callback stages, so you can see how many webhook calls succeeded or failed at each stage.
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Import (Bulk create)</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					Bulk-import posts from external sources. Supported: WordPress (API or CSV export), Squarespace (RSS), RSS feed, or a generic CSV. You choose a source, map fields (title, body, date, etc.) to post fields, pick a schedule and webhook, and the app creates many posts at once. Each bulk-import run counts as one “import operation” toward your monthly limit; the number of posts created counts toward the posts-per-month limit.
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Callback import (API)</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					<code class="rounded bg-[var(--bg)] px-1.5 py-0.5 text-xs font-mono text-[var(--text)]">POST /api/callbacks/import</code> — Accepts a webhook request (e.g. from Make.com) with a secret token. Creates one or more posts from the payload and optionally assigns scheduled_at. Each request counts as one import operation and each created post counts as one callback input toward your monthly limits. You get a unique callback URL and token in Settings → Inputs.
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Settings</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					Configure outputs (webhooks), inputs (callback import URL and token), templates (reusable payload structures with placeholders), and globals (key-value variables used in templates). Outputs define where posts are sent (URL, method, headers). Inputs define how external systems can create posts via the callback import API. Templates and globals let you build consistent JSON payloads across posts.
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Sending posts (cron / manual)</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					A cron job (or manual “Send now”) finds posts whose scheduled_at is due and sends their payload to the configured webhook. The post’s status becomes “sent” or “failed”. Sent count for that calendar month increases. Limits are enforced when scheduling: you cannot schedule a post if (sent + scheduled in that month) would exceed your tier’s posts limit.
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Account</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					Shows your current tier (free, pro, enterprise), usage this month (posts used/limit, callback inputs used/limit, imports used/limit), and billing. You can upgrade to Pro (Stripe Checkout), open the Stripe Customer Portal to manage or cancel subscription, or contact for Enterprise. Logout redirects to the public welcome site.
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Users (admin only)</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					Visible only to users with the admin tier. Lists all users with email, name, tier, and current month usage. Admins can change another user’s tier (free, pro, enterprise, blocked). The first user in the system is set as admin; you cannot demote the last admin.
				</dd>
			</div>

			<div class="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
				<dt class="text-lg font-semibold text-[var(--text)]">Limits (monthly, per calendar month)</dt>
				<dd class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">
					Posts: maximum number of posts that can be sent in a single calendar month (sent + scheduled for that month). No refill within the month—e.g. Free allows 20 sends in January total; if 5 are sent by Jan 10, you have 15 left for January and cannot add more for January. Callback inputs: number of posts created via the callback import API per month. Imports: number of import operations (one bulk-create run or one callback import request) per month. All enforced at creation/schedule time.
				</dd>
			</div>
		</dl>
	</section>

	<div class="mt-12 flex flex-wrap gap-4">
		<a href="/welcome#pricing" class="btn-primary inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold text-white">View pricing</a>
		<a href="/auth/login" class="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]">Log in</a>
	</div>
</div>
