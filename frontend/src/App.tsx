import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Allocations from './pages/Allocations';
import Bookings from './pages/Bookings';
import Maintenance from './pages/Maintenance';
import Audits from './pages/Audits';
import Reports from './pages/Reports';
import ActivityLogs from './pages/ActivityLogs';
import OrgSetup from './pages/OrgSetup';

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-nav flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center animate-pulse">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
            <path d="M2 7h20"/>
          </svg>
        </div>
        <p className="text-white/40 text-sm font-medium">Loading AssetFlow…</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/assets" element={<Assets />} />
              <Route path="/allocations" element={<Allocations />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/audits" element={<Audits />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/logs" element={<ActivityLogs />} />
              <Route path="/org-setup" element={<OrgSetup />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
