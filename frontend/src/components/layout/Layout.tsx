import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Boxes, LayoutDashboard, Building2, PackageSearch, 
  ArrowRightLeft, CalendarClock, Wrench, ShieldCheck, 
  LineChart, ScrollText, LogOut, Menu, X
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/assets', label: 'Directory', icon: PackageSearch },
  { path: '/allocations', label: 'Allocations', icon: ArrowRightLeft },
  { path: '/bookings', label: 'Bookings', icon: CalendarClock },
  { path: '/maintenance', label: 'Maintenance', icon: Wrench },
  { path: '/audits', label: 'Audits', icon: ShieldCheck },
  { path: '/reports', label: 'Reports', icon: LineChart },
  { path: '/logs', label: 'Activity Logs', icon: ScrollText },
];

export function Sidebar({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-nav text-white flex flex-col transition-transform duration-300
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <div className="flex items-center gap-2 text-accent font-semibold text-lg">
            <Boxes size={24} />
            <span>AssetFlow</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slateLight hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold uppercase">
              {user?.full_name.charAt(0)}
            </div>
            <div>
              <div className="font-medium text-sm truncate w-40">{user?.full_name}</div>
              <div className="text-xs text-slateLight capitalize">{user?.role.replace('_', ' ')}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-4">
                <span className="text-xs font-semibold text-slateLight uppercase tracking-wider">Admin</span>
              </div>
              <NavLink
                to="/org-setup"
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Building2 size={18} />
                Organization Setup
              </NavLink>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slateDark hover:bg-slate-100 rounded-lg"
        >
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
