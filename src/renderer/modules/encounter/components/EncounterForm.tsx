/**
 * =============================================================================
 * XENOCARE EMR - ENCOUNTER FORM COMPONENT
 * Description: Form for creating/editing encounters with NDC branding
 * =============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  Search,
  User,
  Calendar,
  Stethoscope,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Shield,
  Building2,
  CheckCircle,
  Clock,
  Check,
  MapPin,
  UserCheck,
  Smile,
  Eye,
  Dumbbell,
  Send,
  Info,
} from 'lucide-react';
import {
  VisitTypes,
  PriorityLevels,
  VisitType,
  PriorityLevel,
  Clinic,
} from '../dtos/encounter.dto';
import { useClinics } from '../hooks/useEncounter';
import { useDoctors } from '../../staff/hooks/useStaff';
import { useCreateEncounter, PaymentCategory } from '../../../lib/workflow';
import type { CreateEncounterDTO } from '../../../lib/workflow';
import { usePatientSearch } from '../../patient-registration/hooks/usePatient';
import { useDebounce } from '../../../hooks/useDebounce';
import type { PatientDTO } from '../../patient-registration/dtos/patient.dto';
import { useToast } from '../../../components/ui/Toast';
import { createClinicalRequest } from '../../clinical-requests/api/clinical-requests.api';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../api/supabaseClient';
import {
  useCreateReferralQueueItem,
  useNhisProfileByPatient,
  useReferralQueue,
} from '../../nhis/hooks';
import { createScopedLogger } from '../../../utils/logger';
import {
  isEmergencyFeatureEnabled,
  isNhisFeatureEnabled,
} from '../../../config/features';
import { DEPLOYMENT } from '../../../config/deployment';

const log = createScopedLogger('EncounterForm');

// Patient search result type - mapped from PatientDTO
interface PatientSearchResult {
  id: string; // UUID - used for foreign key references
  patient_id: string; // VARCHAR - display ID
  first_name: string;
  last_name: string;
  emr_number?: string;
  date_of_birth?: string;
  phone?: string;
  service_number?: string;
  patient_category?: string;
  insurance_type?: string; // 'Private', 'DHML', 'Civilian_NHIS'
  nhis_patient_source?: 'Internal' | 'Referral'; // Internal = registered here, Referral = referred from another facility
}

// Helper: Convert patient insurance_type to payment_category for billing
// insurance_type: 'Private', 'DHML', 'Civilian_NHIS'
// payment_category: 'Cash', 'NHIS', etc.
function getPaymentCategoryFromInsurance(
  insuranceType: string | undefined,
): PaymentCategory {
  if (!insuranceType) return 'Cash';
  const type = insuranceType.toLowerCase().replace(/_/g, ' ');
  // DHML is Military NHIS HMO, not a separate category
  if (type === 'dhml' || type.includes('nhis') || type === 'gifship') {
    return isNhisFeatureEnabled() ? 'NHIS' : 'Cash';
  }
  if (type.includes('retainer') || type.includes('corporate')) {
    return 'Retainership';
  }
  return 'Cash'; // Private patients
}

// Helper: Detect specialty module based on clinic name
// Returns the specialty key used for queue routing, consultation templates, and referrals
type SpecialtyModule =
  | 'dental'
  | 'ophthalmology'
  | 'physiotherapy'
  | 'cardiology'
  | 'dermatology'
  | 'orthopaedics'
  | 'ent'
  | 'urology'
  | 'neurology'
  | 'neuropsychiatry'
  | 'gastroenterology'
  | 'nephrology'
  | 'paediatrics'
  | 'neurosurgery'
  | 'general_surgery'
  | 'gynaecology'
  | 'oral_maxillofacial'
  | 'pulmonology'
  | 'endocrinology'
  | 'nutrition'
  | 'plastic_surgery'
  | 'psychiatry'
  | 'oncology'
  | 'rheumatology'
  | 'infectious_disease'
  | 'haematology'
  | 'cardiothoracic_surgery'
  | 'vascular_surgery'
  | 'paediatric_surgery'
  | 'neonatology'
  | null;

function detectSpecialtyFromClinic(
  clinicName: string | undefined,
): SpecialtyModule {
  if (!clinicName) return null;
  const name = clinicName.toLowerCase();

  // Dental
  if (name.includes('dental')) return 'dental';
  // Ophthalmology / Eye
  if (name.includes('eye') || name.includes('ophthal')) return 'ophthalmology';
  // Physiotherapy / Rehabilitation
  if (name.includes('physio') || name.includes('rehab')) return 'physiotherapy';
  // Cardiology
  if (name.includes('cardiology') || name === 'cardiology clinic')
    return 'cardiology';
  // Cardiothoracic Surgery
  if (name.includes('cardiothoracic')) return 'cardiothoracic_surgery';
  // Dermatology / Skin
  if (name.includes('dermat') || name.includes('skin')) return 'dermatology';
  // Orthopaedics
  if (name.includes('ortho')) return 'orthopaedics';
  // ENT (Ear, Nose, Throat)
  if (name.includes('ent') && (name.includes('clinic') || name.length <= 10))
    return 'ent';
  if (name.includes('ear') && name.includes('nose')) return 'ent';
  // Urology
  if (name.includes('urolog')) return 'urology';
  // Neurosurgery (check before neurology)
  if (name.includes('neurosurg')) return 'neurosurgery';
  // Neuropsychiatry (check before neurology and psychiatry)
  if (name.includes('neuropsych')) return 'neuropsychiatry';
  // Neurology
  if (name.includes('neurol')) return 'neurology';
  // Gastroenterology
  if (name.includes('gastro')) return 'gastroenterology';
  // Nephrology
  if (name.includes('nephrol')) return 'nephrology';
  // Paediatric Surgery (check before paediatrics)
  if (name.includes('paediatric surg') || name.includes('pediatric surg'))
    return 'paediatric_surgery';
  // Paediatrics
  if (name.includes('paediatr') || name.includes('pediatr'))
    return 'paediatrics';
  // General Surgery
  if (name.includes('general surg')) return 'general_surgery';
  // Gynaecology / Obstetrics & Gynaecology
  if (
    name.includes('gynae') ||
    name.includes('gynec') ||
    name.includes('o&g') ||
    name.includes('obstetric')
  )
    return 'gynaecology';
  // Oral & Maxillofacial
  if (name.includes('maxillofacial') || name.includes('oral &'))
    return 'oral_maxillofacial';
  // Pulmonology
  if (name.includes('pulmon') || name.includes('chest clinic'))
    return 'pulmonology';
  // Endocrinology
  if (name.includes('endocrin')) return 'endocrinology';
  // Nutrition / Dietetics
  if (name.includes('nutrition') || name.includes('diet')) return 'nutrition';
  // Plastic Surgery
  if (name.includes('plastic')) return 'plastic_surgery';
  // Psychiatry
  if (name.includes('psychiat')) return 'psychiatry';
  // Oncology
  if (name.includes('oncolog')) return 'oncology';
  // Rheumatology
  if (name.includes('rheumat')) return 'rheumatology';
  // Infectious Disease
  if (
    name.includes('infectious') ||
    name.includes('retroviral') ||
    name.includes('art clinic') ||
    name.includes('hiv')
  )
    return 'infectious_disease';
  // Haematology
  if (name.includes('haemat') || name.includes('hemat')) return 'haematology';
  // Vascular Surgery
  if (name.includes('vascular')) return 'vascular_surgery';
  // Neonatology
  if (name.includes('neonat') || name.includes('scbu')) return 'neonatology';

  return null;
}

// Helper: Check if clinic is GOPD (General Out-Patient Department)
function isGopdClinic(clinicName: string | undefined): boolean {
  if (!clinicName) return false;
  const name = clinicName.toLowerCase();
  return (
    name.includes('gopd') ||
    name.includes('general out') ||
    name.includes('general practice') ||
    name.includes('opd') ||
    name.includes('family medicine')
  );
}

// Helper: Check if clinic is A&E (Accident & Emergency)
function isAeClinic(
  clinic:
    | { clinic_name?: string; clinic_code?: string; clinic_id?: string }
    | null
    | undefined,
): boolean {
  if (!clinic) return false;
  const name = (clinic.clinic_name || '').toLowerCase();
  const code = (clinic.clinic_code || '').toUpperCase();
  const clinicId = (clinic.clinic_id || '').toUpperCase();
  return (
    clinicId === 'CLN-040' ||
    code === 'A&E' ||
    name.includes('accident') ||
    name.includes('a&e') ||
    name.includes('emergency')
  );
}

// Helper: Check if patient is NHIS based on insurance type
function isNhisPatient(insuranceType: string | undefined): boolean {
  if (!isNhisFeatureEnabled()) return false;
  if (!insuranceType) return false;
  return [
    'Military_NHIS',
    'Civilian_NHIS',
    'GIFSHIP',
    'Security_Services_NHIS',
    'DHML',
  ].includes(insuranceType);
}

// Helper: Check if internal NHIS patient requires approval for any clinic
// Internal NHIS patients need NHIS approval for ALL clinics including GOPD
function requiresNhisApprovalForClinic(
  patientSource: 'Internal' | 'Referral' | undefined,
  insuranceType: string | undefined,
  clinicName: string | undefined,
): boolean {
  // External/Referral patients always go through NHIS queue (handled separately)
  if (patientSource === 'Referral') return false;

  // Only NHIS patients require approval
  if (!isNhisPatient(insuranceType)) return false;

  // All clinics (including GOPD) require NHIS verification for internal NHIS patients
  return true;
}

// Helper: Check if external/referral NHIS patient requires approval for ANY clinic
// External referral patients ALWAYS need NHIS approval for EVERY new encounter, regardless of clinic
// This ensures proper verification and authorization for each clinic visit
function requiresExternalNhisApproval(
  patientSource: 'Internal' | 'Referral' | undefined,
  insuranceType: string | undefined,
  nhisProfileActive: boolean,
): boolean {
  // Only applies to external referral patients
  if (patientSource !== 'Referral') return false;

  // Only NHIS patients require approval
  if (!isNhisPatient(insuranceType)) return false;

  // Even verified external patients need approval for each new encounter
  // They have an active NHIS profile but still need encounter-level authorization
  return true;
}

// Helper: Validate External NHIS Referral eligibility
// RULE: Only patients registered as "Referral" (nhis_patient_source = 'Referral') can have External NHIS Referral encounters
// Internal patients (registered directly at this facility) cannot have External NHIS Referral visit type
// Patients with undefined source must update their profile to set the source to 'Referral' first
function isEligibleForExternalNhisReferral(
  nhisPatientSource: 'Internal' | 'Referral' | undefined,
): boolean {
  if (!isNhisFeatureEnabled()) return false;
  // External NHIS Referral is ONLY for patients registered as "Referral"
  // (patients referred from another facility with valid referral documentation)
  // Internal patients are registered directly at this facility and should use standard workflows
  // Undefined source = patient needs to update their registration to set NHIS Patient Source
  return nhisPatientSource === 'Referral';
}

// Get human-readable NHIS patient source label
function getNhisPatientSourceLabel(
  source: 'Internal' | 'Referral' | undefined,
): string {
  switch (source) {
    case 'Internal':
      return 'Internal Patient (Registered at this facility)';
    case 'Referral':
      return 'Referral Patient (Referred from external facility)';
    default:
      return 'Unknown';
  }
}

// Get human-readable insurance type description
function getInsuranceTypeLabel(insuranceType: string | undefined): string {
  if (
    !isNhisFeatureEnabled() &&
    insuranceType &&
    ['dhml', 'gifship', 'civilian nhis', 'military nhis', 'security services nhis'].includes(
      insuranceType.toLowerCase().replace(/_/g, ' '),
    )
  ) {
    return 'Private';
  }
  switch (insuranceType) {
    case 'DHML':
      return 'Military NHIS (DHML)';
    case 'Military_NHIS':
      return 'Military NHIS';
    case 'Civilian_NHIS':
      return 'Civilian NHIS';
    case 'GIFSHIP':
      return 'GIFSHIP';
    case 'Security_Services_NHIS':
      return 'Security Services NHIS';
    case 'Retainership':
      return 'Retainership';
    case 'Private':
      return 'Private Insurance';
    default:
      return insuranceType || 'No Insurance';
  }
}

// Helper: Get specialty department ID
// Maps specialty modules to their department IDs for queue routing
function getSpecialtyDepartmentId(specialty: SpecialtyModule): string | null {
  switch (specialty) {
    case 'dental':
      return 'DEPT013';
    case 'ophthalmology':
      return 'DEPT014';
    case 'physiotherapy':
      return 'DEPT015';
    case 'cardiology':
      return 'DEPT016';
    case 'dermatology':
      return 'DEPT017';
    case 'orthopaedics':
      return 'DEPT018';
    case 'ent':
      return 'DEPT019';
    case 'urology':
      return 'DEPT020';
    case 'neurology':
      return 'DEPT021';
    case 'neuropsychiatry':
      return 'DEPT022';
    case 'gastroenterology':
      return 'DEPT023';
    case 'nephrology':
      return 'DEPT024';
    case 'paediatrics':
      return 'DEPT025';
    case 'neurosurgery':
      return 'DEPT026';
    case 'general_surgery':
      return 'DEPT027';
    case 'gynaecology':
      return 'DEPT028';
    case 'oral_maxillofacial':
      return 'DEPT029';
    case 'pulmonology':
      return 'DEPT030';
    case 'endocrinology':
      return 'DEPT031';
    case 'plastic_surgery':
      return 'DEPT032';
    case 'psychiatry':
      return 'DEPT033';
    case 'oncology':
      return 'DEPT034';
    case 'rheumatology':
      return 'DEPT035';
    case 'infectious_disease':
      return 'DEPT036';
    case 'haematology':
      return 'DEPT037';
    case 'cardiothoracic_surgery':
      return 'DEPT038';
    case 'vascular_surgery':
      return 'DEPT039';
    case 'paediatric_surgery':
      return 'DEPT040';
    case 'neonatology':
      return 'DEPT041';
    case 'nutrition':
      return 'DEPT042';
    default:
      return null;
  }
}

function getSpecialtyDepartmentNameHints(specialty: SpecialtyModule): string[] {
  switch (specialty) {
    case 'dental':
      return ['Dental'];
    case 'ophthalmology':
      return ['Ophthalmology', 'Eye'];
    case 'physiotherapy':
      return ['Physiotherapy', 'Physio', 'Rehab'];
    case 'cardiology':
      return ['Cardiology'];
    case 'dermatology':
      return ['Dermatology'];
    case 'orthopaedics':
      return ['Orthopaedics', 'Orthopedic'];
    case 'ent':
      return ['ENT', 'Ear'];
    case 'urology':
      return ['Urology'];
    case 'neurology':
      return ['Neurology'];
    case 'neuropsychiatry':
      return ['Neuropsychiatry'];
    case 'gastroenterology':
      return ['Gastroenterology'];
    case 'nephrology':
      return ['Nephrology'];
    case 'paediatrics':
      return ['Paediatrics', 'Pediatrics'];
    case 'neurosurgery':
      return ['Neurosurgery'];
    case 'general_surgery':
      return ['General Surgery'];
    case 'gynaecology':
      return ['Gynaecology', 'Gynecology'];
    case 'oral_maxillofacial':
      return ['Oral', 'Maxillofacial'];
    case 'pulmonology':
      return ['Pulmonology', 'Chest'];
    case 'endocrinology':
      return ['Endocrinology'];
    case 'plastic_surgery':
      return ['Plastic Surgery'];
    case 'nutrition':
      return ['Nutrition', 'Diet'];
    case 'psychiatry':
      return ['Psychiatry'];
    case 'oncology':
      return ['Oncology'];
    case 'rheumatology':
      return ['Rheumatology'];
    case 'infectious_disease':
      return ['Infectious'];
    case 'haematology':
      return ['Haematology', 'Hematology'];
    case 'cardiothoracic_surgery':
      return ['Cardiothoracic'];
    case 'vascular_surgery':
      return ['Vascular'];
    case 'paediatric_surgery':
      return ['Paediatric Surgery', 'Pediatric Surgery'];
    case 'neonatology':
      return ['Neonatology'];
    default:
      return [];
  }
}

async function resolveSpecialtyDepartmentUuid(
  specialty: SpecialtyModule,
): Promise<string | null> {
  if (!specialty) return null;

  const legacyCode = getSpecialtyDepartmentId(specialty);
  if (legacyCode) {
    const { data: byCode } = await supabase
      .from('departments')
      .select('id')
      .eq('code', legacyCode)
      .maybeSingle();
    if (byCode?.id) return byCode.id;
  }

  const hints = getSpecialtyDepartmentNameHints(specialty);
  for (const hint of hints) {
    const { data: byName } = await supabase
      .from('departments')
      .select('id')
      .ilike('name', `%${hint}%`)
      .limit(1);

    if (Array.isArray(byName) && byName.length > 0 && byName[0]?.id) {
      return byName[0].id;
    }
  }

  return null;
}

interface EncounterFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preSelectedPatient?: PatientSearchResult;
  // Referral context - pre-populate form when creating encounter from a referral
  referralContext?: {
    referralId: string; // clinical_request.id
    referringDoctorId: string; // Doctor who made the referral
    referringDoctorName: string; // For display
    referralReason: string; // Reason for referral
    specialtyModule: string; // e.g. dental, ophthalmology, cardiology, ent, etc.
    sourceClinicName?: string; // Where patient was referred from / returning to
    isFollowUp?: boolean; // True when this is a follow-up booking (not external referral)
    followUpNotes?: string; // Doctor-entered follow-up instructions to pre-fill on encounter
  };
}

// Doctor option type from staff API
interface DoctorOption {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  department: string | null;
}

// Extended form data type to include additional form fields
interface EncounterFormData {
  patient_id: string;
  clinic_id: string;
  attending_doctor_id: string;
  visit_type: VisitType;
  priority: PriorityLevel;
}

const EncounterForm: React.FC<EncounterFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedPatient,
  referralContext,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPatient, setSelectedPatient] =
    useState<PatientSearchResult | null>(preSelectedPatient || null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // Clinic search state
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');
  const [isClinicDropdownOpen, setIsClinicDropdownOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);

  // Doctor search state
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(
    null,
  );

  // Specialty referral state
  const [specialtyReferralReason, setSpecialtyReferralReason] = useState('');

  // Auth context for staff ID
  const { staff } = useAuth();

  // Toast
  const { showToast } = useToast();

  const [formData, setFormData] = useState<EncounterFormData>({
    patient_id: '',
    clinic_id: '',
    attending_doctor_id: '',
    visit_type: 'New Visit',
    priority: 'Normal',
  });

  const createEncounter = useCreateEncounter();
  const createReferralQueueItem = useCreateReferralQueueItem();
  const { data: nhisProfile, isLoading: nhisProfileLoading } =
    useNhisProfileByPatient(selectedPatient?.id || '', !!selectedPatient);
  const { data: referralQueueData } = useReferralQueue({
    search: selectedPatient?.patient_id || undefined,
    limit: 50,
    page: 1,
  });

  const { data: clinics = [], isLoading: clinicsLoading } = useClinics();

  // Fetch doctors - filter by selected clinic's name (which matches staff department)
  const { data: allDoctors = [], isLoading: doctorsLoading } = useDoctors();

  // Filter doctors by selected clinic (department)
  const filteredDoctors = useMemo(() => {
    if (!selectedClinic) return allDoctors;
    const filtered = allDoctors.filter(
      (doc: DoctorOption) => doc.department === selectedClinic.clinic_name,
    );

    // Fallback: If no doctors are specifically assigned to this clinic,
    // show all doctors so the user can still create an encounter.
    // In production, assure that staff are properly assigned to all clinics.
    return filtered.length > 0 ? filtered : allDoctors;
  }, [allDoctors, selectedClinic]);

  // Detect specialty module based on selected clinic
  const detectedSpecialty = useMemo(() => {
    return detectSpecialtyFromClinic(selectedClinic?.clinic_name);
  }, [selectedClinic]);

  // Check if selected clinic is GOPD
  const isSelectedClinicGopd = useMemo(() => {
    return isGopdClinic(selectedClinic?.clinic_name);
  }, [selectedClinic]);

  // Check if internal NHIS patient requires approval for selected clinic
  // BYPASS: If we have referralContext, it means this encounter is being created from
  // an already-approved internal referral in the InternalReferralQueue - no need for NHIS approval again
  const requiresInternalNhisApproval = useMemo(() => {
    // If creating encounter from an approved referral, skip NHIS approval check
    if (referralContext?.referralId) return false;

    if (!selectedPatient || !selectedClinic) return false;
    return requiresNhisApprovalForClinic(
      selectedPatient.nhis_patient_source,
      selectedPatient.insurance_type,
      selectedClinic.clinic_name,
    );
  }, [selectedPatient, selectedClinic, referralContext]);

  // Check if external/referral NHIS patient requires approval for ANY clinic visit
  // External patients ALWAYS need NHIS approval for each new encounter, even if previously verified
  const requiresExternalNhisApprovalForEncounter = useMemo(() => {
    if (!selectedPatient) return false;
    const profileActive = nhisProfile?.status === 'active';
    return requiresExternalNhisApproval(
      selectedPatient.nhis_patient_source,
      selectedPatient.insurance_type,
      profileActive,
    );
  }, [selectedPatient, nhisProfile]);

  const isReferralAndUnverified = useMemo(() => {
    if (!isNhisFeatureEnabled()) return false;
    if (!selectedPatient) return false;
    // Rule: Referral patients MUST have an active, verified NHIS profile
    // This profile is created/activated during the NHIS Module Verification process.
    // If they were just registered as "Referral" but haven't been cleared by NHIS,
    // they cannot create standard encounters.
    return (
      selectedPatient.nhis_patient_source === 'Referral' &&
      (!nhisProfile || nhisProfile.status !== 'active')
    );
  }, [selectedPatient, nhisProfile]);

  const referralQueueStatus = useMemo(() => {
    const items = referralQueueData?.data || [];
    if (!selectedPatient) return undefined;
    const match = items.find(
      (item: any) =>
        item.patient_id === selectedPatient.id ||
        item.patient?.id === selectedPatient.id,
    );
    return match?.status as string | undefined;
  }, [referralQueueData, selectedPatient]);

  const hasActiveReferralRequest = useMemo(() => {
    if (!isNhisFeatureEnabled()) return false;
    return (
      referralQueueStatus === 'pending' || referralQueueStatus === 'in_review'
    );
  }, [referralQueueStatus]);

  const availableVisitTypes = useMemo<VisitType[]>(() => {
    if (isReferralAndUnverified) {
      return ['Referred NHIS Patient (External)'] as VisitType[];
    }
    return (Array.from(VisitTypes) as VisitType[]).filter(
      (visitType) =>
        (isNhisFeatureEnabled() ||
          visitType !== 'Referred NHIS Patient (External)') &&
        (isEmergencyFeatureEnabled() || visitType !== 'A&E'),
    );
  }, [isReferralAndUnverified]);

  useEffect(() => {
    if (
      isReferralAndUnverified &&
      formData.visit_type !== 'Referred NHIS Patient (External)'
    ) {
      setFormData((prev) => ({
        ...prev,
        visit_type: 'Referred NHIS Patient (External)',
      }));
    }
  }, [isReferralAndUnverified, formData.visit_type]);

  // Real patient search with debounce
  const debouncedSearch = useDebounce(patientSearchQuery, 400);
  const { data: searchResultsRaw = [], isLoading: isSearching } =
    usePatientSearch(debouncedSearch);

  // Map PatientDTO to PatientSearchResult
  const searchResults: PatientSearchResult[] = searchResultsRaw.map(
    (p: PatientDTO) => {
      log.info(
        '[EncounterForm] Raw patient data:',
        p.first_name,
        p.surname,
        'nhis_patient_source:',
        p.nhis_patient_source,
      );
      return {
        id: (p as any).id || p.patient_id, // UUID for foreign key
        patient_id: p.patient_id,
        first_name: p.first_name,
        last_name: p.surname || '',
        emr_number: p.emr_number || undefined,
        date_of_birth: p.date_of_birth || undefined,
        phone: p.contact_phone || undefined,
        service_number: p.service_number || undefined,
        patient_category: p.patient_category || undefined,
        insurance_type: p.insurance_type || undefined,
        nhis_patient_source: p.nhis_patient_source || undefined,
      };
    },
  );

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Invalidate patient search cache to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['patients', 'search'] });

      if (preSelectedPatient) {
        setSelectedPatient(preSelectedPatient);
        setFormData((prev) => ({
          ...prev,
          // Use preSelectedPatient.id (UUID) for foreign key reference
          patient_id: preSelectedPatient.id,
        }));
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
        setSelectedPatient(null);
        setSelectedClinic(null);
        setSelectedDoctor(null);
        setClinicSearchQuery('');
        setDoctorSearchQuery('');
        setIsClinicDropdownOpen(false);
        setIsDoctorDropdownOpen(false);
        setSpecialtyReferralReason('');
        setFormData({
          patient_id: '',
          clinic_id: '',
          attending_doctor_id: '',
          visit_type: 'New Visit',
          priority: 'Normal',
        });
      }
      setPatientSearchQuery('');
    }
  }, [isOpen, preSelectedPatient, queryClient]);

  // Reset doctor when clinic changes
  useEffect(() => {
    setSelectedDoctor(null);
    setFormData((prev) => ({ ...prev, attending_doctor_id: '' }));
    setDoctorSearchQuery('');
  }, [selectedClinic]);

  // Auto-select clinic based on referral specialty module
  useEffect(() => {
    if (
      referralContext?.specialtyModule &&
      clinics.length > 0 &&
      !selectedClinic
    ) {
      const specialty = referralContext.specialtyModule.toLowerCase();
      // Find matching clinic by detecting each clinic's specialty module and comparing
      const matchingClinic = clinics.find((c: Clinic) => {
        const detected = detectSpecialtyFromClinic(c.clinic_name);
        if (detected === specialty) return true;
        // Fallback: also check partial name match for flexibility
        const name = c.clinic_name.toLowerCase();
        return (
          name.includes(specialty) ||
          specialty.includes(name.replace(' clinic', '').trim())
        );
      });
      if (matchingClinic) {
        setSelectedClinic(matchingClinic);
        setFormData((prev) => ({ ...prev, clinic_id: matchingClinic.id }));
        setClinicSearchQuery(matchingClinic.clinic_name);
      }
    }
    // For Follow-Up bookings with no specialty, match clinic by source clinic name
    if (
      referralContext?.isFollowUp &&
      referralContext.sourceClinicName &&
      clinics.length > 0 &&
      !selectedClinic
    ) {
      const sourceName = referralContext.sourceClinicName.toLowerCase();
      const matchingClinic = clinics.find(
        (c: Clinic) =>
          c.clinic_name.toLowerCase().includes(sourceName) ||
          sourceName.includes(c.clinic_name.toLowerCase()),
      );
      if (matchingClinic) {
        setSelectedClinic(matchingClinic);
        setFormData((prev) => ({ ...prev, clinic_id: matchingClinic.id }));
        setClinicSearchQuery(matchingClinic.clinic_name);
      }
    }
  }, [referralContext, clinics, selectedClinic]);

  const selectPatient = (patient: PatientSearchResult) => {
    log.info(
      '[EncounterForm] selectPatient called:',
      patient.first_name,
      patient.last_name,
      'nhis_patient_source:',
      patient.nhis_patient_source,
    );
    setSelectedPatient(patient);
    // Use patient.id (UUID) for foreign key reference, not patient_id (VARCHAR)
    setFormData((prev) => ({ ...prev, patient_id: patient.id }));
    setPatientSearchQuery('');
    setCurrentStep(2);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patient_id || !formData.clinic_id) {
      showToast({
        type: 'error',
        title: 'Missing Information',
        message: 'Please select a patient and clinic before continuing.',
      });
      return;
    }

    if (
      isReferralAndUnverified &&
      formData.visit_type !== 'Referred NHIS Patient (External)'
    ) {
      showToast({
        type: 'error',
        title: 'NHIS Verification Required',
        message:
          'Referral patients must be verified by NHIS before any standard visit types can be created.',
      });
      return;
    }

    // CRITICAL CHECK: Block direct encounter creation for NHIS patients without referral context
    // NHIS patients MUST go through the queue first (unless this is from an approved referral)
    // Exception: A&E/Emergency encounters bypass NHIS approval requirement
    const isEmergencyVisit =
      formData.visit_type === 'A&E' || formData.visit_type === 'Emergency';
    if (
      isNhisPatient(selectedPatient?.insurance_type) &&
      !referralContext &&
      !isEmergencyVisit
    ) {
      showToast({
        type: 'error',
        title: 'NHIS Approval Required',
        message:
          'NHIS patients must be submitted to the NHIS verification queue before creating an encounter. Please go back and click "Submit to NHIS for Approval".',
      });
      return;
    }

    // Convert form data to workflow CreateEncounterDTO
    // Derive payment_category from patient's insurance_type
    const paymentCategory = getPaymentCategoryFromInsurance(
      selectedPatient?.insurance_type,
    );

    const encounterDTO: CreateEncounterDTO = {
      patient_id: formData.patient_id,
      visit_type: formData.visit_type as any,
      payment_category: paymentCategory, // Derived from patient insurance_type
      priority: formData.priority as any,
      clinic_id: formData.clinic_id || undefined,
      attending_doctor_id: formData.attending_doctor_id || undefined,
      // Include referral context if this encounter is being created from a referral
      ...(referralContext && {
        is_referral_encounter: true,
        source_referral_id: referralContext.referralId,
        referring_doctor_id: referralContext.referringDoctorId,
        referral_reason: referralContext.referralReason,
        // For Follow-Up bookings: chief_complaint = follow-up notes (doctor instructions)
        // For regular referrals: chief_complaint = referral reason
        chief_complaint:
          referralContext.isFollowUp && referralContext.followUpNotes
            ? `Follow-up: ${referralContext.followUpNotes}`
            : referralContext.referralReason,
        specialty_module: referralContext.specialtyModule || undefined,
      }),
    };

    // Keep form open while mutation runs — close only AFTER server confirms.
    // This ensures the component stays mounted so inline callbacks (onSuccess, onError)
    // fire reliably. The booking's referral_workflow_status is updated to 'Encounter_Created'
    // on the server BEFORE we call onSuccess() → parent refetch gets fresh data.
    createEncounter.mutate(encounterDTO, {
      onSuccess: async (result) => {
        showToast({
          type: 'success',
          title: 'Encounter Created',
          message: 'Patient added to queue',
        });

        // If specialty clinic is selected, create a clinical request for specialty routing
        if (detectedSpecialty && result?.id) {
          const encounterId = result.id;
          const targetDepartmentId =
            await resolveSpecialtyDepartmentUuid(detectedSpecialty);

          if (targetDepartmentId && staff?.id) {
            try {
              await createClinicalRequest({
                patient_id: formData.patient_id,
                encounter_id: encounterId,
                requesting_doctor_id: staff.id,
                request_type: 'Referral',
                clinical_reason:
                  specialtyReferralReason ||
                  `Specialty routing to ${detectedSpecialty} clinic`,
                target_department_id: targetDepartmentId,
                notes:
                  specialtyReferralReason ||
                  `Direct routing to ${detectedSpecialty} clinic`,
                created_by: staff.id,
                specialty_module: detectedSpecialty,
              });
              showToast({
                type: 'success',
                title: 'Specialty Routing',
                message: `Patient routed to ${detectedSpecialty.charAt(0).toUpperCase() + detectedSpecialty.slice(1)} department`,
              });
            } catch (error) {
              log.error('Error creating specialty routing request:', error);
              showToast({
                type: 'error',
                title: 'Routing Error',
                message: 'Failed to route to specialty department',
              });
            }
          } else {
            log.warn(
              '[EncounterForm] Could not resolve specialty department UUID for:',
              detectedSpecialty,
            );
          }
        }

        // Ensure billing approval queue refreshes immediately after encounter creation.
        queryClient.invalidateQueries({ queryKey: ['billing-orders'] });

        // Notify parent AFTER server confirms — booking status is now 'Encounter_Created'
        // so the parent's refetch will return updated data without the stale booking.
        onSuccess?.();
        onClose();
      },
      onError: (error) => {
        showToast({
          type: 'error',
          title: 'Create Failed',
          message: 'Failed to create encounter',
        });
        log.error('Error creating encounter:', error);
        // Form stays open so user can retry
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop - prevent closing while mutation is running */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={createEncounter.isPending ? undefined : onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl">
          {/* Header with NDC Branding */}
          <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* XenoCare Logo */}
                <div>
                  <h2 className="text-lg font-bold text-white">
                    New Encounter
                  </h2>
                  <p className="text-sm text-white/80">
                    XenoCare - Create Patient Visit
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step Progress */}
            <div className="mt-4 flex items-center gap-2">
              <div
                className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-white' : 'text-white/50'}`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${currentStep >= 1 ? 'bg-white text-primary-700' : 'bg-white/20 text-white/50'}`}
                >
                  1
                </div>
                <span className="text-sm">Patient</span>
              </div>
              <ChevronRight className="h-4 w-4 text-white/40" />
              <div
                className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-white' : 'text-white/50'}`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${currentStep >= 2 ? 'bg-white text-primary-700' : 'bg-white/20 text-white/50'}`}
                >
                  2
                </div>
                <span className="text-sm">Visit Details</span>
              </div>
              <ChevronRight className="h-4 w-4 text-white/40" />
              <div
                className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-white' : 'text-white/50'}`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${currentStep >= 3 ? 'bg-white text-primary-700' : 'bg-white/20 text-white/50'}`}
                >
                  3
                </div>
                <span className="text-sm">Confirm</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Step 1: Patient Selection */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-primary-700/20 bg-gradient-to-br from-green-50 to-white p-5">
                  <label className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-700">
                    <User className="h-4 w-4" />
                    Search Patient
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name, service number, patient number, or phone..."
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      className="w-full rounded-lg border-2 border-gray-300 py-3 pl-10 pr-4 text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700/20"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
                      </div>
                    )}
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                      {searchResults.map((patient) => (
                        <button
                          key={patient.patient_id}
                          type="button"
                          onClick={() => selectPatient(patient)}
                          className="flex w-full items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-3 text-left hover:border-primary-700 hover:bg-green-50 transition-all shadow-sm hover:shadow"
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary-700 to-primary-600 text-white shadow-sm">
                            <User className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {patient.last_name}, {patient.first_name}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span className="font-mono">
                                {patient.emr_number ||
                                  (patient.service_number
                                    ? patient.service_number.replace(/-/g, '/')
                                    : '-')}
                              </span>
                              {patient.phone && (
                                <>
                                  <span>•</span>
                                  <span>{patient.phone}</span>
                                </>
                              )}
                            </div>
                            {patient.patient_category && (
                              <span
                                className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                  patient.patient_category === 'Military'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                <Shield className="h-3 w-3" />
                                {patient.patient_category}
                              </span>
                            )}
                            {/* Show NHIS Patient Source - critical for External NHIS Referral eligibility */}
                            {patient.nhis_patient_source && (
                              <span
                                className={`mt-1 ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                  patient.nhis_patient_source === 'Referral'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {patient.nhis_patient_source === 'Referral'
                                  ? '↗ Referral'
                                  : '● Internal'}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-primary-700" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results state */}
                  {patientSearchQuery.trim().length >= 1 &&
                    !isSearching &&
                    searchResults.length === 0 && (
                      <div className="mt-4 text-center py-6">
                        <User className="mx-auto h-10 w-10 text-gray-300" />
                        <p className="mt-2 text-sm font-medium text-gray-500">
                          No patients found
                        </p>
                        <p className="text-xs text-gray-400">
                          Try a different search term
                        </p>
                      </div>
                    )}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span>
                    Search by name, phone, patient number (e.g. "1" or "000001"
                    for {DEPLOYMENT.emrPrefix}-000001)
                  </span>
                </div>
              </div>
            )}

            {/* Step 2: Visit Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                {/* Selected Patient Card */}
                {selectedPatient && (
                  <div className="rounded-lg border-2 border-primary-700/20 bg-green-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-700 text-white">
                          <User className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {selectedPatient.last_name},{' '}
                            {selectedPatient.first_name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{selectedPatient.emr_number}</span>
                            {/* Show NHIS Patient Source badge - determines External NHIS Referral eligibility */}
                            {selectedPatient.nhis_patient_source && (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  selectedPatient.nhis_patient_source ===
                                  'Referral'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {selectedPatient.nhis_patient_source ===
                                'Referral'
                                  ? '↗ Referral Patient'
                                  : '● Internal Patient'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient(null);
                          setCurrentStep(1);
                        }}
                        className="text-sm font-medium text-primary-700 hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Clinic Selection - Searchable Dropdown */}
                  <div className="col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <Stethoscope className="mb-1 inline-block h-4 w-4" />{' '}
                      Clinic <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      {/* Selected Clinic Display / Search Input */}
                      <div
                        onClick={() =>
                          setIsClinicDropdownOpen(!isClinicDropdownOpen)
                        }
                        className={`flex w-full cursor-pointer items-center justify-between rounded-lg border-2 px-4 py-3 text-sm transition-all duration-200 ${
                          isClinicDropdownOpen
                            ? 'border-primary-700 ring-2 ring-primary-700/20'
                            : selectedClinic
                              ? 'border-primary-700/50 bg-green-50/50'
                              : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {selectedClinic ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-white">
                              <Stethoscope className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">
                                {selectedClinic.clinic_name}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                ({selectedClinic.clinic_code})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">
                            Select a clinic...
                          </span>
                        )}
                        <ChevronDown
                          className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                            isClinicDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>

                      {/* Dropdown Panel */}
                      {isClinicDropdownOpen && (
                        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-gray-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                          {/* Search Input */}
                          <div className="border-b border-gray-100 p-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search clinics..."
                                value={clinicSearchQuery}
                                onChange={(e) =>
                                  setClinicSearchQuery(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700/20"
                                autoFocus
                              />
                            </div>
                          </div>

                          {/* Clinic List */}
                          <div className="max-h-64 overflow-y-auto p-2">
                            {clinicsLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
                              </div>
                            ) : clinics.filter(
                                (clinic: Clinic) =>
                                  clinic.clinic_name
                                    .toLowerCase()
                                    .includes(
                                      clinicSearchQuery.toLowerCase(),
                                    ) ||
                                  clinic.clinic_code
                                    .toLowerCase()
                                    .includes(clinicSearchQuery.toLowerCase()),
                              ).length === 0 ? (
                              <div className="py-8 text-center">
                                <Stethoscope className="mx-auto h-8 w-8 text-gray-300" />
                                <p className="mt-2 text-sm text-gray-500">
                                  No clinics found
                                </p>
                              </div>
                            ) : (
                              clinics
                                .filter(
                                  (clinic: Clinic) =>
                                    clinic.clinic_name
                                      .toLowerCase()
                                      .includes(
                                        clinicSearchQuery.toLowerCase(),
                                      ) ||
                                    clinic.clinic_code
                                      .toLowerCase()
                                      .includes(
                                        clinicSearchQuery.toLowerCase(),
                                      ),
                                )
                                .map((clinic: Clinic) => (
                                  <button
                                    key={clinic.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedClinic(clinic);
                                      // Use clinic.id (UUID) for database reference
                                      setFormData((prev) => ({
                                        ...prev,
                                        clinic_id: clinic.id,
                                        // Auto-set visit_type to A&E when A&E clinic is selected
                                        ...(isAeClinic(clinic)
                                          ? { visit_type: 'A&E' as VisitType }
                                          : {}),
                                      }));
                                      setIsClinicDropdownOpen(false);
                                      setClinicSearchQuery('');
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all duration-150 ${
                                      selectedClinic?.id === clinic.id
                                        ? 'bg-primary-700/10 ring-1 ring-primary-700/30'
                                        : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    <div
                                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                        selectedClinic?.id === clinic.id
                                          ? 'bg-primary-700 text-white'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      <Stethoscope className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">
                                        {clinic.clinic_name}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                          {clinic.clinic_code}
                                        </span>
                                        {clinic.location && (
                                          <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {clinic.location}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {selectedClinic?.id === clinic.id && (
                                      <Check className="h-5 w-5 text-primary-700" />
                                    )}
                                  </button>
                                ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Click outside to close */}
                      {isClinicDropdownOpen && (
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => {
                            setIsClinicDropdownOpen(false);
                            setClinicSearchQuery('');
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Doctor Selection - Searchable Dropdown */}
                  <div className="col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <UserCheck className="mb-1 inline-block h-4 w-4" />{' '}
                      Attending Doctor{' '}
                      {selectedClinic && (
                        <span className="text-gray-400 font-normal normal-case">
                          ({selectedClinic.clinic_name})
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      {/* Selected Doctor Display / Search Input */}
                      <div
                        onClick={() =>
                          selectedClinic &&
                          setIsDoctorDropdownOpen(!isDoctorDropdownOpen)
                        }
                        className={`flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-sm transition-all duration-200 ${
                          !selectedClinic
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                            : isDoctorDropdownOpen
                              ? 'border-primary-700 ring-2 ring-primary-700/20 cursor-pointer'
                              : selectedDoctor
                                ? 'border-primary-700/50 bg-green-50/50 cursor-pointer'
                                : 'border-gray-300 hover:border-gray-400 cursor-pointer'
                        }`}
                      >
                        {!selectedClinic ? (
                          <span className="text-gray-400">
                            Select a clinic first...
                          </span>
                        ) : selectedDoctor ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
                              <UserCheck className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">
                                Dr. {selectedDoctor.first_name}{' '}
                                {selectedDoctor.last_name}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                ({selectedDoctor.staff_id})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">
                            Select a doctor (optional)...
                          </span>
                        )}
                        <ChevronDown
                          className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                            isDoctorDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>

                      {/* Dropdown Panel */}
                      {isDoctorDropdownOpen && selectedClinic && (
                        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-gray-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                          {/* Search Input */}
                          <div className="border-b border-gray-100 p-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search doctors..."
                                value={doctorSearchQuery}
                                onChange={(e) =>
                                  setDoctorSearchQuery(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700/20"
                                autoFocus
                              />
                            </div>
                          </div>

                          {/* Doctor List */}
                          <div className="max-h-64 overflow-y-auto p-2">
                            {doctorsLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-700 border-t-transparent" />
                              </div>
                            ) : filteredDoctors.filter(
                                (doc: DoctorOption) =>
                                  `${doc.first_name} ${doc.last_name}`
                                    .toLowerCase()
                                    .includes(
                                      doctorSearchQuery.toLowerCase(),
                                    ) ||
                                  doc.staff_id
                                    .toLowerCase()
                                    .includes(doctorSearchQuery.toLowerCase()),
                              ).length === 0 ? (
                              <div className="py-8 text-center">
                                <UserCheck className="mx-auto h-8 w-8 text-gray-300" />
                                <p className="mt-2 text-sm text-gray-500">
                                  {filteredDoctors.length === 0
                                    ? `No doctors assigned to ${selectedClinic.clinic_name}`
                                    : 'No doctors found'}
                                </p>
                                {filteredDoctors.length === 0 && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Showing all doctors instead
                                  </p>
                                )}
                              </div>
                            ) : (
                              (filteredDoctors.length > 0
                                ? filteredDoctors
                                : allDoctors
                              )
                                .filter(
                                  (doc: DoctorOption) =>
                                    `${doc.first_name} ${doc.last_name}`
                                      .toLowerCase()
                                      .includes(
                                        doctorSearchQuery.toLowerCase(),
                                      ) ||
                                    doc.staff_id
                                      .toLowerCase()
                                      .includes(
                                        doctorSearchQuery.toLowerCase(),
                                      ),
                                )
                                .map((doctor: DoctorOption) => (
                                  <button
                                    key={doctor.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedDoctor(doctor);
                                      setFormData((prev) => ({
                                        ...prev,
                                        attending_doctor_id: doctor.id,
                                      }));
                                      setIsDoctorDropdownOpen(false);
                                      setDoctorSearchQuery('');
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all duration-150 ${
                                      selectedDoctor?.id === doctor.id
                                        ? 'bg-blue-50 ring-1 ring-blue-300'
                                        : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    <div
                                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                        selectedDoctor?.id === doctor.id
                                          ? 'bg-blue-600 text-white'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      <UserCheck className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">
                                        Dr. {doctor.first_name}{' '}
                                        {doctor.last_name}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                          {doctor.staff_id}
                                        </span>
                                        {doctor.department && (
                                          <span className="flex items-center gap-1">
                                            <Stethoscope className="h-3 w-3" />
                                            {doctor.department}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {selectedDoctor?.id === doctor.id && (
                                      <Check className="h-5 w-5 text-blue-600" />
                                    )}
                                  </button>
                                ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Click outside to close */}
                      {isDoctorDropdownOpen && (
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => {
                            setIsDoctorDropdownOpen(false);
                            setDoctorSearchQuery('');
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Visit Type */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <Calendar className="mb-1 inline-block h-4 w-4" /> Visit
                      Type
                    </label>
                    <select
                      name="visit_type"
                      value={formData.visit_type}
                      onChange={handleInputChange}
                      required
                      disabled={isReferralAndUnverified}
                      className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700/20"
                    >
                      {availableVisitTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {isReferralAndUnverified && (
                      <p className="mt-2 text-xs text-red-600">
                        Visit type locked to NHIS referral until verification is
                        complete.
                      </p>
                    )}
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <AlertCircle className="mb-1 inline-block h-4 w-4" />{' '}
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-sm focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700/20"
                    >
                      {PriorityLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Global Block for Unverified Referral Patients (Applied to all visit types) */}
                {isReferralAndUnverified &&
                  formData.visit_type !==
                    'Referred NHIS Patient (External)' && (
                    <div className="mt-4 rounded-lg border-2 border-red-500 bg-red-50 p-6 animate-pulse shadow-lg">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white flex-shrink-0">
                          <Shield className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-extrabold text-red-900 text-lg uppercase tracking-tight">
                              NHIS Verification Required
                            </h4>
                          </div>
                          <p className="text-red-800 font-medium">
                            <strong>
                              {selectedPatient?.first_name}{' '}
                              {selectedPatient?.last_name}
                            </strong>{' '}
                            is a newly registered{' '}
                            <strong>Referral Patient</strong>.
                          </p>
                          <p className="mt-2 text-sm text-red-700 leading-relaxed">
                            By policy, referral patients{' '}
                            <span className="underline font-bold">MUST</span>{' '}
                            have their referral documents verified in the **NHIS
                            Module** before any clinical encounters (visits) can
                            be created.
                          </p>
                          <div className="mt-4 flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-white/50 rounded-lg px-3 py-2 border border-red-200">
                              <X className="h-4 w-4" />
                              <span>
                                Standard Visit types are BLOCKED until
                                verification is complete.
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg px-3 py-2 border border-blue-200">
                              <Info className="h-4 w-4" />
                              <span>
                                ACTION: Change Visit Type to{' '}
                                <strong>
                                  "Referred NHIS Patient (External)"
                                </strong>{' '}
                                to submit to the NHIS queue.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* NHIS Referral Status Indicator - Only show for pending/in_review/rejected status */}
                {selectedPatient?.nhis_patient_source === 'Referral' &&
                  referralQueueStatus &&
                  (referralQueueStatus === 'pending' ||
                    referralQueueStatus === 'in_review' ||
                    referralQueueStatus === 'rejected' ||
                    referralQueueStatus === 'expired') && (
                    <div
                      className={`mt-4 rounded-lg border p-4 ${
                        referralQueueStatus === 'rejected'
                          ? 'border-red-300 bg-red-50'
                          : referralQueueStatus === 'expired'
                            ? 'border-gray-300 bg-gray-50'
                            : 'border-yellow-300 bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            referralQueueStatus === 'rejected'
                              ? 'bg-red-100 text-red-600'
                              : referralQueueStatus === 'expired'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          <Clock className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            NHIS Queue Status
                          </h4>
                          <p className="mt-1 text-sm text-gray-700">
                            {referralQueueStatus === 'rejected' &&
                              'Rejected: Please review referral details in the NHIS module.'}
                            {referralQueueStatus === 'pending' &&
                              'Pending: Request is awaiting NHIS approval.'}
                            {referralQueueStatus === 'in_review' &&
                              'In Review: NHIS team is reviewing the request.'}
                            {referralQueueStatus === 'expired' &&
                              'Expired: Request has expired. Please submit a new request.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {/* External NHIS Referral - Patient Eligibility Validation */}
                {formData.visit_type === 'Referred NHIS Patient (External)' && (
                  <>
                    {/* Check if patient is eligible for External NHIS Referral */}
                    {log.info(
                      '[EncounterForm] Validation check - selectedPatient?.nhis_patient_source:',
                      selectedPatient?.nhis_patient_source,
                      'isEligible:',
                      isEligibleForExternalNhisReferral(
                        selectedPatient?.nhis_patient_source,
                      ),
                    )}
                    {!isEligibleForExternalNhisReferral(
                      selectedPatient?.nhis_patient_source,
                    ) ? (
                      /* BLOCKED: Patient is not a Referral Patient - cannot have External NHIS Referral */
                      <div className="mt-4 rounded-lg border-2 border-red-300 bg-red-50 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 flex-shrink-0">
                            <X className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-red-900">
                              Patient Not Eligible for External NHIS Referral
                            </h4>
                            <p className="mt-1 text-sm text-red-800">
                              <strong>
                                {selectedPatient?.first_name}{' '}
                                {selectedPatient?.last_name}
                              </strong>{' '}
                              is registered as:{' '}
                              <strong>
                                {getNhisPatientSourceLabel(
                                  selectedPatient?.nhis_patient_source,
                                )}
                              </strong>
                              .
                            </p>
                            <p className="mt-2 text-sm text-red-700">
                              Only patients registered as{' '}
                              <strong>"Referral Patient"</strong> (referred from
                              another facility) can be processed as "Referred
                              NHIS Patient (External)".
                            </p>
                            {!selectedPatient?.nhis_patient_source && (
                              <p className="mt-2 text-sm text-red-700 font-medium">
                                ⚠️ This patient's NHIS Patient Source is not
                                set. Please edit the patient profile and set{' '}
                                <strong>
                                  NHIS Patient Source = "Referral"
                                </strong>{' '}
                                in the registration form.
                              </p>
                            )}
                            <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-100 rounded-lg px-3 py-2">
                              <AlertCircle className="h-4 w-4" />
                              <span>
                                {selectedPatient?.nhis_patient_source ===
                                'Internal'
                                  ? 'Internal patients should use standard visit types. Please select a different visit type or choose a Referral patient.'
                                  : 'Please update the patient profile to set NHIS Patient Source to "Referral" before proceeding.'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ELIGIBLE: Show NHIS Approval Required notice */
                      <div className="mt-4 rounded-lg border-2 border-indigo-200 bg-indigo-50 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0">
                            <Shield className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-indigo-900">
                              NHIS Approval Required
                            </h4>
                            <p className="mt-1 text-sm text-indigo-800">
                              This referral type requires NHIS validation.
                              Please submit this request to the NHIS queue. An
                              NHIS officer must verify the referral validity
                              (30-day limit) before the encounter can proceed.
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-100 rounded-lg px-3 py-2">
                              <Check className="h-4 w-4" />
                              <span>
                                Patient verified as Referral Patient – eligible
                                for external referral processing.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Specialty Clinic Routing Indicator */}
                {detectedSpecialty && (
                  <div className="mt-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white flex-shrink-0">
                        {detectedSpecialty === 'dental' && (
                          <Smile className="h-5 w-5" />
                        )}
                        {detectedSpecialty === 'ophthalmology' && (
                          <Eye className="h-5 w-5" />
                        )}
                        {detectedSpecialty === 'physiotherapy' && (
                          <Dumbbell className="h-5 w-5" />
                        )}
                        {detectedSpecialty === 'nutrition' && (
                          <Stethoscope className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-blue-900">
                            {detectedSpecialty === 'dental' && 'Dental Clinic'}
                            {detectedSpecialty === 'ophthalmology' &&
                              'Eye Clinic (Ophthalmology)'}
                            {detectedSpecialty === 'physiotherapy' &&
                              'Physiotherapy Clinic'}
                            {detectedSpecialty === 'nutrition' &&
                              'Nutrition & Dietetics Clinic'}
                          </h4>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-800">
                            <Send className="h-3 w-3" />
                            Specialty Routing
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-blue-700">
                          This patient will be automatically routed to the
                          specialty module for specialized care.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* NHIS Approval Required Warning for Internal NHIS Patients (Non-GOPD clinics) */}
                {requiresInternalNhisApproval && (
                  <div className="mt-4 rounded-lg border-2 border-orange-400 bg-orange-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white flex-shrink-0">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-orange-900 text-sm uppercase tracking-tight">
                          NHIS Approval Required
                        </h4>
                        <p className="text-orange-800 text-sm mt-1">
                          <strong>
                            {selectedPatient?.first_name}{' '}
                            {selectedPatient?.last_name}
                          </strong>{' '}
                          is an internal NHIS patient.
                        </p>
                        <p className="mt-2 text-sm text-orange-700">
                          All encounters for internal NHIS patients at{' '}
                          <strong>{selectedClinic?.clinic_name}</strong> require
                          NHIS desk approval before creation. Authorization code
                          is not required — admin can verify directly.
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-orange-600 bg-white/50 rounded-lg px-3 py-2 border border-orange-200">
                          <Info className="h-4 w-4" />
                          <span>
                            Request will be sent to NHIS queue. Encounter
                            created after approval.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* External Referral Patient - ALWAYS requires NHIS approval for ANY clinic */}
                {requiresExternalNhisApprovalForEncounter &&
                  !isReferralAndUnverified && (
                    <div className="mt-4 rounded-lg border-2 border-indigo-400 bg-indigo-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white flex-shrink-0">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-tight">
                            External Referral - NHIS Verification Required
                          </h4>
                          <p className="text-indigo-800 text-sm mt-1">
                            <strong>
                              {selectedPatient?.first_name}{' '}
                              {selectedPatient?.last_name}
                            </strong>{' '}
                            is an external referral patient.
                          </p>
                          <p className="mt-2 text-sm text-indigo-700">
                            All encounters for external referral patients
                            require NHIS approval, including visits to{' '}
                            <strong>
                              {selectedClinic?.clinic_name || 'any clinic'}
                            </strong>
                            .
                          </p>
                          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-indigo-600 bg-white/50 rounded-lg px-3 py-2 border border-indigo-200">
                            <Info className="h-4 w-4" />
                            <span>
                              Each new clinic visit requires NHIS queue
                              verification before encounter creation.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Approved Referral Indicator - shown when creating encounter from Internal Referral Queue */}
                {referralContext?.referralId &&
                  isNhisPatient(selectedPatient?.insurance_type) && (
                    <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          NHIS Pre-Approved Referral — Encounter can be created
                          directly
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-green-700 ml-7">
                        This referral has already been approved by NHIS desk.
                        You can proceed to create the encounter.
                      </p>
                    </div>
                  )}

                {/* Clinic & Request Details Card - Shows target clinic details for all encounter types */}
                {selectedClinic && (
                  <div className="mt-4 rounded-xl border-2 border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                      <Building2 className="h-5 w-5 text-primary-700" />
                      <h4 className="font-bold text-gray-900 text-sm uppercase tracking-tight">
                        Target Clinic Details
                      </h4>
                      {referralContext && (
                        <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                          FROM REFERRAL
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                          Clinic Name
                        </span>
                        <p className="font-bold text-gray-900 text-sm">
                          {selectedClinic.clinic_name}
                        </p>
                      </div>
                      {selectedClinic.clinic_code && (
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                            Clinic Code
                          </span>
                          <p className="font-mono font-bold text-gray-700 text-sm">
                            {selectedClinic.clinic_code}
                          </p>
                        </div>
                      )}
                      {selectedDoctor && (
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                            Attending Doctor
                          </span>
                          <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-gray-500" />
                            Dr. {selectedDoctor.first_name}{' '}
                            {selectedDoctor.last_name}
                          </p>
                          {selectedDoctor.department && (
                            <span className="text-xs text-gray-400 block mt-0.5">
                              {selectedDoctor.department}
                            </span>
                          )}
                        </div>
                      )}
                      {referralContext?.sourceClinicName && (
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                            Referred From
                          </span>
                          <p className="font-bold text-gray-800 text-sm">
                            {referralContext.sourceClinicName}
                          </p>
                        </div>
                      )}
                      {referralContext?.referringDoctorName && (
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                            Referring Doctor
                          </span>
                          <p className="font-bold text-gray-800 text-sm">
                            Dr. {referralContext.referringDoctorName}
                          </p>
                        </div>
                      )}
                      {referralContext?.referralReason && (
                        <div className="col-span-2">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                            Referral Reason
                          </span>
                          <p className="text-sm text-gray-600 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                            "{referralContext.referralReason}"
                          </p>
                        </div>
                      )}
                      {detectedSpecialty && (
                        <div className="col-span-2 pt-2 border-t border-gray-100">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                            Specialty Module
                          </span>
                          <p className="font-bold text-blue-700 text-sm capitalize flex items-center gap-1.5">
                            <Stethoscope className="h-3.5 w-3.5" />
                            {detectedSpecialty} — Patient will be automatically
                            routed
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>

                  {formData.visit_type ===
                  'Referred NHIS Patient (External)' ? (
                    /* External NHIS Referral - Create queue item with clinic selection, NHIS must approve before encounter is created */
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedPatient) return;

                        try {
                          // Create referral queue item with clinic info - encounter will be created after NHIS approval
                          await createReferralQueueItem.mutateAsync({
                            patient_id: selectedPatient.id,
                            request_type: 'external_referral',
                            requested_by: staff?.id || '',
                            request_notes: `External NHIS referral request for ${selectedPatient.first_name} ${selectedPatient.last_name}. Target clinic: ${selectedClinic?.clinic_name || 'Not selected'}`,
                            // Include clinic selection - encounter will be created with this clinic after NHIS approval
                            target_clinic_id: formData.clinic_id || undefined,
                            target_doctor_id:
                              formData.attending_doctor_id || undefined,
                            visit_type: 'Referred NHIS Patient (External)',
                            chief_complaint: `External NHIS Referral - ${selectedClinic?.clinic_name || 'General'}`,
                          });

                          showToast({
                            type: 'success',
                            title: 'Request Submitted',
                            message:
                              'Request sent to NHIS queue for approval. Encounter will be created after NHIS approval.',
                          });

                          // Close form only - no automatic redirection
                          onClose();
                        } catch (error) {
                          log.error(
                            'Failed to create referral queue item:',
                            error,
                          );
                          showToast({
                            type: 'error',
                            title: 'Submission Failed',
                            message: 'Failed to submit referral request',
                          });
                        }
                      }}
                      disabled={
                        !isEligibleForExternalNhisReferral(
                          selectedPatient?.nhis_patient_source,
                        ) ||
                        createReferralQueueItem.isPending ||
                        hasActiveReferralRequest ||
                        !formData.clinic_id
                      }
                      className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        isEligibleForExternalNhisReferral(
                          selectedPatient?.nhis_patient_source,
                        ) &&
                        !hasActiveReferralRequest &&
                        formData.clinic_id
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Shield className="h-4 w-4" />
                      {createReferralQueueItem.isPending
                        ? 'Submitting...'
                        : hasActiveReferralRequest
                          ? 'Already in NHIS Queue'
                          : !formData.clinic_id
                            ? 'Select Clinic First'
                            : isEligibleForExternalNhisReferral(
                                  selectedPatient?.nhis_patient_source,
                                )
                              ? 'Submit to NHIS Queue for Approval'
                              : 'Patient Ineligible'}
                    </button>
                  ) : requiresInternalNhisApproval ? (
                    /* Internal NHIS patient going to non-GOPD clinic - requires NHIS approval first */
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedPatient) return;

                        try {
                          // Create referral queue item for internal NHIS patient
                          await createReferralQueueItem.mutateAsync({
                            patient_id: selectedPatient.id,
                            request_type: 'internal_nhis_approval',
                            requested_by: staff?.id || '',
                            request_notes: `Internal NHIS patient encounter request for ${selectedPatient.first_name} ${selectedPatient.last_name}. Target clinic: ${selectedClinic?.clinic_name}`,
                            target_clinic_id: formData.clinic_id || undefined,
                            target_doctor_id:
                              formData.attending_doctor_id || undefined,
                            visit_type: formData.visit_type,
                            chief_complaint: `${formData.visit_type} - ${selectedClinic?.clinic_name}`,
                          });

                          showToast({
                            type: 'success',
                            title: 'Request Submitted',
                            message:
                              'Request sent to NHIS desk for approval. Encounter will be created after approval.',
                          });
                          onClose();
                        } catch (error) {
                          log.error(
                            'Failed to create NHIS approval request:',
                            error,
                          );
                          showToast({
                            type: 'error',
                            title: 'Submission Failed',
                            message: 'Failed to submit NHIS approval request',
                          });
                        }
                      }}
                      disabled={
                        !formData.clinic_id ||
                        createReferralQueueItem.isPending ||
                        hasActiveReferralRequest
                      }
                      className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        formData.clinic_id && !hasActiveReferralRequest
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Shield className="h-4 w-4" />
                      {createReferralQueueItem.isPending
                        ? 'Submitting...'
                        : hasActiveReferralRequest
                          ? 'Already in NHIS Queue'
                          : 'Submit to NHIS Desk for Approval'}
                    </button>
                  ) : requiresExternalNhisApprovalForEncounter &&
                    !isReferralAndUnverified ? (
                    /* Verified external referral patient visiting ANY clinic - still requires NHIS approval */
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedPatient) return;

                        try {
                          // Create referral queue item for verified external patient going to any clinic
                          await createReferralQueueItem.mutateAsync({
                            patient_id: selectedPatient.id,
                            request_type: 'external_referral',
                            requested_by: staff?.id || '',
                            request_notes: `Verified external referral patient encounter request for ${selectedPatient.first_name} ${selectedPatient.last_name}. Target clinic: ${selectedClinic?.clinic_name}`,
                            target_clinic_id: formData.clinic_id || undefined,
                            target_doctor_id:
                              formData.attending_doctor_id || undefined,
                            visit_type: formData.visit_type,
                            chief_complaint: `${formData.visit_type} - ${selectedClinic?.clinic_name}`,
                          });

                          showToast({
                            type: 'success',
                            title: 'Request Submitted',
                            message:
                              'Request sent to NHIS queue for verification. Encounter will be created after approval.',
                          });
                          onClose();
                        } catch (error) {
                          log.error(
                            'Failed to create NHIS verification request:',
                            error,
                          );
                          showToast({
                            type: 'error',
                            title: 'Submission Failed',
                            message:
                              'Failed to submit NHIS verification request',
                          });
                        }
                      }}
                      disabled={
                        !formData.clinic_id ||
                        createReferralQueueItem.isPending ||
                        hasActiveReferralRequest
                      }
                      className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        formData.clinic_id && !hasActiveReferralRequest
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Shield className="h-4 w-4" />
                      {createReferralQueueItem.isPending
                        ? 'Submitting...'
                        : hasActiveReferralRequest
                          ? 'Already in NHIS Queue'
                          : 'Submit to NHIS Queue for Verification'}
                    </button>
                  ) : /* Fallback: Either private patient or NHIS patient from approved referral context */
                  /* Block if NHIS patient without referral context - they must go through queue */
                  isNhisPatient(selectedPatient?.insurance_type) &&
                    !referralContext ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedPatient) return;

                        try {
                          // Auto-submit ALL NHIS patients to queue if not already handled above
                          await createReferralQueueItem.mutateAsync({
                            patient_id: selectedPatient.id,
                            request_type:
                              selectedPatient.nhis_patient_source === 'Referral'
                                ? 'external_referral'
                                : 'internal_nhis_approval',
                            requested_by: staff?.id || '',
                            request_notes: `NHIS patient encounter request for ${selectedPatient.first_name} ${selectedPatient.last_name}. Target clinic: ${selectedClinic?.clinic_name}`,
                            target_clinic_id: formData.clinic_id || undefined,
                            target_doctor_id:
                              formData.attending_doctor_id || undefined,
                            visit_type: formData.visit_type,
                            chief_complaint: `${formData.visit_type} - ${selectedClinic?.clinic_name}`,
                          });

                          showToast({
                            type: 'success',
                            title: 'Request Submitted',
                            message:
                              'NHIS verification required. Request sent to NHIS desk for approval.',
                          });
                          onClose();
                        } catch (error) {
                          log.error(
                            'Failed to create NHIS approval request:',
                            error,
                          );
                          showToast({
                            type: 'error',
                            title: 'Submission Failed',
                            message: 'Failed to submit NHIS approval request',
                          });
                        }
                      }}
                      disabled={
                        !formData.clinic_id ||
                        createReferralQueueItem.isPending ||
                        hasActiveReferralRequest
                      }
                      className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        formData.clinic_id && !hasActiveReferralRequest
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Shield className="h-4 w-4" />
                      {createReferralQueueItem.isPending
                        ? 'Submitting...'
                        : hasActiveReferralRequest
                          ? 'Already in NHIS Queue'
                          : 'Submit to NHIS for Approval'}
                    </button>
                  ) : (
                    /* Regular Continue button for private patients or approved NHIS from referral context */
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      disabled={
                        !formData.clinic_id ||
                        isReferralAndUnverified ||
                        nhisProfileLoading
                      }
                      className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors ${
                        !formData.clinic_id ||
                        isReferralAndUnverified ||
                        nhisProfileLoading
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-primary-700 hover:bg-primary-800'
                      }`}
                    >
                      {nhisProfileLoading
                        ? 'Checking Eligibility...'
                        : isReferralAndUnverified
                          ? 'Verification Required'
                          : 'Continue'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-3 text-sm font-semibold uppercase text-gray-600">
                    Encounter Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Patient</span>
                      <span className="font-medium">
                        {selectedPatient
                          ? `${selectedPatient.last_name}, ${selectedPatient.first_name}`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Patient number</span>
                      <span className="font-medium">
                        {selectedPatient?.emr_number || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Clinic</span>
                      <span className="font-medium">
                        {selectedClinic?.clinic_name || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Attending Doctor</span>
                      <span className="font-medium">
                        {selectedDoctor
                          ? `Dr. ${selectedDoctor.first_name} ${selectedDoctor.last_name}`
                          : 'Not Assigned'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Visit Type</span>
                      <span className="font-medium">{formData.visit_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Priority</span>
                      <span className="font-medium">{formData.priority}</span>
                    </div>

                    {/* Specialty Routing in Summary */}
                    {detectedSpecialty && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Send className="h-3 w-3" />
                            Specialty Routing
                          </span>
                          <span className="inline-flex items-center gap-1 font-medium text-blue-700">
                            {detectedSpecialty === 'dental' && (
                              <>
                                <Smile className="h-4 w-4" /> Dental
                              </>
                            )}
                            {detectedSpecialty === 'ophthalmology' && (
                              <>
                                <Eye className="h-4 w-4" /> Ophthalmology
                              </>
                            )}
                            {detectedSpecialty === 'physiotherapy' && (
                              <>
                                <Dumbbell className="h-4 w-4" /> Physiotherapy
                              </>
                            )}
                            {detectedSpecialty === 'nutrition' && (
                              <>
                                <Stethoscope className="h-4 w-4" /> Nutrition
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={
                      createEncounter.isPending || isReferralAndUnverified
                    }
                    className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors ${
                      createEncounter.isPending || isReferralAndUnverified
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-primary-700 hover:bg-primary-800'
                    }`}
                  >
                    {createEncounter.isPending
                      ? 'Creating...'
                      : isReferralAndUnverified
                        ? 'Verification Required'
                        : 'Create Encounter'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default EncounterForm;