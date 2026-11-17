import { isNhisFeatureEnabled } from '../../config/features';
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  Stethoscope,
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  Users,
  UserCheck,
  ClipboardList,
  Activity,
  TrendingUp,
  AlertTriangle,
  FileText,
  History,
  ArrowUpRight,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Microscope,
  Bot,
  X,
  ChevronDown,
  PanelLeft,
} from 'lucide-react';
import { Button } from '../../components/ui/FormElements';
import ConsultationList from './components/ConsultationList';
import ConsultationWizard, {
  SpecialtyReferralDTO,
  ExternalNhisReferralDTO,
} from './components/ConsultationWizard';
import ConsultationDetail from './components/ConsultationDetail';
import { ConsultationQueuePanel } from './components/ConsultationQueuePanel';
import MyPatientsPanel from './components/MyPatientsPanel';
import PatientHistorySidebar from './components/PatientHistorySidebar';
import { SpecialtyConsultationWizard } from './components/SpecialtyConsultationWizard';
import {
  useCreateConsultation,
  useConsultation,
  useUpdateConsultation,
} from './hooks/useConsultation';
import { useSaveEncounterComplaints } from './hooks/useChiefComplaints';
import {
  useShouldUseSpecialtyWizard,
  useSpecialtyTemplate,
} from './hooks/useSpecialtyTemplate';
import { SpecialtySubmissionData } from './dtos/specialty-template.dto';
import {
  ConsultationWithRelations,
  CreateConsultationDTO,
  LabOrderDTO,
  RadiologyOrderDTO,
  PrescriptionOrderDTO,
  ProcedureOrderDTO,
  AdmissionOrderDTO,
  UpdateConsultationDTO,
} from './dtos/consultation.dto';
import { PatientDTO } from '../patient-registration/dtos/patient.dto';
import {
  PatientSummary,
  createBatchOrders,
  resolvePatientUuid,
} from './api/consultation.api';
import { useAuth } from '../../contexts/AuthContext';
import {
  useActiveEncounters,
  EncounterDTO,
  useMoveToQueue,
  useTransitionEncounter,
  requiresPaymentFirst,
  WorkflowStage,
} from '../../lib/workflow';
import {
  getPatientRecentContinuableEncounter,
  checkEncounterContinuationStatus,
  validateRecordLinkage,
} from '../../lib/encounter';
import { createOutgoingReferral } from '../nhis/api/nhis.api';
import {
  createClinicalRequest,
  createBulkClinicalRequests,
} from '../clinical-requests/api/clinical-requests.api';
import { upsertFollowupBooking } from '../encounter/api/internal-referral.api';
import { CreateTreatmentTaskDTO } from '../treatment-plan/dtos/treatment-plan.dto';
import { createTreatmentPlan } from '../treatment-plan/api/treatment-plan.api';
import { createPhysioPlanFromConsultation } from '../physiotherapy/api/physiotherapy.api';
import { CreateClinicalRequestDTO } from '../clinical-requests/dtos/clinical-request.dto';
import { useToast } from '../../components/ui/Toast';
import { useTimeTheme } from '../../hooks/useTimeTheme';
import { InlineGuidance } from '../../components/guidance/InlineGuidance';
import { AIChatPanel } from '../ai-assistant/components/AIChatPanel';
import { formatSpecialtyExamNarrative } from '../../utils/clinicalTextFormatter';
import { createScopedLogger } from '../../utils/logger';
import { getFacilityName } from '../../lib/facility';

const log = createScopedLogger('ClinicalConsultation');

// XenoCare logo
// =============================================================================
// Types
// =============================================================================

type ActiveTab = 'queue' | 'my-patients' | 'consultations' | 'history';

// =============================================================================
// Main Component
// =============================================================================

