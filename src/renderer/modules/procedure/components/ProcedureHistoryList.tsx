// =============================================================================
// XENOCARE EMR - Procedure History List Component
// Comprehensive list of all procedures with patient information
// =============================================================================

import React, { useState } from 'react';
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Stethoscope,
  Users,
  Download,
} from 'lucide-react';
import {
  useProcedureHistory,
  useProcedureCountByPatient,
} from '../hooks/useProcedures';
import PatientProcedureRecords from './PatientProcedureRecords';
import type {
  ProcedureHistoryFilters,
  ProcedureHistoryItem,
} from '../api/procedures.api';
import {
  SkeletonTable,
  SkeletonEncounterDetail,
} from '../../../components/ui/SkeletonLoader';

interface ProcedureHistoryListProps {
  onSelectProcedure: (procedureId: string) => void;
}

const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  scheduled: {
    color: 'bg-blue-100 text-blue-700',
    icon: <Calendar className="h-3 w-3" />,
    label: 'Scheduled',
  },
  pre_op: {
    color: 'bg-purple-100 text-purple-700',
    icon: <Clock className="h-3 w-3" />,
    label: 'Pre-Op',
  },
  in_progress: {
    color: 'bg-amber-100 text-amber-700',
    icon: <Activity className="h-3 w-3" />,
    label: 'In Progress',
  },
  completed: {
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: 'Completed',
  },
  cancelled: {
    color: 'bg-gray-100 text-gray-600',
    icon: <XCircle className="h-3 w-3" />,
    label: 'Cancelled',
  },
  postponed: {
    color: 'bg-orange-100 text-orange-700',
    icon: <Clock className="h-3 w-3" />,
    label: 'Postponed',
  },
  complications: {
    color: 'bg-red-100 text-red-700',
    icon: <AlertCircle className="h-3 w-3" />,
    label: 'Complications',
  },
};

const priorityColors: Record<string, string> = {
  emergency: 'bg-red-100 text-red-700 border-red-200',
  urgent: 'bg-amber-100 text-amber-700 border-amber-200',
  routine: 'bg-gray-100 text-gray-600 border-gray-200',
  elective: 'bg-blue-100 text-blue-700 border-blue-200',
};

