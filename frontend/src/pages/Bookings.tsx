import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  CalendarClock, Plus, CheckCircle, Clock, AlertTriangle, 
  X, Loader2, MapPin, Calendar, CheckCircle2, AlertCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Booking {
  id: number;
  asset_id: number;
  user_id: number;
  start_time: string;
  end_time: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
  asset: { id: number; name: string; asset_tag: string; location: string };
  user: { id: number; full_name: string; email: string };
}

export default function Bookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('upcoming');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [bookableAssets, setBookableAssets] = useState<{ id: number; name: string; asset_tag: string; location: string }[]>([]);
  const [assetId, setAssetId] = useState<number>(0);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/bookings/?${params.toString()}`);
      setBookings(res.data);
    } catch (err) {
      console.error('Failed to load bookings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const openNewBookingModal = async () => {
    setConflictError(null);
    setIsModalOpen(true);
    try {
      const res = await api.get('/assets/?is_bookable=true');
      setBookableAssets(res.data);
      if (res.data.length > 0) setAssetId(res.data[0].id);
    } catch (err) {
      console.error('Failed to load bookable assets', err);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setConflictError(null);
    try {
      const startIso = new Date(startTime).toISOString();
      const endIso = new Date(endTime).toISOString();

      // Check availability first
      const checkRes = await api.post('/bookings/check-availability', {
        asset_id: Number(assetId),
        start_time: startIso,
        end_time: endIso
      });

      if (!checkRes.data.available) {
        setConflictError('Selected time interval overlaps with an existing booking for this resource.');
        setSubmitting(false);
        return;
      }

      await api.post('/bookings/', {
        asset_id: Number(assetId),
        start_time: startIso,
        end_time: endIso,
        notes
      });

      setIsModalOpen(false);
      setStartTime('');
      setEndTime('');
      setNotes('');
      fetchBookings();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictError('Conflict: This time slot is already reserved.');
      } else {
        console.error('Failed to create reservation', err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!window.confirm('Cancel this resource reservation?')) return;
    try {
      await api.delete(`/bookings/${bookingId}`);
      fetchBookings();
    } catch (err) {
      console.error('Failed to cancel booking', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <span className="badge badge-info"><Clock size={12} className="mr-1" /> Upcoming</span>;
      case 'active':
        return <span className="badge badge-success"><CheckCircle2 size={12} className="mr-1" /> Active Now</span>;
      case 'completed':
        return <span className="badge badge-neutral">Completed</span>;
      case 'cancelled':
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge badge-neutral capitalize">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Resource Bookings</h1>
          <p className="text-baseSlate text-sm">Schedule shared assets such as conference rooms, vehicles, and lab hardware.</p>
        </div>

        <button onClick={openNewBookingModal} className="btn-primary self-start">
          <Plus size={16} />
          Reserve Resource
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
            <option value="">All Bookings</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active Now</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Bookings List */}
      <div className="data-card">
        {loading ? (
          <div className="p-12 text-center text-baseSlate">Loading reservations...</div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center text-baseSlate">No resource reservations found for this status.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-baseSlate font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Resource Asset</th>
                  <th className="px-5 py-3.5">Reserved By</th>
                  <th className="px-5 py-3.5">Schedule Interval</th>
                  <th className="px-5 py-3.5">Purpose / Notes</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="font-medium text-nav">{b.asset.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slateLight mt-0.5">
                        <span className="font-mono text-accent font-semibold">{b.asset.asset_tag}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {b.asset.location}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-nav">{b.user.full_name}</div>
                      <div className="text-xs text-slateLight">{b.user.email}</div>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono">
                      <div className="text-nav font-medium">
                        {format(parseISO(b.start_time), 'MMM d, yyyy • HH:mm')}
                      </div>
                      <div className="text-slateLight">
                        to {format(parseISO(b.end_time), 'MMM d, yyyy • HH:mm')}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-baseSlate max-w-xs truncate">
                      {b.notes || 'No description provided'}
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(b.status)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {(b.status === 'upcoming' || b.status === 'active') && (
                        <button 
                          onClick={() => handleCancelBooking(b.id)}
                          className="text-danger hover:text-red-700 font-medium text-xs"
                        >
                          Cancel
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

      {/* New Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-float max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-surface">
              <h3 className="font-semibold text-lg">Reserve Shared Resource</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slateLight hover:text-nav">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="p-5 space-y-4">
              {conflictError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-danger">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{conflictError}</span>
                </div>
              )}

              <div>
                <label className="form-label">Select Bookable Resource</label>
                <select 
                  className="form-input font-medium"
                  value={assetId}
                  onChange={e => setAssetId(Number(e.target.value))}
                >
                  {bookableAssets.length === 0 ? (
                    <option value={0}>No bookable resources defined</option>
                  ) : bookableAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.asset_tag} — {a.name} ({a.location})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Start Date & Time</label>
                  <input 
                    type="datetime-local" 
                    required 
                    className="form-input text-xs font-mono"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">End Date & Time</label>
                  <input 
                    type="datetime-local" 
                    required 
                    className="form-input text-xs font-mono"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Purpose / Meeting Title</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Q3 Roadmap Review & Sync" 
                  className="form-input"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || bookableAssets.length === 0} className="btn-primary">
                  {submitting && <Loader2 size={16} className="animate-spin mr-1" />}
                  Confirm Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
