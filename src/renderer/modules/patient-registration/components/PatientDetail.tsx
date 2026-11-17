import React from 'react';
import {
  Phone,
  User,
  Calendar,
  Edit2,
  Shield,
  Users,
  FileText,
  AlertTriangle,
  Star,
  CreditCard,
  Briefcase,
  Clock,
  PlusCircle,
  Eye,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  PatientDTO,
  formatDetailedAge,
  formatPatientName,
} from '../dtos/patient.dto';
import { StatusBadge, Button } from '../../../components/ui';
import PatientAllergySummary from '../../../components/shared/PatientAllergySummary';
import {
  isMilitaryFeatureEnabled,
  isNhisCategory,
  isNhisFeatureEnabled,
} from '../../../config/features';

import { Modal } from '../../../components/ui/Modal';
import { RoleGate } from '../../../components/auth/ProtectedRoute';
import { useDependentsByPrincipal, usePatient } from '../hooks/usePatient';
import { useMedicalReports } from '../../medical-reports/hooks/useMedicalReports';
import { MedicalReportDTO } from '../../medical-reports/dtos/medical-reports.dto';
import {
  openMedicalReportPdf,
  downloadMedicalReportPdf,
} from '../../medical-reports/utils/medicalReportPdf';
import { useToast } from '../../../components/ui/Toast';

// XenoCare Logo
// =============================================================================
// Types
// =============================================================================

