import React from 'react';
import Badge from '@/components/ui/Badge';
import { INVOICE_STATUS_LABELS, type InvoiceStatusValue } from '@/lib/types';

const VARIANTS: Record<InvoiceStatusValue, 'success' | 'warning' | 'info' | 'error' | 'neutral'> = {
  PAID: 'success',
  PARTIAL: 'info',
  UNPAID: 'warning',
  OVERDUE: 'error',
  VOID: 'neutral',
  CREDITED: 'neutral',
  REFUND_DUE: 'warning',
};

export default function InvoiceStatusBadge({ status }: { status: InvoiceStatusValue }) {
  return <Badge label={INVOICE_STATUS_LABELS[status]} variant={VARIANTS[status]} />;
}
