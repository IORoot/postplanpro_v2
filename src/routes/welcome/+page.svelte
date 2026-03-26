<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>PostPlan – Schedule and send posts to your webhooks</title>
	<meta name="description" content="Plan content in a calendar, use schedules and bulk import, and fire posts to your webhooks when they're due. Free tier available." />
</svelte:head>

<!-- Hero -->
<section class="relative overflow-hidden bg-[var(--bg)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
	<div class="mx-auto max-w-4xl text-center">
		<h1 class="text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl lg:text-6xl" style="letter-spacing: -0.03em; line-height: 1.1;">
			Schedule posts.<br />Send to webhooks.
		</h1>
		<p class="mx-auto mt-6 max-w-[52ch] text-pretty text-lg leading-relaxed text-[var(--text-muted)]">
			Plan content in a calendar, use schedules and bulk import, and fire posts when they’re due. Connect Make.com, Zapier, or any HTTP endpoint.
		</p>
		<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
			<a href="/auth/login" class="btn-primary inline-flex rounded-lg px-6 py-3 text-base font-semibold text-white">
				Get started free
			</a>
			<a href="/welcome#pricing" class="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-base font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]">
				See pricing
			</a>
		</div>
	</div>
	<!-- Hero image -->
	<div class="mx-auto mt-12 max-w-5xl px-4 sm:mt-16">
		<div class="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
			<img
				src="/workflow.svg"
				alt="PostPlan workflow: import from various sources into Manager, Importer, Scheduler, Publisher; publish to APIs and integrations"
				class="w-full object-contain"
			/>
		</div>
	</div>
</section>

<!-- Details / What you get -->
<section class="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
	<div class="mx-auto max-w-6xl">
		<p class="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">What you get</p>
		<h2 class="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl" style="letter-spacing: -0.02em;">
			One place to plan and send
		</h2>
		<p class="mt-4 max-w-2xl text-[var(--text-muted)]" style="line-height: 1.6;">
			Create posts, attach webhooks, and schedule when they fire. Use the calendar to see what's going out when, or bulk-import from WordPress, RSS, CSV, and more.
		</p>
		<div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 transition-colors hover:border-[var(--primary)]/30">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-[var(--text)]">Calendar view</h3>
				<p class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">See all scheduled and sent posts by month. Drag to reschedule and spot gaps at a glance.</p>
			</div>
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 transition-colors hover:border-[var(--primary)]/30">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-[var(--text)]">Schedules & rules</h3>
				<p class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">Define when posts should go out with time rules. Reuse schedules across posts so planning stays simple.</p>
			</div>
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 transition-colors hover:border-[var(--primary)]/30">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-[var(--text)]">Bulk import</h3>
				<p class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">Pull in posts from WordPress, Squarespace, RSS, or CSV. Map fields and assign schedules in one flow.</p>
			</div>
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 transition-colors hover:border-[var(--primary)]/30">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-[var(--text)]">Callback import</h3>
				<p class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">Let Make.com or other tools send posts via webhook. Each request creates a post and counts toward your plan.</p>
			</div>
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 transition-colors hover:border-[var(--primary)]/30">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-[var(--text)]">Webhooks</h3>
				<p class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">When a post is due, we send its payload to your URL. Use any HTTP endpoint—Make.com, Zapier, or your own API.</p>
			</div>
			<div class="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 transition-colors hover:border-[var(--primary)]/30">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-[var(--text)]">Reports</h3>
				<p class="mt-2 text-sm text-[var(--text-muted)]" style="line-height: 1.6;">Track sent posts and callback stage passes and fails. See how your automation is performing.</p>
			</div>
		</div>
	</div>
</section>

