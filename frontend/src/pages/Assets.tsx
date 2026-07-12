import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, Filter, Plus, Package, MapPin, Tag, 
  CheckCircle, Clock, AlertTriangle, X, History, 
  Building2, User as UserIcon, Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Asset {
  id: number;
  name: string;
  asset_tag: string;
  serial_number: string | null;
  category_id: number;
  status: 'available' | 'allocated' | 'under_maintenance' | 'reserved' | 'lost' | 'decommissioned' | 'pending_inspection';
  condition: string;
  location: string;
  department_id: number | null;
  is_bookable: boolean;
  acquisition_date: string;
  acquisition_cost: number | null;
  notes: string | null;
  category: { id: number; name: string };
  department: { id: number; name: string } | null;
  current_holder?: { id: number; full_name: string; email: string } | null;
}

interface AllocationHistory {
  id: number;
  allocated_at: string;
  returned_at: string | null;
  status: string;
  condition_notes: string | null;
  user: { full_name: string; email: string };
}

export default function Assets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AllocationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New asset form state
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/assets/?${params.toString()}`);
      setAssets(res.data);
    } catch (err) {
      console.error('Failed to fetch assets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAssets();
  };

  const openDetails = async (asset: Asset) => {
    setSelectedAsset(asset);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/assets/${asset.id}/history`);
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/assets/', {
        name,
        category_id: categoryId,
        location,
        acquisition_cost: cost ? parseFloat(cost) : null,
        condition: 'new',
        status: 'available',
        is_bookable: false
      });
      setIsModalOpen(false);
      setName('');
      setLocation('');
      setCost('');
      fetchAssets();
    } catch (err) {
      console.error('Failed to create asset', err);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="badge badge-success"><CheckCircle size={12} className="mr-1" /> Available</span>;
      case 'allocated':
        return <span className="badge badge-info"><UserIcon size={12} className="mr-1" /> Allocated</span>;
      case 'under_maintenance':
        return <span className="badge badge-warning"><Clock size={12} className="mr-1" /> Maintenance</span>;
      default:
        return <span className="badge badge-neutral capitalize">{status.replace('_', ' ')}</span>;
    }
  };

  const canRegister = user?.role === 'admin' || user?.role === 'asset_manager';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Asset Directory</h1>
          <p className="text-baseSlate text-sm">Manage, track, and audit organizational hardware and resources.</p>
        </div>
        
        {canRegister && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary self-start">
            <Plus size={16} />
            Register Asset
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slateLight" size={18} />
            <input
              type="text"
              placeholder="Search by name, tag, or serial number..."
              className="form-input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-secondary">Search</button>
        </form>

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-baseSlate" />
          <select 
            className="form-input w-44"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="allocated">Allocated</option>
            <option value="under_maintenance">Maintenance</option>
            <option value="reserved">Reserved</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      </div>

      {/* Assets Grid / Table */}
      <div className="flex gap-6 items-start">
        <div className={`data-card flex-1 ${selectedAsset ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="p-12 text-center text-baseSlate">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="p-12 text-center text-baseSlate">No assets found matching your criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-baseSlate font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Asset Details</th>
                    <th className="px-5 py-3.5">Tag</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Holder / Location</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((asset) => (
                    <tr 
                      key={asset.id} 
                      onClick={() => openDetails(asset)}
                      className={`cursor-pointer transition-colors ${
                        selectedAsset?.id === asset.id ? 'bg-accent/5' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-nav">{asset.name}</div>
                        <div className="text-xs text-slateLight">{asset.serial_number || 'No Serial #'}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-baseSlate">
                        {asset.asset_tag}
                      </td>
                      <td className="px-5 py-4 text-baseSlate">
                        {asset.category.name}
                      </td>
                      <td className="px-5 py-4">
                        {getStatusBadge(asset.status)}
                      </td>
                      <td className="px-5 py-4 text-baseSlate">
                        {asset.current_holder ? (
                          <div className="flex items-center gap-1.5 font-medium text-nav">
                            <UserIcon size={14} className="text-accent" />
                            {asset.current_holder.full_name}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slateLight">
                            <MapPin size={14} />
                            {asset.location}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openDetails(asset); }}
                          className="text-accent hover:text-accentHover font-medium text-xs"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Side Panel Details */}
        {selectedAsset && (
          <div className="w-full lg:w-96 bg-white rounded-xl border border-slate-200 shadow-float overflow-hidden flex flex-col sticky top-20">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="font-mono text-xs font-semibold text-accent block mb-0.5">
                  {selectedAsset.asset_tag}
                </span>
                <h3 className="font-semibold text-lg text-nav">{selectedAsset.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedAsset(null)}
                className="p-1.5 text-slateLight hover:text-nav rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 border-b border-slate-100 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slateLight block">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedAsset.status)}</div>
                </div>
                <div>
                  <span className="text-xs text-slateLight block">Condition</span>
                  <span className="font-medium capitalize text-nav">{selectedAsset.condition}</span>
                </div>
                <div>
                  <span className="text-xs text-slateLight block">Category</span>
                  <span className="font-medium text-nav">{selectedAsset.category.name}</span>
                </div>
                <div>
                  <span className="text-xs text-slateLight block">Acquired</span>
                  <span className="font-medium text-nav">
                    {selectedAsset.acquisition_date ? format(parseISO(selectedAsset.acquisition_date), 'MMM yyyy') : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs text-slateLight block mb-1">Current Location</span>
                <div className="flex items-center gap-2 text-nav font-medium">
                  <MapPin size={16} className="text-slateLight" />
                  {selectedAsset.location}
                </div>
              </div>

              {selectedAsset.current_holder && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-xs text-slateLight block mb-1">Assigned Holder</span>
                  <div className="flex items-center gap-2 text-nav font-medium">
                    <UserIcon size={16} className="text-accent" />
                    <div>
                      <div>{selectedAsset.current_holder.full_name}</div>
                      <div className="text-xs text-slateLight font-normal">{selectedAsset.current_holder.email}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Allocation History */}
            <div className="p-5 flex-1 overflow-y-auto max-h-80">
              <div className="flex items-center gap-2 text-xs font-semibold text-baseSlate uppercase tracking-wider mb-3">
                <History size={14} />
                Allocation History
              </div>

              {loadingHistory ? (
                <div className="text-center py-4 text-xs text-slateLight">Loading logs...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-4 text-xs text-slateLight">No assignment history on record.</div>
              ) : (
                <div className="space-y-3">
                  {history.map((log) => (
                    <div key={log.id} className="p-3 bg-surface rounded-lg text-xs space-y-1 border border-slate-100">
                      <div className="flex justify-between font-medium text-nav">
                        <span>{log.user.full_name}</span>
                        <span className="capitalize text-slateLight">{log.status}</span>
                      </div>
                      <div className="text-slateLight">
                        Assigned: {format(parseISO(log.allocated_at), 'MMM d, yyyy')}
                      </div>
                      {log.returned_at && (
                        <div className="text-slateLight">
                          Returned: {format(parseISO(log.returned_at), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Register Asset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-float max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-surface">
              <h3 className="font-semibold text-lg">Register New Asset</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slateLight hover:text-nav">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="p-5 space-y-4">
              <div>
                <label className="form-label">Asset Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder='e.g. MacBook Pro 16"' 
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Category</label>
                <select 
                  className="form-input"
                  value={categoryId}
                  onChange={e => setCategoryId(Number(e.target.value))}
                >
                  <option value={1}>Electronics</option>
                  <option value={2}>Vehicles</option>
                  <option value={3}>Furniture</option>
                  <option value={4}>Tools & Equipment</option>
                  <option value={5}>Conference Rooms</option>
                </select>
              </div>

              <div>
                <label className="form-label">Physical Location</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Engineering Lab - Desk 4" 
                  className="form-input"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Acquisition Cost ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="e.g. 2499.00" 
                  className="form-input"
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating && <Loader2 size={16} className="animate-spin mr-1" />}
                  Register Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
