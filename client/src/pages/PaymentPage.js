import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import BrandLogo from '../components/BrandLogo';

export default function PaymentPage() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    applicant_id: params.get('id') || '',
    guardian_email: params.get('email') || '',
    payment_plan: '',
    transaction_ref: '',
    payment_date: '',
    amount_paid: '',
  });
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [pricing, setPricing] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/applicants/pricing');
        setPricing(res.data?.pricing || null);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const regularFee = pricing?.regular_fee || 230000;
  const earlyBird = Boolean(pricing?.early_bird_active);
  const earlyBirdFee = pricing?.computed_early_bird_fee || Math.round(regularFee * 0.9);

  const choosePlan = (plan) => {
    if (plan === 'Early Bird' && !earlyBird) {
      toast.error('Early bird discount is currently disabled');
      return;
    }
    const amount = plan === 'Early Bird' ? earlyBirdFee : regularFee;
    setSelectedPlan(plan);
    setForm((p) => ({ ...p, payment_plan: plan, amount_paid: String(amount) }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!receipt) { toast.error('Please attach your payment receipt'); return; }
    if (!selectedPlan) { toast.error('Please select a payment plan'); return; }
    if (!form.applicant_id || !form.guardian_email) { toast.error('Application ID and email are required'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('receipt', receipt);
      await api.post('/payments/submit', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 480, width: '100%', padding: '48px 36px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={32} color="var(--green)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>Receipt Submitted!</h2>
          <p style={{ color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24 }}>
            Your payment receipt has been received. Our team will verify within 24 hours. You'll receive an email confirmation.
          </p>
          <Link to="/status" className="btn btn-primary">Check Application Status</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <div style={{ background: 'var(--navy)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ChevronLeft size={16} /> Back
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: 16 }}>Upload Payment Receipt</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>2026 Summer Sports Camp</div>
          </div>
          <BrandLogo width={176} compact darkBackground />
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '32px auto', padding: '0 24px 80px' }}>

        <div className="card" style={{ padding: '24px 28px', marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>Select Payment Plan</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              type="button"
              onClick={() => choosePlan('Early Bird')}
              className="btn"
              disabled={!earlyBird}
              style={{
                justifyContent: 'flex-start',
                opacity: earlyBird ? 1 : 0.65,
                background: selectedPlan === 'Early Bird' ? 'rgba(232,160,0,0.12)' : 'var(--surface)',
                border: `1.5px solid ${selectedPlan === 'Early Bird' ? 'rgba(232,160,0,0.5)' : 'var(--border)'}`,
                color: 'var(--text-1)',
                padding: '12px 14px',
                width: '100%'
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--amber)' }}>Early Bird {earlyBird ? '(Open)' : '(Disabled)'}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>₦{earlyBirdFee.toLocaleString()}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => choosePlan('Regular')}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: selectedPlan === 'Regular' ? 'rgba(26,111,165,0.10)' : 'var(--surface)',
                border: `1.5px solid ${selectedPlan === 'Regular' ? 'rgba(26,111,165,0.45)' : 'var(--border)'}`,
                color: 'var(--text-1)',
                padding: '12px 14px',
                width: '100%'
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue)' }}>Regular Plan</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>₦{regularFee.toLocaleString()}</div>
              </div>
            </button>
          </div>
          {!selectedPlan && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>Choose one plan to reveal bank payment details.</p>
          )}
        </div>

        {selectedPlan && (
          <div className="card" style={{ padding: '24px 28px', marginBottom: 20, background: 'var(--navy)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>Bank Transfer Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Account Number</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'white', letterSpacing: '1px' }}>1805832892</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Bank</div>
                <div style={{ fontWeight: 700, color: 'white', fontSize: 15 }}>Access Bank</div>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Account Name</div>
                <div style={{ fontWeight: 700, color: 'white' }}>University of Ibadan MacArthur Grants</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>SELECTED PLAN</div>
                <div style={{ fontWeight: 700, color: '#FFB820', fontSize: 13, marginTop: 2 }}>{selectedPlan}</div>
                <div style={{ fontWeight: 800, color: 'white', fontSize: 20, marginTop: 2 }}>₦{Number(form.amount_paid || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>NARRATION FORMAT</div>
                <div style={{ fontWeight: 700, color: '#FFB820', fontSize: 13, marginTop: 2 }}>Name + SPORT</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>e.g. "John Adeyemi Football"</div>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '28px 28px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--navy)', marginBottom: 20 }}>
            Upload Your Receipt
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-field">
                <label>Application ID / Form Number <span className="req">*</span></label>
                <input className="form-input" placeholder="UI/SA/2026/0001" value={form.applicant_id} onChange={e => set('applicant_id', e.target.value)} required />
              </div>
              <div className="form-field">
                <label>Guardian Email <span className="req">*</span></label>
                <input className="form-input" type="email" placeholder="parent@email.com" value={form.guardian_email} onChange={e => set('guardian_email', e.target.value)} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-field">
                <label>Transfer Reference / Narration</label>
                <input className="form-input" placeholder="John Adeyemi Football" value={form.transaction_ref} onChange={e => set('transaction_ref', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Payment Date</label>
                <input className="form-input" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <label>Amount Paid (₦)</label>
              <input className="form-input" type="number" placeholder={selectedPlan ? form.amount_paid : 'Select payment plan first'} value={form.amount_paid} onChange={e => set('amount_paid', e.target.value)} />
            </div>

            {/* Drop zone */}
            <div className="form-field">
              <label>Payment Receipt / E-Receipt <span className="req">*</span></label>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '28px 20px',
                border: `2px dashed ${receipt ? 'var(--green)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', background: receipt ? 'var(--green-bg)' : 'var(--surface)',
                cursor: 'pointer', transition: 'all .2s', textAlign: 'center',
              }}
                onMouseEnter={e => !receipt && (e.currentTarget.style.borderColor = 'var(--blue)')}
                onMouseLeave={e => !receipt && (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" hidden onChange={e => setReceipt(e.target.files[0])} />
                {receipt
                  ? <><CheckCircle size={28} color="var(--green)" /><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>{receipt.name}</span><span style={{ fontSize: 12, color: 'var(--text-3)' }}>Click to change</span></>
                  : <><Upload size={28} color="var(--text-3)" /><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>Click to upload receipt</span><span style={{ fontSize: 12, color: 'var(--text-3)' }}>JPG, PNG or PDF — max 5MB</span></>
                }
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(232,160,0,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(232,160,0,0.2)' }}>
              <AlertCircle size={16} color="var(--amber)" style={{ marginTop: 1, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                Upload your bank transfer confirmation (e-receipt, transaction screenshot or bank debit alert). Maximum file size: 5MB.
              </p>
            </div>

            <button type="submit" className="btn btn-gold" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: 15 }}>
              {loading ? 'Uploading…' : 'Submit Payment Receipt'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
