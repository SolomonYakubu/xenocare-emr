/**
 * =============================================================================
 * XENOCARE EMR - COMPREHENSIVE ENCOUNTER FILTER PANEL
 * Description: Full-featured filter panel with all encounter fields
 * Features: Multi-section filters, presets, search within filters, export options
 * =============================================================================
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  isNhisCategory,
  isNhisFeatureEnabled,
} from '../../../config/features';
import {
  X,
  Calendar,
  CheckCircle,
  User,
  Building2,
  Stethoscope,
  AlertTriangle,
  RefreshCcw,
  Filter,
  UserCheck,
  Shield,
  Clock,
  Activity,
  Users,
  Heart,
  FileText,
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  Sliders,
  Hash,
  CreditCard,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Tag,
  Printer,
  FileSpreadsheet,
  BookOpen,
  Check,
  TestTubes,
  ScanLine,
  Pill,
  ArrowRightLeft,
  BedDouble,
  Siren,
  Baby,
  ClipboardList,
} from 'lucide-react';
import {
  EncounterStatuses,
  VisitTypes,
  PriorityLevels,
  EncounterStatus,
  VisitType,
  PriorityLevel,
  PaymentCategories,
} from '../dtos/encounter.dto';

// =============================================================================
// Types
// =============================================================================

export interface ComprehensiveEncounterFilters {
  // Search Filters
  searchQuery: string;
  encounterNumber: string;
  patientName: string;
  emrNumber: string;
  serviceNumber: string;
  phone: string;

  // Date Filters
  dateFrom: string;
  dateTo: string;
  createdDateFrom: string;
  createdDateTo: string;

  // Status & Type Filters
  status: EncounterStatus | 'all';
  visitType: VisitType | 'all';
  priority: PriorityLevel | 'all';
  currentStage: string;

  // Location & Provider Filters
  departmentId: string;
  doctorId: string;
  clinicId: string;
  specialtyCode: string;
  registeredBy: string;

  // Patient Category Filters
  patientCategory: string;
  insuranceType: string;
  paymentCategory: string;

  // Demographics
  ageRangeMin: string;
  ageRangeMax: string;
  gender: string;

  // Military/Participant Filters
  rank: string;
  course: string;
  title: string;
  unit: string;

  // Clinical Filters
  diagnosis: string;
  diagnosisCode: string;
  icd10Category: string;
  chiefComplaint: string;
  hasConsultation: string;
  hasTreatmentPlan: string;

  // Services & Orders Filters
  hasLabOrder: string;
  labStatus: string;
  hasRadiologyOrder: string;
  radiologyStatus: string;
  hasPrescription: string;
  prescriptionStatus: string;
  hasProcedure: string;

  // Referral Filters
  hasInternalReferral: string;
  referralTargetSpecialty: string;
  hasExternalReferral: string;
  nhisReferralStatus: string;

  // Admission & Disposition Filters
  patientType: string;
  wasAdmitted: string;
  ward: string;
  dischargeStatus: string;
  encounterOutcome: string;
  losMin: string;
  losMax: string;

  // A&E Specific Filters
  triageCategory: string;
  arrivalMode: string;
  aeDisposition: string;

  // ANC Specific Filters
  ancVisitNumber: string;
  gestationalAgeMin: string;
  gestationalAgeMax: string;

  // Billing Filters
  hasPendingBills: string;
  hasCompletedPayment: string;
  nhisClaimStatus: string;
  billingAmountMin: string;
  billingAmountMax: string;

  // Time-based Filters
  isOverdue: string;
  isExpired: string;
  waitingTimeMin: string;
  waitingTimeMax: string;
}

export const defaultComprehensiveFilters: ComprehensiveEncounterFilters = {
  searchQuery: '',
  encounterNumber: '',
  patientName: '',
  emrNumber: '',
  serviceNumber: '',
  phone: '',
  dateFrom: '',
  dateTo: '',
  createdDateFrom: '',
  createdDateTo: '',
  status: 'all',
  visitType: 'all',
  priority: 'all',
  currentStage: 'all',
  departmentId: 'all',
  doctorId: 'all',
  clinicId: 'all',
  specialtyCode: 'all',
  registeredBy: 'all',
  patientCategory: 'all',
  insuranceType: 'all',
  paymentCategory: 'all',
  ageRangeMin: '',
  ageRangeMax: '',
  gender: 'all',
  rank: 'all',
  course: 'all',
  title: 'all',
  unit: 'all',
  diagnosis: 'all',
  diagnosisCode: '',
  icd10Category: 'all',
  chiefComplaint: 'all',
  hasConsultation: 'all',
  hasTreatmentPlan: 'all',
  hasLabOrder: 'all',
  labStatus: 'all',
  hasRadiologyOrder: 'all',
  radiologyStatus: 'all',
  hasPrescription: 'all',
  prescriptionStatus: 'all',
  hasProcedure: 'all',
  hasInternalReferral: 'all',
  referralTargetSpecialty: 'all',
  hasExternalReferral: 'all',
  nhisReferralStatus: 'all',
  patientType: 'all',
  wasAdmitted: 'all',
  ward: 'all',
  dischargeStatus: 'all',
  encounterOutcome: 'all',
  losMin: '',
  losMax: '',
  triageCategory: 'all',
  arrivalMode: 'all',
  aeDisposition: 'all',
  ancVisitNumber: '',
  gestationalAgeMin: '',
  gestationalAgeMax: '',
  hasPendingBills: 'all',
  hasCompletedPayment: 'all',
  nhisClaimStatus: 'all',
  billingAmountMin: '',
  billingAmountMax: '',
  isOverdue: 'all',
  isExpired: 'all',
  waitingTimeMin: '',
  waitingTimeMax: '',
};

interface ComprehensiveFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: ComprehensiveEncounterFilters;
  onFiltersChange: (filters: ComprehensiveEncounterFilters) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onExport?: () => void;
  onGenerateReport?: () => void;
  // Data lists for dropdowns
  doctorList?: Array<{ id: string; name: string; rank?: string }>;
  departmentList?: Array<{ id: string; name: string }>;
  clinicList?: Array<{ id: string; name: string }>;
  courseList?: Array<{ id: string; name: string }>;
  diagnosisList?: Array<{ name: string; code?: string; count: number }>;
  chiefComplaintList?: Array<{ id: string; name: string; category: string }>;
  rankList?: Array<{ value: string; label: string }>;
  unitList?: Array<{ id: string; name: string }>;
}

// Patient categories based on the EMR system
const PATIENT_CATEGORIES = [
  { value: 'Military', label: 'Military Personnel' },
  { value: 'Military Participant', label: 'Military Participant' },
  { value: 'Civilian', label: 'Civilian' },
  { value: 'Civilian Participant', label: 'Civilian Participant' },
  { value: 'Security Services', label: 'Security Services' },
  { value: 'Dependent', label: 'Dependent (Family)' },
  { value: 'Retired', label: 'Retired Personnel' },
  { value: 'Staff', label: 'Hospital Staff' },
];

const INSURANCE_TYPES = [
  { value: 'Military_NHIS', label: 'Military NHIS' },
  { value: 'Civilian_NHIS', label: 'Civilian NHIS' },
  { value: 'GIFSHIP', label: 'GIFSHIP' },
  { value: 'Security_Services_NHIS', label: 'Security Services NHIS' },
  { value: 'Retainership', label: 'Retainership' },
  { value: 'Private', label: 'Private Insurance' },
  { value: 'None', label: 'No Insurance (Self-Pay)' },
];

const VISIBLE_INSURANCE_TYPES = isNhisFeatureEnabled()
  ? INSURANCE_TYPES
  : INSURANCE_TYPES.filter((type) => !isNhisCategory(type.value));

const ENCOUNTER_STAGES = [
  { value: 'created', label: 'Created' },
  { value: 'billing_queue', label: 'Billing Queue' },
  { value: 'payment_pending', label: 'Payment Pending' },
  { value: 'payment_verified', label: 'Payment Verified' },
  { value: 'nursing_queue', label: 'Nursing Queue' },
  { value: 'nursing_vitals', label: 'Vitals Recording' },
  { value: 'consultation_queue', label: 'Consultation Queue' },
  { value: 'consultation', label: 'In Consultation' },
  { value: 'lab_requested', label: 'Lab Requested' },
  { value: 'radiology_requested', label: 'Radiology Requested' },
  { value: 'pharmacy_pending', label: 'Pharmacy Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'discharged', label: 'Discharged' },
];

const DEPARTMENTS = [
  { value: 'GOPD', label: 'General Out-Patient (GOPD)' },
  { value: 'SOPD', label: 'Special Out-Patient (SOPD)' },
  { value: 'Emergency', label: 'Emergency' },
  { value: 'Laboratory', label: 'Laboratory' },
  { value: 'Radiology', label: 'Radiology' },
  { value: 'Pharmacy', label: 'Pharmacy' },
  { value: 'Nursing', label: 'Nursing' },
  { value: 'Dental', label: 'Dental' },
  { value: 'Physiotherapy', label: 'Physiotherapy' },
  { value: 'Mental Health', label: 'Mental Health' },
  { value: 'Obstetrics', label: 'Obstetrics & Gynecology' },
  { value: 'Pediatrics', label: 'Pediatrics' },
  { value: 'Surgery', label: 'Surgery' },
  { value: 'Internal Medicine', label: 'Internal Medicine' },
  { value: 'Orthopedics', label: 'Orthopedics' },
  { value: 'ENT', label: 'ENT (Ear, Nose, Throat)' },
  { value: 'Ophthalmology', label: 'Ophthalmology' },
  { value: 'Dermatology', label: 'Dermatology' },
];

const MILITARY_RANKS = [
  { value: 'General', label: 'General' },
  { value: 'Lt General', label: 'Lieutenant General' },
  { value: 'Maj General', label: 'Major General' },
  { value: 'Brigadier General', label: 'Brigadier General' },
  { value: 'Colonel', label: 'Colonel' },
  { value: 'Lt Colonel', label: 'Lieutenant Colonel' },
  { value: 'Major', label: 'Major' },
  { value: 'Captain', label: 'Captain' },
  { value: 'Lieutenant', label: 'Lieutenant' },
  { value: '2nd Lieutenant', label: 'Second Lieutenant' },
  { value: 'Warrant Officer', label: 'Warrant Officer' },
  { value: 'Sergeant Major', label: 'Sergeant Major' },
  { value: 'Staff Sergeant', label: 'Staff Sergeant' },
  { value: 'Sergeant', label: 'Sergeant' },
  { value: 'Corporal', label: 'Corporal' },
  { value: 'Lance Corporal', label: 'Lance Corporal' },
  { value: 'Private', label: 'Private' },
  { value: 'Civilian', label: 'Civilian' },
];

// ICD-10 Categories for diagnosis filtering (WHO standard chapters)
const ICD10_CATEGORIES = [
  { code: 'A-B', name: 'Infectious & Parasitic Diseases', range: 'A00-B99' },
  { code: 'C', name: 'Neoplasms', range: 'C00-D49' },
  { code: 'D', name: 'Blood & Immune Disorders', range: 'D50-D89' },
  { code: 'E', name: 'Endocrine, Nutritional & Metabolic', range: 'E00-E89' },
  { code: 'F', name: 'Mental & Behavioral Disorders', range: 'F01-F99' },
  { code: 'G', name: 'Nervous System Diseases', range: 'G00-G99' },
  { code: 'H-eye', name: 'Eye & Adnexa Diseases', range: 'H00-H59' },
  { code: 'H-ear', name: 'Ear & Mastoid Diseases', range: 'H60-H95' },
  { code: 'I', name: 'Circulatory System Diseases', range: 'I00-I99' },
  { code: 'J', name: 'Respiratory System Diseases', range: 'J00-J99' },
  { code: 'K', name: 'Digestive System Diseases', range: 'K00-K95' },
  { code: 'L', name: 'Skin & Subcutaneous Diseases', range: 'L00-L99' },
  { code: 'M', name: 'Musculoskeletal System', range: 'M00-M99' },
  { code: 'N', name: 'Genitourinary System Diseases', range: 'N00-N99' },
  { code: 'O', name: 'Pregnancy & Childbirth', range: 'O00-O9A' },
  { code: 'P', name: 'Perinatal Conditions', range: 'P00-P96' },
  { code: 'Q', name: 'Congenital Malformations', range: 'Q00-Q99' },
  { code: 'R', name: 'Symptoms & Abnormal Findings', range: 'R00-R99' },
  { code: 'S-T', name: 'Injury & Poisoning', range: 'S00-T88' },
  { code: 'V-Y', name: 'External Causes', range: 'V00-Y99' },
  { code: 'Z', name: 'Health Status Factors', range: 'Z00-Z99' },
];

// Specialty codes for specialty clinic filtering
const SPECIALTY_CODES = [
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'dental', label: 'Dental' },
  { value: 'orthopedics', label: 'Orthopedics' },
  { value: 'ent', label: 'ENT (Ear, Nose, Throat)' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'psychiatry', label: 'Psychiatry / Mental Health' },
  { value: 'obstetrics', label: 'Obstetrics & Gynaecology' },
  { value: 'paediatrics', label: 'Paediatrics' },
  { value: 'surgery', label: 'General Surgery' },
  { value: 'internal_medicine', label: 'Internal Medicine' },
  { value: 'physiotherapy', label: 'Physiotherapy' },
  { value: 'nutrition', label: 'Nutrition & Dietetics' },
];

// Encounter outcome options
const ENCOUNTER_OUTCOMES = [
  { value: 'discharged', label: 'Discharged Home' },
  { value: 'referred_out', label: 'Referred to Another Facility' },
  { value: 'admitted', label: 'Admitted (Inpatient)' },
  { value: 'dama', label: 'Discharged Against Medical Advice' },
  { value: 'absconded', label: 'Absconded' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'transferred', label: 'Transferred to Another Ward' },
];

// A&E triage categories
const TRIAGE_CATEGORIES = [
  { value: 'Red', label: 'Red – Immediate / Life-threatening' },
  { value: 'Orange', label: 'Orange – Very Urgent' },
  { value: 'Yellow', label: 'Yellow – Urgent' },
  { value: 'Green', label: 'Green – Standard' },
  { value: 'Blue', label: 'Blue – Non-Urgent' },
];

// A&E arrival modes
const ARRIVAL_MODES = [
  { value: 'Walk-in', label: 'Walk-in' },
  { value: 'Ambulance', label: 'Ambulance' },
  { value: 'Referred', label: 'Referred from Another Facility' },
  { value: 'Police', label: 'Police / Security Escort' },
  { value: 'Private Vehicle', label: 'Private Vehicle' },
  { value: 'Other', label: 'Other' },
];

// A&E disposition types
const AE_DISPOSITIONS = [
  { value: 'Discharged', label: 'Discharged Home' },
  { value: 'Admitted', label: 'Admitted to Ward' },
  { value: 'Referred', label: 'Referred to Specialist' },
  { value: 'Transferred', label: 'Transferred Out' },
  { value: 'DAMA', label: 'Left Against Medical Advice' },
  { value: 'Deceased', label: 'Deceased' },
  { value: 'Observation', label: 'Under Observation' },
];

// NHIS Claim statuses
const NHIS_CLAIM_STATUSES = [
  { value: 'pending', label: 'Pending Submission' },
  { value: 'submitted', label: 'Submitted to HMO' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'queried', label: 'Queried / Under Review' },
  { value: 'paid', label: 'Paid' },
];

// Order status options (reused for lab, radiology, pharmacy)
const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// =============================================================================
// Searchable Dropdown Component - Soft UI with Interactive Feel
// =============================================================================

interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query) ||
        opt.sublabel?.toLowerCase().includes(query),
    );
  }, [options, searchQuery]);

  // Get selected option label
  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label || placeholder;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2.5 text-sm text-left bg-white border rounded-xl
          transition-all duration-200 ease-out
          flex items-center justify-between gap-2
          ${
            isOpen
              ? 'border-primary-700 ring-2 ring-primary-700/20 shadow-lg'
              : 'border-gray-200 hover:border-primary-700/50 hover:shadow-md'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'cursor-pointer'}
          ${value && value !== 'all' ? 'text-gray-900 font-medium' : 'text-gray-500'}
        `}
      >
        <span className="truncate flex-1">{displayLabel}</span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="
            absolute z-50 mt-2 w-full bg-white rounded-xl border border-gray-200 
            shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200
          "
          style={{ maxHeight: '280px' }}
        >
          {/* Search Input */}
          {options.length > 5 && (
            <div className="p-2 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="
                    w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700
                    placeholder:text-gray-400 transition-all duration-200
                  "
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: options.length > 5 ? '220px' : '280px' }}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full px-3 py-2.5 text-left text-sm flex items-center gap-3
                    transition-all duration-150 ease-out
                    ${
                      value === option.value
                        ? 'bg-primary-700/10 text-primary-700'
                        : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                    }
                    ${index !== filteredOptions.length - 1 ? 'border-b border-gray-50' : ''}
                  `}
                >
                  {option.icon && (
                    <span className="flex-shrink-0">{option.icon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`truncate ${value === option.value ? 'font-medium' : ''}`}
                    >
                      {option.label}
                    </div>
                    {option.sublabel && (
                      <div className="text-xs text-gray-400 truncate">
                        {option.sublabel}
                      </div>
                    )}
                  </div>
                  {value === option.value && (
                    <Check className="h-4 w-4 text-primary-700 flex-shrink-0" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-gray-400">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Sub-Components
// =============================================================================

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  icon,
  children,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 px-1 hover:bg-gray-50 transition-colors rounded"
      >
        <div className="flex items-center gap-2">
          <span className="text-primary-700">{icon}</span>
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export function ComprehensiveEncounterFilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  onExport,
  onGenerateReport,
  doctorList = [],
  departmentList = [],
  clinicList = [],
  courseList = [],
  diagnosisList = [],
  chiefComplaintList = [],
  rankList = MILITARY_RANKS,
  unitList = [],
}: ComprehensiveFilterPanelProps) {
  const [searchWithinFilters, setSearchWithinFilters] = useState('');

  const updateFilter = <K extends keyof ComprehensiveEncounterFilters>(
    key: K,
    value: ComprehensiveEncounterFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (
        [
          'searchQuery',
          'encounterNumber',
          'patientName',
          'emrNumber',
          'serviceNumber',
          'phone',
          'dateFrom',
          'dateTo',
          'createdDateFrom',
          'createdDateTo',
          'ageRangeMin',
          'ageRangeMax',
          'diagnosisCode',
          'billingAmountMin',
          'billingAmountMax',
          'waitingTimeMin',
          'waitingTimeMax',
        ].includes(key)
      ) {
        return value !== '';
      }
      return value !== 'all' && value !== '';
    }).length;
  }, [filters]);

  // Quick date presets
  const applyDatePreset = (preset: string) => {
    const today = new Date();
    let fromDate: Date;
    let toDate = new Date();

    switch (preset) {
      case 'today':
        fromDate = today;
        break;
      case 'yesterday':
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 1);
        toDate = fromDate;
        break;
      case 'last7':
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 7);
        break;
      case 'last30':
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 30);
        break;
      case 'thisMonth':
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth':
        fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        toDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisYear':
        fromDate = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    updateFilter('dateFrom', fromDate.toISOString().split('T')[0]);
    updateFilter('dateTo', toDate.toISOString().split('T')[0]);
  };

  // Filter presets - Medical Records oriented
  const applyPreset = (preset: string) => {
    const newFilters = { ...defaultComprehensiveFilters };
    const today = new Date();

    switch (preset) {
      case 'thisMonthGOPD':
        newFilters.departmentId = 'GOPD';
        newFilters.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
      case 'thisMonthSOPD':
        newFilters.departmentId = 'SOPD';
        newFilters.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
      case 'nhisEncounters':
        newFilters.paymentCategory = 'NHIS';
        newFilters.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
      case 'emergencies':
        newFilters.priority = 'Emergency';
        newFilters.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
      case 'admissions':
        newFilters.wasAdmitted = 'yes';
        newFilters.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
      case 'referralsOut':
        newFilters.hasExternalReferral = 'yes';
        newFilters.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
      case 'pendingCompletion':
        newFilters.status = 'Active';
        newFilters.isOverdue = 'yes';
        break;
      case 'mortality':
        newFilters.encounterOutcome = 'deceased';
        newFilters.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
      case 'militaryPersonnel':
        newFilters.patientCategory = 'Military';
        newFilters.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
      case 'ancVisits':
        newFilters.visitType = 'Antenatal';
        newFilters.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
    }

    onFiltersChange(newFilters);
  };

  return (
    <>
      {/* Overlay with backdrop blur */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Centered Modal - Wide Layout */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className={`bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 ${
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-primary-700 to-[#008545]">
            <div className="flex items-center justify-between px-8 py-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <Sliders className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Advanced Filter & Search
                  </h2>
                  <p className="text-white/80 text-sm">
                    Filter encounters across all modules
                  </p>
                </div>
                {activeFilterCount > 0 && (
                  <span className="px-3 py-1 bg-white text-primary-700 text-sm font-bold rounded-full shadow-lg">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Quick Filter Presets - Horizontal Bar */}
            <div className="px-8 py-3 bg-white/10 border-t border-white/20">
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Quick Filters:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      key: 'thisMonthGOPD',
                      label: 'GOPD This Month',
                      icon: Building2,
                    },
                    {
                      key: 'thisMonthSOPD',
                      label: 'SOPD This Month',
                      icon: Stethoscope,
                    },
                    ...(isNhisFeatureEnabled()
                      ? [
                          {
                            key: 'nhisEncounters',
                            label: 'NHIS',
                            icon: Heart,
                          },
                        ]
                      : []),
                    {
                      key: 'emergencies',
                      label: 'Emergencies',
                      icon: AlertTriangle,
                    },
                    {
                      key: 'admissions',
                      label: 'Admissions',
                      icon: BedDouble,
                    },
                    {
                      key: 'referralsOut',
                      label: 'Referrals Out',
                      icon: ArrowRightLeft,
                    },
                    {
                      key: 'militaryPersonnel',
                      label: 'Military',
                      icon: Shield,
                    },
                    {
                      key: 'ancVisits',
                      label: 'ANC',
                      icon: Baby,
                    },
                    {
                      key: 'pendingCompletion',
                      label: 'Overdue',
                      icon: Clock,
                    },
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => applyPreset(preset.key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg transition-all hover:scale-105"
                    >
                      <preset.icon className="h-3.5 w-3.5" />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Filter Content - Multi-Column Grid Layout */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {/* Main Search Bar - Full Width */}
            <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Global search - Search by patient name, patient number, phone, diagnosis..."
                      value={filters.searchQuery}
                      onChange={(e) =>
                        updateFilter('searchQuery', e.target.value)
                      }
                      className="w-full pl-12 pr-4 py-3.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onApplyFilters}
                    className="px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <Filter className="h-4 w-4" />
                    Apply Filters
                  </button>
                  <button
                    onClick={onClearFilters}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all flex items-center gap-2"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Grid - 3 Columns */}
            <div className="grid grid-cols-3 gap-6">
              {/* Column 1: Search & Identity */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <Hash className="h-4 w-4 text-primary-700" />
                    Identity Search
                  </h3>
                  <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Search by encounter number, patient number, or patient name.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Encounter Number
                      </label>
                      <input
                        type="text"
                        placeholder="ENC-..."
                        value={filters.encounterNumber}
                        onChange={(e) =>
                          updateFilter('encounterNumber', e.target.value)
                        }
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200 hover:border-primary-700/50 placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Patient number
                      </label>
                      <input
                        type="text"
                        placeholder="patient number..."
                        value={filters.emrNumber}
                        onChange={(e) =>
                          updateFilter('emrNumber', e.target.value)
                        }
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200 hover:border-primary-700/50 placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Service Number
                      </label>
                      <input
                        type="text"
                        placeholder="N/12345..."
                        value={filters.serviceNumber}
                        onChange={(e) =>
                          updateFilter('serviceNumber', e.target.value)
                        }
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200 hover:border-primary-700/50 placeholder:text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        placeholder="080..."
                        value={filters.phone}
                        onChange={(e) => updateFilter('phone', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200 hover:border-primary-700/50 placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Date Range Card */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <Calendar className="h-4 w-4 text-primary-700" />
                    Date Range
                  </h3>
                  <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Select start and end dates to narrow records by encounter date.</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        From
                      </label>
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) =>
                          updateFilter('dateFrom', e.target.value)
                        }
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        To
                      </label>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => updateFilter('dateTo', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'today', label: 'Today' },
                      { key: 'yesterday', label: 'Yesterday' },
                      { key: 'last7', label: '7 Days' },
                      { key: 'last30', label: '30 Days' },
                      { key: 'thisMonth', label: 'This Month' },
                    ].map((preset) => (
                      <button
                        key={preset.key}
                        onClick={() => applyDatePreset(preset.key)}
                        className="px-2.5 py-1 text-xs bg-primary-700/10 hover:bg-primary-700/20 text-primary-700 rounded-lg transition-colors font-medium"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Demographics Card */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <User className="h-4 w-4 text-primary-700" />
                    Demographics
                  </h3>
                  <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Filter by gender or age to find specific patient groups.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Gender
                      </label>
                      <SearchableDropdown
                        value={filters.gender}
                        onChange={(val) => updateFilter('gender', val)}
                        placeholder="All Genders"
                        options={[
                          { value: 'all', label: 'All Genders' },
                          { value: 'Male', label: 'Male' },
                          { value: 'Female', label: 'Female' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Age Range
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={filters.ageRangeMin}
                          onChange={(e) =>
                            updateFilter('ageRangeMin', e.target.value)
                          }
                          placeholder="Min"
                          min="0"
                          max="120"
                          className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                          type="number"
                          value={filters.ageRangeMax}
                          onChange={(e) =>
                            updateFilter('ageRangeMax', e.target.value)
                          }
                          placeholder="Max"
                          min="0"
                          max="120"
                          className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Status, Type, Location */}
              <div className="space-y-4">
                {/* Status & Type Card */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <CheckCircle className="h-4 w-4 text-primary-700" />
                    Status & Type
                  </h3>
                  <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Narrow by encounter status, visit type, and priority level.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Status
                      </label>
                      <SearchableDropdown
                        value={filters.status}
                        onChange={(val) =>
                          updateFilter('status', val as EncounterStatus | 'all')
                        }
                        placeholder="All Statuses"
                        searchPlaceholder="Search status..."
                        options={[
                          { value: 'all', label: 'All Statuses' },
                          ...EncounterStatuses.map((status) => ({
                            value: status,
                            label: status,
                          })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Stage
                      </label>
                      <SearchableDropdown
                        value={filters.currentStage}
                        onChange={(val) => updateFilter('currentStage', val)}
                        placeholder="All Stages"
                        searchPlaceholder="Search stage..."
                        options={[
                          { value: 'all', label: 'All Stages' },
                          ...ENCOUNTER_STAGES.map((stage) => ({
                            value: stage.value,
                            label: stage.label,
                          })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Visit Type
                      </label>
                      <SearchableDropdown
                        value={filters.visitType}
                        onChange={(val) =>
                          updateFilter('visitType', val as VisitType | 'all')
                        }
                        placeholder="All Types"
                        options={[
                          { value: 'all', label: 'All Visit Types' },
                          ...VisitTypes.map((type) => ({
                            value: type,
                            label: type,
                          })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Priority
                      </label>
                      <SearchableDropdown
                        value={filters.priority}
                        onChange={(val) =>
                          updateFilter('priority', val as PriorityLevel | 'all')
                        }
                        placeholder="All Priorities"
                        options={[
                          { value: 'all', label: 'All Priorities' },
                          ...PriorityLevels.map((level) => ({
                            value: level,
                            label: level,
                          })),
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Location & Provider Card */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <Building2 className="h-4 w-4 text-primary-700" />
                    Location & Provider
                  </h3>
                  <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Filter by clinic, department, or attending doctor.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Department
                      </label>
                      <SearchableDropdown
                        value={filters.departmentId}
                        onChange={(val) => updateFilter('departmentId', val)}
                        placeholder="All Departments"
                        searchPlaceholder="Search department..."
                        options={[
                          { value: 'all', label: 'All Departments' },
                          ...(departmentList.length > 0
                            ? departmentList
                            : DEPARTMENTS
                          ).map((dept: any) => ({
                            value: dept.id || dept.value,
                            label: dept.name || dept.label,
                          })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Clinic
                      </label>
                      <SearchableDropdown
                        value={filters.clinicId}
                        onChange={(val) => updateFilter('clinicId', val)}
                        placeholder="All Clinics"
                        searchPlaceholder="Search clinic..."
                        options={[
                          { value: 'all', label: 'All Clinics' },
                          ...clinicList.map((clinic) => ({
                            value: clinic.id,
                            label: clinic.name,
                          })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Attending Doctor
                      </label>
                      <SearchableDropdown
                        value={filters.doctorId}
                        onChange={(val) => updateFilter('doctorId', val)}
                        placeholder="All Doctors"
                        searchPlaceholder="Search doctor..."
                        options={[
                          { value: 'all', label: 'All Doctors' },
                          ...doctorList.map((doctor) => ({
                            value: doctor.id,
                            label: doctor.rank
                              ? `${doctor.rank} ${doctor.name}`
                              : doctor.name,
                          })),
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Patient Category Card */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <Shield className="h-4 w-4 text-primary-700" />
                    Patient Category
                  </h3>
                  <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">
                    {isNhisFeatureEnabled()
                      ? 'Choose NHIS, private, or other payment categories.'
                      : 'Choose the payment category for this visit.'}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Category
                      </label>
                      <SearchableDropdown
                        value={filters.patientCategory}
                        onChange={(val) => updateFilter('patientCategory', val)}
                        placeholder="All Categories"
                        options={[
                          { value: 'all', label: 'All Categories' },
                          ...PATIENT_CATEGORIES.map((cat) => ({
                            value: cat.value,
                            label: cat.label,
                          })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Insurance Type
                      </label>
                      <SearchableDropdown
                        value={filters.insuranceType}
                        onChange={(val) => updateFilter('insuranceType', val)}
                        placeholder="All Insurance"
                        options={[
                          { value: 'all', label: 'All Insurance Types' },
                          ...VISIBLE_INSURANCE_TYPES.map((ins) => ({
                            value: ins.value,
                            label: ins.label,
                          })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Payment Category
                      </label>
                      <SearchableDropdown
                        value={filters.paymentCategory}
                        onChange={(val) => updateFilter('paymentCategory', val)}
                        placeholder="All Payment"
                        options={[
                          { value: 'all', label: 'All Payment Categories' },
                          ...PaymentCategories.map((pay) => ({
                            value: pay.value,
                            label: pay.label,
                          })),
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: Clinical, Military, Billing */}
              <div className="space-y-4">
                {/* Clinical/Diagnosis Card - Enhanced with ICD-10 Search */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <Stethoscope className="h-4 w-4 text-primary-700" />
                    Clinical & Diagnosis
                  </h3>
                  <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Search by ICD-10 diagnosis code or clinical findings.</p>
                  <div className="space-y-3">
                    {/* ICD-10 Category */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        ICD-10 Category
                      </label>
                      <SearchableDropdown
                        value={filters.icd10Category}
                        onChange={(val) => updateFilter('icd10Category', val)}
                        placeholder="All ICD-10 Categories"
                        searchPlaceholder="Search ICD-10..."
                        options={[
                          { value: 'all', label: 'All ICD-10 Categories' },
                          ...ICD10_CATEGORIES.map((cat) => ({
                            value: cat.code,
                            label: cat.name,
                            sublabel: cat.range,
                          })),
                        ]}
                      />
                    </div>

                    {/* ICD-10 Code Search - NEW Enhanced Feature */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        ICD-10 Code Search
                        <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-bold">
                          NEW
                        </span>
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search by ICD-10 code: A00.0, J18.9, I10..."
                          value={filters.diagnosisCode}
                          onChange={(e) =>
                            updateFilter('diagnosisCode', e.target.value)
                          }
                          className="w-full pl-9 pr-3 py-2.5 text-sm bg-blue-50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 focus:bg-white transition-all duration-200 placeholder:text-gray-400"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Enter exact or partial ICD-10 codes
                      </p>
                    </div>

                    {/* Diagnosis */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Diagnosis
                      </label>
                      <SearchableDropdown
                        value={filters.diagnosis}
                        onChange={(val) => updateFilter('diagnosis', val)}
                        placeholder="All Diagnoses"
                        searchPlaceholder="Search diagnosis..."
                        emptyMessage={
                          diagnosisList.length === 0
                            ? 'Loading...'
                            : 'No diagnoses found'
                        }
                        options={[
                          { value: 'all', label: 'All Diagnoses' },
                          ...diagnosisList.map((diag) => ({
                            value: diag.name,
                            label: diag.name,
                            sublabel: `${diag.count} records`,
                          })),
                        ]}
                      />
                    </div>

                    {/* Chief Complaint */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Chief Complaint
                      </label>
                      <SearchableDropdown
                        value={filters.chiefComplaint}
                        onChange={(val) => updateFilter('chiefComplaint', val)}
                        placeholder="All Complaints"
                        searchPlaceholder="Search complaint..."
                        options={[
                          { value: 'all', label: 'All Chief Complaints' },
                          ...chiefComplaintList.map((complaint) => ({
                            value: complaint.name,
                            label: complaint.name,
                            sublabel: complaint.category,
                          })),
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Military & Course Card */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <GraduationCap className="h-4 w-4 text-primary-700" />
                    Military & Course
                  </h3>
                  <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Filters specific to military personnel and training courses.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Rank
                      </label>
                      <SearchableDropdown
                        value={filters.rank}
                        onChange={(val) => updateFilter('rank', val)}
                        placeholder="All Ranks"
                        searchPlaceholder="Search rank..."
                        options={[
                          { value: 'all', label: 'All Ranks' },
                          ...rankList.map((rank) => ({
                            value: rank.value,
                            label: rank.label,
                          })),
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Course
                      </label>
                      <SearchableDropdown
                        value={filters.course}
                        onChange={(val) => updateFilter('course', val)}
                        placeholder="All Courses"
                        options={[
                          { value: 'all', label: 'All Courses' },
                          ...courseList.map((course) => ({
                            value: course.name,
                            label: course.name,
                          })),
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Billing & Time Card */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <CreditCard className="h-4 w-4 text-primary-700" />
                    Billing & Time Status
                  </h3>
                  <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Filter by billing status, time of day, or waiting time.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Pending Bills
                      </label>
                      <SearchableDropdown
                        value={filters.hasPendingBills}
                        onChange={(val) => updateFilter('hasPendingBills', val)}
                        placeholder="Any"
                        options={[
                          { value: 'all', label: 'Any' },
                          { value: 'yes', label: 'Has Pending Bills' },
                          { value: 'no', label: 'No Pending Bills' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Payment Status
                      </label>
                      <SearchableDropdown
                        value={filters.hasCompletedPayment}
                        onChange={(val) =>
                          updateFilter('hasCompletedPayment', val)
                        }
                        placeholder="Any"
                        options={[
                          { value: 'all', label: 'Any' },
                          { value: 'yes', label: 'Completed' },
                          { value: 'no', label: 'Pending' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Overdue
                      </label>
                      <SearchableDropdown
                        value={filters.isOverdue}
                        onChange={(val) => updateFilter('isOverdue', val)}
                        placeholder="Any"
                        options={[
                          { value: 'all', label: 'Any' },
                          { value: 'yes', label: 'Overdue Only' },
                          { value: 'no', label: 'Not Overdue' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Expired (24hr)
                      </label>
                      <SearchableDropdown
                        value={filters.isExpired}
                        onChange={(val) => updateFilter('isExpired', val)}
                        placeholder="Any"
                        options={[
                          { value: 'all', label: 'Any' },
                          { value: 'yes', label: 'Expired Only' },
                          { value: 'no', label: 'Not Expired' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 2: Services, Referrals, Admission ──────────────── */}
            <div className="grid grid-cols-3 gap-6 mt-6">
              {/* Services & Orders Card */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  <ClipboardList className="h-4 w-4 text-primary-700" />
                  Services & Orders
                </h3>
                <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Find encounters with specific lab, radiology, or pharmacy orders.</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Lab Orders</label>
                      <SearchableDropdown
                        value={filters.hasLabOrder}
                        onChange={(val) => updateFilter('hasLabOrder', val)}
                        placeholder="Any"
                        options={[
                          { value: 'all', label: 'Any' },
                          { value: 'yes', label: 'Has Lab Orders' },
                          { value: 'no', label: 'No Lab Orders' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Lab Status</label>
                      <SearchableDropdown
                        value={filters.labStatus}
                        onChange={(val) => updateFilter('labStatus', val)}
                        placeholder="Any Status"
                        options={[
                          { value: 'all', label: 'Any Status' },
                          ...ORDER_STATUSES.map((s) => ({ value: s.value, label: s.label })),
                        ]}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Radiology Orders</label>
                      <SearchableDropdown
                        value={filters.hasRadiologyOrder}
                        onChange={(val) => updateFilter('hasRadiologyOrder', val)}
                        placeholder="Any"
                        options={[
                          { value: 'all', label: 'Any' },
                          { value: 'yes', label: 'Has Imaging Orders' },
                          { value: 'no', label: 'No Imaging Orders' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Radiology Status</label>
                      <SearchableDropdown
                        value={filters.radiologyStatus}
                        onChange={(val) => updateFilter('radiologyStatus', val)}
                        placeholder="Any Status"
                        options={[
                          { value: 'all', label: 'Any Status' },
                          ...ORDER_STATUSES.map((s) => ({ value: s.value, label: s.label })),
                        ]}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Prescriptions</label>
                      <SearchableDropdown
                        value={filters.hasPrescription}
                        onChange={(val) => updateFilter('hasPrescription', val)}
                        placeholder="Any"
                        options={[
                          { value: 'all', label: 'Any' },
                          { value: 'yes', label: 'Has Prescriptions' },
                          { value: 'no', label: 'No Prescriptions' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Rx Status</label>
                      <SearchableDropdown
                        value={filters.prescriptionStatus}
                        onChange={(val) => updateFilter('prescriptionStatus', val)}
                        placeholder="Any Status"
                        options={[
                          { value: 'all', label: 'Any Status' },
                          { value: 'pending', label: 'Pending Dispensing' },
                          { value: 'dispensed', label: 'Dispensed' },
                          { value: 'partial', label: 'Partially Dispensed' },
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Procedures</label>
                    <SearchableDropdown
                      value={filters.hasProcedure}
                      onChange={(val) => updateFilter('hasProcedure', val)}
                      placeholder="Any"
                      options={[
                        { value: 'all', label: 'Any' },
                        { value: 'yes', label: 'Has Procedures' },
                        { value: 'no', label: 'No Procedures' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Consultation</label>
                    <SearchableDropdown
                      value={filters.hasConsultation}
                      onChange={(val) => updateFilter('hasConsultation', val)}
                      placeholder="Any"
                      options={[
                        { value: 'all', label: 'Any' },
                        { value: 'yes', label: 'Consultation Done' },
                        { value: 'no', label: 'No Consultation Yet' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Referrals Card */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  <ArrowRightLeft className="h-4 w-4 text-primary-700" />
                  Referrals
                </h3>
                <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Filter by referral source, destination, or status.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Internal Referral</label>
                    <SearchableDropdown
                      value={filters.hasInternalReferral}
                      onChange={(val) => updateFilter('hasInternalReferral', val)}
                      placeholder="Any"
                      options={[
                        { value: 'all', label: 'Any' },
                        { value: 'yes', label: 'Has Internal Referral' },
                        { value: 'no', label: 'No Internal Referral' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Referral Target Specialty</label>
                    <SearchableDropdown
                      value={filters.referralTargetSpecialty}
                      onChange={(val) => updateFilter('referralTargetSpecialty', val)}
                      placeholder="All Specialties"
                      searchPlaceholder="Search specialty..."
                      options={[
                        { value: 'all', label: 'All Specialties' },
                        ...SPECIALTY_CODES.map((s) => ({ value: s.value, label: s.label })),
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">External Referral</label>
                    <SearchableDropdown
                      value={filters.hasExternalReferral}
                      onChange={(val) => updateFilter('hasExternalReferral', val)}
                      placeholder="Any"
                      options={[
                        { value: 'all', label: 'Any' },
                        { value: 'yes', label: 'Has External Referral' },
                        { value: 'no', label: 'No External Referral' },
                      ]}
                    />
                  </div>
                  {isNhisFeatureEnabled() && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-medium">NHIS Referral Status</label>
                        <SearchableDropdown
                          value={filters.nhisReferralStatus}
                          onChange={(val) => updateFilter('nhisReferralStatus', val)}
                          placeholder="Any Status"
                          options={[
                            { value: 'all', label: 'Any Status' },
                            { value: 'pending', label: 'Pending Approval' },
                            { value: 'approved', label: 'Approved' },
                            { value: 'rejected', label: 'Rejected' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-medium">NHIS Claim Status</label>
                        <SearchableDropdown
                          value={filters.nhisClaimStatus}
                          onChange={(val) => updateFilter('nhisClaimStatus', val)}
                          placeholder="Any Status"
                          options={[
                            { value: 'all', label: 'Any Status' },
                            ...NHIS_CLAIM_STATUSES.map((s) => ({ value: s.value, label: s.label })),
                          ]}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Specialty Clinic</label>
                    <SearchableDropdown
                      value={filters.specialtyCode}
                      onChange={(val) => updateFilter('specialtyCode', val)}
                      placeholder="All Specialties"
                      searchPlaceholder="Search specialty..."
                      options={[
                        { value: 'all', label: 'All Specialty Clinics' },
                        ...SPECIALTY_CODES.map((s) => ({ value: s.value, label: s.label })),
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Admission & Disposition Card */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  <BedDouble className="h-4 w-4 text-primary-700" />
                  Admission & Disposition
                </h3>
                <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Find admitted patients, discharges, or specific dispositions.</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Patient Type</label>
                      <SearchableDropdown
                        value={filters.patientType}
                        onChange={(val) => updateFilter('patientType', val)}
                        placeholder="All"
                        options={[
                          { value: 'all', label: 'All' },
                          { value: 'outpatient', label: 'Outpatient' },
                          { value: 'inpatient', label: 'Inpatient' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Was Admitted</label>
                      <SearchableDropdown
                        value={filters.wasAdmitted}
                        onChange={(val) => updateFilter('wasAdmitted', val)}
                        placeholder="Any"
                        options={[
                          { value: 'all', label: 'Any' },
                          { value: 'yes', label: 'Yes - Admitted' },
                          { value: 'no', label: 'No - Not Admitted' },
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Encounter Outcome</label>
                    <SearchableDropdown
                      value={filters.encounterOutcome}
                      onChange={(val) => updateFilter('encounterOutcome', val)}
                      placeholder="All Outcomes"
                      options={[
                        { value: 'all', label: 'All Outcomes' },
                        ...ENCOUNTER_OUTCOMES.map((o) => ({ value: o.value, label: o.label })),
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Discharge Status</label>
                    <SearchableDropdown
                      value={filters.dischargeStatus}
                      onChange={(val) => updateFilter('dischargeStatus', val)}
                      placeholder="Any"
                      options={[
                        { value: 'all', label: 'Any' },
                        { value: 'discharged', label: 'Discharged' },
                        { value: 'not_discharged', label: 'Not Yet Discharged' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                      Length of Stay (days)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={filters.losMin}
                        onChange={(e) => updateFilter('losMin', e.target.value)}
                        placeholder="Min"
                        min="0"
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        value={filters.losMax}
                        onChange={(e) => updateFilter('losMax', e.target.value)}
                        placeholder="Max"
                        min="0"
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 3: A&E, ANC, Billing Extended ──────────────── */}
            <div className="grid grid-cols-3 gap-6 mt-6">
              {/* A&E Specific Card */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-orange-100">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-orange-100">
                  <Siren className="h-4 w-4 text-orange-600" />
                  A&E Specific
                </h3>
                <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Emergency-specific filters like triage category and arrival mode.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Triage Category</label>
                    <SearchableDropdown
                      value={filters.triageCategory}
                      onChange={(val) => updateFilter('triageCategory', val)}
                      placeholder="All Categories"
                      options={[
                        { value: 'all', label: 'All Triage Categories' },
                        ...TRIAGE_CATEGORIES.map((t) => ({ value: t.value, label: t.label })),
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Arrival Mode</label>
                    <SearchableDropdown
                      value={filters.arrivalMode}
                      onChange={(val) => updateFilter('arrivalMode', val)}
                      placeholder="All Modes"
                      options={[
                        { value: 'all', label: 'All Arrival Modes' },
                        ...ARRIVAL_MODES.map((m) => ({ value: m.value, label: m.label })),
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">A&E Disposition</label>
                    <SearchableDropdown
                      value={filters.aeDisposition}
                      onChange={(val) => updateFilter('aeDisposition', val)}
                      placeholder="All Dispositions"
                      options={[
                        { value: 'all', label: 'All Dispositions' },
                        ...AE_DISPOSITIONS.map((d) => ({ value: d.value, label: d.label })),
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* ANC Specific Card */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-pink-100">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-pink-100">
                  <Baby className="h-4 w-4 text-pink-600" />
                  Antenatal Care (ANC)
                </h3>
                <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Filter by ANC visit number and pregnancy-related details.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">ANC Visit Number</label>
                    <input
                      type="number"
                      value={filters.ancVisitNumber}
                      onChange={(e) => updateFilter('ancVisitNumber', e.target.value)}
                      placeholder="e.g. 1, 2, 3..."
                      min="1"
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200 placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                      Gestational Age (weeks)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={filters.gestationalAgeMin}
                        onChange={(e) => updateFilter('gestationalAgeMin', e.target.value)}
                        placeholder="Min"
                        min="0"
                        max="45"
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        value={filters.gestationalAgeMax}
                        onChange={(e) => updateFilter('gestationalAgeMax', e.target.value)}
                        placeholder="Max"
                        min="0"
                        max="45"
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Has Treatment Plan</label>
                    <SearchableDropdown
                      value={filters.hasTreatmentPlan}
                      onChange={(val) => updateFilter('hasTreatmentPlan', val)}
                      placeholder="Any"
                      options={[
                        { value: 'all', label: 'Any' },
                        { value: 'yes', label: 'Has Treatment Plan' },
                        { value: 'no', label: 'No Treatment Plan' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Billing Extended Card */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  <CreditCard className="h-4 w-4 text-primary-700" />
                  Billing Details
                </h3>
                <p className="text-[10px] italic text-indigo-500/70 mb-2 -mt-2">Filter by total charges, outstanding balance, or billing type.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                      Billing Amount Range (₦)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={filters.billingAmountMin}
                        onChange={(e) => updateFilter('billingAmountMin', e.target.value)}
                        placeholder="Min"
                        min="0"
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        value={filters.billingAmountMax}
                        onChange={(e) => updateFilter('billingAmountMax', e.target.value)}
                        placeholder="Max"
                        min="0"
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                      Waiting Time Range (minutes)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={filters.waitingTimeMin}
                        onChange={(e) => updateFilter('waitingTimeMin', e.target.value)}
                        placeholder="Min"
                        min="0"
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        value={filters.waitingTimeMax}
                        onChange={(e) => updateFilter('waitingTimeMax', e.target.value)}
                        placeholder="Max"
                        min="0"
                        className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-8 py-4">
            <div className="flex items-center justify-between">
              {/* Left side - Export options */}
              <div className="flex items-center gap-3">
                {onExport && (
                  <button
                    onClick={onExport}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Export Data
                  </button>
                )}
                {onGenerateReport && (
                  <button
                    onClick={onGenerateReport}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                  >
                    <BookOpen className="h-4 w-4" />
                    Generate Report
                  </button>
                )}
              </div>

              {/* Right side - Main actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onClearFilters}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onApplyFilters();
                    onClose();
                  }}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-primary-700 hover:bg-primary-800 rounded-xl transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Apply {activeFilterCount > 0
                    ? `(${activeFilterCount})`
                    : ''}{' '}
                  Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ComprehensiveEncounterFilterPanel;
