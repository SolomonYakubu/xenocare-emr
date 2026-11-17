/**
 * =============================================================================
 * XENOCARE EMR - ENCOUNTER DETAIL COMPONENT
 * Description: Detailed view of a single encounter with NDC branding
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Calendar,
  Clock,
  Stethoscope,
  FileText,
  CreditCard,
  Phone,
  MapPin,
  AlertCircle,
  Play,
  CheckCircle,
  XCircle,
  Printer,
  Edit,
  Shield,
  Building2,
  FileOutput,
  BedDouble,
  Navigation,
  Pencil,
  Check,
  Loader2,
} from 'lucide-react';
import {
  Encounter,
  getEncounterStatusColor,
  getPriorityColor,
  getVisitTypeColor,
  formatEncounterPatientName,
  formatEncounterDoctorName,
  formatEncounterDateTime,
  formatEncounterDate,
  calculateWaitTime,
  getConsultationFee,
  EncounterStatus,
  VisitType,
  PriorityLevel,
} from '../dtos/encounter.dto';
import {
  useUpdateEncounterStatus,
  useUpdateClinic,
} from '../hooks/useEncounter';
import { EncounterClinicalReportWrapper } from './EncounterClinicalReportWrapper';
import { useAuth } from '../../../contexts/AuthContext';
import { ConfirmDialog } from '../../../components/ui/Modal';
import {
  cancelEncounter,
  checkEncounterPaymentStatus,
  getCurrentEncounterLocation,
} from '../../../lib/workflow/api';
import { useToast } from '../../../components/ui/Toast';

interface EncounterDetailProps {
  encounter: Encounter;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

const EncounterDetail: React.FC<EncounterDetailProps> = ({
  encounter,
  isOpen,
  onClose,
  onEdit,
}) => {
  const updateStatus = useUpdateEncounterStatus();
  const updateClinic = useUpdateClinic();
  const { showToast } = useToast();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole(['super_admin']);

  const [showClinicalReport, setShowClinicalReport] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // Price editing state (super_admin only)
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editedFees, setEditedFees] = useState<{
    consultation_fee: number;
    follow_up_fee: number;
    emergency_fee: number;
    nhis_consultation_fee: number;
    nhis_follow_up_fee: number;
    nhis_emergency_fee: number;
  } | null>(null);

  // Current location state
  const [currentLocation, setCurrentLocation] = useState<{
    location: string | null;
    status: string | null;
    department: string | null;
    isInQueue: boolean;
  } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Payment status to determine if cancel button should be shown
  const [hasPaidOrders, setHasPaidOrders] = useState<boolean | null>(null);

  // Fetch current location and payment status on mount and when encounter changes
  useEffect(() => {
    const fetchData = async () => {
      if (!encounter.visit_id) {
        console.log('[EncounterDetail] No visit_id');
        return;
      }

      console.log(
        '[EncounterDetail] Fetching data for visit_id:',
        encounter.visit_id,
      );
      setIsLoadingLocation(true);
      try {
        // Fetch location and payment status separately to handle errors better
        let location = null;
        let paymentStatus = { hasPaidOrders: false };

        try {
          location = await getCurrentEncounterLocation(encounter.visit_id);
          console.log('[EncounterDetail] Location result:', location);
        } catch (locErr) {
          console.error('[EncounterDetail] Error fetching location:', locErr);
        }

        try {
          paymentStatus = await checkEncounterPaymentStatus(encounter.visit_id);
          console.log('[EncounterDetail] Payment status:', paymentStatus);
        } catch (payErr) {
          console.error(
            '[EncounterDetail] Error fetching payment status:',
            payErr,
          );
        }

        setCurrentLocation(location);
        setHasPaidOrders(paymentStatus.hasPaidOrders);
      } catch (error) {
        console.error(
          '[EncounterDetail] Error fetching encounter data:',
          error,
        );
        setCurrentLocation(null);
        setHasPaidOrders(false);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    fetchData();
  }, [encounter.visit_id]);

  const statusColor = getEncounterStatusColor(
    encounter.status as EncounterStatus,
  );
  const priorityColor = getPriorityColor(
    (encounter.priority as PriorityLevel) || 'Normal',
  );
  const visitTypeColor = getVisitTypeColor(encounter.visit_type as VisitType);

  /**
   * Determine if patient is Inpatient or Outpatient based on visit type and admission status
   */
  const getPatientClassification = (): 'Inpatient' | 'Outpatient' => {
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
    if ((encounter as any).discharge_date || (encounter as any).admission_id) {
      return 'Inpatient';
    }
    return 'Outpatient';
  };

  const handleStatusChange = async (status: EncounterStatus) => {
    try {
      await updateStatus.mutateAsync({ visitId: encounter.visit_id, status });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  /**
   * Handle cancel button click - check payment status and show confirmation
   */
  const handleCancelClick = async () => {
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
          message: `Cannot cancel: ${paymentStatus.paidOrdersCount} payment(s) totaling ₦${paymentStatus.totalPaidAmount.toLocaleString()} have been verified. Process a refund first.`,
        });
        return;
      }

      setCancelConfirmOpen(true);
    } catch (error) {
      console.error('Error checking payment status:', error);
      showToast({ type: 'error', message: 'Failed to check payment status' });
    } finally {
      setIsCheckingPayment(false);
    }
  };

  /**
   * Confirm and execute encounter cancellation
   */
  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    setCancelError(null);

    try {
      await cancelEncounter(
        encounter.visit_id,
        'Cancelled by user from encounter details',
      );
      showToast({
        type: 'success',
        message: 'Encounter cancelled successfully',
      });
      setCancelConfirmOpen(false);
      // Update the encounter status in UI
      await updateStatus.mutateAsync({
        visitId: encounter.visit_id,
        status: 'Cancelled',
      });
      onClose(); // Close the detail modal after cancellation
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to cancel encounter';
      setCancelError(errorMessage);
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsCancelling(false);
    }
  };

  /**
   * Handle starting price edit (super_admin only)
   */
  const handleStartEditPrice = () => {
    if (!isSuperAdmin || !encounter.clinic) return;
    const clinic = encounter.clinic as any; // Cast to access nhis fields
    setEditedFees({
      consultation_fee: clinic.consultation_fee || 0,
      follow_up_fee: clinic.follow_up_fee || 0,
      emergency_fee: clinic.emergency_fee || 0,
      nhis_consultation_fee: clinic.nhis_consultation_fee || 0,
      nhis_follow_up_fee: clinic.nhis_follow_up_fee || 0,
      nhis_emergency_fee: clinic.nhis_emergency_fee || 0,
    });
    setIsEditingPrice(true);
  };

  /**
   * Handle saving edited clinic prices
   */
  const handleSavePrice = async () => {
    if (!editedFees || !encounter.clinic?.clinic_id) return;

    try {
      await updateClinic.mutateAsync({
        clinic_id: encounter.clinic.clinic_id,
        consultation_fee: editedFees.consultation_fee,
        follow_up_fee: editedFees.follow_up_fee,
        emergency_fee: editedFees.emergency_fee,
        nhis_consultation_fee: editedFees.nhis_consultation_fee,
        nhis_follow_up_fee: editedFees.nhis_follow_up_fee,
        nhis_emergency_fee: editedFees.nhis_emergency_fee,
      } as any);
      showToast({
        type: 'success',
        message: 'Clinic prices updated successfully',
      });
      setIsEditingPrice(false);
      setEditedFees(null);
    } catch (error: any) {
      showToast({
        type: 'error',
        message: error?.message || 'Failed to update prices',
      });
    }
  };

  /**
   * Handle canceling price edit
   */
  const handleCancelEditPrice = () => {
    setIsEditingPrice(false);
    setEditedFees(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-3xl rounded-xl bg-white shadow-2xl">
          {/* Header with NDC Branding */}
          <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-5 rounded-t-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {/* XenoCare Logo */}
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {formatEncounterPatientName(encounter)}
                  </h2>
                  <p className="text-sm text-white/80">
                    {encounter.patient?.emr_number || 'No Patient number'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                    >
                      {encounter.status}
                    </span>
                    <span className="font-mono text-sm text-white/70 bg-white/10 px-2 py-0.5 rounded">
                      {encounter.encounter_number}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Quick Actions */}
            <div className="mb-6 flex flex-wrap gap-2">
              {/* Only show Cancel button if:
                  - Encounter is not Completed/Cancelled/Closed
                  - No verified payments exist (hasPaidOrders === false)
              */}
              {encounter.status !== 'Completed' &&
                encounter.status !== 'Cancelled' &&
                encounter.status !== 'Closed' &&
                hasPaidOrders === false && (
                  <button
                    onClick={handleCancelClick}
                    disabled={updateStatus.isPending || isCheckingPayment}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    {isCheckingPayment ? 'Checking...' : 'Cancel Encounter'}
                  </button>
                )}
              {/* Show indicator when encounter cannot be cancelled due to verified payments */}
              {encounter.status !== 'Completed' &&
                encounter.status !== 'Cancelled' &&
                encounter.status !== 'Closed' &&
                hasPaidOrders === true && (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-600">
                    <Shield className="h-4 w-4" />
                    Payments Verified - Cannot Cancel
                  </div>
                )}
              <button
                onClick={() => setShowClinicalReport(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <FileOutput className="h-4 w-4" />
                Generate Clinical Report
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Patient Information */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-gray-600">
                    <User className="h-4 w-4" />
                    Patient Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Full Name</span>
                      <span className="font-medium text-gray-900">
                        {formatEncounterPatientName(encounter)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Patient number</span>
                      <span className="font-mono font-medium text-gray-900">
                        {encounter.patient?.emr_number || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date of Birth</span>
                      <span className="font-medium text-gray-900">
                        {encounter.patient?.date_of_birth
                          ? formatEncounterDate(encounter.patient.date_of_birth)
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gender</span>
                      <span className="font-medium text-gray-900">
                        {encounter.patient?.gender || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Phone</span>
                      <span className="font-medium text-gray-900">
                        {encounter.patient?.phone || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visit Details */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-gray-600">
                    <Calendar className="h-4 w-4" />
                    Visit Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Visit Type</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${visitTypeColor.bg} ${visitTypeColor.text} ${visitTypeColor.border}`}
                      >
                        {encounter.visit_type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Priority</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${priorityColor.bg} ${priorityColor.text} ${priorityColor.border}`}
                      >
                        {encounter.priority || 'Normal'}
                      </span>
                    </div>
                    {/* Current Location - Real-time tracking */}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        Current Location
                      </span>
                      {isLoadingLocation ? (
                        <span className="text-gray-400 text-xs">
                          Loading...
                        </span>
                      ) : currentLocation?.location ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            currentLocation.isInQueue
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-blue-200 bg-blue-50 text-blue-700'
                          }`}
                        >
                          {currentLocation.isInQueue && (
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          )}
                          {currentLocation.location}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Unknown</span>
                      )}
                    </div>
                    {/* Queue Status - Show when in queue or has a status */}
                    {currentLocation?.status && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            currentLocation.status === 'Waiting'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : currentLocation.status === 'In Progress'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : currentLocation.status ===
                                    'Ready_For_Consultation'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : currentLocation.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {currentLocation.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Encounter Date</span>
                      <span className="font-medium text-gray-900">
                        {formatEncounterDate(encounter.encounter_date)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Start Time</span>
                      <span className="font-medium text-gray-900">
                        {formatEncounterDateTime(encounter.start_time)}
                      </span>
                    </div>
                    {encounter.end_time && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">End Time</span>
                        <span className="font-medium text-gray-900">
                          {formatEncounterDateTime(encounter.end_time)}
                        </span>
                      </div>
                    )}
                    {(encounter.status === 'Active' ||
                      encounter.status === 'Created') && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Wait Time</span>
                        <span className="font-medium text-orange-600">
                          {calculateWaitTime(encounter.start_time)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Clinic & Staff */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-gray-600">
                    <Stethoscope className="h-4 w-4" />
                    Clinic & Staff
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Clinic</span>
                      <span className="font-medium text-gray-900">
                        {encounter.clinic?.clinic_name || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Clinic Code</span>
                      <span className="font-mono font-medium text-gray-900">
                        {encounter.clinic?.clinic_code || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Attending Doctor</span>
                      <span className="font-medium text-gray-900">
                        {formatEncounterDoctorName(encounter)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Registered By</span>
                      <span className="font-medium text-gray-900">
                        {encounter.registrar
                          ? `${encounter.registrar.first_name} ${encounter.registrar.last_name}`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Information */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase text-gray-600">
                      <CreditCard className="h-4 w-4" />
                      Payment Information
                    </h3>
                    {isSuperAdmin && encounter.clinic && (
                      <button
                        onClick={handleStartEditPrice}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                        title="Edit clinic prices (Super Admin only)"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit Prices
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payment Category</span>
                      <span className="font-medium text-gray-900">
                        {encounter.payment_category || '-'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">Consultation Fee</span>
                      <span className="font-semibold text-primary-700">
                        ₦
                        {getConsultationFee(
                          encounter.clinic,
                          encounter.visit_type as VisitType,
                          encounter.payment_category ||
                            encounter.patient?.insurance_type ||
                            '',
                        ).toLocaleString()}
                      </span>
                    </div>
                    {/* Show all fees for super_admin */}
                    {isSuperAdmin && encounter.clinic && (
                      <>
                        <div className="flex justify-between text-gray-400">
                          <span className="text-gray-500">Follow-Up Fee</span>
                          <span className="font-medium">
                            ₦
                            {encounter.clinic.follow_up_fee?.toLocaleString() ||
                              '0'}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span className="text-gray-500">Emergency Fee</span>
                          <span className="font-medium">
                            ₦
                            {encounter.clinic.emergency_fee?.toLocaleString() ||
                              '0'}
                          </span>
                        </div>
                        {/* NHIS Fees */}
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            NHIS Rates
                          </div>
                          <div className="flex justify-between text-green-600">
                            <span className="text-gray-500">
                              NHIS Consultation
                            </span>
                            <span className="font-medium">
                              ₦
                              {(
                                encounter.clinic as any
                              ).nhis_consultation_fee?.toLocaleString() || '0'}
                            </span>
                          </div>
                          <div className="flex justify-between text-green-600">
                            <span className="text-gray-500">
                              NHIS Follow-Up
                            </span>
                            <span className="font-medium">
                              ₦
                              {(
                                encounter.clinic as any
                              ).nhis_follow_up_fee?.toLocaleString() || '0'}
                            </span>
                          </div>
                          <div className="flex justify-between text-green-600">
                            <span className="text-gray-500">
                              NHIS Emergency
                            </span>
                            <span className="font-medium">
                              ₦
                              {(
                                encounter.clinic as any
                              ).nhis_emergency_fee?.toLocaleString() || '0'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Chief Complaint */}
                {encounter.chief_complaint && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-gray-600">
                      <FileText className="h-4 w-4" />
                      Chief Complaint
                    </h3>
                    <p className="text-sm text-gray-700">
                      {encounter.chief_complaint}
                    </p>
                  </div>
                )}

                {/* Discharge Notes */}
                {encounter.discharge_notes && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-gray-600">
                      <AlertCircle className="h-4 w-4" />
                      Discharge Notes
                    </h3>
                    <p className="text-sm text-gray-700">
                      {encounter.discharge_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Report Modal - Uses wrapper to fetch real data from database */}
      <EncounterClinicalReportWrapper
        isOpen={showClinicalReport}
        onClose={() => setShowClinicalReport(false)}
        encounter={encounter}
      />

      {/* Cancel Encounter Confirmation Dialog */}
      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => {
          setCancelConfirmOpen(false);
          setCancelError(null);
        }}
        onConfirm={handleConfirmCancel}
        title="Cancel Encounter"
        message={
          <div className="space-y-3">
            <p>
              Are you sure you want to cancel this encounter for{' '}
              <strong>{formatEncounterPatientName(encounter)}</strong>?
            </p>

            {/* Patient Classification Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Patient Type:</span>
              <span
                className={`text-xs font-bold px-2 py-1 rounded ${
                  getPatientClassification() === 'Inpatient'
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-sky-100 text-sky-700 border border-sky-200'
                }`}
              >
                {getPatientClassification() === 'Inpatient'
                  ? 'INPATIENT (IPD)'
                  : 'OUTPATIENT (OPD)'}
              </span>
            </div>

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
                  <strong>Outpatient (OPD):</strong> Encounters expire after 24
                  hours
                </li>
                <li>
                  <strong>Inpatient (IPD):</strong> Encounters expire upon
                  patient discharge
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

      {/* Edit Clinic Prices Modal (Super Admin Only) */}
      {isEditingPrice && editedFees && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 transition-opacity"
              onClick={handleCancelEditPrice}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-700 to-primary-600 px-6 py-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                      <CreditCard className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Edit Clinic Prices
                      </h3>
                      <p className="text-sm text-white/80">
                        {encounter.clinic?.clinic_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelEditPrice}
                    className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Super Admin Badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    Super Admin: Price Management
                  </span>
                </div>

                {/* Private/Cash Prices */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-500" />
                    Private / Cash Prices (₦)
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Consultation
                      </label>
                      <input
                        type="number"
                        value={editedFees.consultation_fee}
                        onChange={(e) =>
                          setEditedFees({
                            ...editedFees,
                            consultation_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Follow-Up
                      </label>
                      <input
                        type="number"
                        value={editedFees.follow_up_fee}
                        onChange={(e) =>
                          setEditedFees({
                            ...editedFees,
                            follow_up_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Emergency
                      </label>
                      <input
                        type="number"
                        value={editedFees.emergency_fee}
                        onChange={(e) =>
                          setEditedFees({
                            ...editedFees,
                            emergency_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* NHIS/Insurance Prices */}
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    NHIS / Insurance Prices (₦)
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        NHIS Consultation
                      </label>
                      <input
                        type="number"
                        value={editedFees.nhis_consultation_fee}
                        onChange={(e) =>
                          setEditedFees({
                            ...editedFees,
                            nhis_consultation_fee:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors bg-green-50"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        NHIS Follow-Up
                      </label>
                      <input
                        type="number"
                        value={editedFees.nhis_follow_up_fee}
                        onChange={(e) =>
                          setEditedFees({
                            ...editedFees,
                            nhis_follow_up_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors bg-green-50"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        NHIS Emergency
                      </label>
                      <input
                        type="number"
                        value={editedFees.nhis_emergency_fee}
                        onChange={(e) =>
                          setEditedFees({
                            ...editedFees,
                            nhis_emergency_fee: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors bg-green-50"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Info Note */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">
                    <strong>Note:</strong> Changes will apply to all future
                    encounters at this clinic. Existing billing orders will not
                    be affected.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={handleCancelEditPrice}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePrice}
                  disabled={updateClinic.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-700 rounded-lg hover:bg-[#005830] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updateClinic.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save Prices
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncounterDetail;
