// =============================================================================
// EMR Workflow API - Patient Journey Management
// =============================================================================

import { supabase } from '../../api/supabaseClient';
import { createScopedLogger } from '../../utils/logger';
import { isNhisFeatureEnabled } from '../../config/features';
import {
  EncounterDTO,
  CreateEncounterDTO,
  UpdateEncounterDTO,
  TransitionEncounterDTO,
  MoveToQueueDTO,
  WorkflowStage,
  requiresPaymentFirst,
  mapStageToDepartment,
  canTransition,
} from './types';

const log = createScopedLogger('Workflow');

// =============================================================================
// Specialty Clinic Detection - For Direct Routing
// =============================================================================

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
  | 'plastic_surgery'
  | 'nutrition'
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
type SpecialtyQueueLocation =
  | 'Dental'
  | 'Ophthalmology'
  | 'Physiotherapy'
  | 'Cardiology'
  | 'Dermatology'
  | 'Orthopaedics'
  | 'ENT'
  | 'Urology'
  | 'Neurology'
  | 'Neuropsychiatry'
  | 'Gastroenterology'
  | 'Nephrology'
  | 'Paediatrics'
  | 'Neurosurgery'
  | 'General Surgery'
  | 'Gynaecology'
  | 'Oral & Maxillofacial'
  | 'Pulmonology'
  | 'Endocrinology'
  | 'Plastic Surgery'
  | 'Nutrition'
  | 'Psychiatry'
  | 'Oncology'
  | 'Rheumatology'
  | 'Infectious Disease'
  | 'Haematology'
  | 'Cardiothoracic Surgery'
  | 'Vascular Surgery'
  | 'Paediatric Surgery'
  | 'Neonatology'
  | 'Nursing';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ResolvedClinic {
  id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_code?: string | null;
  consultation_fee?: number | null;
  follow_up_fee?: number | null;
  emergency_fee?: number | null;
}

async function resolveClinicReference(
  clinicRef: string | undefined,
): Promise<ResolvedClinic | null> {
  if (!clinicRef) return null;

  const isUuid = UUID_PATTERN.test(clinicRef);
  const primaryColumn = isUuid ? 'id' : 'clinic_id';
  const fallbackColumn = isUuid ? 'clinic_id' : 'id';

  const selectColumns =
    'id, clinic_id, clinic_name, clinic_code, consultation_fee, follow_up_fee, emergency_fee';

  const primary = await supabase
    .from('clinics')
    .select(selectColumns)
    .eq(primaryColumn, clinicRef)
    .maybeSingle();

  if (primary.data) return primary.data as ResolvedClinic;

  const fallback = await supabase
    .from('clinics')
    .select(selectColumns)
    .eq(fallbackColumn, clinicRef)
    .maybeSingle();

  return (fallback.data as ResolvedClinic | null) ?? null;
}

/**
 * Detect if a clinic is a specialty clinic based on clinic name or ID
 * Specialty clinics skip nursing vitals and go directly to their specialty queue
 */
async function detectSpecialtyClinic(clinicId: string | undefined): Promise<{
  isSpecialty: boolean;
  specialty: SpecialtyModule;
  queueLocation: SpecialtyQueueLocation;
}> {
  if (!clinicId)
    return { isSpecialty: false, specialty: null, queueLocation: 'Nursing' };

  // Resolve clinic by UUID id or business clinic_id code.
  const clinic = await resolveClinicReference(clinicId);

  if (!clinic)
    return { isSpecialty: false, specialty: null, queueLocation: 'Nursing' };

  const clinicName = (clinic.clinic_name || '').toLowerCase();
  const clinicCode = (clinic.clinic_code || '').toLowerCase();

  // Specialty clinic detection map: [nameSubstring | codeMatch] → { specialty, queueLocation }
  const specialtyMap: Array<{
    match: () => boolean;
    specialty: SpecialtyModule;
    queue: SpecialtyQueueLocation;
  }> = [
    {
      match: () => clinicName.includes('dental') || clinicCode === 'den',
      specialty: 'dental',
      queue: 'Dental',
    },
    {
      match: () =>
        clinicName.includes('eye') ||
        clinicName.includes('ophthal') ||
        clinicCode === 'eye',
      specialty: 'ophthalmology',
      queue: 'Ophthalmology',
    },
    {
      match: () =>
        clinicName.includes('physio') ||
        clinicName.includes('rehab') ||
        clinicCode === 'phy',
      specialty: 'physiotherapy',
      queue: 'Physiotherapy',
    },
    {
      match: () => clinicName.includes('cardiothoracic'),
      specialty: 'cardiothoracic_surgery',
      queue: 'Cardiothoracic Surgery',
    },
    {
      match: () => clinicName.includes('cardiology') || clinicCode === 'car',
      specialty: 'cardiology',
      queue: 'Cardiology',
    },
    {
      match: () =>
        clinicName.includes('dermat') ||
        clinicName.includes('skin') ||
        clinicCode === 'skn',
      specialty: 'dermatology',
      queue: 'Dermatology',
    },
    {
      match: () => clinicName.includes('ortho') || clinicCode === 'ort',
      specialty: 'orthopaedics',
      queue: 'Orthopaedics',
    },
    {
      match: () =>
        (clinicName.includes('ent') &&
          (clinicName.includes('clinic') || clinicName.length <= 10)) ||
        clinicCode === 'ent',
      specialty: 'ent',
      queue: 'ENT',
    },
    {
      match: () => clinicName.includes('urolog') || clinicCode === 'uro',
      specialty: 'urology',
      queue: 'Urology',
    },
    {
      match: () => clinicName.includes('neurosurg') || clinicCode === 'nsg',
      specialty: 'neurosurgery',
      queue: 'Neurosurgery',
    },
    {
      match: () => clinicName.includes('neuropsych') || clinicCode === 'npy',
      specialty: 'neuropsychiatry',
      queue: 'Neuropsychiatry',
    },
    {
      match: () => clinicName.includes('neurol') || clinicCode === 'neu',
      specialty: 'neurology',
      queue: 'Neurology',
    },
    {
      match: () => clinicName.includes('gastro') || clinicCode === 'gas',
      specialty: 'gastroenterology',
      queue: 'Gastroenterology',
    },
    {
      match: () => clinicName.includes('nephrol') || clinicCode === 'nep',
      specialty: 'nephrology',
      queue: 'Nephrology',
    },
    {
      match: () =>
        clinicName.includes('paediatric surg') ||
        clinicName.includes('pediatric surg') ||
        clinicCode === 'pds',
      specialty: 'paediatric_surgery',
      queue: 'Paediatric Surgery',
    },
    {
      match: () =>
        clinicName.includes('paediatr') ||
        clinicName.includes('pediatr') ||
        clinicCode === 'ped',
      specialty: 'paediatrics',
      queue: 'Paediatrics',
    },
    {
      match: () => clinicName.includes('general surg') || clinicCode === 'gsg',
      specialty: 'general_surgery',
      queue: 'General Surgery',
    },
    {
      match: () =>
        clinicName.includes('gynae') ||
        clinicName.includes('gynec') ||
        clinicName.includes('obstetric') ||
        clinicCode === 'obg',
      specialty: 'gynaecology',
      queue: 'Gynaecology',
    },
    {
      match: () => clinicName.includes('maxillofacial') || clinicCode === 'omf',
      specialty: 'oral_maxillofacial',
      queue: 'Oral & Maxillofacial',
    },
    {
      match: () =>
        clinicName.includes('pulmon') ||
        (clinicName.includes('chest') && clinicName.includes('clinic')) ||
        clinicCode === 'pul' ||
        clinicCode === 'che',
      specialty: 'pulmonology',
      queue: 'Pulmonology',
    },
    {
      match: () => clinicName.includes('endocrin') || clinicCode === 'end',
      specialty: 'endocrinology',
      queue: 'Endocrinology',
    },
    {
      match: () => clinicName.includes('plastic') || clinicCode === 'pls',
      specialty: 'plastic_surgery',
      queue: 'Plastic Surgery',
    },
    {
      match: () =>
        clinicName.includes('nutrition') ||
        clinicName.includes('diet') ||
        clinicCode === 'nut',
      specialty: 'nutrition',
      queue: 'Nutrition',
    },
    {
      match: () => clinicName.includes('psychiat') || clinicCode === 'psy',
      specialty: 'psychiatry',
      queue: 'Psychiatry',
    },
    {
      match: () => clinicName.includes('oncolog') || clinicCode === 'onc',
      specialty: 'oncology',
      queue: 'Oncology',
    },
    {
      match: () => clinicName.includes('rheumat') || clinicCode === 'rhe',
      specialty: 'rheumatology',
      queue: 'Rheumatology',
    },
    {
      match: () =>
        clinicName.includes('infectious') ||
        clinicName.includes('retroviral') ||
        clinicCode === 'inf' ||
        clinicCode === 'art',
      specialty: 'infectious_disease',
      queue: 'Infectious Disease',
    },
    {
      match: () =>
        clinicName.includes('haemat') ||
        clinicName.includes('hemat') ||
        clinicCode === 'hae',
      specialty: 'haematology',
      queue: 'Haematology',
    },
    {
      match: () => clinicName.includes('vascular') || clinicCode === 'vas',
      specialty: 'vascular_surgery',
      queue: 'Vascular Surgery',
    },
    {
      match: () =>
        clinicName.includes('neonat') ||
        clinicName.includes('scbu') ||
        clinicCode === 'neo',
      specialty: 'neonatology',
      queue: 'Neonatology',
    },
  ];

  for (const entry of specialtyMap) {
    if (entry.match()) {
      return {
        isSpecialty: true,
        specialty: entry.specialty,
        queueLocation: entry.queue,
      };
    }
  }

  return { isSpecialty: false, specialty: null, queueLocation: 'Nursing' };
}

// =============================================================================
// Optimized SELECT Constants (Performance: avoid SELECT *)
// =============================================================================

// Queue table - only fields needed for workflow stage mapping and display
const QUEUE_SELECT = `
  id,
  visit_id,
  encounter_id,
  patient_id,
  department_id,
  clinic_id,
  ticket_number,
  status,
  priority,
  location,
  assigned_to,
  called_at,
  started_at,
  completed_at,
  notes,
  specialty_code,
  created_at,
  updated_at
`;

