import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  BarChart3, PieChart, TrendingUp, DollarSign, Package, 
  Building2, Calendar, Download, RefreshCw
} from 'lucide-react';

interface UtilizationData {
  total_assets: number;
  by_status: Record<string, number>;
  total_valuation: number;
}

interface DepartmentBreakdown {
  department: string;
  asset_count: number;
  total_valuation: number;
}

export default function Reports() {
  const [utilization, setUtilization] = useState<UtilizationData | null>(null);
  const [deptBreakdown, setDeptBreakdown] = useState<DepartmentBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [utilRes, deptRes] = await Promise.all([
        api.get('/analytics/utilization'),
        api.get('/analytics/department-breakdown')
      ]);
      setUtilization(utilRes.data);
      setDeptBreakdown(deptRes.data);
    } catch (err) {
      console.error('Failed to load analytical reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const getPercentage = (count: number, total: number) => {
    if (!total) return 0;
    return Math.round((count / total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Analytics & Financial Reports</h1>
          <p className="text-baseSlate text-sm">Deep-dive utilization metrics, departmental hardware distribution, and asset valuation.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={fetchReports} className="btn-secondary self-start">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={() => window.print()} className="btn-primary self-start">
            <Download size={14} />
            Export Summary
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-baseSlate bg-white rounded-xl border border-slate-200">
          Aggregating enterprise analytics...
        </div>
      ) : (
        <>
          {/* Top Level Financials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="kpi-card flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-accent rounded-xl">
                <DollarSign size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-baseSlate uppercase tracking-wider">Total Hardware Valuation</span>
                <div className="text-2xl font-bold text-nav mt-0.5">
                  ${utilization?.total_valuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="kpi-card flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-success rounded-xl">
                <Package size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-baseSlate uppercase tracking-wider">Registered Assets</span>
                <div className="text-2xl font-bold text-nav mt-0.5">
                  {utilization?.total_assets || 0} units
                </div>
              </div>
            </div>

            <div className="kpi-card flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-warning rounded-xl">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="text-xs font-semibold text-baseSlate uppercase tracking-wider">Active Custody Rate</span>
                <div className="text-2xl font-bold text-nav mt-0.5">
                  {getPercentage(utilization?.by_status['allocated'] || 0, utilization?.total_assets || 1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown Bar Chart */}
            <div className="data-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 font-semibold text-nav">
                  <PieChart size={18} className="text-accent" />
                  Asset Status Distribution
                </div>
                <span className="text-xs text-baseSlate">Total {utilization?.total_assets} items</span>
              </div>

              <div className="space-y-4 pt-2">
                {Object.entries(utilization?.by_status || {}).map(([status, count]) => {
                  const pct = getPercentage(count, utilization?.total_assets || 1);
                  const color = 
                    status === 'available' ? 'bg-success' :
                    status === 'allocated' ? 'bg-accent' :
                    status === 'under_maintenance' ? 'bg-warning' : 'bg-baseSlate';

                  return (
                    <div key={status} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize font-medium text-nav">{status.replace('_', ' ')}</span>
                        <span className="text-baseSlate font-mono">{count} units ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div className={`${color} h-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Department Breakdown */}
            <div className="data-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 font-semibold text-nav">
                  <Building2 size={18} className="text-accent" />
                  Department Valuation & Allocation
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {deptBreakdown.map((d, i) => (
                  <div key={i} className="p-3.5 bg-surface rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-nav text-sm">{d.department}</div>
                      <div className="text-xs text-slateLight">{d.asset_count} assigned hardware units</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-nav text-sm">
                        ${d.total_valuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-accent font-medium">
                        {getPercentage(d.asset_count, utilization?.total_assets || 1)}% of fleet
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
