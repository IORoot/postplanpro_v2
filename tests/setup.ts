import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
	// Bun's jsdom can expose `window` without a full Storage implementation; Vitest needs this for theme code.
	if (typeof window.localStorage?.getItem !== 'function') {
		const store = new Map<string, string>();
		window.localStorage = {
			getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			},
			clear: () => {
				store.clear();
			},
			key: (index: number) => Array.from(store.keys())[index] ?? null,
			get length() {
				return store.size;
			}
		} as Storage;
	}
		window.matchMedia =
		window.matchMedia ||
		((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false
		}));

		// jsdom: scrollIntoView often missing or not callable; app uses it after wizard step changes.
		(Element.prototype as Element & { scrollIntoView: () => void }).scrollIntoView =
			function () {};
}