// Visits table - core encounter fields
const VISIT_SELECT = `
  id,
  visit_id,
  patient_id,
  clinic_id,
  visit_type,
  encounter_number,
  encounter_date,
  priority,
  chief_complaint,
  payment_category,
  insurance_type,
  status,
  current_stage,
  stage_updated_at,
  start_time,
  end_time,
  attending_doctor_id,
  registered_by,
  created_at,
  updated_at,
  opd_classification
`;

// Visits with patient join - for encounter list views
const VISIT_WITH_PATIENT_SELECT = `
  id,
  visit_id,
  patient_id,
  clinic_id,
  visit_type,
  encounter_number,
  encounter_date,
  priority,
  chief_complaint,
  payment_category,
  insurance_type,
  status,
  current_stage,
  stage_updated_at,
  start_time,
  end_time,
  attending_doctor_id,
  registered_by,
  created_at,
  updated_at,
  opd_classification,
  patient:patients(*)
`;

// Stats-only visits - minimal fields for counting
const VISIT_STATS_SELECT = `
  id,
  status,
  current_stage,
  created_at,
  start_time,
  end_time,
  payment_category
`;

function normalizeDepartmentForQueue(
  department: MoveToQueueDTO['department'],
): string {
  switch (department) {
    case 'Reception':
      return 'Registration';
    case 'Laboratory':
      return 'Lab';
    default:
      return department;
  }
}

// =============================================================================
// Get Active Encounters (P2-01: single-query via active_encounter_queue view)
// =============================================================================
// Previously used two sequential queries (visits then queue, joined client-side).
// Now uses the active_encounter_queue view which JOINs visits + patients + queue
// in a single server-side query, eliminating the N+1 pattern.
// Fallback to legacy two-query path if the view is not yet deployed.
// =============================================================================

export async function getActiveEncounters(
  currentUserId?: string,
): Promise<EncounterDTO[]> {
  // --- Primary path: single-query view (migration 146) ---
  const { data: viewData, error: viewError } = await supabase
    .from('active_encounter_queue')
    .select('*')
    .order('created_at', { ascending: false });

  if (!viewError && viewData) {
    // Map flat view columns back into the nested EncounterDTO shape
    // Check care team assignments for is_assigned_to_current_user
    const careTeamAssignments = new Set<string>();
    if (currentUserId && viewData.length > 0) {
      const visitIds = viewData.map((r: any) => r.id);
      const { data: assignments } = await supabase
        .from('encounter_care_team')
        .select('encounter_id')
        .in('encounter_id', visitIds)
        .eq('staff_id', currentUserId)
        .eq('is_active', true);
      if (assignments) {
        assignments.forEach((a: any) =>
          careTeamAssignments.add(a.encounter_id),
        );
      }
    }

    return viewData.map((row: any) => {
      const queueEntry = row.q_id
        ? {
            id: row.q_id,
            visit_id: row.id,
            status: row.q_status,
            location: row.q_location,
            assigned_to: row.q_assigned_to,
            called_at: row.q_called_at,
            started_at: row.q_started_at,
            completed_at: row.q_completed_at,
            ticket_number: row.q_ticket_number,
            specialty_code: row.q_specialty_code,
            notes: row.q_notes,
            department_id: row.q_department_id,
            created_at: row.q_created_at,
            priority: row.priority,
            patient_id: row.patient_id,
          }
        : undefined;

      const patient = {
        id: row.p_id,
        patient_id: row.p_patient_id,
        first_name: row.p_first_name,
        surname: row.p_surname,
        date_of_birth: row.p_date_of_birth,
        gender: row.p_gender,
        contact_phone: row.p_contact_phone,
        emr_number: row.p_emr_number,
        nhis_number: row.p_nhis_number,
        insurance_type: row.p_insurance_type,
        patient_type: row.p_patient_type,
      };

      const pseudoVisit = {
        id: row.id,
        visit_id: row.visit_id,
        patient_id: row.patient_id,
        clinic_id: row.clinic_id,
        visit_type: row.visit_type,
        encounter_number: row.encounter_number,
        encounter_date: row.encounter_date,
        priority: row.priority,
        chief_complaint: row.chief_complaint,
        payment_category: row.payment_category,
        insurance_type: row.insurance_type,
        current_stage: row.current_stage,
        stage_updated_at: row.stage_updated_at,
        start_time: row.start_time,
        end_time: row.end_time,
        attending_doctor_id: row.attending_doctor_id,
        opd_classification: row.opd_classification,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };

      const isAssigned = currentUserId
        ? row.attending_doctor_id === currentUserId ||
          careTeamAssignments.has(row.id)
        : undefined;

      return {
        ...pseudoVisit,
        status: 'Active' as const,
        current_stage: mapVisitToStage(pseudoVisit, queueEntry),
        registration_time: row.start_time,
        patient,
        queue_entry: queueEntry,
        is_assigned_to_current_user: isAssigned,
      };
    }) as unknown as EncounterDTO[];
  }

  // --- Fallback path: legacy two-query approach (if view not yet deployed) ---
  log.warn(
    'active_encounter_queue view unavailable; using fallback query path',
    {
      reason: viewError?.message,
    },
  );

  const { data, error } = await supabase
    .from('visits')
    .select(VISIT_WITH_PATIENT_SELECT)
    .eq('status', 'Active')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const visitIds = data?.map((v) => v.id) || [];
  const queueMap = new Map();

  if (visitIds.length > 0) {
    const { data: queueEntries } = await supabase
      .from('queue')
      .select(QUEUE_SELECT)
      .in('visit_id', visitIds)
      .in('status', ['Waiting', 'In Progress', 'Called'])
      .order('created_at', { ascending: false });

    if (queueEntries) {
      queueEntries.reverse().forEach((q) => {
        queueMap.set(q.visit_id, q);
      });
    }
  }

  const careTeamAssignments = new Set<string>();
  if (currentUserId && visitIds.length > 0) {
    const { data: assignments } = await supabase
      .from('encounter_care_team')
      .select('encounter_id')
      .in('encounter_id', visitIds)
      .eq('staff_id', currentUserId)
      .eq('is_active', true);

    if (assignments) {
      assignments.forEach((a) => careTeamAssignments.add(a.encounter_id));
    }
  }

  return (data || []).map((visit) => {
    const isAssigned = currentUserId
      ? visit.attending_doctor_id === currentUserId ||
        careTeamAssignments.has(visit.id)
      : undefined;

    return {
      ...visit,
      current_stage: mapVisitToStage(visit, queueMap.get(visit.id)),
      registration_time: visit.start_time,
      queue_entry: queueMap.get(visit.id),
      is_assigned_to_current_user: isAssigned,
    };
  }) as unknown as EncounterDTO[];
}

// =============================================================================
// Get Encounter by Visit ID
// =============================================================================

export async function getEncounter(visitId: string): Promise<EncounterDTO> {
  // Try to find by visit_id first (VARCHAR like VIS-20251226-01001)
  // If not found, try by id (UUID) for compatibility
  let visit: any = null;
  const visitError: any = null;

  // First try by visit_id (the display ID)
  const { data: visitByDisplayId, error: displayIdError } = await supabase
    .from('visits')
    .select(VISIT_WITH_PATIENT_SELECT)
    .eq('visit_id', visitId)
    .maybeSingle();

  if (visitByDisplayId) {
    visit = visitByDisplayId;
  } else {
    // Fallback: try by UUID (id)
    const { data: visitByUuid, error: uuidError } = await supabase
      .from('visits')
      .select(VISIT_WITH_PATIENT_SELECT)
      .eq('id', visitId)
      .maybeSingle();

    if (visitByUuid) {
      visit = visitByUuid;
    } else {
      // Neither found
      throw new Error(`Encounter not found: ${visitId}`);
    }
  }

  if (!visit) {
    throw new Error(`Encounter not found: ${visitId}`);
  }

  // Ensure clinic_id is present in the returned object
  // The select * above should include it, but let's be explicit if needed
  // visit.clinic_id should be available directly from the visits table

  // Get related queue entry
  const { data: queueEntry } = await supabase
    .from('queue')
    .select(QUEUE_SELECT)
    .eq('visit_id', visit.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get related consultations
  const { data: consultations } = await supabase
    .from('consultations')
    .select('consultation_id')
    .eq('visit_id', visit.id);

  // Get related lab requests
  const { data: labRequests } = await supabase
    .from('lab_requests')
    .select('request_id')
    .eq('visit_id', visit.id);

  // Get related radiology requests
  const { data: radiologyRequests } = await supabase
    .from('radiology_requests')
    .select('request_id')
    .eq('visit_id', visit.id);

  // Get related prescriptions
  const { data: prescriptions } = await supabase
    .from('prescriptions')
    .select('prescription_id')
    .eq('visit_id', visit.id);

  // Get billing records
  const { data: billing } = await supabase
    .from('billing_orders')
    .select('id, total_amount, paid_amount')
    .eq('visit_id', visit.id);

  const totalCharges =
    billing?.reduce((sum, b) => sum + Number(b.total_amount), 0) || 0;
  const totalPaid =
    billing?.reduce((sum, b) => sum + Number(b.paid_amount), 0) || 0;

  return {
    ...visit,
    current_stage: mapVisitToStage(
      visit,
      queueEntry,
      labRequests || undefined,
      radiologyRequests || undefined,
      prescriptions || undefined,
    ),
    registration_time: visit.start_time,
    queue_entry: queueEntry,
    consultation_id: consultations?.[0]?.consultation_id,
    lab_requests: labRequests?.map((l) => l.request_id) || [],
    radiology_requests: radiologyRequests?.map((r) => r.request_id) || [],
    prescriptions: prescriptions?.map((p) => p.prescription_id) || [],
    billing_id: billing?.[0]?.id,
    total_charges: totalCharges,
    total_paid: totalPaid,
    balance: totalCharges - totalPaid,
  } as EncounterDTO;
}

// =============================================================================
// Get Patient's Active Encounter
// =============================================================================

export async function getPatientActiveEncounter(
  patientId: string,
): Promise<EncounterDTO | null> {
  const today = new Date().toISOString().split('T')[0];

  // Check if patientId is a UUID or a string ID
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      patientId,
    );

  let query = supabase
    .from('visits')
    .select(VISIT_WITH_PATIENT_SELECT)
    .eq('status', 'Active')
    .order('created_at', { ascending: false })
    .limit(1);

  if (isUuid) {
    query = query.eq('patient_id', patientId);
  } else {
    // If it's not a UUID, we need to find the patient's UUID first
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('patient_id', patientId)
      .single();

    if (patient) {
      query = query.eq('patient_id', patient.id);
    } else {
      return null;
    }
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return getEncounter(data.visit_id);
}

// =============================================================================
// Create New Encounter (Patient Check-In)
// =============================================================================

/**
 * Helper: Get consultation fee based on visit type and clinic.
 * Uses SINGLE SOURCE OF TRUTH: consultation_fee, follow_up_fee, emergency_fee
 * from the clinics table. Same price for ALL insurance types.
 * NHIS coverage (100% for consultation) is handled in createConsultationBillingOrder().
 */
async function getConsultationFee(
  clinicId: string | undefined,
  visitType: string,
  _insuranceType: string = '', // Kept for API compatibility, no longer used for fee selection
): Promise<{ fee: number; description: string }> {
  if (!clinicId) {
    return { fee: 0, description: 'Consultation' };
  }

  const clinic = await resolveClinicReference(clinicId);
  if (!clinic) {
    return { fee: 0, description: 'Consultation' };
  }

  // Single source of truth: use the base fee columns for ALL insurance types
  let fee = 0;
  let description = `${clinic.clinic_name} - Consultation`;

  if (visitType === 'Emergency') {
    fee =
      (clinic.emergency_fee as number) ||
      (clinic.consultation_fee as number) ||
      0;
    description = `${clinic.clinic_name} - Emergency Consultation`;
  } else if (visitType === 'Follow-up') {
    fee =
      (clinic.follow_up_fee as number) ||
      (clinic.consultation_fee as number) ||
      0;
    description = `${clinic.clinic_name} - Follow-up Consultation`;
  } else {
    fee = (clinic.consultation_fee as number) || 0;
  }

  return { fee, description };
}

/**
 * Helper: Generate billing order number
 */
function generateBillingOrderNumber(date: Date = new Date()): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
  return `INV-${year}${month}-${random}`; // Use INV- prefix for consistency
}

