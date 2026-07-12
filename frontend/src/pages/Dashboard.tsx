import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Package, CheckCircle2, Wrench, CalendarClock,
  ArrowRightLeft, AlertCircle, Plus, Calendar, AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface KPIs {
  assets_available: number;
  assets_allocated: number;
  maintenance_today: number;
  active_bookings: number;
  pending_transfers: number;
  upcoming_returns: number;
  overdue_returns: number;
}

interface OverdueReturn {
  allocation_id: number;
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  user_id: number;
  expected_return_date: string;
  days_overdue: number;
}

/* ── Skeleton ── */
function SkeletonCard() {
  return (
    <div className="kpi-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <div className="skeleton h-3 w-24 rounded-md" />
          <div className="skeleton h-8 w-14 rounded-lg" />
          <div className="skeleton h-2.5 w-32 rounded-md" />
        </div>
        <div className="skeleton w-12 h-12 rounded-xl" />
      </div>
    </div>
  );
}

/* ── KPI Card ── */
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  trend?: string;
  variant?: 'default' | 'alert' | 'accent';
}

function StatCard({ title, value, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  const isAlert  = variant === 'alert';
  const isAccent = variant === 'accent';

  const iconBg   = isAlert ? 'bg-danger/10 text-danger'
                 : isAccent ? 'bg-accentMuted text-accent'
                 : 'bg-surfaceHover text-accent';

  const valueCls = isAlert ? 'text-danger' : 'text-textPrimary';
  const cardCls  = isAlert ? 'kpi-card-alert' : 'kpi-card';

  return (
    <div className={cardCls}>
      {/* Left accent bar for alert variant */}
      {isAlert && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-danger rounded-l-2xl" />
      )}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-textSecondary mb-1">{title}</p>
          <p className={`text-3xl font-heading font-bold tabular-nums ${valueCls}`}>{value}</p>
          {trend && <p className="text-xs text-textMuted mt-1.5">{trend}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={22} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/* ── Feed Row ── */
function FeedRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-3 flex items-center justify-between gap-3 text-sm border-b border-borderBase/60 last:border-b-0">
      {children}
    </div>
  );
}

/* ── Main Page ── */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [overdue, setOverdue] = useState<OverdueReturn[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [activeAllocations, setActiveAllocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderSentId, setReminderSentId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpiRes, overdueRes, logsRes, allocRes] = await Promise.all([
          api.get('/analytics/kpis'),
          api.get('/analytics/overdue'),
          api.get('/activity-logs/'),
          api.get('/allocations/?status=active')
        ]);
        setKpis(kpiRes.data);
        setOverdue(overdueRes.data);
        setRecentLogs(logsRes.data.slice(0, 5));
        setActiveAllocations(allocRes.data.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const canRegisterAsset = user?.role === 'admin' || user?.role === 'asset_manager';

  return (
    <div className="space-y-6 page-enter">

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, <span className="font-semibold text-textPrimary">{user?.full_name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate('/bookings')} className="btn-secondary">
            <Calendar size={15} aria-hidden="true" />
            Book Resource
          </button>
          <button onClick={() => navigate('/maintenance')} className="btn-secondary">
            <Wrench size={15} aria-hidden="true" />
            Raise Request
          </button>
          {canRegisterAsset && (
            <button onClick={() => navigate('/assets')} className="btn-primary">
              <Plus size={15} aria-hidden="true" />
              Register Asset
            </button>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : kpis ? (
          <>
            <StatCard
              title="Available Assets"
              value={kpis.assets_available}
              icon={CheckCircle2}
            />
            <StatCard
              title="Allocated Assets"
              value={kpis.assets_allocated}
              icon={Package}
            />
            <StatCard
              title="Overdue Returns"
              value={kpis.overdue_returns}
              icon={AlertTriangle}
              variant={kpis.overdue_returns > 0 ? 'alert' : 'default'}
            />
            <StatCard
              title="Active Bookings"
              value={kpis.active_bookings}
              icon={CalendarClock}
              variant="accent"
            />
            <StatCard
              title="Pending Transfers"
              value={kpis.pending_transfers}
              icon={ArrowRightLeft}
            />
            <StatCard
              title="Maintenance Today"
              value={kpis.maintenance_today}
              icon={Wrench}
            />
          </>
        ) : null}
      </div>

      {/* Overdue Alert Table */}
      {!loading && overdue.length > 0 && (
        <div className="data-card animate-fade-in">
          <div className="px-5 py-4 border-b border-borderBase flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-dangerLight flex items-center justify-center">
              <AlertCircle size={15} className="text-danger" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-danger">Action Required</h2>
              <p className="text-xs text-textMuted">
                {overdue.length} overdue return{overdue.length !== 1 ? 's' : ''} need attention
              </p>
            </div>
          </div>

          <div className="overflow-x-auto table-scroll">
            <table className="data-table" aria-label="Overdue returns">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Tag</th>
                  <th>Expected Return</th>
                  <th>Overdue By</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map(item => (
                  <tr key={item.allocation_id}>
                    <td className="font-medium text-textPrimary">{item.asset_name}</td>
                    <td className="font-mono text-xs text-textSecondary">{item.asset_tag}</td>
                    <td className="text-textSecondary">
                      {format(parseISO(item.expected_return_date), 'MMM d, yyyy')}
                    </td>
                    <td>
                      <span className="badge badge-danger">
                        {item.days_overdue}d overdue
                      </span>
                    </td>
                    <td className="text-right">
                      {reminderSentId === item.allocation_id ? (
                        <span className="badge badge-success text-xs">Sent ✓</span>
                      ) : (
                        <button
                          onClick={() => setReminderSentId(item.allocation_id)}
                          className="text-sm font-medium text-accent hover:text-accentHover transition-colors"
                        >
                          Send Reminder
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Active Allocations Feed */}
        <div className="data-card">
          <div className="section-header px-5 pt-4 mx-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
              <Package size={16} className="text-accent" aria-hidden="true" />
              Active Hardware Custody
            </h3>
            <button
              onClick={() => navigate('/allocations')}
              className="text-xs font-medium text-accent hover:text-accentHover transition-colors"
            >
              View all →
            </button>
          </div>

          <div className="px-5 pb-4">
            {loading ? (
              <div className="space-y-3 pt-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="skeleton h-3 w-36 rounded-md" />
                      <div className="skeleton h-2.5 w-24 rounded-md" />
                    </div>
                    <div className="skeleton h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : activeAllocations.length === 0 ? (
              <div className="empty-state py-10">
                <div className="empty-state-icon">
                  <Package size={22} aria-hidden="true" />
                </div>
                <p className="text-sm text-textMuted">No active custody records.</p>
              </div>
            ) : (
              <div>
                {activeAllocations.map((a: any) => (
                  <FeedRow key={a.id}>
                    <div className="min-w-0">
                      <div className="font-medium text-textPrimary truncate">
                        {a.asset?.name || 'Asset Unit'}
                      </div>
                      <div className="text-xs text-textMuted font-mono mt-0.5">
                        {a.asset?.asset_tag || `#${a.asset_id}`}
                        {a.department?.name ? ` · ${a.department.name}` : ''}
                      </div>
                    </div>
                    <span className="badge badge-accent shrink-0">
                      {a.user?.full_name || `User #${a.user_id}`}
                    </span>
                  </FeedRow>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="data-card">
          <div className="section-header px-5 pt-4 mx-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
              <CheckCircle2 size={16} className="text-success" aria-hidden="true" />
              Recent System Activity
            </h3>
            <button
              onClick={() => navigate('/logs')}
              className="text-xs font-medium text-accent hover:text-accentHover transition-colors"
            >
              View logs →
            </button>
          </div>

          <div className="px-5 pb-4">
            {loading ? (
              <div className="space-y-3 pt-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="skeleton h-3 w-40 rounded-md" />
                      <div className="skeleton h-2.5 w-28 rounded-md" />
                    </div>
                    <div className="skeleton h-2.5 w-16 rounded-md" />
                  </div>
                ))}
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="empty-state py-10">
                <div className="empty-state-icon">
                  <CheckCircle2 size={22} aria-hidden="true" />
                </div>
                <p className="text-sm text-textMuted">No system activity recorded yet.</p>
              </div>
            ) : (
              <div>
                {recentLogs.map((log: any) => (
                  <FeedRow key={log.id}>
                    <div className="min-w-0">
                      <div className="font-medium text-textPrimary text-xs truncate">
                        {log.action || log.description || 'Action Logged'}
                      </div>
                      <div className="text-[11px] text-textMuted mt-0.5">
                        {log.user?.full_name || 'System'} · {log.ip_address || 'Internal'}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-textMuted shrink-0 whitespace-nowrap">
                      {(log.created_at || log.timestamp)
                        ? format(parseISO(log.created_at || log.timestamp), 'MMM d, HH:mm')
                        : 'Recent'}
                    </span>
                  </FeedRow>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
