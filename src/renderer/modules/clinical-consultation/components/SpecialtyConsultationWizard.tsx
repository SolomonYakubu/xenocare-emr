/**
 * =============================================================================
 * XENOCARE EMR - SPECIALTY CONSULTATION WIZARD
 *
 * A specialized consultation wizard for SOPD (Specialty OPD) clinics.
 * Mimics the standard ConsultationWizard structure but uses template-driven
 * specialty-specific examination forms instead of generic fields.
 *
 * SOAP Methodology:
 * - Subjective: Patient Review, Chief Complaints, Clinical History
 * - Objective: Vitals, Specialty Examination (TEMPLATE-DRIVEN)
 * - Assessment: Diagnosis
 * - Plan: Orders (Labs, Imaging, Prescriptions, Procedures, Referrals)
 * =============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { isNhisFeatureEnabled } from '../../../config/features';
import PatientAllergySummary from '../../../components/shared/PatientAllergySummary';
import {
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Check,
  User,
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
  Clock,
  Search,
  Plus,
  Minus,
  CheckCircle2,
  Circle,
  Loader2,
  Eye,
  Edit3,
  Bed,
  Scissors,
  ListTodo,
  RefreshCw,
  Send,
  ArrowLeftCircle,
  ArrowRightCircle,
  Sparkles,
  Share2,
  Trash2,
  Building,
  ExternalLink,
  Smile,
  Dumbbell,
  Bot,
  Calculator,
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
  CreateConsultationDTO,
  LabOrderDTO,
  RadiologyOrderDTO,
  PrescriptionOrderDTO,
  ProcedureOrderDTO,
  AdmissionOrderDTO,
} from '../dtos/consultation.dto';
import {
  SpecialtyTemplate,
  SpecialtyTemplateSection,
  SpecialtyFormData,
  SpecialtySubmissionData,
  SPECIALTY_COLORS,
} from '../dtos/specialty-template.dto';
import { SpecialtyExaminationRenderer } from './SpecialtyExaminationRenderer';
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
import {
  ClinicTriageDisplay,
  ClinicalScoreCalculator,
  ConsultationPatientContextBar,
  OrderSetSelector,
} from '../../specialty-common';
import { getScoresForSpecialty } from '../../specialty-common/constants/clinical-scores';
import type { ScoreResult } from '../../specialty-common/dtos/specialty-clinic.dto';
import UniversalExamShell, {
  type VisitMode,
} from '../../specialty-common/components/UniversalExamShell';
import SafetyAlertBanner from '../../neuropsychiatry/components/SafetyAlertBanner';
import {
  getCarePlanConfig,
  type SpecialtyCarePlanConfig,
} from '../../specialty-common/constants/care-plans';
import { useToast } from '../../../components/ui/Toast';
import PatientVitalsSummary from './PatientVitalsSummary';
import { ICDMultiSelect, ICDMultiSelectDiagnosis } from './ICDDiagnosisSearch';
import ChiefComplaintsSection, {
  SelectedComplaint,
} from './ChiefComplaintsSection';
import { useWorkflowDraftPersistence } from '../hooks/useWorkflowDraftPersistence';
import {
  CreateTreatmentTaskDTO,
  TREATMENT_TASK_TYPES,
  TreatmentTaskType,
} from '../../treatment-plan/dtos/treatment-plan.dto';
import { EncounterSummary } from '../../../lib/encounter';
import { supabase } from '../../../api/supabaseClient';
import {
  SpecialtyReferralDTO,
  ExternalNhisReferralDTO,
} from './ConsultationWizard';
import { useAuth } from '../../../contexts/AuthContext';
import { AIChatPanel } from '../../ai-assistant/components/AIChatPanel';
import { AIConsultationReview } from '../../ai-assistant/components/AIConsultationReview';
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

// =============================================================================
// Types
// =============================================================================

interface SpecialtyConsultationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateConsultationDTO,
    specialtyData: SpecialtySubmissionData | null,
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
  specialtyCode: string;
  specialtyName: string;
  template: SpecialtyTemplate | null;
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
// Step Configuration - SOAP Methodology with Specialty Focus
// =============================================================================

const STEPS: Step[] = [
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
    id: 'specialty-exam',
    title: 'Specialty Examination',
    shortTitle: 'Specialty Exam',
    icon: <Sparkles size={12} />,
    description: 'Specialty-specific examination',
    category: 'objective',
  },
  {
    id: 'diagnosis',
    title: 'Diagnosis',
    shortTitle: 'Diagnosis',
    icon: <ClipboardList size={12} />,
    description: 'Assessment & diagnosis',
    category: 'assessment',
  },
  {
    id: 'orders',
    title: 'Orders & Plan',
    shortTitle: 'Orders',
    icon: <ListTodo size={12} />,
    description: 'Labs, imaging, prescriptions',
    category: 'plan',
  },
  {
    id: 'review-submit',
    title: 'Review & Submit',
    shortTitle: 'Submit',
    icon: <CheckCircle2 size={12} />,
    description: 'Final review and submission',
    category: 'review',
  },
];

// =============================================================================
// SOAP Category Colors
// =============================================================================

const SOAP_COLORS = {
  subjective: 'text-blue-700 bg-blue-100 border-blue-300',
  objective: 'text-green-700 bg-green-100 border-green-300',
  assessment: 'text-purple-700 bg-purple-100 border-purple-300',
  plan: 'text-orange-700 bg-orange-100 border-orange-300',
  review: 'text-slate-700 bg-slate-100 border-slate-300',
};

// =============================================================================
// Shared Interactive UI Helpers
// =============================================================================

/** Chip-based single-select for short option lists — replaces raw <select> */
function SpecChipField({
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
// Progress Bar Component
// =============================================================================

interface ProgressBarProps {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (index: number) => void;
  onNext: () => void;
  onPrev: () => void;
  specialtyColor?: string;
}

function ProgressBar({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  onNext,
  onPrev,
  specialtyColor,
}: ProgressBarProps) {
  const isLastStep = currentStep === steps.length - 1;

  const categoryColor: Record<string, string> = {
    subjective: 'bg-blue-500',
    objective: 'bg-green-500',
    assessment: 'bg-purple-500',
    plan: 'bg-orange-500',
    review: 'bg-slate-500',
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 px-4 py-2.5 sticky top-0 z-20">
      <div className="flex items-center gap-1.5">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = completedSteps.has(index);
          const color = categoryColor[step.category] || 'bg-gray-400';

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick(index)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'bg-gray-900 text-white shadow-sm'
                  : isCompleted
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  isActive ? 'bg-white' : isCompleted ? color : 'bg-gray-300 group-hover:bg-gray-400'
                }`}
              />
              {step.shortTitle}
              {isCompleted && !isActive && (
                <Check size={10} strokeWidth={3} className="text-green-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

// =============================================================================
// WORKFLOW DRAFT PERSISTENCE TYPES
// =============================================================================
const SPECIALTY_FORM_STORAGE_PREFIX = 'ndc_specialty_consultation_draft_';

type SpecialtyOrderTab =
  | 'rx'
  | 'lab'
  | 'imaging'
  | 'procedures'
  | 'admission'
  | 'nursing'
  | 'referrals';

interface SpecialtyCarePlanDraft {
  create_care_plan: boolean;
  plan_type: string;
  goals_text: string;
  frequency: string;
  expected_duration: string;
  total_sessions: string;
  therapy_type: string;
  medications: string;
  safety_plan: string;
}

interface SpecialtyFormDraft {
  selectedPatient: PatientDTO | null;
  selectedEncounter: EncounterSummary | null;
  currentStep: number;
  completedSteps: number[];
  selectedComplaints: SelectedComplaint[];
  formData: CreateConsultationDTO;
  specialtyFormData: SpecialtyFormData;
  carePlanDraft: SpecialtyCarePlanDraft;
  visitMode: VisitMode;
  clinicalScores: Record<string, ScoreResult>;
  selectedDiagnoses: ICDMultiSelectDiagnosis[];
  labOrders: LabOrderDTO[];
  radiologyOrders: RadiologyOrderDTO[];
  prescriptions: PrescriptionOrderDTO[];
  procedureOrders: ProcedureOrderDTO[];
  admissionOrder: AdmissionOrderDTO | null;
  treatmentTasks: CreateTreatmentTaskDTO[];
  specialtyReferrals: Record<string, any>;
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
  activeOrderTab: SpecialtyOrderTab;
  savedAt: number;
}

function getStorageKey(patientId: string, encounterId?: string | null): string {
  return `${SPECIALTY_FORM_STORAGE_PREFIX}${patientId}_${encounterId || 'new'}`;
}

// =============================================================================

export function SpecialtyConsultationWizard({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  preselectedPatient,
  visitId,
  encounterId,
  specialtyCode,
  specialtyName,
  template,
}: SpecialtyConsultationWizardProps) {
  const { showToast } = useToast();
  const { staff } = useAuth();

  // AI Assistant Panel State
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isAIPanelExpanded, setIsAIPanelExpanded] = useState(false);
  const closeAIPanel = useCallback(() => {
    setIsAIPanelOpen(false);
    setIsAIPanelExpanded(false);
  }, []);
  const toggleAIPanel = useCallback(() => {
    setIsAIPanelOpen((prev) => {
      if (prev) {
        setIsAIPanelExpanded(false);
      }
      return !prev;
    });
  }, []);

  // Track if we've restored from draft to avoid re-restoring
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // ==========================================================================
  // Step Navigation State
  // ==========================================================================
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // ==========================================================================
  // Care Plan Draft (config-driven — works for any specialty with a care plan config)
  // ==========================================================================
  const carePlanConfig = getCarePlanConfig(specialtyCode);
  const [carePlanDraft, setCarePlanDraft] = useState<SpecialtyCarePlanDraft>({
    create_care_plan: false,
    plan_type: '',
    goals_text: '',
    frequency: carePlanConfig?.default_frequency ?? 'Monthly',
    expected_duration: carePlanConfig?.default_duration ?? '6 months',
    total_sessions: '',
    therapy_type: '',
    medications: '',
    safety_plan: '',
  });

  // ==========================================================================
  // Patient State
  // ==========================================================================
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(
    preselectedPatient || null,
  );
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedEncounter, setSelectedEncounter] =
    useState<EncounterSummary | null>(null);
  const [patientEncounters, setPatientEncounters] = useState<
    EncounterSummary[]
  >([]);
  const [isLoadingEncounter, setIsLoadingEncounter] = useState(false);
  const [encounterError, setEncounterError] = useState<string | undefined>();

  // ==========================================================================
  // Patient History Sidebar State
  // ==========================================================================
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySidebarWidth, setHistorySidebarWidth] = useState(400);
  const toggleHistory = () => setIsHistoryOpen(!isHistoryOpen);

  // Left Vitals Sidebar collapse state
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);

  // Keyboard shortcut to toggle history (Ctrl/Cmd + H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        toggleHistory();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHistoryOpen]);

  // ==========================================================================
  // Complaints State
  // ==========================================================================
  const [selectedComplaints, setSelectedComplaints] = useState<
    SelectedComplaint[]
  >([]);

  // ==========================================================================
  // Form Data State (Standard SOAP fields)
  // ==========================================================================
  const [formData, setFormData] = useState<CreateConsultationDTO>({
    patient_id: '',
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
    follow_up_notes: '',
    icd10_codes: [],
  });

  // ==========================================================================
  // Specialty Examination Data (Template-driven)
  // ==========================================================================
  const [specialtyFormData, setSpecialtyFormData] = useState<SpecialtyFormData>(
    {},
  );
  const [specialtyFormErrors, setSpecialtyFormErrors] = useState<
    Record<string, string>
  >({});

  // ==========================================================================
  // Visit Mode State (first visit vs follow-up)
  // ==========================================================================
  const [visitMode, setVisitMode] = useState<VisitMode>('first');

  // ==========================================================================
  // Clinical Scores State (NYHA, CHA₂DS₂-VASc etc.)
  // ==========================================================================
  const [clinicalScores, setClinicalScores] = useState<
    Record<string, ScoreResult>
  >({});
  const handleScoreChange = useCallback(
    (scoreId: string, result: ScoreResult | null) => {
      setClinicalScores((prev) => {
        if (!result) {
          const next = { ...prev };
          delete next[scoreId];
          return next;
        }
        return { ...prev, [scoreId]: result };
      });
    },
    [],
  );

  // ==========================================================================
  // Diagnosis State
  // ==========================================================================
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<
    ICDMultiSelectDiagnosis[]
  >([]);

  // ==========================================================================
  // Orders State
  // ==========================================================================
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
  const [treatmentTasks, setTreatmentTasks] = useState<
    CreateTreatmentTaskDTO[]
  >([]);

  // ==========================================================================
  // Referrals State - Specialty clinics from specialty_departments table
  // ==========================================================================
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
    dental: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    ophthalmology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    physiotherapy: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    cardiology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    orthopaedics: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    dermatology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    urology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    gastroenterology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    nephrology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    paediatrics: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    neurosurgery: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    neurology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    neuropsychiatry: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    general_surgery: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    gynaecology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    oral_maxillofacial: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    pulmonology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    endocrinology: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    plastic_surgery: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    nutrition: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
    ent: {
      selected: false,
      reason: '',
      urgency: 'Routine',
      referralType: 'internal',
      externalFacility: '',
      externalDoctor: '',
      clinicalFindings: '',
      provisionalDiagnosis: '',
    },
  });

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

  // ==========================================================================
  // Orders UI State
  // ==========================================================================
  const [activeOrderTab, setActiveOrderTab] = useState<SpecialtyOrderTab>(
    'rx',
  );
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState<Partial<CreateTreatmentTaskDTO>>({
    task_type: 'Other',
    title: '',
    description: '',
    instructions: '',
    priority: 'Normal',
  });

  // ==========================================================================
  // Catalogue Hooks  // ==========================================================================
  // Catalogue Hooks
  // ==========================================================================
  const { data: labTests = [], isLoading: isLoadingLabTests } =
    useLabTestCatalogue();
  const { data: imaging = [], isLoading: isLoadingImaging } =
    useImagingCatalogue();
  const { data: drugs = [], isLoading: isLoadingDrugs } = useDrugCatalogue();
  const { data: procedures = [], isLoading: isLoadingProcedures } =
    useProcedureCatalogue();
  const { data: wards = [], isLoading: isLoadingWards } = useWardsCatalogue();

  // Patient search
  const debouncedSearch = useDebounce(patientSearch, 300);
  const { data: searchResults, isLoading: isSearching } =
    usePatientSearch(debouncedSearch);
  const draftStorageKey = useMemo(
    () =>
      selectedPatient?.patient_id
        ? getStorageKey(selectedPatient.patient_id, encounterId)
        : null,
    [encounterId, selectedPatient?.patient_id],
  );
  const {
    restoreDraft: restorePersistedDraft,
    saveDraft: savePersistedDraft,
    clearDraft: clearPersistedDraft,
  } = useWorkflowDraftPersistence<SpecialtyFormDraft>(draftStorageKey);

  // ==========================================================================
  // WORKFLOW DRAFT PERSISTENCE - Restore Draft on Open
  // ==========================================================================
  useEffect(() => {
    if (!isOpen || !draftStorageKey || hasRestoredDraft) return;
    let mounted = true;

    const restoreDraft = async (): Promise<void> => {
      const draft = await restorePersistedDraft();
      if (!mounted) return;

      if (!draft) {
        setHasRestoredDraft(true);
        return;
      }

      setSelectedPatient(draft.selectedPatient || preselectedPatient || null);
      setSelectedEncounter(draft.selectedEncounter || null);
      setCurrentStep(draft.currentStep);
      setCompletedSteps(new Set(draft.completedSteps));
      setSelectedComplaints(draft.selectedComplaints || []);
      setFormData(draft.formData);
      setSpecialtyFormData(draft.specialtyFormData || {});
      setCarePlanDraft(draft.carePlanDraft || carePlanDraft);
      setVisitMode(draft.visitMode || 'first');
      setClinicalScores(draft.clinicalScores || {});
      setSelectedDiagnoses(draft.selectedDiagnoses || []);
      setLabOrders(draft.labOrders || []);
      setRadiologyOrders(draft.radiologyOrders || []);
      setPrescriptions(draft.prescriptions || []);
      setProcedureOrders(draft.procedureOrders || []);
      setAdmissionOrder(draft.admissionOrder);
      setTreatmentTasks(draft.treatmentTasks || []);
      if (draft.specialtyReferrals) {
        setSpecialtyReferrals(draft.specialtyReferrals);
      }
      if (draft.externalNhisReferral) {
        setExternalNhisReferral(draft.externalNhisReferral);
      }
      if (draft.activeOrderTab) {
        setActiveOrderTab(draft.activeOrderTab);
      }

      showToast({
        type: 'info',
        title: 'Draft Restored',
        message: `Previous session data restored from ${new Date(draft.savedAt).toLocaleTimeString()}`,
      });
      setHasRestoredDraft(true);
    };

    void restoreDraft();

    return () => {
      mounted = false;
    };
  }, [
    carePlanDraft,
    draftStorageKey,
    hasRestoredDraft,
    isOpen,
    preselectedPatient,
    restorePersistedDraft,
    showToast,
  ]);

  // ==========================================================================
  // WORKFLOW DRAFT PERSISTENCE - Auto-save Draft
  // ==========================================================================
  useEffect(() => {
    if (!isOpen || !draftStorageKey) return;

    const saveTimer = setTimeout(() => {
      const draft: SpecialtyFormDraft = {
        selectedPatient,
        selectedEncounter,
        currentStep,
        completedSteps: Array.from(completedSteps),
        selectedComplaints,
        formData,
        specialtyFormData,
        carePlanDraft,
        visitMode,
        clinicalScores,
        selectedDiagnoses,
        labOrders,
        radiologyOrders,
        prescriptions,
        procedureOrders,
        admissionOrder,
        treatmentTasks,
        specialtyReferrals,
        externalNhisReferral,
        activeOrderTab,
        savedAt: Date.now(),
      };
      void savePersistedDraft(draft);
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [
    isOpen,
    draftStorageKey,
    selectedPatient,
    selectedEncounter,
    currentStep,
    completedSteps,
    selectedComplaints,
    formData,
    specialtyFormData,
    carePlanDraft,
    visitMode,
    clinicalScores,
    selectedDiagnoses,
    labOrders,
    radiologyOrders,
    prescriptions,
    procedureOrders,
    admissionOrder,
    treatmentTasks,
    specialtyReferrals,
    externalNhisReferral,
    activeOrderTab,
    savePersistedDraft,
  ]);

  // Reset hasRestoredDraft when wizard closes so we can restore again next time
  useEffect(() => {
    if (!isOpen) {
      setHasRestoredDraft(false);
    }
  }, [isOpen]);

  // ==========================================================================
  // Transform Catalogues to Options
  // ==========================================================================
  const labTestOptions: SearchableOption[] = useMemo(
    () =>
      (labTests || []).map((test: any) => ({
        id: test.test_id,
        name: test.test_name,
        code: test.test_code,
        category: test.category ?? undefined,
        subCategory: test.sample_type ?? undefined,
        price: test.price,
        requiresNhisAuth: test.requires_nhis_authorization || false,
      })),
    [labTests],
  );

  const imagingOptions: SearchableOption[] = useMemo(
    () =>
      (imaging || []).map((scan: any) => ({
        id: scan.imaging_id,
        name: scan.imaging_name,
        code: scan.imaging_code,
        category: scan.imaging_type,
        extraInfo: scan.body_part ?? undefined,
        price: scan.price,
        requiresNhisAuth: scan.requires_nhis_authorization || false,
      })),
    [imaging],
  );

  const drugOptions: SearchableOption[] = useMemo(
    () =>
      (drugs || []).map((drug: any) => ({
        id: drug.drug_id,
        name: drug.drug_name,
        code: drug.drug_code ?? undefined,
        category: drug.category ?? undefined,
        subCategory: drug.drug_type ?? undefined,
        price: drug.nhis_price || drug.selling_price || drug.price || 0,
        extraInfo: drug.strength ?? drug.strengths ?? undefined,
        requiresNhisAuth: drug.requires_nhis_authorization || false,
      })),
    [drugs],
  );

  const procedureOptions: SearchableOption[] = useMemo(
    () =>
      (procedures || []).map((proc: any) => ({
        id: proc.procedure_id,
        name: proc.procedure_name,
        code: proc.procedure_code ?? undefined,
        category: proc.procedure_type ?? undefined,
        price: proc.price || 0,
        requiresNhisAuth: proc.requires_nhis_authorization || false,
      })),
    [procedures],
  );

  const wardOptions: SearchableOption[] = useMemo(
    () =>
      (wards || []).map((ward: any) => ({
        id: ward.ward_id,
        name: ward.ward_name,
        category: ward.ward_type ?? undefined,
        extraInfo: `${ward.available_beds}/${ward.total_beds} beds available`,
        price: ward.daily_rate || 0,
      })),
    [wards],
  );

  // ==========================================================================
  // Specialty Colors
  // ==========================================================================
  const specialtyColors = useMemo(() => {
    return SPECIALTY_COLORS[specialtyCode] || SPECIALTY_COLORS.CARDIOLOGY;
  }, [specialtyCode]);

  // ==========================================================================
  // Template Sections
  // ==========================================================================
  const templateSections = useMemo(() => {
    if (!template?.sections) return [];
    return template.sections;
  }, [template]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handlePatientSelect = useCallback((patient: PatientDTO) => {
    setSelectedPatient(patient);
    setFormData((prev) => ({
      ...prev,
      patient_id: patient.patient_id,
    }));
    setPatientSearch('');
    setCompletedSteps((prev) => new Set([...prev, 0]));
  }, []);

  const handleFormChange = useCallback(
    (field: string, value: string | string[] | number | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSpecialtyFieldChange = useCallback(
    (fieldCode: string, value: unknown) => {
      setSpecialtyFormData((prev) => ({
        ...prev,
        [fieldCode]: value,
      }));
      // Clear error when field is updated
      setSpecialtyFormErrors((prev) => {
        const updated = { ...prev };
        delete updated[fieldCode];
        return updated;
      });
    },
    [],
  );

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
    } else {
      setFormData((prev) => ({ ...prev, ...payload.fields }));
    }
    if (payload.specialtyFormData) {
      setSpecialtyFormData((prev) => ({
        ...prev,
        ...payload.specialtyFormData,
      }));
    }
  };

  const handleComplaintsChange = useCallback(
    (complaints: SelectedComplaint[]) => {
      setSelectedComplaints(complaints);
      const complaintsText = complaints
        .map((c) => {
          const duration =
            c.duration_value && c.duration_unit
              ? `${c.duration_value} ${c.duration_unit}`
              : '';
          return `${c.complaint_name}${duration ? ` (${duration})` : ''}`;
        })
        .join('; ');
      setFormData((prev) => ({ ...prev, complaints: complaintsText }));
      if (complaints.length > 0) {
        setCompletedSteps((prev) => new Set([...prev, 1]));
      }
    },
    [],
  );

  const handleDiagnosesChange = useCallback(
    (diagnoses: ICDMultiSelectDiagnosis[]) => {
      setSelectedDiagnoses(diagnoses);
      const diagnosisText = diagnoses
        .map((d) => `${d.code}: ${d.title}`)
        .join('; ');
      const icd10Codes = diagnoses.map((d, idx) => ({
        code: d.code,
        description: d.title,
        is_primary: idx === 0,
      }));
      setFormData((prev) => ({
        ...prev,
        diagnosis: diagnosisText,
        icd10_codes: icd10Codes,
      }));
      if (diagnoses.length > 0) {
        setCompletedSteps((prev) => new Set([...prev, 4]));
      }
    },
    [],
  );

  // Navigate steps
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < STEPS.length) {
      setCurrentStep(step);
    }
  }, []);

  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Submit handler
  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!selectedPatient) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Please select a patient',
        });
        setCurrentStep(0);
        return;
      }

      if (selectedDiagnoses.length === 0) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Please add at least one diagnosis',
        });
        setCurrentStep(4);
        return;
      }

      // Validate referrals if any are selected
      const selectedInternalReferrals = Object.entries(
        specialtyReferrals,
      ).filter(
        ([_, referral]) =>
          referral.selected && referral.referralType === 'internal',
      );
      for (const [specialtyName, referral] of selectedInternalReferrals) {
        if (!referral.reason?.trim()) {
          showToast({
            type: 'error',
            title: 'Error',
            message: `Please provide a reason for the ${specialtyName} referral`,
          });
          setCurrentStep(5);
          setActiveOrderTab('referrals');
          return;
        }
      }

      // Validate external NHIS referral if enabled
      if (isNhisFeatureEnabled() && externalNhisReferral.enabled) {
        if (
          !externalNhisReferral.facilityName?.trim() ||
          !externalNhisReferral.doctorName?.trim() ||
          !externalNhisReferral.reason?.trim()
        ) {
          showToast({
            type: 'error',
            title: 'Error',
            message:
              'Please complete all required fields for external NHIS referral',
          });
          setCurrentStep(5);
          setActiveOrderTab('referrals');
          return;
        }
      }

      // Build final consultation data
      const consultationData: CreateConsultationDTO = {
        ...formData,
        patient_id: selectedPatient.patient_id,
        visit_id: visitId || undefined,
        encounter_id: encounterId || undefined,
      };

      // -----------------------------------------------------------------------
      // Map granular history fields → clinical_notes for timeline display.
      // ClinicalHistoryStep writes to separate fields (hpi, pmh, etc.) but the
      // timeline reads clinical_notes. Compose it here so nothing is lost.
      // -----------------------------------------------------------------------
      if (!consultationData.clinical_notes) {
        const historyParts: string[] = [];
        if (formData.history_of_present_illness)
          historyParts.push(
            `History of Present Illness:\n${formData.history_of_present_illness}`,
          );
        if (formData.past_medical_history)
          historyParts.push(
            `Past Medical History:\n${formData.past_medical_history}`,
          );
        if (formData.family_history)
          historyParts.push(`Family History:\n${formData.family_history}`);
        if (formData.social_history)
          historyParts.push(`Social History:\n${formData.social_history}`);
        if (formData.review_of_systems)
          historyParts.push(
            `Review of Systems:\n${formData.review_of_systems}`,
          );
        if (historyParts.length > 0)
          consultationData.clinical_notes = historyParts.join('\n\n');
      }

      // -----------------------------------------------------------------------
      // Map specialty exam summary → examination_findings for timeline display.
      // The exam step writes free-text narrative to specialtyFormData._exam_summary
      // but the timeline reads examination_findings on the consultations row.
      // -----------------------------------------------------------------------
      const examSummary = (specialtyFormData as Record<string, unknown>)
        ._exam_summary as string | undefined;
      if (!consultationData.examination_findings && examSummary) {
        consultationData.examination_findings = examSummary;
      }
      // -----------------------------------------------------------------------

      // Build specialty submission data with template reference for medico-legal audit
      let specialtySubmission: SpecialtySubmissionData | null = null;
      if (template && Object.keys(specialtyFormData).length > 0) {
        specialtySubmission = {
          specialty_template_id: template.id,
          specialty_template_version: template.version || 1,
          specialty_code: specialtyCode,
          specialty_name: specialtyName,
          form_data: {
            ...specialtyFormData,
            // Embed computed clinical score results alongside examination data
            ...(Object.keys(clinicalScores).length > 0
              ? { _clinical_scores: clinicalScores }
              : {}),
            // Embed care plan draft if the doctor opted in (config-driven, any specialty)
            ...(carePlanConfig && carePlanDraft.create_care_plan
              ? { _care_plan: carePlanDraft }
              : {}),
          },
        };
      }

      // Build specialty referral data for submission
      const specialtyReferralSubmissions: SpecialtyReferralDTO[] =
        Object.entries(specialtyReferrals)
          .filter(
            ([_, referral]) =>
              referral.selected && referral.referralType === 'internal',
          )
          .map(([specialtySlug, referral]) => ({
            specialty: specialtySlug,
            reason: referral.reason,
            urgency: referral.urgency,
            referralType: 'internal' as const,
            clinical_findings: referral.clinicalFindings,
            provisional_diagnosis: referral.provisionalDiagnosis,
          }));

      // Build external NHIS referral if enabled
      const externalReferralSubmission: ExternalNhisReferralDTO | null =
        isNhisFeatureEnabled() && externalNhisReferral.enabled
          ? {
              facilityName: externalNhisReferral.facilityName,
              facilityAddress: externalNhisReferral.facilityAddress,
              doctorName: externalNhisReferral.doctorName,
              reason: externalNhisReferral.reason,
              clinicalFindings: externalNhisReferral.clinicalFindings,
              investigationFindings: externalNhisReferral.investigationFindings,
              provisionalDiagnosis: externalNhisReferral.provisionalDiagnosis,
              urgency: externalNhisReferral.urgency,
            }
          : null;

      // Log submission data for debugging
      console.log(
        '🚀 [SpecialtyWizard] Submitting consultation with services:',
        {
          lab_orders: labOrders.length,
          radiology_orders: radiologyOrders.length,
          prescriptions: prescriptions.length,
          procedure_orders: procedureOrders.length,
          specialty_referrals: specialtyReferralSubmissions.length,
          external_referral: externalReferralSubmission
            ? 'enabled'
            : 'disabled',
          admission_order: admissionOrder ? 'yes' : 'no',
          treatment_tasks: treatmentTasks.length,
        },
      );

      // Submit with specialty data
      await onSubmit(
        consultationData,
        specialtySubmission,
        labOrders,
        radiologyOrders,
        prescriptions,
        procedureOrders,
        admissionOrder,
        treatmentTasks,
        specialtyReferralSubmissions,
        externalReferralSubmission,
      );

      await clearPersistedDraft();

      showToast({
        type: 'success',
        title: 'Success',
        message: 'Consultation saved successfully',
      });
      onClose();
    } catch (error) {
      console.error('Error submitting consultation:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to save consultation',
      });
    }
  };

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load patient encounters (visits) when patient is selected
  useEffect(() => {
    if (selectedPatient?.id) {
      setIsLoadingEncounter(true);
      supabase
        .from('visits')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data, error }) => {
          if (error) {
            setEncounterError('Failed to load encounters');
          } else {
            setPatientEncounters(data || []);
          }
          setIsLoadingEncounter(false);
        });
    }
  }, [selectedPatient?.id]);

  // Set preselected patient
  useEffect(() => {
    if (preselectedPatient) {
      handlePatientSelect(preselectedPatient);
    }
  }, [preselectedPatient, handlePatientSelect]);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/50">
      <div className="w-full h-full bg-gray-100 flex flex-col overflow-hidden">
        {/* Header - Clean Design */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0 z-30 shadow-sm relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${specialtyColors.bg} ${specialtyColors.text}`}
              >
                <Sparkles size={20} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-gray-900 leading-none">
                    {specialtyName} Consultation
                  </h1>
                  {/* Template Badge */}
                  {template && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                      v{template.version || 1}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-none mt-1">
                  Specialty OPD
                </p>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAIPanel}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isAIPanelOpen
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="Toggle AI Assistant"
              >
                <Bot size={16} />
                AI Assistant
              </button>
              <ConsultationTemplatePopover
                formData={formData}
                selectedComplaints={selectedComplaints}
                selectedDiagnoses={selectedDiagnoses}
                specialtyFormData={specialtyFormData}
                specialtyName={specialtyName}
                onApply={applyConsultationTemplate}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleHistory}
                disabled={!selectedPatient}
                className={`hidden md:flex items-center gap-2 text-sm font-medium transition-colors ${
                  isHistoryOpen
                    ? 'bg-blue-50 text-blue-700 underline decoration-blue-300'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="Toggle Patient History (Ctrl+H)"
              >
                <Clock size={16} />
                History Panel
              </Button>
              <div className="h-6 w-px bg-gray-200 mx-1" />
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                title="Close without saving"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation (ProgressBar) - Now Sticky within context */}
        <div className="sticky top-0 z-20">
          <ProgressBar
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={goToStep}
            onNext={goNext}
            onPrev={goPrev}
            specialtyColor={specialtyCode}
          />
        </div>

        {/* 3-COLUMN SPLIT VIEW WRAPPER */}
        <div className="flex flex-1 overflow-hidden relative bg-gray-100">
          {/* LEFT SIDEBAR: Patient Snapshot & Vitals - Collapsible */}
          {selectedPatient && (
            <div
              className="hidden lg:flex flex-col border-r border-gray-200 bg-white overflow-hidden flex-shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-200"
              style={{ width: isLeftSidebarCollapsed ? 40 : 280 }}
            >
              {/* Collapsed State */}
              {isLeftSidebarCollapsed ? (
                <button
                  onClick={() => setIsLeftSidebarCollapsed(false)}
                  className="flex-1 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                  title="Expand Patient Panel"
                >
                  <User className="h-4 w-4 text-blue-600" />
                  <span
                    className="text-[9px] font-bold text-slate-600 uppercase tracking-wider"
                    style={{
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                    }}
                  >
                    Patient
                  </span>
                  <ChevronsRight className="h-4 w-4 text-slate-400" />
                </button>
              ) : (
                <>
                  {/* Header with Collapse Button */}
                  <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-blue-100 rounded-lg">
                        <User className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Patient Info
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsLeftSidebarCollapsed(true)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Collapse Panel"
                    >
                      <ChevronsLeft className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>

                  {/* Patient Identity - Compact */}
                  <div className="px-3 py-2 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-2">
                      {selectedPatient.photo_url ? (
                        <img
                          src={selectedPatient.photo_url}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                          alt=""
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm ring-2 ring-white shadow-sm">
                          {selectedPatient.first_name[0]}
                          {selectedPatient.surname[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
                          {formatPatientName(selectedPatient)}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {selectedPatient.gender} •{' '}
                          {formatDetailedAge(selectedPatient.date_of_birth)} •{' '}
                          {selectedPatient.emr_number}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {/* Allergies - always show review status */}
                    <PatientAllergySummary
                      patientId={selectedPatient.id}
                      knownAllergies={selectedPatient.known_allergies}
                      noKnownAllergies={
                        (selectedPatient as { no_known_allergies?: boolean })
                          .no_known_allergies
                      }
                      compact
                    />

                    {/* Vitals Widget */}
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <Activity size={10} className="text-rose-500" />
                        <span className="text-[9px] font-bold uppercase text-gray-500">
                          Latest Vitals
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg border border-gray-100 p-2">
                        <PatientVitalsSummary
                          patientId={selectedPatient.patient_id}
                          compact
                        />
                      </div>
                    </div>

                    {/* Quick Notes Widget */}
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <Edit3 size={10} className="text-amber-500" />
                        <span className="text-[9px] font-bold uppercase text-gray-500">
                          Quick Notes
                        </span>
                      </div>
                      <textarea
                        className="w-full text-xs bg-yellow-50 border-yellow-200 rounded-lg focus:ring-yellow-400 focus:border-yellow-400 p-2 min-h-[60px] resize-none placeholder:text-yellow-700/50 text-gray-700"
                        placeholder="Session notes..."
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* CENTER: Main Consultation Form */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300">
            <div
              className={`transition-all duration-300 ease-in-out ${isHistoryOpen ? 'max-w-[calc(100vw-800px)]' : 'max-w-7xl mx-auto'}`}
            >
              {/* Card Container for Steps */}
              <div className="bg-white border text-gray-900 border-gray-100 rounded-2xl shadow-sm min-h-[600px] relative">
                {/* Step Content Padding Wrapper */}
                <div className="p-8">
                  {/* Step 0: Patient Review */}
                  {currentStep === 0 && (
                    <PatientReviewStep
                      selectedPatient={selectedPatient}
                      onSelectPatient={handlePatientSelect}
                      patientSearch={patientSearch}
                      onPatientSearchChange={setPatientSearch}
                      searchResults={searchResults}
                      isSearching={isSearching}
                      isPreselected={!!preselectedPatient}
                    />
                  )}

                  {/* Step 1: Chief Complaints */}
                  {currentStep === 1 && (
                    <ChiefComplaintsStep
                      selectedComplaints={selectedComplaints}
                      onComplaintsChange={handleComplaintsChange}
                      specialtyCode={specialtyCode}
                    />
                  )}

                  {/* Step 2: Clinical History */}
                  {currentStep === 2 && (
                    <ClinicalHistoryStep
                      formData={formData}
                      onChange={handleFormChange}
                      specialtyName={specialtyName}
                    />
                  )}

                  {/* Step 3: Specialty Examination (UNIVERSAL SHELL) */}
                  {currentStep === 3 && (
                    <SpecialtyExaminationStep
                      templateSections={templateSections}
                      specialtyFormData={specialtyFormData}
                      onFieldChange={handleSpecialtyFieldChange}
                      errors={specialtyFormErrors}
                      specialtyCode={specialtyCode}
                      specialtyName={specialtyName}
                      normalValues={template?.normal_values}
                      encounterId={encounterId || undefined}
                      clinicalScores={clinicalScores}
                      onScoreChange={handleScoreChange}
                      visitMode={visitMode}
                      onVisitModeChange={setVisitMode}
                    />
                  )}

                  {/* Step 4: Diagnosis */}
                  {currentStep === 4 && (
                    <DiagnosisStep
                      selectedDiagnoses={selectedDiagnoses}
                      onDiagnosesChange={handleDiagnosesChange}
                      formData={formData}
                      onChange={handleFormChange}
                      specialtyCode={specialtyCode}
                      carePlanConfig={carePlanConfig}
                      carePlanDraft={carePlanDraft}
                      onCarePlanDraftChange={setCarePlanDraft}
                    />
                  )}

                  {/* Step 5: Orders */}
                  {currentStep === 5 && (
                    <OrdersStep
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
                      onChange={handleFormChange}
                      specialtyReferrals={specialtyReferrals}
                      onSpecialtyReferralsChange={setSpecialtyReferrals}
                      selectedDiagnoses={selectedDiagnoses}
                      externalNhisReferral={externalNhisReferral}
                      setExternalNhisReferral={setExternalNhisReferral}
                      activeOrderTab={activeOrderTab}
                      setActiveOrderTab={setActiveOrderTab}
                      specialtyCode={specialtyCode}
                    />
                  )}

                  {/* Step 6: Review & Submit */}
                  {currentStep === 6 && (
                    <ReviewSubmitStep
                      selectedPatient={selectedPatient}
                      selectedComplaints={selectedComplaints}
                      formData={formData}
                      specialtyFormData={specialtyFormData}
                      selectedDiagnoses={selectedDiagnoses}
                      labOrders={labOrders}
                      radiologyOrders={radiologyOrders}
                      prescriptions={prescriptions}
                      procedureOrders={procedureOrders}
                      admissionOrder={admissionOrder}
                      treatmentTasks={treatmentTasks}
                      specialtyReferrals={specialtyReferrals}
                      externalNhisReferral={externalNhisReferral}
                      specialtyName={specialtyName}
                      templateSections={templateSections}
                      drugOptions={drugOptions}
                      labTestOptions={labTestOptions}
                      imagingOptions={imagingOptions}
                      procedureOptions={procedureOptions}
                      onEditStep={(stepIndex) => setCurrentStep(stepIndex)}
                    />
                  )}
                </div>
              </div>

              {/* Bottom Spacer */}
              <div className="h-10" />
            </div>
          </div>

          {/* AI ASSISTANT SIDEBAR */}
          {isAIPanelOpen && (
            <div
              className={`${isAIPanelExpanded ? 'w-[620px]' : 'w-[400px]'} flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden transition-all duration-300`}
            >
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
                  selectedComplaints.map((c) => c.complaint_name).join(', ') ||
                  undefined
                }
                department={specialtyName}
                existingCodes={selectedDiagnoses.map((d) => d.code)}
                onClose={closeAIPanel}
                onExpandToggle={(expanded) => setIsAIPanelExpanded(expanded)}
                className="h-full"
              />
            </div>
          )}

          {/* RIGHT SIDEBAR: Encounter-Centric Patient History */}
          {selectedPatient && isHistoryOpen && (
            <InlineSpecialtyHistorySidebar
              patientId={selectedPatient.id || selectedPatient.patient_id || ''}
              isOpen={isHistoryOpen}
              onClose={() => setIsHistoryOpen(false)}
              width={historySidebarWidth}
              onResize={(delta) => {
                setHistorySidebarWidth((prev) =>
                  Math.min(Math.max(prev + delta, 280), 700),
                );
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0 z-30">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="text-sm text-gray-500 font-medium">
              Step {currentStep + 1} of {STEPS.length}:{' '}
              <span className="text-gray-800">{STEPS[currentStep].title}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              {currentStep === STEPS.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={
                    isLoading ||
                    !selectedPatient ||
                    selectedDiagnoses.length === 0
                  }
                  className="bg-primary-700 hover:bg-primary-800 text-white shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Consultation
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={goNext}
                  className="bg-primary-700 hover:bg-primary-800 text-white shadow-sm"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant Slide-over */}
      {isAIPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={closeAIPanel}
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
                onClick={closeAIPanel}
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
                  selectedComplaints.map((c) => c.complaint_name).join(', ') ||
                  undefined
                }
                department={specialtyName}
                existingCodes={selectedDiagnoses.map((d) => d.code)}
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

// =============================================================================
// Patient History Sidebar — Encounter-Centric (mirrors EncounterCentricView)
// =============================================================================

type SpecSidebarModule =
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

const SPEC_SIDEBAR_MODULES: {
  id: SpecSidebarModule;
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

function InlineSpecialtyHistorySidebar({
  patientId,
  isOpen,
  onClose,
  width = 400,
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
  const [activeModule, setActiveModule] =
    useState<SpecSidebarModule>('overview');
  const [showEncDropdown, setShowEncDropdown] = useState(false);
  const [showQuickView, setShowQuickView] = useState(true);

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
      return (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
          <Loader2 size={24} className="animate-spin mb-2" />
          <span className="text-xs">Loading...</span>
        </div>
      );
    }
    if (!encounterDetail) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
          <ClipboardList size={24} className="mb-2 opacity-40" />
          <span className="text-xs">Select an encounter</span>
        </div>
      );
    }

    const panelMap: Record<SpecSidebarModule, React.ReactNode> = {
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
              <h4 className="text-sm font-bold text-gray-900 truncate">
                {patient.title ? `${patient.title} ` : ''}
                {patient.first_name} {patient.surname}
              </h4>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-600">
                <span className="font-medium">
                  {formatDetailedAge(patient.date_of_birth)}{' '}
                  {patient.gender?.charAt(0)}
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
          onChange={(e) => setActiveModule(e.target.value as SpecSidebarModule)}
          className={INPUT_CLS}
        >
          {SPEC_SIDEBAR_MODULES.map((mod) => (
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
// Step Components
// =============================================================================

/**
 * Patient Review Step
 */
function PatientReviewStep({
  selectedPatient,
  onSelectPatient,
  patientSearch,
  onPatientSearchChange,
  searchResults,
  isSearching,
  isPreselected,
}: {
  selectedPatient: PatientDTO | null;
  onSelectPatient: (patient: PatientDTO) => void;
  patientSearch: string;
  onPatientSearchChange: (value: string) => void;
  searchResults?: PatientDTO[];
  isSearching: boolean;
  isPreselected: boolean;
}) {
  // If patient is preselected from queue, show confirmation without ability to change
  if (selectedPatient) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-gray-200 border-dashed">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
          <Check size={32} className="text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Patient Selected
        </h3>
        <p className="text-gray-500 mb-6 text-center max-w-md">
          {formatPatientName(selectedPatient)} is selected. You can now proceed
          with the consultation.
        </p>
        {isPreselected && (
          <p className="text-xs text-gray-400">
            Patient was selected from the queue and cannot be changed.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Selection */}
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Select Patient
        </h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Search for a registered patient by name, patient number or phone number to
          begin the consultation.
        </p>
        <div className="max-w-xl mx-auto relative text-left">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => onPatientSearchChange(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border rounded-2xl transition-all text-sm focus:border-gray-300 focus:bg-white focus:ring-0 placeholder:text-gray-400"
              placeholder="Search patient..."
            />
          </div>
          {/* Search Results */}
          {(isSearching || (searchResults && searchResults.length > 0)) && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-80 overflow-y-auto">
              {isSearching ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : (
                <div className="py-2">
                  {searchResults?.map((patient) => (
                    <button
                      key={patient.patient_id}
                      onClick={() => onSelectPatient(patient)}
                      className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {formatPatientName(patient)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {patient.emr_number} • {patient.gender} •{' '}
                          {formatDetailedAge(patient.date_of_birth)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Chief Complaints Step
 */
function ChiefComplaintsStep({
  selectedComplaints,
  onComplaintsChange,
  specialtyCode,
}: {
  selectedComplaints: SelectedComplaint[];
  onComplaintsChange: (complaints: SelectedComplaint[]) => void;
  specialtyCode: string;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Chief Complaints
        </h3>
        <ChiefComplaintsSection
          selectedComplaints={selectedComplaints}
          onComplaintsChange={onComplaintsChange}
        />
      </div>
    </div>
  );
}

/**
 * Clinical History Step
 */
function ClinicalHistoryStep({
  formData,
  onChange,
  specialtyName,
}: {
  formData: CreateConsultationDTO;
  onChange: (field: string, value: string) => void;
  specialtyName: string;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-gray-500">
              History of Present Illness
            </label>

          </div>
          <textarea
            value={formData.history_of_present_illness || ''}
            onChange={(e) =>
              onChange('history_of_present_illness', e.target.value)
            }
            rows={4}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm transition-all resize-y text-sm"
            placeholder="Onset, duration, progression, associated symptoms..."
          />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-500">
                Past Medical History
              </label>

            </div>
            <textarea
              value={formData.past_medical_history || ''}
              onChange={(e) => onChange('past_medical_history', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm transition-all resize-none text-sm"
              placeholder="Previous illnesses, surgeries, hospitalizations..."
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-500">
                Family History
              </label>

            </div>
            <textarea
              value={formData.family_history || ''}
              onChange={(e) => onChange('family_history', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm transition-all resize-none text-sm"
              placeholder="Relevant family medical history..."
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-500">
                Social History
              </label>

            </div>
            <textarea
              value={formData.social_history || ''}
              onChange={(e) => onChange('social_history', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm transition-all resize-none text-sm"
              placeholder="Occupation, lifestyle, habits..."
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-500">
                Review of Systems
              </label>

            </div>
            <textarea
              value={formData.review_of_systems || ''}
              onChange={(e) => onChange('review_of_systems', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm transition-all resize-none text-sm"
              placeholder="Systemic review findings..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Specialty Examination Step (TEMPLATE-DRIVEN)
 * Now includes: pre-consultation triage display, specialty template form, clinical score calculators
 */
function SpecialtyExaminationStep({
  templateSections,
  specialtyFormData,
  onFieldChange,
  errors,
  specialtyCode,
  specialtyName,
  normalValues,
  encounterId,
  clinicalScores,
  onScoreChange,
  visitMode,
  onVisitModeChange,
}: {
  templateSections: SpecialtyTemplateSection[];
  specialtyFormData: SpecialtyFormData;
  onFieldChange: (fieldCode: string, value: unknown) => void;
  errors: Record<string, string>;
  specialtyCode: string;
  specialtyName: string;
  normalValues?: Record<string, unknown>;
  encounterId?: string;
  clinicalScores: Record<string, ScoreResult>;
  onScoreChange: (scoreId: string, result: ScoreResult | null) => void;
  visitMode: VisitMode;
  onVisitModeChange: (mode: VisitMode) => void;
}) {
  const specialtyColors =
    SPECIALTY_COLORS[specialtyCode] || SPECIALTY_COLORS.CARDIOLOGY;
  const scores = useMemo(
    () => getScoresForSpecialty(specialtyCode),
    [specialtyCode],
  );

  return (
    <div className="space-y-4">
      {/* Pre-Consultation Triage Observations (nurse/technician recordings) */}
      {encounterId && (
        <ClinicTriageDisplay
          encounterId={encounterId}
          clinicType={specialtyCode}
          compact
        />
      )}

      {/* Specialty Header */}
      <div
        className={`${specialtyColors.bg} ${specialtyColors.border} border rounded-2xl p-4`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white/50 ${specialtyColors.text}`}>
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className={`text-base font-semibold ${specialtyColors.text}`}>
              {specialtyName} Examination
            </h3>
            <p className="text-xs text-gray-600">
              Flag abnormal findings · expand sections if needed · use Quick
              Normal for unremarkable exams
            </p>
          </div>
        </div>
      </div>

      {/* Universal Exam Shell – five-block layout */}
      <UniversalExamShell
        specialtyCode={specialtyCode}
        specialtyName={specialtyName}
        templateSections={templateSections}
        specialtyFormData={specialtyFormData}
        onFieldChange={onFieldChange}
        errors={errors}
        normalValues={normalValues}
        scores={scores}
        clinicalScores={clinicalScores}
        onScoreChange={onScoreChange}
        visitMode={visitMode}
        onVisitModeChange={onVisitModeChange}
        safetyBanner={
          specialtyCode === 'NEUROPSYCHIATRY' ? (
            <SafetyAlertBanner specialtyData={specialtyFormData} />
          ) : undefined
        }
      />
    </div>
  );
}

