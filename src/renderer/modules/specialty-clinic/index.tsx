/**
 * =============================================================================
 * XENOCARE EMR - SPECIALTY CLINIC MODULE
 *
 * This module provides template-driven consultation forms for specialty OPD
 * clinics. Unlike the standard GOPD consultation wizard, this module uses
 * pre-configured examination templates specific to each specialty.
 *
 * Supported Specialties (18):
 * - Cardiology, Orthopaedics, Dermatology, Urology, Gastroenterology
 * - Nephrology, Paediatrics, Neurosurgery, Neurology, Neuropsychiatry
 * - General Surgery, Gynaecology, Oral & Maxillofacial, Pulmonology
 * - Endocrinology, Plastic Surgery, ENT, Ophthalmology
 * =============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import { isNhisFeatureEnabled } from '../../config/features';
import { Navigate } from 'react-router-dom';
import {
  Microscope,
  Plus,
  Calendar,
  Clock,
  Users,
  Activity,
  TrendingUp,
  FileText,
  Search,
  ChevronRight,
  Heart,
  Bone,
  Hand,
  Ear,
  Eye,
  Brain,
  Baby,
  Scissors,
  Filter,
  AlertCircle,
  CheckCircle,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { Button, Input, SearchableSelect } from '../../components/ui';
import { SpecialtyConsultationWizard } from '../clinical-consultation/components/SpecialtyConsultationWizard';
import {
  SPECIALTY_TEMPLATES,
  getSpecialtyTemplate,
  getAllSpecialtyTemplates,
} from '../clinical-consultation/constants/specialty-templates';
import {
  SpecialtyTemplate,
  SpecialtyFormData,
  SpecialtySubmissionData,
} from '../clinical-consultation/dtos/specialty-template.dto';
import {
  CreateConsultationDTO,
  LabOrderDTO,
  RadiologyOrderDTO,
  PrescriptionOrderDTO,
  ProcedureOrderDTO,
  AdmissionOrderDTO,
} from '../clinical-consultation/dtos/consultation.dto';
import { PatientDTO } from '../patient-registration/dtos/patient.dto';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { useTimeTheme } from '../../hooks/useTimeTheme';
import { useCreateConsultation } from '../clinical-consultation/hooks/useConsultation';
import { useActiveEncounters, EncounterDTO } from '../../lib/workflow';
import { CreateTreatmentTaskDTO } from '../treatment-plan/dtos/treatment-plan.dto';
import { createTreatmentPlan } from '../treatment-plan/api/treatment-plan.api';
import {
  createBatchOrders,
  resolvePatientUuid,
} from '../clinical-consultation/api/consultation.api';
import { createBulkClinicalRequests } from '../clinical-requests/api/clinical-requests.api';
import type { CreateClinicalRequestDTO } from '../clinical-requests/dtos/clinical-request.dto';
import {
  SpecialtyReferralDTO,
  ExternalNhisReferralDTO,
} from '../clinical-consultation/components/ConsultationWizard';
import { createOutgoingReferral } from '../nhis/api/nhis.api';
import { validateRecordLinkage } from '../../lib/encounter';
import { supabase } from '../../api/supabaseClient';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import { formatSpecialtyExamNarrative } from '../../utils/clinicalTextFormatter';
// Role-based specialty dashboard import
import DynamicSpecialtyDashboard from './pages/SpecialtyClinicPage';
import { useCurrentUserSpecialty } from './hooks/useSpecialtyDashboard';
import { createScopedLogger } from '../../utils/logger';

const log = createScopedLogger('SpecialtyClinicModule');
// =============================================================================
// Types
// =============================================================================

interface SpecialtyClinicStats {
  total: number;
  inProgress: number;
  completed: number;
  waiting: number;
}

// Icon mapping for specialties
const SPECIALTY_ICONS: Record<string, React.ElementType> = {
  CARDIOLOGY: Heart,
  ORTHOPAEDICS: Bone,
  DERMATOLOGY: Hand,
  ENT: Ear,
  OPHTHALMOLOGY: Eye,
  NEUROLOGY: Brain,
  NEUROSURGERY: Brain,
  PAEDIATRICS: Baby,
  GENERAL_SURGERY: Scissors,
};

// =============================================================================
// Specialty Card Component
// =============================================================================

interface SpecialtyCardProps {
  template: SpecialtyTemplate;
  onSelect: (template: SpecialtyTemplate) => void;
  isSelected: boolean;
  patientCount: number;
}

const SpecialtyCard: React.FC<SpecialtyCardProps> = ({
  template,
  onSelect,
  isSelected,
  patientCount,
}) => {
  const Icon = SPECIALTY_ICONS[template.specialty_code] || Sparkles;

  return (
    <button
      onClick={() => onSelect(template)}
      className={`flex w-full items-center gap-3 rounded-xl border bg-white px-3.5 py-3 text-left transition-colors ${
        isSelected
          ? 'border-[#E9783F] bg-[#FDF8F4]'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          isSelected ? 'bg-[#F1EAE4] text-[#B36845]' : 'bg-slate-50 text-slate-500'
        }`}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight text-slate-900">
          {template.specialty_name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {template.sections?.length || 0} sections
          {patientCount > 0 ? ` · ${patientCount} waiting` : ''}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </button>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export default function SpecialtyClinicPage() {
  const { hasRole, staff } = useAuth();
  const { showToast } = useToast();
  const { timeOfDay, colors: themeColors } = useTimeTheme();

  // Check user's specialty and role - MUST be before any conditional returns
  const {
    data: userSpecialtyData,
    isLoading: isLoadingUserSpecialty,
    isError: isUserSpecialtyError,
    refetch: refetchUserSpecialty,
  } = useCurrentUserSpecialty();

  // State - ALL hooks must be called unconditionally
  const [selectedSpecialty, setSelectedSpecialty] =
    useState<SpecialtyTemplate | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [preselectedPatient, setPreselectedPatient] =
    useState<PatientDTO | null>(null);
  const [selectedEncounter, setSelectedEncounter] =
    useState<EncounterDTO | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data hooks
  const createConsultation = useCreateConsultation();
  const { data: activeEncounters, refetch: refetchEncounters } =
    useActiveEncounters();

  // Get all templates
  const allTemplates = useMemo(() => getAllSpecialtyTemplates(), []);

  // Filter templates based on search
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return allTemplates;

    const query = searchQuery.toLowerCase();
    return allTemplates.filter(
      (t) =>
        t.specialty_name.toLowerCase().includes(query) ||
        t.specialty_code.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query),
    );
  }, [allTemplates, searchQuery]);

  // Calculate stats per specialty
  const specialtyStats = useMemo(() => {
    const stats: Record<string, number> = {};

    // For now, we don't have clinic_type on encounters
    // This will be populated when specialty clinics have assigned clinic IDs
    // TODO: Map clinic_id to specialty codes when clinics are configured

    return stats;
  }, [activeEncounters]);

  // Overall stats
  const stats = useMemo((): SpecialtyClinicStats => {
    const total = Object.values(specialtyStats).reduce((a, b) => a + b, 0);
    return {
      total,
      inProgress: Math.floor(total * 0.3),
      completed: Math.floor(total * 0.5),
      waiting: Math.floor(total * 0.2),
    };
  }, [specialtyStats]);

  // Handlers
  const handleSelectSpecialty = useCallback((template: SpecialtyTemplate) => {
    setSelectedSpecialty(template);
    setShowDetails(true);
  }, []);

  const handleStartConsultation = useCallback(() => {
    if (!selectedSpecialty) {
      showToast({
        type: 'warning',
        title: 'Select Specialty',
        message: 'Please select a specialty clinic first',
      });
      return;
    }
    setIsWizardOpen(true);
  }, [selectedSpecialty, showToast]);

  const handleCloseWizard = useCallback(() => {
    setIsWizardOpen(false);
    setPreselectedPatient(null);
    setSelectedEncounter(null);
  }, []);

  /**
   * Submit handler for specialty consultation wizard.
   * Creates consultation with specialty template data and associated orders.
   */
  const handleSubmitConsultation = useCallback(
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
          '[SpecialtyClinic] Linkage validation failed:',
          linkageValidation,
        );
        return;
      }
      // ====================================================================

      setIsSubmitting(true);

      // Store for potential retry
      const savedEncounter = selectedEncounter;
      const savedPatient = preselectedPatient;

      handleCloseWizard();

      // Show saving indicator
      showToast({
        type: 'info',
        title: 'Saving...',
        message: 'Specialty consultation is being saved.',
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

              void createTreatmentPlan({
                encounter_id: consultation.encounter_id,
                patient_id: patientUuidForPlan,
                consultation_id: consultation.consultation_id,
                title: treatmentPlanTitle,
                description: consultation.treatment_plan || undefined,
                instructions: consultation.treatment_plan || undefined,
                tasks: treatmentTasks,
              })
                .then(() => {
                  log.info(
                    '[SpecialtyClinic] Treatment plan created with',
                    treatmentTasks.length,
                    'tasks',
                  );
                })
                .catch((treatmentPlanError) => {
                  log.error(
                    'Failed to create treatment plan:',
                    treatmentPlanError,
                  );
                });
            }
          } catch (treatmentPlanError) {
            log.error(
              'Failed to create treatment plan:',
              treatmentPlanError,
            );
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

          void createBatchOrders({
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
          }).catch((orderErr) => {
            log.error(
              '[SpecialtyClinic] Failed to create batch orders:',
              orderErr,
            );
            showToast({
              type: 'warning',
              title: 'Orders Not Sent',
              message:
                'Consultation saved, but one or more orders could not be sent.',
            });
          });
        }

        // Create Clinical Requests for Admission Orders
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
              '[SpecialtyClinic] Failed to resolve patient UUID for admission request:',
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

            void createBulkClinicalRequests(clinicalRequests)
              .then(() => {
                log.info(
                  '[SpecialtyClinic] Admission request created successfully',
                );
              })
              .catch((admissionErr) => {
                log.error(
                  '[SpecialtyClinic] Failed to create admission request:',
                  admissionErr,
                );
                showToast({
                  type: 'warning',
                  title: 'Admission Request Issue',
                  message:
                    'Could not create admission request. Please try again from clinical requests.',
                });
              });
          } else {
            log.warn(
              '[SpecialtyClinic] Cannot create admission request - missing encounter, patient UUID, or staff UUID',
            );
            showToast({
              type: 'warning',
              title: 'Admission Request Not Created',
              message: 'Admission request requires an active encounter.',
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
              '[SpecialtyClinic] Failed to resolve patient UUID for referrals:',
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

            void createBulkClinicalRequests(referralRequests)
              .then(() => {
                log.info(
                  '[SpecialtyClinic] Internal referrals created:',
                  specialtyReferrals.length,
                );
              })
              .catch((refErr) => {
                log.error(
                  '[SpecialtyClinic] Failed to create internal referrals:',
                  refErr,
                );
                showToast({
                  type: 'warning',
                  title: 'Referral Issue',
                  message:
                    'Some internal referrals could not be created. Please try again.',
                });
              });
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
              '[SpecialtyClinic] Failed to resolve patient UUID for external referral:',
              e,
            );
          }

          if (resolvedEncounterId && resolvedPatientUuid && staffUuid) {
            void createOutgoingReferral({
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
            })
              .then(() => {
                log.info(
                  '[SpecialtyClinic] External NHIS referral created for:',
                  externalNhisReferral.facilityName,
                );
              })
              .catch((extRefErr) => {
                log.error(
                  '[SpecialtyClinic] Failed to create external NHIS referral:',
                  extRefErr,
                );
                showToast({
                  type: 'warning',
                  title: 'External Referral Issue',
                  message: `Could not create external referral to ${externalNhisReferral.facilityName}. Please try from NHIS desk.`,
                });
              });
          }
        }

        // Refetch encounters to update any queue displays
        void refetchEncounters();

        // Build success message
        const successParts: string[] = [];
        if (selectedSpecialty?.specialty_name) {
          successParts.push(
            `${selectedSpecialty.specialty_name} consultation saved`,
          );
        } else {
          successParts.push('Specialty consultation saved');
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
        if (externalNhisReferral) successParts.push('NHIS external referral');

        const successMessage =
          successParts.length > 1
            ? `${successParts[0]} with ${successParts.slice(1).join(', ')}`
            : successParts[0];

        showToast({
          type: 'success',
          title: 'Consultation Complete',
          message: successMessage,
        });
      } catch (error) {
        log.error('Error creating specialty consultation:', error);
        showToast({
          type: 'error',
          title: 'Save Failed',
          message:
            'Failed to save specialty consultation. The form has been restored.',
        });

        // Restore form state for retry
        setPreselectedPatient(savedPatient);
        setSelectedEncounter(savedEncounter);
        setIsWizardOpen(true);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      selectedEncounter,
      preselectedPatient,
      selectedSpecialty,
      createConsultation,
      showToast,
      handleCloseWizard,
      refetchEncounters,
    ],
  );

  // Dynamic header gradient
  const headerGradient = useMemo(() => {
    return `bg-gradient-to-r ${themeColors.header.gradient}`;
  }, [themeColors]);

  // =============================================================================
  // ROLE-BASED RENDERING
  // =============================================================================

  // Determine if user is an admin (can see all specialties)
  const isAdmin =
    userSpecialtyData?.role &&
    ['super_admin', 'admin', 'medical_director'].includes(
      userSpecialtyData.role,
    );

  // Loading state
  if (isLoadingUserSpecialty) {
    return <SkeletonDashboard />;
  }

  // Network error or failed to resolve user specialty — show error with retry
  // Do NOT fall through to admin view, which would expose all specialties
  if (
    isUserSpecialtyError ||
    (!userSpecialtyData?.role && !userSpecialtyData?.specialty_code)
  ) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-10 w-10 text-amber-500" />
        <p className="text-gray-600 text-sm text-center max-w-md">
          Could not load your specialty assignment. Please check your network
          connection and try again.
        </p>
        <Button
          variant="outline"
          onClick={() => refetchUserSpecialty()}
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  // If user is NOT an admin and HAS a specialty_code, show their personal specialty dashboard
  // Only super_admin/admin/medical_director see the full specialty list
  if (!isAdmin && userSpecialtyData?.specialty_code) {
    // Specialties with dedicated modules get redirected to their own pages
    const DEDICATED_MODULE_ROUTES: Record<string, string> = {
      OPHTHALMOLOGY: '/ophthalmology',
      PHYSIOTHERAPY: '/physiotherapy',
      DENTAL: '/dental',
    };
    const dedicatedRoute =
      DEDICATED_MODULE_ROUTES[userSpecialtyData.specialty_code.toUpperCase()];
    if (dedicatedRoute) {
      return <Navigate to={dedicatedRoute} replace />;
    }

    return <DynamicSpecialtyDashboard />;
  }

  // =============================================================================
  // ADMIN VIEW - Specialty list
  // =============================================================================

  return (
    <div className="h-full overflow-y-auto bg-[#F7F6F3]">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Specialty clinics
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Choose a clinic to start a consultation.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-slate-500">
          <span>
            <strong className="font-display text-lg text-slate-900">
              {stats.total}
            </strong>{' '}
            today
          </span>
          <span>
            <strong className="font-display text-lg text-slate-900">
              {stats.inProgress}
            </strong>{' '}
            in progress
          </span>
          <span>
            <strong className="font-display text-lg text-slate-900">
              {stats.completed}
            </strong>{' '}
            completed
          </span>
          <span>
            <strong className="font-display text-lg text-slate-900">
              {stats.waiting}
            </strong>{' '}
            waiting
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="search"
              placeholder="Search clinics"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#E9783F]"
            />
          </div>
          <span className="text-xs text-slate-500">
            {filteredTemplates.length} clinics
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filteredTemplates.map((template) => (
            <SpecialtyCard
              key={template.id}
              template={template}
              onSelect={handleSelectSpecialty}
              isSelected={selectedSpecialty?.id === template.id}
              patientCount={specialtyStats[template.specialty_code] || 0}
            />
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
            <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">No clinics match your search</p>
          </div>
        )}
      </div>

      {/* Specialty details */}
      {showDetails && selectedSpecialty && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
          <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F1EAE4] text-[#B36845]">
                  {(() => {
                    const Icon =
                      SPECIALTY_ICONS[selectedSpecialty.specialty_code] ||
                      Sparkles;
                    return <Icon size={20} />;
                  })()}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-bold text-slate-900">
                    {selectedSpecialty.specialty_name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedSpecialty.sections?.length || 0} examination sections
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                aria-label="Close specialty details"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <p className="text-sm leading-relaxed text-slate-600">
                {selectedSpecialty.description}
              </p>
              <div className="mt-4 space-y-1.5">
                {selectedSpecialty.sections?.map((section, idx) => (
                  <div
                    key={section.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm text-slate-700">
                      {idx + 1}. {section.section_name}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {section.fields?.length || 0} fields
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  handleStartConsultation();
                }}
                className="rounded-lg bg-[#E9783F] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#D96A36]"
              >
                Start consultation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Specialty Consultation Wizard */}
      {selectedSpecialty && (
        <SpecialtyConsultationWizard
          isOpen={isWizardOpen}
          onClose={handleCloseWizard}
          onSubmit={handleSubmitConsultation}
          isLoading={isSubmitting}
          specialtyCode={selectedSpecialty.specialty_code}
          specialtyName={selectedSpecialty.specialty_name}
          template={selectedSpecialty}
          preselectedPatient={preselectedPatient}
          visitId={selectedEncounter?.id}
          encounterId={selectedEncounter?.id}
        />
      )}
    </div>
  );
}