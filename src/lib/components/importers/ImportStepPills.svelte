<script lang="ts">
	let {
		sectionStep,
		focusStep,
		totalSteps = 6
	}: {
		sectionStep: number;
		focusStep: number;
		totalSteps?: number;
	} = $props();

	const steps = $derived(Array.from({ length: totalSteps }, (_, i) => i + 1));
</script>

{#each steps as step (step)}
	<span
		class="bulk-create-step-pill"
		class:done={step < focusStep && !(step === sectionStep && focusStep >= sectionStep)}
		class:active={step === sectionStep && focusStep >= sectionStep}>{step}</span>
{/each}
