'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Users, Edit2, Trash2, Eye, EyeOff, Shield, CheckCircle, XCircle, Search, MoreVertical, KeyRound, Phone, Mail, MapPin,  } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { formatRWF } from '@/lib/format';
import { createUser, setUserActive, updateUser } from '@/actions/users';
import type { ActionResult, ManagedUser } from '@/lib/types';

interface SalesRep {
  id: string;
  name: string;
  email: string;
  phone: string;
  area: string;
  role: 'Sales Officer';
  status: 'Active' | 'Inactive';
  joinDate: string;
  salesThisMonth: number;
  customersAssigned: number;
  identity: string;
}

/** The team is the organization's Sales Officer accounts. */
function toReps(users: ManagedUser[]): SalesRep[] {
  return users
    .filter((u) => u.role === 'SALES_OFFICER')
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      area: u.area,
      role: 'Sales Officer',
      status: u.isActive ? 'Active' : 'Inactive',
      joinDate: u.joinedDate,
      salesThisMonth: u.salesThisMonth,
      customersAssigned: u.customersAssigned,
      identity: u.employeeCode || '—',
    }));
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  area: '',
  role: 'Sales Officer' as SalesRep['role'],
  status: 'Active' as SalesRep['status'],
  password: '',
  confirmPassword: '',
};

function getStatusVariant(s: string): 'success' | 'warning' | 'error' | 'info' {
  if (s === 'Active') return 'success';
  if (s === 'Inactive') return 'warning';
  return 'error';
}

/** Next GS-OFF-### code after the highest one in use. */
function generateIdentity(reps: SalesRep[]) {
  const max = reps.reduce((m, r) => Math.max(m, Number(r.identity.match(/(\d+)$/)?.[1] ?? 0)), 0);
  return `GS-OFF-${String(max + 1).padStart(3, '0')}`;
}

