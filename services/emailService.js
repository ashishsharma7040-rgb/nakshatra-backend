// services/emailService.js
// Uses Node.js built-in 'net' and 'tls' — NO external packages needed.
// Sends OTP emails via Gmail SMTP directly.

const tls = require('tls');

// In-memory OTP store
const otpStore = new Map();

function generate4Digit() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Send email via Gmail SMTP using only Node.js built-ins
function sendEmailRaw(to, subject, htmlBody) {
  return new Promise((resolve, reject) => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      return reject(new Error('EMAIL_USER and EMAIL_PASS must be set on Render.'));
    }

    const boundary = `----=_Part_${Date.now()}`;
    const message = [
      `From: "Nakshatra AI" <${user}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      `Your Nakshatra AI OTP is inside this email. Please view in HTML mode.`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      htmlBody,
      ``,
      `--${boundary}--`,
    ].join('\r\n');

    const b64user = Buffer.from(user).toString('base64');
    const b64pass = Buffer.from(pass).toString('base64');

    let step = 0;
    let buffer = '';

    const socket = tls.connect(465, 'smtp.gmail.com', { rejectUnauthorized: false }, () => {
      // connected
    });

    socket.setTimeout(15000);

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP connection timed out.'));
    });

    socket.on('error', (err) => {
      reject(new Error(`SMTP error: ${err.message}`));
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop();

      for (const line of lines) {
        const code = parseInt(line.slice(0, 3), 10);

        if (step === 0 && code === 220) {
          socket.write(`EHLO nakshatra.ai\r\n`); step = 1;
        } else if (step === 1 && (code === 250 || line.startsWith('250'))) {
          if (line.startsWith('250 ') || line.startsWith('250-SMTPUTF8')) {
            socket.write(`AUTH LOGIN\r\n`); step = 2;
          }
        } else if (step === 2 && code === 334) {
          socket.write(`${b64user}\r\n`); step = 3;
        } else if (step === 3 && code === 334) {
          socket.write(`${b64pass}\r\n`); step = 4;
        } else if (step === 4 && code === 235) {
          socket.write(`MAIL FROM:<${user}>\r\n`); step = 5;
        } else if (step === 5 && code === 250) {
          socket.write(`RCPT TO:<${to}>\r\n`); step = 6;
        } else if (step === 6 && code === 250) {
          socket.write(`DATA\r\n`); step = 7;
        } else if (step === 7 && code === 354) {
          socket.write(`${message}\r\n.\r\n`); step = 8;
        } else if (step === 8 && code === 250) {
          socket.write(`QUIT\r\n`); step = 9;
          socket.end();
          resolve(true);
        } else if (code >= 400) {
          socket.destroy();
          reject(new Error(`SMTP rejected: ${line}`));
        }
      }
    });

    socket.on('close', () => {
      if (step < 9) reject(new Error('SMTP connection closed unexpectedly.'));
    });
  });
}

async function sendOTP(email, name) {
  const otp       = generate4Digit();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  otpStore.set(email.toLowerCase().trim(), { otp, expiresAt });

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#09090f;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090f;padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0"
  style="background:#16162a;border-radius:16px;border:1px solid rgba(201,169,110,0.20);max-width:100%;">
  <tr>
    <td style="background:linear-gradient(135deg,#1a1a2e,#16162a);padding:32px;text-align:center;border-bottom:1px solid rgba(201,169,110,0.12);">
      <div style="font-size:40px;margin-bottom:8px;">&#10022;</div>
      <h1 style="color:#e8cc9a;font-size:22px;margin:0 0 4px;font-family:Georgia,serif;">Nakshatra AI</h1>
      <p style="color:rgba(232,228,218,0.45);font-size:12px;margin:0;text-transform:uppercase;letter-spacing:0.1em;">Vedic Jyotish &middot; Powered by AI</p>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <p style="color:#e8e4da;font-size:16px;line-height:1.6;margin:0 0 16px;">
        Namaste <strong style="color:#e8cc9a;">${name || 'Seeker'}</strong>,
      </p>
      <p style="color:rgba(232,228,218,0.65);font-size:15px;line-height:1.65;margin:0 0 28px;">
        Your verification code for Nakshatra AI is:
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr><td align="center">
          <div style="display:inline-block;background:rgba(201,169,110,0.10);border:2px solid #c9a96e;border-radius:14px;padding:20px 44px;text-align:center;">
            <div style="font-size:11px;color:rgba(201,169,110,0.7);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:10px;">Your OTP</div>
            <div style="font-size:44px;font-weight:700;letter-spacing:0.4em;color:#e8cc9a;font-family:'Courier New',monospace;">${otp}</div>
          </div>
        </td></tr>
      </table>
      <p style="color:rgba(232,228,218,0.50);font-size:13px;text-align:center;margin:0 0 10px;">
        Expires in <strong style="color:#c9a96e;">10 minutes</strong>
      </p>
      <p style="color:rgba(232,228,218,0.30);font-size:12px;text-align:center;margin:0;">
        If you did not request this, please ignore this email.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px;text-align:center;border-top:1px solid rgba(201,169,110,0.10);">
      <p style="color:rgba(232,228,218,0.25);font-size:11px;margin:0;text-transform:uppercase;letter-spacing:0.08em;">
        Nakshatra AI &middot; Vedic Jyotish &middot; Swiss Ephemeris &amp; Gemini AI
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  await sendEmailRaw(email, 'Your Nakshatra AI Verification Code', html);
  console.log(`✓ OTP sent to ${email}`);
  return true;
}

function verifyOTP(email, inputOtp) {
  const key    = email.toLowerCase().trim();
  const record = otpStore.get(key);

  if (!record) return { valid:false, error:'No OTP found. Please request a new one.' };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { valid:false, error:'OTP has expired. Please request a new one.' };
  }
  if (record.otp !== String(inputOtp).trim()) {
    return { valid:false, error:'Incorrect OTP. Please check your email and try again.' };
  }

  otpStore.delete(key);
  return { valid:true };
}

module.exports = { sendOTP, verifyOTP };
