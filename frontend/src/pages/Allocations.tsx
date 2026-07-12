import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowRightLeft, CheckCircle2, History, AlertTriangle, 
  UserCheck, Send, Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Asset {
  id: number;
  name: string;
  asset_tag: string;
  status: string;
}

interface User {
  id: number;
  full_name: string;
  department?: { id: number; name: string };
}

interface AllocationHistory {
  id: number;
  allocated_at: string;
  returned_at: string | null;
  status: string;
  condition_notes: string | null;
  user: { full_name: string; email: string };
}

export default function Allocations() {
  useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  
  const [selectedAssetId, setSelectedAssetId] = useState<number | ''>('');
  const [assetHistory, setAssetHistory] = useState<AllocationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Forms state
  const [assignUserId, setAssignUserId] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Conflict state
  const [conflictData, setConflictData] = useState<{ holder_name: string; dept_name: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [assetsRes, usersRes] = await Promise.all([
          api.get('/assets/'),
          api.get('/users/')
        ]);
        setAssets(assetsRes.data);
        setUsersList(usersRes.data);
      } catch (err) {
        console.error('Failed to load initial data', err);
      }
    };
    fetchInitialData();
  }, []);

  // When asset is selected, fetch its history and check availability
  useEffect(() => {
    if (!selectedAssetId) {
      setAssetHistory([]);
      setConflictData(null);
      setSuccessMsg('');
      return;
    }
    
    const fetchAssetInfo = async () => {
      setLoadingHistory(true);
      setConflictData(null);
      setSuccessMsg('');
      try {
        const historyRes = await api.get(`/assets/${selectedAssetId}/history`);
        setAssetHistory(historyRes.data);
        
        // Find current active allocation if any
        const activeAlloc = historyRes.data.find((h: any) => h.status === 'active');
        if (activeAlloc) {
          setConflictData({
            holder_name: activeAlloc.user.full_name,
            dept_name: 'Unknown Dept' // If available in API, use it. But for now, fallback
          });
        }
      } catch (err) {
        console.error('Failed to fetch asset history', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchAssetInfo();
  }, [selectedAssetId]);

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !assignUserId) return;
    setSubmitting(true);
    setSuccessMsg('');
    
    try {
      await api.post('/allocations/', {
        asset_id: Number(selectedAssetId),
        user_id: Number(assignUserId),
        department_id: null,
        expected_return_date: null,
        condition_notes: 'Direct allocation'
      });
      setSuccessMsg('Asset allocated successfully!');
      // Refresh history
      const historyRes = await api.get(`/assets/${selectedAssetId}/history`);
      setAssetHistory(historyRes.data);
      const activeAlloc = historyRes.data.find((h: any) => h.status === 'active');
      if (activeAlloc) {
        setConflictData({ holder_name: activeAlloc.user.full_name, dept_name: 'Unknown Dept' });
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        const detail = err.response.data.detail;
        setConflictData({
          holder_name: detail.current_holder || 'Unknown',
          dept_name: 'Department'
        });
      } else {
        console.error('Failed to allocate', err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !assignUserId) return;
    setSubmitting(true);
    setSuccessMsg('');
    
    try {
      await api.post('/allocations/transfers', {
        asset_id: Number(selectedAssetId),
        to_user_id: Number(assignUserId),
        notes: transferNotes
      });
      setSuccessMsg('Transfer request submitted successfully!');
      setTransferNotes('');
    } catch (err) {
      console.error('Failed to request transfer', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 page-enter max-w-5xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Allocation & Transfer</h1>
          <p className="page-subtitle">Assign custody, resolve conflicts, and view chronological history.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Asset Selection & Form */}
        <div className="space-y-6">
          <div className="data-card p-6">
            <h2 className="text-lg font-semibold text-textPrimary mb-4">Select Asset</h2>
            <div className="form-group mb-4">
              <label className="form-label">Search & Select Asset</label>
              <select 
                className="form-select"
                value={selectedAssetId}
                onChange={e => setSelectedAssetId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">-- Choose an asset --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>
                ))}
              </select>
            </div>

            {selectedAssetId !== '' && (
              <div className="mt-6 pt-6 border-t border-borderBase animate-fade-in">
                {conflictData ? (
                  <div className="space-y-4">
                    {/* High-visibility alert block */}
                    <div className="p-4 bg-dangerLight border border-danger/30 rounded-xl flex items-start gap-3">
                      <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-danger">Conflict Detected</h3>
                        <p className="text-sm text-danger/90 mt-1">
                          Already Allocated to <strong>{conflictData.holder_name}</strong>. 
                          Direct re-allocation is blocked - submit a transfer request below.
                        </p>
                      </div>
                    </div>

                    {/* Transfer Request Form */}
                    <form onSubmit={handleTransferRequest} className="space-y-4 bg-surfaceCard p-4 rounded-xl border border-borderBase">
                      <h4 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
                        <ArrowRightLeft size={16} className="text-accent" />
                        Transfer Request
                      </h4>
                      <div className="form-group">
                        <label className="form-label">From (Current Holder)</label>
                        <input 
                          type="text" 
                          className="form-input bg-surfaceHover text-textSecondary cursor-not-allowed" 
                          value={conflictData.holder_name} 
                          disabled 
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">To (New Employee)</label>
                        <select 
                          className="form-select"
                          value={assignUserId}
                          onChange={e => setAssignUserId(Number(e.target.value))}
                          required
                        >
                          <option value="">-- Select employee --</option>
                          {usersList.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Reason</label>
                        <textarea 
                          rows={3}
                          className="form-input"
                          placeholder="Why is this transfer needed?"
                          value={transferNotes}
                          onChange={e => setTransferNotes(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" disabled={submitting} className="btn-primary w-full">
                        {submitting && <Loader2 size={16} className="animate-spin" />}
                        <Send size={16} />
                        Submit Request
                      </button>
                    </form>
                  </div>
                ) : (
                  <form onSubmit={handleAllocate} className="space-y-4">
                    <div className="form-group">
                      <label className="form-label">Assign To</label>
                      <select 
                        className="form-select"
                        value={assignUserId}
                        onChange={e => setAssignUserId(Number(e.target.value))}
                        required
                      >
                        <option value="">-- Select employee --</option>
                        {usersList.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" disabled={submitting} className="btn-primary w-full">
                      {submitting && <Loader2 size={16} className="animate-spin" />}
                      <UserCheck size={16} />
                      Allocate Asset
                    </button>
                  </form>
                )}

                {successMsg && (
                  <div className="mt-4 p-3 bg-successLight text-success text-sm font-medium rounded-xl flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    {successMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Allocation History Timeline */}
        <div className="space-y-6">
          <div className="data-card p-6 h-full flex flex-col">
            <h2 className="text-lg font-semibold text-textPrimary mb-4 flex items-center gap-2">
              <History size={18} className="text-accent" />
              Allocation History
            </h2>
            
            <div className="flex-1 overflow-y-auto">
              {!selectedAssetId ? (
                <div className="empty-state py-12">
                  <div className="empty-state-icon">
                    <ArrowRightLeft size={24} />
                  </div>
                  <p className="text-sm text-textMuted">Select an asset to view its history.</p>
                </div>
              ) : loadingHistory ? (
                <div className="space-y-4 pt-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4">
                      <div className="w-px bg-borderBase relative">
                        <div className="absolute -left-1 top-1 w-2.5 h-2.5 rounded-full bg-borderBase"></div>
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="skeleton h-4 w-32 mb-2 rounded-md"></div>
                        <div className="skeleton h-3 w-48 rounded-md"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : assetHistory.length === 0 ? (
                <p className="text-sm text-textMuted">No allocation history for this asset.</p>
              ) : (
                <div className="space-y-0 pl-1">
                  {assetHistory.map((history, idx) => {
                    const isLast = idx === assetHistory.length - 1;
                    return (
                      <div key={history.id} className="flex gap-4 relative">
                        {/* Timeline line */}
                        {!isLast && (
                          <div className="absolute top-2 bottom-[-1rem] left-[5px] w-px bg-borderBase"></div>
                        )}
                        {/* Timeline dot */}
                        <div className={`mt-1.5 w-3 h-3 rounded-full shrink-0 relative z-10 ${
                          history.status === 'active' ? 'bg-success shadow-glow' : 'bg-borderStrong'
                        }`}></div>
                        
                        <div className="flex-1 pb-6">
                          <div className="text-sm font-medium text-textPrimary">
                            {format(parseISO(history.allocated_at), 'MMM dd')} - Allocated to {history.user.full_name}
                          </div>
                          {history.returned_at && (
                            <div className="text-sm text-textSecondary mt-1">
                              {format(parseISO(history.returned_at), 'MMM dd')} - Returned by {history.user.full_name}
                              {history.condition_notes && (
                                <span className="italic text-textMuted ml-1">- condition: {history.condition_notes}</span>
                              )}
                            </div>
                          )}
                          <div className="mt-1">
                            <span className={`badge ${history.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                              {history.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
