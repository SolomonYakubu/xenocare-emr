/**
 * =============================================================================
 * XENOCARE EMR - ENCOUNTER MODULE API
 * Description: Supabase API functions for encounters and clinics
 * =============================================================================
 */

import { supabase } from '../../../api/supabaseClient';
import { sanitizeFilterValue } from '../../../lib/filterSanitizer';
import {
  Encounter,
  CreateEncounterDTO,
  UpdateEncounterDTO,
  EncounterFilters,
  EncounterStats,
  Clinic,
  CreateClinicDTO,
  UpdateClinicDTO,
  ClinicFilters,
} from '../dtos/encounter.dto';
import { createScopedLogger } from '../../../utils/logger';
import {
  isSpecialtyClinicRecord,
  isSpecialtyClinicsEnabled,
} from '../../../config/features';

const log = createScopedLogger('EncounterAPI');

// =============================================================================
// ENCOUNTER API
// =============================================================================

/**
 * Helper function to find patient IDs by EMR number search
 * Supports partial like "1", "01", "001", "0001" for "NDC-0001"
 */
async function findPatientIdsByQuery(searchQuery: string): Promise<string[]> {
  if (!searchQuery || searchQuery.trim().length === 0) return [];

  const cleanQuery = searchQuery.trim().toUpperCase();

  // Build EMR search conditions
  const conditions: string[] = [`emr_number.ilike.%${cleanQuery}%`];

  // For numeric queries, add padded EMR patterns
  if (/^\d+$/.test(cleanQuery)) {
    const num = parseInt(cleanQuery, 10);

    // Support legacy 4-digit and current 6-digit EMR formats.
    const padded4 = num.toString().padStart(4, '0');
    const padded6 = num.toString().padStart(6, '0');
    conditions.push(`emr_number.ilike.%${padded4}%`);
    conditions.push(`emr_number.ilike.%${padded6}%`);
    conditions.push(`emr_number.ilike.%${padded6}`);
    conditions.push(`emr_number.ilike.%-${cleanQuery}`);
  }

  const orQuery = conditions.join(',');

  const { data, error } = await supabase
    .from('patients')
    .select('patient_id, emr_number')
    .or(orQuery)
    .limit(50);

  if (error) {
    log.error('[EMR Search] Error:', error);
    return [];
  }

  return (data || []).map((p) => p.patient_id);
}

/**
 * Fetch encounters with filters
 * Supports searching by: encounter number, patient name, phone, EMR number
 */
