/**
 * =============================================================================
 * XENOCARE EMR - ENCOUNTER FILTER PANEL
 * Description: Comprehensive filter panel for encounters similar to billing module
 * Features: Date range, status, visit type, department, doctor, patient category filters
 * =============================================================================
 */

import React from 'react';
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
} from 'lucide-react';
import {
  EncounterStatuses,
  VisitTypes,
  PriorityLevels,
  EncounterStatus,
  VisitType,
  PriorityLevel,
} from '../dtos/encounter.dto';
import {
  isMilitaryFeatureEnabled,
  isNhisCategory,
  isNhisFeatureEnabled,
} from '../../../config/features';

// =============================================================================
// Types
// =============================================================================

export interface AdvancedEncounterFilters {
  // Search Filters
  searchQuery: string;
  encounterNumber: string;
  patientName: string;
  emrNumber: string;

  // Date Filters
  dateFrom: string;
  dateTo: string;

  // Status Filters
  status: EncounterStatus | 'all';
  visitType: VisitType | 'all';
  priority: PriorityLevel | 'all';

  // Provider Filters
  departmentId: string;
  doctorId: string;
  clinicId: string;

  // Patient Category Filters
  patientCategory: string;
  insuranceType: string;
  paymentCategory: string;

  // Additional Filters
  ageRangeMin: string;
  ageRangeMax: string;
  gender: string;
  course: string;

  // Clinical Filters
  diagnosis: string;
  chiefComplaint: string;
}

export const defaultEncounterFilters: AdvancedEncounterFilters = {
  searchQuery: '',
  encounterNumber: '',
  patientName: '',
  emrNumber: '',
  dateFrom: '',
  dateTo: '',
  status: 'all',
  visitType: 'all',
  priority: 'all',
  departmentId: 'all',
  doctorId: 'all',
  clinicId: 'all',
  patientCategory: 'all',
  insuranceType: 'all',
  paymentCategory: 'all',
  ageRangeMin: '',
  ageRangeMax: '',
  gender: 'all',
  course: 'all',
  diagnosis: 'all',
  chiefComplaint: 'all',
};

interface EncounterFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AdvancedEncounterFilters;
  onFiltersChange: (filters: AdvancedEncounterFilters) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  doctorList?: Array<{ id: string; name: string }>;
  departmentList?: Array<{ id: string; name: string }>;
  clinicList?: Array<{ id: string; name: string }>;
  courseList?: Array<{ id: string; name: string }>;
  diagnosisList?: Array<{ name: string; count: number }>;
  chiefComplaintList?: Array<{ id: string; name: string; category: string }>;
}

// Patient categories based on the EMR system
const PATIENT_CATEGORIES = [
  { value: 'Military', label: 'Military Personnel' },
  { value: 'Military Participant', label: 'Military Participant' },
  { value: 'Civilian', label: 'Civilian' },
  { value: 'Civilian Participant', label: 'Civilian Participant' },
  { value: 'Security Services', label: 'Security Services' },
];

const INSURANCE_TYPES = [
  { value: 'Military_NHIS', label: 'Military NHIS' },
  { value: 'Civilian_NHIS', label: 'Civilian NHIS' },
  { value: 'GIFSHIP', label: 'GIFSHIP' },
  { value: 'Security_Services_NHIS', label: 'Security Services NHIS' },
  { value: 'Retainership', label: 'Retainership' },
  { value: 'Private', label: 'Private Insurance' },
];

const PAYMENT_CATEGORIES = [
  { value: 'Cash', label: 'Cash Payment' },
  { value: 'POS', label: 'POS/Card' },
  { value: 'NHIS', label: 'NHIS' },
  { value: 'Retainership', label: 'Retainership' },
  { value: 'Military_Free', label: 'Military Free' },
];

const VISIBLE_INSURANCE_TYPES = isNhisFeatureEnabled()
  ? INSURANCE_TYPES
  : INSURANCE_TYPES.filter((type) => !isNhisCategory(type.value));

const VISIBLE_PAYMENT_CATEGORIES = PAYMENT_CATEGORIES.filter((category) => {
  if (!isNhisFeatureEnabled() && category.value === 'NHIS') return false;
  if (!isMilitaryFeatureEnabled() && category.value === 'Military_Free')
    return false;
  return true;
});

