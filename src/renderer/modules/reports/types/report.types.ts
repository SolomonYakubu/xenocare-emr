/**
 * XenoCare
 * Comprehensive Export & Reporting System — Shared Types
 *
 * Covers: Labs, Imaging, Procedures, Dental, Physiotherapy, Ophthalmology
 * Supports: CSV, PDF, Excel exports with dynamic filtering and month-end reports
 */

// ─── Date Range ──────────────────────────────────────────────────────────────

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

export interface DateRange {
  from: string; // ISO 8601
  to: string; // ISO 8601
  preset?: DateRangePreset;
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toInputDateValue(value: string): string {
  const date = parseDateInput(value);
  if (!date) return '';

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toDateStartIso(value: string): string {
  const date = parseDateInput(value);
  if (!date) return '';
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function toDateEndIso(value: string): string {
  const date = parseDateInput(value);
  if (!date) return '';
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export function resolveDateRange(
  preset: DateRangePreset,
  custom?: { from: string; to: string },
): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = () => now.toISOString();

  switch (preset) {
    case 'today': {
      return { from: today.toISOString(), to: end(), preset };
    }
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: y.toISOString(), to: today.toISOString(), preset };
    }
    case 'last_7_days': {
      const w = new Date(today);
      w.setDate(w.getDate() - 7);
      return { from: w.toISOString(), to: end(), preset };
    }
    case 'last_30_days': {
      const m = new Date(today);
      m.setDate(m.getDate() - 30);
      return { from: m.toISOString(), to: end(), preset };
    }
    case 'this_month': {
      const som = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: som.toISOString(), to: end(), preset };
    }
    case 'last_month': {
      const slm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const elm = new Date(now.getFullYear(), now.getMonth(), 0);
      elm.setHours(23, 59, 59, 999);
      return { from: slm.toISOString(), to: elm.toISOString(), preset };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const soq = new Date(now.getFullYear(), q * 3, 1);
      return { from: soq.toISOString(), to: end(), preset };
    }
    case 'this_year': {
      const soy = new Date(now.getFullYear(), 0, 1);
      return { from: soy.toISOString(), to: end(), preset };
    }
    case 'custom':
    default:
      return {
        from: custom?.from ? toDateStartIso(custom.from) : '',
        to: custom?.to ? toDateEndIso(custom.to) : '',
        preset: 'custom',
      };
  }
}

export function getDefaultDateRange(): DateRange {
  return resolveDateRange('this_month');
}

// ─── Export Formats ──────────────────────────────────────────────────────────

export type ExportFormat = 'CSV' | 'Excel' | 'PDF';
export type ExportScope = 'filtered' | 'all' | 'selected';

// ─── Shared Filter Base ───────────────────────────────────────────────────────

export interface BaseExportFilters {
  dateRange: DateRange;
  facilityId?: string;
  patientSearch?: string; // free-text: matches name or EMR number
  status?: string;
  doctorId?: string;
  /** IDs of specifically selected rows (for "export selected") */
  selectedIds?: string[];
}

// ─── Module-Specific Filter Extensions ───────────────────────────────────────

export interface LabExportFilters extends BaseExportFilters {
  labCategory?: string; // e.g. Haematology, Biochemistry
  testName?: string;
  resultStatus?: 'normal' | 'abnormal' | 'critical' | 'pending';
  priority?: string;
  patientCategory?: string;
  insuranceType?: string;
  coverageGroup?:
    | 'all_nhis'
    | 'civilian_nhis'
    | 'military_nhis'
    | 'security_nhis'
    | 'retainership'
    | 'private';
}

export interface ImagingExportFilters extends BaseExportFilters {
  modalityType?: string; // X-ray, CT, MRI, Ultrasound, Mammography, Other
  hasReport?: boolean; // filter unreported scans
}

export interface ProcedureExportFilters extends BaseExportFilters {
  priority?: 'Elective' | 'Emergency' | 'Urgent';
  surgeonId?: string;
  hasComplication?: boolean;
}

export interface DentalExportFilters extends BaseExportFilters {
  procedureType?: string; // Scaling, Filling, Extraction, Root Canal, etc.
  visitType?: 'Routine' | 'Emergency';
  treatmentComplete?: boolean;
}

