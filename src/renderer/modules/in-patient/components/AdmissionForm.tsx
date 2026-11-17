// =============================================================================
// XENOCARE EMR - Admission Form Component
// Single-page admission: patient, bed and clinical details in one form.
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useCreateAdmission } from '../hooks/useAdmissions';
import { useBedAvailability } from '../hooks/useBeds';
import { useAuth } from '../../../contexts/AuthContext';
import PatientSearchInput from '../../../components/ui/PatientSearchInput';
import SavedNotesPopover from '../../../components/ui/SavedNotesPopover';
import type { PatientDTO } from '../../patient-registration/dtos/patient.dto';
import type { BedAvailabilityView } from '../../../types/database.types';
import type {
  AdmissionType,
  AdmissionSource,
  AcuityLevel,
  CreateAdmissionDTO,
} from '../../../types/database.types';

interface AdmissionFormProps {
  patientId?: string;
  encounterId?: string;
  initialWardId?: string;
  initialBedId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const admissionTypes: { value: AdmissionType; label: string }[] = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'elective', label: 'Elective' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'observation', label: 'Observation' },
  { value: 'day_case', label: 'Day case' },
];

const admissionSources: { value: AdmissionSource; label: string }[] = [
  { value: 'emergency', label: 'Emergency department' },
  { value: 'outpatient', label: 'Outpatient clinic' },
  { value: 'referral', label: 'External referral' },
  { value: 'transfer', label: 'Transfer from another facility' },
  { value: 'direct', label: 'Direct admission' },
];

