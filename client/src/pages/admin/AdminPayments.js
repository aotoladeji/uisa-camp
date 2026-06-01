import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Eye, CheckCircle, XCircle, ExternalLink, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import api from '../../utils/api';
import { downloadCsv } from '../../utils/exportCsv';

const STATUS_OPTIONS = ['', 'Pending', 'Verified', 'Rejected'];

export default function AdminPayments() {
  const [searchParams] = useSearchParams();
  const [data, setData]    = useState([]);
  const [total, setTotal]  = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState(searchParams.get('status') || '');
  const [page, setPage]       = useState(1);
  const [selected, setSelected] = useState(null);
  const [actionForm, setActionForm] = useState({ action: '', rejection_reason: '', notes: '' });
  const [processing, setProcessing] = useState(false);
  const LIMIT = 20;

  const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/payments', {
        params: { search: search||undefined, status: status||undefined, page, limit: LIMIT }
      });
      setData(res.data);
      setTotal(res.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, status, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAction = async () => {
    if (!selected || !actionForm.action) return;
    if (actionForm.action === 'reject' && !actionForm.rejection_reason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setProcessing(true);
    try {
      const { data: res } = await api.patch(`/payments/${selected.id}/verify`, actionForm);
      toast.success(`Payment ${res.status === 'Verified' ? 'verified' : 'rejected'} successfully`);
      setSelected(null);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    } finally { setProcessing(false); }
  };

  const handleExport = () => {
    if (!data.length) {
      toast.error('No payments to export');
      return;
    }

    const headers = [
      { key: 'form_number', label: 'Form Number' },
      { key: 'full_name', label: 'Applicant Name' },
      { key: 'guardian_email', label: 'Guardian Email' },
      { key: 'sport_selection', label: 'Sport' },
      { key: 'amount_paid', label: 'Amount Paid' },
      { key: 'fee_type', label: 'Fee Type' },
      { key: 'transaction_ref', label: 'Transaction Reference' },
      { key: 'payment_date', label: 'Payment Date' },
      { key: 'bank_name', label: 'Bank Name' },
      { key: 'account_number', label: 'Account Number' },
      { key: 'verification_status', label: 'Verification Status' },
      { key: 'verified_at', label: 'Verified At' },
      { key: 'rejection_reason', label: 'Rejection Reason' },
      { key: 'notes', label: 'Notes' },
      { key: 'created_at', label: 'Created At' },
    ];

    const rows = data.map(row => ({
      form_number: row.form_number || '',
      full_name: row.full_name || '',
      guardian_email: row.guardian_email || '',
      sport_selection: row.sport_selection || '',
      amount_paid: row.amount_paid ?? '',
      fee_type: row.fee_type || '',
      transaction_ref: row.transaction_ref || '',
      payment_date: row.payment_date || '',
      bank_name: row.bank_name || '',
      account_number: row.account_number || '',
      verification_status: row.verification_status || '',
      verified_at: row.verified_at ? new Date(row.verified_at).toLocaleString('en-NG') : '',
      rejection_reason: row.rejection_reason || '',
      notes: row.notes || '',
      created_at: row.created_at ? new Date(row.created_at).toLocaleString('en-NG') : '',
    }));

    downloadCsv({
      filename: `payments-page-${page}-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    });
    toast.success('Payments exported');
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>Payments</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>{total} payment records</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={!data.length}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={15} color="var(--text-3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input className="form-input" placeholder="Search name, form number, reference…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: 36, fontSize: 13 }}
            />
          </div>
          <select className="form-input" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            style={{ width: 160, fontSize: 13 }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatus(''); setPage(1); }}>Clear</button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
        ) : data.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>No payments found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Form #</th>
                  <th>Applicant</th>
                  <th>Sport</th>
                  <th>Amount</th>
                  <th>Fee Type</th>
                  <th>Reference</th>
                  <th>Payment Date</th>
                  <th>Status</th>
                  <th>Receipt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>{row.form_number}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{row.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{row.guardian_email}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{row.sport_selection}</td>
                    <td style={{ fontWeight: 700, fontSize: 14 }}>₦{parseFloat(row.amount_paid || 0).toLocaleString()}</td>
                    <td>
                      {row.fee_type === 'Early Bird'
                        ? <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--amber-bg)', color: 'var(--amber)', padding: '2px 8px', borderRadius: 12 }}>⭐ Early Bird</span>
                        : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Regular</span>
                      }
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.transaction_ref || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{row.payment_date || '—'}</td>
                    <td>
                      <span className={`badge ${row.verification_status === 'Verified' ? 'badge-verified' : row.verification_status === 'Rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                        {row.verification_status}
                      </span>
                    </td>
                    <td>
                      {row.receipt_path
                        ? <a href={`${serverUrl}/${row.receipt_path}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="View Receipt">
                            <ExternalLink size={13} />
                          </a>
                        : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/admin/applicants/${row.applicant_id}`} className="btn btn-ghost btn-sm" title="View Applicant">
                          <Eye size={13} />
                        </Link>
                        {row.verification_status === 'Pending' && (
                          <>
                            <button title="Verify" className="btn btn-sm" onClick={() => { setSelected(row); setActionForm({ action: 'verify', rejection_reason: '', notes: '' }); }}
                              style={{ background: 'var(--green-bg)', color: 'var(--green)', padding: '5px 10px' }}>
                              <CheckCircle size={13} />
                            </button>
                            <button title="Reject" className="btn btn-sm" onClick={() => { setSelected(row); setActionForm({ action: 'reject', rejection_reason: '', notes: '' }); }}
                              style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '5px 10px' }}>
                              <XCircle size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Page {page} of {totalPages} · {total} records</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Verify / Reject Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: '32px 28px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800,
              color: actionForm.action === 'verify' ? 'var(--green)' : 'var(--red)', marginBottom: 6 }}>
              {actionForm.action === 'verify' ? '✅ Verify Payment' : '❌ Reject Payment'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
              Applicant: <strong>{selected.full_name}</strong> · Amount: <strong>₦{parseFloat(selected.amount_paid || 0).toLocaleString()}</strong>
            </p>

            {/* Show receipt inline */}
            {selected.receipt_path && (
              <div style={{ marginBottom: 16 }}>
                <a href={`${serverUrl}/${selected.receipt_path}`} target="_blank" rel="noreferrer"
                  className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}>
                  <ExternalLink size={13} /> Open Full Receipt
                </a>
                {selected.receipt_path.match(/\.(jpg|jpeg|png|webp)$/i) && (
                  <img src={`${serverUrl}/${selected.receipt_path}`} alt="receipt"
                    style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
                  />
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {actionForm.action === 'reject' && (
                <div className="form-field">
                  <label>Rejection Reason <span className="req">*</span></label>
                  <textarea className="form-input" rows={3} value={actionForm.rejection_reason}
                    onChange={e => setActionForm(p => ({ ...p, rejection_reason: e.target.value }))}
                    placeholder="Reason for rejecting this payment…"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              )}
              <div className="form-field">
                <label>Internal Notes (optional)</label>
                <textarea className="form-input" rows={2} value={actionForm.notes}
                  onChange={e => setActionForm(p => ({ ...p, notes: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setSelected(null)} style={{ flex: 1 }}>Cancel</button>
              <button
                className={`btn ${actionForm.action === 'verify' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleAction} disabled={processing}
                style={{ flex: 1, background: actionForm.action === 'verify' ? 'var(--green)' : 'var(--red)', color: 'white' }}>
                {processing ? 'Processing…' : actionForm.action === 'verify' ? '✅ Confirm Verify' : '❌ Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