interface PatientDetailProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientDTO | null;
  onEdit: () => void;
  onCreateEncounter?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export default function PatientDetail({
  isOpen,
  onClose,
  patient,
  onEdit,
  onCreateEncounter,
}: PatientDetailProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isDependent = patient?.patient_type === 'Dependent';
  const isPrincipal = patient?.patient_type === 'Principal';
  const reportTrackingKey = patient?.id || patient?.patient_id || '__none__';

  // Use patient.id (UUID) for principal lookup since principal_id references patients(id)
  const { data: dependents } = useDependentsByPrincipal(
    isPrincipal && patient ? (patient.id ?? null) : null,
  );
  const { data: principalPatient } = usePatient(
    isDependent && patient?.principal_id ? patient.principal_id : '',
  );
  const { data: patientReports, isLoading: isLoadingPatientReports } =
    useMedicalReports({
      patient_id: reportTrackingKey,
    });

  if (!patient) return null;

  const age = formatDetailedAge(patient.date_of_birth);
  const trackedReports = (patientReports || []).slice(0, 6);

  const getReportStatusStyles = (status: string): string => {
    switch (status) {
      case 'Issued':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'Approved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Pending Approval':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Revoked':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleViewReportPdf = async (reportItem: MedicalReportDTO) => {
    try {
      await openMedicalReportPdf(reportItem);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'PDF Preview Failed',
        message:
          error instanceof Error ? error.message : 'Unable to open report PDF.',
      });
    }
  };

  const handleDownloadReportPdf = async (reportItem: MedicalReportDTO) => {
    try {
      await downloadMedicalReportPdf(reportItem);
      showToast({
        type: 'success',
        title: 'Download Started',
        message: 'Report PDF download has started.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Download Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to download report PDF.',
      });
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Inactive':
        return 'neutral';
      case 'Deceased':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const getCategoryIcon = (category?: string | null) => {
    switch (category) {
      case 'Military':
        return <Shield className="h-4 w-4" />;
      case 'DS':
        return <Star className="h-4 w-4" />;
      case 'Civilian':
        return <Users className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Patient Profile"
      size="2xl"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <RoleGate
            roles={[
              'super_admin',
              'admin',
              'medical_director',
              'doctor',
              'nurse',
              'receptionist',
            ]}
          >
            <Button icon={Edit2} onClick={onEdit} variant="primary">
              Edit Patient
            </Button>
          </RoleGate>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Unified Patient Header */}
        <div className="rounded-xl border border-primary-200 bg-white overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              {patient.photo_url ? (
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary-200 flex-shrink-0">
                  <img
                    src={patient.photo_url}
                    alt={`${patient.first_name} ${patient.surname}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-800 border border-primary-200">
                  {patient.first_name.charAt(0)}
                  {patient.surname.charAt(0)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold text-gray-900 truncate">
                      {formatPatientName(patient)}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 font-medium">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {patient.gender}
                      </span>
                      {patient.date_of_birth && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {age}
                        </span>
                      )}
                      {patient.patient_category &&
                        (isMilitaryFeatureEnabled() ||
                          patient.patient_category !== 'Military') && (
                          <span className="flex items-center gap-1 bg-primary-50 px-1.5 py-0.5 rounded text-primary-800 font-semibold">
                            {getCategoryIcon(patient.patient_category)}
                            {patient.patient_category}
                          </span>
                        )}
                      {patient.patient_type && (
                        <span className="bg-primary-50 px-1.5 py-0.5 rounded text-primary-800 font-semibold">
                          {patient.patient_type}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge
                      status={patient.status}
                      variant={
                        getStatusVariant(patient.status) as
                          | 'success'
                          | 'neutral'
                          | 'danger'
                      }
                    />
                    {onCreateEncounter && (
                      <button
                        type="button"
                        onClick={onCreateEncounter}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-800 transition"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        New Visit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ID Badges Bar */}
          <div className="px-4 py-2.5 bg-primary-50 border-t border-primary-100 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-primary-600 font-semibold">EMR</span>
              <span className="font-mono font-bold text-gray-900">
                {patient.emr_number || 'Pending'}
              </span>
            </div>
            {isNhisFeatureEnabled() && (
              <>
                <div className="w-px h-3 bg-primary-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-primary-600 font-semibold">NHIS</span>
                  <span className="font-mono font-semibold text-gray-800">
                    {patient.nhis_number || 'N/A'}
                  </span>
                </div>
              </>
            )}
            {isMilitaryFeatureEnabled() &&
              patient.patient_category === 'Military' &&
              !isDependent && (
                <>
                  <div className="w-px h-3 bg-primary-200" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-primary-600 font-semibold">SVC#</span>
                    <span className="font-mono font-semibold text-gray-800">
                      {(patient.service_number || 'N/A').replace(/-/g, '/')}
                    </span>
                  </div>
                </>
              )}
          </div>
        </div>

        {/* Allergy status */}
        <PatientAllergySummary
          patientId={patient.id}
          knownAllergies={patient.known_allergies}
          noKnownAllergies={
            (patient as { no_known_allergies?: boolean }).no_known_allergies
          }
          compact
        />

        {/* Two-Column: Personal Details + Contact & NOK */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Personal Details */}
          <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
            <div className="px-3 py-1.5 bg-primary-50/70 border-b border-primary-100 flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-primary-600" />
              <h3 className="font-bold text-primary-800 text-[11px] uppercase tracking-wider">
                Personal Details
              </h3>
            </div>
            <div className="divide-y divide-primary-50 text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Full Name</span>
                <span className="font-semibold text-gray-900 text-right">{formatPatientName(patient)}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Gender</span>
                <span className="font-semibold text-gray-900">{patient.gender}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Date of Birth</span>
                <span className="font-semibold text-gray-900">
                  {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Age</span>
                <span className="font-semibold text-gray-900">{age || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Blood Group</span>
                <span className="font-semibold text-gray-900">{patient.blood_group || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Nationality</span>
                <span className="font-semibold text-gray-900">{patient.nationality || 'Nigerian'}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">State / LGA</span>
                <span className="font-semibold text-gray-900 text-right">
                  {patient.state_of_origin || 'N/A'}{patient.lga ? ` / ${patient.lga}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Contact & Next of Kin */}
          <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
            <div className="px-3 py-1.5 bg-primary-50/70 border-b border-primary-100 flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-primary-600" />
              <h3 className="font-bold text-primary-800 text-[11px] uppercase tracking-wider">
                Contact
              </h3>
            </div>
            <div className="divide-y divide-primary-50 text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Phone</span>
                <span className="font-semibold text-gray-900">{patient.contact_phone || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Email</span>
                <span className="font-semibold text-gray-900 truncate ml-4">{patient.email || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Address</span>
                <span className="font-semibold text-gray-900 text-right ml-4">{patient.residential_address || 'N/A'}</span>
              </div>
            </div>

            {/* Next of Kin sub-section */}
            <div className="px-3 py-1.5 bg-primary-50/70 border-y border-primary-100 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary-600" />
              <h3 className="font-bold text-primary-800 text-[11px] uppercase tracking-wider">
                Next of Kin
                {isDependent && principalPatient && !patient.nok_name && (
                  <span className="text-[10px] font-normal text-primary-600 ml-1.5 normal-case">
                    (from Principal)
                  </span>
                )}
              </h3>
            </div>
            <div className="divide-y divide-primary-50 text-sm">
              {(() => {
                const nokSource = patient.nok_name
                  ? patient
                  : isDependent && principalPatient
                    ? principalPatient
                    : patient;
                return (
                  <>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-gray-600 text-xs font-medium">Name</span>
                      <span className="font-semibold text-gray-900">{nokSource.nok_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-gray-600 text-xs font-medium">Relationship</span>
                      <span className="font-semibold text-gray-900">{nokSource.nok_relationship || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-gray-600 text-xs font-medium">Phone</span>
                      <span className="font-semibold text-gray-900">{nokSource.nok_phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-gray-600 text-xs font-medium">Address</span>
                      <span className="font-semibold text-gray-900 text-right ml-4">{nokSource.nok_address || 'N/A'}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Two-Column: Category/Insurance + Military/Civilian */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Category & Insurance */}
          <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
            <div className="px-3 py-1.5 bg-primary-50/70 border-b border-primary-100 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-primary-600" />
              <h3 className="font-bold text-primary-800 text-[11px] uppercase tracking-wider">
                Category & Insurance
              </h3>
            </div>
            <div className="divide-y divide-primary-50 text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Category</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1">
                  {getCategoryIcon(patient.patient_category)}
                  {isMilitaryFeatureEnabled() ||
                  patient.patient_category !== 'Military'
                    ? patient.patient_category || 'N/A'
                    : 'Civilian'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Type</span>
                <span className="font-semibold text-gray-900">{patient.patient_type || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600 text-xs font-medium">Insurance</span>
                <span className="font-semibold text-gray-900">
                  {!isNhisFeatureEnabled() &&
                  isNhisCategory(patient.insurance_type)
                    ? 'Private'
                    : patient.insurance_type || 'N/A'}
                </span>
              </div>
              {isNhisFeatureEnabled() && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-gray-600 text-xs font-medium">NHIS Source</span>
                  <span className="font-semibold text-gray-900">{patient.nhis_patient_source || 'Internal'}</span>
                </div>
              )}
              {patient.payer_info && patient.payer_info.scheme && (
                <>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-gray-600 text-xs font-medium">Scheme</span>
                    <span className="font-semibold text-gray-900">{patient.payer_info.scheme || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-gray-600 text-xs font-medium">Payer Relationship</span>
                    <span className="font-semibold text-gray-900">{patient.payer_info.relationship || 'N/A'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Military or Civilian Employment */}
          {isMilitaryFeatureEnabled() &&
            patient.patient_category === 'Military' &&
            !isDependent && (
            <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
              <div className="px-3 py-1.5 bg-primary-50/70 border-b border-primary-100 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-primary-600" />
                <h3 className="font-bold text-primary-800 text-[11px] uppercase tracking-wider">
                  Military Details
                </h3>
              </div>
              <div className="divide-y divide-primary-50 text-sm">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-gray-600 text-xs font-medium">Service Number</span>
                  <span className="font-semibold text-gray-900 font-mono">{(patient.service_number || 'N/A').replace(/-/g, '/')}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-gray-600 text-xs font-medium">Rank</span>
                  <span className="font-semibold text-gray-900">{patient.rank || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-gray-600 text-xs font-medium">Branch</span>
                  <span className="font-semibold text-gray-900">{patient.military_branch || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-gray-600 text-xs font-medium">Unit</span>
                  <span className="font-semibold text-gray-900">{patient.unit || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {patient.patient_category === 'Civilian' && !isDependent && (
            <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
              <div className="px-3 py-1.5 bg-primary-50/70 border-b border-primary-100 flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-primary-600" />
                <h3 className="font-bold text-primary-800 text-[11px] uppercase tracking-wider">
                  Employment
                </h3>
              </div>
              <div className="divide-y divide-primary-50 text-sm">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-gray-600 text-xs font-medium">Occupation</span>
                  <span className="font-semibold text-gray-900">{patient.occupation || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-gray-600 text-xs font-medium">Employer</span>
                  <span className="font-semibold text-gray-900">{patient.employer || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coverage Relationship (Principal/Dependent) */}
        {(isDependent || isPrincipal) && (
          <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
            <div className="px-3 py-1.5 bg-primary-50/70 border-b border-primary-100 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary-600" />
              <h3 className="font-bold text-primary-800 text-[11px] uppercase tracking-wider">
                Coverage Relationship
              </h3>
            </div>
            <div className="p-3 space-y-2">
              {isDependent && (
                <div className="space-y-2">
                  <div className="p-2.5 bg-primary-50/50 rounded-lg border border-primary-100">
                    <div className="text-xs text-primary-700 font-semibold mb-1">
                      Linked to Principal
                    </div>
                    <div className="font-bold text-gray-900 text-sm">
                      {principalPatient
                        ? `${principalPatient.first_name} ${principalPatient.surname}`
                        : patient.principal_id
                          ? 'Loading...'
                          : 'N/A'}
                    </div>
                    {principalPatient && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        <span className="bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded font-mono font-semibold">
                          {principalPatient.emr_number || 'No EMR'}
                        </span>
                        {principalPatient.patient_category && (
                          <span className="bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded font-semibold">
                            {principalPatient.patient_category}
                          </span>
                        )}
                        {principalPatient.insurance_type && (
                          <span className="bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded font-semibold">
                            {principalPatient.insurance_type}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-gray-600 mt-1.5 font-medium">
                      <span className="font-semibold">Relationship:</span>{' '}
                      <span className="text-gray-800 font-semibold">
                        {patient.relationship_to_principal || 'Not specified'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 italic font-medium">
                    Own EMR ({patient.emr_number}) for individual history; coverage linked to principal above.
                  </p>
                </div>
              )}

              {isPrincipal && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 font-medium">Registered Dependents</span>
                    <span className="font-bold text-primary-800">
                      {dependents?.length || 0}
                    </span>
                  </div>

                  {dependents && dependents.length > 0 && (
                    <div className="divide-y border border-primary-100 rounded-lg overflow-hidden">
                      {dependents.map((d) => (
                        <div
                          key={d.patient_id}
                          className="px-3 py-2 bg-white hover:bg-primary-50/30 transition-colors flex justify-between items-center"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm">
                              {d.first_name} {d.surname}
                            </div>
                            <div className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1 font-medium">
                              <Users className="h-3 w-3" />
                              {d.relationship_to_principal || 'Not specified'}
                              {d.gender && <span>Â· {d.gender}</span>}
                              {d.date_of_birth && <span>Â· {formatDetailedAge(d.date_of_birth)}</span>}
                            </div>
                          </div>
                          <span className="text-xs font-mono bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded flex-shrink-0 ml-2 font-semibold">
                            {d.emr_number || 'No EMR'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Medical Reports */}
        <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
          <div className="px-3 py-1.5 bg-primary-50/70 border-b border-primary-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-primary-600" />
              <h3 className="font-bold text-primary-800 text-[11px] uppercase tracking-wider">
                Medical Reports
              </h3>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                navigate(
                  `/medical-reports?patientId=${encodeURIComponent(reportTrackingKey)}`,
                );
                onClose();
              }}
            >
              View All
            </Button>
          </div>

          <div className="p-2">
            {isLoadingPatientReports ? (
              <p className="text-xs text-gray-600 font-medium p-2">Loading reports...</p>
            ) : trackedReports.length === 0 ? (
              <p className="text-xs text-gray-600 font-medium p-2">No reports found.</p>
            ) : (
              <div className="divide-y divide-primary-50">
                {trackedReports.map((reportItem) => (
                  <div
                    key={reportItem.report_id || reportItem.id}
                    className="flex items-center justify-between gap-3 px-2 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {reportItem.report_title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-600 font-medium">
                          {reportItem.report_type} Â· {new Date(reportItem.created_at).toLocaleDateString()}
                        </span>
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${getReportStatusStyles(reportItem.status)}`}
                        >
                          {reportItem.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewReportPdf(reportItem)}
                        className="p-1.5 rounded hover:bg-primary-50 text-gray-600 hover:text-primary-700 transition"
                        title="View PDF"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadReportPdf(reportItem)}
                        className="p-1.5 rounded hover:bg-primary-50 text-gray-600 hover:text-primary-700 transition"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium pt-2">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary-600" />
            Registered: {new Date(patient.registration_date).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-1.5">
            
            <span>XenoCare</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export { PatientDetail };
