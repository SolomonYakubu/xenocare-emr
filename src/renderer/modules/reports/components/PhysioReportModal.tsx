/**
 * XenoCare — Physiotherapy Report Modal
 */

import React, { useState } from 'react';
import { Activity, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/FormElements';
import { FilterPanel } from './FilterPanel';
import { ExportToolbar } from './ExportToolbar';
import { usePhysioReport } from '../hooks/useReports';
import { dispatchExport, formatDate } from '../services/export.service';
import { logExportAudit } from '../services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { getDefaultDateRange } from '../types/report.types';
import type {
  PhysioExportFilters,
  ExportFormat,
  ExcelSheet,
} from '../types/report.types';
import type { PDFReportOptions } from '../services/export.service';
import { useAuth } from '../../../contexts/AuthContext';
import { useFacilityId } from '../../../hooks/useFacilityId';

const DEFAULT_FILTERS: PhysioExportFilters = {
  dateRange: getDefaultDateRange(),
};
const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Discontinued', label: 'Discontinued' },
  { value: 'On Hold', label: 'On Hold' },
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

export function PhysioReportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const { staff } = useAuth();
  const { facilityId } = useFacilityId();
  const [filters, setFilters] = useState<PhysioExportFilters>(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] =
    useState<PhysioExportFilters>(DEFAULT_FILTERS);
  const {
    data: report,
    isLoading,
    error,
  } = usePhysioReport(activeFilters, facilityId);

  function buildSheets(): ExcelSheet[] {
    if (!report) return [];
    const summaryRows = [
      ['Period', report.summary.period],
      ['Total Sessions', report.summary.total_sessions],
      ['Unique Patients', report.summary.unique_patients],
      ['Active Plans', report.summary.active_plans],
      ['Completed Plans', report.summary.completed_plans],
      ['Missed Sessions', report.summary.missed_sessions],
      ['Improving', report.summary.improving],
      ['No Change', report.summary.no_change],
      ['Worsening', report.summary.worsening],
    ];
    const detailRows = report.records.map((r) => [
      r.emr_number,
      r.patient_name,
      r.condition,
      r.therapist,
      r.plan_status,
      r.total_prescribed_sessions,
      r.completed_sessions,
      r.missed_sessions,
      `${r.compliance_rate}%`,
      r.progress_status || '',
      formatDate(r.start_date),
      formatDate(r.last_session_date),
      formatDate(r.discharge_date),
      r.discharge_outcome || '',
    ]);
    const nonCompliantRows = report.non_compliant.map((r) => [
      r.emr_number,
      r.patient_name,
      r.condition,
      r.therapist,
      r.total_prescribed_sessions,
      r.completed_sessions,
      r.missed_sessions,
      `${r.compliance_rate}%`,
    ]);
    return [
      { name: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
      {
        name: 'Treatment Plans',
        headers: [
          'EMR',
          'Patient',
          'Condition',
          'Therapist',
          'Status',
          'Prescribed',
          'Completed',
          'Missed',
          'Compliance',
          'Progress',
          'Start Date',
          'Last Session',
          'Discharge Date',
          'Discharge Outcome',
        ],
        rows: detailRows,
      },
      {
        name: 'Non-Compliant (<70%)',
        headers: [
          'EMR',
          'Patient',
          'Condition',
          'Therapist',
          'Prescribed',
          'Completed',
          'Missed',
          'Compliance',
        ],
        rows: nonCompliantRows,
      },
    ];
  }

  function buildPDFOpts(): PDFReportOptions {
    const s = report?.summary;
    return {
      title: 'Physiotherapy Month-End Report',
      subtitle: `Period: ${s?.period || ''}`,
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      orientation: 'landscape',
      sections: [
        {
          title: 'Summary',
          summaryRows: [
            { label: 'Total Sessions', value: s?.total_sessions ?? 0 },
            { label: 'Unique Patients', value: s?.unique_patients ?? 0 },
            { label: 'Active Plans', value: s?.active_plans ?? 0 },
            { label: 'Completed Plans', value: s?.completed_plans ?? 0 },
            { label: 'Missed Sessions', value: s?.missed_sessions ?? 0 },
            { label: 'Improving', value: s?.improving ?? 0 },
            { label: 'No Change', value: s?.no_change ?? 0 },
            { label: 'Worsening', value: s?.worsening ?? 0 },
          ],
        },
        {
          title: 'Most Treated Conditions',
          tableHeaders: ['Condition', 'Count', '%'],
          tableRows: (s?.top_conditions || []).map((c) => [
            c.label,
            c.count,
            `${c.percentage}%`,
          ]),
        },
        {
          title: 'Treatment Plan Records',
          tableHeaders: [
            'EMR',
            'Patient',
            'Condition',
            'Therapist',
            'Status',
            'Compliance',
            'Progress',
          ],
          tableRows: (report?.records || [])
            .slice(0, 500)
            .map((r) => [
              r.emr_number,
              r.patient_name,
              r.condition,
              r.therapist,
              r.plan_status,
              `${r.compliance_rate}%`,
              r.progress_status || '—',
            ]),
        },
        {
          title: 'Non-Compliant Patients (< 70%)',
          tableHeaders: [
            'EMR',
            'Patient',
            'Condition',
            'Therapist',
            'Prescribed',
            'Completed',
            'Compliance',
          ],
          tableRows: (report?.non_compliant || []).map((r) => [
            r.emr_number,
            r.patient_name,
            r.condition,
            r.therapist,
            r.total_prescribed_sessions,
            r.completed_sessions,
            `${r.compliance_rate}%`,
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
        `XenoCare_Physiotherapy_Report_${new Date().toISOString().split('T')[0]}`,
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
        module: 'physiotherapy',
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
      title="Physiotherapy Month-End Report"
      size="max"
      allowMaximize
    >
      <div className="space-y-4">
        <FilterPanel
          module="physio"
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
            icon={Activity}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <SummaryCard
                label="Total Sessions"
                value={report.summary.total_sessions}
                color="blue"
              />
              <SummaryCard
                label="Unique Patients"
                value={report.summary.unique_patients}
                color="green"
              />
              <SummaryCard
                label="Active Plans"
                value={report.summary.active_plans}
                color="blue"
              />
              <SummaryCard
                label="Completed Plans"
                value={report.summary.completed_plans}
                color="green"
              />
              <SummaryCard
                label="Missed Sessions"
                value={report.summary.missed_sessions}
                color="yellow"
              />
              <SummaryCard
                label="Improving"
                value={report.summary.improving}
                color="green"
              />
              <SummaryCard
                label="No Change"
                value={report.summary.no_change}
                color="gray"
              />
              <SummaryCard
                label="Worsening"
                value={report.summary.worsening}
                color="red"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Most Treated Conditions
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-1.5">Condition</th>
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
                  Plan Status Breakdown
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
                    {report.summary.by_plan_status.map((s) => (
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

            {report.non_compliant.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Non-Compliant Patients — &lt;70%
                  attendance ({report.non_compliant.length})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead className="bg-orange-100">
                      <tr className="text-left text-orange-700">
                        {[
                          'EMR',
                          'Patient',
                          'Condition',
                          'Therapist',
                          'Prescribed',
                          'Completed',
                          'Missed',
                          'Compliance',
                        ].map((h) => (
                          <th key={h} className="px-2 py-1.5">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.non_compliant.map((r) => (
                        <tr
                          key={r.patient_id}
                          className="border-b border-orange-100"
                        >
                          <td className="px-2 py-1.5 font-mono">
                            {r.emr_number}
                          </td>
                          <td className="px-2 py-1.5">{r.patient_name}</td>
                          <td className="px-2 py-1.5">{r.condition}</td>
                          <td className="px-2 py-1.5">{r.therapist}</td>
                          <td className="px-2 py-1.5 text-right">
                            {r.total_prescribed_sessions}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {r.completed_sessions}
                          </td>
                          <td className="px-2 py-1.5 text-right text-red-700">
                            {r.missed_sessions}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right font-semibold ${r.compliance_rate < 50 ? 'text-red-700' : 'text-orange-700'}`}
                          >
                            {r.compliance_rate}%
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
                  All Treatment Plans ({report.records.length})
                </h4>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr className="text-left text-gray-600">
                      {[
                        'EMR',
                        'Patient',
                        'Condition',
                        'Therapist',
                        'Status',
                        'Prescribed',
                        'Completed',
                        'Missed',
                        'Compliance',
                        'Progress',
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
                        key={r.patient_id}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {r.emr_number}
                        </td>
                        <td className="px-3 py-1.5">{r.patient_name}</td>
                        <td className="px-3 py-1.5">{r.condition}</td>
                        <td className="px-3 py-1.5">{r.therapist}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                              r.plan_status === 'Active'
                                ? 'bg-blue-100 text-blue-700'
                                : r.plan_status === 'Completed'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {r.plan_status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {r.total_prescribed_sessions}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {r.completed_sessions}
                        </td>
                        <td className="px-3 py-1.5 text-right text-yellow-700">
                          {r.missed_sessions}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-medium ${r.compliance_rate < 70 ? 'text-orange-600' : 'text-green-600'}`}
                        >
                          {r.compliance_rate}%
                        </td>
                        <td className="px-3 py-1.5">
                          {r.progress_status && (
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                r.progress_status === 'improving'
                                  ? 'bg-green-100 text-green-700'
                                  : r.progress_status === 'worsening'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {r.progress_status}
                            </span>
                          )}
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
