import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Public pages
import HomePage         from './pages/HomePage';
import RegisterPage     from './pages/RegisterPage';
import PaymentPage      from './pages/PaymentPage';
import StatusPage       from './pages/StatusPage';

// Admin pages
import AdminLogin       from './pages/admin/AdminLogin';
import AdminLayout      from './pages/admin/AdminLayout';
import AdminDashboard   from './pages/admin/AdminDashboard';
import AdminApplicants  from './pages/admin/AdminApplicants';
import AdminApplicantDetail from './pages/admin/AdminApplicantDetail';
import AdminPayments    from './pages/admin/AdminPayments';
import AdminUsers       from './pages/admin/AdminUsers';
import AdminIDCards     from './pages/admin/AdminIDCards';
import ChangePassword  from './pages/admin/ChangePassword';

const ProtectedRoute = ({ children, roles }) => {
  const { admin, isAuth } = useAuth();
  if (!isAuth) return <Navigate to="/admin/login" replace />;
  if (roles && !roles.includes(admin.role)) return <Navigate to="/admin" replace />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontFamily: 'Inter, sans-serif', fontSize: 14 },
            success: { iconTheme: { primary: '#16A34A', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/"          element={<HomePage />} />
          <Route path="/register"  element={<RegisterPage />} />
          <Route path="/payment"   element={<PaymentPage />} />
          <Route path="/status"    element={<StatusPage />} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/id-cards" element={
            <ProtectedRoute><AdminLayout><AdminIDCards /></AdminLayout></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute><AdminLayout /></ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="applicants" element={<AdminApplicants />} />
            <Route path="applicants/:id" element={<AdminApplicantDetail />} />
            <Route path="payments"   element={<AdminPayments />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="users"      element={
              <ProtectedRoute roles={['super_admin']}><AdminUsers /></ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
