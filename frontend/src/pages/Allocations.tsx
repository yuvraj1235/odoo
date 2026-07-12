import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowRightLeft, CheckCircle2, Clock, Plus, UserCheck, 
  AlertCircle, X, Loader2, Calendar, ShieldCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Allocation {
  id: number;
  asset_id: number;
  user_id: number;
  department_id: number;
  allocated_at: string;
  expected_return_date: string | null;
  status: 'active' | 'returned' | 'overdue';
  condition_notes: string | null;
  asset: { id: number; name: string; asset_tag: string };
  user: { id: number; full_name: string; email: string };
}

interface Transfer {
  id: number;
  asset_id: number;
  from_user_id: number;
  to_user_id: number;
  requested_at: string;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  notes: string | null;
  asset: { name: string; asset_tag: string };
  from_user: { full_name: string; email: string };
  to_user: { full_name: string; email: string };
}

export default function Allocations() {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'allocations' | 'transfers'>('allocations');

  // Modals state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedAlloc, setSelectedAlloc] = useState<Allocation | null>(null);

  // Form states
  const [availableAssets, setAvailableAssets] = useState<{ id: number; name: string; asset_tag: string }[]>([]);
  const [usersList, setUsersList] = useState<{ id: number; full_name: string; department_id: number }[]>([]);
  const [assetId, setAssetId] = useState<number>(0);
  const [userId, setUserId] = useState<number>(0);
  const [expectedDate, setExpectedDate] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allocRes, transRes] = await Promise.all([
        api.get('/allocations/'),
        api.get('/allocations/transfers/list')
      ]);
      setAllocations(allocRes.data);
      setTransfers(transRes.data);
    } catch (err) {
      console.error('Failed to load allocations data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAssignModal = async () => {
    setIsAssignModalOpen(true);
    try {
      const [assetsRes, usersRes] = await Promise.all([
        api.get('/assets/?status=available'),
        api.get('/users/')
      ]);
      setAvailableAssets(assetsRes.data);
      setUsersList(usersRes.data);
      if (assetsRes.data.length > 0) setAssetId(assetsRes.data[0].id);
      if (usersRes.data.length > 0) setUserId(usersRes.data[0].id);
    } catch (err) {
      console.error('Failed to prepare assignment modal', err);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetUser = usersList.find(u => u.id === Number(userId));
      await api.post('/allocations/', {
        asset_id: Number(assetId),
        user_id: Number(userId),
        department_id: targetUser?.department_id || 1,
        expected_return_date: expectedDate ? new Date(expectedDate).toISOString() : null,
        condition_notes: 'Initial assignment'
      });
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to create allocation', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (allocationId: number) => {
    if (!window.confirm('Mark this asset as returned to inventory?')) return;
    try {
      await api.post(`/allocations/${allocationId}/return`, {
        condition_notes: 'Returned in working condition'
      });
      fetchData();
    } catch (err) {
      console.error('Failed to return asset', err);
    }
  };

  const openTransferModal = async (alloc: Allocation) => {
    setSelectedAlloc(alloc);
    setIsTransferModalOpen(true);
    try {
      const usersRes = await api.get('/users/');
      setUsersList(usersRes.data.filter((u: any) => u.id !== alloc.user_id));
      if (usersRes.data.length > 0) setUserId(usersRes.data[0].id);
    } catch (err) {
      console.error('Failed to prepare transfer modal', err);
    }
  };

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlloc) return;
    setSubmitting(true);
    try {
      await api.post('/allocations/transfers/request', {
        asset_id: selectedAlloc.asset_id,
        to_user_id: Number(userId),
        notes: transferNotes
      });
      setIsTransferModalOpen(false);
      setTransferNotes('');
      fetchData();
    } catch (err) {
      console.error('Failed to request transfer', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferDecision = async (transferId: number, status: 'approved' | 'rejected') => {
    try {
      await api.put(`/allocations/transfers/${transferId}`, { status });
      fetchData();
    } catch (err) {
      console.error('Failed to process transfer decision', err);
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'asset_manager';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Allocations & Transfers</h1>
          <p className="text-baseSlate text-sm">Assign asset custody, track checkouts, and approve employee peer transfers.</p>
        </div>

        {canManage && (
          <button onClick={openAssignModal} className="btn-primary self-start">
            <Plus size={16} />
            New Assignment
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('allocations')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'allocations' 
              ? 'border-accent text-accent' 
              : 'border-transparent text-baseSlate hover:text-nav'
          }`}
        >
          <UserCheck size={16} />
          Active Allocations ({allocations.filter(a => a.status !== 'returned').length})
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'transfers' 
              ? 'border-accent text-accent' 
              : 'border-transparent text-baseSlate hover:text-nav'
          }`}
        >
          <ArrowRightLeft size={16} />
          Transfer Requests ({transfers.filter(t => t.status === 'requested').length})
        </button>
      </div>

      {/* Content */}
      <div className="data-card">
        {loading ? (
          <div className="p-12 text-center text-baseSlate">Loading data...</div>
        ) : activeTab === 'allocations' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-baseSlate font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Asset</th>
                  <th className="px-5 py-3.5">Assigned To</th>
                  <th className="px-5 py-3.5">Allocated On</th>
                  <th className="px-5 py-3.5">Expected Return</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocations.map((alloc) => (
                  <tr key={alloc.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="font-medium text-nav">{alloc.asset.name}</div>
                      <div className="font-mono text-xs text-accent font-semibold">{alloc.asset.asset_tag}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-nav">{alloc.user.full_name}</div>
                      <div className="text-xs text-slateLight">{alloc.user.email}</div>
                    </td>
                    <td className="px-5 py-4 text-baseSlate">
                      {format(parseISO(alloc.allocated_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-5 py-4 text-baseSlate">
                      {alloc.expected_return_date ? (
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-slateLight" />
                          {format(parseISO(alloc.expected_return_date), 'MMM d, yyyy')}
                        </div>
                      ) : 'Indefinite'}
                    </td>
                    <td className="px-5 py-4">
                      {alloc.status === 'active' ? (
                        <span className="badge badge-success">Active</span>
                      ) : alloc.status === 'overdue' ? (
                        <span className="badge badge-danger">Overdue</span>
                      ) : (
                        <span className="badge badge-neutral">Returned</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      {alloc.status !== 'returned' && (
                        <>
                          <button 
                            onClick={() => openTransferModal(alloc)}
                            className="btn-secondary py-1 text-xs"
                          >
                            Transfer
                          </button>
                          {canManage && (
                            <button 
                              onClick={() => handleReturn(alloc.id)}
                              className="btn-primary py-1 text-xs bg-slateDark hover:bg-nav"
                            >
                              Log Return
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-baseSlate font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Asset</th>
                  <th className="px-5 py-3.5">Current Holder</th>
                  <th className="px-5 py-3.5">Requested Recipient</th>
                  <th className="px-5 py-3.5">Notes</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-baseSlate">No pending transfer requests.</td>
                  </tr>
                ) : transfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="font-medium text-nav">{transfer.asset.name}</div>
                      <div className="font-mono text-xs text-accent font-semibold">{transfer.asset.asset_tag}</div>
                    </td>
                    <td className="px-5 py-4 font-medium text-nav">
                      {transfer.from_user.full_name}
                    </td>
                    <td className="px-5 py-4 font-medium text-accent">
                      {transfer.to_user.full_name}
                    </td>
                    <td className="px-5 py-4 text-xs text-baseSlate max-w-xs truncate">
                      {transfer.notes || 'None provided'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${
                        transfer.status === 'requested' ? 'badge-warning' :
                        transfer.status === 'approved' ? 'badge-success' : 'badge-danger'
                      }`}>
                        {transfer.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      {transfer.status === 'requested' && canManage && (
                        <>
                          <button 
                            onClick={() => handleTransferDecision(transfer.id, 'approved')}
                            className="btn-primary py-1 text-xs bg-success hover:bg-emerald-600"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleTransferDecision(transfer.id, 'rejected')}
                            className="btn-secondary py-1 text-xs text-danger hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-float max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-surface">
              <h3 className="font-semibold text-lg">Assign Asset Custody</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slateLight hover:text-nav">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssign} className="p-5 space-y-4">
              <div>
                <label className="form-label">Available Asset</label>
                <select 
                  className="form-input font-mono text-sm"
                  value={assetId}
                  onChange={e => setAssetId(Number(e.target.value))}
                >
                  {availableAssets.length === 0 ? (
                    <option value={0}>No assets currently available</option>
                  ) : availableAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Assignee Employee</label>
                <select 
                  className="form-input"
                  value={userId}
                  onChange={e => setUserId(Number(e.target.value))}
                >
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Expected Return Date (Optional)</label>
                <input 
                  type="date" 
                  className="form-input"
                  value={expectedDate}
                  onChange={e => setExpectedDate(e.target.value)}
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || availableAssets.length === 0} className="btn-primary">
                  {submitting && <Loader2 size={16} className="animate-spin mr-1" />}
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Request Modal */}
      {isTransferModalOpen && selectedAlloc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-float max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-surface">
              <h3 className="font-semibold text-lg">Request Asset Transfer</h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slateLight hover:text-nav">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRequestTransfer} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-sm border border-slate-100">
                <span className="text-xs text-slateLight block">Asset Being Transferred</span>
                <span className="font-mono text-accent font-semibold">{selectedAlloc.asset.asset_tag}</span> — {selectedAlloc.asset.name}
              </div>

              <div>
                <label className="form-label">Transfer To Colleague</label>
                <select 
                  className="form-input"
                  value={userId}
                  onChange={e => setUserId(Number(e.target.value))}
                >
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Transfer Rationale</label>
                <textarea 
                  rows={3}
                  placeholder="Explain why custody is being shifted..."
                  className="form-input"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting && <Loader2 size={16} className="animate-spin mr-1" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
