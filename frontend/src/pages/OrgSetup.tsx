import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building2, Users, FolderTree, Plus, CheckCircle, 
  X, Loader2, Shield, UserCheck, Trash2, Edit
} from 'lucide-react';

interface Department {
  id: number;
  name: string;
  code?: string;
  head_user_id: number | null;
  status: string;
  head_user?: { full_name: string; email: string } | null;
}

interface Category {
  id: number;
  name: string;
  description: string | null;
  custom_fields: Record<string, string>;
  asset_count?: number;
}

interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: string;
  department_id: number | null;
  is_active: boolean;
  department?: { name: string } | null;
}

export default function OrgSetup() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'users'>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  
  // Forms
  const [deptName, setDeptName] = useState('');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [customFieldsList, setCustomFieldsList] = useState<{ key: string; type: string }[]>([]);
  const [cfKey, setCfKey] = useState('');
  const [cfType, setCfType] = useState('string');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deptRes, catRes, usersRes] = await Promise.all([
        api.get('/departments/'),
        api.get('/categories/'),
        api.get('/users/')
      ]);
      setDepartments(deptRes.data);
      setCategories(catRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Failed to load org setup data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/departments/', { name: deptName, status: 'active' });
      setIsDeptModalOpen(false);
      setDeptName('');
      fetchData();
    } catch (err) {
      console.error('Failed to create department', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCustomField = () => {
    if (!cfKey.trim()) return;
    setCustomFieldsList([...customFieldsList, { key: cfKey.trim(), type: cfType }]);
    setCfKey('');
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFieldsList(customFieldsList.filter((_, i) => i !== index));
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const customFieldsMap: Record<string, string> = {};
      customFieldsList.forEach(item => {
        customFieldsMap[item.key] = item.type;
      });
      await api.post('/categories/', {
        name: catName,
        description: catDesc,
        custom_fields: customFieldsMap
      });
      setIsCatModalOpen(false);
      setCatName('');
      setCatDesc('');
      setCustomFieldsList([]);
      fetchData();
    } catch (err) {
      console.error('Failed to create category', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    try {
      await api.put(`/users/${userId}`, { role: newRole });
      fetchData();
    } catch (err) {
      console.error('Failed to update user role', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Organization Setup</h1>
          <p className="text-baseSlate text-sm">Configure departments, taxonomy categories, and role-based access governance.</p>
        </div>

        {activeTab === 'departments' && (
          <button onClick={() => setIsDeptModalOpen(true)} className="btn-primary self-start">
            <Plus size={16} /> Add Department
          </button>
        )}
        {activeTab === 'categories' && (
          <button onClick={() => setIsCatModalOpen(true)} className="btn-primary self-start">
            <Plus size={16} /> Add Category
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'departments' 
              ? 'border-accent text-accent' 
              : 'border-transparent text-baseSlate hover:text-nav'
          }`}
        >
          <Building2 size={16} />
          Departments ({departments.length})
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'categories' 
              ? 'border-accent text-accent' 
              : 'border-transparent text-baseSlate hover:text-nav'
          }`}
        >
          <FolderTree size={16} />
          Asset Categories ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'users' 
              ? 'border-accent text-accent' 
              : 'border-transparent text-baseSlate hover:text-nav'
          }`}
        >
          <Users size={16} />
          User Roster & RBAC ({users.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="data-card">
        {loading ? (
          <div className="p-12 text-center text-baseSlate">Loading organizational data...</div>
        ) : activeTab === 'departments' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-baseSlate font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Department Name</th>
                  <th className="px-5 py-3.5">Assigned Head</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-nav">{d.name}</td>
                    <td className="px-5 py-4 font-medium text-accent">
                      {d.head_user ? d.head_user.full_name : <span className="text-slateLight font-normal">No Head Assigned</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="badge badge-success capitalize">{d.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'categories' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-baseSlate font-medium border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Category Taxonomy</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Custom Metadata Attributes</th>
                  <th className="px-5 py-3.5">Registered Units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-nav">{c.name}</td>
                    <td className="px-5 py-4 text-xs text-baseSlate">{c.description || 'N/A'}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {Object.entries(c.custom_fields || {}).map(([key, type]) => (
                          <span key={key} className="px-2 py-0.5 bg-slate-100 text-slateDark rounded text-xs font-mono">
                            {key}: {String(type)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono font-medium text-accent">
                      {c.asset_count ?? 0} units
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
                  <th className="px-5 py-3.5">Employee Profile</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">RBAC Access Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Role Assignment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-nav">{u.full_name}</div>
                      <div className="text-xs text-slateLight font-mono">{u.email}</div>
                    </td>
                    <td className="px-5 py-4 font-medium text-baseSlate">
                      {u.department?.name || 'Unassigned'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge uppercase tracking-wider text-[10px] ${
                        u.role === 'admin' ? 'badge-danger font-bold' :
                        u.role === 'asset_manager' ? 'badge-info font-bold' : 'badge-neutral'
                      }`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="badge badge-success">Active</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <select 
                        className="form-input text-xs py-1 w-36"
                        value={u.role}
                        onChange={e => handleUpdateRole(u.id, e.target.value)}
                        disabled={u.id === 1 || u.id === user?.id}
                      >
                        <option value="admin">Admin</option>
                        <option value="asset_manager">Asset Manager</option>
                        <option value="dept_head">Department Head</option>
                        <option value="employee">Employee</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dept Modal */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-float max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-surface">
              <h3 className="font-semibold text-lg">Add New Department</h3>
              <button onClick={() => setIsDeptModalOpen(false)} className="text-slateLight hover:text-nav">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDepartment} className="p-5 space-y-4">
              <div>
                <label className="form-label">Department Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Research & Development" 
                  className="form-input"
                  value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                />
              </div>
              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsDeptModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">Create Department</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cat Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-float max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-surface">
              <h3 className="font-semibold text-lg">Create Asset Category</h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-slateLight hover:text-nav">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="p-5 space-y-4">
              <div>
                <label className="form-label">Category Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Network Servers & Routers" 
                  className="form-input"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea 
                  rows={2}
                  placeholder="Hardware class scope..." 
                  className="form-input"
                  value={catDesc}
                  onChange={e => setCatDesc(e.target.value)}
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="form-label block">Custom Metadata Attributes</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Attribute Key (e.g. warranty_months)" 
                    className="form-input flex-1 text-xs"
                    value={cfKey}
                    onChange={e => setCfKey(e.target.value)}
                  />
                  <select 
                    className="form-input w-28 text-xs"
                    value={cfType}
                    onChange={e => setCfType(e.target.value)}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <button 
                    type="button" 
                    onClick={handleAddCustomField}
                    className="btn-secondary py-1 px-3 text-xs"
                  >
                    Add
                  </button>
                </div>

                {customFieldsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {customFieldsList.map((item, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slateDark rounded-lg text-xs font-mono">
                        <span>{item.key}: <span className="text-accent">{item.type}</span></span>
                        <button type="button" onClick={() => handleRemoveCustomField(idx)} className="text-slateLight hover:text-danger">
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsCatModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">Create Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
