/**
 * XenoCare — Dental Report Modal
 */

import React, { useState } from 'react';
import { Smile, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/FormElements';
import { FilterPanel } from './FilterPanel';
import { ExportToolbar } from './ExportToolbar';
import { useDentalReport } from '../hooks/useReports';
import { dispatchExport, formatDate } from '../services/export.service';
import { logExportAudit } from '../services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { getDefaultDateRange } from '../types/report.types';
import type {
  DentalExportFilters,
  ExportFormat,
  ExcelSheet,
} from '../types/report.types';
import type { PDFReportOptions } from '../services/export.service';
import { useAuth } from '../../../contexts/AuthContext';
import { useFacilityId } from '../../../hooks/useFacilityId';

const DEFAULT_FILTERS: DentalExportFilters = {
  dateRange: getDefaultDateRange(),
};
const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
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

export function DentalReportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const { staff } = useAuth();
  const { facilityId } = useFacilityId();
  const [filters, setFilters] = useState<DentalExportFilters>(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] =
    useState<DentalExportFilters>(DEFAULT_FILTERS);
  const {
    data: report,
    isLoading,
    error,
  } = useDentalReport(activeFilters, facilityId);

  function buildSheets(): ExcelSheet[] {
    if (!report) return [];
    const summaryRows = [
      ['Period', report.summary.period],
      ['Total Exams', report.summary.total_exams],
      ['Total Procedures', report.summary.total_procedures],
      ['Unique Patients', report.summary.unique_patients],
      ['Emergency Visits', report.summary.emergency_visits],
      ['Follow-up Needed', report.summary.follow_up_needed],
      ['Incomplete Treatments', report.summary.incomplete_treatments],
    ];
    const detailRows = report.records.map((r) => [
      r.emr_number,
      r.patient_name,
      r.chief_complaint || '',
      r.diagnosis || '',
      r.procedures_performed,
      r.dentist,
      r.visit_type,
      r.status,
      r.follow_up_required ? 'Yes' : 'No',
      r.treatment_complete ? 'Complete' : 'Incomplete',
      formatDate(r.exam_date),
    ]);
    const incompleteRows = report.incomplete_treatments.map((r) => [
      r.emr_number,
      r.patient_name,
      r.procedures_performed,
      r.dentist,
      r.visit_type,
      formatDate(r.exam_date),
    ]);
    return [
      { name: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
      {
        name: 'All Exams',
        headers: [
          'EMR',
          'Patient',
          'Chief Complaint',
          'Diagnosis',
          'Procedures',
          'Dentist',
          'Visit Type',
          'Status',
          'Follow-up',
          'Treatment',
          'Date',
        ],
        rows: detailRows,
      },
      {
        name: 'Incomplete Treatments',
        headers: [
          'EMR',
          'Patient',
          'Procedures',
          'Dentist',
          'Visit Type',
          'Date',
        ],
        rows: incompleteRows,
      },
    ];
  }

  function buildPDFOpts(): PDFReportOptions {
    const s = report?.summary;
    return {
      title: 'Dental Month-End Report',
      subtitle: `Period: ${s?.period || ''}`,
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      orientation: 'landscape',
      sections: [
        {
          title: 'Summary',
          summaryRows: [
            { label: 'Total Exams', value: s?.total_exams ?? 0 },
            { label: 'Unique Patients', value: s?.unique_patients ?? 0 },
            { label: 'Emergency Visits', value: s?.emergency_visits ?? 0 },
            { label: 'Follow-up Needed', value: s?.follow_up_needed ?? 0 },
            {
              label: 'Incomplete Treatments',
              value: s?.incomplete_treatments ?? 0,
            },
          ],
        },
        {
          title: 'Most Common Procedures',
          tableHeaders: ['Procedure', 'Count', '%'],
          tableRows: (s?.top_procedures || []).map((p) => [
            p.label,
            p.count,
            `${p.percentage}%`,
          ]),
        },
        {
          title: 'All Dental Records',
          tableHeaders: [
            'EMR',
            'Patient',
            'Diagnosis',
            'Procedures',
            'Dentist',
            'Type',
            'Status',
            'Date',
          ],
          tableRows: (report?.records || [])
            .slice(0, 500)
            .map((r) => [
              r.emr_number,
              r.patient_name,
              r.diagnosis || '—',
              r.procedures_performed,
              r.dentist,
              r.visit_type,
              r.status,
              formatDate(r.exam_date),
            ]),
        },
        {
          title: 'Incomplete Treatments',
          tableHeaders: ['EMR', 'Patient', 'Procedures', 'Dentist', 'Date'],
          tableRows: (report?.incomplete_treatments || []).map((r) => [
            r.emr_number,
            r.patient_name,
            r.procedures_performed,
            r.dentist,
            formatDate(r.exam_date),
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
        `XenoCare_Dental_Report_${new Date().toISOString().split('T')[0]}`,
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
        module: 'dental',
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
      title="Dental Month-End Report"
      size="max"
      allowMaximize
    >
      <div className="space-y-4">
        <FilterPanel
          module="dental"
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
            icon={Smile}
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
                label="Emergency Visits"
                value={report.summary.emergency_visits}
                color="red"
              />
              <SummaryCard
                label="Follow-up Needed"
                value={report.summary.follow_up_needed}
                color="yellow"
              />
              <SummaryCard
                label="Incomplete Treatments"
                value={report.summary.incomplete_treatments}
                color="red"
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
                  Most Common Procedures
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
                  By Status
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Status</th>
                      <th className="pb-1.5 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.by_status.map((s) => (
                      <tr key={s.label} className="border-b border-gray-50">
                        <td className="py-1">{s.label}</td>
                        <td className="py-1 text-right font-medium">
                          {s.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {report.incomplete_treatments.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Incomplete / Follow-up Treatments
                  ({report.incomplete_treatments.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead className="bg-orange-100">
                      <tr className="text-left text-orange-700">
                        {[
                          'EMR',
                          'Patient',
                          'Diagnosis',
                          'Procedures',
                          'Dentist',
                          'Date',
                        ].map((h) => (
                          <th key={h} className="px-2 py-1.5">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.incomplete_treatments.map((r) => (
                        <tr key={r.id} className="border-b border-orange-100">
                          <td className="px-2 py-1.5 font-mono">
                            {r.emr_number}
                          </td>
                          <td className="px-2 py-1.5">{r.patient_name}</td>
                          <td className="px-2 py-1.5">{r.diagnosis || '—'}</td>
                          <td className="px-2 py-1.5">
                            {r.procedures_performed}
                          </td>
                          <td className="px-2 py-1.5">{r.dentist}</td>
                          <td className="px-2 py-1.5">
                            {formatDate(r.exam_date)}
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
                  All Dental Records ({report.records.length})
                </h4>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr className="text-left text-gray-600">
                      {[
                        'EMR',
                        'Patient',
                        'Complaint',
                        'Diagnosis',
                        'Procedures',
                        'Dentist',
                        'Type',
                        'Status',
                        'Date',
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
                        <td className="px-3 py-1.5 text-gray-500 truncate max-w-[120px]">
                          {r.chief_complaint || '—'}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[120px]">
                          {r.diagnosis || '—'}
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[150px]">
                          {r.procedures_performed}
                        </td>
                        <td className="px-3 py-1.5">{r.dentist}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                              r.visit_type === 'Emergency'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {r.visit_type}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">{r.status}</td>
                        <td className="px-3 py-1.5">
                          {formatDate(r.exam_date)}
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
