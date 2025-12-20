/**
 * Street Legacy - Email Service
 *
 * Handles email verification and transactional emails.
 * Supports multiple providers: Resend (recommended), SendGrid, or SMTP.
 *
 * For development: emails are logged to console if no provider is configured.
 */

import crypto from 'crypto';

// Email configuration from environment
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console'; // 'resend', 'sendgrid', 'smtp', or 'console'
const EMAIL_FROM = process.env.EMAIL_FROM || 'Street Legacy <noreply@streetlegacy.game>';
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';

// Provider-specific config
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// SMTP config (for providers like Mailgun, Amazon SES, etc.)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

/**
 * Generate a secure random verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Email template for verification
 */
function getVerificationEmailTemplate(username: string, verificationUrl: string): { subject: string; text: string; html: string } {
  const subject = '[Street Legacy] Verify your email address';

  const text = `
STREET LEGACY - EMAIL VERIFICATION
===================================

Operator ${username},

Your registration request has been received.

To activate your account and access the Grid, verify your email:

${verificationUrl}

This link expires in 24 hours.

If you did not register for Street Legacy, ignore this message.

--
Street Legacy Operations
Sector ON-0 | Toronto Grid
© 2091 HydraNet Systems
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - Street Legacy</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0a0a0a;
      font-family: 'Courier New', Courier, monospace;
      color: #00ff00;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      border-bottom: 1px solid #00ff00;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #00ff00;
      font-size: 24px;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 4px;
    }
    .header .tagline {
      color: #666;
      font-size: 12px;
      margin-top: 8px;
    }
    .content {
      background-color: #111;
      border: 1px solid #333;
      padding: 30px;
      margin-bottom: 30px;
    }
    .greeting {
      color: #00ff00;
      font-size: 16px;
      margin-bottom: 20px;
    }
    .message {
      color: #ccc;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .verify-button {
      display: inline-block;
      background-color: #00ff00;
      color: #000;
      padding: 15px 40px;
      text-decoration: none;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-size: 14px;
    }
    .verify-button:hover {
      background-color: #00cc00;
    }
    .link-fallback {
      color: #666;
      font-size: 11px;
      word-break: break-all;
      margin-top: 20px;
    }
    .warning {
      color: #ff6600;
      font-size: 12px;
      border-left: 3px solid #ff6600;
      padding-left: 15px;
      margin-top: 20px;
    }
    .footer {
      text-align: center;
      color: #444;
      font-size: 11px;
      border-top: 1px solid #333;
      padding-top: 20px;
    }
    .footer .logo {
      color: #00ff00;
      font-size: 14px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Street Legacy</h1>
      <div class="tagline">// OPERATOR REGISTRATION //</div>
    </div>

    <div class="content">
      <div class="greeting">&gt; INCOMING TRANSMISSION</div>
      <div class="greeting">Operator <span style="color: #fff;">${username}</span>,</div>

      <div class="message">
        Your registration request has been logged in the system.<br><br>
        To activate your account and gain access to the Grid, you must verify your email address.
      </div>

      <div class="button-container">
        <a href="${verificationUrl}" class="verify-button">[ VERIFY EMAIL ]</a>
      </div>

      <div class="link-fallback">
        If the button doesn't work, copy this link:<br>
        <span style="color: #00ff00;">${verificationUrl}</span>
      </div>

      <div class="warning">
        ⚠ This verification link expires in 24 hours.<br>
        ⚠ If you did not register for Street Legacy, disregard this transmission.
      </div>
    </div>

    <div class="footer">
      <div class="logo">◆ STREET LEGACY ◆</div>
      Sector ON-0 | Toronto Grid<br>
      © 2091 HydraNet Systems
    </div>
  </div>
</body>
</html>
`;

  return { subject, text, html };
}

/**
 * Send email via Resend API
 */
async function sendViaResend(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('[Email] Resend API key not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        text,
        html
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Email] Resend error:', error);
      return false;
    }

    const result = await response.json();
    console.log('[Email] Sent via Resend:', result.id);
    return true;
  } catch (error) {
    console.error('[Email] Resend exception:', error);
    return false;
  }
}

/**
 * Send email via SendGrid API
 */
async function sendViaSendGrid(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.error('[Email] SendGrid API key not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: EMAIL_FROM.match(/<(.+)>/)?.[1] || EMAIL_FROM },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Email] SendGrid error:', error);
      return false;
    }

    console.log('[Email] Sent via SendGrid');
    return true;
  } catch (error) {
    console.error('[Email] SendGrid exception:', error);
    return false;
  }
}

/**
 * Log email to console (development mode)
 */
function logToConsole(to: string, subject: string, text: string): boolean {
  console.log('\n' + '='.repeat(60));
  console.log('[Email] DEVELOPMENT MODE - Email not sent');
  console.log('='.repeat(60));
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('-'.repeat(60));
  console.log(text);
  console.log('='.repeat(60) + '\n');
  return true;
}

/**
 * Send an email using the configured provider
 */
async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  switch (EMAIL_PROVIDER.toLowerCase()) {
    case 'resend':
      return sendViaResend(to, subject, text, html);
    case 'sendgrid':
      return sendViaSendGrid(to, subject, text, html);
    case 'console':
    default:
      return logToConsole(to, subject, text);
  }
}

/**
 * Send verification email to a new user
 */
