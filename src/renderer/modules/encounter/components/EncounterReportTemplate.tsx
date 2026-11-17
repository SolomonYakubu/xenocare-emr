/**
 * =============================================================================
 * XENOCARE EMR - ENCOUNTER REPORT TEMPLATE
 * Description: NDC branded document template for encounter reports
 * For: Medical Record Officers - comprehensive encounter summary
 * =============================================================================
 */

import React, { useRef } from 'react';
import {
  getFacilityAddress,
  getFacilityName,
} from '../../../lib/facility';
import {
  X,
  Download,
  Printer,
  Calendar,
  Building2,
  Users,
  Stethoscope,
  Shield,
  Activity,
  PieChart,
  BarChart3,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Encounter } from '../dtos/encounter.dto';
import {
  EncounterStatsSummary,
  calculateEncounterStats,
} from '../utils/encounterExport';
import { AdvancedEncounterFilters } from './EncounterFilterPanel';

// XenoCare Logo for print
interface EncounterReportTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  encounters: Encounter[];
  filters: AdvancedEncounterFilters;
  title?: string;
}

// =============================================================================
// Component
// =============================================================================

export function EncounterReportTemplate({
  isOpen,
  onClose,
  encounters,
  filters,
  title = 'Encounter Summary Report',
}: EncounterReportTemplateProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const stats = calculateEncounterStats(encounters);
  const generatedDate = new Date().toLocaleString();

  // Format active filters for display
  const getActiveFiltersDescription = (): string[] => {
    const descriptions: string[] = [];
    if (filters.dateFrom || filters.dateTo) {
      descriptions.push(
        `Date: ${filters.dateFrom || 'Any'} to ${filters.dateTo || 'Present'}`,
      );
    }
    if (filters.status !== 'all')
      descriptions.push(`Status: ${filters.status}`);
    if (filters.visitType !== 'all')
      descriptions.push(`Visit Type: ${filters.visitType}`);
    if (filters.priority !== 'all')
      descriptions.push(`Priority: ${filters.priority}`);
    if (filters.departmentId !== 'all')
      descriptions.push(`Department: ${filters.departmentId}`);
    if (filters.patientCategory !== 'all')
      descriptions.push(`Patient Category: ${filters.patientCategory}`);
    if (filters.insuranceType !== 'all')
      descriptions.push(`Insurance: ${filters.insuranceType}`);
    if (filters.gender !== 'all')
      descriptions.push(`Gender: ${filters.gender}`);
    return descriptions;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // For now, use browser's print-to-PDF functionality
    window.print();
  };

  // Sort and limit for display
  const sortedByCount = (
    obj: Record<string, number>,
    limit = 10,
  ): Array<[string, number]> => {
    return Object.entries(obj)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);
  };

  // Calculate percentages
  const getPercentage = (value: number, total: number): string => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-auto">
      {/* Controls - Not printed */}
      <div className="fixed top-4 right-4 flex gap-2 z-[60] print:hidden">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-white text-gray-800 rounded-lg shadow-lg hover:bg-gray-100 flex items-center gap-2 font-medium"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <button
          onClick={handleExportPDF}
          className="px-4 py-2 bg-primary-700 text-white rounded-lg shadow-lg hover:bg-primary-800 flex items-center gap-2 font-medium"
        >
          <Download className="h-4 w-4" />
          Export PDF
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-white text-gray-600 rounded-lg shadow-lg hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Report Content - Printable */}
      <div
        ref={reportRef}
        className="bg-white w-full max-w-5xl rounded-lg shadow-2xl print:shadow-none print:rounded-none print:max-w-none"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-700 to-[#008545] text-white p-8 print:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              
              <div>
                <h1 className="text-2xl font-bold print:text-xl">
                  {getFacilityName().toUpperCase()}
                </h1>
                <h2 className="text-lg opacity-90 print:text-base">
                  XenoCare
                </h2>
                <p className="text-sm opacity-80 mt-1">
                  {getFacilityAddress()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-xl font-semibold print:text-lg">{title}</h3>
              <p className="text-sm opacity-80 mt-1">
                Generated: {generatedDate}
              </p>
            </div>
          </div>
        </div>

        {/* Report Body */}
        <div className="p-8 print:p-6 space-y-8 print:space-y-6">
          {/* Report Summary Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary-700" />
              Report Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {stats.total}
                </div>
                <div className="text-sm text-blue-800">Total Encounters</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {stats.byStatus.Completed || 0}
                </div>
                <div className="text-sm text-green-800">Completed</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {stats.byStatus['In Progress'] || 0}
                </div>
                <div className="text-sm text-yellow-800">In Progress</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {stats.averageAge}
                </div>
                <div className="text-sm text-purple-800">Avg. Patient Age</div>
              </div>
            </div>

            {/* Active Filters */}
            {getActiveFiltersDescription().length > 0 && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600 mb-2">
                  Applied Filters:
                </p>
                <div className="flex flex-wrap gap-2">
                  {getActiveFiltersDescription().map((filter, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white text-gray-700 text-xs rounded border"
                    >
                      {filter}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Date Range */}
            {stats.dateRange.earliest && (
              <p className="text-sm text-gray-500 mt-3">
                <Calendar className="h-4 w-4 inline mr-1" />
                Report Period: {stats.dateRange.earliest} to{' '}
                {stats.dateRange.latest}
              </p>
            )}
          </div>

          {/* Encounter Status Breakdown */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary-700" />
              Encounter Status Distribution
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">
                      Count
                    </th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">
                      Percentage
                    </th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-700 print:hidden">
                      Distribution
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedByCount(stats.byStatus).map(([status, count]) => (
                    <tr key={status} className="border-b border-gray-100">
                      <td className="py-2 px-4">{status}</td>
                      <td className="text-right py-2 px-4 font-medium">
                        {count}
                      </td>
                      <td className="text-right py-2 px-4 text-gray-500">
                        {getPercentage(count, stats.total)}
                      </td>
                      <td className="py-2 px-4 print:hidden">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-700 h-2 rounded-full"
                            style={{ width: getPercentage(count, stats.total) }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Department Statistics */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary-700" />
              Department-wise Distribution
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">
                      Department
                    </th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">
                      Encounters
                    </th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedByCount(stats.byDepartment).map(([dept, count]) => (
                    <tr key={dept} className="border-b border-gray-100">
                      <td className="py-2 px-4">{dept}</td>
                      <td className="text-right py-2 px-4 font-medium">
                        {count}
                      </td>
                      <td className="text-right py-2 px-4 text-gray-500">
                        {getPercentage(count, stats.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Doctor Statistics */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary-700" />
              Attending Doctors Summary
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-2 px-4 font-semibold text-gray-700">
                      Doctor
                    </th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">
                      Patients Seen
                    </th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-700">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedByCount(stats.byDoctor).map(([doctor, count]) => (
                    <tr key={doctor} className="border-b border-gray-100">
                      <td className="py-2 px-4">{doctor}</td>
                      <td className="text-right py-2 px-4 font-medium">
                        {count}
                      </td>
                      <td className="text-right py-2 px-4 text-gray-500">
                        {getPercentage(count, stats.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Patient Category Statistics */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary-700" />
              Patient Category Distribution
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
              {/* By Category */}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-3">
                  By Patient Type
                </h4>
                <div className="space-y-2">
                  {sortedByCount(stats.byPatientCategory).map(
                    ([category, count]) => (
                      <div
                        key={category}
                        className="flex items-center justify-between bg-gray-50 rounded px-3 py-2"
                      >
                        <span className="text-sm">{category}</span>
                        <span className="text-sm font-medium text-primary-700">
                          {count}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
              {/* By Insurance */}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-3">
                  By Insurance Type
                </h4>
                <div className="space-y-2">
                  {sortedByCount(stats.byInsuranceType).map(
                    ([insurance, count]) => (
                      <div
                        key={insurance}
                        className="flex items-center justify-between bg-gray-50 rounded px-3 py-2"
                      >
                        <span className="text-sm">
                          {insurance || 'Not Specified'}
                        </span>
                        <span className="text-sm font-medium text-primary-700">
                          {count}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Visit Type Statistics */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary-700" />
              Visit Type Analysis
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
              {sortedByCount(stats.byVisitType, 8).map(([type, count]) => (
                <div
                  key={type}
                  className="bg-gray-50 rounded-lg p-3 text-center"
                >
                  <div className="text-2xl font-bold text-gray-800">
                    {count}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{type}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Demographics */}
          <div className="pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary-700" />
              Demographics Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
              {/* Gender Distribution */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-600 mb-3">
                  Gender Distribution
                </h4>
                {sortedByCount(stats.byGender).map(([gender, count]) => (
                  <div
                    key={gender}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-gray-700">{gender}</span>
                    <span className="text-sm font-medium">
                      {count} ({getPercentage(count, stats.total)})
                    </span>
                  </div>
                ))}
              </div>
              {/* Priority Distribution */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-600 mb-3">
                  Priority Levels
                </h4>
                {sortedByCount(stats.byPriority).map(([priority, count]) => (
                  <div
                    key={priority}
                    className="flex items-center justify-between py-1"
                  >
                    <span
                      className={`text-sm ${priority === 'Emergency' ? 'text-red-600' : priority === 'Urgent' ? 'text-orange-600' : 'text-gray-700'}`}
                    >
                      {priority}
                    </span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
              {/* Quick Stats */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-600 mb-3">
                  Quick Statistics
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Age:</span>
                    <span className="font-medium">
                      {stats.averageAge} years
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Departments:</span>
                    <span className="font-medium">
                      {Object.keys(stats.byDepartment).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Doctors:</span>
                    <span className="font-medium">
                      {Object.keys(stats.byDoctor).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 print:px-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              <p>XenoCare - Electronic Medical Records System</p>
              <p className="text-xs mt-1">
                This is a system-generated report. For official records, please
                verify with the Medical Records Department.
              </p>
            </div>
            <div className="text-right">
              <p>Page 1 of 1</p>
              <p className="text-xs mt-1">
                Report ID: RPT-{Date.now().toString(36).toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .fixed.inset-0 {
            position: relative !important;
            background: white !important;
          }
          .fixed.inset-0 > div:last-child,
          .fixed.inset-0 > div:last-child * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}

export default EncounterReportTemplate;
