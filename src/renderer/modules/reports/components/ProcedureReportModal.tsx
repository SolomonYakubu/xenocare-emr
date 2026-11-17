/**
 * XenoCare — Procedure Report Modal
 */

import React, { useState } from 'react';
import { Stethoscope, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/FormElements';
import { FilterPanel } from './FilterPanel';
import { ExportToolbar } from './ExportToolbar';
import { useProcedureReport } from '../hooks/useReports';
import { dispatchExport, formatDate } from '../services/export.service';
import { logExportAudit } from '../services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { getDefaultDateRange } from '../types/report.types';
import type {
  ProcedureExportFilters,
  ExportFormat,
  ExcelSheet,
} from '../types/report.types';
import type { PDFReportOptions } from '../services/export.service';
import { useAuth } from '../../../contexts/AuthContext';
import { useFacilityId } from '../../../hooks/useFacilityId';

const DEFAULT_FILTERS: ProcedureExportFilters = {
  dateRange: getDefaultDateRange(),
};

const STATUS_OPTIONS = [
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Postponed', label: 'Postponed' },
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

export function ProcedureReportModal({
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
    useState<ProcedureExportFilters>(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] =
    useState<ProcedureExportFilters>(DEFAULT_FILTERS);
  const {
    data: report,
    isLoading,
    error,
  } = useProcedureReport(activeFilters, facilityId);

  function buildSheets(): ExcelSheet[] {
    if (!report) return [];
    const summaryRows = [
      ['Period', report.summary.period],
      ['Total Procedures', report.summary.total_procedures],
      ['Elective', report.summary.elective],
      ['Emergency/Urgent', report.summary.emergency],
      ['Completed', report.summary.completed],
      ['With Complications', report.summary.complications],
      ['Cancelled', report.summary.cancelled],
    ];
    const detailRows = report.records.map((r) => [
      r.procedure_number,
      r.emr_number,
      r.patient_name,
      r.procedure_name,
      r.priority,
      r.status,
      r.surgeon,
      r.anesthesia_type || '',
      formatDate(r.scheduled_date),
      formatDate(r.completed_date),
      r.duration_minutes ?? '',
      r.outcome || '',
      r.complications || '',
      r.notes || '',
    ]);
    const compRows = report.complication_cases.map((r) => [
      r.procedure_number,
      r.emr_number,
      r.patient_name,
      r.procedure_name,
      r.surgeon,
      formatDate(r.scheduled_date),
      r.complications || '',
    ]);
    return [
      { name: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
      {
        name: 'All Procedures',
        headers: [
          'Procedure No.',
          'EMR',
          'Patient',
          'Procedure',
          'Priority',
          'Status',
          'Surgeon',
          'Anaesthesia',
          'Scheduled',
          'Completed',
          'Duration (min)',
          'Outcome',
          'Complications',
          'Notes',
        ],
        rows: detailRows,
      },
      {
        name: 'Complications',
        headers: [
          'Procedure No.',
          'EMR',
          'Patient',
          'Procedure',
          'Surgeon',
          'Date',
          'Complications',
        ],
        rows: compRows,
      },
    ];
  }

  function buildPDFOpts(): PDFReportOptions {
    const s = report?.summary;
    return {
      title: 'Procedures Month-End Report',
      subtitle: `Period: ${s?.period || ''}`,
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      orientation: 'landscape',
      sections: [
        {
          title: 'Summary',
          summaryRows: [
            { label: 'Total Procedures', value: s?.total_procedures ?? 0 },
            { label: 'Elective', value: s?.elective ?? 0 },
            { label: 'Emergency/Urgent', value: s?.emergency ?? 0 },
            { label: 'Completed', value: s?.completed ?? 0 },
            { label: 'With Complications', value: s?.complications ?? 0 },
            { label: 'Cancelled', value: s?.cancelled ?? 0 },
          ],
        },
        {
          title: 'Top Procedures Performed',
          tableHeaders: ['Procedure', 'Count', '%'],
          tableRows: (s?.top_procedures || []).map((p) => [
            p.label,
            p.count,
            `${p.percentage}%`,
          ]),
        },
        {
          title: 'All Procedure Records',
          tableHeaders: [
            'Proc No.',
            'EMR',
            'Patient',
            'Procedure',
            'Priority',
            'Status',
            'Surgeon',
            'Date',
          ],
          tableRows: (report?.records || [])
            .slice(0, 500)
            .map((r) => [
              r.procedure_number,
              r.emr_number,
              r.patient_name,
              r.procedure_name,
              r.priority,
              r.status,
              r.surgeon,
              formatDate(r.scheduled_date),
            ]),
        },
        {
          title: 'Complication Cases',
          tableHeaders: [
            'Proc No.',
            'EMR',
            'Patient',
            'Procedure',
            'Surgeon',
            'Date',
            'Complications',
          ],
          tableRows: (report?.complication_cases || []).map((r) => [
            r.procedure_number,
            r.emr_number,
            r.patient_name,
            r.procedure_name,
            r.surgeon,
            formatDate(r.scheduled_date),
            r.complications || '—',
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
        `XenoCare_Procedures_Report_${new Date().toISOString().split('T')[0]}`,
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
        module: 'procedures',
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
      title="Procedures Month-End Report"
      size="max"
      allowMaximize
    >
      <div className="space-y-4">
        <FilterPanel
          module="procedure"
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
            icon={Stethoscope}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard
                label="Total"
                value={report.summary.total_procedures}
                color="blue"
              />
              <SummaryCard
                label="Elective"
                value={report.summary.elective}
                color="green"
              />
              <SummaryCard
                label="Emergency"
                value={report.summary.emergency}
                color="red"
              />
              <SummaryCard
                label="Completed"
                value={report.summary.completed}
                color="green"
              />
              <SummaryCard
                label="Complications"
                value={report.summary.complications}
                color="red"
              />
              <SummaryCard
                label="Cancelled"
                value={report.summary.cancelled}
                color="gray"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Top Procedures
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Procedure</th>
                      <th className="pb-1.5 text-right">Count</th>
                      <th className="pb-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.top_procedures.map((p) => (
                      <tr key={p.label} className="border-b border-gray-50">
                        <td className="py-1">{p.label}</td>
                        <td className="py-1 text-right font-medium">
                          {p.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {p.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  By Priority
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Priority</th>
                      <th className="pb-1.5 text-right">Count</th>
                      <th className="pb-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.by_priority.map((p) => (
                      <tr key={p.label} className="border-b border-gray-50">
                        <td className="py-1">{p.label}</td>
                        <td className="py-1 text-right font-medium">
                          {p.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {p.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {report.complication_cases.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Complication Cases (
                  {report.complication_cases.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead className="bg-red-100">
                      <tr className="text-left text-red-700">
                        {[
                          'Proc No.',
                          'EMR',
                          'Patient',
                          'Procedure',
                          'Surgeon',
                          'Date',
                          'Complications',
                        ].map((h) => (
                          <th key={h} className="px-2 py-1.5">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.complication_cases.map((r) => (
                        <tr key={r.id} className="border-b border-red-100">
                          <td className="px-2 py-1.5 font-mono">
                            {r.procedure_number}
                          </td>
                          <td className="px-2 py-1.5 font-mono">
                            {r.emr_number}
                          </td>
                          <td className="px-2 py-1.5">{r.patient_name}</td>
                          <td className="px-2 py-1.5">{r.procedure_name}</td>
                          <td className="px-2 py-1.5">{r.surgeon}</td>
                          <td className="px-2 py-1.5">
                            {formatDate(r.scheduled_date)}
                          </td>
                          <td className="px-2 py-1.5 text-red-800">
                            {r.complications || '—'}
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
                  All Procedure Records ({report.records.length})
                </h4>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr className="text-left text-gray-600">
                      {[
                        'Proc No.',
                        'EMR',
                        'Patient',
                        'Procedure',
                        'Priority',
                        'Status',
                        'Surgeon',
                        'Scheduled',
                        'Duration',
                        'Outcome',
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
                          {r.procedure_number}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {r.emr_number}
                        </td>
                        <td className="px-3 py-1.5">{r.patient_name}</td>
                        <td className="px-3 py-1.5">{r.procedure_name}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                              r.priority === 'Emergency'
                                ? 'bg-red-100 text-red-700'
                                : r.priority === 'Urgent'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {r.priority}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                              r.status === 'Completed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">{r.surgeon}</td>
                        <td className="px-3 py-1.5">
                          {formatDate(r.scheduled_date)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {r.duration_minutes ?? '—'}
                        </td>
                        <td className="px-3 py-1.5">{r.outcome || '—'}</td>
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
