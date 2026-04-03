import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const htmlPath = path.join(repoRoot, 'static/animation.html');
const outDir = path.join(repoRoot, 'src/lib/workflowAnimation');
const outPath = path.join(outDir, 'mountWorkflowAnimation.ts');

const html = fs.readFileSync(htmlPath, 'utf8');
const marker =
	'<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>\n\t<script>\n';
const start = html.indexOf(marker);
if (start === -1) throw new Error('Could not find GSAP script block start');
const bodyStart = start + marker.length;
const endMarker = '\n\t</script>\n\n<div class="animation_and_timeline';
const end = html.indexOf(endMarker, bodyStart);
if (end === -1) throw new Error('Could not find script block end');
let body = html.slice(bodyStart, end);

body = body
	.split('\n')
	.map((line) => (line.startsWith('\t\t') ? line.slice(2) : line))
	.join('\n');

body = body.replace(/document\.querySelectorAll\(/g, 'host.querySelectorAll(');
body = body.replace(/document\.querySelector\(/g, 'host.querySelector(');
body = body.replace(/document\.getElementById\('([^']+)'\)/g, "host.querySelector('#$1')");
body = body.replace(
	/document\.getElementById\(`calendar_feb_\$\{d\}`\)/g,
	'host.querySelector(`#calendar_feb_${d}`)'
);
body = body.replace(
	/\? document\.getElementById\(desktopId\)\s*\n\s*:\s*document\.getElementById\(mobileId\)/g,
	"? host.querySelector('#' + desktopId)\n\t\t\t\t: host.querySelector('#' + mobileId)"
);
body = body.replace(
	/\? document\.getElementById\('website_to_inputs'\)\s*\n\s*:\s*document\.getElementById\('website_to_inputs_mobile'\)/g,
	"? host.querySelector('#website_to_inputs')\n\t\t\t\t: host.querySelector('#website_to_inputs_mobile')"
);
body = body.replace(
	/\? document\.getElementById\('outputs_to_platforms'\)\s*\n\s*:\s*document\.getElementById\('outputs_to_platforms_mobile'\)/g,
	"? host.querySelector('#outputs_to_platforms')\n\t\t\t\t: host.querySelector('#outputs_to_platforms_mobile')"
);

body = body.replace(
	/const root = host\.querySelector\('#intro_animation'\);\s*\n\s*if \(root\) \{\s*\n\s*gsap\.killTweensOf\(root\);\s*\n\s*root\.querySelectorAll/g,
	`const introAnimEl = host.querySelector('#intro_animation');
			if (introAnimEl) {
				gsap.killTweensOf(introAnimEl);
				introAnimEl.querySelectorAll`
);

body = body.replace(/^document\.addEventListener\('DOMContentLoaded', \(\) => \{\n/m, '');

body = body.replace(
	/\n\t\tgsap\.delayedCall\(0\.05, updateClockFloatState\);\n\t\t\}\);$/m,
	'\n\t\tgsap.delayedCall(0.05, updateClockFloatState);'
);

// Mobile clock: hoist MediaQueryList + assign handler for cleanup
body = body.replace(
	/\t\/\* Mobile: corner clock only mid–intro_animation[\s\S]*?const clockFloatMq = window\.matchMedia\('\(max-width: 1279px\)'\);\n\t\tfunction updateClockFloatState\(\) \{/,
	`/* Mobile: corner clock only mid–intro_animation; otherwise clock is hidden (never in-flow in the grid) */
		updateClockFloatState = () => {`
);

const header = `import gsap from 'gsap';

/** GSAP workflow diagram; host element must contain #intro_animation and #timeline (see WorkflowAnimation.svelte). */
export function mountWorkflowAnimation(host: HTMLElement): () => void {
	let updateClockFloatState: () => void = () => {};
	const clockFloatMq = window.matchMedia('(max-width: 1279px)');

	const ctx = gsap.context(() => {
`;

const footer = `
	}, host);

	return () => {
		window.removeEventListener('scroll', updateClockFloatState);
		window.removeEventListener('resize', updateClockFloatState);
		clockFloatMq.removeEventListener('change', updateClockFloatState);
		ctx.revert();
	};
}
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, header + body + footer, 'utf8');
console.log('Wrote', outPath);
