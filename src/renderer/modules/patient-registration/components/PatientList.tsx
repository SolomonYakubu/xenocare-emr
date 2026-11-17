import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  UserPlus,
  Users,
  ChevronDown,
  RefreshCw,
  X,
  FileText,
  Calendar,
  Phone,
  CalendarPlus,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePatients, useDeletePatient } from '../hooks/usePatient';
import {
  PatientDTO,
  PatientCategory,
  PatientType,
  InsuranceType,
  NHISPatientSource,
  PatientSearchParams,
  formatDetailedAge,
  formatPatientName,
} from '../dtos/patient.dto';
import { Gender, PatientStatus, StaffCategory } from '../../../types';
import {
  isMilitaryFeatureEnabled,
  isNhisCategory,
  isNhisFeatureEnabled,
} from '../../../config/features';
import {
  DataTable,
  StatusBadge,
  EmptyState,
  Button,
  Select,
} from '../../../components/ui';

import { ConfirmDialog } from '../../../components/ui/Modal';
import { RoleGate } from '../../../components/auth/ProtectedRoute';
import { useAuth } from '../../../contexts/AuthContext';
import { useTimeTheme } from '../../../hooks/useTimeTheme';
import { useToast } from '../../../components/ui/Toast';
import { getPatientsForExport } from '../api/patient.api';
import { exportPatientRegistrationPdf } from '../utils/patientRegistrationPdf';

// =============================================================================
// Types
// =============================================================================

interface PatientListProps {
  onNewPatient: () => void;
  onViewPatient: (patient: PatientDTO) => void;
  onEditPatient: (patient: PatientDTO) => void;
  onCreateEncounter?: (patient: PatientDTO) => void;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Deceased', label: 'Deceased' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'Military', label: 'Military' },
  { value: 'Civilian', label: 'Civilian' },
  { value: 'DS', label: 'DS' },
  { value: 'Guest Lecturer', label: 'Guest Lecturer' },
];

const PATIENT_CATEGORY_OPTIONS: Array<{
  value: PatientCategory | '';
  label: string;
}> = [
  { value: '', label: 'All Patient Categories' },
  { value: 'Military', label: 'Military' },
  { value: 'Civilian', label: 'Civilian' },
  { value: 'Military Participant', label: 'Military Participant' },
  { value: 'Civilian Participant', label: 'Civilian Participant' },
  { value: 'Security Services', label: 'Security Services' },
];

const PATIENT_TYPE_OPTIONS: Array<{ value: PatientType | ''; label: string }> =
  [
    { value: '', label: 'All Patient Types' },
    { value: 'Principal', label: 'Principal' },
    { value: 'Dependent', label: 'Dependent' },
    { value: 'Private', label: 'Private' },
  ];

const INSURANCE_OPTIONS: Array<{ value: InsuranceType | ''; label: string }> = [
  { value: '', label: 'All Insurance Types' },
  { value: 'Private', label: 'Private' },
  { value: 'Military_NHIS', label: 'Military NHIS' },
  { value: 'Civilian_NHIS', label: 'Civilian NHIS' },
  { value: 'Retainership', label: 'Retainership' },
  { value: 'GIFSHIP', label: 'GIFSHIP' },
  { value: 'DHML', label: 'DHML' },
  { value: 'Security_Services_NHIS', label: 'Security Services NHIS' },
];

const VISIBLE_INSURANCE_OPTIONS = INSURANCE_OPTIONS.filter((option) => {
  if (!option.value) return true;
  if (!isNhisFeatureEnabled() && isNhisCategory(option.value)) return false;
  if (
    !isMilitaryFeatureEnabled() &&
    ['Military_NHIS', 'DHML', 'Security_Services_NHIS'].includes(option.value)
  ) {
    return false;
  }
  return true;
});

const VISIBLE_CATEGORY_OPTIONS = CATEGORY_OPTIONS.filter(
  (option) =>
    isMilitaryFeatureEnabled() ||
    !['Military', 'DS'].includes(option.value),
);
const VISIBLE_PATIENT_CATEGORY_OPTIONS = PATIENT_CATEGORY_OPTIONS.filter(
  (option) =>
    isMilitaryFeatureEnabled() ||
    !['Military', 'Military Participant', 'Security Services'].includes(
      option.value,
    ),
);

const NHIS_SOURCE_OPTIONS: Array<{
  value: NHISPatientSource | '';
  label: string;
}> = [
  { value: '', label: 'All NHIS Sources' },
  { value: 'Internal', label: 'Internal' },
  { value: 'Referral', label: 'Referral' },
];

