import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const htmlPath = path.join(repoRoot, 'static/animation_responsive.html');
const outDir = path.join(repoRoot, 'src/lib/workflowAnimation');
const outTsPath = path.join(outDir, 'mountResponsiveWorkflowAnimation.ts');
const outCssPath = path.join(repoRoot, 'src/lib/components/workflow-animation-responsive.css');

const html = fs.readFileSync(htmlPath, 'utf8');

/* ── Extract inline animation CSS (body block before GSAP script) ─────────── */
const cssStartMarker = '\n\t<style>\n\t\t.website_post_image';
const cssStart = html.indexOf(cssStartMarker);
if (cssStart === -1) throw new Error('Could not find responsive workflow <style> block');
const cssEndMarker = '\n\t</style>\n\n\t<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>';
const cssEnd = html.indexOf(cssEndMarker, cssStart);
if (cssEnd === -1) throw new Error('Could not find end of responsive workflow <style> block');
let cssBody = html.slice(cssStart + '\n\t<style>\n'.length, cssEnd);
cssBody = cssBody
	.split('\n')
	.map((line) => (line.startsWith('\t\t') ? line.slice(2) : line))
	.join('\n');

const cssHeader = `/* Generated from static/animation_responsive.html — run: node scripts/build-responsive-workflow-animation-module.mjs */

@font-face {
	font-family: 'MD Thermochrome';
	src: url('/fonts/MDThermochrome0.3-Medium.otf') format('opentype');
	font-weight: 500;
	font-style: normal;
	font-display: swap;
}

.workflow-animation.intro-font #intro_animation {
	font-family: 'MD Thermochrome', ui-sans-serif, system-ui, sans-serif;
}

`;

fs.writeFileSync(outCssPath, cssHeader + cssBody + '\n', 'utf8');
console.log('Wrote', outCssPath);

/* ── Extract GSAP script body ─────────────────────────────────────────────── */
const scriptMarker =
	'<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>\n\t<script>\n';
const start = html.indexOf(scriptMarker);
if (start === -1) throw new Error('Could not find GSAP script block start');
const bodyStart = start + scriptMarker.length;
const endMarker = '\n\t</script>\n\n<div class="animation_and_timeline';
const end = html.indexOf(endMarker, bodyStart);
if (end === -1) throw new Error('Could not find script block end');
let body = html.slice(bodyStart, end);

body = body
	.split('\n')
	.map((line) => (line.startsWith('\t\t') ? line.slice(2) : line))
	.join('\n');

const domReadyOpen =
	"/* ── Wire up on DOM ready ───────────────────────────────── */\ndocument.addEventListener('DOMContentLoaded', () => {\n";
if (!body.includes(domReadyOpen)) {
	throw new Error('Expected DOMContentLoaded wrapper not found (update domReadyOpen in build script)');
}
body = body.replace(domReadyOpen, '/* Wired when mountResponsiveWorkflowAnimation(host) runs */\n');

const domReadyClose = "\tgsap.delayedCall(0, () => playFromStage('website_posts'));\n});";
if (!body.endsWith(domReadyClose)) {
	throw new Error('Expected DOMContentLoaded close not found at script end');
}
body = body.slice(0, -domReadyClose.length) + "\tgsap.delayedCall(0, () => playFromStage('website_posts'));\n";

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

body = body.replace(/document\.getElementById\(([^)]+)\)/g, "host.querySelector('#' + ($1))");

const header = `// @ts-nocheck
/* Generated from static/animation_responsive.html — run: node scripts/build-responsive-workflow-animation-module.mjs */
import gsap from 'gsap';

/** Responsive GSAP workflow; host must contain #intro_animation and #timeline (see WorkflowAnimation.svelte). */
export function mountResponsiveWorkflowAnimation(host: HTMLElement): () => void {
	const ctx = gsap.context(() => {
`;

const footer = `
	}, host);

	return () => {
		ctx.revert();
	};
}
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outTsPath, header + body + footer, 'utf8');
console.log('Wrote', outTsPath);
