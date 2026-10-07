// UI-facing data shapes returned by the server data layer (src/lib/data) and server actions.
import type { Role } from './roles';

export type OrderStatusValue = 'PENDING_APPROVAL' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDING_APPROVAL: 'Credit Hold',
  CONFIRMED: 'Confirmed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export type PaymentMethodValue = 'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'BANK_TRANSFER' | 'CHEQUE';
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  CASH: 'Cash',
  MTN_MOMO: 'MTN MoMo',
  AIRTEL_MONEY: 'Airtel Money',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
};

export type InvoiceStatusValue = 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'VOID';
export const INVOICE_STATUS_LABELS: Record<InvoiceStatusValue, string> = {
  PAID: 'Paid',
  PARTIAL: 'Part Paid',
  UNPAID: 'Unpaid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
};

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
  // Order taken during this visit, if any (cancelled orders are ignored)
  orderId?: string;
  orderNumber?: string;
  orderStatus?: OrderStatusValue;
  productSummary: string; // e.g. "250G Roasted Coffee ×10, 1KG Roasted Coffee ×2"
  salesValue: number; // order total incl. VAT, 0 when no order
  weightKg: number; // coffee weight of the order
  customerType: string; // label, e.g. "Existing Customer"
  nextFollowUpDate: string;
  remarks: string;
}

export interface OrderLine {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitWeightKg: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: OrderStatusValue;
  customerId: string;
  customerName: string;
  area: string;
  salespersonId: string;
  salesperson: string;
  visitLogId: string;
  paymentTermsDays: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  weightKg: number;
  notes: string;
  holdReason: string;
  cancelReason: string;
  lines: OrderLine[];
  invoiceId: string;
  invoiceNumber: string;
  amountPaid: number; // payments on this order's invoice
}

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: PaymentMethodValue;
  reference: string;
  paidOn: string;
  receivedBy: string;
  notes: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerTin: string;
  salespersonId: string;
  salesperson: string;
  issueDate: string;
  dueDate: string;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  paid: number;
  balance: number;
  status: InvoiceStatusValue;
  daysOverdue: number;
  ebmReceiptNumber: string;
  payments: PaymentRecord[];
}

export interface AgingTotals {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
  overdue: number;
}

export interface PriceListItemDTO {
  productId: string;
  unitPrice: number;
}

export interface PriceListDTO {
  id: string;
  name: string;
  description: string;
  items: PriceListItemDTO[];
  customerCount: number;
}

export interface OrganizationSettings {
  name: string;
  tin: string;
  vatRate: number;
  pricesIncludeVat: boolean;
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
  tin: string;
  province: string;
  district: string;
  sector: string;
  priceListId: string;
  paymentTermsDays: number; // 0 = cash on delivery
  creditLimit: number;
  outstandingBalance: number; // unpaid invoices
  overdueBalance: number; // unpaid invoices past due
  openOrdersTotal: number; // confirmed/held orders not yet invoiced
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
  settings: OrganizationSettings;
  priceLists: { id: string; name: string }[];
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
  actualSales: number; // order value (excl. cancelled) by order date
  actualWeightKg: number;
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
  receivables: AgingTotals;
  ordersOnHold: number;
  ordersToDeliver: number;
  repRows: RepPerformanceRow[];
  trend: TrendPoint[];
  overdue: OverdueFollowUp[];
  openDeals: PipelineDeal[];
}

/** Minimal customer info for order/visit pickers. */
export interface CustomerOption {
  id: string;
  name: string;
  area: string;
  category: string;
  customerType: CustomerTypeValue;
  priceListId: string | null;
  paymentTermsDays: number;
}

/** priceListId -> productId -> unit price, for showing customer-specific prices in forms. */
export type PriceBook = Record<string, Record<string, number>>;
