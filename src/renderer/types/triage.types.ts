// Triage Types for EMR System
// Generated: December 20, 2025

// =====================================================
// ENUMS
// =====================================================

// ESILevel can be both numeric and string for flexibility
export type ESILevel = 1 | 2 | 3 | 4 | 5;

export type TriageStatus =
  | 'Pending'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'pending'
  | 'completed';

export type ConsciousnessLevel = 'Alert' | 'Verbal' | 'Pain' | 'Unresponsive';

export type PainScore =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10';

export type ArrivalMode =
  | 'Walk-in'
  | 'Ambulance'
  | 'Referral'
  | 'Police'
  | 'Self-Transfer';

export type SkinColor =
  | 'Normal'
  | 'Pale'
  | 'Cyanotic'
  | 'Flushed'
  | 'Jaundiced';

export type IsolationType = 'Contact' | 'Droplet' | 'Airborne' | 'Reverse';

// =====================================================
// ESI LEVEL DEFINITIONS
// =====================================================

export interface ESILevelDefinition {
  level: ESILevel;
  name: string;
  description: string;
  responseTime: string;
  color: string;
  examples: string[];
}

// ESI_DESCRIPTIONS for easier access by level number
export const ESI_DESCRIPTIONS: Record<
  ESILevel,
  { name: string; description: string }
> = {
  1: {
    name: 'Resuscitation',
    description: 'Immediate life-saving intervention required',
  },
  2: {
    name: 'Emergent',
    description: 'High-risk situation or severe distress',
  },
  3: {
    name: 'Urgent',
    description: 'Requires multiple resources, stable condition',
  },
  4: {
    name: 'Less Urgent',
    description: 'Requires one resource, stable condition',
  },
  5: { name: 'Non-Urgent', description: 'No resources needed, routine care' },
};

export const ESI_LEVELS: ESILevelDefinition[] = [
  {
    level: 1,
    name: 'Resuscitation',
    description: 'Immediate life-saving intervention required',
    responseTime: 'Immediate',
    color: '#DC2626', // red-600
    examples: [
      'Cardiac arrest',
      'Severe trauma',
      'Respiratory failure',
      'Unresponsive',
    ],
  },
  {
    level: 2,
    name: 'Emergent',
    description: 'High-risk situation or severe distress',
    responseTime: '< 10 minutes',
    color: '#D96A36', // orange-600
    examples: [
      'Chest pain',
      'Stroke symptoms',
      'Severe allergic reaction',
      'Active seizure',
    ],
  },
  {
    level: 3,
    name: 'Urgent',
    description: 'Requires multiple resources, stable condition',
    responseTime: '< 30 minutes',
    color: '#CA8A04', // yellow-600
    examples: [
      'Moderate abdominal pain',
      'Minor fractures',
      'High fever',
      'Dehydration',
    ],
  },
  {
    level: 4,
    name: 'Less Urgent',
    description: 'Requires one resource, stable condition',
    responseTime: '< 60 minutes',
    color: '#16A34A', // green-600
    examples: ['Minor laceration', 'Urinary symptoms', 'Earache', 'Mild rash'],
  },
  {
    level: 5,
    name: 'Non-Urgent',
    description: 'No resources needed, routine care',
    responseTime: '< 120 minutes',
    color: '#2563EB', // blue-600
    examples: [
      'Prescription refill',
      'Minor complaints',
      'Follow-up visit',
      'Suture removal',
    ],
  },
];

// =====================================================
// CHIEF COMPLAINT TYPES
// =====================================================

export interface ChiefComplaint {
  id: string;
  code: string;
  name: string;
  category: string;
  default_esi_level?: ESILevel;
  red_flags?: string[];
  default_department_id?: string;
  requires_immediate_attention: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChiefComplaintCategory {
  name: string;
  complaints: ChiefComplaint[];
}

// =====================================================
// VITAL SIGNS TYPES
// =====================================================

export interface TriageVitalSigns {
  temperature?: number;
  temperature_unit: 'C' | 'F';
  pulse_rate?: number;
  respiratory_rate?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  oxygen_saturation?: number;
  blood_glucose?: number;
  weight?: number;
  height?: number;
}

export interface GCSScore {
  eye: number; // 1-4
  verbal: number; // 1-5
  motor: number; // 1-6
  total: number; // 3-15
}

export interface VitalThresholds {
  pulse_rate: {
    min: number;
    max: number;
    critical_min: number;
    critical_max: number;
  };
  respiratory_rate: {
    min: number;
    max: number;
    critical_min: number;
    critical_max: number;
  };
  oxygen_saturation: { min: number; critical: number };
  blood_pressure_systolic: {
    min: number;
    max: number;
    critical_min: number;
    critical_max: number;
  };
  temperature: {
    min: number;
    max: number;
    critical_min: number;
    critical_max: number;
  };
  gcs: { critical: number };
}

export const VITAL_THRESHOLDS: VitalThresholds = {
  pulse_rate: { min: 50, max: 100, critical_min: 40, critical_max: 150 },
  respiratory_rate: { min: 12, max: 20, critical_min: 8, critical_max: 30 },
  oxygen_saturation: { min: 94, critical: 90 },
  blood_pressure_systolic: {
    min: 100,
    max: 160,
    critical_min: 80,
    critical_max: 200,
  },
  temperature: { min: 36, max: 38, critical_min: 35, critical_max: 40 },
  gcs: { critical: 14 },
};

// =====================================================
// TRIAGE ASSESSMENT TYPES
// =====================================================

export interface TriageAssessment {
  id: string;
  visit_id: string;
  patient_id: string;

