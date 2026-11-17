/**
 * Admission Execution Modal
 * =========================
 * Modal for executing approved admission requests
 * - Select ward and bed
 * - Assign attending physician
 * - Set admission details
 * - Create the admission record
 */

import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  X,
  User,
  Bed,
  Building2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Stethoscope,
  FileText,
  Shield,
} from 'lucide-react';
import {
  ClinicalRequestWithDetailsDTO,
  REQUEST_TYPE_LABELS,
  URGENCY_CONFIG,
  LEVEL_OF_CARE_LABELS,
  LevelOfCare,
} from '../dtos/clinical-request.dto';
import { WardBedSelector } from './WardBedSelector';
import { useAuth } from '../../../contexts/AuthContext';
import SavedNotesPopover from '../../../components/ui/SavedNotesPopover';
import TemplateSearchPopover from '../../../components/ui/TemplateSearchPopover';

interface Ward {
  id: string;
  name: string;
  ward_type: string;
  total_beds: number;
  available_beds: number;
}

interface BedInfo {
  id: string;
  bed_number: string;
  bed_type: string;
  status: string;
}

interface AdmissionExecutionData {
  request_id: string;
  patient_id: string;
  encounter_id: string;
  ward_id: string;
  bed_id: string;
  admission_type:
    | 'emergency'
    | 'elective'
    | 'transfer'
    | 'observation'
    | 'day_case';
  admitting_diagnosis: string;
  chief_complaint?: string;
  reason_for_admission?: string;
  attending_physician_id?: string;
  acuity_level?: string;
  isolation_required?: boolean;
  isolation_type?: string;
  expected_discharge_date?: string;
  notes?: string;
}

interface AdmissionExecutionModalProps {
  request: ClinicalRequestWithDetailsDTO;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (data: AdmissionExecutionData) => Promise<void>;
  facilityId: string;
}

// Acuity levels
const ACUITY_LEVELS = [
  { value: 'low', label: 'Low - Stable condition' },
  { value: 'moderate', label: 'Moderate - Requires monitoring' },
  { value: 'high', label: 'High - Close observation needed' },
  { value: 'critical', label: 'Critical - Intensive care required' },
];

// Isolation types
const ISOLATION_TYPES = [
  { value: 'contact', label: 'Contact Precautions' },
  { value: 'droplet', label: 'Droplet Precautions' },
  { value: 'airborne', label: 'Airborne Precautions' },
  { value: 'protective', label: 'Protective Isolation' },
];

export const AdmissionExecutionModal: React.FC<
  AdmissionExecutionModalProps