export interface PhysioExportFilters extends BaseExportFilters {
  condition?: string; // Back Pain, Stroke Rehab, Fracture, etc.
  planStatus?: string; // Active, Completed, Discontinued
  progressStatus?: 'improving' | 'no_change' | 'worsening';
  therapistId?: string;
}

export interface OphthalmologyExportFilters extends BaseExportFilters {
  condition?: string; // Cataract, Glaucoma, Refractive Error, etc.
  pendingSurgery?: boolean;
  hasPrescription?: boolean;
}

// ─── Summary Row Types ────────────────────────────────────────────────────────

export interface MetricCard {
  label: string;
  value: number | string;
  subLabel?: string;
}

export interface BreakdownRow {
  label: string;
  count: number;
  percentage?: number;
}

// ─── Lab Report ───────────────────────────────────────────────────────────────

export interface LabReportSummary {
  period: string;
  total_tests: number;
  completed: number;
  pending: number;
  abnormal: number;
  critical: number;
  top_tests: BreakdownRow[];
  by_category: BreakdownRow[];
  by_patient_category: BreakdownRow[];
  by_insurance_type: BreakdownRow[];
  by_status: BreakdownRow[];
}

export interface LabReportRecord {
  id: string;
  emr_number: string;
  patient_name: string;
  patient_category: string;
  insurance_type: string;
  test_name: string;
  category: string;
  status: string;
  priority: string;
  result_value?: string;
  result_flag?: string; // Normal / Abnormal / Critical
  requested_by: string;
  requested_at: string;
  collected_at?: string;
  completed_at?: string;
  turnaround_hours?: number;
}

export interface LabReport {
  summary: LabReportSummary;
  records: LabReportRecord[];
  critical_cases: LabReportRecord[];
  generated_at: string;
  generated_by: string;
  filters_applied: Record<string, unknown>;
}

// ─── Imaging Report ───────────────────────────────────────────────────────────

export interface ImagingReportSummary {
  period: string;
  total_scans: number;
  reported: number;
  unreported: number;
  by_modality: BreakdownRow[];
  by_status: BreakdownRow[];
}

export interface ImagingReportRecord {
  id: string;
  emr_number: string;
  patient_name: string;
  scan_type: string;
  indication: string;
  status: string;
  requested_by: string;
  radiologist?: string;
  report_summary?: string;
  requested_at: string;
  completed_at?: string;
  days_to_report?: number;
}

export interface ImagingReport {
  summary: ImagingReportSummary;
  records: ImagingReportRecord[];
  unreported_cases: ImagingReportRecord[];
  generated_at: string;
  generated_by: string;
  filters_applied: Record<string, unknown>;
}

// ─── Procedure Report ─────────────────────────────────────────────────────────

export interface ProcedureReportSummary {
  period: string;
  total_procedures: number;
  elective: number;
  emergency: number;
  completed: number;
  complications: number;
  cancelled: number;
  by_status: BreakdownRow[];
  by_priority: BreakdownRow[];
  top_procedures: BreakdownRow[];
}

export interface ProcedureReportRecord {
  id: string;
  procedure_number: string;
  emr_number: string;
  patient_name: string;
  procedure_name: string;
  priority: string;
  status: string;
  surgeon: string;
  anesthesia_type?: string;
  scheduled_date: string;
  completed_date?: string;
  duration_minutes?: number;
  outcome?: string;
  complications?: string;
  notes?: string;
}

export interface ProcedureReport {
  summary: ProcedureReportSummary;
  records: ProcedureReportRecord[];
  complication_cases: ProcedureReportRecord[];
  generated_at: string;
  generated_by: string;
  filters_applied: Record<string, unknown>;
}

// ─── Dental Report ────────────────────────────────────────────────────────────

export interface DentalReportSummary {
  period: string;
  total_exams: number;
  total_procedures: number;
  unique_patients: number;
  emergency_visits: number;
  follow_up_needed: number;
  incomplete_treatments: number;
  top_procedures: BreakdownRow[];
  by_status: BreakdownRow[];
}

export interface DentalReportRecord {
  id: string;
  emr_number: string;
  patient_name: string;
  chief_complaint?: string;
  diagnosis?: string;
  procedures_performed: string;
  dentist: string;
  visit_type: string;
  status: string;
  follow_up_required?: boolean;
  treatment_complete?: boolean;
  exam_date: string;
}

