import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function GET() {
	const path = join(process.cwd(), 'changelog.md');
	if (!existsSync(path)) {
		return new Response('Not found', { status: 404 });
	}
	const body = readFileSync(path, 'utf8');
	return new Response(body, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Cache-Control': 'no-store'
		}
	});
}
