'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/context/ConfigContext';
import { useUser } from '@/context/UserContext';
import { createCustomer, updateCustomer, type CustomerInput } from '@/actions/customers';
import { RWANDA_DISTRICTS, RWANDA_PROVINCES } from '@/lib/rwanda';
import type { Customer, CustomerStatusValue } from '@/lib/types';

const STATUS_VALUES: Record<Customer['status'], CustomerStatusValue> = {
  Active: 'ACTIVE',
  Inactive: 'INACTIVE',
  Prospect: 'PROSPECT',
};

interface FormState {
  name: string;
  category: string;
  customerType: 'NEW_CUSTOMER' | 'EXISTING_CUSTOMER';
  status: Customer['status'];
  area: string;
  contactPerson: string;
  phone: string;
  email: string;
  tin: string;
  province: string;
  district: string;
  sector: string;
  mainProductId: string;
  monthlyPotential: string;
  remarks: string;
  salespersonId: string;
  priceListId: string;
  creditLimit: string;
  paymentTermsDays: string;
}

function toForm(c: Customer | null): FormState {
  return {
    name: c?.name ?? '',
    category: c?.category ?? '',
    customerType: c?.customerType ?? 'NEW_CUSTOMER',
    status: c?.status ?? 'Prospect',
    area: c?.area ?? '',
    contactPerson: c?.contactPerson ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    tin: c?.tin ?? '',
    province: c?.province ?? '',
    district: c?.district ?? '',
    sector: c?.sector ?? '',
    mainProductId: c?.mainProductId ?? '',
    monthlyPotential: c ? String(c.monthlyPotential) : '',
    remarks: c?.remarks ?? '',
    salespersonId: c?.salespersonId ?? '',
    priceListId: c?.priceListId ?? '',
    creditLimit: c ? String(c.creditLimit) : '0',
    paymentTermsDays: c ? String(c.paymentTermsDays) : '0',
  };
}

interface CustomerFormModalProps {
  /** Customer to edit, or null to create a new one. */
  customer: Customer | null;
  onClose: () => void;
}

