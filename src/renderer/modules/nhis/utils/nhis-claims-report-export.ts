/**
 * NHIS Claims Comprehensive Report Export Utility
 * XENOCARE EMR - NHIS Module
 *
 * Generates detailed, structured reports in PDF, Excel, and CSV formats
 * with full financial breakdowns by billing category:
 *   - Total Claim Value
 *   - Net NHIS Payable (FFS minus co-pay)
 *   - Total Patient Pays (Co-pay + Private)
 *   - Pending Auth (Requires Action)
 *   - CAP (Capitation) - Prepaid
 *   - FFS (Fee For Service) - Billable
 *   - Co-payment - Mandatory patient share
 *   - Private / OOP - Non-covered items
 *
 * Each category can be independently selected for export.
 *
 * @version 1.0.0
 * @date March 2, 2026
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type {
  NhisComprehensiveClaimsSummary,
  NhisComprehensiveClaimItem,
} from '../api/nhis.api';

// ==================== TYPES ====================

/** Categories that can be independently selected for export */
export type ReportCategory =
  | 'total_claim_value'
  | 'net_nhis_payable'
  | 'total_patient_pays'
  | 'pending_auth'
  | 'cap_capitation'
  | 'ffs_fee_for_service'
  | 'copayment'
  | 'private_oop';

/** Service categories (department-level) */
export type ServiceCategory =
  | 'lab'
  | 'radiology'
  | 'pharmacy'
  | 'procedure'
  | 'specialty'
  | 'consultation'
  | 'nursing'
  | 'admission';

// ==================== COLUMN SELECTION SYSTEM ====================

/** Column groups for organized selection UI */
export type ExportColumnGroup =
  | 'identity' // Patient & Encounter identifiers
  | 'clinical' // Diagnosis, ICD, Clinician, Department
  | 'service' // Category, Service name, Quantity
  | 'financial' // All monetary amounts & portion breakdown
  | 'authorization' // Auth code, auth status, provisional
  | 'billing' // Invoice, receipt, payment status, claim status
  | 'audit'; // Timestamps & actors

export const COLUMN_GROUP_LABELS: Record<ExportColumnGroup, string> = {
  identity: 'Patient & Encounter',
  clinical: 'Clinical / NHIS Claims',
  service: 'Service Details',
  financial: 'Financial Breakdown',
  authorization: 'Authorization',
  billing: 'Billing & Payment',
  audit: 'Audit Trail',
};

export const COLUMN_GROUP_DESCRIPTIONS: Record<ExportColumnGroup, string> = {
  identity: 'Patient name, EMR#, NHIS#, encounter, insurance',
  clinical: 'DOB, gender, diagnosis, ICD-10, clinician',
  service: 'Department, service name, quantity',
  financial: 'Total, CAP, FFS, co-pay, private, net NHIS',
  authorization: 'Auth codes, status, provisional flag',
  billing: 'Invoice, receipt, payment & claim status',
  audit: 'Created/submitted/approved timestamps & actors',
};

/** Single exportable column definition */
export interface ExportColumnDef {
  key: string;
  label: string;
  shortLabel: string; // Abbreviated for PDF headers
  group: ExportColumnGroup;
  mandatory: boolean; // Cannot be deselected — always exported
  mandatoryReason?: string; // Why it's mandatory (shown in tooltip)
  excelWidth: number; // Excel column width (wch)
  /** Extract value from a claim item (idx = serial number starting from 1) */
  accessor: (item: NhisComprehensiveClaimItem, idx: number) => string | number;
}

/**
 * Master list of ALL exportable columns.
 * Mandatory fields cannot be deselected by admin.
 * Encounter Number is mandatory on every record per NHIS requirements.
 */
export const EXPORT_COLUMNS: ExportColumnDef[] = [
  // ── IDENTITY (Patient & Encounter) ──
  {
    key: 'serial_number',
    label: 'S/N',
    shortLabel: 'S/N',
    group: 'identity',
    mandatory: true,
    mandatoryReason: 'Record sequencing',
    excelWidth: 6,
    accessor: (_item, idx) => idx,
  },
  {
    key: 'encounter_number',
    label: 'Encounter Number',
    shortLabel: 'Encounter#',
    group: 'identity',
    mandatory: true,
    mandatoryReason: 'NHIS: Every record must have encounter reference',
    excelWidth: 18,
    accessor: (item) => item.encounterNumber || '—',
  },
  {
    key: 'patient_name',
    label: 'Patient Name',
    shortLabel: 'Patient',
    group: 'identity',
    mandatory: true,
    mandatoryReason: 'Patient identification',
    excelWidth: 22,
    accessor: (item) => item.patientName || '—',
  },
  {
    key: 'emr_number',
    label: 'EMR Number',
    shortLabel: 'EMR#',
    group: 'identity',
    mandatory: true,
    mandatoryReason: 'Facility patient ID',
    excelWidth: 14,
    accessor: (item) => item.emrNumber || '—',
  },
  {
    key: 'nhis_number',
    label: 'NHIS Number',
    shortLabel: 'NHIS#',
    group: 'identity',
    mandatory: true,
    mandatoryReason: 'NHIS: Enrollee identification',
    excelWidth: 16,
    accessor: (item) => item.nhisNumber || '—',
  },

  {
    key: 'scheme_type',
    label: 'Scheme Type',
    shortLabel: 'Scheme',
    group: 'identity',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => item.schemeType || '—',
  },
  {
    key: 'tariff_group',
    label: 'Tariff Group',
    shortLabel: 'Tariff',
    group: 'identity',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => item.tariffGroup || '—',
  },

  {
    key: 'encounter_date',
    label: 'Encounter Date',
    shortLabel: 'Enc. Date',
    group: 'identity',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => formatDate(item.encounterDate),
  },
  {
    key: 'is_referral',
    label: 'Is Referral',
    shortLabel: 'Referral',
    group: 'identity',
    mandatory: false,
    excelWidth: 10,
    accessor: (item) => (item.isReferral ? 'Yes' : 'No'),
  },
  {
    key: 'referral_type',
    label: 'Referral Type',
    shortLabel: 'Ref. Type',
    group: 'identity',
    mandatory: false,
    excelWidth: 12,
    accessor: (item) => item.referralType || '—',
  },
  {
    key: 'referral_facility',
    label: 'Referring Facility',
    shortLabel: 'Ref. Facility',
    group: 'identity',
    mandatory: false,
    excelWidth: 18,
    accessor: (item) => item.referralFacility || '—',
  },

  // ── CLINICAL (NHIS Claims Required) ──
  {
    key: 'age',
    label: 'Age',
    shortLabel: 'Age',
    group: 'clinical',
    mandatory: true,
    mandatoryReason: 'NHIS: Enrollee age for claims',
    excelWidth: 6,
    accessor: (item) => {
      if (!item.dateOfBirth) return '—';
      const dob = new Date(item.dateOfBirth);
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      return age;
    },
  },
  {
    key: 'gender',
    label: 'Gender',
    shortLabel: 'Gender',
    group: 'clinical',
    mandatory: true,
    mandatoryReason: 'NHIS: Enrollee demographic for claims',
    excelWidth: 8,
    accessor: (item) => item.gender || '—',
  },
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    shortLabel: 'Diagnosis',
    group: 'clinical',
    mandatory: true,
    mandatoryReason: 'NHIS: Primary diagnosis required for all claims',
    excelWidth: 28,
    accessor: (item) => item.diagnosis || '—',
  },

  {
    key: 'clinician_name',
    label: 'Clinician Name',
    shortLabel: 'Clinician',
    group: 'clinical',
    mandatory: false,
    excelWidth: 18,
    accessor: (item) => item.clinicianName || '—',
  },
  {
    key: 'department',
    label: 'Department',
    shortLabel: 'Dept',
    group: 'clinical',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => item.department || '—',
  },
  {
    key: 'phone',
    label: 'Phone Number',
    shortLabel: 'Phone',
    group: 'clinical',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => item.phone || '—',
  },
  {
    key: 'plan_type',
    label: 'Plan Type',
    shortLabel: 'Plan',
    group: 'clinical',
    mandatory: false,
    excelWidth: 12,
    accessor: (item) => item.planType || '—',
  },

  // ── SERVICE DETAILS ──
  {
    key: 'service_date',
    label: 'Service Date',
    shortLabel: 'Svc Date',
    group: 'service',
    mandatory: true,
    mandatoryReason: 'NHIS: Date of service delivery',
    excelWidth: 14,
    accessor: (item) => formatDate(item.serviceDate),
  },
  {
    key: 'category',
    label: 'Service Category',
    shortLabel: 'Category',
    group: 'service',
    mandatory: true,
    mandatoryReason: 'NHIS: Service classification',
    excelWidth: 16,
    accessor: (item) =>
      item.categoryLabel ||
      SERVICE_CATEGORY_LABELS[item.category] ||
      item.category,
  },
  {
    key: 'service_name',
    label: 'Service / Item Name',
    shortLabel: 'Service',
    group: 'service',
    mandatory: true,
    mandatoryReason: 'NHIS: Service description',
    excelWidth: 28,
    accessor: (item) => item.serviceName || '—',
  },
  {
    key: 'quantity',
    label: 'Quantity',
    shortLabel: 'Qty',
    group: 'service',
    mandatory: false,
    excelWidth: 8,
    accessor: (item) => item.quantity,
  },
  {
    key: 'service_description',
    label: 'Service Description',
    shortLabel: 'Svc Desc',
    group: 'service',
    mandatory: false,
    excelWidth: 24,
    accessor: (item) => item.serviceDescription || '—',
  },

  // ── FINANCIAL ──
  {
    key: 'total_amount',
    label: 'Total Amount (₦)',
    shortLabel: 'Total',
    group: 'financial',
    mandatory: true,
    mandatoryReason: 'NHIS: Total claim value',
    excelWidth: 16,
    accessor: (item) => item.totalAmount,
  },
  {
    key: 'portion_type',
    label: 'Portion Type (NHIA)',
    shortLabel: 'Portion',
    group: 'financial',
    mandatory: true,
    mandatoryReason:
      'NHIA: Payment classification (FFS_COVERED/FFS_PARTIAL_PRIVATE/PRIVATE_ONLY/CAP_ONLY)',
    excelWidth: 18,
    accessor: (item) => item.portionType,
  },
  {
    key: 'cap_amount',
    label: 'CAP Amount (₦)',
    shortLabel: 'CAP',
    group: 'financial',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => item.capAmount,
  },
  {
    key: 'ffs_amount',
    label: 'FFS Amount (₦)',
    shortLabel: 'FFS',
    group: 'financial',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => item.ffsAmount,
  },
  {
    key: 'copay_amount',
    label: 'Co-pay Amount (₦)',
    shortLabel: 'Co-pay',
    group: 'financial',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => item.copayAmount,
  },
  {
    key: 'copay_percentage',
    label: 'Co-pay %',
    shortLabel: 'Co-pay%',
    group: 'financial',
    mandatory: false,
    excelWidth: 10,
    accessor: (item) => `${item.copayPercentage}%`,
  },
  {
    key: 'private_amount',
    label: 'Private / OOP (₦)',
    shortLabel: 'Private',
    group: 'financial',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => item.privateAmount,
  },
  {
    key: 'net_nhis_payable',
    label: 'Net NHIS Payable (₦)',
    shortLabel: 'Net NHIS',
    group: 'financial',
    mandatory: true,
    mandatoryReason: 'NHIS: Net amount payable by NHIS',
    excelWidth: 16,
    accessor: (item) => item.netNhisPayable,
  },
  {
    key: 'nhis_amount',
    label: 'NHIS Covered (₦)',
    shortLabel: 'NHIS Amt',
    group: 'financial',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => item.nhisAmount,
  },
  {
    key: 'patient_amount',
    label: 'Patient Amount (₦)',
    shortLabel: 'Pat. Amt',
    group: 'financial',
    mandatory: false,
    excelWidth: 14,
    accessor: (item) => item.patientAmount,
  },
  {
    key: 'coverage_type',
    label: 'Coverage Type',
    shortLabel: 'Coverage',
    group: 'financial',
    mandatory: false,
    excelWidth: 12,
    accessor: (item) => item.coverageType,
  },
  {
    key: 'coverage_percentage',
    label: 'Coverage %',
    shortLabel: 'Cov%',
    group: 'financial',
    mandatory: false,
    excelWidth: 10,
    accessor: (item) => `${item.coveragePercentage}%`,
  },

  // ── AUTHORIZATION ──
  {
    key: 'auth_code',
    label: 'Authorization Code',
    shortLabel: 'Auth Code',
    group: 'authorization',
    mandatory: true,
    mandatoryReason: 'NHIS: Authorization tracking for FFS claims',
    excelWidth: 18,
    accessor: (item) => item.authorizationCode || '—',
  },

  {
    key: 'is_provisional',
    label: 'Is Provisional',
    shortLabel: 'Prov.',
    group: 'authorization',
    mandatory: false,
    excelWidth: 10,
    accessor: (item) => (item.isProvisional ? 'Yes' : 'No'),
  },

  // ── BILLING ──
  {
    key: 'invoice_number',
    label: 'Invoice Number',
    shortLabel: 'Invoice#',
    group: 'billing',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => item.invoiceNumber || '—',
  },
  {
    key: 'receipt_number',
    label: 'Receipt Number',
    shortLabel: 'Receipt#',
    group: 'billing',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => item.receiptNumber || '—',
  },
  {
    key: 'payment_status',
    label: 'Payment Status',
    shortLabel: 'Pay Stat',
    group: 'billing',
    mandatory: false,
    excelWidth: 12,
    accessor: (item) => item.paymentStatus || '—',
  },
  {
    key: 'claim_status',
    label: 'Claim Status',
    shortLabel: 'Claim Stat',
    group: 'billing',
    mandatory: true,
    mandatoryReason: 'NHIS: Claims workflow tracking',
    excelWidth: 14,
    accessor: (item) => item.claimStatus,
  },

  // ── AUDIT TRAIL ──
  {
    key: 'created_at',
    label: 'Created Date',
    shortLabel: 'Created',
    group: 'audit',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => formatDateTime(item.createdAt),
  },
  {
    key: 'submitted_at',
    label: 'Submitted Date',
    shortLabel: 'Submitted',
    group: 'audit',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => formatDateTime(item.submittedAt),
  },
  {
    key: 'approved_at',
    label: 'Approved Date',
    shortLabel: 'Approved',
    group: 'audit',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => formatDateTime(item.approvedAt),
  },
  {
    key: 'processed_at',
    label: 'Processed Date',
    shortLabel: 'Processed',
    group: 'audit',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => formatDateTime(item.processedAt),
  },
  {
    key: 'paid_at',
    label: 'Paid Date',
    shortLabel: 'Paid',
    group: 'audit',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => formatDateTime(item.paidAt),
  },
  {
    key: 'created_by',
    label: 'Created By',
    shortLabel: 'Cr. By',
    group: 'audit',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => item.createdBy || '—',
  },
  {
    key: 'submitted_by',
    label: 'Submitted By',
    shortLabel: 'Sub. By',
    group: 'audit',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => item.submittedBy || '—',
  },
  {
    key: 'approved_by',
    label: 'Approved By',
    shortLabel: 'Apr. By',
    group: 'audit',
    mandatory: false,
    excelWidth: 16,
    accessor: (item) => item.approvedBy || '—',
  },
  {
    key: 'notes',
    label: 'Notes',
    shortLabel: 'Notes',
    group: 'audit',
    mandatory: false,
    excelWidth: 24,
    accessor: (item) => item.notes || '—',
  },
  {
    key: 'exceptions',
    label: 'Exceptions',
    shortLabel: 'Exceptions',
    group: 'audit',
    mandatory: false,
    excelWidth: 24,
    accessor: (item) => item.exceptions || '—',
  },
  {
    key: 'rejection_reason',
    label: 'Rejection Reason',
    shortLabel: 'Rej. Reason',
    group: 'audit',
    mandatory: false,
    excelWidth: 24,
    accessor: (item) => item.rejectionReason || '—',
  },
];

/** All mandatory column keys — always exported regardless of selection */
export const MANDATORY_COLUMN_KEYS: string[] = EXPORT_COLUMNS.filter(
  (c) => c.mandatory,
).map((c) => c.key);

