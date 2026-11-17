/**
 * =============================================================================
 * XENOCARE EMR - CONSULTATION WIZARD
 * Modern step-based consultation workflow with progress indicator
 * Following SOAP methodology: Subjective → Objective → Assessment → Plan
 * =============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  isMilitaryFeatureEnabled,
  isNhisCategory,
  isNhisFeatureEnabled,
  isSpecialtyClinicsEnabled,
} from '../../../config/features';
import PatientAllergySummary from '../../../components/shared/PatientAllergySummary';
import {
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  User,
  Users,
  Heart,
  FileText,
  Stethoscope,
  ClipboardList,
  Pill,
  FlaskConical,
  Scan,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Activity,
  Thermometer,
  Clock,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  Circle,
  Loader2,
  Maximize2,
  Minimize2,
  Eye,
  Edit3,
  CheckSquare,
  Bed,
  Scissors,
  ListTodo,
  RefreshCw,
  Smile,
  Dumbbell,
  Send,
  Trash2,
  Share2,
  Building,
  ExternalLink,
  GripVertical,
  PanelRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeftCircle,
  ArrowRightCircle,
  Bot,
  Baby,
} from 'lucide-react';
import {
  Button,
  Input,
  CategorizedSearchableMultiSelect,
  SearchableOption,
  SearchableSelect,
} from '../../../components/ui';
import PrescriptionEditor from './prescriptions/PrescriptionEditor';
import LabSpecimenFields from './lab/LabSpecimenFields';
import ConsultationTemplatePopover from './ConsultationTemplatePopover';
import { INPUT_CLS } from '../../../components/ui/ConsultationFormUI';
import {
  SkeletonForm,
  SkeletonList,
} from '../../../components/ui/SkeletonLoader';
import {
  CreateConsultationDTO,
  LabOrderDTO,
  RadiologyOrderDTO,
  PrescriptionOrderDTO,
  ProcedureOrderDTO,
  AdmissionOrderDTO,
} from '../dtos/consultation.dto';
// Removed import from deleted file
import {
  useLabTestCatalogue,
  useImagingCatalogue,
  useDrugCatalogue,
  useProcedureCatalogue,
  useWardsCatalogue,
} from '../hooks/useConsultation';
import { usePatientSearch } from '../../patient-registration/hooks/usePatient';
import {
  PatientDTO,
  formatPatientName,
  formatDetailedAge,
} from '../../patient-registration/dtos/patient.dto';
import { useDebounce } from '../../../hooks/useDebounce';
import { useToast } from '../../../components/ui/Toast';
import PatientVitalsSummary from './PatientVitalsSummary';
import { ICDMultiSelect, ICDMultiSelectDiagnosis } from './ICDDiagnosisSearch';
import ChiefComplaintsSection, {
  SelectedComplaint,
} from './ChiefComplaintsSection';
import {
  CreateTreatmentTaskDTO,
  TREATMENT_TASK_TYPES,
  TreatmentTaskType,
} from '../../treatment-plan/dtos/treatment-plan.dto';
import { EncounterSummary } from '../../../lib/encounter';
import { supabase } from '../../../api/supabaseClient';
import {
  usePatientMedicalRecords,
  useEncounterDetails,
} from '../hooks/useMedicalRecords';
import {
  EncounterSummary as MedRecEncounterSummary,
  EncounterDetail,
} from '../api/medical-records.api';
import {
  OverviewPanel,
  TimelinePanel,
  VitalsPanel,
  LabsPanel,
  RadiologyPanel,
  PharmacyPanel,
  AllNotesPanel,
  TreatmentPlanPanel,
  AdmissionsPanel,
  ProceduresPanel,
  BillingPanel,
  DentalPanel,
  OphthalmologyPanel,
  PhysiotherapyPanel,
} from './medical-records/encounter-centric/panels';
import { useAuth } from '../../../contexts/AuthContext';
import { AIChatPanel } from '../../ai-assistant/components/AIChatPanel';
import { AIConsultationReview } from '../../ai-assistant/components/AIConsultationReview';
import { AncDoctorEncounterAdapter } from '../../anc/components/adapters/AncDoctorEncounterAdapter';
import { ConsultationPatientContextBar } from '../../specialty-common';
import { useWorkflowDraftPersistence } from '../hooks/useWorkflowDraftPersistence';

export interface SpecialtyReferralDTO {
  specialty: string;
  reason: string;
  urgency: 'Routine' | 'Urgent' | 'Emergency';
  referralType: 'internal' | 'external';
  externalFacility?: string;
  externalDoctor?: string;
  // Physiotherapy treatment plan fields (only for physio referrals)
  physioSessionsPlanned?: number;
  physioFrequency?: string;
  physioBillingType?: 'per_session' | 'package';
  physioInstructions?: string;
}

// Separate interface for External NHIS Referrals (to outside hospitals)
export interface ExternalNhisReferralDTO {
  facilityName: string;
  facilityAddress?: string;
  doctorName?: string;
  reason: string;
  clinicalFindings: string;
  investigationFindings?: string;
  provisionalDiagnosis: string;
  urgency: 'Routine' | 'Urgent' | 'Emergency';
}

// =============================================================================
// Types
// =============================================================================

interface ConsultationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateConsultationDTO,
    labOrders: LabOrderDTO[],
    radiologyOrders: RadiologyOrderDTO[],
    prescriptions: PrescriptionOrderDTO[],
    procedureOrders?: ProcedureOrderDTO[],
    admissionOrder?: AdmissionOrderDTO | null,
    treatmentTasks?: CreateTreatmentTaskDTO[],
    specialtyReferrals?: SpecialtyReferralDTO[],
    externalNhisReferral?: ExternalNhisReferralDTO | null,
  ) => Promise<void>;
  isLoading?: boolean;
  preselectedPatient?: PatientDTO | null;
  visitId?: string | null;
  encounterId?: string | null;
}

interface Step {
  id: string;
  title: string;
  shortTitle: string;
  icon: React.ReactNode;
  description: string;
  category: 'subjective' | 'objective' | 'assessment' | 'plan' | 'review';
}

// =============================================================================
// Step Configuration - SOAP Methodology
// =============================================================================

const DEFAULT_STEPS: Step[] = [
  {
    id: 'review',
    title: 'Patient Review',
    shortTitle: 'Review',
    icon: <User size={12} />,
    description: 'Patient info & vital signs',
    category: 'subjective',
  },
  {
    id: 'complaints',
    title: 'Chief Complaints',
    shortTitle: 'Complaints',
    icon: <Heart size={12} />,
    description: 'Primary presenting complaints',
    category: 'subjective',
  },
  {
    id: 'history',
    title: 'Clinical History',
    shortTitle: 'History',
    icon: <FileText size={12} />,
    description: 'History & review of systems',
    category: 'subjective',
  },
  {
    id: 'examination',
    title: 'Examination',
    shortTitle: 'Exam',
    icon: <Stethoscope size={12} />,
    description: 'Physical examination findings',
    category: 'objective',
  },
  {
    id: 'diagnosis',
    title: 'Diagnosis',
    shortTitle: 'Diagnosis',
    icon: <ClipboardList size={12} />,
    description: 'ICD-10 diagnosis & differentials',
    category: 'assessment',
  },
  {
    id: 'orders',
    title: 'Orders & Plan',
    shortTitle: 'Plan',
    icon: <Pill size={12} />,
    description: 'Rx, Labs, Imaging, Procedures, Admission',
    category: 'plan',
  },
  {
    id: 'review-submit',
    title: 'Preview & Submit',
    shortTitle: 'Preview',
    icon: <CheckSquare size={12} />,
    description: 'Preview all details before saving',
    category: 'review',
  },
];

const SOAP_COLORS = {
  subjective: {
    bg: 'bg-blue-500',
    light: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  objective: {
    bg: 'bg-green-500',
    light: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
  },
  assessment: {
    bg: 'bg-purple-500',
    light: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
  },
  plan: {
    bg: 'bg-orange-500',
    light: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
  },
  review: {
    bg: 'bg-emerald-500',
    light: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
  },
};

// =============================================================================
// Shared Interactive UI Helpers
// =============================================================================

/** Chip-based single-select for short option lists — replaces raw <select> */
function ChipField({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
              isSelected
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Progress Indicator Component
// =============================================================================

function ProgressIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  onNext,
  onPrev,
  isLastStep,
}: {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<string>;
  onStepClick: (index: number) => void;
  onNext: () => void;
  onPrev: () => void;
  isLastStep: boolean;
}) {
  const progressPct = Math.round((completedSteps.size / steps.length) * 100);

  // Category → Tailwind bg/border/text for pill states
  const catBg: Record<string, string> = {
    subjective: 'bg-blue-500',
    objective: 'bg-green-500',
    assessment: 'bg-purple-500',
    plan: 'bg-orange-500',
    review: 'bg-slate-500',
  };
  const catOutline: Record<string, string> = {
    subjective: 'border-blue-300 text-blue-700',
    objective: 'border-green-300 text-green-700',
    assessment: 'border-purple-300 text-purple-700',
    plan: 'border-orange-300 text-orange-700',
    review: 'border-slate-300 text-slate-700',
  };

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 flex-shrink-0">
      {/* Pill Step Indicators */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 pb-0.5">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = completedSteps.has(step.id);
            const bg = catBg[step.category] || catBg.review;
            const outline = catOutline[step.category] || catOutline.review;

            return (
              <button
                key={step.id}
                onClick={() => onStepClick(index)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 whitespace-nowrap shrink-0 ${
                  isActive
                    ? `${bg} text-white border-transparent shadow-sm scale-105`
                    : isCompleted
                      ? `bg-white ${outline} hover:shadow-sm`
                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
                }`}
              >
                {isCompleted && !isActive ? (
                  <Check size={12} className="shrink-0" />
                ) : (
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    {step.icon}
                  </span>
                )}
                <span className="hidden sm:inline">{step.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {currentStep > 0 && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border text-gray-600 border-gray-300 hover:bg-gray-100 hover:text-gray-800 text-xs font-medium"
              title="Previous Step"
            >
              <ArrowLeftCircle size={14} />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          {!isLastStep && (
            <button
              onClick={onNext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border text-white bg-primary-700 border-primary-700 hover:bg-primary-800 shadow-sm text-xs font-medium"
              title="Next Step"
            >
              <span className="hidden sm:inline">Next</span>
              <ArrowRightCircle size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Step Content Components
// =============================================================================

// Step 1: Patient Review with Vitals
function ReviewStep({
  selectedPatient,
  onSelectPatient,
  onClearPatient,
  patientSearch,
  onPatientSearchChange,
  searchResults,
  isSearching,
  error,
  selectedEncounter,
  onSelectEncounter,
  encounterError,
  isLoadingEncounter,
  patientEncounters,
}: {
  selectedPatient: PatientDTO | null;
  onSelectPatient: (patient: PatientDTO) => void;
  onClearPatient: () => void;
  patientSearch: string;
  onPatientSearchChange: (value: string) => void;
  searchResults?: PatientDTO[];
  isSearching: boolean;
  error?: string;
  selectedEncounter: EncounterSummary | null;
  onSelectEncounter: (encounter: EncounterSummary | null) => void;
  encounterError?: string;
  isLoadingEncounter: boolean;
  patientEncounters: EncounterSummary[];
}) {
  const [showEncounterDropdown, setShowEncounterDropdown] = useState(false);

  // Format date for display
  const formatEncounterDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate hours since encounter started
  const getEncounterAge = (dateString: string) => {
    const hours =
      (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${Math.floor(hours)} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
  };

  return (
    <div className="space-y-6">
      {/* Patient Banner - Shows when patient is selected */}
      {selectedPatient && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <User className="h-40 w-40 text-gray-900 rotate-12 transform translate-x-10 -translate-y-10" />
          </div>

          <div className="flex items-start gap-6 relative z-10">
            {/* Patient Photo Section */}
            <div className="flex-shrink-0">
              {selectedPatient.photo_url ? (
                <img
                  src={selectedPatient.photo_url}
                  alt={formatPatientName(selectedPatient)}
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-50 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-gray-50 flex flex-col items-center justify-center shadow-inner">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>

            {/* Patient Details */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 truncate">
                    {formatPatientName(selectedPatient)}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      EMR: {selectedPatient.emr_number || 'N/A'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedPatient.gender === 'Male'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-pink-50 text-pink-700'
                      }`}
                    >
                      {selectedPatient.gender}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {formatDetailedAge(selectedPatient.date_of_birth)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearPatient}
                  className="bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                >
                  Change Patient
                </Button>
              </div>

              {/* Additional Patient Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-100">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date of Birth
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedPatient.date_of_birth
                      ? new Date(
                          selectedPatient.date_of_birth,
                        ).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedPatient.contact_phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Blood Group
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {selectedPatient.blood_group || 'N/A'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allergies
                  </p>
                  <PatientAllergySummary
                    patientId={selectedPatient.id}
                    knownAllergies={selectedPatient.known_allergies}
                    noKnownAllergies={
                      (selectedPatient as { no_known_allergies?: boolean })
                        .no_known_allergies
                    }
                    compact
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient Selection - Shows when no patient selected */}
      {!selectedPatient && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Select Patient
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Search for a registered patient by name, patient number or phone number
            to begin the consultation.
          </p>

          <div className="max-w-xl mx-auto relative text-left">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => onPatientSearchChange(e.target.value)}
                className={`w-full pl-12 pr-4 py-4 bg-gray-50/50 border rounded-2xl transition-all text-sm ${
                  error
                    ? 'border-red-300 focus:border-red-500 focus:bg-white'
                    : 'border-transparent focus:border-gray-300 focus:bg-white'
                } focus:ring-0 placeholder:text-gray-400`}
                placeholder="Search patient..."
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}

            {/* Search Results */}
            {(isSearching || (searchResults && searchResults.length > 0)) && (
              <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-80 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4">
                    <SkeletonForm fields={4} hasButtons={false} />
                  </div>
                ) : (
                  <div className="py-2">
                    {searchResults?.map((patient) => (
                      <button
                        key={patient.patient_id}
                        type="button"
                        onClick={() => onSelectPatient(patient)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-4 transition-colors"
                      >
                        {patient.photo_url ? (
                          <img
                            src={patient.photo_url}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-sm">
                            {patient.first_name.charAt(0)}
                            {patient.surname.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {formatPatientName(patient)}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            {patient.emr_number && (
                              <span className="font-medium text-gray-700">
                                {patient.emr_number}
                              </span>
                            )}
                            <span>•</span>
                            <span>{patient.gender}</span>
                            <span>•</span>
                            <span>
                              {formatDetailedAge(patient.date_of_birth)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Encounter Selection - Shows when patient is selected */}
      {selectedPatient && (
        <div
          className={`rounded-2xl border p-6 transition-colors ${
            selectedEncounter
              ? 'bg-white border-green-200 ring-1 ring-green-100'
              : encounterError
                ? 'bg-amber-50 border-amber-200'
                : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                  selectedEncounter
                    ? 'bg-green-50 border-green-200 text-green-600'
                    : encounterError
                      ? 'bg-amber-50 border-amber-200 text-amber-600'
                      : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              >
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Encounter Context
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedEncounter
                    ? 'Services will be linked to this active visit'
                    : 'Please select a visit to continue'}
                </p>
              </div>
            </div>
            {isLoadingEncounter && (
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            )}
          </div>

          {/* Encounter Info or Selection */}
          {isLoadingEncounter ? (
            <div className="border-t border-gray-100 mt-4 pt-4">
              <SkeletonForm fields={4} hasButtons={false} />
            </div>
          ) : selectedEncounter ? (
            <div className="mt-6 pt-6 border-t border-gray-100">
              {/* Selected Encounter Card */}
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                        {selectedEncounter.encounter_number ||
                          selectedEncounter.visit_id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          selectedEncounter.status === 'Active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {selectedEncounter.status}
                      </span>
                      <span className="text-xs font-medium text-gray-500">
                        {selectedEncounter.visit_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        {formatEncounterDate(selectedEncounter.created_at)}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span>
                        {getEncounterAge(selectedEncounter.created_at)} ago
                      </span>
                    </div>

                    {selectedEncounter.chief_complaint && (
                      <div className="mt-3 p-3 bg-white rounded border border-gray-100 text-sm text-gray-600 italic">
                        "{selectedEncounter.chief_complaint}"
                      </div>
                    )}

                    {/* Encounter Stats */}
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-medium text-gray-500">
                      {selectedEncounter.consultation_count > 0 && (
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-gray-200">
                          <FileText className="h-3.5 w-3.5" />
                          {selectedEncounter.consultation_count} Note
                          {selectedEncounter.consultation_count !== 1
                            ? 's'
                            : ''}
                        </span>
                      )}
                      {selectedEncounter.lab_order_count > 0 && (
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-gray-200">
                          <FlaskConical className="h-3.5 w-3.5" />
                          {selectedEncounter.lab_order_count} Lab
                          {selectedEncounter.lab_order_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {selectedEncounter.prescription_count > 0 && (
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-gray-200">
                          <Pill className="h-3.5 w-3.5" />
                          {selectedEncounter.prescription_count} Rx
                        </span>
                      )}
                    </div>
                  </div>

                  {patientEncounters.length > 1 && (
                    <div className="relative flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setShowEncounterDropdown(!showEncounterDropdown)
                        }
                        className="bg-white hover:bg-gray-50 text-gray-600 border-gray-200 shadow-sm"
                      >
                        Change
                        <ChevronDown
                          className={`ml-2 h-3.5 w-3.5 transition-transform ${showEncounterDropdown ? 'rotate-180' : ''}`}
                        />
                      </Button>

                      {/* Dropdown */}
                      {showEncounterDropdown && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowEncounterDropdown(false)}
                          />
                          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto ring-1 ring-black ring-opacity-5">
                            <div className="p-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 rounded-t-lg">
                              Available Encounters
                            </div>
                            {patientEncounters.map((enc) => (
                              <button
                                key={enc.visit_id}
                                type="button"
                                onClick={() => {
                                  onSelectEncounter(enc);
                                  setShowEncounterDropdown(false);
                                }}
                                className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors flex items-start gap-3 ${
                                  enc.visit_id === selectedEncounter.visit_id
                                    ? 'bg-green-50/50'
                                    : ''
                                }`}
                              >
                                <div
                                  className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                                    enc.status === 'Active'
                                      ? 'bg-green-500'
                                      : 'bg-gray-300'
                                  }`}
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 text-sm">
                                      {enc.visit_type}
                                    </span>
                                    {enc.visit_id ===
                                      selectedEncounter.visit_id && (
                                      <span className="text-xs uppercase font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {formatEncounterDate(enc.created_at)}
                                  </div>
                                  {enc.chief_complaint && (
                                    <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                                      {enc.chief_complaint}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : encounterError ? (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 text-sm">
                    Action Required
                  </h4>
                  <p className="text-sm text-amber-800 mt-1">
                    {encounterError}
                  </p>
                </div>
              </div>
            </div>
          ) : patientEncounters.length > 0 ? (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
              <p className="text-xs font-medium text-gray-500">
                Recent Visits ({patientEncounters.length})
              </p>
              <div className="grid gap-3">
                {patientEncounters.map((enc) => (
                  <button
                    key={enc.visit_id}
                    type="button"
                    onClick={() => onSelectEncounter(enc)}
                    className="w-full p-4 bg-white border border-gray-200 hover:border-green-500 hover:ring-1 hover:ring-green-500 rounded-lg text-left transition-all group shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1.5 w-2.5 h-2.5 rounded-full ${
                            enc.status === 'Active'
                              ? 'bg-green-500'
                              : 'bg-gray-300'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {enc.visit_type}
                            </span>
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                              {enc.encounter_number || 'No ID'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatEncounterDate(enc.created_at)}
                            <span className="text-gray-300 mx-1.5">•</span>
                            {getEncounterAge(enc.created_at)} ago
                          </div>
                          {enc.chief_complaint && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-1 italic group-hover:text-gray-900 transition-colors">
                              "{enc.chief_complaint}"
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-green-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Vitals Summary - REMOVED duplicative check as now persistent at top level */}
    </div>
  );
}

// Step 2: Chief Complaints
function ComplaintsStep({
  selectedComplaints,
  onComplaintsChange,
  error,
  disabled,
}: {
  selectedComplaints: SelectedComplaint[];
  onComplaintsChange: (complaints: SelectedComplaint[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      <ChiefComplaintsSection
        selectedComplaints={selectedComplaints}
        onComplaintsChange={onComplaintsChange}
        expanded
        onExpandedChange={() => {}}
        error={error}
        disabled={disabled}
      />
    </div>
  );
}

// Step 3: Clinical History
function HistoryStep({
  formData,
  onChange,
}: {
  formData: CreateConsultationDTO;
  onChange: (field: string, value: string) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    pmh: !!formData.past_medical_history,
    fh: !!formData.family_history,
    sh: !!formData.social_history,
    ros: !!formData.review_of_systems,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      {/* History of Present Illness (Always visible) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] font-semibold text-gray-800 tracking-tight flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary-600" />
            History of Present Illness
          </label>

        </div>
        <textarea
          value={formData.history_of_present_illness || ''}
          onChange={(e) =>
            onChange('history_of_present_illness', e.target.value)
          }
          rows={5}
          className={`${INPUT_CLS} resize-y`}
          placeholder="Describe the onset, duration, progression, and character of symptoms..."
        />
      </div>

      {/* Optional History Sections (Progressive Disclosure) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Past Medical History */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('pmh')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Activity
                className={`h-4 w-4 ${expandedSections.pmh || formData.past_medical_history ? 'text-primary-600' : 'text-gray-400'}`}
              />
              <span
                className={`text-sm font-bold ${expandedSections.pmh || formData.past_medical_history ? 'text-gray-900' : 'text-gray-600'}`}
              >
                Past Medical History
              </span>
              {formData.past_medical_history && !expandedSections.pmh && (
                <span className="w-2 h-2 rounded-full bg-success-500 ml-2" />
              )}
            </div>
            {expandedSections.pmh ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {expandedSections.pmh && (
            <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50/50">
              <textarea
                value={formData.past_medical_history || ''}
                onChange={(e) =>
                  onChange('past_medical_history', e.target.value)
                }
                rows={4}
                className={`${INPUT_CLS} resize-y`}
                placeholder="Previous conditions, surgeries, chronic diseases, allergies..."
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Family History */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('fh')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users
                className={`h-4 w-4 ${expandedSections.fh || formData.family_history ? 'text-primary-600' : 'text-gray-400'}`}
              />
              <span
                className={`text-sm font-bold ${expandedSections.fh || formData.family_history ? 'text-gray-900' : 'text-gray-600'}`}
              >
                Family History
              </span>
              {formData.family_history && !expandedSections.fh && (
                <span className="w-2 h-2 rounded-full bg-success-500 ml-2" />
              )}
            </div>
            {expandedSections.fh ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {expandedSections.fh && (
            <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50/50">
              <textarea
                value={formData.family_history || ''}
                onChange={(e) => onChange('family_history', e.target.value)}
                rows={4}
                className={`${INPUT_CLS} resize-y`}
                placeholder="Hereditary conditions, family medical history..."
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Social History */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('sh')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Smile
                className={`h-4 w-4 ${expandedSections.sh || formData.social_history ? 'text-primary-600' : 'text-gray-400'}`}
              />
              <span
                className={`text-sm font-bold ${expandedSections.sh || formData.social_history ? 'text-gray-900' : 'text-gray-600'}`}
              >
                Social History
              </span>
              {formData.social_history && !expandedSections.sh && (
                <span className="w-2 h-2 rounded-full bg-success-500 ml-2" />
              )}
            </div>
            {expandedSections.sh ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {expandedSections.sh && (
            <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50/50">
              <textarea
                value={formData.social_history || ''}
                onChange={(e) => onChange('social_history', e.target.value)}
                rows={4}
                className={`${INPUT_CLS} resize-y`}
                placeholder="Lifestyle, occupation, habits, living conditions..."
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Review of Systems */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('ros')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Stethoscope
                className={`h-4 w-4 ${expandedSections.ros || formData.review_of_systems ? 'text-primary-600' : 'text-gray-400'}`}
              />
              <span
                className={`text-sm font-bold ${expandedSections.ros || formData.review_of_systems ? 'text-gray-900' : 'text-gray-600'}`}
              >
                Review of Systems
              </span>
              {formData.review_of_systems && !expandedSections.ros && (
                <span className="w-2 h-2 rounded-full bg-success-500 ml-2" />
              )}
            </div>
            {expandedSections.ros ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {expandedSections.ros && (
            <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50/50">
              <textarea
                value={formData.review_of_systems || ''}
                onChange={(e) => onChange('review_of_systems', e.target.value)}
                rows={4}
                className={`${INPUT_CLS} resize-y`}
                placeholder="Cardiovascular, respiratory, GI, neurological systems..."
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Step 4: Examination Findings
function ExaminationStep({
  formData,
  onChange,
}: {
  formData: CreateConsultationDTO;
  onChange: (field: string, value: string) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    detailed: !!formData.physical_examination,
    notes: !!formData.clinical_notes,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      {/* General Examination Findings (Always visible) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] font-semibold text-gray-800 tracking-tight flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary-600" />
            General Examination Findings
          </label>

        </div>
        <textarea
          value={formData.examination_findings || ''}
          onChange={(e) => onChange('examination_findings', e.target.value)}
          rows={4}
          className={`${INPUT_CLS} resize-y`}
          placeholder="General appearance, vital signs interpretation, overall assessment..."
        />
        <p className="text-xs text-gray-500 mt-2">
          Document general appearance, systems examination summary, and key
          findings
        </p>
      </div>

      {/* Optional Examination Sections (Progressive Disclosure) */}
      <div className="space-y-4">
        {/* Detailed Physical Examination */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('detailed')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Activity
                className={`h-4 w-4 ${expandedSections.detailed || formData.physical_examination ? 'text-primary-600' : 'text-gray-400'}`}
              />
              <span
                className={`text-sm font-bold ${expandedSections.detailed || formData.physical_examination ? 'text-gray-900' : 'text-gray-600'}`}
              >
                Detailed Physical Examination
              </span>
              {formData.physical_examination && !expandedSections.detailed && (
                <span className="w-2 h-2 rounded-full bg-success-500 ml-2" />
              )}
            </div>
            {expandedSections.detailed ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {expandedSections.detailed && (
            <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50/50">
              <textarea
                value={formData.physical_examination || ''}
                onChange={(e) =>
                  onChange('physical_examination', e.target.value)
                }
                rows={8}
                className={`${INPUT_CLS} resize-y font-mono`}
                placeholder="Cardiovascular: ...&#10;Respiratory: ...&#10;Abdominal: ...&#10;Neurological: ...&#10;Musculoskeletal: ..."
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Detailed findings by body system (cardiovascular, respiratory,
                abdominal, neurological, etc.)
              </p>
            </div>
          )}
        </div>

        {/* Clinical Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('notes')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText
                className={`h-4 w-4 ${expandedSections.notes || formData.clinical_notes ? 'text-primary-600' : 'text-gray-400'}`}
              />
              <span
                className={`text-sm font-bold ${expandedSections.notes || formData.clinical_notes ? 'text-gray-900' : 'text-gray-600'}`}
              >
                Additional Clinical Notes
              </span>
              {formData.clinical_notes && !expandedSections.notes && (
                <span className="w-2 h-2 rounded-full bg-success-500 ml-2" />
              )}
            </div>
            {expandedSections.notes ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {expandedSections.notes && (
            <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50/50">
              <textarea
                value={formData.clinical_notes || ''}
                onChange={(e) => onChange('clinical_notes', e.target.value)}
                rows={4}
                className={`${INPUT_CLS} resize-y`}
                placeholder="Additional clinical observations, impressions, or notes..."
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Step 5: Diagnosis
function DiagnosisStep({
  selectedDiagnoses,
  onDiagnosesChange,
  formData,
  onChange,
  disabled,
}: {
  selectedDiagnoses: ICDMultiSelectDiagnosis[];
  onDiagnosesChange: (diagnoses: ICDMultiSelectDiagnosis[]) => void;
  formData: CreateConsultationDTO;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Diagnosis Selection
          </h3>
          <ICDMultiSelect
            selectedDiagnoses={selectedDiagnoses}
            onChange={onDiagnosesChange}
            label=""
            placeholder="Search ICD-10 codes to add diagnoses..."
            maxDiagnoses={15}
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">
                Treatment Plan
              </label>

            </div>
            <textarea
              value={formData.treatment_plan || ''}
              onChange={(e) => onChange('treatment_plan', e.target.value)}
              rows={6}
              className={`${INPUT_CLS} resize-none`}
              placeholder="Describe the treatment approach and clinical recommendations..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">
                Recommendations
              </label>

            </div>
            <textarea
              value={formData.recommendations || ''}
              onChange={(e) => onChange('recommendations', e.target.value)}
              rows={6}
              className={`${INPUT_CLS} resize-none`}
              placeholder="Patient instructions, lifestyle modifications, diet, exercise, when to return..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 6: Orders & Plan
function OrdersStep({
  selectedPatient,
  labOrders,
  radiologyOrders,
  prescriptions,
  procedureOrders,
  admissionOrder,
  onLabOrdersChange,
  onRadiologyOrdersChange,
  onPrescriptionsChange,
  onProcedureOrdersChange,
  onAdmissionOrderChange,
  treatmentTasks,
  onTreatmentTasksChange,
  showAddTask,
  setShowAddTask,
  newTask,
  setNewTask,
  labTestOptions,
  imagingOptions,
  isLoadingImaging = false,
  drugOptions,
  procedureOptions,
  wardOptions,
  formData,
  onChange,
  specialtyReferrals,
  onSpecialtyReferralsChange,
  selectedDiagnoses,
  externalNhisReferral,
  setExternalNhisReferral,
  physioTreatmentPlanOrder,
  setPhysioTreatmentPlanOrder,
}: {
  selectedPatient: PatientDTO | null;
  labOrders: LabOrderDTO[];
  radiologyOrders: RadiologyOrderDTO[];
  prescriptions: PrescriptionOrderDTO[];
  procedureOrders: ProcedureOrderDTO[];
  admissionOrder: AdmissionOrderDTO | null;
  onLabOrdersChange: (orders: LabOrderDTO[]) => void;
  onRadiologyOrdersChange: (orders: RadiologyOrderDTO[]) => void;
  onPrescriptionsChange: (prescriptions: PrescriptionOrderDTO[]) => void;
  onProcedureOrdersChange: (orders: ProcedureOrderDTO[]) => void;
  onAdmissionOrderChange: (order: AdmissionOrderDTO | null) => void;
  treatmentTasks: CreateTreatmentTaskDTO[];
  onTreatmentTasksChange: (tasks: CreateTreatmentTaskDTO[]) => void;
  showAddTask: boolean;
  setShowAddTask: (show: boolean) => void;
  newTask: Partial<CreateTreatmentTaskDTO>;
  setNewTask: (task: Partial<CreateTreatmentTaskDTO>) => void;
  labTestOptions: SearchableOption[];
  imagingOptions: SearchableOption[];
  isLoadingImaging?: boolean;
  drugOptions: SearchableOption[];
  procedureOptions: SearchableOption[];
  wardOptions: SearchableOption[];
  formData: CreateConsultationDTO;
  onChange: (field: string, value: string) => void;
  specialtyReferrals: Record<
    string,
    {
      selected: boolean;
      reason: string;
      urgency: 'Routine' | 'Urgent' | 'Emergency';
      referralType: 'internal' | 'external';
      externalFacility: string;
      externalDoctor: string;
      clinicalFindings: string;
      provisionalDiagnosis: string;
    }
  >;
  onSpecialtyReferralsChange: React.Dispatch<
    React.SetStateAction<
      Record<
        string,
        {
          selected: boolean;
          reason: string;
          urgency: 'Routine' | 'Urgent' | 'Emergency';
          referralType: 'internal' | 'external';
          externalFacility: string;
          externalDoctor: string;
          clinicalFindings: string;
          provisionalDiagnosis: string;
        }
      >
    >
  >;
  selectedDiagnoses: ICDMultiSelectDiagnosis[];
  externalNhisReferral: {
    enabled: boolean;
    facilityName: string;
    facilityAddress: string;
    doctorName: string;
    reason: string;
    clinicalFindings: string;
    investigationFindings: string;
    provisionalDiagnosis: string;
    urgency: 'Routine' | 'Urgent' | 'Emergency';
  };
  setExternalNhisReferral: React.Dispatch<
    React.SetStateAction<{
      enabled: boolean;
      facilityName: string;
      facilityAddress: string;
      doctorName: string;
      reason: string;
      clinicalFindings: string;
      investigationFindings: string;
      provisionalDiagnosis: string;
      urgency: 'Routine' | 'Urgent' | 'Emergency';
    }>
  >;
  physioTreatmentPlanOrder: {
    sessionsPlanned: number;
    frequency: string;
    billingType: 'per_session' | 'package';
    instructions: string;
  };
  setPhysioTreatmentPlanOrder: React.Dispatch<
    React.SetStateAction<{
      sessionsPlanned: number;
      frequency: string;
      billingType: 'per_session' | 'package';
      instructions: string;
    }>
  >;
}) {
  const specialtyReferralCount = Object.values(specialtyReferrals).filter(
    (r) => r?.selected,
  ).length;
  const [activeOrderTab, setActiveOrderTab] = useState<
    | 'rx'
    | 'lab'
    | 'imaging'
    | 'procedures'
    | 'admission'
    | 'nursing'
    | 'referrals'
  >('rx');

  const orderTabs = [
    {
      id: 'rx',
      label: 'Prescriptions',
      icon: <Pill size={16} />,
      count: prescriptions.length,
      color: 'orange',
    },
    {
      id: 'lab',
      label: 'Lab Tests',
      icon: <FlaskConical size={16} />,
      count: labOrders.length,
      color: 'emerald',
    },
    {
      id: 'imaging',
      label: 'Imaging',
      icon: <Scan size={16} />,
      count: radiologyOrders.length,
      color: 'blue',
    },
    {
      id: 'procedures',
      label: 'Procedures',
      icon: <Scissors size={16} />,
      count: procedureOrders.length,
      color: 'purple',
    },
    {
      id: 'admission',
      label: 'Admission',
      icon: <Bed size={16} />,
      count: admissionOrder ? 1 : 0,
      color: 'rose',
    },
    {
      id: 'nursing',
      label: 'Nursing Tasks',
      icon: <ListTodo size={16} />,
      count: treatmentTasks.length,
      color: 'teal',
    },
    {
      id: 'referrals',
      label: 'Referrals',
      icon: <Share2 size={16} />,
      count: specialtyReferralCount,
      color: 'cyan',
    },
  ];

  const selectedLabIds = labOrders.map((o) => o.test_id);
  const selectedImagingIds = radiologyOrders.map((o) => o.imaging_id);
  const selectedProcedureIds = procedureOrders.map((o) => o.procedure_id);

  return (
    <div className="space-y-6">
      {/* Order Type Tabs - Modern Clean Design */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
        <div className="flex space-x-1 min-w-max px-1">
          {orderTabs.map((tab) => {
            const isActive = activeOrderTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveOrderTab(tab.id as any)}
                className={`
                  group flex items-center gap-2 py-3 px-4 text-sm font-medium transition-all border-b-2
                  ${
                    isActive
                      ? 'border-green-600 text-green-700 bg-green-50/30'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <span
                  className={`transition-colors ${isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`}
                >
                  {tab.icon}
                </span>
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`ml-1.5 min-w-[1.25rem] h-5 flex items-center justify-center rounded-full text-xs font-bold px-1.5 ${
                      isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prescriptions Tab */}
      {activeOrderTab === 'rx' && (
        <PrescriptionEditor
          prescriptions={prescriptions}
          onChange={onPrescriptionsChange}
          drugOptions={drugOptions}
          clinicalNotes={
            formData.examination_findings ||
            formData.physical_examination ||
            formData.clinical_notes ||
            ''
          }
          diagnosis={selectedDiagnoses.map((diagnosis) => diagnosis.title)}
        />
      )}

      {/* Lab Tests Tab */}
      {activeOrderTab === 'lab' && (
        <div className="space-y-4">
          <CategorizedSearchableMultiSelect
            options={labTestOptions}
            selectedIds={selectedLabIds}
            onToggleSelect={(testId: string) => {
              const test = labTestOptions.find((t) => t.id === testId);
              if (selectedLabIds.includes(testId)) {
                onLabOrdersChange(
                  labOrders.filter((o) => o.test_id !== testId),
                );
              } else {
                // Prefill clinical context from consultation form (similar to specialty referrals)
                const prefillClinicalNotes =
                  formData.examination_findings ||
                  formData.physical_examination ||
                  formData.clinical_notes ||
                  '';
                const prefillDiagnosis =
                  selectedDiagnoses.length > 0
                    ? selectedDiagnoses.map((d) => d.title)
                    : [];
                onLabOrdersChange([
                  ...labOrders,
                  {
                    test_id: testId,
                    priority: 'Normal',
                    test_name: test?.name,
                    test_code: test?.code,
                    specimen_type: test?.subCategory,
                    clinical_notes: prefillClinicalNotes,
                    diagnosis: prefillDiagnosis,
                  },
                ]);
              }
            }}
            placeholder="Search lab tests by name, code, or category..."
            allCategoriesLabel="All Tests"
          />

          {/* Selected Lab Tests with Clinical Notes */}
          {labOrders.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500">
                Selected Lab Tests:
              </p>
              {labOrders.map((order) => {
                const test = labTestOptions.find((t) => t.id === order.test_id);
                return (
                  <div
                    key={order.test_id}
                    className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {test?.name || order.test_name || order.test_id}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onLabOrdersChange(
                            labOrders.filter(
                              (o) => o.test_id !== order.test_id,
                            ),
                          )
                        }
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <LabSpecimenFields
                      specimenType={order.specimen_type || test?.subCategory}
                      specimenIdentifier={order.specimen_identifier}
                      onChange={(patch) =>
                        onLabOrdersChange(
                          labOrders.map((o) =>
                            o.test_id === order.test_id
                              ? { ...o, ...patch }
                              : o,
                          ),
                        )
                      }
                    />
                    <textarea
                      value={order.clinical_notes || ''}
                      onChange={(e) =>
                        onLabOrdersChange(
                          labOrders.map((o) =>
                            o.test_id === order.test_id
                              ? { ...o, clinical_notes: e.target.value }
                              : o,
                          ),
                        )
                      }
                      placeholder="Clinical notes (optional) - reason for test, relevant history..."
                      rows={2}
                      className="w-full mt-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Imaging Tab */}
      {activeOrderTab === 'imaging' && (
        <div className="space-y-4">
          {isLoadingImaging ? (
            <div className="flex items-center justify-center gap-3 py-10 text-gray-500">
              <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <span className="text-sm">Loading imaging catalogue...</span>
            </div>
          ) : (
          <CategorizedSearchableMultiSelect
            options={imagingOptions}
            selectedIds={selectedImagingIds}
            onToggleSelect={(imagingId: string) => {
              const imaging = imagingOptions.find((i) => i.id === imagingId);
              if (selectedImagingIds.includes(imagingId)) {
                onRadiologyOrdersChange(
                  radiologyOrders.filter((o) => o.imaging_id !== imagingId),
                );
              } else {
                // Prefill clinical context from consultation form (similar to specialty referrals)
                const prefillClinicalIndication =
                  formData.examination_findings ||
                  formData.physical_examination ||
                  formData.clinical_notes ||
                  '';
                const prefillDiagnosis =
                  selectedDiagnoses.length > 0
                    ? selectedDiagnoses.map((d) => d.title)
                    : [];
                onRadiologyOrdersChange([
                  ...radiologyOrders,
                  {
                    imaging_id: imagingId,
                    priority: 'Normal',
                    clinical_indication: prefillClinicalIndication,
                    diagnosis: prefillDiagnosis,
                  },
                ]);
              }
            }}
            placeholder="Search imaging studies by name, code, or modality..."
            allCategoriesLabel="All Modalities"
          />
          )}

          {/* Selected Imaging Studies with Clinical Indication */}
          {radiologyOrders.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500">
                Selected Imaging Studies:
              </p>
              {radiologyOrders.map((order) => {
                const imaging = imagingOptions.find(
                  (i) => i.id === order.imaging_id,
                );
                return (
                  <div
                    key={order.imaging_id}
                    className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {imaging?.name || order.imaging_id}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onRadiologyOrdersChange(
                            radiologyOrders.filter(
                              (o) => o.imaging_id !== order.imaging_id,
                            ),
                          )
                        }
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <textarea
                      value={order.clinical_indication || ''}
                      onChange={(e) =>
                        onRadiologyOrdersChange(
                          radiologyOrders.map((o) =>
                            o.imaging_id === order.imaging_id
                              ? { ...o, clinical_indication: e.target.value }
                              : o,
                          ),
                        )
                      }
                      placeholder="Clinical indication (optional) - reason for study, suspected diagnosis..."
                      rows={2}
                      className="w-full mt-2 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Procedures Tab */}
      {activeOrderTab === 'procedures' && (
        <div className="space-y-4">
          <CategorizedSearchableMultiSelect
            options={procedureOptions}
            selectedIds={selectedProcedureIds}
            onToggleSelect={(procedureId: string) => {
              const proc = procedureOptions.find((p) => p.id === procedureId);
              if (selectedProcedureIds.includes(procedureId)) {
                onProcedureOrdersChange(
                  procedureOrders.filter((o) => o.procedure_id !== procedureId),
                );
              } else {
                // Prefill clinical context from consultation form (similar to specialty referrals)
                const prefillClinicalNotes =
                  formData.examination_findings ||
                  formData.physical_examination ||
                  formData.clinical_notes ||
                  '';
                const prefillDiagnosis =
                  selectedDiagnoses.length > 0
                    ? selectedDiagnoses.map((d) => d.title)
                    : [];
                onProcedureOrdersChange([
                  ...procedureOrders,
                  {
                    procedure_id: procedureId,
                    procedure_name: proc?.name || '',
                    procedure_type: proc?.category || 'General',
                    priority: 'Normal',
                    price: proc?.price ?? undefined,
                    clinical_notes: prefillClinicalNotes,
                    diagnosis: prefillDiagnosis,
                  },
                ]);
              }
            }}
            placeholder="Search procedures by name, code, or type..."
            allCategoriesLabel="All Types"
          />

          {/* Selected Procedures */}
          {procedureOrders.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500">
                Selected Procedures:
              </p>
              {procedureOrders.map((proc) => (
                <div
                  key={proc.procedure_id}
                  className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-gray-300"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {proc.procedure_name}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      {proc.procedure_type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onProcedureOrdersChange(
                        procedureOrders.filter(
                          (p) => p.procedure_id !== proc.procedure_id,
                        ),
                      )
                    }
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admission Tab */}
      {activeOrderTab === 'admission' && (
        <div className="space-y-4">
          {!admissionOrder ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-12 text-center hover:bg-white hover:border-rose-300 hover:shadow-sm transition-all group">
              <div className="bg-white p-4 rounded-full shadow-sm w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-gray-100 group-hover:scale-110 transition-transform">
                <Bed className="h-8 w-8 text-rose-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">
                Admit Patient
              </h4>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                Create an inpatient admission request for observation or
                treatment.
              </p>
              <Button
                type="button"
                onClick={() =>
                  onAdmissionOrderChange({
                    admission_type: 'Elective',
                    reason: '',
                    priority: 'Normal',
                  })
                }
                className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 h-auto text-base"
              >
                <Plus size={18} className="mr-2" />
                Create Request
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 rounded-lg border border-rose-100">
                    <Bed className="h-5 w-5 text-rose-600" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    Admission Details
                  </h4>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onAdmissionOrderChange(null)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 p-2 h-auto"
                  title="Remove admission request"
                >
                  <Trash2 size={16} className="mr-2" />
                  Cancel
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Admission Type *
                  </label>
                  <SearchableSelect
                    value={admissionOrder.admission_type}
                    onChange={(value) =>
                      onAdmissionOrderChange({
                        ...admissionOrder,
                        admission_type: value as
                          | 'Emergency'
                          | 'Elective'
                          | 'Transfer',
                      })
                    }
                    options={['Elective', 'Emergency', 'Transfer']}
                    placeholder="Select admission type"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Priority *
                  </label>
                  <SearchableSelect
                    value={admissionOrder.priority}
                    onChange={(value) =>
                      onAdmissionOrderChange({
                        ...admissionOrder,
                        priority: value as 'Normal' | 'Urgent' | 'Emergency',
                      })
                    }
                    options={['Normal', 'Urgent', 'Emergency']}
                    placeholder="Select priority"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Preferred Ward
                  </label>
                  <SearchableSelect
                    value={admissionOrder.ward_name || ''}
                    onChange={(value) => {
                      const ward = wardOptions.find(
                        (w) =>
                          `${w.name} (${w.category}) - ${w.extraInfo}` ===
                          value,
                      );
                      onAdmissionOrderChange({
                        ...admissionOrder,
                        ward_id: ward?.id || undefined,
                        ward_name: ward?.name,
                        ward_type: ward?.category,
                      });
                    }}
                    options={wardOptions.map(
                      (ward) =>
                        `${ward.name} (${ward.category}) - ${ward.extraInfo}`,
                    )}
                    placeholder="Select ward (optional)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Expected Duration
                  </label>
                  <SearchableSelect
                    value={admissionOrder.expected_duration || ''}
                    onChange={(value) =>
                      onAdmissionOrderChange({
                        ...admissionOrder,
                        expected_duration: value || undefined,
                      })
                    }
                    options={[
                      '1 Day',
                      '2-3 Days',
                      '4-7 Days (1 Week)',
                      '1-2 Weeks',
                      '2-4 Weeks',
                      'More than 1 Month',
                    ]}
                    placeholder="Select duration"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-500">
                    Reason for Admission *
                  </label>

                </div>
                <textarea
                  value={admissionOrder.reason}
                  onChange={(e) =>
                    onAdmissionOrderChange({
                      ...admissionOrder,
                      reason: e.target.value,
                    })
                  }
                  className={INPUT_CLS}
                  rows={2}
                  placeholder="Enter reason for admission..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-500">
                    Special Requirements / Notes
                  </label>

                </div>
                <textarea
                  value={admissionOrder.special_requirements || ''}
                  onChange={(e) =>
                    onAdmissionOrderChange({
                      ...admissionOrder,
                      special_requirements: e.target.value || undefined,
                    })
                  }
                  className={INPUT_CLS}
                  rows={2}
                  placeholder="Any special requirements (isolation, monitoring equipment, etc.)..."
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nursing Tasks Tab */}
      {activeOrderTab === 'nursing' && (
        <div className="space-y-4">
          {/* Treatment Plan Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Treatment Plan Notes
            </label>
            <textarea
              value={formData.treatment_plan || ''}
              onChange={(e) => onChange('treatment_plan', e.target.value)}
              className={`${INPUT_CLS} min-h-[80px]`}
              placeholder="General treatment plan notes and instructions for nursing staff..."
            />
          </div>

          {/* Added Tasks List */}
          {treatmentTasks.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900">
                Task List ({treatmentTasks.length})
              </p>
              {treatmentTasks.map((task, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm transition-all hover:border-gray-300"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                          task.task_type === 'Administer_Medication'
                            ? 'bg-orange-50 text-orange-700 border-orange-100'
                            : task.task_type === 'Monitor_Vitals'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : task.task_type === 'Procedure'
                                ? 'bg-purple-50 text-purple-700 border-purple-100'
                                : task.task_type === 'Wound_Care'
                                  ? 'bg-rose-50 text-rose-700 border-rose-100'
                                  : task.task_type === 'Sample_Collection'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {task.task_type.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          task.priority === 'Urgent'
                            ? 'bg-amber-100 text-amber-800'
                            : task.priority === 'Emergency'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{task.title}</p>
                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {task.description}
                      </p>
                    )}
                    {task.instructions && (
                      <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded border border-gray-100">
                        Instructions: {task.instructions}
                      </div>
                    )}

                    {task.task_type === 'Administer_Medication' &&
                      task.medication_name && (
                        <div className="text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded mt-2 inline-flex items-center gap-1">
                          <span>💊</span>
                          <span className="font-medium">
                            {task.medication_name}
                          </span>
                          <span>
                            - {task.dosage} ({task.route})
                          </span>
                        </div>
                      )}

                    {task.task_type === 'Monitor_Vitals' && task.frequency && (
                      <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded mt-2 inline-flex items-center gap-1">
                        <span>⏰ Frequency:</span>
                        <span className="font-medium">{task.frequency}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onTreatmentTasksChange(
                        treatmentTasks.filter((_, i) => i !== index),
                      )
                    }
                    className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Task Form */}
          {showAddTask ? (
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h4 className="font-semibold text-gray-900">
                  Add Nursing Task
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Task Type *
                  </label>
                  <SearchableSelect
                    value={newTask.task_type?.replace(/_/g, ' ') || 'Other'}
                    onChange={(value) =>
                      setNewTask({
                        ...newTask,
                        task_type: value.replace(
                          / /g,
                          '_',
                        ) as TreatmentTaskType,
                      })
                    }
                    options={TREATMENT_TASK_TYPES.map((type) =>
                      type.replace(/_/g, ' '),
                    )}
                    placeholder="Select task type"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Priority
                  </label>
                  <SearchableSelect
                    value={newTask.priority || 'Normal'}
                    onChange={(value) => {
                      const priority =
                        value as CreateTreatmentTaskDTO['priority'];
                      setNewTask({ ...newTask, priority });
                    }}
                    options={['Normal', 'Urgent', 'Emergency']}
                    placeholder="Select priority"
                  />
                </div>
              </div>

              {/* Medication-specific fields */}
              {newTask.task_type === 'Administer_Medication' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Medication Name
                    </label>
                    <input
                      type="text"
                      value={newTask.medication_name || ''}
                      onChange={(e) =>
                        setNewTask({
                          ...newTask,
                          medication_name: e.target.value,
                        })
                      }
                      className={INPUT_CLS}
                      placeholder="e.g., Paracetamol"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Dosage
                    </label>
                    <input
                      type="text"
                      value={newTask.dosage || ''}
                      onChange={(e) =>
                        setNewTask({ ...newTask, dosage: e.target.value })
                      }
                      className={INPUT_CLS}
                      placeholder="e.g., 500mg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Route
                    </label>
                    <SearchableSelect
                      value={newTask.route || 'Oral'}
                      onChange={(value) =>
                        setNewTask({ ...newTask, route: value })
                      }
                      options={[
                        'Oral',
                        'IV (Intravenous)',
                        'IM (Intramuscular)',
                        'SC (Subcutaneous)',
                        'Topical',
                        'Inhaled',
                        'Rectal',
                      ]}
                      placeholder="Select route"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Frequency
                    </label>
                    <SearchableSelect
                      value={newTask.frequency || ''}
                      onChange={(value) =>
                        setNewTask({ ...newTask, frequency: value })
                      }
                      options={[
                        'Once',
                        'Stat (Immediately)',
                        'BD (Twice daily)',
                        'TDS (Three times daily)',
                        'QDS (Four times daily)',
                        'Every 4 hours',
                        'Every 6 hours',
                        'Every 8 hours',
                        'PRN (As needed)',
                      ]}
                      placeholder="Select frequency"
                    />
                  </div>
                </div>
              )}

              {/* Monitor Vitals specific fields */}
              {newTask.task_type === 'Monitor_Vitals' && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Monitoring Frequency
                  </label>
                  <SearchableSelect
                    value={newTask.frequency || ''}
                    onChange={(value) =>
                      setNewTask({ ...newTask, frequency: value })
                    }
                    options={[
                      'Every 15 minutes',
                      'Every 30 minutes',
                      'Every 1 hour',
                      'Every 2 hours',
                      'Every 4 hours',
                      'Every 6 hours',
                      'Every 8 hours',
                      'Three times daily',
                      'Twice daily',
                      'Once daily',
                    ]}
                    placeholder="Select frequency"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Description
                </label>
                <textarea
                  value={newTask.description || ''}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  className={INPUT_CLS}
                  rows={2}
                  placeholder="Additional details about the task..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddTask(false)}
                  className="border-gray-300 text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (newTask.title && newTask.task_type) {
                      onTreatmentTasksChange([
                        ...treatmentTasks,
                        {
                          task_type: newTask.task_type as TreatmentTaskType,
                          title: newTask.title,
                          description: newTask.description || '',
                          instructions: newTask.instructions || '',
                          priority: newTask.priority || 'Normal',
                          medication_name: newTask.medication_name,
                          dosage: newTask.dosage,
                          route: newTask.route,
                          frequency: newTask.frequency,
                        },
                      ]);
                      setNewTask({
                        task_type: 'Other',
                        title: '',
                        description: '',
                        instructions: '',
                        priority: 'Normal',
                      });
                      setShowAddTask(false);
                    }
                  }}
                  disabled={!newTask.title}
                  className="bg-gray-900 hover:bg-gray-800 text-white"
                >
                  <Plus size={16} className="mr-2" />
                  Add Task
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddTask(true)}
              className="w-full py-6 border border-dashed border-gray-300 rounded-2xl text-gray-500 hover:bg-white hover:border-gray-400 hover:text-gray-900 hover:shadow-sm transition-all flex flex-col items-center justify-center gap-2"
            >
              <div className="p-2 bg-gray-100 rounded-full">
                <Plus size={24} />
              </div>
              <span className="font-medium">Add Nursing Task</span>
            </button>
          )}
        </div>
      )}

      {/* Referrals Tab */}
      {activeOrderTab === 'referrals' && (
        <div className="space-y-6">
          {/* Patient Information Card - Military/NHIS Details */}
          {selectedPatient && (
            <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-sm">
              <h4 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Patient Referral Information
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {isMilitaryFeatureEnabled() && selectedPatient.service_number && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Service Number
                    </p>
                    <p className="text-[13px] font-semibold text-gray-800 tracking-tight mt-0.5 font-mono">
                      {selectedPatient.service_number}
                    </p>
                  </div>
                )}
                {selectedPatient.patient_category &&
                  (isMilitaryFeatureEnabled() ||
                    !['Military', 'Military Participant'].includes(
                      selectedPatient.patient_category,
                    )) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Patient Category
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">
                      {selectedPatient.patient_category}
                    </p>
                  </div>
                )}
                {selectedPatient.insurance_type && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Insurance Type
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {!isNhisFeatureEnabled() &&
                      isNhisCategory(selectedPatient.insurance_type)
                        ? 'Private'
                        : selectedPatient.insurance_type?.replace('_', ' ')}
                    </p>
                  </div>
                )}
                {isNhisFeatureEnabled() &&
                  selectedPatient.nhis_patient_source && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        NHIS Source
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">
                        {selectedPatient.nhis_patient_source}
                      </p>
                    </div>
                  )}
                {isMilitaryFeatureEnabled() && selectedPatient.rank && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Rank
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {selectedPatient.rank}
                    </p>
                  </div>
                )}
                {isMilitaryFeatureEnabled() && selectedPatient.military_branch && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Branch
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {selectedPatient.military_branch}
                    </p>
                  </div>
                )}
                {selectedPatient.payer_info?.scheme && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Payer Details / Scheme
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {selectedPatient.payer_info.scheme}
                    </p>
                  </div>
                )}
                {isNhisFeatureEnabled() && selectedPatient.nhis_number && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      NHIS Number
                    </p>
                    <p className="text-sm font-bold text-emerald-700 mt-0.5 font-mono">
                      {selectedPatient.nhis_number}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Share2 className="h-5 w-5 text-cyan-600" />
              Create Referral
            </h3>

            {/* Referral Type Dropdown */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Referral Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Set all to internal type and deselect
                      const updated: Record<string, any> = {};
                      Object.keys(specialtyReferrals).forEach((key) => {
                        updated[key] = {
                          ...specialtyReferrals[key],
                          referralType: 'internal',
                          selected: false,
                        };
                      });
                      onSpecialtyReferralsChange(updated);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      Object.values(specialtyReferrals).some(
                        (r) => r.selected && r.referralType === 'internal',
                      )
                        ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-200'
                        : Object.values(specialtyReferrals).some(
                              (r) => r.selected,
                            )
                          ? 'border-gray-200 bg-white text-gray-400'
                          : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${Object.values(specialtyReferrals).some((r) => r.selected && r.referralType === 'internal') ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        <Building size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          Internal Referral
                        </p>
                        <p className="text-sm text-gray-500">
                          Refer to a specialty clinic within this hospital
                        </p>
                      </div>
                    </div>
                  </button>
                  {isNhisFeatureEnabled() && (
                  <button
                    type="button"
                    onClick={() => {
                      // Toggle external NHIS referral
                      setExternalNhisReferral((prev) => ({
                        ...prev,
                        enabled: !prev.enabled,
                        provisionalDiagnosis:
                          !prev.enabled && selectedDiagnoses.length > 0
                            ? selectedDiagnoses.map((d) => d.title).join(', ')
                            : prev.provisionalDiagnosis,
                        clinicalFindings:
                          !prev.enabled &&
                          (formData.examination_findings ||
                            formData.physical_examination)
                            ? formData.examination_findings ||
                              formData.physical_examination ||
                              ''
                            : prev.clinicalFindings,
                      }));
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      externalNhisReferral.enabled
                        ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-200'
                        : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${externalNhisReferral.enabled ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        <ExternalLink size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          External NHIS Referral
                        </p>
                        <p className="text-sm text-gray-500">
                          Refer to an outside hospital (requires NHIS approval)
                        </p>
                      </div>
                    </div>
                  </button>
                  )}
                </div>
              </div>

              {/* Internal Referral - Specialty Clinic Dropdown Selection */}
              {isSpecialtyClinicsEnabled() && !externalNhisReferral.enabled && (
                <div className="mt-4 space-y-4">
                  <label className="block text-xs font-medium text-gray-500">
                    Select Specialty Clinic for Internal Referral
                  </label>

                  {/* Single Dropdown for All Specialty Clinics */}
                  <div className="relative">
                    <SearchableSelect
                      value={
                        specialtyReferrals.dental?.selected
                          ? '🦷 Dental'
                          : specialtyReferrals.ophthalmology?.selected
                            ? '👁️ Ophthalmology'
                            : specialtyReferrals.physiotherapy?.selected
                              ? '🏃 Physiotherapy'
                              : specialtyReferrals.cardiology?.selected
                                ? '❤️ Cardiology'
                                : specialtyReferrals.orthopaedics?.selected
                                  ? '🦴 Orthopaedics'
                                  : specialtyReferrals.dermatology?.selected
                                    ? '🩺 Dermatology'
                                    : specialtyReferrals.urology?.selected
                                      ? '🚰 Urology'
                                      : specialtyReferrals.gastroenterology
                                            ?.selected
                                        ? '🍽️ Gastroenterology'
                                        : specialtyReferrals.nephrology
                                              ?.selected
                                          ? '🫘 Nephrology'
                                          : specialtyReferrals.paediatrics
                                                ?.selected
                                            ? '👶 Paediatrics'
                                            : specialtyReferrals.neurosurgery
                                                  ?.selected
                                              ? '🧠 Neurosurgery'
                                              : specialtyReferrals.neurology
                                                    ?.selected
                                                ? '🧠 Neurology'
                                                : specialtyReferrals
                                                      .neuropsychiatry?.selected
                                                  ? '💭 Neuropsychiatry'
                                                  : specialtyReferrals
                                                        .general_surgery
                                                        ?.selected
                                                    ? '🏥 General Surgery'
                                                    : specialtyReferrals
                                                          .gynaecology?.selected
                                                      ? '🤰 Gynaecology'
                                                      : specialtyReferrals
                                                            .oral_maxillofacial
                                                            ?.selected
                                                        ? '😷 Oral & Maxillofacial'
                                                        : specialtyReferrals
                                                              .pulmonology
                                                              ?.selected
                                                          ? '🫁 Pulmonology'
                                                          : specialtyReferrals
                                                                .endocrinology
                                                                ?.selected
                                                            ? '⚗️ Endocrinology'
                                                            : specialtyReferrals
                                                                  .plastic_surgery
                                                                  ?.selected
                                                              ? '✨ Plastic Surgery'
                                                              : specialtyReferrals
                                                                    .nutrition
                                                                    ?.selected
                                                                ? '🥗 Nutrition'
                                                                : specialtyReferrals
                                                                      .ent
                                                                      ?.selected
                                                                  ? '👂 ENT (Ear, Nose, Throat)'
                                                                  : ''
                      }
                      onChange={(value) => {
                        // Reset all selections first
                        const resetReferrals: Record<string, any> = {};
                        Object.keys(specialtyReferrals).forEach((key) => {
                          resetReferrals[key] = {
                            ...specialtyReferrals[key],
                            selected: false,
                            referralType: 'internal' as const,
                          };
                        });

                        const clinicalContext = {
                          clinicalFindings:
                            formData.examination_findings ||
                            formData.physical_examination ||
                            '',
                          provisionalDiagnosis:
                            selectedDiagnoses.length > 0
                              ? selectedDiagnoses.map((d) => d.title).join(', ')
                              : '',
                        };

                        // Map dropdown values to specialty keys (matching specialty_departments.specialty_code)
                        const specialtyMap: Record<string, string> = {
                          Dental: 'dental',
                          Ophthalmology: 'ophthalmology',
                          Physiotherapy: 'physiotherapy',
                          Cardiology: 'cardiology',
                          Orthopaedics: 'orthopaedics',
                          Dermatology: 'dermatology',
                          Urology: 'urology',
                          Gastroenterology: 'gastroenterology',
                          Nephrology: 'nephrology',
                          Paediatrics: 'paediatrics',
                          Neurosurgery: 'neurosurgery',
                          Neurology: 'neurology',
                          Neuropsychiatry: 'neuropsychiatry',
                          'General Surgery': 'general_surgery',
                          Gynaecology: 'gynaecology',
                          'Oral & Maxillofacial': 'oral_maxillofacial',
                          Oral: 'oral_maxillofacial',
                          Maxillofacial: 'oral_maxillofacial',
                          Pulmonology: 'pulmonology',
                          Endocrinology: 'endocrinology',
                          'Plastic Surgery': 'plastic_surgery',
                          Plastic: 'plastic_surgery',
                          Nutrition: 'nutrition',
                          Dietetics: 'nutrition',
                          Diet: 'nutrition',
                          ENT: 'ent',
                        };

                        // Find matching specialty
                        let selectedSpecialty = '';
                        for (const [key, specialty] of Object.entries(
                          specialtyMap,
                        )) {
                          if (value.includes(key)) {
                            selectedSpecialty = specialty;
                            break;
                          }
                        }

                        if (
                          selectedSpecialty &&
                          resetReferrals[selectedSpecialty]
                        ) {
                          onSpecialtyReferralsChange({
                            ...resetReferrals,
                            [selectedSpecialty]: {
                              ...resetReferrals[selectedSpecialty],
                              selected: true,
                              referralType: 'internal',
                              ...clinicalContext,
                            },
                          });
                        } else {
                          // Clear all selections
                          onSpecialtyReferralsChange(resetReferrals);
                        }
                      }}
                      options={[
                        'Select a specialty clinic...',
                        '🦷 Dental',
                        '👁️ Ophthalmology',
                        '🏃 Physiotherapy',
                        '❤️ Cardiology',
                        '🦴 Orthopaedics',
                        '🩺 Dermatology',
                        '🚰 Urology',
                        '🍽️ Gastroenterology',
                        '🫘 Nephrology',
                        '👶 Paediatrics',
                        '🧠 Neurosurgery',
                        '🧠 Neurology',
                        '💭 Neuropsychiatry',
                        '🏥 General Surgery',
                        '🤰 Gynaecology',
                        '😷 Oral & Maxillofacial',
                        '🫁 Pulmonology',
                        '⚗️ Endocrinology',
                        '✨ Plastic Surgery',
                        '🥗 Nutrition',
                        '👂 ENT (Ear, Nose, Throat)',
                      ]}
                      placeholder="Select a specialty clinic..."
                    />
                  </div>

                  {/* Selected Clinic Badge */}
                  {Object.entries(specialtyReferrals).some(
                    ([_, r]) => r?.selected,
                  ) && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-50 border border-cyan-200">
                      <div className="p-1.5 rounded-lg bg-cyan-100">
                        <Stethoscope size={16} className="text-cyan-600" />
                      </div>
                      <span className="text-sm font-medium text-cyan-800">
                        {(() => {
                          const selectedEntry = Object.entries(
                            specialtyReferrals,
                          ).find(([_, r]) => r?.selected);
                          if (!selectedEntry) return '';
                          const specialtyLabels: Record<string, string> = {
                            dental: 'Dental',
                            ophthalmology: 'Ophthalmology',
                            physiotherapy: 'Physiotherapy',
                            cardiology: 'Cardiology',
                            orthopaedics: 'Orthopaedics',
                            dermatology: 'Dermatology',
                            urology: 'Urology',
                            gastroenterology: 'Gastroenterology',
                            nephrology: 'Nephrology',
                            paediatrics: 'Paediatrics',
                            neurosurgery: 'Neurosurgery',
                            neurology: 'Neurology',
                            neuropsychiatry: 'Neuropsychiatry',
                            general_surgery: 'General Surgery',
                            gynaecology: 'Gynaecology',
                            oral_maxillofacial: 'Oral & Maxillofacial',
                            pulmonology: 'Pulmonology',
                            endocrinology: 'Endocrinology',
                            plastic_surgery: 'Plastic Surgery',
                            nutrition: 'Nutrition',
                            ent: 'ENT (Ear, Nose, Throat)',
                          };
                          return `${specialtyLabels[selectedEntry[0]] || selectedEntry[0]} selected`;
                        })()}
                      </span>
                      <span className="text-cyan-500 text-xs">
                        ✓ Form below
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Render Active Forms */}
          <div className="space-y-4">
            {/* External NHIS Referral Form - Separate from internal specialty referrals */}
            {isNhisFeatureEnabled() && externalNhisReferral.enabled && (
              <div className="p-6 rounded-2xl border border-amber-200 bg-white shadow-sm ring-1 ring-amber-100 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-amber-100">
                  <div className="bg-amber-50 p-2 rounded-lg">
                    <ExternalLink className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      External NHIS Referral
                    </h4>
                    <p className="text-xs text-amber-600">
                      This will be sent to NHIS desk for approval
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setExternalNhisReferral((prev) => ({
                        ...prev,
                        enabled: false,
                      }))
                    }
                    className="ml-auto text-sm text-red-500 hover:text-red-700"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* External Facility Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Destination Hospital{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={externalNhisReferral.facilityName}
                      onChange={(e) =>
                        setExternalNhisReferral((prev) => ({
                          ...prev,
                          facilityName: e.target.value,
                        }))
                      }
                      placeholder="Enter the name of the hospital"
                      className={INPUT_CLS}
                    />
                  </div>

                  {/* Facility Address */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Facility Address
                    </label>
                    <input
                      type="text"
                      value={externalNhisReferral.facilityAddress}
                      onChange={(e) =>
                        setExternalNhisReferral((prev) => ({
                          ...prev,
                          facilityAddress: e.target.value,
                        }))
                      }
                      placeholder="Enter address (optional)"
                      className={INPUT_CLS}
                    />
                  </div>

                  {/* Receiving Doctor */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Receiving Doctor
                    </label>
                    <input
                      type="text"
                      value={externalNhisReferral.doctorName}
                      onChange={(e) =>
                        setExternalNhisReferral((prev) => ({
                          ...prev,
                          doctorName: e.target.value,
                        }))
                      }
                      placeholder="Enter doctor name (optional)"
                      className={INPUT_CLS}
                    />
                  </div>

                  {/* Urgency */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Urgency <span className="text-red-500">*</span>
                    </label>
                    <ChipField
                      options={[
                        { value: 'Routine', label: 'Routine' },
                        { value: 'Urgent', label: 'Urgent' },
                        { value: 'Emergency', label: 'Emergency' },
                      ]}
                      value={externalNhisReferral.urgency}
                      onChange={(v) =>
                        setExternalNhisReferral((prev) => ({
                          ...prev,
                          urgency: v as any,
                        }))
                      }
                    />
                  </div>

                  {/* Clinical Findings */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-gray-500">
                        Clinical Findings <span className="text-red-500">*</span>
                      </label>

                    </div>
                    <textarea
                      value={externalNhisReferral.clinicalFindings}
                      onChange={(e) =>
                        setExternalNhisReferral((prev) => ({
                          ...prev,
                          clinicalFindings: e.target.value,
                        }))
                      }
                      placeholder="Enter clinical examination findings..."
                      rows={2}
                      className={INPUT_CLS}
                    />
                    {(formData.examination_findings ||
                      formData.physical_examination) &&
                      !externalNhisReferral.clinicalFindings && (
                        <button
                          type="button"
                          onClick={() =>
                            setExternalNhisReferral((prev) => ({
                              ...prev,
                              clinicalFindings:
                                formData.examination_findings ||
                                formData.physical_examination ||
                                '',
                            }))
                          }
                          className="mt-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                        >
                          ↑ Auto-fill from General Examination
                        </button>
                      )}
                  </div>

                  {/* Investigation Findings */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-gray-500">
                        Investigation Findings
                      </label>

                    </div>
                    <textarea
                      value={externalNhisReferral.investigationFindings}
                      onChange={(e) =>
                        setExternalNhisReferral((prev) => ({
                          ...prev,
                          investigationFindings: e.target.value,
                        }))
                      }
                      placeholder="Enter lab/radiology results (optional)..."
                      rows={2}
                      className={INPUT_CLS}
                    />
                  </div>

                  {/* Provisional Diagnosis - Auto-populated */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-gray-500">
                        Provisional Diagnosis{' '}
                        <span className="text-red-500">*</span>
                      </label>

                    </div>
                    <textarea
                      value={externalNhisReferral.provisionalDiagnosis}
                      onChange={(e) =>
                        setExternalNhisReferral((prev) => ({
                          ...prev,
                          provisionalDiagnosis: e.target.value,
                        }))
                      }
                      placeholder="Enter provisional diagnosis..."
                      rows={2}
                      className={INPUT_CLS}
                    />
                    {selectedDiagnoses.length > 0 &&
                      !externalNhisReferral.provisionalDiagnosis && (
                        <button
                          type="button"
                          onClick={() =>
                            setExternalNhisReferral((prev) => ({
                              ...prev,
                              provisionalDiagnosis: selectedDiagnoses
                                .map((d) => d.title)
                                .join(', '),
                            }))
                          }
                          className="mt-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                        >
                          ↑ Auto-fill from diagnosis selection
                        </button>
                      )}
                  </div>

                  {/* Reason for Referral */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-gray-500">
                        Reason for Referral{' '}
                        <span className="text-red-500">*</span>
                      </label>

                    </div>
                    <textarea
                      value={externalNhisReferral.reason}
                      onChange={(e) =>
                        setExternalNhisReferral((prev) => ({
                          ...prev,
                          reason: e.target.value,
                        }))
                      }
                      placeholder="Describe why you are referring this patient to an external facility..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Dental Internal Form */}
            {specialtyReferrals.dental?.selected && (
              <div className="p-6 rounded-2xl border border-cyan-200 bg-white shadow-sm ring-1 ring-cyan-100 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-cyan-100">
                  <div className="bg-cyan-50 p-2 rounded-lg">
                    <Smile className="h-5 w-5 text-cyan-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">
                    Dental Department Referral
                  </h4>
                  <button
                    onClick={() =>
                      onSpecialtyReferralsChange((prev) => ({
                        ...prev,
                        dental: { ...prev.dental, selected: false },
                      }))
                    }
                    className="ml-auto text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Clinical Findings - Auto-populated from Examination */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Clinical Findings
                    </label>
                    <textarea
                      value={specialtyReferrals.dental.clinicalFindings}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          dental: {
                            ...prev.dental,
                            clinicalFindings: e.target.value,
                          },
                        }))
                      }
                      placeholder="Clinical examination findings..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                    {(formData.examination_findings ||
                      formData.physical_examination) &&
                      !specialtyReferrals.dental.clinicalFindings && (
                        <button
                          type="button"
                          onClick={() =>
                            onSpecialtyReferralsChange((prev) => ({
                              ...prev,
                              dental: {
                                ...prev.dental,
                                clinicalFindings:
                                  formData.examination_findings ||
                                  formData.physical_examination ||
                                  '',
                              },
                            }))
                          }
                          className="mt-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                        >
                          ↑ Auto-fill from General Examination Findings
                        </button>
                      )}
                  </div>

                  {/* Provisional Diagnosis - Auto-populated */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Provisional Diagnosis
                    </label>
                    <textarea
                      value={specialtyReferrals.dental.provisionalDiagnosis}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          dental: {
                            ...prev.dental,
                            provisionalDiagnosis: e.target.value,
                          },
                        }))
                      }
                      placeholder="Provisional diagnosis..."
                      rows={2}
                      className={INPUT_CLS}
                    />
                    {selectedDiagnoses.length > 0 &&
                      !specialtyReferrals.dental.provisionalDiagnosis && (
                        <button
                          type="button"
                          onClick={() =>
                            onSpecialtyReferralsChange((prev) => ({
                              ...prev,
                              dental: {
                                ...prev.dental,
                                provisionalDiagnosis: selectedDiagnoses
                                  .map((d) => d.title)
                                  .join(', '),
                              },
                            }))
                          }
                          className="mt-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                        >
                          ↑ Auto-fill from Diagnosis Selection
                        </button>
                      )}
                  </div>

                  {/* Reason for Referral */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      Reason for Referral{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={specialtyReferrals.dental.reason}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          dental: { ...prev.dental, reason: e.target.value },
                        }))
                      }
                      placeholder="Describe the dental concerns..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ophthalmology Internal Form */}
            {specialtyReferrals.ophthalmology?.selected && (
              <div className="p-6 rounded-2xl border border-violet-200 bg-white shadow-sm ring-1 ring-violet-100 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-violet-100">
                  <div className="bg-violet-50 p-2 rounded-lg">
                    <Eye className="h-5 w-5 text-violet-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">
                    Eye Clinic Referral
                  </h4>
                  <button
                    onClick={() =>
                      onSpecialtyReferralsChange((prev) => ({
                        ...prev,
                        ophthalmology: {
                          ...prev.ophthalmology,
                          selected: false,
                        },
                      }))
                    }
                    className="ml-auto text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-5">
                  {/* Clinical Findings - Auto-populated from Examination */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Clinical Findings
                    </label>
                    <textarea
                      value={specialtyReferrals.ophthalmology.clinicalFindings}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          ophthalmology: {
                            ...prev.ophthalmology,
                            clinicalFindings: e.target.value,
                          },
                        }))
                      }
                      placeholder="Clinical examination findings..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                    {(formData.examination_findings ||
                      formData.physical_examination) &&
                      !specialtyReferrals.ophthalmology.clinicalFindings && (
                        <button
                          type="button"
                          onClick={() =>
                            onSpecialtyReferralsChange((prev) => ({
                              ...prev,
                              ophthalmology: {
                                ...prev.ophthalmology,
                                clinicalFindings:
                                  formData.examination_findings ||
                                  formData.physical_examination ||
                                  '',
                              },
                            }))
                          }
                          className="mt-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                        >
                          ↑ Auto-fill from General Examination Findings
                        </button>
                      )}
                  </div>

                  {/* Provisional Diagnosis - Auto-populated */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Provisional Diagnosis
                    </label>
                    <textarea
                      value={
                        specialtyReferrals.ophthalmology.provisionalDiagnosis
                      }
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          ophthalmology: {
                            ...prev.ophthalmology,
                            provisionalDiagnosis: e.target.value,
                          },
                        }))
                      }
                      placeholder="Provisional diagnosis..."
                      rows={2}
                      className={INPUT_CLS}
                    />
                    {selectedDiagnoses.length > 0 &&
                      !specialtyReferrals.ophthalmology
                        .provisionalDiagnosis && (
                        <button
                          type="button"
                          onClick={() =>
                            onSpecialtyReferralsChange((prev) => ({
                              ...prev,
                              ophthalmology: {
                                ...prev.ophthalmology,
                                provisionalDiagnosis: selectedDiagnoses
                                  .map((d) => d.title)
                                  .join(', '),
                              },
                            }))
                          }
                          className="mt-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                        >
                          ↑ Auto-fill from Diagnosis Selection
                        </button>
                      )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      Reason for Referral{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={specialtyReferrals.ophthalmology.reason}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          ophthalmology: {
                            ...prev.ophthalmology,
                            reason: e.target.value,
                          },
                        }))
                      }
                      placeholder="Describe visual symptoms..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Physiotherapy Internal Form */}
            {specialtyReferrals.physiotherapy?.selected && (
              <div className="p-6 rounded-2xl border border-lime-200 bg-white shadow-sm ring-1 ring-lime-100 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-lime-100">
                  <div className="bg-lime-50 p-2 rounded-lg">
                    <Dumbbell className="h-5 w-5 text-lime-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">
                    Physiotherapy Referral
                  </h4>
                  <button
                    onClick={() =>
                      onSpecialtyReferralsChange((prev) => ({
                        ...prev,
                        physiotherapy: {
                          ...prev.physiotherapy,
                          selected: false,
                        },
                      }))
                    }
                    className="ml-auto text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-5">
                  {/* Clinical Findings - Auto-populated from Examination */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Clinical Findings
                    </label>
                    <textarea
                      value={specialtyReferrals.physiotherapy.clinicalFindings}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          physiotherapy: {
                            ...prev.physiotherapy,
                            clinicalFindings: e.target.value,
                          },
                        }))
                      }
                      placeholder="Clinical examination findings..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                    {(formData.examination_findings ||
                      formData.physical_examination) &&
                      !specialtyReferrals.physiotherapy.clinicalFindings && (
                        <button
                          type="button"
                          onClick={() =>
                            onSpecialtyReferralsChange((prev) => ({
                              ...prev,
                              physiotherapy: {
                                ...prev.physiotherapy,
                                clinicalFindings:
                                  formData.examination_findings ||
                                  formData.physical_examination ||
                                  '',
                              },
                            }))
                          }
                          className="mt-1 text-xs text-lime-600 hover:text-lime-700 font-medium"
                        >
                          ↑ Auto-fill from General Examination Findings
                        </button>
                      )}
                  </div>

                  {/* Provisional Diagnosis - Auto-populated */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Provisional Diagnosis
                    </label>
                    <textarea
                      value={
                        specialtyReferrals.physiotherapy.provisionalDiagnosis
                      }
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          physiotherapy: {
                            ...prev.physiotherapy,
                            provisionalDiagnosis: e.target.value,
                          },
                        }))
                      }
                      placeholder="Provisional diagnosis..."
                      rows={2}
                      className={INPUT_CLS}
                    />
                    {selectedDiagnoses.length > 0 &&
                      !specialtyReferrals.physiotherapy
                        .provisionalDiagnosis && (
                        <button
                          type="button"
                          onClick={() =>
                            onSpecialtyReferralsChange((prev) => ({
                              ...prev,
                              physiotherapy: {
                                ...prev.physiotherapy,
                                provisionalDiagnosis: selectedDiagnoses
                                  .map((d) => d.title)
                                  .join(', '),
                              },
                            }))
                          }
                          className="mt-1 text-xs text-lime-600 hover:text-lime-700 font-medium"
                        >
                          ↑ Auto-fill from Diagnosis Selection
                        </button>
                      )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      Reason for Referral & Goals{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={specialtyReferrals.physiotherapy.reason}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          physiotherapy: {
                            ...prev.physiotherapy,
                            reason: e.target.value,
                          },
                        }))
                      }
                      placeholder="Describe mobility issues and treatment goals..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                  </div>

                  {/* Treatment Plan Prescription */}
                  <div className="border-t border-lime-100 pt-4 mt-4">
                    <h5 className="text-sm font-semibold text-lime-800 mb-3">
                      📋 Treatment Plan Prescription
                    </h5>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Sessions Planned
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={physioTreatmentPlanOrder.sessionsPlanned}
                          onChange={(e) =>
                            setPhysioTreatmentPlanOrder((prev) => ({
                              ...prev,
                              sessionsPlanned:
                                parseInt(e.target.value, 10) || 1,
                            }))
                          }
                          className={INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Frequency
                        </label>
                        <ChipField
                          options={[
                            { value: 'Daily', label: 'Daily' },
                            { value: '2x per week', label: '2x/week' },
                            { value: '3x per week', label: '3x/week' },
                            { value: 'Weekly', label: 'Weekly' },
                            { value: 'Biweekly', label: 'Biweekly' },
                          ]}
                          value={physioTreatmentPlanOrder.frequency}
                          onChange={(v) =>
                            setPhysioTreatmentPlanOrder((prev) => ({
                              ...prev,
                              frequency: v,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Billing Type
                        </label>
                        <ChipField
                          options={[
                            { value: 'per_session', label: 'Per Session' },
                            { value: 'package', label: 'Package (Prepaid)' },
                          ]}
                          value={physioTreatmentPlanOrder.billingType}
                          onChange={(v) =>
                            setPhysioTreatmentPlanOrder((prev) => ({
                              ...prev,
                              billingType: v as 'per_session' | 'package',
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Special Instructions
                      </label>
                      <textarea
                        value={physioTreatmentPlanOrder.instructions}
                        onChange={(e) =>
                          setPhysioTreatmentPlanOrder((prev) => ({
                            ...prev,
                            instructions: e.target.value,
                          }))
                        }
                        placeholder="e.g., Focus on cervical mobilization, avoid high-impact exercises..."
                        rows={2}
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Surgery/Theatre Internal Form */}
            {specialtyReferrals.surgery?.selected && (
              <div className="p-6 rounded-2xl border border-red-200 bg-white shadow-sm ring-1 ring-red-100 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-red-100">
                  <div className="bg-red-50 p-2 rounded-lg">
                    <Scissors className="h-5 w-5 text-red-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">
                    Surgery/Theatre Referral
                  </h4>
                  <button
                    onClick={() =>
                      onSpecialtyReferralsChange((prev) => ({
                        ...prev,
                        surgery: { ...prev.surgery, selected: false },
                      }))
                    }
                    className="ml-auto text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-5">
                  {/* Clinical Findings - Auto-populated from Examination */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Clinical Findings
                    </label>
                    <textarea
                      value={specialtyReferrals.surgery.clinicalFindings}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          surgery: {
                            ...prev.surgery,
                            clinicalFindings: e.target.value,
                          },
                        }))
                      }
                      placeholder="Clinical examination findings..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                    {(formData.examination_findings ||
                      formData.physical_examination) &&
                      !specialtyReferrals.surgery.clinicalFindings && (
                        <button
                          type="button"
                          onClick={() =>
                            onSpecialtyReferralsChange((prev) => ({
                              ...prev,
                              surgery: {
                                ...prev.surgery,
                                clinicalFindings:
                                  formData.examination_findings ||
                                  formData.physical_examination ||
                                  '',
                              },
                            }))
                          }
                          className="mt-1 text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          ↑ Auto-fill from General Examination Findings
                        </button>
                      )}
                  </div>

                  {/* Provisional Diagnosis - Auto-populated */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Provisional Diagnosis
                    </label>
                    <textarea
                      value={specialtyReferrals.surgery.provisionalDiagnosis}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          surgery: {
                            ...prev.surgery,
                            provisionalDiagnosis: e.target.value,
                          },
                        }))
                      }
                      placeholder="Provisional diagnosis requiring surgical intervention..."
                      rows={2}
                      className={INPUT_CLS}
                    />
                    {selectedDiagnoses.length > 0 &&
                      !specialtyReferrals.surgery.provisionalDiagnosis && (
                        <button
                          type="button"
                          onClick={() =>
                            onSpecialtyReferralsChange((prev) => ({
                              ...prev,
                              surgery: {
                                ...prev.surgery,
                                provisionalDiagnosis: selectedDiagnoses
                                  .map((d) => d.title)
                                  .join(', '),
                              },
                            }))
                          }
                          className="mt-1 text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          ↑ Auto-fill from Diagnosis Selection
                        </button>
                      )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">
                      Reason for Referral & Surgical Indication{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={specialtyReferrals.surgery.reason}
                      onChange={(e) =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          surgery: { ...prev.surgery, reason: e.target.value },
                        }))
                      }
                      placeholder="Describe surgical indication and procedure required..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Generic Internal Referral Form — renders for any specialty that has NO dedicated form */}
            {(() => {
              // Specialties with dedicated forms above
              const dedicatedFormKeys = [
                'dental',
                'ophthalmology',
                'physiotherapy',
                'surgery',
              ];
              // Find specialties that are selected but don't have a dedicated form
              const genericEntries = Object.entries(specialtyReferrals).filter(
                ([key, ref]) =>
                  ref?.selected && !dedicatedFormKeys.includes(key),
              );

              const specialtyLabels: Record<string, string> = {
                ent: 'ENT (Ear, Nose, Throat)',
                cardiology: 'Cardiology',
                orthopaedics: 'Orthopaedics',
                dermatology: 'Dermatology',
                urology: 'Urology',
                gastroenterology: 'Gastroenterology',
                nephrology: 'Nephrology',
                paediatrics: 'Paediatrics',
                neurosurgery: 'Neurosurgery',
                neurology: 'Neurology',
                neuropsychiatry: 'Neuropsychiatry',
                general_surgery: 'General Surgery',
                gynaecology: 'Gynaecology',
                oral_maxillofacial: 'Oral & Maxillofacial',
                pulmonology: 'Pulmonology',
                endocrinology: 'Endocrinology',
                plastic_surgery: 'Plastic Surgery',
                nutrition: 'Nutrition',
              };

              if (genericEntries.length === 0) return null;

              return genericEntries.map(([key, ref]) => (
                <div
                  key={key}
                  className="p-6 rounded-2xl border border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-100 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-indigo-100">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                      <Stethoscope className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">
                      {specialtyLabels[key] ||
                        key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/_/g, ' ')}{' '}
                      Referral
                    </h4>
                    <button
                      onClick={() =>
                        onSpecialtyReferralsChange((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], selected: false },
                        }))
                      }
                      className="ml-auto text-sm text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-5">
                    {/* Clinical Findings */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        Clinical Findings
                      </label>
                      <textarea
                        value={ref.clinicalFindings}
                        onChange={(e) =>
                          onSpecialtyReferralsChange((prev) => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              clinicalFindings: e.target.value,
                            },
                          }))
                        }
                        placeholder="Clinical examination findings..."
                        rows={3}
                        className={INPUT_CLS}
                      />
                      {(formData.examination_findings ||
                        formData.physical_examination) &&
                        !ref.clinicalFindings && (
                          <button
                            type="button"
                            onClick={() =>
                              onSpecialtyReferralsChange((prev) => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  clinicalFindings:
                                    formData.examination_findings ||
                                    formData.physical_examination ||
                                    '',
                                },
                              }))
                            }
                            className="mt-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            ↑ Auto-fill from General Examination Findings
                          </button>
                        )}
                    </div>

                    {/* Provisional Diagnosis */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        Provisional Diagnosis
                      </label>
                      <textarea
                        value={ref.provisionalDiagnosis}
                        onChange={(e) =>
                          onSpecialtyReferralsChange((prev) => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              provisionalDiagnosis: e.target.value,
                            },
                          }))
                        }
                        placeholder="Provisional diagnosis..."
                        rows={2}
                        className={INPUT_CLS}
                      />
                      {selectedDiagnoses.length > 0 &&
                        !ref.provisionalDiagnosis && (
                          <button
                            type="button"
                            onClick={() =>
                              onSpecialtyReferralsChange((prev) => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  provisionalDiagnosis: selectedDiagnoses
                                    .map((d: any) => d.title)
                                    .join(', '),
                                },
                              }))
                            }
                            className="mt-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            ↑ Auto-fill from Diagnosis Selection
                          </button>
                        )}
                    </div>

                    {/* Reason for Referral - REQUIRED */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">
                        Reason for Referral{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={ref.reason}
                        onChange={(e) =>
                          onSpecialtyReferralsChange((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], reason: e.target.value },
                          }))
                        }
                        placeholder={`Describe the reason for referring to ${specialtyLabels[key] || key}...`}
                        rows={3}
                        className={INPUT_CLS}
                      />
                    </div>

                    {/* Urgency */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">
                        Urgency
                      </label>
                      <ChipField
                        options={[
                          { value: 'Routine', label: 'Routine' },
                          { value: 'Urgent', label: 'Urgent' },
                          { value: 'Emergency', label: 'Emergency' },
                        ]}
                        value={ref.urgency}
                        onChange={(v) =>
                          onSpecialtyReferralsChange((prev) => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              urgency: v as any,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ));
            })()}

            {!Object.values(specialtyReferrals).some((r) => r?.selected) && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 border-dashed p-12 text-center">
                <div className="mx-auto w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                  <Share2 className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-700">
                  No Referrals Selected
                </h3>
                <p className="text-gray-500">
                  Choose a referral type above to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Follow-up Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-gray-100 rounded-lg">
            <Calendar className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Follow-up</h3>
            <p className="text-sm text-gray-500">
              Schedule next appointment if needed
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Follow-up Date
            </label>
            <input
              type="date"
              value={formData.follow_up_date || ''}
              onChange={(e) => onChange('follow_up_date', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Follow-up Instructions
            </label>
            <input
              type="text"
              value={formData.follow_up_notes || ''}
              onChange={(e) => onChange('follow_up_notes', e.target.value)}
              className={INPUT_CLS}
              placeholder="Return if symptoms persist..."
            />
          </div>
          {formData.follow_up_date && (
            <div className="lg:col-span-2 flex items-center gap-2 text-xs text-primary-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Calendar size={13} className="flex-shrink-0" />
              <span>
                A follow-up booking will be created in the{' '}
                <strong>Encounter Module → Booking tab</strong> when you save
                this consultation.
              </span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// Step 7: Review & Submit
function ReviewSubmitStep({
  selectedPatient,
  selectedComplaints,
  formData,
  selectedDiagnoses,
  labOrders,
  radiologyOrders,
  prescriptions,
  procedureOrders,
  admissionOrder,
  treatmentTasks,
  specialtyReferrals,
  drugOptions,
  labTestOptions,
  imagingOptions,
  procedureOptions,
  wardOptions,
  onEditStep,
  // Setters for inline editing
  setFormData,
  setSelectedComplaints,
  setSelectedDiagnoses,
  setLabOrders,
  setRadiologyOrders,
  setPrescriptions,
  setProcedureOrders,
  setAdmissionOrder,
  setTreatmentTasks,
  setSpecialtyReferrals,
}: {
  selectedPatient: PatientDTO | null;
  selectedComplaints: SelectedComplaint[];
  formData: CreateConsultationDTO;
  selectedDiagnoses: ICDMultiSelectDiagnosis[];
  labOrders: LabOrderDTO[];
  radiologyOrders: RadiologyOrderDTO[];
  prescriptions: PrescriptionOrderDTO[];
  procedureOrders: ProcedureOrderDTO[];
  admissionOrder: AdmissionOrderDTO | null;
  treatmentTasks: CreateTreatmentTaskDTO[];
  specialtyReferrals: Record<
    string,
    {
      selected: boolean;
      reason: string;
      urgency: 'Routine' | 'Urgent' | 'Emergency';
      referralType: 'internal' | 'external';
      externalFacility: string;
      externalDoctor: string;
      clinicalFindings: string;
      provisionalDiagnosis: string;
    }
  >;
  drugOptions: SearchableOption[];
  labTestOptions: SearchableOption[];
  imagingOptions: SearchableOption[];
  procedureOptions: SearchableOption[];
  wardOptions: SearchableOption[];
  onEditStep: (stepIndex: number) => void;
  // Setter props for inline editing
  setFormData?: React.Dispatch<React.SetStateAction<CreateConsultationDTO>>;
  setSelectedComplaints?: React.Dispatch<
    React.SetStateAction<SelectedComplaint[]>
  >;
  setSelectedDiagnoses?: React.Dispatch<
    React.SetStateAction<ICDMultiSelectDiagnosis[]>
  >;
  setLabOrders?: React.Dispatch<React.SetStateAction<LabOrderDTO[]>>;
  setRadiologyOrders?: React.Dispatch<
    React.SetStateAction<RadiologyOrderDTO[]>
  >;
  setPrescriptions?: React.Dispatch<
    React.SetStateAction<PrescriptionOrderDTO[]>
  >;
  setProcedureOrders?: React.Dispatch<
    React.SetStateAction<ProcedureOrderDTO[]>
  >;
  setAdmissionOrder?: React.Dispatch<
    React.SetStateAction<AdmissionOrderDTO | null>
  >;
  setTreatmentTasks?: React.Dispatch<
    React.SetStateAction<CreateTreatmentTaskDTO[]>
  >;
  setSpecialtyReferrals?: React.Dispatch<
    React.SetStateAction<
      Record<
        string,
        {
          selected: boolean;
          reason: string;
          urgency: 'Routine' | 'Urgent' | 'Emergency';
          referralType: 'internal' | 'external';
          externalFacility: string;
          externalDoctor: string;
          clinicalFindings: string;
          provisionalDiagnosis: string;
        }
      >
    >
  >;
}) {
  const specialtyReferralCount = Object.values(specialtyReferrals).filter(
    (r) => r?.selected,
  ).length;

  // State for inline editing - track which section is being edited
  const [editingSection, setEditingSection] = useState<number | null>(null);

  // State for collapsible categories
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    subjective: true,
    objective: true,
    assessment: true,
    plan: true,
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Category Header Component with collapse toggle
  function CategoryHeader({
    title,
    color,
    icon,
    categoryKey,
    isExpanded,
  }: {
    title: string;
    color: 'blue' | 'green' | 'purple' | 'orange';
    icon: React.ReactNode;
    categoryKey: string;
    isExpanded: boolean;
  }) {
    const colorMap = {
      blue: 'border-blue-500 text-blue-700',
      green: 'border-emerald-500 text-emerald-700',
      purple: 'border-purple-500 text-purple-700',
      orange: 'border-orange-500 text-orange-700',
    };

    return (
      <button
        type="button"
        onClick={() => toggleCategory(categoryKey)}
        className={`w-full bg-white border border-gray-100 hover:border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between transition-all duration-200 shadow-sm ${
          isExpanded ? 'ring-1 ring-gray-100' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-1.5 rounded-md ${color === 'blue' ? 'bg-blue-50 text-blue-600' : color === 'green' ? 'bg-emerald-50 text-emerald-600' : color === 'purple' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}
          >
            {icon}
          </div>
          <h3 className="font-bold text-sm uppercase tracking-wide text-gray-800">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          {isExpanded ? <Minus size={16} /> : <Plus size={16} />}
        </div>
      </button>
    );
  }

  function SectionCard({
    title,
    icon,
    stepIndex,
    children,
    editContent,
    isEmpty,
    emptyMessage = 'No data entered',
    compact = false,
  }: {
    title: string;
    icon: React.ReactNode;
    stepIndex: number;
    children: React.ReactNode;
    editContent?: React.ReactNode;
    isEmpty?: boolean;
    emptyMessage?: string;
    compact?: boolean;
  }) {
    const isEditing = editingSection === stepIndex;

    const handleEditClick = () => {
      if (editContent) {
        // Toggle inline editing
        setEditingSection(isEditing ? null : stepIndex);
      } else {
        // Fall back to navigation if no inline edit content provided
        onEditStep(stepIndex);
      }
    };

    return (
      <div
        className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${
          isEditing
            ? 'border-primary-700 ring-2 ring-primary-700/20'
            : 'border-gray-200 hover:shadow-md'
        }`}
      >
        <div
          className={`flex items-center justify-between px-4 py-2 border-b ${
            isEditing
              ? 'bg-primary-700/5 border-primary-700/20'
              : 'bg-gray-50/50 border-gray-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <h4
              className={`font-semibold text-sm ${isEditing ? 'text-primary-700' : 'text-gray-700'}`}
            >
              {title}
            </h4>
            {isEditing && (
              <span className="px-2 py-0.5 bg-primary-700 text-white text-xs font-bold rounded uppercase">
                Editing
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleEditClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors shadow-sm ${
              isEditing
                ? 'text-white bg-primary-700 hover:bg-primary-800 border border-primary-700'
                : 'text-gray-600 bg-white border border-gray-200 hover:text-primary-700 hover:border-primary-700'
            }`}
          >
            {isEditing ? (
              <>
                <Check size={10} />
                Done
              </>
            ) : (
              <>
                <Edit3 size={10} />
                Edit
              </>
            )}
          </button>
        </div>
        <div className={compact && !isEditing ? 'px-4 py-3' : 'p-4'}>
          {isEditing && editContent ? (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              {editContent}
            </div>
          ) : isEmpty ? (
            <p className="text-sm text-gray-400 italic flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              {emptyMessage}
            </p>
          ) : (
            children
          )}
        </div>
      </div>
    );
  }

  // Group diagnoses by type (Primary, Secondary, etc.)
  const primaryDiagnoses = selectedDiagnoses.filter((_, idx) => idx === 0);
  const secondaryDiagnoses = selectedDiagnoses.filter((_, idx) => idx > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-700/10 rounded-xl">
            <ClipboardList className="h-5 w-5 text-primary-700" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Consultation Review
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Please verify all clinical documentation and orders before
              finalizing.
            </p>
          </div>
        </div>
      </div>

      {/* Patient Information - Always on top */}
      <SectionCard
        title="Patient Identity"
        icon={<User size={14} />}
        stepIndex={0}
        isEmpty={!selectedPatient}
        compact
      >
        {selectedPatient && (
          <div className="flex items-center gap-4 py-1">
            {selectedPatient.photo_url ? (
              <img
                src={selectedPatient.photo_url}
                alt=""
                className="w-14 h-14 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200">
                <User size={24} />
              </div>
            )}
            <div>
              <p className="font-bold text-gray-900 text-lg">
                {formatPatientName(selectedPatient)}
              </p>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700 border border-gray-200">
                  {selectedPatient.emr_number || 'N/A'}
                </span>
                <span>{selectedPatient.gender}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <span>{formatDetailedAge(selectedPatient.date_of_birth)}</span>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* SUBJECTIVE CATEGORY */}
      <div className="space-y-2">
        <CategoryHeader
          title="Subjective"
          color="blue"
          icon={<Heart size={14} />}
          categoryKey="subjective"
          isExpanded={expandedCategories.subjective}
        />

        <div
          className={`grid grid-cols-1 gap-2 transition-all duration-200 overflow-hidden ${expandedCategories.subjective ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0'}`}
        >
          {/* Chief Complaints */}
          <SectionCard
            title="Chief Complaints"
            icon={<Heart size={14} />}
            stepIndex={1}
            isEmpty={selectedComplaints.length === 0}
            emptyMessage="No complaints recorded"
            compact
          >
            <div className="space-y-2">
              {selectedComplaints.map((complaint, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${complaint.is_primary ? 'bg-red-500' : 'bg-gray-300'}`}
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 text-sm">
                      {complaint.complaint_name}
                    </span>
                    {complaint.is_primary && (
                      <span className="ml-2 px-1.5 py-0.5 bg-white border border-red-200 text-red-700 text-xs font-bold rounded uppercase tracking-wider">
                        Primary
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs bg-gray-100 px-2 py-1 rounded">
                    {complaint.duration_value}{' '}
                    {complaint.duration_unit.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Clinical History */}
          <SectionCard
            title="Clinical History"
            icon={<FileText size={14} />}
            stepIndex={2}
            isEmpty={
              !formData.history_of_present_illness &&
              !formData.past_medical_history &&
              !formData.family_history &&
              !formData.social_history &&
              !formData.review_of_systems
            }
            emptyMessage="No clinical history recorded"
            compact
            editContent={
              setFormData && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      History of Present Illness
                    </label>
                    <textarea
                      value={formData.history_of_present_illness || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          history_of_present_illness: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      rows={3}
                      placeholder="Describe the presenting illness..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Past Medical History
                    </label>
                    <textarea
                      value={formData.past_medical_history || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          past_medical_history: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      rows={2}
                      placeholder="Past medical conditions..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Family History
                    </label>
                    <textarea
                      value={formData.family_history || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          family_history: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      rows={2}
                      placeholder="Family medical history..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Social History
                    </label>
                    <textarea
                      value={formData.social_history || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          social_history: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      rows={2}
                      placeholder="Social history..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Review of Systems
                    </label>
                    <textarea
                      value={formData.review_of_systems || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          review_of_systems: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      rows={2}
                      placeholder="Systems review..."
                    />
                  </div>
                </div>
              )
            }
          >
            <div className="space-y-2 text-sm">
              {formData.history_of_present_illness && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    History of Present Illness
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.history_of_present_illness}
                  </p>
                </div>
              )}
              {formData.past_medical_history && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Past Medical History
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.past_medical_history}
                  </p>
                </div>
              )}
              {formData.family_history && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Family History
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.family_history}
                  </p>
                </div>
              )}
              {formData.social_history && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Social History
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.social_history}
                  </p>
                </div>
              )}
              {formData.review_of_systems && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Review of Systems
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.review_of_systems}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* OBJECTIVE CATEGORY */}
      <div className="space-y-2">
        <CategoryHeader
          title="Objective"
          color="green"
          icon={<Stethoscope size={14} />}
          categoryKey="objective"
          isExpanded={expandedCategories.objective}
        />

        <div
          className={`grid grid-cols-1 gap-2 transition-all duration-200 overflow-hidden ${expandedCategories.objective ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0'}`}
        >
          {/* Vital Signs */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">
                  <Activity size={14} />
                </span>
                <h4 className="font-medium text-gray-800 text-sm">
                  Vital Signs
                </h4>
              </div>
              <span className="text-xs text-gray-400">Recorded by Nursing</span>
            </div>
            <div className="p-3">
              <div className="p-3 bg-slate-50 text-slate-500 text-center rounded-lg border border-dashed border-slate-200 text-sm italic">
                Vitals are permanently displayed at the top of the consultation
                form.
              </div>
            </div>
          </div>

          {/* Physical Examination */}
          <SectionCard
            title="Physical Examination"
            icon={<Stethoscope size={14} />}
            stepIndex={3}
            isEmpty={
              !formData.examination_findings &&
              !formData.physical_examination &&
              !formData.clinical_notes
            }
            emptyMessage="No examination findings recorded"
            compact
            editContent={
              setFormData && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      General Examination
                    </label>
                    <textarea
                      value={formData.examination_findings || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          examination_findings: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      rows={3}
                      placeholder="General examination findings..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Detailed Physical Examination
                    </label>
                    <textarea
                      value={formData.physical_examination || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          physical_examination: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      rows={3}
                      placeholder="Detailed physical examination..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Clinical Notes
                    </label>
                    <textarea
                      value={formData.clinical_notes || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          clinical_notes: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      rows={2}
                      placeholder="Additional clinical notes..."
                    />
                  </div>
                </div>
              )
            }
          >
            <div className="space-y-2 text-sm">
              {formData.examination_findings && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    General Examination
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.examination_findings}
                  </p>
                </div>
              )}
              {formData.physical_examination && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Detailed Physical Examination
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.physical_examination}
                  </p>
                </div>
              )}
              {formData.clinical_notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Clinical Notes
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.clinical_notes}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ASSESSMENT CATEGORY */}
      <div className="space-y-2">
        <CategoryHeader
          title="Assessment"
          color="purple"
          icon={<ClipboardList size={14} />}
          categoryKey="assessment"
          isExpanded={expandedCategories.assessment}
        />

        <div
          className={`grid grid-cols-1 gap-2 transition-all duration-200 overflow-hidden ${expandedCategories.assessment ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0'}`}
        >
          {/* Diagnosis */}
          <SectionCard
            title="Diagnosis"
            icon={<ClipboardList size={14} />}
            stepIndex={4}
            isEmpty={selectedDiagnoses.length === 0}
            emptyMessage="No diagnosis recorded"
            compact
          >
            <div className="space-y-4">
              {/* Primary Diagnosis */}
              {primaryDiagnoses.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Primary Diagnosis
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {primaryDiagnoses.map((diagnosis, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-white border border-red-200 text-gray-800 rounded-md text-sm font-medium shadow-sm flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {!diagnosis.code.startsWith('CUSTOM') && (
                          <span className="text-gray-500 font-mono text-xs border-r border-gray-200 pr-2 mr-1">
                            {diagnosis.code}
                          </span>
                        )}
                        {diagnosis.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Secondary Diagnoses */}
              {secondaryDiagnoses.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Secondary Diagnoses
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {secondaryDiagnoses.map((diagnosis, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-white border border-purple-200 text-gray-700 rounded-md text-sm shadow-sm flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        {!diagnosis.code.startsWith('CUSTOM') && (
                          <span className="text-gray-500 font-mono text-xs border-r border-gray-200 pr-2 mr-1">
                            {diagnosis.code}
                          </span>
                        )}
                        {diagnosis.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Treatment Plan */}
          <SectionCard
            title="Treatment Plan Notes"
            icon={<FileText size={14} />}
            stepIndex={4}
            isEmpty={!formData.treatment_plan && !formData.recommendations}
            emptyMessage="No treatment plan notes"
            compact
          >
            <div className="space-y-2 text-sm">
              {formData.treatment_plan && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Treatment Plan
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.treatment_plan}
                  </p>
                </div>
              )}
              {formData.recommendations && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Recommendations
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {formData.recommendations}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* PLAN CATEGORY */}
      <div className="space-y-2">
        <CategoryHeader
          title="Plan & Orders"
          color="orange"
          icon={<Pill size={14} />}
          categoryKey="plan"
          isExpanded={expandedCategories.plan}
        />

        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-200 overflow-hidden ${expandedCategories.plan ? 'opacity-100 max-h-[2000px]' : 'opacity-0 max-h-0'}`}
        >
          {/* Prescriptions */}
          <SectionCard
            title={`Prescriptions (${prescriptions.length})`}
            icon={<Pill size={14} />}
            stepIndex={5}
            isEmpty={prescriptions.length === 0}
            emptyMessage="No prescriptions"
            compact
          >
            <div className="space-y-2">
              {prescriptions.map((rx, idx) => {
                const drug = drugOptions.find((d) => d.id === rx.drug_id);
                return (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-lg text-sm border border-gray-200 shadow-sm hover:border-orange-200 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="min-w-0">
                        <div
                          className="font-semibold text-gray-900 line-clamp-1"
                          title={drug?.name || rx.drug_name}
                        >
                          {drug?.name || rx.drug_name}
                        </div>
                        {rx.is_external && (
                          <span className="mt-1 inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            External ? not dispensed
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 border border-gray-200 whitespace-nowrap ml-2">
                        x{rx.quantity_prescribed}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                        {rx.dosage}
                      </span>
                      <span>•</span>
                      <span>{rx.frequency}</span>
                      <span>•</span>
                      <span>{rx.duration}</span>
                    </div>
                    {rx.instructions && (
                      <p className="text-xs text-gray-400 mt-1 italic line-clamp-1">
                        {rx.instructions}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Lab Orders */}
          <SectionCard
            title={`Lab Tests (${labOrders.length})`}
            icon={<FlaskConical size={14} />}
            stepIndex={5}
            isEmpty={labOrders.length === 0}
            emptyMessage="No lab tests ordered"
            compact
          >
            <div className="flex flex-wrap gap-2">
              {labOrders.map((order, idx) => {
                const test = labTestOptions.find((t) => t.id === order.test_id);
                return (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-white text-gray-700 border border-emerald-200 rounded-md text-xs font-medium shadow-sm flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {test?.name || order.test_name || order.test_id}
                  </span>
                );
              })}
            </div>
          </SectionCard>

          {/* Imaging Orders */}
          <SectionCard
            title={`Imaging (${radiologyOrders.length})`}
            icon={<Scan size={14} />}
            stepIndex={5}
            isEmpty={radiologyOrders.length === 0}
            emptyMessage="No imaging ordered"
            compact
          >
            <div className="flex flex-wrap gap-2">
              {radiologyOrders.map((order, idx) => {
                const imaging = imagingOptions.find(
                  (i) => i.id === order.imaging_id,
                );
                return (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-white text-gray-700 border border-blue-200 rounded-md text-xs font-medium shadow-sm flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {imaging?.name || order.imaging_id}
                  </span>
                );
              })}
            </div>
          </SectionCard>

          {/* Procedure Orders */}
          <SectionCard
            title={`Procedures (${procedureOrders.length})`}
            icon={<Scissors size={14} />}
            stepIndex={5}
            isEmpty={procedureOrders.length === 0}
            emptyMessage="No procedures requested"
            compact
          >
            <div className="space-y-2">
              {procedureOrders.map((proc, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white rounded-lg text-sm border border-gray-200 shadow-sm hover:border-purple-200 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">
                      {proc.procedure_name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${
                        proc.priority === 'Emergency'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : proc.priority === 'Urgent'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {proc.priority}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs">{proc.procedure_type}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Admission Request */}
          <SectionCard
            title={admissionOrder ? 'Admission Request' : 'Admission'}
            icon={<Bed size={14} />}
            stepIndex={5}
            isEmpty={!admissionOrder}
            emptyMessage="No admission requested"
            compact
          >
            {admissionOrder && (
              <div className="p-3 bg-white rounded-lg text-sm border border-gray-200 shadow-sm hover:border-red-200 transition-colors space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="font-semibold text-gray-900">
                    {admissionOrder.admission_type} Admission
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${
                      admissionOrder.priority === 'Emergency'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : admissionOrder.priority === 'Urgent'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {admissionOrder.priority}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {admissionOrder.ward_name && (
                    <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                      <span className="block text-gray-400 text-xs uppercase">
                        Ward
                      </span>
                      <span className="font-medium text-gray-700">
                        {admissionOrder.ward_name}
                      </span>
                    </div>
                  )}
                  {admissionOrder.expected_duration && (
                    <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                      <span className="block text-gray-400 text-xs uppercase">
                        Duration
                      </span>
                      <span className="font-medium text-gray-700">
                        {admissionOrder.expected_duration}
                      </span>
                    </div>
                  )}
                </div>
                <div className="pt-1">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Reason:</span>{' '}
                    {admissionOrder.reason || 'Not specified'}
                  </p>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Referrals */}
          <SectionCard
            title={`Referrals (${specialtyReferralCount})`}
            icon={<ClipboardList size={14} />}
            stepIndex={5}
            isEmpty={specialtyReferralCount === 0}
            emptyMessage="No referrals"
            compact
          >
            <div className="space-y-2">
              {Object.entries(specialtyReferrals)
                .filter(([_, ref]) => ref?.selected)
                .map(([key, ref]) => (
                  <div
                    key={key}
                    className="p-3 bg-white rounded-lg text-sm border border-gray-200 shadow-sm hover:border-blue-200 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <Share2 size={14} className="text-blue-600" />
                        <span className="font-semibold text-gray-900">
                          {key.charAt(0).toUpperCase() +
                            key.slice(1).replace(/_/g, ' ')}{' '}
                          Referral
                        </span>
                      </div>
                      <span className="text-xs uppercase font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 border border-gray-200">
                        {ref?.urgency}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs italic border-l-2 border-gray-200 pl-2 mt-1">
                      {ref?.reason}
                    </p>
                  </div>
                ))}
            </div>
          </SectionCard>

          {/* Follow-up */}
          <SectionCard
            title="Follow-up"
            icon={<Calendar size={14} />}
            stepIndex={5}
            isEmpty={!formData.follow_up_date && !formData.follow_up_notes}
            emptyMessage="No follow-up scheduled"
            compact
          >
            <div className="p-2 border border-gray-100 rounded-lg bg-gray-50/50">
              {formData.follow_up_date && (
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-gray-400 bg-white p-1.5 rounded shadow-sm border border-gray-100">
                    <Calendar size={16} />
                  </div>
                  <span className="font-medium text-gray-900 text-sm">
                    {new Date(formData.follow_up_date).toLocaleDateString(
                      'en-GB',
                      {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      },
                    )}
                  </span>
                </div>
              )}
              {formData.follow_up_notes && (
                <p className="text-gray-600 text-xs pl-1 border-l-2 border-gray-200 italic ml-2">
                  {formData.follow_up_notes}
                </p>
              )}
            </div>
          </SectionCard>

          {/* Nursing Treatment Tasks */}
          <SectionCard
            title={`Nursing Tasks (${treatmentTasks.length})`}
            icon={<ListTodo size={14} />}
            stepIndex={5}
            isEmpty={treatmentTasks.length === 0}
            emptyMessage="No nursing tasks assigned"
            compact
          >
            <div className="space-y-2">
              {treatmentTasks.map((task, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white rounded-lg text-sm border border-gray-200 shadow-sm hover:border-teal-200 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${
                          task.task_type === 'Administer_Medication'
                            ? 'bg-orange-50 text-orange-700 border-orange-100'
                            : task.task_type === 'Monitor_Vitals'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : task.task_type === 'Procedure'
                                ? 'bg-purple-50 text-purple-700 border-purple-100'
                                : task.task_type === 'Wound_Care'
                                  ? 'bg-red-50 text-red-700 border-red-100'
                                  : task.task_type === 'Sample_Collection'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {task.task_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        task.priority === 'Emergency'
                          ? 'text-red-600 bg-red-50'
                          : task.priority === 'Urgent'
                            ? 'text-amber-600 bg-amber-50'
                            : 'text-gray-500 bg-gray-50'
                      }`}
                    >
                      {task.priority || 'Normal'}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded text-xs border border-gray-100 my-1 font-medium text-gray-800">
                    {task.title}
                  </div>
                  {task.description && (
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  {task.task_type === 'Administer_Medication' &&
                    task.medication_name && (
                      <p className="text-orange-600 text-xs mt-1 bg-orange-50/50 p-1 rounded inline-block">
                        💊 {task.medication_name} - {task.dosage} ({task.route})
                      </p>
                    )}
                  {task.task_type === 'Monitor_Vitals' && task.frequency && (
                    <p className="text-blue-600 text-xs mt-1 bg-blue-50/50 p-1 rounded inline-block">
                      ⏰ {task.frequency}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* AI Clinical Review — Pre-submission analysis */}
      <AIConsultationReview
        patientId={selectedPatient?.id || null}
        complaints={selectedComplaints.map((c) => ({
          complaint_name: c.complaint_name,
          complaint_code: c.complaint_code,
          is_primary: c.is_primary,
          duration_value: c.duration_value,
          duration_unit: c.duration_unit,
          notes: c.notes,
        }))}
        formData={formData}
        diagnoses={selectedDiagnoses.map((d) => ({
          code: d.code,
          title: d.title,
        }))}
        prescriptions={prescriptions.map((p) => ({
          drug_name: p.drug_name,
          dosage: p.dosage,
          route: p.route,
          frequency: p.frequency,
          duration: p.duration,
          quantity_prescribed: p.quantity_prescribed,
          instructions: p.instructions,
        }))}
        labOrders={labOrders.map((l) => ({
          test_name: l.test_name,
          test_code: l.test_code,
          priority: l.priority,
          clinical_notes: l.clinical_notes,
        }))}
        radiologyOrders={radiologyOrders.map((r) => ({
          imaging_id: r.imaging_id,
          body_part: r.body_part,
          clinical_indication: r.clinical_indication,
          priority: r.priority,
        }))}
        procedureOrders={procedureOrders.map((p) => ({
          procedure_name: p.procedure_name,
          procedure_type: p.procedure_type,
          priority: p.priority,
          notes: p.notes,
          clinical_notes: p.clinical_notes,
        }))}
        admissionOrder={admissionOrder as Record<string, unknown> | null}
        treatmentTasks={treatmentTasks.map((t) => ({
          task_type: t.task_type,
          title: t.title,
          priority: t.priority,
          medication_name: t.medication_name,
          dosage: t.dosage,
          route: t.route,
        }))}
        referrals={Object.entries(specialtyReferrals)
          .filter(([, v]) => v?.selected)
          .map(([specialty, v]) => ({
            specialty,
            reason: v.reason,
            urgency: v.urgency,
          }))}
      />

      {/* Submit Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3">
        <div className="bg-white p-1.5 rounded-full border border-gray-200 shadow-sm text-gray-500">
          <AlertCircle size={16} />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">
            Ready to submit?
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Once submitted, the consultation record will be saved to the
            permanent medical record and orders will be dispatched immediately
            to their respective departments.
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Patient History Sidebar — Encounter-Centric (mirrors EncounterCentricView)
// =============================================================================

type SidebarModule =
  | 'overview'
  | 'timeline'
  | 'vitals'
  | 'all-notes'
  | 'labs'
  | 'radiology'
  | 'pharmacy'
  | 'treatment-plan'
  | 'admissions'
  | 'billing'
  | 'procedures'
  | 'dental'
  | 'ophthalmology'
  | 'physiotherapy';

const SIDEBAR_MODULES: {
  id: SidebarModule;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <Activity size={13} />,
    color: 'text-emerald-600',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: <Clock size={13} />,
    color: 'text-amber-600',
  },
  {
    id: 'vitals',
    label: 'Vitals',
    icon: <Heart size={13} />,
    color: 'text-rose-600',
  },
  {
    id: 'all-notes',
    label: 'Clinical Notes',
    icon: <FileText size={13} />,
    color: 'text-indigo-600',
  },
  {
    id: 'labs',
    label: 'Laboratory',
    icon: <FlaskConical size={13} />,
    color: 'text-blue-600',
  },
  {
    id: 'radiology',
    label: 'Radiology',
    icon: <Scan size={13} />,
    color: 'text-purple-600',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: <Pill size={13} />,
    color: 'text-green-600',
  },
  {
    id: 'treatment-plan',
    label: 'Treatment Plan',
    icon: <ListTodo size={13} />,
    color: 'text-teal-600',
  },
  {
    id: 'admissions',
    label: 'Ward/Bed',
    icon: <Bed size={13} />,
    color: 'text-cyan-600',
  },
  {
    id: 'billing',
    label: 'Financials',
    icon: <ClipboardList size={13} />,
    color: 'text-orange-600',
  },
  {
    id: 'procedures',
    label: 'Procedures',
    icon: <Scissors size={13} />,
    color: 'text-red-700',
  },
  {
    id: 'dental',
    label: 'Dental',
    icon: <Smile size={13} />,
    color: 'text-cyan-700',
  },
  {
    id: 'ophthalmology',
    label: 'Ophthalmology',
    icon: <Eye size={13} />,
    color: 'text-indigo-700',
  },
  {
    id: 'physiotherapy',
    label: 'Physiotherapy',
    icon: <Dumbbell size={13} />,
    color: 'text-emerald-700',
  },
];

function InlinePatientHistorySidebar({
  patientId,
  isOpen,
  onClose,
  width = 380,
  onResize,
  onSetWidth,
}: {
  patientId: string;
  isOpen: boolean;
  onClose: () => void;
  width?: number;
  onResize?: (delta: number) => void;
  onSetWidth?: (w: number) => void;
}) {
  const [selectedEncId, setSelectedEncId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<SidebarModule>('overview');
  const [showEncDropdown, setShowEncDropdown] = useState(false);
  const [showQuickView, setShowQuickView] = useState(true); // Toggle between quick view and full module

  // Fetch patient data using the same hooks as EncounterCentricView
  const { data: patientData, isLoading: isLoadingPatient } =
    usePatientMedicalRecords(isOpen ? patientId : null);
  const encounters = patientData?.recent_encounters || [];
  const patient = patientData?.patient;
  const latestVitals = patientData?.latest_vitals;
  const currentMeds = patientData?.current_medications || [];

  // Auto-select first encounter when data loads
  useEffect(() => {
    if (encounters.length > 0 && !selectedEncId) {
      setSelectedEncId(encounters[0].encounter_id);
    }
  }, [encounters, selectedEncId]);

  // Fetch full encounter details for the selected encounter
  const { data: encounterDetail, isLoading: isLoadingDetail } =
    useEncounterDetails(selectedEncId);

  const selectedEnc = encounters.find((e) => e.encounter_id === selectedEncId);

  if (!isOpen) return null;

  // Navigate encounters
  const currentIdx = encounters.findIndex(
    (e) => e.encounter_id === selectedEncId,
  );
  const goPrev = () => {
    if (currentIdx > 0) {
      setSelectedEncId(encounters[currentIdx - 1].encounter_id);
    }
  };
  const goNext = () => {
    if (currentIdx < encounters.length - 1) {
      setSelectedEncId(encounters[currentIdx + 1].encounter_id);
    }
  };

  // Preset sizes
  const SIZE_PRESETS = { sm: 300, md: 400, lg: 550 };

  // Render selected module panel
  function renderModulePanel() {
    if (isLoadingDetail) {
      return <SkeletonForm fields={3} hasButtons={false} />;
    }
    if (!encounterDetail) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
          <ClipboardList size={24} className="mb-2 opacity-40" />
          <span className="text-xs">Select an encounter</span>
        </div>
      );
    }

    const panelMap: Record<SidebarModule, React.ReactNode> = {
      overview: <OverviewPanel encounter={encounterDetail} />,
      timeline: <TimelinePanel encounter={encounterDetail} />,
      vitals: <VitalsPanel encounter={encounterDetail} />,
      'all-notes': <AllNotesPanel encounter={encounterDetail} />,
      labs: (
        <LabsPanel
          encounter={encounterDetail}
          onBack={() => setActiveModule('overview')}
        />
      ),
      radiology: <RadiologyPanel encounter={encounterDetail} />,
      pharmacy: <PharmacyPanel encounter={encounterDetail} />,
      'treatment-plan': <TreatmentPlanPanel encounter={encounterDetail} />,
      admissions: <AdmissionsPanel encounter={encounterDetail} />,
      billing: <BillingPanel encounter={encounterDetail} />,
      procedures: <ProceduresPanel encounter={encounterDetail} />,
      dental: <DentalPanel encounter={encounterDetail} />,
      ophthalmology: <OphthalmologyPanel encounter={encounterDetail} />,
      physiotherapy: <PhysiotherapyPanel encounter={encounterDetail} />,
    };

    return (
      panelMap[activeModule] || <OverviewPanel encounter={encounterDetail} />
    );
  }

  return (
    <div
      className="flex flex-col bg-white border-l border-gray-200 h-full shadow-lg z-20 relative flex-shrink-0"
      style={{ width, minWidth: 280, maxWidth: 650 }}
    >
      {/* Resize Handle - Left Edge */}
      {onResize && (
        <div
          className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-30"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const delta = startX - moveEvent.clientX;
              onResize(delta);
            };
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />
      )}

      {/* Header with Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-slate-800 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <User size={14} />
          <span className="text-xs font-bold uppercase tracking-wide">
            Patient Story
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Size Preset Buttons */}
          {onSetWidth && (
            <div className="flex items-center gap-0.5 mr-2 bg-slate-700 rounded p-0.5">
              {(['sm', 'md', 'lg'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => onSetWidth(SIZE_PRESETS[size])}
                  className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded transition-colors ${
                    width >= SIZE_PRESETS[size] - 20 &&
                    width <= SIZE_PRESETS[size] + 20
                      ? 'bg-white text-slate-800'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title={`${size.toUpperCase()} (${SIZE_PRESETS[size]}px)`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Patient Bio Card - Compact */}
      {isLoadingPatient ? (
        <div className="px-3 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Loading patient...</span>
          </div>
        </div>
      ) : patient ? (
        <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-semibold text-gray-800 tracking-tight truncate">
                {patient.title ? `${patient.title} ` : ''}
                {patient.first_name} {patient.surname}
              </h4>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-600">
                <span className="font-medium">
                  {patient.age}y {patient.gender?.charAt(0)}
                </span>
                <span className="text-gray-300">|</span>
                <span className="font-mono text-gray-500">
                  {patient.emr_number}
                </span>
                {patient.blood_group && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="font-bold text-red-600">
                      {patient.blood_group}
                      {patient.genotype ? `/${patient.genotype}` : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase">
                {patient.patient_category || 'General'}
              </span>
            </div>
          </div>

          {/* Allergies Alert - Prominent if any */}
          {patient.allergies && patient.allergies.length > 0 && (
            <div className="mt-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded flex items-start gap-2">
              <AlertTriangle
                size={12}
                className="text-red-500 flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold uppercase text-red-600">
                  Allergies:
                </span>
                <p className="text-xs text-red-700 font-medium truncate">
                  {patient.allergies
                    .map((a) => (typeof a === 'string' ? a : a.allergen))
                    .join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Quick View Toggle + Content */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50/80 flex-shrink-0">
        <button
          onClick={() => setShowQuickView(!showQuickView)}
          className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            showQuickView
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-200 text-gray-600'
          }`}
        >
          <Activity size={10} />
          Quick View
        </button>
        <span className="text-[9px] text-gray-400">
          {encounters.length} encounter{encounters.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Quick View Section - At a Glance Info */}
      {showQuickView && (
        <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0 space-y-2 max-h-[200px] overflow-y-auto">
          {/* Latest Vitals Row */}
          {latestVitals && (
            <div className="grid grid-cols-4 gap-1.5">
              {latestVitals.blood_pressure && (
                <div className="bg-rose-50 rounded p-1.5 text-center">
                  <div className="text-[8px] text-rose-500 font-bold uppercase">
                    BP
                  </div>
                  <div className="text-xs font-bold text-rose-700">
                    {latestVitals.blood_pressure.systolic}/
                    {latestVitals.blood_pressure.diastolic}
                  </div>
                </div>
              )}
              {latestVitals.pulse_rate && (
                <div className="bg-amber-50 rounded p-1.5 text-center">
                  <div className="text-[8px] text-amber-500 font-bold uppercase">
                    Pulse
                  </div>
                  <div className="text-xs font-bold text-amber-700">
                    {latestVitals.pulse_rate}
                  </div>
                </div>
              )}
              {latestVitals.temperature && (
                <div className="bg-blue-50 rounded p-1.5 text-center">
                  <div className="text-[8px] text-blue-500 font-bold uppercase">
                    Temp
                  </div>
                  <div className="text-xs font-bold text-blue-700">
                    {latestVitals.temperature}°C
                  </div>
                </div>
              )}
              {latestVitals.oxygen_saturation && (
                <div className="bg-green-50 rounded p-1.5 text-center">
                  <div className="text-[8px] text-green-500 font-bold uppercase">
                    SpO₂
                  </div>
                  <div className="text-xs font-bold text-green-700">
                    {latestVitals.oxygen_saturation}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent Meds - Last 3 */}
          {currentMeds.length > 0 && (
            <div>
              <div className="text-[9px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <Pill size={9} /> Recent Medications
              </div>
              <div className="space-y-0.5">
                {currentMeds.slice(0, 3).map((med, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-700 bg-green-50 rounded px-2 py-0.5 truncate"
                  >
                    <span className="font-medium">{med.drug_name}</span>
                    <span className="text-gray-500 ml-1">
                      {med.dosage} {med.frequency}
                    </span>
                  </div>
                ))}
                {currentMeds.length > 3 && (
                  <span className="text-[9px] text-gray-400 italic">
                    +{currentMeds.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Recent Labs from latest encounter */}
          {encounterDetail?.lab_requests &&
            encounterDetail.lab_requests.length > 0 && (
              <div>
                <div className="text-[9px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                  <FlaskConical size={9} /> Recent Lab Requests
                </div>
                <div className="space-y-0.5">
                  {encounterDetail.lab_requests.slice(0, 3).map((lab, i) => (
                    <div
                      key={i}
                      className="text-xs text-gray-700 bg-blue-50 rounded px-2 py-0.5 truncate"
                    >
                      <span className="font-medium">
                        {lab.test_name || 'Lab Test'}
                      </span>
                      <span
                        className={`ml-1 text-[9px] px-1 rounded ${
                          lab.status === 'Completed'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-yellow-100 text-yellow-600'
                        }`}
                      >
                        {lab.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Encounter Selector - Compact */}
      <div className="px-3 py-2 border-b border-gray-200 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            disabled={currentIdx <= 0}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={12} />
          </button>
          <div className="relative flex-1">
            <button
              onClick={() => setShowEncDropdown(!showEncDropdown)}
              className="w-full bg-slate-700 text-white px-2 py-1 rounded flex items-center justify-between gap-1 hover:bg-slate-600 transition-colors text-xs"
            >
              <span className="font-semibold truncate">
                {selectedEnc?.encounter_number || 'Select Encounter'}
              </span>
              <ChevronDown
                size={12}
                className={`transition-transform ${showEncDropdown ? 'rotate-180' : ''}`}
              />
            </button>
            {showEncDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-xl z-50 max-h-48 overflow-y-auto">
                {encounters.map((enc) => (
                  <button
                    key={enc.encounter_id}
                    onClick={() => {
                      setSelectedEncId(enc.encounter_id);
                      setShowEncDropdown(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 hover:bg-gray-50 text-xs border-b border-gray-50 last:border-0 ${
                      enc.encounter_id === selectedEncId ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">
                        {enc.encounter_number}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {new Date(enc.encounter_date).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={goNext}
            disabled={currentIdx >= encounters.length - 1}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Module Selector Dropdown */}
      <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <select
          value={activeModule}
          onChange={(e) => setActiveModule(e.target.value as SidebarModule)}
          className={INPUT_CLS}
        >
          {SIDEBAR_MODULES.map((mod) => (
            <option key={mod.id} value={mod.id}>
              {mod.label}
            </option>
          ))}
        </select>
      </div>

      {/* Module Panel Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="p-3">{renderModulePanel()}</div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Wizard Component
// =============================================================================

const CONSULTATION_FORM_STORAGE_PREFIX = 'ndc_consultation_form_draft_';

interface ConsultationWizardDraft {
  savedAt: number;
  currentStep: number;
  completedSteps: string[];
  selectedPatient: PatientDTO | null;
  selectedEncounter: EncounterSummary | null;
  formData: CreateConsultationDTO;
  selectedDiagnoses: ICDMultiSelectDiagnosis[];
  selectedComplaints: SelectedComplaint[];
  labOrders: LabOrderDTO[];
  radiologyOrders: RadiologyOrderDTO[];
  prescriptions: PrescriptionOrderDTO[];
  procedureOrders: ProcedureOrderDTO[];
  admissionOrder: AdmissionOrderDTO | null;
  treatmentTasks: CreateTreatmentTaskDTO[];
  specialtyReferrals: Record<string, any>;
  externalNhisReferral: Record<string, any>;
  physioTreatmentPlanOrder: {
    sessionsPlanned: number;
    frequency: string;
    billingType: 'per_session' | 'package';
    instructions: string;
  };
}

export default function ConsultationWizard({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  preselectedPatient,
  visitId,
  encounterId,
}: ConsultationWizardProps) {
  // Toast notifications
  const { showToast } = useToast();
  const { staff } = useAuth();
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // AI Assistant Panel State
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [transitionDirection, setTransitionDirection] = useState<
    'left' | 'right'
  >('right');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isMaximized, setIsMaximized] = useState(false);
  const [vitalsSidebarWidth, setVitalsSidebarWidth] = useState(220); // Narrower default
  const [isResizing, setIsResizing] = useState(false);
  const [isVitalsCollapsed, setIsVitalsCollapsed] = useState(false);
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(true);
  const [historySidebarWidth, setHistorySidebarWidth] = useState(340);
  const [isHistoryResizing, setIsHistoryResizing] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<
    ICDMultiSelectDiagnosis[]
  >([]);
  const [selectedComplaints, setSelectedComplaints] = useState<
    SelectedComplaint[]
  >([]);

  // Encounter management state
  const [selectedEncounter, setSelectedEncounter] =
    useState<EncounterSummary | null>(null);
  const [patientEncounters, setPatientEncounters] = useState<
    EncounterSummary[]
  >([]);
  // Dynamically constructed STEPS
  const STEPS = useMemo(() => {
    const baseSteps = [...DEFAULT_STEPS];

    const isAntenatalEncounter =
      selectedEncounter?.visit_type === 'Antenatal' ||
      String(selectedEncounter?.chief_complaint || '')
        .toLowerCase()
        .includes('antenatal') ||
      String((selectedEncounter as any)?.clinic?.clinic_name || '')
        .toLowerCase()
        .includes('antenatal') ||
      String((selectedEncounter as any)?.department_name || '')
        .toLowerCase()
        .includes('gynaec');

    if (isAntenatalEncounter) {
      const reviewIdx = baseSteps.findIndex((s) => s.id === 'review');
      baseSteps.splice(reviewIdx + 1, 0, {
        id: 'antenatal',
        title: 'Antenatal Review',
        shortTitle: 'ANC',
        icon: <Baby size={12} />,
        description: 'Obstetric assessment & timeline',
        category: 'subjective',
      });
    }
    return baseSteps;
  }, [selectedEncounter]);

  const [isLoadingEncounter, setIsLoadingEncounter] = useState(false);
  const [encounterError, setEncounterError] = useState<string | undefined>(
    undefined,
  );

  // Form data
  const [formData, setFormData] = useState<CreateConsultationDTO>({
    patient_id: '',
    visit_id: visitId || '',
    encounter_id: encounterId || '',
    complaints: '',
    clinical_notes: '',
    history_of_present_illness: '',
    past_medical_history: '',
    family_history: '',
    social_history: '',
    review_of_systems: '',
    examination_findings: '',
    physical_examination: '',
    diagnosis: '',
    differential_diagnosis: [],
    treatment_plan: '',
    recommendations: '',
    follow_up_date: '',
    follow_up_notes: '',
  });

  // Orders
  const [labOrders, setLabOrders] = useState<LabOrderDTO[]>([]);
  const [radiologyOrders, setRadiologyOrders] = useState<RadiologyOrderDTO[]>(
    [],
  );
  const [prescriptions, setPrescriptions] = useState<PrescriptionOrderDTO[]>(
    [],
  );
  const [procedureOrders, setProcedureOrders] = useState<ProcedureOrderDTO[]>(
    [],
  );
  const [admissionOrder, setAdmissionOrder] =
    useState<AdmissionOrderDTO | null>(null);

  // Treatment Tasks for nursing
  const [treatmentTasks, setTreatmentTasks] = useState<
    CreateTreatmentTaskDTO[]
  >([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState<Partial<CreateTreatmentTaskDTO>>({
    task_type: 'Other',
    title: '',
    description: '',
    instructions: '',
    priority: 'Normal',
  });

  // Specialty Referrals state - INTERNAL ONLY (to our specialty clinics within NDC)
  // Default state for a specialty referral entry
  const defaultRef = {
    selected: false,
    reason: '',
    urgency: 'Routine' as const,
    referralType: 'internal' as const,
    externalFacility: '',
    externalDoctor: '',
    clinicalFindings: '',
    provisionalDiagnosis: '',
  };

  // Physiotherapy treatment plan fields (separate from general referral state)
  const [physioTreatmentPlanOrder, setPhysioTreatmentPlanOrder] = useState({
    sessionsPlanned: 10,
    frequency: '3x per week',
    billingType: 'per_session' as 'per_session' | 'package',
    instructions: '',
  });

  // Keys MUST match the specialtyMap in the dropdown onChange handler exactly
  const [specialtyReferrals, setSpecialtyReferrals] = useState<
    Record<
      string,
      {
        selected: boolean;
        reason: string;
        urgency: 'Routine' | 'Urgent' | 'Emergency';
        referralType: 'internal' | 'external';
        externalFacility: string;
        externalDoctor: string;
        clinicalFindings: string;
        provisionalDiagnosis: string;
      }
    >
  >({
    dental: { ...defaultRef },
    ophthalmology: { ...defaultRef },
    physiotherapy: { ...defaultRef },
    surgery: { ...defaultRef },
    ent: { ...defaultRef },
    cardiology: { ...defaultRef },
    orthopaedics: { ...defaultRef },
    neurology: { ...defaultRef },
    neuropsychiatry: { ...defaultRef },
    gynaecology: { ...defaultRef },
    paediatrics: { ...defaultRef },
    dermatology: { ...defaultRef },
    pulmonology: { ...defaultRef },
    urology: { ...defaultRef },
    nephrology: { ...defaultRef },
    gastroenterology: { ...defaultRef },
    neurosurgery: { ...defaultRef },
    general_surgery: { ...defaultRef },
    oral_maxillofacial: { ...defaultRef },
    endocrinology: { ...defaultRef },
    plastic_surgery: { ...defaultRef },
    nutrition: { ...defaultRef },
  });

  // External NHIS Referral state - for referring patient to ANOTHER HOSPITAL outside NDC
  const [externalNhisReferral, setExternalNhisReferral] = useState<{
    enabled: boolean;
    facilityName: string;
    facilityAddress: string;
    doctorName: string;
    reason: string;
    clinicalFindings: string;
    investigationFindings: string;
    provisionalDiagnosis: string;
    urgency: 'Routine' | 'Urgent' | 'Emergency';
  }>({
    enabled: false,
    facilityName: '',
    facilityAddress: '',
    doctorName: '',
    reason: '',
    clinicalFindings: '',
    investigationFindings: '',
    provisionalDiagnosis: '',
    urgency: 'Routine',
  });

  useEffect(() => {
    if (!isNhisFeatureEnabled() && externalNhisReferral.enabled) {
      setExternalNhisReferral((prev) => ({ ...prev, enabled: false }));
    }
  }, [externalNhisReferral.enabled]);

  // Count active specialty referrals
  const specialtyReferralCount = Object.values(specialtyReferrals).filter(
    (r) => r?.selected,
  ).length;

  const draftStorageKey = useMemo(() => {
    const patientKey =
      selectedPatient?.patient_id ||
      preselectedPatient?.patient_id ||
      'unassigned';
    const encounterKey =
      selectedEncounter?.visit_id || encounterId || visitId || 'new';
    return `${CONSULTATION_FORM_STORAGE_PREFIX}${patientKey}_${encounterKey}`;
  }, [
    selectedPatient?.patient_id,
    preselectedPatient?.patient_id,
    selectedEncounter?.visit_id,
    encounterId,
    visitId,
  ]);
  const {
    restoreDraft: restorePersistedDraft,
    saveDraft: savePersistedDraft,
    clearDraft: clearPersistedDraft,
  } = useWorkflowDraftPersistence<ConsultationWizardDraft>(draftStorageKey);

  // Catalogues
  const { data: labTests } = useLabTestCatalogue();
  const { data: imagingTypes, isLoading: isLoadingImaging } = useImagingCatalogue();
  const { data: drugs } = useDrugCatalogue();
  const { data: procedures } = useProcedureCatalogue();
  const { data: wards } = useWardsCatalogue();

  // Transform catalogues
  const labTestOptions: SearchableOption[] = useMemo(
    () =>
      (labTests || []).map((test) => ({
        id: test.test_id,
        name: test.test_name,
        code: test.test_code,
        category: test.category ?? undefined,
        subCategory: test.sample_type ?? undefined,
        price: test.price,
        requiresNhisAuth: (test as any).requires_nhis_authorization || false,
      })),
    [labTests],
  );

  const imagingOptions: SearchableOption[] = useMemo(
    () =>
      (imagingTypes || []).map((scan) => ({
        id: scan.imaging_id,
        name: scan.imaging_name,
        code: scan.imaging_code,
        category: scan.imaging_type,
        extraInfo: scan.body_part ?? undefined,
        price: scan.price,
        requiresNhisAuth: (scan as any).requires_nhis_authorization || false,
      })),
    [imagingTypes],
  );

  const drugOptions: SearchableOption[] = useMemo(
    () =>
      (drugs || []).map((drug) => ({
        id: drug.drug_id,
        name: drug.drug_name,
        code: drug.drug_code ?? undefined,
        category: drug.category ?? undefined,
        subCategory: drug.drug_type ?? undefined,
        price: drug.nhis_price || drug.selling_price || drug.price || undefined,
        extraInfo: drug.strength ?? drug.strengths ?? undefined,
        requiresNhisAuth: (drug as any).requires_nhis_authorization || false,
      })),
    [drugs],
  );

  const procedureOptions: SearchableOption[] = useMemo(
    () =>
      (procedures || []).map((proc) => ({
        id: proc.procedure_id,
        name: proc.procedure_name,
        code: proc.procedure_code ?? undefined,
        category: proc.procedure_type ?? undefined,
        price: proc.price || 0,
        requiresNhisAuth: (proc as any).requires_nhis_authorization || false,
      })),
    [procedures],
  );

  const wardOptions: SearchableOption[] = useMemo(
    () =>
      (wards || []).map((ward) => ({
        id: ward.ward_id,
        name: ward.ward_name,
        category: ward.ward_type ?? undefined,
        extraInfo: `${ward.available_beds}/${ward.total_beds} beds available`,
        price: ward.daily_rate || 0,
      })),
    [wards],
  );

  // Patient search
  const debouncedSearch = useDebounce(patientSearch, 500);
  const { data: searchResults, isLoading: isSearching } =
    usePatientSearch(debouncedSearch);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      const defaultVisitId = visitId || '';
      const defaultEncounterId = encounterId || visitId || '';

      if (preselectedPatient) {
        setSelectedPatient(preselectedPatient);
        setFormData((prev) => ({
          ...prev,
          patient_id: preselectedPatient.patient_id,
          visit_id: defaultVisitId,
          encounter_id: defaultEncounterId,
        }));
        // Go to Patient Review page (step 0) when patient is pre-selected
        setCurrentStep(0);
        setCompletedSteps(new Set(['review']));
      } else {
        setSelectedPatient(null);
        setFormData({
          patient_id: '',
          visit_id: defaultVisitId,
          encounter_id: defaultEncounterId,
          complaints: '',
          clinical_notes: '',
          history_of_present_illness: '',
          past_medical_history: '',
          family_history: '',
          social_history: '',
          review_of_systems: '',
          examination_findings: '',
          physical_examination: '',
          diagnosis: '',
          differential_diagnosis: [],
          treatment_plan: '',
          recommendations: '',
          follow_up_date: '',
          follow_up_notes: '',
        });
        setCurrentStep(0);
        setCompletedSteps(new Set());
      }

      setLabOrders([]);
      setRadiologyOrders([]);
      setPrescriptions([]);
      setSelectedDiagnoses([]);
      setSelectedComplaints([]);
      setTreatmentTasks([]);
      setShowAddTask(false);
      setNewTask({
        task_type: 'Other',
        title: '',
        description: '',
        instructions: '',
        priority: 'Normal',
      });
      setErrors({});
      // Reset encounter state
      setSelectedEncounter(null);
      setPatientEncounters([]);
      setEncounterError(undefined);
      setHasRestoredDraft(false);
    }
  }, [isOpen, preselectedPatient, visitId, encounterId]);

  useEffect(() => {
    if (!isOpen || hasRestoredDraft || !draftStorageKey) return;
    let mounted = true;

    const restoreDraft = async (): Promise<void> => {
      const draft = await restorePersistedDraft();
      if (!mounted) return;

      if (!draft) {
        setHasRestoredDraft(true);
        return;
      }

      setCurrentStep(draft.currentStep);
      setCompletedSteps(new Set(draft.completedSteps || []));
      setSelectedPatient(draft.selectedPatient || null);
      setSelectedEncounter(draft.selectedEncounter || null);
      setFormData(draft.formData);
      setSelectedDiagnoses(draft.selectedDiagnoses || []);
      setSelectedComplaints(draft.selectedComplaints || []);
      setLabOrders(draft.labOrders || []);
      setRadiologyOrders(draft.radiologyOrders || []);
      setPrescriptions(draft.prescriptions || []);
      setProcedureOrders(draft.procedureOrders || []);
      setAdmissionOrder(draft.admissionOrder || null);
      setTreatmentTasks(draft.treatmentTasks || []);
      setSpecialtyReferrals(draft.specialtyReferrals || {});
      setExternalNhisReferral(
        (draft.externalNhisReferral as any) || {
          enabled: false,
          facilityName: '',
          facilityAddress: '',
          doctorName: '',
          reason: '',
          clinicalFindings: '',
          investigationFindings: '',
          provisionalDiagnosis: '',
          urgency: 'Routine',
        },
      );
      setPhysioTreatmentPlanOrder(
        draft.physioTreatmentPlanOrder || {
          sessionsPlanned: 10,
          frequency: '3x per week',
          billingType: 'per_session',
          instructions: '',
        },
      );

      showToast({
        type: 'info',
        title: 'Draft Restored',
        message: 'Previous consultation draft was restored automatically.',
      });
      setHasRestoredDraft(true);
    };

    void restoreDraft();

    return () => {
      mounted = false;
    };
  }, [
    draftStorageKey,
    hasRestoredDraft,
    isOpen,
    restorePersistedDraft,
    showToast,
  ]);

  useEffect(() => {
    if (!isOpen || !hasRestoredDraft || !draftStorageKey || !selectedPatient)
      return;

    const timer = setTimeout(() => {
      const draft: ConsultationWizardDraft = {
        savedAt: Date.now(),
        currentStep,
        completedSteps: Array.from(completedSteps),
        selectedPatient,
        selectedEncounter,
        formData,
        selectedDiagnoses,
        selectedComplaints,
        labOrders,
        radiologyOrders,
        prescriptions,
        procedureOrders,
        admissionOrder,
        treatmentTasks,
        specialtyReferrals,
        externalNhisReferral,
        physioTreatmentPlanOrder,
      };
      void savePersistedDraft(draft);
    }, 3000); // 3s debounce to reduce localStorage writes

    return () => clearTimeout(timer);
  }, [
    isOpen,
    hasRestoredDraft,
    draftStorageKey,
    selectedPatient,
    currentStep,
    completedSteps,
    selectedEncounter,
    formData,
    selectedDiagnoses,
    selectedComplaints,
    labOrders,
    radiologyOrders,
    prescriptions,
    procedureOrders,
    admissionOrder,
    treatmentTasks,
    specialtyReferrals,
    externalNhisReferral,
    physioTreatmentPlanOrder,
    savePersistedDraft,
  ]);

  // Fetch patient encounters when patient is selected
  useEffect(() => {
    // Helper: enrich encounter_summary rows with clinic_name from visits table
    async function enrichWithClinic(encounters: any[]): Promise<any[]> {
      if (encounters.length === 0) return encounters;
      const ids = encounters.map((e) => e.encounter_id).filter(Boolean);
      if (ids.length === 0) return encounters;
      const { data: visits } = await supabase
        .from('visits')
        .select('id, clinic:clinics!visits_clinic_id_fkey(clinic_name)')
        .in('id', ids);
      if (!visits) return encounters;
      const clinicMap = new Map(
        visits.map((v: any) => [v.id, v.clinic?.clinic_name]),
      );
      return encounters.map((e) => ({
        ...e,
        clinic: { clinic_name: clinicMap.get(e.encounter_id) || '' },
      }));
    }

    async function fetchPatientEncounters() {
      if (!selectedPatient) {
        setPatientEncounters([]);
        setSelectedEncounter(null);
        setEncounterError(undefined);
        return;
      }

      setIsLoadingEncounter(true);
      setEncounterError(undefined);

      try {
        // encounter_summary.patient_id is UUID (patients.id), not the display patient_id
        const patientUuid = selectedPatient.id;

        // Fetch all encounters for this patient
        const { data, error } = await supabase
          .from('encounter_summary')
          .select('*')
          .eq('patient_id', patientUuid)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const allEncounters = await enrichWithClinic(data || []);

        if (allEncounters.length === 0) {
          setEncounterError(
            'No encounters found. Please create a new encounter.',
          );
          setPatientEncounters([]);
          return;
        }

        setPatientEncounters(allEncounters);

        // Auto-select:
        // 1. First "Active" encounter
        // 2. Or failing that, the most recent encounter (even if completed)
        const activeEncounter = allEncounters.find(
          (e) => e.status === 'Active',
        );
        const mostRecent = allEncounters[0];

        const toSelect = activeEncounter || mostRecent;

        if (toSelect) {
          setSelectedEncounter(toSelect);
          setFormData((prev) => ({
            ...prev,
            visit_id: toSelect.visit_id,
            encounter_id: toSelect.visit_id, // Assuming visit_id is the encounter identifier
          }));
        }
      } catch (err) {
        console.error('Error in fetchPatientEncounters:', err);
        setEncounterError('Failed to load encounters.');
      } finally {
        setIsLoadingEncounter(false);
      }
    }

    // Only fetch if patient was selected from search (not preselected from queue)
    if (selectedPatient && !encounterId) {
      fetchPatientEncounters();
    } else if (encounterId && selectedPatient) {
      // If encounterId is provided (from queue), fetch that specific encounter
      setIsLoadingEncounter(true);
      supabase
        .from('encounter_summary')
        .select('*')
        .eq('visit_id', encounterId)
        .maybeSingle()
        .then(async ({ data, error }) => {
          if (data) {
            const enriched = await enrichWithClinic([data]);
            setSelectedEncounter(enriched[0]);
            setPatientEncounters(enriched);
          }
          setIsLoadingEncounter(false);
        });
    }
  }, [selectedPatient, encounterId]);

  // Handle encounter selection
  const handleSelectEncounter = useCallback(
    (encounter: EncounterSummary | null) => {
      setSelectedEncounter(encounter);
      if (encounter) {
        setFormData((prev) => ({
          ...prev,
          visit_id: encounter.visit_id,
          encounter_id: encounter.visit_id,
        }));
        setEncounterError(undefined);
      }
    },
    [],
  );

  // Handlers
  const handleSelectPatient = (patient: PatientDTO) => {
    setSelectedPatient(patient);
    setFormData((prev) => ({ ...prev, patient_id: patient.patient_id }));
    setPatientSearch('');
    setErrors((prev) => {
      const { patient_id, ...rest } = prev;
      return rest;
    });
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setFormData((prev) => ({
      ...prev,
      patient_id: '',
      visit_id: '',
      encounter_id: '',
    }));
    setSelectedEncounter(null);
    setPatientEncounters([]);
    setEncounterError(undefined);
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const applyConsultationTemplate = (payload: {
    fields: Partial<CreateConsultationDTO>;
    selectedComplaints?: SelectedComplaint[];
    selectedDiagnoses?: ICDMultiSelectDiagnosis[];
    specialtyFormData?: Record<string, unknown>;
  }) => {
    if (payload.selectedComplaints) {
      setSelectedComplaints(payload.selectedComplaints);
    }
    if (payload.selectedDiagnoses) {
      setSelectedDiagnoses(payload.selectedDiagnoses);
      const diagnosisText = payload.selectedDiagnoses
        .map(
          (diagnosis) =>
            `${diagnosis.code.startsWith('CUSTOM') ? '' : `${diagnosis.code} - `}${diagnosis.title}`,
        )
        .join('; ');
      setFormData((prev) => ({
        ...prev,
        ...payload.fields,
        diagnosis: diagnosisText,
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, ...payload.fields }));
  };

  // Step validation - Only patient selection is required, other steps are optional
  const validateCurrentStep = useCallback((): boolean => {
    const step = STEPS[currentStep];
    const newErrors: Record<string, string> = {};

    switch (step.id) {
      case 'review':
        if (!selectedPatient) {
          newErrors.patient_id = 'Please select a patient';
        }
        break;
      // All other steps are optional - doctors can skip them
      case 'complaints':
      case 'history':
      case 'examination':
      case 'diagnosis':
      case 'orders':
      case 'review-submit':
        // No validation required - these are optional
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, selectedPatient]);

  // Navigation with smooth transitions
  const goToStep = (index: number) => {
    // Allow going back freely, but validate going forward
    if (index > currentStep) {
      if (!validateCurrentStep()) return;
    }

    // Set transition direction
    setTransitionDirection(index > currentStep ? 'right' : 'left');
    setIsTransitioning(true);

    // Mark current step as completed if moving forward
    if (index > currentStep) {
      setCompletedSteps((prev) => new Set([...prev, STEPS[currentStep].id]));
    }

    // Small delay for exit animation, then change step
    setTimeout(() => {
      setCurrentStep(index);
      // Reset transition state after enter animation
      setTimeout(() => setIsTransitioning(false), 150);
    }, 50);
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  // Submit
  const handleSubmit = async () => {
    // Only patient is required - all other fields are optional
    if (!selectedPatient) {
      setErrors({ patient_id: 'Patient is required' });
      setCurrentStep(0);
      return;
    }

    // Build complaints text (optional)
    const complaintsText =
      selectedComplaints.length > 0
        ? selectedComplaints
            .map((c) => {
              const durationStr = `${c.duration_value} ${c.duration_unit.toLowerCase()}`;
              return `${c.complaint_name} (${durationStr})${c.is_primary ? ' [PRIMARY]' : ''}`;
            })
            .join('; ')
        : '';

    // Build diagnosis text (optional)
    const diagnosisText =
      selectedDiagnoses.length > 0
        ? selectedDiagnoses
            .map(
              (d) =>
                `${d.code.startsWith('CUSTOM') ? '' : `${d.code} - `}${d.title}`,
            )
            .join('; ')
        : '';

    const submissionData: CreateConsultationDTO = {
      ...formData,
      complaints: complaintsText,
      diagnosis: diagnosisText,
      chief_complaints_structured: selectedComplaints,
    } as any;

    // Build specialty referrals array - INTERNAL ONLY (within XenoCare)
    const referrals: SpecialtyReferralDTO[] = [];
    // Dynamically build referrals from all selected specialties
    Object.entries(specialtyReferrals).forEach(([key, ref]) => {
      if (ref?.selected && ref.reason?.trim()) {
        const dto: SpecialtyReferralDTO = {
          specialty: key.charAt(0).toUpperCase() + key.slice(1),
          reason: ref.reason.trim(),
          urgency: ref.urgency,
          referralType: 'internal',
        };
        // Attach treatment plan data for physiotherapy referrals
        if (key === 'physiotherapy') {
          dto.physioSessionsPlanned = physioTreatmentPlanOrder.sessionsPlanned;
          dto.physioFrequency = physioTreatmentPlanOrder.frequency;
          dto.physioBillingType = physioTreatmentPlanOrder.billingType;
          dto.physioInstructions =
            physioTreatmentPlanOrder.instructions || undefined;
        }
        referrals.push(dto);
      }
    });

    // Build external NHIS referral DTO if enabled
    const externalReferralDto: ExternalNhisReferralDTO | null =
      isNhisFeatureEnabled() &&
      externalNhisReferral.enabled &&
      externalNhisReferral.facilityName.trim() &&
      externalNhisReferral.reason.trim()
        ? {
            facilityName: externalNhisReferral.facilityName.trim(),
            facilityAddress:
              externalNhisReferral.facilityAddress.trim() || undefined,
            doctorName: externalNhisReferral.doctorName.trim() || undefined,
            reason: externalNhisReferral.reason.trim(),
            clinicalFindings: externalNhisReferral.clinicalFindings.trim(),
            investigationFindings:
              externalNhisReferral.investigationFindings.trim() || undefined,
            provisionalDiagnosis:
              externalNhisReferral.provisionalDiagnosis.trim(),
            urgency: externalNhisReferral.urgency,
          }
        : null;

    // Let the parent component handle the submission logic, including try/catch and notifications
    await onSubmit(
      submissionData,
      labOrders,
      radiologyOrders,
      prescriptions,
      procedureOrders,
      admissionOrder,
      treatmentTasks,
      referrals.length > 0 ? referrals : undefined,
      externalReferralDto,
    );

    await clearPersistedDraft();
  };

  if (!isOpen) return null;

  const currentStepData = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className={`fixed inset-0 flex items-center justify-center ${isMaximized ? 'p-0' : 'p-4'}`}
      >
        <div
          className={`relative bg-white shadow-2xl w-full overflow-hidden flex flex-col transition-all duration-200 ${
            isMaximized
              ? 'max-w-none h-full rounded-none'
              : 'max-w-5xl h-[95vh] rounded-2xl'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between bg-white border-b border-gray-200 px-5 py-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-700/10">
                <Stethoscope className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h1 className="text-gray-900 font-bold text-lg leading-none">
                  Clinical Consultation
                </h1>
                <p className="text-gray-500 text-xs mt-1 leading-none">
                  Step {currentStep + 1} of {STEPS.length}:{' '}
                  {currentStepData.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ConsultationTemplatePopover
                formData={formData}
                selectedComplaints={selectedComplaints}
                selectedDiagnoses={selectedDiagnoses}
                onApply={applyConsultationTemplate}
              />
              {/* Toggle AI Assistant */}
              <button
                onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
                className={`p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex items-center gap-1.5 ${isAIPanelOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
                title={
                  isAIPanelOpen ? 'Hide AI Assistant' : 'Show AI Assistant'
                }
              >
                <Bot className="h-5 w-5" />
                <span className="text-xs font-medium">AI</span>
              </button>
              {/* Toggle History View */}
              {selectedPatient && (
                <button
                  onClick={() => setIsHistorySidebarOpen(!isHistorySidebarOpen)}
                  className={`p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:block ${isHistorySidebarOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
                  title={
                    isHistorySidebarOpen
                      ? 'Maximize Note (Hide History)'
                      : 'Split View (Show History)'
                  }
                >
                  <PanelRight className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                title={isMaximized ? 'Restore window' : 'Maximize window'}
              >
                {isMaximized ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">

          {/* Horizontal Steps at Top */}
          <ProgressIndicator
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={goToStep}
            onNext={goNext}
            onPrev={goBack}
            isLastStep={currentStep === STEPS.length - 1}
          />

          {/* Main Layout - Vitals Sidebar & Content */}
          <div className="flex min-h-0">
            {/* Resizable Vitals Sidebar - Left Side */}
            {selectedPatient && currentStep > 0 && (
              <div
                className="hidden lg:flex flex-col bg-white border-r border-gray-200 flex-shrink-0 overflow-hidden relative"
                style={{ width: isVitalsCollapsed ? 40 : vitalsSidebarWidth }}
              >
                {/* Collapsed State */}
                {isVitalsCollapsed ? (
                  <button
                    onClick={() => setIsVitalsCollapsed(false)}
                    className="flex-1 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                    title="Expand Vitals Panel"
                  >
                    <Activity className="h-4 w-4 text-rose-600" />
                    <span
                      className="text-[9px] font-bold text-slate-600 uppercase tracking-wider writing-mode-vertical"
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                      }}
                    >
                      Vitals
                    </span>
                    <ChevronsRight className="h-4 w-4 text-slate-400" />
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-white">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-rose-100 rounded-lg">
                          <Activity className="h-3.5 w-3.5 text-rose-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Vitals
                        </h3>
                        <span className="text-[8px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 animate-pulse">
                          LIVE
                        </span>
                      </div>
                      <button
                        onClick={() => setIsVitalsCollapsed(true)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Collapse Vitals Panel"
                      >
                        <ChevronsLeft className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      <PatientVitalsSummary
                        patientId={selectedPatient.patient_id}
                        hideNursingNotes={false}
                        compact
                        className=""
                      />
                    </div>
                    {/* Resize Handle */}
                    <div
                      className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-10 ${isResizing ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-300'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                        const startX = e.clientX;
                        const startWidth = vitalsSidebarWidth;

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const delta = moveEvent.clientX - startX;
                          const newWidth = Math.min(
                            Math.max(startWidth + delta, 160),
                            350,
                          );
                          setVitalsSidebarWidth(newWidth);
                        };

                        const handleMouseUp = () => {
                          setIsResizing(false);
                          document.removeEventListener(
                            'mousemove',
                            handleMouseMove,
                          );
                          document.removeEventListener(
                            'mouseup',
                            handleMouseUp,
                          );
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      title="Drag to resize"
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 right-0 w-1.5 h-8 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <GripVertical className="h-4 w-4 text-blue-500" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50/50 relative">
              {/* Content Area */}
              <div className="flex-1 p-4 md:p-5 relative z-10">
                <div className="w-full pb-16">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-gray-900">
                      {currentStepData.title}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {currentStepData.description}
                    </p>
                  </div>

                  <div
                    className={`transition-all duration-150 ease-out bg-white rounded-lg shadow-sm border border-gray-200 p-5 min-h-[350px] ${
                      isTransitioning
                        ? transitionDirection === 'right'
                          ? 'opacity-0 translate-x-8'
                          : 'opacity-0 -translate-x-8'
                        : 'opacity-100 translate-x-0'
                    }`}
                  >
                    {STEPS[currentStep].id === 'review' && (
                      <ReviewStep
                        selectedPatient={selectedPatient}
                        onSelectPatient={handleSelectPatient}
                        onClearPatient={handleClearPatient}
                        patientSearch={patientSearch}
                        onPatientSearchChange={setPatientSearch}
                        searchResults={searchResults}
                        isSearching={isSearching}
                        error={errors.patient_id}
                        selectedEncounter={selectedEncounter}
                        onSelectEncounter={handleSelectEncounter}
                        encounterError={encounterError}
                        isLoadingEncounter={isLoadingEncounter}
                        patientEncounters={patientEncounters}
                      />
                    )}

                    {STEPS[currentStep].id === 'antenatal' && (
                      <div className="space-y-4">
                        <AncDoctorEncounterAdapter
                          encounterId={
                            selectedEncounter?.encounter_id || encounterId || ''
                          }
                        />
                      </div>
                    )}

                    {STEPS[currentStep].id === 'complaints' && (
                      <ComplaintsStep
                        selectedComplaints={selectedComplaints}
                        onComplaintsChange={setSelectedComplaints}
                        error={errors.complaints}
                        disabled={isLoading}
                      />
                    )}

                    {STEPS[currentStep].id === 'history' && (
                      <HistoryStep
                        formData={formData}
                        onChange={handleFieldChange}
                      />
                    )}

                    {STEPS[currentStep].id === 'examination' && (
                      <ExaminationStep
                        formData={formData}
                        onChange={handleFieldChange}
                      />
                    )}

                    {STEPS[currentStep].id === 'diagnosis' && (
                      <DiagnosisStep
                        selectedDiagnoses={selectedDiagnoses}
                        onDiagnosesChange={(diagnoses) => {
                          setSelectedDiagnoses(diagnoses);
                          const text = diagnoses
                            .map(
                              (d) =>
                                `${d.code.startsWith('CUSTOM') ? '' : `${d.code} - `}${d.title}`,
                            )
                            .join('; ');
                          setFormData((prev) => ({ ...prev, diagnosis: text }));
                        }}
                        formData={formData}
                        onChange={handleFieldChange}
                        disabled={isLoading}
                      />
                    )}

                    {STEPS[currentStep].id === 'orders' && (
                      <OrdersStep
                        selectedPatient={selectedPatient}
                        labOrders={labOrders}
                        radiologyOrders={radiologyOrders}
                        prescriptions={prescriptions}
                        procedureOrders={procedureOrders}
                        admissionOrder={admissionOrder}
                        onLabOrdersChange={setLabOrders}
                        onRadiologyOrdersChange={setRadiologyOrders}
                        onPrescriptionsChange={setPrescriptions}
                        onProcedureOrdersChange={setProcedureOrders}
                        onAdmissionOrderChange={setAdmissionOrder}
                        treatmentTasks={treatmentTasks}
                        onTreatmentTasksChange={setTreatmentTasks}
                        showAddTask={showAddTask}
                        setShowAddTask={setShowAddTask}
                        newTask={newTask}
                        setNewTask={setNewTask}
                        labTestOptions={labTestOptions}
                        imagingOptions={imagingOptions}
                        isLoadingImaging={isLoadingImaging}
                        drugOptions={drugOptions}
                        procedureOptions={procedureOptions}
                        wardOptions={wardOptions}
                        formData={formData}
                        onChange={handleFieldChange}
                        specialtyReferrals={specialtyReferrals}
                        onSpecialtyReferralsChange={setSpecialtyReferrals}
                        selectedDiagnoses={selectedDiagnoses}
                        externalNhisReferral={externalNhisReferral}
                        setExternalNhisReferral={setExternalNhisReferral}
                        physioTreatmentPlanOrder={physioTreatmentPlanOrder}
                        setPhysioTreatmentPlanOrder={
                          setPhysioTreatmentPlanOrder
                        }
                      />
                    )}

                    {STEPS[currentStep].id === 'review-submit' && (
                      <ReviewSubmitStep
                        selectedPatient={selectedPatient}
                        selectedComplaints={selectedComplaints}
                        formData={formData}
                        selectedDiagnoses={selectedDiagnoses}
                        labOrders={labOrders}
                        radiologyOrders={radiologyOrders}
                        prescriptions={prescriptions}
                        procedureOrders={procedureOrders}
                        admissionOrder={admissionOrder}
                        treatmentTasks={treatmentTasks}
                        specialtyReferrals={specialtyReferrals}
                        drugOptions={drugOptions}
                        labTestOptions={labTestOptions}
                        imagingOptions={imagingOptions}
                        procedureOptions={procedureOptions}
                        wardOptions={wardOptions}
                        onEditStep={(stepIndex) => setCurrentStep(stepIndex)}
                        // Setters for inline editing
                        setFormData={setFormData}
                        setSelectedComplaints={setSelectedComplaints}
                        setSelectedDiagnoses={setSelectedDiagnoses}
                        setLabOrders={setLabOrders}
                        setRadiologyOrders={setRadiologyOrders}
                        setPrescriptions={setPrescriptions}
                        setProcedureOrders={setProcedureOrders}
                        setAdmissionOrder={setAdmissionOrder}
                        setTreatmentTasks={setTreatmentTasks}
                        setSpecialtyReferrals={setSpecialtyReferrals}
                      />
                    )}
                  </div>

                  {/* Footer inside scrollable content */}
                  <div className="mt-6 flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={goBack}
                      disabled={currentStep === 0 || isLoading}
                    >
                      <ChevronLeft size={18} className="mr-1" />
                      Back
                    </Button>

                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>

                      {isLastStep ? (
                        <Button
                          variant="primary"
                          onClick={handleSubmit}
                          disabled={isLoading}
                          className="bg-primary-700 hover:bg-primary-800"
                        >
                          {isLoading ? (
                            <>
                              <Loader2
                                size={18}
                                className="mr-2 animate-spin"
                              />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={18} className="mr-2" />
                              Complete Consultation
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={goNext}
                          disabled={isLoading}
                          className="bg-primary-700 hover:bg-primary-800"
                        >
                          Continue
                          <ChevronRight size={18} className="ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar - Patient History */}
            {selectedPatient &&
              (isHistorySidebarOpen ? (
                <InlinePatientHistorySidebar
                  patientId={
                    selectedPatient.id || selectedPatient.patient_id || ''
                  }
                  isOpen={isHistorySidebarOpen}
                  onClose={() => setIsHistorySidebarOpen(false)}
                  width={historySidebarWidth}
                  onResize={(delta) => {
                    setHistorySidebarWidth((prev) =>
                      Math.min(Math.max(prev + delta, 280), 650),
                    );
                  }}
                  onSetWidth={(w) => setHistorySidebarWidth(w)}
                />
              ) : (
                <div
                  className="bg-white border-l border-gray-200 py-4 flex flex-col items-center gap-4 w-10 flex-shrink-0 cursor-pointer hover:bg-gray-50 transition-colors z-20"
                  onClick={() => setIsHistorySidebarOpen(true)}
                  title="Open History"
                >
                  <div className="p-1.5 bg-gray-100 rounded-lg text-gray-400 hover:text-green-600 transition-colors mt-2 ring-1 ring-gray-200">
                    <ChevronsLeft size={14} />
                  </div>
                  <div className="flex-1 flex items-center justify-center py-4">
                    <span
                      className="text-xs font-bold text-gray-400 tracking-widest uppercase rotate-180 whitespace-nowrap"
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                      }}
                    >
                      History
                    </span>
                  </div>
                </div>
              ))}
          </div>
          </div>
        </div>
      </div>

      {/* AI Assistant Slide-over */}
      {isAIPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={() => setIsAIPanelOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-[61] w-full max-w-4xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-primary-700 to-primary-600 text-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-white rounded-lg p-1.5 shadow flex-shrink-0">
                  
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-semibold truncate">
                    XenoCare AI Assistants
                  </span>
                  {selectedPatient && (
                    <span className="block text-[11px] text-white/85 truncate">
                      {`${selectedPatient.first_name || ''} ${selectedPatient.surname || ''}`.trim()}{' '}
                      •{' '}
                      {selectedPatient.emr_number || selectedPatient.patient_id}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsAIPanelOpen(false)}
                className="p-1.5 rounded-md hover:bg-white/15 transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0">
              <AIChatPanel
                patientId={
                  selectedPatient?.id || selectedPatient?.patient_id || null
                }
                patientName={
                  selectedPatient
                    ? `${selectedPatient.first_name || ''} ${selectedPatient.surname || ''}`.trim()
                    : undefined
                }
                emrNumber={selectedPatient?.emr_number ?? undefined}
                facilityId={staff?.facility_id ?? ''}
                userId={staff?.id ?? ''}
                chiefComplaint={
                  formData.complaints ||
                  selectedComplaints.map((c) => c.complaint_name).join(', ') ||
                  undefined
                }
                consultationData={
                  formData as unknown as Record<string, unknown>
                }
                existingCodes={selectedDiagnoses.map((d) => d.code)}
                department="OPD Consultation"
                variant="minimal"
                className="h-full"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
