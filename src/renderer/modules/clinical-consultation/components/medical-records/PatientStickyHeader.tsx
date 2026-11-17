/**
 * =============================================================================
 * XENOCARE EMR - PATIENT PROFILE HEADER
 * Document-style clinical profile card with all patient overview details
 * Replaces sidebar - serves as the single source of patient context
 * =============================================================================
 */

import {
  isMilitaryFeatureEnabled,
  isNhisFeatureEnabled,
} from '../../../../config/features';
import React, { useState, useCallback } from 'react';
import { ChevronDown, Copy, Check, AlertTriangle } from 'lucide-react';
import {
  PatientHeaderData,
  VitalSnapshot,
  MedicationSummary,
  PatientProblem,
  AllergyInfo,
  EncounterDetail,
} from '../../api/medical-records.api';

// =============================================================================
// Types
// =============================================================================

interface PatientProfileHeaderProps {
  patient: PatientHeaderData;
  encounter?: EncounterDetail; // NEW: Encounter context
  latestVitals?: VitalSnapshot;
  currentMedications: MedicationSummary[];
  problems: PatientProblem[];
  encounterStats?: {
    total: number;
    activeProblems: number;
    labCount: number;
    rxCount: number;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(dateString: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDate(dateString: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function getInitials(firstName: string, surname: string): string {
  return `${firstName?.charAt(0) || ''}${surname?.charAt(0) || ''}`.toUpperCase();
}

function getAge(dob: string, age: string | number): string {
  if (!dob && !age) return '';
  if (!dob) return `${age}y`;
  const today = new Date();
  const birthDate = new Date(dob);
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
}

// =============================================================================
// Main Component - Document Style Profile
// =============================================================================

export function PatientStickyHeader({
  patient,
  encounter,
  latestVitals,
  currentMedications = [],
  problems = [],
  encounterStats,
}: PatientProfileHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [showAllProblems, setShowAllProblems] = useState(false);

  // Build full name with rank and title
  const rankPrefix = patient.rank ? `${patient.rank} ` : '';
  const titlePrefix = patient.title ? `${patient.title} ` : '';
  const baseName = [patient.first_name, patient.middle_name, patient.surname]
    .filter(Boolean)
    .join(' ');
  const fullName = `${rankPrefix}${titlePrefix}${baseName}`.trim();

  const gender = patient.gender?.toLowerCase() === 'male' ? 'M' : 'F';
  const age = getAge(patient.date_of_birth, patient.age);
  const isDependent = patient.patient_type === 'Dependent';

  const handleCopyEMR = useCallback(async () => {
    await navigator.clipboard.writeText(patient.emr_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [patient.emr_number]);

  // Insurance display
  const getInsuranceLabel = () => {
    const insType = (patient.insurance_type || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .trim();
    if (!isNhisFeatureEnabled() && insType.includes('nhis')) {
      return 'Private Pay';
    }
    if (insType === 'dhml' || insType === 'military nhis')
      return 'Military NHIS';
    if (insType === 'security services nhis') return 'Security Services NHIS';
    if (insType === 'gifship') return 'GIFSHIP';
    if (insType.includes('nhis')) return 'NHIS';
    if (insType.includes('retainer') || insType.includes('corporate'))
      return 'Retainership';
    if (insType === 'private') return 'Private Pay';
    return 'Self-Pay';
  };

  const hasAllergies = patient.allergies && patient.allergies.length > 0;
  const hasSevereAllergies =
    hasAllergies &&
    patient.allergies?.some(
      (a) => a.severity === 'Severe' || a.severity === 'Life-threatening',
    );

  const activeProblems = problems.filter(
    (p) => p.status === 'Active' || p.status === 'Chronic',
  );
  const displayProblems = showAllProblems ? problems : problems.slice(0, 3);

  return (
    <div className="bg-[#fcfcfd] border-b border-slate-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.01)] relative overflow-hidden">
      {/* Decorative Document Elements */}
      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-700" />
      <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.02] pointer-events-none">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full text-slate-900 fill-current"
        >
          <path d="M0 0 L100 0 L100 100 Z" />
        </svg>
      </div>

      {/* Critical Alert Banner - Modern & Minimal */}
      {patient.critical_alerts && patient.critical_alerts.length > 0 && (
        <div className="bg-red-600/95 backdrop-blur-sm text-white text-center text-xs py-1.5 font-black uppercase tracking-[0.2em] shadow-lg">
          {patient.critical_alerts.join(' • ')}
        </div>
      )}

      {/* Main Document Body - Compact */}
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          {/* Identity Section - Compact */}
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="h-14 w-14 rounded-xl bg-slate-900 flex items-center justify-center text-xl font-serif font-black text-white shadow-md flex-shrink-0">
              {patient.photo_url ? (
                <img
                  src={patient.photo_url}
                  alt={fullName}
                  className="h-full w-full object-cover rounded-xl"
                />
              ) : (
                <span>{getInitials(patient.first_name, patient.surname)}</span>
              )}
            </div>

            {/* Name Block - Inline */}
            <div className="min-w-0 flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-12 flex-shrink-0">
                  Name:
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight [text-rendering:optimizeLegibility]">
                  {fullName}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-12 flex-shrink-0">
                  EMR No:
                </span>
                <button
                  onClick={handleCopyEMR}
                  className="font-mono text-sm font-black text-primary-700 bg-emerald-50 px-3 py-1 rounded-lg border-2 border-emerald-200 hover:bg-emerald-100 flex items-center gap-2 transition-colors shadow-sm"
                >
                  {patient.emr_number}
                  {copied ? (
                    <Check size={14} className="text-emerald-600" />
                  ) : (
                    <Copy size={14} className="opacity-60" />
                  )}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-800">
                <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sex
                  </span>
                  <span>{gender === 'M' ? 'Male' : 'Female'}</span>
                </div>

                <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Age
                  </span>
                  <span>{age}</span>
                </div>

                {isMilitaryFeatureEnabled() &&
                  (patient.military_branch || patient.service_number) && (
                  <div className="flex items-center gap-2">
                    {patient.military_branch && (
                      <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-950">
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">
                          Service
                        </span>
                        <span>{patient.military_branch}</span>
                      </div>
                    )}
                    {patient.service_number && (
                      <div className="flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-sky-950">
                        <span className="text-xs font-semibold uppercase tracking-wide text-sky-800/80">
                          Svc no
                        </span>
                        <span>{patient.service_number}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Stamps - Compact */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Insurance Badge */}
            <div
              className={`px-4 py-2 rounded-lg border-2 text-center min-w-[90px] ${
                (() => {
                  const t = (patient.insurance_type || '')
                    .toLowerCase()
                    .replace(/_/g, ' ')
                    .trim();
                  return (
                    t.includes('nhis') ||
                    t === 'dhml' ||
                    t === 'gifship' ||
                    t.includes('retainer')
                  );
                })()
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-slate-50 border-slate-300 text-slate-700'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-tight block leading-none opacity-70">
                Financial
              </span>
              <span className="text-sm font-black block leading-none mt-1">
                {getInsuranceLabel()}
              </span>
            </div>

            {/* Allergy Badge */}
            {hasAllergies && (
              <div
                className={`px-4 py-2 rounded-lg border-2 text-center min-w-[90px] ${
                  hasSevereAllergies
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-amber-50 border-amber-300 text-amber-700'
                }`}
              >
                <span className="text-xs font-black uppercase tracking-tight block leading-none opacity-70">
                  Alerts
                </span>
                <span className="text-sm font-black block leading-none mt-1 flex items-center justify-center gap-1">
                  <AlertTriangle size={12} />
                  {patient.allergies?.length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Clinical Summary Stats - Single Row */}
        <div className="flex items-stretch gap-6 mt-4 pt-4 border-t-2 border-slate-200">
          {/* Encounter Lifecycle */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
              <div className="w-1.5 h-3 bg-blue-500 rounded-full" />
              Encounter
            </h3>
            {encounter ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="font-black text-slate-800">
                  {encounter.visit_type}
                </span>
                <span className="text-slate-400 font-bold">|</span>
                <span className="font-bold text-slate-700">
                  {formatDate(encounter.encounter_date)}
                </span>
                <span
                  className={`text-xs font-black px-2 py-0.5 rounded ${
                    encounter.status.toLowerCase() === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {encounter.status}
                </span>
              </div>
            ) : (
              <span className="text-sm text-slate-400 font-bold italic">
                No active encounter
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Compact Version (for scrolled state)
// =============================================================================

export function PatientStickyHeaderCompact({
  patient,
  onExpand,
}: {
  patient: PatientHeaderData;
  onExpand?: () => void;
}) {
  const fullName = [patient.first_name, patient.surname]
    .filter(Boolean)
    .join(' ');
  const gender = patient.gender?.toLowerCase() === 'male' ? 'M' : 'F';
  const age = getAge(patient.date_of_birth, patient.age);
  const hasAllergies = patient.allergies && patient.allergies.length > 0;

  return (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
      <div className="px-8 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm">
            <span className="text-xs text-white font-black uppercase tracking-tighter">
              {getInitials(patient.first_name, patient.surname)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-serif font-black text-slate-900 uppercase tracking-tight">
              {fullName}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="font-mono text-xs font-bold text-primary-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              {patient.emr_number}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {gender}, {age}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasAllergies && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-100 rounded-lg animate-pulse">
              <AlertTriangle size={12} className="text-red-500" />
              <span className="text-xs font-black text-red-700 uppercase">
                Risk Detected
              </span>
            </div>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Expand Patient Profile"
            >
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientStickyHeader;