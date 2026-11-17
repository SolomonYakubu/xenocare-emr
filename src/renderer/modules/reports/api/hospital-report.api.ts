/**
 * XenoCare — Combined Hospital Month-End Report API
 * Aggregates all 6 modules into a single executive-level report.
 */

import { fetchLabReport } from './lab-report.api';
import { fetchImagingReport } from './imaging-report.api';
import { fetchProcedureReport } from './procedure-report.api';
import { fetchDentalReport } from './dental-report.api';
import { fetchPhysioReport } from './physio-report.api';
import { fetchOphthalmologyReport } from './ophthalmology-report.api';
import { supabase } from '../../../api/supabaseClient';
import type {
  DateRange,
  HospitalReport,
  HospitalReportSummary,
} from '../types/report.types';

export interface HospitalReportOptions {
  dateRange: DateRange;
  facilityId: string;
  facilityName?: string;
  generatedBy: string;
  modules?: {
    lab?: boolean;
    imaging?: boolean;
    procedures?: boolean;
    dental?: boolean;
    physio?: boolean;
    ophthalmology?: boolean;
  };
}

export async function fetchHospitalReport(
  opts: HospitalReportOptions,
): Promise<HospitalReport> {
  const { dateRange, facilityId, facilityName, generatedBy } = opts;
  const mods = opts.modules ?? {
    lab: true,
    imaging: true,
    procedures: true,
    dental: true,
    physio: true,
    ophthalmology: true,
  };
  const baseFilters = { dateRange };

  // Run all enabled module fetches in parallel
  const [lab, imaging, procedures, dental, physio, ophthalmology] =
    await Promise.allSettled([
      mods.lab
        ? fetchLabReport(baseFilters, facilityId)
        : Promise.resolve(undefined),
      mods.imaging
        ? fetchImagingReport(baseFilters, facilityId)
        : Promise.resolve(undefined),
      mods.procedures
        ? fetchProcedureReport(baseFilters, facilityId)
        : Promise.resolve(undefined),
      mods.dental
        ? fetchDentalReport(baseFilters, facilityId)
        : Promise.resolve(undefined),
      mods.physio
        ? fetchPhysioReport(baseFilters, facilityId)
        : Promise.resolve(undefined),
      mods.ophthalmology
        ? fetchOphthalmologyReport(baseFilters, facilityId)
        : Promise.resolve(undefined),
    ]);

  const get = <T>(result: PromiseSettledResult<T | undefined>) =>
    result.status === 'fulfilled' ? result.value : undefined;

  const labReport = get(lab);
  const imagingReport = get(imaging);
  const procedureReport = get(procedures);
  const dentalReport = get(dental);
  const physioReport = get(physio);
  const ophthalmologyReport = get(ophthalmology);

  const formatPeriod = (dr: DateRange) => {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    return `${fmt(dr.from)} – ${fmt(dr.to)}`;
  };

  const summary: HospitalReportSummary = {
    period: formatPeriod(dateRange),
    facility_name: facilityName,
    generated_at: new Date().toISOString(),
    generated_by: generatedBy,
    lab: {
      total_tests: labReport?.summary.total_tests ?? 0,
      completed: labReport?.summary.completed ?? 0,
      pending: labReport?.summary.pending ?? 0,
      critical: labReport?.summary.critical ?? 0,
    },
    imaging: {
      total_scans: imagingReport?.summary.total_scans ?? 0,
      reported: imagingReport?.summary.reported ?? 0,
      unreported: imagingReport?.summary.unreported ?? 0,
    },
    procedures: {
      total_procedures: procedureReport?.summary.total_procedures ?? 0,
      emergency: procedureReport?.summary.emergency ?? 0,
      complications: procedureReport?.summary.complications ?? 0,
    },
    dental: {
      total_exams: dentalReport?.summary.total_exams ?? 0,
      unique_patients: dentalReport?.summary.unique_patients ?? 0,
      incomplete_treatments: dentalReport?.summary.incomplete_treatments ?? 0,
    },
    physio: {
      total_sessions: physioReport?.summary.total_sessions ?? 0,
      unique_patients: physioReport?.summary.unique_patients ?? 0,
      missed_sessions: physioReport?.summary.missed_sessions ?? 0,
    },
    ophthalmology: {
      total_exams: ophthalmologyReport?.summary.total_exams ?? 0,
      pending_surgeries: ophthalmologyReport?.summary.pending_surgeries ?? 0,
      critical_cases: ophthalmologyReport?.summary.critical_cases ?? 0,
    },
  };

  return {
    summary,
    lab: labReport,
    imaging: imagingReport,
    procedures: procedureReport,
    dental: dentalReport,
    physio: physioReport,
    ophthalmology: ophthalmologyReport,
  };
}
