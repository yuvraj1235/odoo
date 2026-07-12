import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  Wrench, Plus, CheckCircle2, ShieldAlert, AlertTriangle, 
  Clock, CheckSquare, Settings2, X, Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

type MaintenanceStatus = 'pending' | 'approved' | 'technician_assigned' | 'in_progress' | 'resolved';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface MaintenanceTicket {
  id: number;
  asset_id: number;
  user_id: number;
  assigned_to_id: number | null;
  issue_description: string;
  priority: Priority;
  status: MaintenanceStatus;
  cost: number | null;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  asset: { id: number; name: string; asset_tag: string; status: string };
  user: { full_name: string; email: string };
  assigned_to: { full_name: string; email: string } | null;
}

const COLUMNS: { id: MaintenanceStatus; label: string; icon: React.ElementType }[] = [
  { id: 'pending', label: 'Pending', icon: AlertTriangle },
  { id: 'approved', label: 'Approved', icon: CheckSquare },
  { id: 'technician_assigned', label: 'Tech Assigned', icon: Wrench },
  { id: 'in_progress', label: 'In Progress', icon: Clock },
  { id: 'resolved', label: 'Resolved', icon: CheckCircle2 },
];

export default function Maintenance() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [assetsList, setAssetsList] = useState<{ id: number; name: string; asset_tag: string }[]>([]);
  const [assetId, setAssetId] = useState<number>(0);
  const [priority, setPriority] = useState<Priority>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draggedTicketId, setDraggedTicketId] = useState<number | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/maintenance/');
      setTickets(res.data);
    } catch (err) {
      console.error('Failed to load maintenance tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

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

  const handleStatusUpdate = async (ticketId: number, newStatus: MaintenanceStatus) => {
    // Optimistic update
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    try {
      await api.patch(`/maintenance/${ticketId}`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update ticket status', err);
      // Revert on failure
      fetchTickets();
    }
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'critical':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-dangerLight text-danger flex items-center gap-1"><ShieldAlert size={10} /> CRITICAL</span>;
      case 'high':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-warningLight text-warning">HIGH</span>;
      case 'medium':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-infoLight text-info">MEDIUM</span>;
      default:
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surfaceHover text-textSecondary border border-borderBase">LOW</span>;
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'asset_manager';

  const onDragStart = (e: React.DragEvent, id: number) => {
    if (!canManage) {
      e.preventDefault();
      return;
    }
    setDraggedTicketId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, targetStatus: MaintenanceStatus) => {
    e.preventDefault();
    if (draggedTicketId && canManage) {
      handleStatusUpdate(draggedTicketId, targetStatus);
    }
    setDraggedTicketId(null);
  };

  return (
    <div className="space-y-6 page-enter max-w-[1600px] mx-auto h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="page-header shrink-0">
        <div>
          <h1 className="page-title">Maintenance Workflow</h1>
          <p className="page-subtitle">Drag and drop tickets to progress maintenance lifecycle.</p>
        </div>

        <button onClick={openNewTicketModal} className="btn-primary self-start bg-amber-600 hover:bg-amber-700">
          <Plus size={16} />
          Report Issue
        </button>
      </div>

      {/* Helper Footer Text */}
      <div className="bg-surfaceCard border border-borderBase rounded-xl p-3 flex items-start gap-3 shrink-0 shadow-sm">
        <Settings2 size={16} className="text-accent mt-0.5" />
        <p className="text-xs text-textSecondary">
          <strong>State Engine Behavior:</strong> Moving a card to <span className="font-semibold text-textPrimary">Approved</span> automatically flips the asset status to <code>under_maintenance</code>. Moving it to <span className="font-semibold text-textPrimary text-success">Resolved</span> clears the ticket, logs the resolution date, and returns the asset to <code>available</code>.
        </p>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4 no-scrollbar">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((col) => {
            const columnTickets = tickets.filter(t => t.status === col.id);
            const isResolved = col.id === 'resolved';

            return (
              <div 
                key={col.id} 
                className="w-80 bg-surfaceHover/50 rounded-2xl flex flex-col border border-borderBase overflow-hidden"
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className={`p-4 border-b border-borderBase flex items-center justify-between ${isResolved ? 'bg-successLight/30' : 'bg-surfaceCard'}`}>
                  <div className="flex items-center gap-2">
                    <col.icon size={16} className={isResolved ? 'text-success' : 'text-textSecondary'} />
                    <h3 className={`font-semibold text-sm ${isResolved ? 'text-success font-bold' : 'text-textPrimary'}`}>
                      {col.label}
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-medium bg-surfaceHover px-2 py-0.5 rounded-full text-textSecondary border border-borderBase">
                    {columnTickets.length}
                  </span>
                </div>

                {/* Column Body */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-textMuted" />
                    </div>
                  ) : columnTickets.map(t => (
                    <div 
                      key={t.id}
                      draggable={canManage}
                      onDragStart={(e) => onDragStart(e, t.id)}
                      className={`bg-surfaceCard p-4 rounded-xl shadow-sm border border-borderBase 
                        ${canManage ? 'cursor-grab active:cursor-grabbing hover:border-accent hover:shadow-card transition-all' : ''}
                        ${draggedTicketId === t.id ? 'opacity-50 scale-95' : ''}
                        ${t.priority === 'critical' ? 'border-l-4 border-l-danger' : ''}
                        ${isResolved ? 'opacity-70' : ''}
                      `}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-xs font-semibold text-accent bg-accentLight px-2 py-0.5 rounded">
                          {t.asset.asset_tag}
                        </span>
                        {getPriorityBadge(t.priority)}
                      </div>
                      
                      <p className="text-sm text-textPrimary font-medium mb-3 line-clamp-3">
                        {t.issue_description}
                      </p>

                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-borderBase/60">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-textMuted uppercase tracking-wide">Reported By</span>
                          <span className="text-xs text-textSecondary font-medium truncate max-w-[120px]">{t.user.full_name}</span>
                        </div>
                        {t.assigned_to && (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-textMuted uppercase tracking-wide">Tech</span>
                            <span className="text-xs font-semibold text-nav truncate max-w-[100px]">{t.assigned_to.full_name}</span>
                          </div>
                        )}
                        {isResolved && t.resolved_at && (
                          <div className="text-[10px] text-success font-medium">
                            Resolved {format(parseISO(t.resolved_at), 'd MMM')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {!loading && columnTickets.length === 0 && (
                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-borderBase rounded-xl text-xs text-textMuted font-medium">
                      Drop cards here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Ticket Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="font-semibold text-textPrimary">Report Maintenance Issue</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-textMuted hover:text-textPrimary hover:bg-surfaceHover p-1.5 rounded-lg transition-colors">
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleReportIssue}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label className="form-label">Affected Asset</label>
                  <select 
                    className="form-select font-medium"
                    value={assetId}
                    onChange={e => setAssetId(Number(e.target.value))}
                  >
                    {assetsList.map(a => (
                      <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <select 
                    className="form-select font-medium"
                    value={priority}
                    onChange={e => setPriority(e.target.value as Priority)}
                  >
                    <option value="low">Low — Minor cosmetic / non-blocking</option>
                    <option value="medium">Medium — Degraded performance</option>
                    <option value="high">High — Functional blockage</option>
                    <option value="critical">Critical — Complete failure / safety hazard</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Detailed Issue Description</label>
                  <textarea 
                    rows={4}
                    required
                    placeholder="e.g. Projector bulb not turning on, Forklift noisy compressor..."
                    className="form-input"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500/50 border-none shadow-sm">
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
