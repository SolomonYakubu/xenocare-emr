// =============================================================================
// XENOCARE EMR - Procedure Form Component
// Form for scheduling and creating new procedures
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  User,
  Calendar,
  Clock,
  Activity,
  AlertTriangle,
  FileText,
  Loader2,
  Building2,
  Stethoscope,
  CheckCircle,
  UserCog,
} from 'lucide-react';
import {
  useProcedureCatalogue,
  useSearchProcedureCatalogue,
} from '../hooks/useProcedureCatalogue';
import { useCreateProcedure } from '../hooks/useProcedures';
import { usePatientEncounters } from '../../encounter/hooks/useEncounter';
import { useDoctors } from '../../staff/hooks/useStaff';
import PatientSearchInput from '../../../components/ui/PatientSearchInput';
import type { PatientDTO } from '../../patient-registration/dtos/patient.dto';
import type { Encounter } from '../../encounter/dtos/encounter.dto';
import type {
  ProcedurePriority,
  ProcedureCatalogue,
  CreateProcedureDTO,
} from '../../../types/database.types';

interface ProcedureFormProps {
  patientId?: string;
  encounterId?: string;
  admissionId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const priorities: {
  value: ProcedurePriority;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: 'routine',
    label: 'Routine',
    description: 'Standard scheduled procedure',
    color: 'border-gray-300 hover:border-gray-400',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    description: 'Needs to be done within 24 hours',
    color: 'border-amber-300 hover:border-amber-400',
  },
  {
    value: 'emergency',
    label: 'Emergency',
    description: 'Immediate attention required',
    color: 'border-red-300 hover:border-red-400',
  },
];