export async function getEncounters(
  filters: EncounterFilters = {},
): Promise<Encounter[]> {
  let query = supabase
    .from('visits')
    .select(
      `
      *,
      patient:patients!visits_patient_id_fkey(
        id,
        patient_id,
        first_name,
        surname,
        emr_number,
        date_of_birth,
        gender,
        contact_phone
      ),
      clinic:clinics!visits_clinic_id_fkey(
        id,
        clinic_id,
        clinic_name,
        clinic_code,
        consultation_fee,
        follow_up_fee,
        emergency_fee
      ),
      attending_doctor:staff!visits_attending_doctor_id_fkey(
        staff_id,
        first_name,
        last_name,
        rank
      ),
      registrar:staff!visits_registered_by_fkey(
        staff_id,
        first_name,
        last_name
      )
    `,
    )
    .order('created_at', { ascending: false });

  // Apply search query - search encounters and patients
  if (filters.query && filters.query.trim().length > 0) {
    const searchTerm = filters.query.trim();

    // First, find matching patient IDs
    const matchingPatientIds = await findPatientIdsByQuery(searchTerm);

    // Build encounter-level search - include visit_id and encounter_number
    const safeSearch = sanitizeFilterValue(searchTerm);
    const encounterSearch = `encounter_number.ilike.%${safeSearch}%,visit_id.ilike.%${safeSearch}%,chief_complaint.ilike.%${safeSearch}%`;

    if (matchingPatientIds.length > 0) {
      // Search by encounter fields OR matching patient IDs
      query = query.or(
        `${encounterSearch},patient_id.in.(${matchingPatientIds.join(',')})`,
      );
    } else {
      // Only search encounter fields
      query = query.or(encounterSearch);
    }
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.visit_type && filters.visit_type !== 'all') {
    query = query.eq('visit_type', filters.visit_type);
  }

  if (filters.clinic_id) {
    query = query.eq('clinic_id', filters.clinic_id);
  }

  if (filters.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }

  if (filters.date_from) {
    query = query.gte('encounter_date', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('encounter_date', filters.date_to);
  }

  if (filters.patient_id) {
    query = query.eq('patient_id', filters.patient_id);
  }

  if (filters.attending_doctor_id) {
    query = query.eq('attending_doctor_id', filters.attending_doctor_id);
  }

  // Extended Patient-based Filters - need to filter by patient IDs
  const patientFilterConditions: string[] = [];

  if (filters.patient_category && filters.patient_category !== 'all') {
    patientFilterConditions.push(
      `patient_category.eq.${filters.patient_category}`,
    );
  }

  if (filters.insurance_type && filters.insurance_type !== 'all') {
    patientFilterConditions.push(`insurance_type.eq.${filters.insurance_type}`);
  }

  if (filters.gender && filters.gender !== 'all') {
    patientFilterConditions.push(`gender.eq.${filters.gender}`);
  }

  if (filters.course && filters.course !== 'all') {
    patientFilterConditions.push(`course.eq.${filters.course}`);
  }

  // Apply patient-based filters by fetching matching patient IDs first
  if (patientFilterConditions.length > 0) {
    const { data: matchingPatients } = await supabase
      .from('patients')
      .select('patient_id')
      .or(patientFilterConditions.join(','));

    if (matchingPatients && matchingPatients.length > 0) {
      const patientIds = matchingPatients.map((p) => p.patient_id);
      query = query.in('patient_id', patientIds);
    } else {
      // No matching patients, return empty result
      return [];
    }
  }

  // Age filter - calculate birth date range
  if (filters.age_min !== undefined || filters.age_max !== undefined) {
    const today = new Date();

    if (filters.age_max !== undefined) {
      // Min birth date = today - max_age - 1 year (to be at most max_age)
      const minBirthDate = new Date(today);
      minBirthDate.setFullYear(today.getFullYear() - filters.age_max - 1);

      const { data: olderPatients } = await supabase
        .from('patients')
        .select('patient_id')
        .gte('date_of_birth', minBirthDate.toISOString().split('T')[0]);

      if (olderPatients && olderPatients.length > 0) {
        const patientIds = olderPatients.map((p) => p.patient_id);
        query = query.in('patient_id', patientIds);
      }
    }

    if (filters.age_min !== undefined) {
      // Max birth date = today - min_age years (to be at least min_age)
      const maxBirthDate = new Date(today);
      maxBirthDate.setFullYear(today.getFullYear() - filters.age_min);

      const { data: youngerPatients } = await supabase
        .from('patients')
        .select('patient_id')
        .lte('date_of_birth', maxBirthDate.toISOString().split('T')[0]);

      if (youngerPatients && youngerPatients.length > 0) {
        const patientIds = youngerPatients.map((p) => p.patient_id);
        query = query.in('patient_id', patientIds);
      }
    }
  }

  // Diagnosis filter - filter by consultations
  if (filters.diagnosis && filters.diagnosis !== 'all') {
    const { data: consultationsWithDiag } = await supabase
      .from('consultations')
      .select('encounter_id')
      .eq('diagnosis', filters.diagnosis);

    if (consultationsWithDiag && consultationsWithDiag.length > 0) {
      const encounterIds = consultationsWithDiag.map((c) => c.encounter_id);
      query = query.in('id', encounterIds);
    } else {
      return [];
    }
  }

  // Chief complaint filter
  if (filters.chief_complaint && filters.chief_complaint !== 'all') {
    const { data: complaintsData } = await supabase
      .from('patient_chief_complaints')
      .select('encounter_id, chief_complaint_catalogue!inner(complaint_name)')
      .eq('chief_complaint_catalogue.complaint_name', filters.chief_complaint);

    if (complaintsData && complaintsData.length > 0) {
      const encounterIds = complaintsData.map((c: any) => c.encounter_id);
      query = query.in('id', encounterIds);
    } else {
      // Also check chief_complaint field on visits table
      query = query.ilike('chief_complaint', `%${filters.chief_complaint}%`);
    }
  }

  // ── Cross-Module Filters ──────────────────────────────────────────────────
  // Helper: filter encounters by existence of related records in another table
  const filterByRelated = async (
    table: string,
    fkColumn: string,
    hasFilter: string | undefined,
    statusColumn?: string,
    statusFilter?: string,
  ) => {
    if (!hasFilter || hasFilter === 'all') return;

    const relatedQuery = supabase.from(table).select(fkColumn);
    if (statusColumn && statusFilter && statusFilter !== 'all') {
      relatedQuery.eq(statusColumn, statusFilter);
    }
    const { data: related } = await relatedQuery;
    const ids = [...new Set((related || []).map((r: any) => r[fkColumn]).filter(Boolean))];

    if (hasFilter === 'yes') {
      if (ids.length > 0) { query = query.in('id', ids); } else { return 'empty'; }
    } else if (hasFilter === 'no') {
      if (ids.length > 0) { query = query.not('id', 'in', `(${ids.join(',')})`); }
    }
    return undefined;
  };

  // Lab orders
  if (filters.has_lab_order && filters.has_lab_order !== 'all') {
    const result = await filterByRelated('lab_requests', 'encounter_id', filters.has_lab_order, 'status', filters.lab_status);
    if (result === 'empty') return [];
  }

  // Radiology orders
  if (filters.has_radiology_order && filters.has_radiology_order !== 'all') {
    const result = await filterByRelated('radiology_requests', 'encounter_id', filters.has_radiology_order, 'status', filters.radiology_status);
    if (result === 'empty') return [];
  }

  // Prescriptions
  if (filters.has_prescription && filters.has_prescription !== 'all') {
    const result = await filterByRelated('prescriptions', 'encounter_id', filters.has_prescription, 'status', filters.prescription_status);
    if (result === 'empty') return [];
  }

  // Procedures
  if (filters.has_procedure && filters.has_procedure !== 'all') {
    const result = await filterByRelated('procedures', 'encounter_id', filters.has_procedure);
    if (result === 'empty') return [];
  }

  // Consultations
  if (filters.has_consultation && filters.has_consultation !== 'all') {
    const result = await filterByRelated('consultations', 'encounter_id', filters.has_consultation);
    if (result === 'empty') return [];
  }

  // Internal referrals  
  if (filters.has_internal_referral && filters.has_internal_referral !== 'all') {
    const result = await filterByRelated('clinical_requests', 'encounter_id', filters.has_internal_referral);
    if (result === 'empty') return [];
  }

  // External referrals
  if (filters.has_external_referral && filters.has_external_referral !== 'all') {
    const result = await filterByRelated('external_referrals', 'encounter_id', filters.has_external_referral);
    if (result === 'empty') return [];
  }

  // Admission filter (inpatient vs outpatient)
  if (filters.patient_type && filters.patient_type !== 'all') {
    if (filters.patient_type === 'inpatient') {
      query = query.not('discharge_date', 'is', null);
    } else if (filters.patient_type === 'outpatient') {
      query = query.is('discharge_date', null);
    }
  }

  // Encounter outcome
  if (filters.encounter_outcome && filters.encounter_outcome !== 'all') {
    query = query.eq('closed_reason', filters.encounter_outcome);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  if (filters.offset) {
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit || 50) - 1,
    );
  }

  const { data, error } = await query;

  if (error) {
    log.error('Error fetching encounters:', error);
    throw error;
  }

  // Map emr_number from patient to encounter level for easy access
  const encounters = (data || []).map((enc: any) => ({
    ...enc,
    emr_number: enc.patient?.emr_number || null,
  }));

  return encounters as Encounter[];
}

