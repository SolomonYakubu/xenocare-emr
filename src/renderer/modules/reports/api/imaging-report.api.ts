/**
 * XenoCare — Imaging Report API
 */

import { supabase } from '../../../api/supabaseClient';
import type {
  ImagingExportFilters,
  ImagingReport,
  ImagingReportRecord,
  ImagingReportSummary,
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

function daysApart(
  a: string | null | undefined,
  b: string | null | undefined,
): number | undefined {
  if (!a || !b) return undefined;
  return Math.round(
    Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 864e5,
  );
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

export async function fetchImagingReport(
  filters: ImagingExportFilters,
  _facilityId: string,
): Promise<ImagingReport> {
  let q = supabase
    .from('radiology_requests')
    .select('*')
    .gte('created_at', filters.dateRange.from)
    .lte('created_at', filters.dateRange.to)
    .order('created_at', { ascending: false });

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.doctorId) q = q.eq('ordered_by', filters.doctorId);

  const { data, error } = await q;
  if (error) throw error;

  const rows = data || [];

  // Hydrate patients and staff
  const patientMap = await resolvePatients(rows.map((r) => r.patient_id));
  const allStaffIds = [
    ...rows.map((r) => r.ordered_by).filter(Boolean),
    ...rows.map((r) => r.radiologist_id).filter(Boolean),
  ];
  const staffMap = await resolveStaff(allStaffIds);

  // Hydrate imaging catalogue for modality/name
  const imagingIds = [
    ...new Set(rows.map((r) => r.imaging_id).filter(Boolean)),
  ];
  const imagingMap = new Map<
    string,
    { imaging_name: string; imaging_type: string }
  >();
  if (imagingIds.length) {
    const { data: imgs } = await supabase
      .from('imaging_catalogue')
      .select('imaging_id, imaging_name, imaging_type')
      .in('imaging_id', imagingIds);
    (imgs || []).forEach((i) => imagingMap.set(i.imaging_id, i));
  }

  const records: ImagingReportRecord[] = rows
    .map((req) => {
      const patient = patientMap.get(req.patient_id);
      const doctor = req.ordered_by ? staffMap.get(req.ordered_by) : undefined;
      const radiologist = req.radiologist_id
        ? staffMap.get(req.radiologist_id)
        : undefined;
      const imaging = req.imaging_id
        ? imagingMap.get(req.imaging_id)
        : undefined;
      const patientName = patient
        ? `${patient.first_name || ''} ${patient.surname || ''}`.trim()
        : '—';
      const emr = patient?.emr_number || '—';
      const docName = doctor
        ? `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim()
        : '—';
      const radName = radiologist
        ? `${radiologist.first_name || ''} ${radiologist.last_name || ''}`.trim()
        : '—';
      const modality = imaging?.imaging_type || req.imaging_type || '—';

      if (filters.modalityType && modality !== filters.modalityType)
        return null;
      const hasReport = !!(req.impression || req.report || req.findings);
      if (filters.hasReport === true && !hasReport) return null;
      if (filters.hasReport === false && hasReport) return null;

      return {
        id: req.request_id || req.id || '',
        emr_number: emr,
        patient_name: patientName,
        scan_type: modality,
        indication: req.indication || req.clinical_notes || '—',
        status: req.status,
        requested_by: docName,
        radiologist: radName,
        report_summary:
          req.impression || req.report || req.findings || undefined,
        requested_at: req.created_at,
        completed_at: req.performed_at || req.completed_at || undefined,
        days_to_report: daysApart(
          req.created_at,
          req.performed_at || req.completed_at,
        ),
      } as ImagingReportRecord;
    })
    .filter((r): r is ImagingReportRecord => r !== null);

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
  const total = finalRecords.length;
  const reported = finalRecords.filter((r) => r.report_summary).length;
  const unreported = total - reported;
  const unreportedCases = finalRecords.filter(
    (r) => !r.report_summary && r.status !== 'Cancelled',
  );

  const modalityCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    modalityCounts[r.scan_type] = (modalityCounts[r.scan_type] || 0) + 1;
  });
  const byModality: BreakdownRow[] = Object.entries(modalityCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, percentage: pct(count, total) }));

  const stCounts: Record<string, number> = {};
  finalRecords.forEach((r) => {
    stCounts[r.status] = (stCounts[r.status] || 0) + 1;
  });
  const byStatus: BreakdownRow[] = Object.entries(stCounts).map(
    ([label, count]) => ({ label, count, percentage: pct(count, total) }),
  );

  const summary: ImagingReportSummary = {
    period: formatPeriod(filters.dateRange.from, filters.dateRange.to),
    total_scans: total,
    reported,
    unreported,
    by_modality: byModality,
    by_status: byStatus,
  };

  return {
    summary,
    records: finalRecords,
    unreported_cases: unreportedCases,
    generated_at: new Date().toISOString(),
    generated_by: '',
    filters_applied: filters as unknown as Record<string, unknown>,
  };
}
