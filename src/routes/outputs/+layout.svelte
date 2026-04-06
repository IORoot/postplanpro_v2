<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();

	const navSection = $derived.by(() => {
		const path = $page.url.pathname;
		if (path.startsWith('/outputs/presets')) return 'presets';
		return 'webhooks';
	});
</script>

<div class="settings-layout">
	<aside class="settings-sidebar">
		<nav class="settings-nav">
			<a
				href="/outputs/webhooks"
				class="settings-nav-link {navSection === 'webhooks' ? 'settings-nav-link-active' : ''}"
			>
				Webhooks
			</a>
			<a
				href="/outputs/presets"
				class="settings-nav-link {navSection === 'presets' ? 'settings-nav-link-active' : ''}"
			>
				Presets
			</a>
		</nav>
	</aside>
	<div class="settings-content">
		{@render children()}
	</div>
</div>
