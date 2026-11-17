/**
 * =============================================================================
 * XENOCARE EMR - DYNAMIC SPECIALTY CLINIC PAGE
 * =============================================================================
 *
 * A unified, configuration-driven specialty dashboard that works for ALL
 * specialties without specialty-specific switch/case logic.
 *
 * Key Principles:
 * 1. Single RPC call (get_specialty_dashboard) for all data
 * 2. Feature flags drive UI capabilities (no hardcoded specialty checks)
 * 3. Server-side access control via can_access_specialty()
 *
 * @module SpecialtyClinicPage
 * @version 2.2
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { isNhisFeatureEnabled } from '../../../config/features';
import {
  Search,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
  ClipboardList,
  CheckCircle,
  XCircle,
  Play,
  FileText,
  Activity,
  Heart,
  Bone,
  Eye,
  Ear,
  Brain,
  Baby,
  Scissors,
  Smile,
  Dumbbell,
  Hand,
  Droplet,
  Wind,
  Sparkles,
  Syringe,
  ClipboardCheck,
  Calendar,
  User,
  Stethoscope,
  Bot,
  X,
  BadgeCheck,
  Timer,
  HeartPulse,
  MoreVertical,
  Bell,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Button, Input } from '../../../components/ui/FormElements';
import { useToast } from '../../../components/ui/Toast';
import { useTimeTheme } from '../../../hooks/useTimeTheme';
import {
  useSpecialtyClinic,
  useSpecialtyDepartments,
} from '../hooks/useSpecialtyDashboard';
import type {
  SpecialtyQueuePatient,
  SpecialtyReferral,
  SpecialtyProcedure,
  SpecialtyExam,
  SpecialtyConfig,
  SpecialtyFeatureFlags,
  SpecialtyConsultationHistory,
} from '../types/specialty-dashboard.types';
import { SpecialtyConsultationWizard } from '../../clinical-consultation/components/SpecialtyConsultationWizard';
import { getFullSpecialtyTemplate } from '../../clinical-consultation/api/specialty-template.api';
import type {
  SpecialtyTemplate,
  SpecialtySubmissionData,
} from '../../clinical-consultation/dtos/specialty-template.dto';
import type {
  CreateConsultationDTO,
  LabOrderDTO,
  RadiologyOrderDTO,
  PrescriptionOrderDTO,
  ProcedureOrderDTO,
  AdmissionOrderDTO,
} from '../../clinical-consultation/dtos/consultation.dto';
import type { CreateTreatmentTaskDTO } from '../../treatment-plan/dtos/treatment-plan.dto';
import type { PatientDTO } from '../../patient-registration/dtos/patient.dto';
import { useCreateConsultation } from '../../clinical-consultation/hooks/useConsultation';
import {
  createBatchOrders,
  resolvePatientUuid,
} from '../../clinical-consultation/api/consultation.api';
import { createBulkClinicalRequests } from '../../clinical-requests/api/clinical-requests.api';
import type { CreateClinicalRequestDTO } from '../../clinical-requests/dtos/clinical-request.dto';
import {
  SpecialtyReferralDTO,
  ExternalNhisReferralDTO,
} from '../../clinical-consultation/components/ConsultationWizard';
import { createOutgoingReferral } from '../../nhis/api/nhis.api';
import { createTreatmentPlan } from '../../treatment-plan/api/treatment-plan.api';
import { validateRecordLinkage } from '../../../lib/encounter';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../api/supabaseClient';
import { SkeletonDashboard } from '../../../components/ui/SkeletonLoader';
import SpecialtyCarePlanDashboard from '../../specialty-common/components/SpecialtyCarePlanDashboard';
import SpecialtyConsultationTimeline from '../components/SpecialtyConsultationTimeline';
import { createCareplan } from '../../specialty-common/api/specialty-clinic.api';
import { formatSpecialtyExamNarrative } from '../../../utils/clinicalTextFormatter';
import {
  getCarePlanConfig,
  specialtyHasCarePlan,
} from '../../specialty-common/constants/care-plans';
import { AIChatPanel } from '../../ai-assistant/components/AIChatPanel';
import { ConsultationDashboardAlertsPanel } from '../../../components/clinical/ConsultationDashboardAlertsPanel';
import { createScopedLogger } from '../../../utils/logger';

const log = createScopedLogger('SpecialtyClinic');

// XenoCare Logo
// =============================================================================
// ICON MAPPING (Static - avoids dynamic imports)
// =============================================================================

const ICON_MAP: Record<string, React.ElementType> = {
  Heart,
  Bone,
  Eye,
  Ear,
  Brain,
  Baby,
  Scissors,
  Smile,
  Dumbbell,
  Hand,
  Droplet,
  Wind,
  Sparkles,
  Activity,
};

/**
 * Get icon component by name from database.
 * Returns Activity as fallback.
 */
function getIconByName(iconName: string | null): React.ElementType {
  if (!iconName) return Activity;
  return ICON_MAP[iconName] || Activity;
}

// =============================================================================
// TYPES
// =============================================================================

type ViewTab =
  | 'queue'
  | 'referrals'
  | 'procedures'
  | 'exams'
  | 'history'
  | 'care_plans';

type MetricTone =
  | 'waiting'
  | 'active'
  | 'done'
  | 'referrals'
  | 'procedures'
  | 'exams';

interface DashboardStatsSnapshot {
  waiting: number;
  in_progress: number;
  completed_today: number;
  pending_referrals: number;
  pending_procedures: number;
  total_exams: number;
}

interface SpecialtyMetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle: string;
  tone: MetricTone;
  isDark: boolean;
}