/** Default selected columns — mandatory + common optional ones */
export const DEFAULT_SELECTED_COLUMNS: string[] = [
  ...MANDATORY_COLUMN_KEYS,
  'quantity',
  'cap_amount',
  'ffs_amount',
  'copay_amount',
  'private_amount',
  'invoice_number',
  'receipt_number',
  'payment_status',
];

/** Get column definitions for a set of selected column keys (always includes mandatory) */
export function getSelectedColumns(selectedKeys: string[]): ExportColumnDef[] {
  const keySet = new Set([...MANDATORY_COLUMN_KEYS, ...selectedKeys]);
  return EXPORT_COLUMNS.filter((c) => keySet.has(c.key));
}

/** Get all column groups with their columns */
export function getColumnsByGroup(): {
  group: ExportColumnGroup;
  label: string;
  description: string;
  columns: ExportColumnDef[];
}[] {
  const groups: ExportColumnGroup[] = [
    'identity',
    'clinical',
    'service',
    'financial',
    'authorization',
    'billing',
    'audit',
  ];
  return groups.map((g) => ({
    group: g,
    label: COLUMN_GROUP_LABELS[g],
    description: COLUMN_GROUP_DESCRIPTIONS[g],
    columns: EXPORT_COLUMNS.filter((c) => c.group === g),
  }));
}

export interface ReportExportOptions {
  /** Which financial categories to include */
  selectedCategories: ReportCategory[];
  /** Which columns to include in detailed item tables */
  selectedColumns?: string[];
  /** Report format */
  format: 'pdf_summary' | 'pdf_patient_breakdown' | 'excel' | 'csv';
  /** Facility branding */
  facilityName?: string;
  facilityAddress?: string;
  facilityNhisId?: string;
  /** Report period */
  reportPeriod?: { start: string; end: string };
  /** Who generated */
  generatedBy?: string;
  /** Active filters description */
  filterDescription?: string;
}

export interface CategoryReportData {
  key: ReportCategory;
  label: string;
  description: string;
  badgeText: string;
  totalAmount: number;
  recordCount: number;
  color: string;
  /** Items belonging to this category breakdown */
  items: NhisComprehensiveClaimItem[];
  /** Per-service breakdown within this category */
  serviceBreakdown: ServiceBreakdownRow[];
}

export interface ServiceBreakdownRow {
  serviceCategory: string;
  serviceCategoryLabel: string;
  itemCount: number;
  totalAmount: number;
  nhisAmount: number;
  patientAmount: number;
  capAmount: number;
  ffsAmount: number;
  copayAmount: number;
  privateAmount: number;
  netNhisPayable: number;
  avgCoveragePercent: number;
}

/** Metadata for the category definitions shown in UI/export */
export const REPORT_CATEGORY_DEFS: Record<
  ReportCategory,
  {
    label: string;
    description: string;
    badge: string;
    colorClass: string;
    pdfColor: [number, number, number];
  }
> = {
  total_claim_value: {
    label: 'Total Claim Value',
    description: 'All billed services across all payment types',
    badge: 'All Records',
    colorClass: 'bg-blue-50 border-blue-200 text-blue-700',
    pdfColor: [37, 99, 235],
  },
  net_nhis_payable: {
    label: 'Net NHIS Payable',
    description: 'FFS amount minus co-payment — what NHIS owes the facility',
    badge: 'FFS - Co-pay',
    colorClass: 'bg-green-50 border-green-200 text-green-700',
    pdfColor: [22, 163, 74],
  },
  total_patient_pays: {
    label: 'Total Patient Pays',
    description: 'Co-payment (mandatory share) + Private/OOP charges',
    badge: 'Co-pay + Private',
    colorClass: 'bg-orange-50 border-orange-200 text-orange-700',
    pdfColor: [234, 88, 12],
  },
  pending_auth: {
    label: 'Pending Authorization',
    description:
      'Claims still awaiting authorization codes — requires NHIS desk action',
    badge: 'Requires Action',
    colorClass: 'bg-amber-50 border-amber-200 text-amber-700',
    pdfColor: [217, 119, 6],
  },
  cap_capitation: {
    label: 'CAP (Capitation)',
    description: 'Prepaid monthly capitation — consultation + basic drugs',
    badge: 'Prepaid',
    colorClass: 'bg-blue-50 border-blue-200 text-blue-800',
    pdfColor: [30, 64, 175],
  },
  ffs_fee_for_service: {
    label: 'FFS (Fee For Service)',
    description:
      'Billable per-service items — lab, imaging, procedures, specialty',
    badge: 'Billable',
    colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    pdfColor: [5, 150, 105],
  },
  copayment: {
    label: 'Co-payment',
    description: 'Mandatory patient share on FFS items (policy-based %)',
    badge: '10%',
    colorClass: 'bg-purple-50 border-purple-200 text-purple-800',
    pdfColor: [126, 34, 206],
  },
  private_oop: {
    label: 'Private / Out-of-Pocket',
    description:
      'Non-covered items, non-formulary, items exceeding NHIS limits',
    badge: 'Patient',
    colorClass: 'bg-orange-50 border-orange-200 text-orange-800',
    pdfColor: [194, 65, 12],
  },
};

// ==================== HELPERS ====================

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  lab: 'Laboratory',
  radiology: 'Radiology',
  pharmacy: 'Pharmacy',
  procedure: 'Procedures',
  specialty: 'Specialty',
  consultation: 'Consultation',
  nursing: 'Nursing',
  admission: 'Admission/Inpatient',
};

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `NGN ${formatted}`;
}

function formatCurrencyNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return '—';
  if (text.length <= maxLen) return text;
  return `${text.substring(0, maxLen - 3)}...`;
}

// ==================== DATA COMPUTATION ====================

function buildServiceBreakdown(
  items: NhisComprehensiveClaimItem[],
): ServiceBreakdownRow[] {
  const map = new Map<string, ServiceBreakdownRow>();

  items.forEach((item) => {
    const cat = item.category || 'other';
    let row = map.get(cat);
    if (!row) {
      row = {
        serviceCategory: cat,
        serviceCategoryLabel: SERVICE_CATEGORY_LABELS[cat] || cat,
        itemCount: 0,
        totalAmount: 0,
        nhisAmount: 0,
        patientAmount: 0,
        capAmount: 0,
        ffsAmount: 0,
        copayAmount: 0,
        privateAmount: 0,
        netNhisPayable: 0,
        avgCoveragePercent: 0,
      };
      map.set(cat, row);
    }
    row.itemCount++;
    row.totalAmount += item.totalAmount;
    row.nhisAmount += item.nhisAmount;
    row.patientAmount += item.patientAmount;
    row.capAmount += item.capAmount;
    row.ffsAmount += item.ffsAmount;
    row.copayAmount += item.copayAmount;
    row.privateAmount += item.privateAmount;
    row.netNhisPayable += item.netNhisPayable;
  });

  // Calculate average coverage
  map.forEach((row) => {
    if (row.totalAmount > 0) {
      row.avgCoveragePercent = Math.round(
        (row.nhisAmount / row.totalAmount) * 100,
      );
    }
  });

  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}
