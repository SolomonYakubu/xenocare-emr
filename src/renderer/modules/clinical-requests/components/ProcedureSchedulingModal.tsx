/**
 * Procedure Scheduling Modal
 * ==========================
 * Modal for scheduling approved procedure/surgery requests
 * - Select date and time
 * - Assign theatre/OR room
 * - Set pre-op requirements
 * - Assign surgical team
 */

import React, { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import {
  X,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Stethoscope,
  FileText,
  MapPin,
  Users,
  ClipboardList,
  UserPlus,
  Trash2,
} from 'lucide-react';
import {
  ClinicalRequestWithDetailsDTO,
  URGENCY_CONFIG,
} from '../dtos/clinical-request.dto';
import { useDoctors, useClinicalStaff } from '../../staff/hooks/useStaff';
import { formatDetailedAge } from '../../patient-registration/dtos/patient.dto';
import SavedNotesPopover from '../../../components/ui/SavedNotesPopover';
import TemplateSearchPopover from '../../../components/ui/TemplateSearchPopover';

interface ParticipatingStaff {
  staff_id: string;
  name: string;
  role: string;
}

interface ProcedureSchedulingData {
  request_id: string;
  patient_id: string;
  encounter_id: string;
  scheduled_date: string;
  scheduled_time: string;
  scheduled_duration_minutes: number;
  theatre_room?: string;
  surgeon_id?: string;
  anesthesiologist_id?: string;
  assistant_surgeons?: ParticipatingStaff[];
  pre_op_instructions?: string;
  special_equipment?: string;
  notes?: string;
}

interface ProcedureSchedulingModalProps {
  request: ClinicalRequestWithDetailsDTO;
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (data: ProcedureSchedulingData) => Promise<void>;
  facilityId: string;
}

// Theatre rooms (would normally come from database)
const THEATRE_ROOMS = [
  { id: 'OR-1', name: 'Operating Room 1 (Main)', type: 'General Surgery' },
  { id: 'OR-2', name: 'Operating Room 2', type: 'General Surgery' },
  { id: 'OR-3', name: 'Operating Room 3 (Ortho)', type: 'Orthopedic' },
  { id: 'OR-4', name: 'Minor Procedures Room', type: 'Minor Procedures' },
  { id: 'CATH', name: 'Catheterization Lab', type: 'Cardiac' },
  { id: 'ENDO', name: 'Endoscopy Suite', type: 'Endoscopy' },
];

// Common pre-op requirements
const PRE_OP_CHECKLIST = [
  { id: 'fasting', label: 'NPO (Nothing by mouth) 8 hours before' },
  { id: 'consent', label: 'Surgical consent signed' },
  { id: 'labs', label: 'Pre-op labs completed' },
  { id: 'ecg', label: 'ECG if required' },
  { id: 'blood', label: 'Blood products on standby' },
  { id: 'anesthesia', label: 'Anesthesia consultation done' },
  { id: 'medications', label: 'Hold anticoagulants' },
  { id: 'allergies', label: 'Allergies verified' },
];

// Time slots
const TIME_SLOTS = [
  '07:00',
  '07:30',
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
];

export const ProcedureSchedulingModal: React.FC<
  ProcedureSchedulingModalProps
> = ({ request, isOpen, onClose, onSchedule, facilityId }) => {
  // Fetch staff data
  const { data: doctors = [], isLoading: loadingDoctors } = useDoctors();
  const { data: clinicalStaff = [], isLoading: loadingStaff } =
    useClinicalStaff();

  // Form state
  const [scheduledDate, setScheduledDate] = useState(
    request.scheduled_date || format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  );
  const [scheduledTime, setScheduledTime] = useState(
    request.scheduled_time || '08:00',
  );
  const [estimatedDuration, setEstimatedDuration] = useState(60);
  const [theatreRoom, setTheatreRoom] = useState('');
  const [surgeonId, setSurgeonId] = useState(request.target_doctor_id || '');
  const [anesthesiologistId, setAnesthesiologistId] = useState('');
  const [assistantSurgeons, setAssistantSurgeons] = useState<
    ParticipatingStaff[]
  >([]);
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState('');
  const [selectedRoleToAdd, setSelectedRoleToAdd] =
    useState('Assistant Surgeon');
  const [selectedPreOpChecks, setSelectedPreOpChecks] = useState<string[]>([
    'fasting',
    'consent',
    'labs',
    'allergies',
  ]);
  const [customPreOpInstructions, setCustomPreOpInstructions] = useState(
    request.pre_op_requirements || '',
  );
  const [specialEquipment, setSpecialEquipment] = useState('');
  const [notes, setNotes] = useState(request.procedure_notes || '');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const urgencyConfig = URGENCY_CONFIG[request.urgency];

  const togglePreOpCheck = (checkId: string) => {
    setSelectedPreOpChecks((prev) =>
      prev.includes(checkId)
        ? prev.filter((id) => id !== checkId)
        : [...prev, checkId],
    );
  };

  const addParticipatingStaff = () => {
    if (!selectedStaffToAdd) return;

    const staff = clinicalStaff.find((s) => s.id === selectedStaffToAdd);
    if (!staff) return;

    // Check if already added
    if (assistantSurgeons.some((a) => a.staff_id === selectedStaffToAdd)) {
      return;
    }

    setAssistantSurgeons((prev) => [
      ...prev,
      {
        staff_id: staff.id,
        name: `${staff.first_name} ${staff.last_name}`,
        role: selectedRoleToAdd,
      },
    ]);
    setSelectedStaffToAdd('');
  };

  const removeParticipatingStaff = (staffId: string) => {
    setAssistantSurgeons((prev) => prev.filter((a) => a.staff_id !== staffId));
  };

  const getPreOpInstructions = (): string => {
    const checkedItems = PRE_OP_CHECKLIST.filter((item) =>
      selectedPreOpChecks.includes(item.id),
    )
      .map((item) => `• ${item.label}`)
      .join('\n');

    return customPreOpInstructions
      ? `${checkedItems}\n\nAdditional Instructions:\n${customPreOpInstructions}`
      : checkedItems;
  };

  const canSubmit = () => {
    return scheduledDate && scheduledTime;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      setError('Please select a date and time for the procedure');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const data: ProcedureSchedulingData = {
        request_id: request.id,
        patient_id: request.patient_id,
        encounter_id: request.encounter_id,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        scheduled_duration_minutes: estimatedDuration,
        theatre_room: theatreRoom || undefined,
        surgeon_id: surgeonId || undefined,
        anesthesiologist_id: anesthesiologistId || undefined,
        assistant_surgeons:
          assistantSurgeons.length > 0 ? assistantSurgeons : undefined,
        pre_op_instructions: getPreOpInstructions(),
        special_equipment: specialEquipment || undefined,
        notes: notes || undefined,
      };

      await onSchedule(data);
      onClose();
    } catch (err) {
      console.error('Error scheduling procedure:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to schedule procedure',
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
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-xl">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6" />
              <div>
                <h2 className="text-lg font-semibold">
                  Schedule {request.request_type}
                </h2>
                <p className="text-purple-100 text-sm">
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
                    {formatDetailedAge(request.patient_dob)}
                  </p>
                </div>
              </div>
            </div>

            {/* Procedure Details */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> Procedure Details
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Procedure:</span>
                  <span className="ml-2 font-medium">
                    {request.procedure_name}
                    {request.procedure_code && (
                      <span className="text-gray-500 ml-1">
                        ({request.procedure_code})
                      </span>
                    )}
                  </span>
                </div>
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
              </div>
            </div>

            {/* Schedule Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Schedule
              </h3>

              <div className="grid grid-cols-3 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {TIME_SLOTS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Est. Duration (mins)
                  </label>
                  <input
                    type="number"
                    value={estimatedDuration}
                    onChange={(e) =>
                      setEstimatedDuration(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    min={15}
                    step={15}
                  />
                </div>
              </div>

              {/* Theatre Room */}
              <div>
                <label className="block text-sm text-gray-600 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Theatre / OR Room
                </label>
                <select
                  value={theatreRoom}
                  onChange={(e) => setTheatreRoom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select theatre room...</option>
                  {THEATRE_ROOMS.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} - {room.type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Surgical Team */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> Surgical Team
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {/* Primary Surgeon */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Surgeon in Charge
                  </label>
                  <select
                    value={surgeonId}
                    onChange={(e) => setSurgeonId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    disabled={loadingDoctors}
                  >
                    <option value="">Select surgeon...</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        Dr. {doctor.first_name} {doctor.last_name}
                        {doctor.department && ` - ${doctor.department}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Anesthesiologist */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Anesthesiologist
                  </label>
                  <select
                    value={anesthesiologistId}
                    onChange={(e) => setAnesthesiologistId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    disabled={loadingDoctors}
                  >
                    <option value="">Select anesthesiologist...</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        Dr. {doctor.first_name} {doctor.last_name}
                        {doctor.department && ` - ${doctor.department}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Participating Staff */}
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  Participating Surgeons / Nurses
                </label>

                {/* Add Staff Row */}
                <div className="flex gap-2 mb-3">
                  <select
                    value={selectedStaffToAdd}
                    onChange={(e) => setSelectedStaffToAdd(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                    disabled={loadingStaff}
                  >
                    <option value="">Select staff member...</option>
                    {clinicalStaff
                      .filter(
                        (s) =>
                          !assistantSurgeons.some((a) => a.staff_id === s.id),
                      )
                      .map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.first_name} {staff.last_name} ({staff.role})
                          {staff.department && ` - ${staff.department}`}
                        </option>
                      ))}
                  </select>
                  <select
                    value={selectedRoleToAdd}
                    onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                    className="w-40 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  >
                    <option value="Assistant Surgeon">Assistant Surgeon</option>
                    <option value="Scrub Nurse">Scrub Nurse</option>
                    <option value="Circulating Nurse">Circulating Nurse</option>
                    <option value="Surgical Assistant">
                      Surgical Assistant
                    </option>
                    <option value="Observer">Observer</option>
                  </select>
                  <button
                    type="button"
                    onClick={addParticipatingStaff}
                    disabled={!selectedStaffToAdd}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>

                {/* Added Staff List */}
                {assistantSurgeons.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {assistantSurgeons.map((staff) => (
                      <div
                        key={staff.staff_id}
                        className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{staff.name}</p>
                            <p className="text-xs text-gray-500">
                              {staff.role}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            removeParticipatingStaff(staff.staff_id)
                          }
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {assistantSurgeons.length === 0 && (
                  <p className="text-sm text-gray-400 italic">
                    No participating staff added yet
                  </p>
                )}
              </div>
            </div>

            {/* Pre-Op Requirements */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Pre-Operative Requirements
              </h3>

              {/* Checklist */}
              <div className="grid grid-cols-2 gap-2">
                {PRE_OP_CHECKLIST.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPreOpChecks.includes(item.id)}
                      onChange={() => togglePreOpCheck(item.id)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm">{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Custom Instructions */}
              <div>
                <div className="flex justify-end mb-2">
                  <TemplateSearchPopover
                    templateType="inpatient"
                    category="procedure_notes"
                    currentValues={{ pre_op_instructions: customPreOpInstructions, procedure_notes: notes }}
                    onTemplateSelect={(data) => {
                      if (data.pre_op_instructions) setCustomPreOpInstructions(data.pre_op_instructions);
                      if (data.procedure_notes) setNotes(data.procedure_notes);
                    }}
                    buttonText="Fill All Fields"
                  />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm text-gray-600">
                    Additional Pre-Op Instructions
                  </label>
                  <SavedNotesPopover
                    category="procedure_notes"
                    subcategory="pre_op_instructions"
                    currentValue={customPreOpInstructions}
                    onInsert={(content) => setCustomPreOpInstructions(content)}
                  />
                </div>
                <textarea
                  value={customPreOpInstructions}
                  onChange={(e) => setCustomPreOpInstructions(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Any additional pre-operative instructions..."
                />
              </div>

              {/* Special Equipment */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Special Equipment Required
                </label>
                <input
                  type="text"
                  value={specialEquipment}
                  onChange={(e) => setSpecialEquipment(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Laparoscopic tower, C-arm..."
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-gray-600">
                  <FileText className="w-3 h-3 inline mr-1" /> Scheduling Notes
                </label>
                <SavedNotesPopover
                  category="procedure_notes"
                  subcategory="scheduling_notes"
                  currentValue={notes}
                  onInsert={(content) => setNotes(content)}
                />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Any additional notes for scheduling..."
              />
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
              {scheduledDate && scheduledTime ? (
                <span className="flex items-center gap-2 text-purple-700">
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    Scheduled for{' '}
                    <strong>
                      {format(new Date(scheduledDate), 'EEEE, MMMM d, yyyy')}
                    </strong>{' '}
                    at <strong>{scheduledTime}</strong>
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  Please select date and time
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
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Schedule Procedure
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

export default ProcedureSchedulingModal;
