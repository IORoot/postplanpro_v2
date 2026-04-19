<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();

	const navSection = $derived.by(() => {
		if ($page.url.pathname === '/inputs/webhooks') return 'webhooks';
		const s = $page.url.searchParams.get('section') ?? 'cms';
		const allowed = ['cms', 'spreadsheets', 'feeds', 'callbacks'] as const;
		return (allowed as readonly string[]).includes(s) ? s : 'cms';
	});

	const sourcesNavActive = $derived(
		navSection === 'cms' || navSection === 'spreadsheets' || navSection === 'feeds'
	);
</script>

<div class="settings-layout">
	<aside class="settings-sidebar">
		<nav class="settings-nav">
			<a
				href="/inputs?section=cms"
				class="settings-nav-link {sourcesNavActive ? 'settings-nav-link-active' : ''}"
			>
				Sources
			</a>
			<a
				href="/inputs/webhooks"
				class="settings-nav-link {navSection === 'webhooks' ? 'settings-nav-link-active' : ''}"
			>
				Webhooks
			</a>
			<a
				href="/inputs?section=callbacks"
				class="settings-nav-link {navSection === 'callbacks' ? 'settings-nav-link-active' : ''}"
			>
				Callbacks
			</a>
		</nav>
	</aside>
	<div class="settings-content">
		{@render children()}
	</div>
</div>
