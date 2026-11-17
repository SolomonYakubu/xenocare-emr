/**
 * =============================================================================
 * XENOCARE EMR - ENCOUNTER TABLE COMPONENT
 * Description: Modern, professional data table for displaying encounters
 * =============================================================================
 */

import React from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Stethoscope,
  MoreVertical,
  XCircle,
} from 'lucide-react';
import {
  Encounter,
  getEncounterStatusColor,
  getPriorityColor,
  getVisitTypeColor,
  formatEncounterPatientName,
  formatEncounterDateTime,
  calculateWaitTime,
  isEncounterOverdue,
  EncounterStatus,
  VisitType,
  PriorityLevel,
} from '../dtos/encounter.dto';
import { useUpdateEncounterStatus } from '../hooks/useEncounter';
import { ConfirmDialog } from '../../../components/ui/Modal';
import {
  cancelEncounter,
  checkEncounterPaymentStatus,
} from '../../../lib/workflow/api';
import { useToast } from '../../../components/ui/Toast';
import { SkeletonTable } from '../../../components/ui/SkeletonLoader';
import {
  useEncounterSettings,
  getExpiryHoursForEncounter,
} from '../hooks/useEncounterSettings';

interface EncounterTableProps {
  encounters: Encounter[];
  isLoading?: boolean;
  onRowClick?: (encounter: Encounter) => void;
  showActions?: boolean;
}