export default function ClinicalConsultation() {
  const { hasRole, staff } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const dashboardLaunchHandledRef = useRef<string | null>(null);
  const dashboardEncounterId =
    (location.state as { dashboardEncounterId?: string } | null)
      ?.dashboardEncounterId || null;

  // View State
  const [activeTab, setActiveTab] = useState<ActiveTab>('queue');

  // Form/Detail State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPatientHistoryOpen, setIsPatientHistoryOpen] = useState(false);
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null);
  const [selectedConsultation, setSelectedConsultation] =
    useState<ConsultationWithRelations | null>(null);
  const [preselectedPatient, setPreselectedPatient] =
    useState<PatientDTO | null>(null);
  const [selectedEncounter, setSelectedEncounter] =
    useState<EncounterDTO | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null,
  );
  const [isAIDashboardOpen, setIsAIDashboardOpen] = useState(false);
  const [aiSelectedPatientId, setAiSelectedPatientId] = useState('');

  // Specialty Wizard State - tracks if specialty wizard should be used
  const [isSpecialtyWizardOpen, setIsSpecialtyWizardOpen] = useState(false);

  const createConsultation = useCreateConsultation();
  const updateConsultation = useUpdateConsultation();
  const saveEncounterComplaints = useSaveEncounterComplaints();
  useMoveToQueue();
  const transitionEncounter = useTransitionEncounter();

  // Fetch data
  const { data: consultationDetails } = useConsultation(
    selectedConsultationId || '',
  );
  const { data: activeEncounters, refetch: refetchEncounters } =
    useActiveEncounters();

  useEffect(() => {
    if (!dashboardEncounterId || !activeEncounters?.length) return;
    if (dashboardLaunchHandledRef.current === dashboardEncounterId) return;

    const encounter = activeEncounters.find(
      (candidate) => candidate.id === dashboardEncounterId,
    );
    if (!encounter) return;

    dashboardLaunchHandledRef.current = dashboardEncounterId;
    setActiveTab('queue');
    setSelectedConsultationId(null);
    setSelectedConsultation(null);
    setIsDetailOpen(false);
    setIsPatientHistoryOpen(false);
    setSelectedEncounter(encounter);
    if (encounter.patient) {
      setPreselectedPatient(encounter.patient as PatientDTO);
    }
    setIsFormOpen(true);
  }, [dashboardEncounterId, activeEncounters]);

  // Specialty detection - determine if we should use specialty wizard based on encounter clinic
  const {
    shouldUseSpecialtyWizard,
    specialtyInfo,
    isLoading: isSpecialtyLoading,
  } = useShouldUseSpecialtyWizard(selectedEncounter?.clinic_id);

  // Fetch the full template if specialty is detected
  const { data: specialtyTemplate } = useSpecialtyTemplate(
    specialtyInfo.specialtyCode,
  );

  // Calculate stats
  const stats = useMemo(() => {
    if (!activeEncounters)
      return { total: 0, inProgress: 0, completed: 0, waiting: 0, urgent: 0 };

    const today = new Date().toISOString().split('T')[0];
    const todaysEncounters = activeEncounters.filter((e) =>
      e.created_at.startsWith(today),
    );

    return {
      total: todaysEncounters.length,
      inProgress: todaysEncounters.filter(
        (e) => e.current_stage === 'consultation',
      ).length,
      completed: todaysEncounters.filter((e) => e.status === 'Completed')
        .length,
      waiting: todaysEncounters.filter(
        (e) =>
          e.current_stage === 'queue_waiting' ||
          e.current_stage === 'nursing_vitals',
      ).length,
      urgent: todaysEncounters.filter(
        (e) => e.priority === 'Emergency' || e.priority === 'Urgent',
      ).length,
    };
  }, [activeEncounters]);

  const aiQueuePatients = useMemo(() => {
    if (!activeEncounters) return [];
    const currentStaffId = staff?.id;
    return activeEncounters
      .filter((enc) => {
        if (enc.status !== 'Active') return false;
        if (enc.queue_entry?.specialty_code) return false;
        const readyStages = [
          'consultation',
          'doctor_review',
          'lab_results',
          'radiology_results',
        ];
        if (!readyStages.includes(enc.current_stage)) return false;
        if (enc.queue_entry?.status === 'In Progress') {
          const assignedDoctorId = enc.queue_entry.assigned_to;
          if (assignedDoctorId !== currentStaffId) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priorityOrder = { Emergency: 0, Urgent: 1, Normal: 2 } as const;
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return (
          new Date(a.registration_time).getTime() -
          new Date(b.registration_time).getTime()
        );
      });
  }, [activeEncounters, staff?.id]);

  const aiPatients = useMemo(() => {
    const byPatient = new Map<
      string,
      {
        patientId: string;
        patientName: string;
        emrNumber: string;
        encounter: EncounterDTO;
      }
    >();

    aiQueuePatients.forEach((encounter) => {
      const patientId =
        (encounter.patient as { id?: string } | undefined)?.id ||
        encounter.patient_id;
      if (!patientId || byPatient.has(patientId)) return;

      const patientName =
        `${encounter.patient?.first_name || ''} ${encounter.patient?.surname || ''}`.trim() ||
        'Unknown Patient';
      const emrNumber =
        encounter.patient?.emr_number ||
        encounter.patient?.patient_id ||
        encounter.patient_id;

      byPatient.set(patientId, {
        patientId,
        patientName,
        emrNumber,
        encounter,
      });
    });

    return Array.from(byPatient.values());
  }, [aiQueuePatients]);

  const selectedAiPatient = useMemo(
    () =>
      aiPatients.find((patient) => patient.patientId === aiSelectedPatientId) ||
      null,
    [aiPatients, aiSelectedPatientId],
  );

  useEffect(() => {
    if (!aiSelectedPatientId) return;
    const stillVisible = aiPatients.some(
      (patient) => patient.patientId === aiSelectedPatientId,
    );
    if (!stillVisible) {
      setAiSelectedPatientId('');
    }
  }, [aiPatients, aiSelectedPatientId]);

  // Get time-based theme
  const {
    timeOfDay,
    greeting,
    colors: themeColors,
    isNightMode,
  } = useTimeTheme();

  // Get time icon based on time of day
  const TimeIcon = useMemo(() => {
    switch (timeOfDay) {
      case 'morning':
        return Sunrise;
      case 'afternoon':
        return Sun;
      case 'evening':
        return Sunset;
      case 'night':
        return Moon;
      default:
        return Sun;
    }
  }, [timeOfDay]);

  // Dynamic header gradient based on time
  const headerGradient = useMemo(() => {
    return `bg-gradient-to-r ${themeColors.header.gradient}`;
  }, [themeColors]);

  // Dynamic decorative colors based on time
  const decorativeColors = useMemo(() => {
    return {
      iconBg: themeColors.header.decorativeCircle,
      statBg: themeColors.card.hover,
      accentText: themeColors.accent.text,
    };
  }, [themeColors]);

  // Handlers
  const handleNewConsultation = () => {
    setSelectedConsultation(null);
    setPreselectedPatient(null);
    setSelectedEncounter(null);
    setIsFormOpen(true);
  };

  /**
   * Handle starting a consultation from the queue.
   * Automatically detects if this is a specialty clinic encounter
   * and opens the appropriate wizard (standard or specialty).
   */
  const handleStartConsultationFromQueue = useCallback(
    (encounter: EncounterDTO) => {
      setSelectedEncounter(encounter);
      if (encounter.patient) {
        setPreselectedPatient(encounter.patient as PatientDTO);
      }

      // The specialty detection is handled by useShouldUseSpecialtyWizard hook
      // which watches selectedEncounter.clinic_id
      // For now, open the standard form - the hook will provide specialty info
      // and we can conditionally render the right wizard
      setIsFormOpen(true);
    },
    [],
  );

  /**
   * Force open the specialty wizard for a given encounter.
   * Used when user explicitly wants specialty-driven consultation.
   */
  const handleStartSpecialtyConsultation = useCallback(
    (encounter: EncounterDTO) => {
      setSelectedEncounter(encounter);
      if (encounter.patient) {
        setPreselectedPatient(encounter.patient as PatientDTO);
      }
      setIsSpecialtyWizardOpen(true);
    },
    [],
  );

  /**
   * Close whichever wizard is open and reset state.
   */
  const handleCloseWizard = useCallback(() => {
    setIsFormOpen(false);
    setIsSpecialtyWizardOpen(false);
    setSelectedConsultation(null);
    setPreselectedPatient(null);
    setSelectedEncounter(null);
  }, []);

  const handleSelectPatientFromHistory = (patient: PatientSummary) => {
    setSelectedPatientId(patient.patient_id);
    setIsPatientHistoryOpen(true);
  };

  /**
   * Handle starting a consultation from patient history.
   *
   * Standard EMR Practice for Encounter Continuation:
   * 1. Look for patient's most recent continuable encounter (within 48 hours, Active status)
   * 2. If found, continue that encounter (allows adding more orders to same visit)
   * 3. If not found, warn user they need to register a new encounter first
   *
   * This prevents:
   * - Creating "orphan" records without proper encounter linkage
   * - Reopening old encounters beyond the allowed timeframe
   * - Manipulation by attaching services to wrong encounters
   */
  const handleStartConsultationFromHistory = async (patient: {
    id: string; // UUID primary key - CRITICAL for encounter lookups
    patient_id: string;
    emr_number?: string;
    first_name: string;
    middle_name?: string;
    surname: string;
    gender: string;
    date_of_birth: string;
    contact_phone?: string;
  }) => {
    setIsPatientHistoryOpen(false);

    // Open the consultation UI first, then resolve encounter continuity in the background.
    setPreselectedPatient({
      id: patient.id, // UUID - CRITICAL for encounter lookups
      patient_id: patient.patient_id,
      emr_number: patient.emr_number,
      first_name: patient.first_name,
      middle_name: patient.middle_name,
      surname: patient.surname,
      gender: patient.gender,
      date_of_birth: patient.date_of_birth,
      contact_phone: patient.contact_phone,
    } as PatientDTO);
    setSelectedEncounter(null);
    setIsFormOpen(true);

    // Look for patient's most recent continuable encounter
    // Use UUID (patient.id) for encounter lookup, not patient_id
    try {
      const recentEncounter = await getPatientRecentContinuableEncounter(
        patient.id,
      );

      if (!recentEncounter) {
        showToast({
          type: 'warning',
          title: 'No Active Encounter',
          message:
            'Patient has no active encounter. Please register them at Customer Service first, or select from the queue.',
        });
        return;
      }

      // Check continuation status for detailed info
      const continuationStatus = await checkEncounterContinuationStatus(
        recentEncounter.visit_id,
      );

      if (!continuationStatus.canContinue) {
        return;
      }

      const encounterAsDTO: EncounterDTO = {
        id: recentEncounter.visit_id,
        visit_id: recentEncounter.encounter_number,
        patient_id: recentEncounter.patient_id,
        visit_type: recentEncounter.visit_type as any,
        payment_category: recentEncounter.payment_category as any,
        priority: recentEncounter.priority as any,
        status: recentEncounter.status as any,
        current_stage: recentEncounter.current_stage as WorkflowStage,
        registration_time: recentEncounter.start_time,
        created_at: recentEncounter.start_time,
        updated_at: recentEncounter.start_time,
      };

      setSelectedEncounter(encounterAsDTO);

      if (continuationStatus.requiresJustification) {
        showToast({
          type: 'warning',
          title: 'Encounter Continuation',
          message: `Continuing encounter from ${Math.floor(continuationStatus.hoursOld)} hours ago. Justification may be required.`,
        });
      } else {
        showToast({
          type: 'info',
          title: 'Continuing Encounter',
          message: `Continuing existing encounter (${recentEncounter.encounter_number}) for this patient.`,
        });
      }
    } catch (error) {
      log.error('Error checking for continuable encounter:', error);
      setSelectedEncounter(null);
    }
  };

  const handleViewConsultation = (consultation: ConsultationWithRelations) => {
    setSelectedConsultationId(consultation.consultation_id);
    setSelectedConsultation(consultation);
    setIsDetailOpen(true);
  };

  const handleEditConsultation = (consultation: ConsultationWithRelations) => {
    setSelectedConsultationId(consultation.consultation_id);
    setSelectedConsultation(consultation);
    setIsDetailOpen(true);
  };

  const handleSaveConsultationEdit = async (payload: UpdateConsultationDTO) => {
    await updateConsultation.mutateAsync(payload);
    showToast({
      type: 'success',
      title: 'Consultation Updated',
      message: 'Consultation changes were saved and audit reason recorded.',
    });
  };

  const handleCreateConsultation = async (
    data: CreateConsultationDTO & { chief_complaints_structured?: any[] },
    labOrders: LabOrderDTO[],
    radiologyOrders: RadiologyOrderDTO[],
    prescriptions: PrescriptionOrderDTO[],
    procedureOrders: ProcedureOrderDTO[] = [],
    admissionOrder: AdmissionOrderDTO | null = null,
    treatmentTasks: CreateTreatmentTaskDTO[] = [],
    specialtyReferrals: SpecialtyReferralDTO[] = [],
    externalNhisReferral: ExternalNhisReferralDTO | null = null,
  ) => {
    // ====================================================================
    // ENCOUNTER-CENTRIC VALIDATION (must happen before closing form)
    // ====================================================================
    const encounterId =
      data.encounter_id || data.visit_id || selectedEncounter?.id;
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
      log.error('[Consultation] Linkage validation failed:', linkageValidation);
      return;
    }

    log.info(
      '[Consultation] Record linkage validated - EMR:',
      linkageValidation.emrNumber,
      'Encounter:',
      encounterId,
    );
    // ====================================================================

    // OPTIMISTIC UI: Close form immediately and show saving indicator
    const savedEncounter = selectedEncounter;
    const savedPatient = preselectedPatient;

    setIsFormOpen(false);
    setSelectedConsultation(null);
    setPreselectedPatient(null);
    setSelectedEncounter(null);

    // Show immediate feedback
    showToast({
      type: 'info',
      title: 'Saving...',
      message: 'Consultation is being saved in the background.',
    });

    // Process in background
    try {
      // Extract structured complaints before saving consultation
      const structuredComplaints = data.chief_complaints_structured || [];
      const { chief_complaints_structured, ...consultationData } = data;

      const consultation =
        await createConsultation.mutateAsync(consultationData);
      const staffId = consultation.doctor_id;

      // Get staff UUID from AuthContext for recorded_by fields (FK references staff.id)
      const staffUuid = staff?.id;

      // Save structured chief complaints to database (linked to encounter)
      if (structuredComplaints.length > 0 && consultation.encounter_id) {
        try {
          await saveEncounterComplaints.mutateAsync({
            patientId: consultation.patient_id,
            emrNumber: preselectedPatient?.emr_number || '',
            encounterId: consultation.encounter_id,
            consultationId: consultation.consultation_id,
            complaints: structuredComplaints.map((c: any) => ({
              complaint_id: c.complaint_id,
              is_primary: c.is_primary,
              duration_value: c.duration_value,
              duration_unit: c.duration_unit,
              notes: c.notes,
              // Include custom complaint fields for saving to catalogue
              is_custom: c.is_custom || false,
              complaint_name: c.complaint_name,
              category: c.category,
            })),
            recordedBy: staffUuid, // Use staff UUID, not staff_id string
          });
        } catch (complaintError) {
          log.error('Failed to save chief complaints:', complaintError);
          // Don't fail the whole consultation if complaints fail to save
        }
      }

      // Create treatment plan with nursing tasks if any tasks were specified
      if (treatmentTasks.length > 0 && consultation.encounter_id) {
        try {
          // Resolve patient UUID - treatment_plans.patient_id requires UUID, not VARCHAR patient_id
          const patientUuidForPlan = await resolvePatientUuid(
            consultation.patient_id,
          );

          if (!patientUuidForPlan) {
            log.error('Failed to resolve patient UUID for treatment plan');
            throw new Error('Could not resolve patient UUID');
          }

          // Handle diagnosis which can be an array or string
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
            '[Consultation] Treatment plan created with',
            treatmentTasks.length,
            'tasks',
          );
        } catch (treatmentPlanError) {
          log.error('Failed to create treatment plan:', treatmentPlanError);
          showToast({
            type: 'warning',
            title: 'Treatment Plan Issue',
            message:
              'Treatment plan could not be created. Please try again from the nursing module.',
          });
          // Don't fail the whole consultation if treatment plan fails
        }
      }

      // Use optimized batch creation - significantly faster than individual calls
      const hasOrders =
        labOrders.length > 0 ||
        radiologyOrders.length > 0 ||
        prescriptions.length > 0 ||
        (procedureOrders && procedureOrders.length > 0);

      const createdOrders: Array<{
        type: 'Lab' | 'Radiology' | 'Pharmacy';
        id: string;
        name: string;
        price: number;
      }> = [];

      // Track NHIS requests for notification
      let nhisRequestsCount = 0;

      if (hasOrders) {
        // Parse diagnosis to pass to orders for clinical context
        const diagnosisArray: string[] = [];
        if (consultation.diagnosis) {
          if (Array.isArray(consultation.diagnosis)) {
            diagnosisArray.push(...consultation.diagnosis);
          } else if (typeof consultation.diagnosis === 'string') {
            // Split by semicolon (standard format from wizard)
            diagnosisArray.push(
              ...consultation.diagnosis
                .split(';')
                .map((d) => d.trim())
                .filter(Boolean),
            );
          }
        }

        // Build clinical findings string for NHIS pre-authorization
        const clinicalFindingsParts: string[] = [];
        if ((consultation as any).examination_findings) {
          clinicalFindingsParts.push(
            `Examination Findings: ${(consultation as any).examination_findings}`,
          );
        }
        if ((consultation as any).physical_examination) {
          clinicalFindingsParts.push(
            `Physical Examination: ${(consultation as any).physical_examination}`,
          );
        }
        if ((consultation as any).clinical_notes) {
          clinicalFindingsParts.push(
            `Clinical Notes: ${(consultation as any).clinical_notes}`,
          );
        }
        if ((consultation as any).history_of_present_illness) {
          clinicalFindingsParts.push(
            `History of Present Illness: ${(consultation as any).history_of_present_illness}`,
          );
        }
        const clinicalFindings = clinicalFindingsParts.join('\n\n');

        // Get patient info for NHIS display
        const patientName = preselectedPatient
          ? `${preselectedPatient.first_name || ''} ${preselectedPatient.surname || ''}`.trim()
          : undefined;
        const patientEmrNumber =
          preselectedPatient?.emr_number || preselectedPatient?.patient_id;

        const batchResult = await createBatchOrders({
          consultationId: consultation.consultation_id,
          patientId: consultation.patient_id,
          visitId: consultation.visit_id,
          encounterId: consultation.encounter_id!,
          orderedBy: staffId,
          labOrders,
          radiologyOrders,
          procedureOrders: procedureOrders || [],
          prescriptions,
          diagnosis: diagnosisArray, // Pass diagnosis from consultation to all orders
          clinicalFindings, // Pass clinical findings for NHIS pre-authorization
          patientName, // Pass patient name for NHIS approval display
          patientEmrNumber, // Pass patient number for NHIS approval display
        });

        if (batchResult.procedureRlsFallbackTriggered) {
          showToast({
            type: 'warning',
            title: 'Procedure Request Routed',
            message:
              'Direct procedure queue insert is restricted for your role. The procedure has been routed through clinical requests for approval.',
          });
        }

        // Map batch results to createdOrders for invoice
        batchResult.labRequests.forEach((lr) => {
          if (lr.test_name && lr.price) {
            createdOrders.push({
              type: 'Lab',
              id: lr.request_id,
              name: lr.test_name,
              price: lr.price,
            });
          }
        });

        batchResult.radiologyRequests.forEach((rr) => {
          if (rr.imaging_name && rr.price) {
            createdOrders.push({
              type: 'Radiology',
              id: rr.request_id,
              name: rr.imaging_name,
              price: rr.price,
            });
          }
        });

        batchResult.prescriptionRecords.forEach((pr) => {
          if (pr.drug_name && pr.price) {
            createdOrders.push({
              type: 'Pharmacy',
              id: pr.prescription_id,
              name: pr.drug_name,
              price: pr.price * (pr.quantity || 1),
            });
          }
        });

        // Track NHIS requests count for notification
        nhisRequestsCount = batchResult.nhisRequestsCount || 0;
      }

      // Create Clinical Requests for Procedures, Admissions, and Specialty Referrals
      // These go through approval workflow rather than direct creation
      const clinicalRequests: CreateClinicalRequestDTO[] = [];

      // Resolve encounter ID - use consultation's resolved IDs (passed from wizard form data)
      // The wizard sets encounter_id when user selects an encounter from the dropdown
      const resolvedEncounterId =
        consultation.encounter_id ||
        consultation.visit_id ||
        savedEncounter?.id;

      log.info('[Consultation] Resolving encounter ID:', {
        'consultation.encounter_id': consultation.encounter_id,
        'consultation.visit_id': consultation.visit_id,
        'savedEncounter?.id': savedEncounter?.id,
        resolvedEncounterId,
      });

      // Resolve patient UUID - clinical_requests.patient_id requires UUID, not VARCHAR patient_id
      let resolvedPatientUuid: string | null = null;
      if (
        procedureOrders.length > 0 ||
        admissionOrder ||
        specialtyReferrals.length > 0 ||
        externalNhisReferral
      ) {
        try {
          resolvedPatientUuid = await resolvePatientUuid(
            consultation.patient_id,
          );
        } catch (e) {
          log.error('Failed to resolve patient UUID for clinical requests:', e);
        }
      }

      // Only create clinical requests if we have a valid encounter, patient UUID, AND staff UUID
      if (
        resolvedEncounterId &&
        resolvedPatientUuid &&
        staffUuid &&
        (procedureOrders.length > 0 ||
          admissionOrder ||
          specialtyReferrals.length > 0)
      ) {
        // Create Procedure Requests
        // NOTE: procedure_id comes from nhis_procedures which is now synced to procedure_catalogue
        // via migration 050_seed_procedure_catalogue_from_nhis.sql (same UUIDs used)
        for (const proc of procedureOrders) {
          clinicalRequests.push({
            patient_id: resolvedPatientUuid,
            encounter_id: resolvedEncounterId,
            requesting_doctor_id: staffUuid!, // Use staff UUID, not staff_id string
            request_type:
              proc.procedure_type === 'Surgery' ? 'Surgery' : 'Procedure',
            clinical_reason: proc.notes || `Procedure: ${proc.procedure_name}`,
            urgency:
              proc.priority === 'Emergency'
                ? 'Emergency'
                : proc.priority === 'Urgent'
                  ? 'Urgent'
                  : 'Routine',
            procedure_catalogue_id: proc.procedure_id, // Now valid - IDs synced from nhis_procedures
            procedure_name: proc.procedure_name,
            procedure_notes: proc.notes,
            created_by: staffUuid, // Use staff UUID, not staff_id string
          });
        }

        // Create Admission Request
        if (admissionOrder) {
          clinicalRequests.push({
            patient_id: resolvedPatientUuid,
            encounter_id: resolvedEncounterId,
            requesting_doctor_id: staffUuid!, // Use staff UUID, not staff_id string
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
            created_by: staffUuid, // Use staff UUID, not staff_id string
          });
        }

        // Create Internal Specialty Referral Requests (ALL specialty clinics)
        // These are INTERNAL referrals within XenoCare - they route to Encounter Office first
        for (const referral of specialtyReferrals) {
          clinicalRequests.push({
            patient_id: resolvedPatientUuid,
            encounter_id: resolvedEncounterId,
            requesting_doctor_id: staffUuid!,
            request_type: 'Referral',
            clinical_reason: referral.reason,
            urgency: referral.urgency,
            specialty_module: referral.specialty.toLowerCase(),
            source_clinic_id: savedEncounter?.clinic_id || undefined,
            notes: `Internal referral to ${referral.specialty} - ${referral.reason}`,
            created_by: staffUuid,
            // Explicitly set referral workflow fields so the Encounter Office
            // Internal Referral section can find them even if the DB trigger
            // is missing or Supabase serializes undefined as null.
            referral_workflow_status: 'Pending_Encounter_Office',
            status: 'Under_Review',
          } as any);
        }

        // Process External NHIS Referral separately - goes to nhis_referral_queue for NHIS desk approval
        if (isNhisFeatureEnabled() && externalNhisReferral) {
          try {
            await createOutgoingReferral({
              patient_id: resolvedPatientUuid,
              source_encounter_id: resolvedEncounterId,
              requesting_doctor_id: staffUuid!,
              clinical_findings: externalNhisReferral.clinicalFindings,
              investigation_findings:
                externalNhisReferral.investigationFindings,
              provisional_diagnosis: externalNhisReferral.provisionalDiagnosis,
              reason_for_referral: externalNhisReferral.reason,
              additional_notes: externalNhisReferral.doctorName
                ? `Destination: ${externalNhisReferral.facilityName}, Doctor: ${externalNhisReferral.doctorName}`
                : `Destination: ${externalNhisReferral.facilityName}`,
              urgency: externalNhisReferral.urgency,
              requested_by: staffUuid!,
            });
            log.info(
              '[Consultation] External NHIS referral created successfully for:',
              externalNhisReferral.facilityName,
            );
          } catch (externalRefError) {
            log.error(
              'Failed to create external NHIS referral:',
              externalRefError,
            );
            showToast({
              type: 'warning',
              title: 'External NHIS Referral Issue',
              message: `Could not create external referral to ${externalNhisReferral.facilityName}. Please try again from NHIS desk.`,
            });
          }
        }
      } else if (
        (!resolvedEncounterId || !resolvedPatientUuid || !staffUuid) &&
        (procedureOrders.length > 0 ||
          admissionOrder ||
          specialtyReferrals.length > 0 ||
          externalNhisReferral)
      ) {
        // Warn if clinical requests couldn't be created due to missing encounter, patient, or staff
        log.warn(
          'Clinical requests require an encounter, valid patient, and staff. Procedure/Admission orders not submitted as requests.',
          {
            resolvedEncounterId,
            resolvedPatientUuid,
            staffUuid,
            'consultation.encounter_id': consultation.encounter_id,
            'consultation.visit_id': consultation.visit_id,
            'savedEncounter?.id': savedEncounter?.id,
            procedureOrdersCount: procedureOrders.length,
            hasAdmissionOrder: !!admissionOrder,
            specialtyReferralsCount: specialtyReferrals.length,
            hasExternalNhisReferral:
              isNhisFeatureEnabled() && !!externalNhisReferral,
          },
        );
        showToast({
          type: 'warning',
          title: 'Clinical Requests Not Created',
          message: !resolvedEncounterId
            ? 'Procedure/Admission/Referral requests require an active encounter. Please ensure the patient has an active encounter selected.'
            : !resolvedPatientUuid
              ? 'Could not resolve patient for clinical request. Please try again.'
              : 'Could not resolve staff ID. Please try logging in again.',
        });
      }

      // Submit all clinical requests in bulk
      if (clinicalRequests.length > 0) {
        try {
          log.info(
            '[Consultation] Creating clinical requests:',
            clinicalRequests,
          );
          const createdRequests =
            await createBulkClinicalRequests(clinicalRequests);
          log.info(
            '[Consultation] Clinical requests created successfully:',
            createdRequests,
          );

          // Auto-create Physiotherapy Treatment Plan if physio referral has session data
          const physioReferral = specialtyReferrals.find(
            (r) =>
              r.specialty.toLowerCase() === 'physiotherapy' &&
              r.physioSessionsPlanned,
          );
          if (
            physioReferral &&
            resolvedPatientUuid &&
            resolvedEncounterId &&
            staffUuid
          ) {
            try {
              // Find the created clinical_request for this physio referral
              const physioRequest = createdRequests?.find(
                (cr: any) =>
                  cr.specialty_module === 'physiotherapy' &&
                  cr.request_type === 'Referral',
              );
              await createPhysioPlanFromConsultation({
                patient_id: resolvedPatientUuid,
                encounter_id: resolvedEncounterId,
                prescribing_doctor_id: staffUuid,
                consultation_id: consultation.consultation_id,
                clinical_request_id: physioRequest?.id,
                order: {
                  sessions_prescribed: physioReferral.physioSessionsPlanned!,
                  frequency: physioReferral.physioFrequency || '3x per week',
                  billing_type:
                    physioReferral.physioBillingType || 'per_session',
                  instructions: physioReferral.physioInstructions,
                },
              });
              log.info(
                '[Consultation] Physio treatment plan created successfully',
              );
            } catch (physioPlanError) {
              log.error(
                'Failed to create physio treatment plan:',
                physioPlanError,
              );
            }
          }
        } catch (requestError) {
          log.error('Failed to create clinical requests:', requestError);
          // Don't fail the whole operation if request creation fails
          showToast({
            type: 'warning',
            title: 'Request Creation Issue',
            message:
              'Some clinical requests could not be created. Please try again.',
          });
        }
      } else {
        log.info(
          '[Consultation] No clinical requests to create. ProcedureOrders:',
          procedureOrders.length,
          'AdmissionOrder:',
          !!admissionOrder,
        );
      }

      // ── Follow-Up Booking ────────────────────────────────────────────────
      // When the doctor sets a follow_up_date, create (or update) a Follow-Up
      // booking in clinical_requests so it appears in the Encounter Office
      // Booking tab. Idempotent: calling again with the same encounter updates
      // the existing row rather than creating a duplicate.
      let followUpBooked = false;
      if (data.follow_up_date && resolvedEncounterId && staffUuid) {
        try {
          // resolvedPatientUuid may be null if no procedure/admission orders were
          // placed, so resolve it here as a fallback.
          let followUpPatientUuid = resolvedPatientUuid;
          if (!followUpPatientUuid) {
            followUpPatientUuid = await resolvePatientUuid(
              consultation.patient_id,
            );
          }

          if (followUpPatientUuid) {
            await upsertFollowupBooking({
              encounterId: resolvedEncounterId,
              patientId: followUpPatientUuid,
              requestingDoctorId: staffUuid,
              sourceClinicId: savedEncounter?.clinic_id || undefined,
              followUpDate: data.follow_up_date as string,
              followUpNotes: (data as any).follow_up_notes || undefined,
            });
            followUpBooked = true;
            log.info(
              '[Consultation] Follow-up booking upserted for encounter:',
              resolvedEncounterId,
            );
          } else {
            log.warn(
              '[Consultation] Could not resolve patient UUID for follow-up booking.',
            );
          }
        } catch (followUpError) {
          // Non-fatal — the consultation itself was saved successfully
          log.error(
            '[Consultation] Follow-up booking failed (non-fatal):',
            followUpError,
          );
        }
      }
      // ────────────────────────────────────────────────────────────────────

      // Note: billing_orders are already created by createBatchOrders above
      // No need to create legacy invoices anymore

      // Workflow transitions - only if encounter exists and valid transition is possible
      if (savedEncounter) {
        const needsBilling =
          requiresPaymentFirst(savedEncounter.payment_category) &&
          createdOrders.length > 0;

        // Determine the appropriate next stage based on current state and orders
        let nextStage: WorkflowStage | null = null;
        let notes = '';

        // Only transition to payment if we're not already in a payment-related flow
        // and if the current stage allows transition to payment
        const currentStage = savedEncounter.current_stage;
        const canTransitionToPayment = currentStage === 'consultation';

        if (needsBilling && canTransitionToPayment) {
          nextStage = 'payment';
          notes = 'Service payment required';
        } else if (labOrders.length > 0) {
          nextStage = 'lab_pending';
          notes = 'Lab tests ordered';
        } else if (radiologyOrders.length > 0) {
          nextStage = 'radiology_pending';
          notes = 'Imaging ordered';
        } else if (prescriptions.length > 0) {
          nextStage = 'pharmacy_pending';
          notes = 'Medications prescribed';
        } else {
          nextStage = 'billing_final';
          notes = 'Consultation complete';
        }

        // Only transition if we have a valid next stage and it's different from current
        if (nextStage && nextStage !== currentStage) {
          try {
            await transitionEncounter.mutateAsync({
              visit_id: savedEncounter.visit_id,
              next_stage: nextStage,
              notes,
            });
          } catch (transitionError) {
            log.error('Failed to transition encounter:', transitionError);
            // Don't fail the whole operation if transition fails
          }
        }
      }

      // Refetch encounters to update the queue
      await refetchEncounters();

      // Single consolidated success notification
      const successParts: string[] = ['Consultation saved'];
      if (labOrders.length > 0)
        successParts.push(`${labOrders.length} lab test(s)`);
      if (radiologyOrders.length > 0)
        successParts.push(`${radiologyOrders.length} imaging order(s)`);
      if (prescriptions.length > 0)
        successParts.push(`${prescriptions.length} prescription(s)`);
      if (treatmentTasks.length > 0)
        successParts.push(`${treatmentTasks.length} nursing task(s)`);
      if (followUpBooked) successParts.push('follow-up booked');

      // Count internal specialty referrals
      if (specialtyReferrals.length > 0)
        successParts.push(`${specialtyReferrals.length} internal referral(s)`);

      // Count external NHIS referral (separate from specialty)
      if (isNhisFeatureEnabled() && externalNhisReferral)
        successParts.push('1 external NHIS referral');

      // Count other clinical requests (procedures, admissions) - not including referrals
      if (clinicalRequests.length > specialtyReferrals.length) {
        const otherRequests =
          clinicalRequests.length - specialtyReferrals.length;
        if (otherRequests > 0)
          successParts.push(`${otherRequests} clinical request(s)`);
      }

      // Build the notification message
      let successMessage =
        successParts.length > 1
          ? `${successParts[0]} with ${successParts.slice(1).join(', ')}`
          : 'Consultation saved successfully';

      // If NHIS requests were created, add notification about them
      if (nhisRequestsCount > 0) {
        successMessage += `. ${nhisRequestsCount} service(s) sent to NHIS approval queue.`;
      }

      showToast({
        type: 'success',
        title: 'Consultation Complete',
        message: successMessage,
      });
    } catch (error) {
      // ROLLBACK: Re-open the form with the saved data so user can retry
      log.error('Failed to create consultation:', error);
      showToast({
        type: 'error',
        title: 'Save Failed',
        message:
          'Failed to save consultation. The form has been restored so you can try again.',
      });

      // Restore form state for retry
      setPreselectedPatient(savedPatient);
      setSelectedEncounter(savedEncounter);
      setIsFormOpen(true);
    }
  };

  /**
   * Handle submission from the Specialty Consultation Wizard.
   * Similar to handleCreateConsultation but includes specialty template data.
   */
  const handleCreateSpecialtyConsultation = useCallback(
    async (
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
      const encounterId =
        data.encounter_id || data.visit_id || selectedEncounter?.id;
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
          '[SpecialtyConsultation] Linkage validation failed:',
          linkageValidation,
        );
        return;
      }

      log.info(
        '[SpecialtyConsultation] Record linkage validated - EMR:',
        linkageValidation.emrNumber,
        'Encounter:',
        encounterId,
      );
      // ====================================================================

      // OPTIMISTIC UI: Close form immediately and show saving indicator
      const savedEncounter = selectedEncounter;
      const savedPatient = preselectedPatient;

      handleCloseWizard();

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
            specialty_template_version:
              specialtyData.specialty_template_version,
            specialty_data: specialtyData.form_data,
          }),
        };

        // Create consultation
        const consultation =
          await createConsultation.mutateAsync(consultationPayload);
        const staffId = consultation.doctor_id;
        const staffUuid = staff?.id;

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
                '[SpecialtyConsultation] Treatment plan created with',
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
                  .map((d) => d.trim())
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

          const patientName = preselectedPatient
            ? `${preselectedPatient.first_name || ''} ${preselectedPatient.surname || ''}`.trim()
            : undefined;
          const patientEmrNumber =
            preselectedPatient?.emr_number || preselectedPatient?.patient_id;

          const batchResult = await createBatchOrders({
            consultationId: consultation.consultation_id,
            patientId: consultation.patient_id,
            visitId: consultation.visit_id,
            encounterId: consultation.encounter_id!,
            orderedBy: staffId,
            labOrders,
            radiologyOrders,
            procedureOrders: procedureOrders || [],
            prescriptions,
            diagnosis: diagnosisArray,
            clinicalFindings,
            patientName,
            patientEmrNumber,
          });

          if (batchResult.procedureRlsFallbackTriggered) {
            showToast({
              type: 'warning',
              title: 'Procedure Request Routed',
              message:
                'Direct procedure queue insert is restricted for your role. The procedure has been routed through clinical requests for approval.',
            });
          }
        }

        // Create Clinical Requests for Admission Orders in specialty consultations
        if (admissionOrder) {
          const resolvedEncounterId =
            consultation.encounter_id || consultation.visit_id;
          let resolvedPatientUuid: string | null = null;

          try {
            resolvedPatientUuid = await resolvePatientUuid(
              consultation.patient_id,
            );
          } catch (e) {
            log.error(
              '[SpecialtyConsultation] Failed to resolve patient UUID for admission request:',
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
                '[SpecialtyConsultation] Admission request created successfully',
              );
            } catch (admissionErr) {
              log.error(
                '[SpecialtyConsultation] Failed to create admission request:',
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
              '[SpecialtyConsultation] Cannot create admission request - missing encounter, patient UUID, or staff UUID',
            );
            showToast({
              type: 'warning',
              title: 'Admission Request Not Created',
              message: 'Admission request requires an active encounter.',
            });
          }
        }

        // Create Internal Specialty Referral Requests for specialty consultations
        if (specialtyReferrals && specialtyReferrals.length > 0) {
          const resolvedEncounterId =
            consultation.encounter_id || consultation.visit_id;
          let resolvedPatientUuid: string | null = null;

          try {
            resolvedPatientUuid = await resolvePatientUuid(
              consultation.patient_id,
            );
          } catch (e) {
            log.error(
              '[SpecialtyConsultation] Failed to resolve patient UUID for referrals:',
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
                    requesting_doctor_id: staffUuid!,
                    request_type: 'Referral' as const,
                    clinical_reason: referral.reason,
                    urgency: referral.urgency,
                    specialty_module: referral.specialty.toLowerCase(),
                    notes: `Internal referral to ${referral.specialty} - ${referral.reason}`,
                    created_by: staffUuid,
                    // Explicitly set referral workflow fields so the Encounter Office
                    // Internal Referral section can find them even if the DB trigger
                    // is missing or Supabase serializes undefined as null.
                    referral_workflow_status: 'Pending_Encounter_Office',
                    status: 'Under_Review',
                  }) as any,
              );

            try {
              await createBulkClinicalRequests(referralRequests);
              log.info(
                '[SpecialtyConsultation] Internal referrals created:',
                specialtyReferrals.length,
              );
            } catch (refErr) {
              log.error(
                '[SpecialtyConsultation] Failed to create internal referrals:',
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

        // Process External NHIS Referral for specialty consultations
        if (isNhisFeatureEnabled() && externalNhisReferral) {
          const resolvedEncounterId =
            consultation.encounter_id || consultation.visit_id;
          let resolvedPatientUuid: string | null = null;

          try {
            resolvedPatientUuid = await resolvePatientUuid(
              consultation.patient_id,
            );
          } catch (e) {
            log.error(
              '[SpecialtyConsultation] Failed to resolve patient UUID for external referral:',
              e,
            );
          }

          if (resolvedEncounterId && resolvedPatientUuid && staffUuid) {
            try {
              await createOutgoingReferral({
                patient_id: resolvedPatientUuid,
                source_encounter_id: resolvedEncounterId,
                requesting_doctor_id: staffUuid!,
                clinical_findings: externalNhisReferral.clinicalFindings,
                investigation_findings:
                  externalNhisReferral.investigationFindings,
                provisional_diagnosis:
                  externalNhisReferral.provisionalDiagnosis,
                reason_for_referral: externalNhisReferral.reason,
                additional_notes: externalNhisReferral.doctorName
                  ? `Destination: ${externalNhisReferral.facilityName}, Doctor: ${externalNhisReferral.doctorName}`
                  : `Destination: ${externalNhisReferral.facilityName}`,
                urgency: externalNhisReferral.urgency,
                requested_by: staffUuid!,
              });
              log.info(
                '[SpecialtyConsultation] External NHIS referral created for:',
                externalNhisReferral.facilityName,
              );
            } catch (extRefErr) {
              log.error(
                '[SpecialtyConsultation] Failed to create external NHIS referral:',
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

        // ── Follow-Up Booking (Specialty) ───────────────────────────────────
        let followUpBooked = false;
        const resolvedEncounterIdForFollowUp =
          consultation.encounter_id || consultation.visit_id;
        if (
          data.follow_up_date &&
          resolvedEncounterIdForFollowUp &&
          staffUuid
        ) {
          try {
            let followUpPatientUuid: string | null = null;
            try {
              followUpPatientUuid = await resolvePatientUuid(
                consultation.patient_id,
              );
            } catch {
              showToast({
                type: 'warning',
                title: 'Follow-Up Not Booked',
                message:
                  'The consultation was saved, but the patient could not be resolved for follow-up booking.',
              });
            }

            if (followUpPatientUuid) {
              await upsertFollowupBooking({
                encounterId: resolvedEncounterIdForFollowUp,
                patientId: followUpPatientUuid,
                requestingDoctorId: staffUuid,
                sourceClinicId: savedEncounter?.clinic_id || undefined,
                followUpDate: data.follow_up_date as string,
                followUpNotes: (data as any).follow_up_notes || undefined,
              });
              followUpBooked = true;
              log.info(
                '[SpecialtyConsultation] Follow-up booking upserted for encounter:',
                resolvedEncounterIdForFollowUp,
              );
            }
          } catch (followUpError) {
            log.error(
              '[SpecialtyConsultation] Follow-up booking failed (non-fatal):',
              followUpError,
            );
          }
        }
        // ────────────────────────────────────────────────────────────────────

        // Refetch encounters to update the queue
        await refetchEncounters();

        // Build success message
        const successParts: string[] = ['Specialty consultation saved'];
        if (specialtyData?.specialty_code) {
          successParts[0] = `${specialtyData.specialty_code} consultation saved`;
        }
        if (labOrders.length > 0)
          successParts.push(`${labOrders.length} lab test(s)`);
        if (radiologyOrders.length > 0)
          successParts.push(`${radiologyOrders.length} imaging order(s)`);
        if (prescriptions.length > 0)
          successParts.push(`${prescriptions.length} prescription(s)`);
        if (procedureOrders && procedureOrders.length > 0)
          successParts.push(`${procedureOrders.length} procedure(s)`);
        if (treatmentTasks && treatmentTasks.length > 0)
          successParts.push(`${treatmentTasks.length} nursing task(s)`);
        if (admissionOrder) successParts.push('admission request');
        if (specialtyReferrals && specialtyReferrals.length > 0)
          successParts.push(`${specialtyReferrals.length} referral(s)`);
        if (isNhisFeatureEnabled() && externalNhisReferral)
          successParts.push('NHIS external referral');
        if (followUpBooked) successParts.push('follow-up booked');

        const successMessage =
          successParts.length > 1
            ? `${successParts[0]} with ${successParts.slice(1).join(', ')}`
            : 'Specialty consultation saved successfully';

        showToast({
          type: 'success',
          title: 'Consultation Complete',
          message: successMessage,
        });
      } catch (error) {
        log.error('Failed to create specialty consultation:', error);
        showToast({
          type: 'error',
          title: 'Save Failed',
          message:
            'Failed to save specialty consultation. The form has been restored so you can try again.',
        });

        // Restore form state for retry
        setPreselectedPatient(savedPatient);
        setSelectedEncounter(savedEncounter);
        setIsSpecialtyWizardOpen(true);
      }
    },
    [
      selectedEncounter,
      preselectedPatient,
      staff?.id,
      createConsultation,
      showToast,
      handleCloseWizard,
      refetchEncounters,
    ],
  );

  // Tab definitions
  const tabs = [
    {
      id: 'queue' as const,
      label: 'Active Queue',
      icon: ClipboardList,
      count: stats.waiting + stats.inProgress,
    },
    { id: 'my-patients' as const, label: 'My Patients', icon: UserCheck },
    {
      id: 'consultations' as const,
      label: 'Consultation Records',
      icon: FileText,
    },
    { id: 'history' as const, label: 'Patient History', icon: History },
  ];

  return (
    <div
      className={`flex h-[calc(100vh-4rem)] ${isNightMode ? 'bg-slate-950' : 'bg-slate-50'}`}
    >
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-4 sm:p-6">
          <div
            className={`relative overflow-hidden rounded-2xl border border-white/20 text-white shadow-[0_22px_55px_-22px_rgba(13,94,86,0.38)] sm:rounded-3xl ${headerGradient}`}
          >
            <div
              className={`absolute top-0 right-0 h-64 w-64 ${decorativeColors.iconBg} rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/3`}
            />
            <div
              className={`absolute bottom-0 left-1/4 h-40 w-72 ${decorativeColors.iconBg} rounded-full blur-2xl opacity-20`}
            />

            <div className="relative z-10 px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/95 p-1.5 shadow-lg ring-2 ring-white/35 sm:h-14 sm:w-14">
                    
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                      OPD & clinical
                    </p>
                    <h1 className="mt-0.5 flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl [text-rendering:optimizeLegibility]">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                        <Stethoscope className="h-5 w-5" strokeWidth={2.25} />
                      </span>
                      Clinical consultations
                    </h1>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/90">
                      <TimeIcon className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="font-medium">
                        Dr. {staff?.last_name || 'Doctor'}
                      </span>
                      <span className="text-white/45">·</span>
                      <span className="text-white/85">
                        {getFacilityName()}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {hasRole([
                    'super_admin',
                    'admin',
                    'doctor',
                    'medical_director',
                  ]) && (
                    <Button
                      variant="outline"
                      onClick={handleNewConsultation}
                      className="border-white/40 bg-white font-semibold text-[#11151C] hover:bg-emerald-50"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      New consultation
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 backdrop-blur-md">
                  <div className="rounded-full bg-amber-400/35 p-1">
                    <Clock
                      className="h-3.5 w-3.5 text-amber-100"
                      strokeWidth={2.25}
                    />
                  </div>
                  <span className="font-semibold tabular-nums text-white">
                    {stats.waiting}
                  </span>
                  <span className="text-xs font-medium text-white/85">
                    Queue
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 backdrop-blur-md">
                  <div className="rounded-full bg-sky-400/35 p-1">
                    <Activity
                      className="h-3.5 w-3.5 text-sky-100"
                      strokeWidth={2.25}
                    />
                  </div>
                  <span className="font-semibold tabular-nums text-white">
                    {stats.inProgress}
                  </span>
                  <span className="text-xs font-medium text-white/85">
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 backdrop-blur-md">
                  <div className="rounded-full bg-emerald-400/35 p-1">
                    <CheckCircle
                      className="h-3.5 w-3.5 text-emerald-100"
                      strokeWidth={2.25}
                    />
                  </div>
                  <span className="font-semibold tabular-nums text-white">
                    {stats.completed}
                  </span>
                  <span className="text-xs font-medium text-white/85">
                    Done
                  </span>
                </div>
                {stats.urgent > 0 && (
                  <div className="flex animate-pulse items-center gap-2 rounded-full border border-red-400/40 bg-red-950/50 px-3 py-1.5 backdrop-blur-md">
                    <div className="rounded-full bg-red-400/40 p-1">
                      <AlertTriangle
                        className="h-3.5 w-3.5 text-red-100"
                        strokeWidth={2.25}
                      />
                    </div>
                    <span className="font-semibold tabular-nums text-white">
                      {stats.urgent}
                    </span>
                    <span className="text-xs font-semibold text-red-100/95">
                      Urgent
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 pb-6 sm:px-6">
          <details
            className={`group rounded-2xl border ${
              isNightMode
                ? 'border-slate-700 bg-slate-900/80'
                : 'border-slate-200 bg-white shadow-sm'
            }`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 sm:px-5 sm:py-3.5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <PanelLeft className="h-4 w-4 text-primary-700 opacity-80" />
                Workspace tools & tips
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                AI assistant, queue help
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="border-t border-slate-100 px-4 pb-4 pt-2 dark:border-slate-700 sm:px-5">
              <div className="mb-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAIDashboardOpen(true)}
                  className={
                    isNightMode
                      ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                      : ''
                  }
                >
                  <Bot className="mr-1 h-4 w-4" />
                  Open medical AI
                </Button>
                {hasRole([
                  'super_admin',
                  'admin',
                  'doctor',
                  'medical_director',
                ]) && (
                  <Button variant="primary" onClick={handleNewConsultation}>
                    <Plus className="mr-1 h-4 w-4" />
                    New consultation
                  </Button>
                )}
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Module guidance
              </p>
              <InlineGuidance
                module="consultation"
                title="Patient queue"
                message="Select a patient from the waiting list to start their consultation. Patients ready for consultation have completed vitals."
              />
              <InlineGuidance
                module="consultation"
                title="My admitted patients"
                message="Use this list for inpatients assigned to you — rounds notes and discharge planning."
              />
              <InlineGuidance
                module="consultation"
                title="Consultation records"
                message="Search past consultations for follow-up and auditing."
              />
            </div>
          </details>

          <div
            className={`overflow-hidden rounded-2xl border shadow-sm sm:rounded-2xl ${
              isNightMode
                ? 'border-slate-800 bg-slate-900'
                : 'border-slate-200/90 bg-white'
            }`}
          >
            <div
              className={`border-b ${isNightMode ? 'border-slate-700' : 'border-slate-200'}`}
            >
              <nav className="-mb-px flex overflow-x-auto px-2 sm:px-4">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3.5 text-sm font-semibold transition-colors sm:px-5 sm:py-4 ${
                        activeTab === tab.id
                          ? `${themeColors.accent.border} ${themeColors.accent.text}`
                          : `border-transparent ${
                              isNightMode
                                ? 'text-slate-400 hover:text-slate-100'
                                : 'text-slate-600 hover:text-slate-900'
                            }`
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                      {tab.count !== undefined && tab.count > 0 && (
                        <span
                          className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                            activeTab === tab.id
                              ? `${themeColors.card.background} ${themeColors.accent.text}`
                              : isNightMode
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-5 sm:p-7 lg:p-8">
              {/* Active Queue Tab */}
              {activeTab === 'queue' && (
                <ConsultationQueuePanel
                  onSelectPatient={handleStartConsultationFromQueue}
                  selectedPatientId={selectedEncounter?.patient_id}
                />
              )}

              {/* My Patients Tab */}
              {activeTab === 'my-patients' && (
                <MyPatientsPanel
                  onSelectPatient={handleSelectPatientFromHistory}
                  selectedPatientId={selectedPatientId || undefined}
                />
              )}

              {/* Consultation Records Tab */}
              {activeTab === 'consultations' && (
                <ConsultationList
                  onNewConsultation={handleNewConsultation}
                  onViewConsultation={handleViewConsultation}
                  onEditConsultation={handleEditConsultation}
                />
              )}

              {/* Patient History Tab - Opens History Sidebar */}
              {activeTab === 'history' && (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-700/15 ring-2 ring-primary-700/20">
                    <History
                      className="h-8 w-8 text-primary-700"
                      strokeWidth={2}
                    />
                  </div>
                  <h4
                    className={`mb-2 text-lg font-semibold tracking-tight ${isNightMode ? 'text-slate-100' : 'text-slate-900'}`}
                  >
                    Patient history
                  </h4>
                  <p
                    className={`mx-auto mb-6 max-w-md text-sm leading-relaxed ${isNightMode ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    Open a patient to see consultations, labs, imaging and
                    prescriptions in one place.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setActiveTab('my-patients');
                    }}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Browse my patients
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal - Step-based Wizard UI */}
      {/* Conditionally show specialty wizard if specialty is detected, otherwise standard wizard */}
      {shouldUseSpecialtyWizard && specialtyTemplate ? (
        <SpecialtyConsultationWizard
          isOpen={isFormOpen || isSpecialtyWizardOpen}
          onClose={handleCloseWizard}
          onSubmit={handleCreateSpecialtyConsultation}
          isLoading={createConsultation.isPending}
          preselectedPatient={preselectedPatient}
          visitId={selectedEncounter?.id}
          encounterId={selectedEncounter?.id}
          specialtyCode={specialtyInfo.specialtyCode || ''}
          specialtyName={specialtyInfo.specialtyName || 'Specialty Clinic'}
          template={specialtyTemplate}
        />
      ) : (
        <ConsultationWizard
          isOpen={isFormOpen}
          onClose={handleCloseWizard}
          onSubmit={handleCreateConsultation}
          isLoading={createConsultation.isPending}
          preselectedPatient={preselectedPatient}
          visitId={selectedEncounter?.id} // UUID - THE single encounter identifier
          encounterId={selectedEncounter?.id} // UUID - same as visitId for consistency
        />
      )}

      {/* Specialty Wizard can also be opened explicitly */}
      {!shouldUseSpecialtyWizard &&
        isSpecialtyWizardOpen &&
        specialtyTemplate && (
          <SpecialtyConsultationWizard
            isOpen={isSpecialtyWizardOpen}
            onClose={handleCloseWizard}
            onSubmit={handleCreateSpecialtyConsultation}
            isLoading={createConsultation.isPending}
            preselectedPatient={preselectedPatient}
            visitId={selectedEncounter?.id}
            encounterId={selectedEncounter?.id}
            specialtyCode={specialtyInfo.specialtyCode || ''}
            specialtyName={specialtyInfo.specialtyName || 'Specialty Clinic'}
            template={specialtyTemplate}
          />
        )}

      {/* Detail Slide-over */}
      <ConsultationDetail
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedConsultation(null);
          setSelectedConsultationId(null);
        }}
        consultation={consultationDetails || selectedConsultation}
        onSaveEdit={handleSaveConsultationEdit}
        isSavingEdit={updateConsultation.isPending}
        onPrint={() => {
          window.print();
        }}
      />

      {/* AI Assistant Dashboard Panel */}
      {isAIDashboardOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={() => setIsAIDashboardOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-[61] w-full max-w-4xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-primary-700 to-primary-600 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-1.5 shadow">
                  
                </div>
                <span className="text-sm font-semibold">
                  XenoCare AI Assistant
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={aiSelectedPatientId}
                  onChange={(e) => {
                    setAiSelectedPatientId(e.target.value);
                  }}
                  className="text-xs text-gray-800 rounded-md border border-white/40 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/60"
                  disabled={aiPatients.length === 0}
                >
                  <option value="">
                    {aiPatients.length === 0
                      ? 'All encounter records (no queue patients)'
                      : 'All encounter records (optional patient filter)'}
                  </option>
                  {aiPatients.map((patient) => {
                    return (
                      <option key={patient.patientId} value={patient.patientId}>
                        {patient.patientName} • {patient.emrNumber}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={() => setIsAIDashboardOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/15 transition-colors"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <AIChatPanel
                key={selectedAiPatient?.patientId || 'no-patient'}
                patientId={selectedAiPatient?.patientId || null}
                patientName={selectedAiPatient?.patientName}
                emrNumber={selectedAiPatient?.emrNumber}
                facilityId={staff?.facility_id ?? ''}
                userId={staff?.id ?? ''}
                chiefComplaint={
                  selectedAiPatient?.encounter.chief_complaint ?? undefined
                }
                visitDate={selectedAiPatient?.encounter.created_at}
                department="OPD Consultation"
                assistantScope="clinical"
                variant="minimal"
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Patient History Sidebar - for when opening from other contexts */}
      <PatientHistorySidebar
        isOpen={isPatientHistoryOpen}
        onClose={() => {
          setIsPatientHistoryOpen(false);
          setSelectedPatientId(null);
        }}
        patientId={selectedPatientId}
        onStartConsultation={handleStartConsultationFromHistory}
      />
    </div>
  );
}
