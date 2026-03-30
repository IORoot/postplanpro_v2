/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMail = vi.fn();

/** Mutable stand-in for SvelteKit `$env/dynamic/private` (tests do not load `.env` the same way as `vite dev`). */
const mockPrivateEnv: Record<string, string | undefined> = {};

vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockPrivateEnv;
	}
}));

vi.mock('nodemailer', () => ({
	default: {
		createTransport: vi.fn(() => ({
			sendMail
		}))
	}
}));

describe('sendAuthEmail', () => {
	beforeEach(() => {
		sendMail.mockReset();
		sendMail.mockResolvedValue(undefined);
		for (const k of Object.keys(mockPrivateEnv)) delete mockPrivateEnv[k];
		mockPrivateEnv.SMTP_HOST = 'smtp.example.com';
		mockPrivateEnv.SMTP_PORT = '587';
		mockPrivateEnv.SMTP_USER = 'u';
		mockPrivateEnv.SMTP_PASS = 'p';
		mockPrivateEnv.SMTP_FROM = 'from@example.com';
	});

	afterEach(() => {
		for (const k of Object.keys(mockPrivateEnv)) delete mockPrivateEnv[k];
		vi.resetModules();
	});

	it('returns error when SMTP is not configured', async () => {
		delete mockPrivateEnv.SMTP_HOST;
		const { sendAuthEmail } = await import('./email.js');
		const r = await sendAuthEmail({ to: 'a@b.com', subject: 's', text: 't', html: '<p>t</p>' });
		expect(r).toEqual(
			expect.objectContaining({
				ok: false,
				error: expect.stringContaining('SMTP is not configured')
			})
		);
	});

	it('sends mail and returns ok when configured', async () => {
		const { sendAuthEmail } = await import('./email.js');
		const r = await sendAuthEmail({ to: 'a@b.com', subject: 'sub', text: 'plain', html: '<p>h</p>' });
		expect(r).toEqual({ ok: true });
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'a@b.com', subject: 'sub' })
		);
	});

	it('returns error message when sendMail throws', async () => {
		sendMail.mockRejectedValue(new Error('inbox full'));
		const { sendAuthEmail } = await import('./email.js');
		const r = await sendAuthEmail({ to: 'a@b.com', subject: 's', text: 't', html: 'h' });
		expect(r).toEqual({ ok: false, error: 'inbox full' });
	});
});
