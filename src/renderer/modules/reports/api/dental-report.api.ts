/**
 * XenoCare — Dental Report API
 */

import { supabase } from '../../../api/supabaseClient';
import type {
  DentalExportFilters,
  DentalReport,
  DentalReportRecord,
  DentalReportSummary,
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

export async function fetchDentalReport(
  filters: DentalExportFilters,
  _facilityId: string,
): Promise<DentalReport> {
  let q = supabase
    .from('dental_exams')
    .select('*')
    .gte('created_at', filters.dateRange.from)
    .lte('created_at', filters.dateRange.to)
    .order('created_at', { ascending: false });

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.doctorId) q = q.eq('created_by', filters.doctorId);
  if (filters.treatmentComplete === true) q = q.eq('treatment_complete', true);
  if (filters.treatmentComplete === false)
    q = q.eq('treatment_complete', false);

  const { data, error } = await q;
  if (error) throw error;

  const rows = data || [];

  // Hydrate patients and dentists
  const patientMap = await resolvePatients(rows.map((r) => r.patient_id));
  const staffMap = await resolveStaff(
    rows.map((r) => r.created_by).filter(Boolean),
  );

  // Fetch dental procedures for each exam (sub-table with UUID FK)
  const examIds = rows.map((r) => r.exam_id || r.id).filter(Boolean);
  const procMap = new Map<
    string,
    Array<{ procedure_name?: string; procedure_type?: string }>
  >();
  if (examIds.length) {
    const { data: procs } = await supabase
      .from('dental_procedures')
      .select('exam_id, procedure_name, procedure_type')
      .in('exam_id', examIds);
    (procs || []).forEach((p) => {
      const key = p.exam_id;
      if (!procMap.has(key)) procMap.set(key, []);
      procMap.get(key)!.push(p);
    });
  }

  const allRecords: DentalReportRecord[] = rows.map((exam) => {
    const patient = patientMap.get(exam.patient_id);
    const dentist = exam.created_by ? staffMap.get(exam.created_by) : undefined;
    const examKey = exam.exam_id || exam.id;
    const procs = procMap.get(examKey) || [];
    const procNames =
      procs
        .map((p) => p.procedure_name || p.procedure_type || '')
        .filter(Boolean)
        .join(', ') || '—';

    return {
      id: exam.exam_id || exam.id || '',
      emr_number: patient?.emr_number || '—',
      patient_name: patient
        ? `${patient.first_name || ''} ${patient.surname || ''}`.trim()
        : '—',
      chief_complaint: exam.chief_complaint,
      diagnosis: exam.diagnosis,
      procedures_performed: procNames,
      dentist: dentist
        ? `${dentist.first_name || ''} ${dentist.last_name || ''}`.trim()
        : '—',
      visit_type: (exam.chief_complaint || '')
        .toLowerCase()
        .includes('emergency')
        ? 'Emergency'
        : 'Routine',
      status: exam.status || '—',
      follow_up_required: exam.follow_up_required,
      treatment_complete: exam.treatment_complete,
      exam_date: exam.created_at,
    };
  });

  // Apply dental procedure type filter (post-query because it's on sub-records)
  let filteredRecords = allRecords;
  if (filters.procedureType) {
    filteredRecords = allRecords.filter((r) =>
      r.procedures_performed
        .toLowerCase()
        .includes(filters.procedureType!.toLowerCase()),
    );
  }
  if (filters.visitType) {
    filteredRecords = filteredRecords.filter(
      (r) => r.visit_type === filters.visitType,
    );
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
  const emergency = filteredRecords.filter(
    (r) => r.visit_type === 'Emergency',
  ).length;
  const followUpNeeded = filteredRecords.filter(
    (r) => r.follow_up_required,
  ).length;
  const incomplete = filteredRecords.filter(
    (r) => r.treatment_complete === false,
  );

  // Count procedure types
  const procCounts: Record<string, number> = {};
  for (const rec of filteredRecords) {
    rec.procedures_performed
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => {
        procCounts[p] = (procCounts[p] || 0) + 1;
      });
  }
  const topProcedures: BreakdownRow[] = Object.entries(procCounts)
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

  const summary: DentalReportSummary = {
    period: formatPeriod(filters.dateRange.from, filters.dateRange.to),
    total_exams: total,
    total_procedures: filteredRecords.reduce(
      (acc, r) =>
        acc +
        (r.procedures_performed === '—'
          ? 0
          : r.procedures_performed.split(',').length),
      0,
    ),
    unique_patients: uniquePatients,
    emergency_visits: emergency,
    follow_up_needed: followUpNeeded,
    incomplete_treatments: incomplete.length,
    top_procedures: topProcedures,
    by_status: byStatus,
  };

  return {
    summary,
    records: filteredRecords,
    incomplete_treatments: incomplete,
    generated_at: new Date().toISOString(),
    generated_by: '',
    filters_applied: filters as unknown as Record<string, unknown>,
  };
}