export default function SalesManagerClient({ users }: { users: ManagedUser[] }) {
  const router = useRouter();
  const [reps, setReps] = useState<SalesRep[]>(() => toReps(users));
  useEffect(() => setReps(toReps(users)), [users]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editRep, setEditRep] = useState<SalesRep | null>(null);
  const [viewRep, setViewRep] = useState<SalesRep | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SalesRep | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = reps.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.area.toLowerCase().includes(q) ||
      r.identity.toLowerCase().includes(q);
    const matchRole = !filterRole || r.role === filterRole;
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowAddModal(true);
  }

  function openEdit(rep: SalesRep) {
    setEditRep(rep);
    setForm({
      name: rep.name,
      email: rep.email,
      phone: rep.phone,
      area: rep.area,
      role: rep.role,
      status: rep.status,
      password: '',
      confirmPassword: '',
    });
    setFormError('');
    setOpenMenuId(null);
  }

  function handleFormChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateForm(isEdit: boolean) {
    if (!form.name.trim()) return 'Full name is required.';
    if (!form.email.trim() || !form.email.includes('@')) return 'Valid email is required.';
    if (!form.phone.trim()) return 'Phone number is required.';
    if (!form.area.trim()) return 'Area/territory is required.';
    if (!isEdit) {
      if (!form.password || form.password.length < 10) return 'Password must be at least 10 characters.';
      if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    }
    return '';
  }

  function flash(message: string) {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  /** Applies a server result: refreshes the list on success, shows the error otherwise. */
  function handleResult(res: ActionResult<ManagedUser[]>, onError: (message: string) => void): boolean {
    if (!res.success) {
      onError(res.error);
      return false;
    }
    if (res.data) setReps(toReps(res.data));
    router.refresh();
    return true;
  }

  async function handleAddSubmit() {
    const err = validateForm(false);
    if (err) { setFormError(err); return; }
    const identity = generateIdentity(reps);
    setSaving(true);
    try {
      const res = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        area: form.area.trim(),
        employeeCode: identity,
        role: 'SALES_OFFICER',
        password: form.password,
      });
      if (!handleResult(res, setFormError)) return;
      setShowAddModal(false);
      flash(`Account created for ${form.name.trim()} — ID: ${identity}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit() {
    if (!editRep) return;
    const err = validateForm(true);
    if (err) { setFormError(err); return; }
    setSaving(true);
    try {
      const res = await updateUser(editRep.id, {
        name: form.name.trim(),
        role: 'SALES_OFFICER',
        phone: form.phone.trim(),
        area: form.area.trim(),
        employeeCode: editRep.identity === '—' ? '' : editRep.identity,
      });
      if (!handleResult(res, setFormError)) return;
      if (form.status !== editRep.status) {
        const statusRes = await setUserActive(editRep.id, form.status === 'Active');
        if (!handleResult(statusRes, setFormError)) return;
      }
      setEditRep(null);
      flash(`${form.name} updated successfully.`);
    } finally {
      setSaving(false);
    }
  }

  // Accounts are deactivated rather than deleted so their sales history is kept
  async function handleDelete() {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    setDeleteConfirm(null);
    const res = await setUserActive(target.id, false);
    if (handleResult(res, (m) => flash(`Error: ${m}`))) flash(`${target.name} deactivated and signed out.`);
  }

  async function toggleStatus(rep: SalesRep) {
    setOpenMenuId(null);
    const res = await setUserActive(rep.id, rep.status !== 'Active');
    if (handleResult(res, (m) => flash(`Error: ${m}`))) {
      flash(`${rep.name} ${rep.status === 'Active' ? 'deactivated' : 'activated'}.`);
    }
  }

  // Called as a function (not rendered as <Component/>) so inputs keep focus while typing
  function renderRepFormFields(isEdit?: boolean) {
    return (
      <div className="space-y-4">
        {formError && (
          <div className="flex items-center gap-2 bg-negative/10 border border-negative/30 text-negative text-sm px-3 py-2 rounded-lg">
            <XCircle size={15} />
            {formError}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Full Name *</label>
            <input
              className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
              placeholder="e.g. Jean Habimana"
              value={form.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Email Address *</label>
            <input
              type="email"
              className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
              placeholder="name@gorillasales.rw"
              value={form.email}
              disabled={isEdit}
              onChange={(e) => handleFormChange('email', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Phone *</label>
            <input
              className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
              placeholder="+250 788 000 000"
              value={form.phone}
              onChange={(e) => handleFormChange('phone', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Territory / Area *</label>
            <input
              className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
              placeholder="e.g. Remera / Gisozi"
              value={form.area}
              onChange={(e) => handleFormChange('area', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Role *</label>
            <select
              className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors cursor-pointer"
              value={form.role}
              onChange={(e) => handleFormChange('role', e.target.value)}
            >
              <option value="Sales Officer">Sales Officer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted-foreground mb-2">Status</label>
            <select
              className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors cursor-pointer"
              value={form.status}
              onChange={(e) => handleFormChange('status', e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
        {!isEdit && (
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              <KeyRound size={13} /> Account Credentials
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full border border-border rounded-lg px-4 py-3 pr-10 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
                    placeholder="Min. 10 characters"
                    value={form.password}
                    onChange={(e) => handleFormChange('password', e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Confirm Password *</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={(e) => handleFormChange('confirmPassword', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add, manage and assign identities to your sales team
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors shadow-sm"
        >
          <UserPlus size={16} />
          Add Sales Rep
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-positive/10 border border-positive/30 text-positive text-sm px-4 py-3 rounded-lg">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Reps', value: reps.length, icon: <Users size={18} /> },
          { label: 'Active', value: reps.filter((r) => r.status === 'Active').length, icon: <CheckCircle size={18} className="text-positive" /> },
          { label: 'Sales Officers', value: reps.filter((r) => r.role === 'Sales Officer').length, icon: <Shield size={18} className="text-accent" /> },
          { label: 'Inactive', value: reps.filter((r) => r.status !== 'Active').length, icon: <XCircle size={18} className="text-negative" /> },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-3 border border-border rounded-lg text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
            placeholder="Search by name, email, area or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors cursor-pointer"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="Sales Officer">Sales Officer</option>
        </select>
        <select
          className="border border-border rounded-lg px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors cursor-pointer"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sales (Month)</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                    No sales reps found.
                  </td>
                </tr>
              )}
              {filtered.map((rep) => (
                <tr key={rep.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                        {rep.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{rep.name}</p>
                        <p className="text-xs text-muted-foreground">{rep.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground">{rep.identity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${rep.role === 'Sales Officer' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                      {rep.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{rep.area}</td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(rep.status)}>{rep.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {rep.salesThisMonth > 0 ? formatRWF(rep.salesThisMonth) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setViewRep(rep)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="View details"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(rep)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === rep.id ? null : rep.id)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenuId === rep.id && (
                          <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-xl shadow-lg py-1 w-44">
                            <button
                              onClick={() => toggleStatus(rep)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-foreground flex items-center gap-2"
                            >
                              {rep.status === 'Active' ? <XCircle size={14} className="text-negative" /> : <CheckCircle size={14} className="text-positive" />}
                              {rep.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => { setDeleteConfirm(rep); setOpenMenuId(null); }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-negative/10 text-negative flex items-center gap-2"
                            >
                              <Trash2 size={14} />
                              Deactivate Rep
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          Showing {filtered.length} of {reps.length} reps
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Sales Rep" size="lg">
        <div className="space-y-5">
          {renderRepFormFields()}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSubmit}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm bg-accent text-white font-semibold hover:bg-accent/90 transition-colors flex items-center gap-2"
            >
              <UserPlus size={15} />
              Create Account
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editRep} onClose={() => setEditRep(null)} title={`Edit — ${editRep?.name ?? ''}`} size="lg">
        <div className="space-y-5">
          {renderRepFormFields(true)}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => setEditRep(null)}
              className="px-4 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSubmit}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm bg-accent text-white font-semibold hover:bg-accent/90 transition-colors flex items-center gap-2"
            >
              <CheckCircle size={15} />
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewRep} onClose={() => setViewRep(null)} title="Rep Profile">
        {viewRep && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center text-lg font-bold text-accent">
                {viewRep.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{viewRep.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground">{viewRep.identity}</span>
                  <Badge variant={getStatusVariant(viewRep.status)}>{viewRep.status}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <Mail size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-foreground font-medium">{viewRep.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-foreground font-medium">{viewRep.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Territory</p>
                  <p className="text-foreground font-medium">{viewRep.area}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="text-foreground font-medium">{viewRep.role}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 bg-muted/40 rounded-xl p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{viewRep.customersAssigned}</p>
                <p className="text-xs text-muted-foreground">Customers</p>
              </div>
              <div className="text-center border-x border-border">
                <p className="text-base font-bold text-foreground">{formatRWF(viewRep.salesThisMonth)}</p>
                <p className="text-xs text-muted-foreground">Sales (Month)</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{viewRep.joinDate}</p>
                <p className="text-xs text-muted-foreground">Joined</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <button
                onClick={() => { setViewRep(null); openEdit(viewRep); }}
                className="px-4 py-2 rounded-lg text-sm bg-accent text-white font-semibold hover:bg-accent/90 transition-colors flex items-center gap-2"
              >
                <Edit2 size={14} />
                Edit Info
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Deactivate Sales Rep">
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            Deactivate <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.identity})? They will be signed out and can no longer log in. Their customers and sales history are kept, and the account can be reactivated later.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg text-sm bg-negative text-white font-semibold hover:bg-negative/90 transition-colors flex items-center gap-2"
            >
              <Trash2 size={14} />
              Deactivate
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
