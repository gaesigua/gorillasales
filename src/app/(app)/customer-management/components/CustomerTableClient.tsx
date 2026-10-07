'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Eye, X, AlertTriangle, Download, Plus } from 'lucide-react';
import { formatRWF } from '@/lib/format';
import type { Customer, CustomerStatusValue, VisitLog } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import CustomerDetailPanel from './CustomerDetailPanel';
import WeeklyReportExport from './WeeklyReportExport';
import { useConfig } from '@/context/ConfigContext';
import { useUser } from '@/context/UserContext';
import { createCustomer } from '@/actions/customers';

type SortKey = keyof Customer;

function getStatusVariant(status: string) {
  if (status === 'Active') return 'success';
  if (status === 'Inactive') return 'error';
  return 'info';
}

function getCategoryBadgeColor(category: string) {
  const map: Record<string, string> = {
    'Hotels': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'Coffee Shops': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'Wholesalers': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'Supermarkets': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    'Shops': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    'Stores': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    'Galleries': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    'Offices': 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',
  };
  return map[category] ?? 'bg-muted text-muted-foreground';
}

function getCapacityColor(pct: number) {
  if (pct >= 70) return 'bg-positive';
  if (pct >= 40) return 'bg-accent';
  return 'bg-negative';
}

function getCapacityTextColor(pct: number) {
  if (pct >= 70) return 'text-positive';
  if (pct >= 40) return 'text-accent';
  return 'text-negative';
}

function isOverdue(dateStr: string, today: string) {
  return !!dateStr && dateStr <= today;
}

const STATUS_VALUES: Record<NewCustomerForm['status'], CustomerStatusValue> = {
  Active: 'ACTIVE',
  Inactive: 'INACTIVE',
  Prospect: 'PROSPECT',
};

const PAGE_SIZE_OPTIONS = [5, 10, 20];

interface NewCustomerForm {
  name: string;
  category: string;
  area: string;
  contactPerson: string;
  phone: string;
  salesperson: string;
  mainProduct: string;
  monthlyPotential: string;
  status: 'Active' | 'Inactive' | 'Prospect';
  remarks: string;
}

const EMPTY_FORM: NewCustomerForm = {
  name: '',
  category: '',
  area: '',
  contactPerson: '',
  phone: '',
  salesperson: '',
  mainProduct: '',
  monthlyPotential: '',
  status: 'Prospect',
  remarks: '',
};

interface CustomerTableClientProps {
  customers: Customer[];
  recentVisits: VisitLog[];
  today: string;
}

