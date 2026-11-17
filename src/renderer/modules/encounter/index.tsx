/**
 * =============================================================================
 * XENOCARE EMR - ENCOUNTER MODULE INDEX
 * Description: Main page for the Encounter module with NDC branding
 * =============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stethoscope,
  Calendar,
  Building2,
  Clock,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  Shield,
  Download,
  FileText,
  Send,
  X,
  CreditCard,
  Check,
  Loader2,
  Bot,
  Settings2,
} from 'lucide-react';
import { usePatient } from '../patient-registration/hooks/usePatient';
import { useDebounce } from '../../hooks/useDebounce';
import { isNhisFeatureEnabled } from '../../config/features';
import { DEPLOYMENT } from '../../config/deployment';
import {
  Encounter,
  EncounterFilters,
  EncounterStatuses,
  VisitTypes,
  PriorityLevels,
  EncounterStatus,
  VisitType,
  PriorityLevel,
  Clinic,
} from './dtos/encounter.dto';
import {
  useEncounters,
  useEncounterStats,
  useTodaysEncounters,
  useDiagnosisFilterOptions,
  useChiefComplaintFilterOptions,
  useCourseFilterOptions,
  useUpdateClinic,
} from './hooks/useEncounter';
import { useDoctors, useClinics } from '../staff/hooks/useStaff';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import {
  EncounterForm,
  EncounterTable,
  EncounterDetail,
  ClinicList,
  EncounterFilterPanel,
  EncounterFilterBadge,
  EncounterReportTemplate,
  InternalReferralQueue,
  ExternalReferralsTab,
  defaultEncounterFilters,
  type AdvancedEncounterFilters,
  PatientEncounterSummary,
  ComprehensiveEncounterFilterPanel,
  defaultComprehensiveFilters,
  type ComprehensiveEncounterFilters,
  ExportModal,
  EncounterSettingsPanel,
} from './components';
import { useTimeTheme } from '../../hooks/useTimeTheme';
import { AIChatPanel } from '../ai-assistant/components/AIChatPanel';
import { NhisReferralQueue } from '../nhis/components/NhisReferralQueue';
import { useProcessReferralQueue, useReferralQueue } from '../nhis/hooks';
import {
  getOutgoingExternalReferrals,
  type ExternalReferral,
} from '../../lib/referrals/tracking';

type TabType =
  | 'encounters'
  | 'patients'
  | 'today'
  | 'clinics'
  | 'referrals'
  | 'external-referrals'
  | 'settings';

// Patient type for pre-selection from URL
interface PreSelectedPatient {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  emr_number?: string;
  date_of_birth?: string;
  phone?: string;
  service_number?: string;
  patient_category?: string;
  insurance_type?: string;
  nhis_patient_source?: 'Internal' | 'Referral';
}

interface EncounterAIPatientContext {
  patientId: string;
  patientName: string;
  emrNumber: string;
  encounterId?: string;
  chiefComplaint?: string;
  visitDate?: string;
  department?: string;
  encounterContext: Record<string, unknown>;
}

function buildEncounterHistoryContext(
  patientId: string,
  patientName: string,
  emrNumber: string,
  encounters: Encounter[],
): Record<string, unknown> {
  const patientEncounters = encounters.filter(
    (item) => item.patient_id === patientId,
  );
  const latest = patientEncounters
    .slice()
    .sort(
      (a, b) =>
        new Date(b.encounter_date || b.created_at).getTime() -
        new Date(a.encounter_date || a.created_at).getTime(),
    )[0];

  const toCountMap = (values: Array<string | null | undefined>) => {
    return values.reduce<Record<string, number>>((acc, raw) => {
      const key = raw || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  };

  const unique = (values: Array<string | null | undefined>) =>
    Array.from(new Set(values.filter(Boolean) as string[]));

  return {
    patient_name: patientName,
    emr_number: emrNumber,
    total_encounters: patientEncounters.length,
    first_visit_date: patientEncounters
      .map((item) => item.encounter_date || item.created_at)
      .filter(Boolean)
      .sort()[0],
    latest_visit_date: latest?.encounter_date || latest?.created_at,
    latest_encounter: latest
      ? {
          visit_id: latest.visit_id,
          encounter_id: latest.id,
          status: latest.status,
          current_stage: latest.current_stage,
          visit_type: latest.visit_type,
          priority: latest.priority,
          chief_complaint: latest.chief_complaint,
          clinic_name: latest.clinic?.clinic_name,
          attending_doctor: latest.attending_doctor
            ? `${latest.attending_doctor.rank ? `${latest.attending_doctor.rank} ` : ''}${latest.attending_doctor.first_name || ''} ${latest.attending_doctor.last_name || ''}`.trim()
            : undefined,
        }
      : null,
    visit_types: unique(patientEncounters.map((item) => item.visit_type)),
    priority_breakdown: toCountMap(
      patientEncounters.map((item) => item.priority || undefined),
    ),
    status_breakdown: toCountMap(
      patientEncounters.map((item) => item.status || undefined),
    ),
    stage_breakdown: toCountMap(
      patientEncounters.map((item) => item.current_stage || undefined),
    ),
    chief_complaints: unique(
      patientEncounters.map((item) => item.chief_complaint || undefined),
    ).slice(0, 10),
    clinic_history: unique(
      patientEncounters.map((item) => item.clinic?.clinic_name || undefined),
    ).slice(0, 10),
    attending_doctors: unique(
      patientEncounters.map((item) =>
        item.attending_doctor
          ? `${item.attending_doctor.rank ? `${item.attending_doctor.rank} ` : ''}${item.attending_doctor.first_name || ''} ${item.attending_doctor.last_name || ''}`.trim()
          : undefined,
      ),
    ).slice(0, 10),
  };
}

const EncounterModule: React.FC = () => {
  const { isNightMode } = useTimeTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('encounters');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(
    null,
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [preSelectedPatient, setPreSelectedPatient] =
    useState<PreSelectedPatient | null>(null);
  const [externalReferralTab, setExternalReferralTab] = useState<
    'outgoing' | 'incoming'
  >('incoming');

  // AI Assistant Panel State
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [aiSelectedPatientId, setAiSelectedPatientId] = useState<string>('');

  // Clinic editing state (Super Admin only)
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [editedClinicData, setEditedClinicData] = useState<{
    // Clinic details
    clinic_name: string;
    clinic_code: string;
    description: string;
    location: string;
    operating_hours: string;
    is_active: boolean;
    // Private prices (InsuranceType: 'Private')
    consultation_fee: number;
    follow_up_fee: number;
    emergency_fee: number;
    // Military NHIS prices (InsuranceType: 'Military_NHIS')
    military_nhis_consultation_fee: number;
    military_nhis_follow_up_fee: number;
    military_nhis_emergency_fee: number;
    // Civilian NHIS prices (InsuranceType: 'Civilian_NHIS')
    nhis_consultation_fee: number;
    nhis_follow_up_fee: number;
    nhis_emergency_fee: number;
    // Retainership prices (InsuranceType: 'Retainership')
    retainership_consultation_fee: number;
    retainership_follow_up_fee: number;
    retainership_emergency_fee: number;
    // GIFSHIP prices (InsuranceType: 'GIFSHIP')
    gifship_consultation_fee: number;
    gifship_follow_up_fee: number;
    gifship_emergency_fee: number;
  } | null>(null);

  const { hasRole, staff } = useAuth();
  const { showToast } = useToast();
  const updateClinic = useUpdateClinic();
  const isSuperAdmin = hasRole(['super_admin']);
  const canViewExternalReferrals = hasRole(['super_admin', 'admin']);

  // Only fetch external_referral items for the External Referrals tab
  // Internal NHIS approvals (from specialty referrals) go to NHIS Specialty queue instead
  const {
    data: referralQueueData,
    isLoading: referralQueueLoading,
    refetch: refetchReferralQueue,
  } = useReferralQueue({ request_type: 'external_referral' });
  const processReferralQueue = useProcessReferralQueue();

  const externalReferralStats = useMemo(() => {
    const items = referralQueueData?.data || [];
    const today = new Date().toISOString().split('T')[0];
    return {
      pending: items.filter(
        (i: any) => i.status === 'pending' || i.status === 'in_review',
      ).length,
      expired: items.filter((i: any) => i.status === 'expired' || i.is_expired)
        .length,
      approvedToday: items.filter(
        (i: any) =>
          i.status === 'approved' && i.processed_at?.startsWith(today),
      ).length,
      rejected: items.filter((i: any) => i.status === 'rejected').length,
    };
  }, [referralQueueData]);

  const {
    data: outgoingExternalReferrals = [],
    isLoading: outgoingExternalLoading,
  } = useQuery({
    queryKey: ['external-referrals', 'outgoing'],
    queryFn: () => getOutgoingExternalReferrals(),
  });

  // Get patientId from URL params for auto-opening encounter form
  const urlPatientId = searchParams.get('patientId');
  const urlAction = searchParams.get('action');

  // Fetch patient data when patientId is in URL
  const { data: patientData, isLoading: patientLoading } = usePatient(
    urlPatientId || '',
  );

  // Auto-open form when patient is loaded from URL
  useEffect(() => {
    if (
      urlAction === 'create' &&
      urlPatientId &&
      patientData &&
      !patientLoading
    ) {
      // Map patient data to PreSelectedPatient format
      const mappedPatient: PreSelectedPatient = {
        id: patientData.id || urlPatientId || '',
        patient_id: patientData.patient_id,
        first_name: patientData.first_name,
        last_name: patientData.surname,
        emr_number: patientData.emr_number || undefined,
        date_of_birth: patientData.date_of_birth || undefined,
        phone: patientData.contact_phone || undefined,
        service_number: patientData.service_number || undefined,
        patient_category: patientData.patient_category || undefined,
        insurance_type: patientData.insurance_type || undefined,
        nhis_patient_source: patientData.nhis_patient_source || undefined,
      };
      setPreSelectedPatient(mappedPatient);
      setIsFormOpen(true);
      // Clear URL params after opening form
      setSearchParams({});
    }
  }, [urlAction, urlPatientId, patientData, patientLoading, setSearchParams]);

  // Basic Filters (existing)
  const [filters, setFilters] = useState<EncounterFilters>({
    status: 'all',
    visit_type: 'all',
    priority: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Advanced Filters (new)
  const [advancedFilters, setAdvancedFilters] =
    useState<AdvancedEncounterFilters>(defaultEncounterFilters);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Comprehensive Filters (admin panel)
  const [comprehensiveFilters, setComprehensiveFilters] =
    useState<ComprehensiveEncounterFilters>(defaultComprehensiveFilters);
  const [showComprehensiveFilters, setShowComprehensiveFilters] =
    useState(false);

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Data hooks
  const {
    data: encountersData,
    isLoading: encountersLoading,
    refetch: refetchEncounters,
  } = useEncounters({
    ...filters,
    query: debouncedSearchQuery,
  });
  const encounters = useMemo<Encounter[]>(
    () => (Array.isArray(encountersData) ? encountersData : []),
    [encountersData],
  );
  const { data: stats, isLoading: statsLoading } = useEncounterStats();
  const { data: todaysEncounters = [], isLoading: todayLoading } =
    useTodaysEncounters();

  const encounterAiPatients = useMemo<EncounterAIPatientContext[]>(() => {
    const byPatient = new Map<string, EncounterAIPatientContext>();

    const addEncounter = (encounter: Encounter) => {
      const patientId = encounter.patient_id;
      if (!patientId) return;

      const patientName = encounter.patient
        ? `${encounter.patient.first_name || ''} ${encounter.patient.surname || encounter.patient.last_name || ''}`.trim() ||
          'Unknown Patient'
        : 'Unknown Patient';
      const emrNumber =
        encounter.emr_number ||
        encounter.patient?.emr_number ||
        encounter.patient?.patient_id ||
        patientId;
      const visitDate = encounter.encounter_date || encounter.created_at;
      const existing = byPatient.get(patientId);
      const existingTs = existing?.visitDate
        ? new Date(existing.visitDate).getTime()
        : 0;
      const nextTs = visitDate ? new Date(visitDate).getTime() : 0;

      if (existing && nextTs <= existingTs) return;

      byPatient.set(patientId, {
        patientId,
        patientName,
        emrNumber,
        encounterId: encounter.id,
        chiefComplaint: encounter.chief_complaint || undefined,
        visitDate,
        department: encounter.clinic?.clinic_name || undefined,
        encounterContext: buildEncounterHistoryContext(
          patientId,
          patientName,
          emrNumber,
          encounters,
        ),
      });
    };

    encounters.forEach(addEncounter);
    if (selectedEncounter) {
      addEncounter(selectedEncounter);
    }

    if (preSelectedPatient?.id && !byPatient.has(preSelectedPatient.id)) {
      byPatient.set(preSelectedPatient.id, {
        patientId: preSelectedPatient.id,
        patientName:
          `${preSelectedPatient.first_name || ''} ${preSelectedPatient.last_name || ''}`.trim() ||
          'Unknown Patient',
        emrNumber:
          preSelectedPatient.emr_number ||
          preSelectedPatient.patient_id ||
          preSelectedPatient.id,
        encounterContext: {
          source: 'preselected_patient_context',
        },
      });
    }

    return Array.from(byPatient.values()).sort((a, b) =>
      a.patientName.localeCompare(b.patientName),
    );
  }, [encounters, preSelectedPatient, selectedEncounter]);

  const selectedAiPatient = useMemo(
    () =>
      encounterAiPatients.find(
        (patient) => patient.patientId === aiSelectedPatientId,
      ) || null,
    [encounterAiPatients, aiSelectedPatientId],
  );

  useEffect(() => {
    if (!isAIPanelOpen) return;

    // Default to global mode so admins can query all encounter records immediately.
    setAiSelectedPatientId('');
  }, [isAIPanelOpen]);

  useEffect(() => {
    if (!aiSelectedPatientId) return;

    const stillVisible = encounterAiPatients.some(
      (patient) => patient.patientId === aiSelectedPatientId,
    );

    if (!stillVisible) {
      setAiSelectedPatientId('');
    }
  }, [aiSelectedPatientId, encounterAiPatients]);

  // Filter options hooks
  const { data: diagnosisList = [] } = useDiagnosisFilterOptions(50);
  const { data: chiefComplaintList = [] } = useChiefComplaintFilterOptions();
  const { data: courseList = [] } = useCourseFilterOptions();

  // Doctor and clinic lists for filters
  const { data: doctorData = [] } = useDoctors();
  const { data: clinicData = [] } = useClinics();

  // Format doctor list for filter panel
  const doctorList = doctorData.map((doc: any) => ({
    id: doc.id || doc.staff_id,
    name: `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || 'Unknown',
    rank: doc.rank || '',
  }));

  // Format clinic list for filter panel
  const clinicList = clinicData.map((clinic: any) => ({
    id: clinic.id || clinic.clinic_id,
    name: clinic.clinic_name || clinic.name || 'Unknown Clinic',
  }));

  // Handle advanced filter apply
  const handleApplyAdvancedFilters = () => {
    // Map advanced filters to the basic filter format for the hook
    setFilters({
      status: advancedFilters.status,
      visit_type: advancedFilters.visitType,
      priority: advancedFilters.priority,
      date_from: advancedFilters.dateFrom || undefined,
      date_to: advancedFilters.dateTo || undefined,
      attending_doctor_id:
        advancedFilters.doctorId !== 'all'
          ? advancedFilters.doctorId
          : undefined,
      clinic_id:
        advancedFilters.clinicId !== 'all'
          ? advancedFilters.clinicId
          : undefined,
      // Extended filters
      patient_category:
        advancedFilters.patientCategory !== 'all'
          ? advancedFilters.patientCategory
          : undefined,
      insurance_type:
        advancedFilters.insuranceType !== 'all'
          ? advancedFilters.insuranceType
          : undefined,
      payment_category:
        advancedFilters.paymentCategory !== 'all'
          ? advancedFilters.paymentCategory
          : undefined,
      gender:
        advancedFilters.gender !== 'all' ? advancedFilters.gender : undefined,
      age_min: advancedFilters.ageRangeMin
        ? parseInt(advancedFilters.ageRangeMin)
        : undefined,
      age_max: advancedFilters.ageRangeMax
        ? parseInt(advancedFilters.ageRangeMax)
        : undefined,
      course:
        advancedFilters.course !== 'all' ? advancedFilters.course : undefined,
      diagnosis:
        advancedFilters.diagnosis !== 'all'
          ? advancedFilters.diagnosis
          : undefined,
      chief_complaint:
        advancedFilters.chiefComplaint !== 'all'
          ? advancedFilters.chiefComplaint
          : undefined,
    });
    if (advancedFilters.searchQuery) {
      setSearchQuery(advancedFilters.searchQuery);
    }
    setShowAdvancedFilters(false);
  };

  // Handle clear advanced filters
  const handleClearAdvancedFilters = () => {
    setAdvancedFilters(defaultEncounterFilters);
    setFilters({
      status: 'all',
      visit_type: 'all',
      priority: 'all',
    });
    setSearchQuery('');
  };

  // Handle comprehensive filter apply
  const handleApplyComprehensiveFilters = () => {
    const f = comprehensiveFilters;
    const notAll = (v: string) => (v && v !== 'all' ? v : undefined);
    const toInt = (v: string) => (v ? parseInt(v) || undefined : undefined);

    setFilters({
      status: f.status,
      visit_type: f.visitType,
      priority: f.priority,
      date_from: f.dateFrom || undefined,
      date_to: f.dateTo || undefined,
      attending_doctor_id: notAll(f.doctorId),
      clinic_id: notAll(f.clinicId),
      patient_category: notAll(f.patientCategory),
      insurance_type: notAll(f.insuranceType),
      payment_category: notAll(f.paymentCategory),
      gender: notAll(f.gender),
      age_min: toInt(f.ageRangeMin),
      age_max: toInt(f.ageRangeMax),
      course: notAll(f.course),
      diagnosis: notAll(f.diagnosis),
      diagnosis_code: f.diagnosisCode || undefined,
      icd10_category: notAll(f.icd10Category),
      chief_complaint: notAll(f.chiefComplaint),
      department_id: notAll(f.departmentId),
      specialty_code: notAll(f.specialtyCode),
      registered_by: notAll(f.registeredBy),
      has_consultation: notAll(f.hasConsultation),
      has_treatment_plan: notAll(f.hasTreatmentPlan),
      has_lab_order: notAll(f.hasLabOrder),
      lab_status: notAll(f.labStatus),
      has_radiology_order: notAll(f.hasRadiologyOrder),
      radiology_status: notAll(f.radiologyStatus),
      has_prescription: notAll(f.hasPrescription),
      prescription_status: notAll(f.prescriptionStatus),
      has_procedure: notAll(f.hasProcedure),
      has_internal_referral: notAll(f.hasInternalReferral),
      referral_target_specialty: notAll(f.referralTargetSpecialty),
      has_external_referral: notAll(f.hasExternalReferral),
      nhis_referral_status: notAll(f.nhisReferralStatus),
      nhis_claim_status: notAll(f.nhisClaimStatus),
      patient_type: notAll(f.patientType),
      was_admitted: notAll(f.wasAdmitted),
      ward: notAll(f.ward),
      discharge_status: notAll(f.dischargeStatus),
      encounter_outcome: notAll(f.encounterOutcome),
      los_min: toInt(f.losMin),
      los_max: toInt(f.losMax),
      triage_category: notAll(f.triageCategory),
      arrival_mode: notAll(f.arrivalMode),
      ae_disposition: notAll(f.aeDisposition),
      anc_visit_number: f.ancVisitNumber || undefined,
      gestational_age_min: f.gestationalAgeMin || undefined,
      gestational_age_max: f.gestationalAgeMax || undefined,
      has_pending_bills: notAll(f.hasPendingBills),
      has_completed_payment: notAll(f.hasCompletedPayment),
      billing_amount_min: toInt(f.billingAmountMin),
      billing_amount_max: toInt(f.billingAmountMax),
      is_overdue: notAll(f.isOverdue),
      is_expired: notAll(f.isExpired),
    });
    if (f.searchQuery) {
      setSearchQuery(f.searchQuery);
    }
    setShowComprehensiveFilters(false);
  };

  // Handle clear comprehensive filters
  const handleClearComprehensiveFilters = () => {
    setComprehensiveFilters(defaultComprehensiveFilters);
    setFilters({
      status: 'all',
      visit_type: 'all',
      priority: 'all',
    });
    setSearchQuery('');
  };

  const handleRowClick = (encounter: Encounter) => {
    setSelectedEncounter(encounter);
    setIsDetailOpen(true);
  };

  const handleFormSuccess = () => {
    refetchEncounters();
    setIsFormOpen(false);
    setPreSelectedPatient(null);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setPreSelectedPatient(null);
  };

  // Clinic management handlers (Super Admin only)
  const handleEditClinic = (clinic: Clinic) => {
    if (!isSuperAdmin) {
      showToast({
        type: 'error',
        message: 'Only Super Admin can manage clinics',
      });
      return;
    }
    const c = clinic as any;
    setEditingClinic(clinic);
    setEditedClinicData({
      clinic_name: c.clinic_name || '',
      clinic_code: c.clinic_code || '',
      description: c.description || '',
      location: c.location || '',
      operating_hours: c.operating_hours || '',
      is_active: c.is_active ?? true,
      consultation_fee: c.consultation_fee || 0,
      follow_up_fee: c.follow_up_fee || 0,
      emergency_fee: c.emergency_fee || 0,
      military_nhis_consultation_fee: c.military_nhis_consultation_fee || 0,
      military_nhis_follow_up_fee: c.military_nhis_follow_up_fee || 0,
      military_nhis_emergency_fee: c.military_nhis_emergency_fee || 0,
      security_services_nhis_consultation_fee:
        c.security_services_nhis_consultation_fee || 0,
      security_services_nhis_follow_up_fee:
        c.security_services_nhis_follow_up_fee || 0,
      security_services_nhis_emergency_fee:
        c.security_services_nhis_emergency_fee || 0,
      nhis_consultation_fee: c.nhis_consultation_fee || 0,
      nhis_follow_up_fee: c.nhis_follow_up_fee || 0,
      nhis_emergency_fee: c.nhis_emergency_fee || 0,
      retainership_consultation_fee: c.retainership_consultation_fee || 0,
      retainership_follow_up_fee: c.retainership_follow_up_fee || 0,
      retainership_emergency_fee: c.retainership_emergency_fee || 0,
      gifship_consultation_fee: c.gifship_consultation_fee || 0,
      gifship_follow_up_fee: c.gifship_follow_up_fee || 0,
      gifship_emergency_fee: c.gifship_emergency_fee || 0,
    });
  };

  const handleSaveClinicData = async () => {
    if (!editingClinic || !editedClinicData) return;

    try {
      await updateClinic.mutateAsync({
        clinic_id: editingClinic.clinic_id,
        clinic_name: editedClinicData.clinic_name,
        clinic_code: editedClinicData.clinic_code,
        description: editedClinicData.description || null,
        location: editedClinicData.location || null,
        operating_hours: editedClinicData.operating_hours || null,
        is_active: editedClinicData.is_active,
        consultation_fee: editedClinicData.consultation_fee,
        follow_up_fee: editedClinicData.follow_up_fee,
        emergency_fee: editedClinicData.emergency_fee,
        military_nhis_consultation_fee:
          editedClinicData.military_nhis_consultation_fee,
        military_nhis_follow_up_fee:
          editedClinicData.military_nhis_follow_up_fee,
        military_nhis_emergency_fee:
          editedClinicData.military_nhis_emergency_fee,
        nhis_consultation_fee: editedClinicData.nhis_consultation_fee,
        nhis_follow_up_fee: editedClinicData.nhis_follow_up_fee,
        nhis_emergency_fee: editedClinicData.nhis_emergency_fee,
        retainership_consultation_fee:
          editedClinicData.retainership_consultation_fee,
        retainership_follow_up_fee: editedClinicData.retainership_follow_up_fee,
        retainership_emergency_fee: editedClinicData.retainership_emergency_fee,
        gifship_consultation_fee: editedClinicData.gifship_consultation_fee,
        gifship_follow_up_fee: editedClinicData.gifship_follow_up_fee,
        gifship_emergency_fee: editedClinicData.gifship_emergency_fee,
      } as any);
      showToast({
        type: 'success',
        message: `Clinic "${editedClinicData.clinic_name}" updated successfully`,
      });
      setEditingClinic(null);
      setEditedClinicData(null);
    } catch (error: any) {
      showToast({
        type: 'error',
        message: error?.message || 'Failed to update clinic',
      });
    }
  };

  const handleCancelEditClinic = () => {
    setEditingClinic(null);
    setEditedClinicData(null);
  };

  const statsCards = [
    {
      label: "Today's Visits",
      value: stats?.todayTotal || 0,
      icon: Calendar,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      label: 'Waiting',
      value: stats?.waiting || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      lightColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
    },
    {
      label: 'In Progress',
      value: stats?.inProgress || 0,
      icon: TrendingUp,
      color: 'bg-purple-500',
      lightColor: 'bg-purple-50',
      textColor: 'text-purple-700',
    },
    {
      label: 'Completed',
      value: stats?.completed || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      lightColor: 'bg-green-50',
      textColor: 'text-green-700',
    },
    {
      label: 'Cancelled',
      value: stats?.cancelled || 0,
      icon: XCircle,
      color: 'bg-red-500',
      lightColor: 'bg-red-50',
      textColor: 'text-red-700',
    },
    {
      label: 'Total visits',
      value: stats?.total || 0,
      icon: Users,
      color: 'bg-gray-500',
      lightColor: 'bg-gray-50',
      textColor: 'text-gray-700',
    },
  ];

  const tabs = [
    {
      id: 'encounters' as TabType,
      label: 'All visits',
      icon: Stethoscope,
      count: stats?.total,
    },
    {
      id: 'patients' as TabType,
      label: 'By Patient',
      icon: Users,
      count: undefined,
    },
    {
      id: 'today' as TabType,
      label: "Today's Visits",
      icon: Calendar,
      count: stats?.todayTotal,
    },
    {
      id: 'clinics' as TabType,
      label: 'Clinics',
      icon: Building2,
    },
    {
      id: 'referrals' as TabType,
      label: 'Booking',
      icon: Calendar,
    },
    {
      id: 'external-referrals' as TabType,
      label: 'External Referrals',
      icon: Shield,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      icon: Settings2,
    },
  ].filter(
    (tab) => isNhisFeatureEnabled() || tab.id !== 'external-referrals',
  );

  return (
    <div
      className={`min-h-screen p-6 ${isNightMode ? 'bg-slate-900' : 'bg-gray-50'}`}
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className={`text-lg font-semibold ${isNightMode ? 'text-white' : 'text-gray-900'}`}>
              Visits
            </h1>
            <p className={`text-xs ${isNightMode ? 'text-gray-400' : 'text-gray-400'}`}>
              Patient visits and consultations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
              isAIPanelOpen
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : isNightMode
                  ? 'border-slate-600 bg-slate-800 text-gray-300 hover:bg-slate-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            AI
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-primary-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Encounter
          </button>
        </div>
      </div>

      {/* Stats Cards — hidden on Booking / External Referrals / Settings tabs */}
      {activeTab !== 'referrals' && activeTab !== 'external-referrals' && activeTab !== 'settings' && (
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statsCards.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border p-3.5 transition-all hover:shadow-sm ${
              isNightMode
                ? 'border-slate-700 bg-slate-800/80'
                : 'border-gray-100 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.lightColor}`}
              >
                <stat.icon className={`h-4 w-4 ${stat.textColor}`} />
              </div>
              <div>
                <div className={`text-xl font-bold ${stat.textColor}`}>
                  {statsLoading ? '--' : stat.value}
                </div>
                <div
                  className={`text-[11px] font-medium ${isNightMode ? 'text-gray-400' : 'text-gray-400'}`}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Tabs */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100/80 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    activeTab === tab.id
                      ? 'bg-primary-700/10 text-primary-700'
                      : 'bg-gray-200/80 text-gray-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'encounters' && (
        <div className="space-y-3">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700/20"
              />
              {debouncedSearchQuery && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
                  {encountersLoading
                    ? 'Searching...'
                    : `${encounters.length} found`}
                </span>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                showFilters
                  ? 'border-primary-700 bg-primary-700/5 text-primary-700'
                  : isNightMode
                    ? 'border-slate-600 text-gray-300 hover:bg-slate-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Quick
            </button>

            {/* Advanced Filter Toggle */}
            <button
              onClick={() => setShowComprehensiveFilters(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${isNightMode ? 'border-slate-600 text-gray-300 hover:bg-slate-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter className="h-3.5 w-3.5" />
              Advanced
            </button>

            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${isNightMode ? 'border-slate-600 text-gray-300 hover:bg-slate-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>

            {/* Refresh */}
            <button
              onClick={() => refetchEncounters()}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${isNightMode ? 'border-slate-600 text-gray-300 hover:bg-slate-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {/* Active search indicator */}
          {debouncedSearchQuery && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">EMR:</span>
              <span className="font-medium text-primary-700 bg-primary-700/5 px-1.5 py-0.5 rounded">
                {debouncedSearchQuery}
              </span>
              {/^\d+$/.test(debouncedSearchQuery) && (
                <span className="text-[11px] text-gray-400">
                  → {DEPLOYMENT.emrPrefix}-{debouncedSearchQuery.padStart(DEPLOYMENT.emrPadding, '0')}
                </span>
              )}
              <button
                onClick={() => setSearchQuery('')}
                className="text-[11px] text-gray-400 hover:text-red-500"
              >
                Clear
              </button>
            </div>
          )}

          {/* Filter Panel */}
          {showFilters && (
            <div
              className={`rounded-xl border p-3 ${isNightMode ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-white'}`}
            >
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {/* Status Filter */}
                <div>
                  <label
                    className={`mb-1 block text-[11px] font-medium uppercase tracking-wide ${isNightMode ? 'text-gray-400' : 'text-gray-400'}`}
                  >
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        status: e.target.value as EncounterStatus | 'all',
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700/20"
                  >
                    <option value="all">All Statuses</option>
                    {EncounterStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Visit Type Filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Visit Type
                  </label>
                  <select
                    value={filters.visit_type}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        visit_type: e.target.value as VisitType | 'all',
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700/20"
                  >
                    <option value="all">All Types</option>
                    {VisitTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Priority
                  </label>
                  <select
                    value={filters.priority}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        priority: e.target.value as PriorityLevel | 'all',
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700/20"
                  >
                    <option value="all">All Priorities</option>
                    {PriorityLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Filter */}
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={filters.date_from || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, date_from: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700/20"
                  />
                </div>
              </div>

              {/* Clear Filters */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() =>
                    setFilters({
                      status: 'all',
                      visit_type: 'all',
                      priority: 'all',
                    })
                  }
                  className="text-xs font-medium text-primary-700 hover:underline"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}

          {/* Encounters Table */}
          <EncounterTable
            encounters={encounters}
            isLoading={encountersLoading}
            onRowClick={handleRowClick}
          />
        </div>
      )}

      {activeTab === 'today' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <h2 className={`text-sm font-medium ${isNightMode ? 'text-white' : 'text-gray-700'}`}>
              Today's Encounters
            </h2>
            <span className="rounded-full bg-primary-700/5 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
              {todaysEncounters.length}
            </span>
          </div>

          <EncounterTable
            encounters={todaysEncounters}
            isLoading={todayLoading}
            onRowClick={handleRowClick}
          />
        </div>
      )}

      {/* Patients Tab - Consolidated Patient View */}
      {activeTab === 'patients' && (
        <div className="space-y-3">
          {/* Header with Filter Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className={`text-sm font-medium ${isNightMode ? 'text-white' : 'text-gray-700'}`}>
                By Patient
              </h2>
              <span className="text-[11px] text-gray-400">
                Grouped view
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowComprehensiveFilters(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>
          </div>

          {/* Patient Encounter Summary */}
          <PatientEncounterSummary
            encounters={encounters}
            isLoading={encountersLoading}
            onEncounterClick={handleRowClick}
            onPatientClick={(patientId) => {
              navigate(`/patients/${patientId}`);
            }}
          />
        </div>
      )}

      {activeTab === 'clinics' && (
        <ClinicList
          onAddClinic={() => {
            // TODO: Open clinic form modal
            console.log('Add clinic');
          }}
          onEditClinic={handleEditClinic}
        />
      )}

      {activeTab === 'referrals' && (
        <InternalReferralQueue />
      )}

      {isNhisFeatureEnabled() && activeTab === 'external-referrals' && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={`rounded-xl border p-3 ${isNightMode ? 'border-slate-700 bg-slate-800/80' : 'border-gray-100 bg-white'}`}
            >
              <p className="text-[11px] text-gray-400">Pending</p>
              <p className="mt-0.5 text-xl font-bold text-yellow-600">
                {externalReferralStats.pending}
              </p>
            </div>
            <div
              className={`rounded-xl border p-3 ${isNightMode ? 'border-slate-700 bg-slate-800/80' : 'border-gray-100 bg-white'}`}
            >
              <p className="text-[11px] text-gray-400">Expired</p>
              <p className="mt-0.5 text-xl font-bold text-red-600">
                {externalReferralStats.expired}
              </p>
            </div>
            <div
              className={`rounded-xl border p-3 ${isNightMode ? 'border-slate-700 bg-slate-800/80' : 'border-gray-100 bg-white'}`}
            >
              <p className="text-[11px] text-gray-400">Approved Today</p>
              <p className="mt-0.5 text-xl font-bold text-green-600">
                {externalReferralStats.approvedToday}
              </p>
            </div>
            <div
              className={`rounded-xl border p-3 ${isNightMode ? 'border-slate-700 bg-slate-800/80' : 'border-gray-100 bg-white'}`}
            >
              <p className="text-[11px] text-gray-400">Rejected</p>
              <p className="mt-0.5 text-xl font-bold text-rose-600">
                {externalReferralStats.rejected}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 w-fit">
            <button
              onClick={() => setExternalReferralTab('outgoing')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                externalReferralTab === 'outgoing'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Outgoing
            </button>
            <button
              onClick={() => setExternalReferralTab('incoming')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                externalReferralTab === 'incoming'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Incoming
            </button>
          </div>

          {externalReferralTab === 'incoming' &&
            (canViewExternalReferrals ? (
              <div className="-mt-1">
                <NhisReferralQueue
                  queueItems={referralQueueData?.data}
                  isLoading={referralQueueLoading}
                  onRefresh={() => refetchReferralQueue()}
                  onProcessItem={(itemId, action, data) =>
                    processReferralQueue.mutateAsync({
                      queue_id: itemId,
                      action,
                      processed_by: staff?.id || '',
                      processing_notes: data?.notes,
                      rejection_reason: data?.rejection_reason,
                      auth_code: data?.auth_code,
                      tariff_group: data?.p_tariff_group ?? data?.tariff_group,
                    })
                  }
                  showHeader={false}
                  showStats={false}
                  requestTypeFilter="external_referral"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                You do not have permission to view the external NHIS referral
                queue.
              </div>
            ))}

          {externalReferralTab === 'outgoing' && (
            <ExternalReferralsTab showOnlyReadyToPrint={false} />
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl">
          <EncounterSettingsPanel />
        </div>
      )}

      {/* Encounter Form Modal */}
      <EncounterForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        preSelectedPatient={preSelectedPatient || undefined}
      />

      {/* Encounter Detail Modal */}
      {selectedEncounter && (
        <EncounterDetail
          encounter={selectedEncounter}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedEncounter(null);
          }}
          onEdit={() => {
            // TODO: Open edit form
            console.log('Edit encounter', selectedEncounter);
          }}
        />
      )}

      {/* Comprehensive Filter Panel */}
      <ComprehensiveEncounterFilterPanel
        isOpen={showComprehensiveFilters}
        onClose={() => setShowComprehensiveFilters(false)}
        filters={comprehensiveFilters}
        onFiltersChange={setComprehensiveFilters}
        onApplyFilters={handleApplyComprehensiveFilters}
        onClearFilters={handleClearComprehensiveFilters}
        onExport={() => setShowExportModal(true)}
        onGenerateReport={() => setShowReportModal(true)}
        doctorList={doctorList}
        clinicList={clinicList}
        diagnosisList={diagnosisList}
        chiefComplaintList={chiefComplaintList}
        courseList={courseList}
      />

      {/* Encounter Report Modal */}
      <EncounterReportTemplate
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        encounters={encounters}
        filters={advancedFilters}
        title="Visit summary"
      />

      {/* Export Modal - Multi-format export (CSV, Excel, PDF) */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        encounters={encounters}
        filters={comprehensiveFilters}
        isNightMode={isNightMode}
      />

      {/* Edit Clinic Modal (Super Admin Only) - Central Clinic Management */}
      {editingClinic && editedClinicData && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 transition-opacity"
              onClick={handleCancelEditClinic}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 rounded-t-xl flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Manage Clinic
                      </h3>
                      <p className="text-sm text-white/80">
                        Central Clinic Configuration
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelEditClinic}
                    className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Body - Scrollable */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Super Admin Badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    Super Admin: Full Clinic Management
                  </span>
                </div>

                {/* Clinic Details Section */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    Clinic Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Clinic Name *
                      </label>
                      <input
                        type="text"
                        value={editedClinicData.clinic_name}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            clinic_name: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="e.g., General Outpatient"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Clinic Code *
                      </label>
                      <input
                        type="text"
                        value={editedClinicData.clinic_code}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            clinic_code: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors font-mono"
                        placeholder="e.g., CLN-001"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={editedClinicData.description}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            description: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="Brief description of the clinic"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={editedClinicData.location}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            location: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="e.g., Building A, Floor 2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Operating Hours
                      </label>
                      <input
                        type="text"
                        value={editedClinicData.operating_hours}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            operating_hours: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="e.g., Mon-Fri 8AM-5PM"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg border border-gray-200 hover:border-primary-700 transition-colors">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={editedClinicData.is_active}
                            onChange={(e) =>
                              setEditedClinicData({
                                ...editedClinicData,
                                is_active: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-700/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-700" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            Clinic Active
                          </span>
                          <p className="text-xs text-gray-500">
                            Inactive clinics won't appear in clinic selection
                            lists
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Private/Cash Prices */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-500" />
                    Private / Cash Prices (₦)
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Consultation
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.consultation_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            consultation_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Follow-Up
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.follow_up_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            follow_up_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Emergency
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.emergency_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            emergency_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {isNhisFeatureEnabled() && (
                  <>
                {/* Military NHIS Pricing */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    Military NHIS Prices (₦)
                  </h4>
                  <p className="text-xs text-green-600 mb-3">
                    For patients with InsuranceType: Military_NHIS
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Consultation
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.military_nhis_consultation_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            military_nhis_consultation_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Follow-Up
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.military_nhis_follow_up_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            military_nhis_follow_up_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Emergency
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.military_nhis_emergency_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            military_nhis_emergency_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Security Services NHIS Pricing */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-600" />
                    Security Services NHIS Prices (₦)
                  </h4>
                  <p className="text-xs text-indigo-600 mb-3">
                    For patients with InsuranceType: Security_Services_NHIS
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Consultation
                      </label>
                      <input
                        type="number"
                        value={
                          editedClinicData.security_services_nhis_consultation_fee
                        }
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            security_services_nhis_consultation_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Follow-Up
                      </label>
                      <input
                        type="number"
                        value={
                          editedClinicData.security_services_nhis_follow_up_fee
                        }
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            security_services_nhis_follow_up_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Emergency
                      </label>
                      <input
                        type="number"
                        value={
                          editedClinicData.security_services_nhis_emergency_fee
                        }
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            security_services_nhis_emergency_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Civilian NHIS Pricing */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-teal-700 mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-teal-600" />
                    Civilian NHIS Prices (₦)
                  </h4>
                  <p className="text-xs text-teal-600 mb-3">
                    For patients with InsuranceType: Civilian_NHIS
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Consultation
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.nhis_consultation_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            nhis_consultation_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Follow-Up
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.nhis_follow_up_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            nhis_follow_up_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Emergency
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.nhis_emergency_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            nhis_emergency_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* Retainership Pricing */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    Retainership / Corporate Prices (₦)
                  </h4>
                  <p className="text-xs text-blue-600 mb-3">
                    For patients with InsuranceType: Retainership
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Consultation
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.retainership_consultation_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            retainership_consultation_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Follow-Up
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.retainership_follow_up_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            retainership_follow_up_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Emergency
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.retainership_emergency_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            retainership_emergency_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* GIFSHIP Pricing */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-600" />
                    GIFSHIP Prices (₦)
                  </h4>
                  <p className="text-xs text-purple-600 mb-3">
                    For patients with InsuranceType: GIFSHIP (Government
                    Insurance Fund)
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Consultation
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.gifship_consultation_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            gifship_consultation_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Follow-Up
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.gifship_follow_up_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            gifship_follow_up_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Emergency
                      </label>
                      <input
                        type="number"
                        value={editedClinicData.gifship_emergency_fee}
                        onChange={(e) =>
                          setEditedClinicData({
                            ...editedClinicData,
                            gifship_emergency_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Info Note */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">
                    <strong>Note:</strong> Changes will apply to all future
                    encounters at this clinic. Existing billing orders will not
                    be affected.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                <button
                  onClick={handleCancelEditClinic}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveClinicData}
                  disabled={
                    updateClinic.isPending ||
                    !editedClinicData.clinic_name ||
                    !editedClinicData.clinic_code
                  }
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-700 rounded-lg hover:bg-[#005830] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updateClinic.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save Clinic
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Clinical Assistant Slide-over Panel */}
      {isAIPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsAIPanelOpen(false)}
          />
          <div className="relative w-full max-w-4xl h-[82vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-primary-700 to-primary-600 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-1.5 shadow">
                  
                </div>
                <span className="text-sm font-semibold">
                  XenoCare AI Assistants
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={aiSelectedPatientId}
                  onChange={(e) => setAiSelectedPatientId(e.target.value)}
                  className="text-xs text-gray-800 rounded-md border border-white/40 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                  <option value="">
                    {encounterAiPatients.length === 0
                      ? 'All encounter records (no queue patients)'
                      : 'All encounter records (optional patient filter)'}
                  </option>
                  {encounterAiPatients.map((patient) => (
                    <option key={patient.patientId} value={patient.patientId}>
                      {patient.patientName} • {patient.emrNumber}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setIsAIPanelOpen(false)}
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
                encounterId={selectedAiPatient?.encounterId}
                patientName={selectedAiPatient?.patientName}
                emrNumber={selectedAiPatient?.emrNumber}
                facilityId={staff?.facility_id ?? ''}
                userId={staff?.id ?? ''}
                chiefComplaint={selectedAiPatient?.chiefComplaint}
                visitDate={selectedAiPatient?.visitDate}
                department={selectedAiPatient?.department || 'Encounter'}
                consultationData={selectedAiPatient?.encounterContext || null}
                assistantScope="clinical"
                variant="minimal"
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncounterModule;