export default function CustomerFormModal({ customer, onClose }: CustomerFormModalProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { currentUser, canViewAllReps } = useUser();
  const [form, setForm] = useState<FormState>(() => toForm(customer));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isEdit = !!customer;

  const set = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value, ...(field === 'province' ? { district: '' } : {}) }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = 'Customer name is required';
    if (!form.category) e.category = 'Choose a category';
    if (!form.area.trim()) e.area = 'Area is required';
    if (!form.contactPerson.trim()) e.contactPerson = 'Contact person is required';
    if (form.tin && !/^\d{9}$/.test(form.tin.trim())) e.tin = 'TIN must be 9 digits';
    if (canViewAllReps && Number(form.paymentTermsDays) > 0 && !(Number(form.creditLimit) > 0)) {
      e.creditLimit = 'Set a credit limit for customers on credit terms';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    const payload: CustomerInput = {
      name: form.name,
      category: form.category,
      customerType: form.customerType,
      status: STATUS_VALUES[form.status],
      area: form.area,
      contactPerson: form.contactPerson,
      phone: form.phone,
      email: form.email,
      tin: form.tin,
      province: form.province,
      district: form.district,
      sector: form.sector,
      mainProductId: form.mainProductId,
      monthlyPotential: Number(form.monthlyPotential) || 0,
      remarks: form.remarks,
      salespersonId: form.salespersonId,
      priceListId: form.priceListId,
      creditLimit: Number(form.creditLimit) || 0,
      paymentTermsDays: Number(form.paymentTermsDays) || 0,
    };
    try {
      const res = isEdit ? await updateCustomer(customer.id, payload) : await createCustomer(payload);
      if (!res.success) {
        setSaveError(res.error);
        return;
      }
      router.refresh();
      setSaved(true);
      setTimeout(onClose, 900);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  const labelClass = 'block text-xs font-semibold text-foreground mb-1.5';
  const errorClass = 'text-xs text-negative mt-1';
  const field = (key: keyof FormState, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, required = false) => (
    <div>
      <label className={labelClass}>
        {label} {required && <span className="text-negative">*</span>}
      </label>
      <input
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className={`${inputClass} ${errors[key] ? 'border-negative' : ''}`}
        {...props}
      />
      {errors[key] && <p className={errorClass}>{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-foreground">{isEdit ? `Edit ${customer.name}` : 'Add New Customer'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Close">
            Close
          </button>
        </div>

        {saved ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
            
            <p className="text-base font-semibold text-foreground">{isEdit ? 'Customer updated' : 'Customer added'}</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6">
            <fieldset className="space-y-4">
              <legend className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Customer</legend>
              <div>
                <label className={labelClass}>
                  Category <span className="text-negative">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {config.customerCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => set('category', cat.label)}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${
                        form.category === cat.label ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {errors.category && <p className={errorClass}>{errors.category}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('name', 'Customer Name', { placeholder: 'e.g. Café Botanika' }, true)}
                {field('contactPerson', 'Contact Person', {}, true)}
                {field('phone', 'Phone', { placeholder: '+250 788 000 000' })}
                {field('email', 'Email', { type: 'email' })}
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
                    <option value="Prospect">Prospect</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>New or Existing</label>
                  <select value={form.customerType} onChange={(e) => set('customerType', e.target.value)} className={inputClass}>
                    <option value="NEW_CUSTOMER">New Customer</option>
                    <option value="EXISTING_CUSTOMER">Existing Customer</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Main Product</label>
                  <select value={form.mainProductId} onChange={(e) => set('mainProductId', e.target.value)} className={inputClass}>
                    <option value="">—</option>
                    {config.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                {field('monthlyPotential', 'Monthly Potential (RWF)', { type: 'number', min: 0 })}
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Location &amp; Tax</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('area', 'Sales Area / Route', { placeholder: 'e.g. Kimihurura' }, true)}
                {field('tin', 'TIN', { placeholder: '9 digits', inputMode: 'numeric', maxLength: 9 })}
                <div>
                  <label className={labelClass}>Province</label>
                  <select value={form.province} onChange={(e) => set('province', e.target.value)} className={inputClass}>
                    <option value="">—</option>
                    {RWANDA_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>District</label>
                  <select
                    value={form.district}
                    onChange={(e) => set('district', e.target.value)}
                    className={inputClass}
                    disabled={!form.province}
                  >
                    <option value="">—</option>
                    {(RWANDA_DISTRICTS[form.province] ?? []).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                {field('sector', 'Sector', { placeholder: 'e.g. Kimihurura' })}
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Sales Terms</legend>
              {canViewAllReps ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Assigned Sales Rep</label>
                    <select value={form.salespersonId} onChange={(e) => set('salespersonId', e.target.value)} className={inputClass}>
                      <option value="">Unassigned</option>
                      {config.salespeople.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Price List</label>
                    <select value={form.priceListId} onChange={(e) => set('priceListId', e.target.value)} className={inputClass}>
                      <option value="">Standard list prices</option>
                      {config.priceLists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Payment Terms</label>
                    <select value={form.paymentTermsDays} onChange={(e) => set('paymentTermsDays', e.target.value)} className={inputClass}>
                      <option value="0">Cash on delivery</option>
                      {[7, 14, 30, 45, 60].map((d) => (
                        <option key={d} value={String(d)}>
                          {d} days after delivery
                        </option>
                      ))}
                    </select>
                  </div>
                  {field('creditLimit', 'Credit Limit (RWF)', {
                    type: 'number',
                    min: 0,
                    disabled: form.paymentTermsDays === '0',
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isEdit
                    ? `Rep: ${customer.salesperson || 'Unassigned'} · ${customer.paymentTermsDays > 0 ? `${customer.paymentTermsDays}-day credit` : 'Cash on delivery'}.`
                    : `Assigned to you (${currentUser.name}), cash on delivery.`}{' '}
                  A manager sets credit terms and price lists.
                </p>
              )}
            </fieldset>

            <div>
              <label className={labelClass}>Remarks</label>
              <textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>

            {saveError && (
              <p className="text-sm text-negative bg-negative-bg border border-negative/20 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Customer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
