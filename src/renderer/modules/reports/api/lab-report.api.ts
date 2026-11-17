/**
 * XenoCare — Lab Report API
 *
 * Provides structured, filtered, DB-level queries for Lab month-end reports.
 * Returns typed data consumed by LabReportModal and the export service.
 */

import { supabase } from '../../../api/supabaseClient';
import type {
  LabExportFilters,
  LabReport,
  LabReportRecord,
  LabReportSummary,
  BreakdownRow,
} from '../types/report.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(part: number, total: number): number {
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

function hoursApart(
  a: string | null | undefined,
  b: string | null | undefined,
): number | undefined {
  if (!a || !b) return undefined;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 36e5);
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function normalizeLabCategory(value: string | null | undefined): string {
  const normalized = normalizeText(value);

  if (!normalized) return '';
  if (normalized.includes('haemat') || normalized.includes('hemat')) {
    return 'hematology';
  }
  if (
    normalized.includes('chemical pathology') ||
    normalized.includes('biochem') ||
    normalized.includes('clinical chemistry')
  ) {
    return 'chemical pathology';
  }
  if (normalized.includes('micro')) return 'microbiology';
  if (normalized.includes('sero')) return 'serology';
  if (normalized.includes('immun')) return 'immunology';
  if (normalized.includes('histo')) return 'histopathology';
  if (normalized.includes('urin')) return 'urinalysis';
  if (normalized.includes('paras')) return 'parasitology';

  return normalized;
}

function normalizeInsuranceType(value: string | null | undefined): string {
  return normalizeText(value);
}

function resolveCoverageGroup(
  insuranceType: string | null | undefined,
): LabExportFilters['coverageGroup'] | undefined {
  const normalized = normalizeInsuranceType(insuranceType);

  if (!normalized) return undefined;
  if (normalized === 'civilian nhis' || normalized === 'gifship') {
    return 'civilian_nhis';
  }
  if (normalized === 'military nhis' || normalized === 'dhml') {
    return 'military_nhis';
  }
  if (normalized === 'security services nhis') {
    return 'security_nhis';
  }
  if (normalized === 'retainership') {
    return 'retainership';
  }
  if (normalized === 'private') {
    return 'private';
  }

  return undefined;
}

function matchesCoverageGroup(
  insuranceType: string | null | undefined,
  coverageGroup: LabExportFilters['coverageGroup'] | undefined,
): boolean {
  if (!coverageGroup) return true;

  const resolvedGroup = resolveCoverageGroup(insuranceType);

  if (coverageGroup === 'all_nhis') {
    return (
      resolvedGroup === 'civilian_nhis' ||
      resolvedGroup === 'military_nhis' ||
      resolvedGroup === 'security_nhis'
    );
  }

  return resolvedGroup === coverageGroup;
}

// ─── Hydration helpers ────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolvePatients(patientIds: string[]) {
  const ids = [...new Set(patientIds.filter(Boolean))];
  const map = new Map<
    string,
    {
      first_name: string;
      surname: string;
      emr_number: string | null;
      patient_category: string | null;
      insurance_type: string | null;
    }
  >();
  if (!ids.length) return map;
  const { data } = await supabase
    .from('patients')
    .select(
      'patient_id, first_name, surname, emr_number, patient_category, insurance_type',
    )
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

// ─── Main query ───────────────────────────────────────────────────────────────

