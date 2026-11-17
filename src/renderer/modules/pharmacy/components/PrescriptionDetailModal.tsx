import React, { useState } from 'react';
import {
  X,
  Pill,
  User,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Stethoscope,
  Package,
  CreditCard,
  Activity,
  Printer,
  Edit,
  History,
  Info,
  ClipboardList,
} from 'lucide-react';
import { Button } from '../../../components/ui';
import { isNhisFeatureEnabled } from '../../../config/features';
import PatientAllergySummary from '../../../components/shared/PatientAllergySummary';
import {
  getFacilityAddress,
  getFacilityName,
} from '../../../lib/facility';
import { StatusBadge } from '../../../components/ui/DataDisplay';
import {
  PrescriptionDTO,
  PrescriptionStatus,
  getPrescriptionStatusColor,
  formatPrescriptionDetails,
  getDrugCategoryColor,
  getDrugTypeColor,
  getDispenseStatusColor,
} from '../dtos/pharmacy.dto';
import {
  formatPatientName,
  formatDetailedAge,
} from '../../patient-registration/dtos/patient.dto';

// =============================================================================
// Types
// =============================================================================

interface PrescriptionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: PrescriptionDTO | null;
  onDispense?: (prescription: PrescriptionDTO) => void;
  onPrintLabel?: (prescription: PrescriptionDTO) => void;
  onCancel?: (prescription: PrescriptionDTO) => void;
}