const ProcedureForm: React.FC<ProcedureFormProps> = ({
  patientId: initialPatientId,
  encounterId: initialEncounterId,
  admissionId,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(
    initialPatientId || '',
  );
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(
    null,
  );
  const [selectedEncounterId, setSelectedEncounterId] = useState(
    initialEncounterId || '',
  );
  const [selectedProcedure, setSelectedProcedure] =
    useState<ProcedureCatalogue | null>(null);
  const [scheduledTime, setScheduledTime] = useState(''); // UI-only time field
  const [consentObtained, setConsentObtained] = useState(false); // UI-only consent tracking
  const [selectedSurgeonId, setSelectedSurgeonId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<CreateProcedureDTO>>({
    priority: 'routine',
    scheduled_date: new Date().toISOString().split('T')[0],
    indication: '',
    scheduled_duration_minutes: 60,
    location: '',
  });

  const { data: catalogue } = useProcedureCatalogue();
  const { data: searchResults } = useSearchProcedureCatalogue(searchTerm);
  const { data: doctors = [], isLoading: loadingDoctors } = useDoctors();
  const createProcedure = useCreateProcedure();

  // Fetch patient encounters when patient is selected
  const { data: patientEncounters, isLoading: loadingEncounters } =
    usePatientEncounters(selectedPatientId || undefined);

  // Filter to only show active/open encounters
  const activeEncounters =
    patientEncounters?.filter(
      (enc: Encounter) => enc.status === 'Active' || enc.status === 'Created',
    ) || [];

  const displayedProcedures =
    searchTerm.length >= 2 ? searchResults : catalogue;

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async () => {
    if (!selectedPatientId || !selectedProcedure || !selectedEncounterId) {
      console.error(
        'Missing required fields: patient, procedure, or encounter',
      );
      return;
    }

    try {
      // Combine date and time if time is provided
      let scheduledDateTime = formData.scheduled_date!;
      if (scheduledTime) {
        scheduledDateTime = `${formData.scheduled_date}T${scheduledTime}:00`;
      }

      await createProcedure.mutateAsync({
        patient_id: selectedPatientId,
        encounter_id: selectedEncounterId, // Use selected encounter ID
        admission_id: admissionId,
        catalogue_id: selectedProcedure.id,
        procedure_name: selectedProcedure.name,
        procedure_code: selectedProcedure.code || undefined,
        priority: formData.priority!,
        scheduled_date: scheduledDateTime,
        indication: formData.indication!,
        scheduled_duration_minutes: formData.scheduled_duration_minutes,
        location: formData.location,
        primary_surgeon_id: selectedSurgeonId || undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to create procedure:', error);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        // Require both patient AND encounter selection
        return !!selectedPatientId && !!selectedEncounterId;
      case 2:
        return !!selectedProcedure;
      case 3:
        return !!formData.scheduled_date && !!formData.indication;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Schedule Procedure
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            {[
              { num: 1, label: 'Patient' },
              { num: 2, label: 'Procedure' },
              { num: 3, label: 'Schedule' },
              { num: 4, label: 'Confirm' },
            ].map((s, i) => (
              <React.Fragment key={s.num}>
                {i > 0 && <div className="flex-1 h-0.5 bg-gray-200" />}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= s.num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {s.num}
                  </div>
                  <span
                    className={`text-sm ${step >= s.num ? 'text-gray-900' : 'text-gray-500'}`}
                  >
                    {s.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          {/* Step 1: Patient Selection */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Patient by Patient number or Name
                </label>
                <PatientSearchInput
                  value={selectedPatientId}
                  onChange={(patientId, patient) => {
                    setSelectedPatientId(patientId);
                    setSelectedPatient(patient);
                    // Clear encounter when patient changes
                    if (patientId !== selectedPatientId) {
                      setSelectedEncounterId('');
                    }
                  }}
                  selectedPatient={selectedPatient}
                  placeholder="Search by patient number (e.g., NDC-0001), name, or phone..."
                  autoFocus
                />
              </div>

              {selectedPatient && (
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Patient Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Patient number:</span>
                      <span className="ml-2 font-medium">
                        {selectedPatient.emr_number || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Category:</span>
                      <span className="ml-2 font-medium">
                        {selectedPatient.patient_category || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Phone:</span>
                      <span className="ml-2 font-medium">
                        {selectedPatient.contact_phone || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Insurance:</span>
                      <span className="ml-2 font-medium">
                        {selectedPatient.insurance_type || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Encounter Selection - Required for all procedures */}
              {selectedPatient && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Stethoscope className="inline h-4 w-4 mr-1" />
                    Select Active Encounter *
                  </label>
                  {loadingEncounters ? (
                    <div className="text-sm text-gray-500">
                      Loading encounters...
                    </div>
                  ) : activeEncounters.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        No active encounters found for this patient. Please
                        create an encounter first before scheduling a procedure.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {activeEncounters.map((enc: Encounter) => (
                        <button
                          key={enc.id}
                          type="button"
                          onClick={() => setSelectedEncounterId(enc.id)}
                          className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                            selectedEncounterId === enc.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">
                                {enc.visit_type || 'Encounter'} - {enc.status}
                              </p>
                              <p className="text-sm text-gray-500">
                                Created:{' '}
                                {new Date(enc.created_at).toLocaleDateString()}
                              </p>
                              {enc.chief_complaint && (
                                <p className="text-sm text-gray-600 mt-1">
                                  Chief Complaint: {enc.chief_complaint}
                                </p>
                              )}
                            </div>
                            {selectedEncounterId === enc.id && (
                              <CheckCircle className="h-5 w-5 text-blue-500" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Procedure Selection */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Procedure Catalogue
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by procedure name or code..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {displayedProcedures?.map((proc) => (
                  <button
                    key={proc.id}
                    onClick={() => setSelectedProcedure(proc)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      selectedProcedure?.id === proc.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{proc.name}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {proc.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          {proc.code && <span>Code: {proc.code}</span>}
                          {proc.typical_duration_minutes && (
                            <span>
                              Duration: ~{proc.typical_duration_minutes} min
                            </span>
                          )}
                          <span className="capitalize">{proc.category}</span>
                        </div>
                      </div>
                      {proc.requires_consent && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded">
                          Consent Required
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Scheduling Details */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {priorities.map((p) => (
                    <button
                      key={p.value}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, priority: p.value }))
                      }
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.priority === p.value
                          ? p.value === 'emergency'
                            ? 'border-red-500 bg-red-50'
                            : p.value === 'urgent'
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-blue-500 bg-blue-50'
                          : p.color
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {p.value === 'emergency' && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">{p.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {p.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Scheduled Date *
                    </div>
                  </label>
                  <input
                    type="date"
                    name="scheduled_date"
                    value={formData.scheduled_date}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Scheduled Time
                    </div>
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Location and Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Location
                    </div>
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g., OR 1, Procedure Room A"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Estimated Duration (minutes)
                    </div>
                  </label>
                  <input
                    type="number"
                    name="scheduled_duration_minutes"
                    value={formData.scheduled_duration_minutes}
                    onChange={handleInputChange}
                    min="15"
                    step="15"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Primary Surgeon Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    Primary Surgeon / Performing Doctor
                  </div>
                </label>
                <select
                  value={selectedSurgeonId}
                  onChange={(e) => setSelectedSurgeonId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  disabled={loadingDoctors}
                >
                  <option value="">Select a surgeon/doctor...</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      Dr. {doctor.first_name} {doctor.last_name}
                      {doctor.department ? ` - ${doctor.department}` : ''}
                    </option>
                  ))}
                </select>
                {loadingDoctors && (
                  <p className="text-xs text-gray-500 mt-1">
                    Loading doctors...
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Can be assigned later before the procedure
                </p>
              </div>

              {/* Indication */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Indication / Reason *
                </label>
                <textarea
                  name="indication"
                  value={formData.indication}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Clinical indication for this procedure..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  name="pre_procedure_diagnosis"
                  value={formData.pre_procedure_diagnosis || ''}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Any special instructions, preparations, or diagnosis notes..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Consent */}
              {selectedProcedure?.requires_consent && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="consent_obtained"
                    checked={consentObtained}
                    onChange={(e) => setConsentObtained(e.target.checked)}
                    className="h-4 w-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                  />
                  <label
                    htmlFor="consent_obtained"
                    className="text-sm text-amber-700"
                  >
                    <strong>Consent Required:</strong> I confirm that informed
                    consent has been obtained from the patient
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Procedure Summary
                </h3>

                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-lg border">
                    <p className="text-xs text-gray-500 uppercase mb-1">
                      Procedure
                    </p>
                    <p className="font-medium text-gray-900">
                      {selectedProcedure?.name}
                    </p>
                    {selectedProcedure?.code && (
                      <p className="text-sm text-gray-500">
                        Code: {selectedProcedure.code}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Patient ID</p>
                      <p className="font-medium text-gray-900">
                        {selectedPatientId}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Priority</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {formData.priority}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Scheduled Date</p>
                      <p className="font-medium text-gray-900">
                        {formData.scheduled_date
                          ? new Date(
                              formData.scheduled_date,
                            ).toLocaleDateString()
                          : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Scheduled Time</p>
                      <p className="font-medium text-gray-900">
                        {scheduledTime || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium text-gray-900">
                        {formData.location || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Duration</p>
                      <p className="font-medium text-gray-900">
                        {formData.scheduled_duration_minutes} minutes
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">
                        Primary Surgeon / Doctor
                      </p>
                      <p className="font-medium text-gray-900">
                        {selectedSurgeonId
                          ? (() => {
                              const surgeon = doctors.find(
                                (d) => d.id === selectedSurgeonId,
                              );
                              return surgeon
                                ? `Dr. ${surgeon.first_name} ${surgeon.last_name}`
                                : 'Not assigned';
                            })()
                          : 'Not assigned'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-500">Indication</p>
                    <p className="text-gray-900 mt-1">{formData.indication}</p>
                  </div>

                  {consentObtained && (
                    <div className="flex items-center gap-2 text-green-600">
                      <Activity className="h-4 w-4" />
                      <span className="text-sm">Consent obtained</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onCancel())}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createProcedure.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createProcedure.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Schedule Procedure
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcedureForm;