const EncounterTable: React.FC<EncounterTableProps> = ({
  encounters,
  isLoading,
  onRowClick,
  showActions = true,
}) => {
  const updateStatus = useUpdateEncounterStatus();
  const { showToast } = useToast();
  const { data: expirySettings } = useEncounterSettings();
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false);
  const [encounterToCancel, setEncounterToCancel] =
    React.useState<Encounter | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = React.useState(false);

  const handleStatusChange = async (
    visitId: string,
    status: EncounterStatus,
  ) => {
    try {
      await updateStatus.mutateAsync({ visitId, status });
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleCancelClick = async (encounter: Encounter) => {
    setOpenMenuId(null);
    setIsCheckingPayment(true);
    setCancelError(null);

    try {
      // Check if encounter has paid orders before showing dialog
      const paymentStatus = await checkEncounterPaymentStatus(
        encounter.visit_id,
      );

      if (paymentStatus.hasPaidOrders) {
        showToast({
          type: 'error',
          title: 'Cannot Cancel',
          message: `${paymentStatus.paidOrdersCount} payment(s) totaling ₦${paymentStatus.totalPaidAmount.toLocaleString()} have been verified. Process a refund first.`,
        });
        return;
      }

      setEncounterToCancel(encounter);
      setCancelConfirmOpen(true);
    } catch (error) {
      console.error('Error checking payment status:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to check payment status',
      });
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!encounterToCancel) return;

    setIsCancelling(true);
    setCancelError(null);

    try {
      await cancelEncounter(
        encounterToCancel.visit_id,
        'Cancelled by user from encounter list',
      );
      showToast({
        type: 'success',
        title: 'Cancelled',
        message: 'Encounter cancelled successfully',
      });
      setCancelConfirmOpen(false);
      setEncounterToCancel(null);
      // Trigger a refetch of encounters
      await updateStatus.mutateAsync({
        visitId: encounterToCancel.visit_id,
        status: 'Cancelled',
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to cancel encounter';
      setCancelError(errorMessage);
      showToast({
        type: 'error',
        title: 'Cancel Failed',
        message: errorMessage,
      });
    } finally {
      setIsCancelling(false);
    }
  };

  /**
   * Determine if patient is Inpatient or Outpatient based on visit type and admission status
   */
  const getPatientClassification = (
    encounter: Encounter,
  ): 'Inpatient' | 'Outpatient' => {
    // Check visit type for inpatient indicators
    const inpatientTypes = ['In-Patient', 'Inpatient', 'Admission', 'Ward'];
    if (
      inpatientTypes.some((type) =>
        encounter.visit_type?.toLowerCase().includes(type.toLowerCase()),
      )
    ) {
      return 'Inpatient';
    }
    // Check if encounter has admission-related fields
    if (encounter.discharge_date || (encounter as any).admission_id) {
      return 'Inpatient';
    }
    return 'Outpatient';
  };

  /**
   * Calculate encounter age and check if expired based on admin-configurable settings.
   * Falls back to 504 hours (3 weeks) if settings not loaded.
   */
  const getEncounterAgeStatus = (
    encounter: Encounter,
  ): { ageHours: number; isExpired: boolean } => {
    const ageHours =
      (Date.now() - new Date(encounter.created_at).getTime()) /
      (1000 * 60 * 60);
    const classification = getPatientClassification(encounter);

    // Inpatients expire on discharge, not by time
    if (classification === 'Inpatient') {
      return { ageHours, isExpired: false };
    }

    // Get configurable expiry hours based on OPD classification and encounter category
    const expiryHours = expirySettings
      ? getExpiryHoursForEncounter(
          expirySettings,
          (encounter as any).opd_classification,
          (encounter as any).encounter_category,
        )
      : 504; // Default: 3 weeks

    const isExpired =
      ageHours > expiryHours &&
      (encounter.status === 'Active' || encounter.status === 'Waiting');

    return { ageHours, isExpired };
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <SkeletonTable rows={6} columns={6} />
      </div>
    );
  }

  if (encounters.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm mb-3">
          <Stethoscope className="h-5 w-5 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">
          No encounters found
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Create a new encounter to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {encounters.map((encounter) => {
        const priorityColor = getPriorityColor(
          (encounter.priority as PriorityLevel) || 'Normal',
        );
        const isOverdue = isEncounterOverdue(
          encounter,
          expirySettings?.overdueWarningMinutes,
        );
        const patientClassification = getPatientClassification(encounter);
        const { ageHours, isExpired } = getEncounterAgeStatus(encounter);
        const statusColor = getEncounterStatusColor(encounter.status);
        const priority = encounter.priority || 'Normal';

        return (
          <div
            key={encounter.id || encounter.visit_id}
            onClick={() => onRowClick?.(encounter)}
            className={`group cursor-pointer rounded-xl border bg-white px-3.5 py-3 transition-colors ${
              isOverdue
                ? 'border-red-200 hover:bg-red-50/40'
                : isExpired
                  ? 'border-amber-200 hover:bg-amber-50/40'
                  : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {formatEncounterPatientName(encounter)}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {encounter.patient?.emr_number || 'No patient number'}
                  {' · '}
                  {encounter.encounter_number ||
                    encounter.visit_id?.slice(0, 8) ||
                    '—'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor.bg} ${statusColor.text}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      encounter.status === 'Active'
                        ? 'bg-green-500'
                        : encounter.status === 'Waiting'
                          ? 'bg-amber-500'
                          : encounter.status === 'In Progress'
                            ? 'bg-blue-500'
                            : encounter.status === 'Completed'
                              ? 'bg-gray-400'
                              : 'bg-red-400'
                    }`}
                  />
                  {isExpired
                    ? 'Expired'
                    : encounter.status === 'Active'
                      ? 'Active'
                      : encounter.status}
                </span>
                {showActions && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(
                          openMenuId === encounter.visit_id
                            ? null
                            : encounter.visit_id,
                        );
                      }}
                      aria-label="Visit actions"
                      className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {openMenuId === encounter.visit_id && (
                      <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-slate-200 bg-white py-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowClick?.(encounter);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          Open visit
                        </button>
                        {(encounter.status === 'Active' ||
                          encounter.status === 'Waiting') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelClick(encounter);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancel visit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className="truncate">
                {encounter.clinic?.clinic_name || 'Unassigned clinic'}
              </span>
              <span className="text-slate-300">·</span>
              <span className="truncate">
                {encounter.attending_doctor
                  ? `${encounter.attending_doctor.first_name} ${encounter.attending_doctor.last_name}`
                  : 'No doctor'}
              </span>
              <span className="text-slate-300">·</span>
              <span>
                {new Date(
                  encounter.encounter_date || encounter.created_at,
                ).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                })}
                {', '}
                {new Date(encounter.created_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-500">
                {patientClassification === 'Inpatient'
                  ? 'Inpatient'
                  : 'Outpatient'}
              </span>
              {priority !== 'Normal' && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${priorityColor.bg} ${priorityColor.text}`}
                >
                  {(priority === 'Emergency' || priority === 'Urgent') && (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {priority}
                </span>
              )}
              {encounter.visit_type && (
                <span className="text-slate-400">
                  {encounter.visit_type.split(' ')[0]}
                </span>
              )}
              {isOverdue && (
                <span className="font-medium text-red-600">Overdue</span>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between px-1 pt-1 text-[11px] text-slate-400">
        <span>
          {encounters.length} visit{encounters.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={() => onRowClick?.(encounters[0])}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Cancel Encounter Confirmation Dialog */}
      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => {
          setCancelConfirmOpen(false);
          setEncounterToCancel(null);
          setCancelError(null);
        }}
        onConfirm={handleConfirmCancel}
        title="Cancel Encounter"
        message={
          <div className="space-y-3">
            <p>
              Are you sure you want to cancel this encounter for{' '}
              <strong>
                {encounterToCancel
                  ? formatEncounterPatientName(encounterToCancel)
                  : ''}
              </strong>
              ?
            </p>

            {/* Patient Classification Badge */}
            {encounterToCancel && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Patient Type:</span>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded ${
                    getPatientClassification(encounterToCancel) === 'Inpatient'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-sky-100 text-sky-700 border border-sky-200'
                  }`}
                >
                  {getPatientClassification(encounterToCancel) === 'Inpatient'
                    ? 'INPATIENT (IPD)'
                    : 'OUTPATIENT (OPD)'}
                </span>
              </div>
            )}

            {cancelError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800">❌ Error:</p>
                <p className="text-sm text-red-700">{cancelError}</p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">
                ⚠️ Important Implications:
              </p>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                <li>
                  All pending billing orders will be removed from the payment
                  queue
                </li>
                <li>Any unpaid charges will be voided</li>
                <li>Lab, radiology, and pharmacy orders may be affected</li>
                <li>
                  Clinical notes and records will be preserved but marked as
                  cancelled
                </li>
                <li>
                  <strong>
                    Encounters with verified payments cannot be cancelled
                  </strong>
                </li>
                <li>This action cannot be undone</li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-800 mb-1">
                📋 Encounter Expiry Rules:
              </p>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>
                  <strong>GOPD Outpatient:</strong> Expires after{' '}
                  {expirySettings
                    ? `${Math.round(expirySettings.gopdOutpatientHours / 24)} days`
                    : '3 weeks'}
                </li>
                <li>
                  <strong>Specialty Outpatient:</strong> Expires after{' '}
                  {expirySettings
                    ? `${Math.round(expirySettings.specialtyOutpatientHours / 24)} days`
                    : '3 weeks'}
                </li>
                <li>
                  <strong>Inpatient (IPD):</strong> Expires upon patient
                  discharge
                </li>
                <li>
                  Expiry durations are configurable in the Settings tab
                </li>
              </ul>
            </div>
          </div>
        }
        confirmText="Yes, Cancel Encounter"
        cancelText="Keep Encounter"
        variant="danger"
        isLoading={isCancelling}
      />
    </div>
  );
};

export default EncounterTable;
