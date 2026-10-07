'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Loader2, Calculator, CheckCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { formatRWFFull } from '@/lib/format';
import { useConfig } from '@/context/ConfigContext';
import { useUser } from '@/context/UserContext';
import { createVisitLog } from '@/actions/visits';
import { CUSTOMER_TYPE_LABELS, PAYMENT_STATUS_OPTIONS, type PaymentStatusValue } from '@/lib/types';
import type { CustomerOption } from './DailySalesEntryClient';

interface VisitFormData {
  salespersonId: string;
  dateOfVisit: string;
  customerId: string;
  visitOutcome: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  paymentStatus: PaymentStatusValue | '';
  nextFollowUpDate: string;
  remarks: string;
}

interface SalesEntryFormProps {
  customers: CustomerOption[];
  today: string;
}

export default function SalesEntryForm({ customers, today }: SalesEntryFormProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { currentUser, canViewAllReps } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const emptyForm: VisitFormData = {
    salespersonId: canViewAllReps ? '' : currentUser.id,
    dateOfVisit: today,
    customerId: '',
    visitOutcome: '',
    productId: '',
    quantity: 0,
    unitPrice: 0,
    paymentStatus: '',
    nextFollowUpDate: '',
    remarks: '',
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<VisitFormData>({ defaultValues: emptyForm });

  const quantity = Number(watch('quantity')) || 0;
  const unitPrice = Number(watch('unitPrice')) || 0;
  const salesValue = quantity * unitPrice;
  const selectedCustomer = customers.find((c) => c.id === watch('customerId'));
  const hasOrder = quantity > 0;

  const productField = register('productId', {
    validate: (v) => !hasOrder || !!v || 'Select the product sold',
  });

  const onSubmit = async (data: VisitFormData) => {
    setIsSubmitting(true);
    try {
      const res = await createVisitLog({
        salespersonId: data.salespersonId || undefined,
        customerId: data.customerId,
        dateOfVisit: data.dateOfVisit,
        visitOutcome: data.visitOutcome,
        productId: data.productId || undefined,
        quantity: Number(data.quantity) || 0,
        unitPrice: Number(data.unitPrice) || 0,
        paymentStatus: data.paymentStatus || 'PENDING',
        nextFollowUpDate: data.nextFollowUpDate || undefined,
        remarks: data.remarks,
      });

      if (!res.success) {
        toast.error('Visit was not saved', { description: res.error });
        return;
      }

      setSubmitSuccess(true);
      toast.success('Visit logged', {
        description: `${res.data?.customerName} · ${formatRWFFull(res.data?.salesValue ?? 0)}`,
      });
      router.refresh();
      setTimeout(() => {
        setSubmitSuccess(false);
        reset({ ...emptyForm, salespersonId: data.salespersonId, dateOfVisit: data.dateOfVisit });
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-input border border-border rounded-lg px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors';
  const selectClass =
    'w-full bg-input border border-border rounded-lg px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors cursor-pointer';
  const readOnlyClass =
    'w-full bg-muted/40 border border-border rounded-lg px-4 py-3 text-base text-muted-foreground';
  const labelClass = 'block text-sm font-semibold text-foreground mb-2 tracking-wide';
  const errorClass = 'text-xs text-negative mt-1.5';
  const helperClass = 'text-xs text-muted-foreground mt-1.5';

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Section: Visit Details */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-5 py-3 bg-muted/40 border-b border-border">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Visit Details
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Salesperson: managers choose, officers always log as themselves */}
            <div>
              <label className={labelClass} htmlFor="salespersonId">
                Salesperson <span className="text-negative">*</span>
              </label>
              {canViewAllReps ? (
                <select
                  id="salespersonId"
                  className={selectClass}
                  {...register('salespersonId', { required: 'Select a salesperson' })}
                >
                  <option value="">Select rep...</option>
                  {config.salespeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={readOnlyClass}>{currentUser.name}</div>
              )}
              {errors.salespersonId && <p className={errorClass}>{errors.salespersonId.message}</p>}
            </div>

            {/* Date of Visit */}
            <div>
              <label className={labelClass} htmlFor="dateOfVisit">
                Date of Visit <span className="text-negative">*</span>
              </label>
              <input
                id="dateOfVisit"
                type="date"
                max={today}
                className={inputClass}
                {...register('dateOfVisit', { required: 'Date is required' })}
              />
              {errors.dateOfVisit && <p className={errorClass}>{errors.dateOfVisit.message}</p>}
            </div>

            {/* Visit Outcome */}
            <div>
              <label className={labelClass} htmlFor="visitOutcome">
                Visit Outcome <span className="text-negative">*</span>
              </label>
              <select
                id="visitOutcome"
                className={selectClass}
                {...register('visitOutcome', { required: 'Select an outcome' })}
              >
                <option value="">Select outcome...</option>
                {config.visitOutcomes.map((o) => (
                  <option key={o.id} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.visitOutcome && <p className={errorClass}>{errors.visitOutcome.message}</p>}
            </div>
          </div>
        </div>

        {/* Section: Customer */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-5 py-3 bg-muted/40 border-b border-border">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Customer Information
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass} htmlFor="customerId">
                Customer <span className="text-negative">*</span>
              </label>
              <select
                id="customerId"
                className={selectClass}
                {...register('customerId', { required: 'Select a customer' })}
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className={helperClass}>
                New customer?{' '}
                <Link href="/customer-management" className="underline hover:text-foreground">
                  Add them in Customer Management
                </Link>
              </p>
              {errors.customerId && <p className={errorClass}>{errors.customerId.message}</p>}
            </div>
            <div>
              <span className={labelClass}>Area / Location</span>
              <div className={readOnlyClass}>{selectedCustomer?.area || '—'}</div>
            </div>
            <div>
              <span className={labelClass}>Customer Category</span>
              <div className={readOnlyClass}>{selectedCustomer?.category || '—'}</div>
            </div>
            <div>
              <span className={labelClass}>New or Existing</span>
              <div className={readOnlyClass}>
                {selectedCustomer ? CUSTOMER_TYPE_LABELS[selectedCustomer.customerType] : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Section: Order Details */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-5 py-3 bg-accent/5 border-b border-accent/20">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">
              Order Details <span className="normal-case tracking-normal font-normal">— leave quantity at 0 if no order</span>
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Product */}
            <div>
              <label className={labelClass} htmlFor="productId">
                Product
              </label>
              <select
                id="productId"
                className={selectClass}
                {...productField}
                onChange={(e) => {
                  productField.onChange(e);
                  const product = config.products.find((p) => p.id === e.target.value);
                  if (product) setValue('unitPrice', product.unitPrice);
                }}
              >
                <option value="">Select product...</option>
                {config.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {errors.productId && <p className={errorClass}>{errors.productId.message}</p>}
            </div>

            {/* Quantity */}
            <div>
              <label className={labelClass} htmlFor="quantity">
                Quantity (units)
              </label>
              <input
                id="quantity"
                type="number"
                min="0"
                className={inputClass}
                placeholder="0"
                {...register('quantity', { min: { value: 0, message: 'Must be 0 or more' }, valueAsNumber: true })}
              />
              {errors.quantity && <p className={errorClass}>{errors.quantity.message}</p>}
            </div>

            {/* Unit Price */}
            <div>
              <label className={labelClass} htmlFor="unitPrice">
                Unit Price (RWF)
              </label>
              <input
                id="unitPrice"
                type="number"
                min="0"
                className={inputClass}
                placeholder="0"
                {...register('unitPrice', { min: { value: 0, message: 'Must be 0 or more' }, valueAsNumber: true })}
              />
              <p className={helperClass}>Filled from the product list price; adjust if discounted</p>
              {errors.unitPrice && <p className={errorClass}>{errors.unitPrice.message}</p>}
            </div>

            {/* Calculated Sales Value */}
            <div className="sm:col-span-2 lg:col-span-1">
              <span className={labelClass}>Sales Value (RWF)</span>
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
                <Calculator size={16} className="text-primary shrink-0" />
                <span className="text-sm font-bold text-primary font-tabular">{formatRWFFull(salesValue)}</span>
              </div>
              <p className={helperClass}>Auto-calculated: Quantity × Unit Price</p>
            </div>

            {/* Payment Status */}
            <div>
              <label className={labelClass} htmlFor="paymentStatus">
                Payment Status {hasOrder && <span className="text-negative">*</span>}
              </label>
              <select
                id="paymentStatus"
                className={selectClass}
                {...register('paymentStatus', {
                  validate: (v) => !hasOrder || !!v || 'Select payment status',
                })}
              >
                <option value="">Select status...</option>
                {PAYMENT_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.paymentStatus && <p className={errorClass}>{errors.paymentStatus.message}</p>}
            </div>
          </div>
        </div>

        {/* Section: Follow-up & Remarks */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-5">
          <div className="px-5 py-3 bg-muted/40 border-b border-border">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Follow-up & Notes
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelClass} htmlFor="nextFollowUpDate">
                Next Follow-up Date
              </label>
              <input id="nextFollowUpDate" type="date" min={today} className={inputClass} {...register('nextFollowUpDate')} />
              <p className={helperClass}>Leave blank if no follow-up is needed</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="remarks">
                Remarks / Notes
              </label>
              <textarea
                id="remarks"
                rows={4}
                className={`${inputClass} resize-none`}
                placeholder="Any additional context about this visit..."
                {...register('remarks')}
              />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mb-4">
          <span className="text-negative">*</span> Required fields
        </p>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || submitSuccess}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-95 w-44 ${
              submitSuccess
                ? 'bg-positive text-white cursor-default'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Saving...
              </>
            ) : submitSuccess ? (
              <>
                <CheckCircle size={15} />
                Saved
              </>
            ) : (
              'Log Visit'
            )}
          </button>
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
            onClick={() => reset(emptyForm)}
          >
            Clear Form
          </button>
        </div>
      </form>
    </>
  );
}
