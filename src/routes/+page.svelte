<script lang="ts">
	import HeroWarpBackground from '$lib/components/HeroWarpBackground.svelte';
	import WorkflowAnimation from '$lib/components/WorkflowAnimation.svelte';
	import FeatureSectionAnimation from '$lib/components/FeatureSectionAnimation.svelte';

	let heroCopyEl = $state<HTMLDivElement | null>(null);

	const sections = [
		{
			n: 1 as const,
			eyebrow: 'Calendar',
			heading: 'Your content, visualised at a glance',
			subtitle: 'A full-featured content calendar that makes scheduling obvious. See every post at once, move them instantly, and never lose track of what goes out when.',
			features: [
				{ title: 'Multiple views', body: 'Switch between day, week, month, year, agenda, and schedule views to match how you think.' },
				{ title: 'Drag and drop', body: 'Reschedule any post by dragging it to a new day. The send time updates automatically.' },
				{ title: 'Colour-coded posts', body: 'Assign colours to post types so your calendar tells the story at a glance.' },
				{ title: 'Live status chips', body: 'Dashboard stats show posts by status, schedules active, webhooks connected, and sends this week.' },
			],
		},
		{
			n: 2 as const,
			eyebrow: 'Schedules',
			heading: 'Recurring rules that do the thinking for you',
			subtitle: 'Define once, reuse everywhere. Attach a schedule to any post and PostPlan computes the exact next send time, every time.',
			features: [
				{ title: 'Every recurrence pattern', body: 'Daily, weekly, monthly, yearly, CRON expressions, or fixed intervals — all supported.' },
				{ title: 'Multi-rule schedules', body: 'Stack multiple rules on one schedule for complex patterns like "Weekdays at 9am plus first of month at noon".' },
				{ title: 'Bulk schedule edits', body: 'Update the schedule on multiple posts at once — change the timing across an entire campaign in seconds.' },
				{ title: 'Custom fields per schedule', body: 'Attach extra metadata to a schedule that flows into the webhook payload for every post using it.' },
			],
		},
		{
			n: 3 as const,
			eyebrow: 'Posts',
			heading: 'Every post, shaped exactly as you need it',
			subtitle: 'Rich post editing with multi-select, custom fields, colour labels, and full JSON control. Build the payload your webhook expects, not a generic template.',
			features: [
				{ title: 'Multi-post editing', body: 'Select many posts and update status, schedule, webhook, or colour in one action.' },
				{ title: 'Custom fields', body: 'Add arbitrary key-value fields to any post. They merge into the JSON payload sent to your webhook.' },
				{ title: 'JSON overrides', body: 'Override the entire outbound payload with raw JSON for total control over what gets sent.' },
				{ title: 'Callback stages & webhooks', body: 'Assign multiple outbound webhooks and track stage-by-stage progress as Make.com or your system responds.' },
			],
		},
		{
			n: 4 as const,
			eyebrow: 'Inputs',
			heading: 'Import posts from anywhere, automatically',
			subtitle: 'Connect your content sources and let them feed PostPlan directly. Wizards, feeds, and inbound webhooks mean your queue fills itself.',
			features: [
				{ title: 'WordPress & Squarespace wizards', body: 'Step-by-step import with field mapping, schedule assignment, and bulk post creation.' },
				{ title: 'RSS feeds', body: 'Subscribe to any RSS feed and auto-schedule new items as they appear.' },
				{ title: 'Inbound webhooks', body: 'POST JSON from Make.com, n8n, or your own system to create posts via the API.' },
				{ title: 'Callback status updates', body: 'Receive stage updates from your automation and track them back against the originating post.' },
			],
		},
		{
			n: 5 as const,
			eyebrow: 'Outputs',
			heading: 'Deliver to any endpoint you choose',
			subtitle: 'Create as many outbound webhook destinations as you need. Custom headers, API keys, any URL — PostPlan fires the payload, your system takes it from there.',
			features: [
				{ title: 'Unlimited webhook endpoints', body: 'Create separate outputs for Make.com, Zapier, n8n, Slack, or your own API — all active simultaneously.' },
				{ title: 'Custom headers & API keys', body: 'Set per-output HTTP headers and x-api-key values so every destination authenticates correctly.' },
				{ title: 'Any HTTP endpoint', body: 'No vendor lock-in. If it accepts a POST request, PostPlan can send to it.' },
				{ title: 'Per-post output assignment', body: 'Each post specifies which output fires when it is due, giving you full routing control.' },
			],
		},
		{
			n: 6 as const,
			eyebrow: 'Reports',
			heading: 'Debug fast, understand what happened',
			subtitle: 'Full visibility into every send. See the exact JSON that went out, the response that came back, and the stage-by-stage callback trail.',
			features: [
				{ title: 'Request & response logs', body: 'Inspect the full outbound JSON payload and the raw HTTP response for every send.' },
				{ title: 'Callback stage tracking', body: 'Track pass and fail per stage from Make.com or any callback system, linked back to the post.' },
				{ title: 'Send statistics', body: 'Sent, failed, and pending counts at a glance. See what is performing and what needs attention.' },
				{ title: 'Failed post highlights', body: 'Failed posts surface immediately in the stats panel so nothing slips through unnoticed.' },
			],
		},
		{
			n: 7 as const,
			eyebrow: 'Accounts',
			heading: 'One account, everything configured your way',
			subtitle: 'Templates, global variables, themes, oAuth, and billing — all in one place. Set the defaults once and every post benefits.',
			features: [
				{ title: 'Templates', body: 'Save reusable custom-field structures and apply them to new posts instantly.' },
				{ title: 'Global variables', body: 'Define key-value pairs that merge into every webhook payload — API keys, environment flags, metadata.' },
				{ title: 'Billing & plan management', body: 'Upgrade or downgrade via Stripe. Usage this month shown clearly against your plan limits.' },
				{ title: 'oAuth & themes', body: 'Connect third-party login providers and switch between light and dark themes to suit your workflow.' },
			],
		},
	] as const;
