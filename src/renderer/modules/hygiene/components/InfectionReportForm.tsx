/**
 * Infection Report Form Component
 * Form for reporting new healthcare-associated infections
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  User,
  Shield,
  AlertCircle,
  Loader2,
  Search,
  Calendar,
  Microscope,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useInfectionSurveillance } from '../hooks/useHygiene';
import {
  InfectionSurveillanceFormData,
  InfectionType,
  InfectionSeverity,
  InfectionOutcome,
  getInfectionTypeLabel,
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

const InfectionReportForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { staff } = useAuth();

  const { createRecord } = useInfectionSurveillance();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Patient search state
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>(
    [],
  );
  const [selectedPatient, setSelectedPatient] =
    useState<PatientSearchResult | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Form data
  const [formData, setFormData] = useState<
    Partial<InfectionSurveillanceFormData>
  >({
    infection_type: 'SSI',
    detected_date: new Date().toISOString().split('T')[0],
    device_related: false,
    severity: 'Moderate',
  });

  useEffect(() => {
    // Check if patient ID is in URL params
    const patientId = searchParams.get('patientId');
    if (patientId) {
      loadPatientById(patientId);
    }
  }, []);

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
    if (patientSearch.length >= 2 && !selectedPatient) {
      searchPatients(patientSearch);
    } else {
      setPatientResults([]);
    }
  }, [patientSearch, selectedPatient]);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setError('Please select a patient');
      return;
    }

    if (!staff) {
      setError('You must be logged in to report an infection');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const infectionData: InfectionSurveillanceFormData = {
        infection_type: formData.infection_type as InfectionType,
        detected_date: formData.detected_date!,
        severity: formData.severity,
        device_related: formData.device_related,
        symptoms: formData.symptoms,
        culture_results: formData.culture_results,
        organism: formData.organism,
        treatment_notes: formData.treatment_notes,
        treatment_initiated: formData.treatment_initiated,
      };

      const result = await createRecord(
        selectedPatient.encounter_id!,
        selectedPatient.id,
        infectionData,
        selectedPatient.admission_id,
      );

      if (result) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/hygiene/infections');
        }, 1500);
      } else {
        throw new Error('Failed to report infection');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const infectionTypes: InfectionType[] = [
    'SSI',
    'CAUTI',
    'CLABSI',
    'VAP',
    'CDI',
    'MRSA',
    'Other_HAI',
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Report Infection
            </h1>
            <p className="text-sm text-gray-500">New HAI Surveillance Record</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-700">
                <Shield className="h-5 w-5" />
                Infection reported successfully. Redirecting...
              </div>
            )}

            {/* Patient Selection */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-gray-500" />
                Patient Details
              </h2>

              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Patient
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Search by name or patient number..."
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        if (selectedPatient) setSelectedPatient(null);
                      }}
                    />
                  </div>

                  {/* Dropdown results */}
                  {showPatientDropdown && patientResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {patientResults.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          onClick={() => handlePatientSelect(patient)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">
                                {patient.first_name} {patient.surname}
                              </p>
                              <p className="text-xs text-gray-500">
                                {patient.emr_number}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium text-blue-600">
                                {patient.ward_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                Bed {patient.bed_number}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedPatient && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-blue-600 uppercase font-semibold">
                        Ward Location
                      </p>
                      <p className="text-sm font-medium text-blue-900">
                        {selectedPatient.ward_name} • Bed{' '}
                        {selectedPatient.bed_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 uppercase font-semibold">
                        Admission Status
                      </p>
                      <p className="text-sm font-medium text-blue-900">
                        Active Admission
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Infection Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-gray-500" />
                Infection Data
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Infection Type
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                    value={formData.infection_type || 'SSI'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        infection_type: e.target.value as InfectionType,
                      })
                    }
                  >
                    {infectionTypes.map((type) => (
                      <option key={type} value={type}>
                        {getInfectionTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Detected
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                      value={formData.detected_date || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          detected_date: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Severity
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                    value={formData.severity || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        severity: e.target.value as InfectionSeverity,
                      })
                    }
                  >
                    <option value="Mild">Mild</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Severe">Severe</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <input
                    type="checkbox"
                    id="device_related"
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    checked={formData.device_related}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        device_related: e.target.checked,
                      })
                    }
                  />
                  <label
                    htmlFor="device_related"
                    className="text-sm font-medium text-gray-700"
                  >
                    Device Related (e.g., Catheter, Ventilator)
                  </label>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Symptoms & Signs
                  </label>
                  <div className="flex items-center gap-1">
                    <TemplateSearchPopover
                      templateType="nursing"
                      category="infection_notes"
                      currentValues={{
                        symptoms: formData.symptoms || '',
                        treatment_notes: formData.treatment_notes || '',
                      }}
                      onTemplateSelect={(data) => {
                        if (data.symptoms) setFormData({ ...formData, symptoms: data.symptoms });
                        if (data.treatment_notes) setFormData({ ...formData, treatment_notes: data.treatment_notes });
                      }}
                      buttonText="Fill All Fields"
                    />
                    <SavedNotesPopover
                      category="nursing_notes"
                      subcategory="infection_symptoms"
                      currentValue={formData.symptoms || ''}
                      onInsert={(content) =>
                        setFormData({ ...formData, symptoms: content })
                      }
                    />
                  </div>
                </div>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Describe clinical presentation..."
                  value={formData.symptoms || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, symptoms: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Lab & Clinical */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Microscope className="h-5 w-5 text-gray-500" />
                Laboratory & Treatment
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organism Identified
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g. Staphylococcus aureus"
                      value={formData.organism || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, organism: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Culture Results
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Result summary..."
                      value={formData.culture_results || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          culture_results: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Clinical Notes
                    </label>
                    <SavedNotesPopover
                      category="nursing_notes"
                      subcategory="infection_clinical_notes"
                      currentValue={formData.treatment_notes || ''}
                      onInsert={(content) =>
                        setFormData({
                          ...formData,
                          treatment_notes: content,
                        })
                      }
                    />
                  </div>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Additional observations..."
                    value={formData.treatment_notes || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        treatment_notes: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="treatment_initiated"
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    checked={formData.treatment_initiated}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        treatment_initiated: e.target.checked,
                      })
                    }
                  />
                  <label
                    htmlFor="treatment_initiated"
                    className="text-sm font-medium text-gray-700"
                  >
                    Treatment Initiated (Antibiotics/Intervention)
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !selectedPatient}
                className="inline-flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Report Infection
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InfectionReportForm;
