import nodemailer from 'nodemailer';
import * as vscode from 'vscode';
import {
	getSmtpToolEmailSettings,
	parseSmtpRecipients,
	type SmtpToolEmailSettings,
} from './config';
import { logSmtp } from './logger';

/**
 * Send a single mail using workspace SMTP settings (no SMTP AUTH).
 */
export async function sendMailWithSettings(
	settings: SmtpToolEmailSettings,
	mail: { readonly to: readonly string[]; subject: string; text: string }
): Promise<void> {
	const transporter = nodemailer.createTransport({
		host: settings.host,
		port: settings.port,
		secure: settings.secure,
		tls: { rejectUnauthorized: settings.tlsRejectUnauthorized },
	});
	await transporter.sendMail({
		from: settings.from,
		to: [...mail.to].join(', '),
		subject: mail.subject,
		text: mail.text,
	});
}

/**
 * Validate settings and send a minimal test message (command palette).
 */
export async function sendTestSmtpEmail(): Promise<void> {
	const settings = getSmtpToolEmailSettings();
	const recipients = parseSmtpRecipients(settings.toRaw);
	if (!settings.enabled) {
		void vscode.window.showWarningMessage('SMTP tool email is disabled (llamaCopilot.smtp.enabled).');
		return;
	}
	if (!settings.host || !settings.from || recipients.length === 0) {
		void vscode.window.showWarningMessage(
			'SMTP host, from, and to addresses must be configured before sending a test email.'
		);
		return;
	}
	if (!Number.isFinite(settings.port) || settings.port <= 0) {
		void vscode.window.showWarningMessage('SMTP port must be a positive number.');
		return;
	}
	try {
		await sendMailWithSettings(settings, {
			to: recipients,
			subject: `${settings.subjectPrefix} test`,
			text: 'This is a test email from the Copilot for llama-server LLMs extension.',
		});
		logSmtp(`Test email sent to ${recipients.length} recipient(s).`);
		void vscode.window.showInformationMessage('Test SMTP email sent.');
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		logSmtp(`Test email failed: ${msg}`);
		void vscode.window.showErrorMessage(`Test SMTP email failed: ${msg}`);
	}
}
