/**
 * =============================================================================
 * XENOCARE EMR - ENCOUNTER DETAIL MODAL
 * Professional centered modal showing complete encounter details at a glance
 * Includes: Clinical Notes, Vitals, Nursing Reports, Labs, Imaging, Prescriptions
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Stethoscope,
  FileText,
  Pill,
  FlaskConical,
  Scan,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Printer,
  Download,
  Loader2,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Scale,
  Ruler,
  Shield,
  Building2,
  Phone,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clipboard,
  Syringe,
} from 'lucide-react';
import { EncounterDetail } from '../../api/medical-records.api';
import { useEncounterDetails } from '../../hooks/useMedicalRecords';
import { supabase } from '../../../../api/supabaseClient';

// XenoCare Logo
// =============================================================================
// Types
// =============================================================================

interface EncounterDetailModalProps {
  encounterId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface NursingNote {
  note_id: string;
  note_type: string;
  content: string;
  vital_signs?: {
    blood_pressure?: string;
    pulse?: number;
    temperature?: number;
    respiratory_rate?: number;
  };
  is_critical: boolean;
  requires_doctor_review: boolean;
  created_at: string;
  recorder?:
    | {
        first_name: string;
        last_name: string;
      }
    | {
        first_name: string;
        last_name: string;
      }[]
    | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status?.toLowerCase()) {
    case 'completed':
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-200',
      };
    case 'active':
    case 'in-progress':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-200',
      };
    case 'pending':
    case 'waiting':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-200',
      };
    case 'cancelled':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-200',
      };
  }
}

// =============================================================================
// Section Components
// =============================================================================

function VitalsCard({ vitals }: { vitals: EncounterDetail['vitals'] }) {
  if (!vitals) return null;

  const vitalItems = [
    {
      label: 'Blood Pressure',
      value:
        typeof vitals.blood_pressure === 'object' &&
        vitals.blood_pressure !== null
          ? `${vitals.blood_pressure.systolic}/${vitals.blood_pressure.diastolic}`
          : vitals.blood_pressure || 'N/A',
      icon: Heart,
      unit: 'mmHg',
      color: 'text-red-500',
    },
    {
      label: 'Pulse Rate',
      value: vitals.pulse_rate || 'N/A',
      icon: Activity,
      unit: 'bpm',
      color: 'text-pink-500',
    },
    {
      label: 'Temperature',
      value: vitals.temperature || 'N/A',
      icon: Thermometer,
      unit: '°C',
      color: 'text-orange-500',
    },
    {
      label: 'Respiratory Rate',
      value: vitals.respiratory_rate || 'N/A',
      icon: Wind,
      unit: '/min',
      color: 'text-blue-500',
    },
    {
      label: 'SpO2',
      value: vitals.oxygen_saturation || 'N/A',
      icon: Droplets,
      unit: '%',
      color: 'text-cyan-500',
    },
    {
      label: 'Weight',
      value: vitals.weight || 'N/A',
      icon: Scale,
      unit: 'kg',
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {vitalItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div key={idx} className="bg-gray-50 rounded-lg p-3 text-center">
            <Icon className={`h-5 w-5 mx-auto mb-1 ${item.color}`} />
            <div className="text-lg font-bold text-gray-900">
              {item.value !== 'N/A' ? `${item.value}` : '-'}
            </div>
            <div className="text-xs text-gray-500">{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function ClinicalNotesSection({ encounter }: { encounter: EncounterDetail }) {
  const { consultation } = encounter;
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-primary-700 to-primary-600 text-white flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <FileText size={18} />
          <span className="font-semibold">Clinical Notes (SOAP)</span>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Chief Complaint */}
          {(consultation?.chief_complaint || encounter.chief_complaint) && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1">
                <AlertTriangle size={14} />
                Chief Complaint
              </div>
              <p className="text-amber-900 text-sm">
                {consultation?.chief_complaint || encounter.chief_complaint}
              </p>
            </div>
          )}

          {/* SOAP Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                Subjective (HPI)
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-gray-700 min-h-[80px]">
                {consultation?.history_of_present_illness || (
                  <span className="text-gray-400 italic">Not documented</span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                Objective (Examination)
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-sm text-gray-700 min-h-[80px]">
                {consultation?.examination_findings || (
                  <span className="text-gray-400 italic">Not documented</span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                Assessment (Diagnosis)
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-sm text-gray-700 min-h-[80px]">
                {/* Show diagnosis from the diagnoses array tied to this encounter */}
                {encounter.diagnoses && encounter.diagnoses.length > 0
                  ? encounter.diagnoses.join('; ')
                  : consultation?.diagnosis || (
                      <span className="text-gray-400 italic">
                        Not documented
                      </span>
                    )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
                Plan (Treatment)
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-sm text-gray-700 min-h-[80px]">
                {consultation?.treatment_plan || (
                  <span className="text-gray-400 italic">Not documented</span>
                )}
              </div>
            </div>
          </div>

          {/* Follow-up */}
          {consultation?.follow_up_date && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              <Calendar size={14} className="text-primary-700" />
              <span className="font-medium">Follow-up:</span>
              <span>{formatDate(consultation.follow_up_date)}</span>
              {consultation.follow_up_notes && (
                <span className="text-gray-400">
                  - {consultation.follow_up_notes}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiagnosisSection({ encounter }: { encounter: EncounterDetail }) {
  const [expanded, setExpanded] = useState(true);

  // Get diagnosis directly from the encounter's diagnoses array
  // This is the diagnosis saved in the consultation record tied to this specific encounter
  // It comes from consultations.diagnosis (TEXT[] field) via the API
  const diagnoses: string[] = encounter.diagnoses || [];

  // Debug log to verify we're getting the correct diagnosis for this encounter
  console.log(
    '[DiagnosisSection] Encounter:',
    encounter.encounter_id,
    'Diagnoses:',
    diagnoses,
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Stethoscope size={18} />
          <span className="font-semibold">Diagnosis (ICD-10)</span>
          {diagnoses.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {diagnoses.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="p-4">
          {diagnoses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Stethoscope size={32} className="mx-auto mb-2 opacity-50" />
              <p>No diagnosis recorded for this encounter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {diagnoses.map((diagnosis, idx) => {
                // Try to parse ICD code if present (format: "Code - Description" or just description)
                const icdMatch = diagnosis.match(
                  /^([A-Z]\d{2}(?:\.\d{1,2})?)\s*[-–:]\s*(.+)$/i,
                );
                const icdCode = icdMatch ? icdMatch[1].toUpperCase() : null;
                const description = icdMatch ? icdMatch[2] : diagnosis;

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      {icdCode && (
                        <div className="inline-flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-mono rounded">
                            {icdCode}
                          </span>
                          <span className="text-xs text-purple-600">
                            ICD-10
                          </span>
                        </div>
                      )}
                      <div className="text-gray-900 font-medium">
                        {description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NursingNotesSection({ encounterId }: { encounterId: string }) {
  const [nursingNotes, setNursingNotes] = useState<NursingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function fetchNursingNotes() {
      try {
        // First try to fetch nursing notes - the table might not exist or have different structure
        const { data, error } = await supabase
          .from('nursing_notes')
          .select(
            `
            note_id,
            note_type,
            content,
            vital_signs,
            is_critical,
            requires_doctor_review,
            created_at,
            recorded_by
          `,
          )
          .eq('encounter_id', encounterId)
          .order('created_at', { ascending: false });

        if (error) {
          // Table might not exist or encounter_id column might not exist
          console.warn(
            'Nursing notes query failed, table may not be configured:',
            error.message,
          );
          setNursingNotes([]);
          return;
        }

        // If we have data with recorded_by, fetch staff names separately
        if (data && data.length > 0) {
          const staffIds = [
            ...new Set(data.map((n) => n.recorded_by).filter(Boolean)),
          ];
          let staffMap: Record<
            string,
            { first_name: string; last_name: string }
          > = {};

          if (staffIds.length > 0) {
            const { data: staffData } = await supabase
              .from('staff')
              .select('staff_id, first_name, last_name')
              .in('staff_id', staffIds);

            if (staffData) {
              staffMap = Object.fromEntries(
                staffData.map((s) => [
                  s.staff_id,
                  { first_name: s.first_name, last_name: s.last_name },
                ]),
              );
            }
          }

          // Attach recorder info to notes
          const notesWithRecorder = data.map((note) => ({
            ...note,
            recorder: note.recorded_by ? staffMap[note.recorded_by] : null,
          }));

          setNursingNotes(notesWithRecorder);
        } else {
          setNursingNotes([]);
        }
      } catch (err) {
        console.error('Failed to fetch nursing notes:', err);
        setNursingNotes([]);
      } finally {
        setLoading(false);
      }
    }

    if (encounterId) {
      fetchNursingNotes();
    } else {
      setLoading(false);
    }
  }, [encounterId]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-pink-600 to-pink-500 text-white flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Clipboard size={18} />
          <span className="font-semibold">Nursing Reports</span>
          {nursingNotes.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {nursingNotes.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
            </div>
          ) : nursingNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clipboard size={32} className="mx-auto mb-2 opacity-50" />
              <p>No nursing reports for this encounter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nursingNotes.map((note) => (
                <div
                  key={note.note_id}
                  className={`rounded-lg p-3 border ${
                    note.is_critical
                      ? 'bg-red-50 border-red-200'
                      : note.requires_doctor_review
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          note.is_critical
                            ? 'bg-red-100 text-red-700'
                            : 'bg-pink-100 text-pink-700'
                        }`}
                      >
                        {note.note_type || 'General'}
                      </span>
                      {note.is_critical && (
                        <span className="flex items-center gap-1 text-red-600 text-xs">
                          <AlertTriangle size={12} />
                          Critical
                        </span>
                      )}
                      {note.requires_doctor_review && (
                        <span className="flex items-center gap-1 text-amber-600 text-xs">
                          <AlertCircle size={12} />
                          Needs Review
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(note.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{note.content}</p>
                  {note.recorder && (
                    <div className="mt-2 text-xs text-gray-500">
                      By:{' '}
                      {(() => {
                        const { recorder } = note;
                        if (Array.isArray(recorder) && recorder.length > 0) {
                          return `${recorder[0].first_name || ''} ${recorder[0].last_name || ''}`.trim();
                        }
                        if (!Array.isArray(recorder)) {
                          return `${recorder.first_name} ${recorder.last_name}`;
                        }
                        return 'Unknown';
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MedicationsSection({
  medications,
}: {
  medications: EncounterDetail['medications'];
}) {
  const [expanded, setExpanded] = useState(true);
  const meds = medications || [];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Pill size={18} />
          <span className="font-semibold">Prescriptions</span>
          {meds.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {meds.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="p-4">
          {meds.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Pill size={32} className="mx-auto mb-2 opacity-50" />
              <p>No medications prescribed</p>
            </div>
          ) : (
            <div className="space-y-2">
              {meds.map((rx, idx) => (
                <div
                  key={rx.prescription_id || idx}
                  className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {rx.drug_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {rx.dosage} • {rx.frequency} • {rx.duration} • Qty:{' '}
                      {rx.quantity}
                    </div>
                    {rx.instructions && (
                      <div className="text-xs text-gray-400 mt-1 italic">
                        {rx.instructions}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      rx.status === 'Dispensed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {rx.status || 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LabResultsSection({ labs }: { labs: EncounterDetail['lab_results'] }) {
  const [expanded, setExpanded] = useState(true);
  const labResults = labs || [];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <FlaskConical size={18} />
          <span className="font-semibold">Laboratory Results</span>
          {labResults.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {labResults.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="p-4">
          {labResults.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FlaskConical size={32} className="mx-auto mb-2 opacity-50" />
              <p>No lab tests ordered</p>
            </div>
          ) : (
            <div className="space-y-2">
              {labResults.map((lab, idx) => {
                const statusColor = getStatusColor(lab.status);
                return (
                  <div
                    key={lab.request_id || idx}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {lab.test_name}
                        </span>
                        {lab.is_abnormal && (
                          <AlertTriangle size={14} className="text-red-500" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {lab.category} • Requested:{' '}
                        {formatDate(lab.requested_date)}
                      </div>
                      {lab.result && (
                        <div className="text-sm text-gray-700 mt-1">
                          Result:{' '}
                          <span className="font-medium">{lab.result}</span>
                          {lab.normal_range && (
                            <span className="text-gray-400 ml-2">
                              (Ref: {lab.normal_range})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                    >
                      {lab.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Secure Image Component for Private Buckets
function SecureImage({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;

    // If it's already a full URL (http/https), use it directly
    if (path.startsWith('http')) {
      setSrc(path);
      return;
    }

    // Otherwise, treat as storage path and sign it
    const fetchSignedUrl = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('radiology-images')
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (error) throw error;
        if (data?.signedUrl) {
          setSrc(data.signedUrl);
        }
      } catch (err) {
        console.error('Error signing URL:', err);
        setError(true);
      }
    };

    fetchSignedUrl();
  }, [path]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
      >
        <AlertCircle className="h-8 w-8" />
        <span className="ml-2 text-xs">Failed to load</span>
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${className}`}
      >
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}

function ImagingSection({
  imaging,
}: {
  imaging: EncounterDetail['imaging_results'];
}) {
  const [expanded, setExpanded] = useState(true);
  const imagingResults = imaging || [];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Scan size={18} />
          <span className="font-semibold">Imaging / Radiology</span>
          {imagingResults.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {imagingResults.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="p-4">
          {imagingResults.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Scan size={32} className="mx-auto mb-2 opacity-50" />
              <p>No imaging studies ordered</p>
            </div>
          ) : (
            <div className="space-y-2">
              {imagingResults.map((img, idx) => {
                const statusColor = getStatusColor(img.status);
                return (
                  <div
                    key={img.request_id || idx}
                    className="bg-gray-50 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">
                        {img.exam_name}
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                      >
                        {img.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {img.modality} • Requested:{' '}
                      {formatDate(img.requested_date)}
                    </div>
                    {img.findings && (
                      <div className="mt-2 p-2 bg-white rounded border text-sm text-gray-700">
                        <div className="text-xs text-gray-500 mb-1">
                          Findings:
                        </div>
                        {img.findings}
                      </div>
                    )}
                    {img.impression && (
                      <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200 text-sm text-blue-800">
                        <div className="text-xs text-blue-600 mb-1">
                          Impression:
                        </div>
                        {img.impression}
                      </div>
                    )}
                    {img.result_file_url && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 mb-1">Image:</div>
                        <SecureImage
                          path={img.result_file_url}
                          alt={img.exam_name}
                          className="w-full h-auto rounded-lg border border-gray-200 max-h-96 object-contain bg-black"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function EncounterDetailModal({
  encounterId,
  isOpen,
  onClose,
}: EncounterDetailModalProps) {
  const {
    data: encounter,
    isLoading,
    error,
  } = useEncounterDetails(encounterId);

  useEffect(() => {
    // Prevent body scroll when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 size={40} className="animate-spin text-primary-700" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-96 text-red-500">
            <XCircle size={48} className="mb-4" />
            <p className="text-lg font-medium">
              Failed to load encounter details
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        ) : encounter ? (
          <>
            {/* Professional Header with NDC Branding */}
            <div className="flex-shrink-0 bg-gradient-to-r from-primary-700 via-[#007840] to-primary-600 px-6 py-5">
              <div className="flex items-start justify-between">
                {/* Left: Logo + Patient Info */}
                <div className="flex items-start gap-4">
                  {/* XenoCare Logo */}
                  <div className="flex-shrink-0 bg-white rounded-xl p-2 shadow-lg">
                    
                  </div>

                  {/* Patient & Encounter Info */}
                  <div className="text-white">
                    {/* Patient Name - Prominent */}
                    <div className="text-lg font-bold mb-1">
                      {encounter.patient_name}
                    </div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-base font-semibold text-white/90">
                        {encounter.encounter_number}
                      </h2>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getStatusColor(encounter.status).bg
                        } ${getStatusColor(encounter.status).text}`}
                      >
                        {encounter.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-white/80 text-sm">
                      <span className="flex items-center gap-1.5">
                        <User size={14} />
                        EMR: {encounter.emr_number || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {formatDate(encounter.encounter_date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Stethoscope size={14} />
                        {encounter.visit_type}
                      </span>
                    </div>
                    {encounter.doctor && (
                      <div className="mt-2 text-white/70 text-sm">
                        Attending:{' '}
                        <span className="font-medium text-white">
                          {encounter.doctor.name}
                        </span>
                        {encounter.doctor.specialty &&
                          ` (${encounter.doctor.specialty})`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Print Encounter Summary"
                  >
                    <Printer size={20} />
                  </button>
                  <button
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Download PDF"
                  >
                    <Download size={20} />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Hospital Name */}
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="flex items-center justify-between">
                  <div className="text-white/90 text-sm">
                    <span className="font-semibold">
                      NIGERIAN DEFENCE COLLEGE
                    </span>
                    <span className="mx-2">•</span>
                    <span>Medical Centre</span>
                  </div>
                  <div className="text-white/60 text-xs">
                    Encounter ID: {encounter.encounter_id.substring(0, 8)}...
                  </div>
                </div>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Vitals Summary (if available) */}
                {encounter.vitals && (
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Activity size={16} className="text-primary-700" />
                      Vitals at Encounter
                    </h3>
                    <VitalsCard vitals={encounter.vitals} />
                  </div>
                )}

                {/* Two Column Layout for Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Diagnosis */}
                    <DiagnosisSection encounter={encounter} />

                    {/* Clinical Notes */}
                    <ClinicalNotesSection encounter={encounter} />

                    {/* Nursing Reports */}
                    <NursingNotesSection encounterId={encounter.encounter_id} />
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Medications */}
                    <MedicationsSection medications={encounter.medications} />

                    {/* Lab Results */}
                    <LabResultsSection labs={encounter.lab_results} />

                    {/* Imaging */}
                    <ImagingSection imaging={encounter.imaging_results} />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div>
                  Generated from XenoCare System •{' '}
                  {new Date().toLocaleString()}
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default EncounterDetailModal;