> = ({ request, isOpen, onClose, onExecute, facilityId }) => {
  const { staff } = useAuth();

  // Form state
  const [selectedWardId, setSelectedWardId] = useState<string | null>(
    request.target_ward_id || null,
  );
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [selectedBed, setSelectedBed] = useState<BedInfo | null>(null);

  const [admissionType, setAdmissionType] = useState<'Emergency' | 'Elective'>(
    (request.admission_type as 'Emergency' | 'Elective') || 'Elective',
  );
  const [admittingDiagnosis, setAdmittingDiagnosis] = useState(
    request.clinical_reason || '',
  );
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [reasonForAdmission, setReasonForAdmission] = useState(
    request.clinical_reason || '',
  );
  const [acuityLevel, setAcuityLevel] = useState(
    request.level_of_care === 'ICU'
      ? 'critical'
      : request.level_of_care === 'HDU'
        ? 'high'
        : 'moderate',
  );
  const [isolationRequired, setIsolationRequired] = useState(false);
  const [isolationType, setIsolationType] = useState('');
  const [expectedDischargeDate, setExpectedDischargeDate] = useState('');
  const [notes, setNotes] = useState(request.notes || '');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const urgencyConfig = URGENCY_CONFIG[request.urgency];

  const calculateAge = (dob?: string) => {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
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

  const handleWardSelect = (wardId: string, ward: Ward) => {
    setSelectedWardId(wardId);
    setSelectedWard(ward);
    // Reset bed selection when ward changes
    setSelectedBedId(null);
    setSelectedBed(null);
  };

  const handleBedSelect = (bedId: string, bed: BedInfo) => {
    setSelectedBedId(bedId);
    setSelectedBed(bed);
  };

  const canSubmit = () => {
    return selectedWardId && selectedBedId && admittingDiagnosis.trim();
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      setError('Please select a ward, bed, and provide an admitting diagnosis');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const data: AdmissionExecutionData = {
        request_id: request.id,
        patient_id: request.patient_id,
        encounter_id: request.encounter_id,
        ward_id: selectedWardId!,
        bed_id: selectedBedId!,
        admission_type: admissionType.toLowerCase() as 'emergency' | 'elective',
        admitting_diagnosis: admittingDiagnosis,
        chief_complaint: chiefComplaint || undefined,
        reason_for_admission: reasonForAdmission || undefined,
        attending_physician_id: request.target_doctor_id || staff?.id,
        acuity_level: acuityLevel,
        isolation_required: isolationRequired,
        isolation_type: isolationRequired ? isolationType : undefined,
        expected_discharge_date: expectedDischargeDate || undefined,
        notes: notes || undefined,
      };

      await onExecute(data);
      onClose();
    } catch (err) {
      console.error('Error executing admission:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to execute admission',
      );
    } finally {
      setSubmitting(false);
    }
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
        <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-xl">
            <div className="flex items-center gap-3">
              <Bed className="w-6 h-6" />
              <div>
                <h2 className="text-lg font-semibold">Execute Admission</h2>
                <p className="text-green-100 text-sm">
                  Request #{request.request_number}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${urgencyConfig.bgColor} ${urgencyConfig.color}`}
              >
                {request.urgency}
              </span>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-6">
            {/* Patient Summary */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" /> Patient
              </h3>
              <div className="grid grid-cols-3 gap-4">
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
                    {calculateAge(request.patient_dob)}
                  </p>
                </div>
              </div>
            </div>

            {/* Request Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Request Details
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Clinical Reason:</span>
                  <span className="ml-2">{request.clinical_reason}</span>
                </div>
                <div>
                  <span className="text-gray-500">Requesting Doctor:</span>
                  <span className="ml-2">
                    Dr. {request.requesting_doctor_name}
                  </span>
                </div>
                {request.level_of_care && (
                  <div>
                    <span className="text-gray-500">Level of Care:</span>
                    <span className="ml-2 font-medium text-amber-700">
                      {
                        LEVEL_OF_CARE_LABELS[
                          request.level_of_care as LevelOfCare
                        ]
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ward & Bed Selection */}
            <div className="border rounded-lg p-4">
              <WardBedSelector
                facilityId={facilityId}
                selectedWardId={selectedWardId}
                selectedBedId={selectedBedId}
                suggestedWardId={request.target_ward_id}
                suggestedWardType={request.suggested_ward_type}
                levelOfCare={request.level_of_care}
                onWardSelect={handleWardSelect}
                onBedSelect={handleBedSelect}
                required
              />
            </div>

            {/* Admission Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> Admission Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Admission Type */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Admission Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={admissionType}
                    onChange={(e) =>
                      setAdmissionType(
                        e.target.value as 'Emergency' | 'Elective',
                      )
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Elective">Elective</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>

                {/* Acuity Level */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Acuity Level
                  </label>
                  <select
                    value={acuityLevel}
                    onChange={(e) => setAcuityLevel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {ACUITY_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Admitting Diagnosis */}
              <div>
                <div className="flex justify-end mb-2">
                  <TemplateSearchPopover
                    templateType="inpatient"
                    category="admission_notes"
                    currentValues={{ admitting_diagnosis: admittingDiagnosis, reason_for_admission: reasonForAdmission, notes }}
                    onTemplateSelect={(data) => {
                      if (data.admitting_diagnosis) setAdmittingDiagnosis(data.admitting_diagnosis);
                      if (data.reason_for_admission) setReasonForAdmission(data.reason_for_admission);
                      if (data.notes) setNotes(data.notes);
                    }}
                    buttonText="Fill All Fields"
                  />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-gray-600">
                    Admitting Diagnosis <span className="text-red-500">*</span>
                  </label>
                  <SavedNotesPopover
                    category="admission_notes"
                    subcategory="admitting_diagnosis"
                    currentValue={admittingDiagnosis}
                    onInsert={(content) => setAdmittingDiagnosis(content)}
                  />
                </div>
                <textarea
                  value={admittingDiagnosis}
                  onChange={(e) => setAdmittingDiagnosis(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter the primary diagnosis for admission..."
                />
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Chief Complaint
                </label>
                <input
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Patient's main complaint..."
                />
              </div>

              {/* Reason for Admission */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-gray-600">
                    Reason for Admission
                  </label>
                  <SavedNotesPopover
                    category="admission_notes"
                    subcategory="reason_for_admission"
                    currentValue={reasonForAdmission}
                    onInsert={(content) => setReasonForAdmission(content)}
                  />
                </div>
                <textarea
                  value={reasonForAdmission}
                  onChange={(e) => setReasonForAdmission(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Detailed reason for admission..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Expected Discharge Date */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Expected Discharge
                  </label>
                  <input
                    type="date"
                    value={expectedDischargeDate}
                    onChange={(e) => setExpectedDischargeDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>

                {/* Isolation Required */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Isolation
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isolationRequired}
                        onChange={(e) => setIsolationRequired(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm">Required</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Isolation Type */}
              {isolationRequired && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Isolation Type
                  </label>
                  <select
                    value={isolationType}
                    onChange={(e) => setIsolationType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select isolation type...</option>
                    {ISOLATION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Additional Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-gray-600">
                    Additional Notes
                  </label>
                  <SavedNotesPopover
                    category="admission_notes"
                    subcategory="additional_notes"
                    currentValue={notes}
                    onInsert={(content) => setNotes(content)}
                  />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Any additional notes for nursing staff..."
                />
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 rounded-lg text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t rounded-b-xl flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {selectedWard && selectedBed ? (
                <span className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    Admitting to <strong>{selectedWard.name}</strong>, Bed{' '}
                    <strong>{selectedBed.bed_number}</strong>
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  Please select ward and bed
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit() || submitting}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Admit Patient
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdmissionExecutionModal;
