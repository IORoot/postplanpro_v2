import type { RequestEvent } from '@sveltejs/kit';

export type MockLocals = {
	userId: string | null;
	/** When omitted and `userId` is set, defaults to a signed-in session with that id (for `+layout.server` / Stripe / account). */
	auth?: () => Promise<{ user?: { id: string; email?: string | null } } | null>;
};

/** Minimal `locals` for invoking `load` / `actions` in Vitest. */
export function mockRequestEvent(
	locals: MockLocals,
	url: string,
	extra?: Partial<Pick<RequestEvent, 'params' | 'fetch'>>
): RequestEvent {
	const defaultAuth = async () =>
		locals.userId ? { user: { id: locals.userId, email: 'test@test.com' as string | null } } : null;
	const { auth: authFn, ...localsRest } = locals;
	const auth = authFn ?? defaultAuth;
	return {
		url: new URL(url),
		request: new Request(url),
		params: extra?.params ?? {},
		route: { id: '/test' },
		cookies: { get: () => undefined, set: () => {}, delete: () => {}, serialize: () => '' } as RequestEvent['cookies'],
		fetch: extra?.fetch ?? globalThis.fetch.bind(globalThis),
		getClientAddress: () => '',
		locals: { ...localsRest, auth },
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
		depends: () => {},
		parent: async () => ({}),
		untrack: (fn: () => unknown) => fn()
	} as unknown as RequestEvent;
}

export function formRequest(url: string, data: Record<string, string | string[]>): Request {
	const fd = new FormData();
	for (const [k, v] of Object.entries(data)) {
		if (Array.isArray(v)) for (const item of v) fd.append(k, item);
		else fd.set(k, v);
	}
	return new Request(url, { method: 'POST', body: fd });
}