<!-- Pricing -->
<section id="pricing" class="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
	<div class="mx-auto max-w-6xl">
		<p class="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">Pricing</p>
		<h2 class="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl" style="letter-spacing: -0.02em;">
			Plans that scale with you
		</h2>
		<p class="mt-4 max-w-2xl text-[var(--text-muted)]" style="line-height: 1.6;">
			Start free. Upgrade when you need more posts per month, more callback inputs, or more imports. Limits are per calendar month.
		</p>
		<div class="mt-12 overflow-x-auto">
			<table class="w-full min-w-[600px] border-collapse rounded-xl border border-[var(--border)] bg-[var(--surface)]">
				<thead>
					<tr class="border-b border-[var(--border)] bg-[var(--bg)]">
						<th class="px-4 py-4 text-left text-sm font-semibold text-[var(--text)]">Plan</th>
						<th class="px-4 py-4 text-left text-sm font-semibold text-[var(--text)]">Price</th>
						<th class="px-4 py-4 text-left text-sm font-semibold text-[var(--text)]">Posts sent/mo</th>
						<th class="px-4 py-4 text-left text-sm font-semibold text-[var(--text)]">Callback inputs/mo</th>
						<th class="px-4 py-4 text-left text-sm font-semibold text-[var(--text)]">Imports/mo</th>
						<th class="px-4 py-4 text-left text-sm font-semibold text-[var(--text)]"></th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-b border-[var(--border)]">
						<td class="border-r border-[var(--border)] px-4 py-4 font-medium text-[var(--text)]">Free</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">£0</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">20</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">100</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">100</td>
						<td class="px-4 py-4">
							<a href="/auth/login" class="btn-primary inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white">
								Sign up free
							</a>
						</td>
					</tr>
					<tr class="border-b border-[var(--border)]">
						<td class="border-r border-[var(--border)] px-4 py-4 font-medium text-[var(--text)]">Pro</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">£5/month</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">500</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">2,000</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">2,000</td>
						<td class="px-4 py-4">
							<a href="/auth/login" class="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]">
								Log in to upgrade
							</a>
						</td>
					</tr>
					<tr>
						<td class="border-r border-[var(--border)] px-4 py-4 font-medium text-[var(--text)]">Enterprise</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">Negotiable</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">Unlimited</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">Unlimited</td>
						<td class="border-r border-[var(--border)] px-4 py-4 text-[var(--text-muted)]">Unlimited</td>
						<td class="px-4 py-4">
							<a href="/auth/login" class="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]">
								Contact us
							</a>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</section>

<!-- Benefits strip -->
<section class="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
	<div class="mx-auto max-w-6xl">
		<p class="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">Benefits</p>
		<h2 class="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl" style="letter-spacing: -0.02em;">
			Why use PostPlan
		</h2>
		<ul class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
			<li class="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
				<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</span>
				<span class="text-sm text-[var(--text)]" style="line-height: 1.5;">Hard cap per calendar month—no surprise overages. When you hit the limit, you can't add more until next month.</span>
			</li>
			<li class="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
				<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</span>
				<span class="text-sm text-[var(--text)]" style="line-height: 1.5;">Posts = sends. Up to 20 (free) or 500 (pro) posts can be sent in a given month; scheduled + sent count toward the same limit.</span>
			</li>
			<li class="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
				<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</span>
				<span class="text-sm text-[var(--text)]" style="line-height: 1.5;">Callback inputs and imports have their own monthly caps. Perfect for automation that creates posts via webhook or bulk import.</span>
			</li>
			<li class="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
				<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</span>
				<span class="text-sm text-[var(--text)]" style="line-height: 1.5;">Upgrade or downgrade anytime. Billing and usage are visible on your account page; Pro subscribers can manage or cancel via Stripe.</span>
			</li>
			<li class="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
				<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</span>
				<span class="text-sm text-[var(--text)]" style="line-height: 1.5;">Works with Make.com, Zapier, and any HTTP endpoint. Send JSON payloads when posts are due.</span>
			</li>
			<li class="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
				<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</span>
				<span class="text-sm text-[var(--text)]" style="line-height: 1.5;">Full technical breakdown and feature list on the <a href="/welcome/technical" class="font-medium text-[var(--primary)] hover:underline">Technical details</a> page.</span>
			</li>
		</ul>
	</div>
</section>

<!-- CTA -->
<section class="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
	<div class="mx-auto max-w-3xl text-center">
		<h2 class="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl" style="letter-spacing: -0.02em;">
			Ready to plan your posts?
		</h2>
		<p class="mt-4 text-[var(--text-muted)]" style="line-height: 1.6;">
			Create a free account and connect your first webhook in minutes.
		</p>
		<div class="mt-8 flex flex-wrap items-center justify-center gap-4">
			<a href="/auth/login" class="btn-primary inline-flex rounded-lg px-6 py-3 text-base font-semibold text-white">
				Get started free
			</a>
			<a href="/welcome/technical" class="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-base font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]">
				Technical details →
			</a>
		</div>
	</div>
</section>