/**
 * Fetch single encounter by ID
 */
export async function getEncounterById(
  visitId: string,
): Promise<Encounter | null> {
  const { data, error } = await supabase
    .from('visits')
    .select(
      `
      *,
      patient:patients!visits_patient_id_fkey(
        id,
        patient_id,
        first_name,
        surname,
        emr_number,
        date_of_birth,
        gender,
        contact_phone
      ),
      clinic:clinics!visits_clinic_id_fkey(
        id,
        clinic_id,
        clinic_name,
        clinic_code,
        consultation_fee,
        follow_up_fee,
        emergency_fee
      ),
      attending_doctor:staff!visits_attending_doctor_id_fkey(
        staff_id,
        first_name,
        last_name,
        rank
      ),
      registrar:staff!visits_registered_by_fkey(
        staff_id,
        first_name,
        last_name
      )
    `,
    )
    .eq('visit_id', visitId)
    .single();

  if (error) {
    log.error('Error fetching encounter:', error);
    throw error;
  }

  return data as Encounter | null;
}

/**
 * Create new encounter
 */
export async function createEncounter(
  encounter: CreateEncounterDTO,
): Promise<Encounter> {
  const { data, error } = await supabase
    .from('visits')
    .insert({
      patient_id: encounter.patient_id,
      clinic_id: encounter.clinic_id,
      visit_type: encounter.visit_type,
      priority: encounter.priority || 'Normal',
      chief_complaint: encounter.chief_complaint,
      payment_category: encounter.payment_category,
      attending_doctor_id: encounter.attending_doctor_id,
      encounter_date:
        encounter.encounter_date || new Date().toISOString().split('T')[0],
      status: 'Active',
      start_time: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    log.error('Error creating encounter:', error);
    throw error;
  }

  return data as Encounter;
}

/**
 * Update encounter
 */
export async function updateEncounter(
  encounter: UpdateEncounterDTO,
): Promise<Encounter> {
  const { visit_id, ...updateData } = encounter;

  const { data, error } = await supabase
    .from('visits')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('visit_id', visit_id)
    .select()
    .single();

  if (error) {
    log.error('Error updating encounter:', error);
    throw error;
  }

  return data as Encounter;
}

/**
 * Update encounter status
 */
export async function updateEncounterStatus(
  visitId: string,
  status: string,
): Promise<Encounter> {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  // If marking as completed, set end time
  if (status === 'Completed') {
    updateData.end_time = new Date().toISOString();
  }

  // If starting (In Progress), ensure start_time exists
  if (status === 'In Progress') {
    const { data: current } = await supabase
      .from('visits')
      .select('start_time')
      .eq('visit_id', visitId)
      .single();

    if (!current?.start_time) {
      updateData.start_time = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('visits')
    .update(updateData)
    .eq('visit_id', visitId)
    .select()
    .single();

  if (error) {
    log.error('Error updating encounter status:', error);
    throw error;
  }

  return data as Encounter;
}

/**
 * Delete encounter (soft delete by setting status to Cancelled)
 */
export async function deleteEncounter(visitId: string): Promise<void> {
  const { error } = await supabase
    .from('visits')
    .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
    .eq('visit_id', visitId);

  if (error) {
    log.error('Error deleting encounter:', error);
    throw error;
  }
}

/**
 * Get encounter statistics
 * Note: visit_status enum has: Active, Completed, Cancelled, Created, Closed, Discharged, Registered
 * Waiting/In Progress are queue statuses, not visit statuses
 */
export async function getEncounterStats(): Promise<EncounterStats> {
  const today = new Date().toISOString().split('T')[0];

  // Get total counts using valid visit_status values
  // For waiting/inProgress, we count from queue table instead
  const [
    { count: total },
    { count: active },
    { count: completed },
    { count: cancelled },
    { count: todayTotal },
    { count: queueWaiting },
    { count: queueInProgress },
  ] = await Promise.all([
    supabase.from('visits').select('*', { count: 'exact', head: true }),
    supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Active'),
    supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Completed'),
    supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Cancelled'),
    supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today),
    // Get waiting count from queue table
    supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Waiting', 'Ready_For_Consultation'])
      .gte('created_at', today),
    // Get in progress count from queue table
    supabase
      .from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'In Progress')
      .gte('created_at', today),
  ]);

  return {
    total: total || 0,
    waiting: queueWaiting || 0,
    inProgress: queueInProgress || 0,
    completed: completed || 0,
    cancelled: cancelled || 0,
    todayTotal: todayTotal || 0,
  };
}

/**
 * Get patient encounters history
 */
export async function getPatientEncounters(
  patientId: string,
): Promise<Encounter[]> {
  return getEncounters({ patient_id: patientId });
}

/**
 * Get today's encounters
 */
export async function getTodaysEncounters(): Promise<Encounter[]> {
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).toISOString();
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  ).toISOString();

  // Query visits created today using created_at for reliability
  const { data, error } = await supabase
    .from('visits')
    .select(
      `
      *,
      patient:patients!visits_patient_id_fkey(
        id,
        patient_id,
        first_name,
        surname,
        emr_number,
        date_of_birth,
        gender,
        contact_phone
      ),
      clinic:clinics!visits_clinic_id_fkey(
        id,
        clinic_id,
        clinic_name,
        clinic_code,
        consultation_fee,
        follow_up_fee,
        emergency_fee
      ),
      attending_doctor:staff!visits_attending_doctor_id_fkey(
        staff_id,
        first_name,
        last_name,
        rank
      ),
      registrar:staff!visits_registered_by_fkey(
        staff_id,
        first_name,
        last_name
      )
    `,
    )
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay)
    .order('created_at', { ascending: false });

  if (error) {
    log.error("Error fetching today's encounters:", error);
    throw error;
  }

  // Map emr_number from patient to encounter level for easy access
  const encounters = (data || []).map((enc: any) => ({
    ...enc,
    emr_number: enc.patient?.emr_number || null,
  }));

  return encounters as Encounter[];
}

