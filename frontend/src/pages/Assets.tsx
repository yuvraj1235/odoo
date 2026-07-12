import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  Search, Filter, Plus, Package, MapPin,
  CheckCircle, Clock, AlertTriangle, X, History,
  User as UserIcon, Loader2
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
  category?: { id: number; name: string } | null;
  department?: { id: number; name: string } | null;
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

function SkeletonTableRow() {
  return (
    <tr>
      <td className="px-5 py-4">
        <div className="space-y-1.5">
          <div className="skeleton h-3.5 w-36 rounded-md" />
          <div className="skeleton h-2.5 w-24 rounded-md" />
        </div>
      </td>
      <td className="px-5 py-4"><div className="skeleton h-3 w-20 rounded-md" /></td>
      <td className="px-5 py-4"><div className="skeleton h-3 w-16 rounded-md" /></td>
      <td className="px-5 py-4"><div className="skeleton h-5 w-20 rounded-full" /></td>
      <td className="px-5 py-4"><div className="skeleton h-3 w-24 rounded-md" /></td>
      <td className="px-5 py-4 text-right"><div className="skeleton h-3 w-16 rounded-md ml-auto" /></td>
    </tr>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'available':        return <span className="badge badge-success"><CheckCircle size={11} />Available</span>;
    case 'allocated':        return <span className="badge badge-info"><UserIcon size={11} />Allocated</span>;
    case 'under_maintenance': return <span className="badge badge-warning"><Clock size={11} />Maintenance</span>;
    case 'reserved':         return <span className="badge badge-accent">Reserved</span>;
    case 'lost':             return <span className="badge badge-danger"><AlertTriangle size={11} />Lost</span>;
    default:                 return <span className="badge badge-neutral capitalize">{status.replace(/_/g, ' ')}</span>;
  }
}

