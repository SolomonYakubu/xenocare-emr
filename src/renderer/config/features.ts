/**
 * Application feature flags.
 *
 * NHIS is disabled for deployments where the facility is not NHIS-accredited.
 * All NHIS workflows, billing rules, patient fields, approvals and background
 * processes must treat this flag as the single source of truth.
 */
export const FEATURES = {
  /** NHIS/insurance scheme workflows, fields and billing rules. */
  nhis: false,
  /** The general Specialty Clinics module. */
  specialtyClinics: true,
  /** Individual specialty clinics, enabled independently of the main module. */
  dental: false,
  ophthalmology: false,
  physiotherapy: false,
  /** Military-specific patient/staff classification fields and insurance tiers. */
  military: false,
  /** Accident & Emergency module. */
  emergency: false,
  /** Hygiene and infection-control module. */
  hygiene: false,
} as const;

export function isNhisFeatureEnabled(): boolean {
  return FEATURES.nhis;
}

export function isSpecialtyClinicsEnabled(): boolean {
  return FEATURES.specialtyClinics;
}

export function isDentalEnabled(): boolean {
  return FEATURES.dental;
}

export function isOphthalmologyEnabled(): boolean {
  return FEATURES.ophthalmology;
}

export function isPhysiotherapyEnabled(): boolean {
  return FEATURES.physiotherapy;
}

/** Whether a module in the specialty surface is switched on. */
export function isSpecialtyModuleEnabled(module: string): boolean {
  switch (module) {
    case 'specialty-clinic':
      return FEATURES.specialtyClinics;
    case 'dental':
      return FEATURES.dental;
    case 'ophthalmology':
      return FEATURES.ophthalmology;
    case 'physiotherapy':
      return FEATURES.physiotherapy;
    default:
      return true;
  }
}

export function isMilitaryFeatureEnabled(): boolean {
  return FEATURES.military;
}

export function isEmergencyFeatureEnabled(): boolean {
  return FEATURES.emergency;
}

export function isHygieneFeatureEnabled(): boolean {
  return FEATURES.hygiene;
}

/** Modules that belong to the specialty-clinic surface. */
export const SPECIALTY_CLINIC_MODULES = [
  'specialty-clinic',
  'dental',
  'ophthalmology',
  'physiotherapy',
] as const;

/**
 * Clinic records that represent dedicated specialty clinics. Used to keep
 * specialty clinics out of encounter/routing pickers when the feature is off.
 */
export function isSpecialtyClinicRecord(clinic: {
  clinic_code?: string | null;
  clinic_name?: string | null;
}): boolean {
  const code = (clinic.clinic_code || '').trim().toLowerCase();
  const name = (clinic.clinic_name || '').trim().toLowerCase();

  const codes = new Set([
    'den',
    'eye',
    'phy',
    'skn',
    'ent',
    'ort',
    'psy',
    'car',
    'neu',
    'der',
    'uro',
    'onc',
  ]);

  if (codes.has(code)) return true;

  return [
    'dental',
    'ophthalm',
    'eye clinic',
    'physio',
    'rehab',
    'dermat',
    'skin clinic',
    'cardio',
    'neurolog',
    'psychiatr',
    'orthopaed',
    'orthoped',
    'ent clinic',
    'urolog',
    'oncology',
  ].some((fragment) => name.includes(fragment));
}

/**
 * Detects NHIS-backed insurance/payment categories, including legacy
 * categories that must be treated as self-pay while NHIS is disabled.
 */
export function isNhisCategory(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().replace(/_/g, ' ').trim();
  return (
    normalized.includes('nhis') ||
    normalized === 'dhml' ||
    normalized === 'gifship'
  );
}