export function buildCategoryReports(
  data: NhisComprehensiveClaimsSummary,
  selectedCategories: ReportCategory[],
): CategoryReportData[] {
  const allItems = data.allItems || [];
  const reports: CategoryReportData[] = [];

  for (const catKey of selectedCategories) {
    const def = REPORT_CATEGORY_DEFS?.[catKey];
    if (!def) continue; // Skip if category definition not found (protects against HMR stale refs)
    let relevantItems: NhisComprehensiveClaimItem[];
    let totalAmount: number;

    switch (catKey) {
      case 'total_claim_value':
        relevantItems = allItems;
        totalAmount = allItems.reduce((s, i) => s + i.totalAmount, 0);
        break;

      case 'net_nhis_payable':
        relevantItems = allItems.filter((i) => i.netNhisPayable > 0);
        totalAmount = allItems.reduce((s, i) => s + i.netNhisPayable, 0);
        break;

      case 'total_patient_pays':
        relevantItems = allItems.filter(
          (i) => i.copayAmount + i.privateAmount > 0,
        );
        totalAmount = allItems.reduce(
          (s, i) => s + i.copayAmount + i.privateAmount,
          0,
        );
        break;

      case 'pending_auth':
        relevantItems = allItems.filter(
          (i) =>
            (!i.hasAuthCode ||
              i.authorizationStatus === 'Pending' ||
              i.authorizationStatus === 'Provisional') &&
            i.claimStatus !== 'Paid',
        );
        totalAmount = relevantItems.reduce((s, i) => s + i.totalAmount, 0);
        break;

      case 'cap_capitation':
        relevantItems = allItems.filter(
          (i) => i.capAmount > 0 || i.portionType === 'CAP_ONLY',
        );
        totalAmount = allItems.reduce((s, i) => s + i.capAmount, 0);
        break;

      case 'ffs_fee_for_service':
        relevantItems = allItems.filter(
          (i) =>
            i.ffsAmount > 0 ||
            i.portionType === 'FFS_COVERED' ||
            i.portionType === 'FFS_PARTIAL_PRIVATE',
        );
        totalAmount = allItems.reduce((s, i) => s + i.ffsAmount, 0);
        break;

      case 'copayment':
        relevantItems = allItems.filter((i) => i.copayAmount > 0);
        totalAmount = allItems.reduce((s, i) => s + i.copayAmount, 0);
        break;

      case 'private_oop':
        relevantItems = allItems.filter((i) => i.privateAmount > 0);
        totalAmount = allItems.reduce((s, i) => s + i.privateAmount, 0);
        break;

      default:
        relevantItems = [];
        totalAmount = 0;
    }

    reports.push({
      key: catKey,
      label: def.label,
      description: def.description,
      badgeText: def.badge,
      totalAmount,
      recordCount: relevantItems.length,
      color: def.colorClass,
      items: relevantItems,
      serviceBreakdown: buildServiceBreakdown(relevantItems),
    });
  }

  return reports;
}

// ==================== PDF CONSTANTS ====================

const PDF_COLORS = {
  primary: [22, 101, 52] as [number, number, number], // XenoCare navy (unified)
  secondary: [51, 65, 85] as [number, number, number], // Slate-700
  accent: [37, 99, 235] as [number, number, number], // Blue-600
  success: [22, 163, 74] as [number, number, number],
  warning: [217, 119, 6] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number], // Red-600
  purple: [126, 34, 206] as [number, number, number],
  text: [17, 24, 39] as [number, number, number], // Gray-900
  muted: [100, 116, 139] as [number, number, number], // Slate-500
  light: [248, 250, 252] as [number, number, number],
  tableAlt: [248, 250, 252] as [number, number, number], // Slate-50
  white: [255, 255, 255] as [number, number, number],
};

const PDF_MARGINS = { left: 10, right: 10, top: 22, bottom: 20 };

// Maximum columns per table before splitting into two sub-tables
const MAX_COLS_PER_TABLE = 14;

// Column groups that belong in the "Patient & Service" table vs "Financial & Status" table
const FINANCIAL_GROUPS = new Set(['financial', 'authorization', 'billing', 'audit']);

/**
 * Split columns into two logical tables when too many to fit on one page.
 * Table A: identity + clinical + service columns
 * Table B: S/N + Patient + financial + authorization + billing + audit columns
 */
function splitColumnsForPdf(
  allCols: ExportColumnDef[],
): { tableA: ExportColumnDef[]; tableB: ExportColumnDef[] } | null {
  if (allCols.length <= MAX_COLS_PER_TABLE) return null; // No split needed

  const tableA: ExportColumnDef[] = [];
  const tableB: ExportColumnDef[] = [];

  // Always put S/N in both tables for cross-referencing
  const snCol = allCols.find((c) => c.key === 'serial_number');
  const patientCol = allCols.find((c) => c.key === 'patient_name');

  for (const col of allCols) {
    if (FINANCIAL_GROUPS.has(col.group)) {
      tableB.push(col);
    } else {
      tableA.push(col);
    }
  }

  // Add S/N and Patient to Table B for cross-reference (if not already there)
  if (snCol && !tableB.find((c) => c.key === 'serial_number')) {
    tableB.unshift(snCol);
  }
  if (patientCol && !tableB.find((c) => c.key === 'patient_name')) {
    tableB.splice(1, 0, patientCol);
  }

  return { tableA, tableB };
}

/**
 * Build column styles for a set of columns within available width.
 */
function buildColStyles(
  cols: ExportColumnDef[],
  availableWidth: number,
): Record<number, { cellWidth: number | 'auto'; halign?: 'left' | 'center' | 'right' }> {
  const narrowKeys = new Set([
    'serial_number', 'age', 'quantity', 'gender', 'copay_percentage',
    'coverage_percentage', 'is_referral', 'is_provisional',
  ]);
  const totalExcelW = cols.reduce((s, c) => s + c.excelWidth, 0);
  const styles: Record<number, { cellWidth: number | 'auto'; halign?: 'left' | 'center' | 'right' }> = {};

  cols.forEach((col, i) => {
    const minW = narrowKeys.has(col.key) ? 8 : 12;
    const w = Math.max(minW, Math.round((col.excelWidth / totalExcelW) * availableWidth));
    const isNumeric = col.group === 'financial' || col.key === 'serial_number' || col.key === 'quantity';
    styles[i] = {
      cellWidth: i === cols.length - 1 ? 'auto' : w,
      halign: isNumeric ? 'right' : 'left',
    };
  });

  return styles;
}

/**
 * Compute font size and cell padding based on column count.
 * Ensures readable text with proper breathing room.
 */
function getTableDensity(colCount: number): { fontSize: number; cellPadding: number } {
  if (colCount > 18) return { fontSize: 6.5, cellPadding: 1.5 };
  if (colCount > 14) return { fontSize: 7, cellPadding: 2 };
  if (colCount > 10) return { fontSize: 7.5, cellPadding: 2.5 };
  return { fontSize: 8, cellPadding: 3 };
}

// ==================== PDF GENERATION ====================

/**
 * Generate comprehensive category-breakdown PDF
 * Supports 'pdf_summary' (Standard Summary by auth status) and 'pdf_patient_breakdown' (detailed per patient)
 */
