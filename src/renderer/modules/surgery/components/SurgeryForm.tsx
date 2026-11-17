/**
 * Surgery Form Component
 * Form for creating and editing surgeries
 */

import React, { useState, useEffect } from 'react';
import { isNhisFeatureEnabled } from '../../../config/features';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Calendar,
  Clock,
  User,
  FileText,
  AlertCircle,
  Loader2,
  Search,
} from 'lucide-react';
import { useSurgeries, useTheatreRooms } from '../hooks/useSurgery';
import {
  SurgeryFormData,
  TheatreRoom,
  SurgeryPriority,
} from '../types/surgery.types';
import { supabase } from '../../../api/supabaseClient';
import { sanitizeFilterValue } from '../../../lib/filterSanitizer';
import SavedNotesPopover from '../../../components/ui/SavedNotesPopover';
import TemplateSearchPopover from '../../../components/ui/TemplateSearchPopover';

interface PatientSearchResult {
  id: string;
  first_name: string;
  surname: string;
  emr_number: string;
  insurance_type?: string;
  hasActiveEncounter?: boolean;
}

interface StaffSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  specialization?: string;
}

interface PatientContext {
  patientId: string;
  encounterId: string;
  admissionId?: string;
}

interface EncounterOption {
  id: string;
  start_time: string;
  visit_type?: string;
  status: string;
}

