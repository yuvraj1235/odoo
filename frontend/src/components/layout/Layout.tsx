import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Boxes, LayoutDashboard, Building2, PackageSearch,
  ArrowRightLeft, CalendarClock, Wrench, ShieldCheck,
  LineChart, ScrollText, LogOut, Menu, X, ChevronRight,
  Bell
} from 'lucide-react';

const navItems = [
  { path: '/',             label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/assets',       label: 'Directory',     icon: PackageSearch   },
  { path: '/allocations',  label: 'Allocations',   icon: ArrowRightLeft  },
  { path: '/bookings',     label: 'Bookings',      icon: CalendarClock   },
  { path: '/maintenance',  label: 'Maintenance',   icon: Wrench          },
  { path: '/audits',       label: 'Audits',        icon: ShieldCheck     },
  { path: '/reports',      label: 'Reports',       icon: LineChart       },
  { path: '/logs',         label: 'Activity Logs', icon: ScrollText      },
];

const PAGE_TITLES: Record<string, string> = {
  '/':            'Dashboard',
  '/assets':      'Asset Directory',
  '/allocations': 'Allocations',
  '/bookings':    'Bookings',
  '/maintenance': 'Maintenance',
  '/audits':      'Audits',
  '/reports':     'Reports',
  '/logs':        'Activity Logs',
  '/org-setup':   'Organization Setup',
};

// Avatar initials helper
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen flex flex-col
          w-64 bg-nav
          transition-transform duration-300 ease-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Primary navigation"
      >
        {/* Logo */}
        <div className="h-[60px] flex items-center justify-between px-5 border-b border-navBorder shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-sm">
              <Boxes size={18} strokeWidth={2} className="text-white" />
            </div>
            <span className="text-white font-heading font-bold text-base tracking-tight">
              AssetFlow
            </span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white-8 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Profile */}
        <div className="p-4 border-b border-navBorder shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-default">
            <div
              className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center
                         text-accent font-heading font-bold text-sm shrink-0"
            >
              {user?.full_name ? getInitials(user.full_name) : '?'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.full_name}</div>
              <div className="text-xs text-white/40 capitalize mt-0.5">
                {user?.role?.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 no-scrollbar">
          <div className="px-3 pb-2 pt-1">
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
              Navigation
            </span>
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => { if (window.innerWidth < 1024) onClose(); }}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={17} className="nav-icon" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="px-3 pb-2 pt-4">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                  Administration
                </span>
              </div>
              <NavLink
                to="/org-setup"
                onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Building2 size={17} className="nav-icon" aria-hidden="true" />
                <span>Organization</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-navBorder shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
                       text-sm font-medium text-white/50
                       hover:text-danger hover:bg-danger/10
                       transition-all duration-200"
            aria-label="Sign out"
          >
            <LogOut size={17} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const { user } = useAuth();
  const title = PAGE_TITLES[location.pathname] ?? 'AssetFlow';
  const crumbs = location.pathname.split('/').filter(Boolean);

  return (
    <header
      className="h-[60px] bg-surfaceCard border-b border-borderBase
                 flex items-center justify-between
                 px-4 lg:px-6 sticky top-0 z-30 shrink-0"
    >
      {/* Left: mobile toggle + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-textMuted hover:text-textPrimary hover:bg-surfaceHover rounded-xl transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-sm">
          <span className="text-textMuted font-medium">AssetFlow</span>
          {crumbs.length > 0 && (
            <>
              <ChevronRight size={14} className="text-textDisabled" aria-hidden="true" />
              <span className="text-textPrimary font-semibold">{title}</span>
            </>
          )}
          {crumbs.length === 0 && (
            <span className="text-textPrimary font-semibold ml-0.5"> / {title}</span>
          )}
        </nav>

        {/* Mobile title */}
        <h1 className="sm:hidden font-heading font-bold text-base text-textPrimary">{title}</h1>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button
          className="p-2 text-textMuted hover:text-textPrimary hover:bg-surfaceHover rounded-xl transition-colors relative"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>

        {/* Avatar pill */}
        <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-borderBase ml-1">
          <div
            className="w-8 h-8 rounded-lg bg-accentMuted flex items-center justify-center
                       text-accent font-heading font-bold text-xs"
          >
            {user?.full_name ? getInitials(user.full_name) : '?'}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium text-textPrimary leading-none">{user?.full_name}</div>
            <div className="text-xs text-textMuted capitalize mt-0.5">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-surface flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main
          id="main-content"
          className="flex-1 p-4 lg:p-6 xl:p-8 max-w-[1600px] w-full mx-auto page-enter"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
