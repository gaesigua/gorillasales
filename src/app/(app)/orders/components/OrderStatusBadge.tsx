import React from 'react';
import Badge from '@/components/ui/Badge';
import { ORDER_STATUS_LABELS, type OrderStatusValue } from '@/lib/types';

const VARIANTS: Record<OrderStatusValue, 'success' | 'warning' | 'info' | 'error'> = {
  PENDING_APPROVAL: 'warning',
  CONFIRMED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'error',
};

export default function OrderStatusBadge({ status }: { status: OrderStatusValue }) {
  return <Badge label={ORDER_STATUS_LABELS[status]} variant={VARIANTS[status]} />;
}
