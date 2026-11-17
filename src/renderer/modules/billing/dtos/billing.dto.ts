// =============================================================================
// Billing DTOs and Types
// =============================================================================

import { PatientDTO } from '../../patient-registration/dtos/patient.dto';

// Enums
export const INVOICE_STATUS = [
  'Draft',
  'Pending',
  'Partial',
  'Paid',
  'Overdue',
  'Cancelled',
  'Refunded',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const PAYMENT_METHODS = [
  'Cash',
  'Card',
  'Bank Transfer',
  'Insurance',
  'NHIS',
  'Cheque',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CHARGE_CATEGORIES = [
  'Consultation',
  'Laboratory',
  'Radiology',
  'Pharmacy',
  'Nursing',
  'Procedure',
  'Admission',
  'Supplies',
  'Other',
] as const;
export type ChargeCategory = (typeof CHARGE_CATEGORIES)[number];

// =============================================================================
// Invoice DTOs
// =============================================================================

export interface InvoiceItemDTO {
  item_id: string;
  invoice_id: string;
  description: string;
  category: ChargeCategory;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  reference_id?: string; // Reference to lab test, radiology, prescription, etc.
  reference_type?: string;
  created_at: string;
}

// Encounter reference for billing records
export interface EncounterRef {
  visit_id: string;
  encounter_number?: string | null;
  visit_type?: string;
  chief_complaint?: string;
}

export interface InvoiceDTO {
  invoice_id: string;
  invoice_number: string;
  patient_id: string;
  encounter_id?: string;
  consultation_id?: string | null;
  subtotal: number;
  discount_total?: number;
  discount_amount?: number;
  discount_percent?: number;
  tax_amount: number;
  tax_percent?: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: InvoiceStatus;
  due_date?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
  // Relations
  patient?: PatientDTO;
  encounter?: EncounterRef;
  items?: InvoiceItemDTO[];
  payments?: PaymentDTO[];
  // NHIS fields for consolidated invoices
  nhis_covered?: boolean;
  nhis_payable?: number;
  patient_payable?: number;
  // Consolidated invoice markers
  _isConsolidated?: boolean;
  _billingOrderIds?: string[];
  _source?: string;
}

export interface CreateInvoiceDTO {
  patient_id: string;
  encounter_id: string; // Required - every invoice must be tied to an encounter
  consultation_id?: string;
  items: CreateInvoiceItemDTO[];
  discount_percent?: number;
  tax_percent?: number;
  due_date?: string;
  notes?: string;
}

export interface CreateInvoiceItemDTO {
  description: string;
  category: ChargeCategory;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  reference_id?: string;
  reference_type?: string;
}

export interface UpdateInvoiceDTO {
  invoice_id: string;
  status?: InvoiceStatus;
  due_date?: string;
  notes?: string;
}

// =============================================================================
// Payment DTOs
// =============================================================================

export interface PaymentDTO {
  payment_id: string;
  invoice_id: string;
  receipt_number: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  received_by: string;
  notes?: string;
  created_at: string;
  // Relations
  invoice?: InvoiceDTO;
  received_by_staff?: {
    first_name: string;
    last_name: string;
  };
}

export interface CreatePaymentDTO {
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
}

// =============================================================================
// Price List DTOs
// =============================================================================

export interface PriceItemDTO {
  price_id: string;
  item_code: string;
  item_name: string;
  category: ChargeCategory;
  unit_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePriceItemDTO {
  item_code: string;
  item_name: string;
  category: ChargeCategory;
  unit_price: number;
}

// =============================================================================
// Filter Types
// =============================================================================

export interface InvoiceFilters {
  patient_id?: string;
  status?: InvoiceStatus;
  from_date?: string;
  to_date?: string;
  search?: string;
  /** Page number (1-based). Default 1 */
  page?: number;
  /** Items per page. Default 50, max 200 */
  pageSize?: number;
}

export interface PaymentFilters {
  invoice_id?: string;
  payment_method?: PaymentMethod;
  from_date?: string;
  to_date?: string;
}

// =============================================================================
// Statistics
// =============================================================================

export interface BillingStats {
  total_invoiced: number;
  total_collected: number;
  outstanding: number;
  outstanding_today: number; // Outstanding from invoices created today
  invoices_today: number;
  payments_today: number;
  invoiced_today: number; // Total amount invoiced today
  overdue_invoices: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

export function getInvoiceStatusColor(status: InvoiceStatus): string {
  const colors: Record<InvoiceStatus, string> = {
    Draft: 'gray',
    Pending: 'yellow',
    Partial: 'blue',
    Paid: 'green',
    Overdue: 'orange',
    Cancelled: 'red',
    Refunded: 'purple',
  };
  return colors[status];
}

export function getPaymentMethodColor(method: PaymentMethod): string {
  const colors: Record<PaymentMethod, string> = {
    Cash: 'green',
    Card: 'blue',
    'Bank Transfer': 'indigo',
    Insurance: 'purple',
    NHIS: 'cyan',
    Cheque: 'yellow',
  };
  return colors[method];
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    currencyDisplay: 'code',
  }).format(amount);
}

export function generateInvoiceNumber(date: Date = new Date()): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `INV-${year}${month}-${timestamp}${random}`;
}

export function generateReceiptNumber(date: Date = new Date()): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `RCP-${year}${month}-${random}`;
}

export function calculateItemTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number = 0,
): { discount: number; total: number } {
  const subtotal = quantity * unitPrice;
  const discount = subtotal * (discountPercent / 100);
  const total = subtotal - discount;
  return { discount, total };
}