/**
 * Helper: Create billing order for consultation fee with audit-safe NHIS fields
 * SPECIAL RULE: Consultation is 100% FREE for ALL NHIS patients
 */
async function createConsultationBillingOrder(
  visitUuid: string, // UUID from visits.id - used for billing_orders.visit_id
  encounterId: string, // UUID for encounter_id (same as visitUuid for visits)
  patientId: string,
  clinicId: string | undefined,
  visitType: string,
  staffUuid: string | null,
  insuranceType: string, // Patient's insurance type for NHIS calculation
): Promise<void> {
  // Calculate NHIS amounts - Consultation is 100% FREE for ALL NHIS/insurance patients
  // The gross amount is the ACTUAL consultation fee (single source of truth from clinic)
  // For NHIS: show full price on receipt with 100% coverage
  const normalizedInsuranceType = (insuranceType || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
  const isRetainership = [
    'retainership',
    'corporate',
  ].includes(normalizedInsuranceType);
  const isNhis =
    isNhisFeatureEnabled() &&
    normalizedInsuranceType !== '' &&
    [
      'dhml',
      'military nhis',
      'civilian nhis',
      'security services nhis',
      'gifship',
    ].includes(normalizedInsuranceType);
  const isCoveredConsultation = isNhis || isRetainership;

  // Get consultation fee using single source of truth: clinic's base fee columns
  // Same fee for ALL patient types - NHIS coverage is calculated separately
  const { fee, description } = await getConsultationFee(
    clinicId,
    visitType,
    insuranceType,
  );

  // Only create billing order if there's a fee
  if (fee <= 0) return;

  const orderNumber = generateBillingOrderNumber();

  // Ensure boolean values for database
  const nhisCovered: boolean = isCoveredConsultation === true;
  const nhisPercentage: number = isCoveredConsultation ? 100 : 0; // 100% for covered consultations
  const grossAmount: number = fee;
  const nhisPayable: number = isCoveredConsultation ? grossAmount : 0;
  const patientPayable: number = grossAmount - nhisPayable;

  // ALL billing orders start as 'Pending' - billing admin must verify
  // NHIS consultations also require verification for audit trail compliance
  const billingStatus = 'Pending';
  const itemStatus = 'Unpaid';

  // Create billing order for consultation fee with audit-safe NHIS fields
  const { data: billingOrder, error: orderError } = await supabase
    .from('billing_orders')
    .insert({
      order_number: orderNumber,
      patient_id: patientId,
      visit_id: visitUuid, // UUID - references visits.id
      encounter_id: encounterId, // UUID - for encounter tracking
      source_module: 'consultation',
      total_amount: grossAmount,
      discount_amount: 0,
      tax_amount: 0,
      net_amount: grossAmount,
      paid_amount: 0, // Starts at 0 - updated after admin verification
      balance_amount: patientPayable, // 0 for NHIS, full amount for others
      status: billingStatus, // Always 'Pending' - admin must verify
      payment_method: null, // Set during verification
      // Audit-safe NHIS snapshots (NEVER recalculated)
      nhis_covered: nhisCovered,
      nhis_percentage: nhisPercentage,
      nhis_payable: nhisPayable,
      patient_payable: patientPayable,
      created_by: staffUuid,
    })
    .select('id')
    .single();

  if (orderError) {
    log.error('Failed to create consultation billing order', orderError, {
      billingStatus,
      nhisCovered,
      nhisPercentage,
    });
    return; // Don't fail the encounter creation if billing fails
  }

  // Create billing item with ALL audit-safe mandatory fields
  const { error: itemError } = await supabase.from('billing_items').insert({
    billing_order_id: billingOrder.id,
    item_type: 'Consultation',
    item_id: encounterId, // Reference to the visit
    service_reference_id: encounterId, // UUID reference to source record
    // Audit-safe snapshots (NEVER recalculated even if prices change)
    item_name: description,
    service_name: description,
    quantity: 1,
    unit_price: fee,
    unit_cost: fee,
    total_price: grossAmount,
    gross_amount: grossAmount,
    // NHIS snapshots (NEVER recalculated)
    nhis_covered: nhisCovered,
    nhis_percentage: nhisPercentage,
    nhis_payable: nhisPayable,
    patient_payable: patientPayable,
    status: itemStatus, // Always 'Unpaid' - admin must verify
  });

  if (itemError) {
    log.error('Failed to create consultation billing item', itemError, {
      itemStatus,
      nhisCovered,
      nhisPercentage,
    });
  }

  // AUTO-VERIFY: If 100% NHIS covered, auto-verify immediately — no admin click needed.
  // Uses inline auto-verify (same pattern as billing-order.api.ts autoVerifyNhisBillingOrder)
  if (nhisCovered && nhisPercentage >= 100) {
    try {
      const receiptNumber = `RCP-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(
        Math.random() * 100000,
      )
        .toString()
        .padStart(5, '0')}`;
      const now = new Date().toISOString();

      // Mark billing order as Paid_NHIS
      await supabase
        .from('billing_orders')
        .update({
          status: 'Paid_NHIS',
          payment_method: 'NHIS',
          paid_amount: grossAmount,
          balance_amount: 0,
          receipt_number: receiptNumber,
          updated_at: now,
        })
        .eq('id', billingOrder.id);

      // Mark billing items as Paid
      await supabase
        .from('billing_items')
        .update({ status: 'Paid', updated_at: now })
        .eq('billing_order_id', billingOrder.id);

      // Get patient display ID for receipt
      const { data: patientRec } = await supabase
        .from('patients')
        .select('patient_id')
        .eq('id', patientId)
        .single();

      if (patientRec?.patient_id) {
        await supabase.from('receipts').insert({
          receipt_number: receiptNumber,
          billing_order_id: billingOrder.id,
          patient_id: patientRec.patient_id,
          visit_id: null,
          encounter_id: encounterId,
          amount_paid: 0,
          payment_method: 'NHIS',
        });
      }

      log.info('Auto-verified NHIS consultation billing order', {
        nhisPercentage,
        billingStatus: 'Paid_NHIS',
      });
    } catch (autoVerifyError) {
      log.error(
        'Failed to auto-verify NHIS consultation billing order',
        autoVerifyError,
        {
          nhisPercentage,
        },
      );
      // Don't throw — billing order still created, can be manually verified
    }
  }
}

export async function createEncounter(
  dto: CreateEncounterDTO,
): Promise<EncounterDTO> {
  const resolvedClinic = await resolveClinicReference(dto.clinic_id);
  if (!resolvedClinic) {
    throw new Error(
      'Invalid clinic selected. Please re-select clinic and try again.',
    );
  }

  // Get current staff UUID (not staff_id)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let staffUuid = null;
  if (user) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('id') // Get UUID, not staff_id
      .eq('email', user.email)
      .maybeSingle();
    staffUuid = staffData?.id;
  }

  // Fetch patient's insurance_type for NHIS calculation
  const { data: patientData } = await supabase
    .from('patients')
    .select('insurance_type')
    .eq('id', dto.patient_id)
    .maybeSingle();

  const insuranceType = patientData?.insurance_type || null;

  // Detect if this is a specialty clinic (Dental, Eye, Physio)
  // Specialty clinics: Billing → Specialty Queue (skip Nursing)
  const specialtyInfo = await detectSpecialtyClinic(dto.clinic_id);

  // Detect NHIS referral patient — these must go through NHIS Specialty Approval Queue
  const normalizedIns = (insuranceType || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
  const isNhisReferral =
    isNhisFeatureEnabled() &&
    !!(
      dto.is_referral_encounter &&
      dto.source_referral_id &&
      (normalizedIns.includes('nhis') ||
        normalizedIns === 'dhml' ||
        normalizedIns === 'gifship')
    );

  // Detect if this is an A&E encounter for setting encounter_category
  const isAeVisitType =
    dto.visit_type === 'A&E' || dto.visit_type === 'Emergency';

  // Create visit record - include referral fields if this is a referral encounter
  const { data: visit, error: visitError } = await supabase
    .from('visits')
    .insert({
      patient_id: dto.patient_id,
      visit_type: dto.visit_type,
      payment_category: dto.payment_category,
      insurance_type: insuranceType, // Store patient's insurance_type for NHIS calculation
      priority: dto.priority || (isAeVisitType ? 'Urgent' : 'Normal'),
      chief_complaint: dto.chief_complaint,
      clinic_id: resolvedClinic.id,
      attending_doctor_id: dto.attending_doctor_id, // Selected doctor
      status: 'Active',
      start_time: new Date().toISOString(),
      registered_by: staffUuid, // Must be UUID, not staff_id
      encounter_category: isAeVisitType ? 'emergency' : undefined,
      // Referral encounter fields (optional - only set when creating from a referral)
      is_referral_encounter: dto.is_referral_encounter || false,
      source_referral_id: dto.source_referral_id || null,
      referring_doctor_id: dto.referring_doctor_id || null,
      referral_reason: dto.referral_reason || null,
      // NHIS referral encounters need NHIS specialty approval before proceeding
      // Valid enum values: not_applicable, unverified, blocked, verified, expired, emergency_override
      // NOTE: nhis_approval_status does NOT exist on visits — it only exists on clinical_requests
      nhis_verification_status: isNhisReferral
        ? 'unverified'
        : dto.is_referral_encounter
          ? 'verified'
          : undefined,
    })
    .select(
      `
      *,
      patient:patients(*)
    `,
    )
    .single();

  if (visitError) throw visitError;

  // If this is a referral encounter, update the clinical_request to link it
  if (dto.is_referral_encounter && dto.source_referral_id) {
    const referralUpdate: Record<string, any> = {
      referral_encounter_id: visit.id,
      referral_workflow_status: 'Encounter_Created',
    };

    if (isNhisReferral) {
      // NHIS referral patients need NHIS specialty approval before proceeding
      referralUpdate.nhis_approval_status = 'pending';
      referralUpdate.status = 'Under_Review'; // Valid enum — awaiting NHIS desk review
      log.info('Routed NHIS referral encounter to specialty approval queue', {
        specialtyModule:
          dto.specialty_module || specialtyInfo?.specialty || 'consultation',
      });
    } else {
      // Non-NHIS referrals are approved immediately
      referralUpdate.status = 'Approved';
      referralUpdate.approved_at = new Date().toISOString();
      referralUpdate.approved_by = staffUuid;
    }

    const { error: referralUpdateError } = await supabase
      .from('clinical_requests')
      .update(referralUpdate)
      .eq('id', dto.source_referral_id);

    if (referralUpdateError) {
      log.error(
        'Failed to update referral booking status after encounter creation',
        referralUpdateError,
        {
          isNhisReferral,
        },
      );
      // Don't throw — the encounter (visit) was already created successfully.
      // But log prominently so this can be diagnosed if bookings appear stuck.
    } else {
      log.info('Updated referral booking workflow status', {
        referralWorkflowStatus: 'Encounter_Created',
        isNhisReferral,
      });
    }
  }

  // =============================================================================
  // WORKFLOW ROUTING
  // =============================================================================
  // Normal flow:  Encounter → Billing → Nursing/Specialty
  // NHIS Referral: Encounter → NHIS Specialty Queue (approval) → Billing → Nursing → Specialty
  // =============================================================================

  let initialDepartment = 'Billing'; // Default: start at Billing
  let initialStage: WorkflowStage = 'payment'; // Payment verification stage
  let queueNoteOverride: string | null = null;

  // A&E encounter path — bypass billing, route to Triage
  const isAeEncounter =
    dto.visit_type === 'A&E' || dto.visit_type === 'Emergency';
  if (isAeEncounter) {
    initialDepartment = 'Triage';
    initialStage = 'ae_arrival';
    queueNoteOverride =
      `A&E Arrival — ${dto.chief_complaint || 'Emergency'}`.trim();
    log.info('Routed A&E encounter to triage queue', {
      priority: dto.priority || 'Urgent',
    });
  } else if (isNhisReferral) {
    // NHIS referral patients go to NHIS Specialty Approval Queue FIRST
    // After NHIS approval, nhis.api.ts approveSpecialtyReferral() routes them onward
    initialDepartment = 'NHIS Specialty Queue';
    initialStage = 'registration'; // Not yet at payment stage
    const specialtyModule =
      dto.specialty_module || specialtyInfo?.specialty || 'Consultation';
    const targetLocation =
      specialtyModule.charAt(0).toUpperCase() + specialtyModule.slice(1);
    queueNoteOverride = `NHIS Internal Referral - Awaiting NHIS Specialty Approval for ${targetLocation} [SPECIALTY_NEXT:${targetLocation}]`;
    log.info('Queued NHIS referral for specialty approval', {
      specialtyModule,
    });
  }

  // AUTO-CREATE BILLING ORDER for consultation fee (ALL patients - including NHIS)
  // REQUIREMENT: All billable services must have billing records with NHIS fields
  // NHIS patients: Consultation is 100% free, but billing record is still required for audit
  // Cash/POS patients: Normal billing, patient pays consultation fee
  await createConsultationBillingOrder(
    visit.id, // UUID - billing_orders.visit_id references visits.id (UUID)
    visit.id, // UUID for encounter_id (same as visit_id for visits)
    dto.patient_id,
    resolvedClinic.id,
    dto.visit_type,
    staffUuid,
    insuranceType || '', // Pass insurance type for NHIS calculation
  );

  // Use atomic create_queue_ticket RPC for reliable ticket generation + queue insertion
  let queueEntry: any = null;
  const queueNotes =
    queueNoteOverride ||
    `New encounter - awaiting payment verification. ${dto.chief_complaint || ''}`.trim();

  const { data: queueResult, error: rpcError } = await supabase.rpc(
    'create_queue_ticket',
    {
      p_dept: initialDepartment,
      p_patient_id: dto.patient_id,
      p_visit_id: visit.id,
      p_encounter_id: visit.id,
      p_clinic_id: resolvedClinic.id,
      p_priority: dto.priority || 'Normal',
      p_notes: queueNotes,
    },
  );

  if (rpcError || !queueResult?.success) {
    // Fallback to direct insert if RPC doesn't exist or fails
    log.warn(
      'Atomic queue ticket creation failed during encounter creation; using fallback insertion path',
      {
        department: initialDepartment,
        reason: rpcError?.message || queueResult?.error,
      },
    );
    const fallbackTicket = Math.floor(Date.now() % 10000);

    const { data: fallbackQueue, error: queueError } = await supabase
      .from('queue')
      .insert({
        patient_id: dto.patient_id,
        visit_id: visit.id,
        encounter_id: visit.id,
        location: initialDepartment,
        ticket_number: fallbackTicket.toString(),
        priority: dto.priority || 'Normal',
        clinic_id: resolvedClinic.id,
        status: 'Waiting',
        notes: queueNotes,
      })
      .select()
      .single();

    if (queueError) throw queueError;
    queueEntry = fallbackQueue;
  } else {
    // RPC succeeded - fetch the created queue entry
    const { data: createdQueue } = await supabase
      .from('queue')
      .select()
      .eq('id', queueResult.queue_id)
      .single();
    queueEntry = createdQueue;
    log.info('Created initial queue entry with atomic ticket generation', {
      department: initialDepartment,
      stage: initialStage,
    });
  }

  return {
    ...visit,
    current_stage: initialStage,
    registration_time: visit.start_time,
    queue_entry: queueEntry,
  } as EncounterDTO;
}

// =============================================================================
// Transition Encounter Stage
// =============================================================================

export async function transitionEncounter(
  dto: TransitionEncounterDTO,
): Promise<EncounterDTO> {
  const encounter = await getEncounter(dto.visit_id);

  // Validate transition
  if (!canTransition(encounter.current_stage, dto.next_stage)) {
    throw new Error(
      `Invalid transition from ${encounter.current_stage} to ${dto.next_stage}`,
    );
  }

  // Use encounter.visit_id for updates (the correct VARCHAR display ID)
  const visitIdForUpdate = encounter.visit_id;

  // Update visit status if completing
  if (dto.next_stage === 'completed') {
    const { error: visitError } = await supabase
      .from('visits')
      .update({
        status: 'Completed',
        end_time: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('visit_id', visitIdForUpdate);

    if (visitError) throw visitError;

    // Complete any queue entries
    if (encounter.queue_entry) {
      await supabase
        .from('queue')
        .update({
          status: 'Completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', (encounter.queue_entry as any).id);
    }
  } else {
    // Move to appropriate department queue
    const targetDepartment =
      dto.target_department || mapStageToDepartment(dto.next_stage);
    await moveToQueue({
      visit_id: encounter.id,
      patient_id: encounter.patient_id,
      department: targetDepartment as any,
      priority: encounter.priority,
      clinic_id: encounter.clinic_id || undefined,
      notes: dto.notes,
    });

    // Update visit current_stage explicitly
    await supabase
      .from('visits')
      .update({
        current_stage: dto.next_stage,
        updated_at: new Date().toISOString(),
      })
      .eq('visit_id', visitIdForUpdate);
  }

  return getEncounter(encounter.visit_id);
}

// =============================================================================
// Move Patient to Queue
// =============================================================================

export async function moveToQueue(dto: MoveToQueueDTO): Promise<void> {
  // Complete ALL active queue entries for this encounter to avoid unique-index conflicts.
  // Use both visit_id and encounter_id to catch entries regardless of which field was set.
  const { data: activeEntries } = await supabase
    .from('queue')
    .select('id')
    .or(`visit_id.eq.${dto.visit_id},encounter_id.eq.${dto.visit_id}`)
    .in('status', ['Waiting', 'Called', 'In Progress']);

  if (activeEntries && activeEntries.length > 0) {
    const ids = activeEntries.map((e) => e.id);
    await supabase
      .from('queue')
      .update({
        status: 'Completed',
        completed_at: new Date().toISOString(),
      })
      .in('id', ids);
    log.info('Completed active queue entries before move', {
      completedCount: ids.length,
      department: dto.department,
    });
  }

  // Use atomic create_queue_ticket RPC for reliable ticket generation + queue insertion
  const dbDepartment = normalizeDepartmentForQueue(dto.department);

  const { data: queueResult, error: rpcError } = await supabase.rpc(
    'create_queue_ticket',
    {
      p_dept: dbDepartment,
      p_patient_id: dto.patient_id,
      p_visit_id: dto.visit_id,
      p_encounter_id: dto.visit_id,
      p_clinic_id: dto.clinic_id,
      p_priority: dto.priority || 'Normal',
      p_notes: dto.notes,
    },
  );

  if (rpcError || !queueResult?.success) {
    // Fallback: If the RPC failed due to a duplicate key, the previous completion
    // may not have committed yet. Try an upsert-style approach: complete any
    // remaining active entries at the exact target location, then insert.
    log.warn(
      'Atomic queue ticket creation failed; using fallback insertion path',
      {
        department: dbDepartment,
        reason: rpcError?.message || queueResult?.error,
      },
    );

    // Second-pass cleanup — target the specific location that caused the conflict
    await supabase
      .from('queue')
      .update({ status: 'Completed', completed_at: new Date().toISOString() })
      .or(`visit_id.eq.${dto.visit_id},encounter_id.eq.${dto.visit_id}`)
      .eq('location', dbDepartment)
      .in('status', ['Waiting', 'Called', 'In Progress']);

    const fallbackTicket = Math.floor(Date.now() % 10000);

    const { error } = await supabase.from('queue').insert({
      patient_id: dto.patient_id,
      visit_id: dto.visit_id,
      encounter_id: dto.visit_id,
      location: dbDepartment,
      ticket_number: fallbackTicket.toString(),
      priority: dto.priority || 'Normal',
      clinic_id: dto.clinic_id,
      status: 'Waiting',
      notes: dto.notes,
    });

    if (error) {
      // If STILL a duplicate, the entry already exists at this location — log but don't crash
      if (error.code === '23505') {
        log.warn(
          'Queue entry already exists at destination; skipping duplicate insert',
          {
            department: dbDepartment,
          },
        );
      } else {
        throw error;
      }
    }
  } else {
    log.info('Created queue entry with atomic ticket generation', {
      department: dbDepartment,
    });
  }
}

// =============================================================================
// Record Payment for Encounter
// =============================================================================

export async function recordEncounterPayment(
  visitId: string,
  amount: number,
  paymentMethod: string,
  receiptNumber?: string,
): Promise<void> {
  const encounter = await getEncounter(visitId);

  // Get or create billing record
  let billingId = encounter.billing_id;

  if (!billingId) {
    const { data: billing, error: billingError } = await supabase
      .from('billing_orders')
      .insert({
        patient_id: encounter.patient_id,
        visit_id: encounter.id,
        total_amount: amount,
        paid_amount: amount,
        payment_method: paymentMethod,
        status: 'Paid',
      })
      .select()
      .single();

    if (billingError) throw billingError;
    billingId = billing.id;
  } else {
    // Update existing billing record
    const newPaidAmount = (encounter.total_paid || 0) + amount;
    const { error } = await supabase
      .from('billing_orders')
      .update({
        paid_amount: newPaidAmount,
        payment_method: paymentMethod,
        status:
          newPaidAmount >= (encounter.total_charges || 0)
            ? 'Paid'
            : 'Partially_Paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', billingId);

    if (error) throw error;
  }

  // If payment was required first and now paid, determine next destination
  if (
    requiresPaymentFirst(encounter.payment_category) &&
    encounter.current_stage === 'payment'
  ) {
    // ALL patients (including specialty clinics) go to Nursing for vitals first.
    // Specialty clinics will be routed to their specialty queue AFTER nursing care.
    const specialtyInfo = await detectSpecialtyClinic(encounter.clinic_id);

    if (specialtyInfo.isSpecialty) {
      // Specialty clinics: Go to Nursing FIRST, then specialty queue after vitals
      await moveToQueue({
        visit_id: encounter.id,
        patient_id: encounter.patient_id,
        department: 'Nursing',
        clinic_id: encounter.clinic_id,
        priority: encounter.priority,
        notes: `Payment verified, proceeding to Nursing for vitals [SPECIALTY_NEXT:${specialtyInfo.queueLocation}]`,
      });
    } else {
      // Regular clinics: Go to Nursing for vitals
      await moveToQueue({
        visit_id: encounter.id,
        patient_id: encounter.patient_id,
        department: 'Nursing',
        priority: encounter.priority,
        notes: 'Payment received, proceeding to vitals',
      });
    }
  } else if (encounter.current_stage === 'billing_final') {
    // If in final billing stage, complete the encounter
    await completeEncounter(visitId);
  }
}

// =============================================================================
// Complete Encounter
// =============================================================================

export async function completeEncounter(visitId: string): Promise<void> {
  // Get the UUID first
  const { data: visit } = await supabase
    .from('visits')
    .select('id')
    .eq('visit_id', visitId)
    .single();

  const { error } = await supabase
    .from('visits')
    .update({
      status: 'Completed',
      end_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('visit_id', visitId);

  if (error) throw error;

  if (visit) {
    // Complete any open queue entries
    await supabase
      .from('queue')
      .update({
        status: 'Completed',
        completed_at: new Date().toISOString(),
      })
      .eq('visit_id', visit.id)
      .in('status', ['Waiting', 'Called', 'In Progress']);
  }
}

// =============================================================================
// Cancel Encounter
// =============================================================================

/**
 * Check if an encounter has any paid billing orders
 * @returns Object with hasPaid flag and count of paid orders
 */
export async function checkEncounterPaymentStatus(visitId: string): Promise<{
  hasPaidOrders: boolean;
  paidOrdersCount: number;
  totalPaidAmount: number;
}> {
  // First get the encounter UUID from the visits table
  const { data: visit } = await supabase
    .from('visits')
    .select('id')
    .eq('visit_id', visitId)
    .single();

  if (!visit) {
    return { hasPaidOrders: false, paidOrdersCount: 0, totalPaidAmount: 0 };
  }

  // Query billing orders using the UUID (visit.id) for both visit_id and encounter_id columns
  // Both columns are UUID type, so we use the resolved UUID from the visits table
  const { data, error } = await supabase
    .from('billing_orders')
    .select('id, total_amount, net_amount, paid_amount, status')
    .or(`visit_id.eq.${visit.id},encounter_id.eq.${visit.id}`)
    .in('status', ['Paid', 'Paid_NHIS', 'Paid_Retainership']);

  if (error) throw error;

  const paidOrders = data || [];
  const totalPaidAmount = paidOrders.reduce(
    (sum, order) =>
      sum + (order.paid_amount || order.net_amount || order.total_amount || 0),
    0,
  );

  return {
    hasPaidOrders: paidOrders.length > 0,
    paidOrdersCount: paidOrders.length,
    totalPaidAmount,
  };
}

/**
 * Check if patient is currently admitted (inpatient)
 */
export async function checkPatientAdmissionStatus(patientId: string): Promise<{
  isAdmitted: boolean;
  admissionId?: string;
  wardName?: string;
  bedNumber?: string;
  admissionDate?: string;
}> {
  const { data, error } = await supabase
    .from('patient_admission_status_view')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error) throw error;

  if (data?.is_currently_admitted) {
    return {
      isAdmitted: true,
      admissionId: data.current_admission_id,
      wardName: data.current_ward_name,
      bedNumber: data.current_bed_number,
      admissionDate: data.admission_date,
    };
  }

  return { isAdmitted: false };
}

/**
 * Get current location for an encounter based on active queue entries
 * Returns the most recent/active queue location for the encounter
 */
export async function getCurrentEncounterLocation(visitId: string): Promise<{
  location: string | null;
  status: string | null;
  department: string | null;
  isInQueue: boolean;
  queuedAt?: string;
}> {
  // First get the encounter details including current_stage
  const { data: visit } = await supabase
    .from('visits')
    .select('id, current_stage')
    .eq('visit_id', visitId)
    .single();

  if (!visit) {
    return { location: null, status: null, department: null, isInQueue: false };
  }

  // Map location to friendly display name
  const locationDisplayMap: Record<string, string> = {
    Billing: 'Billing/Payment',
    Nursing: 'Nursing Station',
    Consultation: 'Doctor Consultation',
    Laboratory: 'Laboratory',
    Radiology: 'Radiology',
    Pharmacy: 'Pharmacy',
    Dental: 'Dental Clinic',
    Ophthalmology: 'Eye Clinic',
    Physiotherapy: 'Physiotherapy',
    Reception: 'Reception',
  };

  // Map workflow stage to department/location
  const stageToLocation: Record<string, string> = {
    registration: 'Reception',
    registered: 'Billing', // After registration, patient goes to Billing
    payment: 'Billing',
    nursing_vitals: 'Nursing',
    consultation: 'Consultation',
    lab: 'Laboratory',
    radiology: 'Radiology',
    pharmacy: 'Pharmacy',
    dental: 'Dental',
    ophthalmology: 'Ophthalmology',
    physiotherapy: 'Physiotherapy',
    discharge: 'Discharge',
    completed: 'Completed',
  };

  // Try to find active queue entry using separate queries (more reliable than .or())
  let queueEntry = null;

  // First try by visit_id (UUID)
  const { data: queueByVisitId, error: err1 } = await supabase
    .from('queue')
    .select('location, status, created_at')
    .eq('visit_id', visit.id)
    .in('status', [
      'Waiting',
      'Called',
      'In Progress',
      'Ready_For_Consultation',
    ])
    .order('created_at', { ascending: false })
    .limit(1);

  log.debug('Checked queue by visit_id for encounter location', {
    hasQueueEntry: Boolean(queueByVisitId && queueByVisitId.length > 0),
    hasError: Boolean(err1),
  });

  if (queueByVisitId && queueByVisitId.length > 0) {
    queueEntry = queueByVisitId[0];
  } else {
    // Try by encounter_id
    const { data: queueByEncounterId, error: err2 } = await supabase
      .from('queue')
      .select('location, status, created_at')
      .eq('encounter_id', visit.id)
      .in('status', [
        'Waiting',
        'Called',
        'In Progress',
        'Ready_For_Consultation',
      ])
      .order('created_at', { ascending: false })
      .limit(1);

    log.debug('Checked queue by encounter_id for encounter location', {
      hasQueueEntry: Boolean(
        queueByEncounterId && queueByEncounterId.length > 0,
      ),
      hasError: Boolean(err2),
    });

    if (queueByEncounterId && queueByEncounterId.length > 0) {
      queueEntry = queueByEncounterId[0];
    }
  }

  log.debug('Resolved encounter location', {
    hasQueueEntry: Boolean(queueEntry),
    currentStage: visit.current_stage,
  });

  // If we found a queue entry, use it
  if (queueEntry) {
    return {
      location: queueEntry.location
        ? locationDisplayMap[queueEntry.location] || queueEntry.location
        : null,
      status: queueEntry.status,
      department: queueEntry.location,
      isInQueue: true,
      queuedAt: queueEntry.created_at,
    };
  }

  // Fallback: Use current_stage from visit record
  if (visit.current_stage) {
    const department =
      stageToLocation[visit.current_stage] || visit.current_stage;
    const displayLocation = locationDisplayMap[department] || department;

    return {
      location: displayLocation,
      status: 'Active',
      department,
      isInQueue: false, // Not in queue but has a known stage
      queuedAt: undefined,
    };
  }

  // No location found
  return { location: null, status: null, department: null, isInQueue: false };
}

/**
 * Fetch the configurable encounter expiry hours from system_configurations.
 * Returns the appropriate expiry based on OPD classification and encounter category.
 * Falls back to 504 hours (3 weeks) if no config found.
 */
async function getEncounterExpiryHours(
  opdClassification?: string | null,
  encounterCategory?: string | null,
): Promise<number> {
  const DEFAULT_HOURS = 504; // 3 weeks

  // Determine which config key to look up
  let configKey = 'encounter.expiry.gopd_outpatient_hours';
  if (encounterCategory === 'emergency') {
    configKey = 'encounter.expiry.emergency_hours';
  } else if (encounterCategory === 'day_case') {
    configKey = 'encounter.expiry.day_case_hours';
  } else if (opdClassification === 'SOPD') {
    configKey = 'encounter.expiry.specialty_outpatient_hours';
  }

  const { data, error } = await supabase
    .from('system_configurations')
    .select('value')
    .eq('key', configKey)
    .eq('is_active', true)
    .single();

  if (error || !data) return DEFAULT_HOURS;

  const parsed = Number(data.value);
  return !isNaN(parsed) && parsed > 0 ? parsed : DEFAULT_HOURS;
}

/**
 * Determine patient classification (Outpatient/Inpatient)
 * Uses admin-configurable expiry settings from system_configurations.
 */
export async function getPatientClassification(visitId: string): Promise<{
  classification: 'Outpatient' | 'Inpatient';
  encounterAge: number; // hours since encounter creation
  isExpired: boolean;
  expiryReason?: string;
}> {
  const { data: visit, error } = await supabase
    .from('visits')
    .select('id, patient_id, visit_type, created_at, status, opd_classification, encounter_category')
    .eq('visit_id', visitId)
    .single();

  if (error) throw error;
  if (!visit) throw new Error('Encounter not found');

  // Check if patient is admitted
  const admissionStatus = await checkPatientAdmissionStatus(visit.patient_id);

  const encounterAge =
    (Date.now() - new Date(visit.created_at).getTime()) / (1000 * 60 * 60); // hours

  if (admissionStatus.isAdmitted) {
    // Inpatient - encounter expires on discharge (handled separately)
    return {
      classification: 'Inpatient',
      encounterAge,
      isExpired: false,
    };
  }

  // Fetch configurable expiry hours from system_configurations
  const expiryHours = await getEncounterExpiryHours(
    visit.opd_classification,
    visit.encounter_category,
  );

  const isExpired = encounterAge > expiryHours && visit.status === 'Active';
  return {
    classification: 'Outpatient',
    encounterAge,
    isExpired,
    expiryReason: isExpired
      ? `Outpatient encounter exceeded ${expiryHours}-hour limit`
      : undefined,
  };
}

/**
 * Cancel an encounter with validation checks
 *
 * WORKFLOW ENFORCEMENT:
 * When an encounter is cancelled:
 * 1. Remove from Billing queue
 * 2. Remove from Nursing Care queue (if already routed)
 * 3. Remove from any Specialty queues (Dental, Ophthalmology, Physiotherapy)
 * 4. Cancel all pending billing orders
 * 5. Exclude from all billing calculations, exports, and financial records
 */
export async function cancelEncounter(
  visitId: string,
  reason?: string,
): Promise<void> {
  // Get the visit details first
  const { data: visit } = await supabase
    .from('visits')
    .select('id, patient_id, status')
    .eq('visit_id', visitId)
    .single();

  if (!visit) throw new Error('Encounter not found');

  // Check if encounter is already completed or cancelled
  if (visit.status === 'Completed') {
    throw new Error('Cannot cancel a completed encounter');
  }
  if (visit.status === 'Cancelled') {
    throw new Error('Encounter is already cancelled');
  }

  // Check for paid billing orders - paid encounters cannot be cancelled
  const paymentStatus = await checkEncounterPaymentStatus(visitId);
  if (paymentStatus.hasPaidOrders) {
    throw new Error(
      `Cannot cancel encounter with verified payments. ${paymentStatus.paidOrdersCount} order(s) totaling ₦${paymentStatus.totalPaidAmount.toLocaleString()} have been paid. Please process a refund first.`,
    );
  }

  const nowIso = new Date().toISOString();
  const cancellationNote = reason || 'Encounter cancelled by administrator';

  // =============================================================================
  // 1. Update visit/encounter status to Cancelled
  // =============================================================================
  const { error } = await supabase
    .from('visits')
    .update({
      status: 'Cancelled',
      end_time: nowIso,
      updated_at: nowIso,
      closed_reason: cancellationNote,
    })
    .eq('visit_id', visitId);

  if (error) throw error;

  // =============================================================================
  // 2. Cancel ALL queue entries - Billing, Nursing, and Specialty queues
  // Use both visit.id (UUID) and visitId (VARCHAR) to catch all entries
  // =============================================================================
  const queueCancellationNote = `Cancelled: ${cancellationNote}`;

  // Cancel by UUID (visit.id)
  await supabase
    .from('queue')
    .update({
      status: 'Cancelled',
      completed_at: nowIso,
      notes: queueCancellationNote,
    })
    .eq('visit_id', visit.id)
    .in('status', ['Waiting', 'Called', 'In Progress']);

  // Cancel by encounter_id (UUID) for newer entries
  await supabase
    .from('queue')
    .update({
      status: 'Cancelled',
      completed_at: nowIso,
      notes: queueCancellationNote,
    })
    .eq('encounter_id', visit.id)
    .in('status', ['Waiting', 'Called', 'In Progress']);

  // =============================================================================
  // 3. Cancel ALL pending billing orders for this encounter
  // This ensures cancelled encounters never contribute to financial records
  // =============================================================================

  // Cancel by visit_id (VARCHAR display ID)
  await supabase
    .from('billing_orders')
    .update({
      status: 'Cancelled',
      updated_at: nowIso,
    })
    .eq('visit_id', visitId)
    .in('status', ['Pending', 'Awaiting_Payment']);

  // Cancel by encounter_id (UUID) for newer entries
  await supabase
    .from('billing_orders')
    .update({
      status: 'Cancelled',
      updated_at: nowIso,
    })
    .eq('encounter_id', visit.id)
    .in('status', ['Pending', 'Awaiting_Payment']);

  // =============================================================================
  // 4. Cancel any associated billing items
  // =============================================================================
  const { data: billingOrders } = await supabase
    .from('billing_orders')
    .select('id')
    .or(`visit_id.eq.${visitId},encounter_id.eq.${visit.id}`)
    .eq('status', 'Cancelled');

  if (billingOrders && billingOrders.length > 0) {
    const billingOrderIds = billingOrders.map((o) => o.id);
    await supabase
      .from('billing_items')
      .update({
        status: 'Cancelled',
      })
      .in('billing_order_id', billingOrderIds);
  }
}

// =============================================================================
// Auto-Close Expired Outpatient Encounters
// =============================================================================

/**
 * Close expired outpatient encounters (older than 24 hours)
 * This should be called periodically (e.g., on app load or via scheduled job)
 */
export async function closeExpiredOutpatientEncounters(): Promise<{
  closedCount: number;
  closedIds: string[];
}> {
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  // Find active outpatient encounters older than 24 hours
  // Exclude inpatient visit types
  const inpatientTypes = ['In-Patient', 'Inpatient', 'Admission', 'Ward'];

  // Note: visit_status enum only has Active, Completed, Cancelled, Created, Closed, Discharged, Registered
  // 'Waiting' and 'In Progress' are queue statuses, not visit statuses
  const { data: expiredEncounters, error: fetchError } = await supabase
    .from('visits')
    .select('visit_id, patient_id, visit_type')
    .in('status', ['Active', 'Created', 'Registered'])
    .lt('created_at', twentyFourHoursAgo);

  if (fetchError) throw fetchError;

  // Filter out inpatient encounters
  const outpatientExpired = (expiredEncounters || []).filter(
    (enc) =>
      !inpatientTypes.some((type) =>
        enc.visit_type?.toLowerCase().includes(type.toLowerCase()),
      ),
  );

  if (outpatientExpired.length === 0) {
    return { closedCount: 0, closedIds: [] };
  }

  const visitIds = outpatientExpired.map((e) => e.visit_id);

  // Close the expired encounters
  const { error: updateError } = await supabase
    .from('visits')
    .update({
      status: 'Closed',
      end_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      closed_reason: 'Auto-closed: Outpatient encounter exceeded 24-hour limit',
    })
    .in('visit_id', visitIds);

  if (updateError) throw updateError;

  return { closedCount: visitIds.length, closedIds: visitIds };
}

/**
 * Close encounter when patient is discharged (for inpatients)
 */
export async function closeEncounterOnDischarge(
  admissionId: string,
  visitId: string,
): Promise<void> {
  const { error } = await supabase
    .from('visits')
    .update({
      status: 'Closed',
      end_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      discharge_date: new Date().toISOString(),
      closed_reason: 'Closed on patient discharge',
    })
    .eq('visit_id', visitId);

  if (error) throw error;
}

// =============================================================================
// Get Encounter Statistics
// =============================================================================

export interface EncounterStats {
  total_today: number;
  active: number;
  completed: number;
  cancelled: number;
  waiting: number;
  in_consultation: number;
  pending_payment: number;
  by_payment_category: Record<string, number>;
  by_stage: Record<WorkflowStage, number>;
  average_duration_minutes: number;
  // Inpatient stats
  admitted: number;
  total_beds: number;
  occupied_beds: number;
  // Staff stats
  active_doctors: number;
  // Detailed Real-time Stats
  pharmacy_queued: number;
  lab_pending: number;
  billing_pending: number;
  triage_queue: number;
  consultation_average_wait_minutes: number;
  consultation_wait_target_minutes: number;
  lab_average_wait_minutes: number;
  inactive_doctors: number;
  doctor_performance: {
    doctor_id: string;
    doctor_name: string;
    status: 'Active' | 'Inactive';
    consultations: number;
    avg_wait_minutes: number | null;
    throughput_score: number;
    wait_score: number;
    performance_score: number;
  }[];
}

export async function getEncounterStats(): Promise<EncounterStats> {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().setDate(1))
    .toISOString()
    .split('T')[0];
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const CONSULTATION_WAIT_TARGET_MINUTES = 30;

  // Parallel fetch for visits and inpatient stats
  const [
    todayVisitsResult,
    activeVisitsResult,
    bedsResult,
    admissionsResult,
    onlineDoctorsResult,
    pharmacyResult,
    labResult,
    billingResult,
    radiusResult,
    triageResult,
    consultationResult,
    doctorsResult,
    consultationsForDoctorsResult,
    consultationQueueRowsResult,
    labWaitSamplesResult,
  ] = await Promise.all([
    // 1. Today's visits
    supabase.from('visits').select(VISIT_STATS_SELECT).gte('created_at', today),
    // 2. Active visits (carry-over)
    supabase
      .from('visits')
      .select(VISIT_STATS_SELECT)
      .eq('status', 'Active')
      .lt('created_at', today),
    // 3. Bed stats
    supabase.from('beds').select('status'),
    // 4. Admissions
    supabase
      .from('active_admissions_view')
      .select('admission_id', { count: 'exact', head: true }),
    // 5. Active Doctors
    supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'doctor')
      .eq('is_active', true)
      .gte('last_activity', fiveMinutesAgo),
    // 6. Pharmacy Queued (Pending prescriptions)
    supabase
      .from('prescriptions')
      .select('prescription_id', { count: 'exact', head: true })
      .in('status', ['Pending', 'Awaiting_Payment', 'Partial']),
    // 7. Lab Pending (Pending requests)
    supabase
      .from('lab_requests')
      .select('request_id', { count: 'exact', head: true })
      .in('status', [
        'Pending',
        'Sample Collected',
        'Processing',
        'Awaiting_Payment',
      ]),
    // 8. Billing Pending
    supabase
      .from('billing_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['Pending', 'Awaiting_Payment', 'Partially_Paid']),
    // 9. Radiology Pending (optional, adding to lab count for now or separate if needed)
    supabase
      .from('radiology_requests')
      .select('request_id', { count: 'exact', head: true })
      .in('status', ['Pending', 'Processing']),
    // 10. Triage Queue (Nursing) - All active queue items
    supabase
      .from('queue')
      .select('id', { count: 'exact', head: true })
      .eq('location', 'Nursing')
      .in('status', ['Waiting', 'Called', 'In Progress']), // Ensure we capture all active states
    // 11. Active Consultations - All active queue items in Consultation
    supabase
      .from('queue')
      .select('id', { count: 'exact', head: true })
      .eq('location', 'Consultation')
      .in('status', ['Waiting', 'Called', 'In Progress']), // Changed from just 'In Progress' to all active states per user request
    // 12. All doctors (for inclusive performance table)
    supabase
      .from('staff')
      .select('id, staff_id, first_name, last_name')
      .eq('role', 'doctor')
      .eq('is_active', true),
    // 13. Consultations by doctor (month-to-date throughput)
    supabase
      .from('consultations')
      .select('doctor_id')
      .gte('created_at', firstOfMonth),
    // 14. Consultation queue wait samples (month-to-date)
    supabase
      .from('queue')
      .select(
        'assigned_to, created_at, called_at, consultation_start_time, location',
      )
      .eq('location', 'Consultation')
      .gte('created_at', firstOfMonth),
    // 15. Lab requests wait samples (month-to-date)
    supabase
      .from('lab_requests')
      .select('created_at, processed_at')
      .in('status', ['Completed', 'Reported'])
      .gte('created_at', firstOfMonth),
  ]);

  // Combine today's visits with any still-active visits from previous days
  const todayVisits = todayVisitsResult.data || [];
  const carryOverActive = activeVisitsResult.data || [];
  const visits = [...todayVisits, ...carryOverActive];

  if (todayVisitsResult.error) throw todayVisitsResult.error;

  // Inpatient stats
  const total_beds = bedsResult.data?.length || 0;
  const occupied_beds =
    bedsResult.data?.filter((b) => b.status?.toLowerCase() === 'occupied')
      .length || 0;
  const admitted = admissionsResult.count || 0;

  // Count online doctors (active in last 5 minutes)
  const active_doctors = onlineDoctorsResult.count || 0;

  // Real-time dept stats
  const pharmacy_queued = pharmacyResult.count || 0;
  const lab_pending = (labResult.count || 0) + (radiusResult.count || 0);
  const billing_pending = billingResult.count || 0;
  const triage_queue = triageResult.count || 0;
  const active_consultations = consultationResult.count || 0;

  // Build doctor performance rows for dashboard table.
  const waitSamplesByDoctorId: Record<string, number[]> = {};
  const consultationWaitSamples: number[] = [];
  (consultationQueueRowsResult.data || []).forEach((row) => {
    if (!row.created_at) return;
    const waitEnd = row.consultation_start_time || row.called_at;
    if (!waitEnd) return;

    const waitMins = Math.round(
      (new Date(waitEnd).getTime() - new Date(row.created_at).getTime()) /
        60000,
    );
    if (waitMins < 0 || waitMins > 1000) return;

    consultationWaitSamples.push(waitMins);
    if (row.assigned_to) {
      if (!waitSamplesByDoctorId[row.assigned_to]) {
        waitSamplesByDoctorId[row.assigned_to] = [];
      }
      waitSamplesByDoctorId[row.assigned_to].push(waitMins);
    }
  });

  const consultation_average_wait_minutes =
    consultationWaitSamples.length > 0
      ? Math.round(
          consultationWaitSamples.reduce((sum, mins) => sum + mins, 0) /
            consultationWaitSamples.length,
        )
      : 0;

  // Calculate Lab average wait time
  const labWaitSamples: number[] = [];
  (labWaitSamplesResult.data || []).forEach((row) => {
    if (!row.created_at || !row.processed_at) return;
    const requestDate = new Date(row.created_at).getTime();
    const processedDate = new Date(row.processed_at).getTime();
    const waitMins = Math.round((processedDate - requestDate) / 60000);
    if (waitMins >= 0 && waitMins < 10000) {
      // Max ~1 week to filter anomalies
      labWaitSamples.push(waitMins);
    }
  });

  const lab_average_wait_minutes =
    labWaitSamples.length > 0
      ? Math.round(
          labWaitSamples.reduce((sum, mins) => sum + mins, 0) /
            labWaitSamples.length,
        )
      : 0;

  const consultCountByDoctorKey: Record<string, number> = {};
  (consultationsForDoctorsResult.data || []).forEach((consultation) => {
    const key = consultation.doctor_id;
    if (!key) return;
    consultCountByDoctorKey[key] = (consultCountByDoctorKey[key] || 0) + 1;
  });

  const doctors = doctorsResult.data || [];
  const maxConsultations = Math.max(
    1,
    ...doctors.map((doc) => {
      const byStaffId = doc.staff_id
        ? consultCountByDoctorKey[doc.staff_id] || 0
        : 0;
      const byId = consultCountByDoctorKey[doc.id] || 0;
      return Math.max(byStaffId, byId);
    }),
  );

  const doctor_performance = doctors
    .map((doctor) => {
      const byStaffId = doctor.staff_id
        ? consultCountByDoctorKey[doctor.staff_id] || 0
        : 0;
      const byId = consultCountByDoctorKey[doctor.id] || 0;
      const consultations = Math.max(byStaffId, byId);

      const doctorWaits = waitSamplesByDoctorId[doctor.id] || [];
      const avg_wait_minutes =
        doctorWaits.length > 0
          ? Math.round(
              doctorWaits.reduce((sum, mins) => sum + mins, 0) /
                doctorWaits.length,
            )
          : null;

      const throughput_score = Math.round(
        (consultations / maxConsultations) * 100,
      );
      const wait_score =
        avg_wait_minutes === null
          ? consultations > 0
            ? 60
            : 50
          : Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  (1 -
                    avg_wait_minutes / (CONSULTATION_WAIT_TARGET_MINUTES * 2)) *
                    100,
                ),
              ),
            );

      const status: 'Active' | 'Inactive' =
        consultations > 0 ? 'Active' : 'Inactive';
      const performance_score =
        status === 'Inactive'
          ? 50
          : Math.round(wait_score * 0.6 + throughput_score * 0.4);

      return {
        doctor_id: doctor.id,
        doctor_name:
          `Dr. ${doctor.first_name || ''} ${doctor.last_name || ''}`.trim() ||
          'Unknown Doctor',
        status,
        consultations,
        avg_wait_minutes,
        throughput_score,
        wait_score,
        performance_score,
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Active' ? -1 : 1;
      if (b.performance_score !== a.performance_score) {
        return b.performance_score - a.performance_score;
      }
      return a.doctor_name.localeCompare(b.doctor_name);
    });

  const inactive_doctors = doctor_performance.filter(
    (doctor) => doctor.status === 'Inactive',
  ).length;

  // Get active visit IDs to fetch queue entries
  const activeVisitIds = visits
    .filter((v) => v.status === 'Active')
    .map((v) => v.id);

  // Fetch queue entries for active visits
  const queueMap = new Map<string, any>();
  if (activeVisitIds.length > 0) {
    const { data: queueEntries } = await supabase
      .from('queue')
      .select(QUEUE_SELECT)
      .in('visit_id', activeVisitIds)
      .in('status', ['Waiting', 'In Progress', 'Called'])
      .order('created_at', { ascending: false });

    if (queueEntries) {
      queueEntries.reverse().forEach((q) => {
        queueMap.set(q.visit_id, q);
      });
    }
  }

  // Initialize counters
  let waiting = 0;
  let in_consultation = 0;
  // let pending_payment = 0; // We employ direct count now
  const by_stage: Record<string, number> = {};

  // Calculate stage-based stats for active visits
  (visits || [])
    .filter((v) => v.status === 'Active')
    .forEach((visit) => {
      const queueEntry = queueMap.get(visit.id);
      const stage = mapVisitToStageForStats(visit, queueEntry);

      // Increment stage count
      by_stage[stage] = (by_stage[stage] || 0) + 1;

      // Calculate specific counters
      if (stage === 'consultation') {
        // Only count as in consultation if explicitly there
        if (queueEntry?.status === 'In Progress') {
          in_consultation++;
        }
      } else if (stage === 'queue_waiting' || stage === 'nursing_vitals') {
        waiting++;
      }
    });

  const stats: EncounterStats = {
    total_today: todayVisits.length || 0,
    active: visits.filter((v) => v.status === 'Active').length || 0,
    completed: todayVisits.filter((v) => v.status === 'Completed').length || 0,
    cancelled: todayVisits.filter((v) => v.status === 'Cancelled').length || 0,
    waiting,
    in_consultation: active_consultations,
    pending_payment: billing_pending, // Use direct count
    by_payment_category: {},
    by_stage: by_stage as Record<WorkflowStage, number>,
    average_duration_minutes: 0,
    admitted,
    total_beds,
    occupied_beds,
    active_doctors,
    pharmacy_queued,
    lab_pending,
    billing_pending,
    triage_queue,
    consultation_average_wait_minutes,
    consultation_wait_target_minutes: CONSULTATION_WAIT_TARGET_MINUTES,
    lab_average_wait_minutes,
    inactive_doctors,
    doctor_performance,
  };

  // Count by payment category (today's visits only)
  todayVisits.forEach((v) => {
    const cat = v.payment_category || 'Unknown';
    stats.by_payment_category[cat] = (stats.by_payment_category[cat] || 0) + 1;
  });

  // Calculate average duration for completed visits (today)
  const completedWithDuration = todayVisits.filter(
    (v) => v.status === 'Completed' && v.end_time,
  );
  if (completedWithDuration && completedWithDuration.length > 0) {
    const totalMinutes = completedWithDuration.reduce((sum, v) => {
      const start = new Date(v.start_time).getTime();
      const end = new Date(v.end_time).getTime();
      return sum + (end - start) / 60000;
    }, 0);
    stats.average_duration_minutes = Math.round(
      totalMinutes / completedWithDuration.length,
    );
  }

  return stats;
}

// Helper function to map visit to stage for stats calculation
function mapVisitToStageForStats(visit: any, queueEntry?: any): WorkflowStage {
  if (visit.status === 'Completed') return 'completed';
  if (visit.status === 'Cancelled') return 'completed';

  // Check queue entry
  if (queueEntry) {
    const location = queueEntry.location || queueEntry.department;

    switch (location) {
      case 'Billing':
        return 'payment';
      case 'Nursing':
        return 'nursing_vitals';
      case 'Consultation':
        return 'consultation';
      case 'Laboratory':
      case 'Lab':
        return 'lab_pending';
      case 'Radiology':
        return 'radiology_pending';
      case 'Pharmacy':
        return 'pharmacy_pending';
      case 'Registration':
      case 'Reception':
        return 'registration';
      default:
        return 'queue_waiting';
    }
  }

  // Fallback to visit.current_stage if available and valid
  if (visit.current_stage && visit.current_stage !== 'registered') {
    return visit.current_stage as WorkflowStage;
  }

  return 'registration';
}

// =============================================================================
// Start Consultation - Remove from Queue & Mark as In Consultation
// =============================================================================

/**
 * Start a consultation for an encounter.
 * This will:
 * 1. Update the queue entry status to 'In Progress' (removes from waiting queue)
 * 2. Set the assigned doctor on the queue entry
 * 3. Update the encounter's current_stage to 'consultation'
 * 4. Add the doctor to the encounter care team
 *
 * This ensures only one doctor can actively work on a patient at a time.
 */
export async function startConsultation(
  encounterId: string,
  doctorId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user info
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let staffUuid = doctorId;
    let staffName = '';
    let staffDepartment = '';

    if (!staffUuid && user) {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, first_name, last_name, department')
        .eq('email', user.email)
        .single();

      if (staffData) {
        staffUuid = staffData.id;
        staffName = `${staffData.first_name} ${staffData.last_name}`;
        staffDepartment = staffData.department || '';
      }
    }

    // First check if this encounter is already in consultation by another doctor
    const { data: existingQueue } = await supabase
      .from('queue')
      .select('id, status, assigned_to, started_at')
      .eq('visit_id', encounterId)
      .eq('location', 'Consultation')
      .eq('status', 'In Progress')
      .maybeSingle();

    if (
      existingQueue &&
      existingQueue.assigned_to &&
      existingQueue.assigned_to !== staffUuid
    ) {
      return {
        success: false,
        error: 'This patient is already in consultation with another doctor.',
      };
    }

    // Update queue entry to 'In Progress' and assign the doctor
    const { error: queueError } = await supabase
      .from('queue')
      .update({
        status: 'In Progress',
        assigned_to: staffUuid,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('visit_id', encounterId)
      .eq('location', 'Consultation')
      .in('status', ['Waiting', 'Called']);

    if (queueError) {
      log.error('Failed to update consultation queue state', queueError, {
        operation: 'start_consultation',
      });
      // Don't fail if queue update fails - continue with other updates
    }

    // Update visit current_stage and attending_doctor
    const { error: visitError } = await supabase
      .from('visits')
      .update({
        current_stage: 'consultation',
        attending_doctor_id: staffUuid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', encounterId);

    if (visitError) {
      log.error(
        'Failed to update visit when starting consultation',
        visitError,
        {
          operation: 'start_consultation',
        },
      );
      return { success: false, error: 'Failed to update encounter status.' };
    }

    // Add doctor to encounter care team (if not already)
    if (staffUuid) {
      const { error: careTeamError } = await supabase
        .from('encounter_care_team')
        .upsert(
          {
            encounter_id: encounterId,
            staff_id: staffUuid,
            staff_name: staffName,
            role: 'primary_doctor',
            department: staffDepartment,
            assigned_at: new Date().toISOString(),
            is_active: true,
          },
          {
            onConflict: 'encounter_id,staff_id,role',
          },
        );

      if (careTeamError) {
        log.error(
          'Failed to add clinician to encounter care team',
          careTeamError,
          {
            operation: 'start_consultation',
          },
        );
        // Non-fatal error
      }
    }

    return { success: true };
  } catch (error: any) {
    log.error('Failed to start consultation', error, {
      operation: 'start_consultation',
    });
    return {
      success: false,
      error: error.message || 'Failed to start consultation.',
    };
  }
}

/**
 * Cancel/End a consultation and optionally return patient to queue.
 * Used when a doctor needs to stop working on a patient mid-consultation.
 */
export async function cancelConsultation(
  encounterId: string,
  returnToQueue: boolean = false,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (returnToQueue) {
      // Reset queue entry back to 'Waiting'
      const { error: queueError } = await supabase
        .from('queue')
        .update({
          status: 'Waiting',
          assigned_to: null,
          started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('visit_id', encounterId)
        .eq('location', 'Consultation')
        .eq('status', 'In Progress');

      if (queueError) {
        log.error('Failed to reset consultation queue', queueError, {
          operation: 'cancel_consultation',
          returnToQueue,
        });
      }

      // Update visit to remove attending doctor
      await supabase
        .from('visits')
        .update({
          current_stage: 'consultation', // Stay in consultation stage
          attending_doctor_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', encounterId);
    }

    return { success: true };
  } catch (error: any) {
    log.error('Failed to cancel consultation', error, {
      operation: 'cancel_consultation',
      returnToQueue,
    });
    return { success: false, error: error.message };
  }
}

// =============================================================================
// Helper: Map Visit to Workflow Stage
// =============================================================================

function mapVisitToStage(
  visit: any,
  queueEntry?: any,
  labRequests?: any[],
  radiologyRequests?: any[],
  prescriptions?: any[],
): WorkflowStage {
  if (visit.status === 'Completed') return 'completed';
  if (visit.status === 'Cancelled') return 'completed';

  // Check for pending pharmacy
  if (
    prescriptions?.length &&
    prescriptions.some((p: any) => p.status === 'Pending')
  ) {
    return 'pharmacy_pending';
  }

  // Check for pending radiology
  if (
    radiologyRequests?.length &&
    radiologyRequests.some((r: any) => r.status === 'Pending')
  ) {
    return 'radiology_pending';
  }

  // Check for pending lab
  if (
    labRequests?.length &&
    labRequests.some((l: any) => l.status === 'Pending')
  ) {
    return 'lab_pending';
  }

  // Check queue entry
  if (queueEntry) {
    // Note: queue table uses 'location' column, but some parts of app might refer to it as department
    const location = queueEntry.location || queueEntry.department;

    switch (location) {
      case 'Billing':
        return 'payment';
      case 'Nursing':
        return 'nursing_vitals';
      case 'Consultation':
        return 'consultation';
      case 'Laboratory':
      case 'Lab':
        return 'lab_pending';
      case 'Radiology':
        return 'radiology_pending';
      case 'Pharmacy':
        return 'pharmacy_pending';
      case 'Registration':
      case 'Reception':
        return 'registration';
      default:
        return 'queue_waiting';
    }
  }

  // Fallback to visit.current_stage if available and valid
  if (visit.current_stage && visit.current_stage !== 'registered') {
    return visit.current_stage as WorkflowStage;
  }

  return 'registration';
}
