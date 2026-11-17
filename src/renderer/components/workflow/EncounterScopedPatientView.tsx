/**
 * Encounter-Scoped Patient View
 *
 * Main component for viewing a patient's profile and encounter records
 * with strict role-based access control.
 *
 * Key Features:
 * - Patient profile display (demographics, contacts, insurance)
 * - Encounter timeline with selection
 * - Role-based section visibility
 * - Encounter-scoped data display (no data mixing)
 * - Read-only mode for closed encounters
 */

import React, { useEffect } from 'react';
import { format } from 'date-fns';
import {
  usePatientEncounter,
  SectionGuard,
  EditGuard,
  PatientProfile,
} from '../../contexts/PatientEncounterContext';
import { EncounterTimeline } from './EncounterTimeline';
import { SkeletonEncounterDetail } from '../ui/SkeletonLoader';
import { isNhisFeatureEnabled } from '../../config/features';

// =============================================================================
// Patient Demographics Card
// =============================================================================

interface PatientDemographicsProps {
  patient: PatientProfile;
  viewMode?: 'dashboard' | 'sidebar';
}

function PatientDemographics({
  patient,
  viewMode = 'dashboard',
}: PatientDemographicsProps) {
  const isSidebar = viewMode === 'sidebar';
  return (
    <SectionGuard section="demographics">
      <div
        className={`${isSidebar ? 'p-0 space-y-3' : 'bg-white rounded-lg border border-gray-200 p-6 shadow-sm'}`}
      >
        {!isSidebar && (
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-primary-700">Ã°Å¸â€˜Â¤</span>
            Patient Demographics
          </h3>
        )}

        <div
          className={`grid ${isSidebar ? 'grid-cols-2 gap-x-2 gap-y-3' : 'grid-cols-2 md:grid-cols-3 gap-4'}`}
        >
          <div>
            <label className="text-xs text-gray-500 uppercase">
              Patient number
            </label>
            <p className="font-mono text-primary-700 font-medium text-sm">
              {patient.emr_number}
            </p>
          </div>

          <div className={isSidebar ? 'col-span-2' : ''}>
            <label className="text-xs text-gray-500 uppercase">Full Name</label>
            <p className="font-medium text-gray-900 text-sm">
              {patient.first_name} {patient.middle_name || ''} {patient.surname}
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase">
              DOB / Gender
            </label>
            <p className="text-gray-700 text-sm">
              {patient.date_of_birth
                ? format(new Date(patient.date_of_birth), 'dd/MM/yyyy')
                : '--'}{' '}
              ({patient.gender?.charAt(0) || '-'})
            </p>
          </div>

          {!isSidebar && (
            <>
              <div>
                <label className="text-xs text-gray-500 uppercase">Phone</label>
                <p className="text-gray-700">
                  {patient.contact_phone || 'Not recorded'}
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase">Email</label>
                <p className="text-gray-700">
                  {patient.contact_email || 'Not recorded'}
                </p>
              </div>

              <div className="col-span-2">
                <label className="text-xs text-gray-500 uppercase">
                  Address
                </label>
                <p className="text-gray-700">
                  {patient.address || 'Not recorded'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </SectionGuard>
  );
}

// =============================================================================
// Medical Info Card (role-restricted)
// =============================================================================

function PatientMedicalInfo({
  patient,
  viewMode = 'dashboard',
}: PatientDemographicsProps) {
  const isSidebar = viewMode === 'sidebar';

  if (
    isSidebar &&
    !patient.allergies?.length &&
    !patient.chronic_conditions?.length
  ) {
    return null; // Don't show empty in sidebar
  }

  return (
    <SectionGuard section="vitals">
      <div
        className={`${isSidebar ? 'p-0 space-y-3' : 'bg-white rounded-lg border border-gray-200 p-6 shadow-sm'}`}
      >
        {!isSidebar && (
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-primary-700">Ã°Å¸Â©Âº</span>
            Medical Information
          </h3>
        )}

        <div
          className={`grid ${isSidebar ? 'grid-cols-1 gap-3' : 'grid-cols-2 md:grid-cols-4 gap-4'}`}
        >
          {!isSidebar && (
            <>
              <div>
                <label className="text-xs text-gray-500 uppercase">
                  Blood Group
                </label>
                <p className="font-semibold text-red-600">
                  {patient.blood_group || 'Ã¢â‚¬â€'}
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase">
                  Genotype
                </label>
                <p className="text-gray-700">{patient.genotype || 'Ã¢â‚¬â€'}</p>
              </div>
            </>
          )}

          <div className={isSidebar ? '' : 'col-span-2'}>
            <label className="text-xs text-gray-500 uppercase flex items-center gap-1">
              Known Allergies
              {isSidebar && patient.allergies?.length ? (
                <span className="bg-red-100 text-red-700 text-xs px-1 rounded">
                  {patient.allergies.length}
                </span>
              ) : null}
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {patient.allergies?.length ? (
                patient.allergies.map((allergy, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-200"
                  >
                    Ã¢Å¡Â Ã¯Â¸Â {allergy}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-xs italic">
                  No known allergies
                </span>
              )}
            </div>
          </div>

          <div className={isSidebar ? '' : 'col-span-4'}>
            <label className="text-xs text-gray-500 uppercase">
              Chronic Conditions
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {patient.chronic_conditions?.length ? (
                patient.chronic_conditions.map((condition, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full border border-amber-200"
                  >
                    {condition}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-xs italic">
                  No chronic conditions recorded
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </SectionGuard>
  );
}

// =============================================================================
// Insurance/Payment Card
// =============================================================================

function PatientPaymentInfo({ patient }: PatientDemographicsProps) {
  return (
    <SectionGuard section="billing">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-primary-700">Ã°Å¸â€™Â³</span>
          Payment Information
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase">
              Payment Category
            </label>
            <p className="text-gray-700 font-medium">
              {patient.payment_category || 'Out-of-Pocket'}
            </p>
          </div>

          {isNhisFeatureEnabled() && (
            <div>
              <label className="text-xs text-gray-500 uppercase">
                NHIS Number
              </label>
              <p className="font-mono text-gray-700">
                {patient.nhis_number || 'Not enrolled'}
              </p>
            </div>
          )}
        </div>
      </div>
    </SectionGuard>
  );
}

// =============================================================================
// Encounter Records Sections
// =============================================================================

function EncounterRecordsPanel({
  viewMode = 'dashboard',
}: {
  viewMode?: 'dashboard' | 'sidebar';
}) {
  const { selectedEncounter, encounterRecords, isLoadingRecords, isReadOnly } =
    usePatientEncounter();
  const isSidebar = viewMode === 'sidebar';

  if (!selectedEncounter) {
    return (
      <div
        className={`rounded-lg p-8 text-center ${isSidebar ? 'bg-transparent border border-gray-200 border-dashed py-4' : 'bg-gray-50'}`}
      >
        <div className={`text-4xl mb-4 ${isSidebar ? 'text-2xl mb-2' : ''}`}>
          Ã°Å¸â€œâ€¹
        </div>
        <p className={`text-gray-500 ${isSidebar ? 'text-xs' : ''}`}>
          Select an encounter {isSidebar ? 'above' : 'from the timeline'} to
          view records
        </p>
        {!isSidebar && (
          <p className="text-sm text-gray-400 mt-2">
            All data shown will be scoped to the selected encounter only
          </p>
        )}
      </div>
    );
  }

  if (isLoadingRecords) {
    return (
      <div className="p-4">
        <SkeletonEncounterDetail />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encounter Header */}
      <div
        className={`p-4 rounded-lg ${isReadOnly ? 'bg-amber-50 border border-amber-200' : 'bg-primary-700/5 border border-primary-700/20'} ${isSidebar ? 'p-3' : ''}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3
              className={`font-semibold text-gray-900 ${isSidebar ? 'text-sm' : ''}`}
            >
              {selectedEncounter.encounter_number ||
                `Encounter ${selectedEncounter.visit_id.slice(0, 8)}`}
            </h3>
            <p
              className={`text-sm text-gray-500 ${isSidebar ? 'text-xs' : ''}`}
            >
              {selectedEncounter.visit_type} Ã¢â‚¬Â¢ {selectedEncounter.current_stage}
            </p>
          </div>
          {isReadOnly && (
            <span
              className={`px-3 py-1 bg-amber-100 text-amber-700 text-sm rounded-full ${isSidebar ? 'text-xs px-2 py-0.5' : ''}`}
            >
              Ã°Å¸â€â€™ {isSidebar ? 'Closed' : 'Read-only'}
            </span>
          )}
        </div>
      </div>

      {/* Vitals Section */}
      <SectionGuard section="vitals">
        <RecordSection
          title="Vitals"
          icon="Ã°Å¸Â©Âº"
          records={encounterRecords?.vitals || []}
          emptyMessage="No vitals recorded"
          isSidebar={isSidebar}
          renderRecord={(record: Record<string, unknown>) => (
            <div
              className={`grid ${isSidebar ? 'grid-cols-2' : 'grid-cols-4'} gap-4 text-sm`}
            >
              {record.temperature && <div>Temp: {record.temperature}Ã‚Â°C</div>}
              {record.blood_pressure_systolic && (
                <div>
                  BP: {record.blood_pressure_systolic}/
                  {record.blood_pressure_diastolic}
                </div>
              )}
              {record.pulse && <div>Pulse: {record.pulse} bpm</div>}
              {record.respiratory_rate && (
                <div>RR: {record.respiratory_rate}/min</div>
              )}
            </div>
          )}
        />
      </SectionGuard>

      {/* Triage Section */}
      <SectionGuard section="triage">
        <RecordSection
          title="Triage Assessment"
          icon="Ã°Å¸Å¡Â¨"
          records={encounterRecords?.triage || []}
          emptyMessage="No triage assessment for this encounter"
          renderRecord={(record: Record<string, unknown>) => (
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    record.priority === 'Emergency'
                      ? 'bg-red-100 text-red-700'
                      : record.priority === 'Urgent'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                  }`}
                >
                  {record.priority}
                </span>
                {record.chief_complaint && (
                  <span>{record.chief_complaint}</span>
                )}
              </div>
            </div>
          )}
        />
      </SectionGuard>

      {/* Consultation Section */}
      <SectionGuard section="consultation">
        <EditGuard section="consultation">
          <RecordSection
            title="Consultations"
            icon="Ã°Å¸â€˜Â¨Ã¢â‚¬ÂÃ¢Å¡â€¢Ã¯Â¸Â"
            records={encounterRecords?.consultations || []}
            emptyMessage="No consultations for this encounter"
            renderRecord={(record: Record<string, unknown>) => (
              <div className="space-y-2 text-sm">
                {record.presenting_complaint && (
                  <div>
                    <span className="font-medium">Presenting Complaint:</span>{' '}
                    {record.presenting_complaint}
                  </div>
                )}
                {record.history_of_presenting_illness && (
                  <div>
                    <span className="font-medium">HPI:</span>{' '}
                    {record.history_of_presenting_illness}
                  </div>
                )}
                {record.examination_findings && (
                  <div>
                    <span className="font-medium">Examination:</span>{' '}
                    {record.examination_findings}
                  </div>
                )}
              </div>
            )}
          />
        </EditGuard>
      </SectionGuard>

      {/* Diagnosis Section */}
      <SectionGuard section="diagnosis">
        <RecordSection
          title="Diagnoses"
          icon="Ã°Å¸â€Â¬"
          records={(encounterRecords?.consultations || []).filter(
            (c: Record<string, unknown>) => c.diagnosis,
          )}
          emptyMessage="No diagnoses recorded"
          renderRecord={(record: Record<string, unknown>) => (
            <div className="text-sm">
              <span className="font-medium">{record.diagnosis}</span>
              {record.icd_code && (
                <span className="ml-2 text-gray-500">({record.icd_code})</span>
              )}
            </div>
          )}
        />
      </SectionGuard>

      {/* Lab Requests Section */}
      <SectionGuard section="labRequests">
        <RecordSection
          title="Laboratory Requests"
          icon="Ã°Å¸Â§Âª"
          records={encounterRecords?.lab_requests || []}
          emptyMessage="No lab requests for this encounter"
          renderRecord={(record: Record<string, unknown>) => (
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">
                  {record.test_name || 'Lab Test'}
                </span>
                <span
                  className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    record.status === 'Completed'
                      ? 'bg-green-100 text-green-700'
                      : record.status === 'Pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {record.status}
                </span>
              </div>
            </div>
          )}
        />
      </SectionGuard>

      {/* Lab Results Section */}
      <SectionGuard section="labResults">
        <RecordSection
          title="Laboratory Results"
          icon="Ã°Å¸â€œÅ "
          records={(encounterRecords?.lab_requests || []).filter(
            (r: Record<string, unknown>) => r.lab_result,
          )}
          emptyMessage="No lab results available"
          renderRecord={(record: Record<string, unknown>) => (
            <div className="text-sm">
              <span className="font-medium">{record.test_name}</span>
              <pre className="mt-1 text-xs bg-gray-50 p-2 rounded">
                {JSON.stringify(record.lab_result, null, 2)}
              </pre>
            </div>
          )}
        />
      </SectionGuard>

      {/* Radiology Section */}
      <SectionGuard section="radiologyRequests">
        <RecordSection
          title="Radiology Requests"
          icon="Ã°Å¸â€œÂ·"
          records={encounterRecords?.radiology_requests || []}
          emptyMessage="No radiology requests for this encounter"
          renderRecord={(record: Record<string, unknown>) => (
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {record.modality} - {record.body_part || 'General'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  record.status === 'Completed'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {record.status}
              </span>
            </div>
          )}
        />
      </SectionGuard>

      {/* Prescriptions Section */}
      <SectionGuard section="prescriptions">
        <RecordSection
          title="Prescriptions"
          icon="Ã°Å¸â€™Å "
          records={encounterRecords?.prescriptions || []}
          emptyMessage="No prescriptions for this encounter"
          renderRecord={(record: Record<string, unknown>) => (
            <div className="text-sm">
              <span className="font-medium">{record.medication_name}</span>
              <span className="text-gray-500 ml-2">
                {record.dosage} - {record.frequency} for {record.duration}
              </span>
            </div>
          )}
        />
      </SectionGuard>

      {/* Nursing Care Section */}
      <SectionGuard section="nursingCare">
        <RecordSection
          title="Nursing Care"
          icon="Ã°Å¸â€™â€°"
          records={encounterRecords?.nursing_care || []}
          emptyMessage="No nursing care recorded"
          renderRecord={(record: Record<string, unknown>) => (
            <div className="text-sm">
              <span className="font-medium">{record.care_type}</span>
              {record.notes && (
                <p className="text-gray-500 mt-1">{record.notes}</p>
              )}
            </div>
          )}
        />
      </SectionGuard>

      {/* Billing Section */}
      <SectionGuard section="billing">
        <RecordSection
          title="Billing Orders"
          icon="Ã°Å¸â€™Â°"
          records={encounterRecords?.billing_orders || []}
          emptyMessage="No billing orders for this encounter"
          renderRecord={(record: Record<string, unknown>) => (
            <div className="flex items-center justify-between text-sm">
              <span>{record.description || 'Billing Item'}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  Ã¢â€šÂ¦{record.amount?.toLocaleString()}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    record.payment_status === 'Paid'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {record.payment_status}
                </span>
              </div>
            </div>
          )}
        />
      </SectionGuard>
    </div>
  );
}

// =============================================================================
// Generic Record Section Component
// =============================================================================

interface RecordSectionProps<T> {
  title: string;
  icon: string;
  records: T[];
  emptyMessage: string;
  renderRecord: (record: T, index: number) => React.ReactNode;
  isSidebar?: boolean;
}

function RecordSection<T>({
  title,
  icon,
  records,
  emptyMessage,
  renderRecord,
  isSidebar = false,
}: RecordSectionProps<T>) {
  if (isSidebar && records.length === 0) return null; // Hide empty sections in sidebar

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${isSidebar ? 'border-none shadow-none bg-transparent' : ''}`}
    >
      <div
        className={`px-4 py-3 bg-gray-50 border-b border-gray-200 ${isSidebar ? 'px-0 py-2 bg-transparent border-none' : ''}`}
      >
        <h4
          className={`font-medium text-gray-900 flex items-center gap-2 ${isSidebar ? 'text-xs uppercase tracking-wider text-gray-500' : ''}`}
        >
          <span>{icon}</span>
          {title}
          <span className="ml-auto text-sm text-gray-500">
            {records.length}{' '}
            {isSidebar ? '' : `record${records.length !== 1 ? 's' : ''}`}
          </span>
        </h4>
      </div>
      <div
        className={`${isSidebar ? 'border-l-2 border-gray-200 pl-3 ml-1' : 'p-4'}`}
      >
        {records.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-3">
            {records.map((record, idx) => (
              <div
                key={idx}
                className={`${isSidebar ? 'text-xs' : 'p-3 bg-gray-50 rounded-lg border border-gray-100'}`}
              >
                {renderRecord(record, idx)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface EncounterScopedPatientViewProps {
  patientId?: string;
  className?: string;
  viewMode?: 'dashboard' | 'sidebar';
}

export function EncounterScopedPatientView({
  patientId,
  className = '',
  viewMode = 'dashboard',
}: EncounterScopedPatientViewProps) {
  const {
    selectedPatient,
    isLoadingPatient,
    patientError,
    selectPatient,
    canViewPatient,
  } = usePatientEncounter();

  // Load patient when patientId changes
  useEffect(() => {
    if (
      patientId &&
      (!selectedPatient || selectedPatient.patient_id !== patientId)
    ) {
      selectPatient(patientId);
    }
  }, [patientId, selectedPatient, selectPatient]);

  // Not authorized
  if (!canViewPatient) {
    return (
      <div className={`p-8 bg-red-50 rounded-lg text-center ${className}`}>
        <div className="text-4xl mb-4">Ã°Å¸â€â€™</div>
        <p className="text-red-600 font-medium">Access Denied</p>
        <p className="text-red-500 text-sm mt-2">
          You do not have permission to view patient profiles
        </p>
      </div>
    );
  }

  // Loading
  if (isLoadingPatient) {
    return (
      <div className={`flex items-center justify-center p-12 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto" />
          <p className="text-gray-500 mt-4">Loading patient profile...</p>
        </div>
      </div>
    );
  }

  // Error
  if (patientError) {
    return (
      <div className={`p-8 bg-red-50 rounded-lg text-center ${className}`}>
        <div className="text-4xl mb-4">Ã¢Å¡Â Ã¯Â¸Â</div>
        <p className="text-red-600">{patientError}</p>
      </div>
    );
  }

  // No patient selected
  if (!selectedPatient) {
    return (
      <div className={`p-8 bg-gray-50 rounded-lg text-center ${className}`}>
        <div className="text-4xl mb-4">Ã°Å¸â€˜Â¤</div>
        <p className="text-gray-500">
          Select a patient to view their profile and encounters
        </p>
      </div>
    );
  }

  // Sidebar View
  if (viewMode === 'sidebar') {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Condensed Patient Medical Information */}
        <section>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Patient Profile
          </h4>
          <PatientDemographics patient={selectedPatient} viewMode="sidebar" />
          <div className="mt-4" />
          <PatientMedicalInfo patient={selectedPatient} viewMode="sidebar" />
        </section>

        {/* Encounter History */}
        <section className="border-t border-gray-200 pt-4">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Previous Encounters
          </h4>
          <div className="mb-4 bg-gray-50 rounded border border-gray-200">
            <EncounterTimeline />
          </div>
          <EncounterRecordsPanel viewMode="sidebar" />
        </section>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${className}`}>
      {/* Left Column: Patient Info + Timeline */}
      <div className="lg:col-span-1 space-y-6">
        {/* Patient Profile Cards */}
        <PatientDemographics patient={selectedPatient} />
        <PatientMedicalInfo patient={selectedPatient} />
        <PatientPaymentInfo patient={selectedPatient} />

        {/* Encounter Timeline */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <EncounterTimeline />
        </div>
      </div>

      {/* Right Column: Encounter Records */}
      <div className="lg:col-span-2">
        <EncounterRecordsPanel />
      </div>
    </div>
  );
}

export default EncounterScopedPatientView;
