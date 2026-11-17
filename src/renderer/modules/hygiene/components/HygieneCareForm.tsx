/**
 * Hygiene Care Form Component
 * Form for documenting hygiene care activities
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  User,
  Droplets,
  AlertCircle,
  Loader2,
  Search,
  Clock,
  CheckCircle,
} from 'lucide-react';
import {
  useHygieneCareRecords,
  useHygieneActivityCatalogue,
} from '../hooks/useHygiene';
import {
  HygieneActivityCatalogue,
  HygieneCareRecordFormData,
  HygieneActivityCategory,
  PatientTolerance,
  HygieneStatus,
  MissedCareReason,
  Shift,
  getShiftFromTime,
  getHygieneCategoryLabel,
} from '../types/hygiene.types';
import { supabase } from '../../../api/supabaseClient';
import { sanitizeFilterValue } from '../../../lib/filterSanitizer';
import { useAuth } from '../../../contexts/AuthContext';
import SavedNotesPopover from '../../../components/ui/SavedNotesPopover';
import TemplateSearchPopover from '../../../components/ui/TemplateSearchPopover';

interface PatientSearchResult {
  id: string;
  first_name: string;
  surname: string;
  emr_number: string;
  ward_name?: string;
  bed_number?: string;
  admission_id?: string;
  encounter_id?: string;
  ward_id?: string;
  bed_id?: string;
}

interface PatientContext {
  patientId: string;
  encounterId: string;
  admissionId?: string;
  wardId?: string;
  bedId?: string;
}

const HygieneCareForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { staff } = useAuth();

  const { createRecord, loading } = useHygieneCareRecords();
  const { listActivities } = useHygieneActivityCatalogue();

  const [activities, setActivities] = useState<HygieneActivityCatalogue[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Patient context (separate from form data)
  const [patientContext, setPatientContext] = useState<PatientContext | null>(
    null,
  );

  // Patient search state
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>(
    [],
  );
  const [selectedPatient, setSelectedPatient] =
    useState<PatientSearchResult | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Form data
  const [formData, setFormData] = useState<Partial<HygieneCareRecordFormData>>({
    status: 'Completed',
    patient_tolerance: 'Good',
    shift: getShiftFromTime(),
    activity_category: 'BATH',
    activity_code: '',
    activity_name: '',
  });

  const [selectedCategory, setSelectedCategory] = useState<
    HygieneActivityCategory | ''
  >('');

  useEffect(() => {
    loadActivities();

    // Check if patient ID is in URL params
    const patientId = searchParams.get('patientId');
    if (patientId) {
      loadPatientById(patientId);
    }
  }, []);

  const loadActivities = async () => {
    const data = await listActivities();
    setActivities(data);
  };

  const loadPatientById = async (patientId: string) => {
    const { data } = await supabase
      .from('patients')
      .select(
        `
        id, first_name, surname, emr_number,
        admissions!inner(id, current_ward_id, current_bed_id, admission_status,
          wards:wards!admissions_current_ward_id_fkey(name),
          beds:beds!admissions_current_bed_id_fkey(bed_number)
        ),
        visits!inner(id, status)
      `,
      )
      .eq('id', patientId)
      .eq('admissions.admission_status', 'admitted')
      .eq('visits.status', 'Active')
      .single();

    if (data) {
      const admission = Array.isArray(data.admissions)
        ? data.admissions[0]
        : data.admissions;
      const visit = Array.isArray(data.visits) ? data.visits[0] : data.visits;
      const ward = admission?.wards
        ? Array.isArray(admission.wards)
          ? admission.wards[0]
          : admission.wards
        : null;
      const bed = admission?.beds
        ? Array.isArray(admission.beds)
          ? admission.beds[0]
          : admission.beds
        : null;

      const patient: PatientSearchResult = {
        id: data.id,
        first_name: data.first_name,
        surname: data.surname,
        emr_number: data.emr_number,
        ward_name: ward?.name,
        bed_number: bed?.bed_number,
        admission_id: admission?.id,
        encounter_id: visit?.id,
        ward_id: admission?.current_ward_id,
        bed_id: admission?.current_bed_id,
      };
      handlePatientSelect(patient);
    }
  };

  // Patient search - focus on admitted patients
  useEffect(() => {
    if (patientSearch.length >= 2) {
      searchPatients(patientSearch);
    } else {
      setPatientResults([]);
    }
  }, [patientSearch]);

  const searchPatients = async (query: string) => {
    // Search for admitted patients
    const { data, error } = await supabase
      .from('patients')
      .select(
        `
        id, first_name, surname, emr_number,
        admissions(id, current_ward_id, current_bed_id, admission_status,
          wards:wards!admissions_current_ward_id_fkey(name),
          beds:beds!admissions_current_bed_id_fkey(bed_number)
        ),
        visits(id, status)
      `,
      )
      .or(
        `first_name.ilike.%${sanitizeFilterValue(query)}%,surname.ilike.%${sanitizeFilterValue(query)}%,emr_number.ilike.%${sanitizeFilterValue(query)}%`,
      )
      .limit(10);

    if (error) {
      console.error('Error searching patients:', error);
      setPatientResults([]);
      setShowPatientDropdown(true);
      return;
    }

    const results: PatientSearchResult[] = (data || [])
      .map((p: any) => {
        // Check for active admission using admission_status = 'admitted'
        const admission = Array.isArray(p.admissions)
          ? p.admissions.find((a: any) => a.admission_status === 'admitted')
          : p.admissions?.admission_status === 'admitted'
            ? p.admissions
            : null;
        const visit = Array.isArray(p.visits)
          ? p.visits.find((v: any) => v.status === 'Active')
          : p.visits?.status === 'Active'
            ? p.visits
            : null;
        const ward = admission?.wards
          ? Array.isArray(admission.wards)
            ? admission.wards[0]
            : admission.wards
          : null;
        const bed = admission?.beds
          ? Array.isArray(admission.beds)
            ? admission.beds[0]
            : admission.beds
          : null;

        return {
          id: p.id,
          first_name: p.first_name,
          surname: p.surname,
          emr_number: p.emr_number,
          ward_name: ward?.name,
          bed_number: bed?.bed_number,
          admission_id: admission?.id,
          encounter_id: visit?.id,
          ward_id: admission?.current_ward_id,
          bed_id: admission?.current_bed_id,
        };
      })
      // Only return patients who are currently admitted
      .filter((p: PatientSearchResult) => p.admission_id);

    setPatientResults(results);
    setShowPatientDropdown(true);
  };

  const handlePatientSelect = (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setPatientSearch(
      `${patient.first_name} ${patient.surname} (${patient.emr_number})`,
    );
    setShowPatientDropdown(false);

    if (patient.encounter_id) {
      setPatientContext({
        patientId: patient.id,
        encounterId: patient.encounter_id,
        admissionId: patient.admission_id,
        wardId: patient.ward_id,
        bedId: patient.bed_id,
      });
    } else {
      setPatientContext(null);
      setError('Patient must have an active encounter');
    }
  };

  const handleActivitySelect = (activity: HygieneActivityCatalogue) => {
    setFormData((prev) => ({
      ...prev,
      activity_catalogue_id: activity.id,
      activity_category: activity.category,
      activity_code: activity.activity_code,
      activity_name: activity.activity_name,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!patientContext) {
      setError('Please select a patient with an active encounter');
      return;
    }
    if (!formData.activity_code) {
      setError('Please select an activity');
      return;
    }
    if (formData.status === 'Missed' && !formData.missed_reason) {
      setError('Please select a reason for missed care');
      return;
    }

    setSaving(true);
    try {
      const result = await createRecord(
        patientContext.encounterId,
        patientContext.patientId,
        formData as HygieneCareRecordFormData,
        patientContext.admissionId,
        patientContext.wardId,
        patientContext.bedId,
      );
      if (result) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/hygiene');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save care record');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof HygieneCareRecordFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Filter activities by category
  const filteredActivities = selectedCategory
    ? activities.filter((a) => a.category === selectedCategory)
    : activities;

  // Get unique categories
  const categories = [...new Set(activities.map((a) => a.category))];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/hygiene')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Document Hygiene Care
          </h1>
          <p className="text-sm text-gray-500">
            Record hygiene and infection control activities
          </p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <p className="text-sm text-green-700">
            Care record saved successfully!
          </p>
        </div>
      )}

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
              Search Patient (Admitted) *
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
                          {patient.emr_number}
                          {patient.ward_name && ` • ${patient.ward_name}`}
                          {patient.bed_number && ` • Bed ${patient.bed_number}`}
                        </p>
                      </div>
                      {!patient.encounter_id && (
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
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>
                  {selectedPatient.first_name} {selectedPatient.surname}
                </strong>
                {selectedPatient.ward_name && ` • ${selectedPatient.ward_name}`}
                {selectedPatient.bed_number &&
                  ` • Bed ${selectedPatient.bed_number}`}
              </p>
            </div>
          )}
        </div>

        {/* Activity Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Droplets className="h-5 w-5 text-gray-500" />
            Care Activity
          </h2>

          {/* Category Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Category
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('')}
                className={`px-3 py-1.5 text-sm rounded-full ${
                  selectedCategory === ''
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-sm rounded-full ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getHygieneCategoryLabel(cat)}
                </button>
              ))}
            </div>
          </div>

          {/* Activity List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            {filteredActivities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                onClick={() => handleActivitySelect(activity)}
                className={`p-3 text-left rounded-lg border transition ${
                  formData.activity_code === activity.activity_code
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-sm text-gray-900">
                  {activity.activity_name}
                </p>
                <p className="text-xs text-gray-500">
                  {getHygieneCategoryLabel(activity.category)} •{' '}
                  {activity.activity_code}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Care Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            Care Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                value={formData.status || 'Completed'}
                onChange={(e) =>
                  updateField('status', e.target.value as HygieneStatus)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Completed">Completed</option>
                <option value="Refused">Patient Refused</option>
                <option value="Missed">Missed</option>
                <option value="Deferred">Deferred</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Tolerance
              </label>
              <select
                value={formData.patient_tolerance || 'Good'}
                onChange={(e) =>
                  updateField(
                    'patient_tolerance',
                    e.target.value as PatientTolerance,
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Unable_To_Assess">Unable to Assess</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shift
              </label>
              <select
                value={formData.shift || getShiftFromTime()}
                onChange={(e) => updateField('shift', e.target.value as Shift)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Night">Night</option>
              </select>
            </div>

            {formData.status === 'Missed' && (
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Missed Care *
                </label>
                <select
                  value={formData.missed_reason || ''}
                  onChange={(e) =>
                    updateField(
                      'missed_reason',
                      e.target.value as MissedCareReason,
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select reason...</option>
                  <option value="Patient_Refused">Patient Refused</option>
                  <option value="Patient_Unstable">Patient Unstable</option>
                  <option value="Off_Ward">Patient Off Ward</option>
                  <option value="Staffing">Staffing Issues</option>
                  <option value="Emergency">Emergency Situation</option>
                  <option value="Equipment_Issue">Equipment Issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}

            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Findings / Observations
                </label>
                <div className="flex items-center gap-1">
                  <TemplateSearchPopover
                    templateType="nursing"
                    category="hygiene_notes"
                    currentValues={{
                      findings: formData.findings || '',
                      notes: formData.notes || '',
                    }}
                    onTemplateSelect={(data) => {
                      if (data.findings) updateField('findings', data.findings);
                      if (data.notes) updateField('notes', data.notes);
                    }}
                    buttonText="Fill All Fields"
                  />
                  <SavedNotesPopover
                    category="nursing_notes"
                    subcategory="hygiene_findings"
                    currentValue={formData.findings || ''}
                    onInsert={(content) => updateField('findings', content)}
                  />
                </div>
              </div>
              <textarea
                value={formData.findings || ''}
                onChange={(e) => updateField('findings', e.target.value)}
                placeholder="Document any findings or observations..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <SavedNotesPopover
                  category="nursing_notes"
                  subcategory="hygiene_notes"
                  currentValue={formData.notes || ''}
                  onInsert={(content) => updateField('notes', content)}
                />
              </div>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requires_follow_up || false}
                  onChange={(e) =>
                    updateField('requires_follow_up', e.target.checked)
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Requires follow-up
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/hygiene')}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading || success}
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
                Save Care Record
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default HygieneCareForm;
