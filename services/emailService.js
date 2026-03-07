// services/emailService.js
// Uses Resend API (HTTPS) — works on Render free tier
// SMTP is blocked on Render free tier, Resend uses HTTPS which is never blocked

const https = require('https');

const otpStore = new Map();

function generate4Digit() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function sendViaResend(apiKey, to, subject, html) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from:    'Nakshatra AI <onboarding@resend.dev>',
      to:      [to],
      subject: subject,
      html:    html,
    });

    const options = {
      hostname: 'api.resend.com',
      port:     443,
      path:     '/emails',
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(true);
        } else {
          try {
            const parsed = JSON.parse(data);
            reject(new Error(`Resend error: ${parsed.message || data}`));
          } catch {
            reject(new Error(`Resend HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', err => reject(new Error(`Network error: ${err.message}`)));
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

async function sendOTP(email, name) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY must be set on Render. Get free key at resend.com');
  }

  const otp       = generate4Digit();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  otpStore.set(email.toLowerCase().trim(), { otp, expiresAt });

  console.log(`Sending OTP to ${email}...`);

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#09090f;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09090f;padding:40px 20px;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0"
  style="background:#16162a;border-radius:16px;border:1px solid rgba(201,169,110,0.20);max-width:100%;">
  <tr>
    <td style="background:linear-gradient(135deg,#1a1a2e,#16162a);padding:32px;text-align:center;border-bottom:1px solid rgba(201,169,110,0.12);">
      <div style="font-size:36px;margin-bottom:8px;">&#10022;</div>
      <h1 style="color:#e8cc9a;font-size:22px;margin:0 0 4px;font-family:Georgia,serif;">Nakshatra AI</h1>
      <p style="color:rgba(232,228,218,0.45);font-size:12px;margin:0;text-transform:uppercase;letter-spacing:0.1em;">Vedic Jyotish · Powered by AI</p>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <p style="color:#e8e4da;font-size:16px;line-height:1.6;margin:0 0 16px;">
        Namaste <strong style="color:#e8cc9a;">${name || 'Seeker'}</strong>,
      </p>
      <p style="color:rgba(232,228,218,0.65);font-size:15px;line-height:1.65;margin:0 0 24px;">
        Your verification code for Nakshatra AI is:
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td align="center">
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:rgba(201,169,110,0.10);border:2px solid #c9a96e;border-radius:14px;padding:20px 48px;text-align:center;">
              <div style="font-size:11px;color:rgba(201,169,110,0.7);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:10px;">ONE TIME PASSWORD</div>
              <div style="font-size:48px;font-weight:700;letter-spacing:0.5em;color:#e8cc9a;font-family:'Courier New',monospace;">${otp}</div>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <p style="color:rgba(232,228,218,0.50);font-size:13px;text-align:center;margin:0 0 10px;">
        Expires in <strong style="color:#c9a96e;">10 minutes</strong>
      </p>
      <p style="color:rgba(232,228,218,0.28);font-size:12px;text-align:center;margin:0;">
        If you did not request this, please ignore this email.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 32px;text-align:center;border-top:1px solid rgba(201,169,110,0.10);">
      <p style="color:rgba(232,228,218,0.22);font-size:11px;margin:0;text-transform:uppercase;letter-spacing:0.08em;">
        Nakshatra AI · Vedic Jyotish · Gemini AI
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  await sendViaResend(apiKey, email, 'Your Nakshatra AI Verification Code', html);
  console.log(`✓ OTP sent successfully to ${email}`);
  return true;
}

function verifyOTP(email, inputOtp) {
  const key    = email.toLowerCase().trim();
  const record = otpStore.get(key);

  if (!record) {
    return { valid:false, error:'No OTP found. Please click Get OTP again.' };
  }
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { valid:false, error:'OTP has expired. Please click Get OTP again.' };
  }
  if (record.otp !== String(inputOtp).trim()) {
    return { valid:false, error:'Incorrect OTP. Please check your email and try again.' };
  }

  otpStore.delete(key);
  return { valid:true };
}

module.exports = { sendOTP, verifyOTP };
