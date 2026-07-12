import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  CalendarClock, AlertTriangle, 
  Loader2, CheckCircle2, Sparkles, ArrowRight
} from 'lucide-react';
import { format, parseISO, isSameDay, getHours, getMinutes, parse, isBefore, isAfter } from 'date-fns';

interface Asset {
  id: number;
  name: string;
  asset_tag: string;
  location: string;
}

interface Booking {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  user: { full_name: string };
  notes: string;
}

export default function Bookings() {
  useAuth();
  const [bookableAssets, setBookableAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  // New Booking State
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [conflictData, setConflictData] = useState<any>(null);

  // Fetch bookable assets
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await api.get('/assets/');
        const bookables = res.data.filter((a: any) => a.is_bookable || a.status === 'available');
        setBookableAssets(bookables);
        if (bookables.length > 0) setSelectedAssetId(bookables[0].id);
      } catch (err) {
        console.error('Failed to load assets', err);
      }
    };
    fetchAssets();
  }, []);

  // Fetch bookings for the selected asset and date
  useEffect(() => {
    if (!selectedAssetId || !selectedDate) return;
    const fetchAssetBookings = async () => {
      setLoading(true);
      try {
        // Fetch all bookings for this asset and filter by date
        const res = await api.get(`/bookings/?asset_id=${selectedAssetId}`);
        const dayBookings = res.data.filter((b: Booking) => 
          isSameDay(parseISO(b.start_time), parseISO(selectedDate)) &&
          b.status !== 'cancelled'
        );
        setBookings(dayBookings);
      } catch (err) {
        console.error('Failed to fetch bookings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAssetBookings();
  }, [selectedAssetId, selectedDate]);

  const timelineStartHour = 8; // 8 AM
  const timelineEndHour = 19; // 7 PM
  const totalMinutes = (timelineEndHour - timelineStartHour) * 60;

  // Compute position and height percentage based on time
  const getSlotStyle = (startStr: string, endStr: string) => {
    // startStr and endStr could be ISO strings or 'HH:mm'
    let sHour, sMin, eHour, eMin;
    if (startStr.includes('T')) {
      const sDate = parseISO(startStr);
      const eDate = parseISO(endStr);
      sHour = getHours(sDate);
      sMin = getMinutes(sDate);
      eHour = getHours(eDate);
      eMin = getMinutes(eDate);
    } else {
      [sHour, sMin] = startStr.split(':').map(Number);
      [eHour, eMin] = endStr.split(':').map(Number);
    }

    const startTotalMins = (sHour - timelineStartHour) * 60 + sMin;
    const endTotalMins = (eHour - timelineStartHour) * 60 + eMin;

    const top = Math.max(0, (startTotalMins / totalMinutes) * 100);
    const height = Math.min(100 - top, ((endTotalMins - startTotalMins) / totalMinutes) * 100);

    return { top: `${top}%`, height: `${height}%` };
  };

  const getOverlap = () => {
    if (!startTime || !endTime) return false;
    const s1 = parse(startTime, 'HH:mm', new Date());
    const e1 = parse(endTime, 'HH:mm', new Date());
    
    if (isAfter(s1, e1) || s1.getTime() === e1.getTime()) return true; // Invalid time range

    for (const b of bookings) {
      const bs = parseISO(b.start_time);
      const be = parseISO(b.end_time);
      
      const bsTime = parse(`${getHours(bs)}:${getMinutes(bs)}`, 'HH:mm', new Date());
      const beTime = parse(`${getHours(be)}:${getMinutes(be)}`, 'HH:mm', new Date());

      if (isBefore(s1, beTime) && isAfter(e1, bsTime)) {
        return true;
      }
    }
    return false;
  };

  const isOverlapping = getOverlap();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverlapping || !selectedAssetId) return;
    setSubmitting(true);
    setSuccessMsg('');
    setConflictData(null);

    try {
      const startIso = parse(`${selectedDate} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date()).toISOString();
      const endIso = parse(`${selectedDate} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date()).toISOString();

      await api.post('/bookings/', {
        asset_id: Number(selectedAssetId),
        start_time: startIso,
        end_time: endIso,
        notes: purpose
      });
      setSuccessMsg('Resource booked successfully!');
      setPurpose('');
      
      // Refresh
      const res = await api.get(`/bookings/?asset_id=${selectedAssetId}`);
      const dayBookings = res.data.filter((b: Booking) => 
        isSameDay(parseISO(b.start_time), parseISO(selectedDate)) &&
        b.status !== 'cancelled'
      );
      setBookings(dayBookings);
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Expected business validation conflict — display Smart Swap or conflict banner gracefully
        const detail = err.response.data?.detail;
        setConflictData(typeof detail === 'object' ? detail : {
          status: 'conflict',
          message: typeof detail === 'string' ? detail : 'Resource is unavailable during this time window.',
          conflicting_booking: { team: 'Existing Booking', time: `${startTime} - ${endTime}` }
        });
      } else if (err.response?.status === 400 || err.response?.status === 422) {
        const detail = err.response.data?.detail;
        const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail[0]?.msg : 'Invalid booking request or time range.';
        setConflictData({
          status: 'error',
          message: msg,
          conflicting_booking: null
        });
      } else {
        console.error('Failed to book', err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSmartSwap = async (targetAssetId: number) => {
    setSelectedAssetId(targetAssetId);
    setConflictData(null);
    setSubmitting(true);
    setSuccessMsg('');
    try {
      const startIso = parse(`${selectedDate} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date()).toISOString();
      const endIso = parse(`${selectedDate} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date()).toISOString();

      await api.post('/bookings/', {
        asset_id: targetAssetId,
        start_time: startIso,
        end_time: endIso,
        notes: purpose || 'Smart Swap booking'
      });
      setSuccessMsg('Resource booked via Smart Swap recommendation!');
      setPurpose('');
      
      const res = await api.get(`/bookings/?asset_id=${targetAssetId}`);
      const dayBookings = res.data.filter((b: Booking) => 
        isSameDay(parseISO(b.start_time), parseISO(selectedDate)) &&
        b.status !== 'cancelled'
      );
      setBookings(dayBookings);
    } catch (err: any) {
      if (err.response?.status === 409) {
        const detail = err.response.data?.detail;
        setConflictData(typeof detail === 'object' ? detail : {
          status: 'conflict',
          message: 'This alternative resource was just booked by another user.',
          conflicting_booking: { team: 'Another User', time: `${startTime} - ${endTime}` }
        });
      } else if (err.response?.status === 400 || err.response?.status === 422) {
        const detail = err.response.data?.detail;
        const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail[0]?.msg : 'Invalid booking request or time range.';
        setConflictData({
          status: 'error',
          message: msg,
          conflicting_booking: null
        });
      } else {
        console.error('Failed to book alternative', err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const hoursList = Array.from({ length: timelineEndHour - timelineStartHour + 1 }, (_, i) => timelineStartHour + i);

  return (
    <div className="space-y-6 page-enter max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Resource Booking</h1>
          <p className="page-subtitle">Schedule shared assets such as conference rooms, vehicles, and lab hardware.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Controls & Form */}
        <div className="space-y-6 lg:col-span-1">
          <div className="data-card p-6">
            <h2 className="text-lg font-semibold text-textPrimary mb-4">Select Resource & Date</h2>
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Resource</label>
                <select 
                  className="form-select"
                  value={selectedAssetId}
                  onChange={e => setSelectedAssetId(Number(e.target.value))}
                >
                  {bookableAssets.map(a => (
                    <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input 
                  type="date"
                  className="form-input"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="data-card p-6">
            <h2 className="text-lg font-semibold text-textPrimary mb-4">Request Slot</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Purpose</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Planning Meeting"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  required
                />
              </div>

              {successMsg && (
                <div className="p-3 bg-successLight text-success text-sm font-medium rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  {successMsg}
                </div>
              )}

              {conflictData && (
                <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl space-y-3 animate-fade-in">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-danger">Slot Unavailable</h4>
                      <p className="text-xs text-textSecondary mt-0.5">
                        {conflictData.conflicting_booking?.team || 'Another team'} has booked this slot from {conflictData.conflicting_booking?.time || 'requested time'}.
                      </p>
                    </div>
                  </div>

                  {conflictData.recommendations && conflictData.recommendations.length > 0 && (
                    <div className="pt-2 border-t border-danger/20">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-accent mb-2">
                        <Sparkles size={14} className="animate-spin" />
                        <span>Smart Swap Recommendations (Free now)</span>
                      </div>
                      <div className="space-y-1.5">
                        {conflictData.recommendations.map((rec: any) => (
                          <button
                            key={rec.id}
                            type="button"
                            onClick={() => handleSmartSwap(rec.id)}
                            className="w-full flex items-center justify-between p-2 bg-surfaceHover hover:bg-accentLight/40 rounded-lg text-left transition-colors group border border-borderBase/60"
                          >
                            <div className="truncate pr-2">
                              <span className="font-mono text-[11px] font-bold text-accent mr-1.5">{rec.resource_id}</span>
                              <span className="text-xs font-semibold text-textPrimary">{rec.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-accent group-hover:translate-x-1 transition-transform flex items-center gap-0.5 shrink-0">
                              Swap & Book <ArrowRight size={12} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isOverlapping && !conflictData && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl flex items-center gap-2 text-warning text-xs font-semibold animate-fade-in">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>Selected time range overlaps with an existing booking.</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={submitting || isOverlapping || !selectedAssetId} 
                className="btn-primary w-full"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Book Slot
              </button>
            </form>
          </div>
        </div>

        {/* Right: Vertical Timeline Grid */}
        <div className="lg:col-span-2 data-card p-6 min-h-[600px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-textPrimary flex items-center gap-2">
              <CalendarClock size={18} className="text-accent" />
              Daily Schedule
            </h2>
            {selectedAssetId && (
              <span className="text-sm font-medium text-textSecondary bg-surface px-3 py-1 rounded-full">
                {bookableAssets.find(a => a.id === selectedAssetId)?.name} — {format(parseISO(selectedDate), 'EEE, d MMM')}
              </span>
            )}
          </div>
          
          <div className="flex-1 relative border-t border-l border-borderBase mt-4 ml-12">
            {/* Hour grid lines */}
            {hoursList.map(hour => (
              <div 
                key={hour} 
                className="absolute w-full border-b border-borderBase/50"
                style={{ top: `${((hour - timelineStartHour) / (timelineEndHour - timelineStartHour)) * 100}%` }}
              >
                <div className="absolute -left-12 -top-2.5 w-10 text-right text-xs font-mono text-textMuted">
                  {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                </div>
              </div>
            ))}

            {/* Existing Bookings Blocks */}
            {!loading && bookings.map(b => {
              const style = getSlotStyle(b.start_time, b.end_time);
              return (
                <div 
                  key={b.id} 
                  className="absolute left-2 right-4 bg-accent/10 border-l-4 border-accent rounded-r-md px-3 py-2 overflow-hidden shadow-sm flex flex-col justify-center"
                  style={style}
                >
                  <div className="text-xs font-semibold text-accent">
                    Booked - {b.user.full_name}
                  </div>
                  <div className="text-xs text-textSecondary truncate">
                    {format(parseISO(b.start_time), 'HH:mm')} - {format(parseISO(b.end_time), 'HH:mm')}
                  </div>
                  {b.notes && <div className="text-xs text-textMuted truncate mt-0.5">{b.notes}</div>}
                </div>
              );
            })}

            {/* Requested Slot Block */}
            {startTime && endTime && (() => {
              const s1 = parse(startTime, 'HH:mm', new Date());
              const e1 = parse(endTime, 'HH:mm', new Date());
              if (isAfter(s1, e1) || s1.getTime() === e1.getTime() || getHours(s1) < timelineStartHour || getHours(e1) > timelineEndHour) {
                return null;
              }
              const style = getSlotStyle(startTime, endTime);
              
              if (isOverlapping) {
                return (
                  <div 
                    className="absolute left-2 right-4 border-2 border-dashed border-danger bg-dangerLight/40 rounded-md px-3 py-2 flex items-center justify-center pointer-events-none z-10"
                    style={style}
                  >
                    <div className="text-xs font-bold text-danger text-center bg-white/80 px-2 py-1 rounded backdrop-blur-sm">
                      Requested {startTime} to {endTime} - conflict - slot is unavailable
                    </div>
                  </div>
                );
              } else {
                return (
                  <div 
                    className="absolute left-2 right-4 border-2 border-dashed border-success bg-successLight/40 rounded-md px-3 py-2 flex flex-col justify-center pointer-events-none z-10"
                    style={style}
                  >
                    <div className="text-xs font-bold text-success">
                      Requested Slot
                    </div>
                    <div className="text-xs text-success/80">
                      {startTime} - {endTime}
                    </div>
                  </div>
                );
              }
            })()}

            {loading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-20">
                <Loader2 className="animate-spin text-accent" size={32} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
