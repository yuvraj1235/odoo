import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  RefreshCw, ShieldAlert, Info, Clock, 
  CheckCircle2, FileWarning, ArrowRightLeft, 
  CalendarClock, Settings2, Laptop, UserCheck
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: any;
  created_at: string;
  user?: { full_name: string; email: string } | null;
}

type FilterTab = 'all' | 'alerts' | 'approvals' | 'bookings';

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const fetchLogs = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.get(`/logs/`);
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load activity logs', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const getFilteredLogs = () => {
    switch (activeTab) {
      case 'alerts':
        return logs.filter(log => 
          log.action.includes('damaged') || 
          log.action.includes('missing') || 
          log.action.includes('overdue') ||
          log.action.includes('rejected')
        );
      case 'approvals':
        return logs.filter(log => log.action.includes('approve'));
      case 'bookings':
        return logs.filter(log => log.entity_type === 'booking');
      case 'all':
      default:
        return logs;
    }
  };

  const filteredLogs = getFilteredLogs();

  const renderLogContent = (log: ActivityLog) => {
    const action = log.action.toLowerCase();
    let Icon = Info;
    let iconColor = 'text-accent bg-accentLight/50';
    let text = `${action} on ${log.entity_type} #${log.entity_id}`;

    if (action === 'asset.allocated') {
      Icon = UserCheck;
      iconColor = 'text-success bg-successLight/50';
      text = `${log.details?.asset_tag || 'Asset'} assigned to ${log.user?.full_name || 'user'}`;
    } else if (action === 'asset.returned') {
      Icon = ArrowRightLeft;
      iconColor = 'text-info bg-infoLight/50';
      text = `${log.details?.asset_tag || 'Asset'} returned by ${log.user?.full_name || 'user'}`;
    } else if (action === 'maintenance.requested') {
      Icon = Settings2;
      iconColor = 'text-warning bg-warningLight/50';
      text = `Maintenance requested for asset (Priority: ${log.details?.priority})`;
    } else if (action === 'maintenance.status_changed') {
      Icon = log.details?.to_status === 'resolved' ? CheckCircle2 : Settings2;
      iconColor = log.details?.to_status === 'resolved' ? 'text-success bg-successLight/50' : 'text-accent bg-accentLight/50';
      text = `Maintenance request #${log.entity_id} ${log.details?.to_status}`;
    } else if (action === 'transfer.approved') {
      Icon = CheckCircle2;
      iconColor = 'text-success bg-successLight/50';
      text = `Transfer request approved by ${log.user?.full_name || 'user'}`;
    } else if (action === 'booking.created') {
      Icon = CalendarClock;
      iconColor = 'text-accent bg-accentLight/50';
      text = `Resource booked by ${log.user?.full_name || 'user'}`;
    } else if (action.includes('discrepancy') || action.includes('damaged') || action.includes('missing')) {
      Icon = FileWarning;
      iconColor = 'text-danger bg-dangerLight/50';
      text = `Audit discrepancy flagged: Asset ${log.details?.asset_id} ${action.split('.').pop()}`;
    }

    return { Icon, iconColor, text };
  };

  return (
    <div className="space-y-6 page-enter max-w-4xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity & Notifications</h1>
          <p className="page-subtitle">
            Immutable ledger of user actions, security events, and asset state mutations.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="btn-secondary self-start"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh Feed'}
        </button>
      </div>

      {/* Segmented Filter Pill Bar */}
      <div className="flex items-center gap-2 bg-surface p-1.5 rounded-xl border border-borderBase w-fit">
        {(['all', 'alerts', 'approvals', 'bookings'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
              activeTab === tab 
                ? 'bg-white shadow-sm text-nav' 
                : 'text-textSecondary hover:text-nav hover:bg-white/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Categorized Activity Feed */}
      <div className="bg-white rounded-2xl border border-borderBase shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-textMuted">Loading activity feed...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-surfaceHover rounded-full flex items-center justify-center mb-3">
              <Clock size={24} className="text-textMuted" />
            </div>
            <h3 className="text-sm font-semibold text-textPrimary">No activity found</h3>
            <p className="text-xs text-textMuted mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-borderBase/60">
            {filteredLogs.map(log => {
              const { Icon, iconColor, text } = renderLogContent(log);
              const timeAgo = formatDistanceToNow(parseISO(log.created_at), { addSuffix: true });
              
              return (
                <div key={log.id} className="p-4 hover:bg-surfaceHover/50 transition-colors flex items-start gap-4">
                  <div className={`p-2.5 rounded-full shrink-0 ${iconColor}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-medium text-textPrimary leading-snug">
                      {text}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-textMuted font-medium">
                      <span>{timeAgo}</span>
                      {log.ip_address && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-borderStrong"></span>
                          <span className="font-mono">{log.ip_address}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