const SurgeryForm: React.FC = () => {
  const navigate = useNavigate();
  const { surgeryId } = useParams<{ surgeryId: string }>();
  const isEditing = !!surgeryId;

  const { createSurgery, getSurgeryById, loading } = useSurgeries();
  const { listTheatreRooms } = useTheatreRooms();

  const [theatreRooms, setTheatreRooms] = useState<TheatreRoom[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patient context (separate from form data)
  const [patientContext, setPatientContext] = useState<PatientContext | null>(
    null,
  );

  // Encounter selection state
  const [availableEncounters, setAvailableEncounters] = useState<
    EncounterOption[]
  >([]);
  const [showEncounterSelection, setShowEncounterSelection] = useState(false);

  // Patient search state
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>(
    [],
  );
  const [selectedPatient, setSelectedPatient] =
    useState<PatientSearchResult | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Surgeon search state
  const [surgeonSearch, setSurgeonSearch] = useState('');
  const [surgeonResults, setSurgeonResults] = useState<StaffSearchResult[]>([]);
  const [selectedSurgeon, setSelectedSurgeon] =
    useState<StaffSearchResult | null>(null);
  const [showSurgeonDropdown, setShowSurgeonDropdown] = useState(false);

  // Form data
  const [formData, setFormData] = useState<Partial<SurgeryFormData>>({
    priority: 'Routine',
    requires_nhis_approval: false,
    primary_procedure: '',
    indication: '',
    primary_surgeon_id: '',
  });

  useEffect(() => {
    loadTheatreRooms();
    if (isEditing) {
      loadSurgery();
    }
  }, [surgeryId]);

  const loadTheatreRooms = async () => {
    const rooms = await listTheatreRooms(true);
    setTheatreRooms(rooms);
  };

  const loadSurgery = async () => {
    if (!surgeryId) return;
    const surgery = await getSurgeryById(surgeryId);
    if (surgery) {
      setPatientContext({
        patientId: surgery.patient_id,
        encounterId: surgery.encounter_id,
        admissionId: surgery.admission_id || undefined,
      });
      setFormData({
        primary_procedure: surgery.primary_procedure,
        scheduled_date: surgery.scheduled_date || undefined,
        scheduled_time: surgery.scheduled_time || undefined,
        theatre_room_id: surgery.theatre_room_id || undefined,
        priority: surgery.priority,
        indication: surgery.indication,
        pre_op_diagnosis: surgery.pre_op_diagnosis || undefined,
        primary_surgeon_id: surgery.primary_surgeon_id,
        anesthetist_id: surgery.anesthetist_id || undefined,
        requires_nhis_approval: surgery.requires_nhis_approval,
      });
    }
  };

  // Patient search
  useEffect(() => {
    if (patientSearch.length >= 2) {
      searchPatients(patientSearch);
    } else {
      setPatientResults([]);
    }
  }, [patientSearch]);

  const searchPatients = async (query: string) => {
    const { data } = await supabase
      .from('patients')
      .select(
        `
        id, first_name, surname, emr_number, insurance_type,
        visits(id, status)
      `,
      )
      .or(
        `first_name.ilike.%${sanitizeFilterValue(query)}%,surname.ilike.%${sanitizeFilterValue(query)}%,emr_number.ilike.%${sanitizeFilterValue(query)}%`,
      )
      .limit(10);

    // Filter patients to show if they have an active encounter
    const results = (data || []).map((p: any) => {
      // Check for active visit
      const activeVisit = Array.isArray(p.visits)
        ? p.visits.find((v: any) => v.status === 'Active')
        : p.visits?.status === 'Active'
          ? p.visits
          : null;

      return {
        id: p.id,
        first_name: p.first_name,
        surname: p.surname,
        emr_number: p.emr_number,
        insurance_type: p.insurance_type,
        hasActiveEncounter: !!activeVisit,
      };
    });

    setPatientResults(results);
    setShowPatientDropdown(true);
  };

  // Surgeon search
  useEffect(() => {
    if (surgeonSearch.length >= 2) {
      searchSurgeons(surgeonSearch);
    } else {
      setSurgeonResults([]);
    }
  }, [surgeonSearch]);

  const searchSurgeons = async (query: string) => {
    // Note: 'specialization' may not exist in your schema or is named differently.
    // If getting 400 Bad Request, ensure all selected columns exist in 'staff'.
    // Adjust logic accordingly. Here, I'm removing it temporarily if it's the culprit,
    // or you can check if it's actually 'department' or similar if specialization is missing.
    const { data } = await supabase
      .from('staff')
      .select('id, first_name, last_name, role')
      .eq('role', 'doctor')
      .or(
        `first_name.ilike.%${sanitizeFilterValue(query)}%,last_name.ilike.%${sanitizeFilterValue(query)}%`,
      )
      .limit(10);
    setSurgeonResults(data || []);
    setShowSurgeonDropdown(true);
  };

  const handlePatientSelect = async (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setPatientSearch(
      `${patient.first_name} ${patient.surname} (${patient.emr_number})`,
    );
    setShowPatientDropdown(false);
    setFormData((prev) => ({
      ...prev,
      requires_nhis_approval:
        isNhisFeatureEnabled() && patient.insurance_type === 'nhis',
    }));

    // Reset previous selection
    setPatientContext(null);
    setAvailableEncounters([]);
    setShowEncounterSelection(false);

    // Get all active or ongoing encounters for patient
    // We broaden the search to include any visit that isn't clearly finished
    const { data: encounters } = await supabase
      .from('visits')
      .select('id, start_time, visit_type, status')
      .eq('patient_id', patient.id)
      .eq('status', 'Active')
      .order('start_time', { ascending: false });

    if (encounters && encounters.length > 0) {
      // Always allow user to see/select encounter if they want,
      // but if there's only one, we can either auto-select or just show it.
      // User request: "admin should be able to select an encounter"
      // Let's show the selection if > 0 so they confirm which one.
      // But for better UX, if count == 1, maybe pre-select but show the UI?

      setAvailableEncounters(encounters);
      setShowEncounterSelection(true);

      // If only one, pre-select it effectively
      if (encounters.length === 1) {
        handleEncounterSelect(patient.id, encounters[0]);
      }
    } else {
      setError('Patient must have an active encounter to schedule surgery');
    }
  };

  const handleEncounterSelect = async (
    patientId: string,
    encounter: EncounterOption,
  ) => {
    // Check for active admission linked to this encounter or patient
    const { data: admission } = await supabase
      .from('admissions')
      .select('id')
      .eq('patient_id', patientId)
      .eq('status', 'Active')
      .limit(1)
      .single();

    setPatientContext({
      patientId,
      encounterId: encounter.id,
      admissionId: admission?.id,
    });

    // Hide selection after picking (but keep it available? No, once picked it's set)
    // We can show the selected encounter in the UI.
    setShowEncounterSelection(false);
    setError(null);
  };

  const handleSurgeonSelect = (surgeon: StaffSearchResult) => {
    setSelectedSurgeon(surgeon);
    setSurgeonSearch(`Dr. ${surgeon.first_name} ${surgeon.last_name}`);
    setShowSurgeonDropdown(false);
    setFormData((prev) => ({ ...prev, primary_surgeon_id: surgeon.id }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!patientContext) {
      setError('Please select a patient with an active encounter');
      return;
    }
    if (!formData.primary_procedure) {
      setError('Primary procedure is required');
      return;
    }
    if (!formData.indication) {
      setError('Indication is required');
      return;
    }
    if (!formData.primary_surgeon_id) {
      setError('Please select a surgeon');
      return;
    }

    setSaving(true);
    try {
      const result = await createSurgery(
        patientContext.encounterId,
        patientContext.patientId,
        formData as SurgeryFormData,
        patientContext.admissionId,
      );
      if (result) {
        navigate(`/surgery/${result.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create surgery');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof SurgeryFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/surgery')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Surgery' : 'New Surgery'}
          </h1>
          <p className="text-sm text-gray-500">
            {isEditing ? 'Update surgery details' : 'Schedule a new surgery'}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-500" />
            Patient Information
          </h2>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Patient *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                onFocus={() =>
                  patientResults.length > 0 && setShowPatientDropdown(true)
                }
                placeholder="Search by name or patient number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {showPatientDropdown && patientResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {patientResults.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => handlePatientSelect(patient)}
                    className="w-full px-4 py-2 text-left border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {patient.first_name} {patient.surname}
                        </p>
                        <p className="text-sm text-gray-500">
                          {patient.emr_number} •{' '}
                          {patient.insurance_type || 'Private'}
                        </p>
                      </div>
                      {!patient.hasActiveEncounter && (
                        <span className="text-xs text-amber-500 font-medium bg-amber-50 px-2 py-1 rounded">
                          No Active Encounter
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPatient && (
            <div className="mt-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>
                    {selectedPatient.first_name} {selectedPatient.surname}
                  </strong>
                  {selectedPatient.insurance_type &&
                    ` • ${selectedPatient.insurance_type}`}
                </p>
                {patientContext && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Encounter Linked
                  </p>
                )}
              </div>

              {/* Encounter Selection */}
              {(showEncounterSelection ||
                (availableEncounters.length > 0 && !patientContext)) && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Select Active Encounter
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                    {availableEncounters.map((encounter) => (
                      <button
                        key={encounter.id}
                        type="button"
                        onClick={() =>
                          handleEncounterSelect(selectedPatient.id, encounter)
                        }
                        className={`w-full text-left p-3 border rounded-lg transition-colors flex justify-between items-center group ${
                          patientContext?.encounterId === encounter.id
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-sm text-gray-900">
                            {encounter.visit_type || 'General Visit'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Check-in:{' '}
                            {new Date(encounter.start_time).toLocaleString()}
                          </p>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              encounter.status === 'Active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {encounter.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                            patientContext?.encounterId === encounter.id
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {patientContext?.encounterId === encounter.id && (
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {availableEncounters.length > 1 && !patientContext && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Please select an encounter to proceed.
                    </p>
                  )}
                </div>
              )}

              {/* Change Encounter Button */}
              {patientContext && availableEncounters.length > 1 && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setPatientContext(null);
                      setShowEncounterSelection(true);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Change Encounter
                  </button>
                </div>
              )}
            </div>
          )}

          {isNhisFeatureEnabled() &&
            selectedPatient &&
            formData.requires_nhis_approval && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                ⚠️ This patient has NHIS insurance. Surgery will require NHIS
                authorization.
              </p>
            </div>
          )}
        </div>

        {/* Procedure Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" />
            Procedure Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Procedure *
              </label>
              <input
                type="text"
                value={formData.primary_procedure || ''}
                onChange={(e) =>
                  updateField('primary_procedure', e.target.value)
                }
                placeholder="e.g., Laparoscopic Cholecystectomy"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex justify-end mb-2">
                <TemplateSearchPopover
                  templateType="surgery"
                  category="surgery_notes"
                  currentValues={{ indication: formData.indication ?? '' }}
                  onTemplateSelect={(data) => {
                    if (data.indication) updateField('indication', data.indication);
                    if (data.preop_history) updateField('indication', data.preop_history);
                  }}
                  buttonText="Fill All Fields"
                />
              </div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Indication / Reason for Surgery *
                </label>
                <SavedNotesPopover
                  category="surgery_notes"
                  subcategory="indication"
                  currentValue={formData.indication || ''}
                  onInsert={(content) => updateField('indication', content)}
                />
              </div>
              <textarea
                value={formData.indication || ''}
                onChange={(e) => updateField('indication', e.target.value)}
                placeholder="Clinical indication for the surgery..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pre-Operative Diagnosis
              </label>
              <input
                type="text"
                value={formData.pre_op_diagnosis || ''}
                onChange={(e) =>
                  updateField('pre_op_diagnosis', e.target.value)
                }
                placeholder="Pre-operative diagnosis"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority *
              </label>
              <select
                value={formData.priority || 'Routine'}
                onChange={(e) =>
                  updateField('priority', e.target.value as SurgeryPriority)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Emergency">Emergency</option>
                <option value="Urgent">Urgent</option>
                <option value="Routine">Routine</option>
                <option value="Elective">Elective</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Laterality
              </label>
              <select
                value={formData.laterality || ''}
                onChange={(e) => updateField('laterality', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">N/A</option>
                <option value="Left">Left</option>
                <option value="Right">Right</option>
                <option value="Bilateral">Bilateral</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scheduling */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            Scheduling
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Date
              </label>
              <input
                type="date"
                value={formData.scheduled_date || ''}
                onChange={(e) => updateField('scheduled_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Time
              </label>
              <input
                type="time"
                value={formData.scheduled_time || ''}
                onChange={(e) => updateField('scheduled_time', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Theatre Room
              </label>
              <select
                value={formData.theatre_room_id || ''}
                onChange={(e) => updateField('theatre_room_id', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select theatre room</option>
                {theatreRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_code} - {room.room_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Surgical Team */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-500" />
            Surgical Team
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Surgeon *
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={surgeonSearch}
                  onChange={(e) => setSurgeonSearch(e.target.value)}
                  onFocus={() =>
                    surgeonResults.length > 0 && setShowSurgeonDropdown(true)
                  }
                  placeholder="Search surgeon..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {showSurgeonDropdown && surgeonResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {surgeonResults.map((surgeon) => (
                    <button
                      key={surgeon.id}
                      type="button"
                      onClick={() => handleSurgeonSelect(surgeon)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="font-medium text-gray-900">
                        Dr. {surgeon.first_name} {surgeon.last_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {surgeon.specialization || 'General'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/surgery')}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEditing ? 'Update Surgery' : 'Create Surgery'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SurgeryForm;