export default function Assets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AllocationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  // New asset form state
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const [res, catRes] = await Promise.all([
        api.get(`/assets/?${params.toString()}`),
        api.get('/categories/')
      ]);
      setAssets(res.data);
      setCategories(catRes.data);
      if (catRes.data.length > 0 && !categoryId) {
        setCategoryId(catRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch assets or categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssets(); }, [statusFilter]);

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
        name, category_id: categoryId, location,
        acquisition_cost: cost ? parseFloat(cost) : null,
        condition: 'new', status: 'available', is_bookable: false
      });
      setIsModalOpen(false);
      setName(''); setLocation(''); setCost('');
      fetchAssets();
    } catch (err) {
      console.error('Failed to create asset', err);
    } finally {
      setCreating(false);
    }
  };

  const canRegister = user?.role === 'admin' || user?.role === 'asset_manager';

  return (
    <div className="space-y-5 page-enter">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Directory</h1>
          <p className="page-subtitle">Manage, track, and audit organisational hardware and resources.</p>
        </div>
        {canRegister && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary self-start">
            <Plus size={15} aria-hidden="true" />
            Register Asset
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
              size={16}
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search by name, tag, or serial…"
              className="form-input pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search assets"
            />
          </div>
          <button type="submit" className="btn-secondary shrink-0">Search</button>
        </form>

        <div className="flex items-center gap-2 shrink-0">
          <Filter size={16} className="text-textMuted" aria-hidden="true" />
          <select
            className="form-select w-44"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
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

      {/* Table + Detail Panel */}
      <div className="flex gap-5 items-start">

        {/* Table */}
        <div className={`data-card flex-1 min-w-0 ${selectedAsset ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="overflow-x-auto table-scroll">
              <table className="data-table" aria-label="Loading assets">
                <thead>
                  <tr>
                    <th>Asset Details</th><th>Tag</th><th>Category</th>
                    <th>Status</th><th>Holder / Location</th><th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} />)}
                </tbody>
              </table>
            </div>
          ) : assets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Package size={24} aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-textSecondary mb-1">No assets found</h3>
              <p className="text-sm text-textMuted">Adjust filters or register a new asset.</p>
            </div>
          ) : (
            <div className="overflow-x-auto table-scroll">
              <table className="data-table" aria-label="Asset directory">
                <thead>
                  <tr>
                    <th>Asset Details</th><th>Tag</th><th>Category</th>
                    <th>Status</th><th>Holder / Location</th><th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(asset => (
                    <tr
                      key={asset.id}
                      onClick={() => openDetails(asset)}
                      className={`cursor-pointer ${selectedAsset?.id === asset.id ? 'bg-accentLight/30' : ''}`}
                    >
                      <td>
                        <div className="font-medium text-textPrimary">{asset.name}</div>
                        <div className="text-xs text-textMuted font-mono mt-0.5">
                          {asset.serial_number || 'No Serial #'}
                        </div>
                      </td>
                      <td className="font-mono text-xs font-semibold text-textSecondary">
                        {asset.asset_tag}
                      </td>
                      <td className="text-textSecondary text-sm">{asset.category?.name || 'Uncategorized'}</td>
                      <td>{getStatusBadge(asset.status)}</td>
                      <td>
                        {asset.current_holder ? (
                          <div className="flex items-center gap-1.5 text-sm font-medium text-textPrimary">
                            <UserIcon size={13} className="text-accent" aria-hidden="true" />
                            {asset.current_holder.full_name}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-textMuted">
                            <MapPin size={13} aria-hidden="true" />
                            {asset.location}
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={e => { e.stopPropagation(); openDetails(asset); }}
                          className="text-sm font-medium text-accent hover:text-accentHover transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedAsset && (
          <aside
            className="w-full lg:w-96 data-card flex flex-col sticky top-[68px] max-h-[calc(100vh-90px)] overflow-hidden animate-slide-in-left"
            aria-label="Asset details"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-borderBase flex items-start justify-between bg-surface/50 shrink-0">
              <div>
                <span className="font-mono text-xs font-semibold text-accent block mb-0.5">
                  {selectedAsset.asset_tag}
                </span>
                <h3 className="font-semibold text-textPrimary">{selectedAsset.name}</h3>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-surfaceHover rounded-lg transition-colors shrink-0"
                aria-label="Close detail panel"
              >
                <X size={17} />
              </button>
            </div>

            {/* Attributes */}
            <div className="p-5 border-b border-borderBase grid grid-cols-2 gap-4 text-sm shrink-0">
              <div>
                <span className="text-xs text-textMuted block mb-1">Status</span>
                {getStatusBadge(selectedAsset.status)}
              </div>
              <div>
                <span className="text-xs text-textMuted block mb-1">Condition</span>
                <span className="font-medium capitalize text-textPrimary">{selectedAsset.condition}</span>
              </div>
              <div>
                <span className="text-xs text-textMuted block mb-1">Category</span>
                <span className="font-medium text-textPrimary">{selectedAsset.category?.name || 'Uncategorized'}</span>
              </div>
              <div>
                <span className="text-xs text-textMuted block mb-1">Acquired</span>
                <span className="font-medium text-textPrimary">
                  {selectedAsset.acquisition_date
                    ? format(parseISO(selectedAsset.acquisition_date), 'MMM yyyy')
                    : '—'}
                </span>
              </div>

              <div className="col-span-2 pt-2 border-t border-borderBase">
                <span className="text-xs text-textMuted block mb-1.5">Location</span>
                <div className="flex items-center gap-2 text-sm font-medium text-textPrimary">
                  <MapPin size={14} className="text-textMuted" aria-hidden="true" />
                  {selectedAsset.location}
                </div>
              </div>

              {selectedAsset.current_holder && (
                <div className="col-span-2 border-t border-borderBase pt-2">
                  <span className="text-xs text-textMuted block mb-1.5">Current Holder</span>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accentMuted flex items-center justify-center text-accent font-bold text-xs">
                      {selectedAsset.current_holder.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-textPrimary">
                        {selectedAsset.current_holder.full_name}
                      </div>
                      <div className="text-xs text-textMuted">
                        {selectedAsset.current_holder.email}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* History */}
            <div className="p-5 flex-1 overflow-y-auto no-scrollbar">
              <div className="flex items-center gap-2 text-xs font-semibold text-textMuted uppercase tracking-wider mb-3">
                <History size={13} aria-hidden="true" />
                Allocation History
              </div>

              {loadingHistory ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-xl border border-borderBase space-y-1.5">
                      <div className="skeleton h-3 w-28 rounded-md" />
                      <div className="skeleton h-2.5 w-36 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-textMuted text-center py-4">No assignment history on record.</p>
              ) : (
                <div className="space-y-2">
                  {history.map(log => (
                    <div key={log.id} className="p-3 bg-surface rounded-xl text-xs border border-borderBase space-y-1">
                      <div className="flex justify-between font-medium text-textPrimary">
                        <span>{log.user.full_name}</span>
                        <span className="capitalize text-textMuted badge badge-neutral">{log.status}</span>
                      </div>
                      <div className="text-textMuted">
                        Assigned: {format(parseISO(log.allocated_at), 'MMM d, yyyy')}
                      </div>
                      {log.returned_at && (
                        <div className="text-textMuted">
                          Returned: {format(parseISO(log.returned_at), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Register Asset Modal */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-asset-title"
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="register-asset-title" className="font-semibold text-textPrimary">
                Register New Asset
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-surfaceHover rounded-lg transition-colors"
                aria-label="Close dialog"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleCreateAsset}>
              <div className="modal-body space-y-4">
                <div className="form-group">
                  <label htmlFor="asset-name" className="form-label">
                    Asset Name <span className="text-danger" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="asset-name"
                    type="text"
                    required
                    placeholder='e.g. MacBook Pro 16"'
                    className="form-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="asset-category" className="form-label">
                    Category <span className="text-danger" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="asset-category"
                    className="form-select"
                    value={categoryId}
                    onChange={e => setCategoryId(Number(e.target.value))}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="asset-location" className="form-label">
                    Physical Location <span className="text-danger" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="asset-location"
                    type="text"
                    required
                    placeholder="e.g. Engineering Lab — Desk 4"
                    className="form-input"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="asset-cost" className="form-label">
                    Acquisition Cost (USD)
                  </label>
                  <input
                    id="asset-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 2,499.00"
                    className="form-input"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                  />
                  <p className="form-helper">Optional — leave blank if unknown</p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
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
