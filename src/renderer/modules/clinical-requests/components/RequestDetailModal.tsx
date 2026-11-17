/**
 * Request Detail Modal Component
 * ==============================
 * Detailed view of a clinical request with action buttons
 */

import React, { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  X,
  User,
  Calendar,
  Clock,
  Building2,
  Bed,
  Stethoscope,
  AlertTriangle,
  CheckCircle,
  XCircle,
  PlayCircle,
  FileText,
  Phone,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDetailedAge } from '../../patient-registration/dtos/patient.dto';
import {
  ClinicalRequestWithDetailsDTO,
  ClinicalRequestStatusHistoryDTO,
  REQUEST_STATUS_CONFIG,
  URGENCY_CONFIG,
  REQUEST_TYPE_LABELS,
  LEVEL_OF_CARE_LABELS,
  canApprove,
  canSchedule,
  canComplete,
  canCancel,
  LevelOfCare,
} from '../dtos/clinical-request.dto';
import { useRequestStatusHistory } from '../hooks/useClinicalRequests';

interface RequestDetailModalProps {
  request: ClinicalRequestWithDetailsDTO;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (request: ClinicalRequestWithDetailsDTO, notes?: string) => void;
  onReject?: (request: ClinicalRequestWithDetailsDTO, reason: string) => void;
  onSchedule?: (
    request: ClinicalRequestWithDetailsDTO,
    date: string,
    time?: string,
    notes?: string,
  ) => void;
  onStart?: (request: ClinicalRequestWithDetailsDTO) => void;
  onComplete?: (request: ClinicalRequestWithDetailsDTO, notes?: string) => void;
  onCancel?: (request: ClinicalRequestWithDetailsDTO, reason?: string) => void;
  onExecuteAdmission?: () => void;
  onScheduleProcedure?: () => void;
  onExecuteDischarge?: () => void;
  currentUserId?: string;
  canPerformActions?: boolean;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  request,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onSchedule,
  onStart,
  onComplete,
  onCancel,
  onExecuteAdmission,
  onScheduleProcedure,
  onExecuteDischarge,
  currentUserId,
  canPerformActions = true,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [actionMode, setActionMode] = useState<
    'approve' | 'reject' | 'schedule' | 'cancel' | null
  >(null);
  const [actionNotes, setActionNotes] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const { data: statusHistory, isLoading: historyLoading } =
    useRequestStatusHistory(request.id, { enabled: showHistory });

  if (!isOpen) return null;

  const statusConfig = REQUEST_STATUS_CONFIG[request.status];
  const urgencyConfig = URGENCY_CONFIG[request.urgency];

  const handleAction = () => {
    switch (actionMode) {
      case 'approve':
        onApprove?.(request, actionNotes);
        break;
      case 'reject':
        onReject?.(request, actionNotes);
        break;
      case 'schedule':
        onSchedule?.(request, scheduleDate, scheduleTime, actionNotes);
        break;
      case 'cancel':
        onCancel?.(request, actionNotes);
        break;
    }
    setActionMode(null);
    setActionNotes('');
    setScheduleDate('');
    setScheduleTime('');
  };