const VISIBLE_PATIENT_CATEGORIES = PATIENT_CATEGORIES.filter(
  (category) =>
    isMilitaryFeatureEnabled() ||
    !['Military', 'Military Participant', 'Security Services'].includes(
      category.value,
    ),
);

const DEPARTMENTS = [
  { value: 'GOPD', label: 'General outpatient' },
  { value: 'SOPD', label: 'Specialist outpatient' },
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
];

// =============================================================================
// Component
// =============================================================================

export function EncounterFilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  doctorList = [],
  departmentList = [],
  clinicList = [],
  courseList = [],
  diagnosisList = [],
  chiefComplaintList = [],
}: EncounterFilterPanelProps) {
  const updateFilter = <K extends keyof AdvancedEncounterFilters>(
    key: K,
    value: AdvancedEncounterFilters[K],
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Get active filter count
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    // Text search fields - count if not empty
    if (
      [
        'dateFrom',
        'dateTo',
        'ageRangeMin',
        'ageRangeMax',
        'searchQuery',
        'encounterNumber',
        'patientName',
        'emrNumber',
      ].includes(key)
    ) {
      return value !== '';
    }
    // Select fields - count if not 'all'
    return value !== 'all' && value !== '';
  }).length;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-out Panel - From Right */}
      <div
        className={`fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-700 to-[#008545]">
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">
              Encounter Filters
            </h2>
            {activeFilterCount > 0 && (
              <span className="px-2.5 py-0.5 bg-white text-primary-700 text-xs font-bold rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Date Range Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary-700" />
              Date Range
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
                />
              </div>
            </div>
            {/* Quick Date Presets */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Today', days: 0 },
                { label: 'Yesterday', days: 1 },
                { label: 'Last 7 Days', days: 7 },
                { label: 'Last 30 Days', days: 30 },
                { label: 'This Month', days: -1 },
                { label: 'Last Month', days: -2 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    const today = new Date();
                    let fromDate: Date;
                    let toDate = new Date();

                    if (preset.days === 0) {
                      fromDate = today;
                    } else if (preset.days === 1) {
                      fromDate = new Date(today);
                      fromDate.setDate(today.getDate() - 1);
                      toDate = fromDate;
                    } else if (preset.days === -1) {
                      // This month
                      fromDate = new Date(
                        today.getFullYear(),
                        today.getMonth(),
                        1,
                      );
                    } else if (preset.days === -2) {
                      // Last month
                      fromDate = new Date(
                        today.getFullYear(),
                        today.getMonth() - 1,
                        1,
                      );
                      toDate = new Date(
                        today.getFullYear(),
                        today.getMonth(),
                        0,
                      );
                    } else {
                      fromDate = new Date(today);
                      fromDate.setDate(today.getDate() - preset.days);
                    }

                    updateFilter(
                      'dateFrom',
                      fromDate.toISOString().split('T')[0],
                    );
                    updateFilter('dateTo', toDate.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 text-xs bg-primary-700/10 hover:bg-primary-700/20 text-primary-700 hover:text-primary-800 rounded transition-colors font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Encounter Status Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary-700" />
              Encounter Status
            </h3>
            <select
              value={filters.status}
              onChange={(e) =>
                updateFilter(
                  'status',
                  e.target.value as EncounterStatus | 'all',
                )
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="all">All Statuses</option>
              {EncounterStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Visit Type Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary-700" />
              Visit Type
            </h3>
            <select
              value={filters.visitType}
              onChange={(e) =>
                updateFilter('visitType', e.target.value as VisitType | 'all')
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="all">All Visit Types</option>
              {VisitTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary-700" />
              Priority Level
            </h3>
            <select
              value={filters.priority}
              onChange={(e) =>
                updateFilter(
                  'priority',
                  e.target.value as PriorityLevel | 'all',
                )
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="all">All Priorities</option>
              {PriorityLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          {/* Department Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary-700" />
              Department
            </h3>
            <select
              value={filters.departmentId}
              onChange={(e) => updateFilter('departmentId', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="all">All Departments</option>
              {departmentList.length > 0
                ? departmentList.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))
                : DEPARTMENTS.map((dept) => (
                    <option key={dept.value} value={dept.value}>
                      {dept.label}
                    </option>
                  ))}
            </select>
          </div>

          {/* Doctor Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary-700" />
              Attending Doctor
            </h3>
            <select
              value={filters.doctorId}
              onChange={(e) => updateFilter('doctorId', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="all">All Doctors</option>
              {doctorList.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </div>

          {/* Patient Category Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary-700" />
              Patient Category
            </h3>
            <select
              value={filters.patientCategory}
              onChange={(e) => updateFilter('patientCategory', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="all">All Categories</option>
              {VISIBLE_PATIENT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Insurance Type Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary-700" />
              Insurance Type
            </h3>
            <select
              value={filters.insuranceType}
              onChange={(e) => updateFilter('insuranceType', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="all">All Insurance Types</option>
              {VISIBLE_INSURANCE_TYPES.map((ins) => (
                <option key={ins.value} value={ins.value}>
                  {ins.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Category Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-700" />
              Payment Category
            </h3>
            <select
              value={filters.paymentCategory}
              onChange={(e) => updateFilter('paymentCategory', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="all">All Payment Categories</option>
              {VISIBLE_PAYMENT_CATEGORIES.map((pay) => (
                <option key={pay.value} value={pay.value}>
                  {pay.label}
                </option>
              ))}
            </select>
          </div>

          {/* Course Filter (for Participants) */}
          {courseList.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary-700" />
                Course (Participants)
              </h3>
              <select
                value={filters.course}
                onChange={(e) => updateFilter('course', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
              >
                <option value="all">All Courses</option>
                {courseList.map((course) => (
                  <option key={course.id} value={course.name}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Gender Filter */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="h-4 w-4 text-primary-700" />
              Gender
            </h3>
            <select
              value={filters.gender}
              onChange={(e) => updateFilter('gender', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          {/* Age Range Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary-700" />
              Age Range
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Min Age
                </label>
                <input
                  type="number"
                  value={filters.ageRangeMin}
                  onChange={(e) => updateFilter('ageRangeMin', e.target.value)}
                  placeholder="0"
                  min="0"
                  max="120"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Max Age
                </label>
                <input
                  type="number"
                  value={filters.ageRangeMax}
                  onChange={(e) => updateFilter('ageRangeMax', e.target.value)}
                  placeholder="No limit"
                  min="0"
                  max="120"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
                />
              </div>
            </div>
          </div>

          {/* Clinical Filters Divider */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
              Clinical Filters
            </h4>
          </div>

          {/* Diagnosis Filter */}
          {diagnosisList.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary-700" />
                Diagnosis
              </h3>
              <select
                value={filters.diagnosis}
                onChange={(e) => updateFilter('diagnosis', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
              >
                <option value="all">All Diagnoses</option>
                {diagnosisList.map((diag) => (
                  <option key={diag.name} value={diag.name}>
                    {diag.name} ({diag.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Chief Complaint Filter */}
          {chiefComplaintList.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary-700" />
                Chief Complaint
              </h3>
              <select
                value={filters.chiefComplaint}
                onChange={(e) => updateFilter('chiefComplaint', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
              >
                <option value="all">All Chief Complaints</option>
                {chiefComplaintList.map((complaint) => (
                  <option key={complaint.id} value={complaint.name}>
                    {complaint.name} ({complaint.category})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 space-y-3">
          <button
            onClick={onApplyFilters}
            className="w-full px-4 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Apply Filters
          </button>
          <button
            onClick={onClearFilters}
            className="w-full px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-700 font-medium rounded-lg border border-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Clear All Filters
          </button>
        </div>
      </div>
    </>
  );
}

// =============================================================================
// Filter Summary Badge
// =============================================================================

export function EncounterFilterBadge({
  filters,
  onClick,
}: {
  filters: AdvancedEncounterFilters;
  onClick: () => void;
}) {
  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    // Text search fields - count if not empty
    if (
      [
        'dateFrom',
        'dateTo',
        'ageRangeMin',
        'ageRangeMax',
        'searchQuery',
        'encounterNumber',
        'patientName',
        'emrNumber',
      ].includes(key)
    ) {
      return value !== '';
    }
    // Select fields - count if not 'all'
    return value !== 'all' && value !== '';
  });

  if (activeFilters.length === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-primary-700/10 text-primary-700 rounded-full text-sm hover:bg-primary-700/20 transition-colors font-medium"
    >
      <Filter className="h-3.5 w-3.5" />
      <span>
        {activeFilters.length} filter{activeFilters.length > 1 ? 's' : ''}{' '}
        active
      </span>
    </button>
  );
}