// =============================================================================
// CLINIC API
// =============================================================================

/**
 * Fetch all clinics
 */
export async function getClinics(
  filters: ClinicFilters = {},
): Promise<Clinic[]> {
  let query = supabase
    .from('clinics')
    .select('*')
    .order('clinic_name', { ascending: true });

  if (filters.query) {
    query = query.or(
      `clinic_name.ilike.%${filters.query}%,clinic_code.ilike.%${filters.query}%,description.ilike.%${filters.query}%`,
    );
  }

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.department_id) {
    query = query.eq('department_id', filters.department_id);
  }

  const { data, error } = await query;

  if (error) {
    log.error('Error fetching clinics:', error);
    throw error;
  }

  const clinics = (data || []) as Clinic[];
  return isSpecialtyClinicsEnabled()
    ? clinics
    : clinics.filter((clinic) => !isSpecialtyClinicRecord(clinic));
}

/**
 * Fetch active clinics only
 */
export async function getActiveClinics(): Promise<Clinic[]> {
  return getClinics({ is_active: true });
}

/**
 * Fetch single clinic by ID
 */
export async function getClinicById(clinicId: string): Promise<Clinic | null> {
  // Check if input is a UUID
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      clinicId,
    );
  const column = isUuid ? 'id' : 'clinic_id';

  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq(column, clinicId)
    .single();

  if (error) {
    log.error('Error fetching clinic:', error);
    throw error;
  }

  return data as Clinic | null;
}

