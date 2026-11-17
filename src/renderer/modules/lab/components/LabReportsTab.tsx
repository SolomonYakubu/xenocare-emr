import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  Calendar,
  TestTube,
  CheckCircle,
  Clock,
  Filter,
  FileText,
  Activity,
  User,
  Stethoscope,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '../../../components/ui/FormElements';
import { StatusBadge, EmptyState } from '../../../components/ui/DataDisplay';
import { SkeletonTable } from '../../../components/ui/SkeletonLoader';
import {
  LabRequestDTO,
  LabRequestStatus,
  getLabStatusColor,
} from '../dtos/lab.dto';
import { formatPatientName } from '../../patient-registration/dtos/patient.dto';
import { Patient } from '../../../types/database.types';

interface LabReportsTabProps {
  requests: LabRequestDTO[];
  isLoading: boolean;
  onViewReport: (request: LabRequestDTO) => void;
}

// Grouped patient records type
interface PatientLabGroup {
  patient: Patient;
  patientId: string;
  emrNumber: string;
  requests: LabRequestDTO[];
  totalRequests: number;
  completedCount: number;
  pendingCount: number;
  latestDate: string;
}

function getRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 30) return `${diffInDays} days ago`;
  return '';
}

export default function LabReportsTab({
  requests,
  isLoading,
  onViewReport,
}: LabReportsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'completed' | 'in_progress'
  >('all');
  const [selectedPatientGroup, setSelectedPatientGroup] =
    useState<PatientLabGroup | null>(null);

  // Filter to only show requests with results (completed or in progress)
  const reportableRequests = useMemo(() => {
    return requests.filter(
      (req) =>
        req.status === 'Completed' ||
        req.status === 'In Progress' ||
        req.status === 'Result_Ready' ||
        req.lab_result ||
        req.result,
    );
  }, [requests]);

  // Group requests by patient patient number
  const patientGroups = useMemo(() => {
    const groups = new Map<string, PatientLabGroup>();

    reportableRequests.forEach((req) => {
      if (!req.patient) return;

      // Use patient id for grouping, but display emr_number
      const patientId = req.patient.id || req.patient.patient_id;
      const emrNumber = req.patient.emr_number || 'Pending';

      if (!groups.has(patientId)) {
        groups.set(patientId, {
          patient: req.patient,
          patientId,
          emrNumber,
          requests: [],
          totalRequests: 0,
          completedCount: 0,
          pendingCount: 0,
          latestDate: req.created_at,
        });
      }

      const group = groups.get(patientId)!;
      group.requests.push(req);
      group.totalRequests++;

      if (req.status === 'Completed' || req.status === 'Result_Ready') {
        group.completedCount++;
      } else {
        group.pendingCount++;
      }

      // Track latest date
      if (new Date(req.created_at) > new Date(group.latestDate)) {
        group.latestDate = req.created_at;
      }
    });

    return Array.from(groups.values());
  }, [reportableRequests]);

  // Filter groups based on search and status
  const filteredGroups = useMemo(() => {
    let filtered = [...patientGroups];

    // Status filter
    if (statusFilter === 'completed') {
      filtered = filtered.filter((g) => g.completedCount > 0);
    } else if (statusFilter === 'in_progress') {
      filtered = filtered.filter((g) => g.pendingCount > 0);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((g) => {
        const patientName = formatPatientName(g.patient).toLowerCase();
        const emrNumber = g.emrNumber.toLowerCase();
        const phone = g.patient.contact_phone?.toLowerCase() || '';

        return (
          patientName.includes(query) ||
          emrNumber.includes(query) ||
          phone.includes(query)
        );
      });
    }

    // Sort by latest date
    filtered.sort(
      (a, b) =>
        new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime(),
    );

    return filtered;
  }, [patientGroups, searchQuery, statusFilter]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusVariant = (
    status: LabRequestStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'Result_Ready':
        return 'success';
      case 'In Progress':
        return 'info';
      case 'Sample Collected':
        return 'info';
      case 'Pending':
        return 'warning';
      case 'Cancelled':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Search and Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-info-600" />
              Lab Reports by Patient
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {filteredGroups.length} patients with lab reports
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by EMR, name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-info-500 focus:border-info-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'all' | 'completed' | 'in_progress',
                  )
                }
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-info-500 focus:border-info-500 appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={TestTube}
          title="No Lab Reports Found"
          description={
            searchQuery
              ? 'Try adjusting your search criteria'
              : 'No lab reports available yet'
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Tests
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status Summary
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Latest Date
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredGroups.map((group) => (
                  <tr
                    key={group.patientId}
                    className="hover:bg-gray-50 transition-colors group"
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-info-500 to-primary-600 flex items-center justify-center text-white text-xs font-medium shadow-sm">
                          {group.patient.first_name?.charAt(0)}
                          {group.patient.surname?.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 text-sm group-hover:text-info-700 transition-colors">
                              {formatPatientName(group.patient)}
                            </p>
                            <span className="inline-block font-mono text-[10px] font-bold text-success-700 bg-success-50 border border-success-200 px-1.5 py-0.5 rounded">
                              {group.patient.emr_number || 'Pending'}
                            </span>
                          </div>
                          {group.patient.contact_phone && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {group.patient.contact_phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <TestTube className="h-3.5 w-3.5 text-info-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {group.totalRequests}
                        </span>
                        <span className="text-xs text-gray-500">test(s)</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {group.completedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-success-50 text-success-700 border border-success-200">
                            <CheckCircle className="h-3 w-3" />
                            {group.completedCount} done
                          </span>
                        )}
                        {group.pendingCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-warning-50 text-warning-700 border border-warning-200">
                            <Clock className="h-3 w-3" />
                            {group.pendingCount} pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {formatDate(group.latestDate)}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedPatientGroup(group)}
                        className="inline-flex items-center gap-1 h-8 text-xs px-3"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View All
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Patient Lab Records Detail Modal */}
      {selectedPatientGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-info-600 to-primary-600 px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedPatientGroup(null)}
                    className="p-1 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition-colors mr-1"
                    title="Back"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-base font-semibold shadow-sm">
                    {selectedPatientGroup.patient.first_name?.charAt(0)}
                    {selectedPatientGroup.patient.surname?.charAt(0)}
                  </div>
                  <div className="text-white">
                    <h3 className="text-base font-semibold">
                      {formatPatientName(selectedPatientGroup.patient)}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] font-bold text-white bg-white/20 px-1.5 py-0.5 rounded">
                        {selectedPatientGroup.patient.emr_number || 'Pending'}
                      </span>
                      <span className="text-xs text-info-100">
                        • {selectedPatientGroup.totalRequests} Lab Test(s)
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPatientGroup(null)}
                  className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Lab Records List */}
            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-5">
              <div className="space-y-3">
                {selectedPatientGroup.requests
                  .sort((a, b) => {
                    // Sort by verification/result time if available, otherwise creation time - DESCENDING
                    const timeA = new Date(
                      a.lab_result?.approved_at ||
                        a.lab_result?.reported_at ||
                        a.created_at ||
                        0,
                    ).getTime();
                    const timeB = new Date(
                      b.lab_result?.approved_at ||
                        b.lab_result?.reported_at ||
                        b.created_at ||
                        0,
                    ).getTime();
                    return timeB - timeA;
                  })
                  .map((request) => (
                    <div
                      key={request.request_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedPatientGroup(null);
                        onViewReport(request);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedPatientGroup(null);
                          onViewReport(request);
                        }
                      }}
                      className="cursor-pointer border border-gray-200 rounded-lg p-3 hover:border-info-300 hover:shadow-sm transition-all bg-white"
                    >
                      {/* Patient & Encounter Header */}
                      <div className="bg-gray-50 -mx-3 -mt-3 px-3 py-2 mb-3 rounded-t-lg border-b border-gray-200">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                                EMR:
                              </span>
                              <span className="font-mono text-[11px] font-bold text-success-700 bg-success-50 border border-success-200 px-1.5 py-0.5 rounded">
                                {selectedPatientGroup.patient.emr_number ||
                                  'Pending'}
                              </span>
                            </div>
                            <span className="text-gray-300">|</span>
                            <span className="font-medium text-gray-900 text-xs">
                              {formatPatientName(selectedPatientGroup.patient)}
                            </span>
                          </div>
                          {request.encounter?.encounter_number && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                                Encounter:
                              </span>
                              <span className="font-mono text-[11px] font-medium text-info-700 bg-info-50 border border-info-200 px-1.5 py-0.5 rounded">
                                {request.encounter.encounter_number}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {/* Test Info */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <TestTube className="h-4 w-4 text-info-600" />
                            <h4 className="font-semibold text-gray-900 text-sm">
                              {request.test?.test_name || 'Unknown Test'}
                            </h4>
                            <StatusBadge
                              status={request.status}
                              variant={getStatusVariant(
                                request.status as LabRequestStatus,
                              )}
                            />
                          </div>

                          {/* Test Category & Date */}
                          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2.5">
                            {request.test?.category && (
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                {request.test.category}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {/* Use result_date/verified_at if available for saving time context */}
                              {formatDate(
                                request.lab_result?.approved_at ||
                                  request.lab_result?.reported_at ||
                                  request.created_at,
                              )}
                              {/* Relative Time Badge */}
                              {getRelativeTime(
                                request.lab_result?.approved_at ||
                                  request.lab_result?.reported_at ||
                                  request.created_at,
                              ) && (
                                <span className="text-[10px] font-bold text-info-700 bg-info-50 px-1.5 py-0.5 rounded border border-info-100 uppercase tracking-wide ml-1">
                                  {getRelativeTime(
                                    request.lab_result?.approved_at ||
                                      request.lab_result?.reported_at ||
                                      request.created_at,
                                  )}
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {/* Use result_date/verified_at if available for saving time context */}
                              {new Date(
                                request.lab_result?.approved_at ||
                                  request.lab_result?.reported_at ||
                                  request.created_at ||
                                  '',
                              ).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Requesting Doctor */}
                          {request.doctor && (
                            <div className="bg-info-50/50 rounded-md p-2 mb-2 border border-info-100/50">
                              <div className="flex items-center gap-1.5 text-xs">
                                <Stethoscope className="h-3.5 w-3.5 text-info-600" />
                                <span className="font-medium text-info-900">
                                  Requested by:
                                </span>
                                <span className="text-info-700">
                                  Dr. {request.doctor.first_name}{' '}
                                  {request.doctor.last_name}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Diagnosis */}
                          {request.diagnosis &&
                            request.diagnosis.length > 0 && (
                              <div className="bg-warning-50/50 rounded-md p-2 mb-2 border border-warning-100/50">
                                <div className="flex items-start gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-warning-600 mt-0.5" />
                                  <div>
                                    <span className="font-medium text-warning-900 text-xs">
                                      Diagnosis/Indication:
                                    </span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {request.diagnosis.map((dx, i) => (
                                        <span
                                          key={i}
                                          className="inline-block px-1.5 py-0.5 bg-warning-100 text-warning-800 text-[10px] rounded border border-warning-200"
                                        >
                                          {dx}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                          {/* Clinical Notes */}
                          {request.clinical_notes && (
                            <div className="bg-gray-50 rounded-md p-2 border border-gray-100">
                              <div className="flex items-start gap-1.5">
                                <User className="h-3.5 w-3.5 text-gray-500 mt-0.5" />
                                <div>
                                  <span className="font-medium text-gray-700 text-xs">
                                    Clinical Notes:
                                  </span>
                                  <p className="text-xs text-gray-600 mt-0.5">
                                    {request.clinical_notes}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Results Preview */}
                          {(request.lab_result || request.result) && (
                            <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                              <div className="flex items-center gap-1.5 text-xs">
                                <CheckCircle className="h-3.5 w-3.5 text-success-500" />
                                <span className="font-medium text-success-700">
                                  Result Available
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* View Detail Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedPatientGroup(null);
                            onViewReport(request);
                          }}
                          className="inline-flex h-8 items-center gap-1 border-info-200 px-3 text-xs text-info-700 hover:bg-info-50"
                        >
                          View Report
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
