import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  User,
  Shield,
  Briefcase,
  Users,
  Phone,
  MapPin,
  Heart,
  UserCheck,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Calendar,
  Mail,
  Home,
  Droplets,
  Building2,
  UserPlus,
  FileText,
  Hospital,
  ClipboardList,
  BadgeCheck,
  Info,
  Camera,
  Upload,
  Trash2,
  Plus,
  Loader2,
  GraduationCap,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Textarea,
  SearchableSelect,
} from '../../../components/ui';
import {
  CreatePatientDTO,
  UpdatePatientDTO,
  PatientDTO,
  validatePatientForm,
  PatientFormErrors,
  PatientCategory,
  PatientType,
  InsuranceType,
  SecurityOrganization,
  NHISPatientSource,
  ReferralStatus,
  formatDetailedAge,
  calculateDetailedAge,
  capitalizePatientName,
} from '../dtos/patient.dto';
import { Gender, StaffCategory, MilitaryBranch } from '../../../types';
import {
  isMilitaryFeatureEnabled,
  isNhisCategory,
  isNhisFeatureEnabled,
} from '../../../config/features';
import {
  usePayerSchemes,
  usePatients,
  usePatient,
  useDependentsByPrincipal,
} from '../hooks/usePatient';
import {
  useActiveCourses,
  useCreateCourse,
  useNextCourseNumber,
} from '../hooks/useCourses';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import {
  ALLERGY_SEVERITIES,
  type AllergySeverity,
  type PatientAllergyInput,
} from '../api/patient-allergies.api';
import {
  usePatientAllergyReview,
  usePatientAllergies,
  useSavePatientAllergies,
} from '../hooks/usePatientAllergies';

// =============================================================================
// Constants
// =============================================================================

const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];

const PATIENT_CATEGORY_OPTIONS = [
  { value: '', label: 'Select Category' },
  { value: 'Military', label: 'Military' },
  { value: 'Civilian', label: 'Civilian' },
  { value: 'Military Participant', label: 'Military Participant' },
  { value: 'Civilian Participant', label: 'Civilian Participant' },
  { value: 'Security Services', label: 'Security Services' },
];

const PATIENT_TYPE_OPTIONS = [
  { value: '', label: 'Select Patient Type' },
  { value: 'Principal', label: 'Principal' },
  { value: 'Dependent', label: 'Dependent' },
];

const MILITARY_ARM_OPTIONS = [
  { value: 'Army', label: 'Army' },
  { value: 'Navy', label: 'Navy' },
  { value: 'Airforce', label: 'Airforce' },
];

// Personnel Category based on Service Branch
const PERSONNEL_CATEGORY_OPTIONS: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  Army: [
    { value: 'Officer', label: 'Officer' },
    { value: 'Soldier', label: 'Soldier' },
  ],
  Navy: [
    { value: 'Officer', label: 'Officer' },
    { value: 'Rating', label: 'Rating' },
  ],
  Airforce: [
    { value: 'Officer', label: 'Officer' },
    { value: 'Airman', label: 'Airman' },
  ],
};

// Nigerian Military Ranks by Service and Category
const MILITARY_RANKS: Record<string, Record<string, string[]>> = {
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
  militaryBranch?: string,
  personnelCategory?: string,
): Array<{ value: string; label: string }> => {
  if (!militaryBranch || !personnelCategory) return [];
  const ranks = MILITARY_RANKS[militaryBranch]?.[personnelCategory] || [];
  return ranks.map((rank) => ({ value: rank, label: rank }));
};

// Helper function to infer personnel category from existing rank
const inferPersonnelCategory = (
  militaryBranch: string,
  rank: string,
): string => {
  if (!militaryBranch || !rank) return '';
  const branchRanks = MILITARY_RANKS[militaryBranch];
  if (!branchRanks) return '';

  for (const [category, ranks] of Object.entries(branchRanks)) {
    if (ranks.includes(rank)) {
      return category;
    }
  }
  return '';
};

const MILITARY_COVERAGE_OPTIONS = [
  { value: 'Military_NHIS', label: 'Military NHIS' },
];

const CIVILIAN_COVERAGE_OPTIONS = [
  { value: '', label: 'Select Insurance Type' },
  { value: 'Civilian_NHIS', label: 'Civilian NHIS' },
  { value: 'GIFSHIP', label: 'GIFSHIP' },
  { value: 'Private', label: 'Private Insurance' },
];

// Insurance Type options (main dropdown)
const INSURANCE_TYPE_OPTIONS = [
  { value: '', label: 'Select Insurance Category' },
  { value: 'Military_NHIS', label: 'Military NHIS' },
  { value: 'Civilian_NHIS', label: 'Civilian NHIS' },
  {
    value: 'Security_Services_NHIS',
    label: 'Security Services NHIS (Paramilitary)',
  },
  { value: 'GIFSHIP', label: 'GIFSHIP' },
  { value: 'Retainership', label: 'Retainership' },
  { value: 'Private', label: 'Private' },
];

// Security Services/Paramilitary Organizations
const SECURITY_ORGANIZATION_OPTIONS = [
  { value: '', label: 'Select Organization' },
  { value: 'NPF', label: 'Nigeria Police Force (NPF)' },
  { value: 'NSCDC', label: 'Nigeria Security and Civil Defence Corps (NSCDC)' },
  { value: 'NIS', label: 'Nigeria Immigration Service (NIS)' },
  { value: 'NCS', label: 'Nigeria Customs Service (NCS)' },
  { value: 'FFS', label: 'Federal Fire Service (FFS)' },
  { value: 'DSS', label: 'Department of State Services (DSS)' },
  { value: 'NCoS', label: 'Nigeria Correctional Service (NCoS)' },
  { value: 'FRSC', label: 'Federal Road Safety Corps (FRSC)' },
  { value: 'NDLEA', label: 'National Drug Law Enforcement Agency (NDLEA)' },
  { value: 'EFCC', label: 'Economic and Financial Crimes Commission (EFCC)' },
  { value: 'ICPC', label: 'Independent Corrupt Practices Commission (ICPC)' },
  { value: 'NIA', label: 'Nigeria Intelligence Agency (NIA)' },
];

const ENROLLMENT_TYPE_OPTIONS = [
  { value: 'Individual', label: 'Individual' },
  { value: 'Family', label: 'Family' },
  { value: 'Group', label: 'Group' },
];

const DEPENDENT_RELATIONSHIP_OPTIONS = [
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Son', label: 'Son' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Other', label: 'Other' },
];

const BLOOD_GROUP_OPTIONS = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

const OCCUPATION_OPTIONS = [
  'Trader',
  'Farmer',
  'Student',
  'Teacher',
  'Civil Servant',
  'Business Owner',
  'Artisan',
  'Healthcare Worker',
  'Driver',
  'Housewife',
  'Clergy',
  'Security Personnel',
  'Retired',
  'Unemployed',
  'Other',
];

const NOK_RELATIONSHIPS = [
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Son', label: 'Son' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Uncle', label: 'Uncle' },
  { value: 'Aunt', label: 'Aunt' },
  { value: 'Cousin', label: 'Cousin' },
  { value: 'Nephew', label: 'Nephew' },
  { value: 'Niece', label: 'Niece' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Other', label: 'Other' },
];

const PAYER_RELATIONSHIPS = [
  { value: 'Self', label: 'Self' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Child', label: 'Child' },
  { value: 'Dependent', label: 'Dependent' },
];

// NHIS Patient Source Options
const NHIS_PATIENT_SOURCE_OPTIONS = [
  {
    value: 'Internal',
    label: 'Internal Patient',
    description: 'Patient registered directly at this facility',
  },
  {
    value: 'Referral',
    label: 'Referral Patient',
    description: 'Patient referred from another facility',
  },
];

// Referral Status Options
const REFERRAL_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Used', label: 'Used' },
  { value: 'Cancelled', label: 'Cancelled' },
];

// =============================================================================
// Types
// =============================================================================

interface PatientFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePatientDTO | UpdatePatientDTO) => Promise<PatientDTO>;
  onCreateDependent?: (data: CreatePatientDTO) => Promise<PatientDTO>;
  patient?: PatientDTO | null;
  preset?: Partial<CreatePatientDTO>;
  onOpenDependentForPrincipal?: (principal: PatientDTO) => void;
  isLoading?: boolean;
}

// =============================================================================
// Initial State
// =============================================================================

const getInitialFormData = (
  patient?: PatientDTO | null,
  preset?: Partial<CreatePatientDTO>,
): CreatePatientDTO => ({
  first_name: patient?.first_name || '',
  middle_name: patient?.middle_name || '',
  surname: patient?.surname || '',
  gender: patient?.gender || ('' as Gender),
  date_of_birth: patient?.date_of_birth || '',
  nationality: patient?.nationality || 'Nigeria',
  state_of_origin: patient?.state_of_origin || '',
  lga: patient?.lga || '',
  contact_phone: patient?.contact_phone || '',
  email: patient?.email || '',
  residential_address: patient?.residential_address || '',
  nok_name: patient?.nok_name || '',
  nok_relationship: patient?.nok_relationship || '',
  nok_phone: patient?.nok_phone || '',
  nok_address: patient?.nok_address || '',
  blood_group: patient?.blood_group || '',
  known_allergies: patient?.known_allergies || [],
  payer_info: patient?.payer_info || {
    scheme: '',
    enrolee_id: '',
    relationship: 'Self',
    expiration_date: '',
  },
  // Deployment defaults for MUHEDA CLINIC: general civilian/self-pay patient.
  // Existing records keep their stored classification when edited.
  patient_category: isMilitaryFeatureEnabled()
    ? patient?.patient_category || 'Civilian'
    : 'Civilian',
  insurance_type:
    isMilitaryFeatureEnabled() || isNhisFeatureEnabled()
      ? ((patient?.insurance_type as InsuranceType) || 'Private')
      : 'Private',
  patient_type: patient?.patient_type || 'Private',
  principal_id: patient?.principal_id || '',
  relationship_to_principal: patient?.relationship_to_principal || '',
  // Military-specific fields - display / instead of - (stored as -)
  service_number: (patient?.service_number || '').replace(/-/g, '/'),
  rank: patient?.rank || '',
  military_branch: patient?.military_branch || undefined,
  unit: patient?.unit || patient?.military_info?.unit || '',
  // Civilian-specific fields
  occupation: patient?.occupation || patient?.civilian_info?.occupation || '',
  employer: patient?.employer || patient?.civilian_info?.employer || '',
  title: patient?.title || '', // Title / Designation for Civilian and Civilian Participant
  // Participant-specific fields
  course: patient?.course || '', // Course name for Participants
  // Security Services NHIS fields
  security_organization: (patient?.security_organization as any) || undefined,
  security_service_number: patient?.security_service_number || '',
  // NHIS & Referral fields
  nhis_number: patient?.nhis_number || '',
  national_id: patient?.national_id || '', // Preserve existing value; no UI field

  nhis_patient_source: patient?.nhis_patient_source || 'Internal',
  referral_code: patient?.referral_code || '',
  referring_facility_name: patient?.referring_facility_name || '',
  referring_facility_nhis_id: patient?.referring_facility_nhis_id || '',
  referral_date: patient?.referral_date || '',
  referral_reason: patient?.referral_reason || '',
  referral_status: patient?.referral_status || 'Active',
  referral_expiry_date: patient?.referral_expiry_date || '',
  clinical_summary: patient?.clinical_summary || '',
  // Legacy fields
  staff_category: patient?.staff_category || undefined,
  // Preset values apply only when creating a new patient
  ...(patient ? {} : preset || {}),
});

