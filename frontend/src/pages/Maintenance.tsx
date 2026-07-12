import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  Wrench, Plus, AlertTriangle, CheckCircle2, Clock, 
  X, Loader2, User as UserIcon, ShieldAlert
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface MaintenanceTicket {
  id: number;
  asset_id: number;
  user_id: number;
  assigned_to_id: number | null;
  issue_description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'in_progress' | 'waiting_for_parts' | 'resolved' | 'decommissioned';
  cost: number | null;
  reported_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  asset: { id: number; name: string; asset_tag: string; status: string };
  reporter: { full_name: string; email: string };
  assignee: { full_name: string; email: string } | null;
}

export default function Maintenance() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [assetsList, setAssetsList] = useState<{ id: number; name: string; asset_tag: string }[]>([]);
  const [assetId, setAssetId] = useState<number>(0);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/maintenance/?${params.toString()}`);
      setTickets(res.data);
    } catch (err) {
      console.error('Failed to load maintenance tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const openNewTicketModal = async () => {
    setIsModalOpen(true);
    try {
      const res = await api.get('/assets/');
      setAssetsList(res.data);
      if (res.data.length > 0) setAssetId(res.data[0].id);
    } catch (err) {
      console.error('Failed to prepare maintenance modal', err);
    }
  };

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/maintenance/', {
        asset_id: Number(assetId),
        issue_description: description,
        priority
      });
      setIsModalOpen(false);
      setDescription('');
      fetchTickets();
    } catch (err) {
      console.error('Failed to submit maintenance ticket', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (ticketId: number, newStatus: string) => {
    try {
      await api.put(`/maintenance/${ticketId}`, {
        status: newStatus,
        resolution_notes: newStatus === 'resolved' ? 'Repaired and tested by technician' : null
      });
      fetchTickets();
    } catch (err) {
      console.error('Failed to update ticket status', err);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'critical':
        return <span className="badge badge-danger font-semibold"><ShieldAlert size={12} className="mr-1" /> CRITICAL</span>;
      case 'high':
        return <span className="badge badge-warning font-semibold">High</span>;
      case 'medium':
        return <span className="badge badge-info">Medium</span>;
      default:
        return <span className="badge badge-neutral">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reported':
        return <span className="badge badge-warning"><AlertTriangle size={12} className="mr-1" /> Reported</span>;
      case 'in_progress':
        return <span className="badge badge-info"><Clock size={12} className="mr-1" /> In Progress</span>;
      case 'resolved':
        return <span className="badge badge-success"><CheckCircle2 size={12} className="mr-1" /> Resolved</span>;
      default:
        return <span className="badge badge-neutral capitalize">{status.replace('_', ' ')}</span>;
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'asset_manager';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Maintenance Pipeline</h1>
          <p className="text-baseSlate text-sm">Track hardware issues, calibrations, and technician repair lifecycles.</p>
        </div>

        <button onClick={openNewTicketModal} className="btn-primary self-start bg-amber-600 hover:bg-amber-700">
          <Wrench size={16} />
          Report Issue
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-baseSlate uppercase tracking-wider">Filter Status:</span>
          <select 
            className="form-input w-44 text-sm py-1.5"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Tickets</option>
            <option value="reported">Reported</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="data-card">
        {loading ? (
          <div className="p-12 text-center text-baseSlate">Loading maintenance tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-baseSlate">No maintenance tickets found for this status.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-baseSlate font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Target Asset</th>
                  <th className="px-5 py-3.5">Priority</th>
                  <th className="px-5 py-3.5">Reported By & When</th>
                  <th className="px-5 py-3.5">Issue Description</th>
                  <th className="px-5 py-3.5">Lifecycle Status</th>
                  <th className="px-5 py-3.5 text-right">Technician Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="font-medium text-nav">{t.asset.name}</div>
                      <div className="font-mono text-xs text-accent font-semibold">{t.asset.asset_tag}</div>
                    </td>
                    <td className="px-5 py-4">
                      {getPriorityBadge(t.priority)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-nav">{t.reporter.full_name}</div>
                      <div className="text-xs text-slateLight">
                        {format(parseISO(t.reported_at), 'MMM d, yyyy • HH:mm')}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-baseSlate max-w-xs">
                      {t.issue_description}
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(t.status)}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      {canManage && t.status === 'reported' && (
                        <button 
                          onClick={() => handleStatusUpdate(t.id, 'in_progress')}
                          className="btn-secondary py-1 text-xs"
                        >
                          Start Work
                        </button>
                      )}
                      {canManage && (t.status === 'reported' || t.status === 'in_progress') && (
                        <button 
                          onClick={() => handleStatusUpdate(t.id, 'resolved')}
                          className="btn-primary py-1 text-xs bg-success hover:bg-emerald-600"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-float max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-surface">
              <h3 className="font-semibold text-lg">Report Maintenance Issue</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slateLight hover:text-nav">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReportIssue} className="p-5 space-y-4">
              <div>
                <label className="form-label">Affected Asset</label>
                <select 
                  className="form-input font-medium"
                  value={assetId}
                  onChange={e => setAssetId(Number(e.target.value))}
                >
                  {assetsList.map(a => (
                    <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Priority Level</label>
                <select 
                  className="form-input font-medium"
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                >
                  <option value="low">Low — Minor cosmetic / non-blocking</option>
                  <option value="medium">Medium — Degraded performance</option>
                  <option value="high">High — Functional blockage</option>
                  <option value="critical">Critical — Complete failure / safety hazard</option>
                </select>
              </div>

              <div>
                <label className="form-label">Detailed Issue Description</label>
                <textarea 
                  rows={4}
                  required
                  placeholder="Explain what broke, error codes, or symptoms..."
                  className="form-input"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary bg-amber-600 hover:bg-amber-700">
                  {submitting && <Loader2 size={16} className="animate-spin mr-1" />}
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
