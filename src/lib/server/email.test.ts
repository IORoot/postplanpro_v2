/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMail = vi.fn();

vi.mock('nodemailer', () => ({
	default: {
		createTransport: vi.fn(() => ({
			sendMail
		}))
	}
}));

describe('sendAuthEmail', () => {
	const prev = { ...process.env };

	beforeEach(() => {
		sendMail.mockReset();
		sendMail.mockResolvedValue(undefined);
		process.env.SMTP_HOST = 'smtp.example.com';
		process.env.SMTP_PORT = '587';
		process.env.SMTP_USER = 'u';
		process.env.SMTP_PASS = 'p';
		process.env.SMTP_FROM = 'from@example.com';
	});

	afterEach(() => {
		process.env = { ...prev };
		vi.resetModules();
	});

	it('returns error when SMTP is not configured', async () => {
		delete process.env.SMTP_HOST;
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