/**
 * Create new clinic
 */
export async function createClinic(clinic: CreateClinicDTO): Promise<Clinic> {
  const { data, error } = await supabase
    .from('clinics')
    .insert({
      ...clinic,
      is_active: clinic.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    log.error('Error creating clinic:', error);
    throw error;
  }

  return data as Clinic;
}

/**
 * Update clinic
 */
export async function updateClinic(clinic: UpdateClinicDTO): Promise<Clinic> {
  const { clinic_id, ...updateData } = clinic;

  const { data, error } = await supabase
    .from('clinics')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('clinic_id', clinic_id)
    .select()
    .single();

  if (error) {
    log.error('Error updating clinic:', error);
    throw error;
  }

  return data as Clinic;
}

/**
 * Toggle clinic active status
 */
export async function toggleClinicStatus(
  clinicId: string,
  isActive: boolean,
): Promise<Clinic> {
  const { data, error } = await supabase
    .from('clinics')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('clinic_id', clinicId)
    .select()
    .single();

  if (error) {
    log.error('Error toggling clinic status:', error);
    throw error;
  }

  return data as Clinic;
}

/**
 * Delete clinic (hard delete)
 */
export async function deleteClinic(clinicId: string): Promise<void> {
  const { error } = await supabase
    .from('clinics')
    .delete()
    .eq('clinic_id', clinicId);

  if (error) {
    log.error('Error deleting clinic:', error);
    throw error;
  }
}

// =============================================================================
// ENCOUNTER CLINICAL DATA FOR REPORTS
// =============================================================================

/**
 * Comprehensive clinical data for an encounter report
 * Fetches all related records tied to the encounter_id
 */
export interface EncounterClinicalData {
  encounter: Encounter;
  vitals: {
    id: string;
    temperature: number | null;
    blood_pressure_systolic: number | null;
    blood_pressure_diastolic: number | null;
    blood_pressure: string | null;
    pulse: number | null;
    respiratory_rate: number | null;
    oxygen_saturation: number | null;
    weight: number | null;
    height: number | null;
    bmi: number | null;
    blood_glucose: number | null;
    pain_level: number | null;
    is_critical: boolean;
    date_recorded: string;
    notes: string | null;
    nurse?: { staff_id: string; first_name: string; last_name: string } | null;
  }[];
  consultation: {
    consultation_id: string;
    complaints: string | null;
    history_of_present_illness: string | null;
    past_medical_history: string | null;
    examination_findings: string | null;
    diagnosis: string[] | null;
    diagnosis_text: string | null;
    differential_diagnosis: string[] | null;
    treatment_plan: string | null;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    clinical_notes: string | null;
    follow_up_date: string | null;
    follow_up_notes: string | null;
    consultation_date: string;
    doctor?: {
      staff_id: string;
      first_name: string;
      last_name: string;
      rank?: string;
    } | null;
  } | null;
  labRequests: {
    request_id: string;
    test_name: string | null;
    category: string | null;
    clinical_notes: string | null;
    priority: string;
    status: string;
    result: any;
    result_notes: string | null;
    created_at: string;
    ordered_by?: {
      staff_id: string;
      first_name: string;
      last_name: string;
    } | null;
    lab_result?: any;
  }[];
  prescriptions: {
    prescription_id: string;
    drug_name: string | null;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
    route: string | null;
    quantity_prescribed: number | null;
    quantity_dispensed: number | null;
    instructions: string | null;
    status: string;
    created_at: string;
    doctor?: { staff_id: string; first_name: string; last_name: string } | null;
  }[];
  imagingRequests: {
    request_id: string;
    procedure_name: string | null;
    modality: string | null;
    clinical_notes: string | null;
    priority: string;
    status: string;
    findings: string | null;
    impression: string | null;
    created_at: string;
    ordered_by?: {
      staff_id: string;
      first_name: string;
      last_name: string;
    } | null;
    performed_by?: {
      staff_id: string;
      first_name: string;
      last_name: string;
    } | null;
  }[];
  nursingNotes: {
    id: string;
    note_type: string;
    title: string | null;
    content: string;
    patient_condition: string | null;
    pain_level: number | null;
    interventions_performed: string | null;
    patient_response: string | null;
    is_critical: boolean;
    shift: string | null;
    created_at: string;
    recorded_by?: {
      staff_id: string;
      first_name: string;
      last_name: string;
    } | null;
  }[];
  treatmentPlan: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    status: string;
    created_at: string;
    created_by?: {
      staff_id: string;
      first_name: string;
      last_name: string;
    } | null;
    tasks: {
      id: string;
      task_type: string;
      title: string;
      description: string | null;
      instructions: string | null;
      status: string;
      scheduled_time: string | null;
      completed_at: string | null;
    }[];
  } | null;
  triageAssessment: {
    id: string;
    chief_complaint_text: string | null;
    triage_level: number | null;
    triage_color: string | null;
    consciousness: string | null;
    pain_score: number | null;
    created_at: string;
    triaged_by?: {
      staff_id: string;
      first_name: string;
      last_name: string;
    } | null;
  } | null;
}