  const resetAction = () => {
    setActionMode(null);
    setActionNotes('');
    setScheduleDate('');
    setScheduleTime('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${urgencyConfig.bgColor} ${urgencyConfig.color}`}
              >
                {request.urgency}
              </span>
              <h2 className="text-lg font-semibold text-gray-900">
                {REQUEST_TYPE_LABELS[request.request_type]} Request
              </h2>
              <span className="text-sm text-gray-500">
                {request.request_number}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-6">
            {/* Patient Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Patient Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Name</label>
                  <p className="font-medium">{request.patient_name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Patient number</label>
                  <p className="font-medium">{request.emr_number}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Gender / Age</label>
                  <p className="font-medium">
                    {request.patient_gender} /{' '}
                    {formatDetailedAge(request.patient_dob)}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Contact</label>
                  <p className="font-medium flex items-center gap-1">
                    <Phone className="w-3 h-3" />{' '}
                    {request.patient_phone || 'N/A'}
                  </p>
                </div>
                {request.patient_category && (
                  <div>
                    <label className="text-xs text-gray-500">Category</label>
                    <p className="font-medium">{request.patient_category}</p>
                  </div>
                )}
                {request.insurance_type && (
                  <div>
                    <label className="text-xs text-gray-500">Insurance</label>
                    <p className="font-medium">{request.insurance_type}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Request Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Request Details
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <label className="text-xs text-blue-700 font-medium">
                    Clinical Reason
                  </label>
                  <p className="text-gray-800 mt-1">
                    {request.clinical_reason}
                  </p>
                </div>

                {request.notes && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="text-xs text-gray-500">
                      Additional Notes
                    </label>
                    <p className="text-gray-700 mt-1">{request.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">
                      Requesting Doctor
                    </label>
                    <p className="font-medium">
                      Dr. {request.requesting_doctor_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Department</label>
                    <p className="font-medium">
                      {request.requesting_department_name || 'N/A'}
                    </p>
                  </div>
                  {request.suggested_timeframe && (
                    <div>
                      <label className="text-xs text-gray-500">
                        Suggested Timeframe
                      </label>
                      <p className="font-medium">
                        {request.suggested_timeframe}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Admission-specific details */}
            {request.request_type === 'Admission' && (
              <div className="bg-amber-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Bed className="w-4 h-4" /> Admission Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">
                      Admission Type
                    </label>
                    <p className="font-medium">
                      {request.admission_type || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      Level of Care
                    </label>
                    <p className="font-medium">
                      {request.level_of_care
                        ? LEVEL_OF_CARE_LABELS[
                            request.level_of_care as LevelOfCare
                          ]
                        : 'Not specified'}
                    </p>
                  </div>
                  {request.target_ward_name && (
                    <div>
                      <label className="text-xs text-gray-500">
                        Suggested Ward
                      </label>
                      <p className="font-medium">
                        {request.target_ward_name}
                        {request.available_beds !== undefined && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({request.available_beds} beds available)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {request.expected_duration && (
                    <div>
                      <label className="text-xs text-gray-500">
                        Expected Duration
                      </label>
                      <p className="font-medium">{request.expected_duration}</p>
                    </div>
                  )}
                  {request.special_requirements && (
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">
                        Special Requirements
                      </label>
                      <p className="font-medium">
                        {request.special_requirements}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Procedure-specific details */}
            {(request.request_type === 'Procedure' ||
              request.request_type === 'Surgery') && (
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" /> Procedure Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Procedure</label>
                    <p className="font-medium">
                      {request.procedure_name}
                      {request.procedure_code && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({request.procedure_code})
                        </span>
                      )}
                    </p>
                  </div>
                  {request.procedure_notes && (
                    <div>
                      <label className="text-xs text-gray-500">
                        Procedure Notes
                      </label>
                      <p className="text-gray-700">{request.procedure_notes}</p>
                    </div>
                  )}
                  {request.pre_op_requirements && (
                    <div>
                      <label className="text-xs text-gray-500">
                        Pre-op Requirements
                      </label>
                      <p className="text-gray-700">
                        {request.pre_op_requirements}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scheduling Info */}
            {request.scheduled_date && (
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Schedule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Date</label>
                    <p className="font-medium">
                      {format(
                        new Date(request.scheduled_date),
                        'EEEE, MMMM d, yyyy',
                      )}
                    </p>
                  </div>
                  {request.scheduled_time && (
                    <div>
                      <label className="text-xs text-gray-500">Time</label>
                      <p className="font-medium">{request.scheduled_time}</p>
                    </div>
                  )}
                  {request.scheduling_notes && (
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">
                        Scheduling Notes
                      </label>
                      <p className="text-gray-700">
                        {request.scheduling_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rejection Info */}
            {request.status === 'Rejected' && request.rejection_reason && (
              <div className="bg-red-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Rejection Reason
                </h3>
                <p className="text-gray-700">{request.rejection_reason}</p>
              </div>
            )}

            {/* Timeline */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>
                  Created {formatDistanceToNow(new Date(request.created_at))}{' '}
                  ago
                </span>
                {request.reviewed_at && (
                  <>
                    <span>•</span>
                    <span>
                      Reviewed{' '}
                      {formatDistanceToNow(new Date(request.reviewed_at))} ago
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Status History */}
            <div className="border-t pt-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              >
                <History className="w-4 h-4" />
                <span>Status History</span>
                {showHistory ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showHistory && (
                <div className="mt-3 space-y-2">
                  {historyLoading ? (
                    <p className="text-sm text-gray-500">Loading history...</p>
                  ) : statusHistory && statusHistory.length > 0 ? (
                    statusHistory.map(
                      (entry: ClinicalRequestStatusHistoryDTO) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 text-sm"
                        >
                          <div className="w-2 h-2 mt-1.5 rounded-full bg-gray-400" />
                          <div>
                            <p>
                              <span className="font-medium">
                                {entry.from_status || 'Created'} →{' '}
                                {entry.to_status}
                              </span>
                              {entry.changed_by_name && (
                                <span className="text-gray-500">
                                  {' '}
                                  by {entry.changed_by_name}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(
                                new Date(entry.changed_at),
                                'MMM d, yyyy h:mm a',
                              )}
                            </p>
                            {entry.change_reason && (
                              <p className="text-gray-600 mt-1">
                                {entry.change_reason}
                              </p>
                            )}
                          </div>
                        </div>
                      ),
                    )
                  ) : (
                    <p className="text-sm text-gray-500">
                      No status history available
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Section */}
          {canPerformActions && (
            <div className="px-6 py-4 bg-gray-50 border-t">
              {/* Action Form */}
              {actionMode && (
                <div className="mb-4 p-4 bg-white rounded-lg border">
                  <h4 className="font-medium mb-3 capitalize">
                    {actionMode} Request
                  </h4>

                  {actionMode === 'schedule' && (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Date *
                        </label>
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="block text-sm text-gray-600 mb-1">
                      {actionMode === 'reject'
                        ? 'Reason *'
                        : 'Notes (optional)'}
                    </label>
                    <textarea
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder={
                        actionMode === 'reject'
                          ? 'Enter rejection reason...'
                          : 'Enter notes...'
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAction}
                      disabled={
                        (actionMode === 'reject' && !actionNotes) ||
                        (actionMode === 'schedule' && !scheduleDate)
                      }
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      Confirm {actionMode}
                    </button>
                    <button
                      onClick={resetAction}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!actionMode && (
                <div className="flex flex-wrap gap-2">
                  {canApprove(request) && onApprove && (
                    <button
                      onClick={() => setActionMode('approve')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve
                    </button>
                  )}

                  {canApprove(request) && onReject && (
                    <button
                      onClick={() => setActionMode('reject')}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  )}

                  {/* Execute Admission - for approved admission requests */}
                  {request.status === 'Approved' &&
                    request.request_type === 'Admission' &&
                    onExecuteAdmission && (
                      <button
                        onClick={onExecuteAdmission}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                      >
                        <Bed className="w-4 h-4" /> Execute Admission
                      </button>
                    )}

                  {/* Schedule Procedure - for approved procedure/surgery requests */}
                  {request.status === 'Approved' &&
                    (request.request_type === 'Procedure' ||
                      request.request_type === 'Surgery') &&
                    onScheduleProcedure && (
                      <button
                        onClick={onScheduleProcedure}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        <Calendar className="w-4 h-4" /> Schedule Procedure
                      </button>
                    )}

                  {/* Execute Discharge - for approved discharge requests */}
                  {request.status === 'Approved' &&
                    request.request_type === 'Discharge' &&
                    onExecuteDischarge && (
                      <button
                        onClick={onExecuteDischarge}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                      >
                        <FileText className="w-4 h-4" /> Execute Discharge
                      </button>
                    )}

                  {canSchedule(request) &&
                    onSchedule &&
                    !onScheduleProcedure && (
                      <button
                        onClick={() => setActionMode('schedule')}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        <Calendar className="w-4 h-4" /> Schedule
                      </button>
                    )}

                  {request.status === 'Scheduled' && onStart && (
                    <button
                      onClick={() => onStart(request)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      <PlayCircle className="w-4 h-4" /> Start
                    </button>
                  )}

                  {canComplete(request) && onComplete && (
                    <button
                      onClick={() => onComplete(request)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <CheckCircle className="w-4 h-4" /> Complete
                    </button>
                  )}

                  {canCancel(request) && onCancel && (
                    <button
                      onClick={() => setActionMode('cancel')}
                      className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      <XCircle className="w-4 h-4" /> Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestDetailModal;