  // Status
  status: TriageStatus;
  arrival_mode?: ArrivalMode;

  // Chief complaint
  chief_complaint_id?: string;
  chief_complaint_text: string;
  complaint_duration?: string;
  complaint_onset?: string;

  // History
  history_of_present_illness?: string;
  associated_symptoms?: string[];
  red_flags_present?: string[];
  allergies?: string;
  current_medications?: string;

  // Vital signs
  temperature?: number;
  temperature_unit: 'C' | 'F';
  pulse_rate?: number;
  respiratory_rate?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  oxygen_saturation?: number;
  blood_glucose?: number;
  weight?: number;
  height?: number;

  // Neurological
  consciousness: ConsciousnessLevel;
  gcs_eye?: number;
  gcs_verbal?: number;
  gcs_motor?: number;
  gcs_total?: number;
  pupil_reaction?: string;

  // Pain
  pain_score?: PainScore;
  pain_location?: string;
  pain_character?: string;

  // Physical appearance
  general_appearance?: string;
  is_distressed: boolean;
  is_diaphoretic: boolean;
  skin_color?: SkinColor;

  // ESI scoring
  calculated_esi_level?: ESILevel;
  assigned_esi_level: ESILevel;
  esi_override_reason?: string;
  resources_needed?: number;

  // Routing
  target_department_id?: string;
  routing_priority: number;
  routing_notes?: string;
  is_emergency: boolean;

  // Special flags
  is_fall_risk: boolean;
  is_isolation_required: boolean;
  isolation_type?: IsolationType;
  is_restraint_required: boolean;
  is_suicide_risk: boolean;
  special_needs?: string;

  // Timestamps
  triage_started_at?: string;
  triage_completed_at?: string;
  created_at: string;
  updated_at: string;

  // Staff
  triaged_by: string;
  reviewed_by?: string;
}

export interface TriageWithDetails extends TriageAssessment {
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    medical_record_number: string;
    gender: string;
  };
  visit: {
    id: string;
    visit_number: string;
    visit_type: string;
  };
  chief_complaint?: ChiefComplaint;
  target_department?: {
    id: string;
    code: string;
    name: string;
  };
  triaged_by_user?: {
    id: string;
    full_name: string;
  };
}

// =====================================================
// TRIAGE FORM DTOs
// =====================================================

export interface CreateTriageDTO {
  visit_id: string;
  patient_id: string;

  // Chief complaint
  chief_complaint_id?: string;
  chief_complaint_text: string;
  complaint_duration?: string;
  complaint_onset?: string;
  arrival_mode?: ArrivalMode;

  // History
  history_of_present_illness?: string;
  associated_symptoms?: string[];
  allergies?: string;
  current_medications?: string;

  // Vital signs
  vitals: TriageVitalSigns;

  // Neurological
  consciousness?: ConsciousnessLevel;
  gcs_eye?: number;
  gcs_verbal?: number;
  gcs_motor?: number;

  // Pain
  pain_score?: PainScore;
  pain_location?: string;
  pain_character?: string;

  // Physical
  general_appearance?: string;
  is_distressed?: boolean;
  is_diaphoretic?: boolean;
  skin_color?: SkinColor;

  // ESI
  assigned_esi_level: ESILevel;
  esi_override_reason?: string;
  resources_needed?: number;

  // Routing
  target_department_id?: string;
  is_emergency?: boolean;

  // Flags
  is_fall_risk?: boolean;
  is_isolation_required?: boolean;
  isolation_type?: IsolationType;
  is_restraint_required?: boolean;
  is_suicide_risk?: boolean;
  special_needs?: string;
}

export interface UpdateTriageDTO extends Partial<CreateTriageDTO> {
  id: string;
}

// =====================================================
// TRIAGE ROUTING RULES
// =====================================================

