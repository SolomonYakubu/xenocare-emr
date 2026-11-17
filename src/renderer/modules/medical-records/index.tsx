/**
 * =============================================================================
 * XENOCARE EMR - UNIFIED MEDICAL RECORDS MODULE
 *
 * Entry point for all clinicians to access patient medical records.
 * Shows ALL patients with encounters from ANY clinic:
 * - GOPD, Dental, Ophthalmology, Physiotherapy, Radiology, Lab, etc.
 *
 * This is the SHARED ASSET - accessible to all clinical staff.
 * Clicking any patient opens the EncounterCentricView with full history.
 * =============================================================================
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FolderHeart,
  User,
  Calendar,
  CreditCard,
  ChevronRight,
  Clock,
  History,
  Building2,
  Phone,
  FileText,
  Loader2,
  AlertTriangle,
  Filter,
  RefreshCw,
  Users,
  Stethoscope,
  Eye,
  Smile,
  HeartPulse,
  FlaskConical,
  Scan,
  Activity,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ExternalLink,
  Info,
  HelpCircle,
  X,
  CheckSquare,
  Square,
  Download,
  Printer,
  FileDown,
  SlidersHorizontal,
  RotateCcw,
  Shield,
  Heart,
  Briefcase,
  GraduationCap,
  Hash,
  MapPin,
  Droplet,
  Check,
  FileSpreadsheet,
  Tag,
  Zap,
} from 'lucide-react';
import {
  format,
  formatDistanceToNow,
  parseISO,
  subDays,
  subMonths,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Select } from '../../components/ui/FormElements';
import { Card, EmptyState, DataTable } from '../../components/ui/DataDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { useTimeTheme } from '../../hooks/useTimeTheme';
import { supabase } from '../../api/supabaseClient';
import { createScopedLogger } from '../../utils/logger';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
// import jsPDF from 'jspdf';
// import 'jspdf-autotable';

const log = createScopedLogger('MedicalRecords');

// =============================================================================
// Database Hooks for Filter Dropdowns
// =============================================================================

// Hook to fetch HMOs from database
function useHMOs() {
  return useQuery({
    queryKey: ['nhis_hmos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nhis_hmos')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to fetch courses from database
function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, course_name, course_number, is_active')
        .order('course_number', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to fetch unique units from patients table
function useUnits() {
  return useQuery({
    queryKey: ['patient_units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('unit')
        .not('unit', 'is', null)
        .not('unit', 'eq', '');
      if (error) throw error;
      // Get unique units
      const uniqueUnits = [
        ...new Set(data?.map((p) => p.unit).filter(Boolean)),
      ].sort();
      return uniqueUnits;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to fetch unique titles from patients table
function useTitles() {
  return useQuery({
    queryKey: ['patient_titles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('title')
        .not('title', 'is', null)
        .not('title', 'eq', '');
      if (error) throw error;
      // Get unique titles
      const uniqueTitles = [
        ...new Set(data?.map((p) => p.title).filter(Boolean)),
      ].sort();
      return uniqueTitles;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// =============================================================================
// Types
// =============================================================================

interface PatientWithEncounters {
  id: string;
  emr_number: string;
  first_name: string;
  surname: string;
  middle_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  contact_phone: string | null;
  patient_category: string | null;
  insurance_type: string | null;
  blood_group: string | null;
  service_number: string | null;
  rank: string | null;
  status: string | null;
  total_encounters: number;
  last_encounter_date: string | null;
  last_encounter_type: string | null;
  last_department: string | null;
  departments_visited: string[];
}

type DateFilter = 'today' | 'week' | 'month' | '3months' | 'year' | 'all';
type DepartmentFilter =
  | 'all'
  | 'gopd'
  | 'dental'
  | 'ophthalmology'
  | 'physiotherapy'
  | 'inpatient'
  | 'cardiology'
  | 'ent'
  | 'orthopaedics'
  | 'dermatology'
  | 'urology'
  | 'neurology'
  | 'neuropsychiatry'
  | 'paediatrics'
  | 'gynaecology'
  | 'general_surgery'
  | 'psychiatry'
  | 'oncology'
  | string;
type PatientCategory =
  | 'all'
  | 'Military'
  | 'Civilian'
  | 'Military Participant'
  | 'Civilian Participant'
  | 'Security Services'
  | 'Dependent'
  | 'Retired';
type InsuranceType =
  | 'all'
  | 'Private'
  | 'Military_NHIS'
  | 'Civilian_NHIS'
  | 'GIFSHIP'
  | 'Security_Services_NHIS'
  | 'Retainership'
  | 'none';
type GenderFilter = 'all' | 'Male' | 'Female';
type AgeRangeFilter = 'all' | '0-18' | '19-35' | '36-50' | '51-65' | '65+';
type BloodGroupFilter =
  | 'all'
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';
type RecordStatusFilter = 'all' | 'active' | 'discharged' | 'pending';

// Interface for selected patients for batch operations
interface SelectedPatientsState {
  ids: Set<string>;
  selectAll: boolean;
}

// Comprehensive filter state
interface ComprehensiveFilters {
  dateFilter: DateFilter;
  deptFilter: DepartmentFilter;
  categoryFilter: PatientCategory;
  insuranceFilter: InsuranceType;
  genderFilter: GenderFilter;
  ageRangeFilter: AgeRangeFilter;
  bloodGroupFilter: BloodGroupFilter;
  statusFilter: RecordStatusFilter;
}

// Extended comprehensive filter state for modal - aligned with EncounterCentricView
interface MedicalRecordsFilters {
  // Search filters
  searchQuery: string;
  patientName: string;
  emrNumber: string;
  serviceNumber: string;
  phone: string;

  // Date filters
  dateFrom: string;
  dateTo: string;
  registrationDateFrom: string;
  registrationDateTo: string;

  // Status & Type
  encounterStatus: string;
  visitType: string;
  priority: string;

  // Department & Location
  department: DepartmentFilter;
  clinicId: string;

  // Patient Category
  patientCategory: PatientCategory;
  insuranceType: InsuranceType;
  hmo: string;
  paymentCategory: string;

  // Demographics
  gender: GenderFilter;
  ageRangeMin: string;
  ageRangeMax: string;
  bloodGroup: BloodGroupFilter;

  // Military/Participant
  armOfService: string;
  personnelCategory: string;
  rank: string;
  course: string;
  title: string;
  unit: string;

  // Clinical filters
  hasDiagnosis: string;
  hasPrescriptions: string;
  hasLabResults: string;
  hasRadiology: string;
  hasVitals: string;

  // Record Activity
  hasActiveEncounter: string;
  totalVisitsMin: string;
  totalVisitsMax: string;
}

const defaultMedicalRecordsFilters: MedicalRecordsFilters = {
  searchQuery: '',
  patientName: '',
  emrNumber: '',
  serviceNumber: '',
  phone: '',
  dateFrom: '',
  dateTo: '',
  registrationDateFrom: '',
  registrationDateTo: '',
  encounterStatus: 'all',
  visitType: 'all',
  priority: 'all',
  department: 'all',
  clinicId: 'all',
  patientCategory: 'all',
  insuranceType: 'all',
  hmo: 'all',
  paymentCategory: 'all',
  gender: 'all',
  ageRangeMin: '',
  ageRangeMax: '',
  bloodGroup: 'all',
  armOfService: 'all',
  personnelCategory: 'all',
  rank: 'all',
  course: 'all',
  title: 'all',
  unit: 'all',
  hasDiagnosis: 'all',
  hasPrescriptions: 'all',
  hasLabResults: 'all',
  hasRadiology: 'all',
  hasVitals: 'all',
  hasActiveEncounter: 'all',
  totalVisitsMin: '',
  totalVisitsMax: '',
};

// =============================================================================
// Comprehensive Filter Modal Component
// =============================================================================

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: MedicalRecordsFilters;
  onFiltersChange: (filters: MedicalRecordsFilters) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onExport?: (format: 'csv' | 'pdf') => void;
}

// Patient Categories
const PATIENT_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'Military', label: 'Military Personnel' },
  { value: 'Military Participant', label: 'Military Participant' },
  { value: 'Civilian', label: 'Civilian' },
  { value: 'Civilian Participant', label: 'Civilian Participant' },
  { value: 'Security Services', label: 'Security Services' },
  { value: 'Dependent', label: 'Dependent (Family)' },
  { value: 'Retired', label: 'Retired Personnel' },
];

// Insurance Types
const INSURANCE_TYPES = [
  { value: 'all', label: 'All Insurance Types' },
  { value: 'Military_NHIS', label: 'Military NHIS' },
  { value: 'Civilian_NHIS', label: 'Civilian NHIS' },
  { value: 'GIFSHIP', label: 'GIFSHIP' },
  { value: 'Security_Services_NHIS', label: 'Security Services NHIS' },
  { value: 'Retainership', label: 'Retainership' },
  { value: 'Private', label: 'Private Insurance' },
  { value: 'none', label: 'No Insurance (Self-Pay)' },
];

// Departments
const DEPARTMENTS = [
  { value: 'all', label: 'All Departments' },
  { value: 'gopd', label: 'General Out-Patient (GOPD)' },
  { value: 'dental', label: 'Dental' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'physiotherapy', label: 'Physiotherapy' },
  { value: 'inpatient', label: 'Inpatient' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'pharmacy', label: 'Pharmacy' },
];

// Arms of Service
const ARMS_OF_SERVICE = [
  { value: 'all', label: 'All Services' },
  { value: 'Army', label: 'Nigerian Army' },
  { value: 'Navy', label: 'Nigerian Navy' },
  { value: 'Airforce', label: 'Nigerian Airforce' },
];

// Personnel Category by Arm of Service
const PERSONNEL_CATEGORIES_BY_SERVICE: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  all: [{ value: 'all', label: 'All Categories' }],
  Army: [
    { value: 'all', label: 'All Categories' },
    { value: 'Officer', label: 'Officer' },
    { value: 'Soldier', label: 'Soldier' },
  ],
  Navy: [
    { value: 'all', label: 'All Categories' },
    { value: 'Officer', label: 'Officer' },
    { value: 'Rating', label: 'Rating' },
  ],
  Airforce: [
    { value: 'all', label: 'All Categories' },
    { value: 'Officer', label: 'Officer' },
    { value: 'Airman', label: 'Airman' },
  ],
};

// Nigerian Military Ranks by Service and Personnel Category
const MILITARY_RANKS_BY_SERVICE_CATEGORY: Record<
  string,
  Record<string, string[]>
> = {
  Army: {
    Officer: [
      'Gen',
      'Lt Gen',
      'Maj Gen',
      'Brig Gen',
      'Col',
      'Lt Col',
      'Maj',
      'Capt',
      'Lt',
      '2Lt',
    ],
    Soldier: ['AWO', 'MWO', 'WO', 'SSGT', 'SGT', 'Cpl', 'LCpl', 'Pte'],
  },
  Navy: {
    Officer: [
      'Adm',
      'V Adm',
      'R Adm',
      'Cdre',
      'Capt (NN)',
      'Cdr',
      'Lt Cdr',
      'Lt',
      'SLt',
    ],
    Rating: ['NWO', 'MWO', 'WO', 'PO', 'LS', 'AB', 'SM', 'OS'],
  },
  Airforce: {
    Officer: [
      'Air Chf Mshl',
      'Air Mshl',
      'AVM',
      'Air Cdre',
      'Gp Capt',
      'Wg Cdr',
      'Sqn Ldr',
      'Flt Lt',
      'Fg Offr',
    ],
    Airman: ['AWO', 'MWO', 'WO', 'FS', 'Sgt', 'Cpl', 'LCpl', 'ACM'],
  },
};

// Helper function to get rank options based on service and category
const getRankOptions = (
  armOfService: string,
  personnelCategory: string,
): Array<{ value: string; label: string }> => {
  const options: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All Ranks' },
  ];

  if (armOfService === 'all') {
    // Return all ranks from all services
    Object.values(MILITARY_RANKS_BY_SERVICE_CATEGORY).forEach(
      (serviceRanks) => {
        Object.values(serviceRanks).forEach((ranks) => {
          ranks.forEach((rank) => {
            if (!options.find((o) => o.value === rank)) {
              options.push({ value: rank, label: rank });
            }
          });
        });
      },
    );
    return options;
  }

  const serviceRanks = MILITARY_RANKS_BY_SERVICE_CATEGORY[armOfService];
  if (!serviceRanks) return options;

  if (personnelCategory === 'all') {
    // Return all ranks for the selected service
    Object.values(serviceRanks).forEach((ranks) => {
      ranks.forEach((rank) => {
        options.push({ value: rank, label: rank });
      });
    });
  } else {
    // Return ranks for specific category
    const ranks = serviceRanks[personnelCategory] || [];
    ranks.forEach((rank) => {
      options.push({ value: rank, label: rank });
    });
  }

  return options;
};

// Blood Groups
const BLOOD_GROUPS = [
  { value: 'all', label: 'All Blood Groups' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

// Age Ranges
const AGE_RANGES = [
  { value: 'all', label: 'All Ages' },
  { value: '0-18', label: 'Children (0-18)', min: 0, max: 18 },
  { value: '19-35', label: 'Young Adults (19-35)', min: 19, max: 35 },
  { value: '36-50', label: 'Adults (36-50)', min: 36, max: 50 },
  { value: '51-65', label: 'Middle Age (51-65)', min: 51, max: 65 },
  { value: '65+', label: 'Senior (65+)', min: 65, max: 150 },
];

// Record Status Options
const RECORD_STATUS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active Records' },
  { value: 'inactive', label: 'Inactive Records' },
];

// Encounter Status Options (aligned with EncounterCentricView)
const ENCOUNTER_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Discharged', label: 'Discharged' },
  { value: 'Cancelled', label: 'Cancelled' },
];

// Visit Types (aligned with EncounterCentricView)
const VISIT_TYPES = [
  { value: 'all', label: 'All Visit Types' },
  { value: 'New', label: 'New Visit' },
  { value: 'Follow-up', label: 'Follow-up' },
  { value: 'Emergency', label: 'Emergency' },
  { value: 'Routine', label: 'Routine Checkup' },
  { value: 'Referral', label: 'Referral' },
];

// Priority Levels (aligned with EncounterCentricView)
const PRIORITY_LEVELS = [
  { value: 'all', label: 'All Priorities' },
  { value: 'Emergency', label: 'Emergency' },
  { value: 'Urgent', label: 'Urgent' },
  { value: 'Normal', label: 'Normal' },
];

// Payment Categories
const PAYMENT_CATEGORIES = [
  { value: 'all', label: 'All Payment Types' },
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Self-Pay', label: 'Self-Pay' },
  { value: 'Free', label: 'Free/Waived' },
];

function MedicalRecordsFilterModal({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  onExport,
}: FilterModalProps) {
  // Fetch data from database for dropdowns
  const { data: hmos = [] } = useHMOs();
  const { data: courses = [] } = useCourses();
  const { data: units = [] } = useUnits();
  const { data: titles = [] } = useTitles();

  const updateFilter = <K extends keyof MedicalRecordsFilters>(
    key: K,
    value: MedicalRecordsFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Handler for Arm of Service change - resets dependent fields
  const handleArmOfServiceChange = (newArmOfService: string) => {
    onFiltersChange({
      ...filters,
      armOfService: newArmOfService,
      personnelCategory: 'all',
      rank: 'all',
    });
  };

  // Handler for Personnel Category change - resets dependent rank field
  const handlePersonnelCategoryChange = (newCategory: string) => {
    onFiltersChange({
      ...filters,
      personnelCategory: newCategory,
      rank: 'all',
    });
  };

  // Handler for Patient Category change - resets military/participant specific fields
  const handlePatientCategoryChange = (newCategory: string) => {
    const updates: Partial<MedicalRecordsFilters> = {
      patientCategory: newCategory as PatientCategory,
    };
    // Reset category-specific filters when category changes
    if (newCategory !== 'Military' && newCategory !== 'Military Participant') {
      updates.armOfService = 'all';
      updates.personnelCategory = 'all';
      updates.rank = 'all';
    }
    if (
      newCategory !== 'Military Participant' &&
      newCategory !== 'Civilian Participant'
    ) {
      updates.course = 'all';
      updates.title = 'all';
    }
    onFiltersChange({ ...filters, ...updates });
  };

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (
        [
          'searchQuery',
          'patientName',
          'emrNumber',
          'serviceNumber',
          'phone',
          'dateFrom',
          'dateTo',
          'registrationDateFrom',
          'registrationDateTo',
          'ageRangeMin',
          'ageRangeMax',
          'totalVisitsMin',
          'totalVisitsMax',
        ].includes(key)
      ) {
        return value !== '';
      }
      return value !== 'all' && value !== '';
    }).length;
  }, [filters]);

  // Quick filter presets (aligned with EncounterCentricView patterns)
  const applyPreset = (preset: string) => {
    const newFilters = { ...defaultMedicalRecordsFilters };
    const today = new Date();

    switch (preset) {
      case 'activeEncounters':
        newFilters.hasActiveEncounter = 'yes';
        break;
      case 'militaryPersonnel':
        newFilters.patientCategory = 'Military';
        break;
      case 'nhisPatients':
        newFilters.insuranceType = 'Civilian_NHIS';
        break;
      case 'militaryNhisPatients':
        newFilters.insuranceType = 'Military_NHIS';
        break;
      case 'dependents':
        newFilters.patientCategory = 'Dependent';
        break;
      case 'participants':
        newFilters.patientCategory = 'Military Participant';
        break;
      case 'withDiagnosis':
        newFilters.hasDiagnosis = 'yes';
        break;
      case 'withLabResults':
        newFilters.hasLabResults = 'yes';
        break;
      case 'recentVisits':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        newFilters.dateFrom = weekAgo.toISOString().split('T')[0];
        newFilters.dateTo = today.toISOString().split('T')[0];
        break;
    }

    onFiltersChange(newFilters);
  };

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

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay with backdrop blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Centered Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100">
          {/* Header - Matching EncounterCentricView Style */}
          <div className="flex-shrink-0 bg-gradient-to-r from-primary-700 to-[#008545]">
            <div className="flex items-center justify-between px-8 py-5">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <SlidersHorizontal className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Advanced Filter & Search
                  </h2>
                  <p className="text-white/80 text-sm">
                    Filter patient records for EncounterCentricView
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

            {/* Quick Filter Presets - Matching EncounterCentricView */}
            <div className="px-8 py-3 bg-white/10 border-t border-white/20">
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Quick Filters:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      key: 'activeEncounters',
                      label: 'Active Encounters',
                      icon: Activity,
                    },
                    {
                      key: 'militaryPersonnel',
                      label: 'Military',
                      icon: Shield,
                    },
                    { key: 'nhisPatients', label: 'NHIS', icon: Heart },
                    {
                      key: 'militaryNhisPatients',
                      label: 'Military NHIS',
                      icon: Shield,
                    },
                    {
                      key: 'participants',
                      label: 'Participants',
                      icon: GraduationCap,
                    },
                    {
                      key: 'withDiagnosis',
                      label: 'With Diagnosis',
                      icon: Stethoscope,
                    },
                    {
                      key: 'withLabResults',
                      label: 'With Labs',
                      icon: FlaskConical,
                    },
                    {
                      key: 'recentVisits',
                      label: 'Recent (7 Days)',
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

          {/* Filter Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {/* Unified Search & Header Controls */}
            <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Global search - patient name, EMR number, phone, diagnosis..."
                      value={filters.searchQuery}
                      onChange={(e) =>
                        updateFilter('searchQuery', e.target.value)
                      }
                      className="w-full pl-12 pr-4 py-3.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 focus:bg-white transition-all duration-200"
                    />
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
                      <RotateCcw className="h-4 w-4" />
                      Clear
                    </button>
                  </div>
                </div>

                {/* Date Controls moved to header for visibility */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 w-24">
                        <Calendar className="h-4 w-4 text-primary-700" />
                        Timeline:
                      </div>
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) =>
                            updateFilter('dateFrom', e.target.value)
                          }
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) =>
                            updateFilter('dateTo', e.target.value)
                          }
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
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
                          className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-primary-700/10 hover:text-primary-700 rounded-lg transition-colors border border-gray-200"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Grid - 3 Columns */}
            <div className="grid grid-cols-3 gap-6">
              {/* Column 1: Patient Background & Admin */}
              <div className="space-y-4">
                {/* Identity & Demographics */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <Users className="h-4 w-4 text-primary-700" />
                    Patient Background
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Gender
                      </label>
                      <select
                        value={filters.gender}
                        onChange={(e) =>
                          updateFilter('gender', e.target.value as GenderFilter)
                        }
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                      >
                        <option value="all">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Age Range
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="Min age"
                          value={filters.ageRangeMin}
                          onChange={(e) =>
                            updateFilter('ageRangeMin', e.target.value)
                          }
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
                        />
                        <input
                          type="number"
                          placeholder="Max age"
                          value={filters.ageRangeMax}
                          onChange={(e) =>
                            updateFilter('ageRangeMax', e.target.value)
                          }
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Blood Group
                      </label>
                      <select
                        value={filters.bloodGroup}
                        onChange={(e) =>
                          updateFilter(
                            'bloodGroup',
                            e.target.value as BloodGroupFilter,
                          )
                        }
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                      >
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg.value} value={bg.value}>
                            {bg.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Insurance & Billing */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <Heart className="h-4 w-4 text-primary-700" />
                    Insurance & Billing
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Insurance Type
                      </label>
                      <select
                        value={filters.insuranceType}
                        onChange={(e) =>
                          updateFilter(
                            'insuranceType',
                            e.target.value as InsuranceType,
                          )
                        }
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                      >
                        {INSURANCE_TYPES.map((ins) => (
                          <option key={ins.value} value={ins.value}>
                            {ins.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        HMO
                      </label>
                      <select
                        value={filters.hmo}
                        onChange={(e) => updateFilter('hmo', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                      >
                        <option value="all">All HMOs</option>
                        {hmos.map((hmo) => (
                          <option key={hmo.id} value={hmo.name}>
                            {hmo.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Service & Classification */}
              <div className="space-y-4">
                {/* Main Classification */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <Shield className="h-4 w-4 text-primary-700" />
                    Classification
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Patient Category
                      </label>
                      <select
                        value={filters.patientCategory}
                        onChange={(e) =>
                          handlePatientCategoryChange(e.target.value)
                        }
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                      >
                        {PATIENT_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Service Unit / Formation
                      </label>
                      <select
                        value={filters.unit}
                        onChange={(e) => updateFilter('unit', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                      >
                        <option value="all">All Units</option>
                        {units.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Military Details - Conditional */}
                {(filters.patientCategory === 'Military' ||
                  filters.patientCategory === 'Military Participant' ||
                  filters.patientCategory === 'all') && (
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-primary-700/20 bg-primary-700/5">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-primary-700/10">
                      <Zap className="h-4 w-4 text-primary-700" />
                      Military Service Details
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                            Arm of Service
                          </label>
                          <select
                            value={filters.armOfService}
                            onChange={(e) =>
                              handleArmOfServiceChange(e.target.value)
                            }
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                          >
                            {ARMS_OF_SERVICE.map((arm) => (
                              <option key={arm.value} value={arm.value}>
                                {arm.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                            Branch
                          </label>
                          <select
                            value={filters.personnelCategory}
                            onChange={(e) =>
                              handlePersonnelCategoryChange(e.target.value)
                            }
                            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                          >
                            {(
                              PERSONNEL_CATEGORIES_BY_SERVICE[
                                filters.armOfService
                              ] || PERSONNEL_CATEGORIES_BY_SERVICE.all
                            ).map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                          Rank
                        </label>
                        <select
                          value={filters.rank}
                          onChange={(e) => updateFilter('rank', e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                        >
                          {getRankOptions(
                            filters.armOfService,
                            filters.personnelCategory,
                          ).map((rank) => (
                            <option key={rank.value} value={rank.value}>
                              {rank.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Participant Details - Conditional */}
                {(filters.patientCategory === 'Military Participant' ||
                  filters.patientCategory === 'Civilian Participant' ||
                  filters.patientCategory === 'all') && (
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100 bg-blue-50/30">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-blue-100">
                      <GraduationCap className="h-4 w-4 text-blue-600" />
                      NDC Participant Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                          Active Course
                        </label>
                        <select
                          value={filters.course}
                          onChange={(e) =>
                            updateFilter('course', e.target.value)
                          }
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                        >
                          <option value="all">All Courses</option>
                          {courses.map((course) => (
                            <option key={course.id} value={course.course_name}>
                              {course.course_name}{' '}
                              {course.course_number
                                ? `(${course.course_number})`
                                : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                          Professional Title
                        </label>
                        <select
                          value={filters.title}
                          onChange={(e) =>
                            updateFilter('title', e.target.value)
                          }
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                        >
                          <option value="all">All Titles</option>
                          {titles.map((title) => (
                            <option key={title} value={title}>
                              {title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 3: Encounter & Activity */}
              <div className="space-y-4">
                {/* Workflow Status */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <Activity className="h-4 w-4 text-primary-700" />
                    Encounter & Workflow
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Status
                      </label>
                      <select
                        value={filters.encounterStatus}
                        onChange={(e) =>
                          updateFilter('encounterStatus', e.target.value)
                        }
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                      >
                        {ENCOUNTER_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                          Visit Type
                        </label>
                        <select
                          value={filters.visitType}
                          onChange={(e) =>
                            updateFilter('visitType', e.target.value)
                          }
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                        >
                          {VISIT_TYPES.map((vt) => (
                            <option key={vt.value} value={vt.value}>
                              {vt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                          Priority
                        </label>
                        <select
                          value={filters.priority}
                          onChange={(e) =>
                            updateFilter('priority', e.target.value)
                          }
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                        >
                          {PRIORITY_LEVELS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
                        Target Department
                      </label>
                      <select
                        value={filters.department}
                        onChange={(e) =>
                          updateFilter(
                            'department',
                            e.target.value as DepartmentFilter,
                          )
                        }
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                      >
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept.value} value={dept.value}>
                            {dept.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Clinical Content Flags */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                    <FileText className="h-4 w-4 text-primary-700" />
                    Clinical Record Flags
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { label: 'Has Diagnosis', key: 'hasDiagnosis' },
                      { label: 'Has Vitals', key: 'hasVitals' },
                      { label: 'Has Prescriptions', key: 'hasPrescriptions' },
                      { label: 'Has Lab Results', key: 'hasLabResults' },
                      { label: 'Has Radiology', key: 'hasRadiology' },
                    ].map((flag) => (
                      <div
                        key={flag.key}
                        className="flex items-center justify-between"
                      >
                        <label className="text-xs text-gray-600 font-medium">
                          {flag.label}
                        </label>
                        <select
                          value={(filters as any)[flag.key]}
                          onChange={(e) =>
                            updateFilter(flag.key as any, e.target.value)
                          }
                          className="w-32 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
                        >
                          <option value="all">Any</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-8 py-4">
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onApplyFilters();
                  onClose();
                }}
                className="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// Stats Cards Component
// =============================================================================

function StatsCards({ stats }: { stats: any }) {
  const cards = [
    { label: 'Total patients', value: stats?.totalPatients || 0 },
    { label: 'Outpatient visits', value: stats?.gopdCount || 0 },
    {
      label: 'Specialty visits',
      value:
        (stats?.dentalCount || 0) +
        (stats?.ophthalCount || 0) +
        (stats?.physioCount || 0),
    },
    { label: "Today's records", value: stats?.todayCount || 0 },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3"
        >
          <p className="text-xs font-medium text-slate-500">{card.label}</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Export Modal Component (with Patient Selection)
// =============================================================================

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientWithEncounters[];
  activeFilters: MedicalRecordsFilters;
  activeFilterCount: number;
}

function MedicalRecordsExportModal({
  isOpen,
  onClose,
  patients,
  activeFilters,
  activeFilterCount,
}: ExportModalProps) {
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'excel'>(
    'pdf',
  );
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(
    new Set(),
  );
  const [selectAllForExport, setSelectAllForExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedForExport(new Set());
      setSelectAllForExport(false);
    }
  }, [isOpen]);

  const handleSelectAllForExport = () => {
    if (selectAllForExport) {
      setSelectedForExport(new Set());
      setSelectAllForExport(false);
    } else {
      setSelectedForExport(new Set(patients.map((p) => p.id)));
      setSelectAllForExport(true);
    }
  };

  const handlePatientExportSelect = (patientId: string) => {
    const newSelected = new Set(selectedForExport);
    if (newSelected.has(patientId)) {
      newSelected.delete(patientId);
      setSelectAllForExport(false);
    } else {
      newSelected.add(patientId);
      if (newSelected.size === patients.length) {
        setSelectAllForExport(true);
      }
    }
    setSelectedForExport(newSelected);
  };

  const handleExport = async () => {
    if (selectedForExport.size === 0) {
      alert('Please select at least one patient to export.');
      return;
    }

    setIsExporting(true);
    try {
      // Get selected patients data
      const selectedPatients = patients.filter((p) =>
        selectedForExport.has(p.id),
      );

      if (exportFormat === 'pdf') {
        const { default: jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF();

        doc.text('Patient Medical Records', 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);

        const tableColumn = [
          'Patient ID',
          'Name',
          'Gender',
          'Date of Birth',
          'Phone Number',
        ];
        const tableRows: (string | null | undefined)[][] = [];

        selectedPatients.forEach((patient) => {
          const patientData: (string | null | undefined)[] = [
            patient.emr_number,
            `${patient.first_name} ${patient.surname}`,
            patient.gender,
            patient.date_of_birth
              ? new Date(patient.date_of_birth).toLocaleDateString()
              : 'N/A',
            patient.contact_phone,
          ];
          tableRows.push(patientData);
        });

        (autoTable as any)(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 30,
        });

        doc.save('patient-records.pdf');

        alert(`Exported ${selectedPatients.length} patient record(s) to PDF.`);
      } else {
        log.info('Patient record export requested', {
          format: exportFormat,
          selectedCount: selectedPatients.length,
        });
        // TODO: Implement actual export logic for other formats
        alert(
          `Export initiated for ${selectedPatients.length} patient record(s) as ${exportFormat.toUpperCase()}.`,
        );
      }

      onClose();
    } catch (error) {
      log.error('Patient record export failed', error, {
        format: exportFormat,
        selectedCount: selectedPatients.length,
      });
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Download className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Export Patient Records
                  </h2>
                  <p className="text-white/80 text-sm">
                    {patients.length} patient{patients.length !== 1 ? 's' : ''}{' '}
                    matching current filters
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Active Filters Summary */}
          {activeFilterCount > 0 && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-blue-600" />
                <span className="text-xs font-medium text-blue-800">
                  Filtered by {activeFilterCount} criteria - only filtered
                  records will be exported
                </span>
              </div>
            </div>
          )}

          {/* Format Selection */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Format
            </label>
            <div className="flex gap-3">
              {[
                { value: 'pdf', label: 'PDF', icon: FileDown, color: 'red' },
                {
                  value: 'excel',
                  label: 'Excel',
                  icon: FileSpreadsheet,
                  color: 'green',
                },
                { value: 'csv', label: 'CSV', icon: FileText, color: 'blue' },
              ].map((format) => (
                <button
                  key={format.value}
                  onClick={() => setExportFormat(format.value as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                    exportFormat === format.value
                      ? `border-${format.color}-500 bg-${format.color}-50 text-${format.color}-700`
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <format.icon size={18} />
                  {format.label}
                  {exportFormat === format.value && (
                    <Check size={16} className="ml-1" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Patient Selection */}
          <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAllForExport}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {selectAllForExport ? (
                    <CheckSquare size={16} className="text-green-600" />
                  ) : (
                    <Square size={16} className="text-gray-400" />
                  )}
                  {selectAllForExport ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-500">
                  {selectedForExport.size} of {patients.length} selected
                </span>
              </div>
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl">
              {patients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderHeart className="text-gray-300 mb-3" size={40} />
                  <p className="text-gray-500">
                    No patients match the current filters
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">
                        <button
                          onClick={handleSelectAllForExport}
                          className="p-1 rounded hover:bg-gray-200 transition-colors"
                        >
                          {selectAllForExport ? (
                            <CheckSquare size={16} className="text-green-600" />
                          ) : (
                            <Square size={16} className="text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        <div className="flex items-center gap-1">
                          Patient
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        <div className="flex items-center gap-1">
                          Category
                        </div>
                      </th>
                      
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                        <div className="flex items-center justify-center gap-1">
                          Visits
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        <div className="flex items-center gap-1">
                          Last Visit
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        <div className="flex items-center gap-1">
                          Last Dept
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-16">
                        <div className="flex items-center justify-center gap-1">
                          View
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {patients.map((patient) => {
                      const fullName = [
                        patient.first_name,
                        patient.middle_name,
                        patient.surname,
                      ]
                        .filter(Boolean)
                        .join(' ');
                      const isSelected = selectedForExport.has(patient.id);
                      return (
                        <tr
                          key={patient.id}
                          onClick={() => handlePatientExportSelect(patient.id)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-3">
                            {isSelected ? (
                              <CheckSquare
                                size={16}
                                className="text-green-600"
                              />
                            ) : (
                              <Square size={16} className="text-gray-400" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {fullName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {patient.emr_number}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">
                              {patient.patient_category || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-slate-900">
                            {patient.total_encounters}
                          </td>
                          <td className="px-4 py-3">
                            {patient.last_encounter_date ? (
                              <span className="text-sm text-gray-900">
                                {format(
                                  parseISO(patient.last_encounter_date),
                                  'dd MMM yyyy',
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="hidden px-4 py-3 xl:table-cell">
                            <span className="text-sm capitalize text-gray-700">
                              {patient.last_department || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePatientExportSelect(patient.id);
                              }}
                              className="p-2 rounded-lg hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                            >
                              <ExternalLink size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {selectedForExport.size > 0
                  ? `${selectedForExport.size} patient${selectedForExport.size !== 1 ? 's' : ''} will be exported`
                  : 'Select patients to export'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={selectedForExport.size === 0 || isExporting}
                  className={`flex items-center gap-2 px-5 py-2.5 font-medium rounded-xl transition-all ${
                    selectedForExport.size === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-slate-700 hover:bg-slate-800 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Export {exportFormat.toUpperCase()}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// Hooks
// =============================================================================

function usePatientsWithEncounters(filters: MedicalRecordsFilters) {
  return useQuery({
    queryKey: ['patients-with-encounters', filters],
    queryFn: async () => {
      // First, get ALL patients from patients table
      let patientsQuery = supabase
        .from('patients')
        .select(
          `
          id,
          emr_number,
          first_name,
          surname,
          middle_name,
          date_of_birth,
          gender,
          contact_phone,
          patient_category,
          insurance_type,
          blood_group,
          service_number,
          rank,
          status,
          arm_of_service,
          unit,
          course,
          title,
          payer_info
        `,
        )
        .order('created_at', { ascending: false });

      // Apply search filter at database level for efficiency
      if (filters.searchQuery && filters.searchQuery.length >= 2) {
        patientsQuery = patientsQuery.or(
          `first_name.ilike.%${filters.searchQuery}%,surname.ilike.%${filters.searchQuery}%,emr_number.ilike.%${filters.searchQuery}%,contact_phone.ilike.%${filters.searchQuery}%,service_number.ilike.%${filters.searchQuery}%`,
        );
      }

      // Apply patient category filter at database level
      if (filters.patientCategory !== 'all') {
        patientsQuery = patientsQuery.eq(
          'patient_category',
          filters.patientCategory,
        );
      }

      // Apply insurance type filter at database level
      if (filters.insuranceType !== 'all') {
        if (filters.insuranceType === 'none') {
          patientsQuery = patientsQuery.is('insurance_type', null);
        } else {
          patientsQuery = patientsQuery.eq(
            'insurance_type',
            filters.insuranceType,
          );
        }
      }

      // Apply gender filter at database level
      if (filters.gender !== 'all') {
        patientsQuery = patientsQuery.eq('gender', filters.gender);
      }

      // Apply blood group filter at database level
      if (filters.bloodGroup !== 'all') {
        patientsQuery = patientsQuery.eq('blood_group', filters.bloodGroup);
      }

      // Apply arm of service filter at database level (Military filters)
      if (filters.armOfService !== 'all') {
        patientsQuery = patientsQuery.eq(
          'arm_of_service',
          filters.armOfService,
        );
      }

      // Apply rank filter at database level
      if (filters.rank !== 'all') {
        patientsQuery = patientsQuery.eq('rank', filters.rank);
      }

      // Apply unit filter at database level
      if (filters.unit !== 'all') {
        patientsQuery = patientsQuery.eq('unit', filters.unit);
      }

      // Apply course filter at database level (NDC Participant filters)
      if (filters.course !== 'all') {
        patientsQuery = patientsQuery.eq('course', filters.course);
      }

      // Apply title filter at database level
      if (filters.title !== 'all') {
        patientsQuery = patientsQuery.eq('title', filters.title);
      }

      const { data: patientsData, error: patientsError } =
        await patientsQuery.limit(1000);
      if (patientsError) throw patientsError;

      // Apply filters that need in-memory processing
      let filteredPatients = patientsData || [];

      // Apply HMO filter (stored in payer_info JSONB)
      if (filters.hmo !== 'all') {
        filteredPatients = filteredPatients.filter((patient: any) => {
          const patientHMO = patient.payer_info?.scheme;
          return patientHMO === filters.hmo;
        });
      }

      // Apply age range filter (requires calculating age from DOB)
      if (filters.ageRangeMin || filters.ageRangeMax) {
        const now = new Date();
        const minAge = parseInt(filters.ageRangeMin) || 0;
        const maxAge = parseInt(filters.ageRangeMax) || 150;

        filteredPatients = filteredPatients.filter((patient: any) => {
          if (!patient.date_of_birth) return false;
          const dob = new Date(patient.date_of_birth);
          const age = Math.floor(
            (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
          );
          return age >= minAge && age <= maxAge;
        });
      }

      // Get encounter data from encounter_summary
      let encounterQuery = supabase
        .from('encounter_summary')
        .select(
          `
          encounter_id,
          patient_id,
          encounter_date,
          visit_type,
          current_stage
        `,
        )
        .order('encounter_date', { ascending: false });

      // Apply date filter to encounters using dateFrom/dateTo from filters
      if (filters.dateFrom) {
        encounterQuery = encounterQuery.gte('encounter_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        encounterQuery = encounterQuery.lte('encounter_date', filters.dateTo);
      }

      const { data: encounterData, error: encounterError } =
        await encounterQuery.limit(5000);
      if (encounterError) throw encounterError;

      // Build a map of patient encounters
      const encounterMap = new Map<
        string,
        {
          total: number;
          lastDate: string | null;
          lastType: string | null;
          lastDept: string | null;
          departments: string[];
        }
      >();

      encounterData?.forEach((enc: any) => {
        const patientId = enc.patient_id;

        if (!encounterMap.has(patientId)) {
          encounterMap.set(patientId, {
            total: 0,
            lastDate: null,
            lastType: null,
            lastDept: null,
            departments: [],
          });
        }

        const existing = encounterMap.get(patientId)!;
        existing.total++;

        // Track most recent encounter
        if (!existing.lastDate || enc.encounter_date > existing.lastDate) {
          existing.lastDate = enc.encounter_date;
          existing.lastType = enc.visit_type;
          existing.lastDept = enc.current_stage || enc.visit_type;
        }

        // Track unique visit types
        const visitType = enc.visit_type || enc.current_stage;
        if (visitType && !existing.departments.includes(visitType)) {
          existing.departments.push(visitType);
        }
      });

      // Combine patients with encounter data
      let results: PatientWithEncounters[] =
        filteredPatients?.map((patient: any) => {
          const encounters = encounterMap.get(patient.id);
          return {
            id: patient.id,
            emr_number: patient.emr_number,
            first_name: patient.first_name,
            surname: patient.surname,
            middle_name: patient.middle_name,
            date_of_birth: patient.date_of_birth,
            gender: patient.gender,
            contact_phone: patient.contact_phone,
            patient_category: patient.patient_category,
            insurance_type: patient.insurance_type,
            blood_group: patient.blood_group,
            service_number: patient.service_number,
            rank: patient.rank,
            status: patient.status,
            total_encounters: encounters?.total || 0,
            last_encounter_date: encounters?.lastDate || null,
            last_encounter_type: encounters?.lastType || null,
            last_department: encounters?.lastDept || null,
            departments_visited: encounters?.departments || [],
          };
        }) || [];

      // Apply department filter based on visit_type
      if (filters.department !== 'all') {
        const deptMap: Record<string, string[]> = {
          gopd: [
            'GOPD',
            'General Practice',
            'Outpatient',
            'Consultation',
            'Follow-up',
          ],
          dental: ['Dental'],
          ophthalmology: ['Ophthalmology', 'Eye'],
          physiotherapy: ['Physiotherapy', 'Physio'],
          inpatient: ['Inpatient', 'Admission', 'Ward'],
        };
        const allowedTypes = deptMap[filters.department] || [];
        results = results.filter((p) =>
          p.departments_visited.some((d) =>
            allowedTypes.some((t) => d.toLowerCase().includes(t.toLowerCase())),
          ),
        );
      }

      // Sort by last encounter date (patients with recent visits first), then by EMR number
      results.sort((a, b) => {
        // Patients with encounters come first
        if (a.total_encounters > 0 && b.total_encounters === 0) return -1;
        if (a.total_encounters === 0 && b.total_encounters > 0) return 1;

        // Then by last encounter date
        if (a.last_encounter_date && b.last_encounter_date) {
          return (
            new Date(b.last_encounter_date).getTime() -
            new Date(a.last_encounter_date).getTime()
          );
        }
        if (a.last_encounter_date) return -1;
        if (b.last_encounter_date) return 1;

        // Finally by EMR number
        return (a.emr_number || '').localeCompare(b.emr_number || '');
      });

      return results;
    },
    staleTime: 30000, // 30 seconds
  });
}

function useEncounterStats(dateFilter: DateFilter) {
  return useQuery({
    queryKey: ['encounter-stats', dateFilter],
    queryFn: async () => {
      let fromDate: Date | null = null;
      const now = new Date();

      switch (dateFilter) {
        case 'today':
          fromDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          fromDate = subDays(new Date(), 7);
          break;
        case 'month':
          fromDate = subMonths(new Date(), 1);
          break;
        case '3months':
          fromDate = subMonths(new Date(), 3);
          break;
        case 'year':
          fromDate = subMonths(new Date(), 12);
          break;
      }

      let query = supabase
        .from('encounter_summary')
        .select(
          'encounter_id, visit_type, encounter_date, patient_id, current_stage',
        );

      if (fromDate) {
        query = query.gte('encounter_date', fromDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const uniquePatients = new Set(data?.map((e) => e.patient_id));

      // Count by visit_type or current_stage
      const gopdCount =
        data?.filter((e) =>
          [
            'GOPD',
            'General Practice',
            'Outpatient',
            'Consultation',
            'Follow-up',
          ].some(
            (d) =>
              e.visit_type?.toLowerCase().includes(d.toLowerCase()) ||
              e.current_stage?.toLowerCase().includes(d.toLowerCase()),
          ),
        ).length || 0;

      const dentalCount =
        data?.filter(
          (e) =>
            e.visit_type?.toLowerCase().includes('dental') ||
            e.current_stage?.toLowerCase().includes('dental'),
        ).length || 0;

      const ophthalCount =
        data?.filter(
          (e) =>
            e.visit_type?.toLowerCase().includes('ophthal') ||
            e.current_stage?.toLowerCase().includes('ophthal') ||
            e.visit_type?.toLowerCase().includes('eye'),
        ).length || 0;

      const physioCount =
        data?.filter(
          (e) =>
            e.visit_type?.toLowerCase().includes('physio') ||
            e.current_stage?.toLowerCase().includes('physio'),
        ).length || 0;

      const todayCount =
        data?.filter((e) => new Date(e.encounter_date) >= today).length || 0;

      return {
        totalPatients: uniquePatients.size,
        gopdCount,
        dentalCount,
        ophthalCount,
        physioCount,
        todayCount,
      };
    },
    staleTime: 60000,
  });
}

// =============================================================================
// Department Badge Component
// =============================================================================

function DepartmentBadges({ departments }: { departments: string[] }) {
  const deptConfig: Record<string, { icon: any; color: string; bg: string }> = {
    gopd: {
      icon: Stethoscope,
      color: 'text-emerald-900',
      bg: 'bg-emerald-100',
    },
    dental: { icon: Smile, color: 'text-cyan-950', bg: 'bg-cyan-100' },
    ophthalmology: { icon: Eye, color: 'text-violet-900', bg: 'bg-violet-100' },
    physiotherapy: {
      icon: HeartPulse,
      color: 'text-rose-900',
      bg: 'bg-rose-100',
    },
    laboratory: {
      icon: FlaskConical,
      color: 'text-amber-950',
      bg: 'bg-amber-100',
    },
    radiology: { icon: Scan, color: 'text-indigo-950', bg: 'bg-indigo-100' },
  };

  const getDeptType = (dept: string): string => {
    const d = dept.toLowerCase();
    if (
      ['gopd', 'general practice', 'internal medicine', 'opd', 'family'].some(
        (x) => d.includes(x),
      )
    )
      return 'gopd';
    if (d.includes('dental')) return 'dental';
    if (d.includes('ophthal') || d.includes('eye')) return 'ophthalmology';
    if (d.includes('physio')) return 'physiotherapy';
    if (d.includes('lab')) return 'laboratory';
    if (d.includes('radio') || d.includes('imaging')) return 'radiology';
    return 'gopd';
  };

  // Get unique department types
  const uniqueTypes = [...new Set(departments.map(getDeptType))];

  return (
    <div className="flex flex-wrap gap-1">
      {uniqueTypes.slice(0, 3).map((type) => {
        const config = deptConfig[type] || deptConfig.gopd;
        const Icon = config.icon;
        return (
          <span
            key={type}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}
          >
            <Icon size={12} />
          </span>
        );
      })}
      {uniqueTypes.length > 3 && (
        <span className="text-xs text-gray-500">+{uniqueTypes.length - 3}</span>
      )}
    </div>
  );
}

// =============================================================================
// Patient Row Component
// =============================================================================

function PatientRow({
  patient,
  onClick,
  isSelected,
  onSelect,
  isNightMode = false,
}: {
  patient: PatientWithEncounters;
  onClick: () => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isNightMode?: boolean;
}) {
  const fullName = [patient.first_name, patient.middle_name, patient.surname]
    .filter(Boolean)
    .join(' ');

  const categoryColors: Record<string, string> = {
    Serving: 'bg-green-100 text-green-800',
    Retired: 'bg-blue-100 text-blue-800',
    Civilian: 'bg-gray-100 text-gray-800',
    Dependent: 'bg-purple-100 text-purple-800',
    NHIS: 'bg-orange-100 text-orange-800',
    Military: 'bg-green-100 text-green-800',
    'Military Participant': 'bg-teal-100 text-teal-800',
    'Civilian Participant': 'bg-indigo-100 text-indigo-800',
    'Security Services': 'bg-emerald-100 text-emerald-800',
  };
  const categoryColor =
    categoryColors[patient.patient_category || ''] ||
    'bg-gray-100 text-gray-600';

  return (
    <tr
      className={`transition-colors border-b ${
        isNightMode
          ? 'border-slate-800 hover:bg-slate-800/60'
          : 'border-gray-100 hover:bg-emerald-50/70'
      } ${isSelected ? (isNightMode ? 'bg-slate-800/80' : 'bg-[#FDF8F4]') : ''}`}
    >
      {/* Selection Checkbox */}
      <td className="px-3 py-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(patient.id);
          }}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
        >
          {isSelected ? (
            <CheckSquare size={18} className="text-[#E9783F]" />
          ) : (
            <Square size={18} className="text-gray-400" />
          )}
        </button>
      </td>

      {/* Patient Info */}
      <td className="px-3 py-3 cursor-pointer sm:px-4" onClick={onClick}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 max-w-full">
            <p
              className={`truncate font-semibold ${isNightMode ? 'text-slate-100' : 'text-slate-900'}`}
            >
              {fullName}
            </p>
            <div
              className={`flex flex-wrap items-center gap-2 text-xs ${isNightMode ? 'text-slate-400' : 'text-slate-500'}`}
            >
              <span>{patient.emr_number}</span>
              <span className="lg:hidden">
                · {patient.patient_category || '—'}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="hidden cursor-pointer px-4 py-3 lg:table-cell" onClick={onClick}>
        <span
          className={`text-sm ${isNightMode ? 'text-slate-300' : 'text-slate-600'}`}
        >
          {patient.patient_category || '—'}
        </span>
      </td>

      {/* Total Encounters */}
      <td className="px-4 py-3 text-center cursor-pointer" onClick={onClick}>
        <span
          className={`text-sm font-semibold ${isNightMode ? 'text-slate-100' : 'text-slate-900'}`}
        >
          {patient.total_encounters}
        </span>
      </td>

      {/* Last Visit */}
      <td className="hidden cursor-pointer px-4 py-3 xl:table-cell" onClick={onClick}>
        {patient.last_encounter_date ? (
          <span
            className={`text-sm ${isNightMode ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {format(parseISO(patient.last_encounter_date), 'dd MMM yyyy')}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      {/* Last Department */}
      <td className="hidden cursor-pointer px-4 py-3 xl:table-cell" onClick={onClick}>
        <span
          className={`text-sm ${isNightMode ? 'text-slate-200' : 'text-slate-700'}`}
        >
          {patient.last_department || '—'}
        </span>
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        <button
          onClick={onClick}
          className={`p-2 rounded-lg transition-colors ${
            isNightMode
              ? 'text-slate-500 hover:bg-slate-800 hover:text-emerald-400'
              : 'text-slate-400 hover:bg-emerald-100 hover:text-primary-700'
          }`}
        >
          <ExternalLink size={18} />
        </button>
      </td>
    </tr>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function MedicalRecordsModule() {
  const navigate = useNavigate();
  const { staff } = useAuth();
  const { colors: themeColors, isNightMode } = useTimeTheme();
  const headerGradient = useMemo(
    () => `bg-gradient-to-r ${themeColors.header.gradient}`,
    [themeColors.header.gradient],
  );

  // Legacy dateFilter kept for useEncounterStats hook
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // Advanced Filter Modal State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [modalFilters, setModalFilters] = useState<MedicalRecordsFilters>(
    defaultMedicalRecordsFilters,
  );

  // Selection state for batch operations
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(
    new Set(),
  );
  const [selectAll, setSelectAll] = useState(false);

  // Count active filters from modal
  const activeFilterCount = useMemo(() => {
    return Object.entries(modalFilters).filter(([key, value]) => {
      if (
        [
          'searchQuery',
          'emrNumber',
          'serviceNumber',
          'phone',
          'dateFrom',
          'dateTo',
          'encounterDateFrom',
          'encounterDateTo',
          'ageRangeMin',
          'ageRangeMax',
          'totalVisitsMin',
          'totalVisitsMax',
        ].includes(key)
      ) {
        return value !== '';
      }
      return value !== 'all' && value !== '';
    }).length;
  }, [modalFilters]);

  // Apply filters from modal - just close the modal since filters are already applied through modalFilters state
  const handleApplyModalFilters = () => {
    // Close modal after applying - filters are already reactive through modalFilters state
    setShowFilterModal(false);
  };

  // Clear all modal filters
  const handleClearModalFilters = () => {
    setModalFilters(defaultMedicalRecordsFilters);
    setDateFilter('all'); // Reset stats filter too
    setSelectedPatients(new Set());
    setSelectAll(false);
  };

  // Export handler
  const handleExport = (format: 'csv' | 'pdf') => {
    // TODO: Implement export functionality
    log.info('Medical records list export requested', {
      format,
      activeFilterKeys: Object.entries(modalFilters)
        .filter(([, value]) =>
          Array.isArray(value) ? value.length > 0 : Boolean(value),
        )
        .map(([key]) => key),
    });
    alert(`Export to ${format.toUpperCase()}`);
  };

  // Data - pass modalFilters object to the hook for comprehensive filtering
  const {
    data: patients,
    isLoading,
    refetch,
  } = usePatientsWithEncounters(modalFilters);
  const { data: stats } = useEncounterStats(dateFilter);

  // Handle select all toggle
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedPatients(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(patients?.map((p) => p.id) || []);
      setSelectedPatients(allIds);
      setSelectAll(true);
    }
  };

  // Handle individual patient selection
  const handlePatientSelect = (patientId: string) => {
    const newSelected = new Set(selectedPatients);
    if (newSelected.has(patientId)) {
      newSelected.delete(patientId);
      setSelectAll(false);
    } else {
      newSelected.add(patientId);
      if (patients && newSelected.size === patients.length) {
        setSelectAll(true);
      }
    }
    setSelectedPatients(newSelected);
  };

  // Open selected patients in new tabs
  const handleViewSelectedPatients = () => {
    selectedPatients.forEach((patientId) => {
      window.open(`/medical-records/${patientId}`, '_blank');
    });
  };

  const handleOpenPatient = (patientId: string) => {
    navigate(`/medical-records/${patientId}`);
  };

  const dateFilterOptions = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: '3months', label: 'Last 3 Months' },
    { value: 'year', label: 'Last Year' },
    { value: 'all', label: 'All Time' },
  ];

  const deptFilterOptions = [
    { value: 'all', label: 'All Departments' },
    { value: 'gopd', label: 'GOPD / General' },
    { value: 'dental', label: 'Dental' },
    { value: 'ophthalmology', label: 'Ophthalmology' },
    { value: 'physiotherapy', label: 'Physiotherapy' },
    { value: 'inpatient', label: 'Inpatient' },
  ];

  const categoryFilterOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'Military', label: 'Military' },
    { value: 'Civilian', label: 'Civilian' },
    { value: 'Military Participant', label: 'Military Participant' },
    { value: 'Civilian Participant', label: 'Civilian Participant' },
    { value: 'Security Services', label: 'Security Services' },
    { value: 'Dependent', label: 'Dependent' },
  ];

  const insuranceFilterOptions = [
    { value: 'all', label: 'All Insurance Types' },
    { value: 'Private', label: 'Private' },
    { value: 'Military_NHIS', label: 'Military NHIS' },
    { value: 'Civilian_NHIS', label: 'Civilian NHIS' },
    { value: 'GIFSHIP', label: 'GIFSHIP' },
    { value: 'Security_Services_NHIS', label: 'Security Services NHIS' },
    { value: 'Retainership', label: 'Retainership' },
    { value: 'none', label: 'No Insurance' },
  ];

  const genderFilterOptions = [
    { value: 'all', label: 'All Genders' },
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
  ];

  const ageRangeFilterOptions = [
    { value: 'all', label: 'All Ages' },
    { value: '0-18', label: 'Children (0-18)' },
    { value: '19-35', label: 'Young Adults (19-35)' },
    { value: '36-50', label: 'Adults (36-50)' },
    { value: '51-65', label: 'Middle Age (51-65)' },
    { value: '65+', label: 'Senior (65+)' },
  ];

  const bloodGroupFilterOptions = [
    { value: 'all', label: 'All Blood Groups' },
    { value: 'A+', label: 'A+' },
    { value: 'A-', label: 'A-' },
    { value: 'B+', label: 'B+' },
    { value: 'B-', label: 'B-' },
    { value: 'AB+', label: 'AB+' },
    { value: 'AB-', label: 'AB-' },
    { value: 'O+', label: 'O+' },
    { value: 'O-', label: 'O-' },
  ];

  return (
    <div
      className={`min-h-screen ${isNightMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50'}`}
    >
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Medical records
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Patient charts across every department.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E9783F] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#D96A36]"
            >
              <Download size={15} />
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Filters Bar - Advanced Filter Only */}
        <Card
          className={`mb-6 overflow-hidden rounded-2xl border shadow-sm ${isNightMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200/90'}`}
        >
          <div className="p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {/* Search - Primary Filter */}
              <div className="w-full sm:flex-1 sm:max-w-xl">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search by name, EMR number, service number, phone..."
                    value={modalFilters.searchQuery}
                    onChange={(e) =>
                      setModalFilters((prev) => ({
                        ...prev,
                        searchQuery: e.target.value,
                      }))
                    }
                    className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none ring-primary-600/20 focus:border-primary-600 focus:ring-2 ${
                      isNightMode
                        ? 'border-slate-600 bg-slate-800 text-slate-100 placeholder:text-slate-500'
                        : 'border-slate-300 bg-white text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Advanced Filter Button */}
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearModalFilters}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <RotateCcw size={14} />
                    Reset Filters
                  </button>
                )}
                <button
                  onClick={() => setShowFilterModal(true)}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <SlidersHorizontal size={16} />
                  Advanced Filter
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-bold rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Active Filters Summary */}
            {activeFilterCount > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-500">
                    Active Filters:
                  </span>
                  {modalFilters.dateFrom && modalFilters.dateTo && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
                      <Calendar size={12} />
                      {modalFilters.dateFrom} - {modalFilters.dateTo}
                    </span>
                  )}
                  {modalFilters.department !== 'all' && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                      <Building2 size={12} />
                      {DEPARTMENTS.find(
                        (d) => d.value === modalFilters.department,
                      )?.label || modalFilters.department}
                    </span>
                  )}
                  {modalFilters.patientCategory !== 'all' && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                      <Tag size={12} />
                      {modalFilters.patientCategory}
                    </span>
                  )}
                  {modalFilters.insuranceType !== 'all' && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1">
                      <Shield size={12} />
                      {modalFilters.insuranceType}
                    </span>
                  )}
                  {modalFilters.gender !== 'all' && (
                    <span className="px-2 py-1 bg-pink-100 text-pink-700 text-xs rounded-full flex items-center gap-1">
                      <User size={12} />
                      {modalFilters.gender}
                    </span>
                  )}
                  {modalFilters.encounterStatus !== 'all' && (
                    <span className="px-2 py-1 bg-cyan-100 text-cyan-700 text-xs rounded-full flex items-center gap-1">
                      <Activity size={12} />
                      {modalFilters.encounterStatus}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Results Count and Batch Actions */}
        <div className="mb-4 flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <p
              className={`text-sm ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              {isLoading
                ? 'Loading...'
                : `${patients?.length || 0} patients with records`}
            </p>
            {selectedPatients.size > 0 && (
              <div className="flex items-center gap-2 pl-4 border-l border-gray-300">
                <span className="text-sm font-medium text-green-700">
                  {selectedPatients.size} selected
                </span>
                <button
                  onClick={handleViewSelectedPatients}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ExternalLink size={14} />
                  View Selected
                </button>
                <button
                  onClick={() => {
                    setSelectedPatients(new Set());
                    setSelectAll(false);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <X size={14} />
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Patient Table */}
        <Card
          className={`overflow-hidden rounded-2xl border shadow-sm ${
            isNightMode
              ? 'border-slate-700 bg-slate-900'
              : 'border-slate-200/90'
          }`}
        >
          {isLoading ? (
            <SkeletonTable rows={8} columns={4} />
          ) : patients && patients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead
                  className={`border-b ${
                    isNightMode
                      ? 'border-slate-700 bg-slate-800/80'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <tr>
                    {/* Select All Checkbox */}
                    <th className="px-3 py-3 w-10">
                      <button
                        onClick={handleSelectAll}
                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                        title={selectAll ? 'Deselect all' : 'Select all'}
                      >
                        {selectAll ? (
                          <CheckSquare size={18} className="text-[#E9783F]" />
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                        isNightMode ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        Patient
                      </div>
                    </th>
                    <th
                      className={`hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider lg:table-cell ${
                        isNightMode ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        Category
                      </div>
                    </th>
                    
                    <th
                      className={`w-14 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${
                        isNightMode ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Visits
                      </div>
                    </th>
                    <th
                      className={`hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider xl:table-cell ${
                        isNightMode ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        Last Visit
                      </div>
                    </th>
                    <th
                      className={`hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider xl:table-cell ${
                        isNightMode ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        Last Dept
                      </div>
                    </th>
                    <th
                      className={`w-16 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${
                        isNightMode ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        View
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <PatientRow
                      key={patient.id}
                      patient={patient}
                      onClick={() => handleOpenPatient(patient.id)}
                      isSelected={selectedPatients.has(patient.id)}
                      onSelect={handlePatientSelect}
                      isNightMode={isNightMode}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <FolderHeart className="text-gray-300 mb-3" size={48} />
                <h3 className="text-lg font-semibold text-gray-700">
                  No patient records found
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {modalFilters.searchQuery
                    ? `No patients match "${modalFilters.searchQuery}". Try a different search term.`
                    : 'No patient encounters found for the selected filters. Try adjusting the date range or department filter.'}
                </p>
              </div>
            </div>
          )}
        </Card>

        <div
          className={`mt-2 rounded-2xl border p-4 ${
            isNightMode
              ? 'border-emerald-800/60 bg-emerald-950/40'
              : 'border-emerald-200 bg-emerald-50/90'
          }`}
        >
          <div className="flex items-start gap-3">
            <Building2
              className={`mt-0.5 flex-shrink-0 ${isNightMode ? 'text-emerald-400' : 'text-emerald-700'}`}
              size={20}
            />
            <div>
              <p
                className={`text-sm font-semibold ${isNightMode ? 'text-emerald-100' : 'text-emerald-950'}`}
              >
                Viewing as: {staff?.role?.replace('_', ' ') || 'clinician'}
                {staff?.department && ` · ${staff.department}`}
              </p>
              <p
                className={`mt-1 text-xs leading-relaxed ${isNightMode ? 'text-emerald-200/90' : 'text-emerald-900/85'}`}
              >
                All departmental records are listed here. Open a patient to see
                encounters, labs, imaging, and notes according to your role.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Modal */}
      <MedicalRecordsFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={modalFilters}
        onFiltersChange={setModalFilters}
        onApplyFilters={handleApplyModalFilters}
        onClearFilters={handleClearModalFilters}
        onExport={handleExport}
      />

      {/* Export Modal with Patient Selection */}
      <MedicalRecordsExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        patients={patients || []}
        activeFilters={modalFilters}
        activeFilterCount={activeFilterCount}
      />
    </div>
  );
}
