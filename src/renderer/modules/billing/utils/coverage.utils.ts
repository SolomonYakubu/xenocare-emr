/**
 * Billing Coverage Utilities
 *
 * Implements NHIS/Insurance coverage calculation based on EMR Workflow Reference.
 * Service-based billing with coverage rules per patient type.
 */

import { supabase } from '../../../api/supabaseClient';
import {
  isNhisCategory,
  isNhisFeatureEnabled,
} from '../../../config/features';

// =============================================================================
// Coverage Types
// =============================================================================

export const COVERAGE_TYPES = [
  'Private',
  'Military_NHIS',
  'Civilian_NHIS',
  'GIFSHIP',
  'Security_Services_NHIS',
  'Retainership',
  'Waived',
] as const;

export type CoverageType = (typeof COVERAGE_TYPES)[number];

export const SERVICE_CATEGORIES = [
  'Consultation',
  'Lab',
  'Radiology',
  'Pharmacy',
  'Procedure',
  'Surgery',
  'Nursing',
  'Admission',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

// =============================================================================
// Coverage Rules (from EMR Workflow Reference)
// =============================================================================

/**
 * Payment rules by patient type
 *
 * | Patient Type      | Service Coverage | Patient Pays | Insurance Pays |
 * |-------------------|------------------|--------------|----------------|
 * | Private           | Any              | 100%         | 0%             |
 * | Military NHIS     | Covered          | 0%           | 100% (DHML)    |
 * | Military NHIS     | Not Covered      | 100%         | 0%             |
 * | Civilian NHIS     | Covered          | 10%          | 90% (NHIS)     |
 * | Civilian NHIS     | Not Covered      | 100%         | 0%             |
 */

export interface CoverageRule {
  coverageType: CoverageType;
  serviceCategory: ServiceCategory;
  isCovered: boolean;
  patientPercentage: number; // 0-100
  insurancePercentage: number; // 0-100
  maxCoverageAmount?: number;
  requiresAuthorization?: boolean;
}

// Static coverage rules (can be overridden by database)
const DEFAULT_COVERAGE_RULES: CoverageRule[] = [
  // Private - 100% patient pays for everything
  {
    coverageType: 'Private',
    serviceCategory: 'Consultation',
    isCovered: false,
    patientPercentage: 100,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Private',
    serviceCategory: 'Lab',
    isCovered: false,
    patientPercentage: 100,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Private',
    serviceCategory: 'Radiology',
    isCovered: false,
    patientPercentage: 100,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Private',
    serviceCategory: 'Pharmacy',
    isCovered: false,
    patientPercentage: 100,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Private',
    serviceCategory: 'Procedure',
    isCovered: false,
    patientPercentage: 100,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Private',
    serviceCategory: 'Surgery',
    isCovered: false,
    patientPercentage: 100,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Private',
    serviceCategory: 'Nursing',
    isCovered: false,
    patientPercentage: 100,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Private',
    serviceCategory: 'Admission',
    isCovered: false,
    patientPercentage: 100,
    insurancePercentage: 0,
  },

  // Military NHIS (HMO/Payer: DHML) - 0% patient pays for covered services
  // DHML = Defence Health Maintenance Limited — the default HMO for Military NHIS, NOT a separate category
  {
    coverageType: 'Military_NHIS',
    serviceCategory: 'Consultation',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Military_NHIS',
    serviceCategory: 'Lab',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Military_NHIS',
    serviceCategory: 'Radiology',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Military_NHIS',
    serviceCategory: 'Pharmacy',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Military_NHIS',
    serviceCategory: 'Procedure',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Military_NHIS',
    serviceCategory: 'Surgery',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Military_NHIS',
    serviceCategory: 'Nursing',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Military_NHIS',
    serviceCategory: 'Admission',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },

  // Civilian NHIS - 10% patient pays for covered services
  {
    coverageType: 'Civilian_NHIS',
    serviceCategory: 'Consultation',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'Civilian_NHIS',
    serviceCategory: 'Lab',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'Civilian_NHIS',
    serviceCategory: 'Radiology',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'Civilian_NHIS',
    serviceCategory: 'Pharmacy',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'Civilian_NHIS',
    serviceCategory: 'Procedure',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'Civilian_NHIS',
    serviceCategory: 'Surgery',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
    requiresAuthorization: true,
  },
  {
    coverageType: 'Civilian_NHIS',
    serviceCategory: 'Nursing',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'Civilian_NHIS',
    serviceCategory: 'Admission',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
    requiresAuthorization: true,
  },

  // GIFSHIP (falls under Civilian NHIS) - 10% patient pays
  {
    coverageType: 'GIFSHIP',
    serviceCategory: 'Consultation',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'GIFSHIP',
    serviceCategory: 'Lab',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'GIFSHIP',
    serviceCategory: 'Radiology',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'GIFSHIP',
    serviceCategory: 'Pharmacy',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'GIFSHIP',
    serviceCategory: 'Procedure',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'GIFSHIP',
    serviceCategory: 'Surgery',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
    requiresAuthorization: true,
  },
  {
    coverageType: 'GIFSHIP',
    serviceCategory: 'Nursing',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
  },
  {
    coverageType: 'GIFSHIP',
    serviceCategory: 'Admission',
    isCovered: true,
    patientPercentage: 10,
    insurancePercentage: 90,
    requiresAuthorization: true,
  },

  // Security Services NHIS - 0% patient pays (same coverage as Military NHIS)
  {
    coverageType: 'Security_Services_NHIS',
    serviceCategory: 'Consultation',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Security_Services_NHIS',
    serviceCategory: 'Lab',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Security_Services_NHIS',
    serviceCategory: 'Radiology',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Security_Services_NHIS',
    serviceCategory: 'Pharmacy',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Security_Services_NHIS',
    serviceCategory: 'Procedure',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Security_Services_NHIS',
    serviceCategory: 'Surgery',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Security_Services_NHIS',
    serviceCategory: 'Nursing',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Security_Services_NHIS',
    serviceCategory: 'Admission',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },

  // Retainership - 0% patient pays
  {
    coverageType: 'Retainership',
    serviceCategory: 'Consultation',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Retainership',
    serviceCategory: 'Lab',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Retainership',
    serviceCategory: 'Radiology',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Retainership',
    serviceCategory: 'Pharmacy',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Retainership',
    serviceCategory: 'Procedure',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Retainership',
    serviceCategory: 'Surgery',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Retainership',
    serviceCategory: 'Nursing',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },
  {
    coverageType: 'Retainership',
    serviceCategory: 'Admission',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 100,
  },

  // Waived - 0% patient pays
  {
    coverageType: 'Waived',
    serviceCategory: 'Consultation',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Waived',
    serviceCategory: 'Lab',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Waived',
    serviceCategory: 'Radiology',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Waived',
    serviceCategory: 'Pharmacy',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Waived',
    serviceCategory: 'Procedure',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Waived',
    serviceCategory: 'Surgery',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Waived',
    serviceCategory: 'Nursing',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 0,
  },
  {
    coverageType: 'Waived',
    serviceCategory: 'Admission',
    isCovered: true,
    patientPercentage: 0,
    insurancePercentage: 0,
  },
];

// =============================================================================
// Coverage Calculation
// =============================================================================

export interface CoverageCalculation {
  totalAmount: number;
  patientAmount: number;
  insuranceAmount: number;
  isCovered: boolean;
  coverageType: CoverageType;
  serviceCategory: ServiceCategory;
  requiresAuthorization: boolean;
  maxCoverageApplied: boolean;
}

/**
 * Calculate billing coverage for a service
 */
export function calculateCoverage(
  coverageType: CoverageType,
  serviceCategory: ServiceCategory,
  totalAmount: number,
  isServiceCovered: boolean = true,
): CoverageCalculation {
  // NHIS is disabled for non-accredited facilities: treat every NHIS-backed
  // category as a self-pay (Private) patient.
  const nhisDisabled =
    !isNhisFeatureEnabled() && isNhisCategory(coverageType);
  const effectiveCoverageType: CoverageType = nhisDisabled
    ? 'Private'
    : coverageType;
  const serviceCovered = nhisDisabled ? false : isServiceCovered;

  // Find the applicable rule
  let rule = DEFAULT_COVERAGE_RULES.find(
    (r) =>
      r.coverageType === effectiveCoverageType &&
      r.serviceCategory === serviceCategory,
  );

  // If no rule found, default to Private (100% patient pays)
  if (!rule) {
    rule = {
      coverageType: 'Private',
      serviceCategory,
      isCovered: false,
      patientPercentage: 100,
      insurancePercentage: 0,
    };
  }

  // If service is not covered under this plan, patient pays 100%
  if (!serviceCovered || !rule.isCovered) {
    return {
      totalAmount,
      patientAmount: totalAmount,
      insuranceAmount: 0,
      isCovered: false,
      coverageType: effectiveCoverageType,
      serviceCategory,
      requiresAuthorization: false,
      maxCoverageApplied: false,
    };
  }

  // Calculate amounts
  let patientAmount =
    Math.round(((totalAmount * rule.patientPercentage) / 100) * 100) / 100;
  let insuranceAmount =
    Math.round(((totalAmount * rule.insurancePercentage) / 100) * 100) / 100;
  let maxCoverageApplied = false;

  // Apply max coverage if specified
  if (rule.maxCoverageAmount && insuranceAmount > rule.maxCoverageAmount) {
    insuranceAmount = rule.maxCoverageAmount;
    patientAmount = totalAmount - insuranceAmount;
    maxCoverageApplied = true;
  }

  // Ensure amounts sum to total (handle rounding)
  const diff = totalAmount - (patientAmount + insuranceAmount);
  patientAmount = Math.round((patientAmount + diff) * 100) / 100;

  return {
    totalAmount,
    patientAmount,
    insuranceAmount,
    isCovered: true,
    coverageType: effectiveCoverageType,
    serviceCategory,
    requiresAuthorization: rule.requiresAuthorization || false,
    maxCoverageApplied,
  };
}

/**
 * Calculate coverage using database rules (async)
 */
export async function calculateCoverageFromDb(
  coverageType: CoverageType,
  serviceCategory: ServiceCategory,
  totalAmount: number,
): Promise<CoverageCalculation> {
  if (!isNhisFeatureEnabled() && isNhisCategory(coverageType)) {
    return calculateCoverage(coverageType, serviceCategory, totalAmount);
  }

  try {
    const { data, error } = await supabase.rpc('calculate_billing_coverage', {
      p_coverage_type: coverageType,
      p_service_category: serviceCategory,
      p_total_amount: totalAmount,
    });

    if (error || !data || data.length === 0) {
      // Fallback to static rules
      return calculateCoverage(coverageType, serviceCategory, totalAmount);
    }

    const result = data[0];
    return {
      totalAmount,
      patientAmount: result.patient_amount,
      insuranceAmount: result.insurance_amount,
      isCovered: result.is_covered,
      coverageType,
      serviceCategory,
      requiresAuthorization: false,
      maxCoverageApplied: false,
    };
  } catch {
    // Fallback to static rules
    return calculateCoverage(coverageType, serviceCategory, totalAmount);
  }
}

// =============================================================================
// Patient Type Detection
// =============================================================================

/**
 * Determine coverage type from patient's payment category
 */
export function getCoverageTypeFromPaymentCategory(
  paymentCategory: string,
): CoverageType {
  if (!isNhisFeatureEnabled() && isNhisCategory(paymentCategory)) {
    return 'Private';
  }

  const normalized = paymentCategory.toLowerCase().replace(/[^a-z]/g, '');

  // DHML = Defence Health Maintenance Limited — default HMO for Military NHIS, NOT a separate category
  if (normalized.includes('militarynhis') || normalized.includes('dhml')) {
    return 'Military_NHIS';
  }

  if (normalized.includes('securityservicesnhis')) {
    return 'Security_Services_NHIS';
  }

  if (normalized.includes('gifship')) {
    return 'GIFSHIP';
  }

  if (normalized.includes('civiliannhis') || normalized.includes('nhis')) {
    return 'Civilian_NHIS';
  }

  if (normalized.includes('retainer') || normalized.includes('corporate')) {
    return 'Retainership';
  }

  if (normalized.includes('waiv')) {
    return 'Waived';
  }

  return 'Private';
}

/**
 * Check if a service requires payment before proceeding
 */
export function requiresPaymentBeforeService(
  coverageType: CoverageType,
  serviceCategory: ServiceCategory,
): boolean {
  const calculation = calculateCoverage(coverageType, serviceCategory, 100);

  // If patient pays any amount, payment is required
  return calculation.patientAmount > 0;
}

/**
 * Check if NHIS patient can proceed without upfront payment
 */
export function canProceedWithoutPayment(coverageType: CoverageType): boolean {
  if (!isNhisFeatureEnabled()) {
    return coverageType === 'Retainership' || coverageType === 'Waived';
  }

  return (
    coverageType === 'Military_NHIS' ||
    coverageType === 'Retainership' ||
    coverageType === 'Waived'
  );
}

// =============================================================================
// NHIS Coverage Helper for Service Modules
// =============================================================================

/**
 * Service types for NHIS coverage calculation
 */
export type NhisServiceType =
  | 'Consultation'
  | 'Laboratory'
  | 'Radiology'
  | 'Pharmacy'
  | 'Procedure'
  | 'Surgery'
  | 'Dental'
  | 'Ophthalmology'
  | 'Physiotherapy'
  | 'Nursing'
  | 'Admission'
  | 'Other';

/**
 * NHIS coverage calculation result
 */
export interface NhisCoverageResult {
  isNhis: boolean;
  nhisPercentage: number; // 0-100
  nhisPayable: number; // Amount NHIS pays
  patientPayable: number; // Amount patient pays
  grossAmount: number; // Total amount
  useNhisPrice: boolean; // Whether to use NHIS price or regular price
}

/**
 * Get the default NHIS coverage percentage based on insurance type.
 *
 * Coverage Rules:
 * - Military NHIS (DHML): 100% coverage for all covered services
 * - Civilian NHIS: 90% coverage for services (patient pays 10%)
 * - Consultation: ALWAYS 100% free for ALL NHIS patients
 * - Private/Cash: 0% coverage (patient pays 100%)
 *
 * @param insuranceType - Patient's insurance type from visit/encounter
 * @param serviceType - The type of service being billed
 * @returns Default NHIS percentage (0-100)
 */
export function getDefaultNhisPercentage(
  insuranceType: string | null | undefined,
  serviceType: NhisServiceType = 'Other',
): number {
  if (!isNhisFeatureEnabled()) return 0;

  const normalized = (insuranceType || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();

  // Check if this is an NHIS patient
  const isMilitaryNhis = ['dhml', 'military nhis'].includes(normalized);
  const isSecurityNhis = normalized === 'security services nhis';
  const isCivilianNhis = ['civilian nhis', 'nhis', 'gifship'].includes(
    normalized,
  );
  const isRetainership =
    normalized.includes('retainer') || normalized.includes('corporate');

  // Consultation is ALWAYS 100% free for ALL NHIS patients
  if (serviceType === 'Consultation') {
    if (isMilitaryNhis || isSecurityNhis || isCivilianNhis || isRetainership) {
      return 100;
    }
    return 0; // Private patients pay full consultation
  }

  // For all other services:
  // - Military NHIS/DHML: 100% coverage
  // - Civilian NHIS: 90% coverage
  // - Retainership: 100% coverage
  // - Private: 0% coverage
  if (isMilitaryNhis || isSecurityNhis) {
    return 100;
  }

  if (isCivilianNhis) {
    return 90;
  }

  if (isRetainership) {
    return 100;
  }

  // Private/Cash patients - no coverage
  return 0;
}

/**
 * Check if a patient is an NHIS patient based on insurance type
 */
export function isNhisPatientType(
  insuranceType: string | null | undefined,
): boolean {
  if (!isNhisFeatureEnabled()) return false;

  const normalized = (insuranceType || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
  // DHML is Military NHIS HMO, not a separate category
  return (
    normalized.includes('nhis') ||
    normalized === 'dhml' ||
    normalized === 'gifship' ||
    normalized.includes('retainer') ||
    normalized.includes('corporate')
  );
}

/**
 * Calculate NHIS coverage for a service.
 *
 * This function properly handles NHIS billing by:
 * 1. ALWAYS using the service's NHIS price as the single source of truth for NHIS patients
 * 2. Applying the correct coverage percentage based on insurance type
 * 3. Allowing service-level percentage overrides
 *
 * IMPORTANT: NHIS Price (₦) is the SINGLE SOURCE OF TRUTH for all NHIS billing.
 * The NHIS Pays (%) determines how much of the NHIS price is covered by insurance.
 *
 * @param params - Calculation parameters
 * @returns Coverage calculation result
 */
export function calculateNhisServiceCoverage(params: {
  insuranceType: string | null | undefined;
  serviceType: NhisServiceType;
  regularPrice: number;
  nhisPrice?: number | null;
  isServiceNhisCovered?: boolean;
  serviceNhisPercentage?: number | null; // Service-level override (0 means use default)
  quantity?: number;
}): NhisCoverageResult {
  const {
    insuranceType,
    serviceType,
    regularPrice,
    nhisPrice,
    isServiceNhisCovered = true,
    serviceNhisPercentage,
    quantity = 1,
  } = params;

  const isNhis = isNhisPatientType(insuranceType);

  // If not NHIS patient or service not covered, patient pays full regular price
  if (!isNhis || !isServiceNhisCovered) {
    const grossAmount = regularPrice * quantity;
    return {
      isNhis: false,
      nhisPercentage: 0,
      nhisPayable: 0,
      patientPayable: grossAmount,
      grossAmount,
      useNhisPrice: false,
    };
  }

  // NHIS Price is the SINGLE SOURCE OF TRUTH for NHIS patients
  // Always use NHIS price when available; fallback to regular price only if NHIS price is missing
  const effectivePrice = nhisPrice && nhisPrice > 0 ? nhisPrice : regularPrice;
  const grossAmount = effectivePrice * quantity;
  const useNhisPrice = !!(nhisPrice && nhisPrice > 0);

  // Determine coverage percentage:
  // 1. If service has a specific percentage > 0, use it (admin override)
  // 2. Otherwise, use default based on insurance type and service type
  let nhisPercentage: number;
  if (serviceNhisPercentage && serviceNhisPercentage > 0) {
    nhisPercentage = serviceNhisPercentage;
  } else {
    nhisPercentage = getDefaultNhisPercentage(insuranceType, serviceType);
  }

  // Calculate amounts based on NHIS price (single source of truth)
  const nhisPayable =
    Math.round(((grossAmount * nhisPercentage) / 100) * 100) / 100;
  const patientPayable = Math.round((grossAmount - nhisPayable) * 100) / 100;

  return {
    isNhis: true,
    nhisPercentage,
    nhisPayable,
    patientPayable,
    grossAmount,
    useNhisPrice,
  };
}

// =============================================================================
// Receipt Generation
// =============================================================================

export interface ReceiptLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  nhisContribution: number;
  patientAmount: number;
}

export interface ReceiptSummary {
  lines: ReceiptLine[];
  subtotal: number;
  nhisTotal: number;
  patientTotal: number;
  grandTotal: number;
  coverageType: CoverageType;
  receiptNumber?: string;
  issuedAt?: string;
}

/**
 * Always issue receipt (even for NHIS/DHML - per workflow reference)
 */
export function generateReceiptSummary(
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    serviceCategory: ServiceCategory;
    isServiceCovered?: boolean;
  }>,
  coverageType: CoverageType,
): ReceiptSummary {
  const lines: ReceiptLine[] = [];
  let subtotal = 0;
  let nhisTotal = 0;
  let patientTotal = 0;

  for (const item of items) {
    const amount = item.quantity * item.unitPrice;
    const coverage = calculateCoverage(
      coverageType,
      item.serviceCategory,
      amount,
      item.isServiceCovered,
    );

    lines.push({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount,
      nhisContribution: coverage.insuranceAmount,
      patientAmount: coverage.patientAmount,
    });

    subtotal += amount;
    nhisTotal += coverage.insuranceAmount;
    patientTotal += coverage.patientAmount;
  }

  return {
    lines,
    subtotal,
    nhisTotal,
    patientTotal,
    grandTotal: subtotal,
    coverageType,
  };
}

// =============================================================================
// Helpers
// =============================================================================

export function getCoverageTypeLabel(type: CoverageType): string {
  switch (type) {
    case 'Private':
      return 'Private (Cash)';
    case 'Military_NHIS':
      return 'Military NHIS';
    case 'Civilian_NHIS':
      return 'Civilian NHIS';
    case 'GIFSHIP':
      return 'GIFSHIP';
    case 'Security_Services_NHIS':
      return 'Security Services NHIS';
    case 'Retainership':
      return 'Retainership';
    case 'Waived':
      return 'Waived';
    default:
      return type;
  }
}

export function getCoverageTypeColor(type: CoverageType): string {
  switch (type) {
    case 'Private':
      return 'bg-gray-100 text-gray-800';
    case 'Military_NHIS':
      return 'bg-green-100 text-green-800';
    case 'Civilian_NHIS':
      return 'bg-blue-100 text-blue-800';
    case 'GIFSHIP':
      return 'bg-purple-100 text-purple-800';
    case 'Security_Services_NHIS':
      return 'bg-yellow-100 text-yellow-800';
    case 'Retainership':
      return 'bg-purple-100 text-purple-800';
    case 'Waived':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
  }).format(amount);
}
