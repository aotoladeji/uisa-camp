import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Upload, UserCheck, Pencil, Trash2 } from 'lucide-react';
import api from '../../utils/api';

export default function AdminStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ full_name: '', designation: '', department: 'Coaching', phone: '', email: '', username: '', theme_color: '#0F766E' });
  const [photo, setPhoto] = useState(null);

  const fetchStaff = async () => {
    try {
      const { data } = await api.get('/staff');
      setStaff(data);
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const resetForm = () => {
    setForm({ full_name: '', designation: '', department: 'Coaching', phone: '', email: '', username: '', theme_color: '#0F766E' });
    setPhoto(null);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) fd.append(key, value);
      });
      if (photo) fd.append('photo', photo);
      if (editingId) {
        await api.patch(`/staff/${editingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Staff updated');
      } else {
        const { data } = await api.post('/staff', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success(`Staff created: ${data.full_name}`);
      }
      resetForm();
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.error || (editingId ? 'Failed to update staff' : 'Failed to create staff'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      full_name: item.full_name || '',
      designation: item.designation || '',
      department: item.department || 'Coaching',
      phone: item.phone || '',
      email: item.email || '',
      username: item.username || '',
      theme_color: item.theme_color || '#0F766E',
    });
    setPhoto(null);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this staff record?')) return;
    try {
      await api.delete(`/staff/${id}`);
      toast.success('Staff deleted');
      fetchStaff();
    } catch {
      toast.error('Failed to delete staff');
    }
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>Staff</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 4 }}>Create staff accounts and generate printable ID cards.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
          <Plus size={15} /> Add Staff
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, marginBottom: 16 }}>{editingId ? 'Edit Staff' : 'Create New Staff'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-field">
              <label>Full Name</label>
              <input className="form-input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} required />
            </div>
            <div className="form-field">
              <label>Designation</label>
              <input className="form-input" value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} required placeholder="Football Coach" />
            </div>
            <div className="form-field">
              <label>Department</label>
              <input className="form-input" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} placeholder="Coaching" />
            </div>
            <div className="form-field">
              <label>Username</label>
              <input className="form-input" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="coachname" />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>ID Card Theme</label>
              <input className="form-input" type="color" value={form.theme_color} onChange={e => setForm(p => ({ ...p, theme_color: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Passport Photo</label>
              <input className="form-input" type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? (editingId ? 'Saving…' : 'Creating…') : <><Upload size={14} /> {editingId ? 'Save Changes' : 'Create Staff'}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading staff…</div> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Contact</th>
                <th>Theme</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.photo_url ? <img src={item.photo_url} alt={item.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserCheck size={16} color="var(--navy)" />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>{item.designation}</td>
                  <td>{item.department}</td>
                  <td style={{ fontSize: 13 }}>{item.email || item.phone || '—'}</td>
                  <td><span style={{ padding: '4px 8px', borderRadius: 999, background: item.theme_color || '#0F766E', color: 'white', fontSize: 12 }}>{item.theme_color || '#0F766E'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => startEdit(item)}><Pencil size={14} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