/**
 * Fetch comprehensive clinical data for an encounter report
 */
export async function getEncounterClinicalData(
  encounterId: string,
): Promise<EncounterClinicalData | null> {
  // 1. Fetch the encounter with patient, clinic, and doctor info
  const { data: encounter, error: encounterError } = await supabase
    .from('visits')
    .select(
      `
      *,
      patient:patients!visits_patient_id_fkey(
        id, patient_id, first_name, surname, emr_number, 
        date_of_birth, gender, contact_phone, blood_group,
        service_number, patient_category, insurance_type
      ),
      clinic:clinics!visits_clinic_id_fkey(id, clinic_id, clinic_name, clinic_code),
      attending_doctor:staff!visits_attending_doctor_id_fkey(
        staff_id, first_name, last_name, rank
      ),
      registrar:staff!visits_registered_by_fkey(
        staff_id, first_name, last_name
      )
    `,
    )
    .eq('id', encounterId)
    .single();

  if (encounterError || !encounter) {
    log.error('Error fetching encounter:', encounterError);
    return null;
  }

  // 2. Fetch vitals
  const { data: vitals } = await supabase
    .from('vitals')
    .select(
      `
      *,
      nurse:staff(staff_id, first_name, last_name)
    `,
    )
    .eq('encounter_id', encounterId)
    .order('date_recorded', { ascending: false });

  // 3. Fetch consultation
  const { data: consultations } = await supabase
    .from('consultations')
    .select(
      `
      *,
      doctor:staff!consultations_doctor_id_fkey(staff_id, first_name, last_name, rank)
    `,
    )
    .eq('encounter_id', encounterId)
    .order('consultation_date', { ascending: false })
    .limit(1);

  // 4. Fetch lab requests with test info and results
  const { data: labRequests } = await supabase
    .from('lab_requests')
    .select(
      `
      *,
      test:lab_test_catalogue(name, category),
      ordered_by_staff:staff!lab_requests_ordered_by_fkey(staff_id, first_name, last_name),
      lab_result:lab_results(*)
    `,
    )
    .eq('encounter_id', encounterId)
    .order('created_at', { ascending: false });

  // 5. Fetch prescriptions with drug info
  const { data: prescriptions } = await supabase
    .from('prescriptions')
    .select(
      `
      *,
      drug:drug_catalogue(generic_name, brand_name),
      doctor:staff!prescriptions_doctor_id_fkey(staff_id, first_name, last_name)
    `,
    )
    .eq('encounter_id', encounterId)
    .order('created_at', { ascending: false });

  // 6. Fetch imaging requests
  const { data: imagingRequests } = await supabase
    .from('imaging_requests')
    .select(
      `
      *,
      procedure:imaging_catalogue(name, modality),
      ordered_by_staff:staff!imaging_requests_ordered_by_fkey(staff_id, first_name, last_name),
      performed_by_staff:staff!imaging_requests_performed_by_fkey(staff_id, first_name, last_name)
    `,
    )
    .eq('encounter_id', encounterId)
    .order('created_at', { ascending: false });

  // 7. Fetch nursing notes
  const { data: nursingNotes } = await supabase
    .from('nursing_notes')
    .select(
      `
      *,
      recorded_by_staff:staff!nursing_notes_recorded_by_fkey(staff_id, first_name, last_name)
    `,
    )
    .eq('encounter_id', encounterId)
    .order('created_at', { ascending: false });

  // 8. Fetch treatment plan with tasks
  const { data: treatmentPlans } = await supabase
    .from('treatment_plans')
    .select(
      `
      *,
      created_by_staff:staff!treatment_plans_created_by_fkey(staff_id, first_name, last_name),
      tasks:treatment_tasks(*)
    `,
    )
    .eq('encounter_id', encounterId)
    .order('created_at', { ascending: false })
    .limit(1);

  // 9. Fetch triage assessment
  const { data: triageAssessments } = await supabase
    .from('triage_assessments')
    .select(
      `
      *,
      triaged_by_staff:staff!triage_assessments_triaged_by_fkey(staff_id, first_name, last_name)
    `,
    )
    .eq('encounter_id', encounterId)
    .order('created_at', { ascending: false })
    .limit(1);

  // Compile and return clinical data
  return {
    encounter: encounter as Encounter,
    vitals: (vitals || []).map((v) => ({
      id: v.id,
      temperature: v.temperature,
      blood_pressure_systolic: v.blood_pressure_systolic,
      blood_pressure_diastolic: v.blood_pressure_diastolic,
      blood_pressure: v.blood_pressure,
      pulse: v.pulse,
      respiratory_rate: v.respiratory_rate,
      oxygen_saturation: v.oxygen_saturation,
      weight: v.weight,
      height: v.height,
      bmi: v.bmi,
      blood_glucose: v.blood_glucose,
      pain_level: v.pain_level,
      is_critical: v.is_critical || false,
      date_recorded: v.date_recorded,
      notes: v.notes,
      nurse: v.nurse,
    })),
    consultation: consultations?.[0]
      ? {
          consultation_id: consultations[0].consultation_id,
          complaints: consultations[0].complaints,
          history_of_present_illness:
            consultations[0].history_of_present_illness,
          past_medical_history: consultations[0].past_medical_history,
          examination_findings: consultations[0].examination_findings,
          diagnosis: consultations[0].diagnosis,
          diagnosis_text: consultations[0].diagnosis_text,
          differential_diagnosis: consultations[0].differential_diagnosis,
          treatment_plan: consultations[0].treatment_plan,
          subjective: consultations[0].subjective,
          objective: consultations[0].objective,
          assessment: consultations[0].assessment,
          plan: consultations[0].plan,
          clinical_notes: consultations[0].clinical_notes,
          follow_up_date: consultations[0].follow_up_date,
          follow_up_notes: consultations[0].follow_up_notes,
          consultation_date: consultations[0].consultation_date,
          doctor: consultations[0].doctor,
        }
      : null,
    labRequests: (labRequests || []).map((lr) => ({
      request_id: lr.request_id,
      test_name: lr.test?.name || null,
      category: lr.test?.category || null,
      clinical_notes: lr.clinical_notes,
      priority: lr.priority,
      status: lr.status,
      result: lr.result,
      result_notes: lr.result_notes,
      created_at: lr.created_at,
      ordered_by: lr.ordered_by_staff,
      lab_result: Array.isArray(lr.lab_result)
        ? lr.lab_result[0]
        : lr.lab_result,
    })),
    prescriptions: (prescriptions || []).map((rx) => ({
      prescription_id: rx.prescription_id,
      drug_name: rx.drug?.generic_name || rx.drug?.brand_name || null,
      dosage: rx.dosage,
      frequency: rx.frequency,
      duration: rx.duration,
      route: rx.route,
      quantity_prescribed: rx.quantity_prescribed,
      quantity_dispensed: rx.quantity_dispensed,
      instructions: rx.instructions,
      status: rx.status,
      created_at: rx.created_at,
      doctor: rx.doctor,
    })),
    imagingRequests: (imagingRequests || []).map((ir) => ({
      request_id: ir.request_id,
      procedure_name: ir.procedure?.name || null,
      modality: ir.procedure?.modality || null,
      clinical_notes: ir.clinical_notes,
      priority: ir.priority,
      status: ir.status,
      findings: ir.findings,
      impression: ir.impression,
      created_at: ir.created_at,
      ordered_by: ir.ordered_by_staff,
      performed_by: ir.performed_by_staff,
    })),
    nursingNotes: (nursingNotes || []).map((nn) => ({
      id: nn.id,
      note_type: nn.note_type,
      title: nn.title,
      content: nn.content,
      patient_condition: nn.patient_condition,
      pain_level: nn.pain_level,
      interventions_performed: nn.interventions_performed,
      patient_response: nn.patient_response,
      is_critical: nn.is_critical || false,
      shift: nn.shift,
      created_at: nn.created_at,
      recorded_by: nn.recorded_by_staff,
    })),
    treatmentPlan: treatmentPlans?.[0]
      ? {
          id: treatmentPlans[0].id,
          title: treatmentPlans[0].title,
          description: treatmentPlans[0].description,
          instructions: treatmentPlans[0].instructions,
          status: treatmentPlans[0].status,
          created_at: treatmentPlans[0].created_at,
          created_by: treatmentPlans[0].created_by_staff,
          tasks: (treatmentPlans[0].tasks || []).map((t: any) => ({
            id: t.id,
            task_type: t.task_type,
            title: t.title,
            description: t.description,
            instructions: t.instructions,
            status: t.status,
            scheduled_time: t.scheduled_time,
            completed_at: t.completed_at,
          })),
        }
      : null,
    triageAssessment: triageAssessments?.[0]
      ? {
          id: triageAssessments[0].id,
          chief_complaint_text: triageAssessments[0].chief_complaint_text,
          triage_level: triageAssessments[0].triage_level,
          triage_color: triageAssessments[0].triage_color,
          consciousness: triageAssessments[0].consciousness,
          pain_score: triageAssessments[0].pain_score,
          created_at: triageAssessments[0].created_at,
          triaged_by: triageAssessments[0].triaged_by_staff,
        }
      : null,
  };
}

