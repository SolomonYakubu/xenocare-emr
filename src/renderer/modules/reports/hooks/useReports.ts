/**
 * XenoCare
 * Report System — TanStack Query Hooks
 *
 * These hooks are used by the per-module export panels and report modals.
 * They delegate data fetching to the API layer and handle caching.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchLabReport } from '../api/lab-report.api';
import { fetchImagingReport } from '../api/imaging-report.api';
import { fetchProcedureReport } from '../api/procedure-report.api';
import { fetchDentalReport } from '../api/dental-report.api';
import { fetchPhysioReport } from '../api/physio-report.api';
import { fetchOphthalmologyReport } from '../api/ophthalmology-report.api';
import {
  fetchHospitalReport,
  type HospitalReportOptions,
} from '../api/hospital-report.api';
import type {
  LabExportFilters,
  ImagingExportFilters,
  ProcedureExportFilters,
  DentalExportFilters,
  PhysioExportFilters,
  OphthalmologyExportFilters,
} from '../types/report.types';

// ─── Lab ──────────────────────────────────────────────────────────────────────

export function useLabReport(
  filters: LabExportFilters | null,
  facilityId: string | null,
) {
  return useQuery({
    queryKey: ['lab-report', filters, facilityId],
    queryFn: () => fetchLabReport(filters!, facilityId!),
    enabled: !!filters && !!facilityId && !!filters.dateRange.from,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Imaging ──────────────────────────────────────────────────────────────────

export function useImagingReport(
  filters: ImagingExportFilters | null,
  facilityId: string | null,
) {
  return useQuery({
    queryKey: ['imaging-report', filters, facilityId],
    queryFn: () => fetchImagingReport(filters!, facilityId!),
    enabled: !!filters && !!facilityId && !!filters.dateRange.from,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Procedures ───────────────────────────────────────────────────────────────

export function useProcedureReport(
  filters: ProcedureExportFilters | null,
  facilityId: string | null,
) {
  return useQuery({
    queryKey: ['procedure-report', filters, facilityId],
    queryFn: () => fetchProcedureReport(filters!, facilityId!),
    enabled: !!filters && !!facilityId && !!filters.dateRange.from,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Dental ───────────────────────────────────────────────────────────────────

export function useDentalReport(
  filters: DentalExportFilters | null,
  facilityId: string | null,
) {
  return useQuery({
    queryKey: ['dental-report', filters, facilityId],
    queryFn: () => fetchDentalReport(filters!, facilityId!),
    enabled: !!filters && !!facilityId && !!filters.dateRange.from,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Physiotherapy ────────────────────────────────────────────────────────────

export function usePhysioReport(
  filters: PhysioExportFilters | null,
  facilityId: string | null,
) {
  return useQuery({
    queryKey: ['physio-report', filters, facilityId],
    queryFn: () => fetchPhysioReport(filters!, facilityId!),
    enabled: !!filters && !!facilityId && !!filters.dateRange.from,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Ophthalmology ────────────────────────────────────────────────────────────

export function useOphthalmologyReport(
  filters: OphthalmologyExportFilters | null,
  facilityId: string | null,
) {
  return useQuery({
    queryKey: ['ophthalmology-report', filters, facilityId],
    queryFn: () => fetchOphthalmologyReport(filters!, facilityId!),
    enabled: !!filters && !!facilityId && !!filters.dateRange.from,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Combined Hospital ────────────────────────────────────────────────────────

export function useHospitalReport(opts: HospitalReportOptions | null) {
  return useQuery({
    queryKey: ['hospital-report', opts],
    queryFn: () => fetchHospitalReport(opts!),
    enabled: !!opts && !!opts.facilityId && !!opts.dateRange.from,
    staleTime: 1000 * 60 * 5,
  });
}
