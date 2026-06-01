import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import api from '../../utils/api';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (form.new_password.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    if (form.new_password !== form.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (form.current_password === form.new_password) {
      toast.error('New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password
      });
      toast.success('Password changed successfully!');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const PasswordInput = ({ label, name, value, show, onToggle }) => (
    <div className="form-field">
      <label>{label} <span className="req">*</span></label>
      <div style={{ position: 'relative' }}>
        <input
          className="form-input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          required
          style={{ paddingRight: 42 }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--text-3)',
            cursor: 'pointer',
            display: 'flex'
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => navigate('/admin')}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 12 }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 800,
          color: 'var(--text-1)',
          marginBottom: 6
        }}>
          Change Password
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
          Update your account password for security
        </p>
      </div>

      {/* Form Card */}
      <div className="card" style={{ maxWidth: 520, padding: 32 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'var(--blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20
        }}>
          <Lock size={22} color="white" />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <PasswordInput
            label="Current Password"
            name="current_password"
            value={form.current_password}
            show={showPasswords.current}
            onToggle={() => setShowPasswords(p => ({ ...p, current: !p.current }))}
          />

          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

          <PasswordInput
            label="New Password"
            name="new_password"
            value={form.new_password}
            show={showPasswords.new}
            onToggle={() => setShowPasswords(p => ({ ...p, new: !p.new }))}
          />

          <PasswordInput
            label="Confirm New Password"
            name="confirm_password"
            value={form.confirm_password}
            show={showPasswords.confirm}
            onToggle={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))}
          />

          {/* Password Requirements */}
          <div style={{
            padding: 14,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13
          }}>
            <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
              Password Requirements:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: form.new_password.length >= 8 ? 'var(--green)' : 'var(--text-3)'
              }}>
                <Check size={14} />
                <span>At least 8 characters</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: form.new_password && form.new_password === form.confirm_password ? 'var(--green)' : 'var(--text-3)'
              }}>
                <Check size={14} />
                <span>Passwords match</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="btn btn-outline"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
