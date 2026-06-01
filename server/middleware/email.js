const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const baseTemplate = (title, content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #0A3D62 0%, #1a6a9a 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p  { color: rgba(255,255,255,.75); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 36px 40px; color: #333; line-height: 1.7; }
    .body h2 { color: #0A3D62; font-size: 18px; margin-bottom: 8px; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .badge-green  { background: #d4f4e2; color: #1a7a45; }
    .badge-red    { background: #fde8e8; color: #b91c1c; }
    .badge-blue   { background: #dbeafe; color: #1d4ed8; }
    .detail-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; color: #111; }
    .footer { background: #f8fafc; padding: 20px 40px; text-align: center; color: #888; font-size: 12px; }
    .footer a { color: #0A3D62; text-decoration: none; }
    .cta { display: block; width: fit-content; margin: 20px auto; background: #E8A000; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🏆 UI Sports Academy</h1>
      <p>2026 Summer Sports Camp</p>
    </div>
    <div class="body">
      <h2>${title}</h2>
      ${content}
    </div>
    <div class="footer">
      <p>University of Ibadan Sports Academy | International School, UI, Ibadan</p>
      <p><a href="mailto:uisportsacademy@gmail.com">uisportsacademy@gmail.com</a> | +234 803 687 0535</p>
    </div>
  </div>
</body>
</html>`;

const templates = {
  registration_received: (data) => ({
    subject: `Application Received – ${data.form_number} | UI Sports Academy 2026`,
    html: baseTemplate('Application Received! 🎉', `
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>We have successfully received the application for <strong>${data.full_name}</strong> to participate in the 2026 UI Summer Sports Camp.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Form Number</span><span class="detail-value">${data.form_number}</span></div>
        <div class="detail-row"><span class="detail-label">Applicant</span><span class="detail-value">${data.full_name}</span></div>
        <div class="detail-row"><span class="detail-label">Sport</span><span class="detail-value">${data.sport}</span></div>
        <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${data.category}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="badge badge-blue">Pending Payment</span></div>
      </div>
      <h2>Next Step: Make Payment</h2>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Bank</span><span class="detail-value">Access Bank</span></div>
        <div class="detail-row"><span class="detail-label">Account Number</span><span class="detail-value">1805832892</span></div>
        <div class="detail-row"><span class="detail-label">Account Name</span><span class="detail-value">University of Ibadan MacArthur Grants</span></div>
        <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">₦${data.amount.toLocaleString()}</span></div>
        <div class="detail-row"><span class="detail-label">Narration</span><span class="detail-value">${data.full_name} ${data.sport}</span></div>
      </div>
      <p>After payment, log back in and upload your payment receipt to complete your application.</p>
      <p><em>Early bird discount (10%) applies for payments before 3rd July 2026.</em></p>
    `)
  }),

  payment_submitted: (data) => ({
    subject: `Payment Receipt Received – ${data.form_number}`,
    html: baseTemplate('Payment Receipt Received', `
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>We have received your payment receipt for <strong>${data.full_name}</strong>. Our team will verify your payment within 24 hours.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Form Number</span><span class="detail-value">${data.form_number}</span></div>
        <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">₦${data.amount.toLocaleString()}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="badge badge-blue">Under Review</span></div>
      </div>
      <p>You will receive an email once your payment has been verified.</p>
    `)
  }),

  payment_verified: (data) => ({
    subject: `Payment Verified ✅ – ${data.form_number} | UI Sports Academy`,
    html: baseTemplate('Payment Verified! ✅', `
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>Great news! Your payment for <strong>${data.full_name}</strong>'s application has been verified.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Form Number</span><span class="detail-value">${data.form_number}</span></div>
        <div class="detail-row"><span class="detail-label">Amount Verified</span><span class="detail-value">₦${data.amount.toLocaleString()}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="badge badge-green">Verified</span></div>
      </div>
      <p>Your application is now being reviewed by our team. You will receive your admission decision before the camp start date.</p>
    `)
  }),

  admitted: (data) => ({
    subject: `🏆 Congratulations! Admitted to 2026 UI Summer Sports Camp`,
    html: baseTemplate('Congratulations! You\'re Admitted! 🏆', `
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>We are thrilled to inform you that <strong>${data.full_name}</strong> has been <strong>officially admitted</strong> to the 2026 UI Summer Sports Camp!</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Form Number</span><span class="detail-value">${data.form_number}</span></div>
        <div class="detail-row"><span class="detail-label">Sport</span><span class="detail-value">${data.sport}</span></div>
        <div class="detail-row"><span class="detail-label">Camp Dates</span><span class="detail-value">August 3 – 28, 2026</span></div>
        <div class="detail-row"><span class="detail-label">Venue</span><span class="detail-value">International School, UI, Ibadan</span></div>
        ${data.group ? `<div class="detail-row"><span class="detail-label">Group</span><span class="detail-value">${data.group}</span></div>` : ''}
        ${data.room ? `<div class="detail-row"><span class="detail-label">Room</span><span class="detail-value">${data.room}</span></div>` : ''}
        ${data.coach ? `<div class="detail-row"><span class="detail-label">Coach</span><span class="detail-value">${data.coach}</span></div>` : ''}
      </div>
      <p>Please arrive on <strong>Monday, August 3, 2026</strong> between 7:00 AM – 9:00 AM. Bring your admission letter, all required documents, and sporting gear.</p>
      <p><em>…Developing Champions in Sports & Character</em></p>
    `)
  }),

  rejected: (data) => ({
    subject: `Application Update – ${data.form_number} | UI Sports Academy`,
    html: baseTemplate('Application Status Update', `
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>We regret to inform you that the application for <strong>${data.full_name}</strong> could not be processed at this time.</p>
      ${data.reason ? `<div class="detail-box"><p><strong>Reason:</strong> ${data.reason}</p></div>` : ''}
      <p>For questions, please contact us at <a href="mailto:uisportsacademy@gmail.com">uisportsacademy@gmail.com</a> or call 08036870535.</p>
    `)
  }),
};

const sendEmail = async (to, templateKey, data) => {
  try {
    const { subject, html } = templates[templateKey](data);
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"UI Sports Academy" <uisportsacademy@gmail.com>',
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
};

module.exports = { sendEmail };
