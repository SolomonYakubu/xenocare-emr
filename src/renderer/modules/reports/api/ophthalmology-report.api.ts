/**
 * XenoCare — Ophthalmology Report API
 */

import { supabase } from '../../../api/supabaseClient';
import type {
  OphthalmologyExportFilters,
  OphthalmologyReport,
  OphthalmologyReportRecord,
  OphthalmologyReportSummary,
  BreakdownRow,
} from '../types/report.types';

function pct(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function formatPeriod(from: string, to: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return `${fmt(from)} – ${fmt(to)}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolvePatients(patientIds: string[]) {
  const ids = [...new Set(patientIds.filter(Boolean))];
  const map = new Map<
    string,
    { first_name: string; surname: string; emr_number: string | null }
  >();
  if (!ids.length) return map;
  const { data } = await supabase
    .from('patients')
    .select('patient_id, first_name, surname, emr_number')
    .in('patient_id', ids);
  (data || []).forEach((p) => map.set(p.patient_id, p));
  return map;
}

async function resolveStaff(staffIds: string[]) {
  const ids = [...new Set(staffIds.filter(Boolean))];
  const map = new Map<string, { first_name: string; last_name: string }>();
  if (!ids.length) return map;
  const uuids = ids.filter((id) => UUID_RE.test(id));
  const legacy = ids.filter((id) => !UUID_RE.test(id));
  if (uuids.length) {
    const { data } = await supabase
      .from('staff')
      .select('id, first_name, last_name')
      .in('id', uuids);
    (data || []).forEach((s) => map.set(s.id, s));
  }
  if (legacy.length) {
    const { data } = await supabase
      .from('staff')
      .select('staff_id, first_name, last_name')
      .in('staff_id', legacy);
    (data || []).forEach((s) => {
      if (s.staff_id) map.set(s.staff_id, s);
    });
  }
  return map;
}

export async function fetchOphthalmologyReport(
  filters: OphthalmologyExportFilters,
  _facilityId: string,
): Promise<OphthalmologyReport> {
  let q = supabase
    .from('eye_exams')
    .select('*')
    .gte('created_at', filters.dateRange.from)
    .lte('created_at', filters.dateRange.to)
    .order('created_at', { ascending: false });

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.doctorId) q = q.eq('created_by', filters.doctorId);

  const { data, error } = await q;
  if (error) throw error;

  const rows = data || [];

  // Hydrate patients and doctors
  const patientMap = await resolvePatients(rows.map((r) => r.patient_id));
  const staffMap = await resolveStaff(
    rows.map((r) => r.created_by).filter(Boolean),
  );

  // Fetch sub-table data (eye_prescriptions and eye_procedures)
  const examIds = rows.map((r) => r.exam_id || r.id).filter(Boolean);
  const rxMap = new Map<string, Array<{ prescription_type: string }>>();
  const procMap = new Map<string, Array<{ status: string }>>();

  if (examIds.length) {
    const { data: rxData } = await supabase
      .from('eye_prescriptions')
      .select('exam_id, prescription_type')
      .in('exam_id', examIds);
    (rxData || []).forEach((rx) => {
      if (!rxMap.has(rx.exam_id)) rxMap.set(rx.exam_id, []);
      rxMap.get(rx.exam_id)!.push(rx);
    });

    const { data: procData } = await supabase
      .from('eye_procedures')
      .select('exam_id, status, procedure_type')
      .in('exam_id', examIds);
    (procData || []).forEach((p) => {
      if (!procMap.has(p.exam_id)) procMap.set(p.exam_id, []);
      procMap.get(p.exam_id)!.push(p);
    });
  }

  const allRecords: OphthalmologyReportRecord[] = rows.map((exam) => {
    const examKey = exam.exam_id || exam.id;
    const patient = patientMap.get(exam.patient_id);
    const doctor = exam.created_by ? staffMap.get(exam.created_by) : undefined;
    const prescriptions = rxMap.get(examKey) || [];
    const procedures = procMap.get(examKey) || [];

    const hasGlassesRx = prescriptions.some(
      (p) => p.prescription_type === 'Glasses',
    );
    const hasContactRx = prescriptions.some(
      (p) => p.prescription_type === 'Contact Lens',
    );
    const hasSurgeryPending = procedures.some((p) =>
      ['Scheduled', 'Pending', 'Approved'].includes(p.status || ''),
    );

    // Identify critical cases (glaucoma)
    const diagLower = (exam.diagnosis || '').toLowerCase();
    const isCritical =
      diagLower.includes('glaucoma') ||
      diagLower.includes('retinal detachment') ||
      diagLower.includes('optic neuropathy');

    return {
      id: examKey,
      emr_number: patient?.emr_number || '—',
      patient_name: patient
        ? `${patient.first_name || ''} ${patient.surname || ''}`.trim()
        : '—',
      va_right: exam.va_right,
      va_left: exam.va_left,
      iop_right: exam.iop_right,
      iop_left: exam.iop_left,
      diagnosis: exam.diagnosis,
      treatment: exam.treatment_plan,
      doctor: doctor
        ? `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim()
        : '—',
      status: exam.status || '—',
      has_glasses_rx: hasGlassesRx || hasContactRx,
      has_surgery_pending: hasSurgeryPending,
      exam_date: exam.created_at,
      _is_critical: isCritical,
    } as OphthalmologyReportRecord & { _is_critical: boolean };
  });

  // Filters
  let filteredRecords = allRecords as (OphthalmologyReportRecord & {
    _is_critical: boolean;
  })[];
  if (filters.condition) {
    filteredRecords = filteredRecords.filter((r) =>
      (r.diagnosis || '')
        .toLowerCase()
        .includes(filters.condition!.toLowerCase()),
    );
  }
  if (filters.pendingSurgery === true) {
    filteredRecords = filteredRecords.filter((r) => r.has_surgery_pending);
  } else if (filters.pendingSurgery === false) {
    filteredRecords = filteredRecords.filter((r) => !r.has_surgery_pending);
  }
  if (filters.hasPrescription === true) {
    filteredRecords = filteredRecords.filter((r) => r.has_glasses_rx);
  } else if (filters.hasPrescription === false) {
    filteredRecords = filteredRecords.filter((r) => !r.has_glasses_rx);
  }
  if (filters.patientSearch) {
    filteredRecords = filteredRecords.filter(
      (r) =>
        r.patient_name
          .toLowerCase()
          .includes(filters.patientSearch!.toLowerCase()) ||
        r.emr_number
          .toLowerCase()
          .includes(filters.patientSearch!.toLowerCase()),
    );
  }

  const total = filteredRecords.length;
  const uniquePatients = new Set(filteredRecords.map((r) => r.emr_number)).size;
  const pendingSurgeries = filteredRecords.filter((r) => r.has_surgery_pending);
  const glassesRx = filteredRecords.filter((r) => r.has_glasses_rx).length;
  const criticalCases = filteredRecords.filter((r) => r._is_critical);

  // Top conditions
  const condCounts: Record<string, number> = {};
  filteredRecords.forEach((r) => {
    const key = r.diagnosis || 'No diagnosis';
    condCounts[key] = (condCounts[key] || 0) + 1;
  });
  const topConditions: BreakdownRow[] = Object.entries(condCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count, percentage: pct(count, total) }));

  const stCounts: Record<string, number> = {};
  filteredRecords.forEach((r) => {
    stCounts[r.status] = (stCounts[r.status] || 0) + 1;
  });
  const byStatus: BreakdownRow[] = Object.entries(stCounts).map(
    ([label, count]) => ({ label, count, percentage: pct(count, total) }),
  );

  const summary: OphthalmologyReportSummary = {
    period: formatPeriod(filters.dateRange.from, filters.dateRange.to),
    total_exams: total,
    unique_patients: uniquePatients,
    pending_surgeries: pendingSurgeries.length,
    glasses_prescriptions: glassesRx,
    contact_lens_prescriptions: filteredRecords.filter((r) => r.has_glasses_rx)
      .length,
    critical_cases: criticalCases.length,
    top_conditions: topConditions,
    by_status: byStatus,
  };

  // Strip internal _is_critical before returning
  const cleanRecords = filteredRecords.map(
    ({ _is_critical, ...r }) => r as OphthalmologyReportRecord,
  );
  const cleanCritical = criticalCases.map(
    ({ _is_critical, ...r }) => r as OphthalmologyReportRecord,
  );
  const cleanSurgeries = pendingSurgeries.map(
    ({ _is_critical, ...r }) => r as OphthalmologyReportRecord,
  );

  return {
    summary,
    records: cleanRecords,
    critical_cases: cleanCritical,
    pending_surgeries: cleanSurgeries,
    generated_at: new Date().toISOString(),
    generated_by: '',
    filters_applied: filters as unknown as Record<string, unknown>,
  };
}