// =============================================================================
// FILTER OPTIONS API - Diagnosis, Chief Complaints, Courses
// =============================================================================

/**
 * Get all unique diagnoses with counts for filter dropdown
 */
export async function getDiagnosisFilterOptions(
  limit: number = 50,
): Promise<{ name: string; count: number }[]> {
  const { data, error } = await supabase
    .from('consultations')
    .select('diagnosis')
    .not('diagnosis', 'is', null);

  if (error) {
    log.error('[Diagnosis Filter] Error fetching diagnoses:', error);
    return [];
  }

  // Count occurrences
  const counts: Record<string, number> = {};
  data?.forEach((c) => {
    // Handle diagnosis which could be string or object/array
    const diagValue = c.diagnosis;
    const diagStr =
      typeof diagValue === 'string'
        ? diagValue
        : diagValue && typeof diagValue === 'object'
          ? JSON.stringify(diagValue)
          : null;

    if (diagStr && diagStr.trim()) {
      const diag = diagStr.trim();
      counts[diag] = (counts[diag] || 0) + 1;
    }
  });

  // Sort by count descending and limit
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Get all unique chief complaints for filter dropdown
 */
export async function getChiefComplaintFilterOptions(): Promise<
  { id: string; name: string; category: string }[]
> {
  // First try to get from catalogue
  const { data: catalogue, error: catError } = await supabase
    .from('chief_complaint_catalogue')
    .select('complaint_id, complaint_name, category')
    .eq('is_active', true)
    .order('complaint_name', { ascending: true });

  if (!catError && catalogue && catalogue.length > 0) {
    return catalogue.map((c) => ({
      id: c.complaint_id,
      name: c.complaint_name,
      category: c.category || 'General',
    }));
  }

  // Fallback: get from patient_chief_complaints if catalogue is empty
  const { data: patientComplaints } = await supabase
    .from('patient_chief_complaints')
    .select('complaint_id, chief_complaint_catalogue(complaint_name, category)')
    .limit(100);

  if (patientComplaints && patientComplaints.length > 0) {
    const uniqueComplaints = new Map<
      string,
      { id: string; name: string; category: string }
    >();
    patientComplaints.forEach((pc: any) => {
      if (pc.complaint_id && pc.chief_complaint_catalogue) {
        uniqueComplaints.set(pc.complaint_id, {
          id: pc.complaint_id,
          name: pc.chief_complaint_catalogue.complaint_name,
          category: pc.chief_complaint_catalogue.category || 'General',
        });
      }
    });
    return Array.from(uniqueComplaints.values());
  }

  return [];
}

/**
 * Get courses for filter dropdown (for participants)
 */
export async function getCourseFilterOptions(): Promise<
  { id: string; name: string }[]
> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, course_name, course_number')
    .order('course_number', { ascending: false });

  if (error) {
    log.error('[Course Filter] Error fetching courses:', error);
    return [];
  }

  return (data || []).map((c) => ({
    id: c.id,
    name: c.course_name,
  }));
}

// Export all API functions
export const encounterApi = {
  // Encounters
  getEncounters,
  getEncounterById,
  createEncounter,
  updateEncounter,
  updateEncounterStatus,
  deleteEncounter,
  getEncounterStats,
  getPatientEncounters,
  getTodaysEncounters,
  // Clinical Data for Reports
  getEncounterClinicalData,
  // Filter Options
  getDiagnosisFilterOptions,
  getChiefComplaintFilterOptions,
  getCourseFilterOptions,
  // Clinics
  getClinics,
  getActiveClinics,
  getClinicById,
  createClinic,
  updateClinic,
  toggleClinicStatus,
  deleteClinic,
};

export default encounterApi;