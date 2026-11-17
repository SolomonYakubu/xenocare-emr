/**
 * Records History Module - Type Definitions
 * XENOCARE EMR
 *
 * Unified record types for cross-module history browsing and export.
 */

// ---------------------------------------------------------------------------
// Record categories mirroring clinical modules
// ---------------------------------------------------------------------------

import {
  isDentalEnabled,
  isNhisFeatureEnabled,
  isOphthalmologyEnabled,
  isPhysiotherapyEnabled,
  isSpecialtyClinicsEnabled,
} from '../../../config/features';

export type RecordCategory =
  | 'encounter'
  | 'consultation'
  | 'specialty'
  | 'lab'
  | 'radiology'
  | 'pharmacy'
  | 'physiotherapy'
  | 'nursing'
  | 'procedure'
  | 'dental'
  | 'ophthalmology'
  | 'anc'
  | 'admission'
  | 'billing'
  | 'nhis_claim';

export interface RecordCategoryMeta {
  key: RecordCategory;
  label: string;
  color: string; // Tailwind bg-* class
}

const ALL_RECORD_CATEGORIES: RecordCategoryMeta[] = [
  { key: 'encounter', label: 'Visits', color: 'bg-emerald-500' },
  { key: 'consultation', label: 'Consultations', color: 'bg-green-500' },
  { key: 'specialty', label: 'Specialty Clinics', color: 'bg-violet-500' },
  { key: 'lab', label: 'Laboratory', color: 'bg-yellow-500' },
  { key: 'radiology', label: 'Radiology', color: 'bg-indigo-500' },
  { key: 'pharmacy', label: 'Pharmacy', color: 'bg-purple-500' },
  { key: 'physiotherapy', label: 'Physiotherapy', color: 'bg-purple-600' },
  { key: 'nursing', label: 'Nursing', color: 'bg-pink-500' },
  { key: 'procedure', label: 'Procedures', color: 'bg-fuchsia-500' },
  { key: 'dental', label: 'Dental', color: 'bg-cyan-600' },
  { key: 'ophthalmology', label: 'Ophthalmology', color: 'bg-indigo-600' },
  { key: 'anc', label: 'Antenatal Care', color: 'bg-pink-600' },
  { key: 'admission', label: 'Admissions', color: 'bg-violet-600' },
  { key: 'billing', label: 'Billing', color: 'bg-teal-500' },
  { key: 'nhis_claim', label: 'NHIS Claims', color: 'bg-green-600' },
];

export const RECORD_CATEGORIES: RecordCategoryMeta[] =
  ALL_RECORD_CATEGORIES.filter((category) => {
    switch (category.key) {
      case 'nhis_claim':
        return isNhisFeatureEnabled();
      case 'specialty':
        return isSpecialtyClinicsEnabled();
      case 'dental':
        return isDentalEnabled();
      case 'ophthalmology':
        return isOphthalmologyEnabled();
      case 'physiotherapy':
        return isPhysiotherapyEnabled();
      default:
        return true;
    }
  });

// ---------------------------------------------------------------------------
// Unified record row displayed in the history table
// ---------------------------------------------------------------------------

export interface UnifiedRecord {
  id: string;
  category: RecordCategory;
  categoryLabel: string;
  patientId: string;
  patientName: string;
  emrNumber: string;
  encounterId?: string;
  date: string; // ISO date string
  title: string;
  description: string;
  status: string;
  department: string;
  staffName: string;
  amount?: number;
  nhisRelated: boolean;
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export interface RecordsHistoryFilters {
  category: RecordCategory | 'all';
  dateFrom: string;
  dateTo: string;
  searchTerm: string; // patient name / EMR number
  status: string; // varies per category
  department: string;
  page: number;
  pageSize: number;
}

export function getDefaultFilters(): RecordsHistoryFilters {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return {
    category: 'all',
    dateFrom: thirtyDaysAgo.toISOString().split('T')[0],
    dateTo: now.toISOString().split('T')[0],
    searchTerm: '',
    status: '',
    department: '',
    page: 1,
    pageSize: 50,
  };
}

// ---------------------------------------------------------------------------
// Export options
// ---------------------------------------------------------------------------

export type RecordsExportFormat = 'pdf' | 'csv';

export interface RecordsExportOptions {
  format: RecordsExportFormat;
  title: string;
  filters: RecordsHistoryFilters;
  generatedBy: string;
}

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

export interface RecordsHistoryResponse {
  data: UnifiedRecord[];
  totalCount: number;
}
