// =============================================================================
// Billing Order DTOs and Types
// Central Payment Order Management
// =============================================================================

import { isNhisFeatureEnabled } from '../../../config/features';

// Enums matching database
export const BILLING_ORDER_STATUS = [
  'Pending',
  'Awaiting_Payment',
  'Partially_Paid',
  'Paid',
  'Paid_NHIS',
  'Paid_Retainership',
  'Waived',
  'Cancelled',
] as const;
export type BillingOrderStatus = (typeof BILLING_ORDER_STATUS)[number];

export const SOURCE_MODULES = [
  'registration',
  'consultation',
  'nursing',
  'admission',
  'lab',
  'radiology',
  'pharmacy',
  'procedure',
  // Specialty Clinical Modules
  'dental',
  'ophthalmology',
  'physiotherapy',
] as const;
export type SourceModule = (typeof SOURCE_MODULES)[number];

// Service Types (matching PRD)
export const SERVICE_TYPES = [
  'Consultation',
  'Laboratory',
  'Radiology',
  'Pharmacy',
  'Surgery',
  'Procedure',
  'Nursing',
  'Admission',
  'Supplies',
  'Other',
  // Specialty Clinical Services
  'Dental',
  'Ophthalmology',
  'Physiotherapy',
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

// Payment Methods
export const PAYMENT_METHODS = [
  'Cash',
  'POS',
  'Transfer',
  'NHIS',
  'Retainership',
] as const;
export type PaymentMethodType = (typeof PAYMENT_METHODS)[number];

// =============================================================================
// Billing Order DTOs
// =============================================================================

export type BillingItemStatus = 'Paid' | 'Partially Paid' | 'Unpaid';

/**
 * Billing Order Item DTO - Represents a single line item in a billing order
 * All fields are audit-safe snapshots captured at billing time and should NEVER be recalculated
 */
export interface BillingOrderItemDTO {
  id: string;
  billing_order_id: string;

  // Service identification (audit-safe)
  item_type?: ServiceType | null;
  item_id?: string | null; // Legacy: reference to catalogue ID
  service_reference_id?: string; // UUID reference to source record (lab_requests.id, imaging_requests.id, etc.)

  // Audit-safe snapshots (captured at billing time - NEVER recalculated)
  item_name: string; // Legacy field - kept for compatibility
  service_name: string; // Snapshot of service name at billing time
  unit_price: number; // Legacy field - kept for compatibility
  unit_cost: number; // Snapshot of unit cost at billing time
  quantity: number;
  total_price: number; // Legacy field - kept for compatibility
  gross_amount: number; // Snapshot: quantity * unit_cost (stored, not calculated)

  // NHIS fields (audit-safe snapshots)
  nhis_covered: boolean; // Whether this item is covered by NHIS
  nhis_percentage: number; // Percentage covered (0-100)
  nhis_payable: number; // Amount payable by NHIS
  patient_payable: number; // Amount payable by patient

  status: BillingItemStatus;
  created_at: string;
}

/**
 * Input for creating a billing item - all mandatory audit fields required
 */
export interface CreateBillingItemDTO {
  // Service identification (required)
  item_type: ServiceType;
  service_reference_id?: string; // UUID reference to source record

  // Audit-safe values (all required - no exceptions)
  service_name: string; // Name of service/item at billing time
  unit_cost: number; // Cost per unit at billing time
  quantity: number; // Must be >= 1
  gross_amount: number; // quantity * unit_cost (pre-calculated, stored as-is)

  // NHIS fields (all required - no exceptions)
  nhis_covered: boolean;
  nhis_percentage: number; // 0-100
  nhis_payable: number;
  patient_payable: number;
}

export interface BillingOrderDTO {
  id: string;
  billing_id?: string; // legacy alias
  order_number: string;
  patient_id: string;
  visit_id?: string | null;
  encounter_id?: string | null;

  // Source tracking
  source_module?: SourceModule;

  // Aggregated amounts
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  paid_amount: number;
  balance_amount: number;

  // Payment status
  status: BillingOrderStatus;
  payment_method?: PaymentMethodType;

  // Audit tracking
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Relations (populated via joins)
  patient?: {
    patient_id: string;
    first_name: string;
    surname: string;
    contact_phone?: string;
    gender?: string;
    date_of_birth?: string;
    insurance_type?: string;
  } | null;
  visit?: {
    visit_id: string;
    visit_type: string;
    payment_category: string;
    insurance_type?: string;
    encounter_category?: string;
    priority: string;
    status: string;
    clinic_id?: string;
    start_time?: string;
    // Referral encounter fields
    is_referral_encounter?: boolean;
    source_referral_id?: string;
  } | null;
  created_by_staff?: {
    first_name: string;
    last_name: string;
  } | null;
  items: BillingOrderItemDTO[];

  // Legacy/derived fields for backwards compatibility until UI is refactored
  amount_due: number;
  amount_paid: number;
  balance: number;
  payment_status: BillingOrderStatus;
  service_type?: ServiceType;
  service_code?: string;
  service_description?: string;
  source_record_id?: string;
  quantity?: number;
  unit_price?: number;
  gross_amount?: number;
  discount_percent?: number;
  nhis_covered?: boolean;
  nhis_percentage?: number;
  nhis_payable?: number;
  patient_payable?: number;
  requested_by?: string;
  requested_by_role?: string;
  verified_by?: string;
  verified_at?: string;
  receipt_number?: string;
  cashier_id?: string;
  invoice_id?: string;
  invoice_item_id?: string;
  requested_by_staff?: {
    first_name: string;
    last_name: string;
  } | null;
  verified_by_staff?: {
    first_name: string;
    last_name: string;
  } | null;
  cashier?: {
    first_name: string;
    last_name: string;
  } | null;
}

/**
 * Create Billing Order DTO - All audit-safe fields are MANDATORY
 * Used for creating new billing orders with full NHIS tracking
 */
export interface CreateBillingOrderDTO {
  // Required identifiers
  patient_id: string;
  visit_id?: string; // DEPRECATED: use encounter_id
  encounter_id?: string; // PRIMARY: UUID from visits.id
  source_module: SourceModule;

  // Service identification (required)
  service_type: ServiceType;
  service_reference_id?: string; // UUID of source record (lab_requests.id, imaging_requests.id, etc.)

  // Audit-safe billing fields (ALL REQUIRED - no exceptions)
  service_name: string; // Name of service at billing time
  unit_cost: number; // Cost per unit at billing time
  quantity: number; // Must be >= 1
  gross_amount: number; // quantity * unit_cost (pre-calculated)

  // NHIS fields (ALL REQUIRED - no exceptions)
  nhis_covered: boolean; // Whether NHIS covers this
  nhis_percentage: number; // 0-100
  nhis_payable: number; // Amount NHIS pays
  patient_payable: number; // Amount patient pays

  // Optional fields
  discount_percent?: number;
  idempotency_key?: string;

  // Legacy fields (kept for backward compatibility)
  service_code?: string;
  service_description?: string; // Alias for service_name
  unit_price?: number; // Alias for unit_cost
}

// =============================================================================
// Receipt DTOs
// =============================================================================

export interface ReceiptDTO {
  receipt_id: string;
  receipt_number: string;
  billing_id: string;
  patient_id: string;
  visit_id?: string;

  // Amounts
  gross_amount: number;
  nhis_payable: number;
  patient_payable: number;
  amount_paid: number;
  change_amount: number;

  // Payment details
  payment_method: PaymentMethodType;
  payment_reference?: string;

  // Staff
  cashier_id: string;

  // Timestamps
  receipt_date: string;
  created_at: string;

  // Relations
  patient?: {
    first_name: string;
    surname: string;
    file_number: string;
  };
  cashier?: {
    first_name: string;
    last_name: string;
  };
  billing_order?: BillingOrderDTO;
}

export interface CreateReceiptDTO {
  billing_id: string;
  amount_paid: number;
  payment_method: PaymentMethodType;
  payment_reference?: string;
}

export interface VerifyPaymentDTO {
  billing_id: string;
  payment_method: 'Cash' | 'POS' | 'NHIS' | 'Retainership';
  notes?: string;
  /** Optional: Pass current version for optimistic locking */
  version?: number;
}

export interface BatchVerifyPaymentDTO {
  billing_ids: string[];
  payment_method: 'Cash' | 'POS' | 'NHIS' | 'Retainership';
  notes?: string;
}

export interface BillingOrderFilters {
  patient_id?: string;
  visit_id?: string;
  source_module?: SourceModule;
  payment_status?: BillingOrderStatus;
  status?: BillingOrderStatus;
  from_date?: string;
  to_date?: string;
  /** Page number (1-based). Default 1 */
  page?: number;
  /** Items per page. Default 50, max 200 */
  pageSize?: number;
}

// =============================================================================
// Billing Queue Summary (grouped by patient/visit)
// =============================================================================

export interface BillingQueueItem {
  patient_id: string;
  visit_id: string;
  patient: {
    first_name: string;
    surname: string;
    contact_phone?: string;
    gender?: string;
    date_of_birth?: string;
    file_number?: string;
    insurance_type?: string;
  };
  visit: {
    visit_type: string;
    payment_category: string;
    insurance_type?: string;
    priority: string;
    start_time: string;
    clinic_id?: string;
  };
  orders: BillingOrderDTO[];

  // Summary amounts
  total_gross_amount: number;
  total_nhis_payable: number;
  total_patient_payable: number;
  total_amount_paid: number;
  total_balance: number;

  // Legacy fields
  total_amount_due: number;
  total_paid: number;
  pending_count: number;
  has_pending: boolean;

  // NHIS info
  is_nhis: boolean;
  nhis_percentage: number;
}

// =============================================================================
// Billing Statistics
// =============================================================================

export interface BillingOrderStats {
  pending_count: number;
  pending_amount: number;
  paid_today_count: number;
  paid_today_amount: number;
  by_payment_method: {
    method: string;
    count: number;
    amount: number;
  }[];
  by_source_module: {
    module: SourceModule;
    count: number;
    amount: number;
  }[];
}

// =============================================================================
// Helper Functions
// =============================================================================

export function calculateBillingOrderAmount(
  quantity: number,
  unitPrice: number,
  discountPercent: number = 0,
): { discountAmount: number; amountDue: number } {
  const subtotal = quantity * unitPrice;
  const discountAmount = subtotal * (discountPercent / 100);
  const amountDue = subtotal - discountAmount;
  return { discountAmount, amountDue };
}

// =============================================================================
// NHIS Helpers
// =============================================================================

/**
 * Check if a payment category is NHIS (Military NHIS, Civilian NHIS, or DHML)
 * DHML = Defence Health Maintenance Limited = Military NHIS
 */
export function isNhisPaymentCategory(
  paymentCategory: string | null | undefined,
): boolean {
  if (!isNhisFeatureEnabled()) return false;
  if (!paymentCategory) return false;
  const category = paymentCategory.toLowerCase().replace(/_/g, ' ');
  // DHML = Defence Health Maintenance Limited — default HMO for Military NHIS
  return (
    category.includes('nhis') || category === 'dhml' || category === 'gifship'
  );
}

// NHIS Calculation based on payment category
export interface NHISCalculation {
  grossAmount: number;
  nhisCovered: boolean;
  nhisPercentage: number;
  nhisPayable: number;
  patientPayable: number;
}

export function calculateNHISAmounts(
  grossAmount: number,
  paymentCategory: string,
  serviceType: ServiceType = 'Other',
): NHISCalculation {
  // Default: patient pays 100%
  let nhisPercentage = 0;
  let nhisCovered = false;

  if (!isNhisFeatureEnabled()) {
    return {
      grossAmount,
      nhisCovered: false,
      nhisPercentage: 0,
      nhisPayable: 0,
      patientPayable: grossAmount,
    };
  }

  // Normalize payment category for comparison
  const category = paymentCategory?.toLowerCase().replace(/_/g, ' ') || '';

  // Apply rules based on payment category
  // DHML = Defence Health Maintenance Limited = Military NHIS
  if (category === 'military nhis' || category === 'dhml') {
    // Military NHIS covers 100%, patient pays 0%
    nhisPercentage = 100;
    nhisCovered = true;
  } else if (category === 'civilian nhis') {
    // Civilian NHIS covers 90%, patient pays 10%
    nhisPercentage = 90;
    nhisCovered = true;
  } else {
    // Private or others: patient pays 100%
    nhisPercentage = 0;
    nhisCovered = false;
  }

  // Special case: Consultation is free for ALL NHIS patients (both Military and Civilian)
  if (nhisCovered && serviceType === 'Consultation') {
    nhisPercentage = 100;
  }

  const nhisPayable = grossAmount * (nhisPercentage / 100);
  const patientPayable = grossAmount - nhisPayable;

  return {
    grossAmount,
    nhisCovered,
    nhisPercentage,
    nhisPayable,
    patientPayable,
  };
}

// Get NHIS percentage for a payment category
export function getNHISPercentage(paymentCategory: string): number {
  if (!isNhisFeatureEnabled()) return 0;

  // Normalize payment category for comparison
  const category = paymentCategory?.toLowerCase().replace(/_/g, ' ') || '';

  // DHML = Defence Health Maintenance Limited = Military NHIS (100% coverage)
  if (category === 'military nhis' || category === 'dhml') {
    return 100;
  }
  if (category === 'security services nhis') {
    return 100;
  }
  if (category === 'civilian nhis') {
    return 90;
  }
  if (category === 'gifship') {
    return 90;
  }
  return 0;
}

/**
 * Check if an order is an NHIS consultation that is fully covered (patient_payable = 0)
 * These orders should NOT appear in outstanding balances or as unpaid
 * They are automatically verified at creation and receipted for audit purposes
 */
export function isNhisConsultationFullyCovered(order: {
  nhis_covered?: boolean;
  source_module?: string;
  patient_payable?: number;
  service_type?: string;
}): boolean {
  if (!isNhisFeatureEnabled()) return false;

  // Must be NHIS covered
  if (!order.nhis_covered) return false;

  // Must be a consultation
  const isConsultation =
    order.source_module === 'consultation' ||
    order.service_type === 'Consultation';
  if (!isConsultation) return false;

  // Patient payable must be 0
  const patientPayable = Number(order.patient_payable) || 0;
  return patientPayable === 0;
}

/**
 * Check if an order should be counted in outstanding balance
 * Returns false for fully covered NHIS consultations
 */
export function shouldCountAsOutstanding(order: {
  nhis_covered?: boolean;
  source_module?: string;
  patient_payable?: number;
  service_type?: string;
  status?: string;
  balance_amount?: number;
}): boolean {
  if (!isNhisFeatureEnabled()) {
    return (Number(order.balance_amount) || 0) > 0;
  }

  // Never count fully covered NHIS consultations
  if (isNhisConsultationFullyCovered(order)) {
    return false;
  }

  // For NHIS orders, only count if patient_payable > 0
  if (order.nhis_covered) {
    return (Number(order.patient_payable) || 0) > 0;
  }

  // For non-NHIS orders, count if there's a balance
  return (Number(order.balance_amount) || 0) > 0;
}

/**
 * Get the effective outstanding amount for an order
 * For NHIS orders, returns patient_payable; for others, returns balance_amount
 */
export function getEffectiveOutstanding(order: {
  nhis_covered?: boolean;
  source_module?: string;
  patient_payable?: number;
  service_type?: string;
  balance_amount?: number;
  net_amount?: number;
}): number {
  if (!isNhisFeatureEnabled()) {
    return Number(order.balance_amount) || Number(order.net_amount) || 0;
  }

  // Fully covered NHIS consultations have 0 outstanding
  if (isNhisConsultationFullyCovered(order)) {
    return 0;
  }

  // For NHIS orders, use patient_payable
  if (order.nhis_covered) {
    return Number(order.patient_payable) || 0;
  }

  // For non-NHIS orders, use balance_amount
  return Number(order.balance_amount) || Number(order.net_amount) || 0;
}

// =============================================================================
// Audit-Safe Billing Order Builder
// =============================================================================

/**
 * Prepare a complete CreateBillingOrderDTO with all mandatory audit-safe fields
 * This ensures consistent billing data across all service modules
 *
 * @param params - Service billing parameters
 * @returns Complete CreateBillingOrderDTO with all NHIS fields calculated
 */
export function prepareBillingOrderDTO(params: {
  patient_id: string;
  encounter_id: string;
  source_module: SourceModule;
  service_type: ServiceType;
  service_reference_id?: string;
  service_name: string;
  unit_cost: number;
  quantity?: number;
  insurance_type: string; // Patient's insurance type (DHML, Civilian_NHIS, Private)
  discount_percent?: number;
}): CreateBillingOrderDTO {
  const quantity = params.quantity ?? 1;
  const grossAmount = quantity * params.unit_cost;

  // Calculate discount
  const discountPercent = params.discount_percent ?? 0;
  const discountAmount = grossAmount * (discountPercent / 100);
  const netAmount = grossAmount - discountAmount;

  // Calculate NHIS amounts based on insurance type and service type
  const nhisCalc = calculateNHISAmounts(
    netAmount,
    params.insurance_type,
    params.service_type,
  );

  return {
    patient_id: params.patient_id,
    encounter_id: params.encounter_id,
    source_module: params.source_module,
    service_type: params.service_type,
    service_reference_id: params.service_reference_id,
    // Audit-safe billing fields (ALL MANDATORY)
    service_name: params.service_name,
    unit_cost: params.unit_cost,
    quantity,
    gross_amount: grossAmount,
    // NHIS fields (ALL MANDATORY - pre-calculated)
    nhis_covered: nhisCalc.nhisCovered,
    nhis_percentage: nhisCalc.nhisPercentage,
    nhis_payable: nhisCalc.nhisPayable,
    patient_payable: nhisCalc.patientPayable,
    // Optional
    discount_percent: discountPercent,
    // Legacy fields
    service_description: params.service_name,
    unit_price: params.unit_cost,
  };
}

export function getBillingOrderStatusColor(status: BillingOrderStatus): string {
  switch (status) {
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'Awaiting_Payment':
      return 'bg-orange-100 text-orange-800';
    case 'Partially_Paid':
      return 'bg-blue-100 text-blue-800';
    case 'Paid':
      return 'bg-green-100 text-green-800';
    case 'Paid_NHIS':
      return 'bg-emerald-100 text-emerald-800';
    case 'Paid_Retainership':
      return 'bg-purple-100 text-purple-800';
    case 'Waived':
      return 'bg-gray-100 text-gray-800';
    case 'Cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getBillingOrderStatusLabel(status: BillingOrderStatus): string {
  switch (status) {
    case 'Awaiting_Payment':
      return 'Awaiting Payment';
    case 'Partially_Paid':
      return 'Partially Paid';
    case 'Paid_NHIS':
      return 'Paid (NHIS)';
    case 'Paid_Retainership':
      return 'Paid (Retainership)';
    default:
      return status;
  }
}

export function getServiceTypeColor(serviceType: ServiceType): string {
  const colors: Record<ServiceType, string> = {
    Consultation: 'bg-indigo-100 text-indigo-800',
    Laboratory: 'bg-amber-100 text-amber-800',
    Radiology: 'bg-cyan-100 text-cyan-800',
    Pharmacy: 'bg-emerald-100 text-emerald-800',
    Surgery: 'bg-red-100 text-red-800',
    Procedure: 'bg-purple-100 text-purple-800',
    Nursing: 'bg-pink-100 text-pink-800',
    Admission: 'bg-blue-100 text-blue-800',
    Supplies: 'bg-gray-100 text-gray-800',
    Other: 'bg-gray-100 text-gray-800',
    // Specialty service types
    Dental: 'bg-violet-100 text-violet-800',
    Ophthalmology: 'bg-sky-100 text-sky-800',
    Physiotherapy: 'bg-lime-100 text-lime-800',
  };
  return colors[serviceType] || 'bg-gray-100 text-gray-800';
}

export function getSourceModuleLabel(module: SourceModule): string {
  const labels: Record<SourceModule, string> = {
    registration: 'Registration',
    consultation: 'Consultation',
    nursing: 'Nursing',
    admission: 'Admission',
    lab: 'Laboratory',
    radiology: 'Radiology',
    pharmacy: 'Pharmacy',
    procedure: 'Procedure',
    // Specialty modules
    dental: 'Dental',
    ophthalmology: 'Ophthalmology',
    physiotherapy: 'Physiotherapy',
  };
  return labels[module] || module;
}

export function getSourceModuleColor(module: SourceModule): string {
  const colors: Record<SourceModule, string> = {
    registration: 'bg-blue-100 text-blue-800',
    consultation: 'bg-indigo-100 text-indigo-800',
    nursing: 'bg-pink-100 text-pink-800',
    admission: 'bg-purple-100 text-purple-800',
    lab: 'bg-amber-100 text-amber-800',
    radiology: 'bg-cyan-100 text-cyan-800',
    pharmacy: 'bg-emerald-100 text-emerald-800',
    procedure: 'bg-orange-100 text-orange-800',
    // Specialty modules
    dental: 'bg-violet-100 text-violet-800',
    ophthalmology: 'bg-sky-100 text-sky-800',
    physiotherapy: 'bg-lime-100 text-lime-800',
  };
  return colors[module] || 'bg-gray-100 text-gray-800';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
