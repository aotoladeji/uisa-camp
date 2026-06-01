import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Barcode from 'react-barcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Printer, CheckSquare, Square, RefreshCcw, FileDown } from 'lucide-react';
import api from '../../utils/api';
import brandLogo from '../../assets/ui-brand-logo.svg';

const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

const toDisplayDate = (value) => {
  if (!value) return 'DD/MM/YYYY';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB');
};

const toPhotoUrl = (path) => {
  if (!path) return '';
  return `${serverUrl}/${String(path).replace(/^\/+/, '')}`;
};

export default function AdminIDCards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [printIds, setPrintIds] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchCards = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/applicants/id-cards');
      setCards(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load ID cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCards(); }, []);

  useEffect(() => {
    const resetPrint = () => setPrintIds(null);
    window.addEventListener('afterprint', resetPrint);
    return () => window.removeEventListener('afterprint', resetPrint);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(card =>
      `${card.full_name} ${card.form_number} ${card.card_number} ${card.card_role} ${card.group_assigned || ''} ${card.room_number || ''}`.toLowerCase().includes(q)
    );
  }, [cards, query]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedIds.includes(c.id));

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !filtered.some(c => c.id === id)));
      return;
    }

    const merged = new Set(selectedIds);
    filtered.forEach(c => merged.add(c.id));
    setSelectedIds(Array.from(merged));
  };

  const triggerPrint = (ids = null) => {
    if (ids && ids.length === 0) {
      toast.error('Select at least one card to print');
      return;
    }

    setPrintIds(ids);
    setTimeout(() => window.print(), 120);
  };

  const exportPdf = async (ids = null) => {
    const targetIds = Array.isArray(ids)
      ? ids
      : filtered.map(c => c.id);

    if (!targetIds.length) {
      toast.error('No cards to export');
      return;
    }

    setExportingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const cardWidth = (pageWidth - margin * 3) / 2;
      const cardHeight = 88;
      let x = margin;
      let y = margin;
      let index = 0;

      for (const id of targetIds) {
        const node = document.getElementById(`id-card-canvas-${id}`);
        if (!node) continue;

        // Ensure image resources are loaded and rendered before capture.
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const img = canvas.toDataURL('image/png');

        if (index > 0 && index % 6 === 0) {
          pdf.addPage();
          x = margin;
          y = margin;
        }

        pdf.addImage(img, 'PNG', x, y, cardWidth, cardHeight, undefined, 'FAST');

        if (x + cardWidth + margin > pageWidth - margin) {
          x = margin;
          y += cardHeight + 6;
        } else {
          x += cardWidth + margin;
        }

        if (y + cardHeight > pageHeight - margin) {
          pdf.addPage();
          x = margin;
          y = margin;
          index = 0;
        } else {
          index += 1;
        }
      }

      pdf.save(`uisa-id-cards-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exported');
    } catch (err) {
      toast.error('Could not export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const shouldHideInPrint = (id) => Array.isArray(printIds) && !printIds.includes(id);

  return (
    <div className="page-enter">
      <div className="id-cards-toolbar no-print">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>ID Cards</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>
            {cards.length} admitted applicant{cards.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="id-cards-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchCards}>
            <RefreshCcw size={14} /> Refresh
          </button>
          <button className="btn btn-outline btn-sm" onClick={toggleSelectAll}>
            {allFilteredSelected ? <Square size={14} /> : <CheckSquare size={14} />}
            {allFilteredSelected ? 'Clear Selection' : 'Select All'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => triggerPrint(selectedIds)}>
            <Printer size={14} /> Print Selected
          </button>
          <button className="btn btn-gold btn-sm" onClick={() => triggerPrint(null)}>
            <Printer size={14} /> Print All
          </button>
          <button className="btn btn-outline btn-sm" disabled={exportingPdf || !selectedIds.length} onClick={() => exportPdf(selectedIds)}>
            <FileDown size={14} /> PDF Selected
          </button>
          <button className="btn btn-outline btn-sm" disabled={exportingPdf || !filtered.length} onClick={() => exportPdf(null)}>
            <FileDown size={14} /> PDF All
          </button>
        </div>
      </div>

      <div className="card no-print" style={{ padding: 14, marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="Search by name, form number, role or card number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading ID cards...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center', color: 'var(--text-3)' }}>
          No admitted applicants found.
        </div>
      ) : (
        <div className="id-cards-grid">
          {filtered.map(card => (
            <div key={card.id} className={`id-card-shell ${shouldHideInPrint(card.id) ? 'id-card-print-hidden' : ''}`} id={`id-card-canvas-${card.id}`}>
              <div className="id-card-select no-print">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(card.id)}
                    onChange={() => toggleSelect(card.id)}
                  />
                  Select
                </label>
                <button className="btn btn-outline btn-sm" onClick={() => triggerPrint([card.id])}>
                  <Printer size={13} /> Print
                </button>
              </div>

              <div className="id-card-template">
                <div className="id-card-header">
                  <div className="id-card-logo"><img src={brandLogo} alt="University of Ibadan" style={{ width: 46, height: 'auto', display: 'block' }} /></div>
                  <div className="id-card-company">UI SPORTS ACADEMY</div>
                  <div className="id-card-tagline">SUMMER CAMP 2026</div>
                </div>

                <div className="id-card-photo-wrap">
                  {card.passport_photo ? (
                    <img src={toPhotoUrl(card.passport_photo)} alt={card.full_name} className="id-card-photo" crossOrigin="anonymous" />
                  ) : (
                    <div className="id-card-photo id-card-photo-fallback">
                      {(card.first_name?.[0] || '') + (card.surname?.[0] || '')}
                    </div>
                  )}
                </div>

                <div className="id-card-body">
                  <div className="id-card-name">{card.full_name.toUpperCase()}</div>
                  <div className="id-card-role">{String(card.card_role || 'ATHLETE').toUpperCase()}</div>

                  <div className="id-card-details">
                    <div><span>ID NO</span><b>{card.card_number}</b></div>
                    <div><span>DOB</span><b>{toDisplayDate(card.date_of_birth)}</b></div>
                    <div><span>Blood</span><b>{card.blood_group || 'N/A'}</b></div>
                    <div><span>Group</span><b>{card.group_assigned || 'N/A'}</b></div>
                    <div><span>Room</span><b>{card.room_number || 'N/A'}</b></div>
                    <div><span>Sport</span><b>{card.card_role || 'N/A'}</b></div>
                    <div><span>Phone</span><b>{card.guardian_phone || 'N/A'}</b></div>
                    <div><span>E-mail</span><b>{card.guardian_email || 'N/A'}</b></div>
                  </div>

                  <div className="id-card-barcode">
                    <Barcode
                      value={card.barcode_value || card.card_number}
                      displayValue={false}
                      width={1.4}
                      height={46}
                      margin={0}
                      background="transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
