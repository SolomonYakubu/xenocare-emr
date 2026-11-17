/**
 * =============================================================================
 * XENOCARE EMR - ENCOUNTER CLINICAL REPORT
 * =============================================================================
 * Hospital-Grade Medical Report Export Template
 *
 * Purpose: Generate standardized clinical reports for individual encounters
 * Usage: Documentation, referrals, audits, legal review
 *
 * CORE PRINCIPLES:
 * 1. Encounter is the single source of truth
 * 2. Every section references the Encounter
 * 3. Missing information labeled as "Not Recorded"
 * 4. Suitable for senior consultants, auditors, and legal teams
 * =============================================================================
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  getFacilityAddress,
  getFacilityName,
} from '../../../lib/facility';
import {
  X,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Building2,
  Activity,
  Stethoscope,
  FileText,
  Pill,
  TestTube2,
  Heart,
  ClipboardList,
  Shield,
  AlertCircle,
  Calendar,
  Loader2,
} from 'lucide-react';
import { Encounter } from '../dtos/encounter.dto';

// =============================================================================
// Types & Interfaces
// =============================================================================

interface EncounterClinicalReportProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: Encounter | null;
  // Extended data from related modules (fetched separately)
  vitals?: VitalSigns | null;
  labResults?: LabResult[];
  radiologyResults?: RadiologyResult[];
  prescriptions?: Prescription[];
  nursingNotes?: NursingNote[];
  clinicalNotes?: ClinicalNote[];
  procedures?: Procedure[];
}

interface VitalSigns {
  recorded_at: string;
  temperature?: number;
  pulse?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  pain_score?: number;
  gcs_score?: number;
  recorded_by?: string;
}

interface LabResult {
  id: string;
  test_name: string;
  category: string;
  result?: string;
  unit?: string;
  reference_range?: string;
  status: 'pending' | 'completed' | 'cancelled';
  ordered_at: string;
  completed_at?: string;
  ordered_by?: string;
  is_abnormal?: boolean;
  lab_result?: any;
}

interface RadiologyResult {
  id: string;
  procedure_name: string;
  modality: string;
  status: 'pending' | 'completed' | 'cancelled';
  ordered_at: string;
  completed_at?: string;
  findings?: string;
  impression?: string;
  radiologist?: string;
}

interface Prescription {
  id: string;
  drug_name: string;
  dosage: string;
  route: string;
  frequency: string;
  duration?: string;
  quantity?: number;
  instructions?: string;
  prescribed_at: string;
  prescribed_by?: string;
  status: 'active' | 'completed' | 'cancelled';
}

interface NursingNote {
  id: string;
  note_type: string;
  content: string;
  recorded_at: string;
  recorded_by?: string;
}

interface ClinicalNote {
  id: string;
  note_type: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  recorded_at: string;
  recorded_by?: string;
}

interface Procedure {
  id: string;
  procedure_name: string;
  procedure_type: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  performed_at?: string;
  performed_by?: string;
  notes?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

// =============================================================================
// Constants
// =============================================================================
const CONFIDENTIALITY_NOTICE = `
CONFIDENTIAL MEDICAL RECORD - This document contains protected health information (PHI) 
and is intended solely for the authorized recipient(s). Unauthorized access, disclosure, 
copying, distribution, or use of this information is strictly prohibited and may be 
subject to civil and criminal penalties under applicable laws.
`.trim();

// =============================================================================
// Helper Functions
// =============================================================================

const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Not Recorded';
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid Date';
  }
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Not Recorded';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Invalid Date';
  }
};

const calculateAge = (dob: string | null | undefined): string => {
  if (!dob) return 'Not Recorded';
  try {
    const birthDate = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    if (days < 0) {
      months--;
      const prev = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prev.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years === 0 && months === 0) {
      const weeks = Math.floor(days / 7);
      const rem = days % 7;
      if (weeks > 0 && rem > 0) return `${weeks}w ${rem}d`;
      if (weeks > 0) return `${weeks}w`;
      return `${days}d`;
    }
    if (years === 0) {
      const parts = [`${months}m`];
      if (days > 0) parts.push(`${days}d`);
      return parts.join(' ');
    }
    const parts = [`${years}y`];
    if (months > 0) parts.push(`${months}m`);
    if (days > 0) parts.push(`${days}d`);
    return parts.join(' ');
  } catch {
    return 'Not Recorded';
  }
};

const generateReportId = (encounterId: string): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const shortId = encounterId.slice(0, 8).toUpperCase();
  return `RPT-${shortId}-${timestamp}`;
};

// =============================================================================
// Validation
// =============================================================================

interface ValidationResult {
  errors: ValidationError[]; // Blocking errors - report cannot be generated
  warnings: ValidationError[]; // Non-blocking warnings - report can proceed with notices
}

const validateEncounterForReport = (
  encounter: Encounter | null,
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!encounter) {
    errors.push({
      field: 'encounter',
      message: 'Encounter data is required to generate report',
    });
    return { errors, warnings };
  }

  if (!encounter.id && !encounter.visit_id) {
    errors.push({ field: 'encounter_id', message: 'Encounter ID is missing' });
  }

  // Attending doctor is now a warning, not a blocking error
  // Reports can be generated but will show "Not Assigned" for the doctor
  if (!encounter.attending_doctor_id && !encounter.attending_doctor) {
    warnings.push({
      field: 'attending_doctor',
      message: 'Attending medical officer is not assigned',
    });
  }

  // Diagnosis validation - warning
  if (!encounter.chief_complaint) {
    warnings.push({
      field: 'diagnosis',
      message: 'Chief complaint/diagnosis is not recorded',
    });
  }

  return { errors, warnings };
};

// =============================================================================
// Lab Result Rendering Helper - Hospital Grade & Compact
// =============================================================================

const renderLabResultContent = (lab: LabResult) => {
  const data = lab.lab_result?.structured_result || {};
  const template = lab.lab_result?.result_template_type;
  const components = lab.lab_result?.components || [];
  const interpretation = lab.lab_result?.interpretation;
  const remarks = lab.lab_result?.remarks;

  let content = null;

  // 1. Culture & Sensitivity
  if (template === 'culture_sensitivity') {
    content = (
      <div className="text-xs space-y-2">
        {data.specimenInfo && (
          <div className="grid grid-cols-3 gap-2 bg-gray-50 p-1.5 rounded border border-gray-100">
            <div>
              <span className="text-xs text-gray-500 block uppercase tracking-wide">
                SPECIMEN
              </span>
              <span className="font-semibold text-gray-800">
                {data.specimenInfo.specimenType || '-'}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block uppercase tracking-wide">
                COLLECTED
              </span>
              <span className="font-semibold text-gray-800">
                {data.specimenInfo.collectionDate
                  ? new Date(
                      data.specimenInfo.collectionDate,
                    ).toLocaleDateString()
                  : '-'}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block uppercase tracking-wide">
                QUALITY
              </span>
              <span className="font-semibold text-gray-800">
                {data.specimenInfo.specimenQuality || '-'}
              </span>
            </div>
          </div>
        )}
        {data.microscopy && (
          <div>
            <h5 className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
              <TestTube2 className="h-3 w-3" /> Microscopy
            </h5>
            <div className="bg-white border border-gray-100 rounded">
              {Object.entries(data.microscopy).map(([k, v]) =>
                k !== 'otherFindings' && v ? (
                  <div
                    key={k}
                    className="flex justify-between px-2 py-1 border-b border-gray-50 last:border-0"
                  >
                    <span className="capitalize text-gray-600 font-medium">
                      {k.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {String(v)}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
            {data.microscopy.otherFindings && (
              <div className="mt-1 text-gray-700 bg-gray-50 p-1 rounded italic">
                {data.microscopy.otherFindings}
              </div>
            )}
          </div>
        )}
        {data.cultures &&
          Array.isArray(data.cultures) &&
          data.cultures.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <Activity className="h-3 w-3" /> Culture Results
              </h5>
              {data.cultures.map((c: any, i: number) => (
                <div
                  key={i}
                  className="mb-2 p-1.5 bg-white rounded border border-gray-200 shadow-sm"
                >
                  <div className="flex justify-between font-bold text-gray-800 items-start">
                    <span className="text-secondary-700">
                      Isolate #{i + 1}:{' '}
                      <span className="text-black">{c.organismIsolated}</span>
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded uppercase ${c.growth === 'No Growth' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {c.growth}
                    </span>
                  </div>
                  {(c.colonyCount || c.incubationTime) && (
                    <div className="text-xs text-gray-500 mt-1 grid grid-cols-2">
                      {c.colonyCount && (
                        <span>
                          Count:{' '}
                          <span className="font-medium text-gray-700">
                            {c.colonyCount}
                          </span>
                        </span>
                      )}
                      {c.incubationTime && (
                        <span>
                          Incubation:{' '}
                          <span className="font-medium text-gray-700">
                            {c.incubationTime} hrs
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        {data.sensitivities &&
          Array.isArray(data.sensitivities) &&
          data.sensitivities.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <Pill className="h-3 w-3" /> Antibiotic Susceptibility
              </h5>
              <div className="grid grid-cols-2 gap-3">
                {data.sensitivities.map((s: any, i: number) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded p-1.5 bg-white"
                  >
                    <div className="font-bold text-xs mb-1.5 text-gray-700 border-b border-gray-100 pb-1">
                      {s.organism || 'Organism'}
                    </div>
                    {s.antibiotics &&
                      s.antibiotics.map((ab: any, j: number) => {
                        const res = ab.result || ab.sensitivity;
                        const isSensitive =
                          String(res).startsWith('S') ||
                          String(res) === 'Sensitive';
                        return (
                          <div
                            key={j}
                            className="flex justify-between text-xs border-b border-gray-50 last:border-0 py-0.5"
                          >
                            <span className="text-gray-600">
                              {ab.antibiotic}
                            </span>
                            <span
                              className={`font-bold ${isSensitive ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {res}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    );
  }

  // 2. Parasitology
  else if (template === 'parasite_report') {
    content = (
      <div className="text-xs space-y-2">
        <div
          className={`p-1.5 rounded text-center font-bold uppercase ${data.parasitesFound ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-green-50 text-green-800 border border-green-100'}`}
        >
          {data.parasitesFound ? 'Parasites Detected' : 'No Parasites Detected'}
        </div>
        {data.detections &&
          Array.isArray(data.detections) &&
          data.detections.length > 0 && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-semibold">
                    Organism
                  </th>
                  <th className="text-center py-1 px-2 font-semibold">Stage</th>
                  <th className="text-right py-1 px-2 font-semibold">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.detections.map((d: any, i: number) => (
                  <tr
                    key={i}
                    className="border-b last:border-0 border-gray-100"
                  >
                    <td className="py-1 px-2 font-bold text-gray-800">
                      {d.parasite || d.name}
                    </td>
                    <td className="py-1 px-2 text-center text-gray-600">
                      {d.stage || '-'}
                    </td>
                    <td className="py-1 px-2 text-right text-gray-600">
                      {d.count || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    );
  }

  // 3. Urinalysis Checklist
  else if (template === 'urinalysis_checklist') {
    const sections = ['physical', 'chemical', 'microscopy'];
    content = (
      <div className="grid grid-cols-3 gap-2 text-xs">
        {sections.map((section) => {
          if (!data[section]) return null;
          return (
            <div
              key={section}
              className="border border-gray-200 rounded bg-white overflow-hidden"
            >
              <div className="bg-gray-50 px-2 py-1 border-b border-gray-200 font-bold uppercase text-xs text-gray-600">
                {section}
              </div>
              <div className="p-1.5 space-y-1">
                {Object.entries(data[section]).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="capitalize text-gray-500 truncate pr-1">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 4. Qualitative / Quantitative
  else if (template === 'qualitative_quantitative') {
    content = (
      <div className="flex gap-4 items-center">
        {data.qualitative && (
          <div
            className={`flex-1 p-2 rounded border text-center ${
              ['Positive', 'Reactive'].includes(data.qualitative)
                ? 'bg-red-50 border-red-100 text-red-800'
                : 'bg-green-50 border-green-100 text-green-800'
            }`}
          >
            <div className="text-xs uppercase tracking-wider opacity-70 mb-0.5">
              Result
            </div>
            <div className="text-lg font-bold">{data.qualitative}</div>
          </div>
        )}
        {data.quantitative !== undefined && data.quantitative !== null && (
          <div className="flex-1 p-2 rounded border border-gray-200 bg-white text-center">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-0.5">
              Value
            </div>
            <div className="text-lg font-bold text-blue-900">
              {data.quantitative}{' '}
              <span className="text-sm text-gray-500 font-normal">
                {data.unit || ''}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 5. Binary Metadata (e.g. HIV/Hepatitis kits)
  else if (template === 'binary_metadata') {
    content = (
      <div className="space-y-2">
        {data.result && (
          <div
            className={`p-1.5 rounded text-center border font-bold uppercase text-sm ${
              ['Positive', 'Reactive', 'Detected'].includes(data.result)
                ? 'bg-red-50 border-red-100 text-red-800'
                : 'bg-green-50 border-green-100 text-green-800'
            }`}
          >
            {data.result}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {data.method && (
            <div className="p-1 bg-gray-50 border rounded">
              <span className="block text-gray-500 uppercase">Method</span>
              <span className="font-semibold">{data.method}</span>
            </div>
          )}
          {data.kitLot && (
            <div className="p-1 bg-gray-50 border rounded">
              <span className="block text-gray-500 uppercase">Kit/Lot</span>
              <span className="font-semibold">{data.kitLot}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 6. Narrative / Diagnostic
  else if (template === 'narrative_diagnostic') {
    content = (
      <div className="text-sm space-y-2">
        {data.findings && (
          <div className="p-2 border border-blue-100 bg-blue-50/30 rounded">
            <h5 className="text-xs font-bold uppercase text-blue-800 mb-1">
              Diagnostic Findings
            </h5>
            <p className="text-gray-800 whitespace-pre-wrap">{data.findings}</p>
          </div>
        )}
        {data.impression && (
          <div className="p-2 border border-amber-100 bg-amber-50/30 rounded">
            <h5 className="text-xs font-bold uppercase text-amber-800 mb-1">
              Pathologist Impression
            </h5>
            <p className="font-semibold text-amber-900">{data.impression}</p>
          </div>
        )}
        {data.recommendation && (
          <div className="mt-1">
            <span className="text-xs font-bold text-gray-600">
              Recommendation:{' '}
            </span>
            <span className="text-xs text-gray-800">{data.recommendation}</span>
          </div>
        )}
      </div>
    );
  }

  // 7. Numeric Timing
  else if (template === 'numeric_timing') {
    const readings = data.readings || data.results || [];
    content = (
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-1.5">Time/Param</th>
              <th className="p-1.5">Value</th>
              <th className="p-1.5">Unit</th>
              <th className="p-1.5">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {readings.map((r: any, i: number) => (
              <tr key={i}>
                <td className="p-1.5 font-medium">
                  {r.timePoint || r.parameter}
                </td>
                <td className="p-1.5 font-bold">{r.value}</td>
                <td className="p-1.5 text-gray-500">{r.unit}</td>
                <td className="p-1.5">{r.flag || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 8. Components (General / Chemical / Hematology fallback)
  else if (
    components.length > 0 ||
    template === 'panel' ||
    (data.parameters && data.parameters.length) ||
    (data.results && data.results.length)
  ) {
    const items =
      components.length > 0
        ? components
        : data.parameters || data.results || [];
    content = (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
            <th className="pb-1 pl-1">Test</th>
            <th className="pb-1">Result</th>
            <th className="pb-1">Unit</th>
            <th className="pb-1">Ref. Range</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item: any, i: number) => {
            const name = item.component_name || item.name || item.parameter;
            const val =
              item.resultValue ??
              (item.result_value ||
                item.result_text ||
                item.value ||
                item.result);
            const unit = item.result_unit || item.unit || '';
            const ref =
              item.reference_range ||
              item.reference ||
              item.referenceRange ||
              '';
            const isAbnormal =
              item.result_status === 'Abnormal' ||
              item.flag === 'H' ||
              item.flag === 'L' ||
              item.flag === 'High' ||
              item.flag === 'Low' ||
              item.isAbnormal ||
              item.result_status === 'Critical' ||
              item.flag === 'C';
            const isCritical =
              item.result_status === 'Critical' ||
              item.flag === 'C' ||
              item.flag === 'CC' ||
              item.flag === 'Critical Low' ||
              item.flag === 'Critical High' ||
              item.isCritical;

            return (
              <tr
                key={i}
                className={`${isCritical ? 'bg-red-50' : isAbnormal ? 'bg-amber-50' : ''}`}
              >
                <td className="py-1.5 pl-1 font-medium text-gray-800">
                  {name}
                </td>
                <td
                  className={`py-1.5 ${isCritical ? 'text-red-700 font-black' : isAbnormal ? 'text-amber-700 font-bold' : 'text-gray-900'}`}
                >
                  {val}
                </td>
                <td className="py-1.5 text-gray-500">{unit}</td>
                <td className="py-1.5 text-gray-400 text-xs">{ref}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // Fallback: Result string
  else {
    content = (
      <div className="text-sm">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-lg text-gray-900">
            {lab.result || 'No Result'}
          </span>
          <span className="text-gray-500">{lab.unit}</span>
        </div>
        {lab.reference_range && (
          <div className="text-xs text-gray-500">
            Ref: {lab.reference_range}
          </div>
        )}
        {lab.is_abnormal && (
          <span className="text-xs font-bold text-red-600 uppercase border border-red-200 px-1 rounded">
            Abnormal
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {content}

      {/* Append Interpretation & Remarks if present */}
      {(interpretation || remarks) && (
        <div className="mt-1 pt-2 border-t border-gray-100 grid gap-2">
          {interpretation && (
            <div className="bg-blue-50/50 p-2 rounded border border-blue-100">
              <p className="text-xs font-bold text-blue-700 uppercase mb-0.5">
                Interpretation
              </p>
              <p className="text-xs text-blue-900">{interpretation}</p>
            </div>
          )}
          {remarks && (
            <div className="bg-gray-50 p-2 rounded border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase mb-0.5">
                Remarks
              </p>
              <p className="text-xs text-gray-700 italic">{remarks}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Sub-Components
// =============================================================================

const SectionHeader: React.FC<{ title: string; icon?: React.ReactNode }> = ({
  title,
  icon,
}) => (
  <div className="flex items-center gap-2 border-b-2 border-primary-700 pb-2 mb-4 mt-6 print:mt-4">
    {icon && <span className="text-primary-700">{icon}</span>}
    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
      {title}
    </h2>
  </div>
);

const DataField: React.FC<{
  label: string;
  value: string | number | null | undefined;
  className?: string;
  isHighlighted?: boolean;
}> = ({ label, value, className = '', isHighlighted = false }) => {
  const displayValue =
    value === null || value === undefined || value === ''
      ? 'Not Recorded'
      : String(value);
  const isNotRecorded = displayValue === 'Not Recorded';

  return (
    <div className={`${className}`}>
      <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
        {label}
      </p>
      <p
        className={`text-sm mt-0.5 ${
          isNotRecorded
            ? 'text-gray-400 italic'
            : isHighlighted
              ? 'font-semibold text-gray-900'
              : 'text-gray-800'
        }`}
      >
        {displayValue}
      </p>
    </div>
  );
};

const ValidationErrorDisplay: React.FC<{
  errors: ValidationError[];
  onClose: () => void;
}> = ({ errors, onClose }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
      <div className="flex items-center gap-3 text-red-600 mb-4">
        <AlertTriangle className="h-8 w-8" />
        <h2 className="text-xl font-bold">Report Cannot Be Generated</h2>
      </div>
      <p className="text-gray-600 mb-4">
        The following required information is missing or invalid:
      </p>
      <ul className="space-y-2 mb-6">
        {errors.map((error, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-gray-900">
                {error.field}:
              </span>{' '}
              <span className="text-gray-600">{error.message}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500 mb-4">
        Please ensure all required fields are completed in the encounter record
        before generating the report.
      </p>
      <button
        onClick={onClose}
        className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
      >
        Close
      </button>
    </div>
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

export function EncounterClinicalReport({
  isOpen,
  onClose,
  encounter,
  vitals,
  labResults = [],
  radiologyResults = [],
  prescriptions = [],
  nursingNotes = [],
  clinicalNotes = [],
  procedures = [],
}: EncounterClinicalReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const [validationWarnings, setValidationWarnings] = useState<
    ValidationError[]
  >([]);
  const [showValidationError, setShowValidationError] = useState(false);

  // Validate encounter when modal opens
  useEffect(() => {
    if (isOpen && encounter) {
      const { errors, warnings } = validateEncounterForReport(encounter);
      setValidationErrors(errors);
      setValidationWarnings(warnings);
      // Only block report for actual errors, not warnings
      if (errors.length > 0) {
        setShowValidationError(true);
      }
    }
  }, [isOpen, encounter]);

  if (!isOpen) return null;

  // Show validation errors only if there are blocking errors
  if (showValidationError && validationErrors.length > 0) {
    return (
      <ValidationErrorDisplay
        errors={validationErrors}
        onClose={() => {
          setShowValidationError(false);
          onClose();
        }}
      />
    );
  }

  if (!encounter) return null;

  // Generate report metadata
  const reportId = generateReportId(encounter.id);
  const generatedAt = new Date().toLocaleString('en-GB');
  const pageGeneratedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Extract encounter data
  const encounterId =
    encounter.visit_id || encounter.encounter_number || encounter.id;
  const encounterDate = formatDateTime(
    encounter.encounter_date || encounter.created_at,
  );
  const encounterType = encounter.visit_type || 'Not Specified';
  const department = encounter.clinic?.clinic_name || 'General Out-Patient';
  const priority = encounter.priority || 'Normal';

  // Patient data
  const patientName = encounter.patient
    ? `${encounter.patient.first_name} ${encounter.patient.surname || encounter.patient.last_name || ''}`.trim()
    : 'Not Recorded';
  const emrNumber =
    encounter.patient?.emr_number || encounter.emr_number || 'Not Recorded';
  const patientDOB = encounter.patient?.date_of_birth;
  const patientAge = calculateAge(patientDOB);
  const patientGender = encounter.patient?.gender || 'Not Recorded';
  const patientPhone =
    encounter.patient?.contact_phone ||
    encounter.patient?.phone ||
    'Not Recorded';

  // Attending doctor
  const attendingDoctor = encounter.attending_doctor
    ? `${encounter.attending_doctor.rank ? `${encounter.attending_doctor.rank} ` : ''}${encounter.attending_doctor.first_name} ${encounter.attending_doctor.last_name}`.trim()
    : 'Not Assigned';

  // Clinical data
  const chiefComplaint = encounter.chief_complaint || 'Not Recorded';
  const currentStage =
    encounter.current_stage?.replace(/_/g, ' ') || 'Not Recorded';
  const status = encounter.status || 'Active';

  // Separate completed and pending investigations
  const completedLabs = labResults.filter((l) => l.status === 'completed');
  const pendingLabs = labResults.filter((l) => l.status === 'pending');
  const completedRadiology = radiologyResults.filter(
    (r) => r.status === 'completed',
  );
  const pendingRadiology = radiologyResults.filter(
    (r) => r.status === 'pending',
  );

  // Active prescriptions
  const activePrescriptions = prescriptions.filter(
    (p) => p.status === 'active',
  );
  const completedProcedures = procedures.filter(
    (p) => p.status === 'completed',
  );

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-auto print:bg-white print:static print:overflow-visible">
      {/* Print Controls - Hidden on print */}
      <div className="fixed top-4 right-4 flex gap-2 z-[60] print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-800 transition-colors shadow-lg"
        >
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Report Document */}
      <div
        ref={reportRef}
        className="bg-white w-full max-w-[210mm] mx-auto my-4 shadow-2xl print:shadow-none print:my-0 print:max-w-none"
        style={{ minHeight: '297mm' }}
      >
        {/* ================================================================= */}
        {/* 1. REPORT HEADER */}
        {/* ================================================================= */}
        <div className="bg-gradient-to-r from-primary-700 to-[#008545] text-white p-6 print:p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              
              <div>
                <h1 className="text-xl font-bold tracking-wide">
                  {getFacilityName().toUpperCase()}
                </h1>
                <p className="text-sm text-white/80">
                  {getFacilityAddress()}
                </p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">Report ID: {reportId}</p>
              <p className="text-white/80">Generated: {generatedAt}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/20">
            <h2 className="text-2xl font-bold text-center tracking-widest">
              ENCOUNTER CLINICAL REPORT
            </h2>
          </div>
        </div>

        {/* Confidentiality Notice */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 print:px-4 print:py-1">
          <p className="text-xs text-amber-800 text-center italic">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            {CONFIDENTIALITY_NOTICE}
          </p>
        </div>

        {/* Validation Warnings Banner - shows when report proceeds despite warnings */}
        {validationWarnings.length > 0 && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 print:px-4 print:py-1 print:hidden">
            <div className="flex items-center gap-2 text-xs text-yellow-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">Note:</span>
              <span>{validationWarnings.map((w) => w.message).join('; ')}</span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="px-8 py-6 print:px-6 print:py-4 space-y-2">
          {/* ================================================================= */}
          {/* 2. PATIENT & ENCOUNTER IDENTIFICATION */}
          {/* ================================================================= */}
          <SectionHeader
            title="Patient & Encounter Identification"
            icon={<User className="h-5 w-5" />}
          />

          <div className="grid grid-cols-2 gap-6 print:gap-4">
            {/* Patient Information */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase">
                Patient Information
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <DataField
                  label="Full Name"
                  value={patientName}
                  isHighlighted
                  className="col-span-2"
                />
                <DataField
                  label="Hospital/Patient number"
                  value={emrNumber}
                  isHighlighted
                />
                <DataField label="Age" value={patientAge} />
                <DataField label="Sex" value={patientGender} />
                <DataField
                  label="Date of Birth"
                  value={formatDate(patientDOB)}
                />
                <DataField
                  label="Contact Phone"
                  value={patientPhone}
                  className="col-span-2"
                />
              </div>
            </div>

            {/* Encounter Information */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-sm font-bold text-blue-800 mb-3 uppercase">
                Encounter Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <DataField
                  label="Encounter ID"
                  value={encounterId}
                  isHighlighted
                  className="col-span-2"
                />
                <DataField
                  label="Encounter Date & Time"
                  value={encounterDate}
                />
                <DataField label="Encounter Type" value={encounterType} />
                <DataField label="Department/Unit" value={department} />
                <DataField label="Priority" value={priority} />
                <DataField label="Current Status" value={status} />
                <DataField label="Workflow Stage" value={currentStage} />
              </div>
            </div>
          </div>

          {/* Attending Medical Officer */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-100 mt-4">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-green-700" />
              <span className="text-sm font-bold text-green-800 uppercase">
                Attending Medical Officer:
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {attendingDoctor}
              </span>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 3. PRESENTING COMPLAINT & HISTORY */}
          {/* ================================================================= */}
          <SectionHeader
            title="Presenting Complaint & History"
            icon={<FileText className="h-5 w-5" />}
          />

          <div className="space-y-4">
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <h3 className="text-sm font-bold text-amber-800 mb-2">
                Chief Complaint
              </h3>
              <p
                className={`text-sm ${chiefComplaint === 'Not Recorded' ? 'text-gray-400 italic' : 'text-gray-800'}`}
              >
                {chiefComplaint}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h3 className="text-sm font-bold text-gray-700 mb-2">
                  History of Presenting Illness
                </h3>
                <p className="text-sm text-gray-400 italic">Not Recorded</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h3 className="text-sm font-bold text-gray-700 mb-2">
                  Past Medical History
                </h3>
                <p className="text-sm text-gray-400 italic">Not Recorded</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h3 className="text-sm font-bold text-gray-700 mb-2">
                  Drug History
                </h3>
                <p className="text-sm text-gray-400 italic">Not Recorded</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                <h3 className="text-sm font-bold text-red-700 mb-2">
                  Known Allergies
                </h3>
                <p className="text-sm text-gray-400 italic">Not Recorded</p>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 4. CLINICAL EXAMINATION */}
          {/* ================================================================= */}
          <SectionHeader
            title="Clinical Examination"
            icon={<Activity className="h-5 w-5" />}
          />

          {/* Vital Signs */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Vital Signs
              {vitals && (
                <span className="text-xs font-normal text-blue-600">
                  ({formatDateTime(vitals.recorded_at)})
                </span>
              )}
            </h3>

            {vitals ? (
              <div className="grid grid-cols-4 gap-4 print:grid-cols-5">
                <div className="bg-white rounded-lg p-3 text-center border">
                  <p className="text-xs text-gray-500 uppercase">Temperature</p>
                  <p className="text-lg font-bold text-gray-900">
                    {vitals.temperature ?? '--'}°C
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border">
                  <p className="text-xs text-gray-500 uppercase">Pulse</p>
                  <p className="text-lg font-bold text-gray-900">
                    {vitals.pulse ?? '--'} bpm
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border">
                  <p className="text-xs text-gray-500 uppercase">
                    Blood Pressure
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {vitals.blood_pressure_systolic ?? '--'}/
                    {vitals.blood_pressure_diastolic ?? '--'} mmHg
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border">
                  <p className="text-xs text-gray-500 uppercase">Resp. Rate</p>
                  <p className="text-lg font-bold text-gray-900">
                    {vitals.respiratory_rate ?? '--'} /min
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border">
                  <p className="text-xs text-gray-500 uppercase">SpO₂</p>
                  <p className="text-lg font-bold text-gray-900">
                    {vitals.oxygen_saturation ?? '--'}%
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border">
                  <p className="text-xs text-gray-500 uppercase">Weight</p>
                  <p className="text-lg font-bold text-gray-900">
                    {vitals.weight ?? '--'} kg
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border">
                  <p className="text-xs text-gray-500 uppercase">Height</p>
                  <p className="text-lg font-bold text-gray-900">
                    {vitals.height ?? '--'} cm
                  </p>
                </div>
                {vitals.pain_score !== undefined && (
                  <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
                    <p className="text-xs text-gray-500 uppercase">
                      Pain Score
                    </p>
                    <p className="text-lg font-bold text-orange-600">
                      {vitals.pain_score}/10
                    </p>
                  </div>
                )}
                {vitals.gcs_score !== undefined && (
                  <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
                    <p className="text-xs text-gray-500 uppercase">GCS</p>
                    <p className="text-lg font-bold text-purple-600">
                      {vitals.gcs_score}/15
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic text-center py-4">
                Vital signs not recorded for this encounter
              </p>
            )}
          </div>

          {/* Examination Findings */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h3 className="text-sm font-bold text-gray-700 mb-2">
                General Examination
              </h3>
              <p className="text-sm text-gray-400 italic">Not Recorded</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h3 className="text-sm font-bold text-gray-700 mb-2">
                Systemic Examination
              </h3>
              <p className="text-sm text-gray-400 italic">Not Recorded</p>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 5. INVESTIGATIONS */}
          {/* ================================================================= */}
          <SectionHeader
            title="Investigations"
            icon={<TestTube2 className="h-5 w-5" />}
          />

          {/* Laboratory Investigations */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700">
              Laboratory Investigations
            </h3>

            {labResults.length > 0 ? (
              <>
                {/* Completed Results */}
                {completedLabs.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <h4 className="text-xs font-semibold text-green-700 uppercase mb-3 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Completed ({completedLabs.length})
                    </h4>
                    <div className="space-y-4">
                      {completedLabs.map((lab) => (
                        <div
                          key={lab.id}
                          className="bg-white rounded border border-green-100 overflow-hidden shadow-sm"
                        >
                          <div className="bg-green-50/50 px-3 py-2 border-b border-green-100 flex justify-between items-center">
                            <div>
                              <span className="font-bold text-gray-800 text-sm">
                                {lab.test_name}
                              </span>
                              {lab.category && (
                                <span className="text-xs text-gray-500 ml-2">
                                  ({lab.category})
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(lab.completed_at)}
                            </span>
                          </div>
                          <div className="p-3">
                            {renderLabResultContent(lab)}
                          </div>
                          {/* Signatures/Metadata for report */}
                          {lab.lab_result?.uploader && (
                            <div className="px-3 py-1 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
                              <span>
                                Perf: {lab.lab_result.uploader.first_name}{' '}
                                {lab.lab_result.uploader.last_name}
                              </span>
                              {lab.lab_result.verifier && (
                                <span>
                                  Ver: {lab.lab_result.verifier.first_name}{' '}
                                  {lab.lab_result.verifier.last_name}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Investigations */}
                {pendingLabs.length > 0 && (
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <h4 className="text-xs font-semibold text-amber-700 uppercase mb-3 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Pending ({pendingLabs.length})
                    </h4>
                    <ul className="space-y-1">
                      {pendingLabs.map((lab) => (
                        <li
                          key={lab.id}
                          className="text-sm text-gray-700 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 bg-amber-400 rounded-full" />
                          {lab.test_name}
                          <span className="text-xs text-gray-500">
                            - Ordered: {formatDateTime(lab.ordered_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-4 text-center">
                No laboratory investigations ordered for this encounter
              </p>
            )}

            {/* Radiology Investigations */}
            <h3 className="text-sm font-bold text-gray-700 mt-4">
              Radiology/Imaging
            </h3>

            {radiologyResults.length > 0 ? (
              <div className="space-y-3">
                {radiologyResults.map((rad) => (
                  <div
                    key={rad.id}
                    className={`rounded-lg p-4 border ${
                      rad.status === 'completed'
                        ? 'bg-green-50 border-green-100'
                        : 'bg-amber-50 border-amber-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">
                        {rad.procedure_name}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          rad.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {rad.status.toUpperCase()}
                      </span>
                    </div>
                    {rad.findings && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 uppercase">
                          Findings
                        </p>
                        <p className="text-sm text-gray-700">{rad.findings}</p>
                      </div>
                    )}
                    {rad.impression && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 uppercase">
                          Impression
                        </p>
                        <p className="text-sm text-gray-700 font-medium">
                          {rad.impression}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-4 text-center">
                No radiology/imaging investigations ordered for this encounter
              </p>
            )}
          </div>

          {/* ================================================================= */}
          {/* 6. DIAGNOSIS */}
          {/* ================================================================= */}
          <SectionHeader
            title="Diagnosis"
            icon={<ClipboardList className="h-5 w-5" />}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <h3 className="text-sm font-bold text-amber-800 mb-2">
                Provisional Diagnosis
              </h3>
              <p
                className={`text-sm ${chiefComplaint === 'Not Recorded' ? 'text-gray-400 italic' : 'text-gray-800'}`}
              >
                {chiefComplaint}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <h3 className="text-sm font-bold text-green-800 mb-2">
                Final Diagnosis
              </h3>
              <p className="text-sm text-gray-400 italic">Not Recorded</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border mt-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">
              ICD-10 Codes
            </h3>
            <p className="text-sm text-gray-400 italic">Not Recorded</p>
          </div>

          {/* ================================================================= */}
          {/* 7. TREATMENT & ORDERS */}
          {/* ================================================================= */}
          <SectionHeader
            title="Treatment & Orders"
            icon={<Pill className="h-5 w-5" />}
          />

          {/* Medications */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700">
              Medications Prescribed
            </h3>

            {prescriptions.length > 0 ? (
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase border-b border-purple-200">
                      <th className="pb-2">Medication</th>
                      <th className="pb-2">Dose</th>
                      <th className="pb-2">Route</th>
                      <th className="pb-2">Frequency</th>
                      <th className="pb-2">Duration</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((rx) => (
                      <tr
                        key={rx.id}
                        className="border-b border-purple-100 last:border-0"
                      >
                        <td className="py-2 font-medium">{rx.drug_name}</td>
                        <td className="py-2">{rx.dosage}</td>
                        <td className="py-2">{rx.route}</td>
                        <td className="py-2">{rx.frequency}</td>
                        <td className="py-2">{rx.duration || '--'}</td>
                        <td className="py-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              rx.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {rx.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-4 text-center">
                No medications prescribed for this encounter
              </p>
            )}

            {/* Procedures */}
            <h3 className="text-sm font-bold text-gray-700 mt-4">
              Procedures Performed
            </h3>

            {procedures.length > 0 ? (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                {procedures.map((proc) => (
                  <div
                    key={proc.id}
                    className="py-2 border-b border-blue-100 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {proc.procedure_name}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          proc.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {proc.status.toUpperCase()}
                      </span>
                    </div>
                    {proc.performed_by && (
                      <p className="text-xs text-gray-500 mt-1">
                        Performed by: {proc.performed_by}
                      </p>
                    )}
                    {proc.notes && (
                      <p className="text-sm text-gray-600 mt-1">{proc.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-4 text-center">
                No procedures performed during this encounter
              </p>
            )}

            {/* Other Orders */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">
                  IV Fluids
                </h4>
                <p className="text-sm text-gray-400 italic">Not Recorded</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">
                  Oxygen Therapy
                </h4>
                <p className="text-sm text-gray-400 italic">Not Recorded</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">
                  Blood Products
                </h4>
                <p className="text-sm text-gray-400 italic">Not Recorded</p>
              </div>
            </div>

            {/* Referrals */}
            <div className="bg-gray-50 rounded-lg p-4 border mt-4">
              <h4 className="text-xs font-bold text-gray-600 uppercase mb-2">
                Referrals Made
              </h4>
              <p className="text-sm text-gray-400 italic">
                No referrals recorded
              </p>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 8. CLINICAL NOTES & ASSESSMENT */}
          {/* ================================================================= */}
          <SectionHeader
            title="Clinical Notes & Assessment"
            icon={<FileText className="h-5 w-5" />}
          />

          {clinicalNotes.length > 0 ? (
            <div className="space-y-4">
              {clinicalNotes.map((note) => (
                <div key={note.id} className="bg-gray-50 rounded-lg p-4 border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700 uppercase">
                      {note.note_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(note.recorded_at)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {note.subjective && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase">
                          Subjective
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {note.subjective}
                        </p>
                      </div>
                    )}
                    {note.objective && (
                      <div>
                        <p className="text-xs font-semibold text-green-600 uppercase">
                          Objective
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {note.objective}
                        </p>
                      </div>
                    )}
                    {note.assessment && (
                      <div>
                        <p className="text-xs font-semibold text-amber-600 uppercase">
                          Assessment
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {note.assessment}
                        </p>
                      </div>
                    )}
                    {note.plan && (
                      <div>
                        <p className="text-xs font-semibold text-purple-600 uppercase">
                          Plan
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          {note.plan}
                        </p>
                      </div>
                    )}
                  </div>
                  {note.recorded_by && (
                    <p className="text-xs text-gray-500 mt-3 pt-2 border-t">
                      Recorded by: {note.recorded_by}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 border">
              <p className="text-sm text-gray-400 italic text-center">
                No clinical notes recorded for this encounter
              </p>
            </div>
          )}

          {/* ================================================================= */}
          {/* 9. OUTCOME & DISPOSITION */}
          {/* ================================================================= */}
          <SectionHeader
            title="Outcome & Disposition"
            icon={<Shield className="h-5 w-5" />}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h3 className="text-sm font-bold text-gray-700 mb-3">
                Disposition
              </h3>
              <div className="space-y-2">
                <DataField label="Outcome" value={status} isHighlighted />
                <DataField label="Discharge Date/Time" value="Not Recorded" />
                <DataField label="Discharge Type" value="Not Recorded" />
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h3 className="text-sm font-bold text-gray-700 mb-3">
                Follow-up
              </h3>
              <div className="space-y-2">
                <DataField
                  label="Follow-up Instructions"
                  value="Not Recorded"
                />
                <DataField label="Next Appointment" value="Not Recorded" />
                <DataField label="Return If" value="Not Recorded" />
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 10. AUTHENTICATION */}
          {/* ================================================================= */}
          <SectionHeader
            title="Authentication"
            icon={<Stethoscope className="h-5 w-5" />}
          />

          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Medical Officer Name
                  </p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {attendingDoctor}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Rank/Designation
                  </p>
                  <p className="text-sm text-gray-800 mt-1">
                    {encounter.attending_doctor?.rank || 'Not Recorded'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    MDCN License Number
                  </p>
                  <p className="text-sm text-gray-400 italic mt-1">
                    Not Recorded
                  </p>
                </div>
              </div>
              <div className="flex flex-col justify-end">
                <div className="border-t-2 border-gray-400 pt-2 mt-8">
                  <p className="text-xs text-gray-500 text-center">
                    Digital Signature / Approval
                  </p>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    Approved on: {generatedAt}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 11. FOOTER METADATA */}
        {/* ================================================================= */}
        <div className="bg-gray-100 px-8 py-4 print:px-6 border-t mt-auto">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="space-y-1">
              <p>
                <strong>Encounter ID:</strong> {encounterId}
              </p>
              <p>
                <strong>Report ID:</strong> {reportId}
              </p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">
                XenoCare Electronic Medical Records
              </p>
              <p>Export Timestamp: {generatedAt}</p>
            </div>
            <div className="text-right">
              <p>Page 1 of 1</p>
              <p>This is a computer-generated document</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .fixed {
            position: static !important;
          }
          [class*="print\\:"] {
            visibility: visible;
          }
          #root {
            display: none;
          }
        }
        @page {
          size: A4;
          margin: 10mm;
        }
      `}</style>
    </div>
  );
}

export default EncounterClinicalReport;
