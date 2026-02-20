export type PayloadField = {
	key: string;
	type: string;
	value: string | null;
};

export function parseValue(type: string, value: string | null): unknown {
	if (value == null || value === '') return value;
	switch (type) {
		case 'number':
			return Number(value);
		case 'boolean':
			return value === 'true' || value === '1';
		case 'json':
			try {
				return JSON.parse(value);
			} catch {
				return value;
			}
		default:
			return value;
	}
}

function pathSegments(path: string): Array<string | number> {
	const segs: Array<string | number> = [];
	const re = /([^[.\]]+)|\[(\d+)\]/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(path)) !== null) {
		if (m[1]) segs.push(m[1]);
		else if (m[2]) segs.push(Number(m[2]));
	}
	return segs;
}

export function setByPath(target: Record<string, unknown>, rawPath: string, value: unknown) {
	const path = rawPath.trim();
	if (!path) return;
	const segs = pathSegments(path);
	if (segs.length === 0) return;

	let cur: unknown = target;
	for (let i = 0; i < segs.length - 1; i++) {
		const seg = segs[i];
		const next = segs[i + 1];
		if (typeof seg === 'number') {
			if (!Array.isArray(cur)) return;
			if (cur[seg] == null || typeof cur[seg] !== 'object') {
				cur[seg] = typeof next === 'number' ? [] : {};
			}
			cur = cur[seg];
		} else {
			const obj = cur as Record<string, unknown>;
			if (obj[seg] == null || typeof obj[seg] !== 'object') {
				obj[seg] = typeof next === 'number' ? [] : {};
			}
			cur = obj[seg];
		}
	}

	const last = segs[segs.length - 1];
	if (typeof last === 'number') {
		if (Array.isArray(cur)) cur[last] = value;
		return;
	}
	(cur as Record<string, unknown>)[last] = value;
}

export function buildPostPayload(
	base: { title: string; content: string | null; image_url: string | null; scheduled_at: string | null },
	postFields: PayloadField[],
	globals: PayloadField[]
): Record<string, unknown> {
	const body: Record<string, unknown> = {
		title: base.title,
		content: base.content,
		image_url: base.image_url,
		scheduled_at: base.scheduled_at
	};
	for (const f of postFields) {
		setByPath(body, f.key, parseValue(f.type, f.value));
	}
	for (const g of globals) {
		setByPath(body, g.key, parseValue(g.type, g.value));
	}
	return body;
}
