import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  FileText, Search, Filter, Clock, User as UserIcon, 
  Tag, Shield, RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: any;
  ip_address: string | null;
  created_at: string;
  user?: { full_name: string; email: string } | null;
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityFilter) params.append('entity_type', entityFilter);
      const res = await api.get(`/logs/?${params.toString()}`);
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load system activity logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter]);

  const filteredLogs = logs.filter(log => {
    if (!search) return true;
    const query = search.toLowerCase();
    const actionMatch = log.action.toLowerCase().includes(query);
    const userMatch = log.user?.full_name.toLowerCase().includes(query);
    const entityMatch = log.entity_type.toLowerCase().includes(query);
    return actionMatch || userMatch || entityMatch;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('CREATE') || action.includes('REGISTER')) {
      return <span className="badge badge-success font-mono">{action}</span>;
    }
    if (action.includes('DELETE') || action.includes('LOST') || action.includes('REJECT')) {
      return <span className="badge badge-danger font-mono">{action}</span>;
    }
    if (action.includes('UPDATE') || action.includes('ASSIGN')) {
      return <span className="badge badge-info font-mono">{action}</span>;
    }
    return <span className="badge badge-neutral font-mono">{action}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">System Audit Logs</h1>
          <p className="text-baseSlate text-sm">Immutable ledger of all user actions, security events, and asset state mutations.</p>
        </div>

        <button onClick={fetchLogs} className="btn-secondary self-start">
          <RefreshCw size={14} />
          Refresh Feed
        </button>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slateLight" size={18} />
          <input
            type="text"
            placeholder="Search action, user name, or entity type..."
            className="form-input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-baseSlate" />
          <select 
            className="form-input w-48"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="">All Entity Types</option>
            <option value="user">User / Security</option>
            <option value="asset">Asset Hardware</option>
            <option value="allocation">Custody Allocation</option>
            <option value="booking">Resource Booking</option>
            <option value="maintenance">Maintenance</option>
            <option value="audit_cycle">Audit Cycle</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="data-card">
        {loading ? (
          <div className="p-12 text-center text-baseSlate">Loading audit records...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-baseSlate">No activity events found matching your search criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-baseSlate font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Event Timestamp</th>
                  <th className="px-5 py-3.5">Action Executed</th>
                  <th className="px-5 py-3.5">Actor / User</th>
                  <th className="px-5 py-3.5">Target Entity</th>
                  <th className="px-5 py-3.5">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 text-baseSlate whitespace-nowrap">
                      {log.created_at || log.timestamp ? format(parseISO(log.created_at || log.timestamp), 'yyyy-MM-dd • HH:mm:ss') : 'N/A'}
                    </td>
                    <td className="px-5 py-4">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-5 py-4 font-sans text-nav font-medium">
                      {log.user ? (
                        <div className="flex items-center gap-1.5">
                          <UserIcon size={14} className="text-accent" />
                          <span>{log.user.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-slateLight">System Automaton</span>
                      )}
                    </td>
                    <td className="px-5 py-4 uppercase text-slateDark font-semibold">
                      {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                    </td>
                    <td className="px-5 py-4 text-slateLight">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
