// UI-facing data shapes returned by the server data layer (src/lib/data) and server actions.
import type { Role } from './roles';

export type PaymentStatusValue = 'PAID' | 'CREDIT' | 'PENDING' | 'OVERDUE' | 'PARTIAL';

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatusValue; label: string }[] = [
  { value: 'PAID', label: 'Paid' },
  { value: 'CREDIT', label: 'Credit' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'OVERDUE', label: 'Overdue' },
];

export function paymentStatusLabel(value: string): string {
  return PAYMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export type CustomerTypeValue = 'NEW_CUSTOMER' | 'EXISTING_CUSTOMER';
export const CUSTOMER_TYPE_LABELS: Record<CustomerTypeValue, string> = {
  NEW_CUSTOMER: 'New Customer',
  EXISTING_CUSTOMER: 'Existing Customer',
};

export type CustomerStatusValue = 'ACTIVE' | 'INACTIVE' | 'PROSPECT';
export type CustomerStatusLabel = 'Active' | 'Inactive' | 'Prospect';
export const CUSTOMER_STATUS_LABELS: Record<CustomerStatusValue, CustomerStatusLabel> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  PROSPECT: 'Prospect',
};

export interface VisitLog {
  id: string;
  timestamp: string;
  salespersonId: string;
  salesperson: string;
  dateOfVisit: string;
  customerId: string;
  customerName: string;
  area: string;
  customerCategory: string;
  visitOutcome: string;
  productId?: string;
  productCategory: string; // product name
  quantity: number;
  weightKg: number; // quantity × product unit weight
  unitPrice: number;
  salesValue: number;
  paymentStatus: string; // label, e.g. "Paid"
  customerType: string; // label, e.g. "Existing Customer"
  nextFollowUpDate: string;
  remarks: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  category: string;
  customerType: CustomerTypeValue;
  area: string;
  contactPerson: string;
  phone: string;
  email: string;
  salespersonId: string;
  salesperson: string;
  mainProductId: string;
  mainProduct: string;
  monthlyPotential: number;
  monthlyCapacity: number; // sales value this month
  status: CustomerStatusLabel;
  nextFollowUp: string;
  visitsThisMonth: number;
  ordersThisMonth: number;
  lastOrderDate: string;
  remarks: string;
  outstandingBalance: number;
  creditLimit: number;
}

export interface PipelineStage {
  id: string;
  name: string;
  probability: number;
  sortOrder: number;
  color?: string;
}

export interface PipelineDeal {
  id: string;
  title: string;
  customerId: string;
  customer: string;
  area: string;
  contactPerson: string;
  potentialValue: number;
  salespersonId: string;
  salesperson: string;
  stageId: string;
  stage: string;
  lastContact: string;
  nextAction: string;
  followUpDate: string;
  probability: number;
  weightedValue: number;
  remarks: string;
}

export interface RepMonthlyTarget {
  id: string;
  salespersonId: string;
  repName: string;
  month: number; // 0-11
  year: number;
  targetAmount: number; // RWF
  targetWeightKg: number;
}

export interface CommissionRule {
  id: string;
  name: string;
  type: 'percentage' | 'flat';
  value: number;
  thresholdPct: number;
  description: string;
  sortOrder: number;
}

export interface LookupItem {
  id: string;
  label: string;
  sortOrder: number;
}

export interface ProductItem {
  id: string;
  label: string;
  sku: string;
  category: string;
  unitPrice: number;
  unitOfMeasure: string;
  weightKg: number;
}

export interface SalespersonItem {
  id: string;
  label: string;
  initials: string;
}

/** Org-wide reference data used by forms and filters on every page. */
export interface AppConfig {
  salespeople: SalespersonItem[];
  customerCategories: LookupItem[];
  visitOutcomes: LookupItem[];
  products: ProductItem[];
  pipelineStages: PipelineStage[];
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  organizationName: string;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  initials: string;
  phone: string;
  area: string;
  employeeCode: string;
  lastLogin: string;
  joinedDate: string;
  salesThisMonth: number;
  customersAssigned: number;
}

export type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };

export interface RepPerformanceRow {
  salespersonId: string;
  salesperson: string;
  target: number;
  targetWeightKg: number;
  actualSales: number;
  achievementPct: number;
  newCustomers: number;
  customerVisits: number;
  orders: number;
  outstandingFollowUps: number;
}

export interface OverdueFollowUp {
  id: string; // visit id
  customerId: string;
  customer: string;
  area: string;
  salespersonId: string;
  salesperson: string;
  dueDate: string;
  daysOverdue: number;
  lastOutcome: string;
}

export interface TrendPoint {
  month: string; // short label, e.g. "Sep 26"
  target: number;
  actual: number;
}

export interface DashboardData {
  today: string; // YYYY-MM-DD, Kigali
  month: number;
  year: number;
  repRows: RepPerformanceRow[];
  trend: TrendPoint[];
  overdue: OverdueFollowUp[];
  openDeals: PipelineDeal[];
}