export async function generateCategoryReportPdf(
  data: NhisComprehensiveClaimsSummary,
  categoryReports: CategoryReportData[],
  options: ReportExportOptions,
): Promise<Blob> {
  const {
    facilityName = 'XenoCare',
    facilityAddress = 'XenoCare',
    facilityNhisId = 'NHIS-NDC-001',
    generatedBy = 'System',
    reportPeriod,
    filterDescription,
    format,
  } = options;

  const isPatientBreakdown = format === 'pdf_patient_breakdown';
  // Resolve selected columns (always includes mandatory)
  const activeColumns = getSelectedColumns(
    options.selectedColumns || DEFAULT_SELECTED_COLUMNS,
  );
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = PDF_MARGINS.top;

  // ---- Page helpers ----
  const checkPageBreak = (space: number) => {
    if (yPos + space > pageHeight - PDF_MARGINS.bottom) {
      doc.addPage();
      yPos = PDF_MARGINS.top;
      addHeader();
    }
  };

  const addHeader = () => {
    doc.setFillColor(...PDF_COLORS.primary);
    doc.rect(0, 0, pageWidth, 14, 'F');
    // Centered facility name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(facilityName.toUpperCase(), pageWidth / 2, 6, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const subtitle = isPatientBreakdown
      ? 'NHIS CLAIMS \u2014 PATIENT BREAKDOWN REPORT'
      : 'NHIS CLAIMS \u2014 CATEGORY ANALYSIS REPORT';
    doc.text(subtitle, pageWidth / 2, 11, { align: 'center' });
    // Right side info
    doc.setFontSize(7);
    doc.text(
      `Report: ${formatDate(new Date().toISOString())}`,
      pageWidth - PDF_MARGINS.right,
      7,
      { align: 'right' },
    );
    if (reportPeriod) {
      doc.text(
        `Period: ${formatDate(reportPeriod.start)} — ${formatDate(reportPeriod.end)}`,
        pageWidth - PDF_MARGINS.right,
        12,
        { align: 'right' },
      );
    }
  };

  const addFooter = () => {
    const fy = pageHeight - 8;
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${facilityName}  \u2022  NHIS ID: ${facilityNhisId}  \u2022  Page ${doc.getCurrentPageInfo().pageNumber}`,
      pageWidth / 2,
      fy,
      { align: 'center' },
    );
  };

  // ---- First page ----
  addHeader();
  yPos = 20;

  // Filter / period metadata line
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFont('helvetica', 'normal');
  if (filterDescription) {
    doc.text(`Filters: ${filterDescription}`, PDF_MARGINS.left, yPos);
    yPos += 4;
  }
  doc.text(
    `Generated: ${formatDateTime(new Date().toISOString())}  |  By: ${generatedBy}  |  Format: ${isPatientBreakdown ? 'Patient Breakdown' : 'Standard Summary'}`,
    PDF_MARGINS.left,
    yPos,
  );
  yPos += 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(PDF_MARGINS.left, yPos, pageWidth - PDF_MARGINS.right, yPos);
  yPos += 6;

  // ======== EXECUTIVE SUMMARY (autoTable for consistency) ========
  doc.setTextColor(...PDF_COLORS.text);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', PDF_MARGINS.left, yPos);
  yPos += 5;

  const totalClaim = data.allItems.reduce((s, i) => s + i.totalAmount, 0);
  const totalNetNhis = data.allItems.reduce((s, i) => s + i.netNhisPayable, 0);
  const totalPatientPays = data.allItems.reduce(
    (s, i) => s + i.copayAmount + i.privateAmount,
    0,
  );
  const pendingItems = data.allItems.filter(
    (i) =>
      !i.hasAuthCode ||
      i.authorizationStatus === 'Pending' ||
      i.authorizationStatus === 'Provisional',
  );
  const totalPending = pendingItems.reduce((s, i) => s + i.totalAmount, 0);
  const totalCap = data.allItems.reduce((s, i) => s + i.capAmount, 0);
  const totalFfs = data.allItems.reduce((s, i) => s + i.ffsAmount, 0);
  const totalCopay = data.allItems.reduce((s, i) => s + i.copayAmount, 0);
  const totalPrivate = data.allItems.reduce((s, i) => s + i.privateAmount, 0);

  // Summary table — clean 4-column layout (Metric | Amount | Metric | Amount)
  autoTable(doc, {
    startY: yPos,
    head: [['Category', 'Amount', 'Category', 'Amount']],
    body: [
      [
        'Total Claim Value',
        `${formatCurrency(totalClaim)}  (${data.allItems.length})`,
        'Net NHIS Payable',
        `${formatCurrency(totalNetNhis)}`,
      ],
      [
        'Total Patient Pays',
        formatCurrency(totalPatientPays),
        'Pending Authorization',
        `${formatCurrency(totalPending)}  (${pendingItems.length})`,
      ],
      [
        'CAP (Capitation)',
        formatCurrency(totalCap),
        'FFS (Fee For Service)',
        formatCurrency(totalFfs),
      ],
      [
        'Co-payment (10%)',
        formatCurrency(totalCopay),
        'Private / OOP',
        formatCurrency(totalPrivate),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: PDF_COLORS.primary,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 2.5,
    },
    alternateRowStyles: { fillColor: PDF_COLORS.tableAlt },
    margin: { left: PDF_MARGINS.left + 20, right: PDF_MARGINS.right + 20 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
      1: { halign: 'right', cellWidth: 65, fontStyle: 'bold' },
      2: { fontStyle: 'bold', cellWidth: 55 },
      3: { halign: 'right', cellWidth: 65, fontStyle: 'bold' },
    },
    tableWidth: 'wrap',
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // ======== CATEGORY-BY-CATEGORY SECTIONS ========
  for (const report of categoryReports) {
    // New page for each category section
    doc.addPage();
    addHeader();
    yPos = 24;

    // Category title bar — XenoCare navy
    doc.setFillColor(...PDF_COLORS.primary);
    doc.roundedRect(
      PDF_MARGINS.left,
      yPos,
      pageWidth - PDF_MARGINS.left - PDF_MARGINS.right,
      10,
      2,
      2,
      'F',
    );
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${report.label.toUpperCase()} — ${formatCurrency(report.totalAmount)}`,
      pageWidth / 2,
      yPos + 7,
      { align: 'center' },
    );
    yPos += 14;

    // Description + record count
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${report.description}  |  ${report.recordCount} records  |  ${report.badgeText}`,
      PDF_MARGINS.left,
      yPos,
    );
    yPos += 6;

    // ---- Service breakdown table ----
    doc.setTextColor(...PDF_COLORS.text);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Service Category Breakdown', PDF_MARGINS.left, yPos);
    yPos += 4;

    const svcData = report.serviceBreakdown.map((row) => [
      row.serviceCategoryLabel,
      row.itemCount.toString(),
      formatCurrency(row.totalAmount),
      formatCurrency(row.nhisAmount),
      formatCurrency(row.patientAmount),
      formatCurrency(row.capAmount),
      formatCurrency(row.ffsAmount),
      formatCurrency(row.copayAmount),
      formatCurrency(row.privateAmount),
      formatCurrency(row.netNhisPayable),
      `${row.avgCoveragePercent}%`,
    ]);

    // Totals row
    const totals = report.serviceBreakdown.reduce(
      (acc, r) => {
        acc.items += r.itemCount;
        acc.total += r.totalAmount;
        acc.nhis += r.nhisAmount;
        acc.patient += r.patientAmount;
        acc.cap += r.capAmount;
        acc.ffs += r.ffsAmount;
        acc.copay += r.copayAmount;
        acc.priv += r.privateAmount;
        acc.netNhis += r.netNhisPayable;
        return acc;
      },
      {
        items: 0,
        total: 0,
        nhis: 0,
        patient: 0,
        cap: 0,
        ffs: 0,
        copay: 0,
        priv: 0,
        netNhis: 0,
      },
    );

    svcData.push([
      'TOTAL',
      totals.items.toString(),
      formatCurrency(totals.total),
      formatCurrency(totals.nhis),
      formatCurrency(totals.patient),
      formatCurrency(totals.cap),
      formatCurrency(totals.ffs),
      formatCurrency(totals.copay),
      formatCurrency(totals.priv),
      formatCurrency(totals.netNhis),
      totals.total > 0
        ? `${Math.round((totals.nhis / totals.total) * 100)}%`
        : '—',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [
        [
          'Service',
          'Count',
          'Total',
          'NHIS Amt',
          'Patient Amt',
          'CAP',
          'FFS',
          'Co-pay',
          'Private',
          'Net NHIS',
          'Avg Cov%',
        ],
      ],
      body: svcData,
      theme: 'grid',
      headStyles: {
        fillColor: PDF_COLORS.primary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'ellipsize' as const,
      },
      alternateRowStyles: { fillColor: PDF_COLORS.tableAlt },
      margin: { left: PDF_MARGINS.left, right: PDF_MARGINS.right },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' },
        7: { cellWidth: 20, halign: 'right' },
        8: { cellWidth: 20, halign: 'right' },
        9: { cellWidth: 22, halign: 'right' },
        10: { cellWidth: 12, halign: 'center' },
      },
      willDrawCell: (cellData) => {
        // Bold total row
        if (cellData.row.index === svcData.length - 1) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.fillColor = [240, 240, 250];
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ---- Detailed items (using admin-selected columns) ----
    const pdfCols = activeColumns;
    const availableWidth = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right;

    const currencyKeys = new Set([
      'total_amount', 'unit_price', 'nhis_payable', 'net_nhis_payable',
      'copay_amount', 'private_amount', 'approved_amount', 'discount_amount',
    ]);
    const formatPdfCell = (val: string | number, colKey: string): string => {
      if (typeof val === 'number') {
        return currencyKeys.has(colKey) ? formatCurrency(val) : String(val);
      }
      const s = String(val);
      // Suppress raw UUIDs and prefixed UUIDs (e.g. PEND-xxxxxxxx-...)
      if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(s)) return '\u2014';
      return truncateText(s, 40);
    };

    // Split columns into two tables if too many for one page
    const split = splitColumnsForPdf(pdfCols);

    /**
     * Render a legend box explaining the table layout to the reader.
     */
    const renderSplitLegend = () => {
      if (!split) return;
      checkPageBreak(22);

      // Legend box
      const boxW = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right;
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.roundedRect(PDF_MARGINS.left, yPos, boxW, 18, 1.5, 1.5, 'FD');

      const lx = PDF_MARGINS.left + 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_COLORS.text);
      doc.text('How to Read This Report', lx, yPos + 4.5);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(
        `Due to the number of columns selected (${pdfCols.length}), data is presented in two linked tables per section for readability:`,
        lx, yPos + 8.5,
      );
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_COLORS.secondary);
      doc.text(
        `\u25A0 Table A \u2014 Patient & Service Information (${split.tableA.length} columns):  Demographics, diagnosis, service details, and dates.`,
        lx, yPos + 12.5,
      );
      doc.setTextColor(...PDF_COLORS.primary);
      doc.text(
        `\u25A0 Table B \u2014 Financial & Authorization (${split.tableB.length} columns):  Amounts, coverage, co-pay, authorization status, and billing.`,
        lx, yPos + 16,
      );

      // Cross-reference note on right
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(
        'Match rows between tables using the S/N column.',
        pageWidth - PDF_MARGINS.right - 4, yPos + 4.5,
        { align: 'right' },
      );
      yPos += 21;
    };

    /**
     * Render a sub-table label with description.
     */
    const renderTableLabel = (
      tableId: 'A' | 'B',
      color: [number, number, number],
    ) => {
      const labels = {
        A: {
          title: `Table A \u2014 Patient & Service Information (${split!.tableA.length} columns)`,
          desc: 'Patient demographics, clinical diagnosis, service name, dates, and encounter details',
        },
        B: {
          title: `Table B \u2014 Financial & Authorization (${split!.tableB.length} columns)`,
          desc: 'Amounts billed, NHIS payable, co-pay, coverage %, authorization codes, and billing status',
        },
      };
      const { title, desc } = labels[tableId];

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(title, PDF_MARGINS.left, yPos);
      yPos += 3;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(desc, PDF_MARGINS.left, yPos);
      yPos += 3.5;
    };

    /**
     * Render a single autoTable for a set of columns.
     * Uses linebreak overflow with controlled widths for professional text wrapping.
     */
    const renderDataTable = (
      cols: ExportColumnDef[],
      items: NhisComprehensiveClaimItem[],
      headerColor: [number, number, number],
      altRowColor: [number, number, number],
    ) => {
      const density = getTableDensity(cols.length);
      const colStyles = buildColStyles(cols, availableWidth);
      autoTable(doc, {
        startY: yPos,
        head: [cols.map((c) => c.shortLabel)],
        body: items.map((item, i) =>
          cols.map((col) => formatPdfCell(col.accessor(item, i + 1), col.key)),
        ),
        theme: 'grid',
        headStyles: {
          fillColor: headerColor,
          textColor: PDF_COLORS.white,
          fontStyle: 'bold',
          fontSize: density.fontSize,
          cellPadding: density.cellPadding,
        },
        bodyStyles: {
          fontSize: density.fontSize,
          cellPadding: density.cellPadding,
          overflow: 'linebreak' as const,
          minCellHeight: 6,
        },
        alternateRowStyles: { fillColor: altRowColor },
        margin: { left: PDF_MARGINS.left, right: PDF_MARGINS.right },
        columnStyles: colStyles,
        didDrawPage: () => {
          addHeader();
          addFooter();
        },
      });
      yPos = (doc as any).lastAutoTable.finalY;
    };

    if (isPatientBreakdown) {
      // Group by patient
      const patientGroups: Record<
        string,
        {
          patientName: string;
          emrNumber: string;
          nhisNumber: string;
          payerName: string;
          encounterNumber: string;
          items: NhisComprehensiveClaimItem[];
        }
      > = {};

      report.items.forEach((item) => {
        const key = item.patientId || item.patientName;
        if (!patientGroups[key]) {
          patientGroups[key] = {
            patientName: item.patientName || '\u2014',
            emrNumber: item.emrNumber || '\u2014',
            nhisNumber: item.nhisNumber || '\u2014',
            payerName:
              item.payerName || item.hmoName || item.insuranceType || '\u2014',
            encounterNumber: item.encounterNumber || '\u2014',
            items: [],
          };
        }
        patientGroups[key].items.push(item);
      });

      const sortedPatients = Object.values(patientGroups).sort((a, b) =>
        a.patientName.localeCompare(b.patientName),
      );

      checkPageBreak(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_COLORS.primary);
      doc.text(
        `Detailed Patient Breakdown \u2014 ${report.label}`,
        PDF_MARGINS.left,
        yPos,
      );
      yPos += 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(
        `${sortedPatients.length} patients  |  ${report.recordCount} total service items  |  ${pdfCols.length} data columns`,
        PDF_MARGINS.left,
        yPos,
      );
      yPos += 5;

      renderSplitLegend();

      sortedPatients.forEach((group, idx) => {
        checkPageBreak(30);

        // Patient header strip
        const stripW = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right;
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(PDF_MARGINS.left, yPos, stripW, 10, 1, 1, 'F');
        doc.setDrawColor(...PDF_COLORS.primary);
        doc.roundedRect(PDF_MARGINS.left, yPos, stripW, 10, 1, 1, 'S');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_COLORS.primary);
        doc.text(
          `Patient ${idx + 1} of ${sortedPatients.length}:  ${group.patientName}`,
          PDF_MARGINS.left + 3,
          yPos + 4,
        );
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.text);
        doc.text(
          `EMR: ${group.emrNumber}   |   NHIS ID: ${group.nhisNumber}   |   Encounter: ${group.encounterNumber}   |   Payer/HMO: ${group.payerName}   |   Services: ${group.items.length} item${group.items.length > 1 ? 's' : ''}`,
          PDF_MARGINS.left + 3,
          yPos + 8.5,
        );
        yPos += 12;

        if (split) {
          // ── Table A: Patient & Service ──
          renderTableLabel('A', PDF_COLORS.secondary);
          renderDataTable(split.tableA, group.items, PDF_COLORS.secondary, PDF_COLORS.tableAlt);
          yPos += 5;

          // ── Table B: Financial & Authorization ──
          checkPageBreak(15);
          renderTableLabel('B', PDF_COLORS.primary);
          renderDataTable(split.tableB, group.items, PDF_COLORS.primary, PDF_COLORS.tableAlt);
        } else {
          // Single table — all columns fit
          renderDataTable(pdfCols, group.items, PDF_COLORS.secondary, PDF_COLORS.tableAlt);
        }
        yPos += 2;

        // Subtotal
        const subTotal = group.items.reduce((s, i) => s + i.totalAmount, 0);
        const subNhis = group.items.reduce((s, i) => s + i.netNhisPayable, 0);
        const subCopay = group.items.reduce((s, i) => s + i.copayAmount, 0);
        const subPriv = group.items.reduce((s, i) => s + i.privateAmount, 0);
        checkPageBreak(10);
        doc.setFillColor(248, 250, 252);
        const subW = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right;
        doc.roundedRect(PDF_MARGINS.left, yPos, subW, 7, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_COLORS.text);
        doc.text(
          `Patient Subtotal (${group.items.length} item${group.items.length > 1 ? 's' : ''}):`,
          PDF_MARGINS.left + 3,
          yPos + 4.5,
        );
        doc.text(
          `Total Billed: ${formatCurrency(subTotal)}   |   NHIS Payable: ${formatCurrency(subNhis)}   |   Co-pay: ${formatCurrency(subCopay)}   |   Private: ${formatCurrency(subPriv)}`,
          pageWidth - PDF_MARGINS.right - 3,
          yPos + 4.5,
          { align: 'right' },
        );
        yPos += 10;
      });
    } else {
      // Standard summary: grouped by auth status
      checkPageBreak(20);

      const withAuth = report.items.filter((i) => i.hasAuthCode);
      const withoutAuth = report.items.filter((i) => !i.hasAuthCode);

      // Section title
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_COLORS.primary);
      doc.text(
        `Standard Claims Summary \u2014 ${report.label}`,
        PDF_MARGINS.left,
        yPos,
      );
      yPos += 4;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(
        `${report.recordCount} total items  |  ${withAuth.length} authorized  |  ${withoutAuth.length} pending authorization  |  ${pdfCols.length} data columns`,
        PDF_MARGINS.left,
        yPos,
      );
      yPos += 5;

      renderSplitLegend();

      // With Auth Code section
      if (withAuth.length > 0) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_COLORS.primary);
        doc.text(
          `\u2713 Authorized Claims (${withAuth.length} items) \u2014 Valid NHIS Authorization Obtained`,
          PDF_MARGINS.left,
          yPos,
        );
        yPos += 3;
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.muted);
        doc.text(
          'These claims have been pre-authorized by the NHIS and are eligible for reimbursement processing.',
          PDF_MARGINS.left,
          yPos,
        );
        yPos += 4;

        if (split) {
          renderTableLabel('A', PDF_COLORS.secondary);
          renderDataTable(split.tableA, withAuth, PDF_COLORS.secondary, PDF_COLORS.tableAlt);
          yPos += 5;

          checkPageBreak(15);
          renderTableLabel('B', PDF_COLORS.primary);
          renderDataTable(split.tableB, withAuth, PDF_COLORS.primary, PDF_COLORS.tableAlt);
        } else {
          renderDataTable(pdfCols, withAuth, PDF_COLORS.primary, PDF_COLORS.tableAlt);
        }
        yPos += 6;
      }

      // Without Auth Code section
      if (withoutAuth.length > 0) {
        checkPageBreak(18);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 83, 9);
        doc.text(
          `\u26A0 Pending Authorization (${withoutAuth.length} items) \u2014 Action Required`,
          PDF_MARGINS.left,
          yPos,
        );
        yPos += 3;
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.muted);
        doc.text(
          'These claims are awaiting NHIS authorization codes. They cannot be submitted for reimbursement until authorization is obtained.',
          PDF_MARGINS.left,
          yPos,
        );
        yPos += 4;

        if (split) {
          renderTableLabel('A', PDF_COLORS.secondary);
          renderDataTable(split.tableA, withoutAuth, [180, 83, 9], [255, 251, 235]);
          yPos += 5;

          checkPageBreak(15);
          renderTableLabel('B', PDF_COLORS.primary);
          renderDataTable(split.tableB, withoutAuth, [180, 83, 9], [255, 251, 235]);
        } else {
          renderDataTable(pdfCols, withoutAuth, [180, 83, 9], [255, 251, 235]);
        }
        yPos += 6;
      }
    }
  }

  // ======== GRAND TOTAL PAGE ========
  doc.addPage();
  addHeader();
  yPos = 24;

  // Grand total banner — clean XenoCare navy bar
  doc.setFillColor(...PDF_COLORS.primary);
  doc.roundedRect(
    PDF_MARGINS.left,
    yPos,
    pageWidth - PDF_MARGINS.left - PDF_MARGINS.right,
    22,
    2,
    2,
    'F',
  );
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL — SELECTED CATEGORIES', pageWidth / 2, yPos + 8, {
    align: 'center',
  });
  doc.setFontSize(16);
  doc.text(formatCurrency(totalClaim), pageWidth / 2, yPos + 18, {
    align: 'center',
  });
  yPos += 28;

  // Summary table of all selected categories
  autoTable(doc, {
    startY: yPos,
    head: [['Category', 'Records', 'Total Amount', 'Badge']],
    body: categoryReports.map((r) => [
      r.label,
      r.recordCount.toString(),
      formatCurrency(r.totalAmount),
      r.badgeText,
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: PDF_COLORS.primary,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 60, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 40, halign: 'center' },
    },
    margin: { left: PDF_MARGINS.left + 30, right: PDF_MARGINS.right + 30 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 20;

  // Certification
  checkPageBreak(50);
  doc.setDrawColor(...PDF_COLORS.muted);
  doc.line(PDF_MARGINS.left, yPos, pageWidth - PDF_MARGINS.right, yPos);
  yPos += 8;
  doc.setTextColor(...PDF_COLORS.text);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Certification', PDF_MARGINS.left, yPos);
  yPos += 7;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'I certify that the above services were rendered to listed NHIS beneficiaries and claims are accurate.',
    PDF_MARGINS.left,
    yPos,
  );
  yPos += 12;

  const sigW = 75;
  const sigGap = 30;
  const sigStart = (pageWidth - (sigW * 3 + sigGap * 2)) / 2;
  doc.line(sigStart, yPos, sigStart + sigW, yPos);
  doc.setFontSize(8);
  doc.text('NHIS Desk Officer', sigStart, yPos + 4);
  doc.text('Date: _______________', sigStart, yPos + 9);

  const sig2 = sigStart + sigW + sigGap;
  doc.line(sig2, yPos, sig2 + sigW, yPos);
  doc.text('Accounts Officer', sig2, yPos + 4);
  doc.text('Date: _______________', sig2, yPos + 9);

  const sig3 = sig2 + sigW + sigGap;
  doc.line(sig3, yPos, sig3 + sigW, yPos);
  doc.text('Medical Director', sig3, yPos + 4);
  doc.text('Date: _______________', sig3, yPos + 9);

  // Stamp box
  yPos += 20;
  doc.setDrawColor(...PDF_COLORS.muted);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(pageWidth - PDF_MARGINS.right - 42, yPos - 12, 38, 25);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text('Official Stamp', pageWidth - PDF_MARGINS.right - 23, yPos + 5, {
    align: 'center',
  });

  // Add footer to all
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  return doc.output('blob');
}

// ==================== EXCEL EXPORT ====================

/**
 * Generate comprehensive multi-sheet Excel workbook with per-category sheets
 */
export function generateCategoryReportExcel(
  data: NhisComprehensiveClaimsSummary,
  categoryReports: CategoryReportData[],
  options: ReportExportOptions,
): Blob {
  const wb = XLSX.utils.book_new();
  const {
    facilityName = 'XenoCare',
    reportPeriod,
    generatedBy = 'System',
  } = options;
  // Resolve selected columns
  const xlCols = getSelectedColumns(
    options.selectedColumns || DEFAULT_SELECTED_COLUMNS,
  );

  // ---- Sheet 1: Executive Summary ----
  const summaryRows: (string | number | null)[][] = [
    ['XENOCARE — NHIS CLAIMS CATEGORY REPORT', '', '', ''],
    ['Facility', facilityName, '', ''],
    ['Report Date', formatDate(new Date().toISOString()), '', ''],
    [
      'Period',
      reportPeriod
        ? `${reportPeriod.start} to ${reportPeriod.end}`
        : 'All Time',
      '',
      '',
    ],
    ['Generated By', generatedBy, '', ''],
    [],
    ['EXECUTIVE SUMMARY', '', '', ''],
    ['Metric', 'Amount (NGN)', 'Records', 'Notes'],
    [
      'Total Claim Value',
      data.allItems.reduce((s, i) => s + i.totalAmount, 0),
      data.allItems.length,
      'All billed services',
    ],
    [
      'Net NHIS Payable',
      data.allItems.reduce((s, i) => s + i.netNhisPayable, 0),
      data.allItems.filter((i) => i.netNhisPayable > 0).length,
      'FFS minus co-pay',
    ],
    [
      'Total Patient Pays',
      data.allItems.reduce((s, i) => s + i.copayAmount + i.privateAmount, 0),
      data.allItems.filter((i) => i.copayAmount + i.privateAmount > 0).length,
      'Co-pay + Private',
    ],
    [
      'Pending Auth',
      data.allItems
        .filter((i) => !i.hasAuthCode)
        .reduce((s, i) => s + i.totalAmount, 0),
      data.allItems.filter((i) => !i.hasAuthCode).length,
      'Requires Action',
    ],
    [],
    ['PAYMENT PORTION BREAKDOWN', '', '', ''],
    [
      'CAP (Capitation)',
      data.allItems.reduce((s, i) => s + i.capAmount, 0),
      data.allItems.filter((i) => i.capAmount > 0).length,
      'Prepaid',
    ],
    [
      'FFS (Fee For Service)',
      data.allItems.reduce((s, i) => s + i.ffsAmount, 0),
      data.allItems.filter((i) => i.ffsAmount > 0).length,
      'Billable',
    ],
    [
      'Co-payment',
      data.allItems.reduce((s, i) => s + i.copayAmount, 0),
      data.allItems.filter((i) => i.copayAmount > 0).length,
      'Mandatory share',
    ],
    [
      'Private / OOP',
      data.allItems.reduce((s, i) => s + i.privateAmount, 0),
      data.allItems.filter((i) => i.privateAmount > 0).length,
      'Patient pays',
    ],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Executive Summary');

  // ---- Sheet per selected category ----
  categoryReports.forEach((report) => {
    const sheetName = report.label
      .substring(0, 28)
      .replace(/[\\/*?[\]:]/g, '_');

    // Service breakdown header
    const rows: (string | number | null)[][] = [
      [
        `${report.label} — Service Breakdown`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      [report.description, '', '', '', '', '', '', '', '', '', ''],
      [
        `Records: ${report.recordCount}`,
        `Total: ${formatCurrency(report.totalAmount)}`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      [],
      [
        'Service Category',
        'Count',
        'Total Amount',
        'NHIS Amount',
        'Patient Amount',
        'CAP',
        'FFS',
        'Co-pay',
        'Private',
        'Net NHIS Payable',
        'Avg Coverage %',
      ],
    ];

    report.serviceBreakdown.forEach((row) => {
      rows.push([
        row.serviceCategoryLabel,
        row.itemCount,
        row.totalAmount,
        row.nhisAmount,
        row.patientAmount,
        row.capAmount,
        row.ffsAmount,
        row.copayAmount,
        row.privateAmount,
        row.netNhisPayable,
        row.avgCoveragePercent,
      ]);
    });

    // Totals row
    const tot = report.serviceBreakdown.reduce(
      (a, r) => {
        a.items += r.itemCount;
        a.total += r.totalAmount;
        a.nhis += r.nhisAmount;
        a.patient += r.patientAmount;
        a.cap += r.capAmount;
        a.ffs += r.ffsAmount;
        a.copay += r.copayAmount;
        a.priv += r.privateAmount;
        a.netNhis += r.netNhisPayable;
        return a;
      },
      {
        items: 0,
        total: 0,
        nhis: 0,
        patient: 0,
        cap: 0,
        ffs: 0,
        copay: 0,
        priv: 0,
        netNhis: 0,
      },
    );
    rows.push([
      'TOTAL',
      tot.items,
      tot.total,
      tot.nhis,
      tot.patient,
      tot.cap,
      tot.ffs,
      tot.copay,
      tot.priv,
      tot.netNhis,
      '',
    ]);

    // Blank row then detailed items (using admin-selected columns)
    rows.push([]);
    rows.push([
      `DETAILED ITEMS (${xlCols.length} columns)`,
      ...new Array(Math.max(0, xlCols.length - 1)).fill(''),
    ]);
    rows.push(xlCols.map((c) => c.label));

    report.items.forEach((item, idx) => {
      rows.push(
        xlCols.map((col) => {
          const val = col.accessor(item, idx + 1);
          return val;
        }),
      );
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      // Service breakdown columns (first 11)
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      // Dynamic columns beyond the service breakdown header row
      ...xlCols.slice(11).map((c) => ({ wch: c.excelWidth })),
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // Write to buffer
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ==================== CSV EXPORT ====================

/**
 * Generate CSV string for selected categories
 * One file per category or combined — we do combined with clear section headers
 */
export function generateCategoryReportCsv(
  data: NhisComprehensiveClaimsSummary,
  categoryReports: CategoryReportData[],
  options: ReportExportOptions,
): string {
  const BOM = '\uFEFF';
  const lines: string[] = [];
  const esc = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (
      s.includes(',') ||
      s.includes('"') ||
      s.includes('\n') ||
      s.includes('\r')
    ) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  // Resolve selected columns
  const csvCols = getSelectedColumns(
    options.selectedColumns || DEFAULT_SELECTED_COLUMNS,
  );

  // Header info
  lines.push(`${esc('XENOCARE — NHIS CLAIMS CATEGORY REPORT')}`);
  lines.push(
    `${esc('Report Date')},${esc(formatDate(new Date().toISOString()))}`,
  );
  if (options.reportPeriod) {
    lines.push(
      `${esc('Period')},${esc(`${options.reportPeriod.start} to ${options.reportPeriod.end}`)}`,
    );
  }
  lines.push('');

  // Executive Summary
  lines.push('EXECUTIVE SUMMARY');
  lines.push('Metric,Amount,Records,Notes');
  lines.push(
    `Total Claim Value,${data.allItems.reduce((s, i) => s + i.totalAmount, 0)},${data.allItems.length},All Records`,
  );
  lines.push(
    `Net NHIS Payable,${data.allItems.reduce((s, i) => s + i.netNhisPayable, 0)},${data.allItems.filter((i) => i.netNhisPayable > 0).length},FFS minus co-pay`,
  );
  lines.push(
    `Total Patient Pays,${data.allItems.reduce((s, i) => s + i.copayAmount + i.privateAmount, 0)},${data.allItems.filter((i) => i.copayAmount + i.privateAmount > 0).length},Co-pay + Private`,
  );
  lines.push(
    `Pending Auth,${data.allItems.filter((i) => !i.hasAuthCode).reduce((s, i) => s + i.totalAmount, 0)},${data.allItems.filter((i) => !i.hasAuthCode).length},Requires Action`,
  );
  lines.push(
    `CAP (Capitation),${data.allItems.reduce((s, i) => s + i.capAmount, 0)},${data.allItems.filter((i) => i.capAmount > 0).length},Prepaid`,
  );
  lines.push(
    `FFS (Fee For Service),${data.allItems.reduce((s, i) => s + i.ffsAmount, 0)},${data.allItems.filter((i) => i.ffsAmount > 0).length},Billable`,
  );
  lines.push(
    `Co-payment,${data.allItems.reduce((s, i) => s + i.copayAmount, 0)},${data.allItems.filter((i) => i.copayAmount > 0).length},Mandatory share`,
  );
  lines.push(
    `Private / OOP,${data.allItems.reduce((s, i) => s + i.privateAmount, 0)},${data.allItems.filter((i) => i.privateAmount > 0).length},Patient pays`,
  );
  lines.push('');

  // Per-category sections
  categoryReports.forEach((report) => {
    lines.push(`=== ${report.label.toUpperCase()} ===`);
    lines.push(`${esc(report.description)}`);
    lines.push(`Records: ${report.recordCount},Total: ${report.totalAmount}`);
    lines.push('');

    // Service breakdown
    lines.push('SERVICE CATEGORY BREAKDOWN');
    lines.push(
      'Service,Count,Total,NHIS Amount,Patient Amount,CAP,FFS,Co-pay,Private,Net NHIS,Avg Coverage %',
    );
    report.serviceBreakdown.forEach((row) => {
      lines.push(
        [
          esc(row.serviceCategoryLabel),
          row.itemCount,
          row.totalAmount,
          row.nhisAmount,
          row.patientAmount,
          row.capAmount,
          row.ffsAmount,
          row.copayAmount,
          row.privateAmount,
          row.netNhisPayable,
          `${row.avgCoveragePercent}%`,
        ].join(','),
      );
    });
    lines.push('');

    // Detail items (using admin-selected columns)
    lines.push(`DETAILED ITEMS (${csvCols.length} columns)`);
    lines.push(csvCols.map((c) => esc(c.label)).join(','));

    report.items.forEach((item, idx) => {
      lines.push(
        csvCols.map((col) => esc(col.accessor(item, idx + 1))).join(','),
      );
    });

    lines.push('');
    lines.push('');
  });

  return BOM + lines.join('\n');
}

// ==================== DOWNLOAD HELPERS ====================

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Main export entry point — dispatches to correct format generator
 */
export async function exportCategoryReport(
  data: NhisComprehensiveClaimsSummary,
  options: ReportExportOptions,
): Promise<void> {
  const categoryReports = buildCategoryReports(
    data,
    options.selectedCategories,
  );
  const dateStr = new Date().toISOString().split('T')[0];

  switch (options.format) {
    case 'pdf_summary':
    case 'pdf_patient_breakdown': {
      const pdfBlob = await generateCategoryReportPdf(
        data,
        categoryReports,
        options,
      );
      const suffix =
        options.format === 'pdf_patient_breakdown'
          ? 'Patient_Breakdown'
          : 'Standard_Summary';
      downloadBlob(pdfBlob, `NHIS_Category_Report_${suffix}_${dateStr}.pdf`);
      break;
    }

    case 'excel': {
      const xlBlob = generateCategoryReportExcel(
        data,
        categoryReports,
        options,
      );
      downloadBlob(xlBlob, `NHIS_Category_Report_${dateStr}.xlsx`);
      break;
    }

    case 'csv': {
      const csvContent = generateCategoryReportCsv(
        data,
        categoryReports,
        options,
      );
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `NHIS_Category_Report_${dateStr}.csv`);
      break;
    }
  }
}
