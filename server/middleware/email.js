const nodemailer = require('nodemailer');
const crypto = require('crypto');
const pool = require('../db/pool');

// Build a signed URL to the printable admission letter page.
// The HMAC prevents link tampering; no expiry is needed since letters are permanent.
const buildLetterUrl = (formNumber) => {
  // SERVER_URL = API base (e.g. http://localhost:5000 locally, https://uisa-camp.vercel.app in prod)
  // Falls back to CLIENT_URL for single-domain deployments (Vercel) where both are the same.
  const base = (process.env.SERVER_URL || process.env.CLIENT_URL || 'http://localhost:5000').replace(/\/$/, '');
  const sig  = crypto.createHmac('sha256', process.env.JWT_SECRET || 'uisa_dev_secret')
                     .update(formNumber)
                     .digest('hex');
  return `${base}/api/applicants/letter?form=${encodeURIComponent(formNumber)}&sig=${sig}`;
};

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 465,
  secure: parseInt(process.env.SMTP_PORT) === 465 || !process.env.SMTP_PORT, // true for port 465 (SSL)
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
    .badge-green { background-color: #f0fff4; color: #38a169; }
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
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Official Admission Offer - ${data.form_number}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; margin: 0; background: #f4f7f9; color: #111827; }
    .page { max-width: 720px; margin: 30px auto; background: #fff; border: 1px solid #e1e8ed; border-radius: 8px; overflow: hidden; }
    .header { background: #0A3D62; padding: 28px 36px; }
    .header-org { color: #fff; font-family: Arial, sans-serif; font-weight: 800; font-size: 20px; }
    .header-sub { color: rgba(255,255,255,0.7); font-family: Arial, sans-serif; font-size: 13px; margin-top: 4px; }
    .body { padding: 36px; }
    h1 { font-family: Arial, sans-serif; color: #0A3D62; font-size: 22px; margin: 0 0 20px; }
    h2 { font-family: Arial, sans-serif; color: #0A3D62; font-size: 16px; margin: 24px 0 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    p { font-size: 15px; line-height: 1.7; margin: 0 0 14px; }
    .info { margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .row { display: table; width: 100%; border-bottom: 1px solid #e5e7eb; }
    .row:last-child { border-bottom: 0; }
    .lbl { display: table-cell; width: 45%; padding: 10px 14px; background: #f9fafb; font-family: Arial, sans-serif; font-weight: 700; font-size: 13px; color: #374151; }
    .val { display: table-cell; padding: 10px 14px; font-family: Arial, sans-serif; font-size: 13px; color: #111827; }
    .badge-green { display: inline-block; background: #f0fff4; color: #16a34a; font-weight: 700; padding: 2px 10px; border-radius: 9999px; font-size: 12px; }
    .checklist { margin: 8px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.8; }
    .sign { margin-top: 36px; border-top: 1px solid #d1d5db; padding-top: 10px; font-family: Arial, sans-serif; font-size: 14px; color: #374151; }
    .footer { padding: 16px 36px; text-align: center; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .print-btn-wrap { text-align: center; margin: 28px 0 8px; }
      .print-btn { display: inline-block; background: #0A3D62; color: #fff; font-family: Arial, sans-serif; font-weight: 700; font-size: 14px; padding: 12px 32px; border-radius: 6px; text-decoration: none; cursor: pointer; letter-spacing: .3px; }
    .print-btn:hover { background: #0c4e7a; }
    @media print {
      body { background: #fff; }
      .page { margin: 0; border: none; border-radius: 0; box-shadow: none; }
      .print-btn-wrap { display: none; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-org">UNIVERSITY OF IBADAN SPORTS ACADEMY</div>
      <div class="header-sub">Official Admission Offer · 2026 Summer Sports Camp</div>
    </div>
    <div class="body">
      <h1>Congratulations! Admission Offered 🏆</h1>
      <p>Dear <strong>${data.guardian_name}</strong>,</p>
      <p>We are delighted to inform you that <strong>${data.full_name}</strong> has been offered admission into the 2026 University of Ibadan Sports Academy Summer Camp.</p>
      <p>Following the successful review of the application and verification of all required documentation, the applicant has been selected to participate in this year's camp programme. This admission reflects our confidence in the applicant's potential and our commitment to supporting the development of young athletes in both sports performance and character.</p>

      <div class="info">
        <div class="row"><div class="lbl">Form Number</div><div class="val">${data.form_number}</div></div>
        <div class="row"><div class="lbl">Participant</div><div class="val">${data.full_name}</div></div>
        <div class="row"><div class="lbl">Sport</div><div class="val">${data.sport}</div></div>
        <div class="row"><div class="lbl">Camp Period</div><div class="val">August 3 – Aug 28, 2026</div></div>
        <div class="row"><div class="lbl">Venue</div><div class="val">International School, Univ. of Ibadan</div></div>
        <div class="row"><div class="lbl">Training Group</div><div class="val">${data.group_assigned || 'TBA'}</div></div>
        <div class="row"><div class="lbl">Assigned Coach</div><div class="val">${data.coach_assigned || 'TBA'}</div></div>
        <div class="row"><div class="lbl">Accommodation</div><div class="val">${data.room_number || 'TBA'}</div></div>
        <div class="row"><div class="lbl">Admission Status</div><div class="val"><span class="badge-green">Admitted</span></div></div>
      </div>

      <h2>Arrival Information</h2>
      <p>Participants are expected to arrive on <strong>Monday, August 3, 2026</strong> between 7:00 AM and 9:00 AM for registration, orientation, and camp allocation.</p>

      <div class="info">
        <div class="row"><div class="lbl" colspan="2" style="width:100%;font-size:13px;font-weight:700;">Please come along with:</div></div>
        <div class="row"><div class="val" style="padding:10px 14px;">
          <ul class="checklist">
            <li>Printed official admission letter</li>
            <li>Proof of payment</li>
            <li>Medical information (if applicable)</li>
            <li>Any sport-specific equipment required</li>
          </ul>
        </div></div>
      </div>

      <h2>Important Notice</h2>
      <p>This admission is valid for the 2026 Summer Camp session only. Participants are expected to comply with all camp rules, safety regulations, and the code of conduct throughout the programme.</p>
      <p>We look forward to welcoming <strong>${data.full_name}</strong> to an exciting month of learning, competition, teamwork, discipline, and personal development.</p>
      <p style="font-style:italic;color:#0A3D62;font-weight:700;">Developing Champions in Sports and Character.</p>

      <div class="sign">Camp Director</div>

      <div class="print-btn-wrap">
        <button onclick="downloadAsPDF()" class="print-btn">⬇ Save / Print as PDF</button>
      </div>
      
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <script>
        function downloadAsPDF() {
          const element = document.querySelector('.page');
          const opt = {
            margin:       0,
            filename:     'Admission-Letter-${data.form_number.replace(/[^A-Za-z0-9-]/g, '-')}.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };
          
          // Hide the button before generating PDF
          const btnWrap = document.querySelector('.print-btn-wrap');
          btnWrap.style.display = 'none';
          
          html2pdf().set(opt).from(element).save().then(() => {
            // Show the button again after PDF is generated
            btnWrap.style.display = 'block';
          });
        }
      </script>
    </div>
    <div class="footer">
      <p>&copy; 2026 University of Ibadan Sports Academy</p>
      <p>Ibadan, Nigeria | +234 803 687 0535</p>
    </div>
  </div>
</body>
</html>`
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