type AgeUnit = 'years' | 'months';
interface EstimatedAgeInput {
  value: string;
  unit: AgeUnit;
}

function getEstimatedAgeFromDob(
  dateOfBirth?: string | null,
): EstimatedAgeInput {
  const detailed = calculateDetailedAge(dateOfBirth);
  if (!detailed) return { value: '', unit: 'years' };

  if (detailed.years >= 2) {
    return { value: String(detailed.years), unit: 'years' };
  }

  return {
    value: String(detailed.years * 12 + detailed.months),
    unit: 'months',
  };
}

function calculateDobFromEstimatedAge(
  value: string,
  unit: AgeUnit,
): string {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount) || amount < 0) return '';

  const date = new Date();
  date.setHours(12, 0, 0, 0);
  if (unit === 'months') {
    date.setMonth(date.getMonth() - Math.floor(amount));
  } else {
    date.setFullYear(date.getFullYear() - Math.floor(amount));
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =============================================================================
// Component
// =============================================================================

export default function PatientForm({
  isOpen,
  onClose,
  onSubmit,
  onCreateDependent,
  patient,
  preset,
  onOpenDependentForPrincipal,
  isLoading = false,
}: PatientFormProps) {
  const { staff } = useAuth();
  // MUHEDA registration no longer collects payer, course or classification
  // data, so these legacy queries remain disabled.
  const { data: payerSchemes = [] } = usePayerSchemes(false);
  const { data: activeCourses = [], isLoading: coursesLoading } =
    useActiveCourses(false);
  const createCourseMutation = useCreateCourse();
  const { data: nextCourseNumber } = useNextCourseNumber(false);
  const [formData, setFormData] = useState<CreatePatientDTO>(
    getInitialFormData(patient, preset),
  );
  const [estimatedAge, setEstimatedAge] = useState<EstimatedAgeInput>(() =>
    getEstimatedAgeFromDob(patient?.date_of_birth || preset?.date_of_birth),
  );
  const [noKnownAllergies, setNoKnownAllergies] = useState(false);
  const [allergyEntries, setAllergyEntries] = useState<PatientAllergyInput[]>(
    [],
  );
  const [allergyDraft, setAllergyDraft] = useState<PatientAllergyInput>({
    allergen: '',
    reaction: '',
    severity: 'Moderate',
    notes: '',
  });
  const [allergyError, setAllergyError] = useState<string | null>(null);
  const { data: structuredAllergies } = usePatientAllergies(patient?.id);
  const { data: allergyReview } = usePatientAllergyReview(patient?.id);
  const savePatientAllergies = useSavePatientAllergies();
  // Manual Principal Entry State
  const [manualPrincipal, setManualPrincipal] = useState(false);
  const [errors, setErrors] = useState<PatientFormErrors>({});
  const [allergiesInput, setAllergiesInput] = useState('');
  const [principalSearch, setPrincipalSearch] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const { showToast } = useToast();
  const [isSavingAndAddingDependent, setIsSavingAndAddingDependent] =
    useState(false);
  // Personnel category for military ranks (Officer, Soldier, Rating, Airman)
  const [personnelCategory, setPersonnelCategory] = useState<string>(
    patient?.rank
      ? inferPersonnelCategory(patient.military_branch || '', patient.rank)
      : '',
  );
  const [showDependentEntry, setShowDependentEntry] = useState(false);
  const [pendingDependents, setPendingDependents] = useState<
    Array<{
      first_name: string;
      surname: string;
      gender: Gender | '';
      date_of_birth: string;
      relationship_to_principal: string;
    }>
  >([]);
  const [currentDependentData, setCurrentDependentData] = useState({
    first_name: '',
    surname: '',
    gender: '' as Gender | '',
    date_of_birth: '',
    relationship_to_principal: '',
  });
  const [dependentEntryError, setDependentEntryError] = useState<string | null>(
    null,
  );

  // Expansion state for fullscreen modal

  // Course management state
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [newCourseYear, setNewCourseYear] = useState(
    new Date().getFullYear() + 1,
  );

  // Photo upload state
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    patient?.photo_url || null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle photo upload
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      // Create preview and convert to base64 for storage
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setPhotoPreview(base64);
        setFormData((prev) => ({ ...prev, photo_url: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setFormData((prev) => ({ ...prev, photo_url: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle adding a new course
  const handleAddCourse = async () => {
    if (!nextCourseNumber) return;
    try {
      const newCourse = await createCourseMutation.mutateAsync({
        course_name: `Course ${nextCourseNumber}`,
        course_number: nextCourseNumber,
        year: newCourseYear,
        is_active: true,
      });
      // Auto-select the newly created course
      setFormData((prev) => ({ ...prev, course: newCourse.course_name }));
      setShowAddCourseModal(false);
      setNewCourseYear(new Date().getFullYear() + 1);
    } catch (error) {
      console.error('Failed to create course:', error);
    }
  };

  // MUHEDA CLINIC registration is intentionally limited to two sections.
  const steps = [
    {
      id: 'personal',
      title: 'Personal',
      icon: User,
      description: 'Basic details',
    },
    {
      id: 'contact',
      title: 'Contact',
      icon: Phone,
      description: 'Address & next of kin',
    },
  ];

  // Dependent/principal registration is not part of MUHEDA's workflow.
  const { data: principalSearchResults } = usePatients(
    {
      query: principalSearch,
      limit: 5,
      patient_type: 'Principal',
    },
    false,
  );

  const isEditing = !!patient;
  const isMilitary = formData.patient_category === 'Military';
  const isCivilian = formData.patient_category === 'Civilian';
  const isMilitaryParticipant =
    formData.patient_category === 'Military Participant';
  const isCivilianParticipant =
    formData.patient_category === 'Civilian Participant';
  const isDependent = formData.patient_type === 'Dependent';
  const isPrincipal = formData.patient_type === 'Principal';

  const canManageDependents =
    staff?.role === 'admin' ||
    staff?.role === 'super_admin' ||
    staff?.role === 'receptionist' ||
    staff?.role === 'customer_service';
  const isDependentModeLocked =
    !isEditing && preset?.patient_type === 'Dependent';

  const { data: selectedPrincipal } = usePatient(formData.principal_id || '');

  // Fetch existing dependents when editing a principal patient
  const { data: existingDependents } = useDependentsByPrincipal(
    isEditing && isPrincipal && patient?.id ? patient.id : null,
  );

  // Reset form when opening / switching mode
  useEffect(() => {
    if (!isOpen) return;
    setFormData(getInitialFormData(patient, preset));
    setEstimatedAge(
      getEstimatedAgeFromDob(
        patient?.date_of_birth || preset?.date_of_birth,
      ),
    );
    setAllergiesInput(patient?.known_allergies?.join(', ') || '');
    setNoKnownAllergies(false);
    setAllergyEntries([]);
    setAllergyDraft({
      allergen: '',
      reaction: '',
      severity: 'Moderate',
      notes: '',
    });
    setAllergyError(null);
    setPrincipalSearch('');
    setErrors({});
    setCurrentStep(0);
    // Reset dependent entry state
    setPendingDependents([]);
    setShowDependentEntry(false);
    setCurrentDependentData({
      first_name: '',
      surname: '',
      gender: '',
      date_of_birth: '',
      relationship_to_principal: '',
    });
  }, [patient, preset, isOpen]);

  // Load structured allergy records once for an existing patient.
  useEffect(() => {
    if (!isOpen) return;

    setNoKnownAllergies(Boolean(allergyReview?.no_known_allergies));

    const rows = structuredAllergies ?? [];
    const entries: PatientAllergyInput[] =
      rows.length > 0
        ? rows.map((entry) => ({
            allergen: entry.allergen,
            reaction: entry.reaction || '',
            severity: entry.severity,
            notes: entry.notes || '',
          }))
        : (patient?.known_allergies || [])
            .filter(Boolean)
            .map((allergen) => ({
              allergen,
              reaction: '',
              severity: 'Moderate' as AllergySeverity,
              notes: 'Imported from existing allergy record',
            }));

    setAllergyEntries(entries);
    setAllergyError(null);
  }, [isOpen, patient?.id, structuredAllergies, allergyReview]);

  // Inherit category/insurance AND address/contact from principal when registering a dependent
  useEffect(() => {
    if (!isDependent) return;
    if (!selectedPrincipal) return;

    setFormData((prev) => ({
      ...prev,
      // Insurance/category - always inherited
      patient_category:
        (selectedPrincipal.patient_category as any) || prev.patient_category,
      insurance_type:
        (selectedPrincipal.insurance_type as any) || prev.insurance_type,
      // Address/contact fields - inherited but editable (only if not already set)
      state_of_origin:
        prev.state_of_origin || selectedPrincipal.state_of_origin || '',
      lga: prev.lga || selectedPrincipal.lga || '',
      residential_address:
        prev.residential_address || selectedPrincipal.residential_address || '',
      contact_phone:
        prev.contact_phone || selectedPrincipal.contact_phone || '',
      nationality:
        prev.nationality || selectedPrincipal.nationality || 'Nigeria',
      // Inherit surname by default for dependents (common family name)
      surname: prev.surname || selectedPrincipal.surname || '',
      payer_info: {
        ...(prev.payer_info || {
          scheme: '',
          enrolee_id: '',
          relationship: 'Dependent',
          expiration_date: '',
        }),
        relationship: 'Dependent',
        // Inherit scheme from principal
        scheme:
          selectedPrincipal.payer_info?.scheme || prev.payer_info?.scheme || '',
      },
    }));
  }, [isDependent, selectedPrincipal]);

  // Clear dependent fields if patient type changes away from Dependent
  useEffect(() => {
    if (isDependent) return;
    setFormData((prev) => ({
      ...prev,
      principal_id: undefined,
      relationship_to_principal: undefined,
    }));
  }, [isDependent]);

  // Auto-set DHML as default scheme for military patients
  useEffect(() => {
    if (isMilitaryFeatureEnabled() && isMilitary) {
      setFormData((prev) => ({
        ...prev,
        insurance_type: 'Military_NHIS',
        payer_info: {
          ...prev.payer_info,
          scheme: 'Defence Health Maintenance Limited', // Default HMO
          enrolee_id: prev.payer_info?.enrolee_id || '',
          relationship: prev.payer_info?.relationship || 'Principal',
          expiration_date: prev.payer_info?.expiration_date || '',
        },
      }));
    }
  }, [isMilitary]);

  // GIFSHIP Expiration Logic & Enrollment Defaults
  useEffect(() => {
    if (formData.insurance_type === 'GIFSHIP') {
      // Set expiration to 1 year from now if not set or is invalid
      const now = new Date();
      const oneYearFromNow = new Date(now.setFullYear(now.getFullYear() + 1))
        .toISOString()
        .split('T')[0];

      setFormData((prev) => ({
        ...prev,
        payer_info: {
          ...prev.payer_info,
          scheme: prev.payer_info?.scheme || '',
          enrolee_id: prev.payer_info?.enrolee_id || '',
          relationship: prev.payer_info?.relationship || 'Principal',
          // Only set if not already set, or force update if needed (user requirement: "USUALLY EXPIRES AFTER ONE YEAR")
          // We set strictly 1 year from today for new entries
          expiration_date: prev.payer_info?.expiration_date || oneYearFromNow,
        },
      }));
    }
  }, [formData.insurance_type]);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;

    // Clear LGA when state changes
    if (name === 'state_of_origin') {
      setFormData((prev) => ({ ...prev, [name]: value, lga: '' }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error for this field
    if (errors[name as keyof PatientFormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    // Auto-capitalize names on blur
    const nameFields = ['first_name', 'surname', 'middle_name', 'nok_name'];

    if (nameFields.includes(name)) {
      setFormData((prev) => ({
        ...prev,
        [name]: capitalizePatientName(value),
      }));
    }
  };

  // Handle payer info changes
  const handlePayerChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    const field = name.split('.')[1]; // payer_info.scheme -> scheme
    setFormData((prev) => ({
      ...prev,
      payer_info: {
        ...prev.payer_info!,
        [field]: value,
      },
    }));
  };

  const buildSubmitData = (
    overrides?: Partial<CreatePatientDTO>,
  ): CreatePatientDTO => {
    const allergies = allergiesInput
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    return {
      ...formData,
      ...(overrides || {}),
      known_allergies: allergies.length > 0 ? allergies : undefined,
      // Convert empty strings to undefined for optional fields
      date_of_birth: formData.date_of_birth || undefined,
      blood_group: formData.blood_group || undefined,
      patient_category: formData.patient_category || 'Civilian',
      insurance_type:
        !isNhisFeatureEnabled() && isNhisCategory(formData.insurance_type)
          ? 'Private'
          : formData.insurance_type || 'Private',
      patient_type: (overrides?.patient_type ||
        formData.patient_type ||
        'Private') as any,

      // Map to legacy fields for backward compatibility
      staff_category:
        (formData.patient_category as StaffCategory) || 'Civilian',
      military_branch: isMilitary ? formData.military_branch : undefined,

      // Map NHIS numbers based on category
      nhis_number: isNhisFeatureEnabled()
        ? formData.nhis_number || undefined
        : undefined,

      // Clear military fields if not military
      service_number: isMilitary
        ? (formData.service_number || '').replace(/\//g, '-')
        : undefined,
      rank: isMilitary ? formData.rank : undefined,
      unit: isMilitary ? formData.unit : undefined,

      // Occupation is a core registration field for this deployment.
      occupation: formData.occupation || undefined,
      employer: formData.employer || undefined,

      // Clear dependent fields if not dependent
      principal_id: isDependent ? formData.principal_id : undefined,
      relationship_to_principal: isDependent
        ? formData.relationship_to_principal
        : undefined,

      // NHIS and referral fields
      nhis_patient_source: isNhisFeatureEnabled()
        ? formData.nhis_patient_source || 'Internal'
        : 'Internal',

      // Clear referral fields if not a referral patient
      referral_code:
        isNhisFeatureEnabled() && formData.nhis_patient_source === 'Referral'
          ? formData.referral_code
          : undefined,
      referring_facility_name:
        isNhisFeatureEnabled() && formData.nhis_patient_source === 'Referral'
          ? formData.referring_facility_name
          : undefined,
      referring_facility_nhis_id:
        isNhisFeatureEnabled() && formData.nhis_patient_source === 'Referral'
          ? formData.referring_facility_nhis_id
          : undefined,
      referral_date:
        isNhisFeatureEnabled() && formData.nhis_patient_source === 'Referral'
          ? formData.referral_date
          : undefined,
      referral_reason:
        isNhisFeatureEnabled() && formData.nhis_patient_source === 'Referral'
          ? formData.referral_reason
          : undefined,
      referral_status:
        isNhisFeatureEnabled() && formData.nhis_patient_source === 'Referral'
          ? formData.referral_status
          : undefined,
      referral_expiry_date:
        isNhisFeatureEnabled() && formData.nhis_patient_source === 'Referral'
          ? formData.referral_expiry_date
          : undefined,
      clinical_summary:
        isNhisFeatureEnabled() && formData.nhis_patient_source === 'Referral'
          ? formData.clinical_summary
          : undefined,
    };
  };

  const persistAllergies = async (savedPatient?: PatientDTO | null) => {
    if (!savedPatient?.id) return;
    try {
      await savePatientAllergies.mutateAsync({
        patientId: savedPatient.id,
        noKnownAllergies,
        entries: allergyEntries,
        recordedBy: staff?.id || null,
      });
    } catch (error) {
      console.error('Failed to save patient allergies:', error);
      showToast({
        type: 'error',
        title: 'Allergies not saved',
        message:
          'The patient record was saved, but allergy details could not be stored. Please edit the patient and try again.',
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    console.log('[PatientForm] Submit triggered, formData:', formData);

    // Validate form
    const validationErrors = validatePatientForm(formData);
    // If Manual Principal Entry is active, ignore the missing principal_id error
    if (manualPrincipal && validationErrors.principal_id) {
      delete validationErrors.principal_id;
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      // All remaining validated fields belong to the Personal section.
      const errorKeys = Object.keys(validationErrors);
      setCurrentStep(0);

      // Build a user-friendly message listing the missing fields
      const fieldLabels: Record<string, string> = {
        first_name: 'First Name',
        surname: 'Surname',
        gender: 'Sex',
        date_of_birth: 'Date of Birth',
        email: 'Email Address',
        contact_phone: 'Phone Number',
      };

      const missingLabels = errorKeys.map(
        (k) => fieldLabels[k] || k.replace(/_/g, ' '),
      );

      showToast({
        type: 'error',
        title: 'Required Fields Missing',
        message: `Please fill in: ${missingLabels.join(', ')}`,
        duration: 7000,
      });
      return;
    }

    const submitData = buildSubmitData();
    console.log('[PatientForm] Submit data:', submitData);

    const needsDependentChain =
      pendingDependents.length > 0 &&
      !!onCreateDependent &&
      (!isEditing || patient?.patient_type === 'Principal');

    if (!needsDependentChain) {
      const payload =
        isEditing && patient
          ? ({
              ...submitData,
              patient_id: patient.patient_id,
            } as UpdatePatientDTO)
          : submitData;

      // Instant close for fast UX; write continues in background with rollback handling.
      onClose();
      void onSubmit(payload)
        .then((saved) => persistAllergies(saved))
        .catch((error) => {
          console.error('Failed to save patient:', error);
        });
      return;
    }

    try {
      if (isEditing && patient) {
        const updatedPatient = await onSubmit({
          ...submitData,
          patient_id: patient.patient_id,
        } as UpdatePatientDTO);
        await persistAllergies(updatedPatient);

        // If editing a principal and there are pending dependents, create them
        if (
          pendingDependents.length > 0 &&
          onCreateDependent &&
          patient.patient_type === 'Principal'
        ) {
          await Promise.all(
            pendingDependents.map((dep) => {
              const dependentData: CreatePatientDTO = {
                // Required unique fields for dependent
                first_name: dep.first_name,
                surname: dep.surname || formData.surname,
                gender: dep.gender as Gender,
                date_of_birth: dep.date_of_birth || undefined,
                // Patient type and linkage - use UUID (id) not patient_id
                patient_type: 'Dependent',
                principal_id: patient.id,
                relationship_to_principal: dep.relationship_to_principal,
                // Inherited from principal
                patient_category: formData.patient_category,
                insurance_type: formData.insurance_type,
                nationality: formData.nationality || 'Nigeria',
                state_of_origin: formData.state_of_origin || undefined,
                lga: formData.lga || undefined,
                residential_address: formData.residential_address || undefined,
                contact_phone: formData.contact_phone || undefined,
                payer_info: {
                  scheme: formData.payer_info?.scheme || '',
                  enrolee_id: '',
                  relationship: 'Dependent',
                  expiration_date: formData.payer_info?.expiration_date || '',
                },
              };
              return onCreateDependent(dependentData);
            }),
          );
        }
      } else {
        // Create principal patient first
        const createdPrincipal = await onSubmit(submitData);
        await persistAllergies(createdPrincipal);

        // If there are pending dependents and we can create them, do so in parallel
        if (
          pendingDependents.length > 0 &&
          onCreateDependent &&
          createdPrincipal
        ) {
          await Promise.all(
            pendingDependents.map((dep) => {
              const dependentData: CreatePatientDTO = {
                // Required unique fields for dependent
                first_name: dep.first_name,
                surname: dep.surname || formData.surname, // Inherit surname if not provided
                gender: dep.gender as Gender,
                date_of_birth: dep.date_of_birth || undefined,
                // Patient type and linkage - use UUID (id) not patient_id
                patient_type: 'Dependent',
                principal_id: createdPrincipal.id,
                relationship_to_principal: dep.relationship_to_principal,
                // Inherited from principal
                patient_category: formData.patient_category,
                insurance_type: formData.insurance_type,
                nationality: formData.nationality || 'Nigeria',
                state_of_origin: formData.state_of_origin || undefined,
                lga: formData.lga || undefined,
                residential_address: formData.residential_address || undefined,
                contact_phone: formData.contact_phone || undefined,
                payer_info: {
                  scheme: formData.payer_info?.scheme || '',
                  enrolee_id: '',
                  relationship: 'Dependent',
                  expiration_date: formData.payer_info?.expiration_date || '',
                },
              };
              return onCreateDependent(dependentData);
            }),
          );
        }
      }

      // Reset dependents state
      setPendingDependents([]);
      setShowDependentEntry(false);
      onClose();
    } catch (error) {
      console.error('Failed to save patient:', error);
    }
  };

  const handleSaveAndAddDependent = async () => {
    if (isEditing) return;
    if (!canManageDependents) return;
    if (formData.patient_type !== 'Principal') return;

    // Validate principal data only
    const validationErrors = validatePatientForm({
      ...formData,
      patient_type: 'Principal',
      principal_id: undefined,
      relationship_to_principal: undefined,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSavingAndAddingDependent(true);
    try {
      const principalPayload = buildSubmitData({
        patient_type: 'Principal',
        principal_id: undefined,
        relationship_to_principal: undefined,
      });

      const createdPrincipal = await onSubmit(principalPayload);
      await persistAllergies(createdPrincipal);
      if (onOpenDependentForPrincipal) {
        onOpenDependentForPrincipal(createdPrincipal);
      }
    } finally {
      setIsSavingAndAddingDependent(false);
    }
  };

  const showDependentFields = isDependent;
  // Show military fields for Military and Military Participant (not dependents)
  const showMilitaryFields =
    isMilitaryFeatureEnabled() && (isMilitary || isMilitaryParticipant) && !isDependent;
  // Show civilian fields for Civilian and Civilian Participant (not dependents)
  const showCivilianFields =
    (isCivilian || isCivilianParticipant) && !isDependent;
  // Show course field for participants only
  const showCourseField =
    (isMilitaryParticipant || isCivilianParticipant) && !isDependent;
  // Show title/rank for Civilian and Civilian Participant
  const showCivilianTitle =
    (isCivilian || isCivilianParticipant) && !isDependent;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (index: number) => {
    setCurrentStep(index);
  };

  const handleEstimatedAgeChange = (
    value: string,
    unit: AgeUnit = estimatedAge.unit,
  ) => {
    setEstimatedAge({ value, unit });
    setFormData((prev) => ({
      ...prev,
      date_of_birth: calculateDobFromEstimatedAge(value, unit),
    }));
    if (errors.date_of_birth) {
      setErrors((prev) => {
        const { date_of_birth: _dateOfBirth, ...rest } = prev;
        return rest;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop with blur effect */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />

      {/* Modal Container - Full height with smooth entrance */}
      <div className="fixed inset-0 flex items-center justify-center p-0 transition-all duration-300 min-[480px]:p-3 sm:p-4 md:p-6">
        <div
          className="relative flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none border border-slate-200 bg-white transition-all duration-300 min-[480px]:max-h-[min(100dvh,56rem)] min-[480px]:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <h1 className="font-display truncate text-lg font-bold text-slate-900">
                {isEditing ? 'Edit patient' : 'New patient'}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {isEditing
                  ? 'Update demographics and contact details'
                  : 'Demographics, contact and next of kin'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content */}
          <form
            id="patient-form"
            onSubmit={handleSubmit}
            className="min-h-0 flex-1 overflow-y-auto bg-[#F7F6F3]"
          >
            <div className="p-4 sm:p-5">
              {/* Step 1: Personal Information */}
              {(<div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_16px_-4px_rgba(15,80,72,0.08)] overflow-hidden">
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1EAE4]">
                        <User className="h-4 w-4 text-[#B36845]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                          Personal information
                        </h3>
                      </div>
                    </div>

                    {/* Section Content */}
                    <div className="p-5">
                      {/* Profile Photo Upload - Admin only */}
                      {(staff?.role === 'admin' ||
                        staff?.role === 'super_admin' ||
                        staff?.role === 'receptionist') && (
                        <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                          {photoPreview ? (
                            <img
                              src={photoPreview}
                              alt="Patient"
                              className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
                              <Camera className="h-5 w-5" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                              id="photo-upload"
                            />
                            <label
                              htmlFor="photo-upload"
                              className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#B36845] hover:underline"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              {photoPreview ? 'Change photo' : 'Add photo'}
                            </label>
                            <p className="text-[11px] text-slate-400">
                              Optional · JPG, PNG or GIF, max 5MB
                            </p>
                          </div>
                          {photoPreview && (
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Surname */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Surname <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              name="surname"
                              value={formData.surname}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className={`w-full pl-4 pr-10 py-3 border-2 rounded-xl transition-all duration-200 text-sm focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 ${errors.surname ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 focus:bg-white'}`}
                              placeholder="Enter surname"
                            />
                          </div>
                          {errors.surname && (
                            <p className="text-xs text-red-600 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />{' '}
                              {errors.surname}
                            </p>
                          )}
                        </div>

                        {/* First Name */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              name="first_name"
                              value={formData.first_name}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className={`w-full pl-4 pr-10 py-3 border-2 rounded-xl transition-all duration-200 text-sm focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 ${errors.first_name ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 focus:bg-white'}`}
                              placeholder="Enter first name"
                            />
                          </div>
                          {errors.first_name && (
                            <p className="text-xs text-red-600 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />{' '}
                              {errors.first_name}
                            </p>
                          )}
                        </div>

                        {/* Middle Name */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Middle Name
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              name="middle_name"
                              value={formData.middle_name || ''}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all duration-200 text-sm bg-gray-50/50 focus:bg-white"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Gender, DOB */}
                      <div className="grid grid-cols-2 gap-5 mt-5">
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Gender <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="gender"
                            value={formData.gender || ''}
                            onChange={(event) =>
                              setFormData((prev) => ({
                                ...prev,
                                gender: event.target.value as Gender,
                              }))
                            }
                            className={`w-full rounded-xl border-2 px-4 py-3 text-sm outline-none transition-all focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20 ${errors.gender ? 'border-red-400 bg-red-50/50' : 'border-gray-200 bg-gray-50/50 focus:bg-white'}`}
                          >
                            <option value="">Select gender</option>
                            {GENDER_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Estimated Age
                            {formData.date_of_birth && (
                              <span className="ml-1 text-primary-700 font-bold text-xs">
                                ({formatDetailedAge(formData.date_of_birth)})
                              </span>
                            )}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={0}
                              max={estimatedAge.unit === 'months' ? 1800 : 150}
                              step={1}
                              inputMode="numeric"
                              name="estimated_age"
                              value={estimatedAge.value}
                              onChange={(event) =>
                                handleEstimatedAgeChange(event.target.value)
                              }
                              className="min-w-0 flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all duration-200 text-sm bg-gray-50/50 focus:bg-white"
                              placeholder={estimatedAge.unit === 'months' ? 'e.g. 18' : 'e.g. 34'}
                            />
                            <div className="flex rounded-xl border-2 border-gray-200 bg-gray-50 p-1">
                              {(['years', 'months'] as const).map((unit) => (
                                <button
                                  key={unit}
                                  type="button"
                                  onClick={() =>
                                    handleEstimatedAgeChange(
                                      estimatedAge.value,
                                      unit,
                                    )
                                  }
                                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                                    estimatedAge.unit === unit
                                      ? 'bg-primary-700 text-white shadow-sm'
                                      : 'text-gray-500 hover:text-gray-800'
                                  }`}
                                >
                                  {unit}
                                </button>
                              ))}
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Enter the estimated age; the system will derive an
                            approximate date of birth for clinical records.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                        {/* Phone Number */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Phone Number
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              name="contact_phone"
                              value={formData.contact_phone || ''}
                              onChange={handleChange}
                              maxLength={11}
                              className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all duration-200 text-sm bg-gray-50/50 focus:bg-white"
                              placeholder="Enter phone number"
                            />
                          </div>
                        </div>

                        {/* Email Address */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Email Address
                          </label>
                          <div className="relative">
                            <input
                              type="email"
                              name="email"
                              value={formData.email || ''}
                              onChange={handleChange}
                              className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all duration-200 text-sm bg-gray-50/50 focus:bg-white"
                              placeholder="Enter email address"
                            />
                          </div>
                          {errors.email && (
                            <p className="text-xs text-red-600 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> {errors.email}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                        {/* Occupation - searchable predefined options + manual entry */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Occupation
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              name="occupation"
                              list="occupation-options"
                              value={formData.occupation || ''}
                              onChange={handleChange}
                              className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all duration-200 text-sm bg-gray-50/50 focus:bg-white"
                              placeholder="Select or type occupation"
                            />
                          </div>
                          <datalist id="occupation-options">
                            {OCCUPATION_OPTIONS.map((occupation) => (
                              <option key={occupation} value={occupation} />
                            ))}
                          </datalist>
                        </div>

                        {/* Blood Group - retained for clinical safety */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Blood Group
                          </label>
                          <select
                            name="blood_group"
                            value={formData.blood_group || ''}
                            onChange={(event) =>
                              setFormData((prev) => ({
                                ...prev,
                                blood_group: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl border-2 border-gray-200 bg-gray-50/50 px-4 py-3 text-sm outline-none transition-all focus:border-primary-700 focus:bg-white focus:ring-2 focus:ring-primary-700/20"
                          >
                            <option value="">Select blood group</option>
                            {BLOOD_GROUP_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                              Allergies
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Record No Known Allergies or add specific allergies.
                            </p>
                          </div>
                          <label className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800">
                            <input
                              type="checkbox"
                              checked={noKnownAllergies}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setNoKnownAllergies(checked);
                                if (checked) {
                                  setAllergyEntries([]);
                                  setAllergyError(null);
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            No Known Allergies
                          </label>
                        </div>

                        {!noKnownAllergies && (
                          <div className="mt-4 space-y-3">
                            {allergyEntries.length > 0 && (
                              <div className="space-y-2">
                                {allergyEntries.map((entry, index) => (
                                  <div
                                    key={`${entry.allergen}-${index}`}
                                    className="flex flex-wrap items-center gap-2 rounded-lg border border-red-100 bg-white px-3 py-2"
                                  >
                                    <span className="text-sm font-semibold text-slate-900">
                                      {entry.allergen}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                        entry.severity === 'Life-threatening'
                                          ? 'bg-red-700 text-white'
                                          : entry.severity === 'Severe'
                                            ? 'bg-red-100 text-red-800'
                                            : entry.severity === 'Moderate'
                                              ? 'bg-orange-100 text-orange-800'
                                              : 'bg-yellow-100 text-yellow-800'
                                      }`}
                                    >
                                      {entry.severity}
                                    </span>
                                    {entry.reaction && (
                                      <span className="text-xs text-slate-500">
                                        Reaction: {entry.reaction}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAllergyEntries((prev) =>
                                          prev.filter((_, i) => i !== index),
                                        )
                                      }
                                      className="ml-auto rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                      title="Remove allergy"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                              <input
                                type="text"
                                value={allergyDraft.allergen}
                                onChange={(e) =>
                                  setAllergyDraft((prev) => ({
                                    ...prev,
                                    allergen: e.target.value,
                                  }))
                                }
                                placeholder="Allergen (e.g. penicillin)"
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm md:col-span-4"
                              />
                              <input
                                type="text"
                                value={allergyDraft.reaction || ''}
                                onChange={(e) =>
                                  setAllergyDraft((prev) => ({
                                    ...prev,
                                    reaction: e.target.value,
                                  }))
                                }
                                placeholder="Reaction"
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm md:col-span-3"
                              />
                              <select
                                value={allergyDraft.severity}
                                onChange={(e) =>
                                  setAllergyDraft((prev) => ({
                                    ...prev,
                                    severity: e.target.value as AllergySeverity,
                                  }))
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm md:col-span-2"
                              >
                                {ALLERGY_SEVERITIES.map((severity) => (
                                  <option key={severity} value={severity}>
                                    {severity}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={allergyDraft.notes || ''}
                                onChange={(e) =>
                                  setAllergyDraft((prev) => ({
                                    ...prev,
                                    notes: e.target.value,
                                  }))
                                }
                                placeholder="Notes (optional)"
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm md:col-span-2"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const allergen = allergyDraft.allergen.trim();
                                  if (!allergen) {
                                    setAllergyError('Enter an allergen first.');
                                    return;
                                  }
                                  if (
                                    allergyEntries.some(
                                      (entry) =>
                                        entry.allergen.toLowerCase() ===
                                        allergen.toLowerCase(),
                                    )
                                  ) {
                                    setAllergyError(
                                      'This allergen is already recorded.',
                                    );
                                    return;
                                  }
                                  setAllergyEntries((prev) => [
                                    ...prev,
                                    {
                                      ...allergyDraft,
                                      allergen,
                                      reaction:
                                        allergyDraft.reaction?.trim() || '',
                                      notes: allergyDraft.notes?.trim() || '',
                                    },
                                  ]);
                                  setAllergyDraft({
                                    allergen: '',
                                    reaction: '',
                                    severity: 'Moderate',
                                    notes: '',
                                  });
                                  setAllergyError(null);
                                }}
                                className="flex items-center justify-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 md:col-span-1"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add
                              </button>
                            </div>
                            {allergyError && (
                              <p className="text-xs text-red-600">
                                {allergyError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(<div className="space-y-5">
                  {/* Contact Information */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(15,80,72,0.08)] overflow-hidden">
                    {/* Section Header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                      <div className="w-9 h-9 bg-primary-700 rounded-xl flex items-center justify-center shadow-sm shadow-primary-700/25">
                        <Phone className="h-4 w-4 text-[#B36845]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                          Contact Information
                        </h3>
                      </div>
                    </div>

                    {/* Section Content */}
                    <div className="p-5">
                      <div className="grid grid-cols-1 gap-5">
                        {/* Residential Address */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Residential Address
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              name="residential_address"
                              value={formData.residential_address || ''}
                              onChange={handleChange}
                              className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all duration-200 text-sm bg-gray-50/50 focus:bg-white"
                              placeholder="Enter full residential address"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Next of Kin Divider */}
                      <div className="flex items-center gap-4 my-7">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                        <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider bg-gray-50/80 px-4 py-1.5 rounded-full border border-gray-100">
                          <Users className="h-3.5 w-3.5" />
                          Next of Kin
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {/* NOK Full Name */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            NOK Full Name
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              name="nok_name"
                              value={formData.nok_name || ''}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all duration-200 text-sm bg-gray-50/50 focus:bg-white"
                              placeholder="Enter next of kin name"
                            />
                          </div>
                        </div>

                        {/* Relationship */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            Relationship
                          </label>
                          <div className="relative">
                            <SearchableSelect
                              options={NOK_RELATIONSHIPS}
                              value={formData.nok_relationship || ''}
                              onChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  nok_relationship: value,
                                }))
                              }
                              placeholder="Select Relationship"
                              className="w-full border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all text-sm bg-gray-50/50 focus:bg-white"
                            />
                          </div>
                        </div>

                        {/* NOK Phone */}
                        <div className="space-y-2 group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 group-focus-within:text-primary-700 transition-colors">
                            NOK Phone
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              name="nok_phone"
                              value={formData.nok_phone || ''}
                              onChange={handleChange}
                              maxLength={11}
                              className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all duration-200 text-sm bg-gray-50/50 focus:bg-white"
                              placeholder="Enter NOK phone number"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Service & Classification (disabled for MUHEDA CLINIC) */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Service & Classification Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(15,80,72,0.08)] overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                      <div className="w-9 h-9 bg-primary-700 rounded-xl flex items-center justify-center shadow-sm shadow-primary-700/25">
                        <Shield className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                          Service & Classification
                        </h3>
                        <p className="text-xs text-gray-500">
                          Service branch, patient type, and insurance details
                        </p>
                      </div>
                    </div>

                    <div className="p-5 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Service Category */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-gray-400" />
                            Service Category{' '}
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <SearchableSelect
                              options={PATIENT_CATEGORY_OPTIONS.filter(
                                (opt) =>
                                  opt.value !== '' &&
                                  (isMilitaryFeatureEnabled() ||
                                    ![
                                      'Military',
                                      'Military Participant',
                                      'Security Services',
                                    ].includes(opt.value)),
                              )}
                              value={formData.patient_category || ''}
                              onChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  patient_category: value as PatientCategory,
                                }))
                              }
                              placeholder="Select Service Category"
                              className="w-full border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all text-sm bg-gray-50 focus:bg-white"
                            />
                          </div>
                        </div>

                        {/* Patient Type */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            Patient Type <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <SearchableSelect
                              options={PATIENT_TYPE_OPTIONS.filter(
                                (opt) => opt.value !== '',
                              )}
                              value={formData.patient_type || ''}
                              onChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  patient_type: value as PatientType,
                                }))
                              }
                              disabled={
                                isEditing &&
                                patient?.patient_type === 'Dependent'
                              }
                              placeholder="Select Patient Type"
                              className="w-full border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all text-sm bg-gray-50 focus:bg-white"
                            />
                          </div>
                          {isEditing &&
                            patient?.patient_type === 'Dependent' && (
                              <p className="text-xs text-amber-600 mt-1">
                                ⚠️ Cannot change type for existing dependent
                              </p>
                            )}
                        </div>
                      </div>

                      {/* Insurance moved to Main Card (if not Military) */}
                      {!showDependentFields && !isMilitary && (
                        <div className="pt-4 border-t border-gray-100">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-gray-400" />
                              Insurance Category
                            </label>
                            <div className="relative">
                              <SearchableSelect
                                options={INSURANCE_TYPE_OPTIONS.filter(
                                  (opt) =>
                                    opt.value !== '' &&
                                    (isNhisFeatureEnabled() ||
                                      !isNhisCategory(opt.value)),
                                )}
                                value={formData.insurance_type || ''}
                                onChange={(value) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    insurance_type: value as InsuranceType,
                                    // Clear security organization when insurance type changes
                                    security_organization:
                                      value === 'Security_Services_NHIS'
                                        ? prev.security_organization
                                        : undefined,
                                    security_service_number:
                                      value === 'Security_Services_NHIS'
                                        ? prev.security_service_number
                                        : '',
                                  }))
                                }
                                placeholder="Select Insurance Category"
                                className="w-full border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all text-sm bg-gray-50 focus:bg-white"
                              />
                            </div>
                          </div>

                          {/* Security Services NHIS - Organization Selection */}
                          {formData.insurance_type ===
                            'Security_Services_NHIS' && (
                            <div className="mt-4 space-y-4 p-5 bg-blue-50/80 rounded-2xl border border-blue-200/80 shadow-[0_2px_12px_-4px_rgba(30,100,200,0.08)]">
                              <div className="flex items-center gap-2.5 text-blue-800 mb-3">
                                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-600/25">
                                  <Shield className="h-4 w-4 text-white" />
                                </div>
                                <span className="font-semibold text-sm">
                                  Security Services Details
                                </span>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                  Security Organization{' '}
                                  <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <SearchableSelect
                                    options={SECURITY_ORGANIZATION_OPTIONS.filter(
                                      (opt) => opt.value !== '',
                                    )}
                                    value={formData.security_organization || ''}
                                    onChange={(value) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        security_organization: value as any,
                                      }))
                                    }
                                    placeholder="Select Organization"
                                    className="w-full border-2 border-blue-200 rounded-xl hover:border-blue-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-white"
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                  Force/Service Number
                                </label>
                                <input
                                  type="text"
                                  name="security_service_number"
                                  value={formData.security_service_number || ''}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      security_service_number:
                                        e.target.value.toUpperCase(),
                                    }))
                                  }
                                  placeholder="Enter Force/Service Number"
                                  className="w-full px-3 py-2.5 border-2 border-blue-200 rounded-xl hover:border-blue-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm bg-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Military Auto-Insurance Badge */}
                      {!showDependentFields && isMilitary && (
                        <div className="pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-primary-700/5 to-primary-600/5 border border-primary-700/15 rounded-2xl">
                            <div className="w-9 h-9 bg-primary-700 rounded-xl flex items-center justify-center shadow-sm shadow-primary-700/25">
                              <Shield className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-primary-700">
                                Military NHIS Active
                              </span>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Insurance is automatically assigned for military
                                personnel.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dependent Details Card */}
                  {showDependentFields && (
                    <div className="bg-amber-50/80 rounded-2xl border border-amber-200/80 shadow-[0_2px_16px_-4px_rgba(180,130,20,0.1)] overflow-hidden">
                      <div className="px-5 py-4 border-b border-amber-200/80 bg-gradient-to-r from-amber-100/60 to-amber-50/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-200 flex items-center justify-center text-amber-800 shadow-sm">
                            <Users className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-amber-900 text-sm">
                              Dependent Details
                            </h4>
                            <p className="text-xs text-amber-700">
                              Link to a principal or enter details manually
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-amber-200 shadow-sm">
                          <input
                            type="checkbox"
                            id="manualPrincipal"
                            checked={manualPrincipal}
                            onChange={(e) => {
                              setManualPrincipal(e.target.checked);
                              if (e.target.checked) {
                                setPrincipalSearch('');
                                setFormData((prev) => ({
                                  ...prev,
                                  principal_id: undefined,
                                }));
                              }
                            }}
                            className="rounded text-amber-600 focus:ring-amber-500 border-amber-300 h-4 w-4"
                          />
                          <label
                            htmlFor="manualPrincipal"
                            className="text-xs font-bold text-amber-800 cursor-pointer select-none uppercase tracking-wide"
                          >
                            Manual Principal (Unlinked)
                          </label>
                        </div>
                      </div>

                      <div className="p-5">
                        {manualPrincipal ? (
                          <div className="space-y-5 animate-fadeIn">
                            <div className="p-3 bg-yellow-100 border border-yellow-200 rounded-xl text-xs text-yellow-800 flex items-start gap-2 shadow-sm">
                              <Info className="h-4 w-4 shrink-0 mt-0.5" />
                              <p>
                                {formData.patient_category === 'Security Services'
                                  ? 'You are registering a dependent of a Security Services / Paramilitary principal who is not in the system. Enter the principal\'s details below for the record.'
                                  : formData.patient_category === 'Civilian' || formData.patient_category === 'Civilian Participant'
                                    ? 'You are registering a dependent of a Civilian NHIS enrollee who is not in the system. Enter the principal\'s details below for the record.'
                                    : 'You are registering a dependent of a Military personnel who is not in the system. Enter the principal\'s details below for the record.'}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5 p-3 bg-white rounded-xl border border-amber-100 shadow-sm">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                                  Principal&apos;s Name
                                </label>
                                <input
                                  type="text"
                                  placeholder={
                                    formData.patient_category === 'Security Services'
                                      ? "e.g. CSP Aminu Bello"
                                      : formData.patient_category === 'Civilian' || formData.patient_category === 'Civilian Participant'
                                        ? "e.g. Alhaji Musa Ibrahim"
                                        : "e.g. Gen. Musa Yar'adua"
                                  }
                                  className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-amber-500 bg-transparent text-sm focus:outline-none transition-colors"
                                  value={
                                    formData.payer_info?.principal_name || ''
                                  }
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      payer_info: {
                                        ...(prev.payer_info || ({} as any)),
                                        principal_name: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1.5 p-3 bg-white rounded-xl border border-amber-100 shadow-sm">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                                  Relationship
                                </label>
                                <SearchableSelect
                                  options={DEPENDENT_RELATIONSHIP_OPTIONS}
                                  value={
                                    formData.relationship_to_principal || ''
                                  }
                                  onChange={(value) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      relationship_to_principal: value,
                                    }))
                                  }
                                  placeholder="Select Relationship"
                                  className="w-full border-b-2 border-gray-200 focus:border-amber-500 bg-transparent text-sm transition-colors"
                                />
                              </div>
                              <div className="space-y-1.5 p-3 bg-white rounded-xl border border-amber-100 shadow-sm">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                                  {formData.patient_category === 'Security Services'
                                    ? "Principal's Title / Designation"
                                    : formData.patient_category === 'Civilian' || formData.patient_category === 'Civilian Participant'
                                      ? "Principal's Occupation"
                                      : "Principal's Title"}
                                </label>
                                <input
                                  type="text"
                                  placeholder={
                                    formData.patient_category === 'Security Services'
                                      ? "e.g. Chief Superintendent of Police"
                                      : formData.patient_category === 'Civilian' || formData.patient_category === 'Civilian Participant'
                                        ? "e.g. Civil Servant, Teacher"
                                        : "e.g. Major General"
                                  }
                                  className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-amber-500 bg-transparent text-sm focus:outline-none transition-colors"
                                  value={
                                    formData.payer_info?.principal_rank || ''
                                  }
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      payer_info: {
                                        ...((prev.payer_info as any) || {}),
                                        principal_rank: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1.5 p-3 bg-white rounded-xl border border-amber-100 shadow-sm">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                                  {formData.patient_category === 'Security Services'
                                    ? "Principal's Force No"
                                    : formData.patient_category === 'Civilian' || formData.patient_category === 'Civilian Participant'
                                      ? "Principal's NHIS / Enrollee ID"
                                      : "Principal's Service No"}
                                </label>
                                <input
                                  type="text"
                                  placeholder={
                                    formData.patient_category === 'Security Services'
                                      ? "e.g. AP/12345"
                                      : formData.patient_category === 'Civilian' || formData.patient_category === 'Civilian Participant'
                                        ? "e.g. NHF/2024/001234"
                                        : "e.g. N/12345"
                                  }
                                  className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-amber-500 bg-transparent text-sm focus:outline-none transition-colors"
                                  value={
                                    formData.payer_info
                                      ?.principal_service_number || ''
                                  }
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      payer_info: {
                                        ...((prev.payer_info as any) || {}),
                                        principal_service_number:
                                          e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-5 animate-fadeIn">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Search Principal
                              </label>
                              <SearchableSelect
                                label=""
                                options={
                                  principalSearchResults?.patients?.map(
                                    (p: PatientDTO) => ({
                                      value: p.id || '',
                                      label: `${p.first_name} ${p.surname} (${p.emr_number || 'No EMR'})`,
                                    }),
                                  ) || []
                                }
                                value={selectedPrincipal?.id || ''}
                                onChange={(val: string) => {
                                  const principal =
                                    principalSearchResults?.patients?.find(
                                      (p: PatientDTO) => p.id === val,
                                    );
                                  if (principal) {
                                    setFormData((prev) => ({
                                      ...prev,
                                      principal_id: principal.id || '',
                                      surname: principal.surname,
                                      insurance_type:
                                        (principal.insurance_type as InsuranceType) ||
                                        undefined,
                                      residential_address:
                                        principal.residential_address ||
                                        undefined,
                                      state_of_origin:
                                        principal.state_of_origin || undefined,
                                      lga: principal.lga || undefined,
                                      nationality:
                                        principal.nationality || undefined,
                                      patient_category:
                                        principal.patient_category || undefined,
                                    }));
                                  }
                                }}
                                placeholder="Search by name, rank, or patient number..."
                                onSearch={(q: string) => setPrincipalSearch(q)}
                              />
                              <p className="text-xs text-gray-500">
                                Type at least 2 characters to search for a
                                principal to link.
                              </p>
                            </div>

                            {selectedPrincipal && (
                              <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-start gap-4">
                                <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 font-bold shrink-0">
                                  <BadgeCheck className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">
                                    Linked to: {selectedPrincipal.first_name}{' '}
                                    {selectedPrincipal.surname}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {selectedPrincipal.rank}{' '}
                                    {selectedPrincipal.service_number
                                      ? `• ${selectedPrincipal.service_number}`
                                      : ''}
                                  </p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {selectedPrincipal.insurance_type && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        Insurance:{' '}
                                        {selectedPrincipal.insurance_type}
                                      </span>
                                    )}
                                    {selectedPrincipal.state_of_origin && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                        {selectedPrincipal.state_of_origin}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-600 uppercase">
                                  Relationship to Principal *
                                </label>
                                <SearchableSelect
                                  options={DEPENDENT_RELATIONSHIP_OPTIONS}
                                  value={
                                    formData.relationship_to_principal || ''
                                  }
                                  onChange={(value) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      relationship_to_principal: value,
                                    }))
                                  }
                                  placeholder="Select relationship"
                                  className="w-full border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all text-sm bg-white"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-600 uppercase">
                                  Contact Phone
                                </label>
                                <input
                                  type="tel"
                                  name="contact_phone"
                                  value={formData.contact_phone || ''}
                                  onChange={handleChange}
                                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-all text-sm"
                                  placeholder="e.g. 08012345678"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Military Fields */}
                  {showMilitaryFields && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(15,80,72,0.08)] overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-700 rounded-xl flex items-center justify-center shadow-sm shadow-primary-700/25">
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {isMilitaryParticipant
                            ? 'Military Participant Details'
                            : 'Military Details'}
                        </h4>
                      </div>
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Service Number *
                          </label>
                          <input
                            type="text"
                            name="service_number"
                            value={formData.service_number || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm"
                            placeholder="e.g., N/12345"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Arm of Service *
                          </label>
                          <SearchableSelect
                            options={MILITARY_ARM_OPTIONS}
                            value={formData.military_branch || ''}
                            onChange={(value) => {
                              // Synthetic event to trigger handleChange logic
                              handleChange({
                                target: { name: 'military_branch', value },
                              } as any);
                              // Reset personnel category and rank when service changes
                              setPersonnelCategory('');
                              setFormData((prev) => ({ ...prev, rank: '' }));
                            }}
                            placeholder="Select arm"
                            className="w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Personnel Category *
                          </label>
                          <SearchableSelect
                            options={
                              formData.military_branch
                                ? PERSONNEL_CATEGORY_OPTIONS[
                                    formData.military_branch
                                  ] || []
                                : []
                            }
                            value={personnelCategory}
                            onChange={(value) => {
                              setPersonnelCategory(value);
                              // Reset rank when category changes
                              setFormData((prev) => ({ ...prev, rank: '' }));
                            }}
                            disabled={!formData.military_branch}
                            placeholder="Select category"
                            className="w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Rank *
                          </label>
                          <SearchableSelect
                            options={getRankOptions(
                              formData.military_branch,
                              personnelCategory,
                            )}
                            value={formData.rank || ''}
                            onChange={(value) =>
                              setFormData((prev) => ({ ...prev, rank: value }))
                            }
                            disabled={!personnelCategory}
                            placeholder="Select rank"
                            className="w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Unit
                          </label>
                          <input
                            type="text"
                            name="unit"
                            value={formData.unit || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm"
                            placeholder="e.g., 1 Division"
                          />
                        </div>
                        {/* Course field for Military Participant */}
                        {isMilitaryParticipant && (
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Course *
                            </label>
                            <div className="flex gap-2">
                              <SearchableSelect
                                options={activeCourses.map((course) => ({
                                  value: course.course_name,
                                  label: `${course.course_name} (${course.year})`,
                                }))}
                                value={formData.course || ''}
                                onChange={(value) => {
                                  handleChange({
                                    target: { name: 'course', value },
                                  } as any);
                                }}
                                disabled={coursesLoading}
                                placeholder="Select Course"
                                className="flex-1 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowAddCourseModal(true)}
                                className="px-3 py-2.5 bg-primary-700 text-white rounded-xl hover:bg-primary-800 text-sm flex items-center gap-1"
                                title="Add New Course"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Civilian Fields */}
                  {showCivilianFields && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(15,80,72,0.08)] overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-600/25">
                          <Briefcase className="h-4 w-4 text-white" />
                        </div>
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {isCivilianParticipant
                            ? 'Participant Details'
                            : 'Employment Details'}
                        </h4>
                      </div>
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Title / Designation for Civilian and Civilian Participant */}
                        {showCivilianTitle && (
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Title / Designation
                            </label>
                            <input
                              type="text"
                              name="title"
                              value={formData.title || ''}
                              onChange={handleChange}
                              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 hover:border-gray-300 text-sm"
                              placeholder="e.g., Dr., Prof., Engr., Chief"
                            />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Occupation
                          </label>
                          <input
                            type="text"
                            name="occupation"
                            value={formData.occupation || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 hover:border-gray-300 text-sm"
                            placeholder="e.g., Engineer"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Employer
                          </label>
                          <input
                            type="text"
                            name="employer"
                            value={formData.employer || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 hover:border-gray-300 text-sm"
                            placeholder="Company name"
                          />
                        </div>
                        {/* Course field for Civilian Participant */}
                        {isCivilianParticipant && (
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Course *
                            </label>
                            <div className="flex gap-2">
                              <SearchableSelect
                                options={activeCourses.map((course) => ({
                                  value: course.course_name,
                                  label: `${course.course_name} (${course.year})`,
                                }))}
                                value={formData.course || ''}
                                onChange={(value) => {
                                  handleChange({
                                    target: { name: 'course', value },
                                  } as any);
                                }}
                                disabled={coursesLoading}
                                placeholder="Select Course"
                                className="flex-1 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 hover:border-gray-300 text-sm bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowAddCourseModal(true)}
                                className="px-3 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm flex items-center gap-1"
                                title="Add New Course"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* NHIS Information Section */}
                  {(formData.insurance_type === 'Civilian_NHIS' ||
                    formData.insurance_type === 'Military_NHIS' ||
                    formData.insurance_type === 'GIFSHIP') && (
                    <div className="mt-5 p-5 bg-teal-50/80 rounded-2xl border border-teal-200/80 shadow-[0_2px_12px_-4px_rgba(20,120,100,0.08)]">
                      <h4 className="font-semibold text-teal-800 mb-4 flex items-center gap-2.5 text-sm">
                        <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center shadow-sm shadow-teal-600/25">
                          <BadgeCheck className="h-4 w-4 text-white" />
                        </div>
                        NHIS Information
                      </h4>

                      {/* GIFSHIP Enrollment Type */}
                      {formData.insurance_type === 'GIFSHIP' && (
                        <div className="mb-5 bg-white p-3 rounded-xl border border-teal-100 shadow-sm">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                            Enrollment Type{' '}
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <SearchableSelect
                              options={ENROLLMENT_TYPE_OPTIONS}
                              value={formData.enrollment_type || ''}
                              onChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  enrollment_type: value as any,
                                }))
                              }
                              placeholder="Select Enrollment Type"
                              className="w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-teal-600 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {/* HMO Selection - Merged from old Step 4 */}
                      <div className="mb-5 bg-white p-3 rounded-xl border border-teal-100 shadow-sm">
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                          HMO / Payer{' '}
                          {isMilitary && (
                            <span className="text-green-600 normal-case font-normal">
                              (Military NHIS)
                            </span>
                          )}{' '}
                          <span className="text-red-500">*</span>
                        </label>
                        {isMilitary ? (
                          <div className="w-full px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 font-medium flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Defence Health Maintenance Limited
                          </div>
                        ) : (
                          <SearchableSelect
                            options={payerSchemes.map((scheme) => ({
                              value: scheme.name || '',
                              label: scheme.display_name || scheme.name || '',
                            }))}
                            value={formData.payer_info?.scheme || ''}
                            onChange={(value) => {
                              setFormData((prev) => ({
                                ...prev,
                                payer_info: {
                                  ...(prev.payer_info || ({} as any)),
                                  scheme: value,
                                },
                              }));
                            }}
                            placeholder="Select HMO"
                          />
                        )}
                      </div>

                      {/* NHIS Patient Source Selection */}
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                          Patient Source
                          <span
                            className="ml-1 text-gray-400 font-normal normal-case"
                            title="Internal patients are registered directly at this facility. Referral patients are referred from another NHIS facility."
                          >
                            <Info className="h-3 w-3 inline" />
                          </span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {NHIS_PATIENT_SOURCE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  nhis_patient_source:
                                    opt.value as NHISPatientSource,
                                  // Clear referral fields when switching to Internal
                                  ...(opt.value === 'Internal'
                                    ? {
                                        referral_code: '',
                                        referring_facility_name: '',
                                        referring_facility_nhis_id: '',
                                        referral_date: '',
                                        referral_reason: '',
                                        referral_status:
                                          'Active' as ReferralStatus,
                                        clinical_summary: '',
                                      }
                                    : {}),
                                }))
                              }
                              className={`p-3 rounded-xl border-2 text-left transition-all ${
                                formData.nhis_patient_source === opt.value
                                  ? 'border-teal-600 bg-teal-100/60 ring-1 ring-teal-300'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {opt.value === 'Internal' ? (
                                  <Hospital
                                    className={`h-4 w-4 ${formData.nhis_patient_source === opt.value ? 'text-teal-600' : 'text-gray-500'}`}
                                  />
                                ) : (
                                  <ClipboardList
                                    className={`h-4 w-4 ${formData.nhis_patient_source === opt.value ? 'text-teal-600' : 'text-gray-500'}`}
                                  />
                                )}
                                <span
                                  className={`font-medium text-sm ${formData.nhis_patient_source === opt.value ? 'text-teal-800' : 'text-gray-700'}`}
                                >
                                  {opt.label}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 ml-6">
                                {opt.description}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Common NHIS Fields */}
                      <div className="grid grid-cols-1 gap-4 mb-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            NHIS Number *
                            <span
                              className="ml-1 text-gray-400 font-normal normal-case"
                              title="The patient's NHIS enrollment number"
                            >
                              <Info className="h-3 w-3 inline" />
                            </span>
                          </label>
                          <input
                            type="text"
                            name="nhis_number"
                            value={formData.nhis_number || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-teal-600 text-sm"
                            placeholder="e.g., NHIS/2024/123456"
                          />
                        </div>
                      </div>

                      {/* Referral Details - Hidden as per requirements, only NHIS number is collected for referrals */}
                      {/*
                        {formData.nhis_patient_source === 'Referral' && (
                          <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                             ... fields hidden ...
                          </div>
                        )}
                        */}
                    </div>
                  )}

                  {/* Add Dependents Section - Only for NHIS Principal patients (Military, Civilian, GIFSHIP) */}
                  {canManageDependents &&
                    isPrincipal &&
                    (formData.insurance_type === 'Military_NHIS' ||
                      formData.insurance_type === 'Civilian_NHIS' ||
                      formData.insurance_type === 'GIFSHIP') && (
                      <div className="mt-5 p-5 bg-purple-50/80 rounded-2xl border border-purple-200/80 shadow-[0_2px_12px_-4px_rgba(120,60,200,0.08)]">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-purple-800 flex items-center gap-2.5 text-sm">
                              <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center shadow-sm shadow-purple-600/25">
                                <Users className="h-4 w-4 text-white" />
                              </div>
                              Dependents
                            </h4>
                            <p className="text-xs text-purple-600 mt-1.5 ml-[42px]">
                              {isEditing
                                ? `Manage dependents for ${formData.first_name} ${formData.surname}`
                                : 'Add dependents (spouse, children, etc.) to be registered under this principal'}
                            </p>
                          </div>
                          {!showDependentEntry && (
                            <button
                              type="button"
                              onClick={() => {
                                // Prefill surname from principal's surname
                                setCurrentDependentData((prev) => ({
                                  ...prev,
                                  surname: formData.surname || '',
                                }));
                                setShowDependentEntry(true);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-xs transition-all"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Add Dependent
                            </button>
                          )}
                        </div>

                        {/* Existing dependents (when editing) */}
                        {isEditing &&
                          existingDependents &&
                          existingDependents.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-purple-700 mb-2">
                                Existing Dependents ({existingDependents.length}
                                ):
                              </p>
                              <div className="space-y-2">
                                {existingDependents.map((dep) => (
                                  <div
                                    key={dep.patient_id}
                                    className="flex items-center justify-between bg-white rounded-xl border border-purple-200 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-xs">
                                        {dep.first_name?.charAt(0)}
                                        {dep.surname?.charAt(0)}
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-900 text-sm">
                                          {dep.first_name} {dep.surname}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {dep.relationship_to_principal ||
                                            'Relationship not set'}{' '}
                                          • {dep.gender || 'N/A'}
                                          {dep.date_of_birth &&
                                            ` • DOB: ${dep.date_of_birth}`}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                      {dep.emr_number || 'No EMR'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {isEditing &&
                          (!existingDependents ||
                            existingDependents.length === 0) &&
                          !showDependentEntry &&
                          pendingDependents.length === 0 && (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                              <p>No dependents registered yet</p>
                              <p className="text-xs mt-1">
                                Click "Add Dependent" to register family members
                              </p>
                            </div>
                          )}

                        {/* Pending dependents to be created (for new registration) */}
                        {pendingDependents.length > 0 && (
                          <div className="mb-3">
                            {isEditing && (
                              <p className="text-xs font-medium text-green-700 mb-2">
                                New Dependents to Add:
                              </p>
                            )}
                            <div className="space-y-2">
                              {pendingDependents.map((dep, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-white rounded-xl border border-purple-200 px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-xs">
                                      {dep.first_name.charAt(0)}
                                      {dep.surname.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900 text-sm">
                                        {dep.first_name} {dep.surname}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {dep.relationship_to_principal} •{' '}
                                        {dep.gender}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPendingDependents((prev) =>
                                        prev.filter((_, i) => i !== idx),
                                      )
                                    }
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Dependent entry form */}
                        {showDependentEntry && (
                          <div className="bg-white rounded-xl border border-purple-200 p-3 space-y-3">
                            <div className="text-xs text-purple-600 bg-purple-50 rounded p-2 mb-2">
                              <span className="font-medium">
                                ℹ️ Inherited from principal:
                              </span>{' '}
                              Insurance, State/LGA, Address, Contact
                            </div>
                            <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-2 border border-amber-200">
                              <span className="font-medium">
                                ⚠️ Age Requirement:
                              </span>{' '}
                              Dependents must be under 18 years old, except for
                              Spouse who can be any age.
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  First Name *
                                </label>
                                <input
                                  type="text"
                                  value={currentDependentData.first_name}
                                  onChange={(e) => {
                                    setDependentEntryError(null);
                                    setCurrentDependentData((prev) => ({
                                      ...prev,
                                      first_name: e.target.value,
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-purple-500 text-sm"
                                  placeholder="First name"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  Surname (Family Name)
                                </label>
                                <input
                                  type="text"
                                  value={currentDependentData.surname}
                                  onChange={(e) => {
                                    setDependentEntryError(null);
                                    setCurrentDependentData((prev) => ({
                                      ...prev,
                                      surname: e.target.value,
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-purple-500 text-sm"
                                  placeholder="Surname"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  Gender *
                                </label>
                                <select
                                  value={currentDependentData.gender}
                                  onChange={(e) => {
                                    setDependentEntryError(null);
                                    setCurrentDependentData((prev) => ({
                                      ...prev,
                                      gender: e.target.value as Gender,
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-purple-500 text-sm"
                                >
                                  <option value="">Select</option>
                                  {GENDER_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  Date of Birth
                                </label>
                                <input
                                  type="date"
                                  value={currentDependentData.date_of_birth}
                                  onChange={(e) => {
                                    setDependentEntryError(null);
                                    setCurrentDependentData((prev) => ({
                                      ...prev,
                                      date_of_birth: e.target.value,
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-purple-500 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                  Relationship *
                                </label>
                                <select
                                  value={
                                    currentDependentData.relationship_to_principal
                                  }
                                  onChange={(e) => {
                                    setDependentEntryError(null);
                                    setCurrentDependentData((prev) => ({
                                      ...prev,
                                      relationship_to_principal: e.target.value,
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-purple-500 text-sm"
                                >
                                  <option value="">Select</option>
                                  {DEPENDENT_RELATIONSHIP_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                              {dependentEntryError && (
                                <div className="w-full mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                                  {dependentEntryError}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setDependentEntryError(null);
                                  setShowDependentEntry(false);
                                  setCurrentDependentData({
                                    first_name: '',
                                    surname: '',
                                    gender: '',
                                    date_of_birth: '',
                                    relationship_to_principal: '',
                                  });
                                }}
                                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDependentEntryError(null);
                                  if (
                                    !currentDependentData.first_name ||
                                    !currentDependentData.surname ||
                                    !currentDependentData.gender ||
                                    !currentDependentData.relationship_to_principal
                                  ) {
                                    return;
                                  }

                                  // Check GIFSHIP Dependent Limits
                                  if (formData.insurance_type === 'GIFSHIP') {
                                    let limit = 0;
                                    if (
                                      formData.enrollment_type === 'Individual'
                                    )
                                      limit = 2;
                                    else if (
                                      formData.enrollment_type === 'Family'
                                    )
                                      limit = 4;
                                    else if (
                                      formData.enrollment_type === 'Group'
                                    )
                                      limit = 10;

                                    const currentCount =
                                      (existingDependents?.length || 0) +
                                      pendingDependents.length;

                                    // If limit is 0 (e.g. not selected), we might want to prompt selection, but here we assume strict limits
                                    if (limit > 0 && currentCount >= limit) {
                                      setDependentEntryError(
                                        `Maximum number of dependents reached for GIFSHIP ${formData.enrollment_type} enrollment (Limit: ${limit}).`,
                                      );
                                      return;
                                    }
                                    // If enrollment type isn't selected, maybe block? Or assume unlimited?
                                    // Requirement says "FOR GIFSHIPS THEY CAN ONLY ADD...". Implies limits are key.
                                    if (!formData.enrollment_type) {
                                      setDependentEntryError(
                                        'Please select an Enrollment Type for GIFSHIP before adding dependents.',
                                      );
                                      return;
                                    }
                                  }

                                  // Age validation: Dependents must be under 18 unless Spouse
                                  if (
                                    currentDependentData.date_of_birth &&
                                    currentDependentData.relationship_to_principal !==
                                      'Spouse'
                                  ) {
                                    const birthDate = new Date(
                                      currentDependentData.date_of_birth,
                                    );
                                    const today = new Date();
                                    let age =
                                      today.getFullYear() -
                                      birthDate.getFullYear();
                                    const monthDiff =
                                      today.getMonth() - birthDate.getMonth();
                                    if (
                                      monthDiff < 0 ||
                                      (monthDiff === 0 &&
                                        today.getDate() < birthDate.getDate())
                                    ) {
                                      age--;
                                    }
                                    if (age >= 18) {
                                      setDependentEntryError(
                                        'Dependents must be under 18 years old. Only Spouse can be 18 years or older.',
                                      );
                                      return;
                                    }
                                  }

                                  // GIFSHIP (Corpers) Expiration Logic - ensure dependent matches principal expiry by default?
                                  // User said "ENSURE ALL THESE RECORDS... IS THE SAME".
                                  // We'll proceed with adding.

                                  setPendingDependents((prev) => [
                                    ...prev,
                                    { ...currentDependentData },
                                  ]);
                                  setCurrentDependentData({
                                    first_name: '',
                                    surname: '',
                                    gender: '',
                                    date_of_birth: '',
                                    relationship_to_principal: '',
                                  });
                                  setDependentEntryError(null);
                                  setShowDependentEntry(false);
                                }}
                                disabled={
                                  !currentDependentData.first_name ||
                                  !currentDependentData.surname ||
                                  !currentDependentData.gender ||
                                  !currentDependentData.relationship_to_principal
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Add to List
                              </button>
                            </div>
                          </div>
                        )}

                        {pendingDependents.length > 0 &&
                          !showDependentEntry && (
                            <div className="flex justify-end mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  // Prefill surname from principal's surname
                                  setCurrentDependentData((prev) => ({
                                    ...prev,
                                    surname: formData.surname || '',
                                  }));
                                  setShowDependentEntry(true);
                                }}
                                className="text-purple-600 hover:text-purple-800 text-xs font-medium flex items-center gap-1"
                              >
                                <UserPlus className="h-3 w-3" />
                                Add Another
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                </div>
              )}

              {/* Step 4: Documents (Removed/Merged) */}
            </div>
          </form>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <p className="hidden text-xs text-slate-500 sm:block">
              Fields marked <span className="text-red-500">*</span> are required
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit as any}
                disabled={isLoading || isSavingAndAddingDependent}
                className="flex items-center gap-2 rounded-lg bg-[#E9783F] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#D96A36] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isEditing ? 'Save changes' : 'Save patient'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Add Course Modal */}
      {showAddCourseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary-700" />
              Add New Course
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  value={`Course ${nextCourseNumber || ''}`}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-gray-100 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Course names are auto-generated based on sequence
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={newCourseYear}
                  onChange={(e) =>
                    setNewCourseYear(
                      parseInt(e.target.value) || new Date().getFullYear(),
                    )
                  }
                  min={new Date().getFullYear()}
                  max={new Date().getFullYear() + 10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-700 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAddCourseModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCourse}
                disabled={createCourseMutation.isPending || !nextCourseNumber}
                className="px-4 py-2 bg-primary-700 text-white rounded-xl hover:bg-primary-800 disabled:opacity-50 flex items-center gap-2"
              >
                {createCourseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Course
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
          20%, 40%, 60%, 80% { transform: translateX(2px); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-slideUp {
          animation: slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        /* Smooth scrollbar for form content */
        form::-webkit-scrollbar {
          width: 6px;
        }
        form::-webkit-scrollbar-track {
          background: transparent;
        }
        form::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.12);
          border-radius: 3px;
        }
        form::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
