/**
 * XenoCare — Procedure Report API
 */

import { supabase } from '../../../api/supabaseClient';
import type {
  ProcedureExportFilters,
  ProcedureReport,
  ProcedureReportRecord,
  ProcedureReportSummary,
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

export async function fetchProcedureReport(
  filters: ProcedureExportFilters,
  facilityId: string,
): Promise<ProcedureReport> {
  let q = supabase
    .from('procedures')
    .select('*')
    .eq('facility_id', facilityId)
    .gte('scheduled_date', filters.dateRange.from)
    .lte('scheduled_date', filters.dateRange.to)
    .order('scheduled_date', { ascending: false });

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.surgeonId) q = q.eq('primary_surgeon_id', filters.surgeonId);

  const { data, error } = await q;
  if (error) throw error;

  const rows = data || [];

  // Hydrate patients and surgeons
  const patientMap = await resolvePatients(rows.map((r) => r.patient_id));
  const staffMap = await resolveStaff(
    rows.map((r) => r.primary_surgeon_id).filter(Boolean),
  );

  const records: ProcedureReportRecord[] = rows.map((proc) => {
    const patient = patientMap.get(proc.patient_id);
    const surgeon = proc.primary_surgeon_id
      ? staffMap.get(proc.primary_surgeon_id)
      : undefined;
    const patientName = patient
      ? `${patient.first_name || ''} ${patient.surname || ''}`.trim()
      : '—';
    const emr = patient?.emr_number || '—';
    const surgeonName = surgeon
      ? `${surgeon.first_name || ''} ${surgeon.last_name || ''}`.trim()
      : '—';

    let durationMins: number | undefined;
    if (proc.actual_start_time && proc.actual_end_time) {
      durationMins = Math.round(
        (new Date(proc.actual_end_time).getTime() -
          new Date(proc.actual_start_time).getTime()) /
          60000,
      );
    }

    return {
      id: proc.id,
      procedure_number: proc.procedure_number || '—',
      emr_number: emr,
      patient_name: patientName,
      procedure_name: proc.procedure_name || '—',
      priority: proc.priority || '—',
      status: proc.status || '—',
      surgeon: surgeonName,
      anesthesia_type: proc.anesthesia_type,
      scheduled_date: proc.scheduled_date,
      completed_date: proc.actual_end_time,
      duration_minutes: durationMins,
      outcome: proc.post_op_diagnosis,
      complications: proc.complications,
      notes: proc.notes || proc.procedure_notes,
    };
  });

  let finalRecords = records;

  if (filters.hasComplication !== undefined) {
    finalRecords = finalRecords.filter((r) => {
      const hasComplication = Boolean(
        r.complications && String(r.complications).trim(),
      );
      return filters.hasComplication ? hasComplication : !hasComplication;
    });
  }

  if (filters.patientSearch) {
    const searchTerm = filters.patientSearch.toLowerCase();
    finalRecords = finalRecords.filter(
      (r) =>
        r.patient_name.toLowerCase().includes(searchTerm) ||
        r.emr_number.toLowerCase().includes(searchTerm),
    );
  }

  const total = finalRecords.length;
  const elective = finalRecords.filter((r) => r.priority === 'Elective').length;
  const emergency = finalRecords.filter(
    (r) => r.priority === 'Emergency' || r.priority === 'Urgent',
  ).length;
  const completed = finalRecords.filter((r) => r.status === 'Completed').length;
  const complications = finalRecords.filter((r) => r.complications).length;
  const cancelled = finalRecords.filter((r) => r.status === 'Cancelled').length;
  const complicationCases = finalRecords.filter((r) => r.complications);

  const stCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    stCounts[r.status] = (stCounts[r.status] || 0) + 1;
  });
  const byStatus: BreakdownRow[] = Object.entries(stCounts).map(
    ([label, count]) => ({ label, count, percentage: pct(count, total) }),
  );

  const priCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    priCounts[r.priority] = (priCounts[r.priority] || 0) + 1;
  });
  const byPriority: BreakdownRow[] = Object.entries(priCounts).map(
    ([label, count]) => ({ label, count, percentage: pct(count, total) }),
  );

  const procCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    procCounts[r.procedure_name] = (procCounts[r.procedure_name] || 0) + 1;
  });
  const topProcedures: BreakdownRow[] = Object.entries(procCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count, percentage: pct(count, total) }));

  const summary: ProcedureReportSummary = {
    period: formatPeriod(filters.dateRange.from, filters.dateRange.to),
    total_procedures: total,
    elective,
    emergency,
    completed,
    complications,
    cancelled,
    by_status: byStatus,
    by_priority: byPriority,
    top_procedures: topProcedures,
  };

  return {
    summary,
    records: finalRecords,
    complication_cases: complicationCases,
    generated_at: new Date().toISOString(),
    generated_by: '',
    filters_applied: filters as unknown as Record<string, unknown>,
  };
}