export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const verificationUrl = `${SITE_URL}/verify-email?token=${token}`;
  const { subject, text, html } = getVerificationEmailTemplate(username, verificationUrl);

  try {
    const sent = await sendEmail(email, subject, text, html);

    if (!sent) {
      return { success: false, error: 'Failed to send verification email' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Email] Failed to send verification email:', error);
    return { success: false, error: error.message || 'Email service error' };
  }
}

/**
 * Email template for password reset
 */
function getPasswordResetEmailTemplate(username: string, resetUrl: string): { subject: string; text: string; html: string } {
  const subject = '[Street Legacy] Password Reset Request';

  const text = `
STREET LEGACY - PASSWORD RESET
==============================

Operator ${username},

A password reset has been requested for your account.

To reset your password, use this link:

${resetUrl}

This link expires in 1 hour.

If you did not request this reset, ignore this message.
Your password will remain unchanged.

--
Street Legacy Operations
Sector ON-0 | Toronto Grid
© 2091 HydraNet Systems
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - Street Legacy</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0a0a0a;
      font-family: 'Courier New', Courier, monospace;
      color: #00ff00;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      border-bottom: 1px solid #ff6600;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #ff6600;
      font-size: 24px;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 4px;
    }
    .header .tagline {
      color: #666;
      font-size: 12px;
      margin-top: 8px;
    }
    .content {
      background-color: #111;
      border: 1px solid #333;
      padding: 30px;
      margin-bottom: 30px;
    }
    .greeting {
      color: #ff6600;
      font-size: 16px;
      margin-bottom: 20px;
    }
    .message {
      color: #ccc;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .reset-button {
      display: inline-block;
      background-color: #ff6600;
      color: #000;
      padding: 15px 40px;
      text-decoration: none;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-size: 14px;
    }
    .link-fallback {
      color: #666;
      font-size: 11px;
      word-break: break-all;
      margin-top: 20px;
    }
    .warning {
      color: #ff4444;
      font-size: 12px;
      border-left: 3px solid #ff4444;
      padding-left: 15px;
      margin-top: 20px;
    }
    .footer {
      text-align: center;
      color: #444;
      font-size: 11px;
      border-top: 1px solid #333;
      padding-top: 20px;
    }
    .footer .logo {
      color: #00ff00;
      font-size: 14px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Street Legacy</h1>
      <div class="tagline">// PASSWORD RESET REQUEST //</div>
    </div>

    <div class="content">
      <div class="greeting">&gt; SECURITY ALERT</div>
      <div class="greeting">Operator <span style="color: #fff;">${username}</span>,</div>

      <div class="message">
        A password reset has been requested for your account.<br><br>
        If you initiated this request, click the button below to create a new password.
      </div>

      <div class="button-container">
        <a href="${resetUrl}" class="reset-button">[ RESET PASSWORD ]</a>
      </div>

      <div class="link-fallback">
        If the button doesn't work, copy this link:<br>
        <span style="color: #ff6600;">${resetUrl}</span>
      </div>

      <div class="warning">
        ⚠ This link expires in 1 hour.<br>
        ⚠ If you did not request this reset, ignore this message.<br>
        ⚠ Your password will remain unchanged.
      </div>
    </div>

    <div class="footer">
      <div class="logo">◆ STREET LEGACY ◆</div>
      Sector ON-0 | Toronto Grid<br>
      © 2091 HydraNet Systems
    </div>
  </div>
</body>
</html>
`;

  return { subject, text, html };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  username: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
  const { subject, text, html } = getPasswordResetEmailTemplate(username, resetUrl);

  try {
    const sent = await sendEmail(email, subject, text, html);

    if (!sent) {
      return { success: false, error: 'Failed to send password reset email' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Email] Failed to send password reset email:', error);
    return { success: false, error: error.message || 'Email service error' };
  }
}

/**
 * Send a welcome email after verification
 */
export async function sendWelcomeEmail(email: string, username: string): Promise<boolean> {
  const subject = '[Street Legacy] Welcome to the Grid, Operator';

  const text = `
STREET LEGACY - ACCOUNT ACTIVATED
==================================

Welcome, Operator ${username}.

Your account has been verified and activated.

You now have full access to the Toronto Grid.

Login and begin your operations:
${SITE_URL}

--
Street Legacy Operations
Sector ON-0 | Toronto Grid
© 2091 HydraNet Systems
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { background: #0a0a0a; color: #00ff00; font-family: 'Courier New', monospace; padding: 40px; }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { color: #00ff00; letter-spacing: 4px; }
    .button { display: inline-block; background: #00ff00; color: #000; padding: 15px 40px; text-decoration: none; font-weight: bold; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>◆ STREET LEGACY ◆</h1>
    <p>Welcome, Operator <strong>${username}</strong>.</p>
    <p>Your account has been verified and activated.</p>
    <p>You now have full access to the Toronto Grid.</p>
    <a href="${SITE_URL}" class="button">[ ENTER THE GRID ]</a>
    <hr style="border-color: #333; margin: 30px 0;">
    <p style="color: #444; font-size: 11px;">
      Street Legacy Operations<br>
      Sector ON-0 | Toronto Grid<br>
      © 2091 HydraNet Systems
    </p>
  </div>
</body>
</html>
`;

  return sendEmail(email, subject, text, html);
}

export default {
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