function SpecialtyMetricCard({
  title,
  value,
  icon,
  subtitle,
  tone,
  isDark,
}: SpecialtyMetricCardProps) {
  const displayValue = Number.isFinite(value) ? value : 0;
  const toneStyles: Record<
    MetricTone,
    {
      shell: string;
      badge: string;
      value: string;
      subtitle: string;
    }
  > = {
    waiting: {
      shell: isDark
        ? 'border-amber-900/60 bg-slate-800'
        : 'border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white',
      badge: isDark
        ? 'bg-amber-900/40 text-amber-300'
        : 'bg-amber-100 text-amber-700',
      value: isDark ? 'text-amber-300' : 'text-amber-700',
      subtitle: isDark ? 'text-slate-400' : 'text-amber-700/70',
    },
    active: {
      shell: isDark
        ? 'border-teal-900/60 bg-slate-800'
        : 'border-teal-100 bg-gradient-to-br from-teal-50 via-white to-white',
      badge: isDark
        ? 'bg-teal-900/40 text-teal-300'
        : 'bg-teal-100 text-teal-700',
      value: isDark ? 'text-teal-300' : 'text-[#11151C]',
      subtitle: isDark ? 'text-slate-400' : 'text-teal-700/70',
    },
    done: {
      shell: isDark
        ? 'border-emerald-900/60 bg-slate-800'
        : 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white',
      badge: isDark
        ? 'bg-emerald-900/40 text-emerald-300'
        : 'bg-emerald-100 text-emerald-700',
      value: isDark ? 'text-emerald-300' : 'text-emerald-700',
      subtitle: isDark ? 'text-slate-400' : 'text-emerald-700/70',
    },
    referrals: {
      shell: isDark
        ? 'border-indigo-900/60 bg-slate-800'
        : 'border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white',
      badge: isDark
        ? 'bg-indigo-900/40 text-indigo-300'
        : 'bg-indigo-100 text-indigo-700',
      value: isDark ? 'text-indigo-300' : 'text-indigo-700',
      subtitle: isDark ? 'text-slate-400' : 'text-indigo-700/70',
    },
    procedures: {
      shell: isDark
        ? 'border-rose-900/60 bg-slate-800'
        : 'border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white',
      badge: isDark
        ? 'bg-rose-900/40 text-rose-300'
        : 'bg-rose-100 text-rose-700',
      value: isDark ? 'text-rose-300' : 'text-rose-700',
      subtitle: isDark ? 'text-slate-400' : 'text-rose-700/70',
    },
    exams: {
      shell: isDark
        ? 'border-sky-900/60 bg-slate-800'
        : 'border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white',
      badge: isDark ? 'bg-sky-900/40 text-sky-300' : 'bg-sky-100 text-sky-700',
      value: isDark ? 'text-sky-300' : 'text-sky-700',
      subtitle: isDark ? 'text-slate-400' : 'text-sky-700/70',
    },
  };

  const styles = toneStyles[tone];

  return (
    <div
      className={`rounded-[1.75rem] border px-5 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${styles.shell}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className={`mt-1 text-xs font-medium ${styles.subtitle}`}>
            {subtitle}
          </p>
        </div>
        <div className={`rounded-2xl px-3 py-2 ${styles.badge}`}>{icon}</div>
      </div>
      <div className="flex items-end gap-2">
        <p
          className={`text-[34px] leading-none font-extrabold ${styles.value}`}
        >
          {displayValue.toString().padStart(2, '0')}
        </p>
        <span className="pb-1 text-xs font-semibold text-slate-400 dark:text-slate-400">
          cases
        </span>
      </div>
    </div>
  );
}

function tabLabel(tab: ViewTab): string {
  if (tab === 'queue') return 'Queue';
  if (tab === 'referrals') return 'Referrals';
  if (tab === 'procedures') return 'Procedures';
  if (tab === 'exams') return 'Exams';
  if (tab === 'history') return 'History';
  return 'Care Plans';
}

function tabCount(tab: ViewTab, stats: DashboardStatsSnapshot): number | null {
  if (tab === 'queue') return stats.waiting + stats.in_progress;
  if (tab === 'referrals') return stats.pending_referrals || null;
  if (tab === 'procedures') return stats.pending_procedures || null;
  if (tab === 'exams') return stats.total_exams || null;
  return null;
}

function tabIcon(tab: ViewTab): React.ElementType {
  if (tab === 'queue') return Users;
  if (tab === 'referrals') return ClipboardList;
  if (tab === 'procedures') return Syringe;
  if (tab === 'exams') return ClipboardCheck;
  if (tab === 'history') return FileText;
  return HeartPulse;
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function SpecialtyClinicPage() {
  const location = useLocation();
  const { specialtyCode: routeSpecialtyCode } = useParams<{
    specialtyCode?: string;
  }>();
  const dashboardLaunchHandledRef = useRef<string | null>(null);
  const dashboardQueueId =
    (
      location.state as {
        dashboardQueueId?: string;
        dashboardQueueAction?: 'start' | 'resume';
      } | null
    )?.dashboardQueueId || null;
  const dashboardQueueAction =
    (
      location.state as {
        dashboardQueueId?: string;
        dashboardQueueAction?: 'start' | 'resume';
      } | null
    )?.dashboardQueueAction || 'start';
  const { isNightMode } = useTimeTheme();
  const { showToast } = useToast();
  const { staff } = useAuth();
  const createConsultation = useCreateConsultation();
  // Use isNightMode instead of isDark
  const isDark = isNightMode;

  // Tab state - MUST be before any conditional returns
  const [activeTab, setActiveTab] = useState<ViewTab>('queue');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAIDashboardOpen, setIsAIDashboardOpen] = useState(false);
  const [aiSelectedPatient, setAiSelectedPatient] =
    useState<SpecialtyQueuePatient | null>(null);

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] =
    useState<SpecialtyQueuePatient | null>(null);
  const [specialtyTemplate, setSpecialtyTemplate] =
    useState<SpecialtyTemplate | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  // Track current session queue ID for session persistence
  const [currentSessionQueueId, setCurrentSessionQueueId] = useState<
    string | null
  >(null);

  // Auto-open encounter detail for a specific exam from the exams table
  const [timelineSelectedExamId, setTimelineSelectedExamId] = useState<string | null>(null);

  // Load dashboard data (auto-detects specialty if not in route)
  const {
    specialtyCode,
    dashboard,
    isLoading,
    isError,
    error,
    refetch,
    actions,
  } = useSpecialtyClinic(routeSpecialtyCode?.toUpperCase());

  // Extract data with safe defaults (for hooks that depend on this data)
  const config = dashboard?.config;
  const stats = dashboard?.stats;
  const queue = dashboard?.queue || [];
  const referrals = dashboard?.referrals || [];
  const procedures = dashboard?.procedures || [];
  const exams = dashboard?.exams || [];
  const history = dashboard?.history || [];

  // ALL useMemo hooks MUST be called before any conditional returns
  // Separate waiting patients from in-progress sessions
  const waitingQueue = useMemo(
    () => queue.filter((p) => p.status === 'Waiting' || p.status === 'Called'),
    [queue],
  );

  const activeSessions = useMemo(
    () => queue.filter((p) => p.status === 'In Progress'),
    [queue],
  );

  // Filtered queue (only waiting/called patients)
  const filteredQueue = useMemo(() => {
    if (!searchTerm) return waitingQueue;
    const term = searchTerm.toLowerCase();
    return waitingQueue.filter(
      (p) =>
        p.first_name?.toLowerCase().includes(term) ||
        p.last_name?.toLowerCase().includes(term) ||
        p.emr_number?.toLowerCase().includes(term),
    );
  }, [waitingQueue, searchTerm]);

  // Filtered sessions (in-progress)
  const filteredSessions = useMemo(() => {
    if (!searchTerm) return activeSessions;
    const term = searchTerm.toLowerCase();
    return activeSessions.filter(
      (p) =>
        p.first_name?.toLowerCase().includes(term) ||
        p.last_name?.toLowerCase().includes(term) ||
        p.emr_number?.toLowerCase().includes(term),
    );
  }, [activeSessions, searchTerm]);

  const specialtyPatientAlertsEncounter = useMemo(
    () =>
      selectedPatient
        ? {
            priority: selectedPatient.priority || undefined,
            chief_complaint: null as string | null,
          }
        : null,
    [selectedPatient],
  );

  // Filtered referrals
  const filteredReferrals = useMemo(() => {
    if (!searchTerm) return referrals;
    const term = searchTerm.toLowerCase();
    return referrals.filter(
      (r) =>
        r.first_name?.toLowerCase().includes(term) ||
        r.last_name?.toLowerCase().includes(term) ||
        r.emr_number?.toLowerCase().includes(term),
    );
  }, [referrals, searchTerm]);

  // Filtered procedures
  const filteredProcedures = useMemo(() => {
    if (!searchTerm) return procedures;
    const term = searchTerm.toLowerCase();
    return procedures.filter(
      (p) =>
        p.procedure_name?.toLowerCase().includes(term) ||
        p.request_number?.toLowerCase().includes(term),
    );
  }, [procedures, searchTerm]);

  // Filtered exams
  const filteredExams = useMemo(() => {
    if (!searchTerm) return exams;
    const term = searchTerm.toLowerCase();
    return exams.filter(
      (e) =>
        e.exam_type?.toLowerCase().includes(term) ||
        e.status?.toLowerCase().includes(term),
    );
  }, [exams, searchTerm]);

  // Filtered history
  const filteredHistory = useMemo(() => {
    if (!searchTerm) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(
      (h) =>
        h.first_name?.toLowerCase().includes(term) ||
        h.last_name?.toLowerCase().includes(term) ||
        h.emr_number?.toLowerCase().includes(term) ||
        h.chief_complaint?.toLowerCase().includes(term) ||
        h.diagnosis?.toLowerCase().includes(term),
    );
  }, [history, searchTerm]);

  const aiQueuePatients = useMemo(() => {
    const combined = [...waitingQueue, ...activeSessions];
    const seen = new Set<string>();
    return combined.filter((patient) => {
      if (seen.has(patient.id)) return false;
      seen.add(patient.id);
      return true;
    });
  }, [waitingQueue, activeSessions]);

  useEffect(() => {
    if (!aiSelectedPatient) return;
    const stillVisible = aiQueuePatients.some(
      (patient) => patient.id === aiSelectedPatient.id,
    );
    if (!stillVisible) {
      setAiSelectedPatient(null);
    }
  }, [aiQueuePatients, aiSelectedPatient]);

  // Get icon component
  const IconComponent = getIconByName(config?.icon_name || null);

  // Handle errors - AFTER all hooks have been called
  if (isError) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-96 ${isDark ? 'text-red-400' : 'text-red-600'}`}
      >
        <AlertCircle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-sm">
          {error?.message || 'You do not have access to this specialty.'}
        </p>
      </div>
    );
  }

  // Loading state - AFTER all hooks have been called
  if (isLoading || !dashboard || !config || !stats) {
    return <SkeletonDashboard />;
  }

  // Action handlers
  const handleStartSession = async (queueId: string) => {
    // Find the patient from the queue
    let patient = queue.find((p) => p.id === queueId);
    if (!patient) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Patient not found in queue',
      });
      return;
    }

    try {
      // First, update the queue status to In Progress
      await actions.startSession.mutateAsync({ queueId });

      // Track the current session queue ID
      setCurrentSessionQueueId(queueId);

      // If encounter_id/visit_id not in patient data (RPC not updated), fetch from queue table
      if (!patient.encounter_id && !patient.visit_id) {
        log.info(
          '[SpecialtyClinicPage] Fetching encounter_id from queue table...',
        );
        const { data: queueData } = await supabase
          .from('queue')
          .select('visit_id, encounter_id')
          .eq('id', queueId)
          .single();

        if (queueData) {
          // Create enhanced patient object with encounter data
          patient = {
            ...patient,
            visit_id: queueData.visit_id,
            encounter_id: queueData.encounter_id,
          };
          log.info(
            '[SpecialtyClinicPage] Got encounter_id:',
            queueData.encounter_id,
          );
        }
      }

      // Load the specialty template
      if (specialtyCode) {
        setIsLoadingTemplate(true);
        try {
          const templateData = await getFullSpecialtyTemplate(specialtyCode);
          setSpecialtyTemplate(templateData?.template || null);
        } catch (templateErr) {
          log.warn('No specialty template found, using default form');
          setSpecialtyTemplate(null);
        } finally {
          setIsLoadingTemplate(false);
        }
      }

      // Set selected patient and open wizard
      setSelectedPatient(patient);
      setIsWizardOpen(true);

      showToast({
        type: 'success',
        title: 'Session Started',
        message: 'Patient session has been started. Complete the consultation.',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to start session';
      showToast({ type: 'error', title: 'Error', message });
    }
  };

  // Resume an in-progress session
  const handleResumeSession = async (queueId: string) => {
    // Find the patient from the queue (already in progress)
    let patient = queue.find((p) => p.id === queueId);
    if (!patient) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Session not found',
      });
      return;
    }

    try {
      // Validate session can be resumed
      await actions.resumeSession.mutateAsync({ queueId });

      // Track the current session queue ID
      setCurrentSessionQueueId(queueId);

      // If encounter_id/visit_id not in patient data (RPC not updated), fetch from queue table
      if (!patient.encounter_id && !patient.visit_id) {
        log.info(
          '[SpecialtyClinicPage] Fetching encounter_id from queue table...',
        );
        const { data: queueData } = await supabase
          .from('queue')
          .select('visit_id, encounter_id')
          .eq('id', queueId)
          .single();

        if (queueData) {
          // Create enhanced patient object with encounter data
          patient = {
            ...patient,
            visit_id: queueData.visit_id,
            encounter_id: queueData.encounter_id,
          };
          log.info(
            '[SpecialtyClinicPage] Got encounter_id:',
            queueData.encounter_id,
          );
        }
      }

      // Load the specialty template
      if (specialtyCode) {
        setIsLoadingTemplate(true);
        try {
          const templateData = await getFullSpecialtyTemplate(specialtyCode);
          setSpecialtyTemplate(templateData?.template || null);
        } catch (templateErr) {
          log.warn('No specialty template found, using default form');
          setSpecialtyTemplate(null);
        } finally {
          setIsLoadingTemplate(false);
        }
      }

      // Set selected patient and open wizard
      setSelectedPatient(patient);
      setIsWizardOpen(true);

      showToast({
        type: 'info',
        title: 'Session Resumed',
        message:
          'Continuing patient session. Remember to complete the consultation.',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to resume session';
      showToast({ type: 'error', title: 'Error', message });
    }
  };

  useEffect(() => {
    if (!dashboardQueueId || !queue.length) return;

    const launchKey = `${dashboardQueueAction}:${dashboardQueueId}`;
    if (dashboardLaunchHandledRef.current === launchKey) return;

    const queuePatient = queue.find(
      (patient) => patient.id === dashboardQueueId,
    );
    if (!queuePatient) return;

    dashboardLaunchHandledRef.current = launchKey;

    if (
      dashboardQueueAction === 'resume' ||
      queuePatient.status === 'In Progress'
    ) {
      void handleResumeSession(dashboardQueueId);
      return;
    }

    void handleStartSession(dashboardQueueId);
  }, [
    dashboardQueueAction,
    dashboardQueueId,
    handleResumeSession,
    handleStartSession,
    queue,
  ]);

  // Abandon a session (return patient to waiting queue)
  const handleAbandonSession = async (queueId: string) => {
    try {
      await actions.abandonSession.mutateAsync({ queueId });
      showToast({
        type: 'info',
        title: 'Session Abandoned',
        message: 'Patient has been returned to the waiting queue.',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to abandon session';
      showToast({ type: 'error', title: 'Error', message });
    }
  };

  // Handle wizard close - session remains In Progress for later resuming
  const handleWizardClose = () => {
    // Close wizard but keep session in progress
    // Patient can be resumed from Sessions tab
    setIsWizardOpen(false);
    setSelectedPatient(null);
    setCurrentSessionQueueId(null);
    refetch(); // Refresh the dashboard data

    // Show reminder that session is still active
    if (currentSessionQueueId) {
      showToast({
        type: 'warning',
        title: 'Session Paused',
        message:
          'Patient session is still in progress. Resume from Sessions tab or abandon to return patient to queue.',
      });
    }
  };

  // Handle consultation submit - actually saves the consultation to database
  const handleConsultationSubmit = async (
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
  ) => {
    // ====================================================================
    // ENCOUNTER-CENTRIC VALIDATION
    // ====================================================================
    const encounterId = data.encounter_id || data.visit_id;
    const patientId = data.patient_id;

    if (!encounterId) {
      showToast({
        type: 'error',
        title: 'Missing Encounter',
        message:
          'All clinical records must be tied to an encounter. Please select a patient from the queue.',
      });
      return;
    }

    if (!patientId) {
      showToast({
        type: 'error',
        title: 'Missing Patient',
        message: 'All clinical records must be tied to a patient patient number.',
      });
      return;
    }

    // Validate EMR → Encounter → Record linkage
    const linkageValidation = await validateRecordLinkage(
      patientId,
      encounterId,
      {
        recordType: 'consultation',
      },
    );

    if (!linkageValidation.isValid) {
      showToast({
        type: 'error',
        title: 'Record Linkage Error',
        message:
          linkageValidation.error ||
          'Invalid patient/encounter linkage. Please verify the encounter.',
      });
      log.error(
        '[SpecialtyClinicPage] Linkage validation failed:',
        linkageValidation,
      );
      return;
    }

    log.info(
      '[SpecialtyClinicPage] Record linkage validated - EMR:',
      linkageValidation.emrNumber,
      'Encounter:',
      encounterId,
    );
    // ====================================================================

    // CAPTURE queue ID before clearing state - needed to mark queue as completed after save
    const queueIdToComplete = currentSessionQueueId;

    // Clear session state BEFORE closing to prevent "Session Paused" warning
    setCurrentSessionQueueId(null);
    setIsWizardOpen(false);
    setSelectedPatient(null);

    // Show immediate feedback
    showToast({
      type: 'info',
      title: 'Saving...',
      message: 'Specialty consultation is being saved in the background.',
    });

    try {
      // Build consultation payload with specialty data
      const consultationPayload: CreateConsultationDTO = {
        ...data,
        // Add specialty template reference if available
        ...(specialtyData && {
          specialty_code: specialtyData.specialty_code,
          specialty_template_id: specialtyData.specialty_template_id,
          specialty_template_version: specialtyData.specialty_template_version,
          specialty_data: specialtyData.form_data,
        }),
      };

      log.info(
        '[SpecialtyClinicPage] Saving consultation with specialty data:',
        {
          specialty_code: specialtyData?.specialty_code,
          specialty_template_id: specialtyData?.specialty_template_id,
          form_data_keys: specialtyData?.form_data
            ? Object.keys(specialtyData.form_data)
            : [],
        },
      );

      // Create consultation
      const consultation =
        await createConsultation.mutateAsync(consultationPayload);
      log.info(
        '[SpecialtyClinicPage] Consultation created:',
        consultation.consultation_id,
      );

      // Create treatment plan with nursing tasks if any tasks were specified
      if (
        treatmentTasks &&
        treatmentTasks.length > 0 &&
        consultation.encounter_id
      ) {
        try {
          const patientUuidForPlan = await resolvePatientUuid(
            consultation.patient_id,
          );

          if (patientUuidForPlan) {
            let diagnosisText = '';
            if (consultation.diagnosis) {
              if (Array.isArray(consultation.diagnosis)) {
                diagnosisText = consultation.diagnosis[0] || '';
              } else if (typeof consultation.diagnosis === 'string') {
                diagnosisText = consultation.diagnosis.split(';')[0].trim();
              }
            }
            const treatmentPlanTitle = diagnosisText
              ? `Treatment Plan - ${diagnosisText}`
              : 'Treatment Plan';

            await createTreatmentPlan({
              encounter_id: consultation.encounter_id,
              patient_id: patientUuidForPlan,
              consultation_id: consultation.consultation_id,
              title: treatmentPlanTitle,
              description: consultation.treatment_plan || undefined,
              instructions: consultation.treatment_plan || undefined,
              tasks: treatmentTasks,
            });

            log.info(
              '[SpecialtyClinicPage] Treatment plan created with',
              treatmentTasks.length,
              'tasks',
            );
          }
        } catch (treatmentPlanError) {
          log.error('Failed to create treatment plan:', treatmentPlanError);
        }
      }

      // Create batch orders if any
      const hasOrders =
        labOrders.length > 0 ||
        radiologyOrders.length > 0 ||
        prescriptions.length > 0 ||
        (procedureOrders && procedureOrders.length > 0);

      if (hasOrders) {
        const diagnosisArray: string[] = [];
        if (consultation.diagnosis) {
          if (Array.isArray(consultation.diagnosis)) {
            diagnosisArray.push(...consultation.diagnosis);
          } else if (typeof consultation.diagnosis === 'string') {
            diagnosisArray.push(
              ...consultation.diagnosis
                .split(';')
                .map((d: string) => d.trim())
                .filter(Boolean),
            );
          }
        }

        const clinicalFindingsParts: string[] = [];
        if ((consultation as any).examination_findings) {
          clinicalFindingsParts.push(
            `Examination Findings: ${(consultation as any).examination_findings}`,
          );
        }
        if (specialtyData?.form_data) {
          const specialtyNarrative = formatSpecialtyExamNarrative(
            specialtyData.specialty_code,
            specialtyData.form_data,
          );
          if (specialtyNarrative) {
            clinicalFindingsParts.push(specialtyNarrative);
          }
        }
        const clinicalFindings = clinicalFindingsParts.join('\n\n');

        const patientName = selectedPatient
          ? `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim()
          : undefined;
        const patientEmrNumber = selectedPatient?.emr_number;

        await createBatchOrders({
          consultationId: consultation.consultation_id,
          patientId: consultation.patient_id,
          visitId: consultation.visit_id,
          encounterId: consultation.encounter_id!,
          orderedBy: consultation.doctor_id,
          labOrders,
          radiologyOrders,
          prescriptions,
          procedureOrders: procedureOrders || [],
          diagnosis: diagnosisArray,
          clinicalFindings,
          patientName,
          patientEmrNumber,
        });

        log.info('[SpecialtyClinicPage] Batch orders created');
      }

      // Create Clinical Requests for Admission Orders
      // These go through approval workflow rather than direct creation
      if (admissionOrder) {
        const resolvedEncounterId =
          consultation.encounter_id || consultation.visit_id;
        const staffUuid = staff?.id;
        let resolvedPatientUuid: string | null = null;

        try {
          resolvedPatientUuid = await resolvePatientUuid(
            consultation.patient_id,
          );
        } catch (e) {
          log.error(
            '[SpecialtyClinicPage] Failed to resolve patient UUID for admission request:',
            e,
          );
        }

        if (resolvedEncounterId && resolvedPatientUuid && staffUuid) {
          const clinicalRequests: CreateClinicalRequestDTO[] = [
            {
              patient_id: resolvedPatientUuid,
              encounter_id: resolvedEncounterId,
              requesting_doctor_id: staffUuid,
              request_type: 'Admission',
              clinical_reason: admissionOrder.reason || 'Admission requested',
              urgency:
                admissionOrder.priority === 'Emergency'
                  ? 'Emergency'
                  : admissionOrder.priority === 'Urgent'
                    ? 'Urgent'
                    : 'Routine',
              target_ward_id: admissionOrder.ward_id,
              admission_type: admissionOrder.admission_type as
                | 'Emergency'
                | 'Elective',
              expected_duration: admissionOrder.expected_duration,
              special_requirements: admissionOrder.special_requirements,
              created_by: staffUuid,
            },
          ];

          try {
            await createBulkClinicalRequests(clinicalRequests);
            log.info(
              '[SpecialtyClinicPage] Admission request created successfully',
            );
          } catch (admissionErr) {
            log.error(
              '[SpecialtyClinicPage] Failed to create admission request:',
              admissionErr,
            );
            showToast({
              type: 'warning',
              title: 'Admission Request Issue',
              message:
                'Could not create admission request. Please try again from clinical requests.',
            });
          }
        } else {
          log.warn(
            '[SpecialtyClinicPage] Cannot create admission request - missing encounter, patient UUID, or staff UUID',
          );
          showToast({
            type: 'warning',
            title: 'Admission Request Not Created',
            message:
              'Admission request requires an active encounter. Please ensure the patient has an active encounter.',
          });
        }
      }

      // Create Internal Specialty Referral Requests
      if (specialtyReferrals && specialtyReferrals.length > 0) {
        const resolvedEncounterId =
          consultation.encounter_id || consultation.visit_id;
        const staffUuid = staff?.id;
        let resolvedPatientUuid: string | null = null;

        try {
          resolvedPatientUuid = await resolvePatientUuid(
            consultation.patient_id,
          );
        } catch (e) {
          log.error(
            '[SpecialtyClinicPage] Failed to resolve patient UUID for referrals:',
            e,
          );
        }

        if (resolvedEncounterId && resolvedPatientUuid && staffUuid) {
          const referralRequests: CreateClinicalRequestDTO[] =
            specialtyReferrals.map(
              (referral) =>
                ({
                  patient_id: resolvedPatientUuid!,
                  encounter_id: resolvedEncounterId,
                  requesting_doctor_id: staffUuid,
                  request_type: 'Referral' as const,
                  clinical_reason: referral.reason,
                  urgency: referral.urgency,
                  specialty_module: referral.specialty.toLowerCase(),
                  notes: `Internal referral to ${referral.specialty} - ${referral.reason}`,
                  created_by: staffUuid,
                  referral_workflow_status: 'Pending_Encounter_Office',
                  status: 'Under_Review',
                }) as any,
            );

          try {
            await createBulkClinicalRequests(referralRequests);
            log.info(
              '[SpecialtyClinicPage] Internal referrals created:',
              specialtyReferrals.length,
            );
          } catch (refErr) {
            log.error(
              '[SpecialtyClinicPage] Failed to create internal referrals:',
              refErr,
            );
            showToast({
              type: 'warning',
              title: 'Referral Issue',
              message:
                'Some internal referrals could not be created. Please try again.',
            });
          }
        }
      }

      // Process External NHIS Referral
      if (isNhisFeatureEnabled() && externalNhisReferral) {
        const resolvedEncounterId =
          consultation.encounter_id || consultation.visit_id;
        const staffUuid = staff?.id;
        let resolvedPatientUuid: string | null = null;

        try {
          resolvedPatientUuid = await resolvePatientUuid(
            consultation.patient_id,
          );
        } catch (e) {
          log.error(
            '[SpecialtyClinicPage] Failed to resolve patient UUID for external referral:',
            e,
          );
        }

        if (resolvedEncounterId && resolvedPatientUuid && staffUuid) {
          try {
            await createOutgoingReferral({
              patient_id: resolvedPatientUuid,
              source_encounter_id: resolvedEncounterId,
              requesting_doctor_id: staffUuid,
              clinical_findings: externalNhisReferral.clinicalFindings,
              investigation_findings:
                externalNhisReferral.investigationFindings,
              provisional_diagnosis: externalNhisReferral.provisionalDiagnosis,
              reason_for_referral: externalNhisReferral.reason,
              additional_notes: externalNhisReferral.doctorName
                ? `Destination: ${externalNhisReferral.facilityName}, Doctor: ${externalNhisReferral.doctorName}`
                : `Destination: ${externalNhisReferral.facilityName}`,
              urgency: externalNhisReferral.urgency,
              requested_by: staffUuid,
            });
            log.info(
              '[SpecialtyClinicPage] External NHIS referral created for:',
              externalNhisReferral.facilityName,
            );
          } catch (extRefErr) {
            log.error(
              '[SpecialtyClinicPage] Failed to create external NHIS referral:',
              extRefErr,
            );
            showToast({
              type: 'warning',
              title: 'External Referral Issue',
              message: `Could not create external referral to ${externalNhisReferral.facilityName}. Please try from NHIS desk.`,
            });
          }
        }
      }

      // Create Specialty Care Plan (config-driven, any supported specialty)
      const cpConfig = getCarePlanConfig(specialtyData?.specialty_code ?? '');
      if (
        cpConfig &&
        specialtyData?.form_data?._care_plan?.create_care_plan === true
      ) {
        const cpDraft = specialtyData.form_data._care_plan as {
          plan_type: string;
          goals_text: string;
          frequency: string;
          expected_duration: string;
          total_sessions: string;
          therapy_type: string;
          medications: string;
          safety_plan: string;
        };
        try {
          const resolvedPatientUuid = await resolvePatientUuid(
            consultation.patient_id,
          );
          if (resolvedPatientUuid && cpDraft.plan_type) {
            const goals = cpDraft.goals_text
              .split(',')
              .map((g) => g.trim())
              .filter(Boolean);
            const diagnosis = Array.isArray(consultation.diagnosis)
              ? consultation.diagnosis
              : typeof consultation.diagnosis === 'string'
                ? consultation.diagnosis
                    .split(';')
                    .map((d: string) => d.trim())
                    .filter(Boolean)
                : [];
            const planLabel =
              cpConfig.plan_types.find((p) => p.value === cpDraft.plan_type)
                ?.label ?? cpDraft.plan_type;
            await createCareplan({
              patient_id: resolvedPatientUuid,
              encounter_id: consultation.encounter_id || undefined,
              specialty_code: cpConfig.specialty_code,
              plan_type: cpDraft.plan_type,
              plan_name: `${cpConfig.section_title} — ${planLabel}`,
              diagnosis,
              goals,
              frequency: cpDraft.frequency || cpConfig.default_frequency,
              expected_duration:
                cpDraft.expected_duration || cpConfig.default_duration,
              total_sessions: cpDraft.total_sessions
                ? parseInt(cpDraft.total_sessions, 10)
                : undefined,
              baseline_data: {
                therapy_type: cpDraft.therapy_type || undefined,
                medications: cpDraft.medications || undefined,
                safety_plan: cpDraft.safety_plan || undefined,
              },
              created_by: staff!.id,
            });
            log.info(
              '[SpecialtyClinicPage] Care plan created for patient',
              resolvedPatientUuid,
              'specialty',
              cpConfig.specialty_code,
            );
          }
        } catch (carePlanErr) {
          log.error(
            '[SpecialtyClinicPage] Failed to create care plan:',
            carePlanErr,
          );
          showToast({
            type: 'warning',
            title: 'Care Plan Issue',
            message:
              'Consultation saved, but the care plan could not be created. Please add it manually from the Care Plans tab.',
          });
        }
      }

      // Mark the queue entry as Completed so patient disappears from queue
      if (queueIdToComplete) {
        try {
          await actions.completeSession.mutateAsync({
            queueId: queueIdToComplete,
          });
          log.info(
            '[SpecialtyClinicPage] Queue entry marked as Completed:',
            queueIdToComplete,
          );
        } catch (queueErr) {
          log.error(
            '[SpecialtyClinicPage] Failed to complete queue entry:',
            queueErr,
          );
          // Don't fail the whole operation - consultation is already saved
        }
      }

      refetch(); // Refresh the dashboard data

      showToast({
        type: 'success',
        title: 'Consultation Completed',
        message: 'Specialty consultation has been saved successfully.',
      });
    } catch (err: unknown) {
      log.error('[SpecialtyClinicPage] Failed to save consultation:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to save consultation';
      showToast({ type: 'error', title: 'Error', message });
      // Don't throw - we've already closed the wizard
    }
  };

  const handleAcceptReferral = async (requestId: string) => {
    try {
      await actions.acceptReferral.mutateAsync({ requestId });
      showToast({
        type: 'success',
        title: 'Referral Accepted',
        message: 'Patient will be added to your queue.',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to accept referral';
      showToast({ type: 'error', title: 'Error', message });
    }
  };

  const handleRejectReferral = async (requestId: string, reason: string) => {
    try {
      await actions.rejectReferral.mutateAsync({ requestId, reason });
      showToast({
        type: 'info',
        title: 'Referral Rejected',
        message: 'The referring doctor will be notified.',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to reject referral';
      showToast({ type: 'error', title: 'Error', message });
    }
  };

  const handleCompleteSession = async (queueId: string) => {
    try {
      await actions.completeSession.mutateAsync({ queueId });
      showToast({
        type: 'success',
        title: 'Session Completed',
        message: 'Patient session has been completed.',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to complete session';
      showToast({ type: 'error', title: 'Error', message });
    }
  };

  const tabs = useMemo(
    () =>
      [
        'queue',
        'referrals',
        'procedures',
        'exams',
        'history',
        ...(specialtyHasCarePlan(specialtyCode ?? '') ? ['care_plans'] : []),
      ] as ViewTab[],
    [specialtyCode],
  );

  return (
    <div
      className={`flex min-h-full flex-col font-sans ${isDark ? 'bg-slate-900 text-white' : 'bg-[#f8f9fa] text-slate-800'}`}
    >
      <div className="px-6 py-10 sm:px-10 lg:px-12 max-w-[1600px] mx-auto w-full flex-1 flex flex-col">
        <div
          className={`relative mb-8 overflow-hidden rounded-[2rem] border px-6 py-7 sm:px-8 ${isDark ? 'border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900' : 'border-teal-100 bg-gradient-to-br from-white via-teal-50/70 to-slate-50'}`}
        >
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-teal-100/40 blur-3xl dark:bg-teal-500/10" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? 'bg-slate-700 text-teal-300' : 'bg-[#E9783F] text-white'}`}
                >
                  <IconComponent className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Specialty Clinic Workspace
                  </p>
                  <h1 className="text-[30px] font-bold tracking-tight text-slate-900 dark:text-white">
                    {config.specialty_name} Dashboard
                  </h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                <span>{format(new Date(), 'EEEE, do MMMM')}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-[#11151C] dark:text-teal-300">
                  {stats.waiting + stats.in_progress} patients across waiting
                  and active sessions
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 self-start">
              <button
                type="button"
                onClick={() => refetch()}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-colors ${isDark ? 'border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <div
                className={`font-black text-xs uppercase tracking-[0.22em] px-4 py-2 rounded-full shadow-sm border ${isDark ? 'bg-teal-900/40 text-teal-300 border-teal-800' : 'bg-[#ccfbf1] text-[#11151C] border-teal-100'}`}
              >
                Clinic Active
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 sm:gap-5 mb-8">
          <SpecialtyMetricCard
            title="Waiting"
            value={stats.waiting}
            icon={<Clock className="h-4 w-4" />}
            subtitle="Patients not yet started"
            tone="waiting"
            isDark={isDark}
          />
          <SpecialtyMetricCard
            title="In Progress"
            value={stats.in_progress}
            icon={<Play className="h-4 w-4" />}
            subtitle="Assigned active sessions"
            tone="active"
            isDark={isDark}
          />
          <SpecialtyMetricCard
            title="Completed Today"
            value={stats.completed_today}
            icon={<CheckCircle className="h-4 w-4" />}
            subtitle="Sessions closed today"
            tone="done"
            isDark={isDark}
          />
          <SpecialtyMetricCard
            title="Pending Referrals"
            value={stats.pending_referrals}
            icon={<ClipboardList className="h-4 w-4" />}
            subtitle="Awaiting specialist review"
            tone="referrals"
            isDark={isDark}
          />
          <SpecialtyMetricCard
            title="Pending Procedures"
            value={stats.pending_procedures}
            icon={<Syringe className="h-4 w-4" />}
            subtitle="Procedural worklist"
            tone="procedures"
            isDark={isDark}
          />
          <SpecialtyMetricCard
            title="Total Exams"
            value={stats.total_exams}
            icon={<ClipboardCheck className="h-4 w-4" />}
            subtitle="Assessments on record"
            tone="exams"
            isDark={isDark}
          />
        </div>

        {/* AI assistants — collapsible to give the workspace more room */}
        <details className="group mb-8 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70 open:shadow-md">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/80 px-5 py-4 sm:px-6 dark:bg-slate-800/70 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Sparkles className="h-5 w-5 text-[#11151C] shrink-0" />
              {config.specialty_name} AI Assistants
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
              Optional tools
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="border-t border-slate-100 px-5 pb-6 pt-3 dark:border-slate-700 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Open the assistant hub to configure models or start a session.
              </p>
              <button
                type="button"
                onClick={() => setIsAIDashboardOpen(true)}
                className="text-[11px] font-black text-[#11151C] dark:text-teal-300 uppercase tracking-widest hover:underline"
              >
                Configure models
              </button>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-100 dark:border-slate-700 flex items-start gap-4">
                <div className="bg-[#ccfbf1]/60 dark:bg-teal-900/40 p-3.5 rounded-2xl text-[#11151C] dark:text-teal-300 shrink-0">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-slate-900 dark:text-white tracking-tight">
                    Diagnostic Analysis Assistant
                  </h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-300 mt-1.5 leading-relaxed">
                    Neural analysis for diagnosis detection tailored for{' '}
                    {config.specialty_name.toLowerCase()} workflows.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAIDashboardOpen(true)}
                    className="mt-4 text-[10px] font-black text-[#11151C] dark:text-teal-300 uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                  >
                    Analyze data <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-100 dark:border-slate-700 flex items-start gap-4">
                <div className="bg-[#ccfbf1]/60 dark:bg-teal-900/40 p-3.5 rounded-2xl text-[#11151C] dark:text-teal-300 shrink-0">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-[15px] text-slate-900 dark:text-white tracking-tight">
                    Clinical Scribe Pro
                  </h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-300 mt-1.5 leading-relaxed">
                    Ambient capture for structured consultation notes.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAIDashboardOpen(true)}
                    className="mt-4 text-[10px] font-black text-[#11151C] dark:text-teal-300 uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                  >
                    Start session <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </details>

        {/* Two-Column Layout (Left: Lists, Right: Alerts) */}
        <div className="flex flex-col 2xl:flex-row gap-8 2xl:gap-10 flex-1 min-h-0">
          {/* Left Content (Tabs & List) */}
          <div className="flex-[2.5] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/85 dark:shadow-none flex flex-col">
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/70 sm:px-6">
              <div className="flex flex-wrap gap-2 overflow-x-auto">
                {tabs.map((tab) => {
                  const label = tabLabel(tab);
                  const count = tabCount(tab, stats);
                  const Icon = tabIcon(tab);
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold transition-all whitespace-nowrap ${isActive ? 'bg-[#E9783F] text-white shadow-sm shadow-teal-900/20' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {count !== null && (
                        <span
                          className={`ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white p-5 dark:bg-slate-900/85 sm:p-6">
              {/* Internal Tabs Render */}
              {activeTab === 'queue' && (
                <QueueTab
                  waitingQueue={filteredQueue}
                  activeSessions={filteredSessions}
                  onStartSession={handleStartSession}
                  onResumeSession={handleResumeSession}
                  onAbandonSession={handleAbandonSession}
                  isStarting={actions.startSession.isPending}
                  isResuming={actions.resumeSession.isPending}
                  isAbandoning={actions.abandonSession.isPending}
                  isDark={isDark}
                />
              )}
              {activeTab === 'referrals' && (
                <ReferralsTab
                  referrals={filteredReferrals}
                  onAccept={handleAcceptReferral}
                  onReject={handleRejectReferral}
                  isProcessing={
                    actions.acceptReferral.isPending ||
                    actions.rejectReferral.isPending
                  }
                  isDark={isDark}
                />
              )}
              {activeTab === 'procedures' && (
                <ProceduresTab
                  procedures={filteredProcedures}
                  specialtyName={config.specialty_name}
                  isDark={isDark}
                />
              )}
              {activeTab === 'exams' && (
                <ExamsTab
                  exams={filteredExams}
                  specialtyName={config.specialty_name}
                  isDark={isDark}
                  onViewTimeline={(examId) => {
                    setTimelineSelectedExamId(examId);
                    setActiveTab('history');
                  }}
                />
              )}
              {activeTab === 'history' && (
                <SpecialtyConsultationTimeline
                  history={filteredHistory}
                  specialtyName={config.specialty_name}
                  isDark={isDark}
                  initialSelectedEncounterId={timelineSelectedExamId}
                  onInitialSelectionClosed={() => setTimelineSelectedExamId(null)}
                />
              )}
              {activeTab === 'care_plans' &&
                specialtyHasCarePlan(specialtyCode ?? '') && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm h-full">
                    <SpecialtyCarePlanDashboard
                      specialtyCode={specialtyCode ?? ''}
                    />
                  </div>
                )}
            </div>
          </div>

          {/* Right panel: same clinical alerts + treatment inbox as other consultation dashboards */}
          <div className="flex flex-none flex-col 2xl:w-[min(20rem,100%)] 2xl:max-w-[20rem]">
            <ConsultationDashboardAlertsPanel
              patientIdForLookup={selectedPatient?.patient_id}
              patientDisplayName={
                selectedPatient
                  ? `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim()
                  : undefined
              }
              encounter={specialtyPatientAlertsEncounter}
              isNightMode={isDark}
            >
              {referrals.length > 0 && (
                <div className="mt-6 space-y-4">
                  {referrals.slice(0, 1).map((ref) => (
                    <div
                      key={ref.id}
                      className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#E9783F]" />
                      <div className="p-5">
                        <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#11151C]">
                          REFERRAL TASK
                          <span className="font-bold text-slate-400">
                            {ref.created_at
                              ? formatDistanceToNow(new Date(ref.created_at), {
                                  addSuffix: true,
                                })
                              : ''}
                          </span>
                        </div>
                        <h4 className="mb-2 font-bold leading-tight text-slate-900 dark:text-white">
                          Incoming Referral: {ref.first_name} {ref.last_name}
                        </h4>
                        <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          Query:{' '}
                          {ref.clinical_notes ||
                            'Consultation request from GP.'}
                        </p>
                        <Button
                          variant="outline"
                          className="w-full rounded-xl border-slate-200 py-2 text-[11px] font-bold text-slate-700"
                          onClick={() => setActiveTab('referrals')}
                        >
                          Schedule Triage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ConsultationDashboardAlertsPanel>
          </div>
        </div>
      </div>

      {/* Specialty Consultation Wizard */}
      {selectedPatient && (
        <SpecialtyConsultationWizard
          isOpen={isWizardOpen}
          onClose={handleWizardClose}
          onSubmit={handleConsultationSubmit}
          isLoading={isLoadingTemplate}
          preselectedPatient={
            {
              id: selectedPatient.patient_id,
              patient_id: selectedPatient.patient_id,
              first_name: selectedPatient.first_name,
              surname: selectedPatient.last_name,
              emr_number: selectedPatient.emr_number,
            } as unknown as PatientDTO
          }
          visitId={selectedPatient.visit_id || selectedPatient.encounter_id}
          encounterId={selectedPatient.encounter_id || selectedPatient.visit_id}
          specialtyCode={specialtyCode || ''}
          specialtyName={config.specialty_name}
          template={specialtyTemplate}
        />
      )}

      {/* AI Assistant Dashboard Panel Modal */}
      {isAIDashboardOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsAIDashboardOpen(false)}
          />
          <div className="relative w-full max-w-5xl h-[85vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#1E232B] to-teal-700 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 rounded-xl p-2 border border-white/20">
                  
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">
                    XenoCare AI Assistants
                  </h2>
                  <p className="text-[10px] font-bold text-teal-100 uppercase tracking-widest">
                    Intelligent Diagnostic Suite
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={aiSelectedPatient?.id || ''}
                    onChange={(e) => {
                      const next =
                        aiQueuePatients.find(
                          (patient) => patient.id === e.target.value,
                        ) || null;
                      setAiSelectedPatient(next);
                    }}
                    className="appearance-none text-xs font-bold text-slate-800 rounded-full border-none bg-white/90 pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-white/60 min-w-[200px]"
                    disabled={aiQueuePatients.length === 0}
                  >
                    <option value="">
                      {aiQueuePatients.length === 0
                        ? 'No active queue patients'
                        : 'Select patient context'}
                    </option>
                    {aiQueuePatients.map((patient) => {
                      const fullName =
                        `${patient.first_name || ''} ${patient.last_name || ''}`.trim() ||
                        'Unknown Patient';
                      return (
                        <option key={patient.id} value={patient.id}>
                          {fullName} •{' '}
                          {patient.emr_number || patient.patient_id}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronRight className="h-3 w-3 absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none rotate-90" />
                </div>
                <button
                  onClick={() => setIsAIDashboardOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-slate-50">
              <AIChatPanel
                key={aiSelectedPatient?.id || 'no-patient'}
                patientId={aiSelectedPatient?.patient_id || null}
                patientName={
                  aiSelectedPatient
                    ? `${aiSelectedPatient.first_name || ''} ${aiSelectedPatient.last_name || ''}`.trim()
                    : undefined
                }
                emrNumber={aiSelectedPatient?.emr_number ?? undefined}
                facilityId={staff?.facility_id ?? ''}
                userId={staff?.id ?? ''}
                visitDate={aiSelectedPatient?.created_at}
                department={config.specialty_name}
                variant="minimal"
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB COMPONENTS
// =============================================================================

interface QueueTabProps {
  waitingQueue: SpecialtyQueuePatient[];
  activeSessions: SpecialtyQueuePatient[];
  onStartSession: (queueId: string) => void;
  onResumeSession: (queueId: string) => void;
  onAbandonSession: (queueId: string) => void;
  isStarting: boolean;
  isResuming: boolean;
  isAbandoning: boolean;
  isDark: boolean;
}

function QueueTab({
  waitingQueue,
  activeSessions,
  onStartSession,
  onResumeSession,
  onAbandonSession,
  isStarting,
  isResuming,
  isAbandoning,
  isDark,
}: QueueTabProps) {
  if (activeSessions.length === 0 && waitingQueue.length === 0) {
    return (
      <div
        className={`rounded-[1.75rem] border border-dashed px-6 py-20 text-center ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500 bg-slate-50/60'}`}
      >
        <Users className="h-12 w-12 mx-auto mb-4 opacity-30 text-[#11151C]" />
        <p className="font-bold tracking-tight">No patients in queue</p>
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-300">
          New specialty patients and assigned sessions will appear here.
        </p>
      </div>
    );
  }

  const renderQueueRows = (
    patients: SpecialtyQueuePatient[],
    section: 'assigned' | 'waiting',
  ) => {
    if (patients.length === 0) {
      return (
        <div
          className={`rounded-2xl border border-dashed px-5 py-8 text-center ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 bg-slate-50/70 text-slate-500'}`}
        >
          <p className="text-sm font-semibold">
            {section === 'assigned'
              ? 'No active patients assigned to you'
              : 'No patients waiting in this queue'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {patients.map((patient) => {
          const isWait =
            patient.status === 'Waiting' || patient.status === 'Called';
          const initials =
            `${patient.first_name?.[0] || ''}${patient.last_name?.[0] || ''}`.toUpperCase();

          return (
            <div
              key={patient.id}
              className={`rounded-[1.25rem] border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(120px,.7fr)_minmax(120px,.6fr)_auto] lg:items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ${isDark ? 'border-slate-600 bg-slate-700 text-slate-200' : 'border-teal-100 bg-teal-50 text-[#11151C]'}`}
                  >
                    {initials || <User className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {patient.first_name} {patient.last_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {patient.emr_number || patient.patient_id?.slice(0, 8)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Arrival
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {format(new Date(patient.created_at), 'hh:mm a')}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Status
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isWait ? (isDark ? 'bg-teal-900/40 text-teal-300' : 'bg-[#ccfbf1] text-[#11151C]') : isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}
                    >
                      {isWait ? 'Waiting' : 'Assigned'}
                    </span>
                    {patient.priority && patient.priority !== 'Normal' && (
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isDark ? 'bg-rose-900/40 text-rose-300' : 'bg-rose-100 text-rose-700'}`}
                      >
                        {patient.priority}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-start gap-2 lg:justify-end">
                  {isWait ? (
                    <Button
                      onClick={() => onStartSession(patient.id)}
                      disabled={isStarting}
                      className="bg-[#E9783F] hover:bg-[#0a4a44] text-white rounded-full px-5 py-2 h-auto text-[11px] font-bold shadow-sm min-w-[88px]"
                    >
                      Start
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => onResumeSession(patient.id)}
                        disabled={isResuming || isAbandoning}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 py-2 h-auto text-[11px] font-bold shadow-sm"
                      >
                        Resume
                      </Button>
                      <Button
                        onClick={() => onAbandonSession(patient.id)}
                        variant="ghost"
                        disabled={isResuming || isAbandoning}
                        className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full h-9 w-9 p-0"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div
        className={`overflow-hidden rounded-[1.75rem] border ${isDark ? 'border-slate-700 bg-slate-950/70' : 'border-slate-200 bg-white shadow-sm'}`}
      >
        <div
          className={`flex items-center justify-between gap-4 border-b px-5 py-4 ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/70'}`}
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
              Active Sessions
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              Patients already assigned to you
            </h3>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${isDark ? 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/20' : 'bg-indigo-100 text-indigo-700'}`}
          >
            {activeSessions.length}
          </span>
        </div>
        <div className="p-5">{renderQueueRows(activeSessions, 'assigned')}</div>
      </div>

      <div
        className={`overflow-hidden rounded-[1.75rem] border ${isDark ? 'border-slate-700 bg-slate-950/70' : 'border-slate-200 bg-white shadow-sm'}`}
      >
        <div
          className={`flex items-center justify-between gap-4 border-b px-5 py-4 ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/70'}`}
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
              Waiting Queue
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              Patients waiting to be picked up
            </h3>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${isDark ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/20' : 'bg-[#ccfbf1] text-[#11151C]'}`}
          >
            {waitingQueue.length}
          </span>
        </div>
        <div className="p-5">{renderQueueRows(waitingQueue, 'waiting')}</div>
      </div>
    </div>
  );
}

interface ReferralsTabProps {
  referrals: SpecialtyReferral[];
  onAccept: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  isProcessing: boolean;
  isDark: boolean;
}

function ReferralsTab({
  referrals,
  onAccept,
  onReject,
  isProcessing,
  isDark,
}: ReferralsTabProps) {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (referrals.length === 0) {
    return (
      <div
        className={`rounded-[1.75rem] border border-dashed px-6 py-20 text-center ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500 bg-slate-50/60'}`}
      >
        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30 text-[#11151C]" />
        <p className="font-bold tracking-tight">No pending referrals</p>
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-300">
          Incoming specialty referrals will appear here for review.
        </p>
      </div>
    );
  }

  const handleRejectConfirm = () => {
    if (rejectId && rejectReason.trim()) {
      onReject(rejectId, rejectReason);
      setRejectId(null);
      setRejectReason('');
    }
  };

  return (
    <div className="space-y-3">
      {referrals.map((req) => {
        const initials =
          `${req.first_name?.[0] || ''}${req.last_name?.[0] || ''}`.toUpperCase();
        const urgencyStyle =
          req.urgency === 'Urgent' || req.urgency === 'Emergency'
            ? isDark
              ? 'bg-rose-900/40 text-rose-300'
              : 'bg-rose-100 text-rose-700'
            : isDark
              ? 'bg-teal-900/40 text-teal-300'
              : 'bg-[#ccfbf1] text-[#11151C]';

        return (
          <div
            key={req.id}
            className={`relative rounded-[1.25rem] border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(100px,.6fr)_minmax(0,1.2fr)_auto] lg:items-center">
              {/* Patient */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ${isDark ? 'border-slate-600 bg-slate-700 text-slate-200' : 'border-indigo-100 bg-indigo-50 text-indigo-700'}`}
                >
                  {initials || <User className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {req.first_name} {req.last_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {req.emr_number} &middot; {req.request_number}
                  </p>
                </div>
              </div>

              {/* Urgency + Status */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${urgencyStyle}`}
                >
                  {req.urgency || 'Routine'}
                </span>
              </div>

              {/* Referring Doctor + Notes */}
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Referred by
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Dr. {req.requesting_doctor_first} {req.requesting_doctor_last}
                </p>
                {req.clinical_notes && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {req.clinical_notes}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-start gap-2 lg:justify-end">
                {rejectId === req.id ? (
                  <div
                    className={`flex flex-col gap-2 rounded-2xl border p-3 shadow-lg ${isDark ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-white'}`}
                  >
                    <Input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Rejection reason..."
                      className="h-8 text-xs rounded-xl"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRejectId(null)}
                        className="h-7 text-[10px] rounded-full"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleRejectConfirm}
                        disabled={!rejectReason.trim()}
                        className="h-7 bg-rose-600 hover:bg-rose-700 text-white text-[10px] rounded-full px-4"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => onAccept(req.id)}
                      className="bg-[#E9783F] hover:bg-[#0a4a44] text-white rounded-full px-5 py-2 h-auto text-[11px] font-bold shadow-sm min-w-[88px]"
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => setRejectId(req.id)}
                      variant="ghost"
                      className="text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full h-9 w-9 p-0"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface HistoryTabProps {
  history: SpecialtyConsultationHistory[];
  specialtyName: string;
  isDark: boolean;
}

function HistoryTab({ history, specialtyName, isDark }: HistoryTabProps) {
  const [selectedConsultation, setSelectedConsultation] =
    useState<SpecialtyConsultationHistory | null>(null);
  const [historySearch, setHistorySearch] = useState('');

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const q = historySearch.toLowerCase();
    return history.filter(
      (c) =>
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.emr_number?.toLowerCase().includes(q) ||
        c.diagnosis?.toLowerCase().includes(q) ||
        c.chief_complaint?.toLowerCase().includes(q),
    );
  }, [history, historySearch]);

  if (history.length === 0) {
    return (
      <div
        className={`text-center py-20 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-30 text-[#11151C]" />
        <p className="font-bold tracking-tight">No Consultation History</p>
        <p className="text-xs text-slate-400 mt-2">
          Completed consultations for {specialtyName} will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Search Header */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search patients, EMR, diagnosis..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 text-sm rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-[#11151C]/50 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
            }`}
          />
        </div>
      </div>

      <div className="hidden lg:grid grid-cols-12 gap-4 px-6 pb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <div className="col-span-3">Patient</div>
        <div className="col-span-2">Date</div>
        <div className="col-span-3">Clinician</div>
        <div className="col-span-2">Diagnosis</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>

      <div className="space-y-2.5">
        {filteredHistory.map((consultation) => {
          const initials =
            `${consultation.first_name?.[0] || ''}${consultation.last_name?.[0] || ''}`.toUpperCase();
          const isCompleted =
            consultation.status?.toLowerCase() === 'completed';

          return (
            <div
              key={consultation.id}
              onClick={() => setSelectedConsultation(consultation)}
              className={`rounded-[1.25rem] p-4 lg:p-3 shadow-sm border flex flex-col lg:grid lg:grid-cols-12 gap-4 items-center transition-all hover:shadow-md cursor-pointer ${isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-100 hover:border-[#11151C]/30'}`}
            >
              {/* PATIENT */}
              <div className="col-span-3 flex items-center gap-3 w-full lg:pl-2">
                <div
                  className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm border ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                >
                  {initials || <User className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[13px] text-slate-900 dark:text-white truncate">
                    {consultation.first_name} {consultation.last_name}
                  </p>
                  <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">
                    {consultation.emr_number ||
                      consultation.patient_id?.slice(0, 8)}
                  </p>
                </div>
              </div>

              {/* DATE */}
              <div className="col-span-2 text-[12px] font-bold text-slate-700 dark:text-slate-300 w-full flex items-center">
                {consultation.consultation_date
                  ? format(
                      new Date(consultation.consultation_date),
                      'MMM d, yyyy',
                    )
                  : 'Unknown'}
              </div>

              {/* CLINICIAN */}
              <div className="col-span-3 w-full flex items-center">
                <span
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold leading-none truncate max-w-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  Dr. {consultation.doctor_first} {consultation.doctor_last}
                </span>
              </div>

              {/* DIAGNOSIS */}
              <div className="col-span-2 w-full flex items-center">
                <span
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border max-w-full truncate ${
                    isCompleted
                      ? isDark
                        ? 'text-emerald-400 bg-emerald-900/30 border-emerald-800'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : isDark
                        ? 'text-blue-400 bg-blue-900/30 border-blue-800'
                        : 'text-blue-700 bg-blue-50 border-blue-200'
                  }`}
                >
                  {consultation.diagnosis || 'Pending'}
                </span>
              </div>

              {/* ACTIONS */}
              <div className="col-span-2 flex items-center justify-end w-full lg:pr-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-[#11151C] hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full px-4 h-8 text-[11px] font-bold"
                >
                  View
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredHistory.length === 0 && historySearch && (
        <div
          className={`text-center py-20 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
        >
          <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-bold">No results for "{historySearch}"</p>
        </div>
      )}

      {/* CONSULTATION DETAIL MODAL */}
      {selectedConsultation && (
        <ConsultationDetailModal
          consultation={selectedConsultation}
          onClose={() => setSelectedConsultation(null)}
          isDark={isDark}
        />
      )}
    </div>
  );
}

// =============================================================================
// CONSULTATION DETAIL MODAL — XENOCARE BRANDED COMPREHENSIVE DESIGN
// =============================================================================

interface ConsultationDetailModalProps {
  consultation: SpecialtyConsultationHistory;
  onClose: () => void;
  isDark: boolean;
}

function ConsultationDetailModal({
  consultation,
  onClose,
  isDark,
}: ConsultationDetailModalProps) {
  // Helper to render a detail section
  function DetailSection({
    title,
    content,
    icon: Icon,
    accent = 'gray',
    fullWidth = false,
  }: {
    title: string;
    content: React.ReactNode;
    icon?: React.ElementType;
    accent?: string;
    fullWidth?: boolean;
  }) {
    if (!content) {
      return fullWidth ? (
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-2">
            {Icon && <Icon className="h-4 w-4 text-gray-300" />}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {title}
            </p>
          </div>
          <p className="text-sm text-gray-400 italic">Not recorded</p>
        </div>
      ) : null;
    }
    return (
      <div className={fullWidth ? 'col-span-2' : ''}>
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className={`h-4 w-4 text-${accent}-500`} />}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {title}
          </p>
        </div>
        <div className="text-sm text-gray-800">{content}</div>
      </div>
    );
  }

  // Parse specialty data for display - Enhanced
  const renderSpecialtyData = () => {
    if (
      !consultation.specialty_data ||
      Object.keys(consultation.specialty_data).length === 0
    ) {
      return null;
    }

    return (
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-indigo-100 rounded-lg">
            <Activity className="h-4 w-4 text-indigo-600" />
          </div>
          <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
            Specialty Examination Data
          </h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(consultation.specialty_data).map(([key, value]) => {
            const formattedKey = key
              .replace(/_/g, ' ')
              .replace(/([A-Z])/g, ' $1')
              .trim();
            let displayValue: React.ReactNode;
            if (value === null || value === undefined || value === '') {
              displayValue = <span className="text-gray-400">—</span>;
            } else if (typeof value === 'boolean') {
              displayValue = (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {value ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {value ? 'Yes' : 'No'}
                </span>
              );
            } else if (typeof value === 'object') {
              displayValue = (
                <pre className="text-xs font-mono bg-white/60 p-2 rounded-lg border border-indigo-100 whitespace-pre-wrap overflow-x-auto max-h-32">
                  {JSON.stringify(value, null, 2)}
                </pre>
              );
            } else {
              displayValue = (
                <span className="font-medium text-gray-800">
                  {String(value)}
                </span>
              );
            }

            return (
              <div
                key={key}
                className={`${typeof value === 'object' && value !== null ? 'col-span-2 md:col-span-3' : ''} bg-white/50 rounded-xl px-3 py-2.5 border border-indigo-50`}
              >
                <p className="text-xs font-bold uppercase text-indigo-500 tracking-wider mb-1">
                  {formattedKey}
                </p>
                <div className="text-sm">{displayValue}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-xl shadow-2xl bg-white ring-1 ring-black/5 flex flex-col animate-in zoom-in-95 duration-200">
        {/* ──── XenoCare Branded Header ──── */}
        <div className="shrink-0 bg-gradient-to-r from-primary-700 to-[#008545] px-8 py-5 border-b border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              {/* XenoCare Logo */}
              <div className="hidden sm:flex items-center gap-3 border-r border-white/20 pr-5">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shadow-inner p-1.5 backdrop-blur-sm">
                  
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight text-white">
                    XENOCARE
                  </h4>
                  <span className="text-xs font-bold tracking-widest text-[#fbbf24] uppercase">
                    EMR System
                  </span>
                </div>
              </div>
              {/* Title */}
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight drop-shadow-sm">
                  Consultation Record
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-green-100 text-sm font-semibold">
                    {consultation.first_name} {consultation.last_name}
                  </span>
                  <span className="text-white/30">•</span>
                  <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white text-xs border border-white/10">
                    {consultation.emr_number}
                  </span>
                  <span className="text-white/30">•</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      consultation.status?.toLowerCase() === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30'
                        : 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/30'
                    }`}
                  >
                    {consultation.status?.toLowerCase() === 'completed' ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {consultation.status || 'Completed'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 shadow-lg hover:shadow-xl active:scale-95"
              title="Close"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ──── Scrollable Content ──── */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          <div className="p-8 space-y-6 max-w-5xl mx-auto">
            {/* ── Consultation Meta Grid ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
                <div className="p-4 text-center hover:bg-gray-50 transition-colors">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Consultation Date
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {consultation.consultation_date
                      ? format(
                          new Date(consultation.consultation_date),
                          'MMM d, yyyy',
                        )
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {consultation.consultation_date
                      ? format(
                          new Date(consultation.consultation_date),
                          'h:mm a',
                        )
                      : ''}
                  </p>
                </div>
                <div className="p-4 text-center hover:bg-gray-50 transition-colors">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Attending Doctor
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {consultation.doctor_first
                      ? `Dr. ${consultation.doctor_first} ${consultation.doctor_last || ''}`
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {consultation.specialty_code || 'General'}
                  </p>
                </div>
                <div className="p-4 text-center hover:bg-gray-50 transition-colors">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Encounter
                  </p>
                  <p className="text-sm font-mono font-bold text-gray-700">
                    {consultation.encounter_id
                      ? consultation.encounter_id.slice(0, 8).toUpperCase()
                      : '—'}
                  </p>
                </div>
                <div className="p-4 text-center hover:bg-gray-50 transition-colors">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                      consultation.status?.toLowerCase() === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                    }`}
                  >
                    {consultation.status?.toLowerCase() === 'completed' ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                    {consultation.status || 'Completed'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Chief Complaint ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-orange-100 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Chief Complaint / Presenting Complaints
                </h4>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed bg-orange-50/50 rounded-xl px-4 py-3 border border-orange-100/50">
                {consultation.chief_complaint || consultation.complaints || (
                  <span className="text-gray-400 italic">Not recorded</span>
                )}
              </p>
            </div>

            {/* ── Clinical Notes ── */}
            {consultation.clinical_notes && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Clinical Notes
                  </h4>
                </div>
                <div className="text-sm text-gray-800 leading-relaxed bg-blue-50/30 rounded-xl px-4 py-3 border border-blue-100/40 whitespace-pre-wrap">
                  {consultation.clinical_notes}
                </div>
              </div>
            )}

            {/* ── Examination Findings ── */}
            {consultation.examination_findings && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <Stethoscope className="h-4 w-4 text-purple-600" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Examination Findings
                  </h4>
                </div>
                <div className="text-sm text-gray-800 leading-relaxed bg-purple-50/30 rounded-xl px-4 py-3 border border-purple-100/40 whitespace-pre-wrap">
                  {consultation.examination_findings}
                </div>
              </div>
            )}

            {/* ── Specialty Examination Data ── */}
            {renderSpecialtyData()}

            {/* ── Diagnosis & ICD Codes ── */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200/60 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-amber-100 rounded-lg">
                  <ClipboardList className="h-4 w-4 text-amber-600" />
                </div>
                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Diagnosis
                </h4>
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-relaxed">
                {consultation.diagnosis || (
                  <span className="text-gray-400 italic font-normal">
                    No diagnosis recorded
                  </span>
                )}
              </p>
              {consultation.icd_codes && consultation.icd_codes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200/50">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
                    ICD-10 Codes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {consultation.icd_codes.map((icdCode, idx) => {
                      const codeStr =
                        typeof icdCode === 'string'
                          ? icdCode
                          : (icdCode as { code?: string; description?: string })
                              ?.code || '';
                      const description =
                        typeof icdCode === 'object'
                          ? (icdCode as { description?: string })?.description
                          : null;

                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-white text-amber-800 border border-amber-200 shadow-sm"
                          title={description || undefined}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          {codeStr}
                          {description && (
                            <span className="font-sans font-medium text-amber-600 ml-1">
                              — {description}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Treatment Plan ── */}
            {consultation.treatment_plan && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-emerald-100 rounded-lg">
                    <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Treatment Plan
                  </h4>
                </div>
                <div className="text-sm text-gray-800 leading-relaxed bg-emerald-50/30 rounded-xl px-4 py-3 border border-emerald-100/40 whitespace-pre-wrap">
                  {consultation.treatment_plan}
                </div>
              </div>
            )}

            {/* ── Footer Meta ── */}
            <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wider px-1 pt-2 border-t border-gray-100">
              <span>Record ID: {consultation.id?.slice(0, 12)}</span>
              <span>XenoCare • Electronic Health Record</span>
              {consultation.updated_at && (
                <span>
                  Last Updated:{' '}
                  {format(new Date(consultation.updated_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ──── Footer Actions ──── */}
        <div className="shrink-0 px-8 py-4 bg-white border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {consultation.consultation_date
              ? `Consultation on ${format(new Date(consultation.consultation_date), 'EEEE, MMMM d, yyyy')}`
              : 'Clinical consultation record'}
          </p>
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            Close Record
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PROCEDURES TAB COMPONENT
// =============================================================================

interface ProceduresTabProps {
  procedures: SpecialtyProcedure[];
  specialtyName: string;
  isDark: boolean;
}

function ProceduresTab({
  procedures,
  specialtyName,
  isDark,
}: ProceduresTabProps) {
  if (procedures.length === 0) {
    return (
      <div
        className={`rounded-[1.75rem] border border-dashed px-6 py-20 text-center ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500 bg-slate-50/60'}`}
      >
        <Syringe className="h-12 w-12 mx-auto mb-4 opacity-30 text-[#11151C]" />
        <p className="font-bold tracking-tight">
          No pending {specialtyName.toLowerCase()} procedures
        </p>
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-300">
          Procedure requests will appear here when submitted.
        </p>
      </div>
    );
  }

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return isDark
          ? 'bg-emerald-900/40 text-emerald-300'
          : 'bg-emerald-100 text-emerald-700';
      case 'in_progress':
      case 'in-progress':
        return isDark
          ? 'bg-blue-900/40 text-blue-300'
          : 'bg-blue-100 text-blue-700';
      case 'pending':
        return isDark
          ? 'bg-teal-900/40 text-teal-300'
          : 'bg-[#ccfbf1] text-[#11151C]';
      case 'cancelled':
        return isDark
          ? 'bg-rose-900/40 text-rose-300'
          : 'bg-rose-100 text-rose-700';
      default:
        return isDark
          ? 'bg-slate-700 text-slate-300'
          : 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-3">
      {procedures.map((procedure) => (
        <div
          key={procedure.id}
          className={`rounded-[1.25rem] border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
        >
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(100px,.6fr)_minmax(100px,.6fr)_minmax(0,1fr)_auto] lg:items-center">
            {/* Procedure */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ${isDark ? 'border-slate-600 bg-slate-700 text-slate-200' : 'border-rose-100 bg-rose-50 text-rose-600'}`}
              >
                <Syringe className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {procedure.procedure_name}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {procedure.request_number} &middot; {procedure.first_name}{' '}
                  {procedure.last_name}
                </p>
              </div>
            </div>

            {/* Date */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Date
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {format(new Date(procedure.created_at), 'MMM d, yyyy')}
              </p>
            </div>

            {/* Status */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Status
              </p>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getStatusStyle(procedure.status)}`}
                >
                  {procedure.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="min-w-0">
              {procedure.clinical_notes && (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Notes
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {procedure.clinical_notes}
                  </p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-start lg:justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-500 dark:text-slate-300 hover:text-[#11151C] hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full px-4 h-9 text-[11px] font-bold"
              >
                View Details
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// EXAMS TAB COMPONENT
// =============================================================================

interface ExamsTabProps {
  exams: SpecialtyExam[];
  specialtyName: string;
  isDark: boolean;
  onViewTimeline?: (examId: string) => void;
}

function ExamsTab({ exams, specialtyName, isDark, onViewTimeline }: ExamsTabProps) {
  if (exams.length === 0) {
    return (
      <div
        className={`rounded-[1.75rem] border border-dashed px-6 py-20 text-center ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500 bg-slate-50/60'}`}
      >
        <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-30 text-[#11151C]" />
        <p className="font-bold tracking-tight">
          No {specialtyName.toLowerCase()} exams on record
        </p>
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-300">
          Specialty examinations and assessments will be listed here.
        </p>
      </div>
    );
  }

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return isDark
          ? 'bg-emerald-900/40 text-emerald-300'
          : 'bg-emerald-100 text-emerald-700';
      case 'in_progress':
      case 'in-progress':
        return isDark
          ? 'bg-blue-900/40 text-blue-300'
          : 'bg-blue-100 text-blue-700';
      case 'pending':
        return isDark
          ? 'bg-teal-900/40 text-teal-300'
          : 'bg-[#ccfbf1] text-[#11151C]';
      default:
        return isDark
          ? 'bg-slate-700 text-slate-300'
          : 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-3">
      {exams.map((exam) => (
        <div
          key={exam.id}
          className={`rounded-[1.25rem] border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
        >
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(100px,.6fr)_minmax(100px,.6fr)_minmax(0,1fr)_auto] lg:items-center">
            {/* Exam */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ${isDark ? 'border-slate-600 bg-slate-700 text-slate-200' : 'border-sky-100 bg-sky-50 text-sky-600'}`}
              >
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {exam.exam_type}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {exam.first_name} {exam.last_name} &middot; {exam.emr_number}
                </p>
              </div>
            </div>

            {/* Date */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Date
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {format(new Date(exam.created_at), 'MMM d, yyyy')}
              </p>
            </div>

            {/* Status */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Status
              </p>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getStatusStyle(exam.status)}`}
                >
                  {exam.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Findings */}
            <div className="min-w-0">
              {exam.findings && (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Findings
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {exam.findings}
                  </p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 justify-start lg:justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-500 dark:text-slate-300 hover:text-[#11151C] hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full px-4 h-9 text-[11px] font-bold"
              >
                View Details
              </Button>
              {onViewTimeline && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewTimeline(exam.id)}
                  className="text-slate-500 dark:text-slate-300 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-full px-4 h-9 text-[11px] font-bold"
                  title="View encounter timeline with orders"
                >
                  <Activity className="h-3.5 w-3.5 mr-1" />
                  Timeline
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// FEATURE FLAG COMPONENTS
// =============================================================================

interface FeatureFlagComponentsProps {
  featureFlags: SpecialtyFeatureFlags;
  isDark: boolean;
}

/**
 * Renders specialty-specific UI components based on feature flags.
 * NO switch/case on specialty name - uses flags only.
 */
function FeatureFlagComponents({
  featureFlags,
  isDark,
}: FeatureFlagComponentsProps) {
  // Only render if there are active feature flags
  const activeFlags = Object.entries(featureFlags).filter(
    ([, value]) => value === true,
  );

  if (activeFlags.length === 0) {
    return null;
  }

  return (
    <div
      className={`px-6 py-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
    >
      <p
        className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-400'} mb-2`}
      >
        Specialty Features:
      </p>
      <div className="flex flex-wrap gap-2">
        {featureFlags.has_tooth_chart && (
          <span
            className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-amber-900 text-amber-200' : 'bg-amber-100 text-amber-800'}`}
          >
            Tooth Chart
          </span>
        )}
        {featureFlags.has_vision_test && (
          <span
            className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}`}
          >
            Vision Test
          </span>
        )}
        {featureFlags.has_exercises && (
          <span
            className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'}`}
          >
            Exercises
          </span>
        )}
        {featureFlags.has_ecg && (
          <span
            className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'}`}
          >
            ECG
          </span>
        )}
        {featureFlags.has_growth_chart && (
          <span
            className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-sky-900 text-sky-200' : 'bg-sky-100 text-sky-800'}`}
          >
            Growth Chart
          </span>
        )}
        {featureFlags.has_audiogram && (
          <span
            className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800'}`}
          >
            Audiogram
          </span>
        )}
        {featureFlags.has_skin_diagram && (
          <span
            className={`px-2 py-1 text-xs rounded ${isDark ? 'bg-pink-900 text-pink-200' : 'bg-pink-100 text-pink-800'}`}
          >
            Skin Diagram
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { SpecialtyClinicPage };
