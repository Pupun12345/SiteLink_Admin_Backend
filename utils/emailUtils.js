const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.generateTempPassword = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

exports.sendPasswordEmail = async (email, tempPassword) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Temporary Password - SiteLink Admin',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">SiteLink Admin Password Recovery</h2>
        <p>Your temporary password is:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 0; letter-spacing: 2px;">${tempPassword}</p>
        </div>
        <p style="color: #ef4444; font-size: 14px; font-weight: 600;">⚠️ IMPORTANT: Please change this password immediately after logging in.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">This is an automated message from SiteLink. Please do not reply to this email.</p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};