const acuityLevels: { value: AcuityLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-[#E9783F] focus:ring-2 focus:ring-[#E9783F]/15';

const labelClass = 'mb-1 block text-xs font-semibold text-slate-600';

const AdmissionForm: React.FC<AdmissionFormProps> = ({
  patientId: initialPatientId,
  encounterId,
  initialWardId,
  initialBedId,
  onSuccess,
  onCancel,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState(
    initialPatientId || '',
  );
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(
    null,
  );
  const [selectedWardId, setSelectedWardId] = useState(initialWardId || '');
  const [selectedBedId, setSelectedBedId] = useState(initialBedId || '');

  const [formData, setFormData] = useState<Partial<CreateAdmissionDTO>>({
    admission_type: 'elective',
    admission_source: 'outpatient',
    acuity_level: 'moderate',
    admitting_diagnosis: '',
    chief_complaint: '',
    reason_for_admission: '',
    isolation_required: false,
  });

  const { staff } = useAuth();
  const createAdmission = useCreateAdmission();
  const { data: beds = [], isLoading: bedsLoading } = useBedAvailability();

  const availableBeds = useMemo(
    () =>
      (beds as BedAvailabilityView[])
        .filter((bed) => String(bed.status).toLowerCase() === 'available')
        .sort((a, b) => {
          const na = Number(a.bed_number.replace(/\D/g, ''));
          const nb = Number(b.bed_number.replace(/\D/g, ''));
          return na - nb;
        }),
    [beds],
  );

  const selectedBed = availableBeds.find(
    (bed) => bed.bed_id === selectedBedId,
  );

  // Preselect a bed when the form is opened from the bed board.
  useEffect(() => {
    if (!initialBedId || selectedBedId) return;
    const bed = (beds as BedAvailabilityView[]).find(
      (item) => item.bed_id === initialBedId,
    );
    if (bed) {
      setSelectedBedId(bed.bed_id);
      setSelectedWardId(bed.ward_id);
    }
  }, [beds, initialBedId, selectedBedId]);

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

  const canSubmit =
    !!selectedPatientId &&
    !!selectedWardId &&
    !!selectedBedId &&
    !!formData.admitting_diagnosis?.trim() &&
    !createAdmission.isPending;

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!canSubmit) return;

    try {
      await createAdmission.mutateAsync({
        patient_id: selectedPatientId,
        encounter_id: encounterId,
        ward_id: selectedWardId,
        bed_id: selectedBedId,
        admission_type: formData.admission_type!,
        admission_source: formData.admission_source,
        admitting_diagnosis: formData.admitting_diagnosis!,
        chief_complaint: formData.chief_complaint,
        reason_for_admission: formData.reason_for_admission,
        acuity_level: formData.acuity_level,
        isolation_required: formData.isolation_required,
        expected_discharge_date: formData.expected_discharge_date,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to create admission:', error);
    }
  };

  const missing = [
    !selectedPatientId && 'patient',
    !selectedBedId && 'bed',
    !formData.admitting_diagnosis?.trim() && 'diagnosis',
  ].filter(Boolean);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col bg-white"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Patient */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-bold text-slate-900">Patient</h3>
            {selectedPatient && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPatientId('');
                  setSelectedPatient(null);
                }}
                className="text-xs font-semibold text-[#B36845] hover:underline"
              >
                Change
              </button>
            )}
          </div>
          {selectedPatient ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[11px] text-slate-500">EMR</dt>
                <dd className="font-semibold text-slate-800">
                  {selectedPatient.emr_number || 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Name</dt>
                <dd className="font-semibold text-slate-800">
                  {[selectedPatient.first_name, selectedPatient.surname]
                    .filter(Boolean)
                    .join(' ')}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Phone</dt>
                <dd className="font-semibold text-slate-800">
                  {selectedPatient.contact_phone || 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Category</dt>
                <dd className="font-semibold text-slate-800">
                  {selectedPatient.patient_category || 'N/A'}
                </dd>
              </div>
            </dl>
          ) : (
            <PatientSearchInput
              value={selectedPatientId}
              onChange={(patientId, patient) => {
                setSelectedPatientId(patientId);
                setSelectedPatient(patient);
              }}
              selectedPatient={selectedPatient}
              placeholder="Search by patient number, name or phone"
              autoFocus
            />
          )}
        </section>

        {/* Bed */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-bold text-slate-900">Bed</h3>
            <span className="text-xs text-slate-500">
              {availableBeds.length} available
            </span>
          </div>

          {bedsLoading ? (
            <p className="rounded-lg border border-slate-200 px-3 py-4 text-sm text-slate-500">
              Loading beds…
            </p>
          ) : availableBeds.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              No beds are available. Free a bed or add one from the bed board.
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-label="Available beds"
              className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-5"
            >
              {availableBeds.map((bed) => {
                const active = bed.bed_id === selectedBedId;
                return (
                  <button
                    key={bed.bed_id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setSelectedBedId(bed.bed_id);
                      setSelectedWardId(bed.ward_id);
                    }}
                    className={`rounded-lg border px-2 py-2 text-center text-sm font-semibold transition-colors ${
                      active
                        ? 'border-[#E9783F] bg-[#FBF1E9] text-[#8A4A2A]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {bed.bed_number}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Clinical details */}
        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-900">
            Clinical details
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="admission_type">
                Admission type
              </label>
              <select
                id="admission_type"
                name="admission_type"
                value={formData.admission_type}
                onChange={handleInputChange}
                className={fieldClass}
              >
                {admissionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="admission_source">
                Admission source
              </label>
              <select
                id="admission_source"
                name="admission_source"
                value={formData.admission_source}
                onChange={handleInputChange}
                className={fieldClass}
              >
                {admissionSources.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <span className={labelClass}>Urgency</span>
              <div
                role="radiogroup"
                aria-label="Urgency"
                className="grid grid-cols-4 gap-2"
              >
                {acuityLevels.map((level) => {
                  const active = formData.acuity_level === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          acuity_level: level.value,
                        }))
                      }
                      className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? 'border-[#E9783F] bg-[#FBF1E9] text-[#8A4A2A]'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label
                  className="text-xs font-semibold text-slate-600"
                  htmlFor="admitting_diagnosis"
                >
                  Admitting diagnosis <span className="text-red-500">*</span>
                </label>
                <SavedNotesPopover
                  category="admission_notes"
                  subcategory="admitting_diagnosis"
                  currentValue={formData.admitting_diagnosis || ''}
                  onInsert={(content) =>
                    setFormData((prev) => ({
                      ...prev,
                      admitting_diagnosis: content,
                    }))
                  }
                />
              </div>
              <textarea
                id="admitting_diagnosis"
                name="admitting_diagnosis"
                value={formData.admitting_diagnosis}
                onChange={handleInputChange}
                rows={2}
                placeholder="Primary diagnosis for admission"
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="chief_complaint">
                Chief complaint
              </label>
              <input
                id="chief_complaint"
                type="text"
                name="chief_complaint"
                value={formData.chief_complaint}
                onChange={handleInputChange}
                placeholder="Main complaint"
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="expected_discharge_date">
                Expected discharge
              </label>
              <input
                id="expected_discharge_date"
                type="date"
                name="expected_discharge_date"
                value={formData.expected_discharge_date || ''}
                onChange={handleInputChange}
                className={fieldClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="reason_for_admission">
                Reason for admission
              </label>
              <textarea
                id="reason_for_admission"
                name="reason_for_admission"
                value={formData.reason_for_admission}
                onChange={handleInputChange}
                rows={2}
                placeholder="Optional context for the ward team"
                className={fieldClass}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                id="isolation_required"
                name="isolation_required"
                checked={formData.isolation_required}
                onChange={handleInputChange}
                className="h-4 w-4 rounded border-slate-300 text-[#E9783F] focus:ring-[#E9783F]"
              />
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Isolation required
            </label>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
        <p className="text-xs text-slate-500">
          {missing.length > 0
            ? `Select ${missing.join(', ')} to continue`
            : selectedBed
              ? `${selectedBed.bed_number} · ${selectedBed.ward_name}`
              : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-[#E9783F] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#D96A36] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createAdmission.isPending ? 'Admitting…' : 'Admit patient'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default AdmissionForm;
