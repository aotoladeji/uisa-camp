import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Printer, Search, CheckSquare, Square, RefreshCcw } from 'lucide-react';
import api from '../../utils/api';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export default function AdminStaffIDCards() {
  const [staff, setStaff] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [printIds, setPrintIds] = useState(null);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/staff');
      setStaff(data);
    } catch {
      toast.error('Failed to load staff ID cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    const resetPrint = () => setPrintIds(null);
    window.addEventListener('afterprint', resetPrint);
    return () => window.removeEventListener('afterprint', resetPrint);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(item => [item.full_name, item.designation, item.department, item.username].join(' ').toLowerCase().includes(q));
  }, [staff, query]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(item => selectedIds.includes(item.id));

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !filtered.some(item => item.id === id)));
      return;
    }

    const merged = new Set(selectedIds);
    filtered.forEach(item => merged.add(item.id));
    setSelectedIds(Array.from(merged));
  };

  const triggerPrint = (ids = null) => {
    if (ids && ids.length === 0) {
      toast.error('Select at least one staff card to print');
      return;
    }
    setPrintIds(ids);
    setTimeout(() => window.print(), 120);
  };

  const shouldHideInPrint = (id) => Array.isArray(printIds) && !printIds.includes(id);

  const getIdNumber = (item) => `UISTA-${new Date().getFullYear()}-${String(item.id).padStart(4, '0')}`;

  const renderCardPreview = (item) => {
    const idNumber = getIdNumber(item);
    const accent = item.theme_color || '#0F766E';
    const photoFallback = (item.full_name || 'Staff').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();

    return (
      <div className="id-card-template" style={{ borderColor: accent, boxShadow: '0 10px 24px rgba(0,0,0,.12)' }}>
        <div className="id-card-header" style={{ background: accent }}>
          <div className="id-card-company">UI SPORTS ACADEMY</div>
          <div className="id-card-tagline">STAFF ID CARD</div>
        </div>

        <div className="id-card-photo-wrap">
          {item.photo_url ? (
            <img src={item.photo_url} alt={item.full_name} className="id-card-photo" style={{ borderColor: accent }} />
          ) : (
            <div className="id-card-photo id-card-photo-fallback" style={{ borderColor: accent, color: accent }}>
              {photoFallback || 'S'}
            </div>
          )}
        </div>

        <div className="id-card-body">
          <div className="id-card-name" style={{ color: accent }}>{(item.full_name || 'Staff Member').toUpperCase()}</div>
          <div className="id-card-role" style={{ color: accent }}>{(item.designation || 'Staff').toUpperCase()}</div>

          <div className="id-card-details">
            <div><span>ID NO</span><b>{idNumber}</b></div>
            <div><span>DEPT</span><b>{item.department || 'Staff'}</b></div>
            <div><span>PHONE</span><b>{item.phone || 'N/A'}</b></div>
            <div><span>WEB</span><b>sportsacademy.ui.edu.ng</b></div>
          </div>
        </div>
      </div>
    );
  };

  const printCard = (item) => {
    const printWindow = window.open('', '_blank', 'width=900,height=650');
    if (!printWindow) return;
    const idNumber = getIdNumber(item);
    const accent = item.theme_color || '#0F766E';
    const name = escapeHtml(item.full_name || 'Staff Member');
    const designation = escapeHtml(item.designation || 'Staff');
    const department = escapeHtml(item.department || 'Staff');
    const phone = escapeHtml(item.phone || 'N/A');
    const photoHtml = item.photo_url ? `<img src="${item.photo_url}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-weight:800;font-size:28px;color:${accent}">${(name || 'S').slice(0, 2).toUpperCase()}</div>`;

    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${name} ID Card</title><style>body{margin:0;font-family:Arial,sans-serif;background:#f3f4f6;padding:20px} .wrap{width:760px;margin:0 auto;background:#fff;border:2px solid ${accent};border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.12)} .head{background:${accent};padding:18px 16px 80px;text-align:center;position:relative} .head::after{content:'';position:absolute;left:-8%;right:-8%;bottom:-45px;height:90px;border-radius:50%;background:#fff;border-top:4px solid ${accent}} .company{color:#fff;font-weight:800;letter-spacing:.4px;font-size:17px;font-family:var(--font-display)} .tag{color:rgba(255,255,255,.82);font-size:11px;letter-spacing:.4px} .photo-wrap{display:flex;justify-content:center;margin-top:-52px;position:relative;z-index:2} .photo{width:110px;height:110px;border-radius:50%;border:5px solid ${accent};object-fit:cover;background:#d6dee8;display:flex;align-items:center;justify-content:center} .body{padding:14px 18px 16px} .name{text-align:center;font-family:var(--font-display);color:${accent};font-size:24px;font-weight:900;line-height:1.1;margin-top:2px} .role{text-align:center;font-size:13px;font-weight:800;color:${accent};letter-spacing:.8px;margin:2px 0 10px} .details{display:flex;flex-direction:column;gap:6px} .row{display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:baseline} .label{color:${accent};font-weight:800;font-size:12px} .value{color:#1f2f44;font-size:13px;overflow-wrap:anywhere} </style></head><body><div class="wrap"><div class="head"><div class="company">UI SPORTS ACADEMY</div><div class="tag">STAFF ID CARD</div></div><div class="photo-wrap"><div class="photo">${photoHtml}</div></div><div class="body"><div class="name">${name}</div><div class="role">${designation}</div><div class="details"><div class="row"><span class="label">ID NO</span><b class="value">${idNumber}</b></div><div class="row"><span class="label">DEPT</span><b class="value">${department}</b></div><div class="row"><span class="label">PHONE</span><b class="value">${phone}</b></div><div class="row"><span class="label">WEB</span><b class="value">sportsacademy.ui.edu.ng</b></div></div></div></div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 600);
  };

  return (
    <div className="page-enter">
      <div className="id-cards-toolbar no-print">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>Staff ID Cards</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>Preview and print staff ID cards from one place.</p>
        </div>

        <div className="id-cards-actions">
          <button className="btn btn-outline btn-sm" onClick={loadStaff}>
            <RefreshCcw size={14} /> Refresh
          </button>
          <button className="btn btn-outline btn-sm" onClick={toggleSelectAll}>
            {allFilteredSelected ? <Square size={14} /> : <CheckSquare size={14} />}
            {allFilteredSelected ? 'Clear Selection' : 'Select All'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => triggerPrint(selectedIds)} disabled={!selectedIds.length}>
            <Printer size={14} /> Print Selected
          </button>
          <button className="btn btn-gold btn-sm" onClick={() => triggerPrint(null)}>
            <Printer size={14} /> Print All
          </button>
        </div>
      </div>

      <div className="card no-print" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input className="form-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search staff by name, role or department" style={{ paddingLeft: 38 }} />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading staff cards…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)' }}>
          No staff found.
        </div>
      ) : (
        <div className="id-cards-grid">
          {filtered.map(item => (
            <div key={item.id} className={`id-card-shell ${shouldHideInPrint(item.id) ? 'id-card-print-hidden' : ''}`}>
              <div className="id-card-select no-print">
                <label>
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                  Select
                </label>
                <button className="btn btn-outline btn-sm" onClick={() => triggerPrint([item.id])}>
                  <Printer size={13} /> Print
                </button>
              </div>
              {renderCardPreview(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