export default function CustomerTableClient({ customers, recentVisits, today }: CustomerTableClientProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { currentUser, canViewAllReps } = useUser();
  const customerCategories = config.customerCategories.map((i) => i.label);
  const salespeople = config.salespeople;
  const products = config.products;

  const customerList = customers;
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  // For managers/admins: salesperson filter dropdown; for officers: locked to their own name
  const [filterSalesperson, setFilterSalesperson] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<NewCustomerForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewCustomerForm, string>>>({});
  const [addSuccess, setAddSuccess] = useState(false);


  const filtered = useMemo(() => {
    return customerList.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.area.toLowerCase().includes(search.toLowerCase()) ||
        c.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
        c.salesperson.toLowerCase().includes(search.toLowerCase());
      const matchCat = !filterCategory || c.category === filterCategory;
      // Sales officers only receive their own (and unassigned) customers from the server
      const matchRep = !filterSalesperson || c.salespersonId === filterSalesperson;
      const matchStatus = !filterStatus || c.status === filterStatus;
      return matchSearch && matchCat && matchRep && matchStatus;
    });
  }, [customerList, search, filterCategory, filterSalesperson, filterStatus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setFilterCategory('');
    setFilterSalesperson('');
    setFilterStatus('');
    setPage(1);
  };

  const hasActiveFilters = search || filterCategory || filterSalesperson || filterStatus;

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === 'asc' ? (
        <ChevronUp size={11} className="text-accent" />
      ) : (
        <ChevronDown size={11} className="text-accent" />
      )
    ) : (
      <ChevronDown size={11} className="text-muted-foreground opacity-30" />
    );

  // Summary stats
  const activeCount = customerList.filter((c) => c.status === 'Active').length;
  const prospectCount = customerList.filter((c) => c.status === 'Prospect').length;
  const overdueCount = customerList.filter((c) => isOverdue(c.nextFollowUp, today)).length;
  const totalPotential = customerList.reduce((s, c) => s + c.monthlyPotential, 0);

  // Category breakdown for KPI
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    customerList.forEach((c) => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return counts;
  }, [customerList]);

  // Add customer form handlers
  const handleFormChange = (field: keyof NewCustomerForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewCustomerForm, string>> = {};
    if (!formData.name.trim()) errors.name = 'Customer name is required';
    if (!formData.category) errors.category = 'Category is required — every customer must be grouped';
    if (!formData.area.trim()) errors.area = 'Area is required';
    if (!formData.contactPerson.trim()) errors.contactPerson = 'Contact person is required';
    if (canViewAllReps && !formData.salesperson) errors.salesperson = 'Assign a sales rep';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddCustomer = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await createCustomer({
        name: formData.name.trim(),
        category: formData.category,
        area: formData.area.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        salespersonId: formData.salesperson,
        mainProductId: formData.mainProduct,
        monthlyPotential: Number(formData.monthlyPotential) || 0,
        status: STATUS_VALUES[formData.status],
        remarks: formData.remarks.trim(),
      });
      if (!res.success) {
        setSaveError(res.error);
        return;
      }
      router.refresh();
      setAddSuccess(true);
      setTimeout(() => {
        setAddSuccess(false);
        setShowAddModal(false);
        setFormData(EMPTY_FORM);
        setFormErrors({});
      }, 1200);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setAddSuccess(false);
    setSaveError('');
  };

  const inputClass =
    'w-full bg-input border border-border rounded-lg px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors';
  const selectClass =
    'w-full bg-input border border-border rounded-lg px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors cursor-pointer';
  const labelClass = 'block text-sm font-semibold text-foreground mb-2 tracking-wide';
  const errorClass = 'text-xs text-negative mt-1.5';

  return (
    <>
      {showExport && <WeeklyReportExport visits={recentVisits} today={today} onClose={() => setShowExport(false)} />}
      {selectedCustomer && (
        <CustomerDetailPanel
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Add New Customer</h2>
                <p className="text-xs text-muted-foreground mt-0.5">All customers must be assigned a category upon entry</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {addSuccess ? (
              <div className="px-6 py-16 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-positive/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-foreground">Customer added successfully!</p>
                <p className="text-sm text-muted-foreground">{formData.name} · {formData.category}</p>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Category — highlighted as required grouping field */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <label className="block text-xs font-bold text-primary mb-2 uppercase tracking-widest">
                    Customer Category <span className="text-negative">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select the business type that best describes this customer. This grouping is required for all accounts.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {customerCategories.map((cat) => (
                      <button
                        key={`cat-btn-${cat}`}
                        type="button"
                        onClick={() => handleFormChange('category', cat)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                          formData.category === cat
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-input border-border text-foreground hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {formErrors.category && (
                    <p className={`${errorClass} mt-2`}>{formErrors.category}</p>
                  )}
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Customer Name <span className="text-negative">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Kigali Grand Hotel"
                      value={formData.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      className={`${inputClass} ${formErrors.name ? 'border-negative' : ''}`}
                    />
                    {formErrors.name && <p className={errorClass}>{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Area / Location <span className="text-negative">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Kigali Centre"
                      value={formData.area}
                      onChange={(e) => handleFormChange('area', e.target.value)}
                      className={`${inputClass} ${formErrors.area ? 'border-negative' : ''}`}
                    />
                    {formErrors.area && <p className={errorClass}>{formErrors.area}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Contact Person <span className="text-negative">*</span></label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={formData.contactPerson}
                      onChange={(e) => handleFormChange('contactPerson', e.target.value)}
                      className={`${inputClass} ${formErrors.contactPerson ? 'border-negative' : ''}`}
                    />
                    {formErrors.contactPerson && <p className={errorClass}>{formErrors.contactPerson}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input
                      type="text"
                      placeholder="+250 788 000 000"
                      value={formData.phone}
                      onChange={(e) => handleFormChange('phone', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Assigned Sales Rep <span className="text-negative">*</span></label>
                    {canViewAllReps ? (
                      <select
                        value={formData.salesperson}
                        onChange={(e) => handleFormChange('salesperson', e.target.value)}
                        className={`${selectClass} ${formErrors.salesperson ? 'border-negative' : ''}`}
                      >
                        <option value="">Select rep...</option>
                        {salespeople.map((sp) => (
                          <option key={`add-sp-${sp.id}`} value={sp.id}>{sp.label}</option>
                        ))}
                      </select>
                    ) : (
                      <div className={`${inputClass} bg-muted/40 text-muted-foreground`}>{currentUser.name}</div>
                    )}
                    {formErrors.salesperson && <p className={errorClass}>{formErrors.salesperson}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleFormChange('status', e.target.value as 'Active' | 'Inactive' | 'Prospect')}
                      className={selectClass}
                    >
                      <option value="Prospect">Prospect</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Main Product</label>
                    <select
                      value={formData.mainProduct}
                      onChange={(e) => handleFormChange('mainProduct', e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={`add-prod-${p.id}`} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Monthly Potential (RWF)</label>
                    <input
                      type="number"
                      placeholder="e.g. 500000"
                      value={formData.monthlyPotential}
                      onChange={(e) => handleFormChange('monthlyPotential', e.target.value)}
                      className={inputClass}
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Remarks</label>
                  <textarea
                    rows={3}
                    placeholder="Any notes about this customer..."
                    value={formData.remarks}
                    onChange={(e) => handleFormChange('remarks', e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {saveError && (
                  <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{saveError}</p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomer}
                    disabled={saving}
                    className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Add Customer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Customer Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {canViewAllReps
                ? `${customerList.length} accounts · ${activeCount} active · ${prospectCount} prospects · All Reps`
                : `${filtered.length} accounts · ${currentUser.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExport(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground text-sm font-semibold rounded-lg hover:bg-muted transition-colors active:scale-95"
            >
              <Download size={15} />
              Weekly Report
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors active:scale-95"
            >
              <Plus size={15} />
              Add Customer
            </button>
          </div>
        </div>

        {/* Summary KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Active Accounts
            </p>
            <p className="text-2xl font-bold text-foreground font-tabular mt-1">{activeCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Prospects
            </p>
            <p className="text-2xl font-bold text-info font-tabular mt-1">{prospectCount}</p>
          </div>
          <div
            className={`rounded-xl px-4 py-3 border ${
              overdueCount > 0
                ? 'bg-negative-bg border-negative/20' : 'bg-card border-border'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {overdueCount > 0 && (
                <AlertTriangle size={12} className="text-negative" />
              )}
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Overdue Follow-ups
              </p>
            </div>
            <p
              className={`text-2xl font-bold font-tabular mt-1 ${
                overdueCount > 0 ? 'text-negative' : 'text-foreground'
              }`}
            >
              {overdueCount}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Total Monthly Potential
            </p>
            <p className="text-2xl font-bold text-foreground font-tabular mt-1">
              {formatRWF(totalPotential)}
            </p>
          </div>
        </div>

        {/* Category breakdown strip */}
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Customers by Category
          </p>
          <div className="flex flex-wrap gap-2">
            {customerCategories.map((cat) => {
              const count = categoryBreakdown[cat] || 0;
              return (
                <button
                  key={`cat-strip-${cat}`}
                  onClick={() => {
                    setFilterCategory(filterCategory === cat ? '' : cat);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    filterCategory === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : `${getCategoryBadgeColor(cat)} border-transparent hover:opacity-80`
                  }`}
                >
                  {cat}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    filterCategory === cat ? 'bg-white/20' : 'bg-black/10'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search customers, areas, reps..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
              className="bg-input border border-border rounded-lg px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors"
            >
              <option value="">All Categories</option>
              {customerCategories.map((cat) => (
                <option key={`filter-cat-${cat}`} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {canViewAllReps ? (
              <select
                value={filterSalesperson}
                onChange={(e) => { setFilterSalesperson(e.target.value); setPage(1); }}
                className="bg-input border border-border rounded-lg px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors"
              >
                <option value="">All Reps</option>
                {salespeople.map((sp) => (
                  <option key={`filter-sp-${sp.id}`} value={sp.id}>
                    {sp.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary text-xs font-semibold rounded-lg border border-primary/20">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {currentUser.name}
              </span>
            )}

            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="bg-input border border-border rounded-lg px-4 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Prospect">Prospect</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors"
              >
                <X size={13} />
                Clear filters
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {(
                    [
                      { key: 'name', label: 'Customer' },
                      { key: 'category', label: 'Category' },
                      { key: 'area', label: 'Area' },
                      { key: 'salesperson', label: 'Rep' },
                      { key: 'status', label: 'Status' },
                      { key: 'monthlyPotential', label: 'Potential/Mo' },
                      { key: 'monthlyCapacity', label: 'Capacity/Mo' },
                      { key: 'visitsThisMonth', label: 'Visits' },
                      { key: 'ordersThisMonth', label: 'Orders' },
                      { key: 'lastOrderDate', label: 'Last Order' },
                      { key: 'nextFollowUp', label: 'Next Follow-up' },
                    ] as { key: SortKey; label: string }[]
                  ).map((col) => (
                    <th
                      key={`cth-${col.key}`}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} />
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                          <Search size={20} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          No customers match your filters
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Try adjusting your search or filter criteria
                        </p>
                        <button
                          onClick={clearFilters}
                          className="text-xs font-medium text-accent hover:text-accent/80"
                        >
                          Clear all filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageData.map((customer) => {
                    const capacityPct =
                      customer.monthlyPotential > 0
                        ? Math.round(
                            (customer.monthlyCapacity / customer.monthlyPotential) * 100
                          )
                        : 0;
                    const overdue = isOverdue(customer.nextFollowUp, today);

                    return (
                      <tr
                        key={`cust-row-${customer.id}`}
                        className="hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        {/* Customer name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                              {customer.name
                                .split(' ')
                                .slice(0, 2)
                                .map((w) => w[0])
                                .join('')}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate max-w-[160px]">
                                {customer.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {customer.contactPerson || '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${getCategoryBadgeColor(customer.category)}`}>
                            {customer.category}
                          </span>
                        </td>

                        {/* Area */}
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {customer.area}
                        </td>

                        {/* Rep */}
                        <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                          {customer.salesperson ? customer.salesperson.split(' ')[0] : 'Unassigned'}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <Badge
                            label={customer.status}
                            variant={getStatusVariant(customer.status)}
                            dot
                            size="sm"
                          />
                        </td>

                        {/* Monthly Potential */}
                        <td className="px-4 py-3 text-sm text-muted-foreground font-tabular text-right whitespace-nowrap">
                          {formatRWF(customer.monthlyPotential)}
                        </td>

                        {/* Monthly Capacity + health bar */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground font-tabular">
                                {formatRWF(customer.monthlyCapacity)}
                              </span>
                              <span
                                className={`text-[11px] font-bold font-tabular ${getCapacityTextColor(
                                  capacityPct
                                )}`}
                              >
                                {capacityPct}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full health-bar-fill ${getCapacityColor(
                                  capacityPct
                                )}`}
                                style={{ width: `${Math.min(capacityPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Visits */}
                        <td className="px-4 py-3 text-center text-sm font-tabular text-foreground">
                          {customer.visitsThisMonth}
                        </td>

                        {/* Orders */}
                        <td className="px-4 py-3 text-center">
                          {customer.ordersThisMonth > 0 ? (
                            <span className="text-sm font-semibold text-positive font-tabular">
                              {customer.ordersThisMonth}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">0</span>
                          )}
                        </td>

                        {/* Last Order */}
                        <td className="px-4 py-3 text-sm text-muted-foreground font-tabular whitespace-nowrap">
                          {customer.lastOrderDate || '—'}
                        </td>

                        {/* Next Follow-up */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {customer.nextFollowUp ? (
                            <div className="flex items-center gap-1.5">
                              {overdue && (
                                <AlertTriangle size={12} className="text-negative shrink-0" />
                              )}
                              <span
                                className={`text-sm font-tabular ${
                                  overdue ? 'text-negative font-semibold' : 'text-muted-foreground'
                                }`}
                              >
                                {customer.nextFollowUp}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            title="View customer details"
                            onClick={() => setSelectedCustomer(customer)}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors ml-auto"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-muted/20 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={`ps-${s}`} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of{' '}
                {sorted.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="w-7 h-7 rounded-md flex items-center justify-center border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded-md flex items-center justify-center border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={`cpage-${i + 1}`}
                  onClick={() => setPage(i + 1)}
                  className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                    page === i + 1
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 rounded-md flex items-center justify-center border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={13} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="w-7 h-7 rounded-md flex items-center justify-center border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}