// =============================================================================
// Helper Components
// =============================================================================

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        {Icon && <Icon className="h-4 w-4" />}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-gray-900 text-right max-w-[60%]">
        {value}
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export default function PrescriptionDetailModal({
  isOpen,
  onClose,
  prescription,
  onDispense,
  onPrintLabel,
  onCancel,
}: PrescriptionDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'dispense'>('details');

  if (!isOpen || !prescription) return null;

  const remaining =
    prescription.quantity_prescribed - (prescription.quantity_dispensed || 0);
  const isPending = prescription.status === 'Pending';
  const isPartial = prescription.status === 'Partial';
  const isDispensed = prescription.status === 'Dispensed';
  const isCancelled = prescription.status === 'Cancelled';

  const getStatusIcon = () => {
    if (isDispensed) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (isCancelled) return <X className="h-5 w-5 text-red-500" />;
    if (isPartial) return <Activity className="h-5 w-5 text-amber-500" />;
    return <Clock className="h-5 w-5 text-blue-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="relative bg-gray-50 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* EMR Header with NDC Branding */}
          <div className="bg-white border-b border-gray-200 flex-shrink-0">
            {/* Top Bar with Logo and Title */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600">
              <div className="flex items-center gap-4">
                <div className="border-l border-white/30 pl-4">
                  <h1 className="text-white font-bold text-lg tracking-wide">
                    {getFacilityName().toUpperCase()}
                  </h1>
                  <p className="text-green-100 text-xs font-medium">
                    {getFacilityAddress() || 'Prescription Details'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-4">
                  <p className="text-white text-sm font-medium">
                    Rx #{prescription.prescription_id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-green-100 text-xs">
                    {new Date(prescription.created_at).toLocaleDateString(
                      'en-NG',
                      {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      },
                    )}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6 bg-gray-50">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'details'
                    ? 'text-primary-700 border-b-2 border-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Prescription Details
                </div>
              </button>
              <button
                onClick={() => setActiveTab('dispense')}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'dispense'
                    ? 'text-primary-700 border-b-2 border-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Dispense History
                  {prescription.dispenses &&
                    prescription.dispenses.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        {prescription.dispenses.length}
                      </span>
                    )}
                </div>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            {activeTab === 'details' && (
              <div className="p-6 space-y-5">
                {/* Status Banner */}
                <div
                  className={`p-4 rounded-xl flex items-center justify-between ${
                    isDispensed
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                      : isCancelled
                        ? 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200'
                        : isPartial
                          ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200'
                          : 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon()}
                    <div>
                      <p
                        className={`font-semibold ${
                          isDispensed
                            ? 'text-green-800'
                            : isCancelled
                              ? 'text-red-800'
                              : isPartial
                                ? 'text-amber-800'
                                : 'text-blue-800'
                        }`}
                      >
                        {isDispensed
                          ? 'Fully Dispensed'
                          : isCancelled
                            ? 'Prescription Cancelled'
                            : isPartial
                              ? 'Partially Dispensed'
                              : 'Pending Dispensing'}
                      </p>
                      <p
                        className={`text-xs ${
                          isDispensed
                            ? 'text-green-600'
                            : isCancelled
                              ? 'text-red-600'
                              : isPartial
                                ? 'text-amber-600'
                                : 'text-blue-600'
                        }`}
                      >
                        {isDispensed
                          ? 'All medication has been given to patient'
                          : isCancelled
                            ? 'This prescription has been cancelled'
                            : isPartial
                              ? `${prescription.quantity_dispensed} of ${prescription.quantity_prescribed} units dispensed`
                              : 'Awaiting pharmacy action'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    status={prescription.status}
                    variant={getPrescriptionStatusColor(
                      prescription.status as PrescriptionStatus,
                    )}
                  />
                </div>

                {/* Patient Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-blue-100 rounded-xl">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Patient Information
                      </h3>
                      <p className="text-xs text-gray-500">
                        Prescription recipient details
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {prescription.patient?.first_name?.charAt(0)}
                      {prescription.patient?.surname?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-semibold text-gray-900">
                        {prescription.patient
                          ? formatPatientName(prescription.patient)
                          : 'Unknown Patient'}
                      </h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>{prescription.patient?.gender || 'N/A'}</span>
                        <span>•</span>
                        <span>
                          {prescription.patient?.date_of_birth
                            ? `${formatDetailedAge(prescription.patient.date_of_birth)}`
                            : 'N/A'}
                        </span>
                        <span>•</span>
                        <span>
                          {prescription.patient?.contact_phone || 'No phone'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Structured allergy status */}
                  <PatientAllergySummary
                    patientId={prescription.patient?.id}
                    knownAllergies={prescription.patient?.known_allergies}
                    noKnownAllergies={
                      (
                        prescription.patient as
                          | { no_known_allergies?: boolean }
                          | undefined
                      )?.no_known_allergies
                    }
                    compact
                  />
                </div>

                {/* Clinical Context Section - Diagnosis & Indication */}
                {(prescription.diagnosis?.length ||
                  prescription.clinical_notes) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                      <div className="p-2.5 bg-emerald-100 rounded-xl">
                        <Stethoscope className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Clinical Context
                        </h3>
                        <p className="text-xs text-gray-500">
                          Why this medication was prescribed
                        </p>
                      </div>
                    </div>

                    {/* Diagnosis */}
                    {prescription.diagnosis &&
                      prescription.diagnosis.length > 0 && (
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 mb-3">
                          <p className="text-xs font-semibold text-emerald-800 uppercase mb-2">
                            Diagnosis / Indication
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {prescription.diagnosis.map((d, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-white border border-emerald-300 text-emerald-800 text-sm rounded-lg font-medium"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Clinical Notes */}
                    {prescription.clinical_notes && (
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
                          Clinical Notes
                        </p>
                        <p className="text-sm text-gray-800">
                          {prescription.clinical_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Medication Details Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-purple-100 rounded-xl">
                      <Pill className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Medication Details
                      </h3>
                      <p className="text-xs text-gray-500">
                        Drug information and specifications
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 mb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-xl">
                          {prescription.drug?.drug_name}
                        </h4>
                        {prescription.drug?.brand_name && (
                          <p className="text-sm text-purple-600 font-medium">
                            Brand: {prescription.drug.brand_name}
                          </p>
                        )}
                        <p className="text-sm text-purple-700 font-medium mt-0.5">
                          {prescription.drug?.strength} •{' '}
                          {prescription.drug?.dosage_form ||
                            prescription.drug?.formulation}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {prescription.drug?.manufacturer ||
                            'Unknown manufacturer'}
                        </p>
                      </div>
                      <div className="text-right space-y-1.5">
                        {prescription.drug?.category && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDrugCategoryColor(prescription.drug.category as any)}`}
                          >
                            {prescription.drug.category}
                          </span>
                        )}
                        {prescription.drug?.drug_type && (
                          <span
                            className={`block inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDrugTypeColor(prescription.drug.drug_type as any)}`}
                          >
                            {prescription.drug.drug_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Generic Name
                      </p>
                      <p className="font-medium text-gray-900">
                        {prescription.drug?.generic_name ||
                          prescription.drug?.drug_name ||
                          'N/A'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Drug Type
                      </p>
                      <p className="font-medium text-gray-900">
                        {prescription.drug?.drug_type || 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Route
                      </p>
                      <p className="font-medium text-gray-900">
                        {prescription.route || 'Oral'}
                      </p>
                    </div>
                  </div>

                  {/* NHIS Coverage Info */}
                  {isNhisFeatureEnabled() &&
                    prescription.drug?.nhis_eligible && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          NHIS Covered
                        </span>
                      </div>
                      <span className="text-sm font-bold text-green-700">
                        {prescription.drug?.nhis_percentage || 0}% Coverage
                      </span>
                    </div>
                  )}
                </div>

                {/* Dosage Instructions Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-amber-100 rounded-xl">
                      <FileText className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Dosage Instructions
                      </h3>
                      <p className="text-xs text-gray-500">
                        How the medication should be taken
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-gray-900 font-medium">
                      {formatPrescriptionDetails(prescription)}
                    </p>
                    {prescription.instructions && (
                      <div className="mt-3 pt-3 border-t border-amber-200">
                        <p className="text-xs font-semibold text-amber-800 uppercase mb-1">
                          Special Instructions
                        </p>
                        <p className="text-sm text-amber-900 italic">
                          {prescription.instructions}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Dosage
                      </p>
                      <p className="font-bold text-lg text-gray-900">
                        {prescription.dosage || 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Frequency
                      </p>
                      <p className="font-bold text-lg text-gray-900">
                        {prescription.frequency || 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Duration
                      </p>
                      <p className="font-bold text-lg text-gray-900">
                        {prescription.duration || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quantity Summary Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                      <Package className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Quantity Details
                      </h3>
                      <p className="text-xs text-gray-500">
                        Prescription and dispensing quantities
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white text-center shadow-md">
                      <div className="text-3xl font-bold">
                        {prescription.quantity_prescribed}
                      </div>
                      <div className="text-xs text-blue-100 uppercase tracking-wider mt-1">
                        Prescribed
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl text-white text-center shadow-md">
                      <div className="text-3xl font-bold">
                        {prescription.quantity_dispensed || 0}
                      </div>
                      <div className="text-xs text-green-100 uppercase tracking-wider mt-1">
                        Dispensed
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl text-white text-center shadow-md">
                      <div className="text-3xl font-bold">{remaining}</div>
                      <div className="text-xs text-orange-100 uppercase tracking-wider mt-1">
                        Remaining
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-xl text-white text-center shadow-md ${
                        (prescription.drug?.quantity_in_stock || 0) === 0
                          ? 'bg-gradient-to-br from-red-500 to-red-600'
                          : (prescription.drug?.quantity_in_stock || 0) <=
                              (prescription.drug?.reorder_level || 10)
                            ? 'bg-gradient-to-br from-yellow-500 to-amber-500'
                            : 'bg-gradient-to-br from-teal-500 to-cyan-600'
                      }`}
                    >
                      <div className="text-3xl font-bold">
                        {prescription.drug?.quantity_in_stock || 0}
                      </div>
                      <div
                        className={`text-xs uppercase tracking-wider mt-1 ${
                          (prescription.drug?.quantity_in_stock || 0) === 0
                            ? 'text-red-100'
                            : 'text-teal-100'
                        }`}
                      >
                        In Stock
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prescriber & Timeline Section */}
                <div className="grid grid-cols-2 gap-5">
                  {/* Prescriber Info */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                      <div className="p-2.5 bg-indigo-100 rounded-xl">
                        <Stethoscope className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Prescribed By
                        </h3>
                        <p className="text-xs text-gray-500">Doctor details</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow">
                        {prescription.doctor?.first_name?.charAt(0)}
                        {prescription.doctor?.last_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          Dr. {prescription.doctor?.first_name}{' '}
                          {prescription.doctor?.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {prescription.doctor?.department ||
                            'General Practitioner'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                      <div className="p-2.5 bg-gray-100 rounded-xl">
                        <History className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Timeline
                        </h3>
                        <p className="text-xs text-gray-500">Important dates</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-4 w-4" />
                          <span>Created</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(prescription.created_at).toLocaleDateString(
                            'en-NG',
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </span>
                      </div>
                      {prescription.updated_at &&
                        prescription.updated_at !== prescription.created_at && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="h-4 w-4" />
                              <span>Last Updated</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(
                                prescription.updated_at,
                              ).toLocaleDateString('en-NG', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Instructions/Notes Section */}
                {prescription.instructions && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                      <div className="p-2.5 bg-gray-100 rounded-xl">
                        <Info className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Additional Instructions
                        </h3>
                        <p className="text-xs text-gray-500">
                          Detailed instructions for medication use
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-700">{prescription.instructions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Dispense History Tab */}
            {activeTab === 'dispense' && (
              <div className="p-6 space-y-5">
                {prescription.dispenses && prescription.dispenses.length > 0 ? (
                  <>
                    {/* Dispense Summary */}
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <Package className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              Dispense Summary
                            </p>
                            <p className="text-xs text-gray-500">
                              {prescription.dispenses.length} dispense record(s)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-700">
                            {prescription.quantity_dispensed || 0} /{' '}
                            {prescription.quantity_prescribed}
                          </p>
                          <p className="text-xs text-gray-500">
                            units dispensed
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dispense Records */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                        <div className="p-2.5 bg-blue-100 rounded-xl">
                          <History className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">
                            Dispense History
                          </h3>
                          <p className="text-xs text-gray-500">
                            Record of all dispensing actions
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {prescription.dispenses.map((dispense, idx) => (
                          <div
                            key={dispense.dispense_id || idx}
                            className="p-4 bg-gray-50 rounded-xl border border-gray-200"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                  Dispense #{idx + 1}
                                </span>
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded ${
                                    dispense.dispense_status ===
                                    'Fully Dispensed'
                                      ? 'bg-green-100 text-green-700'
                                      : dispense.dispense_status ===
                                          'Partially Dispensed'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {dispense.dispense_status || 'Dispensed'}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                {new Date(
                                  dispense.dispense_date || dispense.created_at,
                                ).toLocaleDateString('en-NG', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">
                                  Quantity
                                </p>
                                <p className="font-semibold text-gray-900">
                                  {dispense.quantity_dispensed} units
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">
                                  Dispensed By
                                </p>
                                <p className="font-semibold text-gray-900">
                                  {dispense.pharmacist
                                    ? `${dispense.pharmacist.first_name} ${dispense.pharmacist.last_name}`
                                    : 'N/A'}
                                </p>
                              </div>
                              {dispense.batch_number && (
                                <div>
                                  <p className="text-xs text-gray-500 uppercase mb-1">
                                    Batch Number
                                  </p>
                                  <p className="font-semibold text-gray-900">
                                    {dispense.batch_number}
                                  </p>
                                </div>
                              )}
                              {dispense.substituted_drug && (
                                <div className="col-span-2">
                                  <p className="text-xs text-amber-600 uppercase mb-1">
                                    Substituted Drug
                                  </p>
                                  <p className="font-semibold text-amber-800">
                                    {dispense.substituted_drug.drug_name}
                                    {dispense.substitution_reason && (
                                      <span className="font-normal text-gray-500 text-xs ml-2">
                                        ({dispense.substitution_reason})
                                      </span>
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>

                            {dispense.notes && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs text-gray-500 uppercase mb-1">
                                  Notes
                                </p>
                                <p className="text-sm text-gray-700">
                                  {dispense.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">
                      No Dispense Records
                    </h3>
                    <p className="text-sm text-gray-500">
                      This prescription has not been dispensed yet
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with Actions */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Prescription ID: {prescription.prescription_id}
              </div>
              <div className="flex items-center gap-3">
                {isDispensed && onPrintLabel && (
                  <Button
                    variant="secondary"
                    onClick={() => onPrintLabel(prescription)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Label
                  </Button>
                )}
                {isPending && onCancel && (
                  <Button
                    variant="secondary"
                    onClick={() => onCancel(prescription)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Cancel Prescription
                  </Button>
                )}
                {(isPending || isPartial) && onDispense && (
                  <Button
                    onClick={() => onDispense(prescription)}
                    className="bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-[#007538] text-white px-6"
                  >
                    <Pill className="h-4 w-4 mr-2" />
                    Dispense Now
                  </Button>
                )}
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
