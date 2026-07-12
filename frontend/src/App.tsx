import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen bg-nav flex items-center justify-center text-accent">Loading...</div>;
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
              <Route path="/assets" element={<div>Directory</div>} />
              <Route path="/allocations" element={<div>Allocations</div>} />
              <Route path="/bookings" element={<div>Bookings</div>} />
              <Route path="/maintenance" element={<div>Maintenance</div>} />
              <Route path="/audits" element={<div>Audits</div>} />
              <Route path="/reports" element={<div>Reports</div>} />
              <Route path="/logs" element={<div>Activity Logs</div>} />
              <Route path="/org-setup" element={<div>Org Setup</div>} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
