import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Check, X, Loader2, FileCheck, Users, 
  MapPin, AlertTriangle, ChevronLeft, CalendarClock
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface AuditCycle {
  id: number;
  name?: string;
  title?: string;
  scope_type?: string;
  scope_id?: number | null;
  status: 'planned' | 'in_progress' | 'closed' | 'open';
  date_from?: string;
  start_date?: string;
  date_to?: string | null;
  end_date?: string | null;
  total_items?: number;
  verified_items?: number;
  created_by?: { full_name: string; email: string };
  creator?: { full_name: string; email: string };
}

interface AuditItem {
  id: number;
  audit_cycle_id: number;
  asset_id: number;
  status: 'pending' | 'verified' | 'missing' | 'damaged';
  verified_by_id: number | null;
  verified_at: string | null;
  notes: string | null;
  asset: { id: number; name: string; asset_tag: string; location: string };
}

export default function Audits() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<AuditCycle | null>(null);
  
  const [checklist, setChecklist] = useState<AuditItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);

  // New cycle form
  const [title, setTitle] = useState('');
  const [scopeType, setScopeType] = useState('all');
  const [selectedDeptId, setSelectedDeptId] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchCycles = async () => {
    setLoading(true);
    try {
      const [res, deptsRes] = await Promise.all([
        api.get('/audits/'),
        api.get('/departments/')
      ]);
      setCycles(res.data);
      setDepartments(deptsRes.data);
      if (deptsRes.data.length > 0 && !selectedDeptId) {
        setSelectedDeptId(deptsRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load audit cycles', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  const openCycleChecklist = async (cycle: AuditCycle) => {
    setSelectedCycle(cycle);
    setLoadingChecklist(true);
    try {
      const res = await api.get(`/audits/${cycle.id}`);
      setChecklist(res.data.items || []);
    } catch (err) {
      console.error('Failed to load checklist', err);
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const res = await api.post('/audits/', {
        name: title,
        date_from: now.toISOString(),
        date_to: nextWeek.toISOString(),
        department_id: scopeType === 'department' ? selectedDeptId : null
      });
      setIsModalOpen(false);
      setTitle('');
      await fetchCycles();
      openCycleChecklist(res.data);
    } catch (err) {
      console.error('Failed to create audit cycle', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyItem = async (itemId: number, newStatus: 'verified' | 'missing' | 'damaged') => {
    if (!selectedCycle) return;
    
    // Optimistic update
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, status: newStatus } : item
    ));

    try {
      await api.patch(`/audits/${selectedCycle.id}/items/${itemId}`, {
        status: newStatus,
        notes: `Audited and marked ${newStatus}`
      });
      // Optionally fetch cycles in background to update counts
      api.get('/audits/').then(res => setCycles(res.data));
    } catch (err) {
      console.error('Failed to verify item', err);
      // Revert if error
      if (selectedCycle) openCycleChecklist(selectedCycle);
    }
  };

  const handleCloseCycle = async () => {
    if (!selectedCycle) return;
    if (!window.confirm('Close this audit cycle? Any items marked missing will be updated in the system.')) return;
    setSubmitting(true);
    try {
      await api.post(`/audits/${selectedCycle.id}/close`);
      setSelectedCycle(null);
      fetchCycles();
    } catch (err) {
      console.error('Failed to close audit cycle', err);
    } finally {
      setSubmitting(false);
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'asset_manager';

  // Live Discrepancy Calculation
  const flaggedCount = useMemo(() => {
    return checklist.filter(item => item.status === 'missing' || item.status === 'damaged').length;
  }, [checklist]);

  if (selectedCycle) {
    const cycleName = selectedCycle.name || selectedCycle.title;
    const startDate = selectedCycle.date_from || selectedCycle.start_date;
    const endDate = selectedCycle.date_to || selectedCycle.end_date;

    return (
      <div className="space-y-6 page-enter max-w-6xl mx-auto flex flex-col h-[calc(100vh-120px)]">
        {/* Active Cycle Identifier Header */}
        <div className="bg-slateDark text-white p-6 rounded-2xl shadow-float flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <div className="relative z-10 flex items-start gap-4">
            <button 
              onClick={() => setSelectedCycle(null)}
              className="mt-1 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="badge bg-accent text-white border-none font-bold tracking-widest text-[10px] uppercase">
                  Active Audit
                </span>
                <span className={`badge border-none font-bold tracking-widest text-[10px] uppercase ${selectedCycle.status === 'closed' ? 'bg-white/20 text-white' : 'bg-success/20 text-successLight'}`}>
                  {selectedCycle.status === 'closed' ? 'CLOSED' : 'IN PROGRESS'}
                </span>
              </div>
              <h1 className="text-2xl font-bold">{cycleName}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-white/70">
                <div className="flex items-center gap-1.5">
                  <CalendarClock size={16} />
                  {startDate ? format(parseISO(startDate), 'd MMM') : 'N/A'} - {endDate ? format(parseISO(endDate), 'd MMM') : 'Ongoing'}
                </div>
                <div className="flex items-center gap-1.5">
                  <Users size={16} />
                  Auditor: {selectedCycle.creator?.full_name || selectedCycle.created_by?.full_name || user?.full_name}
                </div>
              </div>
            </div>
          </div>
          
          {selectedCycle.status !== 'closed' && canManage && (
            <button 
              onClick={handleCloseCycle}
              disabled={submitting}
              className="btn-primary bg-white text-slateDark hover:bg-slate-100 border-none shadow-xl relative z-10 whitespace-nowrap"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
              Close Audit Cycle
            </button>
          )}
        </div>

        {/* 3-Column Verification Table */}
        <div className="data-card flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm relative">
              <thead className="bg-surface sticky top-0 z-10 text-textSecondary font-semibold border-b border-borderBase">
                <tr>
                  <th className="px-6 py-4 w-1/3">Asset</th>
                  <th className="px-6 py-4 w-1/3">Expected Location</th>
                  <th className="px-6 py-4 w-1/3 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderBase">
                {loadingChecklist ? (
                  <tr><td colSpan={3} className="p-12 text-center text-textMuted"><Loader2 className="animate-spin inline mr-2" /> Loading checklist...</td></tr>
                ) : checklist.length === 0 ? (
                  <tr><td colSpan={3} className="p-12 text-center text-textMuted">No items in this audit scope.</td></tr>
                ) : (
                  checklist.map(item => (
                    <tr key={item.id} className="hover:bg-surfaceHover/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs font-bold text-accent mb-1">{item.asset.asset_tag}</div>
                        <div className="font-semibold text-textPrimary">{item.asset.name}</div>
                      </td>
                      <td className="px-6 py-4 text-textSecondary flex items-center gap-2 mt-2">
                        <MapPin size={16} className="text-textMuted" />
                        {item.asset.location || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {selectedCycle.status === 'closed' ? (
                          <span className={`badge ${
                            item.status === 'verified' ? 'badge-success' :
                            item.status === 'missing' ? 'badge-danger' :
                            item.status === 'damaged' ? 'badge-warning' : 'badge-neutral'
                          }`}>
                            {item.status.toUpperCase()}
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleVerifyItem(item.id, 'verified')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border-2 flex items-center gap-1
                                ${item.status === 'verified' 
                                  ? 'bg-success/10 border-success text-success shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                                  : 'border-borderBase text-textMuted hover:border-success/50 hover:text-success'}`}
                            >
                              <Check size={14} /> Verified
                            </button>
                            <button
                              onClick={() => handleVerifyItem(item.id, 'damaged')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border-2
                                ${item.status === 'damaged' 
                                  ? 'bg-warning/10 border-warning text-warning shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                                  : 'border-borderBase text-textMuted hover:border-warning/50 hover:text-warning'}`}
                            >
                              Damaged
                            </button>
                            <button
                              onClick={() => handleVerifyItem(item.id, 'missing')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border-2 flex items-center gap-1
                                ${item.status === 'missing' 
                                  ? 'bg-danger/10 border-danger text-danger shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                                  : 'border-borderBase text-textMuted hover:border-danger/50 hover:text-danger'}`}
                            >
                              <X size={14} /> Missing
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Live Discrepancy Aggregator */}
          {flaggedCount > 0 && selectedCycle.status !== 'closed' && (
            <div className="bg-warningLight/50 border-t border-warning/30 p-4 shrink-0 flex items-center justify-center gap-3 animate-fade-in">
              <AlertTriangle size={18} className="text-warning font-bold" />
              <span className="text-sm font-semibold text-warningDark">
                [{flaggedCount}] assets flagged - discrepancy report generated automatically
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Cycles List View
  return (
    <div className="space-y-6 page-enter max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Audits</h1>
          <p className="page-subtitle">Initiate verification cycles and reconcile missing hardware.</p>
        </div>

        {canManage && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary self-start">
            <Plus size={16} />
            Start New Audit Cycle
          </button>
        )}
      </div>

      <div className="data-card">
        {loading ? (
          <div className="p-12 text-center text-textMuted"><Loader2 className="animate-spin inline mr-2" /> Loading cycles...</div>
        ) : cycles.length === 0 ? (
          <div className="p-12 text-center text-textMuted">No audit cycles found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-textSecondary font-semibold border-b border-borderBase">
                <tr>
                  <th className="px-6 py-4">Audit Campaign</th>
                  <th className="px-6 py-4">Scope</th>
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderBase">
                {cycles.map((c) => {
                  const progress = c.total_items ? (c.verified_items! / c.total_items) * 100 : 0;
                  return (
                    <tr 
                      key={c.id}
                      onClick={() => openCycleChecklist(c)}
                      className="hover:bg-surfaceHover cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-textPrimary">{c.name || c.title}</div>
                        <div className="text-xs text-textMuted mt-1">
                          Started: {c.date_from || c.start_date ? format(parseISO((c.date_from || c.start_date)!), 'MMM d, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 capitalize text-textSecondary">
                        {c.scope_type}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-textPrimary mb-1.5">
                          <span>{c.verified_items} / {c.total_items} verified</span>
                          <span className="text-textMuted font-medium">({Math.round(progress)}%)</span>
                        </div>
                        <div className="w-32 bg-borderBase h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${progress === 100 ? 'bg-success' : 'bg-accent'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${
                          c.status === 'closed' ? 'badge-neutral' : 
                          c.status === 'in_progress' || c.status === 'open' ? 'badge-info' : 'badge-neutral'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-accent hover:text-accentHover font-bold text-xs uppercase tracking-wider">
                          Open →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Audit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="modal-header">
              <h3 className="font-semibold text-textPrimary">Start Inventory Audit</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-textMuted hover:text-textPrimary hover:bg-surfaceHover p-1.5 rounded-lg transition-colors">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleCreateCycle}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label className="form-label">Audit Cycle Title</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Q3 Organization-Wide Hardware Scan" 
                    className="form-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Audit Scope</label>
                  <select 
                    className="form-select"
                    value={scopeType}
                    onChange={e => setScopeType(e.target.value)}
                  >
                    <option value="all">All Organization Assets</option>
                    <option value="department">Specific Department</option>
                  </select>
                </div>

                {scopeType === 'department' && (
                  <div className="form-group">
                    <label className="form-label">Select Department</label>
                    <select 
                      className="form-select"
                      value={selectedDeptId}
                      onChange={e => setSelectedDeptId(Number(e.target.value))}
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting && <Loader2 size={16} className="animate-spin mr-1" />}
                  Generate Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
