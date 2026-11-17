import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  Calendar,
  Image,
  CheckCircle,
  Clock,
  Filter,
  FileImage,
  Activity,
  User,
  Stethoscope,
  X,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../../../components/ui/FormElements';
import { StatusBadge } from '../../../components/ui/DataDisplay';
import {
  RadiologyRequestDTO,
  RadiologyRequestStatus,
  getRadiologyStatusColor,
} from '../dtos/radiology.dto';
import { formatPatientName } from '../../patient-registration/dtos/patient.dto';
import { SkeletonTable } from '../../../components/ui/SkeletonLoader';
import { Patient } from '../../../types/database.types';

interface ImagingReportsTabProps {
  requests: RadiologyRequestDTO[];
  isLoading: boolean;
  onViewReport: (request: RadiologyRequestDTO) => void;
}

// Grouped patient records type
interface PatientImagingGroup {
  patient: Patient;
  patientId: string;
  emrNumber: string;
  requests: RadiologyRequestDTO[];
  totalRequests: number;
  completedCount: number;
  pendingCount: number;
  latestDate: string;
}

export default function ImagingReportsTab({
  requests,
  isLoading,
  onViewReport,
}: ImagingReportsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'reported' | 'completed'
  >('all');
  const [selectedPatientGroup, setSelectedPatientGroup] =
    useState<PatientImagingGroup | null>(null);

  // Filter to only show requests with results
  const reportableRequests = useMemo(() => {
    return requests.filter(
      (req) =>
        req.status === 'Final Report' ||
        req.status === 'Reported' ||
        req.status === 'Preliminary Report' ||
        req.status === 'Awaiting Report' ||
        req.status === 'Imaging Completed' ||
        req.status === 'Completed' ||
        req.status === 'In Progress' ||
        req.scan_result ||
        req.findings ||
        req.impression,
    );
  }, [requests]);

  // Group requests by patient patient number
  const patientGroups = useMemo(() => {
    const groups = new Map<string, PatientImagingGroup>();

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

      if (req.status === 'Final Report' || req.status === 'Reported') {
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
    if (statusFilter === 'reported') {
      filtered = filtered.filter((g) =>
        g.requests.some(
          (r) => r.status === 'Final Report' || r.status === 'Reported',
        ),
      );
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter((g) =>
        g.requests.some(
          (r) =>
            r.status === 'Final Report' ||
            r.status === 'Reported' ||
            r.status === 'Preliminary Report',
        ),
      );
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
    status: RadiologyRequestStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
    switch (status) {
      case 'Final Report':
        return 'success';
      case 'Reported':
        return 'success';
      case 'Preliminary Report':
        return 'info';
      case 'Awaiting Report':
        return 'info';
      case 'Imaging Completed':
        return 'info';
      case 'In Progress':
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
    return <SkeletonTable rows={5} columns={3} />;
  }

  return (
    <div className="space-y-4">
      {/* Header with Search and Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileImage className="h-5 w-5 text-purple-600" />
              Imaging Reports by Patient
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {filteredGroups.length} patients with imaging reports
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'all' | 'reported' | 'completed',
                  )
                }
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="reported">Reported</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Image className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Imaging Reports Found
          </h3>
          <p className="text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search criteria'
              : 'No imaging reports available yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Studies
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status Summary
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Latest Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredGroups.map((group) => (
                  <tr
                    key={group.patientId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                          {group.patient.first_name?.charAt(0)}
                          {group.patient.surname?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {formatPatientName(group.patient)}
                          </p>
                          <span className="inline-block font-mono text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded mt-1">
                            {group.patient.emr_number || 'Pending'}
                          </span>
                          {group.patient.contact_phone && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {group.patient.contact_phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-semibold text-gray-900">
                          {group.totalRequests}
                        </span>
                        <span className="text-xs text-gray-500">study(s)</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {group.completedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3" />
                            {group.completedCount} done
                          </span>
                        )}
                        {group.pendingCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock className="h-3 w-3" />
                            {group.pendingCount} pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(group.latestDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedPatientGroup(group)}
                        className="inline-flex items-center gap-1"
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

      {/* Patient Imaging Records Detail Modal */}
      {selectedPatientGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-semibold">
                    {selectedPatientGroup.patient.first_name?.charAt(0)}
                    {selectedPatientGroup.patient.surname?.charAt(0)}
                  </div>
                  <div className="text-white">
                    <h3 className="text-lg font-semibold">
                      {formatPatientName(selectedPatientGroup.patient)}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded">
                        {selectedPatientGroup.patient.emr_number || 'Pending'}
                      </span>
                      <span className="text-sm text-purple-100">
                        • {selectedPatientGroup.totalRequests} Imaging Study(s)
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPatientGroup(null)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Body - Imaging Records List */}
            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
              <div className="space-y-4">
                {selectedPatientGroup.requests.map((request) => (
                  <div
                    key={request.request_id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-sm transition-all"
                  >
                    {/* Patient & Encounter Header */}
                    <div className="bg-gray-50 -mx-4 -mt-4 px-4 py-3 mb-4 rounded-t-lg border-b border-gray-200">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">EMR:</span>
                            <span className="font-mono text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                              {selectedPatientGroup.patient.emr_number ||
                                'Pending'}
                            </span>
                          </div>
                          <span className="text-gray-300">|</span>
                          <span className="font-medium text-gray-900 text-sm">
                            {formatPatientName(selectedPatientGroup.patient)}
                          </span>
                        </div>
                        {request.encounter?.encounter_number && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">
                              Encounter:
                            </span>
                            <span className="font-mono text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                              {request.encounter.encounter_number}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Imaging Info */}
                        <div className="flex items-center gap-2 mb-2">
                          <Image className="h-5 w-5 text-purple-600" />
                          <h4 className="font-semibold text-gray-900">
                            {request.imaging?.imaging_name || 'Unknown Study'}
                          </h4>
                          <StatusBadge
                            status={request.status}
                            variant={getStatusVariant(
                              request.status as RadiologyRequestStatus,
                            )}
                          />
                        </div>

                        {/* Modality & Date */}
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          {request.imaging?.imaging_type && (
                            <span className="flex items-center gap-1">
                              <Activity className="h-3.5 w-3.5" />
                              {request.imaging.imaging_type}
                            </span>
                          )}
                          {request.body_part && (
                            <span className="text-gray-400">
                              • {request.body_part}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(request.created_at)}
                          </span>
                        </div>

                        {/* Requesting Doctor */}
                        {request.doctor && (
                          <div className="bg-purple-50 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Stethoscope className="h-4 w-4 text-purple-600" />
                              <span className="font-medium text-purple-900">
                                Requested by:
                              </span>
                              <span className="text-purple-700">
                                Dr. {request.doctor.first_name}{' '}
                                {request.doctor.last_name}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Diagnosis */}
                        {request.diagnosis && request.diagnosis.length > 0 && (
                          <div className="bg-amber-50 rounded-lg p-3 mb-3">
                            <div className="flex items-start gap-2">
                              <FileImage className="h-4 w-4 text-amber-600 mt-0.5" />
                              <div>
                                <span className="font-medium text-amber-900 text-sm">
                                  Diagnosis/Indication:
                                </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {request.diagnosis.map((dx, i) => (
                                    <span
                                      key={i}
                                      className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded"
                                    >
                                      {dx}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Clinical Indication */}
                        {(request.clinical_indication ||
                          request.clinical_notes) && (
                          <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <div className="flex items-start gap-2">
                              <User className="h-4 w-4 text-gray-500 mt-0.5" />
                              <div>
                                <span className="font-medium text-gray-700 text-sm">
                                  Clinical Indication:
                                </span>
                                <p className="text-sm text-gray-600 mt-1">
                                  {request.clinical_indication ||
                                    request.clinical_notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Report Preview */}
                        {(request.scan_result ||
                          request.findings ||
                          request.impression) && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2 text-sm mb-3">
                              <CheckCircle className="h-4 w-4 text-green-500" />
                              <span className="font-medium text-green-700">
                                Report Details
                              </span>
                              {request.scan_result?.is_preliminary && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                                  Preliminary
                                </span>
                              )}
                              {request.scan_result?.urgency &&
                                request.scan_result.urgency !== 'Normal' && (
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                      request.scan_result.urgency === 'Critical'
                                        ? 'bg-red-100 text-red-800'
                                        : request.scan_result.urgency ===
                                            'Urgent'
                                          ? 'bg-orange-100 text-orange-800'
                                          : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {request.scan_result.urgency}
                                  </span>
                                )}
                            </div>

                            {/* Technique */}
                            {request.scan_result?.technique && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                  Technique
                                </p>
                                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-gray-700 text-sm">
                                    {request.scan_result.technique}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Comparison */}
                            {request.scan_result?.comparison && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                  Comparison
                                </p>
                                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-gray-700 text-sm">
                                    {request.scan_result.comparison}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Findings */}
                            {(request.findings ||
                              request.scan_result?.findings) && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                  Findings
                                </p>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                  <p className="text-gray-800 text-sm whitespace-pre-wrap">
                                    {request.scan_result?.findings ||
                                      request.findings}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Impression */}
                            {(request.impression ||
                              request.scan_result?.impression) && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                  Impression
                                </p>
                                <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                                  <p className="text-gray-800 text-sm whitespace-pre-wrap font-medium">
                                    {request.scan_result?.impression ||
                                      request.impression}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Additional Notes / Recommendations */}
                            {request.scan_result?.notes && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                  Additional Notes / Recommendations
                                </p>
                                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                  <p className="text-gray-800 text-sm whitespace-pre-wrap">
                                    {request.scan_result.notes}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Images with Full Details */}
                            {request.scan_images &&
                              request.scan_images.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                                    Scan Images ({request.scan_images.length})
                                  </p>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {request.scan_images.map((img, idx) => (
                                      <div
                                        key={img.image_id || idx}
                                        className={`relative rounded-lg overflow-hidden border ${
                                          img.is_key_image
                                            ? 'border-yellow-400 ring-2 ring-yellow-200'
                                            : 'border-gray-200'
                                        } bg-gray-50`}
                                      >
                                        {/* Image Preview */}
                                        <div className="aspect-square bg-gray-100 relative">
                                          <img
                                            src={
                                              img.image_url || img.image_path
                                            }
                                            alt={
                                              img.description ||
                                              `Scan ${idx + 1}`
                                            }
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              const target =
                                                e.target as HTMLImageElement;
                                              target.style.display = 'none';
                                              target.parentElement!.innerHTML =
                                                '<div class="w-full h-full flex items-center justify-center text-gray-400"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                                            }}
                                          />
                                          {/* Key Image Badge */}
                                          {img.is_key_image && (
                                            <div className="absolute top-1 right-1 bg-yellow-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                              KEY
                                            </div>
                                          )}
                                          {/* Sequence Number */}
                                          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                                            #{img.sequence_number || idx + 1}
                                          </div>
                                        </div>
                                        {/* Image Details */}
                                        <div className="p-2 text-xs">
                                          {img.view_plane && (
                                            <p className="font-medium text-purple-700 truncate">
                                              {img.view_plane}
                                            </p>
                                          )}
                                          {img.file_name && (
                                            <p
                                              className="text-gray-500 truncate"
                                              title={img.file_name}
                                            >
                                              {img.file_name}
                                            </p>
                                          )}
                                          {img.notes && (
                                            <p className="text-gray-600 mt-1 line-clamp-2 italic">
                                              {img.notes}
                                            </p>
                                          )}
                                          {img.file_size && (
                                            <p className="text-gray-400 text-xs mt-1">
                                              {(img.file_size / 1024).toFixed(
                                                1,
                                              )}{' '}
                                              KB
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {/* Reported By */}
                            {request.scan_result?.reporter && (
                              <div className="text-xs text-gray-500 mt-2">
                                Reported by:{' '}
                                {request.scan_result.reporter.first_name}{' '}
                                {request.scan_result.reporter.last_name}
                                {request.scan_result.reported_at && (
                                  <span>
                                    {' '}
                                    on{' '}
                                    {formatDate(
                                      request.scan_result.reported_at,
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* View Detail Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedPatientGroup(null);
                          onViewReport(request);
                        }}
                        className="text-purple-600 hover:text-purple-700"
                        title="View full details"
                      >
                        <Eye className="h-5 w-5" />
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
