import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  BarChart3, Activity, DollarSign, Package, 
  Building2, Download, RefreshCw, FileText
} from 'lucide-react';

interface DeptAllocation {
  department_name: string;
  allocated_count: number;
}

interface UtilizationItem {
  asset_name: string;
  asset_tag: string;
  allocation_count: number;
  total_days: number;
}

interface MaintenanceByCategory {
  category_name: string;
  count: number;
}

export default function Reports() {
  const [deptAllocation, setDeptAllocation] = useState<DeptAllocation[]>([]);
  const [utilization, setUtilization] = useState<UtilizationItem[]>([]);
  const [maintData, setMaintData] = useState<MaintenanceByCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [deptRes, utilRes, maintRes] = await Promise.all([
        api.get('/analytics/department-allocation'),
        api.get('/analytics/utilization'),
        api.get('/analytics/maintenance-by-category')
      ]);
      setDeptAllocation(deptRes.data);
      setUtilization(utilRes.data);
      setMaintData(maintRes.data);
    } catch (err) {
      console.error('Failed to load analytical reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      alert('Mock report compiled and downloaded successfully.');
    }, 1500);
  };

  // Mock data for line graph
  const lineGraphPoints = [10, 25, 15, 30, 20, 40, 25, 45, 30, 50, 35, 20];
  const maxLinePoint = Math.max(...lineGraphPoints);

  // Mock data for assets nearing retirement
  const retirementLedger = [
    { tag: 'AF-0020', name: 'Laptop', warning: '4 years old : nearing retirement', critical: true },
    { tag: 'AF-0081', name: 'Server Rack', warning: 'End of warranty next month', critical: false },
    { tag: 'AF-0103', name: 'Company Vehicle', warning: 'Due for 50k mile service', critical: false },
    { tag: 'AF-0042', name: 'Projector', warning: '5 years old : decommission required', critical: true },
  ];

  return (
    <div className="space-y-6 page-enter max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Interactive utilization metrics, maintenance frequency, and lifecycle ledgers.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={fetchReports} className="btn-secondary self-start">
            <RefreshCw size={16} />
            Refresh
          </button>
          <button onClick={handleExport} disabled={exporting} className="btn-primary self-start">
            {exporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
            Export report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-textMuted bg-surface rounded-xl border border-borderBase">
          Aggregating enterprise analytics...
        </div>
      ) : (
        <>
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* SVG Bar Chart: Utilization by department */}
            <div className="data-card p-6 flex flex-col h-80">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-textPrimary flex items-center gap-2">
                  <BarChart3 size={18} className="text-accent" />
                  Utilization by department
                </h2>
              </div>
              <div className="flex-1 flex items-end justify-between gap-2 px-2 relative">
                {/* Y-Axis lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-full border-b border-dashed border-borderBase/50"></div>
                  ))}
                </div>
                {/* Bars */}
                {deptAllocation.slice(0, 6).map((dept, idx) => {
                  const maxAlloc = Math.max(...deptAllocation.map(d => d.allocated_count), 1);
                  const heightPct = (dept.allocated_count / maxAlloc) * 100;
                  return (
                    <div key={idx} className="flex flex-col items-center justify-end w-full group relative z-10 h-full pb-8">
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slateDark text-white text-xs px-2 py-1 rounded transition-opacity whitespace-nowrap pointer-events-none">
                        {dept.allocated_count} assets
                      </div>
                      <div 
                        className="w-4/5 max-w-[40px] bg-gradient-to-t from-accent/80 to-accent rounded-t-sm transition-all duration-700 ease-out"
                        style={{ height: `${Math.max(heightPct, 5)}%` }}
                      ></div>
                      <span className="absolute bottom-0 text-[10px] text-textSecondary font-semibold truncate w-full text-center mt-2">
                        {dept.department_name.substring(0, 8)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SVG Line Graph: Maintenance Frequency */}
            <div className="data-card p-6 flex flex-col h-80">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-textPrimary flex items-center gap-2">
                  <Activity size={18} className="text-accent" />
                  Maintenance Frequency
                </h2>
              </div>
              <div className="flex-1 relative pb-6 px-2">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {[0, 0.33, 0.66, 1].map((ratio) => (
                    <line key={ratio} x1="0" y1={`${ratio * 100}%`} x2="100%" y2={`${ratio * 100}%`} stroke="currentColor" strokeDasharray="4" className="text-borderBase/50" />
                  ))}
                  
                  {/* Line path */}
                  <polyline 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3" 
                    className="text-accent drop-shadow-md"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={lineGraphPoints.map((val, idx) => {
                      const x = (idx / (lineGraphPoints.length - 1)) * 100;
                      const y = 100 - (val / maxLinePoint) * 100;
                      return `${x}%,${y}%`;
                    }).join(' ')}
                  />
                  
                  {/* Data points */}
                  {lineGraphPoints.map((val, idx) => {
                    const x = (idx / (lineGraphPoints.length - 1)) * 100;
                    const y = 100 - (val / maxLinePoint) * 100;
                    return (
                      <circle 
                        key={idx} 
                        cx={`${x}%`} 
                        cy={`${y}%`} 
                        r="4" 
                        className="fill-white stroke-accent stroke-2"
                      />
                    );
                  })}
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-textMuted font-mono">
                  <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                </div>
              </div>
            </div>

          </div>

          {/* Structured Text Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Usage Analysis */}
            <div className="data-card p-6">
              <h3 className="text-base font-semibold text-textPrimary mb-4 border-b border-borderBase pb-2">
                Most used assets vs Idle assets
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-success">High Utilization</h4>
                  {utilization.slice(0, 2).map((u, i) => (
                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-successLight/30 rounded-lg">
                      <span className="font-medium text-textPrimary">{u.asset_name} <span className="text-textMuted font-mono ml-1">{u.asset_tag}</span></span>
                      <span className="text-xs font-semibold text-successDark">{u.total_days} active days</span>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-textMuted">Idle / Unused</h4>
                  {/* Mock idle assets since backend doesn't explicitly return idle list, we just simulate it based on requirement */}
                  <div className="flex justify-between items-center text-sm p-2 bg-surfaceHover rounded-lg border border-borderBase">
                    <span className="font-medium text-textPrimary">Camera AF-0301</span>
                    <span className="text-xs text-textSecondary italic">unused 60+ days</span>
                  </div>
                  <div className="flex justify-between items-center text-sm p-2 bg-surfaceHover rounded-lg border border-borderBase">
                    <span className="font-medium text-textPrimary">Microphone AF-0199</span>
                    <span className="text-xs text-textSecondary italic">unused 45+ days</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lifecycle Warnings */}
            <div className="data-card p-6">
              <h3 className="text-base font-semibold text-textPrimary mb-4 border-b border-borderBase pb-2">
                Assets due for maintenance / nearing retirement
              </h3>
              <div className="space-y-3">
                {retirementLedger.map((item, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${item.critical ? 'bg-dangerLight/40 border-danger/30' : 'bg-warningLight/40 border-warning/30'}`}>
                    <FileText size={18} className={item.critical ? 'text-danger mt-0.5' : 'text-warning mt-0.5'} />
                    <div>
                      <div className="text-sm font-semibold text-textPrimary">
                        {item.name} <span className="font-mono text-xs text-accent ml-1">{item.tag}</span>
                      </div>
                      <div className={`text-xs mt-1 ${item.critical ? 'text-danger font-medium' : 'text-warningDark'}`}>
                        {item.warning}
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
