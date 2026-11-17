/**
 * XenoCare — Ophthalmology Report Modal
 */

import React, { useState } from 'react';
import { Eye, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/FormElements';
import { FilterPanel } from './FilterPanel';
import { ExportToolbar } from './ExportToolbar';
import { useOphthalmologyReport } from '../hooks/useReports';
import { dispatchExport, formatDate } from '../services/export.service';
import { logExportAudit } from '../services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { getDefaultDateRange } from '../types/report.types';
import type {
  OphthalmologyExportFilters,
  ExportFormat,
  ExcelSheet,
} from '../types/report.types';
import type { PDFReportOptions } from '../services/export.service';
import { useAuth } from '../../../contexts/AuthContext';
import { useFacilityId } from '../../../hooks/useFacilityId';

const DEFAULT_FILTERS: OphthalmologyExportFilters = {
  dateRange: getDefaultDateRange(),
};
const STATUS_OPTIONS = [
  { value: 'Completed', label: 'Completed' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Cancelled', label: 'Cancelled' },
];

function SummaryCard({
  label,
  value,
  color = 'blue',
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  };
  return (
    <div
      className={`border rounded-xl p-4 text-center ${colors[color] || colors.blue}`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 font-medium opacity-80">{label}</div>
    </div>
  );
}

export function OphthalmologyReportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const { staff } = useAuth();
  const { facilityId } = useFacilityId();
  const [filters, setFilters] =
    useState<OphthalmologyExportFilters>(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] =
    useState<OphthalmologyExportFilters>(DEFAULT_FILTERS);
  const {
    data: report,
    isLoading,
    error,
  } = useOphthalmologyReport(activeFilters, facilityId);

  function buildSheets(): ExcelSheet[] {
    if (!report) return [];
    const summaryRows = [
      ['Period', report.summary.period],
      ['Total Exams', report.summary.total_exams],
      ['Unique Patients', report.summary.unique_patients],
      ['Pending Surgeries', report.summary.pending_surgeries],
      ['Glasses Prescriptions', report.summary.glasses_prescriptions],
      ['Contact Lens Prescriptions', report.summary.contact_lens_prescriptions],
      ['Critical Cases', report.summary.critical_cases],
    ];
    const detailRows = report.records.map((r) => [
      r.emr_number,
      r.patient_name,
      formatDate(r.exam_date),
      r.va_right || '',
      r.va_left || '',
      r.iop_right ?? '',
      r.iop_left ?? '',
      r.diagnosis || '',
      r.treatment || '',
      r.has_glasses_rx ? 'Yes' : 'No',
      '',
      '',
      r.doctor,
      r.status,
      '',
    ]);
    const criticalRows = report.critical_cases.map((r) => [
      r.emr_number,
      r.patient_name,
      formatDate(r.exam_date),
      r.diagnosis || '',
      r.treatment || '',
      r.doctor,
      r.status,
    ]);
    const surgeryRows = report.pending_surgeries.map((r) => [
      r.emr_number,
      r.patient_name,
      formatDate(r.exam_date),
      r.diagnosis || '',
      r.treatment || '',
      r.doctor,
      '',
    ]);
    return [
      { name: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
      {
        name: 'All Exams',
        headers: [
          'EMR',
          'Patient',
          'Date',
          'VA R',
          'VA L',
          'IOP R',
          'IOP L',
          'Diagnosis',
          'Treatment',
          'Glasses',
          'Contact Lens',
          'Procedure',
          'Doctor',
          'Status',
          'Follow-Up',
        ],
        rows: detailRows,
      },
      {
        name: 'Critical Cases',
        headers: [
          'EMR',
          'Patient',
          'Date',
          'Diagnosis',
          'Treatment',
          'Doctor',
          'Status',
        ],
        rows: criticalRows,
      },
      {
        name: 'Pending Surgeries',
        headers: [
          'EMR',
          'Patient',
          'Date',
          'Diagnosis',
          'Treatment',
          'Doctor',
          'Follow-Up Date',
        ],
        rows: surgeryRows,
      },
    ];
  }

  function buildPDFOpts(): PDFReportOptions {
    const s = report?.summary;
    return {
      title: 'Ophthalmology Month-End Report',
      subtitle: `Period: ${s?.period || ''}`,
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      orientation: 'landscape',
      sections: [
        {
          title: 'Summary',
          summaryRows: [
            { label: 'Total Exams', value: s?.total_exams ?? 0 },
            { label: 'Unique Patients', value: s?.unique_patients ?? 0 },
            { label: 'Pending Surgeries', value: s?.pending_surgeries ?? 0 },
            {
              label: 'Glasses Prescriptions',
              value: s?.glasses_prescriptions ?? 0,
            },
            { label: 'Critical Cases', value: s?.critical_cases ?? 0 },
          ],
        },
        {
          title: 'Top Diagnoses',
          tableHeaders: ['Diagnosis', 'Count', '%'],
          tableRows: (s?.top_conditions || []).map((c) => [
            c.label,
            c.count,
            `${c.percentage}%`,
          ]),
        },
        {
          title: 'Critical Cases',
          tableHeaders: [
            'EMR',
            'Patient',
            'Date',
            'Diagnosis',
            'Doctor',
            'Status',
          ],
          tableRows: (report?.critical_cases || []).map((r) => [
            r.emr_number,
            r.patient_name,
            formatDate(r.exam_date),
            r.diagnosis || '',
            r.doctor,
            r.status,
          ]),
        },
        {
          title: 'All Eye Exams',
          tableHeaders: [
            'EMR',
            'Patient',
            'Date',
            'Diagnosis',
            'Doctor',
            'Status',
          ],
          tableRows: (report?.records || [])
            .slice(0, 500)
            .map((r) => [
              r.emr_number,
              r.patient_name,
              formatDate(r.exam_date),
              r.diagnosis || '',
              r.doctor,
              r.status,
            ]),
        },
      ],
    };
  }

  async function handleExport(format: ExportFormat) {
    if (!report) return;
    try {
      dispatchExport(
        format,
        buildSheets(),
        buildPDFOpts(),
        `XenoCare_Ophthalmology_Report_${new Date().toISOString().split('T')[0]}`,
      );
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message:
          error instanceof Error
            ? error.message
            : 'The report export could not be generated.',
      });
      return;
    }
    try {
      await logExportAudit({
        module: 'ophthalmology',
        format,
        record_count: report.records.length,
        filters: activeFilters as unknown as Record<string, unknown>,
        exported_by: staff?.id || '',
        exported_by_name: staff ? `${staff.first_name} ${staff.last_name}` : '',
        exported_at: new Date().toISOString(),
      });
    } catch {
      showToast({
        type: 'warning',
        title: 'Audit Log Pending',
        message:
          'The report exported successfully, but its audit entry could not be recorded right now.',
      });
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ophthalmology Month-End Report"
      size="max"
      allowMaximize
    >
      <div className="space-y-4">
        <FilterPanel
          module="ophthalmology"
          filters={filters}
          onChange={setFilters}
          onReset={() => {
            setFilters(DEFAULT_FILTERS);
            setActiveFilters(DEFAULT_FILTERS);
          }}
          statusOptions={STATUS_OPTIONS}
        />
        <div className="flex justify-between items-center">
          <Button
            variant="primary"
            size="sm"
            icon={Eye}
            onClick={() => setActiveFilters({ ...filters })}
            isLoading={isLoading}
          >
            Generate Report
          </Button>
          <ExportToolbar
            onExport={handleExport}
            recordCount={report?.records.length}
            disabled={!report}
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 size={24} className="animate-spin mr-2" /> Generating…
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">
            {(error as Error).message}
          </div>
        )}

        {report && !isLoading && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <SummaryCard
                label="Total Exams"
                value={report.summary.total_exams}
                color="blue"
              />
              <SummaryCard
                label="Unique Patients"
                value={report.summary.unique_patients}
                color="green"
              />
              <SummaryCard
                label="Pending Surgeries"
                value={report.summary.pending_surgeries}
                color="yellow"
              />
              <SummaryCard
                label="Glasses Prescriptions"
                value={report.summary.glasses_prescriptions}
                color="purple"
              />
              <SummaryCard
                label="Critical Cases"
                value={report.summary.critical_cases}
                color="red"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Top Diagnoses
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Diagnosis</th>
                      <th className="pb-1.5 text-right">Count</th>
                      <th className="pb-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.top_conditions.map((c) => (
                      <tr key={c.label} className="border-b border-gray-50">
                        <td className="py-1">{c.label}</td>
                        <td className="py-1 text-right font-medium">
                          {c.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {c.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Exam Status Breakdown
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Status</th>
                      <th className="pb-1.5 text-right">Count</th>
                      <th className="pb-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.by_status.map((s) => (
                      <tr key={s.label} className="border-b border-gray-50">
                        <td className="py-1">{s.label}</td>
                        <td className="py-1 text-right font-medium">
                          {s.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {s.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {report.critical_cases.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Critical Cases — Glaucoma / High
                  IOP / Retinal Pathology ({report.critical_cases.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead className="bg-red-100">
                      <tr className="text-left text-red-700">
                        {[
                          'EMR',
                          'Patient',
                          'Date',
                          'Diagnosis',
                          'Treatment',
                          'Doctor',
                          'Status',
                        ].map((h) => (
                          <th key={h} className="px-2 py-1.5">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.critical_cases.map((r) => (
                        <tr key={r.id} className="border-b border-red-100">
                          <td className="px-2 py-1.5 font-mono">
                            {r.emr_number}
                          </td>
                          <td className="px-2 py-1.5">{r.patient_name}</td>
                          <td className="px-2 py-1.5">
                            {formatDate(r.exam_date)}
                          </td>
                          <td className="px-2 py-1.5 text-red-800 font-medium">
                            {r.diagnosis}
                          </td>
                          <td className="px-2 py-1.5">{r.treatment || '—'}</td>
                          <td className="px-2 py-1.5">{r.doctor}</td>
                          <td className="px-2 py-1.5">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {report.pending_surgeries.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Pending Surgeries (
                  {report.pending_surgeries.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead className="bg-yellow-100">
                      <tr className="text-left text-yellow-700">
                        {[
                          'EMR',
                          'Patient',
                          'Date',
                          'Diagnosis',
                          'Treatment Plan',
                          'Doctor',
                          'Follow-Up',
                        ].map((h) => (
                          <th key={h} className="px-2 py-1.5">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.pending_surgeries.map((r) => (
                        <tr key={r.id} className="border-b border-yellow-100">
                          <td className="px-2 py-1.5 font-mono">
                            {r.emr_number}
                          </td>
                          <td className="px-2 py-1.5">{r.patient_name}</td>
                          <td className="px-2 py-1.5">
                            {formatDate(r.exam_date)}
                          </td>
                          <td className="px-2 py-1.5">{r.diagnosis || '—'}</td>
                          <td className="px-2 py-1.5">{r.treatment || '—'}</td>
                          <td className="px-2 py-1.5">{r.doctor}</td>
                          <td className="px-2 py-1.5">
                            {r.has_surgery_pending ? 'Scheduled' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-700">
                  All Eye Exams ({report.records.length})
                </h4>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs min-w-[1000px]">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr className="text-left text-gray-600">
                      {[
                        'EMR',
                        'Patient',
                        'Date',
                        'VA R/L',
                        'IOP R/L',
                        'Diagnosis',
                        'Treatment',
                        'Doctor',
                        'Status',
                      ].map((h) => (
                        <th key={h} className="px-3 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.records.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {r.emr_number}
                        </td>
                        <td className="px-3 py-1.5">{r.patient_name}</td>
                        <td className="px-3 py-1.5">
                          {formatDate(r.exam_date)}
                        </td>
                        <td className="px-3 py-1.5">
                          {r.va_right || '—'} / {r.va_left || '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          {r.iop_right ?? '—'} / {r.iop_left ?? '—'}
                        </td>
                        <td className="px-3 py-1.5 max-w-[180px] truncate">
                          {r.diagnosis || '—'}
                        </td>
                        <td className="px-3 py-1.5 max-w-[160px] truncate">
                          {r.treatment || '—'}
                        </td>
                        <td className="px-3 py-1.5">{r.doctor}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                              r.status === 'Completed'
                                ? 'bg-green-100 text-green-700'
                                : r.status === 'Pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
