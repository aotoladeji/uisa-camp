import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search, CheckCircle, Clock, XCircle, AlertCircle, ArrowRight, FileText, Printer } from 'lucide-react';
import api from '../utils/api';
import BrandLogo from '../components/BrandLogo';

const STATUS_CONFIG = {
  'Pending':            { color: 'var(--amber)',   bg: 'var(--amber-bg)',  icon: Clock,         label: 'Pending Payment' },
  'Payment Submitted':  { color: '#7C3AED',        bg: '#EDE9FE',          icon: Clock,         label: 'Payment Under Review' },
  'Payment Verified':   { color: 'var(--blue)',    bg: '#DBEAFE',          icon: CheckCircle,   label: 'Payment Verified' },
  'Medical Cleared':    { color: '#065F46',        bg: '#D1FAE5',          icon: CheckCircle,   label: 'Medical Cleared' },
  'Admitted':           { color: 'var(--green)',   bg: 'var(--green-bg)',  icon: CheckCircle,   label: 'Admitted' },
  'Rejected':           { color: 'var(--red)',     bg: 'var(--red-bg)',    icon: XCircle,       label: 'Not Admitted' },
};

const TIMELINE = [
  { key: 'registered',       label: 'Application Submitted' },
  { key: 'payment',          label: 'Payment Submitted' },
  { key: 'payment_verified', label: 'Payment Verified' },
  { key: 'medical',          label: 'Medical Cleared' },
  { key: 'admitted',         label: 'Admitted' },
];

function getTimelineStep(status) {
  switch(status) {
    case 'Pending':           return 0;
    case 'Payment Submitted': return 1;
    case 'Payment Verified':  return 2;
    case 'Medical Cleared':   return 3;
    case 'Admitted':          return 4;
    default:                  return 0;
  }
}

