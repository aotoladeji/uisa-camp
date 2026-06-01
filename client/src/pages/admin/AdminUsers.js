import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Shield, User, Check, X, Eye, EyeOff } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', color: '#7C3AED', bg: '#EDE9FE' },
  admin:       { label: 'Admin',       color: 'var(--blue)', bg: '#DBEAFE' },
  verifier:    { label: 'Verifier',    color: 'var(--amber)', bg: 'var(--amber-bg)' },
};

export default function AdminUsers() {
  const { admin: currentAdmin } = useAuth();
  const [admins, setAdmins]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'verifier' });

  const fetchAdmins = async () => {
    try {
      const { data } = await api.get('/auth/admins');
      setAdmins(data);
    } catch { toast.error('Failed to load admin users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleCreate = async e => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await api.post('/auth/create-admin', form);
      toast.success('Admin user created');
      setForm({ name: '', email: '', password: '', role: 'verifier' });
      setShowForm(false);
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create admin');
    } finally { setSaving(false); }
  };

  const toggleActive = async (id, current) => {
    try {
      await api.patch(`/auth/admins/${id}`, { is_active: current ? 0 : 1 });
      toast.success(current ? 'Account deactivated' : 'Account activated');
      fetchAdmins();
    } catch { toast.error('Update failed'); }
  };

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/auth/admins/${id}`, { role });
      toast.success('Role updated');
      fetchAdmins();
    } catch { toast.error('Update failed'); }
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--navy)' }}>Admin Users</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>Manage admin access to the portal</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
          <UserPlus size={15} /> New Admin
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card" style={{ padding: '24px 28px', marginBottom: 24, border: '1.5px solid var(--blue)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 18 }}>Create New Admin User</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div className="form-field">
                <label>Full Name <span className="req">*</span></label>
                <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="John Adeyemi" />
              </div>
              <div className="form-field">
                <label>Email Address <span className="req">*</span></label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required placeholder="john@uisportsacademy.ng" />
              </div>
              <div className="form-field">
                <label>Password <span className="req">*</span></label>
                <div style={{ position: 'relative' }}>
                  <input className="form-input" type={showPwd ? 'text' : 'password'}
                    value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required placeholder="Min. 8 characters" style={{ paddingRight: 42 }}
                  />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="form-field">
                <label>Role <span className="req">*</span></label>
                <select className="form-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="verifier">Verifier — can verify payments</option>
                  <option value="admin">Admin — full applicant management</option>
                  <option value="super_admin">Super Admin — all access</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Creating…' : <><UserPlus size={14} /> Create Admin</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admins list */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => {
                const roleCfg = ROLE_CONFIG[a.role] || ROLE_CONFIG.verifier;
                const isMe = a.id === currentAdmin?.id;
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: roleCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: roleCfg.color }}>
                          {a.name[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{a.name}{isMe && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 10 }}>you</span>}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{a.email}</td>
                    <td>
                      <select
                        value={a.role}
                        disabled={isMe || a.role === 'super_admin'}
                        onChange={e => changeRole(a.id, e.target.value)}
                        style={{ fontSize: 13, padding: '4px 10px', borderRadius: 8, border: `1px solid ${roleCfg.color}33`, background: roleCfg.bg, color: roleCfg.color, fontWeight: 600, cursor: isMe ? 'not-allowed' : 'pointer', outline: 'none' }}
                      >
                        <option value="verifier">Verifier</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        background: a.is_active ? 'var(--green-bg)' : 'var(--red-bg)',
                        color: a.is_active ? 'var(--green)' : 'var(--red)',
                      }}>
                        {a.is_active ? <Check size={11} /> : <X size={11} />}
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {a.last_login ? new Date(a.last_login).toLocaleDateString('en-NG') : 'Never'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {new Date(a.created_at).toLocaleDateString('en-NG')}
                    </td>
                    <td>
                      {!isMe && (
                        <button
                          className={`btn btn-sm ${a.is_active ? 'btn-danger' : ''}`}
                          style={!a.is_active ? { background: 'var(--green-bg)', color: 'var(--green)' } : {}}
                          onClick={() => toggleActive(a.id, a.is_active)}
                        >
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Role guide */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Shield size={14} color={cfg.color} />
              <span style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{cfg.label}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
              {key === 'super_admin' && 'Full system access. Manage admins, verify payments, update all statuses.'}
              {key === 'admin' && 'Manage applicants and update statuses. Verify and reject payments.'}
              {key === 'verifier' && 'Can only verify or reject payment receipts.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
