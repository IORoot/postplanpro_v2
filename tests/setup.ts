import '@testing-library/jest-dom/vitest';
import { setTestDatabasePath } from './helpers/testDb.js';

// Use test DB for all tests so API integration tests have a consistent DB path
// (unit tests that don't touch DB are unaffected)
setTestDatabasePath();

if (typeof window !== 'undefined') {
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
}
