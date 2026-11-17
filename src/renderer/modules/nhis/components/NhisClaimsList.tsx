// =============================================================================
// NHIS Claims Management Component (Redesigned)
// XENOCARE EMR - NHIS Module
// Full CAP / FFS / Private / Co-pay payment portion model
// Configurable export field selector + enhanced claim detail modal
// =============================================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  FlaskConical,
  Pill,
  Stethoscope,
  Activity,
  Syringe,
  Shield,
  Users,
  Building,
  Calendar,
  RefreshCw,
  TrendingUp,
  DollarSign,
  CreditCard,
  BadgeCheck,
  AlertCircle,
  X,
  ListFilter,
  ChevronUp,
  Settings2,
  Columns,
  Banknote,
  Receipt,
  ClipboardList,
} from 'lucide-react';
import { useNhisComprehensiveClaims } from '../hooks';
import type { NhisComprehensiveClaimItem } from '../api/nhis.api';
import { downloadComprehensiveNhisClaimsPdf } from '../utils/nhis-claims-pdf-export';
import { useToast } from '../../../components/ui/Toast';
import { getPayerSchemes } from '../../patient-registration/api/patient.api';
import { NhisClaimsExportModal } from './NhisClaimsExportModal';
import { SkeletonTable } from '../../../components/ui/SkeletonLoader';

// XenoCare Logo
// =============================================================================
// Helpers & Constants
// =============================================================================