</script>

<svelte:head>
	<title>PostPlan – Schedule and send posts to your webhooks</title>
	<meta name="description" content="Plan content in a calendar, use schedules and bulk import, and fire posts to your webhooks when they're due. Free tier available." />
</svelte:head>

<!-- Hero — GSAP-driven warp background (Composio-style pixel tunnel) -->
<section
	class="relative overflow-hidden bg-[#030308] px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8 lg:py-32"
>
	<HeroWarpBackground alignAnchor={heroCopyEl} />
	<div bind:this={heroCopyEl} class="relative z-10 mr-auto max-w-4xl text-left">
		<h1
			class="text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl"
			style="letter-spacing: -0.03em; line-height: 1.1;"
		>
			Schedule posts.<br />Send to webhooks.
		</h1>
		<p class=" mt-6 max-w-[52ch] text-pretty text-lg leading-relaxed text-neutral-300">
			Plan content in a calendar, use schedules and bulk import, and fire posts when they’re due. Connect Make.com, Zapier, or any HTTP endpoint.
		</p>
		<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
			<a href="/auth/login" class="btn-primary inline-flex rounded-lg px-6 py-3 text-base font-semibold text-white">
				Get started free
			</a>
			<a
				href="/#pricing"
				class="inline-flex rounded-lg border border-neutral-600 bg-white/5 px-6 py-3 text-base font-medium text-white hover:bg-white/10"
			>
				See pricing
			</a>
		</div>
	</div>
	<!-- Interactive workflow (GSAP) — reusable component -->
	<div class="relative z-10 mx-auto mt-12 sm:mt-16">
		<div class="overflow-hidden rounded-xl md:border border-neutral-800/80 sm:p-4 md:bg-neutral-950">
			<WorkflowAnimation class="rounded-lg" />
		</div>
	</div>
</section>

