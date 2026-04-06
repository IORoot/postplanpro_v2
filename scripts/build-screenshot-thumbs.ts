/**
 * For every PNG in static/screenshots/full/, ensure a matching WebP exists in
 * static/screenshots/thumb/ (max width 960, quality 86). Run:
 *   npx tsx scripts/build-screenshot-thumbs.ts
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const FULL = path.join(ROOT, 'static', 'screenshots', 'full');
const THUMB = path.join(ROOT, 'static', 'screenshots', 'thumb');

async function main(): Promise<void> {
	const files = readdirSync(FULL).filter((f) => f.endsWith('.png'));
	for (const file of files) {
		const base = file.replace(/\.png$/i, '');
		const src = path.join(FULL, file);
		const dest = path.join(THUMB, `${base}.webp`);
		await sharp(src).resize({ width: 960, withoutEnlargement: true }).webp({ quality: 86 }).toFile(dest);
		console.log('OK', path.relative(ROOT, dest));
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
