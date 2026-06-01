import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, UserCog, FileText,
  LogOut, Menu, X, ChevronRight, KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../../components/BrandLogo';

const NAV_ITEMS = [
  { to: '/admin',            icon: LayoutDashboard, label: 'Dashboard',   exact: true },
  { to: '/admin/applicants', icon: Users,            label: 'Applicants' },
  { to: '/admin/payments',   icon: CreditCard,       label: 'Payments' },
  { to: '/admin/id-cards',   icon: FileText,         label: 'ID Cards' },
  { to: '/admin/users',      icon: UserCog,          label: 'Admin Users', roles: ['super_admin'] },
];

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', verifier: 'Verifier' };

export default function AdminLayout({ children }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandLogo width={138} compact darkBackground />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', fontSize: 14, lineHeight: 1.1 }}>UI Sport Academy</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Camp 2026</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0 8px', marginBottom: 8 }}>Menu</div>
        {NAV_ITEMS.filter(item => !item.roles || item.roles.includes(admin?.role)).map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact}
            onClick={() => setSidebarOpen(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 'var(--radius-md)',
              marginBottom: 3, fontSize: 14, fontWeight: 500,
              color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
              background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              transition: 'all .15s',
              textDecoration: 'none',
            })}
            onMouseEnter={e => { if (!e.currentTarget.style.background.includes('0.12')) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { if (!e.currentTarget.style.background.includes('0.12')) e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.06)', marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'white', fontSize: 13, flexShrink: 0 }}>
            {admin?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{ROLE_LABELS[admin?.role]}</div>
          </div>
        </div>
        <button onClick={() => { navigate('/admin/change-password'); setSidebarOpen(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', transition: 'all .15s', marginBottom: 4 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
        >
          <KeyRound size={15} /> Change Password
        </button>
        <button onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.15)'; e.currentTarget.style.color = '#FCA5A5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface)' }}>

      {/* Desktop sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: 'var(--navy)',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 50,
        display: 'flex', flexDirection: 'column',
      }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 98 }} onClick={() => setSidebarOpen(false)} />
          <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, background: 'var(--navy)', zIndex: 99, display: 'flex', flexDirection: 'column' }}>
            <button onClick={() => setSidebarOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          height: 60, background: 'var(--white)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', position: 'sticky', top: 0, zIndex: 40,
        }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSidebarOpen(true)}
            style={{ display: 'none' }}>
            <Menu size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-3)' }}>
            <span>Admin</span>
            <ChevronRight size={14} />
            <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>Management Portal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, padding: '28px 28px', overflowX: 'hidden' }}>
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