export interface DentalReport {
  summary: DentalReportSummary;
  records: DentalReportRecord[];
  incomplete_treatments: DentalReportRecord[];
  generated_at: string;
  generated_by: string;
  filters_applied: Record<string, unknown>;
}

// ─── Physiotherapy Report ─────────────────────────────────────────────────────

export interface PhysioReportSummary {
  period: string;
  total_sessions: number;
  unique_patients: number;
  active_plans: number;
  completed_plans: number;
  missed_sessions: number;
  improving: number;
  no_change: number;
  worsening: number;
  top_conditions: BreakdownRow[];
  by_plan_status: BreakdownRow[];
}

export interface PhysioReportRecord {
  patient_id: string;
  emr_number: string;
  patient_name: string;
  condition: string;
  therapist: string;
  plan_status: string;
  total_prescribed_sessions: number;
  completed_sessions: number;
  missed_sessions: number;
  compliance_rate: number;
  progress_status?: string;
  start_date: string;
  last_session_date?: string;
  discharge_date?: string;
  discharge_outcome?: string;
}

export interface PhysioReport {
  summary: PhysioReportSummary;
  records: PhysioReportRecord[];
  non_compliant: PhysioReportRecord[];
  generated_at: string;
  generated_by: string;
  filters_applied: Record<string, unknown>;
}

// ─── Ophthalmology Report ─────────────────────────────────────────────────────

export interface OphthalmologyReportSummary {
  period: string;
  total_exams: number;
  unique_patients: number;
  pending_surgeries: number;
  glasses_prescriptions: number;
  contact_lens_prescriptions: number;
  critical_cases: number;
  top_conditions: BreakdownRow[];
  by_status: BreakdownRow[];
}

export interface OphthalmologyReportRecord {
  id: string;
  emr_number: string;
  patient_name: string;
  va_right?: string;
  va_left?: string;
  iop_right?: number;
  iop_left?: number;
  diagnosis?: string;
  treatment?: string;
  doctor: string;
  status: string;
  has_glasses_rx?: boolean;
  has_surgery_pending?: boolean;
  exam_date: string;
}

export interface OphthalmologyReport {
  summary: OphthalmologyReportSummary;
  records: OphthalmologyReportRecord[];
  critical_cases: OphthalmologyReportRecord[];
  pending_surgeries: OphthalmologyReportRecord[];
  generated_at: string;
  generated_by: string;
  filters_applied: Record<string, unknown>;
}

// ─── Combined Hospital Month-End Report ──────────────────────────────────────

export interface HospitalReportSummary {
  period: string;
  facility_name?: string;
  generated_at: string;
  generated_by: string;
  lab: Pick<
    LabReportSummary,
    'total_tests' | 'completed' | 'pending' | 'critical'
  >;
  imaging: Pick<
    ImagingReportSummary,
    'total_scans' | 'reported' | 'unreported'
  >;
  procedures: Pick<
    ProcedureReportSummary,
    'total_procedures' | 'emergency' | 'complications'
  >;
  dental: Pick<
    DentalReportSummary,
    'total_exams' | 'unique_patients' | 'incomplete_treatments'
  >;
  physio: Pick<
    PhysioReportSummary,
    'total_sessions' | 'unique_patients' | 'missed_sessions'
  >;
  ophthalmology: Pick<
    OphthalmologyReportSummary,
    'total_exams' | 'pending_surgeries' | 'critical_cases'
  >;
}

export interface HospitalReport {
  summary: HospitalReportSummary;
  lab?: LabReport;
  imaging?: ImagingReport;
  procedures?: ProcedureReport;
  dental?: DentalReport;
  physio?: PhysioReport;
  ophthalmology?: OphthalmologyReport;
}

// ─── Export Audit Entry ───────────────────────────────────────────────────────

export interface ExportAuditEntry {
  module: string;
  format: ExportFormat;
  record_count: number;
  filters: Record<string, unknown>;
  exported_by: string;
  exported_by_name: string;
  exported_at: string;
}

// ─── Table Sheet for Excel ────────────────────────────────────────────────────

export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}
