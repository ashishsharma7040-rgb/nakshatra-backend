// services/emailService.js
// Sends OTP emails using nodemailer with Gmail or any SMTP provider

const nodemailer = require('nodemailer');

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = new Map();

function generateOTP() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit OTP
}

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set in Render environment variables.');
  }
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Use Gmail App Password, not your real password
    },
  });
}

async function sendOTP(email, name) {
  const otp       = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store OTP
  otpStore.set(email.toLowerCase(), { otp, expiresAt });

  const transporter = getTransporter();

  const mailOptions = {
    from: `"Nakshatra AI ✦" <${process.env.EMAIL_USER}>`,
    to:   email,
    subject: 'Your Nakshatra AI Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#09090f;font-family:'Georgia',serif;">
        <div style="max-width:480px;margin:40px auto;background:#16162a;border-radius:16px;overflow:hidden;border:1px solid rgba(201,169,110,0.2);">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#1a1a2e,#16162a);padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(201,169,110,0.15);">
            <div style="font-size:36px;margin-bottom:8px;">✦</div>
            <h1 style="color:#e8cc9a;font-size:22px;margin:0;letter-spacing:0.05em;">Nakshatra AI</h1>
            <p style="color:rgba(232,228,218,0.5);font-size:13px;margin:6px 0 0;">Vedic Jyotish · Powered by AI</p>
          </div>

          <!-- Body -->
          <div style="padding:32px;">
            <p style="color:#e8e4da;font-size:16px;line-height:1.6;margin:0 0 20px;">
              Namaste <strong>${name || 'Seeker'}</strong>,
            </p>
            <p style="color:rgba(232,228,218,0.7);font-size:15px;line-height:1.6;margin:0 0 28px;">
              Your verification code for Nakshatra AI is:
            </p>

            <!-- OTP Box -->
            <div style="text-align:center;margin:0 0 28px;">
              <div style="display:inline-block;background:linear-gradient(135deg,rgba(201,169,110,0.15),rgba(201,169,110,0.05));border:2px solid #c9a96e;border-radius:12px;padding:18px 40px;">
                <span style="font-size:40px;font-weight:700;letter-spacing:0.3em;color:#e8cc9a;font-family:monospace;">${otp}</span>
              </div>
            </div>

            <p style="color:rgba(232,228,218,0.5);font-size:13px;line-height:1.6;margin:0 0 16px;text-align:center;">
              This code expires in <strong style="color:#c9a96e;">10 minutes</strong>
            </p>
            <p style="color:rgba(232,228,218,0.4);font-size:12px;line-height:1.6;margin:0;text-align:center;">
              If you did not request this, please ignore this email.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding:20px 32px;border-top:1px solid rgba(201,169,110,0.1);text-align:center;">
            <p style="color:rgba(232,228,218,0.3);font-size:11px;margin:0;letter-spacing:0.06em;text-transform:uppercase;">
              Powered by Swiss Ephemeris · Gemini AI
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`✓ OTP sent to ${email}`);
  return true;
}

function verifyOTP(email, otp) {
  const key    = email.toLowerCase();
  const record = otpStore.get(key);
  if (!record)                      return { valid:false, error:'No OTP found. Please request a new one.' };
  if (Date.now() > record.expiresAt) { otpStore.delete(key); return { valid:false, error:'OTP has expired. Please request a new one.' }; }
  if (record.otp !== String(otp).trim()) return { valid:false, error:'Incorrect OTP. Please try again.' };
  otpStore.delete(key); // used up
  return { valid:true };
}

module.exports = { sendOTP, verifyOTP };