<!-- Feature sections — 7 alternating text/animation rows -->
{#each sections as s, idx}
	<section class="border-t border-[var(--border)] {idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--bg)]'} px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
		<div class="mx-auto max-w-6xl">
			<div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-16 {idx % 2 === 1 ? 'lg:[&>*:first-child]:order-last' : ''}">
				<!-- Text column -->
				<div>
					<p class="text-xs font-medium uppercase tracking-widest text-[var(--primary)]">{s.eyebrow}</p>
					<h2 class="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl" style="letter-spacing: -0.02em; line-height: 1.15;">
						{s.heading}
					</h2>
					<p class="mt-4 text-[var(--text-muted)]" style="line-height: 1.65; max-width: 48ch;">
						{s.subtitle}
					</p>
					<div class="mt-8 space-y-5">
						{#each s.features as feature}
							<div class="flex gap-3">
								<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/12 text-[var(--primary)]">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</span>
								<div>
									<span class="text-sm font-semibold text-[var(--text)]">{feature.title}</span>
									<span class="text-sm text-[var(--text-muted)]"> — {feature.body}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
				<!-- Animation column -->
				<div class="overflow-hidden rounded-xl border border-[var(--border)] aspect-[4/3]">
					<FeatureSectionAnimation section={s.n} class="w-full h-full" />
				</div>
			</div>
		</div>
	</section>
{/each}

<!-- Pricing -->
<section id="pricing" class="border-t border-[var(--border)] bg-[var(--bg)] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
	<div class="mx-auto max-w-6xl">
		<p class="text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">Pricing</p>
		<h2 class="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl" style="letter-spacing: -0.02em;">
			Plans that scale with you
		</h2>
		<p class="mt-4 max-w-2xl text-[var(--text-muted)]" style="line-height: 1.6;">
			Start free and upgrade as your content operation grows. All plans include every feature — only the monthly usage quotas differ.
		</p>

		<div class="mt-12 grid gap-6 sm:grid-cols-3">

			<!-- Free -->
			<div class="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
				<!-- Header -->
				<div class="px-6 pt-8 pb-6" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, var(--surface)), var(--surface));">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
						</svg>
					</div>
					<h3 class="mt-4 text-lg font-semibold text-[var(--text)]">Free</h3>
					<p class="mt-1 text-sm text-[var(--text-muted)]">Try PostPlan at no cost. No card required.</p>
					<div class="mt-4 flex items-baseline gap-1">
						<span class="text-3xl font-bold tracking-tight text-[var(--text)]">£0</span>
						<span class="text-sm text-[var(--text-muted)]">/ month</span>
					</div>
				</div>
				<!-- Features -->
				<div class="flex-1 border-t border-[var(--border)] px-6 py-6 space-y-3">
					{#each [
						{ icon: 'M3 7h18M3 12h18M3 17h18', label: '20 posts sent per month' },
						{ icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5', label: '100 import operations' },
						{ icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: '100 callback inputs' },
						{ icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Full calendar — all views' },
						{ icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Schedules & recurrence rules' },
						{ icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Reports & send logs' },
					] as row}
						<div class="flex items-center gap-2.5">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
							<span class="text-sm text-[var(--text-muted)]">{row.label}</span>
						</div>
					{/each}
				</div>
				<!-- CTA -->
				<div class="border-t border-[var(--border)] px-6 py-5">
					<a href="/auth/login" class="btn-primary flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white">
						Get started free
					</a>
				</div>
			</div>

			<!-- Pro — highlighted -->
			<div class="flex flex-col rounded-2xl border-2 border-[var(--primary)] bg-[var(--surface)] overflow-hidden relative">
				<div class="absolute top-0 right-0 m-3">
					<span class="inline-flex items-center rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Most popular</span>
				</div>
				<!-- Header -->
				<div class="px-6 pt-8 pb-6" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, var(--surface)), var(--surface));">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/20 text-[var(--primary)]">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
					</div>
					<h3 class="mt-4 text-lg font-semibold text-[var(--text)]">Pro</h3>
					<p class="mt-1 text-sm text-[var(--text-muted)]">For teams with regular content workflows.</p>
					<div class="mt-4 flex items-baseline gap-1">
						<span class="text-3xl font-bold tracking-tight text-[var(--primary)]">£5</span>
						<span class="text-sm text-[var(--text-muted)]">/ month</span>
					</div>
				</div>
				<!-- Features -->
				<div class="flex-1 border-t border-[var(--border)] px-6 py-6 space-y-3">
					{#each [
						{ label: '500 posts sent per month', bold: true },
						{ label: '2,000 import operations', bold: true },
						{ label: '2,000 callback inputs', bold: true },
						{ label: 'Everything in Free' },
						{ label: 'Stripe billing & upgrade portal' },
						{ label: 'Priority support' },
					] as row}
						<div class="flex items-center gap-2.5">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
							<span class="text-sm {row.bold ? 'font-medium text-[var(--text)]' : 'text-[var(--text-muted)]'}">{row.label}</span>
						</div>
					{/each}
				</div>
				<!-- CTA -->
				<div class="border-t border-[var(--primary)]/30 px-6 py-5">
					<a href="/auth/login" class="btn-primary flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white">
						Start with Pro
					</a>
				</div>
			</div>

			<!-- Enterprise -->
			<div class="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
				<!-- Header -->
				<div class="px-6 pt-8 pb-6" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 4%, var(--surface)), var(--surface));">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
						</svg>
					</div>
					<h3 class="mt-4 text-lg font-semibold text-[var(--text)]">Enterprise</h3>
					<p class="mt-1 text-sm text-[var(--text-muted)]">Unlimited scale for high-volume operations.</p>
					<div class="mt-4 flex items-baseline gap-1">
						<span class="text-3xl font-bold tracking-tight text-[var(--text)]">Custom</span>
					</div>
				</div>
				<!-- Features -->
				<div class="flex-1 border-t border-[var(--border)] px-6 py-6 space-y-3">
					{#each [
						{ label: 'Unlimited posts per month', bold: true },
						{ label: 'Unlimited import operations', bold: true },
						{ label: 'Unlimited callback inputs', bold: true },
						{ label: 'Everything in Pro' },
						{ label: 'Admin user management panel' },
						{ label: 'Negotiated pricing & SLA' },
					] as row}
						<div class="flex items-center gap-2.5">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
							<span class="text-sm {row.bold ? 'font-medium text-[var(--text)]' : 'text-[var(--text-muted)]'}">{row.label}</span>
						</div>
					{/each}
				</div>
				<!-- CTA -->
				<div class="border-t border-[var(--border)] px-6 py-5">
					<a href="/auth/login" class="flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors">
						Contact us
					</a>
				</div>
			</div>

		</div>

		<p class="mt-6 text-center text-xs text-[var(--text-muted)]">
			All limits are per calendar month and reset on the 1st. Hard caps — no surprise overages.
		</p>
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
