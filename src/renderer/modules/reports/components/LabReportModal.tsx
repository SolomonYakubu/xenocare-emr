/**
 * XenoCare — Lab Report Modal
 *
 * Month-end Lab report: summary metrics + detailed table + critical alerts.
 * Supports CSV, Excel, and PDF export of the generated report.
 */

import React, { useState } from 'react';
import {
  FlaskConical,
  AlertTriangle,
  Download,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/FormElements';
import { FilterPanel } from './FilterPanel';
import { ExportToolbar } from './ExportToolbar';
import { useLabReport } from '../hooks/useReports';
import { dispatchExport, formatDate } from '../services/export.service';
import { logExportAudit } from '../services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { getDefaultDateRange } from '../types/report.types';
import type {
  LabExportFilters,
  ExportFormat,
  LabReportRecord,
  ExcelSheet,
} from '../types/report.types';
import type { PDFReportOptions } from '../services/export.service';
import { useAuth } from '../../../contexts/AuthContext';
import { useFacilityId } from '../../../hooks/useFacilityId';

interface LabReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_FILTERS: LabExportFilters = {
  dateRange: getDefaultDateRange(),
};

const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Processing', label: 'Processing' },
  { value: 'Sample Collected', label: 'Sample Collected' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Rejected', label: 'Rejected' },
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

export function LabReportModal({ isOpen, onClose }: LabReportModalProps) {
  const { showToast } = useToast();
  const { staff } = useAuth();
  const { facilityId } = useFacilityId();
  const [filters, setFilters] = useState<LabExportFilters>(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] =
    useState<LabExportFilters>(DEFAULT_FILTERS);

  const {
    data: report,
    isLoading,
    error,
    refetch,
  } = useLabReport(activeFilters, facilityId);

  function applyFilters() {
    setActiveFilters({ ...filters });
  }

  function buildSheets(): ExcelSheet[] {
    if (!report) return [];
    const summaryRows: (string | number | null)[][] = [
      ['Period', report.summary.period],
      ['Total Tests', report.summary.total_tests],
      ['Completed', report.summary.completed],
      ['Pending', report.summary.pending],
      ['Abnormal', report.summary.abnormal],
      ['Critical', report.summary.critical],
    ];
    const detailRows = report.records.map((r) => [
      r.emr_number,
      r.patient_name,
      r.patient_category,
      r.insurance_type,
      r.test_name,
      r.category,
      r.status,
      r.priority,
      r.result_value || '',
      r.result_flag || '',
      r.requested_by,
      formatDate(r.requested_at),
      formatDate(r.collected_at),
      formatDate(r.completed_at),
      r.turnaround_hours !== undefined ? r.turnaround_hours : '',
    ]);
    const critRows = report.critical_cases.map((r) => [
      r.emr_number,
      r.patient_name,
      r.patient_category,
      r.insurance_type,
      r.test_name,
      r.result_value || '',
      r.result_flag || '',
      r.requested_by,
      formatDate(r.requested_at),
    ]);
    return [
      { name: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
      {
        name: 'All Tests',
        headers: [
          'EMR No.',
          'Patient',
          'Patient Category',
          'Insurance Type',
          'Test',
          'Category',
          'Status',
          'Priority',
          'Result',
          'Flag',
          'Requested By',
          'Requested At',
          'Collected At',
          'Completed At',
          'TAT (hrs)',
        ],
        rows: detailRows,
      },
      {
        name: 'Patient Categories',
        headers: ['Patient Category', 'Count', '%'],
        rows: report.summary.by_patient_category.map((row) => [
          row.label,
          row.count,
          `${row.percentage ?? 0}%`,
        ]),
      },
      {
        name: 'Insurance Types',
        headers: ['Insurance Type', 'Count', '%'],
        rows: report.summary.by_insurance_type.map((row) => [
          row.label,
          row.count,
          `${row.percentage ?? 0}%`,
        ]),
      },
      {
        name: 'Flagged Alerts',
        headers: [
          'EMR No.',
          'Patient',
          'Patient Category',
          'Insurance Type',
          'Test',
          'Result',
          'Flag',
          'Requested By',
          'Date',
        ],
        rows: critRows,
      },
    ];
  }

  function buildPDFOpts(): PDFReportOptions {
    const s = report?.summary;
    return {
      title: 'Laboratory Month-End Report',
      subtitle: `Period: ${s?.period || ''}`,
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      orientation: 'landscape',
      sections: [
        {
          title: 'Summary Metrics',
          summaryRows: [
            { label: 'Total Tests', value: s?.total_tests ?? 0 },
            { label: 'Completed', value: s?.completed ?? 0 },
            { label: 'Pending', value: s?.pending ?? 0 },
            { label: 'Abnormal Results', value: s?.abnormal ?? 0 },
            { label: 'Critical Results', value: s?.critical ?? 0 },
          ],
        },
        {
          title: 'Top Requested Tests',
          tableHeaders: ['Test Name', 'Count', '%'],
          tableRows: (s?.top_tests || []).map((t) => [
            t.label,
            t.count,
            `${t.percentage}%`,
          ]),
        },
        {
          title: 'Patient Category Breakdown',
          tableHeaders: ['Patient Category', 'Count', '%'],
          tableRows: (s?.by_patient_category || []).map((row) => [
            row.label,
            row.count,
            `${row.percentage ?? 0}%`,
          ]),
        },
        {
          title: 'Insurance Type Breakdown',
          tableHeaders: ['Insurance Type', 'Count', '%'],
          tableRows: (s?.by_insurance_type || []).map((row) => [
            row.label,
            row.count,
            `${row.percentage ?? 0}%`,
          ]),
        },
        {
          title: 'Full Test Records',
          tableHeaders: [
            'EMR No.',
            'Patient',
            'Patient Category',
            'Insurance Type',
            'Test',
            'Category',
            'Status',
            'Flag',
            'Requested By',
            'Date',
          ],
          tableRows: (report?.records || []).map((r) => [
            r.emr_number,
            r.patient_name,
            r.patient_category,
            r.insurance_type,
            r.test_name,
            r.category,
            r.status,
            r.result_flag || '—',
            r.requested_by,
            formatDate(r.requested_at),
          ]),
        },
        {
          title: 'Critical / Abnormal Alerts',
          tableHeaders: [
            'EMR No.',
            'Patient',
            'Patient Category',
            'Insurance Type',
            'Test',
            'Result',
            'Flag',
            'Requested By',
            'Date',
          ],
          tableRows: (report?.records || [])
            .filter(
              (r) => r.result_flag === 'Critical' || r.result_flag === 'Abnormal',
            )
            .map((r) => [
              r.emr_number,
              r.patient_name,
              r.patient_category,
              r.insurance_type,
              r.test_name,
              r.result_value || '—',
              r.result_flag || '—',
              r.requested_by,
              formatDate(r.requested_at),
            ]),
        },
      ],
    };
  }

  async function handleExport(format: ExportFormat) {
    if (!report) return;
    const fname = `XenoCare_Lab_Report_${new Date().toISOString().split('T')[0]}`;
    try {
      dispatchExport(format, buildSheets(), buildPDFOpts(), fname);
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
        module: 'lab',
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
      title="Lab Month-End Report"
      size="max"
      allowMaximize
    >
      <div className="space-y-4">
        {/* Filters */}
        <FilterPanel
          module="lab"
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
            icon={FlaskConical}
            onClick={applyFilters}
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

        {/* Loading / error */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 size={24} className="animate-spin mr-2" /> Generating
            report…
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">
            Failed to generate report: {(error as Error).message}
          </div>
        )}

        {report && !isLoading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard
                label="Total Tests"
                value={report.summary.total_tests}
                color="blue"
              />
              <SummaryCard
                label="Completed"
                value={report.summary.completed}
                color="green"
              />
              <SummaryCard
                label="Pending"
                value={report.summary.pending}
                color="yellow"
              />
              <SummaryCard
                label="Abnormal"
                value={report.summary.abnormal}
                color="yellow"
              />
              <SummaryCard
                label="Critical"
                value={report.summary.critical}
                color="red"
              />
              <SummaryCard
                label="Period"
                value={report.summary.period}
                color="gray"
              />
            </div>

            {/* Top tests + breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <TrendingUp size={14} /> Top Requested Tests
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Test</th>
                      <th className="pb-1.5 text-right">Count</th>
                      <th className="pb-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.top_tests.slice(0, 8).map((t) => (
                      <tr key={t.label} className="border-b border-gray-50">
                        <td className="py-1">{t.label}</td>
                        <td className="py-1 text-right font-medium">
                          {t.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {t.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  By Category
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Category</th>
                      <th className="pb-1.5 text-right">Count</th>
                      <th className="pb-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.by_category.slice(0, 8).map((t) => (
                      <tr key={t.label} className="border-b border-gray-50">
                        <td className="py-1">{t.label}</td>
                        <td className="py-1 text-right font-medium">
                          {t.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {t.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  By Patient Category
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Category</th>
                      <th className="pb-1.5 text-right">Count</th>
                      <th className="pb-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.by_patient_category.slice(0, 8).map((t) => (
                      <tr key={t.label} className="border-b border-gray-50">
                        <td className="py-1">{t.label}</td>
                        <td className="py-1 text-right font-medium">
                          {t.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {t.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  By Insurance Type
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Insurance</th>
                      <th className="pb-1.5 text-right">Count</th>
                      <th className="pb-1.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.by_insurance_type.slice(0, 8).map((t) => (
                      <tr key={t.label} className="border-b border-gray-50">
                        <td className="py-1">{t.label}</td>
                        <td className="py-1 text-right font-medium">
                          {t.count}
                        </td>
                        <td className="py-1 text-right text-gray-500">
                          {t.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Critical alerts */}
            {report.critical_cases.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Critical Alerts (
                  {report.critical_cases.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead className="bg-red-100">
                      <tr className="text-left text-red-700">
                        <th className="px-2 py-1.5 rounded-l">EMR</th>
                        <th className="px-2 py-1.5">Patient</th>
                        <th className="px-2 py-1.5">Test</th>
                        <th className="px-2 py-1.5">Result</th>
                        <th className="px-2 py-1.5">Requested By</th>
                        <th className="px-2 py-1.5 rounded-r">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.critical_cases.map((r) => (
                        <tr key={r.id} className="border-b border-red-100">
                          <td className="px-2 py-1.5 font-mono text-xs">
                            {r.emr_number}
                          </td>
                          <td className="px-2 py-1.5">{r.patient_name}</td>
                          <td className="px-2 py-1.5">{r.test_name}</td>
                          <td className="px-2 py-1.5 text-red-800 font-semibold">
                            {r.result_value || '—'}
                          </td>
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

            {/* Detailed records */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h4 className="text-sm font-semibold text-gray-700">
                  Detailed Records ({report.records.length})
                </h4>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr className="text-left text-gray-600">
                      {[
                        'EMR',
                        'Patient',
                        'Test',
                        'Category',
                        'Status',
                        'Flag',
                        'Result',
                        'Requested By',
                        'Date',
                        'TAT (hrs)',
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
                        <td className="px-3 py-1.5">{r.test_name}</td>
                        <td className="px-3 py-1.5 text-gray-500">
                          {r.category}
                        </td>
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
                        <td className="px-3 py-1.5">
                          {r.result_flag && (
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                r.result_flag === 'Critical'
                                  ? 'bg-red-100 text-red-700'
                                  : r.result_flag === 'Abnormal'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {r.result_flag}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">{r.result_value || '—'}</td>
                        <td className="px-3 py-1.5">{r.requested_by}</td>
                        <td className="px-3 py-1.5">
                          {formatDate(r.requested_at)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {r.turnaround_hours ?? '—'}
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