export interface TriageRoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  is_active: boolean;

  conditions: TriageRoutingConditions;

  target_department_id: string;
  override_priority?: number;
  auto_notify_roles?: string[];
  requires_immediate_bed: boolean;

  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface TriageRoutingConditions {
  esi_level?: ESILevel[];
  chief_complaint_category?: string[];
  age_min?: number;
  age_max?: number;
  is_emergency?: boolean;
  vital_thresholds?: {
    oxygen_saturation_below?: number;
    heart_rate_above?: number;
    heart_rate_below?: number;
    blood_pressure_systolic_above?: number;
    blood_pressure_systolic_below?: number;
  };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function getESILevelInfo(level: ESILevel): ESILevelDefinition {
  return ESI_LEVELS.find((l) => l.level === level) || ESI_LEVELS[4];
}

export function getESIColor(level: ESILevel): string {
  return getESILevelInfo(level).color;
}

export function getESIName(level: ESILevel): string {
  return getESILevelInfo(level).name;
}

export function calculateGCSTotal(
  eye: number,
  verbal: number,
  motor: number,
): number {
  return (eye || 4) + (verbal || 5) + (motor || 6);
}

export function isVitalCritical(
  vitalType: keyof VitalThresholds,
  value: number,
): boolean {
  const threshold = VITAL_THRESHOLDS[vitalType];

  if (vitalType === 'oxygen_saturation') {
    return value < (threshold as { min: number; critical: number }).critical;
  }

  if (vitalType === 'gcs') {
    return value < (threshold as { critical: number }).critical;
  }

  const t = threshold as { critical_min: number; critical_max: number };
  return value < t.critical_min || value > t.critical_max;
}

export function isVitalAbnormal(
  vitalType: keyof Omit<VitalThresholds, 'gcs'>,
  value: number,
): boolean {
  const threshold = VITAL_THRESHOLDS[vitalType];

  if (vitalType === 'oxygen_saturation') {
    return value < (threshold as { min: number }).min;
  }

  const t = threshold as { min: number; max: number };
  return value < t.min || value > t.max;
}

export function suggestESILevel(
  vitals: TriageVitalSigns,
  consciousness: ConsciousnessLevel,
  gcs: GCSScore | null,
  painScore: number,
  resourcesNeeded: number,
  isEmergency: boolean,
): ESILevel {
  // ESI Level 1: Requires immediate life-saving intervention
  if (consciousness === 'Unresponsive' || isEmergency) {
    return 1;
  }

  // Check for critical vitals
  const hasCriticalVitals =
    (vitals.pulse_rate && isVitalCritical('pulse_rate', vitals.pulse_rate)) ||
    (vitals.respiratory_rate &&
      isVitalCritical('respiratory_rate', vitals.respiratory_rate)) ||
    (vitals.oxygen_saturation &&
      isVitalCritical('oxygen_saturation', vitals.oxygen_saturation)) ||
    (vitals.blood_pressure_systolic &&
      isVitalCritical(
        'blood_pressure_systolic',
        vitals.blood_pressure_systolic,
      )) ||
    (gcs && gcs.total < 14);

  // ESI Level 2: High-risk or severe distress
  if (
    consciousness === 'Verbal' ||
    consciousness === 'Pain' ||
    hasCriticalVitals ||
    painScore >= 8
  ) {
    return 2;
  }

  // Check for abnormal vitals
  const hasAbnormalVitals =
    (vitals.pulse_rate && isVitalAbnormal('pulse_rate', vitals.pulse_rate)) ||
    (vitals.respiratory_rate &&
      isVitalAbnormal('respiratory_rate', vitals.respiratory_rate)) ||
    (vitals.oxygen_saturation &&
      isVitalAbnormal('oxygen_saturation', vitals.oxygen_saturation)) ||
    (vitals.blood_pressure_systolic &&
      isVitalAbnormal(
        'blood_pressure_systolic',
        vitals.blood_pressure_systolic,
      ));

  // ESI Level 2 upgrade if abnormal vitals + high resource need
  if (hasAbnormalVitals && resourcesNeeded >= 2) {
    return 2;
  }

  // ESI Levels 3-5 based on resource needs
  if (resourcesNeeded >= 2) {
    return 3;
  }
  if (resourcesNeeded === 1) {
    return 4;
  }

  return 5;
}

// =====================================================
// ADDITIONAL TYPES FOR API COMPATIBILITY
// =====================================================

// Alias for TriageWithDetails
export type TriageAssessmentWithDetails = TriageWithDetails;

// Query parameters for triage assessments
export interface TriageQueryParams {
  patient_id?: string;
  visit_id?: string;
  esi_level?: ESILevel;
  status?: TriageStatus;
  from_date?: string;
  to_date?: string;
  limit?: number;
}

// Vital Signs interface for API usage
export interface VitalSigns {
  systolic_bp?: number;
  diastolic_bp?: number;
  pulse?: number;
  temperature?: number;
  respiratory_rate?: number;
  spo2?: number;
  gcs_eye?: number;
  gcs_verbal?: number;
  gcs_motor?: number;
  pain_scale?: number;
  weight?: number;
  height?: number;
}
