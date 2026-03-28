import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import SampleJsonViewer from './SampleJsonViewer.svelte';

describe('SampleJsonViewer', () => {
	it('renders null as text', () => {
		render(SampleJsonViewer, { props: { data: null } });
		expect(screen.getByText('null')).toBeInTheDocument();
	});

	it('renders string', () => {
		render(SampleJsonViewer, { props: { data: 'hello' } });
		expect(screen.getByText('"hello"')).toBeInTheDocument();
	});

	it('renders number', () => {
		render(SampleJsonViewer, { props: { data: 42 } });
		expect(screen.getByText('42')).toBeInTheDocument();
	});

	it('renders boolean', () => {
		render(SampleJsonViewer, { props: { data: true } });
		expect(screen.getByText('true')).toBeInTheDocument();
	});

	it('renders object with keys', () => {
		render(SampleJsonViewer, { props: { data: { foo: 'bar' } } });
		expect(screen.getByText('foo')).toBeInTheDocument();
		expect(screen.getByText('"bar"')).toBeInTheDocument();
	});

	it('renders empty object', () => {
		render(SampleJsonViewer, { props: { data: {} } });
		expect(screen.getByText('{')).toBeInTheDocument();
		expect(screen.getByText('}')).toBeInTheDocument();
	});

	it('renders array', () => {
		render(SampleJsonViewer, { props: { data: [1, 2] } });
		expect(screen.getByText('[0]')).toBeInTheDocument();
		expect(screen.getByText('[1]')).toBeInTheDocument();
	});
});
