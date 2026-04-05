<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { mountResponsiveWorkflowAnimation } from '$lib/workflowAnimation/mountResponsiveWorkflowAnimation.js';
	import './workflow-animation-responsive.css';

	interface Props {
		class?: string;
	}
	let { class: className = '' }: Props = $props();

	let host = $state<HTMLDivElement | null>(null);
	let teardown: (() => void) | undefined;

	onMount(() => {
		if (host) teardown = mountResponsiveWorkflowAnimation(host);
	});

	onDestroy(() => {
		teardown?.();
	});
</script>

<div
	bind:this={host}
	class="workflow-animation intro-font animation_and_timeline flex flex-col gap-2 max-xl:gap-2 xl:gap-8 bg-black xl:min-h-0 {className ?? ''}"
>

	<div id="intro_animation" class="intro_animation font-md-thermochrome text-white max-xl:flex max-xl:flex-col max-xl:min-h-0 max-xl:gap-2 p-2 max-xl:p-2 xl:grid xl:auto-rows-auto xl:grid-cols-7 xl:grid-rows-3 xl:gap-8 xl:p-4">

		<div id="clock" class="shrink-0 bg-neutral-200 p-4 pb-0 border border-neutral-100 flex flex-col gap-2 text-neutral-800 md:col-span-2 xl:col-span-1 xl:col-start-6 xl:row-start-1">
			<div class="clock-block-heading section_title text-2xl mb-4">CLOCK</div>
			<div class="clock-date-row w-full flex border-b border-neutral-700">
				<div id="clock_month" class="month text-xl w-full">January</div>
				<div id="clock_day" class="day text-3xl">30</div>
				<div id="clock_ordinal" class="ordinal text-sm">th</div>
			</div>

			<div class="clock-time-row w-full flex">
				<div id="clock_time" class="time text-5xl m-auto text-green-700">09:00</div>
			</div>
		</div>

		<div
			id="intro_carousel_stage"
			class="max-xl:relative max-xl:flex max-xl:min-h-0 max-xl:min-w-0 max-xl:flex-1 max-xl:flex-col xl:contents"
		>
			<div
				id="intro_slides_track"
				class="flex min-h-0 min-w-0 flex-1 flex-row overflow-x-auto overflow-y-hidden snap-x snap-mandatory xl:hidden"
				aria-label="Animation stages"
			></div>
			<div
				id="intro_pipes_overlay"
				class="pointer-events-none max-md:hidden max-xl:absolute max-xl:inset-0 max-xl:z-[35] overflow-visible xl:hidden"
				aria-hidden="true"
			></div>
		</div>

		<div id="website" class="min-h-0 min-w-0 md:col-span-1 xl:row-span-3 xl:h-full bg-neutral-200 border border-neutral-800 relative">

			<div class="website_header bg-neutral-200 h-6 p-1">
				<svg role="img" class="w-4 h-4 fill-green-500" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>WordPress</title><path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/></svg>
			</div>

			<div class="website_hero bg-green-500 h-24 flex">
				<div class="m-auto text-white text-xl">MyWebsite.com</div>
			</div>

			<div class="website_posts p-4 text-black flex flex-col">

				<div class="website_post post_one flex pb-4 border-b border-neutral-100 gap-2 opacity-0 xl:h-full">
					<div class="website_post_image bg-neutral-300 aspect-ratio w-4 h-4"></div>
					<div class="website_post_text flex flex-col">
						<div class="website_post_title text-md font-bold">My First Post</div>
						<div class="website_post_description text-xs">Testing an automation to post to Social Media</div>
					</div>
				</div>

				<div class="website_post post_two flex py-4 border-b border-neutral-100 gap-2 opacity-0 xl:h-full">
					<div class="website_post_image bg-neutral-300 aspect-ratio w-4 h-4"></div>
					<div class="website_post_text flex flex-col">
						<div class="website_post_title text-md font-bold">Second Post</div>
						<div class="website_post_description text-xs">Check out these videos</div>
					</div>
				</div>

				<div class="website_post post_three flex py-4 border-b border-neutral-100 gap-2 opacity-0 xl:h-full">
					<div class="website_post_image bg-neutral-300 aspect-ratio w-4 h-4"></div>
					<div class="website_post_text flex flex-col">
						<div class="website_post_title text-md font-bold">Hi There!</div>
						<div class="website_post_description text-xs">Let the world know on YouTube!</div>
					</div>
				</div>

				<div class="website_post post_four flex py-4 border-b border-neutral-100 gap-2 opacity-0 xl:h-full">
					<div class="website_post_image bg-neutral-300 aspect-ratio w-4 h-4"></div>
					<div class="website_post_text flex flex-col">
						<div class="website_post_title text-md font-bold">New Release!</div>
						<div class="website_post_description text-xs">Github v1.0.0 release for my software!</div>
					</div>
				</div>

				<div class="website_post post_five flex py-4 border-b border-neutral-100 gap-2 opacity-0 xl:h-full">
					<div class="website_post_image bg-neutral-300 aspect-ratio w-4 h-4"></div>
					<div class="website_post_text flex flex-col">
						<div class="website_post_title text-md font-bold">All Channels!</div>
						<div class="website_post_description text-xs">Release to social media!</div>
					</div>
				</div>

			</div>

			<svg id="website_to_inputs" class="intro-pipe-connector website_to_inputs stroke-green-500 opacity-0 pointer-events-none hidden md:block" xmlns="http://www.w3.org/2000/svg" width="32" height="16" style="position:absolute; top:50%; right:-32px; transform:translateY(-50%); overflow:visible;">
				<line class="pipe-line" x1="0" y1="8" x2="32" y2="8" stroke-width="1"/>
			</svg>
			<svg id="website_to_inputs_mobile" class="intro-pipe-connector website_to_inputs block stroke-green-500 opacity-0 pointer-events-none md:hidden " xmlns="http://www.w3.org/2000/svg" width="16" height="32" style="position:absolute; left:50%; top:100%; transform:translateX(-50%); overflow:visible;">
				<line class="pipe-line" x1="8" y1="0" x2="8" y2="32" stroke-width="1"/>
			</svg>

		</div>



		<div id="inputs" class="min-h-0 min-w-0 md:col-span-1 xl:row-span-3 bg-neutral-900 p-4 border border-neutral-800 flex flex-col gap-4 relative opacity-30">
			<div class="section_title text-2xl">INPUTS</div>
			
			<div id="input_wordpress" class="border border-neutral-700 p-2 flex gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>WordPress</title><path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0"/></svg>
				<p class="text-md my-auto">Wordpress</p>
			</div>

			<div id="input_squarespace" class="border border-neutral-700 p-2 hidden md:flex gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Squarespace</title><path d="M22.655 8.719c-1.802-1.801-4.726-1.801-6.564 0l-7.351 7.35c-.45.45-.45 1.2 0 1.65.45.449 1.2.449 1.65 0l7.351-7.351c.899-.899 2.362-.899 3.264 0 .9.9.9 2.364 0 3.264l-7.239 7.239c.9.899 2.362.899 3.263 0l5.589-5.589c1.836-1.838 1.836-4.763.037-6.563zm-2.475 2.437c-.451-.45-1.201-.45-1.65 0l-7.354 7.389c-.9.899-2.361.899-3.262 0-.45-.45-1.2-.45-1.65 0s-.45 1.2 0 1.649c1.801 1.801 4.726 1.801 6.564 0l7.351-7.35c.449-.487.449-1.239.001-1.688zm-2.439-7.35c-1.801-1.801-4.726-1.801-6.564 0l-7.351 7.351c-.45.449-.45 1.199 0 1.649s1.2.45 1.65 0l7.395-7.351c.9-.899 2.371-.899 3.27 0 .451.45 1.201.45 1.65 0 .421-.487.421-1.199-.029-1.649h-.021zm-2.475 2.437c-.45-.45-1.2-.45-1.65 0l-7.351 7.389c-.899.9-2.363.9-3.265 0-.9-.899-.9-2.363 0-3.264l7.239-7.239c-.9-.9-2.362-.9-3.263 0L1.35 8.719c-1.8 1.8-1.8 4.725 0 6.563 1.801 1.801 4.725 1.801 6.564 0l7.35-7.351c.451-.488.451-1.238 0-1.688h.002z"/></svg>
				<p class="text-md my-auto">Squarespace</p>
			</div>

			<div id="input_csv" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg class="w-8 h-8 fill-white my-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M3.83325 10H5.83325V9.00002H4.16659V7.00002H5.83325V6.00002H3.83325C3.64436 6.00002 3.48614 6.06402 3.35859 6.19202C3.23103 6.32002 3.16703 6.47824 3.16659 6.66669V9.33335C3.16659 9.52224 3.23059 9.68069 3.35859 9.80869C3.48659 9.93669 3.64481 10.0005 3.83325 10ZM6.43325 10H8.43325C8.62214 10 8.78059 9.93602 8.90859 9.80802C9.03659 9.68002 9.10036 9.5218 9.09992 9.33335V8.33335C9.09992 8.14446 9.03592 7.96935 8.90792 7.80802C8.77992 7.64669 8.6217 7.56624 8.43325 7.56669H7.43325V7.00002H9.09992V6.00002H7.09992C6.91103 6.00002 6.75281 6.06402 6.62525 6.19202C6.4977 6.32002 6.4337 6.47824 6.43325 6.66669V7.66669C6.43325 7.85558 6.49725 8.02513 6.62525 8.17535C6.75325 8.32558 6.91147 8.40047 7.09992 8.40002H8.09992V9.00002H6.43325V10ZM10.8333 10H11.8333L12.9999 6.00002H11.9999L11.3333 8.30002L10.6666 6.00002H9.66659L10.8333 10ZM2.66659 13.3334C2.29992 13.3334 1.98614 13.2029 1.72525 12.942C1.46436 12.6811 1.3337 12.3671 1.33325 12V4.00002C1.33325 3.63335 1.46392 3.31958 1.72525 3.05869C1.98659 2.7978 2.30036 2.66713 2.66659 2.66669H13.3333C13.6999 2.66669 14.0139 2.79735 14.2753 3.05869C14.5366 3.32002 14.667 3.6338 14.6666 4.00002V12C14.6666 12.3667 14.5361 12.6807 14.2753 12.942C14.0144 13.2034 13.7004 13.3338 13.3333 13.3334H2.66659Z" fill="white"/>
				</svg>
					
				<p class="text-md my-auto">CSV</p>
			</div>

			<div id="input_json" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg class="w-8 h-8 fill-white my-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M3.16675 10H4.33341C4.5223 10 4.68075 9.93602 4.80875 9.80802C4.93675 9.68002 5.00053 9.5218 5.00008 9.33335V6.50002C5.00008 6.35558 4.95275 6.23624 4.85808 6.14202C4.76341 6.0478 4.64408 6.00046 4.50008 6.00002C4.35608 5.99958 4.23675 6.04691 4.14208 6.14202C4.04741 6.23713 4.00008 6.35646 4.00008 6.50002V9.16669H3.33341V8.75002C3.33341 8.6278 3.29453 8.5278 3.21675 8.45002C3.13897 8.37224 3.03897 8.33335 2.91675 8.33335C2.79453 8.33335 2.69453 8.37224 2.61675 8.45002C2.53897 8.5278 2.50008 8.6278 2.50008 8.75002V9.33335C2.50008 9.52224 2.56408 9.68069 2.69208 9.80869C2.82008 9.93669 2.9783 10.0005 3.16675 10ZM6.11675 10H7.11675C7.30564 10 7.46408 9.93602 7.59208 9.80802C7.72008 9.68002 7.78386 9.5218 7.78341 9.33335V8.33335C7.78341 8.14446 7.71942 7.98624 7.59141 7.85869C7.46342 7.73113 7.30519 7.66713 7.11675 7.66669H6.28341V6.83335H6.95008C6.95008 6.92224 6.98341 7.00002 7.05008 7.06669C7.11675 7.13335 7.19453 7.16669 7.28341 7.16669H7.36675C7.48897 7.16669 7.58897 7.1278 7.66675 7.05002C7.74453 6.97224 7.78341 6.87224 7.78341 6.75002V6.66669C7.78341 6.4778 7.71942 6.31958 7.59141 6.19202C7.46342 6.06447 7.30541 6.00046 7.11741 6.00002H6.11741C5.92853 6.00002 5.7703 6.06402 5.64275 6.19202C5.51519 6.32002 5.45097 6.47824 5.45008 6.66669V7.66669C5.45008 7.85558 5.51408 8.01402 5.64208 8.14202C5.77008 8.27002 5.9283 8.3338 6.11675 8.33335H6.95008V9.16669H6.28341C6.28341 9.0778 6.25008 9.00002 6.18341 8.93335C6.11675 8.86669 6.03897 8.83335 5.95008 8.83335H5.86675C5.74453 8.83335 5.64453 8.87224 5.56675 8.95002C5.48897 9.0278 5.45008 9.1278 5.45008 9.25002V9.33335C5.45008 9.52224 5.51408 9.68069 5.64208 9.80869C5.77008 9.93669 5.9283 10.0005 6.11675 10ZM9.05008 9.00002V7.00002H9.71675V9.00002H9.05008ZM8.88342 10H9.88342C10.0723 10 10.2307 9.93602 10.3587 9.80802C10.4867 9.68002 10.5505 9.5218 10.5501 9.33335V6.66669C10.5501 6.4778 10.4863 6.31958 10.3587 6.19202C10.2312 6.06447 10.0727 6.00046 9.88342 6.00002H8.88342C8.69453 6.00002 8.5363 6.06402 8.40875 6.19202C8.28119 6.32002 8.21719 6.47824 8.21675 6.66669V9.33335C8.21675 9.52224 8.28075 9.68069 8.40875 9.80869C8.53675 9.93669 8.69497 10.0005 8.88342 10ZM11.8334 8.25002L12.4001 9.73335C12.4334 9.82224 12.4834 9.88891 12.5501 9.93335C12.6167 9.9778 12.6945 10 12.7834 10H12.9167C13.039 10 13.139 9.96113 13.2167 9.88335C13.2945 9.80558 13.3334 9.70558 13.3334 9.58335V6.41669C13.3334 6.29446 13.2945 6.19446 13.2167 6.11669C13.139 6.03891 13.039 6.00002 12.9167 6.00002C12.7945 6.00002 12.6945 6.03891 12.6167 6.11669C12.539 6.19446 12.5001 6.29446 12.5001 6.41669V7.75002L11.9334 6.26669C11.9001 6.1778 11.8501 6.11113 11.7834 6.06669C11.7167 6.02224 11.639 6.00002 11.5501 6.00002H11.4167C11.2945 6.00002 11.1945 6.03891 11.1167 6.11669C11.039 6.19446 11.0001 6.29446 11.0001 6.41669V9.58335C11.0001 9.70558 11.039 9.80558 11.1167 9.88335C11.1945 9.96113 11.2945 10 11.4167 10C11.539 10 11.639 9.96113 11.7167 9.88335C11.7945 9.80558 11.8334 9.70558 11.8334 9.58335V8.25002ZM2.00008 13.3334C1.63341 13.3334 1.31964 13.2029 1.05875 12.942C0.797859 12.6811 0.667192 12.3671 0.666748 12V4.00002C0.666748 3.63335 0.797415 3.31958 1.05875 3.05869C1.32008 2.7978 1.63386 2.66713 2.00008 2.66669H14.0001C14.3667 2.66669 14.6807 2.79735 14.9421 3.05869C15.2034 3.32002 15.3339 3.6338 15.3334 4.00002V12C15.3334 12.3667 15.203 12.6807 14.9421 12.942C14.6812 13.2034 14.3672 13.3338 14.0001 13.3334H2.00008Z" fill="white"/>
				</svg>	
				<p class="text-md my-auto">JSON</p>
			</div>

			<div id="input_rss" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg class="w-8 h-8 fill-white my-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M4.12008 10.4267C4.50553 10.4267 4.87519 10.5798 5.14774 10.8524C5.4203 11.1249 5.57341 11.4946 5.57341 11.88C5.57341 12.6667 4.92008 13.3334 4.12008 13.3334C3.33341 13.3334 2.66675 12.6667 2.66675 11.88C2.66675 11.4946 2.81987 11.1249 3.09242 10.8524C3.36497 10.5798 3.73463 10.4267 4.12008 10.4267ZM2.66675 2.96002C5.41793 2.96002 8.05643 4.05292 10.0018 5.9983C11.9472 7.94368 13.0401 10.5822 13.0401 13.3334H11.1534C11.1534 11.0826 10.2593 8.92393 8.66773 7.33238C7.07617 5.74082 4.91755 4.84669 2.66675 4.84669V2.96002ZM2.66675 6.73336C4.41718 6.73336 6.09591 7.42871 7.33365 8.66645C8.57139 9.90419 9.26675 11.5829 9.26675 13.3334H7.38008C7.38008 12.0833 6.8835 10.8844 5.99958 10.0005C5.11566 9.1166 3.9168 8.62002 2.66675 8.62002V6.73336Z" fill="white"/>
				</svg>
				<p class="text-md my-auto">RSS</p>
			</div>

			<div id="input_webhooks" class="border border-neutral-700 p-2 flex gap-2 bg-neutral-800 h-full">
				<svg class="w-8 h-8 fill-white my-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M4.66659 14C3.74436 14 2.95836 13.6749 2.30859 13.0246C1.65881 12.3744 1.3337 11.5884 1.33325 10.6666C1.33325 9.85554 1.58614 9.14731 2.09192 8.54198C2.5977 7.93665 3.2337 7.55598 3.99992 7.39998V8.78331C3.61103 8.91665 3.2917 9.15554 3.04192 9.49998C2.79214 9.84443 2.66703 10.2333 2.66659 10.6666C2.66659 11.2222 2.86103 11.6944 3.24992 12.0833C3.63881 12.4722 4.11103 12.6666 4.66659 12.6666C5.22214 12.6666 5.69436 12.4722 6.08325 12.0833C6.47214 11.6944 6.66659 11.2222 6.66659 10.6666V9.99998H10.5833C10.6721 9.89998 10.7806 9.81931 10.9086 9.75798C11.0366 9.69665 11.1781 9.6662 11.3333 9.66665C11.611 9.66665 11.8473 9.76398 12.0419 9.95865C12.2366 10.1533 12.3337 10.3893 12.3333 10.6666C12.3328 10.944 12.2357 11.1802 12.0419 11.3753C11.8481 11.5704 11.6119 11.6675 11.3333 11.6666C11.1777 11.6666 11.0359 11.6362 10.9079 11.5753C10.7799 11.5144 10.6719 11.4338 10.5839 11.3333H7.93325C7.7777 12.1 7.39703 12.7362 6.79125 13.242C6.18547 13.7478 5.47725 14.0004 4.66659 14ZM11.3333 14C10.711 14 10.1473 13.8473 9.64192 13.542C9.13659 13.2366 8.73925 12.8338 8.44992 12.3333H10.2333C10.3888 12.4444 10.561 12.5278 10.7499 12.5833C10.9388 12.6389 11.1333 12.6666 11.3333 12.6666C11.8888 12.6666 12.361 12.4722 12.7499 12.0833C13.1388 11.6944 13.3333 11.2222 13.3333 10.6666C13.3333 10.1111 13.1388 9.63887 12.7499 9.24998C12.361 8.86109 11.8888 8.66665 11.3333 8.66665C11.111 8.66665 10.9055 8.69731 10.7166 8.75865C10.5277 8.81998 10.3499 8.91154 10.1833 9.03331L8.14992 5.64998C7.91659 5.60554 7.72214 5.49442 7.56659 5.31665C7.41103 5.13887 7.33325 4.9222 7.33325 4.66665C7.33325 4.38887 7.43059 4.15287 7.62525 3.95865C7.81992 3.76442 8.05592 3.66709 8.33325 3.66665C8.61059 3.6662 8.84681 3.76354 9.04192 3.95865C9.23703 4.15376 9.33414 4.38976 9.33325 4.66665V4.80865C9.33325 4.84731 9.32214 4.89442 9.29992 4.94998L10.7499 7.38331C10.8388 7.36109 10.9333 7.34731 11.0333 7.34198C11.1333 7.33665 11.2333 7.33376 11.3333 7.33331C12.2555 7.33331 13.0417 7.65843 13.6919 8.30865C14.3421 8.95887 14.667 9.74487 14.6666 10.6666C14.6661 11.5884 14.341 12.3746 13.6913 13.0253C13.0415 13.676 12.2555 14.0009 11.3333 14ZM4.66659 11.6666C4.38881 11.6666 4.15281 11.5695 3.95859 11.3753C3.76436 11.1811 3.66703 10.9449 3.66659 10.6666C3.66659 10.4222 3.74436 10.2111 3.89992 10.0333C4.05547 9.85554 4.24436 9.73887 4.46659 9.68331L6.03325 7.08331C5.71103 6.78331 5.45814 6.42509 5.27459 6.00865C5.09103 5.5922 4.99947 5.14487 4.99992 4.66665C4.99992 3.74442 5.32503 2.95842 5.97525 2.30865C6.62547 1.65887 7.41147 1.33376 8.33325 1.33331C9.25503 1.33287 10.0413 1.65798 10.6919 2.30865C11.3426 2.95931 11.6675 3.74531 11.6666 4.66665H10.3333C10.3333 4.11109 10.1388 3.63887 9.74992 3.24998C9.36103 2.86109 8.88881 2.66665 8.33325 2.66665C7.7777 2.66665 7.30547 2.86109 6.91659 3.24998C6.5277 3.63887 6.33325 4.11109 6.33325 4.66665C6.33325 5.14442 6.4777 5.56398 6.76659 5.92531C7.05547 6.28665 7.42214 6.51709 7.86659 6.61665L5.61659 10.3666C5.63881 10.4222 5.65281 10.4722 5.65859 10.5166C5.66436 10.5611 5.66703 10.6111 5.66659 10.6666C5.66659 10.9444 5.56947 11.1806 5.37525 11.3753C5.18103 11.57 4.94481 11.6671 4.66659 11.6666Z" fill="white"/>
				</svg>				
				<p class="text-md my-auto">WebHooks</p>
			</div>

			<div id="input_callbacks" class="border border-neutral-700 p-2 flex gap-2 bg-neutral-800 h-full">
				<svg class="w-8 h-8 fill-white my-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M1.33333 16H13.3333V14.6666H14.6667V2.66665H13.3333V1.33331H1.33333V2.66665H0V14.6666H1.33333V16ZM5.33333 13.3333V12H4V10.6666H2.66667V9.33331H4V7.99998H5.33333V6.66665H6.66667V7.99998H5.33333V9.33331H10.6667V5.33331H8V3.99998H10.6667V5.33331H12V9.33331H10.6667V10.6666H5.33333V12H6.66667V13.3333H5.33333Z" fill="white"/>
				</svg>					
				<p class="text-md my-auto">Callbacks</p>
			</div>

			<svg id="inputs_to_schedules" class="intro-pipe-connector line stroke-green-500 opacity-0 pointer-events-none hidden xl:block" xmlns="http://www.w3.org/2000/svg"
				width="32" height="16"
				style="position:absolute; top:16.666%; right:-32px; transform:translateY(-50%); overflow:visible;">
				<line class="pipe-line" x1="0" y1="8" x2="32" y2="8"
					stroke-width="1"/>
			</svg>
			<svg id="inputs_to_schedules_mobile" class="intro-pipe-connector line block stroke-green-500 opacity-0 pointer-events-none xl:hidden z-50" xmlns="http://www.w3.org/2000/svg" width="16" height="32"
				style="position:absolute; left:50%; top:100%; transform:translateX(-50%); overflow:visible;">
				<line class="pipe-line" x1="8" y1="0" x2="8" y2="32" stroke-width="1"/>
			</svg>
		</div>




		<div id="schedules" class="min-h-0 min-w-0 md:col-span-2 xl:col-span-3 bg-neutral-900 p-4 border border-neutral-800 flex flex-col gap-4 relative opacity-30">
			<div class="section_title text-2xl">SCHEDULES</div>

			<div id="schedule_daily_inspiration" class="schedule_daily border border-neutral-700 px-4 py-2 flex gap-4 bg-neutral-800 xl:text-2xl">
				<div class="w-full my-auto">🎉 Daily Inspiration</div>
				<div class="w-32 bg-green-800 px-4 py-1 text-center my-auto">daily</div>
				<div class="w-full m-auto text-center">at 11:00</div>
			</div>

			<div class="schedule_daily border border-neutral-700 px-4 py-2 flex gap-4 bg-neutral-800 xl:text-2xl">
				<div class="w-full my-auto">💻 Dev News</div>
				<div class="w-32 bg-green-800 px-4 py-1 text-center my-auto">cron</div>
				<div class="w-full m-auto text-center">0 17 * * 5</div>
			</div>

			<svg id="schedules_to_calendar" class="intro-pipe-connector line stroke-green-500 opacity-0" xmlns="http://www.w3.org/2000/svg"
				width="16" height="32"
				style="position:absolute; bottom:-32px; left:50%; transform:translateX(-50%); overflow:visible;">
				<line class="pipe-line" x1="8" y1="0" x2="8" y2="32"
					stroke-width="1"/>
			</svg>
		</div>



		<div id="calendar" class="min-h-0 min-w-0 md:col-span-2 xl:col-span-3 xl:row-span-2 xl:col-start-3 xl:row-start-2 bg-neutral-900 p-4 border border-neutral-800 flex flex-col gap-4 relative opacity-30">
			<div class="section_title text-2xl">CALENDAR</div>

			<div class="grid grid-cols-8 gap-4 auto-rows-auto max-xl:h-auto xl:grid-rows-5 xl:h-full">

				<div id="calendar_jan_27" class="border border-neutral-600 p-1 bg-neutral-900 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">27</div>
				</div>
				<div id="calendar_jan_28" class="border border-neutral-600 p-1 bg-neutral-900 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">28</div>
				</div>
				<div id="calendar_jan_29" class="border border-neutral-600 p-1 bg-neutral-900 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">29</div>
				</div>
				<div id="calendar_jan_30" class="current_date border border-green-500 p-1 bg-neutral-900 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">30</div>
				</div>

				<div id="calendar_feb_1" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex flex-col-reverse gap-1 col-span-2">
					<div class="calendar_animated_post w-full bg-green-800 border border-green-700 p-1 text-xs opacity-0">My First Post</div>
					<div class="text-right text-sm">1</div>
				</div>

				<div id="calendar_feb_2" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">2</div>
				</div>

				<div id="calendar_feb_3" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">3</div>
				</div>


				<div id="calendar_feb_4" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">4</div>
				</div>
				<div id="calendar_feb_5" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">5</div>
				</div>
				<div id="calendar_feb_6" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">6</div>
				</div>
				<div id="calendar_feb_7" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">7</div>
				</div>

				<div id="calendar_feb_8" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex flex-col-reverse gap-1 col-span-2">
					<div class="calendar_animated_post w-full bg-green-800 border border-green-700 p-1 text-xs opacity-0 ">Second Post</div>
					<div class="text-right text-sm">8</div>
				</div>

				<div id="calendar_feb_9" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">9</div>
				</div>

				<div id="calendar_feb_10" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">10</div>
				</div>


				<div id="calendar_feb_11" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">11</div>
				</div>
				<div id="calendar_feb_12" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">12</div>
				</div>
				<div id="calendar_feb_13" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">13</div>
				</div>
				<div id="calendar_feb_14" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">14</div>
				</div>

				<div id="calendar_feb_15" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex flex-col-reverse gap-1 col-span-2">
					<div class="calendar_animated_post w-full bg-green-800 border border-green-700 p-1 text-xs opacity-0">Hi There!</div>
					<div class="text-right text-sm">15</div>
				</div>

				<div id="calendar_feb_16" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">16</div>
				</div>

				<div id="calendar_feb_17" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">17</div>
				</div>


				<div id="calendar_feb_18" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">18</div>
				</div>
				<div id="calendar_feb_19" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">19</div>
				</div>
				<div id="calendar_feb_20" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">20</div>
				</div>
				<div id="calendar_feb_21" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">21</div>
				</div>

				<div id="calendar_feb_22" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex flex-col-reverse gap-1 col-span-2">
					<div class="calendar_animated_post w-full bg-green-800 border border-green-700 p-1 text-xs opacity-0">New Release!</div>
					<div class="text-right text-sm">22</div>
				</div>

				<div id="calendar_feb_23" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">23</div>
				</div>

				<div id="calendar_feb_24" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">24</div>
				</div>


				<div id="calendar_feb_25" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">25</div>
				</div>
				<div id="calendar_feb_26" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">26</div>
				</div>
				<div id="calendar_feb_27" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">27</div>
				</div>
				<div id="calendar_feb_28" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full p-1 text-xs"></div>
					<div class="text-sm">28</div>
				</div>

				<div id="calendar_feb_29" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex flex-col-reverse gap-1 col-span-2">
					<div class="calendar_animated_post w-full bg-green-800 border border-green-700 p-1 text-xs opacity-0">All Channels</div>
					<div class="text-right text-sm">29</div>
				</div>

				<div id="calendar_feb_30" class="border border-neutral-700 p-1 bg-neutral-800 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">30</div>
				</div>

				<div id="calendar_mar_1" class="border border-neutral-600 p-1 bg-neutral-900 w-full flex gap-1">
					<div class="hidden xl:block w-full"></div>
					<div class="text-sm">1</div>
				</div>

			</div>

			<svg id="calendar_to_outputs" class="intro-pipe-connector line stroke-green-500 opacity-0 pointer-events-none hidden xl:block" xmlns="http://www.w3.org/2000/svg"
				width="32" height="16"
				style="position:absolute; top:50%; right:-32px; transform:translateY(-50%); overflow:visible;">
				<line class="pipe-line" x1="0" y1="8" x2="32" y2="8"
					stroke-width="1"/>
			</svg>
			<svg id="calendar_to_outputs_mobile" class="intro-pipe-connector line block stroke-green-500 opacity-0 pointer-events-none xl:hidden overflow-visible" xmlns="http://www.w3.org/2000/svg" width="16" height="32"
				style="position:absolute; left:50%; top:100%; transform:translateX(-50%);">
				<line class="pipe-line" x1="8" y1="0" x2="8" y2="32" stroke-width="1"/>
			</svg>
		</div>



		<div id="outputs" class="min-h-0 min-w-0 md:col-span-1 xl:row-span-2 xl:col-start-6 xl:row-start-2 bg-neutral-900 p-4 border border-neutral-800 flex flex-col gap-4 relative opacity-30">
			<div class="section_title text-2xl">OUTPUTS</div>
			<div id="output_make" class="border border-neutral-700 p-2 flex gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Make</title><path fill="#6D00CC" d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z"/></svg>
				<p class="text-md my-auto">Make.com</p>
			</div>

			<div id="output_n8n" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>n8n</title><path fill="#EA4B71" d="M21.4737 5.6842c-1.1772 0-2.1663.8051-2.4468 1.8947h-2.8955c-1.235 0-2.289.893-2.492 2.111l-.1038.623a1.263 1.263 0 0 1-1.246 1.0555H11.289c-.2805-1.0896-1.2696-1.8947-2.4468-1.8947s-2.1663.8051-2.4467 1.8947H4.973c-.2805-1.0896-1.2696-1.8947-2.4468-1.8947C1.1311 9.4737 0 10.6047 0 12s1.131 2.5263 2.5263 2.5263c1.1772 0 2.1663-.8051 2.4468-1.8947h1.4223c.2804 1.0896 1.2696 1.8947 2.4467 1.8947 1.1772 0 2.1663-.8051 2.4468-1.8947h1.0008a1.263 1.263 0 0 1 1.2459 1.0555l.1038.623c.203 1.218 1.257 2.111 2.492 2.111h.3692c.2804 1.0895 1.2696 1.8947 2.4468 1.8947 1.3952 0 2.5263-1.131 2.5263-2.5263s-1.131-2.5263-2.5263-2.5263c-1.1772 0-2.1664.805-2.4468 1.8947h-.3692a1.263 1.263 0 0 1-1.246-1.0555l-.1037-.623A2.52 2.52 0 0 0 13.9607 12a2.52 2.52 0 0 0 .821-1.4794l.1038-.623a1.263 1.263 0 0 1 1.2459-1.0555h2.8955c.2805 1.0896 1.2696 1.8947 2.4468 1.8947 1.3952 0 2.5263-1.131 2.5263-2.5263s-1.131-2.5263-2.5263-2.5263m0 1.2632a1.263 1.263 0 0 1 1.2631 1.2631 1.263 1.263 0 0 1-1.2631 1.2632 1.263 1.263 0 0 1-1.2632-1.2632 1.263 1.263 0 0 1 1.2632-1.2631M2.5263 10.7368A1.263 1.263 0 0 1 3.7895 12a1.263 1.263 0 0 1-1.2632 1.2632A1.263 1.263 0 0 1 1.2632 12a1.263 1.263 0 0 1 1.2631-1.2632m6.3158 0A1.263 1.263 0 0 1 10.1053 12a1.263 1.263 0 0 1-1.2632 1.2632A1.263 1.263 0 0 1 7.579 12a1.263 1.263 0 0 1 1.2632-1.2632m10.1053 3.7895a1.263 1.263 0 0 1 1.2631 1.2632 1.263 1.263 0 0 1-1.2631 1.2631 1.263 1.263 0 0 1-1.2632-1.2631 1.263 1.263 0 0 1 1.2632-1.2632"/></svg>
				<p class="text-md my-auto">n8n.io</p>
			</div>

			<div id="output_zapier" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Zapier</title><path fill="#FF4F00" d="M4.157 0A4.151 4.151 0 0 0 0 4.161v15.678A4.151 4.151 0 0 0 4.157 24h15.682A4.152 4.152 0 0 0 24 19.839V4.161A4.152 4.152 0 0 0 19.839 0H4.157Zm10.61 8.761h.03a.577.577 0 0 1 .23.038.585.585 0 0 1 .201.124.63.63 0 0 1 .162.431.612.612 0 0 1-.162.435.58.58 0 0 1-.201.128.58.58 0 0 1-.23.042.529.529 0 0 1-.235-.042.585.585 0 0 1-.332-.328.559.559 0 0 1-.038-.235.613.613 0 0 1 .17-.431.59.59 0 0 1 .405-.162Zm2.853 1.572c.03.004.061.004.095.004.325-.011.646.064.937.219.238.144.431.355.552.609.128.279.189.582.185.888v.193a2 2 0 0 1 0 .219h-2.498c.003.227.075.45.204.642a.78.78 0 0 0 .646.265.714.714 0 0 0 .484-.136.642.642 0 0 0 .23-.318l.915.257a1.398 1.398 0 0 1-.28.537c-.14.159-.321.284-.521.355a2.234 2.234 0 0 1-.836.136 1.923 1.923 0 0 1-1.001-.245 1.618 1.618 0 0 1-.665-.703 2.221 2.221 0 0 1-.227-1.036 1.95 1.95 0 0 1 .48-1.398 1.9 1.9 0 0 1 1.3-.488Zm-9.607.023c.162.004.325.026.48.079.207.065.4.174.563.314.26.302.393.692.366 1.088v2.276H8.53l-.109-.711h-.065c-.064.163-.155.31-.272.439a1.122 1.122 0 0 1-.374.264 1.023 1.023 0 0 1-.453.083 1.334 1.334 0 0 1-.866-.264.965.965 0 0 1-.329-.801.993.993 0 0 1 .076-.431 1.02 1.02 0 0 1 .242-.363 1.478 1.478 0 0 1 1.043-.303h.952v-.181a.696.696 0 0 0-.136-.454.553.553 0 0 0-.438-.154.695.695 0 0 0-.378.086.48.48 0 0 0-.193.254l-.99-.144a1.26 1.26 0 0 1 .257-.563c.14-.174.321-.302.533-.378.261-.091.54-.136.82-.129.053-.003.106-.007.163-.007Zm4.384.007c.174 0 .347.038.506.114.182.083.34.211.458.374.257.423.377.911.351 1.406a2.53 2.53 0 0 1-.355 1.448 1.148 1.148 0 0 1-1.009.517c-.204 0-.401-.045-.582-.136a1.052 1.052 0 0 1-.48-.457 1.298 1.298 0 0 1-.114-.234h-.045l.004 1.784h-1.059v-4.713h.904l.117.805h.057c.068-.208.177-.401.328-.56a1.129 1.129 0 0 1 .843-.344h.076v-.004Zm7.559.084h.903l.113.805h.053a1.37 1.37 0 0 1 .235-.484.813.813 0 0 1 .313-.242.82.82 0 0 1 .39-.076h.234v1.051h-.401a.662.662 0 0 0-.313.008.623.623 0 0 0-.272.155.663.663 0 0 0-.174.26.683.683 0 0 0-.027.314v1.875h-1.054v-3.666Zm-17.515.003h3.262v.896L3.73 13.104l.034.113h1.973l.042.9H2.4v-.9l1.931-1.754-.045-.117H2.441v-.896Zm11.815 0h1.055v3.659h-1.055V10.45Zm3.443.684.019.016a.69.69 0 0 0-.351.045.756.756 0 0 0-.287.204c-.11.155-.174.336-.189.522h1.545c-.034-.526-.257-.787-.74-.787h.003Zm-5.718.163c-.026 0-.057 0-.083.004a.78.78 0 0 0-.31.053.746.746 0 0 0-.257.189 1.016 1.016 0 0 0-.204.695v.064c-.015.257.057.507.204.711a.634.634 0 0 0 .253.196.638.638 0 0 0 .314.061.644.644 0 0 0 .578-.265c.14-.223.204-.48.189-.74a1.216 1.216 0 0 0-.181-.711.677.677 0 0 0-.503-.257Zm-4.509 1.266a.464.464 0 0 0-.268.102.373.373 0 0 0-.114.276c0 .053.008.106.027.155a.375.375 0 0 0 .087.132.576.576 0 0 0 .397.11v.004a.863.863 0 0 0 .563-.182.573.573 0 0 0 .211-.457v-.14h-.903Z"/></svg>
				<p class="text-md my-auto">zapier.com</p>
			</div>

			<div id="output_ifttt" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>IFTTT</title><path d="M0 8.82h2.024v6.36H0zm11.566 0h-3.47v2.024h1.446v4.337h2.024v-4.337h1.446V8.82zm5.494 0h-3.47v2.024h1.446v4.337h2.024v-4.337h1.446V8.82zm5.494 0h-3.47v2.024h1.446v4.337h2.024v-4.337H24V8.82zM7.518 10.843V8.82H2.892v6.36h2.024v-1.734H6.65v-2.024H4.916v-.578z"/></svg>
				<p class="text-md my-auto">IFTTT.com</p>
			</div>

			<div id="output_webhooks" class="border border-neutral-700 p-2 flex gap-2 bg-neutral-800 h-full">
				<svg class="w-8 h-8 fill-white my-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path fill="#E71E62" d="M4.66659 14C3.74436 14 2.95836 13.6749 2.30859 13.0246C1.65881 12.3744 1.3337 11.5884 1.33325 10.6666C1.33325 9.85554 1.58614 9.14731 2.09192 8.54198C2.5977 7.93665 3.2337 7.55598 3.99992 7.39998V8.78331C3.61103 8.91665 3.2917 9.15554 3.04192 9.49998C2.79214 9.84443 2.66703 10.2333 2.66659 10.6666C2.66659 11.2222 2.86103 11.6944 3.24992 12.0833C3.63881 12.4722 4.11103 12.6666 4.66659 12.6666C5.22214 12.6666 5.69436 12.4722 6.08325 12.0833C6.47214 11.6944 6.66659 11.2222 6.66659 10.6666V9.99998H10.5833C10.6721 9.89998 10.7806 9.81931 10.9086 9.75798C11.0366 9.69665 11.1781 9.6662 11.3333 9.66665C11.611 9.66665 11.8473 9.76398 12.0419 9.95865C12.2366 10.1533 12.3337 10.3893 12.3333 10.6666C12.3328 10.944 12.2357 11.1802 12.0419 11.3753C11.8481 11.5704 11.6119 11.6675 11.3333 11.6666C11.1777 11.6666 11.0359 11.6362 10.9079 11.5753C10.7799 11.5144 10.6719 11.4338 10.5839 11.3333H7.93325C7.7777 12.1 7.39703 12.7362 6.79125 13.242C6.18547 13.7478 5.47725 14.0004 4.66659 14ZM11.3333 14C10.711 14 10.1473 13.8473 9.64192 13.542C9.13659 13.2366 8.73925 12.8338 8.44992 12.3333H10.2333C10.3888 12.4444 10.561 12.5278 10.7499 12.5833C10.9388 12.6389 11.1333 12.6666 11.3333 12.6666C11.8888 12.6666 12.361 12.4722 12.7499 12.0833C13.1388 11.6944 13.3333 11.2222 13.3333 10.6666C13.3333 10.1111 13.1388 9.63887 12.7499 9.24998C12.361 8.86109 11.8888 8.66665 11.3333 8.66665C11.111 8.66665 10.9055 8.69731 10.7166 8.75865C10.5277 8.81998 10.3499 8.91154 10.1833 9.03331L8.14992 5.64998C7.91659 5.60554 7.72214 5.49442 7.56659 5.31665C7.41103 5.13887 7.33325 4.9222 7.33325 4.66665C7.33325 4.38887 7.43059 4.15287 7.62525 3.95865C7.81992 3.76442 8.05592 3.66709 8.33325 3.66665C8.61059 3.6662 8.84681 3.76354 9.04192 3.95865C9.23703 4.15376 9.33414 4.38976 9.33325 4.66665V4.80865C9.33325 4.84731 9.32214 4.89442 9.29992 4.94998L10.7499 7.38331C10.8388 7.36109 10.9333 7.34731 11.0333 7.34198C11.1333 7.33665 11.2333 7.33376 11.3333 7.33331C12.2555 7.33331 13.0417 7.65843 13.6919 8.30865C14.3421 8.95887 14.667 9.74487 14.6666 10.6666C14.6661 11.5884 14.341 12.3746 13.6913 13.0253C13.0415 13.676 12.2555 14.0009 11.3333 14ZM4.66659 11.6666C4.38881 11.6666 4.15281 11.5695 3.95859 11.3753C3.76436 11.1811 3.66703 10.9449 3.66659 10.6666C3.66659 10.4222 3.74436 10.2111 3.89992 10.0333C4.05547 9.85554 4.24436 9.73887 4.46659 9.68331L6.03325 7.08331C5.71103 6.78331 5.45814 6.42509 5.27459 6.00865C5.09103 5.5922 4.99947 5.14487 4.99992 4.66665C4.99992 3.74442 5.32503 2.95842 5.97525 2.30865C6.62547 1.65887 7.41147 1.33376 8.33325 1.33331C9.25503 1.33287 10.0413 1.65798 10.6919 2.30865C11.3426 2.95931 11.6675 3.74531 11.6666 4.66665H10.3333C10.3333 4.11109 10.1388 3.63887 9.74992 3.24998C9.36103 2.86109 8.88881 2.66665 8.33325 2.66665C7.7777 2.66665 7.30547 2.86109 6.91659 3.24998C6.5277 3.63887 6.33325 4.11109 6.33325 4.66665C6.33325 5.14442 6.4777 5.56398 6.76659 5.92531C7.05547 6.28665 7.42214 6.51709 7.86659 6.61665L5.61659 10.3666C5.63881 10.4222 5.65281 10.4722 5.65859 10.5166C5.66436 10.5611 5.66703 10.6111 5.66659 10.6666C5.66659 10.9444 5.56947 11.1806 5.37525 11.3753C5.18103 11.57 4.94481 11.6671 4.66659 11.6666Z"/>
				</svg>
				<p class="text-md my-auto">Webhooks</p>
			</div>

			<svg id="outputs_to_platforms" class="intro-pipe-connector line stroke-green-500 opacity-0 pointer-events-none hidden md:block" xmlns="http://www.w3.org/2000/svg"
				width="32" height="16"
				style="position:absolute; top:50%; right:-32px; transform:translateY(-50%); overflow:visible;">
				<line class="pipe-line" x1="0" y1="8" x2="32" y2="8"
					stroke-width="1"/>
			</svg>
			<svg id="outputs_to_platforms_mobile" class="intro-pipe-connector line block stroke-green-500 opacity-0 pointer-events-none md:hidden" xmlns="http://www.w3.org/2000/svg" width="16" height="32"
				style="position:absolute; left:50%; top:100%; transform:translateX(-50%); overflow:visible;">
				<line class="pipe-line" x1="8" y1="0" x2="8" y2="32" stroke-width="1"/>
			</svg>

		</div>

		<div id="platforms" class="min-h-0 min-w-0 md:col-span-1 xl:row-span-3 xl:col-start-7 xl:row-start-1 bg-neutral-900 p-4 border border-neutral-800 flex flex-col gap-4 opacity-30">
			<div class="section_title text-2xl">PLATFORMS</div>

			<div id="platform_youtube" class="border border-neutral-700 p-2 flex gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>YouTube</title><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
				<p class="text-md my-auto">YouTube</p>
			</div>

			<div id="platform_instagram" class="border border-neutral-700 p-2 flex gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Instagram</title><path fill="#FF0069" d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>
				<p class="text-md my-auto">Instagram</p>
			</div>

			<div id="platform_tiktok" class="border border-neutral-700 p-2 flex gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>TikTok</title><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
				<p class="text-md my-auto">TikTok</p>
			</div>

			<div id="platform_facebook" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Facebook</title><path fill="#0866FF" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>
				<p class="text-md my-auto">Facebook</p>
			</div>

			<div id="platform_github" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
				<p class="text-md my-auto">GitHub</p>
			</div>

			<div id="platform_chatgpt" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg class="w-8 h-8 my-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<g clip-path="url(#clip0_704_471)">
						<path d="M6.12671 9.31333V4.51333L9.85671 2.36C11.9234 1.16666 15.6234 4.11 14.07 6.80333" stroke="white" stroke-width="0.333333" stroke-linejoin="round"/>
						<path d="M6.12671 6.98002L10.2834 4.58002L14.0134 6.73335C16.08 7.92668 15.38 12.6034 12.27 12.6034" stroke="white" stroke-width="0.333333" stroke-linejoin="round"/>
						<path d="M8.14676 5.81335L12.3034 8.21335V12.5234C12.3034 14.91 7.90343 16.6434 6.3501 13.95" stroke="white" stroke-width="0.333333" stroke-linejoin="round"/>
						<path d="M10.1667 7.06665V11.78L6.43665 13.9333C4.36999 15.1267 0.669985 12.1833 2.22332 9.48998" stroke="white" stroke-width="0.333333" stroke-linejoin="round"/>
						<path d="M10.1667 9.31334L6.01001 11.7133L2.28001 9.56C0.210012 8.36334 0.910012 3.69 4.02001 3.69" stroke="white" stroke-width="0.333333" stroke-linejoin="round"/>
						<path d="M8.14666 10.48L3.98999 8.07999V3.76999C3.98999 1.38332 8.38999 -0.350014 9.94332 2.34332" stroke="white" stroke-width="0.333333" stroke-linejoin="round"/>
					</g>
					<defs><clipPath id="clip0_704_471"><rect width="16" height="16" fill="white"/></clipPath></defs>
				</svg>
				<p class="text-md my-auto">ChatGPT</p>
			</div>

			<div id="platform_claude" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg role="img" class="w-8 h-8 fill-white my-auto" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Claude</title><path fill="#D97757" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>
				<p class="text-md my-auto">Claude</p>
			</div>

			<div id="platform_anything" class="hidden border border-neutral-700 p-2 md:flex md:gap-2 bg-neutral-800 h-full">
				<svg class="w-8 h-8 fill-green-500 my-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<g clip-path="url(#clip0_704_782)">
						<mask id="mask0_704_782" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
							<path d="M7.59965 1.40036L1.47131 7.52869C1.34633 7.65371 1.27612 7.82325 1.27612 8.00002C1.27612 8.1768 1.34633 8.34634 1.47131 8.47136L7.59998 14.6C7.725 14.725 7.89454 14.7952 8.07131 14.7952C8.24809 14.7952 8.41763 14.725 8.54265 14.6L14.671 8.47169C14.796 8.34667 14.8662 8.17713 14.8662 8.00036C14.8662 7.82358 14.796 7.65404 14.671 7.52903L8.54231 1.40002C8.4173 1.27504 8.24776 1.20483 8.07098 1.20483C7.8942 1.20483 7.72467 1.27504 7.59965 1.40002V1.40036Z" fill="#08BD80" stroke="#08BD80" stroke-width="1.33333" stroke-linejoin="round"/>
							<path d="M6 8H10M8 6V10" stroke="black" stroke-width="1.33333" stroke-linecap="round"/>
						</mask>
						<g mask="url(#mask0_704_782)">
							<path d="M0 0H16V16H0V0Z" fill="#08BD80"/>
						</g>
					</g>
					<defs>
					<clipPath id="clip0_704_782">
						<rect width="16" height="16" fill="#08BD80"/>
					</clipPath>
					</defs>
				</svg>
					
				<p class="text-md my-auto">Others</p>
			</div>
		</div>
	</div>

	<div id="timeline" class="flex shrink-0 p-1 max-xl:p-1 xl:p-4 w-full text-white m-auto gap-1 xl:gap-4 justify-center flex-wrap max-xl:pb-[max(0.25rem,env(safe-area-inset-bottom))]">
		<button type="button" class="timeline-btn border border-neutral-700 p-2 xl:p-4 text-sm xl:text-md bg-neutral-800 min-w-[7rem]" data-stage="website_posts">Content</button>
		<button type="button" class="timeline-btn border border-neutral-700 p-2 xl:p-4 text-sm xl:text-md bg-neutral-800 min-w-[7rem]" data-stage="import_data">Import</button>
		<button type="button" class="timeline-btn border border-neutral-700 p-2 xl:p-4 text-sm xl:text-md bg-neutral-800 min-w-[7rem]" data-stage="schedule_calendar">Schedule Calendar</button>
		<button type="button" class="timeline-btn border border-neutral-700 p-2 xl:p-4 text-sm xl:text-md bg-neutral-800 min-w-[7rem]" data-stage="send_webhook">Send</button>
		<button type="button" class="timeline-btn border border-neutral-700 p-2 xl:p-4 text-sm xl:text-md bg-neutral-800 min-w-[7rem]" data-stage="run_automation">Automate</button>
		<button type="button" id="intro_pause_toggle" class=" p-1 xl:p-3 min-w-[2.75rem] xl:min-w-[3.25rem] " aria-pressed="false" aria-label="Pause intro animation">
			<svg class="intro-pause-icon w-5 h-5 xl:w-6 xl:h-6 fill-neutral-700" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
			<svg class="intro-play-icon hidden w-5 h-5 xl:w-6 xl:h-6 fill-current" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7L8 5z"/></svg>
		</button>
	</div>
</div>
