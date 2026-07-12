import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
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

function StatCard({ title, value, icon: Icon, trend, variant = 'default' }: any) {
  const isAlert = variant === 'alert';
  return (
    <div className={`kpi-card relative overflow-hidden ${isAlert ? 'border-danger/30 bg-red-50/50' : ''}`}>
      {isAlert && <div className="absolute top-0 left-0 w-1 h-full bg-danger"></div>}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate mb-1">{title}</p>
          <h3 className={`text-3xl font-heading ${isAlert ? 'text-danger' : 'text-nav'}`}>{value}</h3>
          {trend && (
            <p className="text-xs text-slateLight mt-2">{trend}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isAlert ? 'bg-danger/10 text-danger' : 'bg-slate-50 text-accent'}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [overdue, setOverdue] = useState<OverdueReturn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpiRes, overdueRes] = await Promise.all([
          api.get('/analytics/kpis'),
          api.get('/analytics/overdue')
        ]);
        setKpis(kpiRes.data);
        setOverdue(overdueRes.data);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const canRegisterAsset = user?.role === 'admin' || user?.role === 'asset_manager';

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate">Loading dashboard data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
          <p className="text-slate text-sm">Welcome back, {user?.full_name}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="btn-secondary">
            <Calendar size={16} />
            Book Resource
          </button>
          <button className="btn-secondary">
            <Wrench size={16} />
            Raise Request
          </button>
          {canRegisterAsset && (
            <button className="btn-primary">
              <Plus size={16} />
              Register Asset
            </button>
          )}
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
        </div>
      )}

      {overdue.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="text-danger" size={20} />
            <h2 className="text-lg font-semibold">Action Required: Overdue Returns</h2>
          </div>
          
          <div className="data-card border-danger/20">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Asset</th>
                    <th className="px-5 py-3">Tag</th>
                    <th className="px-5 py-3">Expected Return</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdue.map(item => (
                    <tr key={item.allocation_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 font-medium text-nav">{item.asset_name}</td>
                      <td className="px-5 py-4 font-mono text-slate">{item.asset_tag}</td>
                      <td className="px-5 py-4 text-slate">
                        {format(parseISO(item.expected_return_date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-5 py-4">
                        <span className="badge badge-danger">
                          {item.days_overdue} days overdue
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button className="text-accent hover:text-accentHover font-medium transition-colors">
                          Send Reminder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
