import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TableVirtuoso } from 'react-virtuoso';
import {
  Search, Filter, Plus, Package, MapPin,
  CheckCircle, Clock, AlertTriangle, X, History,
  User as UserIcon, Loader2, Upload, Sparkles
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AllocationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debounce search input for high throughput
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // TanStack Query for Categories (high stale time)
  const { data: categories = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories/')).data,
    staleTime: 5 * 60 * 1000,
  });

  // TanStack Query for Assets directory
  const { data: assets = [], isLoading: loading } = useQuery<Asset[]>({
    queryKey: ['assets', debouncedSearch, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/assets/?${params.toString()}`);
      return res.data;
    },
  });

  // New asset form state
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Record<string, boolean>>({});
  const [extractingOcr, setExtractingOcr] = useState(false);
  const [ocrFeedback, setOcrFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
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

  const handleOcrUpload = async (file: File) => {
    setExtractingOcr(true);
    setOcrFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/ai/extract-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      const updatedFields: Record<string, boolean> = {};
      
      if (data.asset_name) {
        setName(data.asset_name);
        updatedFields['name'] = true;
      }
      if (data.serial_number) {
        setSerialNumber(data.serial_number);
        updatedFields['serial_number'] = true;
      }
      if (data.acquisition_cost !== null && data.acquisition_cost !== undefined) {
        setCost(String(data.acquisition_cost));
        updatedFields['cost'] = true;
      }
      if (data.acquisition_date) {
        setAcquisitionDate(data.acquisition_date);
        updatedFields['acquisition_date'] = true;
      }
      
      setAutoFilledFields(updatedFields);
      setOcrFeedback(`Extracted from ${file.name} (Confidence: ${Math.round((data.confidence || 0.9) * 100)}%)`);
    } catch (err) {
      console.error('OCR extraction failed', err);
      setOcrFeedback('Failed to extract document data. Please enter details manually.');
    } finally {
      setExtractingOcr(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/assets/', {
        name,
        serial_number: serialNumber || null,
        category_id: categoryId,
        location,
        acquisition_cost: cost ? parseFloat(cost) : null,
        acquisition_date: acquisitionDate ? new Date(acquisitionDate).toISOString() : null,
        condition: 'new', status: 'available', is_bookable: false
      });
      setIsModalOpen(false);
      setName(''); setSerialNumber(''); setLocation(''); setCost(''); setAcquisitionDate('');
      setAutoFilledFields({}); setOcrFeedback(null);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
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
            <div className="overflow-x-auto table-scroll h-[620px] rounded-lg border border-borderBase">
              <TableVirtuoso
                data={assets}
                components={{
                  Table: ({ style, ...props }) => (
                    <table {...props} className="data-table w-full" style={{ ...style }} />
                  ),
                  TableHead: React.forwardRef((props, ref) => (
                    <thead {...props} ref={ref} className="bg-surface sticky top-0 z-10 shadow-sm" />
                  )),
                  TableRow: ({ item: asset, ...props }) => (
                    <tr
                      {...props}
                      onClick={() => openDetails(asset)}
                      className={`cursor-pointer hover:bg-surface/60 transition-colors ${selectedAsset?.id === asset.id ? 'bg-accentLight/30' : ''}`}
                    />
                  ),
                  TableBody: React.forwardRef((props, ref) => (
                    <tbody {...props} ref={ref} />
                  )),
                }}
                fixedHeaderContent={() => (
                  <tr>
                    <th>Asset Details</th><th>Tag</th><th>Category</th>
                    <th>Status</th><th>Holder / Location</th><th className="text-right">Action</th>
                  </tr>
                )}
                itemContent={(_, asset) => (
                  <>
                    <td className="px-5 py-3.5 border-b border-borderBase">
                      <div className="font-medium text-textPrimary">{asset.name}</div>
                      <div className="text-xs text-textMuted font-mono mt-0.5">
                        {asset.serial_number || 'No Serial #'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 border-b border-borderBase font-mono text-xs font-semibold text-textSecondary">
                      {asset.asset_tag}
                    </td>
                    <td className="px-5 py-3.5 border-b border-borderBase text-textSecondary text-sm">{asset.category?.name || 'Uncategorized'}</td>
                    <td className="px-5 py-3.5 border-b border-borderBase">{getStatusBadge(asset.status)}</td>
                    <td className="px-5 py-3.5 border-b border-borderBase">
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
                    <td className="px-5 py-3.5 border-b border-borderBase text-right">
                      <button
                        onClick={e => { e.stopPropagation(); openDetails(asset); }}
                        className="text-sm font-medium text-accent hover:text-accentHover transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </>
                )}
              />
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
                {/* AI OCR Dropzone */}
                <div className="p-4 rounded-xl border-2 border-dashed border-borderBase hover:border-accent bg-surfaceCard transition-all">
                  <label className="flex flex-col items-center justify-center cursor-pointer space-y-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleOcrUpload(file);
                      }}
                      disabled={extractingOcr}
                    />
                    <div className="w-10 h-10 rounded-full bg-accentLight/40 flex items-center justify-center text-accent">
                      {extractingOcr ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-textPrimary">
                        <Sparkles size={14} className="text-accent" />
                        <span>Auto-Fill via Invoice/Receipt</span>
                      </div>
                      <p className="text-[11px] text-textMuted mt-0.5">
                        Drop image or PDF to instantly extract asset details & cost
                      </p>
                    </div>
                  </label>
                  {ocrFeedback && (
                    <div className={`mt-3 p-2 rounded-lg text-xs font-medium flex items-center justify-between ${
                      ocrFeedback.includes('Failed') ? 'bg-danger/10 text-danger' : 'bg-info/10 text-info'
                    }`}>
                      <span className="flex items-center gap-1.5 truncate">
                        <Sparkles size={13} className="shrink-0" />
                        {ocrFeedback}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="asset-name" className="form-label mb-0">
                      Asset Name <span className="text-danger" aria-hidden="true">*</span>
                    </label>
                    {autoFilledFields['name'] && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-info/15 text-info border border-info/30 shadow-sm animate-fade-in" title="Suggested by AI from uploaded invoice">
                        <Sparkles size={10} /> Suggested by AI
                      </span>
                    )}
                  </div>
                  <input
                    id="asset-name"
                    type="text"
                    required
                    placeholder='e.g. MacBook Pro 16"'
                    className={`form-input transition-all ${
                      autoFilledFields['name'] ? 'border-info/80 bg-info/5 shadow-[0_0_8px_rgba(59,130,246,0.15)]' : ''
                    }`}
                    value={name}
                    onChange={e => { setName(e.target.value); setAutoFilledFields(prev => ({ ...prev, name: false })); }}
                  />
                </div>

                <div className="form-group">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="asset-serial" className="form-label mb-0">
                      Serial Number
                    </label>
                    {autoFilledFields['serial_number'] && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-info/15 text-info border border-info/30 shadow-sm animate-fade-in" title="Suggested by AI from uploaded invoice">
                        <Sparkles size={10} /> Suggested by AI
                      </span>
                    )}
                  </div>
                  <input
                    id="asset-serial"
                    type="text"
                    placeholder="e.g. SN-8839201-A"
                    className={`form-input transition-all ${
                      autoFilledFields['serial_number'] ? 'border-info/80 bg-info/5 shadow-[0_0_8px_rgba(59,130,246,0.15)]' : ''
                    }`}
                    value={serialNumber}
                    onChange={e => { setSerialNumber(e.target.value); setAutoFilledFields(prev => ({ ...prev, serial_number: false })); }}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-group">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="asset-cost" className="form-label mb-0">
                        Acquisition Cost ($)
                      </label>
                      {autoFilledFields['cost'] && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-info/15 text-info border border-info/30 shadow-sm animate-fade-in" title="Suggested by AI from uploaded invoice">
                          <Sparkles size={10} /> Suggested
                        </span>
                      )}
                    </div>
                    <input
                      id="asset-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 2,499.00"
                      className={`form-input transition-all ${
                        autoFilledFields['cost'] ? 'border-info/80 bg-info/5 shadow-[0_0_8px_rgba(59,130,246,0.15)]' : ''
                      }`}
                      value={cost}
                      onChange={e => { setCost(e.target.value); setAutoFilledFields(prev => ({ ...prev, cost: false })); }}
                    />
                  </div>

                  <div className="form-group">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="asset-acq-date" className="form-label mb-0">
                        Acquisition Date
                      </label>
                      {autoFilledFields['acquisition_date'] && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-info/15 text-info border border-info/30 shadow-sm animate-fade-in" title="Suggested by AI from uploaded invoice">
                          <Sparkles size={10} /> Suggested
                        </span>
                      )}
                    </div>
                    <input
                      id="asset-acq-date"
                      type="date"
                      className={`form-input transition-all ${
                        autoFilledFields['acquisition_date'] ? 'border-info/80 bg-info/5 shadow-[0_0_8px_rgba(59,130,246,0.15)]' : ''
                      }`}
                      value={acquisitionDate}
                      onChange={e => { setAcquisitionDate(e.target.value); setAutoFilledFields(prev => ({ ...prev, acquisition_date: false })); }}
                    />
                  </div>
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
