// =============================================================================
// AeNewArrival — Nigerian A&E Standard: Search patient OR quick-register + Arrival
// Two-path flow: existing patient search, or emergency quick registration
// =============================================================================

import React, { useState } from 'react';
import {
  Search,
  ArrowLeft,
  User,
  Phone,
  Calendar,
  UserPlus,
  Siren,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useDebounce } from '../../../../hooks/useDebounce';
import {
  usePatientSearch,
  useCreatePatient,
} from '../../../patient-registration/hooks/usePatient';
import type {
  PatientDTO,
  CreatePatientDTO,
} from '../../../patient-registration/dtos/patient.dto';
import type { Gender } from '../../../../types';
import ArrivalForm from './ArrivalForm';

interface AeNewArrivalProps {
  onBack: () => void;
  onSuccess: (encounterId: string) => void;
}

type FlowStep = 'choose' | 'search' | 'quick-register' | 'arrival';

export default function AeNewArrival({ onBack, onSuccess }: AeNewArrivalProps) {
  const [step, setStep] = useState<FlowStep>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(
    null,
  );

  // Quick registration state
  const [quickForm, setQuickForm] = useState({
    first_name: '',
    surname: '',
    gender: '' as Gender | '',
    estimated_age: '',
    date_of_birth: '',
    contact_phone: '',
    nok_name: '',
    nok_phone: '',
    nok_relationship: '',
    residential_address: '',
  });
  const [quickErrors, setQuickErrors] = useState<Record<string, string>>({});
  const [registering, setRegistering] = useState(false);
  const [useEstimatedAge, setUseEstimatedAge] = useState(true);

  const debouncedSearch = useDebounce(searchQuery, 400);
  const { data: patients = [], isLoading } = usePatientSearch(debouncedSearch);
  const createPatientMutation = useCreatePatient();

  // Validate quick-register form
  const validateQuickForm = () => {
    const errors: Record<string, string> = {};
    if (!quickForm.first_name.trim())
      errors.first_name = 'First name is required';
    if (!quickForm.surname.trim()) errors.surname = 'Surname is required';
    if (!quickForm.gender) errors.gender = 'Gender is required';
    if (useEstimatedAge && !quickForm.estimated_age) {
      errors.estimated_age = 'Estimated age is required';
    }
    if (!useEstimatedAge && !quickForm.date_of_birth) {
      errors.date_of_birth = 'Date of birth is required';
    }
    setQuickErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Calculate DOB from estimated age
  const dobFromAge = (ageStr: string): string => {
    const age = parseInt(ageStr, 10);
    if (isNaN(age) || age < 0) return '';
    const d = new Date();
    d.setFullYear(d.getFullYear() - age);
    return d.toISOString().split('T')[0];
  };

  // Quick-register and proceed to arrival
  const handleQuickRegister = async () => {
    if (!validateQuickForm()) return;
    setRegistering(true);
    try {
      const dob = useEstimatedAge
        ? dobFromAge(quickForm.estimated_age)
        : quickForm.date_of_birth;

      const newPatient: CreatePatientDTO = {
        first_name: quickForm.first_name.trim(),
        surname: quickForm.surname.trim(),
        gender: quickForm.gender as Gender,
        date_of_birth: dob || undefined,
        contact_phone: quickForm.contact_phone || undefined,
        nok_name: quickForm.nok_name || undefined,
        nok_phone: quickForm.nok_phone || undefined,
        nok_relationship: quickForm.nok_relationship || undefined,
        residential_address: quickForm.residential_address || undefined,
      };

      const created = await createPatientMutation.mutateAsync(newPatient);
      setSelectedPatient(created);
      setStep('arrival');
    } catch (err) {
      console.error('[A&E] Quick registration failed:', err);
      setQuickErrors({ _form: 'Registration failed. Please try again.' });
    } finally {
      setRegistering(false);
    }
  };

  // ── Step: Arrival Form ──────────────────────────────────────────────────
  if (step === 'arrival' && selectedPatient) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              setSelectedPatient(null);
              setStep('choose');
            }}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {/* Patient Banner */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div>
            <span className="font-semibold text-green-800">
              {selectedPatient.first_name} {selectedPatient.surname}
            </span>
            <span className="text-green-600 text-sm ml-2">
              EMR:{' '}
              {(selectedPatient as any).emr_number ||
                selectedPatient.patient_id}
            </span>
          </div>
        </div>

        <ArrivalForm
          patientId={(selectedPatient as any).id || selectedPatient.patient_id}
          patientName={`${selectedPatient.first_name} ${selectedPatient.surname}`}
          onSuccess={onSuccess}
        />
      </div>
    );
  }

  // ── Step: Quick Emergency Registration ──────────────────────────────────
  if (step === 'quick-register') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setStep('choose')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-bold text-red-700">
              Emergency Patient Registration
            </h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Quick registration for unregistered emergency patients. Full details
            can be updated later.
          </p>

          {quickErrors._form && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">{quickErrors._form}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickForm.first_name}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                  placeholder="First name"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-red-500 focus:border-red-500 ${quickErrors.first_name ? 'border-red-400' : 'border-gray-300'}`}
                  autoFocus
                />
                {quickErrors.first_name && (
                  <p className="text-red-500 text-xs mt-1">
                    {quickErrors.first_name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Surname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickForm.surname}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, surname: e.target.value }))
                  }
                  placeholder="Surname"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-red-500 focus:border-red-500 ${quickErrors.surname ? 'border-red-400' : 'border-gray-300'}`}
                />
                {quickErrors.surname && (
                  <p className="text-red-500 text-xs mt-1">
                    {quickErrors.surname}
                  </p>
                )}
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {(['Male', 'Female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setQuickForm((f) => ({ ...f, gender: g }))}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                      quickForm.gender === g
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {quickErrors.gender && (
                <p className="text-red-500 text-xs mt-1">
                  {quickErrors.gender}
                </p>
              )}
            </div>

            {/* Age / DOB Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  {useEstimatedAge ? 'Estimated Age' : 'Date of Birth'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setUseEstimatedAge(!useEstimatedAge)}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  {useEstimatedAge
                    ? 'Enter exact DOB instead'
                    : 'Use estimated age instead'}
                </button>
              </div>
              {useEstimatedAge ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="150"
                    value={quickForm.estimated_age}
                    onChange={(e) =>
                      setQuickForm((f) => ({
                        ...f,
                        estimated_age: e.target.value,
                      }))
                    }
                    placeholder="Age in years"
                    className={`w-32 border rounded-lg px-3 py-2.5 text-sm focus:ring-red-500 focus:border-red-500 ${quickErrors.estimated_age ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  <span className="text-sm text-gray-500">years</span>
                </div>
              ) : (
                <input
                  type="date"
                  value={quickForm.date_of_birth}
                  onChange={(e) =>
                    setQuickForm((f) => ({
                      ...f,
                      date_of_birth: e.target.value,
                    }))
                  }
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-red-500 focus:border-red-500 ${quickErrors.date_of_birth ? 'border-red-400' : 'border-gray-300'}`}
                />
              )}
              {(quickErrors.estimated_age || quickErrors.date_of_birth) && (
                <p className="text-red-500 text-xs mt-1">
                  {quickErrors.estimated_age || quickErrors.date_of_birth}
                </p>
              )}
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={quickForm.contact_phone}
                onChange={(e) =>
                  setQuickForm((f) => ({ ...f, contact_phone: e.target.value }))
                }
                placeholder="e.g. 08012345678"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={quickForm.residential_address}
                onChange={(e) =>
                  setQuickForm((f) => ({
                    ...f,
                    residential_address: e.target.value,
                  }))
                }
                placeholder="Residential address (if known)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Next of Kin — Important for emergency */}
            <div className="border border-orange-200 bg-orange-50/50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Next of Kin / Informant
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={quickForm.nok_name}
                    onChange={(e) =>
                      setQuickForm((f) => ({ ...f, nok_name: e.target.value }))
                    }
                    placeholder="Full name"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={quickForm.nok_phone}
                    onChange={(e) =>
                      setQuickForm((f) => ({ ...f, nok_phone: e.target.value }))
                    }
                    placeholder="Phone number"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Relationship
                  </label>
                  <select
                    value={quickForm.nok_relationship}
                    onChange={(e) =>
                      setQuickForm((f) => ({
                        ...f,
                        nok_relationship: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select...</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Friend">Friend</option>
                    <option value="Colleague">Colleague</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Register Button */}
            <button
              type="button"
              onClick={handleQuickRegister}
              disabled={registering}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {registering ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Registering Patient...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Register & Continue to Arrival
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Search Existing Patient ───────────────────────────────────────
  if (step === 'search') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setStep('choose')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-bold text-red-700 mb-1">
            Find Existing Patient
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Search by name, patient number, or phone number.
          </p>

          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, patient ID, or phone number..."
              className="w-full rounded-lg border-2 border-gray-300 py-3 pl-10 pr-4 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              autoFocus
            />
          </div>

          {/* Results */}
          {isLoading && (
            <div className="py-8 text-center text-gray-400 text-sm">
              Searching...
            </div>
          )}

          {!isLoading && debouncedSearch && patients.length === 0 && (
            <div className="py-8 text-center space-y-3">
              <p className="text-gray-400 text-sm">
                No patients found matching &ldquo;{debouncedSearch}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => {
                  // Pre-fill surname from search
                  const parts = debouncedSearch.trim().split(/\s+/);
                  setQuickForm((f) => ({
                    ...f,
                    first_name: parts[0] || '',
                    surname: parts.slice(1).join(' ') || '',
                  }));
                  setStep('quick-register');
                }}
                className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                <UserPlus className="h-4 w-4" />
                Register as new emergency patient
              </button>
            </div>
          )}

          {patients.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {patients.map((patient: PatientDTO) => (
                <button
                  key={patient.patient_id}
                  type="button"
                  onClick={() => {
                    setSelectedPatient(patient);
                    setStep('arrival');
                  }}
                  className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-red-300 hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                      <User className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {patient.first_name} {patient.surname}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>
                          {(patient as any).emr_number || patient.patient_id}
                        </span>
                        {patient.contact_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {patient.contact_phone}
                          </span>
                        )}
                        {patient.date_of_birth && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {patient.date_of_birth}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-red-600">
                      Select &rarr;
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!debouncedSearch && (
            <div className="py-8 text-center text-gray-400 text-sm">
              Start typing to search for a patient
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Step: Choose Path (default) ─────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>

      {/* Nigerian A&E Workflow Banner */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
        <div className="flex items-start gap-3">
          <Siren className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-red-800">
              A&E Standard Workflow
            </h3>
            <p className="text-xs text-red-600 mt-1">
              Register arrival &rarr; Triage (ESI 1-5) &rarr; Primary Survey
              (ABCDE) &rarr; Consultation &rarr; Orders &amp; Treatment &rarr;
              Disposition
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          New Emergency Arrival
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          How would you like to register this patient?
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Search Existing */}
          <button
            type="button"
            onClick={() => setStep('search')}
            className="group text-left border-2 border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:bg-blue-50/50 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-gray-900">Existing Patient</h3>
            </div>
            <p className="text-sm text-gray-500">
              Search for a patient already registered in the system by name, EMR
              number, or phone.
            </p>
          </button>

          {/* Option 2: Quick Register */}
          <button
            type="button"
            onClick={() => setStep('quick-register')}
            className="group text-left border-2 border-gray-200 rounded-xl p-5 hover:border-red-400 hover:bg-red-50/50 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-red-100 text-red-600 group-hover:bg-red-200 transition-colors">
                <UserPlus className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-gray-900">New Patient</h3>
            </div>
            <p className="text-sm text-gray-500">
              Quick emergency registration for patients not yet in the system.
              Only essential details needed.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
