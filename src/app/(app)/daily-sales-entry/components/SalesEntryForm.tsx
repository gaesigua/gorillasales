'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Loader2, CheckCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { formatRWFFull } from '@/lib/format';
import { useConfig } from '@/context/ConfigContext';
import { useUser } from '@/context/UserContext';
import { createVisitLog } from '@/actions/visits';
import { CUSTOMER_TYPE_LABELS } from '@/lib/types';
import OrderLinesEditor, { completedLines, emptyLine, type DraftLine } from '@/components/orders/OrderLinesEditor';
import type { CustomerOption, PriceBook } from './DailySalesEntryClient';

interface VisitFormData {
  salespersonId: string;
  dateOfVisit: string;
  customerId: string;
  visitOutcome: string;
  nextFollowUpDate: string;
  remarks: string;
}

interface SalesEntryFormProps {
  customers: CustomerOption[];
  priceBook: PriceBook;
  today: string;
  /** Pre-fill from a route stop; `nonce` changes on every click so the same stop can be picked again. */
  preset?: { customerId: string; salespersonId: string; nonce: number } | null;
}

export default function SalesEntryForm({ customers, priceBook, today, preset }: SalesEntryFormProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { currentUser, canViewAllReps } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const emptyForm: VisitFormData = {
    salespersonId: canViewAllReps ? '' : currentUser.id,
    dateOfVisit: today,
    customerId: '',
    visitOutcome: '',
    nextFollowUpDate: '',
    remarks: '',
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<VisitFormData>({ defaultValues: emptyForm });

  useEffect(() => {
    if (!preset) return;
    setValue('customerId', preset.customerId);
    if (canViewAllReps) setValue('salespersonId', preset.salespersonId);
  }, [preset, setValue, canViewAllReps]);

  const selectedCustomer = customers.find((c) => c.id === watch('customerId'));
  const priceFor = (productId: string) =>
    (selectedCustomer?.priceListId ? priceBook[selectedCustomer.priceListId]?.[productId] : undefined) ??
    config.products.find((p) => p.id === productId)?.unitPrice ??
    0;

  const onSubmit = async (data: VisitFormData) => {
    setIsSubmitting(true);
    try {
      const orderLines = completedLines(lines, canViewAllReps);
      const res = await createVisitLog({
        salespersonId: data.salespersonId || undefined,
        customerId: data.customerId,
        dateOfVisit: data.dateOfVisit,
        visitOutcome: data.visitOutcome,
        nextFollowUpDate: data.nextFollowUpDate || undefined,
        remarks: data.remarks,
        orderLines,
      });

      if (!res.success) {
        toast.error('Visit was not saved', { description: res.error });
        return;
      }

      setSubmitSuccess(true);
      const v = res.data;
      toast.success(v?.orderNumber ? `Visit and order ${v.orderNumber} saved` : 'Visit logged', {
        description: v?.orderNumber
          ? `${v.customerName} · ${formatRWFFull(v.salesValue)}${v.orderStatus === 'PENDING_APPROVAL' ? ' · on credit hold, needs manager approval' : ''}`
          : v?.customerName,
      });
      router.refresh();
      setTimeout(() => {
        setSubmitSuccess(false);
        reset({ ...emptyForm, salespersonId: data.salespersonId, dateOfVisit: data.dateOfVisit });
        setLines([emptyLine()]);
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
              Order Taken <span className="normal-case tracking-normal font-normal">— leave empty if no order</span>
            </h3>
          </div>
          <div className="p-5">
            <OrderLinesEditor
              lines={lines}
              onChange={setLines}
              products={config.products}
              priceFor={priceFor}
              canEditPrice={canViewAllReps}
              vatRate={config.settings.vatRate}
              pricesIncludeVat={config.settings.pricesIncludeVat}
            />
            {selectedCustomer && (
              <p className="text-xs text-muted-foreground mt-3">
                {selectedCustomer.paymentTermsDays > 0
                  ? `Credit terms: pay within ${selectedCustomer.paymentTermsDays} days of delivery.`
                  : 'Cash on delivery.'}{' '}
                Orders over the credit limit, or for customers with overdue invoices, go on hold for manager approval.
              </p>
            )}
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
            onClick={() => {
              reset(emptyForm);
              setLines([emptyLine()]);
            }}
          >
            Clear Form
          </button>
        </div>
      </form>
    </>
  );
}
