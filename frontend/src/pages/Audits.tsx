import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  ClipboardCheck, Plus, CheckCircle2, Clock, AlertTriangle, 
  X, Loader2, ShieldCheck, Check, AlertCircle, FileCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface AuditCycle {
  id: number;
  name?: string;
  title?: string;
  scope_type?: string;
  scope_id?: number | null;
  status: 'planned' | 'in_progress' | 'closed';
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
  verifier?: { full_name: string } | null;
}

export default function Audits() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<AuditCycle | null>(null);
  const [checklist, setChecklist] = useState<AuditItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New cycle form
  const [title, setTitle] = useState('');
  const [scopeType, setScopeType] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  const fetchCycles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audits/');
      setCycles(res.data);
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
      await api.post('/audits/', {
        title,
        scope_type: scopeType,
        scope_id: null
      });
      setIsModalOpen(false);
      setTitle('');
      fetchCycles();
    } catch (err) {
      console.error('Failed to create audit cycle', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyItem = async (itemId: number, newStatus: 'verified' | 'missing' | 'damaged') => {
    if (!selectedCycle) return;
    try {
      await api.put(`/audits/${selectedCycle.id}/items/${itemId}`, {
        status: newStatus,
        notes: `Audited and marked ${newStatus}`
      });
      openCycleChecklist(selectedCycle);
      fetchCycles();
    } catch (err) {
      console.error('Failed to verify item', err);
    }
  };

  const handleCloseCycle = async () => {
    if (!selectedCycle) return;
    if (!window.confirm('Close this audit cycle? Any items still pending verification will automatically be marked LOST in the global asset registry!')) return;
    try {
      await api.post(`/audits/${selectedCycle.id}/close`);
      setSelectedCycle(null);
      fetchCycles();
    } catch (err) {
      console.error('Failed to close audit cycle', err);
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'asset_manager';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Inventory Audits</h1>
          <p className="text-baseSlate text-sm">Initiate verification cycles, reconcile missing hardware, and close audit records.</p>
        </div>

        {canManage && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary self-start">
            <Plus size={16} />
            Start New Audit Cycle
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="flex gap-6 items-start">
        {/* Cycles Table */}
        <div className={`data-card flex-1 ${selectedCycle ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="p-12 text-center text-baseSlate">Loading cycles...</div>
          ) : cycles.length === 0 ? (
            <div className="p-12 text-center text-baseSlate">No audit cycles found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-baseSlate font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Audit Campaign</th>
                    <th className="px-5 py-3.5">Scope</th>
                    <th className="px-5 py-3.5">Progress</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cycles.map((c) => (
                    <tr 
                      key={c.id}
                      onClick={() => openCycleChecklist(c)}
                      className={`cursor-pointer transition-colors ${
                        selectedCycle?.id === c.id ? 'bg-accent/5' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-nav">{c.name || c.title}</div>
                        <div className="text-xs text-slateLight">
                          Started: {c.date_from || c.start_date ? format(parseISO((c.date_from || c.start_date)!), 'MMM d, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-5 py-4 capitalize text-baseSlate">
                        {c.scope_type}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-nav">
                          <span>{c.verified_items} / {c.total_items} verified</span>
                          <span className="text-slateLight font-normal">
                            ({c.total_items ? Math.round((c.verified_items / c.total_items) * 100) : 0}%)
                          </span>
                        </div>
                        <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                          <div 
                            className="bg-accent h-full transition-all" 
                            style={{ width: `${c.total_items ? (c.verified_items / c.total_items) * 100 : 0}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`badge ${
                          c.status === 'closed' ? 'badge-neutral' : 'badge-info'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button className="text-accent hover:text-accentHover font-medium text-xs">
                          Checklist →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side Panel Checklist */}
        {selectedCycle && (
          <div className="w-full lg:w-[480px] bg-white rounded-xl border border-slate-200 shadow-float overflow-hidden flex flex-col sticky top-20">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-accent block mb-0.5">
                  Audit Checklist Scope
                </span>
                <h3 className="font-semibold text-lg text-nav">{selectedCycle.name || selectedCycle.title}</h3>
              </div>
              <button 
                onClick={() => setSelectedCycle(null)}
                className="p-1.5 text-slateLight hover:text-nav rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Checklist Items */}
            <div className="p-5 flex-1 overflow-y-auto max-h-[500px] space-y-3">
              {loadingChecklist ? (
                <div className="text-center py-8 text-baseSlate">Loading checklist...</div>
              ) : checklist.length === 0 ? (
                <div className="text-center py-8 text-baseSlate">No inventory items inside this scope.</div>
              ) : (
                checklist.map((item) => (
                  <div key={item.id} className="p-3.5 bg-surface rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs text-accent font-semibold">{item.asset.asset_tag}</div>
                        <div className="font-medium text-nav text-sm">{item.asset.name}</div>
                        <div className="text-xs text-slateLight">Expected at: {item.asset.location}</div>
                      </div>
                      <div>
                        <span className={`badge ${
                          item.status === 'verified' ? 'badge-success' :
                          item.status === 'missing' ? 'badge-danger' :
                          item.status === 'damaged' ? 'badge-warning' : 'badge-neutral'
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {selectedCycle.status === 'in_progress' && canManage && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button 
                          onClick={() => handleVerifyItem(item.id, 'verified')}
                          className="flex-1 btn-primary py-1.5 text-xs bg-success hover:bg-emerald-600 flex justify-center gap-1"
                        >
                          <Check size={14} /> Present
                        </button>
                        <button 
                          onClick={() => handleVerifyItem(item.id, 'damaged')}
                          className="btn-secondary py-1.5 text-xs text-warning hover:bg-amber-50"
                        >
                          Damaged
                        </button>
                        <button 
                          onClick={() => handleVerifyItem(item.id, 'missing')}
                          className="btn-secondary py-1.5 text-xs text-danger hover:bg-red-50"
                        >
                          Missing
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {selectedCycle.status === 'in_progress' && canManage && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={handleCloseCycle}
                  className="btn-primary w-full justify-center bg-slateDark hover:bg-nav"
                >
                  <FileCheck size={16} />
                  Finalize & Close Cycle
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Audit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-float max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-surface">
              <h3 className="font-semibold text-lg">Start Inventory Audit</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slateLight hover:text-nav">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCycle} className="p-5 space-y-4">
              <div>
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

              <div>
                <label className="form-label">Audit Scope</label>
                <select 
                  className="form-input"
                  value={scopeType}
                  onChange={e => setScopeType(e.target.value)}
                >
                  <option value="all">All Organization Assets</option>
                  <option value="category">Specific Category</option>
                  <option value="department">Specific Department</option>
                </select>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-nav flex gap-2">
                <AlertCircle size={16} className="text-accent shrink-0 mt-0.5" />
                <span>Starting this audit will automatically snapshot all active assets inside the scope and generate verification checklist items.</span>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
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
