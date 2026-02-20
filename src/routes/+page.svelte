<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/calendar', { replaceState: true });
	});
</script>

<p class="text-[var(--text-muted)]">Redirecting to Calendar…</p>