export default function StatusPage() {
  const [form, setForm]     = useState({ email: '', phone: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSearch = async e => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const { data } = await api.get('/applicants/lookup', {
        params: { email: form.email.trim(), phone: form.phone.trim() }
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Application not found. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? (STATUS_CONFIG[result.status] || STATUS_CONFIG['Pending']) : null;
  const StatusIcon = cfg?.icon;
  const timelineStep = result ? getTimelineStep(result.status) : 0;
  const isRejected = result?.status === 'Rejected';

  const buildAdmissionLetterHtml = (app) => {
    const fullName = `${app.first_name || ''} ${app.surname || ''}`.trim();
    const generatedDate = new Date().toLocaleDateString('en-GB');
    const sport = app.sport_selection || 'N/A';
    const formNumber = app.form_number || 'N/A';
    const category = app.age_category || 'N/A';

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admission Letter - ${formNumber}</title>
    <style>
      body { font-family: Georgia, 'Times New Roman', serif; margin: 0; color: #111827; background: #ffffff; }
      .page { max-width: 860px; margin: 0 auto; padding: 42px 48px 56px; }
      .head { border-bottom: 2px solid #0B2E63; padding-bottom: 14px; margin-bottom: 24px; }
      .camp { font-family: Arial, sans-serif; color: #0B2E63; font-weight: 800; font-size: 22px; letter-spacing: .3px; }
      .meta { margin-top: 6px; font-family: Arial, sans-serif; color: #334155; font-size: 13px; }
      h1 { font-family: Arial, sans-serif; color: #0B2E63; font-size: 24px; margin: 0 0 14px; }
      p { font-size: 16px; line-height: 1.6; margin: 0 0 14px; }
      .info { margin: 18px 0 22px; border: 1px solid #D1D5DB; border-radius: 8px; overflow: hidden; }
      .row { display: grid; grid-template-columns: 220px 1fr; }
      .row > div { padding: 11px 14px; border-bottom: 1px solid #E5E7EB; font-size: 14px; }
      .row:last-child > div { border-bottom: 0; }
      .label { background: #F8FAFC; font-family: Arial, sans-serif; font-weight: 700; color: #1F2937; }
      .value { font-family: Arial, sans-serif; color: #111827; }
      .sign { margin-top: 40px; }
      .line { width: 230px; border-top: 1px solid #111827; margin-top: 40px; }
      .foot { margin-top: 24px; font-size: 12px; color: #6B7280; font-family: Arial, sans-serif; }
      @media print { .page { padding: 24px 30px; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="head">
        <div class="camp">UNIVERSITY OF IBADAN SPORTS ACADEMY</div>
        <div class="meta">Official Admission Letter · 2026 Summer Sports Camp</div>
      </div>

      <h1>Offer of Provisional Admission</h1>

      <p>Date: <strong>${generatedDate}</strong></p>
      <p>Dear Parent/Guardian,</p>
      <p>
        We are pleased to inform you that <strong>${fullName}</strong> has been offered provisional admission into the
        University of Ibadan Sports Academy 2026 Summer Sports Camp.
      </p>

      <div class="info">
        <div class="row"><div class="label">Applicant Name</div><div class="value">${fullName}</div></div>
        <div class="row"><div class="label">Form Number</div><div class="value">${formNumber}</div></div>
        <div class="row"><div class="label">Sport</div><div class="value">${sport}</div></div>
        <div class="row"><div class="label">Category</div><div class="value">${category}</div></div>
        <div class="row"><div class="label">Resumption Date</div><div class="value"><strong>August 3, 2026</strong> (7:00 AM - 9:00 AM)</div></div>
        <div class="row"><div class="label">Venue</div><div class="value">International School, University of Ibadan</div></div>
      </div>

      <p>
        Kindly come along with this admission letter and all required documents for screening and final onboarding.
      </p>

      <div class="sign">
        <div class="line"></div>
        <p style="margin-top:8px;font-size:14px;font-family:Arial,sans-serif;">Camp Director</p>
      </div>

      <div class="foot">
      </div>
    </div>
  </body>
</html>`;
  };

  const downloadAdmissionLetter = () => {
    if (!result) return;
    const html = buildAdmissionLetterHtml(result);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admission-letter-${(result.form_number || 'uisa').replace(/[^a-zA-Z0-9-]/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printAdmissionLetter = () => {
    if (!result) return;
    const html = buildAdmissionLetterHtml(result);
    const printWin = window.open('', '_blank', 'noopener,noreferrer,width=980,height=860');
    if (!printWin) return;
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 250);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ background: 'var(--navy)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 580, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ChevronLeft size={16} /> Home
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: 16 }}>
              Application Status
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>2026 Summer Sports Camp</div>
          </div>
          <BrandLogo width={170} compact darkBackground />
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: '40px auto', padding: '0 24px 80px' }}>

        {/* Search card */}
        <div className="card" style={{ padding: '32px 32px', marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
            Check Your Status
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
            Enter the guardian email and phone number used during registration.
          </p>
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-field">
              <label>Guardian Email Address <span className="req">*</span></label>
              <input className="form-input" type="email" placeholder="parent@email.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div className="form-field">
              <label>Guardian Phone Number <span className="req">*</span></label>
              <input className="form-input" type="tel" placeholder="080XXXXXXXX"
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>
            {error && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'var(--red-bg)', borderRadius: 'var(--radius-md)', color: 'var(--red)', fontSize: 13 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ gap: 8 }}>
              {loading ? 'Searching…' : <><Search size={16} /> Check Status</>}
            </button>
          </form>
        </div>

        {/* Result */}
        {result && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Status header */}
            <div style={{ background: isRejected ? 'var(--red)' : 'var(--navy)', padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <StatusIcon size={24} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>
                    Current Status
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'white' }}>
                    {cfg.label}
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div style={{ padding: '24px 28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                {[
                  ['Form Number', result.form_number],
                  ['Applicant', `${result.first_name} ${result.surname}`],
                  ['Sport', result.sport_selection],
                  ['Category', result.age_category],
                  ['Payment Status', result.payment_status || 'Not submitted'],
                  ['Amount', result.amount_paid ? `₦${parseFloat(result.amount_paid).toLocaleString()}` : '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{k}</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              {!isRejected && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Progress</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {TIMELINE.map((t, i) => {
                      const done    = i < timelineStep;
                      const active  = i === timelineStep;
                      const pending = i > timelineStep;
                      return (
                        <div key={t.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                              background: done ? 'var(--navy)' : active ? 'var(--gold)' : 'var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {done
                                ? <CheckCircle size={14} color="white" />
                                : <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? 'white' : 'var(--text-3)' }} />
                              }
                            </div>
                            {i < TIMELINE.length - 1 && (
                              <div style={{ width: 2, height: 24, background: done ? 'var(--navy)' : 'var(--border)', margin: '2px 0' }} />
                            )}
                          </div>
                          <div style={{ paddingTop: 5, paddingBottom: i < TIMELINE.length - 1 ? 0 : 0 }}>
                            <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: done || active ? 'var(--text-1)' : 'var(--text-3)' }}>
                              {t.label}
                              {active && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--gold)', background: 'rgba(232,160,0,0.12)', padding: '2px 8px', borderRadius: 20 }}>Current</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CTA based on status */}
              {result.status === 'Pending' && (
                <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(232,160,0,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(232,160,0,0.25)' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>Action Required: Upload Payment</p>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                    Transfer ₦{new Date() <= new Date('2026-07-03') ? '207,000' : '230,000'} to Access Bank — 1805832892 and upload your receipt.
                  </p>
                  <Link to={`/payment?form_number=${encodeURIComponent(result.form_number || '')}&email=${encodeURIComponent(result.guardian_email || '')}`} className="btn btn-gold btn-sm">
                    Upload Receipt <ArrowRight size={14} />
                  </Link>
                </div>
              )}

              {result.status === 'Admitted' && (
                <div style={{ marginTop: 20, padding: '16px', background: 'var(--green-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(22,163,74,0.3)' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>🎉 Congratulations! You have been admitted.</p>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                    Please arrive at International School, University of Ibadan on <strong>August 3, 2026</strong> between 7–9AM with your admission letter and all documents.
                  </p>
                  <div style={{ background: '#ffffff', border: '1px solid rgba(22,163,74,0.28)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 10 }}>
                      Click below to get your admission letter for download or printing.
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={downloadAdmissionLetter}>
                        <FileText size={14} /> Download Admission Letter
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={printAdmissionLetter}>
                        <Printer size={14} /> Print Admission Letter
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-3)' }}>
          Need help? Call <strong>08036870535</strong> or email <a href="mailto:uisportsacademy@gmail.com" style={{ color: 'var(--blue)' }}>uisportsacademy@gmail.com</a>
        </div>
      </div>
    </div>
  );
}
