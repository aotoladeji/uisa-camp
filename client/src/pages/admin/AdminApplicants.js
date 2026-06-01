import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Eye, ChevronLeft, ChevronRight, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { downloadCsv } from '../../utils/exportCsv';

const STATUS_OPTIONS = ['', 'Pending', 'Payment Submitted', 'Payment Verified', 'Medical Cleared', 'Admitted', 'Rejected'];
const SPORT_OPTIONS  = ['', 'Football', 'Basketball', 'Athletics', 'Swimming', 'Tennis'];

const BADGE_MAP = {
  'Pending':           'badge-pending',
  'Payment Submitted': 'badge-submitted',
  'Payment Verified':  'badge-verified',
  'Medical Cleared':   'badge-cleared',
  'Admitted':          'badge-admitted',
  'Rejected':          'badge-rejected',
};

export default function AdminApplicants() {
  const { admin } = useAuth();
  const [searchParams] = useSearchParams();
  const [data, setData]    = useState([]);
  const [total, setTotal]  = useState(0);
  const [loading, setLoading] = useState(true);

  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState(searchParams.get('status') || '');
  const [sport,   setSport]   = useState('');
  const [page,    setPage]    = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const LIMIT = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/applicants', {
        params: { search: search||undefined, status: status||undefined, sport: sport||undefined, page, limit: LIMIT }
      });
      setData(res.data);
      setTotal(res.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, status, sport, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => data.some(row => row.id === id)));
  }, [data]);

  const canDelete = admin?.role === 'admin' || admin?.role === 'super_admin';

  const handleDelete = async (row) => {
    const ok = window.confirm(`Delete ${row.first_name} ${row.surname} (${row.form_number})? This action cannot be undone.`);
    if (!ok) return;

    setDeletingId(row.id);
    try {
      await api.delete(`/applicants/${row.id}`);
      toast.success('Applicant deleted');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete applicant');
    } finally {
      setDeletingId(null);
    }
  };

  const allPageSelected = data.length > 0 && data.every(row => selectedIds.includes(row.id));

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(id => !data.some(row => row.id === id)));
      return;
    }

    const merged = new Set(selectedIds);
    data.forEach(row => merged.add(row.id));
    setSelectedIds(Array.from(merged));
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) {
      toast.error('Select at least one applicant');
      return;
    }

    const ok = window.confirm(`Delete ${selectedIds.length} selected applicant(s)? This action cannot be undone.`);
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const { data: res } = await api.post('/applicants/bulk-delete', { ids: selectedIds });
      toast.success(`${res.deleted || selectedIds.length} applicant(s) deleted`);
      setSelectedIds([]);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = () => {
    if (!data.length) {
      toast.error('No applicants to export');
      return;
    }

    const headers = [
      { key: 'form_number', label: 'Form Number' },
      { key: 'full_name', label: 'Applicant Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'age', label: 'Age' },
      { key: 'sport_selection', label: 'Sport' },
      { key: 'age_category', label: 'Category' },
      { key: 'guardian_name', label: 'Guardian Name' },
      { key: 'guardian_email', label: 'Guardian Email' },
      { key: 'guardian_phone', label: 'Guardian Phone' },
      { key: 'payment_status', label: 'Payment Status' },
      { key: 'status', label: 'Application Status' },
      { key: 'created_at', label: 'Created At' },
    ];

    const rows = data.map(row => ({
      form_number: row.form_number,
      full_name: `${row.first_name || ''} ${row.surname || ''}`.trim(),
      gender: row.gender || '',
      age: row.age ?? '',
      sport_selection: row.sport_selection || '',
      age_category: row.age_category || '',
      guardian_name: row.guardian_name || '',
      guardian_email: row.guardian_email || '',
      guardian_phone: row.guardian_phone || '',
      payment_status: row.payment_status || '',
      status: row.status || '',
      created_at: row.created_at ? new Date(row.created_at).toLocaleString('en-NG') : '',
    }));

    downloadCsv({
      filename: `applicants-page-${page}-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    });
    toast.success('Applicants exported');
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>Applicants</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>{total} total registrations</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={!data.length}>
            <Download size={14} /> Export CSV
          </button>
          {canDelete && (
            <button className="btn btn-danger btn-sm" disabled={bulkDeleting || !selectedIds.length} onClick={handleBulkDelete}>
              <Trash2 size={14} /> Delete Selected ({selectedIds.length})
            </button>
          )}
          <Link to="/register" target="_blank" className="btn btn-gold btn-sm">+ New Registration</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={15} color="var(--text-3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="form-input"
              placeholder="Search name, form number, email…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: 36, fontSize: 13 }}
            />
          </div>
          <select className="form-input" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            style={{ width: 180, fontSize: 13 }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <select className="form-input" value={sport} onChange={e => { setSport(e.target.value); setPage(1); }}
            style={{ width: 150, fontSize: 13 }}>
            {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Sports'}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatus(''); setSport(''); setPage(1); }}>
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>
        ) : data.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>No applicants found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 52 }}>
                    {canDelete ? (
                      <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} />
                    ) : null}
                  </th>
                  <th>Form #</th>
                  <th>Applicant</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Sport</th>
                  <th>Category</th>
                  <th>Guardian</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.id}>
                    <td>
                      {canDelete ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleSelect(row.id)}
                        />
                      ) : null}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>{row.form_number}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 14 }}>{row.first_name} {row.surname}</div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{row.gender}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{row.age}</td>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{row.sport_selection}</td>
                    <td>
                      <span style={{ fontSize: 12, background: 'var(--surface)', padding: '2px 8px', borderRadius: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                        {row.age_category === 'Junior (6-17)' ? 'Junior' : 'Elite'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{row.guardian_name}</td>
                    <td>
                      {row.payment_status ? (
                        <span className={`badge ${row.payment_status === 'Verified' ? 'badge-verified' : row.payment_status === 'Rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                          {row.payment_status}
                        </span>
                      ) : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                    </td>
                    <td><span className={`badge ${BADGE_MAP[row.status] || 'badge-pending'}`}>{row.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {new Date(row.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/admin/applicants/${row.id}`} className="btn btn-ghost btn-sm" title="View">
                          <Eye size={14} />
                        </Link>
                        {canDelete && (
                          <button
                            className="btn btn-sm btn-danger"
                            title="Delete Applicant"
                            onClick={() => handleDelete(row)}
                            disabled={deletingId === row.id}
                            style={{ padding: '6px 10px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Page {page} of {totalPages} · {total} records
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </button>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
