import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  Heart,
  Thermometer,
  Activity,
  Wind,
  Scale,
  Ruler,
  User,
  Search,
  AlertCircle,
  Clock,
  FileText,
  Droplets,
  Gauge,
} from 'lucide-react';
import { Button } from '../../../components/ui';
import {
  CreateNursingCareDTO,
  CARE_TYPES,
  CareType,
  VitalSignsData,
  validateNursingCareForm,
  NursingCareFormErrors,
  calculateBMI,
  getBMICategory,
  NursingCareDTO,
} from '../dtos/nursing.dto';
import { usePatientSearch } from '../../patient-registration/hooks/usePatient';
import {
  PatientDTO,
  formatPatientName,
  formatDetailedAge,
} from '../../patient-registration/dtos/patient.dto';
import { useDebounce } from '../../../hooks/useDebounce';

// =============================================================================
// Types
// =============================================================================

interface NursingCareFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateNursingCareDTO) => Promise<void>;
  isLoading?: boolean;
  preselectedPatient?: PatientDTO | null;
  visitId?: string | null;
  queueId?: string | null;
  encounterId?: string | null;
  editingRecord?: NursingCareDTO | null;
}

// =============================================================================
// Component
// =============================================================================

export default function NursingCareForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  preselectedPatient,
  visitId,
  queueId,
  encounterId,
  editingRecord,
}: NursingCareFormProps) {
  // Check if we're in edit mode
  const isEditMode = Boolean(editingRecord);

  // State
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(
    null,
  );
  const [errors, setErrors] = useState<NursingCareFormErrors>({});

  // Form data
  const [careType, setCareType] = useState<CareType>('Vital Signs');
  const [notes, setNotes] = useState('');
  const [nextCareTime, setNextCareTime] = useState('');

  // Vital signs
  const [vitalSigns, setVitalSigns] = useState<VitalSignsData>({
    temperature: undefined,
    pulse: undefined,
    blood_pressure_systolic: undefined,
    blood_pressure_diastolic: undefined,
    respiratory_rate: undefined,
    oxygen_saturation: undefined,
    weight: undefined,
    height: undefined,
    blood_glucose: undefined,
    pain_level: undefined,
  });

  // Patient search
  const debouncedSearch = useDebounce(patientSearch, 500);
  const { data: searchResults, isLoading: isSearching } =
    usePatientSearch(debouncedSearch);

  // Reset on open or populate from editing record
  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        // Edit mode - populate from existing record
        if (editingRecord.patient) {
          setSelectedPatient({
            ...editingRecord.patient,
            patient_id: editingRecord.patient_id,
          } as PatientDTO);
        } else if (preselectedPatient) {
          setSelectedPatient(preselectedPatient);
        }
        setCareType((editingRecord.care_type as CareType) || 'Vital Signs');
        setNotes(editingRecord.notes || '');
        setNextCareTime(editingRecord.next_care_time || '');
        setVitalSigns(editingRecord.vital_signs || {});
      } else {
        // Create mode - reset or use preselected patient
        if (preselectedPatient) {
          setSelectedPatient(preselectedPatient);
        } else {
          setSelectedPatient(null);
        }
        setCareType('Vital Signs');
        setNotes('');
        setNextCareTime('');
        setVitalSigns({});
      }
      setErrors({});
    }
  }, [isOpen, preselectedPatient, editingRecord]);

  // Handle vital sign change
  const handleVitalChange = (field: keyof VitalSignsData, value: string) => {
    const numValue = value ? parseFloat(value) : undefined;
    setVitalSigns((prev) => ({ ...prev, [field]: numValue }));
  };

  // Select patient
  const handleSelectPatient = (patient: PatientDTO) => {
    setSelectedPatient(patient);
    setPatientSearch('');
    if (errors.patient_id) {
      setErrors((prev) => ({ ...prev, patient_id: undefined }));
    }
  };

  // Auto-calculate BMI
  const bmi = useMemo(() => {
    return calculateBMI(vitalSigns.weight, vitalSigns.height);
  }, [vitalSigns.weight, vitalSigns.height]);

  const bmiInfo = useMemo(() => getBMICategory(bmi), [bmi]);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData: CreateNursingCareDTO = {
      patient_id: selectedPatient?.patient_id || '',
      visit_id: visitId || undefined,
      queue_id: queueId || undefined,
      encounter_id: encounterId || undefined,
      care_type: careType,
      vital_signs:
        careType === 'Vital Signs'
          ? { ...vitalSigns, bmi: bmi || undefined }
          : undefined,
      notes,
      next_care_time: nextCareTime || undefined,
    };

    const validationErrors = validateNursingCareForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    await onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-2">
        <div
          className="relative bg-gray-50 rounded-lg shadow-2xl w-full max-w-5xl h-[95vh] overflow-hidden flex flex-col border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* EMR Header with NDC Branding */}
          <div className="bg-white border-b border-gray-200 flex-shrink-0">
            {/* Top Bar with Logo and Title */}
            <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-primary-700 to-primary-600">
              <div className="flex items-center gap-4">
                <div className="border-l border-white/30 pl-4">
                  <h1 className="text-white font-bold text-lg tracking-wide">
                    XENOCARE
                  </h1>
                  <p className="text-green-100 text-xs font-medium">
                    Medical Centre - Nursing & Vitals Module
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-4">
                  <p className="text-white text-sm font-medium">
                    {isEditMode ? 'EDIT VITALS' : 'RECORD VITALS'}
                  </p>
                  <p className="text-green-100 text-xs">
                    {new Date().toLocaleDateString('en-NG', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
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
          </div>

          {/* Form Content */}
          <form
            id="nursing-care-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto bg-white"
          >
            <div className="p-6 space-y-6">
              {/* Patient Selection Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                  <div className="p-2 bg-primary-700/10 rounded-lg">
                    <User className="h-5 w-5 text-primary-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Patient Information
                    </h3>
                    <p className="text-xs text-gray-500">
                      Select or search for patient
                    </p>
                  </div>
                </div>

                {selectedPatient ? (
                  <div className="flex items-center justify-between p-4 bg-primary-700/5 rounded-lg border border-primary-700/20">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary-700 flex items-center justify-center text-white font-bold text-lg">
                        {selectedPatient.first_name.charAt(0)}
                        {selectedPatient.surname.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-lg">
                          {formatPatientName(selectedPatient)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {selectedPatient.gender} •{' '}
                          {formatDetailedAge(selectedPatient.date_of_birth)}
                          {selectedPatient.contact_phone &&
                            ` • ${selectedPatient.contact_phone}`}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(null)}
                      className="px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-700/10 rounded-lg transition-colors"
                    >
                      Change Patient
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Search Patient <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-md transition-all text-sm focus:ring-0 focus:border-primary-700 ${
                            errors.patient_id
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          placeholder="Search by name or phone number..."
                        />
                      </div>
                      {errors.patient_id && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{' '}
                          {errors.patient_id}
                        </p>
                      )}
                    </div>
                    {(isSearching ||
                      (searchResults && searchResults.length > 0)) && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {isSearching && (
                          <div className="p-3 text-sm text-gray-500 text-center">
                            Searching...
                          </div>
                        )}
                        {!isSearching &&
                          searchResults?.map((patient) => (
                            <button
                              key={patient.patient_id}
                              type="button"
                              onClick={() => handleSelectPatient(patient)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
                            >
                              <div className="w-10 h-10 rounded-full bg-primary-700/10 flex items-center justify-center text-primary-700 text-sm font-semibold flex-shrink-0">
                                {patient.first_name.charAt(0)}
                                {patient.surname.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {formatPatientName(patient)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {patient.gender} •{' '}
                                  {formatDetailedAge(patient.date_of_birth)} •{' '}
                                  {patient.contact_phone}
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Care Type Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                  <div className="p-2 bg-primary-700/10 rounded-lg">
                    <FileText className="h-5 w-5 text-primary-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Care Type
                    </h3>
                    <p className="text-xs text-gray-500">
                      Select the type of nursing care being recorded
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Type of Care <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={careType}
                    onChange={(e) => setCareType(e.target.value as CareType)}
                    className={`w-full px-3 py-2.5 border-2 rounded-md transition-all text-sm focus:ring-0 focus:border-primary-700 ${
                      errors.care_type
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {CARE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {errors.care_type && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.care_type}
                    </p>
                  )}
                </div>
              </div>

              {/* Vital Signs Section */}
              {careType === 'Vital Signs' && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2 bg-pink-100 rounded-lg">
                      <Activity className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Vital Signs
                      </h3>
                      <p className="text-xs text-gray-500">
                        Record patient vital measurements
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Temperature */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <Thermometer className="inline h-3 w-3 mr-1" />
                        Temperature (°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={vitalSigns.temperature || ''}
                        onChange={(e) =>
                          handleVitalChange('temperature', e.target.value)
                        }
                        className={`w-full px-3 py-2.5 border-2 rounded-md transition-all text-sm focus:ring-0 focus:border-primary-700 ${
                          errors.vital_signs?.temperature
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        placeholder="36.5"
                      />
                      {errors.vital_signs?.temperature && (
                        <p className="text-xs text-red-600">
                          {errors.vital_signs.temperature}
                        </p>
                      )}
                    </div>

                    {/* Pulse */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <Heart className="inline h-3 w-3 mr-1" />
                        Pulse (bpm)
                      </label>
                      <input
                        type="number"
                        value={vitalSigns.pulse || ''}
                        onChange={(e) =>
                          handleVitalChange('pulse', e.target.value)
                        }
                        className={`w-full px-3 py-2.5 border-2 rounded-md transition-all text-sm focus:ring-0 focus:border-primary-700 ${
                          errors.vital_signs?.pulse
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        placeholder="72"
                      />
                      {errors.vital_signs?.pulse && (
                        <p className="text-xs text-red-600">
                          {errors.vital_signs.pulse}
                        </p>
                      )}
                    </div>

                    {/* Respiratory Rate */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <Wind className="inline h-3 w-3 mr-1" />
                        Resp. Rate (/min)
                      </label>
                      <input
                        type="number"
                        value={vitalSigns.respiratory_rate || ''}
                        onChange={(e) =>
                          handleVitalChange('respiratory_rate', e.target.value)
                        }
                        className={`w-full px-3 py-2.5 border-2 rounded-md transition-all text-sm focus:ring-0 focus:border-primary-700 ${
                          errors.vital_signs?.respiratory_rate
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        placeholder="16"
                      />
                      {errors.vital_signs?.respiratory_rate && (
                        <p className="text-xs text-red-600">
                          {errors.vital_signs.respiratory_rate}
                        </p>
                      )}
                    </div>

                    {/* SpO2 */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <Gauge className="inline h-3 w-3 mr-1" />
                        SpO2 (%)
                      </label>
                      <input
                        type="number"
                        value={vitalSigns.oxygen_saturation || ''}
                        onChange={(e) =>
                          handleVitalChange('oxygen_saturation', e.target.value)
                        }
                        className={`w-full px-3 py-2.5 border-2 rounded-md transition-all text-sm focus:ring-0 focus:border-primary-700 ${
                          errors.vital_signs?.oxygen_saturation
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        placeholder="98"
                      />
                      {errors.vital_signs?.oxygen_saturation && (
                        <p className="text-xs text-red-600">
                          {errors.vital_signs.oxygen_saturation}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Blood Pressure Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Blood Pressure (mmHg)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={vitalSigns.blood_pressure_systolic || ''}
                          onChange={(e) =>
                            handleVitalChange(
                              'blood_pressure_systolic',
                              e.target.value,
                            )
                          }
                          className={`flex-1 px-3 py-2.5 border-2 rounded-md transition-all text-sm focus:ring-0 focus:border-primary-700 ${
                            errors.vital_signs?.blood_pressure
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          placeholder="Systolic (120)"
                        />
                        <span className="text-gray-400 font-bold">/</span>
                        <input
                          type="number"
                          value={vitalSigns.blood_pressure_diastolic || ''}
                          onChange={(e) =>
                            handleVitalChange(
                              'blood_pressure_diastolic',
                              e.target.value,
                            )
                          }
                          className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-md hover:border-gray-300 focus:ring-0 focus:border-primary-700 transition-all text-sm"
                          placeholder="Diastolic (80)"
                        />
                      </div>
                      {errors.vital_signs?.blood_pressure && (
                        <p className="text-xs text-red-600">
                          {errors.vital_signs.blood_pressure}
                        </p>
                      )}
                    </div>

                    {/* Pain Level */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Pain Level (0-10)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={vitalSigns.pain_level || ''}
                        onChange={(e) =>
                          handleVitalChange('pain_level', e.target.value)
                        }
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-md hover:border-gray-300 focus:ring-0 focus:border-primary-700 transition-all text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Anthropometric Measurements */}
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-gray-500" />
                      Anthropometric Measurements
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Weight */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={vitalSigns.weight || ''}
                          onChange={(e) =>
                            handleVitalChange('weight', e.target.value)
                          }
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-md hover:border-gray-300 focus:ring-0 focus:border-primary-700 transition-all text-sm"
                          placeholder="70"
                        />
                      </div>

                      {/* Height */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Height (cm)
                        </label>
                        <input
                          type="number"
                          value={vitalSigns.height || ''}
                          onChange={(e) =>
                            handleVitalChange('height', e.target.value)
                          }
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-md hover:border-gray-300 focus:ring-0 focus:border-primary-700 transition-all text-sm"
                          placeholder="170"
                        />
                      </div>

                      {/* BMI (Auto-calculated) */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          BMI (Auto)
                        </label>
                        <div
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-md border-2 ${
                            bmi
                              ? 'bg-gray-50 border-gray-200'
                              : 'bg-gray-100 border-gray-200'
                          }`}
                        >
                          <span className="text-lg font-bold text-gray-900">
                            {bmi ? bmi.toFixed(1) : '--'}
                          </span>
                          {bmi && (
                            <span
                              className={`text-xs font-medium ${bmiInfo.color}`}
                            >
                              {bmiInfo.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Blood Glucose */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          <Droplets className="inline h-3 w-3 mr-1" />
                          Glucose (mg/dL)
                        </label>
                        <input
                          type="number"
                          value={vitalSigns.blood_glucose || ''}
                          onChange={(e) =>
                            handleVitalChange('blood_glucose', e.target.value)
                          }
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-md hover:border-gray-300 focus:ring-0 focus:border-primary-700 transition-all text-sm"
                          placeholder="100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Nursing Notes Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Nursing Notes
                    </h3>
                    <p className="text-xs text-gray-500">
                      Document observations and care provided
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className={`w-full px-3 py-2.5 border-2 rounded-md transition-all text-sm focus:ring-0 focus:border-primary-700 resize-none ${
                        errors.notes
                          ? 'border-red-400 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      placeholder="Document the care provided, observations, and any relevant information..."
                    />
                    {errors.notes && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.notes}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Next Care Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={nextCareTime}
                      onChange={(e) => setNextCareTime(e.target.value)}
                      className="w-full md:w-1/2 px-3 py-2.5 border-2 border-gray-200 rounded-md hover:border-gray-300 focus:ring-0 focus:border-primary-700 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                <span className="text-red-500">*</span> Required fields
              </p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <button
                  type="submit"
                  form="nursing-care-form"
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-700 hover:bg-[#005830] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isEditMode ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {isEditMode ? 'Update Vitals' : 'Save Vitals Record'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