const formatCurrency = (amount: number) =>
  `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const getInsuranceTypeColor = (type: string) => {
  switch (type) {
    case 'Personnel':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Civilian NHIS':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'GIFSHIP':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Private HMO':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'lab':
      return <FlaskConical className="h-4 w-4" />;
    case 'pharmacy':
      return <Pill className="h-4 w-4" />;
    case 'radiology':
      return <Activity className="h-4 w-4" />;
    case 'procedure':
      return <Syringe className="h-4 w-4" />;
    case 'specialty':
      return <Stethoscope className="h-4 w-4" />;
    case 'consultation':
      return <Users className="h-4 w-4" />;
    case 'admission':
      return <Building className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'lab':
      return 'bg-purple-100 text-purple-700';
    case 'pharmacy':
      return 'bg-green-100 text-green-700';
    case 'radiology':
      return 'bg-orange-100 text-orange-700';
    case 'procedure':
      return 'bg-red-100 text-red-700';
    case 'specialty':
      return 'bg-indigo-100 text-indigo-700';
    case 'consultation':
      return 'bg-blue-100 text-blue-700';
    case 'admission':
      return 'bg-teal-100 text-teal-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    lab: 'Laboratory',
    pharmacy: 'Pharmacy',
    radiology: 'Radiology',
    procedure: 'Procedures',
    specialty: 'Specialty',
    consultation: 'Consultation',
    nursing: 'Nursing',
    admission: 'Admission/Inpatient',
  };
  return labels[category] || category;
};

const PORTION_COLORS: Record<string, string> = {
  FFS_COVERED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FFS_PARTIAL_PRIVATE: 'bg-amber-100 text-amber-700 border-amber-200',
  PRIVATE_ONLY: 'bg-orange-100 text-orange-700 border-orange-200',
  CAP_ONLY: 'bg-blue-100 text-blue-700 border-blue-200',
};

const getPortionBadge = (type: string) =>
  PORTION_COLORS[type] || 'bg-gray-100 text-gray-700 border-gray-200';

const PORTION_TYPE_SHORT_LABELS: Record<string, string> = {
  FFS_COVERED: 'FFS',
  FFS_PARTIAL_PRIVATE: 'FFS+Priv',
  PRIVATE_ONLY: 'Private',
  CAP_ONLY: 'CAP',
};

const getClaimStatusStyle = (status: string) => {
  switch (status) {
    case 'Paid':
      return 'bg-green-100 text-green-700';
    case 'Approved':
      return 'bg-blue-100 text-blue-700';
    case 'Submitted':
      return 'bg-cyan-100 text-cyan-700';
    case 'Under_Review':
      return 'bg-amber-100 text-amber-700';
    case 'Queried':
      return 'bg-orange-100 text-orange-700';
    case 'Rejected':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

// =============================================================================
// Filter + Export Field Definitions
// =============================================================================

interface FilterState {
  startDate?: string;
  endDate?: string;
  insuranceType?: string;
  category?: string;
  hasAuthCode?: boolean;
  hmoIds: string[];
  schemes: string[];
  statuses: string[];
  coverageTypes: string[];
  portionTypes: string[];
  claimStatuses: string[];
  dateRangeType: 'created' | 'service';
}

/** Each exportable column that an admin can toggle on/off */
export interface ExportColumn {
  key: string;
  label: string;
  group:
    | 'patient'
    | 'encounter'
    | 'service'
    | 'financial'
    | 'authorization'
    | 'billing'
    | 'clinical'
    | 'audit';
  required?: boolean; // cannot be deselected
  getValue: (item: NhisComprehensiveClaimItem) => string;
}

const EXPORT_COLUMNS: ExportColumn[] = [
  // Patient (most are required for NHIS compliance)
  {
    key: 'patientName',
    label: 'Full Name',
    group: 'patient',
    required: true,
    getValue: (i) => i.patientName,
  },
  {
    key: 'emrNumber',
    label: 'Patient number',
    group: 'patient',
    required: true,
    getValue: (i) => i.emrNumber,
  },
  {
    key: 'nhisNumber',
    label: 'NHIS / Enrollee ID',
    group: 'patient',
    required: true,
    getValue: (i) => i.nhisNumber || '',
  },
  {
    key: 'dateOfBirth',
    label: 'Date of Birth',
    group: 'patient',
    getValue: (i) => formatDate(i.dateOfBirth),
  },
  {
    key: 'gender',
    label: 'Gender',
    group: 'patient',
    getValue: (i) => i.gender || '',
  },
  {
    key: 'phone',
    label: 'Phone Number',
    group: 'patient',
    getValue: (i) => i.phone || '',
  },
  {
    key: 'insuranceType',
    label: 'Insurance Type',
    group: 'patient',
    getValue: (i) => i.insuranceType,
  },
  {
    key: 'planType',
    label: 'Plan Type',
    group: 'patient',
    getValue: (i) => i.planType || '',
  },
  {
    key: 'payerName',
    label: 'HMO / Payer Name',
    group: 'patient',
    getValue: (i) => i.payerName || i.hmoName || '',
  },
  // Encounter (required)
  {
    key: 'encounterNumber',
    label: 'Encounter ID',
    group: 'encounter',
    required: true,
    getValue: (i) => i.encounterNumber || '',
  },
  {
    key: 'serviceDate',
    label: 'Date of Visit',
    group: 'encounter',
    required: true,
    getValue: (i) => formatDate(i.serviceDate),
  },
  {
    key: 'department',
    label: 'Department',
    group: 'encounter',
    getValue: (i) => i.department || i.categoryLabel,
  },
  // Service
  {
    key: 'category',
    label: 'Service Category',
    group: 'service',
    getValue: (i) => i.categoryLabel,
  },
  {
    key: 'serviceName',
    label: 'Service / Item Name',
    group: 'service',
    getValue: (i) => i.serviceName,
  },
  {
    key: 'quantity',
    label: 'Qty',
    group: 'service',
    getValue: (i) => String(i.quantity),
  },
  // Authorization
  {
    key: 'authorizationCode',
    label: 'Auth Code',
    group: 'authorization',
    required: true,
    getValue: (i) => i.authorizationCode || '',
  },
  {
    key: 'authorizationStatus',
    label: 'Auth Status',
    group: 'authorization',
    getValue: (i) => i.authorizationStatus,
  },
  // Financial
  {
    key: 'portionType',
    label: 'Portion Type (NHIA Classification)',
    group: 'financial',
    getValue: (i) => i.portionType,
  },
  {
    key: 'totalAmount',
    label: 'Total Cost',
    group: 'financial',
    required: true,
    getValue: (i) => formatCurrency(i.totalAmount),
  },
  {
    key: 'capAmount',
    label: 'CAP Amount',
    group: 'financial',
    getValue: (i) => formatCurrency(i.capAmount),
  },
  {
    key: 'ffsAmount',
    label: 'FFS Amount',
    group: 'financial',
    getValue: (i) => formatCurrency(i.ffsAmount),
  },
  {
    key: 'copayAmount',
    label: 'Co-payment',
    group: 'financial',
    getValue: (i) => formatCurrency(i.copayAmount),
  },
  {
    key: 'copayPercentage',
    label: 'Co-pay %',
    group: 'financial',
    getValue: (i) => `${i.copayPercentage}%`,
  },
  {
    key: 'netNhisPayable',
    label: 'Net NHIS Payable',
    group: 'financial',
    getValue: (i) => formatCurrency(i.netNhisPayable),
  },
  {
    key: 'privateAmount',
    label: 'Private / Out-of-Pocket',
    group: 'financial',
    getValue: (i) => formatCurrency(i.privateAmount),
  },
  {
    key: 'nhisAmount',
    label: 'NHIS Covered Amount',
    group: 'financial',
    getValue: (i) => formatCurrency(i.nhisAmount),
  },
  {
    key: 'patientAmount',
    label: 'Patient Payable',
    group: 'financial',
    getValue: (i) => formatCurrency(i.patientAmount),
  },
  {
    key: 'coveragePercentage',
    label: 'Coverage %',
    group: 'financial',
    getValue: (i) => `${i.coveragePercentage}%`,
  },
  // Billing
  {
    key: 'invoiceNumber',
    label: 'Invoice No',
    group: 'billing',
    getValue: (i) => i.invoiceNumber || '',
  },
  {
    key: 'receiptNumber',
    label: 'Receipt No',
    group: 'billing',
    getValue: (i) => i.receiptNumber || '',
  },
  {
    key: 'paymentStatus',
    label: 'Payment Status',
    group: 'billing',
    getValue: (i) => i.paymentStatus || '',
  },
  {
    key: 'claimStatus',
    label: 'Claim Status',
    group: 'billing',
    getValue: (i) => i.claimStatus,
  },
  // Clinical
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    group: 'clinical',
    getValue: (i) => i.diagnosis || '',
  },
  {
    key: 'icdCode',
    label: 'ICD-10 Code',
    group: 'clinical',
    getValue: (i) => i.icdCode || '',
  },
  {
    key: 'clinicianName',
    label: 'Clinician',
    group: 'clinical',
    getValue: (i) => i.clinicianName || '',
  },
  // Referral
  {
    key: 'isReferral',
    label: 'Is Referral',
    group: 'clinical',
    getValue: (i) => (i.isReferral ? 'Yes' : 'No'),
  },
  {
    key: 'referralType',
    label: 'Referral Type',
    group: 'clinical',
    getValue: (i) => i.referralType || '',
  },
  {
    key: 'referralFacility',
    label: 'Referring Facility',
    group: 'clinical',
    getValue: (i) => i.referralFacility || '',
  },
  // Audit
  {
    key: 'createdAt',
    label: 'Created At',
    group: 'audit',
    getValue: (i) => formatDate(i.createdAt),
  },
  {
    key: 'approvedBy',
    label: 'Approved By',
    group: 'audit',
    getValue: (i) => i.approvedBy || '',
  },
  {
    key: 'notes',
    label: 'Notes',
    group: 'audit',
    getValue: (i) => i.notes || '',
  },
];

const EXPORT_GROUPS = [
  { key: 'patient', label: 'Patient Details', icon: Users },
  { key: 'encounter', label: 'Encounter', icon: Calendar },
  { key: 'service', label: 'Service Details', icon: ClipboardList },
  { key: 'authorization', label: 'Authorization', icon: Shield },
  { key: 'financial', label: 'Financial / Portions', icon: Banknote },
  { key: 'billing', label: 'Billing / Claims', icon: Receipt },
  { key: 'clinical', label: 'Clinical', icon: Stethoscope },
  { key: 'audit', label: 'Audit Trail', icon: FileText },
] as const;

const INSURANCE_TYPE_OPTIONS = [
  { value: 'Personnel', label: 'Personnel (Military)' },
  { value: 'Civilian NHIS', label: 'Civilian NHIS' },
  { value: 'GIFSHIP', label: 'GIFSHIP' },
  { value: 'Private HMO', label: 'Private HMO' },
];

const CATEGORY_OPTIONS = [
  { value: 'lab', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'procedure', label: 'Procedures' },
  { value: 'specialty', label: 'Specialty' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'admission', label: 'Admission/Inpatient' },
];

const STATUS_OPTIONS = [
  { value: 'Verified', label: 'Verified' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Provisional', label: 'Provisional' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Rejected', label: 'Rejected' },
];

const PORTION_TYPE_OPTIONS = [
  { value: 'FFS_COVERED', label: 'FFS Covered (Standard 90/10)' },
  { value: 'FFS_PARTIAL_PRIVATE', label: 'FFS Partial + Private' },
  { value: 'PRIVATE_ONLY', label: 'Private Only (Out-of-pocket)' },
  { value: 'CAP_ONLY', label: 'CAP Only (Capitation)' },
];

const CLAIM_STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Under_Review', label: 'Under Review' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Paid', label: 'Paid' },
];

const COVERAGE_OPTIONS = [
  { value: 'Full', label: 'Full Coverage' },
  { value: 'Partial', label: 'Partial Coverage' },
  { value: 'Not Covered', label: 'Not Covered' },
];

// =============================================================================
// Claim Detail Modal (Enhanced with Payment Portions)
// =============================================================================

interface ClaimDetailModalProps {
  claim: NhisComprehensiveClaimItem;
  onClose: () => void;
}

function ClaimDetailModal({ claim, onClose }: ClaimDetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 py-4">
          <div className="flex items-center gap-4">
            
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">
                NHIS Claim Details
              </h3>
              <p className="text-green-100 text-sm">XenoCare</p>
            </div>
            <div className="text-right">
              <p className="text-white text-sm font-mono">
                {claim.encounterNumber || '---'}
              </p>
              <p className="text-green-100 text-xs">
                {formatDate(claim.serviceDate)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-2 p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Patient & Insurance Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Patient</p>
              <p className="font-semibold text-sm">{claim.patientName}</p>
              <p className="text-xs text-gray-500 font-mono">
                {claim.emrNumber}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">NHIS / Enrollee ID</p>
              <p className="font-mono text-sm font-medium">
                {claim.nhisNumber || '---'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Insurance Category</p>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getInsuranceTypeColor(claim.insuranceType)}`}
              >
                {claim.insuranceType}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Payer / HMO</p>
              <p className="font-medium text-sm">
                {claim.payerName || claim.hmoName || '---'}
              </p>
            </div>
          </div>

          {/* Patient Demographics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Date of Birth</p>
              <p className="text-sm">{formatDate(claim.dateOfBirth)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Gender</p>
              <p className="text-sm">{claim.gender || '---'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Phone</p>
              <p className="text-sm">{claim.phone || '---'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Plan Type</p>
              <p className="text-sm">{claim.planType || '---'}</p>
            </div>
          </div>

          {/* Service Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">
                Department / Category
              </p>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(claim.category)}`}
              >
                {getCategoryIcon(claim.category)}
                {claim.categoryLabel || getCategoryLabel(claim.category)}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 col-span-2">
              <p className="text-xs text-gray-500 mb-1">Service / Item</p>
              <p className="font-medium">{claim.serviceName}</p>
              {claim.serviceDescription && (
                <p className="text-sm text-gray-500">
                  {claim.serviceDescription}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Qty: {claim.quantity}
              </p>
            </div>
          </div>

          {/* Clinical / Diagnosis Row */}
          {claim.diagnosis && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <p className="text-xs text-gray-500 mb-1">Diagnosis</p>
              <p className="text-sm font-medium text-blue-800">
                {claim.diagnosis}
              </p>
              {claim.icdCode && (
                <p className="text-xs text-blue-600 mt-0.5">
                  ICD-10: {claim.icdCode}
                </p>
              )}
            </div>
          )}

          {/* Authorization Row */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className={`rounded-lg p-3 ${claim.hasAuthCode ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}
            >
              <p className="text-xs text-gray-500 mb-1">Authorization Code</p>
              {claim.hasAuthCode ? (
                <p className="font-mono font-bold text-green-700">
                  {claim.authorizationCode}
                </p>
              ) : (
                <p className="text-amber-600 text-sm">Not provided</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Authorization Status</p>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  claim.authorizationStatus === 'Verified'
                    ? 'bg-green-100 text-green-700'
                    : claim.authorizationStatus === 'Approved'
                      ? 'bg-blue-100 text-blue-700'
                      : claim.authorizationStatus === 'Provisional'
                        ? 'bg-amber-100 text-amber-700'
                        : claim.authorizationStatus === 'Pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                }`}
              >
                {claim.authorizationStatus}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Coverage Type</p>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  claim.coverageType === 'Full'
                    ? 'bg-green-100 text-green-700'
                    : claim.coverageType === 'Partial'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {claim.coverageType}
              </span>
            </div>
          </div>

          {/* Referral Row */}
          {claim.isReferral && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <p className="text-xs text-gray-500 mb-1">Referral Type</p>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    claim.referralType === 'External'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {claim.referralType}
                </span>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <p className="text-xs text-gray-500 mb-1">Referring Facility</p>
                <p className="font-medium text-sm">
                  {claim.referralFacility || '—'}
                </p>
              </div>
            </div>
          )}

          {/* Payment Portion Breakdown (NHIA Standard Classification) */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-700">
                Payment Portion Breakdown (NHIA)
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getPortionBadge(claim.portionType)}`}
              >
                {claim.portionType.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 text-center">
                <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">
                  CAP (Capitation)
                </p>
                <p className="text-lg font-bold text-blue-700 mt-1">
                  {formatCurrency(claim.capAmount)}
                </p>
                <p className="text-[10px] text-blue-400">Prepaid monthly</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 text-center">
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">
                  FFS (Fee For Service)
                </p>
                <p className="text-lg font-bold text-emerald-700 mt-1">
                  {formatCurrency(claim.ffsAmount)}
                </p>
                <p className="text-[10px] text-emerald-400">
                  NHIS pays per service
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-100 text-center">
                <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wider">
                  Private / OOP
                </p>
                <p className="text-lg font-bold text-orange-700 mt-1">
                  {formatCurrency(claim.privateAmount)}
                </p>
                <p className="text-[10px] text-orange-400">
                  Patient out-of-pocket
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 text-center">
                <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider">
                  Co-payment ({claim.copayPercentage}%)
                </p>
                <p className="text-lg font-bold text-purple-700 mt-1">
                  {formatCurrency(claim.copayAmount)}
                </p>
                <p className="text-[10px] text-purple-400">
                  Mandatory patient share
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded p-2 border text-center">
                <p className="text-xs text-gray-500">Total Service Cost</p>
                <p className="font-bold">{formatCurrency(claim.totalAmount)}</p>
              </div>
              <div className="bg-green-50 rounded p-2 border border-green-200 text-center">
                <p className="text-xs text-green-600">Net NHIS Payable</p>
                <p className="font-bold text-green-700">
                  {formatCurrency(claim.netNhisPayable)}
                </p>
              </div>
              <div className="bg-orange-50 rounded p-2 border border-orange-200 text-center">
                <p className="text-xs text-orange-600">Total Patient Pays</p>
                <p className="font-bold text-orange-700">
                  {formatCurrency(claim.copayAmount + claim.privateAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Claim Workflow Status */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
            <span className="text-xs text-gray-500">Claim Status:</span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${getClaimStatusStyle(claim.claimStatus)}`}
            >
              {claim.claimStatus.replace('_', ' ')}
            </span>
          </div>

          {/* Invoice / Payment Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Invoice No</p>
              <p className="font-mono text-sm">{claim.invoiceNumber || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Receipt No</p>
              <p className="font-mono text-sm">{claim.receiptNumber || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Payment Status</p>
              {claim.paymentStatus ? (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    claim.paymentStatus === 'Paid'
                      ? 'bg-green-100 text-green-700'
                      : claim.paymentStatus === 'Pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : claim.paymentStatus === 'Reversed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {claim.paymentStatus}
                </span>
              ) : (
                <span className="text-gray-400 text-sm">—</span>
              )}
            </div>
          </div>

          {/* Notes */}
          {claim.notes && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-xs text-gray-500 mb-1">Notes / Exceptions</p>
              <p className="text-sm">{claim.notes}</p>
            </div>
          )}

          {/* Approval Info */}
          {claim.approvedBy && (
            <div className="text-xs text-gray-500 text-right">
              Approved by {claim.approvedBy}{' '}
              {claim.approvedAt && `on ${formatDate(claim.approvedAt)}`}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Summary Card
function SummaryCard({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">{icon}</div>
        <div>
          <p className="text-xs font-medium text-white/80">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
          {subValue && <p className="text-xs text-white/70">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

// Collapsible Filter Section
function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0 py-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-green-700 mb-2"
      >
        {title}
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen && (
        <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

// Checkbox Item
function CheckboxItem({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4 ml-1"
      />
      <span className="text-sm text-gray-600 flex-1 truncate" title={label}>
        {label}
      </span>
      {count !== undefined && (
        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </label>
  );
}

export function NhisClaimsList() {
  const { showToast } = useToast();

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    hmoIds: [],
    schemes: [],
    statuses: [],
    coverageTypes: [],
    portionTypes: [],
    claimStatuses: [],
    dateRangeType: 'created',
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hmoOptions, setHmoOptions] = useState<
    { name: string; display_name: string }[]
  >([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClaim, setSelectedClaim] =
    useState<NhisComprehensiveClaimItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const itemsPerPage = 15;

  // Export Column Selector state
  const [isExportSelectorOpen, setIsExportSelectorOpen] = useState(false);
  // Category Report Export Modal state
  const [isCategoryExportOpen, setIsCategoryExportOpen] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState<
    Set<string>
  >(() => {
    // Default: all required + common fields
    const defaults = new Set<string>();
    EXPORT_COLUMNS.forEach((col) => {
      if (col.required) defaults.add(col.key);
    });
    // Add common useful fields by default
    [
      'dateOfBirth',
      'gender',
      'insuranceType',
      'payerName',
      'department',
      'category',
      'serviceName',
      'authorizationStatus',
      'portionType',
      'totalAmount',
      'ffsAmount',
      'copayAmount',
      'netNhisPayable',
      'privateAmount',
      'invoiceNumber',
      'claimStatus',
      'diagnosis',
    ].forEach((k) => defaults.add(k));
    return defaults;
  });

  // Load HMO options
  useEffect(() => {
    getPayerSchemes()
      .then((data) => setHmoOptions(data))
      .catch(console.error);
  }, []);

  const {
    data: claimsData,
    isLoading,
    refetch,
  } = useNhisComprehensiveClaims({
    startDate: filters.startDate,
    endDate: filters.endDate,
    // Note: We mostly filter on client side for the complex fields,
    // but pass basic dates to API to limit payload size
  });

  // Filter items logic
  const filteredItems = useMemo(() => {
    if (!claimsData?.allItems) return [];

    return claimsData.allItems.filter((item) => {
      // 1. Text Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches =
          item.patientName.toLowerCase().includes(query) ||
          item.emrNumber.toLowerCase().includes(query) ||
          item.serviceName.toLowerCase().includes(query) ||
          item.authorizationCode?.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // 2. Insurance Type
      if (filters.insuranceType && item.insuranceType !== filters.insuranceType)
        return false;

      // 3. Category
      if (filters.category && item.category !== filters.category) return false;

      // 4. Auth Code Status
      if (filters.hasAuthCode !== undefined) {
        if (filters.hasAuthCode && !item.hasAuthCode) return false;
        if (!filters.hasAuthCode && item.hasAuthCode) return false;
      }

      // 5. HMO / Payer (Check against both HMO name and Payer name)
      if (filters.hmoIds.length > 0) {
        // HMO filter logic: check if item's payerName or hmoName matches any selected HMO
        // We use string list of HMO names as IDs here since DB hmo_id might be sparse
        const itemPayer = item.payerName || item.hmoName;
        if (!itemPayer || !filters.hmoIds.includes(itemPayer)) return false;
      }

      // 6. Schemes
      if (filters.schemes.length > 0) {
        // Not implemented separately as Scheme often maps to InsuranceType or Payer
        // Keeping placeholder if needed later
      }

      // 7. Statuses (Authorization Status)
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(item.authorizationStatus)) return false;
      }

      // 8. Coverage Types
      if (filters.coverageTypes.length > 0) {
        if (!filters.coverageTypes.includes(item.coverageType)) return false;
      }

      // 9. Portion Types (CAP/FFS/Private/Mixed)
      if (filters.portionTypes.length > 0) {
        if (!filters.portionTypes.includes(item.portionType)) return false;
      }

      // 10. Claim Statuses
      if (filters.claimStatuses.length > 0) {
        if (!filters.claimStatuses.includes(item.claimStatus)) return false;
      }

      // 11. Date Range (Service Date vs Created Date)
      // Note: Created Date is handled by API query (startDate/endDate)
      // If user wants to filter by Encounter/Service Date specifically within the fetched range:
      if (
        filters.dateRangeType === 'service' &&
        filters.startDate &&
        filters.endDate
      ) {
        const itemDate = new Date(item.serviceDate);
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate < start || itemDate > end) return false;
      }

      return true;
    });
  }, [claimsData?.allItems, searchQuery, filters]);

  // Pagination
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  // Calculate stats for current filter view
  const activeStats = useMemo(() => {
    return {
      totalAmount: filteredItems.reduce(
        (sum, item) => sum + item.totalAmount,
        0,
      ),
      totalNhis: filteredItems.reduce((sum, item) => sum + item.nhisAmount, 0),
      totalPatient: filteredItems.reduce(
        (sum, item) => sum + item.patientAmount,
        0,
      ),
      totalCap: filteredItems.reduce((sum, item) => sum + item.capAmount, 0),
      totalFfs: filteredItems.reduce((sum, item) => sum + item.ffsAmount, 0),
      totalPrivate: filteredItems.reduce(
        (sum, item) => sum + item.privateAmount,
        0,
      ),
      totalCopay: filteredItems.reduce(
        (sum, item) => sum + item.copayAmount,
        0,
      ),
      totalNetNhis: filteredItems.reduce(
        (sum, item) => sum + item.netNhisPayable,
        0,
      ),
      count: filteredItems.length,
    };
  }, [filteredItems]);

  // Derived stats for Charts (Dynamic based on filters)
  const chartData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    const statusMap = new Map<string, number>();

    filteredItems.forEach((item) => {
      // Category Sum
      const currentCat = categoryMap.get(item.category) || 0;
      categoryMap.set(item.category, currentCat + item.nhisAmount);

      // Status Count
      const currentStatus = statusMap.get(item.authorizationStatus) || 0;
      statusMap.set(item.authorizationStatus, currentStatus + 1);
    });

    const categoryData = Array.from(categoryMap.entries())
      .map(([key, value]) => ({
        name: key,
        // Format Key for display
        label: key === 'Drugs' ? 'Pharmacy' : key,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    // Color palette for charts
    const COLORS = [
      '#16a34a',
      '#2563eb',
      '#d97706',
      '#9333ea',
      '#db2777',
      '#0891b2',
    ];

    return { categoryData, COLORS };
  }, [filteredItems]);

  // Handle Filter Changes Helpers
  const toggleFilter = (field: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const current = prev[field] as string[];
      const updated = current.includes(value)
        ? current.filter((i) => i !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      hmoIds: [],
      schemes: [],
      statuses: [],
      coverageTypes: [],
      portionTypes: [],
      claimStatuses: [],
      dateRangeType: 'created',
      startDate: undefined,
      endDate: undefined,
      insuranceType: undefined,
      category: undefined,
      hasAuthCode: undefined,
    });
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Export PDF handler
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const handleExportPdf = async (
    format: 'standard' | 'patient_breakdown' = 'standard',
  ) => {
    if (!claimsData) return;

    setIsExporting(true);
    setIsExportMenuOpen(false);
    try {
      // Create a filtered summary object
      const filteredSummary = {
        ...claimsData,
        allItems: filteredItems, // Use only filtered items
        totalItems: filteredItems.length,
        totalAmount: activeStats.totalAmount,
        totalNhisCovered: activeStats.totalNhis,
        totalPatientPortion: activeStats.totalPatient,
        // Recalculate other stats if strictly needed, but PDF mostly uses allItems list
      };

      await downloadComprehensiveNhisClaimsPdf(filteredSummary, {
        facilityName: 'XenoCare',
        facilityAddress: 'XenoCare',
        generatedBy: 'System',
        reportPeriod:
          filters.startDate && filters.endDate
            ? {
                start: filters.startDate,
                end: filters.endDate,
              }
            : undefined,
        filters: {
          insuranceType: filters.insuranceType,
          category: filters.category,
          hasAuthCode: filters.hasAuthCode,
        },
        format,
      });
      showToast({
        type: 'success',
        message: `Exported ${filteredItems.length} filtered claims`,
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      showToast({ type: 'error', message: 'Failed to export report' });
    } finally {
      setIsExporting(false);
    }
  };

  // CSV Export with selected columns
  const handleExportCsv = useCallback(() => {
    if (!filteredItems.length) return;

    // Build selected columns in definition order
    const sortedCols = EXPORT_COLUMNS.filter((c) =>
      selectedExportColumns.has(c.key),
    );

    // CSV header row
    const headerRow = sortedCols
      .map((c) => `"${c.label.replace(/"/g, '""')}"`)
      .join(',');

    // Helper to extract field value from a claim item
    const extractValue = (
      item: NhisComprehensiveClaimItem,
      col: ExportColumn,
    ): string => {
      const raw = col.getValue(item);
      if (raw === null || raw === undefined) return '';
      if (typeof raw === 'number') return String(raw);
      return String(raw);
    };

    const dataRows = filteredItems.map((item) =>
      sortedCols
        .map((col) => {
          const val = extractValue(item, col);
          // Escape for CSV
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(','),
    );

    const csvContent = [headerRow, ...dataRows].join('\n');
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel
    const blob = new Blob([BOM + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NHIS_Claims_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportSelectorOpen(false);
    showToast({
      type: 'success',
      message: `Exported ${filteredItems.length} records with ${sortedCols.length} columns`,
    });
  }, [filteredItems, selectedExportColumns]);

  // Toggle individual export column
  const toggleExportColumn = useCallback((colId: string) => {
    // Don't allow toggling required columns
    const col = EXPORT_COLUMNS.find((c) => c.key === colId);
    if (col?.required) return;
    setSelectedExportColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }, []);

  // Toggle entire group
  const toggleExportGroup = useCallback(
    (groupId: string) => {
      const groupCols = EXPORT_COLUMNS.filter((c) => c.group === groupId);
      const allSelected = groupCols.every((c) =>
        selectedExportColumns.has(c.key),
      );
      setSelectedExportColumns((prev) => {
        const next = new Set(prev);
        groupCols.forEach((c) => {
          if (c.required) return; // always keep required
          if (allSelected) next.delete(c.key);
          else next.add(c.key);
        });
        return next;
      });
    },
    [selectedExportColumns],
  );

  return (
    <div className="relative h-[calc(100vh-100px)] flex flex-col bg-slate-50 overflow-hidden rounded-xl border border-slate-200">
      {/* Backdrop for mobile / focus mode */}
      {isSidebarOpen && (
        <div
          className="absolute inset-0 bg-black/20 z-30 backdrop-blur-[1px] transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Slide-over Filter Panel */}
      <div
        className={`absolute top-0 left-0 bottom-0 w-80 bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Filter size={18} className="text-green-600" />
            Advanced Filters
          </h3>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 hover:bg-slate-100 rounded-full text-slate-500"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Header with Reset */}
          <div className="flex justify-end">
            <button
              onClick={clearFilters}
              className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
            >
              <XCircle size={12} /> Reset All
            </button>
          </div>

          {/* Date Logic */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Timeframe
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() =>
                  setFilters((prev) => ({ ...prev, dateRangeType: 'created' }))
                }
                className={`text-xs py-1.5 px-2 rounded border ${filters.dateRangeType === 'created' ? 'bg-green-100 border-green-200 text-green-800 font-medium' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                Date Created
              </button>
              <button
                onClick={() =>
                  setFilters((prev) => ({ ...prev, dateRangeType: 'service' }))
                }
                className={`text-xs py-1.5 px-2 rounded border ${filters.dateRangeType === 'service' ? 'bg-green-100 border-green-200 text-green-800 font-medium' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                Encounter Date
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-8">From</span>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      startDate: e.target.value || undefined,
                    }))
                  }
                  className="flex-1 text-xs border-slate-300 rounded focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-8">To</span>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      endDate: e.target.value || undefined,
                    }))
                  }
                  className="flex-1 text-xs border-slate-300 rounded focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
          </div>

          {/* HMO Filter */}
          <FilterSection title="HMO & Payers" defaultOpen>
            <div className="max-h-48 overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
              {hmoOptions.length === 0 ? (
                <div className="text-xs text-slate-400 italic p-1">
                  Loading Payers...
                </div>
              ) : (
                hmoOptions.map((hmo) => (
                  <CheckboxItem
                    key={hmo.name}
                    label={hmo.display_name}
                    checked={filters.hmoIds.includes(hmo.name)}
                    onChange={() => toggleFilter('hmoIds', hmo.name)}
                  />
                ))
              )}
            </div>
          </FilterSection>

          {/* Auth Status */}
          <FilterSection title="Auth Status">
            {STATUS_OPTIONS.map((opt) => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.statuses.includes(opt.value)}
                onChange={() => toggleFilter('statuses', opt.value)}
              />
            ))}
          </FilterSection>

          {/* Service Category */}
          <FilterSection title="Department / Category">
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      category:
                        prev.category === opt.value ? undefined : opt.value,
                    }));
                    setCurrentPage(1);
                  }}
                  className={`text-xs py-2 px-2 rounded-lg border text-left transition-colors ${
                    filters.category === opt.value
                      ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-105'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-green-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* Insurance Type */}
          <FilterSection title="Insurance Type">
            {INSURANCE_TYPE_OPTIONS.map((opt) => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.insuranceType === opt.value}
                onChange={() =>
                  setFilters((prev) => ({
                    ...prev,
                    insuranceType:
                      prev.insuranceType === opt.value ? undefined : opt.value,
                  }))
                }
              />
            ))}
          </FilterSection>

          {/* Payment Portion Type */}
          <FilterSection title="Payment Portion" defaultOpen={false}>
            {PORTION_TYPE_OPTIONS.map((opt) => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.portionTypes.includes(opt.value)}
                onChange={() => toggleFilter('portionTypes', opt.value)}
              />
            ))}
          </FilterSection>

          {/* Claim Workflow Status */}
          <FilterSection title="Claim Status" defaultOpen={false}>
            {CLAIM_STATUS_OPTIONS.map((opt) => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.claimStatuses.includes(opt.value)}
                onChange={() => toggleFilter('claimStatuses', opt.value)}
              />
            ))}
          </FilterSection>

          {/* Coverage Type */}
          <FilterSection title="Coverage Type" defaultOpen={false}>
            {COVERAGE_OPTIONS.map((opt) => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.coverageTypes.includes(opt.value)}
                onChange={() => toggleFilter('coverageTypes', opt.value)}
              />
            ))}
          </FilterSection>
        </div>

        {/* Bottom Action */}
        <div className="p-4 border-t bg-slate-50">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium shadow hover:bg-green-700 transition-colors"
          >
            Apply Filters ({filteredItems.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-slate-200 py-3 px-6 shadow-sm z-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors border border-slate-200"
            >
              <Filter size={16} />
              <span className="hidden sm:inline">Filters</span>
              {(filters.hmoIds.length > 0 ||
                filters.category ||
                filters.statuses.length > 0) && (
                <span className="bg-green-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  !
                </span>
              )}
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                NHIS Claim Manager
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{filteredItems.length} records found</span>
                {(filters.startDate || filters.endDate) && (
                  <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100">
                    {filters.startDate || 'Beginning'} —{' '}
                    {filters.endDate || 'Now'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Text Search - Always visible */}
            <div className="relative w-64 hidden md:block">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search patient, code..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
              />
            </div>

            <div className="h-8 w-px bg-slate-200 mx-1" />

            <button
              onClick={() => refetch()}
              className="p-2 text-slate-500 hover:bg-slate-100 hover:text-green-600 rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={18} />
            </button>
            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={isExporting || !claimsData}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-md font-medium disabled:opacity-50 transition-colors text-sm"
              >
                {isExporting ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <Download size={16} />
                )}
                Export Report
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsExportSelectorOpen(true);
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-700 flex flex-col gap-0.5"
                    >
                      <span className="font-medium flex items-center gap-1.5">
                        <Columns size={13} />
                        Custom Export (CSV)
                      </span>
                      <span className="text-xs text-slate-400">
                        Select columns & download CSV
                      </span>
                    </button>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      onClick={() => {
                        setIsCategoryExportOpen(true);
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-700 flex flex-col gap-0.5"
                    >
                      <span className="font-medium flex items-center gap-1.5">
                        <ListFilter size={13} />
                        Category Reports (PDF/Excel/CSV)
                      </span>
                      <span className="text-xs text-slate-400">
                        Detailed breakdowns per billing category
                      </span>
                    </button>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      onClick={() => handleExportPdf('standard')}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-700 flex flex-col gap-0.5"
                    >
                      <span className="font-medium">
                        PDF — Standard Summary
                      </span>
                      <span className="text-xs text-slate-400">
                        Claims grouped by auth status
                      </span>
                    </button>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      onClick={() => handleExportPdf('patient_breakdown')}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-700 flex flex-col gap-0.5"
                    >
                      <span className="font-medium">
                        PDF — Patient Breakdown
                      </span>
                      <span className="text-xs text-slate-400">
                        Detailed list per patient
                      </span>
                    </button>
                  </div>
                </div>
              )}
              {/* click outside handler would be ideal but this suffices for now */}
              {isExportMenuOpen && (
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setIsExportMenuOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* High Level Stats Grid — NHIS Payment Portions */}
            {claimsData && (
              <>
                {/* Row 1: Grand totals */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-14 h-14 bg-blue-50 rounded-bl-full -mr-2 -mt-2 opacity-50" />
                    <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                      Total Claim Value
                    </p>
                    <h2 className="text-lg font-bold text-slate-800 mt-0.5">
                      {formatCurrency(activeStats.totalAmount)}
                    </h2>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-blue-600 bg-blue-50 w-fit px-1.5 py-0.5 rounded">
                      <TrendingUp size={10} />
                      {activeStats.count} records
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-14 h-14 bg-green-50 rounded-bl-full -mr-2 -mt-2 opacity-50" />
                    <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                      Net NHIS Payable
                    </p>
                    <h2 className="text-lg font-bold text-green-700 mt-0.5">
                      {formatCurrency(activeStats.totalNetNhis)}
                    </h2>
                    <div className="mt-1 text-[11px] text-green-600">
                      FFS minus co-pay
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-14 h-14 bg-orange-50 rounded-bl-full -mr-2 -mt-2 opacity-50" />
                    <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                      Total Patient Pays
                    </p>
                    <h2 className="text-lg font-bold text-orange-600 mt-0.5">
                      {formatCurrency(
                        activeStats.totalCopay + activeStats.totalPrivate,
                      )}
                    </h2>
                    <div className="mt-1 text-[11px] text-orange-500">
                      Co-pay + Private
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-14 h-14 bg-amber-50 rounded-bl-full -mr-2 -mt-2 opacity-50" />
                    <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                      Pending Auth
                    </p>
                    <h2 className="text-lg font-bold text-amber-600 mt-0.5">
                      {claimsData.totalPendingNhis > 0
                        ? formatCurrency(claimsData.totalPendingNhis)
                        : '—'}
                    </h2>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-600">
                      <AlertTriangle size={10} />
                      Requires Action
                    </div>
                  </div>
                </div>
                {/* Row 2: Payment Portion Breakdown */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-blue-600 text-[11px] font-bold uppercase tracking-wider">
                        CAP (Capitation)
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">
                        Prepaid
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-blue-800 mt-1">
                      {formatCurrency(activeStats.totalCap)}
                    </h2>
                    <p className="text-[10px] text-blue-500 mt-0.5">
                      Consultation + basic drugs (tracked, not billed)
                    </p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-emerald-600 text-[11px] font-bold uppercase tracking-wider">
                        FFS (Fee For Service)
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 font-medium">
                        Billable
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-emerald-800 mt-1">
                      {formatCurrency(activeStats.totalFfs)}
                    </h2>
                    <p className="text-[10px] text-emerald-500 mt-0.5">
                      Lab, imaging, procedures, specialty
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-purple-600 text-[11px] font-bold uppercase tracking-wider">
                        Co-payment
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">
                        10%
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-purple-800 mt-1">
                      {formatCurrency(activeStats.totalCopay)}
                    </h2>
                    <p className="text-[10px] text-purple-500 mt-0.5">
                      Mandatory patient share on FFS items
                    </p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-orange-600 text-[11px] font-bold uppercase tracking-wider">
                        Private / OOP
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">
                        Patient
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-orange-800 mt-1">
                      {formatCurrency(activeStats.totalPrivate)}
                    </h2>
                    <p className="text-[10px] text-orange-500 mt-0.5">
                      Non-covered items, non-formulary
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Visual Analytics Section */}
            {filteredItems.length > 0 && chartData.categoryData.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-slate-500" />
                  Revenue Distribution by Department
                </h3>
                <div className="h-64 w-full p-4 flex items-end gap-3 border-b border-l border-slate-200 bg-white">
                  {chartData.categoryData.map((entry, index) => {
                    const maxValue = Math.max(
                      ...chartData.categoryData.map((d) => d.value),
                      1,
                    );
                    // Calculate percentage but ensure at least 4% visibility if value > 0
                    const rawPercent = (entry.value / maxValue) * 100;
                    const heightPercent =
                      entry.value > 0 ? Math.max(rawPercent, 4) : 0;

                    // Use hex codes directly to bypass Tailwind class generation issues
                    const barColor =
                      chartData.COLORS[index % chartData.COLORS.length] ||
                      '#3b82f6';

                    return (
                      <div
                        key={entry.name}
                        className="flex-1 flex flex-col justify-end items-center group relative h-full"
                      >
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-[calc(100%+5px)] mb-2 bg-slate-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-20 transition-opacity pointer-events-none shadow-lg">
                          <span className="font-bold capitalize">
                            {entry.label}
                          </span>
                          : {formatCurrency(entry.value)}
                        </div>

                        {/* Bar Container - align bottom */}
                        <div className="w-full h-full flex items-end justify-center relative">
                          {/* The Bar Itself */}
                          <div
                            className="w-full rounded-t-md hover:opacity-90 transition-all duration-500 relative shadow-sm border-t border-x border-white/20"
                            style={{
                              height: `${heightPercent}%`,
                              backgroundColor: barColor,
                              minHeight: entry.value > 0 ? '4px' : '0',
                            }}
                          >
                            {/* Glass highlight effect */}
                            <div className="absolute top-0 inset-x-0 h-[20%] bg-white/10 rounded-t-md" />
                          </div>
                        </div>

                        {/* Label */}
                        <span
                          className="text-xs text-slate-500 mt-2 font-medium truncate w-full text-center capitalize"
                          title={entry.label}
                        >
                          {entry.label}
                        </span>
                      </div>
                    );
                  })}
                  {chartData.categoryData.length === 0 && (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm italic">
                      No category data available to display
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Claims Table (Enhanced) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1">
              {/* Table content from previous implementation but wrapped cleanly */}
              {isLoading ? (
                <SkeletonTable rows={6} columns={5} />
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <FileText size={24} className="opacity-40" />
                  </div>
                  <p className="font-medium text-lg text-slate-800">
                    No claims match your filters
                  </p>
                  <p className="text-sm mt-1">
                    Try adjusting the sidebar filters or search terms
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider">
                            Patient Info
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider">
                            Payer / Scheme
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider">
                            Service
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider">
                            Portion
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider">
                            Net NHIS
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap text-xs uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedItems.map((item, idx) => (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50 transition-colors group"
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                              <div className="font-medium text-slate-700">
                                {formatDate(item.serviceDate)}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {(currentPage - 1) * itemsPerPage + idx + 1}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800 text-sm">
                                {item.patientName}
                              </p>
                              <p className="text-xs text-slate-500 font-mono">
                                {item.emrNumber} • {item.insuranceType}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <div
                                className="font-medium text-slate-700 max-w-[140px] truncate"
                                title={
                                  (item.payerName || item.hmoName) ?? undefined
                                }
                              >
                                {item.payerName || item.hmoName || '—'}
                              </div>
                              {item.hasAuthCode && (
                                <span className="inline-block mt-1 font-mono text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100">
                                  {item.authorizationCode}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`w-2 h-2 rounded-full ${getCategoryColorDot(item.category)}`}
                                />
                                <span className="text-xs font-medium text-slate-600">
                                  {item.categoryLabel}
                                </span>
                              </div>
                              <p
                                className="text-xs text-slate-500 truncate max-w-[160px]"
                                title={item.serviceName}
                              >
                                {item.serviceName}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700 text-sm">
                              {formatCurrency(item.totalAmount)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPortionBadge(item.portionType)}`}
                              >
                                {PORTION_TYPE_SHORT_LABELS[item.portionType] ||
                                  item.portionType}
                              </span>
                              {item.copayAmount > 0 && (
                                <div className="text-[10px] text-purple-500 mt-0.5">
                                  Co-pay: {formatCurrency(item.copayAmount)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="font-bold text-sm text-green-700">
                                {formatCurrency(item.netNhisPayable)}
                              </div>
                              {item.patientAmount > 0 && (
                                <div className="text-xs text-orange-400">
                                  Pat: {formatCurrency(item.patientAmount)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  item.authorizationStatus === 'Verified'
                                    ? 'bg-green-100 text-green-700'
                                    : item.authorizationStatus === 'Approved'
                                      ? 'bg-blue-100 text-blue-700'
                                      : item.authorizationStatus === 'Pending'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {item.authorizationStatus === 'Verified' ? (
                                  <CheckCircle size={10} />
                                ) : null}
                                {item.authorizationStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSelectedClaim(item)}
                                className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination footer */}
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Page {currentPage} of {totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage <= 1}
                          className="p-1.5 border border-slate-300 rounded hover:bg-white disabled:opacity-50 text-slate-600"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage >= totalPages}
                          className="p-1.5 border border-slate-300 rounded hover:bg-white disabled:opacity-50 text-slate-600"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
        />
      )}

      {/* Category Report Export Modal */}
      {claimsData && (
        <NhisClaimsExportModal
          isOpen={isCategoryExportOpen}
          onClose={() => setIsCategoryExportOpen(false)}
          claimsData={{
            ...claimsData,
            allItems: filteredItems,
            totalItems: filteredItems.length,
            totalAmount: activeStats.totalAmount,
            totalNhisCovered: activeStats.totalNhis,
            totalPatientPortion: activeStats.totalPatient,
          }}
          filterDescription={
            [
              filters.insuranceType,
              filters.category && `Category: ${filters.category}`,
              filters.startDate && `From: ${filters.startDate}`,
              filters.endDate && `To: ${filters.endDate}`,
            ]
              .filter(Boolean)
              .join(' | ') || undefined
          }
          reportPeriod={
            filters.startDate && filters.endDate
              ? { start: filters.startDate, end: filters.endDate }
              : undefined
          }
          onToast={showToast}
        />
      )}

      {/* Export Column Selector Modal */}
      {isExportSelectorOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsExportSelectorOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[780px] max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Columns size={20} className="text-green-600" />
                  Export Column Selector
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select which fields to include in your CSV export. Required
                  fields (marked with *) cannot be deselected.
                </p>
              </div>
              <button
                onClick={() => setIsExportSelectorOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {/* Column Groups */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {EXPORT_GROUPS.map((group) => {
                const groupCols = EXPORT_COLUMNS.filter(
                  (c) => c.group === group.key,
                );
                const selectedCount = groupCols.filter((c) =>
                  selectedExportColumns.has(c.key),
                ).length;
                const allSelected = selectedCount === groupCols.length;
                const noneSelected = selectedCount === 0;

                return (
                  <div
                    key={group.key}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    {/* Group Header */}
                    <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExportGroup(group.key)}
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] transition-colors ${
                            allSelected
                              ? 'bg-green-600 border-green-600 text-white'
                              : !noneSelected
                                ? 'bg-green-100 border-green-300 text-green-600'
                                : 'border-slate-300 text-transparent hover:border-green-400'
                          }`}
                        >
                          {allSelected ? '✓' : !noneSelected ? '–' : ''}
                        </button>
                        <span className="font-semibold text-sm text-slate-700">
                          {group.label}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {selectedCount}/{groupCols.length}
                        </span>
                      </div>
                    </div>
                    {/* Group Columns */}
                    <div className="p-3 grid grid-cols-2 gap-2">
                      {groupCols.map((col) => {
                        const isSelected = selectedExportColumns.has(col.key);
                        return (
                          <label
                            key={col.key}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                              col.required
                                ? 'bg-green-50 border border-green-100'
                                : isSelected
                                  ? 'bg-blue-50 hover:bg-blue-100'
                                  : 'hover:bg-slate-50'
                            } ${col.required ? 'cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleExportColumn(col.key)}
                              disabled={col.required}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-green-600 focus:ring-green-500 disabled:opacity-60"
                            />
                            <span
                              className={`text-xs ${col.required ? 'font-semibold text-green-700' : isSelected ? 'text-blue-700 font-medium' : 'text-slate-600'}`}
                            >
                              {col.label}
                              {col.required ? ' *' : ''}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50 rounded-b-2xl">
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  {selectedExportColumns.size}
                </span>{' '}
                of {EXPORT_COLUMNS.length} columns selected
                {' • '}
                <span className="font-semibold text-slate-700">
                  {filteredItems.length}
                </span>{' '}
                records to export
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsExportSelectorOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportCsv}
                  disabled={
                    selectedExportColumns.size === 0 ||
                    filteredItems.length === 0
                  }
                  className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow font-medium disabled:opacity-50 transition-colors text-sm"
                >
                  <Download size={15} />
                  Export CSV ({filteredItems.length} records)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers ---------------------------------------------------------------------

function getCategoryColorDot(category: string) {
  switch (category) {
    case 'Pharmacy':
      return 'bg-green-500';
    case 'Laboratory':
      return 'bg-blue-500';
    case 'Radiology':
      return 'bg-purple-500';
    case 'Procedure':
      return 'bg-orange-500';
    default:
      return 'bg-slate-400';
  }
}

export default NhisClaimsList;
