import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly devMode: boolean;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('EMAIL_HOST') ?? 'smtp.gmail.com';
    const port = parseInt(this.config.get<string>('EMAIL_PORT') ?? '587', 10);
    const user = this.config.get<string>('EMAIL_USER');
    const pass = this.config.get<string>('EMAIL_PASS');

    this.from =
      this.config.get<string>('EMAIL_FROM') ?? 'Zarova <noreply@zarova.com>';

    if (!user) {
      this.logger.warn(
        'EMAIL_USER is not set — email sending is disabled (dev mode).',
      );
      this.devMode = true;
    } else {
      this.devMode = false;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  // ============================================================
  // PUBLIC METHODS
  // ============================================================

  async sendWelcomeEmail(to: string, firstName: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Welcome to Zarova',
      html: this.buildWelcomeHtml(firstName),
    });
  }

  async sendPasswordResetEmail(
    to: string,
    firstName: string,
    resetToken: string,
    resetUrl: string,
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Reset your Zarova password',
      html: this.buildPasswordResetHtml(firstName, resetUrl),
    });
  }

  async sendTransactionNotificationEmail(
    to: string,
    firstName: string,
    data: {
      type: string;
      amount: string;
      currency: string;
      reference: string;
      balance: string;
    },
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Transaction ${data.reference} — ${data.type}`,
      html: this.buildTransactionHtml(firstName, data),
    });
  }

  async sendTwoFactorEnabledEmail(
    to: string,
    firstName: string,
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Two-factor authentication enabled',
      html: this.buildTwoFactorHtml(firstName),
    });
  }

  async sendLoginAlertEmail(
    to: string,
    firstName: string,
    data: { ip: string; device: string; time: string },
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'New sign-in to your Zarova account',
      html: this.buildLoginAlertHtml(firstName, data),
    });
  }

  // ============================================================
  // PRIVATE — TRANSPORT
  // ============================================================

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (this.devMode) {
      this.logger.debug(
        `[dev mode] Skipping email to ${options.to}: "${options.subject}"`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      this.logger.log(`Email sent to ${options.to}: "${options.subject}"`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send email to ${options.to}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  // ============================================================
  // PRIVATE — HTML BUILDERS
  // ============================================================

  private layout(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f4c81;padding:32px 40px;text-align:center;">
              <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Zarova</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 40px 32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
                This email was sent by Zarova. If you did not request it, you can safely ignore it.
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} Zarova. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private buildWelcomeHtml(firstName: string): string {
    const body = `
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;">Welcome, ${firstName}!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
        Your Zarova account is ready. We're glad to have you on board.
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
        With Zarova you can:
      </p>
      <ul style="margin:0 0 28px;padding-left:20px;font-size:15px;color:#475569;line-height:1.8;">
        <li>Send and receive funds instantly</li>
        <li>Manage multiple wallets in one place</li>
        <li>Track every transaction with a full audit trail</li>
      </ul>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
        <tr>
          <td style="border-radius:6px;background-color:#0f4c81;">
            <a href="https://zarova.com/dashboard"
               style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
              Go to your dashboard
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        If you have any questions, reply to this email or visit our support centre.
      </p>
    `;
    return this.layout('Welcome to Zarova', body);
  }

  private buildPasswordResetHtml(
    firstName: string,
    resetUrl: string,
  ): string {
    const body = `
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
        Hi ${firstName}, we received a request to reset the password for your Zarova account.
        Click the button below to choose a new password. This link expires in <strong>15 minutes</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>
          <td style="border-radius:6px;background-color:#0f4c81;">
            <a href="${resetUrl}"
               style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
              Reset password
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
        If the button does not work, copy and paste the link below into your browser:
      </p>
      <p style="margin:0 0 28px;word-break:break-all;">
        <a href="${resetUrl}" style="font-size:13px;color:#0f4c81;">${resetUrl}</a>
      </p>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        If you did not request a password reset, no action is needed — your password will not change.
      </p>
    `;
    return this.layout('Reset your Zarova password', body);
  }

  private buildTransactionHtml(
    firstName: string,
    data: {
      type: string;
      amount: string;
      currency: string;
      reference: string;
      balance: string;
    },
  ): string {
    const typeLabel =
      data.type.charAt(0).toUpperCase() + data.type.slice(1).toLowerCase();

    const body = `
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;">Transaction notification</h1>
      <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">
        Hi ${firstName}, here is a summary of your recent transaction.
      </p>

      <!-- Transaction card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 28px;">
        <tr>
          <td style="background-color:#f8fafc;padding:16px 20px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Transaction details</span>
          </td>
        </tr>
        <tr>
          <td style="padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;">Type</td>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;text-align:right;">${typeLabel}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;">Amount</td>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;">${data.amount} ${data.currency}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;">Reference</td>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;text-align:right;font-family:monospace;">${data.reference}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;font-size:14px;color:#64748b;">Available balance</td>
                <td style="padding:14px 20px;font-size:14px;color:#0f172a;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;">${data.balance} ${data.currency}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        If you did not authorise this transaction, please contact Zarova support immediately.
      </p>
    `;
    return this.layout(`Transaction — ${data.reference}`, body);
  }

  private buildTwoFactorHtml(firstName: string): string {
    const body = `
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;">Two-factor authentication enabled</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
        Hi ${firstName}, two-factor authentication (2FA) has been successfully enabled on your Zarova account.
        Your account is now more secure.
      </p>

      <!-- Info box -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background-color:#eff6ff;border-left:4px solid #0f4c81;border-radius:4px;margin:0 0 28px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-size:14px;color:#1e40af;line-height:1.6;">
              <strong>What this means:</strong> You will be prompted for a one-time code each time you sign in.
              Keep your authenticator app accessible.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
        If you did not make this change, please reset your password immediately and contact support.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
        <tr>
          <td style="border-radius:6px;background-color:#0f4c81;">
            <a href="https://zarova.com/settings/security"
               style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
              Review security settings
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        Thank you for keeping your Zarova account secure.
      </p>
    `;
    return this.layout('Two-factor authentication enabled', body);
  }

  private buildLoginAlertHtml(
    firstName: string,
    data: { ip: string; device: string; time: string },
  ): string {
    const body = `
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;">New sign-in detected</h1>
      <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">
        Hi ${firstName}, we noticed a new sign-in to your Zarova account. If this was you, no action is needed.
      </p>

      <!-- Sign-in detail card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 28px;">
        <tr>
          <td style="background-color:#f8fafc;padding:16px 20px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Sign-in details</span>
          </td>
        </tr>
        <tr>
          <td style="padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;">Time</td>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;text-align:right;">${data.time}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;">Device</td>
                <td style="padding:14px 20px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;text-align:right;">${data.device}</td>
              </tr>
              <tr>
                <td style="padding:14px 20px;font-size:14px;color:#64748b;">IP address</td>
                <td style="padding:14px 20px;font-size:14px;color:#0f172a;font-weight:600;text-align:right;font-family:monospace;">${data.ip}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Warning box -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background-color:#fff7ed;border-left:4px solid #f97316;border-radius:4px;margin:0 0 28px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0;font-size:14px;color:#9a3412;line-height:1.6;">
              <strong>Didn't sign in?</strong> Secure your account immediately by resetting your password.
            </p>
          </td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
        <tr>
          <td style="border-radius:6px;background-color:#dc2626;">
            <a href="https://zarova.com/auth/forgot-password"
               style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
              Secure my account
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;">
        If this sign-in was you, you can safely ignore this email.
      </p>
    `;
    return this.layout('New sign-in to your Zarova account', body);
  }
}
