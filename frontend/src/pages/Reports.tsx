import { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  BarChart3, Activity, Download, RefreshCw, FileText,
  Sparkles, CheckCircle2, Loader2, Wrench, ShieldAlert
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

interface PredictiveAssetRisk {
  asset_id: number;
  asset_name: string;
  asset_tag: string;
  category_name: string | null;
  risk_score: number;
  predictive_alert: boolean;
  risk_factors: Record<string, number>;
  last_maintenance_days: number | null;
  total_booking_hours: number;
  asset_age_days: number;
}

export default function Reports() {
  const [deptAllocation, setDeptAllocation] = useState<DeptAllocation[]>([]);
  const [utilization, setUtilization] = useState<UtilizationItem[]>([]);
  const [maintData, setMaintData] = useState<MaintenanceByCategory[]>([]);
  const [predictiveRisks, setPredictiveRisks] = useState<PredictiveAssetRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [schedulingId, setSchedulingId] = useState<number | null>(null);
  const [scheduledSuccess, setScheduledSuccess] = useState<number | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [deptRes, utilRes, maintRes, predRes] = await Promise.all([
        api.get('/analytics/department-allocation'),
        api.get('/analytics/utilization'),
        api.get('/analytics/maintenance-by-category'),
        api.get('/ai/predictive-maintenance')
      ]);
      setDeptAllocation(deptRes.data);
      setUtilization(utilRes.data);
      setMaintData(maintRes.data);
      setPredictiveRisks(predRes.data);
    } catch (err) {
      console.error('Failed to load analytical reports', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePreventive = async (item: PredictiveAssetRisk) => {
    setSchedulingId(item.asset_id);
    try {
      await api.post('/maintenance/', {
        asset_id: item.asset_id,
        issue_description: `Preventive Maintenance Scheduled by AI Engine (Failure Risk Score: ${Math.round(item.risk_score * 100)}% | Risk Factors: Age ${item.asset_age_days}d, Maint Gap ${item.last_maintenance_days ?? 'N/A'}d, Runtime ${item.total_booking_hours}h)`,
        priority: item.risk_score >= 0.80 ? 'critical' : 'high'
      });
      setScheduledSuccess(item.asset_id);
      setTimeout(() => setScheduledSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to schedule preventive maintenance', err);
      alert('Failed to schedule maintenance ticket.');
    } finally {
      setSchedulingId(null);
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
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {[0, 0.33, 0.66, 1].map((ratio) => (
                    <line key={ratio} x1="0" y1={ratio * 100} x2="100" y2={ratio * 100} stroke="currentColor" strokeDasharray="4" className="text-borderBase/50" />
                  ))}
                  
                  {/* Line path */}
                  <polyline 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    className="text-accent drop-shadow-md"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={lineGraphPoints.map((val, idx) => {
                      const x = (idx / (lineGraphPoints.length - 1)) * 100;
                      const y = 100 - (val / maxLinePoint) * 100;
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                  
                  {/* Data points */}
                  {lineGraphPoints.map((val, idx) => {
                    const x = (idx / (lineGraphPoints.length - 1)) * 100;
                    const y = 100 - (val / maxLinePoint) * 100;
                    return (
                      <circle 
                        key={idx} 
                        cx={x} 
                        cy={y} 
                        r="2" 
                        className="fill-white stroke-accent stroke-2"
                      />
                    );
                  })}
                </svg>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-textMuted font-mono">
                  <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                </div>
              </div>
              {maintData.length > 0 && (
                <div className="mt-4 pt-3 border-t border-borderBase flex flex-wrap gap-2">
                  {maintData.map((cat, idx) => (
                    <span key={idx} className="text-[11px] px-2.5 py-1 bg-surfaceHover rounded-lg text-textSecondary border border-borderBase font-medium">
                      {cat.category_name}: <strong className="text-textPrimary ml-1">{cat.count}</strong>
                    </span>
                  ))}
                </div>
              )}
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

            {/* Lifecycle Warnings & AI Predictive Maintenance */}
            <div className="data-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-borderBase pb-2">
                  <h3 className="text-base font-semibold text-textPrimary flex items-center gap-2">
                    <Sparkles size={16} className="text-accent animate-pulse" />
                    Predictive Maintenance Forecasting
                  </h3>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-textMuted px-2 py-0.5 rounded bg-surfaceHover border border-borderBase">
                    AI Risk Engine
                  </span>
                </div>

                <p className="text-xs text-textSecondary mb-4 leading-relaxed">
                  Calculated Failure Risk Scores based on asset age, maintenance intervals, physical condition, and cumulative operational runtime.
                </p>

                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {predictiveRisks.length > 0 ? (
                    predictiveRisks.slice(0, 5).map((item) => {
                      const riskPct = Math.round(item.risk_score * 100);
                      const isHighRisk = item.predictive_alert || item.risk_score > 0.80;
                      const isMediumRisk = !isHighRisk && item.risk_score > 0.45;
                      const isSuccess = scheduledSuccess === item.asset_id;

                      return (
                        <div
                          key={item.asset_id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isHighRisk
                              ? 'bg-dangerLight/20 border-danger/40 shadow-[0_0_12px_rgba(239,68,68,0.08)]'
                              : isMediumRisk
                              ? 'bg-warningLight/20 border-warning/30'
                              : 'bg-surfaceHover/50 border-borderBase/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-textPrimary">{item.asset_name}</span>
                                <span className="font-mono text-[10px] font-bold text-accent bg-accentLight px-1.5 py-0.5 rounded">
                                  {item.asset_tag}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-textMuted mt-1">
                                <span>Age: {item.asset_age_days}d</span>
                                <span>•</span>
                                <span>Runtime: {item.total_booking_hours}h</span>
                                {item.last_maintenance_days !== null && (
                                  <>
                                    <span>•</span>
                                    <span>Last Maint: {item.last_maintenance_days}d ago</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                                  isHighRisk
                                    ? 'bg-danger text-white'
                                    : isMediumRisk
                                    ? 'bg-warning text-slateDark'
                                    : 'bg-info/20 text-info font-medium'
                                }`}
                              >
                                {riskPct}% Risk
                              </span>
                            </div>
                          </div>

                          {/* Linear progress metric bar */}
                          <div className="w-full bg-surfaceCard rounded-full h-2 mb-3 overflow-hidden border border-borderBase/50">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                isHighRisk
                                  ? 'bg-gradient-to-r from-warning to-danger'
                                  : isMediumRisk
                                  ? 'bg-warning'
                                  : 'bg-info'
                              }`}
                              style={{ width: `${riskPct}%` }}
                            />
                          </div>

                          {/* Quick-action schedule button */}
                          {(isHighRisk || isMediumRisk) && (
                            <div className="flex items-center justify-between pt-1 border-t border-borderBase/40">
                              <span className="text-[11px] font-medium text-textSecondary flex items-center gap-1">
                                {isHighRisk && <ShieldAlert size={13} className="text-danger shrink-0" />}
                                {isHighRisk ? 'Immediate preventive action advised' : 'Scheduled maintenance recommended'}
                              </span>
                              <button
                                onClick={() => handleSchedulePreventive(item)}
                                disabled={schedulingId === item.asset_id || isSuccess}
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                                  isSuccess
                                    ? 'bg-successLight text-successDark border border-success/30'
                                    : isHighRisk
                                    ? 'bg-danger hover:bg-danger/90 text-white shadow-sm'
                                    : 'btn-secondary text-[11px] py-1 px-2'
                                }`}
                              >
                                {schedulingId === item.asset_id ? (
                                  <>
                                    <Loader2 size={12} className="animate-spin" />
                                    <span>Scheduling...</span>
                                  </>
                                ) : isSuccess ? (
                                  <>
                                    <CheckCircle2 size={12} className="text-success" />
                                    <span>Ticket Created!</span>
                                  </>
                                ) : (
                                  <>
                                    <Wrench size={12} />
                                    <span>Schedule Preventive Maintenance</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    retirementLedger.map((item, i) => (
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
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
