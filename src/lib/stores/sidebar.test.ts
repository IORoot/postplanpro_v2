import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { sidebarOpen, toggleSidebar, closeSidebar } from './sidebar.js';

describe('sidebar store', () => {
	it('sidebarOpen starts false', () => {
		expect(get(sidebarOpen)).toBe(false);
	});

	it('toggleSidebar flips value', () => {
		sidebarOpen.set(false);
		toggleSidebar();
		expect(get(sidebarOpen)).toBe(true);
		toggleSidebar();
		expect(get(sidebarOpen)).toBe(false);
	});

	it('closeSidebar sets to false', () => {
		sidebarOpen.set(true);
		closeSidebar();
		expect(get(sidebarOpen)).toBe(false);
	});
});