const GENDER_OPTIONS: Array<{ value: Gender | ''; label: string }> = [
  { value: '', label: 'All Genders' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

// =============================================================================
// Component
// =============================================================================

export default function PatientList({
  onNewPatient,
  onViewPatient,
  onEditPatient,
  onCreateEncounter,
}: PatientListProps) {
  const navigate = useNavigate();
  const { staff } = useAuth();
  const { isNightMode } = useTimeTheme();
  const { showToast } = useToast();
  const canUseAdminRegistrationFilters =
    staff?.role === 'super_admin' || staff?.role === 'admin';

  const panelClass = isNightMode
    ? 'rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06]'
    : 'rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-18px_rgba(15,80,72,0.12)] ring-1 ring-slate-200/60';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PatientStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<StaffCategory | ''>('');
  const [patientCategoryFilter, setPatientCategoryFilter] = useState<
    PatientCategory | ''
  >('');
  const [patientTypeFilter, setPatientTypeFilter] = useState<PatientType | ''>(
    '',
  );
  const [insuranceTypeFilter, setInsuranceTypeFilter] = useState<
    InsuranceType | ''
  >('');
  const [nhisSourceFilter, setNhisSourceFilter] = useState<
    NHISPatientSource | ''
  >('');
  const [genderFilter, setGenderFilter] = useState<Gender | ''>('');
  const [registrationDateFrom, setRegistrationDateFrom] = useState('');
  const [registrationDateTo, setRegistrationDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletePatient, setDeletePatient] = useState<PatientDTO | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showLegacyFilters, setShowLegacyFilters] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const patientFilters = useMemo<PatientSearchParams>(
    () => ({
      query: searchQuery,
      status: statusFilter || undefined,
      staff_category: categoryFilter || undefined,
      patient_category:
        canUseAdminRegistrationFilters && patientCategoryFilter
          ? patientCategoryFilter
          : undefined,
      patient_type:
        canUseAdminRegistrationFilters && patientTypeFilter
          ? patientTypeFilter
          : undefined,
      insurance_type:
        canUseAdminRegistrationFilters && insuranceTypeFilter
          ? insuranceTypeFilter
          : undefined,
      nhis_patient_source:
        canUseAdminRegistrationFilters && nhisSourceFilter
          ? nhisSourceFilter
          : undefined,
      gender:
        canUseAdminRegistrationFilters && genderFilter
          ? genderFilter
          : undefined,
      registration_date_from:
        canUseAdminRegistrationFilters && registrationDateFrom
          ? registrationDateFrom
          : undefined,
      registration_date_to:
        canUseAdminRegistrationFilters && registrationDateTo
          ? registrationDateTo
          : undefined,
      page: currentPage,
      limit: 20,
    }),
    [
      searchQuery,
      statusFilter,
      categoryFilter,
      canUseAdminRegistrationFilters,
      patientCategoryFilter,
      patientTypeFilter,
      insuranceTypeFilter,
      nhisSourceFilter,
      genderFilter,
      registrationDateFrom,
      registrationDateTo,
      currentPage,
    ],
  );

  // Hooks
  const { data, isLoading, error, refetch } = usePatients(patientFilters);

  const deleteMutation = useDeletePatient();

  // Handle delete
  const handleDelete = async () => {
    if (!deletePatient) return;
    await deleteMutation.mutateAsync(deletePatient.patient_id);
    setDeletePatient(null);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setCategoryFilter('');
    setPatientCategoryFilter('');
    setPatientTypeFilter('');
    setInsuranceTypeFilter('');
    setNhisSourceFilter('');
    setGenderFilter('');
    setRegistrationDateFrom('');
    setRegistrationDateTo('');
    setCurrentPage(1);
  };

  const activeFilterCount = [
    searchQuery,
    statusFilter,
    categoryFilter,
    canUseAdminRegistrationFilters ? patientCategoryFilter : '',
    canUseAdminRegistrationFilters ? patientTypeFilter : '',
    canUseAdminRegistrationFilters ? insuranceTypeFilter : '',
    canUseAdminRegistrationFilters ? nhisSourceFilter : '',
    canUseAdminRegistrationFilters ? genderFilter : '',
    canUseAdminRegistrationFilters ? registrationDateFrom : '',
    canUseAdminRegistrationFilters ? registrationDateTo : '',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const handleExportPdf = async () => {
    setIsExportingPdf(true);

    try {
      const exportFilters: PatientSearchParams = {
        ...patientFilters,
        page: undefined,
        limit: undefined,
      };
      const patients = await getPatientsForExport(exportFilters);

      if (patients.length === 0) {
        showToast({
          type: 'info',
          title: 'No records to export',
          message: 'Adjust the registration filters and try again.',
        });
        return;
      }

      const generatedBy =
        staff?.role === 'super_admin'
          ? 'Super Admin'
          : staff?.role === 'admin'
            ? 'Admin'
            : 'System';

      const { filename } = await exportPatientRegistrationPdf(patients, {
        filters: exportFilters,
        generatedBy,
      });

      showToast({
        type: 'success',
        title: 'PDF report ready',
        message: `${patients.length} registrations exported to ${filename}.`,
      });
    } catch (exportError) {
      showToast({
        type: 'error',
        title: 'Export failed',
        message:
          exportError instanceof Error
            ? exportError.message
            : 'Unable to export the filtered registration report.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: PatientStatus) => {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Inactive':
        return 'neutral';
      case 'Deceased':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  // Get category color
  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'Military':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Civilian':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'DS':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Guest Lecturer':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Table columns
  const columns = useMemo(
    () => [
      {
        key: 'name' as const,
        header: 'Patient Name',
        render: (patient: PatientDTO) => (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-sm font-bold tracking-tight text-white shadow-md shadow-emerald-900/20 ring-2 ring-white/30">
              {patient.first_name.charAt(0)}
              {patient.surname.charAt(0)}
            </div>
            <div className="min-w-0">
              <div
                className={`font-semibold tracking-tight ${isNightMode ? 'text-slate-100' : 'text-slate-900'}`}
              >
                {formatPatientName(patient)}
              </div>
              <div
                className={`flex flex-wrap items-center gap-2 text-sm ${isNightMode ? 'text-slate-400' : 'text-slate-500'}`}
              >
                {patient.contact_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {patient.contact_phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'emr_number' as const,
        header: 'Patient number',
        render: (patient: PatientDTO) => (
          <div className="flex items-center gap-2">
            <FileText
              className={`h-4 w-4 ${isNightMode ? 'text-emerald-400' : 'text-emerald-600'}`}
            />
            <span
              className={`font-mono text-sm font-semibold ${isNightMode ? 'text-emerald-300' : 'text-emerald-800'}`}
            >
              {patient.emr_number || 'Pending'}
            </span>
          </div>
        ),
      },
      {
        key: 'gender' as const,
        header: 'Gender',
        render: (patient: PatientDTO) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              patient.gender === 'Male'
                ? 'bg-blue-50 text-blue-700'
                : patient.gender === 'Female'
                  ? 'bg-pink-50 text-pink-700'
                  : 'bg-gray-50 text-gray-700'
            }`}
          >
            {patient.gender}
          </span>
        ),
      },
      {
        key: 'age' as const,
        header: 'Age',
        render: (patient: PatientDTO) => {
          const age = formatDetailedAge(patient.date_of_birth);
          return (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span
                className={`font-medium ${isNightMode ? 'text-slate-200' : 'text-slate-700'}`}
              >
                {age || 'N/A'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'staff_category' as const,
        header: 'Category',
        render: (patient: PatientDTO) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getCategoryColor(patient.staff_category ?? undefined)}`}
          >
            {patient.staff_category || 'External'}
          </span>
        ),
      },
      {
        key: 'actions' as const,
        header: 'Actions',
        className: 'text-right',
        render: (patient: PatientDTO) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewPatient(patient);
              }}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
              title="View Details"
            >
              <Eye size={18} />
            </button>
            <RoleGate
              roles={[
                'super_admin',
                'admin',
                'medical_director',
                'receptionist',
              ]}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCreateEncounter) {
                    onCreateEncounter(patient);
                  } else {
                    navigate(
                      `/encounter?patientId=${patient.patient_id}&action=create`,
                    );
                  }
                }}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Create Encounter"
              >
                <CalendarPlus size={18} />
              </button>
            </RoleGate>
            <RoleGate
              roles={[
                'super_admin',
                'admin',
                'medical_director',
                'doctor',
                'nurse',
                'receptionist',
              ]}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPatient(patient);
                }}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Edit Patient"
              >
                <Edit2 size={18} />
              </button>
            </RoleGate>
            <RoleGate roles={['super_admin', 'admin', 'medical_director']}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletePatient(patient);
                }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Patient"
              >
                <Trash2 size={18} />
              </button>
            </RoleGate>
          </div>
        ),
      },
    ],
    [onViewPatient, onEditPatient, onCreateEncounter, navigate, isNightMode],
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-200/80 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
        Error loading patients: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className={`absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 sm:h-5 sm:w-5 ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}
            />
            <input
              type="text"
              placeholder="Search by name, phone or patient number"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none ring-primary-600/20 transition focus:border-primary-600 focus:ring-2 sm:py-3 sm:pl-11 ${
                isNightMode
                  ? 'border-slate-600 bg-slate-800/80 text-slate-100 placeholder:text-slate-500'
                  : 'border-slate-200/90 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:bg-white'
              }`}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition sm:flex-initial lg:py-3 ${
                showFilters || hasActiveFilters
                  ? isNightMode
                    ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-200'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : isNightMode
                    ? 'border-slate-600 bg-slate-800/60 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="h-4 w-4 shrink-0" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-700 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => refetch()}
              className={`rounded-xl border p-2.5 transition sm:p-3 ${
                isNightMode
                  ? 'border-slate-600 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showFilters && (
          <div
            className={`border-t px-4 pb-4 pt-3 sm:px-5 ${
              isNightMode
                ? 'border-slate-700/80 bg-slate-800/40'
                : 'border-slate-100 bg-slate-50/80'
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h4
                  className={`text-sm font-semibold ${isNightMode ? 'text-slate-200' : 'text-slate-700'}`}
                >
                  Filter options
                </h4>
                {canUseAdminRegistrationFilters && (
                  <p
                    className={`mt-1 text-xs ${isNightMode ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    Everyday filters stay visible. Legacy classification
                    filters are optional.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canUseAdminRegistrationFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      if (showLegacyFilters) {
                        setCategoryFilter('');
                        setPatientCategoryFilter('');
                        setPatientTypeFilter('');
                        setInsuranceTypeFilter('');
                        setNhisSourceFilter('');
                        setCurrentPage(1);
                      }
                      setShowLegacyFilters((value) => !value);
                    }}
                    className={`text-xs font-semibold ${isNightMode ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {showLegacyFilters
                      ? 'Hide legacy classification filters'
                      : 'Show legacy classification filters'}
                  </button>
                )}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={`flex items-center gap-1 text-sm font-medium ${isNightMode ? 'text-slate-400 hover:text-red-400' : 'text-slate-500 hover:text-red-600'}`}
                  >
                    <X className="h-3 w-3" />
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label
                  className={`mb-1.5 block text-xs font-medium ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  Patient status
                </label>
                <Select
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as PatientStatus | '');
                    setCurrentPage(1);
                  }}
                  className="w-full"
                />
              </div>
              {canUseAdminRegistrationFilters && showLegacyFilters && (
                <div>
                  <label
                    className={`mb-1.5 block text-xs font-medium ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    Staff category
                  </label>
                  <Select
                    options={VISIBLE_CATEGORY_OPTIONS}
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value as StaffCategory | '');
                      setCurrentPage(1);
                    }}
                    className="w-full"
                  />
                </div>
              )}
              {canUseAdminRegistrationFilters && showLegacyFilters && (
                <>
                  <div>
                    <label
                      className={`mb-1.5 block text-xs font-medium ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                      Patient category
                    </label>
                    <Select
                      options={VISIBLE_PATIENT_CATEGORY_OPTIONS}
                      value={patientCategoryFilter}
                      onChange={(e) => {
                        setPatientCategoryFilter(
                          e.target.value as PatientCategory | '',
                        );
                        setCurrentPage(1);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label
                      className={`mb-1.5 block text-xs font-medium ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                      Patient type
                    </label>
                    <Select
                      options={PATIENT_TYPE_OPTIONS}
                      value={patientTypeFilter}
                      onChange={(e) => {
                        setPatientTypeFilter(
                          e.target.value as PatientType | '',
                        );
                        setCurrentPage(1);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label
                      className={`mb-1.5 block text-xs font-medium ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                      Insurance type
                    </label>
                    <Select
                      options={VISIBLE_INSURANCE_OPTIONS}
                      value={insuranceTypeFilter}
                      onChange={(e) => {
                        setInsuranceTypeFilter(
                          e.target.value as InsuranceType | '',
                        );
                        setCurrentPage(1);
                      }}
                      className="w-full"
                    />
                  </div>
                  {isNhisFeatureEnabled() && (
                    <div>
                      <label
                        className={`mb-1.5 block text-xs font-medium ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                      >
                        NHIS source
                      </label>
                      <Select
                        options={NHIS_SOURCE_OPTIONS}
                        value={nhisSourceFilter}
                        onChange={(e) => {
                          setNhisSourceFilter(
                            e.target.value as NHISPatientSource | '',
                          );
                          setCurrentPage(1);
                        }}
                        className="w-full"
                      />
                    </div>
                  )}
                </>
              )}
              {canUseAdminRegistrationFilters && (
                <>
                  <div>
                    <label
                      className={`mb-1.5 block text-xs font-medium ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                      Gender
                    </label>
                    <Select
                      options={GENDER_OPTIONS}
                      value={genderFilter}
                      onChange={(e) => {
                        setGenderFilter(e.target.value as Gender | '');
                        setCurrentPage(1);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label
                      className={`mb-1.5 block text-xs font-medium ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                      Registration from
                    </label>
                    <input
                      type="date"
                      value={registrationDateFrom}
                      onChange={(e) => {
                        setRegistrationDateFrom(e.target.value);
                        setCurrentPage(1);
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ring-primary-600/20 transition focus:border-primary-600 focus:ring-2 ${
                        isNightMode
                          ? 'border-slate-600 bg-slate-900 text-slate-100'
                          : 'border-slate-200 bg-white text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label
                      className={`mb-1.5 block text-xs font-medium ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                      Registration to
                    </label>
                    <input
                      type="date"
                      value={registrationDateTo}
                      onChange={(e) => {
                        setRegistrationDateTo(e.target.value);
                        setCurrentPage(1);
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ring-primary-600/20 transition focus:border-primary-600 focus:ring-2 ${
                        isNightMode
                          ? 'border-slate-600 bg-slate-900 text-slate-100'
                          : 'border-slate-200 bg-white text-slate-900'
                      }`}
                    />
                  </div>
                </>
              )}
            </div>

            {canUseAdminRegistrationFilters && (
              <div
                className={`mt-4 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
                  isNightMode
                    ? 'border-slate-700 bg-slate-900/60'
                    : 'border-slate-200 bg-white/80'
                }`}
              >
                <div>
                  <p
                    className={`text-sm font-semibold ${isNightMode ? 'text-slate-100' : 'text-slate-800'}`}
                  >
                    PDF registration report
                  </p>
                  <p
                    className={`text-xs ${isNightMode ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    Exports the full filtered registration dataset, not only the
                    current page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isNightMode
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-[#E9783F] text-white hover:bg-[#0b4f49]'
                  }`}
                >
                  <Download className="h-4 w-4" />
                  {isExportingPdf ? 'Preparing report...' : 'Export PDF report'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Summary */}
      {data && (
        <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
          <div
            className={`flex items-center gap-2 text-sm ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
          >
            <Users
              className={`h-4 w-4 shrink-0 ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}
            />
            <span>
              Showing{' '}
              <span
                className={`font-semibold ${isNightMode ? 'text-slate-100' : 'text-slate-900'}`}
              >
                {data.patients.length}
              </span>{' '}
              of{' '}
              <span
                className={`font-semibold ${isNightMode ? 'text-slate-100' : 'text-slate-900'}`}
              >
                {data.total}
              </span>{' '}
              patients
            </span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className={`text-sm font-semibold ${isNightMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-primary-700 hover:text-primary-800'}`}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Data Table */}
      {!isLoading && (!data?.patients || data.patients.length === 0) ? (
        <div className={`${panelClass} p-10 sm:p-12`}>
          <EmptyState
            icon={
              <Users
                size={48}
                className={isNightMode ? 'text-slate-600' : 'text-slate-300'}
                strokeWidth={1.25}
              />
            }
            title="No patients found"
            description={
              searchQuery
                ? 'Try adjusting your search or filters'
                : 'Start by registering a new patient'
            }
            action={
              <RoleGate
                roles={[
                  'super_admin',
                  'admin',
                  'medical_director',
                  'doctor',
                  'nurse',
                  'receptionist',
                ]}
              >
                <Button icon={UserPlus} onClick={onNewPatient}>
                  Register patient
                </Button>
              </RoleGate>
            }
          />
        </div>
      ) : (
        <div className={`${panelClass} overflow-hidden`}>
          <DataTable
            data={data?.patients || []}
            columns={columns}
            keyField="patient_id"
            isLoading={isLoading}
            onRowClick={onViewPatient}
            pagination={
              data
                ? {
                    currentPage: data.page,
                    totalPages: data.totalPages,
                    totalItems: data.total,
                    itemsPerPage: 20,
                    onPageChange: setCurrentPage,
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletePatient}
        onClose={() => setDeletePatient(null)}
        onConfirm={handleDelete}
        title="Delete Patient"
        message={`Are you sure you want to deactivate "${deletePatient ? formatPatientName(deletePatient) : ''}"? This will mark the patient as inactive.`}
        confirmText="Deactivate"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
