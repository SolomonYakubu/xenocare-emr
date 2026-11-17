/**
 * XenoCare — Physiotherapy Report API
 */

import { supabase } from '../../../api/supabaseClient';
import type {
  PhysioExportFilters,
  PhysioReport,
  PhysioReportRecord,
  PhysioReportSummary,
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

export async function fetchPhysioReport(
  filters: PhysioExportFilters,
  _facilityId: string,
): Promise<PhysioReport> {
  // Query treatment plans as the unit of analysis
  let q = supabase
    .from('physio_plans')
    .select('*')
    .gte('created_at', filters.dateRange.from)
    .lte('created_at', filters.dateRange.to)
    .order('created_at', { ascending: false });

  if (filters.planStatus) q = q.eq('status', filters.planStatus);
  if (filters.therapistId) q = q.eq('therapist_id', filters.therapistId);

  const { data, error } = await q;
  if (error) throw error;

  const rows = data || [];

  // Hydrate patients and therapists
  const patientMap = await resolvePatients(rows.map((r) => r.patient_id));
  const staffMap = await resolveStaff(
    rows.map((r) => r.therapist_id).filter(Boolean),
  );

  // Fetch latest progress per plan
  const planIds = rows.map((r) => r.plan_id || r.id).filter(Boolean);
  const progressMap = new Map<string, { overall_progress?: string }>();
  if (planIds.length) {
    const { data: progresses } = await supabase
      .from('physio_progress')
      .select('plan_id, overall_progress, assessment_date')
      .in('plan_id', planIds)
      .order('assessment_date', { ascending: false });
    // Keep only the latest per plan_id
    (progresses || []).forEach((p) => {
      if (!progressMap.has(p.plan_id)) progressMap.set(p.plan_id, p);
    });
  }

  // Total sessions in the period
  const { count: totalSessionsCount } = await supabase
    .from('physio_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('session_date', filters.dateRange.from)
    .lte('session_date', filters.dateRange.to);

  const records: PhysioReportRecord[] = rows.map((plan) => {
    const patient = patientMap.get(plan.patient_id);
    const therapist = plan.therapist_id
      ? staffMap.get(plan.therapist_id)
      : undefined;
    const planKey = plan.plan_id || plan.id;
    const latestProg = progressMap.get(planKey);

    const prescribed = plan.total_sessions_prescribed || 0;
    const completed = plan.sessions_completed || 0;
    const missed = plan.sessions_missed || 0;
    const compliance =
      prescribed > 0 ? Math.round((completed / prescribed) * 100) : 0;

    return {
      patient_id: patient?.emr_number || planKey,
      emr_number: patient?.emr_number || '—',
      patient_name: patient
        ? `${patient.first_name || ''} ${patient.surname || ''}`.trim()
        : '—',
      condition: plan.condition || plan.diagnosis || '—',
      therapist: therapist
        ? `${therapist.first_name || ''} ${therapist.last_name || ''}`.trim()
        : '—',
      plan_status: plan.status || '—',
      total_prescribed_sessions: prescribed,
      completed_sessions: completed,
      missed_sessions: missed,
      compliance_rate: compliance,
      progress_status: latestProg?.overall_progress,
      start_date: plan.start_date || plan.created_at,
      last_session_date: plan.end_date,
      discharge_date: plan.discharge_date,
      discharge_outcome: plan.discharge_outcome,
    };
  });

  // Apply filters
  let finalRecords = records;
  if (filters.condition) {
    finalRecords = finalRecords.filter((r) =>
      r.condition.toLowerCase().includes(filters.condition!.toLowerCase()),
    );
  }
  if (filters.progressStatus) {
    finalRecords = finalRecords.filter(
      (r) => r.progress_status === filters.progressStatus,
    );
  }
  if (filters.patientSearch) {
    finalRecords = finalRecords.filter(
      (r) =>
        r.patient_name
          .toLowerCase()
          .includes(filters.patientSearch!.toLowerCase()) ||
        r.emr_number
          .toLowerCase()
          .includes(filters.patientSearch!.toLowerCase()),
    );
  }

  const total = finalRecords.length;
  const uniquePatients = new Set(finalRecords.map((r) => r.emr_number)).size;
  const activePlans = finalRecords.filter(
    (r) => r.plan_status === 'Active',
  ).length;
  const completedPlans = finalRecords.filter(
    (r) => r.plan_status === 'Completed',
  ).length;
  const missedTotal = finalRecords.reduce(
    (acc, r) => acc + r.missed_sessions,
    0,
  );
  const improving = finalRecords.filter(
    (r) => r.progress_status === 'improving',
  ).length;
  const noChange = finalRecords.filter(
    (r) => r.progress_status === 'no_change',
  ).length;
  const worsening = finalRecords.filter(
    (r) => r.progress_status === 'worsening',
  ).length;
  const nonCompliant = finalRecords.filter((r) => r.compliance_rate < 70);

  // Top conditions
  const condCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    condCounts[r.condition] = (condCounts[r.condition] || 0) + 1;
  });
  const topConditions: BreakdownRow[] = Object.entries(condCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count, percentage: pct(count, total) }));

  const stCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    stCounts[r.plan_status] = (stCounts[r.plan_status] || 0) + 1;
  });
  const byPlanStatus: BreakdownRow[] = Object.entries(stCounts).map(
    ([label, count]) => ({ label, count, percentage: pct(count, total) }),
  );

  const summary: PhysioReportSummary = {
    period: formatPeriod(filters.dateRange.from, filters.dateRange.to),
    total_sessions: totalSessionsCount || 0,
    unique_patients: uniquePatients,
    active_plans: activePlans,
    completed_plans: completedPlans,
    missed_sessions: missedTotal,
    improving,
    no_change: noChange,
    worsening,
    top_conditions: topConditions,
    by_plan_status: byPlanStatus,
  };

  return {
    summary,
    records: finalRecords,
    non_compliant: nonCompliant,
    generated_at: new Date().toISOString(),
    generated_by: '',
    filters_applied: filters as unknown as Record<string, unknown>,
  };
}
