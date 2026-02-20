import nodemailer from 'nodemailer';

function getSmtpConfig() {
	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT ?? '587');
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;
	const from = process.env.SMTP_FROM;
	if (!host || !user || !pass || !from) return null;
	return { host, port, user, pass, from };
}

export async function sendAuthEmail(input: {
	to: string;
	subject: string;
	text: string;
	html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const smtp = getSmtpConfig();
	if (!smtp) {
		return {
			ok: false,
			error:
				'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.'
		};
	}
	try {
		const transporter = nodemailer.createTransport({
			host: smtp.host,
			port: smtp.port,
			secure: smtp.port === 465,
			auth: { user: smtp.user, pass: smtp.pass }
		});
		await transporter.sendMail({
			from: smtp.from,
			to: input.to,
			subject: input.subject,
			text: input.text,
			html: input.html
		});
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : 'Failed to send email.'
		};
	}
}
