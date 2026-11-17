/**
 * XenoCare — Imaging Report Modal
 */

import React, { useState } from 'react';
import { Scan, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/FormElements';
import { FilterPanel } from './FilterPanel';
import { ExportToolbar } from './ExportToolbar';
import { useImagingReport } from '../hooks/useReports';
import { dispatchExport, formatDate } from '../services/export.service';
import { logExportAudit } from '../services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { getDefaultDateRange } from '../types/report.types';
import type {
  ImagingExportFilters,
  ExportFormat,
  ExcelSheet,
} from '../types/report.types';
import type { PDFReportOptions } from '../services/export.service';
import { useAuth } from '../../../contexts/AuthContext';
import { useFacilityId } from '../../../hooks/useFacilityId';

const DEFAULT_FILTERS: ImagingExportFilters = {
  dateRange: getDefaultDateRange(),
};

const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
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
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
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

export function ImagingReportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const { staff } = useAuth();
  const { facilityId } = useFacilityId();
  const [filters, setFilters] = useState<ImagingExportFilters>(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] =
    useState<ImagingExportFilters>(DEFAULT_FILTERS);
  const {
    data: report,
    isLoading,
    error,
  } = useImagingReport(activeFilters, facilityId);

  function buildSheets(): ExcelSheet[] {
    if (!report) return [];
    const summaryRows = [
      ['Period', report.summary.period],
      ['Total Scans', report.summary.total_scans],
      ['Reported', report.summary.reported],
      ['Unreported', report.summary.unreported],
    ];
    const detailRows = report.records.map((r) => [
      r.emr_number,
      r.patient_name,
      r.scan_type,
      r.indication,
      r.status,
      r.requested_by,
      r.radiologist || '',
      r.report_summary || '',
      formatDate(r.requested_at),
      formatDate(r.completed_at),
      r.days_to_report ?? '',
    ]);
    const unreportedRows = report.unreported_cases.map((r) => [
      r.emr_number,
      r.patient_name,
      r.scan_type,
      r.indication,
      r.requested_by,
      formatDate(r.requested_at),
    ]);
    return [
      { name: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
      {
        name: 'All Scans',
        headers: [
          'EMR',
          'Patient',
          'Scan Type',
          'Indication',
          'Status',
          'Requested By',
          'Radiologist',
          'Report',
          'Requested At',
          'Completed At',
          'Days to Report',
        ],
        rows: detailRows,
      },
      {
        name: 'Unreported Cases',
        headers: [
          'EMR',
          'Patient',
          'Scan Type',
          'Indication',
          'Requested By',
          'Date',
        ],
        rows: unreportedRows,
      },
    ];
  }

  function buildPDFOpts(): PDFReportOptions {
    const s = report?.summary;
    return {
      title: 'Imaging / Radiology Month-End Report',
      subtitle: `Period: ${s?.period || ''}`,
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      orientation: 'landscape',
      sections: [
        {
          title: 'Summary',
          summaryRows: [
            { label: 'Total Scans', value: s?.total_scans ?? 0 },
            { label: 'Reported', value: s?.reported ?? 0 },
            { label: 'Unreported', value: s?.unreported ?? 0 },
          ],
        },
        {
          title: 'By Modality',
          tableHeaders: ['Modality', 'Count', '%'],
          tableRows: (s?.by_modality || []).map((m) => [
            m.label,
            m.count,
            `${m.percentage}%`,
          ]),
        },
        {
          title: 'Full Scan Records',
          tableHeaders: [
            'EMR',
            'Patient',
            'Scan Type',
            'Status',
            'Requested By',
            'Radiologist',
            'Date',
          ],
          tableRows: (report?.records || [])
            .slice(0, 500)
            .map((r) => [
              r.emr_number,
              r.patient_name,
              r.scan_type,
              r.status,
              r.requested_by,
              r.radiologist || '—',
              formatDate(r.requested_at),
            ]),
        },
        {
          title: 'Unreported / Delayed Cases',
          tableHeaders: [
            'EMR',
            'Patient',
            'Scan Type',
            'Indication',
            'Requested By',
            'Date',
          ],
          tableRows: (report?.unreported_cases || []).map((r) => [
            r.emr_number,
            r.patient_name,
            r.scan_type,
            r.indication,
            r.requested_by,
            formatDate(r.requested_at),
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
        `XenoCare_Imaging_Report_${new Date().toISOString().split('T')[0]}`,
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
        module: 'imaging',
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
      title="Imaging / Radiology Month-End Report"
      size="max"
      allowMaximize
    >
      <div className="space-y-4">
        <FilterPanel
          module="imaging"
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
            icon={Scan}
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
                label="Total Scans"
                value={report.summary.total_scans}
                color="blue"
              />
              <SummaryCard
                label="Reported"
                value={report.summary.reported}
                color="green"
              />
              <SummaryCard
                label="Unreported"
                value={report.summary.unreported}
                color="yellow"
              />
              <SummaryCard
                label="Period"
                value={report.summary.period}
                color="gray"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  By Modality
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Modality</th>
                      <th className="pb-1.5 text-right">Count</th>
                      <th className="pb-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.by_modality.map((m) => (
                      <tr key={m.label} className="border-b border-gray-50">
                        <td className="py-1">{m.label}</td>
                        <td className="py-1 text-right font-medium">
                          {m.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {m.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  By Status
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
                    {report.summary.by_status.map((m) => (
                      <tr key={m.label} className="border-b border-gray-50">
                        <td className="py-1">{m.label}</td>
                        <td className="py-1 text-right font-medium">
                          {m.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {m.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {report.unreported_cases.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Unreported / Delayed Cases (
                  {report.unreported_cases.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead className="bg-yellow-100">
                      <tr className="text-left text-yellow-700">
                        {[
                          'EMR',
                          'Patient',
                          'Scan Type',
                          'Indication',
                          'Requested By',
                          'Date',
                        ].map((h) => (
                          <th key={h} className="px-2 py-1.5">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.unreported_cases.map((r) => (
                        <tr key={r.id} className="border-b border-yellow-100">
                          <td className="px-2 py-1.5 font-mono">
                            {r.emr_number}
                          </td>
                          <td className="px-2 py-1.5">{r.patient_name}</td>
                          <td className="px-2 py-1.5">{r.scan_type}</td>
                          <td className="px-2 py-1.5">{r.indication}</td>
                          <td className="px-2 py-1.5">{r.requested_by}</td>
                          <td className="px-2 py-1.5">
                            {formatDate(r.requested_at)}
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
                  All Scan Records ({report.records.length})
                </h4>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr className="text-left text-gray-600">
                      {[
                        'EMR',
                        'Patient',
                        'Scan Type',
                        'Status',
                        'Requested By',
                        'Radiologist',
                        'Date',
                        'Days to Report',
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
                        <td className="px-3 py-1.5">{r.scan_type}</td>
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
                        <td className="px-3 py-1.5">{r.requested_by}</td>
                        <td className="px-3 py-1.5">{r.radiologist || '—'}</td>
                        <td className="px-3 py-1.5">
                          {formatDate(r.requested_at)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {r.days_to_report ?? '—'}
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