export async function fetchLabReport(
  filters: LabExportFilters,
  facilityId: string,
): Promise<LabReport> {
  // Fetch main records without FK joins (patient_id is a varchar FK, not tracked by PostgREST)
  let q = supabase
    .from('lab_requests')
    .select('*')
    .gte('created_at', filters.dateRange.from)
    .lte('created_at', filters.dateRange.to)
    .order('created_at', { ascending: false });

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.doctorId) q = q.eq('ordered_by', filters.doctorId);

  const { data, error } = await q;
  if (error) throw error;

  const rows = data || [];

  // Hydrate patients and staff separately
  const patientMap = await resolvePatients(rows.map((r) => r.patient_id));
  const staffMap = await resolveStaff(
    rows.map((r) => r.ordered_by).filter(Boolean),
  );

  // Hydrate test names from lab_test_catalogue
  const testIds = [...new Set(rows.map((r) => r.test_id).filter(Boolean))];
  const testMap = new Map<string, { name: string; category: string | null }>();
  if (testIds.length) {
    const { data: tests } = await supabase
      .from('lab_test_catalogue')
      .select('id, name, category')
      .in('id', testIds);
    (tests || []).forEach((t) => testMap.set(t.id, t));
  }

  // Build one record per request
  const records: LabReportRecord[] = rows
    .map((req) => {
      const patient = patientMap.get(req.patient_id);
      const staff = req.ordered_by ? staffMap.get(req.ordered_by) : undefined;
      const test = req.test_id ? testMap.get(req.test_id) : undefined;
      const patientName = patient
        ? `${patient.first_name || ''} ${patient.surname || ''}`.trim()
        : '—';
      const emr = patient?.emr_number || '—';
      const patientCategory = patient?.patient_category || 'Unspecified';
      const insuranceType = patient?.insurance_type || 'Unspecified';
      const docName = staff
        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
        : '—';
      const testName = test?.name || '—';
      const category = test?.category || '—';

      // Apply item-level filters
      if (
        filters.labCategory &&
        normalizeLabCategory(category) !==
          normalizeLabCategory(filters.labCategory)
      ) {
        return null;
      }
      if (
        filters.testName &&
        !testName.toLowerCase().includes(filters.testName.toLowerCase())
      )
        return null;
      if (
        filters.patientCategory &&
        normalizeText(patientCategory) !== normalizeText(filters.patientCategory)
      ) {
        return null;
      }
      if (
        filters.insuranceType &&
        normalizeInsuranceType(insuranceType) !==
          normalizeInsuranceType(filters.insuranceType)
      ) {
        return null;
      }
      if (!matchesCoverageGroup(insuranceType, filters.coverageGroup)) {
        return null;
      }
      if (filters.resultStatus) {
        if (
          filters.resultStatus === 'pending' &&
          !['Pending', 'Processing', 'Sample Collected'].includes(req.status)
        )
          return null;
        if (
          filters.resultStatus === 'abnormal' &&
          req.result_status !== 'Abnormal'
        )
          return null;
        if (
          filters.resultStatus === 'critical' &&
          req.result_status !== 'Critical'
        )
          return null;
        if (filters.resultStatus === 'normal' && req.result_status !== 'Normal')
          return null;
      }

      return {
        id: req.request_id || req.id || '',
        emr_number: emr,
        patient_name: patientName,
        patient_category: patientCategory,
        insurance_type: insuranceType,
        test_name: testName,
        category,
        status: req.status,
        priority: req.priority || 'Routine',
        result_value: req.result != null ? String(req.result) : undefined,
        result_flag: req.result_status || undefined,
        requested_by: docName,
        requested_at: req.created_at,
        collected_at: req.sample_collected_at || undefined,
        completed_at: req.processed_at || undefined,
        turnaround_hours: hoursApart(req.sample_collected_at, req.processed_at),
      } as LabReportRecord;
    })
    .filter((r): r is LabReportRecord => r !== null);

  // Filter by patient search
  const finalRecords = filters.patientSearch
    ? records.filter(
        (r) =>
          r.patient_name
            .toLowerCase()
            .includes(filters.patientSearch!.toLowerCase()) ||
          r.emr_number
            .toLowerCase()
            .includes(filters.patientSearch!.toLowerCase()),
      )
    : records;

  // ── Summary ──
  const total = finalRecords.length;
  const completed = finalRecords.filter((r) => r.status === 'Completed').length;
  const pending = finalRecords.filter((r) =>
    ['Pending', 'Processing', 'Sample Collected'].includes(r.status),
  ).length;
  const abnormal = finalRecords.filter(
    (r) => r.result_flag === 'Abnormal',
  ).length;
  const critical = finalRecords.filter(
    (r) => r.result_flag === 'Critical',
  ).length;
  const criticalCases = finalRecords.filter(
    (r) => r.result_flag === 'Critical',
  );

  // Top tests
  const testCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    testCounts[r.test_name] = (testCounts[r.test_name] || 0) + 1;
  });
  const topTests: BreakdownRow[] = Object.entries(testCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, count]) => ({ label, count, percentage: pct(count, total) }));

  // By category
  const catCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    catCounts[r.category] = (catCounts[r.category] || 0) + 1;
  });
  const byCategory: BreakdownRow[] = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, percentage: pct(count, total) }));

  const patientCategoryCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    patientCategoryCounts[r.patient_category] =
      (patientCategoryCounts[r.patient_category] || 0) + 1;
  });
  const byPatientCategory: BreakdownRow[] = Object.entries(
    patientCategoryCounts,
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, percentage: pct(count, total) }));

  const insuranceCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    insuranceCounts[r.insurance_type] =
      (insuranceCounts[r.insurance_type] || 0) + 1;
  });
  const byInsuranceType: BreakdownRow[] = Object.entries(insuranceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, percentage: pct(count, total) }));

  // By status
  const stCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    stCounts[r.status] = (stCounts[r.status] || 0) + 1;
  });
  const byStatus: BreakdownRow[] = Object.entries(stCounts).map(
    ([label, count]) => ({ label, count, percentage: pct(count, total) }),
  );

  const summary: LabReportSummary = {
    period: formatPeriod(filters.dateRange.from, filters.dateRange.to),
    total_tests: total,
    completed,
    pending,
    abnormal,
    critical,
    top_tests: topTests,
    by_category: byCategory,
    by_patient_category: byPatientCategory,
    by_insurance_type: byInsuranceType,
    by_status: byStatus,
  };

  return {
    summary,
    records: finalRecords,
    critical_cases: criticalCases,
    generated_at: new Date().toISOString(),
    generated_by: '', // filled in by hook
    filters_applied: filters as unknown as Record<string, unknown>,
  };
}