/**
 * Diagnosis Step
 */
function DiagnosisStep({
  selectedDiagnoses,
  onDiagnosesChange,
  formData,
  onChange,
  specialtyCode,
  carePlanConfig,
  carePlanDraft,
  onCarePlanDraftChange,
}: {
  selectedDiagnoses: ICDMultiSelectDiagnosis[];
  onDiagnosesChange: (diagnoses: ICDMultiSelectDiagnosis[]) => void;
  formData: CreateConsultationDTO;
  onChange: (field: string, value: string) => void;
  specialtyCode?: string;
  carePlanConfig?: SpecialtyCarePlanConfig | null;
  carePlanDraft?: {
    create_care_plan: boolean;
    plan_type: string;
    goals_text: string;
    frequency: string;
    expected_duration: string;
    total_sessions: string;
    therapy_type: string;
    medications: string;
    safety_plan: string;
  };
  onCarePlanDraftChange?: (draft: NonNullable<typeof carePlanDraft>) => void;
}) {
  const showCarePlan = !!carePlanConfig;
  const draft = carePlanDraft;
  const setDraft = onCarePlanDraftChange;

  return (
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
        />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-gray-500">
              Treatment Plan
            </label>

          </div>
          <textarea
            value={formData.treatment_plan || ''}
            onChange={(e) => onChange('treatment_plan', e.target.value)}
            rows={6}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm transition-all resize-none text-sm"
            placeholder="Describe the treatment approach..."
          />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-gray-500">
              Follow-up Instructions
            </label>

          </div>
          <textarea
            value={formData.follow_up_notes || ''}
            onChange={(e) => onChange('follow_up_notes', e.target.value)}
            rows={6}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm transition-all resize-none text-sm"
            placeholder="Follow-up schedule and instructions..."
          />
        </div>
      </div>

      {/* Care Plan Setup — shown for any specialty with a care plan config */}
      {showCarePlan && draft && setDraft && carePlanConfig && (
        <div
          className={`bg-${carePlanConfig.color}-50 border border-${carePlanConfig.color}-200 rounded-2xl overflow-hidden`}
        >
          {/* Header / Toggle */}
          <div
            className={`flex items-center justify-between px-6 py-4 border-b border-${carePlanConfig.color}-200 bg-${carePlanConfig.color}-100`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg bg-${carePlanConfig.color}-600 flex items-center justify-center`}
              >
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <div>
                <p
                  className={`text-sm font-semibold text-${carePlanConfig.color}-900`}
                >
                  {carePlanConfig.section_title}
                </p>
                <p className={`text-xs text-${carePlanConfig.color}-600`}>
                  {carePlanConfig.section_description}
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span
                className={`text-xs font-medium text-${carePlanConfig.color}-700`}
              >
                {draft.create_care_plan ? 'Enabled' : 'Disabled'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    create_care_plan: !draft.create_care_plan,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  draft.create_care_plan
                    ? `bg-${carePlanConfig.color}-600`
                    : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    draft.create_care_plan ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Care Plan Form — shown when enabled */}
          {draft.create_care_plan && (
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Plan Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Plan Type *
                  </label>
                  <select
                    value={draft.plan_type}
                    onChange={(e) =>
                      setDraft({ ...draft, plan_type: e.target.value })
                    }
                    className={INPUT_CLS}
                  >
                    <option value="">Select plan type…</option>
                    {carePlanConfig.plan_types.map((pt) => (
                      <option key={pt.value} value={pt.value}>
                        {pt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Therapy Type — only shown if specialty config includes it */}
                {carePlanConfig.include_therapy_type && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Therapy Type
                    </label>
                    <select
                      value={draft.therapy_type}
                      onChange={(e) =>
                        setDraft({ ...draft, therapy_type: e.target.value })
                      }
                      className={INPUT_CLS}
                    >
                      <option value="">None / Not applicable</option>
                      {(carePlanConfig.therapy_types ?? []).map((tt) => (
                        <option key={tt.value} value={tt.value}>
                          {tt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Frequency */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Follow-up Frequency *
                  </label>
                  <select
                    value={draft.frequency}
                    onChange={(e) =>
                      setDraft({ ...draft, frequency: e.target.value })
                    }
                    className={INPUT_CLS}
                  >
                    <option value="Weekly">Weekly</option>
                    <option value="Every 2 weeks">Every 2 weeks</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Every 2 months">Every 2 months</option>
                    <option value="Every 3 months">Every 3 months</option>
                    <option value="As needed">As needed</option>
                  </select>
                </div>
                {/* Expected Duration */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Expected Duration *
                  </label>
                  <select
                    value={draft.expected_duration}
                    onChange={(e) =>
                      setDraft({ ...draft, expected_duration: e.target.value })
                    }
                    className={INPUT_CLS}
                  >
                    <option value="3 months">3 months</option>
                    <option value="6 months">6 months</option>
                    <option value="1 year">1 year</option>
                    <option value="Ongoing">Ongoing</option>
                  </select>
                </div>
                {/* Total Sessions */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Total Sessions (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={draft.total_sessions}
                    onChange={(e) =>
                      setDraft({ ...draft, total_sessions: e.target.value })
                    }
                    placeholder="e.g. 12"
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {/* Goals */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Treatment Goals{' '}
                  <span className="font-normal text-gray-400">
                    (separate multiple goals with a comma)
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={draft.goals_text}
                  onChange={(e) =>
                    setDraft({ ...draft, goals_text: e.target.value })
                  }
                  placeholder="e.g. Goal 1, Goal 2, Goal 3"
                  className={`w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:border-${carePlanConfig.color}-500 focus:ring-1 focus:ring-${carePlanConfig.color}-500`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Medications — only shown if specialty config includes it */}
                {carePlanConfig.include_medications && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Current Medications Summary
                    </label>
                    <textarea
                      rows={2}
                      value={draft.medications}
                      onChange={(e) =>
                        setDraft({ ...draft, medications: e.target.value })
                      }
                      placeholder="e.g. Medication 1, Medication 2"
                      className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:border-${carePlanConfig.color}-500 focus:ring-1 focus:ring-${carePlanConfig.color}-500`}
                    />
                  </div>
                )}
                {/* Safety Plan — only shown if specialty config includes it */}
                {carePlanConfig.include_safety_plan && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Safety Plan
                    </label>
                    <textarea
                      rows={2}
                      value={draft.safety_plan}
                      onChange={(e) =>
                        setDraft({ ...draft, safety_plan: e.target.value })
                      }
                      placeholder="e.g. Emergency contacts and crisis plan"
                      className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:border-${carePlanConfig.color}-500 focus:ring-1 focus:ring-${carePlanConfig.color}-500`}
                    />
                  </div>
                )}
              </div>

              <p
                className={`text-xs text-${carePlanConfig.color}-600 bg-${carePlanConfig.color}-50 rounded-lg px-3 py-2 border border-${carePlanConfig.color}-200`}
              >
                A care plan record will be created automatically when you submit
                this consultation. You can track sessions and update the plan
                from the <strong>Care Plans</strong> tab.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Orders Step - Full Implementation with all 7 tabs
 */
function OrdersStep({
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
  activeOrderTab,
  setActiveOrderTab,
  specialtyCode,
}: {
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
  specialtyCode: string;
  formData: CreateConsultationDTO;
  onChange: (
    field: string,
    value: string | string[] | number | boolean,
  ) => void;
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
  activeOrderTab:
    | 'rx'
    | 'lab'
    | 'imaging'
    | 'procedures'
    | 'admission'
    | 'nursing'
    | 'referrals';
  setActiveOrderTab: React.Dispatch<
    React.SetStateAction<
      | 'rx'
      | 'lab'
      | 'imaging'
      | 'procedures'
      | 'admission'
      | 'nursing'
      | 'referrals'
    >
  >;
}) {
  const specialtyReferralCount =
    Object.values(specialtyReferrals).filter((r) => r?.selected).length +
    (isNhisFeatureEnabled() && externalNhisReferral.enabled ? 1 : 0);

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
      {/* Investigation Panel Quick-Select (Order Sets) */}
      <OrderSetSelector
        specialtyCode={specialtyCode}
        currentLabOrders={labOrders}
        currentRadiologyOrders={radiologyOrders}
        onAddLabOrders={(newOrders) =>
          onLabOrdersChange([...labOrders, ...newOrders])
        }
        onAddRadiologyOrders={(newOrders) =>
          onRadiologyOrdersChange([...radiologyOrders, ...newOrders])
        }
        labTestOptions={labTestOptions}
        imagingOptions={imagingOptions}
      />

      {/* Order Type Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
        <div className="flex space-x-1 min-w-max px-1">
          {orderTabs.map((tab) => {
            const isActive = activeOrderTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveOrderTab(tab.id as typeof activeOrderTab)
                }
                className={`group flex items-center gap-2 py-3 px-4 text-sm font-medium transition-all border-b-2 ${
                  isActive
                    ? 'border-green-600 text-green-700 bg-green-50/30'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
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
                      placeholder="Clinical notes (optional)..."
                      rows={2}
                      className={INPUT_CLS}
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
              if (selectedImagingIds.includes(imagingId)) {
                onRadiologyOrdersChange(
                  radiologyOrders.filter((o) => o.imaging_id !== imagingId),
                );
              } else {
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
            placeholder="Search imaging studies..."
            allCategoriesLabel="All Modalities"
          />
          )}

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
                      placeholder="Clinical indication (optional)..."
                      rows={2}
                      className={INPUT_CLS}
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
            placeholder="Search procedures..."
            allCategoriesLabel="All Types"
          />

          {procedureOrders.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500">
                Selected Procedures:
              </p>
              {procedureOrders.map((proc) => (
                <div
                  key={proc.procedure_id}
                  className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
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
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-12 text-center hover:bg-white hover:border-rose-300 transition-all group">
              <div className="bg-white p-4 rounded-full shadow-sm w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-gray-100 group-hover:scale-110 transition-transform">
                <Bed className="h-8 w-8 text-rose-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">
                Admit Patient
              </h4>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                Create an inpatient admission request.
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
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
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
                  className="text-red-600 hover:bg-red-50 p-2 h-auto"
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
                  placeholder="Any special requirements..."
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nursing Tasks Tab */}
      {activeOrderTab === 'nursing' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Treatment Plan Notes
            </label>
            <textarea
              value={formData.treatment_plan || ''}
              onChange={(e) => onChange('treatment_plan', e.target.value)}
              className={`${INPUT_CLS} min-h-[80px]`}
              placeholder="General treatment plan notes..."
            />
          </div>

          {treatmentTasks.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900">
                Task List ({treatmentTasks.length})
              </p>
              {treatmentTasks.map((task, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
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
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onTreatmentTasksChange(
                        treatmentTasks.filter((_, i) => i !== index),
                      )
                    }
                    className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddTask ? (
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 space-y-6">
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
                    onChange={(value) =>
                      setNewTask({
                        ...newTask,
                        priority: value as CreateTreatmentTaskDTO['priority'],
                      })
                    }
                    options={['Normal', 'Urgent', 'Emergency']}
                    placeholder="Select priority"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={newTask.title || ''}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  className={INPUT_CLS}
                  placeholder="Enter task title..."
                />
              </div>

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
                  placeholder="Additional details..."
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
              className="w-full py-6 border border-dashed border-gray-300 rounded-2xl text-gray-500 hover:bg-white hover:border-gray-400 hover:text-gray-900 transition-all flex flex-col items-center justify-center gap-2"
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
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Share2 className="h-5 w-5 text-cyan-600" />
              Create Referral
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Referral Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Reset all specialty referrals
                      const resetReferrals: Record<string, any> = {};
                      Object.keys(specialtyReferrals).forEach((key) => {
                        resetReferrals[key] = {
                          ...specialtyReferrals[key],
                          referralType: 'internal',
                          selected: false,
                        };
                      });
                      onSpecialtyReferralsChange(resetReferrals);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      Object.values(specialtyReferrals).some(
                        (r) => r?.selected && r?.referralType === 'internal',
                      )
                        ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-200'
                        : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${Object.values(specialtyReferrals).some((r) => r?.selected && r?.referralType === 'internal') ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-500'}`}
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
                    onClick={() =>
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
                      }))
                    }
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
                          Refer to an outside hospital
                        </p>
                      </div>
                    </div>
                  </button>
                  )}
                </div>
              </div>

              {!externalNhisReferral.enabled && (
                <div className="mt-4 space-y-4">
                  <label className="block text-xs font-medium text-gray-500">
                    Select Specialty Clinic for Internal Referral
                  </label>
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
                                      : specialtyReferrals.nephrology?.selected
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
                                                      .general_surgery?.selected
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

                  {/* Selected Clinic Badge */}
                  {Object.entries(specialtyReferrals).some(
                    ([_, r]) => r?.selected,
                  ) && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-50 border border-cyan-200">
                      <div className="p-1.5 rounded-lg bg-cyan-100">
                        <Stethoscope size={16} className="text-cyan-600" />
                      </div>
                      <span className="text-sm font-medium text-cyan-800">
                        Selected:{' '}
                        {(() => {
                          const SPECIALTY_LABELS: Record<string, string> = {
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
                            ent: 'ENT',
                          };
                          const selected = Object.entries(
                            specialtyReferrals,
                          ).find(([_, r]) => r?.selected);
                          return selected
                            ? SPECIALTY_LABELS[selected[0]] || selected[0]
                            : 'Unknown';
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active Referral Forms */}
          <div className="space-y-4">
            {isNhisFeatureEnabled() && externalNhisReferral.enabled && (
              <div className="p-6 rounded-2xl border border-amber-200 bg-white shadow-sm ring-1 ring-amber-100">
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
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Urgency <span className="text-red-500">*</span>
                    </label>
                    <SpecChipField
                      options={[
                        { value: 'Routine', label: 'Routine' },
                        { value: 'Urgent', label: 'Urgent' },
                        { value: 'Emergency', label: 'Emergency' },
                      ]}
                      value={externalNhisReferral.urgency}
                      onChange={(v) =>
                        setExternalNhisReferral((prev) => ({
                          ...prev,
                          urgency: v as 'Routine' | 'Urgent' | 'Emergency',
                        }))
                      }
                    />
                  </div>
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
                  </div>
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
                      placeholder="Describe why you are referring this patient..."
                      rows={3}
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Generic Internal Specialty Referral Form - Works for any selected specialty */}
            {Object.entries(specialtyReferrals).map(([key, referral]) => {
              if (!referral?.selected) return null;

              const SPECIALTY_CONFIG: Record<
                string,
                {
                  label: string;
                  icon: React.ReactNode;
                  colorClass: string;
                  placeholder: string;
                }
              > = {
                dental: {
                  label: 'Dental Department',
                  icon: <Smile className="h-5 w-5" />,
                  colorClass: 'cyan',
                  placeholder: 'Describe dental concerns...',
                },
                ophthalmology: {
                  label: 'Eye Clinic (Ophthalmology)',
                  icon: <Eye className="h-5 w-5" />,
                  colorClass: 'violet',
                  placeholder: 'Describe visual symptoms...',
                },
                physiotherapy: {
                  label: 'Physiotherapy',
                  icon: <Dumbbell className="h-5 w-5" />,
                  colorClass: 'lime',
                  placeholder:
                    'Describe mobility issues and treatment goals...',
                },
                cardiology: {
                  label: 'Cardiology',
                  icon: <Heart className="h-5 w-5" />,
                  colorClass: 'rose',
                  placeholder: 'Describe cardiac concerns...',
                },
                orthopaedics: {
                  label: 'Orthopaedics',
                  icon: <Activity className="h-5 w-5" />,
                  colorClass: 'amber',
                  placeholder: 'Describe musculoskeletal concerns...',
                },
                dermatology: {
                  label: 'Dermatology',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'pink',
                  placeholder: 'Describe skin conditions...',
                },
                urology: {
                  label: 'Urology',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'blue',
                  placeholder: 'Describe urological concerns...',
                },
                gastroenterology: {
                  label: 'Gastroenterology',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'orange',
                  placeholder: 'Describe GI concerns...',
                },
                nephrology: {
                  label: 'Nephrology',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'teal',
                  placeholder: 'Describe renal concerns...',
                },
                paediatrics: {
                  label: 'Paediatrics',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'sky',
                  placeholder: 'Describe paediatric concerns...',
                },
                neurosurgery: {
                  label: 'Neurosurgery',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'indigo',
                  placeholder: 'Describe neurosurgical indication...',
                },
                neurology: {
                  label: 'Neurology',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'purple',
                  placeholder: 'Describe neurological symptoms...',
                },
                neuropsychiatry: {
                  label: 'Neuropsychiatry',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'fuchsia',
                  placeholder: 'Describe neuropsychiatric concerns...',
                },
                general_surgery: {
                  label: 'General Surgery',
                  icon: <Scissors className="h-5 w-5" />,
                  colorClass: 'red',
                  placeholder: 'Describe surgical indication...',
                },
                gynaecology: {
                  label: 'Gynaecology',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'pink',
                  placeholder: 'Describe gynaecological concerns...',
                },
                oral_maxillofacial: {
                  label: 'Oral & Maxillofacial',
                  icon: <Smile className="h-5 w-5" />,
                  colorClass: 'emerald',
                  placeholder: 'Describe maxillofacial concerns...',
                },
                pulmonology: {
                  label: 'Pulmonology',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'sky',
                  placeholder: 'Describe respiratory concerns...',
                },
                endocrinology: {
                  label: 'Endocrinology',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'yellow',
                  placeholder: 'Describe endocrine concerns...',
                },
                plastic_surgery: {
                  label: 'Plastic Surgery',
                  icon: <Scissors className="h-5 w-5" />,
                  colorClass: 'rose',
                  placeholder: 'Describe plastic surgery indication...',
                },
                nutrition: {
                  label: 'Nutrition',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'emerald',
                  placeholder: 'Describe nutritional concerns and goals...',
                },
                ent: {
                  label: 'ENT (Ear, Nose, Throat)',
                  icon: <Stethoscope className="h-5 w-5" />,
                  colorClass: 'green',
                  placeholder: 'Describe ENT concerns...',
                },
              };

              const config = SPECIALTY_CONFIG[key] || {
                label: key,
                icon: <Stethoscope className="h-5 w-5" />,
                colorClass: 'gray',
                placeholder: 'Describe reason for referral...',
              };

              return (
                <div
                  key={key}
                  className={`p-6 rounded-2xl border border-${config.colorClass}-200 bg-white shadow-sm ring-1 ring-${config.colorClass}-100`}
                >
                  <div
                    className={`flex items-center gap-3 mb-4 pb-4 border-b border-${config.colorClass}-100`}
                  >
                    <div
                      className={`bg-${config.colorClass}-50 p-2 rounded-lg text-${config.colorClass}-600`}
                    >
                      {config.icon}
                    </div>
                    <h4 className="font-semibold text-gray-900">
                      {config.label} Referral
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
                    {/* Clinical Findings - Auto-populated from Examination */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-gray-500">
                          Clinical Findings
                        </label>

                      </div>
                      <textarea
                        value={referral.clinicalFindings}
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
                        rows={2}
                        className={INPUT_CLS}
                      />
                      {(formData.examination_findings ||
                        formData.physical_examination) &&
                        !referral.clinicalFindings && (
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
                            className={`mt-1 text-xs text-${config.colorClass}-600 hover:text-${config.colorClass}-700 font-medium`}
                          >
                            ↑ Auto-fill from General Examination Findings
                          </button>
                        )}
                    </div>

                    {/* Provisional Diagnosis - Auto-populated */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-gray-500">
                          Provisional Diagnosis
                        </label>

                      </div>
                      <textarea
                        value={referral.provisionalDiagnosis}
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
                        !referral.provisionalDiagnosis && (
                          <button
                            type="button"
                            onClick={() =>
                              onSpecialtyReferralsChange((prev) => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  provisionalDiagnosis: selectedDiagnoses
                                    .map((d) => d.title)
                                    .join(', '),
                                },
                              }))
                            }
                            className={`mt-1 text-xs text-${config.colorClass}-600 hover:text-${config.colorClass}-700 font-medium`}
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
                        value={referral.reason}
                        onChange={(e) =>
                          onSpecialtyReferralsChange((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], reason: e.target.value },
                          }))
                        }
                        placeholder={config.placeholder}
                        rows={3}
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {!Object.values(specialtyReferrals).some((r) => r?.selected) &&
              !externalNhisReferral.enabled && (
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

    </div>
  );
}

/**
 * Review & Submit Step
 */
function ReviewSubmitStep({
  selectedPatient,
  selectedComplaints,
  formData,
  specialtyFormData,
  selectedDiagnoses,
  labOrders,
  radiologyOrders,
  prescriptions,
  procedureOrders,
  admissionOrder,
  treatmentTasks,
  specialtyReferrals,
  externalNhisReferral,
  specialtyName,
  templateSections,
  drugOptions,
  labTestOptions,
  imagingOptions,
  procedureOptions,
  onEditStep,
}: {
  selectedPatient: PatientDTO | null;
  selectedComplaints: SelectedComplaint[];
  formData: CreateConsultationDTO;
  specialtyFormData: SpecialtyFormData;
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
  specialtyName: string;
  templateSections: SpecialtyTemplateSection[];
  drugOptions: SearchableOption[];
  labTestOptions: SearchableOption[];
  imagingOptions: SearchableOption[];
  procedureOptions: SearchableOption[];
  onEditStep: (stepIndex: number) => void;
}) {
  const specialtyReferralCount =
    Object.values(specialtyReferrals).filter((r) => r?.selected).length +
    (isNhisFeatureEnabled() && externalNhisReferral.enabled ? 1 : 0);

  // Get filled specialty fields count
  const filledFieldsCount = Object.values(specialtyFormData).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && v !== '';
  }).length;
  const totalFieldsCount = templateSections.reduce(
    (acc, s) => acc + s.fields.length,
    0,
  );

  // Group diagnoses by type (Primary, Secondary)
  const primaryDiagnoses = selectedDiagnoses.filter((_, idx) => idx === 0);
  const secondaryDiagnoses = selectedDiagnoses.filter((_, idx) => idx > 0);

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
    const colorClasses: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-emerald-50 text-emerald-600',
      purple: 'bg-purple-50 text-purple-600',
      orange: 'bg-orange-50 text-orange-600',
    };

    return (
      <button
        type="button"
        onClick={() => toggleCategory(categoryKey)}
        className={`w-full bg-white border border-gray-100 hover:border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between transition-all duration-200 shadow-sm ${
          isExpanded ? 'ring-1 ring-gray-200' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-md ${colorClasses[color]}`}>
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

  // Section Card with edit button
  function SectionCard({
    title,
    icon,
    stepIndex,
    children,
    isEmpty,
    emptyMessage = 'No data entered',
    compact = false,
  }: {
    title: string;
    icon: React.ReactNode;
    stepIndex: number;
    children: React.ReactNode;
    isEmpty?: boolean;
    emptyMessage?: string;
    compact?: boolean;
  }) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50/50 border-gray-100">
          <h4 className="font-semibold text-sm text-gray-700">{title}</h4>
          <button
            type="button"
            onClick={() => onEditStep(stepIndex)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md text-gray-600 bg-white border border-gray-200 hover:text-primary-700 hover:border-primary-700 transition-colors shadow-sm"
          >
            <Edit3 size={10} />
            Edit
          </button>
        </div>
        <div className={compact ? 'px-4 py-3' : 'p-4'}>
          {isEmpty ? (
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

  // Helper to format specialty field values for display
  const formatFieldValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Get a field label from template sections by field_code
  const getFieldLabel = (fieldCode: string): string => {
    for (const section of templateSections) {
      const field = section.fields.find((f) => f.field_code === fieldCode);
      if (field) return field.field_label;
    }
    return fieldCode
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary-700/10 rounded-xl">
            <ClipboardList className="h-6 w-6 text-primary-700" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {specialtyName} Consultation Review
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Please verify all clinical documentation and orders before
              finalizing.
            </p>
          </div>
        </div>
      </div>

      {/* Patient Identity — Always on top */}
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

      {/* ═══════════ SUBJECTIVE ═══════════ */}
      <div className="space-y-2">
        <CategoryHeader
          title="Subjective"
          color="blue"
          icon={<Heart size={14} />}
          categoryKey="subjective"
          isExpanded={expandedCategories.subjective}
        />
        <div
          className={`grid grid-cols-1 gap-2 transition-all duration-200 overflow-hidden ${expandedCategories.subjective ? 'opacity-100 max-h-[3000px]' : 'opacity-0 max-h-0'}`}
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
                    {complaint.duration_unit?.toLowerCase()}
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
          >
            <div className="space-y-3 text-sm">
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

      {/* ═══════════ OBJECTIVE ═══════════ */}
      <div className="space-y-2">
        <CategoryHeader
          title="Objective"
          color="green"
          icon={<Stethoscope size={14} />}
          categoryKey="objective"
          isExpanded={expandedCategories.objective}
        />
        <div
          className={`grid grid-cols-1 gap-2 transition-all duration-200 overflow-hidden ${expandedCategories.objective ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0'}`}
        >
          {/* Vital Signs placeholder */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-gray-500" />
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

          {/* General Examination fields (if any) */}
          <SectionCard
            title="Physical Examination"
            icon={<Stethoscope size={14} />}
            stepIndex={3}
            isEmpty={
              !formData.examination_findings &&
              !formData.physical_examination &&
              !formData.clinical_notes
            }
            emptyMessage="No general examination findings"
            compact
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

          {/* ★ Specialty Examination — full field-by-field preview */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-emerald-50/50 border-emerald-100">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-600" />
                <h4 className="font-semibold text-sm text-emerald-800">
                  {specialtyName} Examination
                </h4>
                <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  {filledFieldsCount}/{totalFieldsCount} fields
                </span>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(3)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md text-gray-600 bg-white border border-gray-200 hover:text-primary-700 hover:border-primary-700 transition-colors shadow-sm"
              >
                <Edit3 size={10} />
                Edit
              </button>
            </div>
            <div className="p-4">
              {filledFieldsCount === 0 ? (
                <p className="text-sm text-gray-400 italic flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  No specialty examination data entered
                </p>
              ) : (
                <div className="space-y-4">
                  {templateSections.map((section) => {
                    // Get fields with values in this section
                    const sectionFieldsWithValues = section.fields.filter(
                      (f) => {
                        const val = specialtyFormData[f.field_code];
                        if (val === null || val === undefined || val === '')
                          return false;
                        if (Array.isArray(val) && val.length === 0)
                          return false;
                        return true;
                      },
                    );

                    if (sectionFieldsWithValues.length === 0) return null;

                    return (
                      <div
                        key={section.section_code}
                        className="border border-gray-100 rounded-lg overflow-hidden"
                      >
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                          <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {section.section_name}
                          </h5>
                        </div>
                        <div className="px-3 py-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                            {sectionFieldsWithValues.map((field) => {
                              const val = specialtyFormData[field.field_code];
                              const displayVal = formatFieldValue(val);
                              return (
                                <div
                                  key={field.field_code}
                                  className="flex flex-col py-1 border-b border-gray-50 last:border-0"
                                >
                                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    {field.field_label}
                                  </span>
                                  <span className="text-sm text-gray-800 font-medium mt-0.5">
                                    {displayVal}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Also show any specialty fields NOT in a template section (edge case) */}
                  {(() => {
                    const templateFieldCodes = new Set(
                      templateSections.flatMap((s) =>
                        s.fields.map((f) => f.field_code),
                      ),
                    );
                    const extraEntries = Object.entries(
                      specialtyFormData,
                    ).filter(
                      ([key, val]) =>
                        !templateFieldCodes.has(key) &&
                        val !== null &&
                        val !== undefined &&
                        val !== '' &&
                        !(Array.isArray(val) && val.length === 0),
                    );
                    if (extraEntries.length === 0) return null;
                    return (
                      <div className="border border-gray-100 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                          <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Other Findings
                          </h5>
                        </div>
                        <div className="px-3 py-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                          {extraEntries.map(([key, val]) => (
                            <div
                              key={key}
                              className="flex flex-col py-1 border-b border-gray-50 last:border-0"
                            >
                              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                {getFieldLabel(key)}
                              </span>
                              <span className="text-sm text-gray-800 font-medium mt-0.5">
                                {formatFieldValue(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ ASSESSMENT ═══════════ */}
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
            stepIndex={5}
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

      {/* ═══════════ PLAN & ORDERS ═══════════ */}
      <div className="space-y-2">
        <CategoryHeader
          title="Plan & Orders"
          color="orange"
          icon={<Pill size={14} />}
          categoryKey="plan"
          isExpanded={expandedCategories.plan}
        />
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-200 overflow-hidden ${expandedCategories.plan ? 'opacity-100 max-h-[4000px]' : 'opacity-0 max-h-0'}`}
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
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Reason:</span>{' '}
                  {admissionOrder.reason || 'Not specified'}
                </p>
              </div>
            )}
          </SectionCard>

          {/* Referrals */}
          <SectionCard
            title={`Referrals (${specialtyReferralCount})`}
            icon={<Share2 size={14} />}
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
              {externalNhisReferral.enabled && (
                <div className="p-3 bg-white rounded-lg text-sm border border-gray-200 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <ExternalLink size={14} className="text-indigo-600" />
                      <span className="font-semibold text-gray-900">
                        NHIS External Referral
                      </span>
                    </div>
                    <span className="text-xs uppercase font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 border border-gray-200">
                      {externalNhisReferral.urgency}
                    </span>
                  </div>
                  {externalNhisReferral.facilityName && (
                    <p className="text-gray-600 text-xs mt-1">
                      <span className="font-medium">Facility:</span>{' '}
                      {externalNhisReferral.facilityName}
                    </p>
                  )}
                  <p className="text-gray-500 text-xs italic border-l-2 border-gray-200 pl-2 mt-1">
                    {externalNhisReferral.reason}
                  </p>
                </div>
              )}
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

      {/* Validation Warnings */}
      {(!selectedPatient || selectedDiagnoses.length === 0) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-2">
            <AlertTriangle size={18} />
            Cannot Submit
          </h4>
          <ul className="text-sm text-red-700 list-disc list-inside">
            {!selectedPatient && <li>Patient selection required</li>}
            {selectedDiagnoses.length === 0 && (
              <li>At least one diagnosis required</li>
            )}
          </ul>
        </div>
      )}

      {/* AI Clinical Review */}
      {selectedPatient && (
        <AIConsultationReview
          patientId={
            (selectedPatient.patient_id || selectedPatient.id || null) as
              | string
              | null
          }
          complaints={selectedComplaints}
          formData={formData}
          specialtyExamination={
            specialtyFormData as unknown as Record<string, unknown>
          }
          diagnoses={selectedDiagnoses}
          prescriptions={prescriptions as unknown as Record<string, unknown>[]}
          labOrders={labOrders as unknown as Record<string, unknown>[]}
          radiologyOrders={
            radiologyOrders as unknown as Record<string, unknown>[]
          }
          procedureOrders={
            procedureOrders as unknown as Record<string, unknown>[]
          }
          admissionOrder={
            admissionOrder as unknown as Record<string, unknown> | null
          }
          treatmentTasks={
            treatmentTasks as unknown as Record<string, unknown>[]
          }
          referrals={
            [
              ...Object.entries(specialtyReferrals)
                .filter(([, r]) => r?.selected)
                .map(([name, r]) => ({
                  specialty: name,
                  reason: r.reason,
                  urgency: r.urgency,
                  referralType: r.referralType,
                  externalFacility: r.externalFacility,
                  externalDoctor: r.externalDoctor,
                  clinicalFindings: r.clinicalFindings,
                  provisionalDiagnosis: r.provisionalDiagnosis,
                })),
              ...(externalNhisReferral.enabled
                ? [
                    {
                      specialty: 'NHIS External Referral',
                      reason: externalNhisReferral.reason,
                      urgency: externalNhisReferral.urgency,
                      referralType: 'external' as const,
                      externalFacility: externalNhisReferral.facilityName,
                      externalDoctor: externalNhisReferral.doctorName,
                      clinicalFindings: externalNhisReferral.clinicalFindings,
                      provisionalDiagnosis:
                        externalNhisReferral.provisionalDiagnosis,
                    },
                  ]
                : []),
            ] as unknown as Record<string, unknown>[]
          }
        />
      )}

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

export default SpecialtyConsultationWizard;
