import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, CreditCard, TrendingUp, ArrowRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const SPORT_COLORS = { Football: '#16A34A', Basketball: '#EA580C', Athletics: '#7C3AED', Swimming: '#0891B2', Tennis: '#D97706' };

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  const content = (
    <div className="card" style={{ padding: '20px 22px', display: 'flex', gap: 16, alignItems: 'center', transition: 'all .2s', cursor: to ? 'pointer' : 'default' }}
      onMouseEnter={e => to && (e.currentTarget.style.transform = 'translateY(-2px)', e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
      onMouseLeave={e => to && (e.currentTarget.style.transform = '', e.currentTarget.style.boxShadow = '')}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--navy)', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      {to && <ArrowRight size={16} color="var(--text-3)" />}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoAcceptMode, setAutoAcceptMode] = useState('balanced');
  const [savingMode, setSavingMode] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [pricingDraft, setPricingDraft] = useState({
    camp_fee_amount: '230000',
    early_bird_enabled: true,
    early_bird_discount_pct: '10',
    early_bird_fee_amount: '',
    early_bird_deadline: '2026-07-03',
  });
  const [savingPricing, setSavingPricing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, modeRes] = await Promise.all([
          api.get('/applicants/stats/summary'),
          api.get('/auth/settings/auto-accept-mode'),
        ]);
        setStats(statsRes.data);
        setAutoAcceptMode(modeRes.data?.mode || 'balanced');

        try {
          const pricingRes = await api.get('/auth/settings/pricing');
          const p = pricingRes.data?.pricing;
          if (p) {
            setPricing(p);
            setPricingDraft({
              camp_fee_amount: String(p.regular_fee ?? 230000),
              early_bird_enabled: Boolean(p.early_bird_enabled),
              early_bird_discount_pct: String(p.early_bird_discount_pct ?? 10),
              early_bird_fee_amount: p.early_bird_fee_amount == null ? '' : String(p.early_bird_fee_amount),
              early_bird_deadline: p.early_bird_deadline || '2026-07-03',
            });
          }
        } catch (_pricingErr) {
          // Pricing panel is admin-only; ignore for lower roles.
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveAutoAcceptMode = async (mode) => {
    setSavingMode(true);
    try {
      await api.patch('/auth/settings/auto-accept-mode', { mode });
      setAutoAcceptMode(mode);
      toast.success(`Auto-accept mode set to ${mode}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update mode');
    } finally {
      setSavingMode(false);
    }
  };

  const savePricingSettings = async () => {
    setSavingPricing(true);
    try {
      const payload = {
        camp_fee_amount: Number(pricingDraft.camp_fee_amount),
        early_bird_enabled: Boolean(pricingDraft.early_bird_enabled),
        early_bird_discount_pct: Number(pricingDraft.early_bird_discount_pct),
        early_bird_fee_amount: pricingDraft.early_bird_fee_amount === '' ? null : Number(pricingDraft.early_bird_fee_amount),
        early_bird_deadline: pricingDraft.early_bird_deadline,
      };
      const res = await api.patch('/auth/settings/pricing', payload);
      const p = res.data?.pricing;
      if (p) {
        setPricing(p);
      }
      toast.success('Pricing settings updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not update pricing settings');
    } finally {
      setSavingPricing(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>Loading dashboard…</div>
    </div>
  );

  const c = stats?.counts || {};
  const sportData = stats?.sportBreakdown || [];
  const categoryData = stats?.categoryBreakdown || [];
  const revenue = stats?.revenue || {};

  const statusBarData = [
    { name: 'Pending',    value: parseInt(c.pending) || 0 },
    { name: 'Pmt Submit', value: parseInt(c.payment_submitted) || 0 },
    { name: 'Pmt Verified', value: parseInt(c.payment_verified) || 0 },
    { name: 'Med. Cleared', value: parseInt(c.medical_cleared) || 0 },
    { name: 'Admitted',   value: parseInt(c.admitted) || 0 },
    { name: 'Rejected',   value: parseInt(c.rejected) || 0 },
  ];

  return (
    <div className="page-enter">
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--navy)' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>2026 UI Summer Sports Camp — Overview</p>
      </div>

      {/* Stat cards */}
      <div className="admin-dashboard-card-grid" style={{ marginBottom: 20 }}>
        <StatCard icon={Users}     label="Total Applications" value={c.total || 0}       color="var(--blue)"  to="/admin/applicants" />
        <StatCard icon={CheckCircle} label="Admitted"         value={c.admitted || 0}    color="var(--green)" to="/admin/applicants?status=Admitted" />
        <StatCard icon={Clock}     label="Pending Payment"    value={c.pending || 0}     color="var(--amber)" to="/admin/applicants?status=Pending" />
        <StatCard icon={CreditCard} label="Verify Receipts" value={c.payment_submitted || 0} color="#7C3AED" to="/admin/payments?status=Pending" />
        <StatCard icon={TrendingUp} label="Revenue Verified"  value={`₦${(parseFloat(revenue.total_revenue)||0).toLocaleString()}`} color="var(--green)" sub={`${revenue.total_payments || 0} payments`} />
      </div>

      {/* Quick action cards */}
      <div className="admin-dashboard-card-grid" style={{ marginBottom: 28 }}>
        {[
          { icon: Users, label: 'Review Applications', desc: `${c.payment_verified || 0} ready to admit`, to: '/admin/applicants?status=Payment+Verified', color: 'var(--blue)' },
          { icon: CheckCircle, label: 'Medical Cleared', desc: `${c.medical_cleared || 0} cleared`, to: '/admin/applicants?status=Medical+Cleared', color: '#065F46' },
          { icon: AlertCircle, label: 'Rejected', desc: `${c.rejected || 0} rejected`, to: '/admin/applicants?status=Rejected', color: 'var(--red)' },
        ].map(({ icon: Icon, label, desc, to, color }) => (
          <Link key={to} to={to} className="admin-dashboard-action-link" style={{ textDecoration: 'none' }}>
            <div className="card admin-dashboard-action-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</div>
              </div>
              <ArrowRight size={14} color="var(--text-3)" style={{ marginLeft: 'auto' }} />
            </div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>Auto-Accept Mode</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Controls automatic admission logic for new registrations.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['strict', 'balanced', 'lenient'].map(mode => (
              <button
                key={mode}
                className="btn btn-sm"
                disabled={savingMode}
                onClick={() => saveAutoAcceptMode(mode)}
                style={{
                  background: autoAcceptMode === mode ? 'var(--navy)' : 'var(--surface)',
                  color: autoAcceptMode === mode ? 'white' : 'var(--text-2)',
                  border: `1px solid ${autoAcceptMode === mode ? 'var(--navy)' : 'var(--border)'}`,
                  textTransform: 'capitalize'
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {pricing && <div className="card" style={{ padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 4 }}>Pricing Flex Control</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>Enable/disable early bird and adjust fee values. Leave Early Bird fixed fee empty to use percentage mode.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 10, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
            Regular Fee
            <input className="form-input" type="number" min="0" value={pricingDraft.camp_fee_amount} onChange={(e) => setPricingDraft(p => ({ ...p, camp_fee_amount: e.target.value }))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
            Discount %
            <input className="form-input" type="number" min="0" max="100" value={pricingDraft.early_bird_discount_pct} onChange={(e) => setPricingDraft(p => ({ ...p, early_bird_discount_pct: e.target.value }))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
            Early Bird Fixed Fee
            <input className="form-input" type="number" min="0" placeholder="optional" value={pricingDraft.early_bird_fee_amount} onChange={(e) => setPricingDraft(p => ({ ...p, early_bird_fee_amount: e.target.value }))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
            Deadline
            <input className="form-input" type="date" value={pricingDraft.early_bird_deadline} onChange={(e) => setPricingDraft(p => ({ ...p, early_bird_deadline: e.target.value }))} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>
            <input type="checkbox" checked={pricingDraft.early_bird_enabled} onChange={(e) => setPricingDraft(p => ({ ...p, early_bird_enabled: e.target.checked }))} />
            Early Bird Enabled
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Current computed early-bird fee: <strong style={{ color: 'var(--navy)' }}>₦{(pricing?.computed_early_bird_fee || 0).toLocaleString()}</strong>
          </div>
          <button className="btn btn-sm" onClick={savePricingSettings} disabled={savingPricing}>
            {savingPricing ? 'Saving...' : 'Save Pricing'}
          </button>
        </div>
      </div>}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Sport breakdown */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 20 }}>By Sport</h3>
          {sportData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sportData} dataKey="count" nameKey="sport_selection" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {sportData.map((entry, i) => (
                    <Cell key={i} fill={SPORT_COLORS[entry.sport_selection] || '#94A3B8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>No data yet</div>}
        </div>

        {/* Category */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 20 }}>Age Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} dataKey="count" nameKey="age_category" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(percent*100).toFixed(0)}%`}>
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={['#0A3D62','#E8A000'][i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend formatter={v => <span style={{ fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>No data yet</div>}
        </div>
      </div>

      {/* Status bar chart */}
      <div className="card" style={{ padding: '22px 24px', marginBottom: 28 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 20 }}>Application Status Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={statusBarData} barSize={32}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontFamily: 'Plus Jakarta Sans', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-md)' }}
            />
            <Bar dataKey="value" name="Applicants" radius={[6,6,0,0]}>
              {statusBarData.map((entry, i) => (
                <Cell key={i} fill={['#D97706','#7C3AED','#0891B2','#065F46','#16A34A','#DC2626'][i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
