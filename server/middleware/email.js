const nodemailer = require('nodemailer');
const pool = require('../db/pool');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

const baseTemplate = (title, content) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; border: 1px solid #e1e8ed; }
    .header { background-color: #0A3D62; padding: 30px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
    .body { padding: 40px; color: #333333; line-height: 1.6; }
    .body h2 { color: #0A3D62; font-size: 20px; margin-top: 0; }
    .detail-box { background-color: #f8fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 15px; margin: 20px 0; }
    .detail-row { border-bottom: 1px solid #edf2f7; padding: 8px 0; font-size: 14px; display: table; width: 100%; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { display: table-cell; color: #718096; width: 50%; }
    .detail-value { display: table-cell; font-weight: 700; color: #2d3748; text-align: right; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .badge-blue { background-color: #ebf8ff; color: #3182ce; }
    .footer { padding: 20px; text-align: center; color: #a0aec0; font-size: 12px; background-color: #f7fafc; }
    .footer p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>UI SPORTS ACADEMY</h1>
    </div>
    <div class="body">
      <h2>${title}</h2>
      ${content}
    </div>
    <div class="footer">
      <p>&copy; 2026 University of Ibadan Sports Academy</p>
      <p>Ibadan, Nigeria | +234 803 687 0535</p>
    </div>
  </div>
</body>
</html>`;

const textFallbacks = {
  registration_received: (data) => `Application Received: ${data.form_number}. Dear ${data.guardian_name}, we have received the application for ${data.full_name}. Next Step: Please pay ₦${(data.amount||0).toLocaleString()} to Access Bank 1805832892.`,
  payment_submitted: (data) => `Receipt Received: ${data.form_number}. Dear ${data.guardian_name}, we have received your receipt for ${data.full_name}. Verification is in progress.`,
  payment_verified: (data) => `Payment Verified: ${data.form_number}. Dear ${data.guardian_name}, the payment for ${data.full_name} has been verified. Welcome!`,
  admitted: (data) => `Admission Offer: ${data.full_name}. Congratulations! You have been admitted to the UI Sports Academy Summer Camp 2026.`,
};

const templates = {
  registration_received: (data) => ({
    subject: `Application Received – ${data.form_number} | UI Sports Academy`,
    html: baseTemplate('Registration Received', `
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>We've received the application for <strong>${data.full_name}</strong>.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Form Number</span><span class="detail-value">${data.form_number}</span></div>
        <div class="detail-row"><span class="detail-label">Sport</span><span class="detail-value">${data.sport}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${data.category}</span></div>
      </div>
      <p><strong>Next Step:</strong> Please make a payment of <strong>₦${(data.amount||0).toLocaleString()}</strong> to the account below:</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Bank</span><span class="detail-value">Access Bank</span></div>
        <div class="detail-row"><span class="detail-label">Account</span><span class="detail-value">1805832892</span></div>
        <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">UI MacArthur Grants</span></div>
      </div>
    `)
  }),
  payment_submitted: (data) => ({
    subject: `Receipt Received – ${data.form_number}`,
    html: baseTemplate('Receipt Under Review', `
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>We have received your payment receipt for <strong>${data.full_name}</strong>.</p>
      <p>Verification is in progress. You will be notified once complete.</p>
    `)
  }),
  payment_verified: (data) => ({
    subject: `Payment Verified ✅ – ${data.form_number}`,
    html: baseTemplate('Payment Verified', `
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>The payment for <strong>${data.full_name}</strong> has been successfully verified.</p>
      <p>Welcome to the 2026 Summer Camp!</p>
    `)
  }),
  admitted: (data) => ({
    subject: `Official Admission Offer – ${data.full_name} | UI Sports Academy`,
    html: baseTemplate('Congratulations! Admission Offered 🏆', `
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>We are delighted to inform you that <strong>${data.full_name}</strong> has been offered admission to the 2026 Summer Camp.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Form Number</span><span class="detail-value">${data.form_number}</span></div>
        <div class="detail-row"><span class="detail-label">Sport</span><span class="detail-value">${data.sport}</span></div>
      </div>
    `)
  }),
};

async function sendEmail(to, type, data, applicantId = null, adminId = null) {
  const template = templates[type];
  if (!template) return;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"UI Sports Academy" <uisportsacademy@gmail.com>',
    to,
    subject: template(data).subject,
    html: template(data).html,
    text: textFallbacks[type] ? textFallbacks[type](data) : template(data).subject,
    headers: {
      'Precedence': 'bulk',
      'X-Auto-Response-Suppress': 'OOF, AutoReply'
    }
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${type} to ${to} (${info.messageId})`);

    if (applicantId && pool) {
      await pool.query(
        "INSERT INTO email_logs (applicant_id, email_type, recipient, sent_by, status) VALUES (?, ?, ?, ?, ?)",
        [applicantId, type, to, adminId, 'Sent']
      );
    }
    return info;
  } catch (error) {
    console.error(`Email error (${type}):`, error.message);
    if (applicantId && pool) {
      await pool.query(
        "INSERT INTO email_logs (applicant_id, email_type, recipient, sent_by, status) VALUES (?, ?, ?, ?, ?)",
        [applicantId, type, to, adminId, 'Failed: ' + error.message.slice(0, 50)]
      );
    }
    throw error;
  }
}

module.exports = { sendEmail };