const ProcedureHistoryList: React.FC<ProcedureHistoryListProps> = ({
  onSelectProcedure,
}) => {
  const [filters, setFilters] = useState<ProcedureHistoryFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'procedures' | 'patients'>(
    'procedures',
  );
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    emrNumber: string;
  } | null>(null);

  const { data: historyData, isLoading } = useProcedureHistory(
    filters,
    page,
    pageSize,
  );
  const {
    data: patientStats,
    isLoading: loadingPatients,
    error: patientError,
  } = useProcedureCountByPatient();

  // Debug logging for patient stats
  console.log(
    '[ProcedureHistoryList] patientStats:',
    patientStats,
    'loading:',
    loadingPatients,
    'error:',
    patientError,
  );

  const procedures: ProcedureHistoryItem[] =
    (historyData as { data: ProcedureHistoryItem[]; total: number } | undefined)
      ?.data || [];
  const total =
    (historyData as { data: ProcedureHistoryItem[]; total: number } | undefined)
      ?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleFilterChange = (
    key: keyof ProcedureHistoryFilters,
    value: string,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    if (days < 0) {
      months--;
      const prev = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prev.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years === 0 && months === 0) {
      const weeks = Math.floor(days / 7);
      const rem = days % 7;
      if (weeks > 0 && rem > 0) return `${weeks}w ${rem}d`;
      if (weeks > 0) return `${weeks}w`;
      return `${days}d`;
    }
    if (years === 0) {
      const parts = [`${months}m`];
      if (days > 0) parts.push(`${days}d`);
      return parts.join(' ');
    }
    const parts = [`${years}y`];
    if (months > 0) parts.push(`${months}m`);
    if (days > 0) parts.push(`${days}d`);
    return parts.join(' ');
  };

  return (
    <div className="space-y-4">
      {/* View Toggle and Search Bar */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          {/* View Toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('procedures')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'procedures'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              All Procedures
            </button>
            <button
              onClick={() => setViewMode('patients')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'patients'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="h-4 w-4" />
              By Patient
            </button>
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
            {/* Search */}
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={filters.searchTerm || ''}
                onChange={(e) =>
                  handleFilterChange('searchTerm', e.target.value)
                }
                placeholder="Search by procedure # or name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                showFilters || Object.keys(filters).length > 1
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {Object.keys(filters).filter(
                (k) =>
                  k !== 'searchTerm' &&
                  filters[k as keyof ProcedureHistoryFilters],
              ).length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {
                    Object.keys(filters).filter(
                      (k) =>
                        k !== 'searchTerm' &&
                        filters[k as keyof ProcedureHistoryFilters],
                    ).length
                  }
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="cancelled">Cancelled</option>
                <option value="postponed">Postponed</option>
                <option value="complications">Complications</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {viewMode === 'procedures' ? (
        <>
          {/* Procedures Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {isLoading ? (
              <SkeletonTable rows={5} columns={4} />
            ) : procedures.length === 0 ? (
              <div className="text-center py-16">
                <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No procedures found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Procedure
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Surgeon
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {procedures.map((procedure) => {
                    const status =
                      statusConfig[procedure.status] || statusConfig.scheduled;
                    return (
                      <tr
                        key={procedure.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {procedure.procedure_number}
                            </p>
                            <p
                              className="text-sm text-gray-500 truncate max-w-[200px]"
                              title={procedure.procedure_name}
                            >
                              {procedure.procedure_name}
                            </p>
                            {procedure.catalogue_category && (
                              <span className="inline-flex mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                {procedure.catalogue_category}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {procedure.patient_name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>{procedure.patient_emr_number}</span>
                                {procedure.patient_gender && (
                                  <>
                                    <span>•</span>
                                    <span>{procedure.patient_gender}</span>
                                  </>
                                )}
                                {procedure.patient_dob && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      {calculateAge(procedure.patient_dob)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-gray-900">
                              {formatDate(
                                procedure.scheduled_date ||
                                  procedure.actual_start_time,
                              )}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatTime(
                                procedure.scheduled_date ||
                                  procedure.actual_start_time,
                              )}
                              {procedure.actual_duration_minutes && (
                                <span className="text-gray-400">
                                  {' '}
                                  • {procedure.actual_duration_minutes} min
                                </span>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {procedure.surgeon_name ? (
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-900">
                                {procedure.surgeon_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Not assigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
                          >
                            {status.icon}
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${priorityColors[procedure.priority] || priorityColors.routine}`}
                          >
                            {procedure.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onSelectProcedure(procedure.id)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl border shadow-sm px-4 py-3">
              <p className="text-sm text-gray-600">
                Showing {(page - 1) * pageSize + 1} to{' '}
                {Math.min(page * pageSize, total)} of {total} procedures
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Patients with Procedures View */
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {loadingPatients ? (
            <SkeletonEncounterDetail />
          ) : patientError ? (
            <div className="text-center py-16">
              <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
              <p className="text-red-500 font-medium">
                Error loading patient data
              </p>
              <p className="text-sm text-red-400 mt-1">
                {(patientError as Error)?.message || 'Unknown error'}
              </p>
            </div>
          ) : !patientStats || patientStats.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">
                No patients with procedures found
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Create a procedure request to see patients here
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Patient number
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Procedures
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Cancelled
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patientStats.map((patient) => (
                  <tr
                    key={patient.patient_id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                          {patient.patient_name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">
                          {patient.patient_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 font-mono text-sm">
                        {patient.emr_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold">
                        {patient.total}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold">
                        {patient.completed}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-semibold">
                        {patient.cancelled}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedPatient({
                            id: patient.patient_id,
                            name: patient.patient_name,
                            emrNumber: patient.emr_number,
                          });
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View All →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Patient Procedure Records Modal */}
      {selectedPatient && (
        <PatientProcedureRecords
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          emrNumber={selectedPatient.emrNumber}
          onClose={() => setSelectedPatient(null)}
          onViewProcedure={(procedureId) => {
            setSelectedPatient(null);
            onSelectProcedure(procedureId);
          }}
        />
      )}
    </div>
  );
};

export default ProcedureHistoryList;
