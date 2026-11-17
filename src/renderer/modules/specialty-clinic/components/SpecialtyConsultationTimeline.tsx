/**
 * =============================================================================
 * SPECIALTY CONSULTATION TIMELINE  (v2 — Modal-First Design)
 * =============================================================================
 * World-class EMR timeline following the Epic / Cerner / Meditech approach:
 *
 *  OUTER VIEW  — compact chronological card list grouped by period.
 *                Each card shows: patient, date, chief complaint, doctor, status.
 *                Clicking any card opens a full encounter modal.
 *
 *  MODAL VIEW  — full 2-panel encounter detail:
 *    ┌─────────────────────────────────────────────────────┐
 *    │  [LEFT SIDEBAR 264px]    │  [MAIN CONTENT — scroll] │
 *    │  ─ Patient Identity      │  Chief Complaint          │
 *    │  ─ Encounter Metadata    │  Clinical Notes / HPI     │
 *    │  ─ ICD Diagnoses         │  Examination Findings     │
 *    │  ─ Quick-nav links       │  Structured examination    │
 *    │                          │  Diagnosis                │
 *    │                          │  Treatment Plan           │
 *    │                          │  ── Addendum Timeline ──  │
 *    └─────────────────────────────────────────────────────┘
 *
 * Design principles:
 *  1. Original consultation is immutable — addendums are append-only
 *  2. specialty_data JSONB rendered as labeled clinical grid
 *  3. ICD chips show code + description + primary indicator
 *  4. Full keyboard-accessible modal (Escape to close)
 * =============================================================================
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Calendar,
  User,
  Search,
  Clock,
  Stethoscope,
  Tag,
  Filter,
  MessageSquarePlus,
  Send,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Activity,
  Pill,
  PenLine,
  UserCheck,
  Layers,
  Hash,
  BookOpen,
  Printer,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Share2,
  TrendingUp,
  CheckCircle2,
  Building2,
  Heart,
  MoreVertical,
  CalendarPlus,
  ClipboardList,
  Target,
} from 'lucide-react';
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  isThisYear,
} from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import {
  useConsultationAddendums,
  useAddConsultationAddendum,
  usePatientCareplans,
  useCareplanSessions,
  usePatientCareplanSessions,
} from '../../specialty-common/hooks/useSpecialtyClinic';
import type { ConsultationAddendum } from '../../specialty-common/api/specialty-clinic.api';
import type { SpecialtyCareplan, CareplanSession } from '../../specialty-common/dtos/specialty-clinic.dto';
import SpecialtyOrdersStep, {
  createDefaultSpecialtyReferrals,
  type SpecialtyReferralsState,
} from '../../specialty-common/components/SpecialtyOrdersStep';
import {
  useLabTestCatalogue,
  useImagingCatalogue,
  useDrugCatalogue,
  useProcedureCatalogue,
} from '../../clinical-consultation/hooks/useConsultation';
import type {
  LabOrderDTO,
  RadiologyOrderDTO,
  ProcedureOrderDTO,
  PrescriptionOrderDTO,
} from '../../clinical-consultation/dtos/consultation.dto';
import {
  submitSpecialtyOrdersAndReferrals,
  type SpecialtyOrdersPayload,
} from '../../specialty-common/utils/specialty-order-submission';
import type { SpecialtyConsultationHistory } from '../types/specialty-dashboard.types';
import { supabase } from '../../../api/supabaseClient';
import EncounterDetailLayout from '../../specialty-common/components/EncounterDetailLayout';
import {
  extractPrintableFields,
  type PrintableField,
} from '../../../utils/printFieldUtils';

// =============================================================================
// Utility helpers
// =============================================================================

const INTERNAL_KEYS = new Set([
  '_exam_summary',
  '_version',
  '_template',
  '_care_plan',
  '_clinical_scores',
]);

function keyToLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function resolveSpecialtyFieldLabel(
  key: string,
  record: Record<string, unknown>,
): string {
  const normalized = key.toLowerCase();
  if (normalized === 'clinical_notes') {
    const hasRadiographicContext = Object.keys(record).some((k) =>
      /(radiograph|radiographic|xray|x_ray|imaging)/i.test(k),
    );
    if (hasRadiographicContext) return 'Radiographic Findings';
  }
  if (
    /(radiograph|radiographic|xray|x_ray|imaging)_?findings/.test(normalized)
  ) {
    return 'Radiographic Findings';
  }
  return keyToLabel(key);
}

function renderSpecialtyValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ') || '—';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

function normalizeConsultationStatus(
  status: string | null | undefined,
): 'Completed' | 'Active' {
  const s = (status || '').toLowerCase();
  if (s.includes('complete') || s.includes('done') || s.includes('final'))
    return 'Completed';
  return 'Active';
}

function statusColors(status: string | null) {
  switch (normalizeConsultationStatus(status).toLowerCase()) {
    case 'completed':
      return {
        dot: 'bg-emerald-500 border-emerald-600',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'active':
      return {
        dot: 'bg-blue-500 border-blue-600',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    default:
      return {
        dot: 'bg-gray-400 border-gray-500',
        badge: 'bg-gray-50 text-gray-600 border-gray-200',
      };
  }
}

function fmtDate(d: string | null | undefined, withTime = false): string {
  if (!d) return '—';
  try {
    return format(
      new Date(d),
      withTime ? 'MMM d, yyyy · h:mm a' : 'MMM d, yyyy',
    );
  } catch {
    return d;
  }
}

function fmtRelative(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return formatDistanceToNow(new Date(d), { addSuffix: true });
  } catch {
    return '';
  }
}

function getStaffTitle(role: string | null | undefined): string {
  if (!role) return '';
  const r = role.toLowerCase();
  if (
    r.includes('doctor') ||
    r.includes('physician') ||
    r.includes('surgeon') ||
    r.includes('consultant') ||
    r.includes('specialist')
  )
    return 'Dr.';
  if (r.includes('nurse')) return 'Nurse';
  if (r.includes('pharmacist')) return 'Pharm.';
  if (r.includes('physio') || r.includes('therapist')) return 'PT';
  if (r.includes('radiolog')) return 'Rad.';
  return '';
}

/** Label for template / structured fields under Examinations (replaces generic “Specialty data”). */
function structuredExaminationLabel(specialtyName: string): string {
  const s = specialtyName.trim();
  if (!s) return 'Structured examination';
  const lower = s.toLowerCase();
  if (lower.endsWith(' examination')) return s;
  return `${s} examination`;
}

function normalizeSpecialtyKey(input: string): string {
  const source = (input || '').toLowerCase().trim();
  if (!source) return 'general_surgery';

  const aliases: Array<{ pattern: RegExp; key: string }> = [
    { pattern: /dental|dentistry/, key: 'dental' },
    { pattern: /ophthalm|eye/, key: 'ophthalmology' },
    { pattern: /physio/, key: 'physiotherapy' },
    { pattern: /cardio/, key: 'cardiology' },
    { pattern: /orthop/, key: 'orthopaedics' },
    { pattern: /dermat/, key: 'dermatology' },
    { pattern: /urolog/, key: 'urology' },
    { pattern: /gastro/, key: 'gastroenterology' },
    { pattern: /nephro/, key: 'nephrology' },
    { pattern: /paedi|pedia/, key: 'paediatrics' },
    { pattern: /neuropsy/, key: 'neuropsychiatry' },
    { pattern: /neurosurg/, key: 'neurosurgery' },
    { pattern: /neurolog/, key: 'neurology' },
    { pattern: /gynae|obgyn|ob\/gyn/, key: 'gynaecology' },
    { pattern: /oral.*maxillofacial|maxillofacial/, key: 'oral_maxillofacial' },
    { pattern: /pulmon|respira/, key: 'pulmonology' },
    { pattern: /endocr/, key: 'endocrinology' },
    { pattern: /plastic/, key: 'plastic_surgery' },
    { pattern: /ent|ear.*nose.*throat/, key: 'ent' },
    { pattern: /general.*surg|surgery/, key: 'general_surgery' },
  ];

  for (const alias of aliases) {
    if (alias.pattern.test(source)) return alias.key;
  }

  return (
    source.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') ||
    'general_surgery'
  );
}

/** Per-specialty accent palette so each of the 17+ clinics feels distinct while sharing the same layout language. */
type SpecialtyEncounterTheme = {
  primary: string;
  primaryHover: string;
  text: string;
  softBg: string;
  softBorder: string;
  sidebarDot: string;
  priorityFrom: string;
  priorityTo: string;
  complaintCardAccent: string;
};

const SPECIALTY_ENCOUNTER_THEMES: Record<string, SpecialtyEncounterTheme> = {
  dermatology: {
    primary: 'bg-[#0d6b73]',
    primaryHover: 'hover:bg-[#0a575e]',
    text: 'text-[#0d6b73]',
    softBg: 'bg-[#e8f4f5]',
    softBorder: 'border-[#c5e4e8]',
    sidebarDot: 'bg-[#0d6b73]',
    priorityFrom: 'from-[#0d6b73]',
    priorityTo: 'to-[#14919b]',
    complaintCardAccent: 'border-[#0d6b73]/25',
  },
  cardiology: {
    primary: 'bg-rose-700',
    primaryHover: 'hover:bg-rose-800',
    text: 'text-rose-800',
    softBg: 'bg-rose-50',
    softBorder: 'border-rose-200',
    sidebarDot: 'bg-rose-600',
    priorityFrom: 'from-rose-700',
    priorityTo: 'to-rose-600',
    complaintCardAccent: 'border-rose-200',
  },
  dental: {
    primary: 'bg-cyan-700',
    primaryHover: 'hover:bg-cyan-800',
    text: 'text-cyan-800',
    softBg: 'bg-cyan-50',
    softBorder: 'border-cyan-200',
    sidebarDot: 'bg-cyan-600',
    priorityFrom: 'from-cyan-700',
    priorityTo: 'to-teal-600',
    complaintCardAccent: 'border-cyan-200',
  },
  ophthalmology: {
    primary: 'bg-sky-700',
    primaryHover: 'hover:bg-sky-800',
    text: 'text-sky-900',
    softBg: 'bg-sky-50',
    softBorder: 'border-sky-200',
    sidebarDot: 'bg-sky-600',
    priorityFrom: 'from-sky-700',
    priorityTo: 'to-indigo-600',
    complaintCardAccent: 'border-sky-200',
  },
  ent: {
    primary: 'bg-violet-700',
    primaryHover: 'hover:bg-violet-800',
    text: 'text-violet-900',
    softBg: 'bg-violet-50',
    softBorder: 'border-violet-200',
    sidebarDot: 'bg-violet-600',
    priorityFrom: 'from-violet-700',
    priorityTo: 'to-purple-600',
    complaintCardAccent: 'border-violet-200',
  },
  orthopaedics: {
    primary: 'bg-amber-700',
    primaryHover: 'hover:bg-amber-800',
    text: 'text-amber-900',
    softBg: 'bg-amber-50',
    softBorder: 'border-amber-200',
    sidebarDot: 'bg-amber-600',
    priorityFrom: 'from-amber-700',
    priorityTo: 'to-orange-600',
    complaintCardAccent: 'border-amber-200',
  },
  neurology: {
    primary: 'bg-indigo-700',
    primaryHover: 'hover:bg-indigo-800',
    text: 'text-indigo-900',
    softBg: 'bg-indigo-50',
    softBorder: 'border-indigo-200',
    sidebarDot: 'bg-indigo-600',
    priorityFrom: 'from-indigo-700',
    priorityTo: 'to-blue-600',
    complaintCardAccent: 'border-indigo-200',
  },
  neurosurgery: {
    primary: 'bg-slate-800',
    primaryHover: 'hover:bg-slate-900',
    text: 'text-slate-800',
    softBg: 'bg-slate-100',
    softBorder: 'border-slate-300',
    sidebarDot: 'bg-slate-700',
    priorityFrom: 'from-slate-800',
    priorityTo: 'to-slate-600',
    complaintCardAccent: 'border-slate-300',
  },
  neuropsychiatry: {
    primary: 'bg-fuchsia-800',
    primaryHover: 'hover:bg-fuchsia-900',
    text: 'text-fuchsia-900',
    softBg: 'bg-fuchsia-50',
    softBorder: 'border-fuchsia-200',
    sidebarDot: 'bg-fuchsia-700',
    priorityFrom: 'from-fuchsia-800',
    priorityTo: 'to-purple-700',
    complaintCardAccent: 'border-fuchsia-200',
  },
  paediatrics: {
    primary: 'bg-pink-700',
    primaryHover: 'hover:bg-pink-800',
    text: 'text-pink-900',
    softBg: 'bg-pink-50',
    softBorder: 'border-pink-200',
    sidebarDot: 'bg-pink-600',
    priorityFrom: 'from-pink-600',
    priorityTo: 'to-rose-600',
    complaintCardAccent: 'border-pink-200',
  },
  gynaecology: {
    primary: 'bg-rose-800',
    primaryHover: 'hover:bg-rose-900',
    text: 'text-rose-900',
    softBg: 'bg-rose-50',
    softBorder: 'border-rose-200',
    sidebarDot: 'bg-rose-700',
    priorityFrom: 'from-rose-800',
    priorityTo: 'to-pink-700',
    complaintCardAccent: 'border-rose-200',
  },
  urology: {
    primary: 'bg-blue-800',
    primaryHover: 'hover:bg-blue-900',
    text: 'text-blue-900',
    softBg: 'bg-blue-50',
    softBorder: 'border-blue-200',
    sidebarDot: 'bg-blue-700',
    priorityFrom: 'from-blue-800',
    priorityTo: 'to-cyan-700',
    complaintCardAccent: 'border-blue-200',
  },
  gastroenterology: {
    primary: 'bg-lime-800',
    primaryHover: 'hover:bg-lime-900',
    text: 'text-lime-900',
    softBg: 'bg-lime-50',
    softBorder: 'border-lime-200',
    sidebarDot: 'bg-lime-700',
    priorityFrom: 'from-lime-800',
    priorityTo: 'to-emerald-700',
    complaintCardAccent: 'border-lime-200',
  },
  nephrology: {
    primary: 'bg-blue-900',
    primaryHover: 'hover:bg-blue-950',
    text: 'text-blue-950',
    softBg: 'bg-sky-50',
    softBorder: 'border-sky-200',
    sidebarDot: 'bg-blue-800',
    priorityFrom: 'from-blue-900',
    priorityTo: 'to-indigo-800',
    complaintCardAccent: 'border-sky-300',
  },
  pulmonology: {
    primary: 'bg-teal-800',
    primaryHover: 'hover:bg-teal-900',
    text: 'text-teal-900',
    softBg: 'bg-teal-50',
    softBorder: 'border-teal-200',
    sidebarDot: 'bg-teal-700',
    priorityFrom: 'from-teal-800',
    priorityTo: 'to-cyan-800',
    complaintCardAccent: 'border-teal-200',
  },
  endocrinology: {
    primary: 'bg-amber-900',
    primaryHover: 'hover:bg-amber-950',
    text: 'text-amber-950',
    softBg: 'bg-amber-50',
    softBorder: 'border-amber-200',
    sidebarDot: 'bg-amber-800',
    priorityFrom: 'from-amber-900',
    priorityTo: 'to-yellow-800',
    complaintCardAccent: 'border-amber-200',
  },
  physiotherapy: {
    primary: 'bg-emerald-800',
    primaryHover: 'hover:bg-emerald-900',
    text: 'text-emerald-900',
    softBg: 'bg-emerald-50',
    softBorder: 'border-emerald-200',
    sidebarDot: 'bg-emerald-700',
    priorityFrom: 'from-emerald-800',
    priorityTo: 'to-green-700',
    complaintCardAccent: 'border-emerald-200',
  },
  plastic_surgery: {
    primary: 'bg-purple-800',
    primaryHover: 'hover:bg-purple-900',
    text: 'text-purple-900',
    softBg: 'bg-purple-50',
    softBorder: 'border-purple-200',
    sidebarDot: 'bg-purple-700',
    priorityFrom: 'from-purple-800',
    priorityTo: 'to-fuchsia-700',
    complaintCardAccent: 'border-purple-200',
  },
  oral_maxillofacial: {
    primary: 'bg-cyan-800',
    primaryHover: 'hover:bg-cyan-900',
    text: 'text-cyan-900',
    softBg: 'bg-cyan-50',
    softBorder: 'border-cyan-200',
    sidebarDot: 'bg-cyan-700',
    priorityFrom: 'from-cyan-800',
    priorityTo: 'to-blue-800',
    complaintCardAccent: 'border-cyan-200',
  },
  general_surgery: {
    primary: 'bg-[#E9783F]',
    primaryHover: 'hover:bg-[#0a4d46]',
    text: 'text-[#11151C]',
    softBg: 'bg-teal-50',
    softBorder: 'border-teal-200',
    sidebarDot: 'bg-[#E9783F]',
    priorityFrom: 'from-[#1E232B]',
    priorityTo: 'to-emerald-700',
    complaintCardAccent: 'border-teal-200',
  },
};

const DEFAULT_ENCOUNTER_THEME = SPECIALTY_ENCOUNTER_THEMES.general_surgery;

function getSpecialtyEncounterTheme(
  specialtyKey: string,
): SpecialtyEncounterTheme {
  return SPECIALTY_ENCOUNTER_THEMES[specialtyKey] ?? DEFAULT_ENCOUNTER_THEME;
}

type ReferralUrgency = {
  label: string;
  level: 'routine' | 'elevated' | 'high' | 'stat';
};

function deriveReferralUrgency(
  priorities: (string | null | undefined)[],
  fallbackComplaint?: string | null,
): ReferralUrgency {
  const blob = priorities.map((p) => (p || '').toLowerCase()).join(' ');
  const complaint = (fallbackComplaint || '').toLowerCase();
  if (
    /stat|emergency|immediate|911/.test(blob) ||
    /critical|unresponsive|cardiac arrest/.test(complaint)
  ) {
    return { label: 'Stat', level: 'stat' };
  }
  if (
    /urgent|asap|high|priority/.test(blob) ||
    /severe|worst|sudden|thunderclap/.test(complaint)
  ) {
    return { label: 'High', level: 'high' };
  }
  if (
    /soon|routine|normal|low|standard/.test(blob) &&
    priorities.some(Boolean)
  ) {
    return { label: 'Routine', level: 'routine' };
  }
  if (priorities.some((p) => Boolean(p && String(p).trim()))) {
    return { label: 'Standard', level: 'elevated' };
  }
  return { label: 'Not set', level: 'routine' };
}

function groupByPeriod(
  records: SpecialtyConsultationHistory[],
): Map<string, SpecialtyConsultationHistory[]> {
  const groups = new Map<string, SpecialtyConsultationHistory[]>();

  for (const r of records) {
    const date = r.consultation_date
      ? new Date(r.consultation_date)
      : new Date(r.created_at ?? '');
    let label: string;
    if (isToday(date)) label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    else if (isThisWeek(date)) label = 'This Week';
    else if (isThisMonth(date)) label = 'This Month';
    else if (isThisYear(date)) label = format(date, 'MMMM yyyy');
    else label = format(date, 'MMMM yyyy');

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }

  return groups;
}

// =============================================================================
// Section header helper
// =============================================================================

// =============================================================================
// Timeline Section Card — inpatient-style vertical timeline entry
// =============================================================================

type TimelineSectionColor =
  | 'red'
  | 'blue'
  | 'teal'
  | 'indigo'
  | 'amber'
  | 'emerald'
  | 'violet';

const TIMELINE_DOT_COLORS: Record<
  TimelineSectionColor,
  {
    dot: string;
    ring: string;
    badge: string;
    bg: string;
    border: string;
    text: string;
  }
> = {
  red: {
    dot: 'bg-red-500',
    ring: 'ring-red-200',
    badge: 'bg-red-100 text-red-800',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
  },
  blue: {
    dot: 'bg-blue-500',
    ring: 'ring-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
  },
  teal: {
    dot: 'bg-teal-500',
    ring: 'ring-teal-200',
    badge: 'bg-teal-100 text-teal-800',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-900',
  },
  indigo: {
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-200',
    badge: 'bg-indigo-100 text-indigo-800',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-900',
  },
  amber: {
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
  },
  emerald: {
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
  },
  violet: {
    dot: 'bg-violet-500',
    ring: 'ring-violet-200',
    badge: 'bg-violet-100 text-violet-800',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-900',
  },
};

function TimelineSectionCard({
  icon,
  title,
  color,
  isLast,
  rightElement,
  hasContent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: TimelineSectionColor;
  isLast?: boolean;
  rightElement?: React.ReactNode;
  hasContent?: boolean;
  children: React.ReactNode;
}) {
  const tc = TIMELINE_DOT_COLORS[color];
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="relative flex gap-3 sm:gap-4 print:break-inside-avoid">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0 w-8 sm:w-10">
        <div
          className={`w-5 h-5 rounded-full ring-4 ${tc.ring} ${tc.dot} shadow-sm z-10 shrink-0 mt-1 flex items-center justify-center`}
        >
          <span className="text-white">{icon}</span>
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gradient-to-b from-slate-300 to-slate-100 mt-1" />
        )}
      </div>
      {/* Content card */}
      <div className="flex-1 pb-6 min-w-0">
        <div
          className={`bg-white border rounded-xl shadow-sm ${hasContent !== false ? `hover:shadow-md hover:${tc.border}` : ''} transition-all`}
        >
          {/* Card header */}
          <div
            className="px-5 py-3 flex items-center justify-between gap-3 border-b border-slate-100 cursor-pointer select-none"
            onClick={() => setIsOpen((prev) => !prev)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
              }
            }}
            aria-expanded={isOpen}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span className="text-slate-400 shrink-0 mt-0.5">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
              <span
                className={`min-w-0 px-3 py-1.5 rounded-lg text-sm font-bold tracking-wide text-left whitespace-normal break-words ${tc.badge}`}
              >
                {title}
              </span>
            </div>
            {rightElement && (
              <div
                className="print:hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {rightElement}
              </div>
            )}
          </div>
          {/* Card body */}
          {isOpen && <div className="px-5 py-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Addendum timeline (inside encounter modal)
// =============================================================================

interface AddendumTimelineProps {
  consultationId: string;
  staffId: string;
}

type TimelineAddendum = ConsultationAddendum & { _optimistic?: boolean };

function AddendumTimeline({ consultationId, staffId }: AddendumTimelineProps) {
  const { staff } = useAuth();
  const { data: addendums = [], isLoading } =
    useConsultationAddendums(consultationId);
  const addMutation = useAddConsultationAddendum();
  const { showToast } = useToast();
  const [noteText, setNoteText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingAddendums, setPendingAddendums] = useState<TimelineAddendum[]>(
    [],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visibleAddendums = useMemo<TimelineAddendum[]>(
    () => [...pendingAddendums, ...(addendums as TimelineAddendum[])],
    [pendingAddendums, addendums],
  );

  useEffect(() => {
    if (showForm && textareaRef.current) textareaRef.current.focus();
  }, [showForm]);

  async function handleSubmit() {
    const text = noteText.trim();
    if (!text) return;

    const optimisticId = `optimistic-${Date.now()}`;
    setPendingAddendums((prev) => [
      {
        id: optimisticId,
        consultation_id: consultationId,
        note_text: text,
        created_by: staffId || null,
        created_at: new Date().toISOString(),
        staff: null,
        _optimistic: true,
      },
      ...prev,
    ]);

    try {
      await addMutation.mutateAsync({
        consultationId,
        noteText: text,
        createdBy: staffId,
      });
      setPendingAddendums((prev) =>
        prev.filter((note) => note.id !== optimisticId),
      );
      showToast({
        type: 'success',
        title: 'Note Added',
        message: 'Addendum saved.',
      });
      setNoteText('');
      setShowForm(false);
    } catch {
      setPendingAddendums((prev) =>
        prev.filter((note) => note.id !== optimisticId),
      );
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Could not save addendum.',
      });
    }
  }

  return (
    <div>
      {/* Add Note Form — always at the top for quick access */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full text-sm text-violet-700 hover:text-violet-900 font-semibold flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-200 hover:bg-violet-50 transition-colors mb-4 bg-white"
        >
          <MessageSquarePlus className="w-4 h-4" />
          Add Addendum Note
        </button>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 mb-4">
          <p className="text-sm font-semibold text-slate-700">
            New addendum note:
          </p>
          <textarea
            ref={textareaRef}
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter follow-up note, plan change, additional findings..."
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-base resize-none focus:ring-2 focus:ring-violet-500 focus:border-violet-400 outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowForm(false);
                setNoteText('');
              }}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!noteText.trim() || addMutation.isPending}
              className="text-sm bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2 font-semibold transition-colors"
            >
              <Send className="w-4 h-4" />
              {addMutation.isPending ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Notes count header */}
      {visibleAddendums.length > 0 && (
        <p className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-3">
          {visibleAddendums.length} note
          {visibleAddendums.length !== 1 ? 's' : ''} — most recent first
        </p>
      )}

      {isLoading && visibleAddendums.length === 0 ? (
        <div className="space-y-3 mb-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-16 bg-violet-50 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : visibleAddendums.length > 0 ? (
        <div className="relative ml-3 mb-4">
          {/* Vertical rail */}
          <div className="absolute left-0 top-2 bottom-4 w-0.5 bg-violet-200 rounded-full" />
          {visibleAddendums.map((a, i) => {
            const isOptimistic = Boolean(a._optimistic);
            const staffName = a.staff
              ? `${a.staff.first_name ?? ''} ${a.staff.last_name ?? ''}`.trim()
              : `${staff?.first_name ?? ''} ${staff?.last_name ?? ''}`.trim() ||
                'Unknown';
            const staffTitle = a.staff
              ? getStaffTitle((a.staff as any).role)
              : '';
            return (
              <div key={a.id} className="relative pl-6 pb-4">
                <div
                  className={`absolute left-[-4px] top-2 w-3 h-3 rounded-full border-2 border-white ring-2 ${
                    i === 0
                      ? 'bg-violet-500 ring-violet-300'
                      : 'bg-violet-200 ring-violet-100'
                  }`}
                />
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-sm font-bold text-violet-800 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4" />
                      {staffTitle && (
                        <span className="text-violet-500 font-semibold">
                          {staffTitle}
                        </span>
                      )}
                      {staffName}
                    </span>
                    <span className="text-xs text-violet-400 shrink-0">
                      {isOptimistic ? 'Just now' : fmtRelative(a.created_at)}
                    </span>
                  </div>
                  <p className="text-base text-violet-900 leading-relaxed">
                    {a.note_text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-4 bg-violet-50/50 border border-dashed border-violet-200 rounded-xl px-4 py-6 text-center">
          <PenLine className="w-6 h-6 text-violet-300 mx-auto mb-2" />
          <p className="text-sm text-violet-400 font-medium">
            No addendum notes yet
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Dental Exam Panel (used inside EncounterDetailModal for dental specialties)
// =============================================================================

function DentalExamPanel({ encounterId }: { encounterId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [exam, setExam] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    supabase
      .from('dental_exams')
      .select(
        'consultation_type, complaint_type, affected_area, chief_complaint, complaint_duration, ' +
          'pain_level, pain_character, dental_history, medical_history, allergies, current_medications, ' +
          'systemic_conditions, tobacco_use, alcohol_use, ' +
          'extraoral_findings, intraoral_findings, soft_tissue_exam, hard_tissue_exam, ' +
          'occlusion_class, tmj_assessment, gingival_status, bleeding_on_probing, plaque_score, ' +
          'calculus_present, pocket_depth_notes, radiograph_taken, radiograph_type, radiograph_findings, ' +
          'provisional_diagnosis, final_diagnosis, treatment_plan, urgency, ' +
          'estimated_sessions, follow_up_required, follow_up_date, follow_up_notes, status',
      )
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => {
        setExam(data as any);
        setLoading(false);
      });
  }, [encounterId]);

  if (loading)
    return (
      <p className="text-xs text-gray-400 italic py-2">
        Loading dental exam data...
      </p>
    );
  if (!exam)
    return (
      <p className="text-xs text-gray-400 italic py-2">
        No dental examination recorded for this encounter.
      </p>
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function Field({ label, value }: { label: string; value: any }) {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === false
    )
      return null;
    const txt =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    return (
      <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5">
        <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p className="text-sm text-teal-900 font-medium leading-snug">{txt}</p>
      </div>
    );
  }

  const sysConditions = exam.systemic_conditions as
    | Record<string, boolean>
    | null
    | undefined;
  const activeConds: string[] = sysConditions
    ? Object.entries(sysConditions)
        .filter(([, v]) => v)
        .map(([k]) => k)
    : [];

  return (
    <div className="space-y-4">
      {/* Complaint */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Visit Type" value={exam.consultation_type} />
        <Field label="Complaint Category" value={exam.complaint_type} />
        <div className="col-span-2">
          <Field label="Chief Complaint" value={exam.chief_complaint} />
        </div>
        <Field label="Affected Area / Tooth" value={exam.affected_area} />
        <Field label="Duration" value={exam.complaint_duration} />
        <Field
          label="Pain Level"
          value={exam.pain_level != null ? `${exam.pain_level}/10` : null}
        />
        <Field label="Pain Character" value={exam.pain_character} />
      </div>

      {/* History */}
      {(exam.dental_history ||
        exam.medical_history ||
        exam.allergies ||
        exam.current_medications ||
        activeConds.length > 0 ||
        exam.tobacco_use ||
        exam.alcohol_use) && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            History
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Dental History" value={exam.dental_history} />
            <Field label="Medical History" value={exam.medical_history} />
            <div className="col-span-2">
              <Field label="Allergies" value={exam.allergies} />
            </div>
            <div className="col-span-2">
              <Field
                label="Current Medications"
                value={exam.current_medications}
              />
            </div>
            {activeConds.length > 0 && (
              <div className="col-span-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">
                  Systemic Conditions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activeConds.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Field label="Tobacco Use" value={exam.tobacco_use} />
            <Field label="Alcohol Use" value={exam.alcohol_use} />
          </div>
        </div>
      )}

      {/* Examination */}
      {(exam.extraoral_findings ||
        exam.intraoral_findings ||
        exam.soft_tissue_exam ||
        exam.hard_tissue_exam ||
        exam.occlusion_class ||
        exam.tmj_assessment) && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            Oral Examination
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Extraoral Findings" value={exam.extraoral_findings} />
            <Field label="Intraoral Findings" value={exam.intraoral_findings} />
            <Field label="Soft Tissue" value={exam.soft_tissue_exam} />
            <Field label="Hard Tissue" value={exam.hard_tissue_exam} />
            <Field label="Occlusion Class" value={exam.occlusion_class} />
            <Field label="TMJ Assessment" value={exam.tmj_assessment} />
          </div>
        </div>
      )}

      {/* Periodontal */}
      {(exam.gingival_status ||
        exam.bleeding_on_probing ||
        exam.plaque_score != null ||
        exam.pocket_depth_notes) && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            Periodontal
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Gingival Status" value={exam.gingival_status} />
            <Field
              label="Bleeding on Probing"
              value={exam.bleeding_on_probing ? 'Yes' : null}
            />
            <Field label="Plaque Score" value={exam.plaque_score} />
            <Field
              label="Calculus"
              value={exam.calculus_present ? 'Present' : null}
            />
            <div className="col-span-2">
              <Field
                label="Pocket Depth Notes"
                value={exam.pocket_depth_notes}
              />
            </div>
          </div>
        </div>
      )}

      {/* Radiograph */}
      {exam.radiograph_taken && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            Radiograph
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type" value={exam.radiograph_type} />
            <div className="col-span-2">
              <Field label="Findings" value={exam.radiograph_findings} />
            </div>
          </div>
        </div>
      )}

      {/* Diagnosis & Plan */}
      {(exam.provisional_diagnosis ||
        exam.final_diagnosis ||
        exam.treatment_plan) && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
            Diagnosis & Plan
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Provisional Diagnosis"
              value={exam.provisional_diagnosis}
            />
            <Field label="Final Diagnosis" value={exam.final_diagnosis} />
            <Field label="Urgency" value={exam.urgency} />
            <Field label="Estimated Sessions" value={exam.estimated_sessions} />
            <div className="col-span-2">
              <Field label="Treatment Plan" value={exam.treatment_plan} />
            </div>
          </div>
        </div>
      )}

      {/* Follow-up */}
      {exam.follow_up_required && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Follow-up Date" value={exam.follow_up_date} />
          <div className="col-span-2">
            <Field label="Follow-up Notes" value={exam.follow_up_notes} />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Encounter detail modal (2-panel: sidebar + main content)
// =============================================================================

interface EncounterDetailModalProps {
  consultation: SpecialtyConsultationHistory;
  allHistory: SpecialtyConsultationHistory[];
  specialtyName: string;
  staffId: string;
  onClose: () => void;
  onSelectEncounter: (c: SpecialtyConsultationHistory) => void;
}

type CareTab =
  | 'summary'
  | 'orders-services'
  | 'doctor-notes'
  | 'treatment-plan'
  | 'lab-orders'
  | 'imaging-orders'
  | 'procedure-orders'
  | 'medications'
  | 'care-plans'
  | 'sessions'
  | 'history'
  | 'addendum';

interface EncounterLabOrder {
  request_id: string;
  test_id: string | null;
  status: string | null;
  priority: string | null;
  clinical_notes: string | null;
  created_at: string | null;
  ordered_by: string | null;
  test_name?: string;
  ordered_by_name?: string;
  lab_result_value?: string | null;
  lab_result_status?: string | null;
  lab_result_interpretation?: string | null;
  lab_result_comments?: string | null;
  lab_result_reported_at?: string | null;
  lab_result_unit?: string | null;
  lab_result_reference_range?: string | null;
  lab_result_is_abnormal?: boolean | null;
  lab_result_is_critical?: boolean | null;
}

interface EncounterImagingOrder {
  request_id: string;
  imaging_id: string | null;
  imaging_type: string | null;
  body_part: string | null;
  status: string | null;
  priority: string | null;
  clinical_indication: string | null;
  notes: string | null;
  clinical_history?: string | null;
  created_at: string | null;
  ordered_by: string | null;
  imaging_name?: string;
  ordered_by_name?: string;
  result_findings?: string | null;
  result_impression?: string | null;
  result_notes?: string | null;
  result_reported_at?: string | null;
  result_status?: string | null;
  result_extra_fields?: PrintableField[];
}

interface NormalizedLabResultRow {
  request_id: string;
  result_value: string | null;
  interpretation: string | null;
  comments: string | null;
  reported_at: string | null;
  approved_at: string | null;
  workflow_status: string | null;
  unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean | null;
  is_critical: boolean | null;
}

interface NormalizedScanResultRow {
  request_id: string;
  findings: string | null;
  impression: string | null;
  notes: string | null;
  reported_at: string | null;
  report_date: string | null;
  created_at: string | null;
  workflow_status: string | null;
  extra_fields: PrintableField[];
}

interface EncounterProcedureOrder {
  id: string;
  procedure_name: string | null;
  procedure_code: string | null;
  status: string | null;
  priority: string | null;
  indication: string | null;
  procedure_notes: string | null;
  scheduled_date: string | null;
  actual_end_time: string | null;
  created_at: string | null;
  primary_surgeon_id: string | null;
  created_by: string | null;
  findings: string | null;
  post_op_diagnosis: string | null;
  requested_by_name?: string;
}

interface EncounterProcedureRequestRow {
  request_id: string;
  procedure_id: string | null;
  procedure_name: string | null;
  procedure_type: string | null;
  status: string | null;
  priority: string | null;
  clinical_notes: string | null;
  notes: string | null;
  ordered_by: string | null;
  created_at: string | null;
}

interface EncounterMedicationOrder {
  prescription_id: string;
  drug_id: string | null;
  prescribed_by?: string | null;
  doctor_id?: string | null;
  dosage: string | null;
  dose?: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  quantity_prescribed: number | null;
  quantity_dispensed: number | null;
  instructions: string | null;
  special_instructions?: string | null;
  notes?: string | null;
  status: string | null;
  created_at: string | null;
  drug_name?: string;
  ordered_by_name?: string;
}

interface VisitLookupRow {
  id: string;
  encounter_number: string | null;
  visit_id: string | null;
}

function orderStatusBadgeClass(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (s.includes('complete') || s.includes('done')) {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
  if (s.includes('cancel') || s.includes('reject') || s.includes('declin')) {
    return 'bg-rose-100 text-rose-700 border-rose-200';
  }
  if (s.includes('progress') || s.includes('process') || s.includes('active')) {
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveEncounterLookupIds(
  encounterId?: string | null,
  visitId?: string | null,
): Promise<{ encounterIds: string[]; visitIds: string[] }> {
  const encounterIds = new Set<string>();
  const visitIds = new Set<string>();

  async function addResolvedVisitLookup(identifier?: string | null) {
    if (!identifier) return;

    if (UUID_REGEX.test(identifier)) {
      encounterIds.add(identifier);

      const { data, error } = await supabase
        .from('visits')
        .select('id, visit_id')
        .eq('id', identifier)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to resolve encounter UUID to visit_id:', error);
        return;
      }

      if (data?.id) encounterIds.add(data.id);
      if (data?.visit_id) visitIds.add(data.visit_id);
      return;
    }

    visitIds.add(identifier);

    const { data, error } = await supabase
      .from('visits')
      .select('id, visit_id')
      .eq('visit_id', identifier)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to resolve encounter visit_id to UUID:', error);
      return;
    }

    if (data?.id) encounterIds.add(data.id);
    if (data?.visit_id) visitIds.add(data.visit_id);
  }

  await Promise.all([
    addResolvedVisitLookup(encounterId),
    addResolvedVisitLookup(visitId),
  ]);

  return {
    encounterIds: Array.from(encounterIds),
    visitIds: Array.from(visitIds),
  };
}

function mergeUniqueRows<T>(
  rows: T[],
  keySelector: (row: T) => string | null | undefined,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const row of rows) {
    const key = keySelector(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

function pickLatestByDate<T extends Record<string, any>>(
  rows: T[],
  keySelector: (row: T) => string | null | undefined,
  dateSelector: (row: T) => string | null | undefined,
): Map<string, T> {
  const result = new Map<string, T>();

  for (const row of rows) {
    const key = keySelector(row);
    if (!key) continue;

    const existing = result.get(key);
    if (!existing) {
      result.set(key, row);
      continue;
    }

    const existingTs = new Date(dateSelector(existing) || 0).getTime();
    const currentTs = new Date(dateSelector(row) || 0).getTime();
    if (Number.isNaN(existingTs) || currentTs > existingTs) {
      result.set(key, row);
    }
  }

  return result;
}

async function fetchLabResultsByRequestIds(
  requestIds: string[],
): Promise<NormalizedLabResultRow[]> {
  if (requestIds.length === 0) return [];

  const primary = await supabase
    .from('lab_results')
    .select(
      'request_id, result_value, interpretation, comments, reported_at, approved_at, workflow_status, unit, reference_range, is_abnormal, is_critical, created_at',
    )
    .in('request_id', requestIds);

  if (!primary.error) {
    return ((primary.data || []) as Array<any>).map((row) => ({
      request_id: row.request_id,
      result_value: row.result_value != null ? String(row.result_value) : null,
      interpretation: row.interpretation || null,
      comments: row.comments || null,
      reported_at: row.reported_at || row.created_at || null,
      approved_at: row.approved_at || null,
      workflow_status: row.workflow_status || null,
      unit: row.unit || null,
      reference_range: row.reference_range || null,
      is_abnormal: row.is_abnormal ?? null,
      is_critical: row.is_critical ?? null,
    }));
  }

  const legacy = await supabase
    .from('lab_results')
    .select(
      'lab_request_id, result, result_value, interpretation, remarks, upload_date, verified_at, result_status, workflow_status, created_at',
    )
    .in('lab_request_id', requestIds);

  if (legacy.error) {
    console.error('Failed to load lab results from both schema variants:', {
      primaryError: primary.error,
      legacyError: legacy.error,
    });
    return [];
  }

  return ((legacy.data || []) as Array<any>).map((row) => ({
    request_id: row.lab_request_id,
    result_value:
      row.result != null
        ? String(row.result)
        : row.result_value != null
          ? String(row.result_value)
          : null,
    interpretation: row.interpretation || null,
    comments: row.remarks || null,
    reported_at: row.upload_date || row.created_at || null,
    approved_at: row.verified_at || null,
    workflow_status: row.workflow_status || row.result_status || null,
    unit: row.unit || null,
    reference_range: row.reference_range || null,
    is_abnormal: row.is_abnormal ?? null,
    is_critical: row.is_critical ?? null,
  }));
}

async function fetchScanResultsByRequestIds(
  requestIds: string[],
): Promise<NormalizedScanResultRow[]> {
  if (requestIds.length === 0) return [];

  const primary = await supabase
    .from('scan_results')
    .select('*')
    .in('request_id', requestIds);

  if (!primary.error) {
    return ((primary.data || []) as Array<any>).map((row) => ({
      request_id: row.request_id || row.scan_request_id,
      findings: row.findings || null,
      impression: row.impression || null,
      notes: row.notes || row.recommendation || null,
      reported_at:
        row.reported_at ||
        row.report_date ||
        row.verified_at ||
        row.created_at ||
        null,
      report_date: row.report_date || row.verified_at || null,
      created_at: row.created_at || null,
      workflow_status:
        row.workflow_status ||
        (row.is_preliminary ? 'Preliminary' : row.urgency || null),
      extra_fields: extractPrintableFields(row as Record<string, unknown>, {
        excludeKeys: [
          'id',
          'request_id',
          'scan_request_id',
          'findings',
          'impression',
          'notes',
          'recommendation',
          'reported_at',
          'report_date',
          'created_at',
          'workflow_status',
          'is_preliminary',
          'urgency',
          'reporter',
          'verifier',
          'request',
        ],
        maxDepth: 3,
      }),
    }));
  }

  const legacy = await supabase
    .from('scan_results')
    .select('*')
    .in('scan_request_id', requestIds);

  if (legacy.error) {
    console.error('Failed to load imaging results from both schema variants:', {
      primaryError: primary.error,
      legacyError: legacy.error,
    });
    return [];
  }

  return ((legacy.data || []) as Array<any>).map((row) => ({
    request_id: row.request_id || row.scan_request_id,
    findings: row.findings || null,
    impression: row.impression || null,
    notes: row.notes || row.recommendation || null,
    reported_at:
      row.reported_at ||
      row.report_date ||
      row.verified_at ||
      row.created_at ||
      null,
    report_date: row.report_date || row.verified_at || null,
    created_at: row.created_at || null,
    workflow_status:
      row.workflow_status ||
      (row.is_preliminary ? 'Preliminary' : row.urgency || null),
    extra_fields: extractPrintableFields(row as Record<string, unknown>, {
      excludeKeys: [
        'id',
        'request_id',
        'scan_request_id',
        'findings',
        'impression',
        'notes',
        'recommendation',
        'reported_at',
        'report_date',
        'created_at',
        'workflow_status',
        'is_preliminary',
        'urgency',
        'reporter',
        'verifier',
        'request',
      ],
      maxDepth: 3,
    }),
  }));
}

// =============================================================================
// Care Plan Summary Card (used in encounter detail modal)
// =============================================================================

function CarePlanSummaryCard({
  plan,
  specialtyName,
}: {
  plan: SpecialtyCareplan;
  specialtyName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: sessions = [] } = useCareplanSessions(expanded ? plan.id : undefined);

  const statusStyle: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    On_Hold: 'bg-amber-100 text-amber-700 border-amber-300',
    Completed: 'bg-gray-100 text-gray-600 border-gray-300',
    Cancelled: 'bg-red-100 text-red-700 border-red-300',
  };

  const completedSessions = sessions.filter((s) => s.status === 'Completed').length;

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div
        className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900">{plan.plan_name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${statusStyle[plan.status] ?? statusStyle.Active}`}>
                {plan.status?.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ClipboardList className="w-3 h-3" />
                {plan.plan_type}
              </span>
              <span>{plan.frequency ?? 'Flexible'} · {plan.expected_duration ?? 'Ongoing'}</span>
              {plan.total_sessions && (
                <span>{completedSessions}/{plan.total_sessions} sessions</span>
              )}
            </div>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
        </div>

        {/* Goals chips */}
        {plan.goals && plan.goals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {plan.goals.slice(0, 4).map((g, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                <Target className="w-3 h-3 inline mr-0.5" />
                {g}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 space-y-3">
          {/* Session progress */}
          {plan.total_sessions && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{completedSessions} sessions completed</span>
                <span>{Math.max(0, plan.total_sessions - completedSessions)} remaining</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-teal-500 transition-all"
                  style={{ width: `${Math.min(100, (completedSessions / plan.total_sessions) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Diagnosis */}
          {plan.diagnosis && plan.diagnosis.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Diagnoses</p>
              <div className="flex flex-wrap gap-1">
                {plan.diagnosis.map((d, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Baseline data */}
          {plan.baseline_data && Object.keys(plan.baseline_data).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Baseline Information</p>
              <div className="grid grid-cols-1 gap-1">
                {Object.entries(plan.baseline_data)
                  .filter(([, v]) => v != null && v !== '')
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-slate-500 capitalize w-28 shrink-0">{k.replace(/_/g, ' ')}:</span>
                      <span className="text-slate-700 font-medium">{String(v)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Session history — Physio-style */}
          {sessions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Session History</p>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-white">
                {sessions.map((s) => {
                  const isCompleted = s.status === 'Completed';
                  const isMissed = s.status === 'Missed';
                  const isCancelled = s.status === 'Cancelled';
                  return (
                    <div key={s.id} className={`p-3 flex items-center justify-between hover:bg-slate-50 ${isCompleted ? 'bg-green-50/30' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isCompleted ? 'bg-green-100 text-green-700'
                            : isMissed || isCancelled ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {s.session_number}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">Session {s.session_number}</span>
                            <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                              isCompleted ? 'bg-green-100 text-green-700'
                                : isMissed || isCancelled ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {s.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {isCompleted && s.notes && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{s.notes}</p>
                          )}
                          {!isCompleted && s.scheduled_date && (
                            <p className="text-xs text-slate-400 mt-0.5">Scheduled: {fmtDate(s.scheduled_date)}</p>
                          )}
                          {isCompleted && s.completed_date && (
                            <p className="text-xs text-slate-400 mt-0.5">{fmtDate(s.completed_date)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Created {fmtRelative(plan.created_at)}
          </p>
        </div>
      )}
    </div>
  );
}

function EncounterDetailModal({
  consultation: c,
  allHistory,
  specialtyName,
  staffId,
  onClose,
  onSelectEncounter,
}: EncounterDetailModalProps) {
  const { staff } = useAuth();
  const initials =
    `${c.first_name?.charAt(0) ?? ''}${c.last_name?.charAt(0) ?? ''}`.toUpperCase();
  const doctorName = [c.doctor_first, c.doctor_last].filter(Boolean).join(' ');
  const sc = statusColors(c.status);

  const { data: addendums = [] } = useConsultationAddendums(c.id ?? '');
  const safeAddendums = addendums ?? [];
  const { showToast } = useToast();

  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<CareTab>('summary');
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<(CareplanSession & { plan_name: string; plan_type: string; careplan_status: string }) | null>(null);
  const [encounterFilterId, setEncounterFilterId] = useState<string>('all');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [sendOrdersLoading, setSendOrdersLoading] = useState(false);
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);
  const [labOrders, setLabOrders] = useState<EncounterLabOrder[]>([]);
  const [imagingOrders, setImagingOrders] = useState<EncounterImagingOrder[]>(
    [],
  );
  const [procedureOrders, setProcedureOrders] = useState<
    EncounterProcedureOrder[]
  >([]);
  const [medicationOrders, setMedicationOrders] = useState<
    EncounterMedicationOrder[]
  >([]);
  const [encounterNumberMap, setEncounterNumberMap] = useState<
    Record<string, string>
  >({});

  const [draftLabOrders, setDraftLabOrders] = useState<LabOrderDTO[]>([]);
  const [draftRadiologyOrders, setDraftRadiologyOrders] = useState<
    RadiologyOrderDTO[]
  >([]);
  const [draftPrescriptions, setDraftPrescriptions] = useState<
    PrescriptionOrderDTO[]
  >([]);
  const [draftProcedureOrders, setDraftProcedureOrders] = useState<
    ProcedureOrderDTO[]
  >([]);
  const [draftSpecialtyReferrals, setDraftSpecialtyReferrals] =
    useState<SpecialtyReferralsState>(createDefaultSpecialtyReferrals());

  const { data: labTests = [] } = useLabTestCatalogue();
  const { data: imagingStudies = [] } = useImagingCatalogue();
  const { data: drugs = [] } = useDrugCatalogue();
  const { data: proceduresCatalogue = [] } = useProcedureCatalogue();

  const labTestOptions = useMemo(
    () =>
      labTests.map((t: any) => ({
        id: t.id,
        name: t.test_name || t.name,
        code: t.test_code || t.code,
        category: t.category || 'General',
        price: t.price,
      })),
    [labTests],
  );

  const imagingOptions = useMemo(
    () =>
      imagingStudies.map((i: any) => ({
        id: i.imaging_id,
        name: i.imaging_name,
        code: i.imaging_code,
        category: i.imaging_type || 'General',
        extraInfo: i.body_part ?? undefined,
        price: i.price,
        requiresNhisAuth: i.requires_nhis_authorization || false,
      })),
    [imagingStudies],
  );

  const drugOptions = useMemo(
    () =>
      drugs.map((d: any) => ({
        id: d.id,
        name: d.drug_name || d.name,
        code: d.drug_code || d.code,
        category: d.category || 'General',
        price: d.price,
      })),
    [drugs],
  );

  const procedureOptions = useMemo(
    () =>
      proceduresCatalogue.map((p: any) => ({
        id: p.id,
        name: p.procedure_name || p.name,
        code: p.procedure_code || p.code,
        category: p.category || p.procedure_type || 'General',
        price: p.price,
      })),
    [proceduresCatalogue],
  );

  const currentSpecialtyKey = useMemo(
    () => normalizeSpecialtyKey(specialtyName),
    [specialtyName],
  );

  // Care plans for this patient
  const { data: patientCarePlans = [] } = usePatientCareplans(
    c.patient_id || undefined,
    currentSpecialtyKey?.toUpperCase(),
  );

  // All sessions across all care plans for this patient
  const { data: patientSessions = [] } = usePatientCareplanSessions(
    c.patient_id || undefined,
    currentSpecialtyKey?.toUpperCase(),
  );

  const encounterTheme = useMemo(
    () => getSpecialtyEncounterTheme(currentSpecialtyKey),
    [currentSpecialtyKey],
  );
  const draftOrderSelectionCount =
    draftLabOrders.length +
    draftRadiologyOrders.length +
    draftPrescriptions.length +
    draftProcedureOrders.length +
    Object.values(draftSpecialtyReferrals).filter((ref) => ref.selected).length;

  // All encounters for this same patient, sorted newest-first
  const patientEncounters = useMemo(() => {
    if (!c.patient_id) return [];
    return [...allHistory]
      .filter((h) => h.patient_id === c.patient_id)
      .sort((a, b) => {
        const da = new Date(a.consultation_date ?? a.created_at ?? 0).getTime();
        const db = new Date(b.consultation_date ?? b.created_at ?? 0).getTime();
        return db - da;
      });
  }, [allHistory, c.patient_id]);

  useEffect(() => {
    let cancelled = false;

    async function loadEncounterNumbers() {
      const encounterIds = Array.from(
        new Set(
          patientEncounters
            .map((enc) => enc.encounter_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      if (encounterIds.length === 0) {
        setEncounterNumberMap({});
        return;
      }

      try {
        const { data, error } = await supabase
          .from('visits')
          .select('id, encounter_number, visit_id')
          .in('id', encounterIds);

        if (error) throw error;
        if (cancelled) return;

        const rows = (data || []) as VisitLookupRow[];
        const map: Record<string, string> = {};

        for (const row of rows) {
          if (!row.id) continue;
          map[row.id] =
            row.encounter_number ||
            row.visit_id ||
            `ENC-${row.id.slice(0, 8).toUpperCase()}`;
        }

        for (const encounterId of encounterIds) {
          if (!map[encounterId]) {
            map[encounterId] = `ENC-${encounterId.slice(0, 8).toUpperCase()}`;
          }
        }

        setEncounterNumberMap(map);
      } catch (error) {
        console.error('Failed to load encounter numbers for selector:', error);
        if (!cancelled) {
          const fallback: Record<string, string> = {};
          for (const encounterId of encounterIds) {
            fallback[encounterId] =
              `ENC-${encounterId.slice(0, 8).toUpperCase()}`;
          }
          setEncounterNumberMap(fallback);
        }
      }
    }

    loadEncounterNumbers();

    return () => {
      cancelled = true;
    };
  }, [patientEncounters]);

  useEffect(() => {
    let cancelled = false;

    async function loadEncounterOrders() {
      const { encounterIds: encounterLookupIds, visitIds: visitLookupIds } =
        await resolveEncounterLookupIds(c.encounter_id, c.visit_id);
      if (encounterLookupIds.length === 0 && visitLookupIds.length === 0) {
        setLabOrders([]);
        setImagingOrders([]);
        setProcedureOrders([]);
        setMedicationOrders([]);
        setOrdersLoading(false);
        return;
      }

      setOrdersLoading(true);

      try {
        const [
          labByEncounterRes,
          labByVisitRes,
          imagingByEncounterRes,
          imagingByVisitRes,
          procedureRes,
          procedureRequestByEncounterRes,
          procedureRequestByVisitRes,
          prescriptionsByEncounterRes,
          prescriptionsByVisitRes,
        ] = await Promise.all([
          encounterLookupIds.length > 0
            ? supabase
                .from('lab_requests')
                .select(
                  'request_id, test_id, status, priority, clinical_notes, created_at, ordered_by',
                )
                .in('encounter_id', encounterLookupIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as EncounterLabOrder[] }),
          visitLookupIds.length > 0
            ? supabase
                .from('lab_requests')
                .select(
                  'request_id, test_id, status, priority, clinical_notes, created_at, ordered_by',
                )
                .in('visit_id', visitLookupIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as EncounterLabOrder[] }),
          encounterLookupIds.length > 0
            ? supabase
                .from('radiology_requests')
                .select('*')
                .in('encounter_id', encounterLookupIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as EncounterImagingOrder[] }),
          visitLookupIds.length > 0
            ? supabase
                .from('radiology_requests')
                .select('*')
                .in('visit_id', visitLookupIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as EncounterImagingOrder[] }),
          encounterLookupIds.length > 0
            ? supabase
                .from('procedures')
                .select(
                  'id, procedure_name, procedure_code, status, priority, indication, procedure_notes, scheduled_date, actual_end_time, findings, post_op_diagnosis, created_at, primary_surgeon_id, created_by',
                )
                .in('encounter_id', encounterLookupIds)
                .order('scheduled_date', {
                  ascending: false,
                  nullsFirst: false,
                })
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as EncounterProcedureOrder[] }),
          encounterLookupIds.length > 0
            ? supabase
                .from('procedure_requests')
                .select(
                  'request_id, procedure_id, procedure_name, procedure_type, status, priority, clinical_notes, notes, ordered_by, created_at',
                )
                .in('encounter_id', encounterLookupIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as EncounterProcedureRequestRow[] }),
          visitLookupIds.length > 0
            ? supabase
                .from('procedure_requests')
                .select(
                  'request_id, procedure_id, procedure_name, procedure_type, status, priority, clinical_notes, notes, ordered_by, created_at',
                )
                .in('visit_id', visitLookupIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as EncounterProcedureRequestRow[] }),
          encounterLookupIds.length > 0
            ? supabase
                .from('prescriptions')
                .select('*')
                .in('encounter_id', encounterLookupIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as EncounterMedicationOrder[] }),
          visitLookupIds.length > 0
            ? supabase
                .from('prescriptions')
                .select('*')
                .in('visit_id', visitLookupIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as EncounterMedicationOrder[] }),
        ]);

        const rawLabs = mergeUniqueRows(
          [
            ...((labByEncounterRes.data || []) as EncounterLabOrder[]),
            ...((labByVisitRes.data || []) as EncounterLabOrder[]),
          ].sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime(),
          ),
          (row) => row.request_id,
        );
        const rawImaging = mergeUniqueRows(
          [
            ...((imagingByEncounterRes.data || []) as EncounterImagingOrder[]),
            ...((imagingByVisitRes.data || []) as EncounterImagingOrder[]),
          ].sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime(),
          ),
          (row) => row.request_id,
        );
        const rawProcedures = (procedureRes.data ||
          []) as EncounterProcedureOrder[];
        const rawProcedureRequests = mergeUniqueRows(
          [
            ...((procedureRequestByEncounterRes.data ||
              []) as EncounterProcedureRequestRow[]),
            ...((procedureRequestByVisitRes.data ||
              []) as EncounterProcedureRequestRow[]),
          ].sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime(),
          ),
          (row) => row.request_id,
        );
        const rawPrescriptions = mergeUniqueRows(
          [
            ...((prescriptionsByEncounterRes.data ||
              []) as EncounterMedicationOrder[]),
            ...((prescriptionsByVisitRes.data ||
              []) as EncounterMedicationOrder[]),
          ].sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime(),
          ),
          (row) => row.prescription_id,
        );

        const labRequestIds = Array.from(
          new Set(
            rawLabs
              .map((o) => o.request_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const imagingRequestIds = Array.from(
          new Set(
            rawImaging
              .map((o) => o.request_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );

        const staffIds = Array.from(
          new Set(
            [
              ...rawLabs.map((o) => o.ordered_by),
              ...rawImaging.map((o) => o.ordered_by),
              ...rawProcedures.map((o) => o.primary_surgeon_id || o.created_by),
              ...rawProcedureRequests.map((o) => o.ordered_by),
              ...rawPrescriptions.map(
                (o) => o.prescribed_by || o.doctor_id || null,
              ),
            ].filter((id): id is string => Boolean(id)),
          ),
        );

        const testIds = Array.from(
          new Set(
            rawLabs
              .map((o) => o.test_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const imagingIds = Array.from(
          new Set(
            rawImaging
              .map((o) => o.imaging_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const procedureCatalogueIds = Array.from(
          new Set(
            rawProcedureRequests
              .map((o) => o.procedure_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const drugIds = Array.from(
          new Set(
            rawPrescriptions
              .map((o) => o.drug_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );

        const [
          staffRes,
          testsRes,
          imagingCatalogueRes,
          procedureCatalogueRes,
          drugsRes,
          labResultsRows,
          scanResultsRows,
        ] = await Promise.all([
          staffIds.length > 0
            ? supabase
                .from('staff')
                .select('staff_id, first_name, last_name')
                .in('staff_id', staffIds)
            : Promise.resolve({
                data: [] as Array<{
                  staff_id: string;
                  first_name: string | null;
                  last_name: string | null;
                }>,
              }),
          testIds.length > 0
            ? supabase
                .from('lab_test_catalogue')
                .select('id, name, code')
                .in('id', testIds)
            : Promise.resolve({
                data: [] as Array<{
                  id: string;
                  name: string | null;
                  code: string | null;
                }>,
              }),
          imagingIds.length > 0
            ? supabase
                .from('imaging_catalogue')
                .select('id, name, code')
                .in('id', imagingIds)
            : Promise.resolve({
                data: [] as Array<{
                  id: string;
                  name: string | null;
                  code: string | null;
                }>,
              }),
          procedureCatalogueIds.length > 0
            ? supabase
                .from('nhis_procedures')
                .select('id, name, code')
                .in('id', procedureCatalogueIds)
            : Promise.resolve({
                data: [] as Array<{
                  id: string;
                  name: string | null;
                  code: string | null;
                }>,
              }),
          drugIds.length > 0
            ? supabase.from('drug_catalogue').select('*').in('id', drugIds)
            : Promise.resolve({ data: [] as Array<any> }),
          fetchLabResultsByRequestIds(labRequestIds),
          fetchScanResultsByRequestIds(imagingRequestIds),
        ]);

        if (cancelled) return;

        const staffMap = new Map(
          (
            (staffRes.data || []) as Array<{
              staff_id: string;
              first_name: string | null;
              last_name: string | null;
            }>
          ).map((s) => {
            const fullName = [s.first_name, s.last_name]
              .filter(Boolean)
              .join(' ')
              .trim();
            return [
              s.staff_id,
              fullName || `Staff ${s.staff_id.slice(0, 8)}`,
            ] as const;
          }),
        );

        const testMap = new Map(
          (
            (testsRes.data || []) as Array<{
              id: string;
              name: string | null;
              code: string | null;
            }>
          ).map((t) => {
            const label = t.name
              ? `${t.name}${t.code ? ` (${t.code})` : ''}`
              : t.code || t.id;
            return [t.id, label] as const;
          }),
        );

        const imagingMap = new Map(
          (
            (imagingCatalogueRes.data || []) as Array<{
              id: string;
              name: string | null;
              code: string | null;
            }>
          ).map((i) => {
            const label = i.name
              ? `${i.name}${i.code ? ` (${i.code})` : ''}`
              : i.code || i.id;
            return [i.id, label] as const;
          }),
        );

        const procedureCatalogueMap = new Map(
          (
            (procedureCatalogueRes.data || []) as Array<{
              id: string;
              name: string | null;
              code: string | null;
            }>
          ).map((p) => {
            const label = p.name || p.code || p.id;
            return [p.id, { name: label, code: p.code || null }] as const;
          }),
        );

        const drugMap = new Map(
          ((drugsRes.data || []) as Array<any>).map((d) => {
            const label =
              d.drug_name ||
              d.name ||
              d.generic_name ||
              d.brand_name ||
              d.drug_code ||
              d.code ||
              d.id;
            return [d.id, label] as const;
          }),
        );

        const labResultMap = pickLatestByDate(
          labResultsRows,
          (lr) => lr.request_id,
          (lr) => lr.reported_at || lr.approved_at,
        );

        const scanResultMap = pickLatestByDate(
          scanResultsRows,
          (sr) => sr.request_id,
          (sr) => sr.reported_at || sr.report_date || sr.created_at,
        );

        setLabOrders(
          rawLabs.map((o) => ({
            ...o,
            test_name:
              (o.test_id && testMap.get(o.test_id)) || o.test_id || 'Lab Test',
            ordered_by_name:
              (o.ordered_by && staffMap.get(o.ordered_by)) ||
              'Unknown clinician',
            lab_result_value:
              labResultMap.get(o.request_id)?.result_value || null,
            lab_result_status:
              labResultMap.get(o.request_id)?.workflow_status || null,
            lab_result_interpretation:
              labResultMap.get(o.request_id)?.interpretation || null,
            lab_result_comments:
              labResultMap.get(o.request_id)?.comments || null,
            lab_result_reported_at:
              labResultMap.get(o.request_id)?.reported_at ||
              labResultMap.get(o.request_id)?.approved_at ||
              null,
            lab_result_unit:
              labResultMap.get(o.request_id)?.unit || null,
            lab_result_reference_range:
              labResultMap.get(o.request_id)?.reference_range || null,
            lab_result_is_abnormal:
              labResultMap.get(o.request_id)?.is_abnormal ?? null,
            lab_result_is_critical:
              labResultMap.get(o.request_id)?.is_critical ?? null,
          })),
        );

        setImagingOrders(
          rawImaging.map((o) => ({
            ...o,
            notes: o.notes || o.clinical_history || null,
            imaging_name:
              (o.imaging_id && imagingMap.get(o.imaging_id)) ||
              o.imaging_type ||
              o.imaging_id ||
              'Imaging study',
            ordered_by_name:
              (o.ordered_by && staffMap.get(o.ordered_by)) ||
              'Unknown clinician',
            result_findings: scanResultMap.get(o.request_id)?.findings || null,
            result_impression:
              scanResultMap.get(o.request_id)?.impression || null,
            result_notes: scanResultMap.get(o.request_id)?.notes || null,
            result_reported_at:
              scanResultMap.get(o.request_id)?.reported_at ||
              scanResultMap.get(o.request_id)?.report_date ||
              scanResultMap.get(o.request_id)?.created_at ||
              null,
            result_status:
              scanResultMap.get(o.request_id)?.workflow_status || null,
            result_extra_fields:
              scanResultMap.get(o.request_id)?.extra_fields || [],
          })),
        );

        setProcedureOrders(
          [
            ...rawProcedureRequests.map((o) => {
              const requestedById = o.ordered_by;
              const catalogue = o.procedure_id
                ? procedureCatalogueMap.get(o.procedure_id)
                : undefined;
              return {
                id: o.request_id,
                procedure_name:
                  o.procedure_name ||
                  catalogue?.name ||
                  o.procedure_type ||
                  'Procedure Request',
                procedure_code: catalogue?.code || o.procedure_id,
                status: o.status,
                priority: o.priority,
                indication: o.clinical_notes,
                procedure_notes: o.notes,
                scheduled_date: null,
                actual_end_time: null,
                created_at: o.created_at,
                primary_surgeon_id: null,
                created_by: o.ordered_by,
                findings: null,
                post_op_diagnosis: null,
                requested_by_name:
                  (requestedById && staffMap.get(requestedById)) ||
                  'Unknown clinician',
              } as EncounterProcedureOrder;
            }),
            ...rawProcedures.map((o) => {
              const requestedById = o.primary_surgeon_id || o.created_by;
              return {
                ...o,
                requested_by_name:
                  (requestedById && staffMap.get(requestedById)) ||
                  'Unknown clinician',
              };
            }),
          ].sort((a, b) => {
            const aTs = new Date(
              a.scheduled_date || a.created_at || 0,
            ).getTime();
            const bTs = new Date(
              b.scheduled_date || b.created_at || 0,
            ).getTime();
            return bTs - aTs;
          }),
        );

        setMedicationOrders(
          rawPrescriptions.map((o) => {
            const prescribedBy = o.prescribed_by || o.doctor_id || null;
            return {
              ...o,
              dose: o.dose || o.dosage || null,
              instructions: o.instructions || o.notes || null,
              special_instructions: o.special_instructions || o.notes || null,
              drug_name: (o.drug_id && drugMap.get(o.drug_id)) || 'Medication',
              ordered_by_name:
                (prescribedBy && staffMap.get(prescribedBy)) ||
                'Unknown clinician',
            };
          }),
        );
      } catch (error) {
        console.error('Failed to load specialty encounter orders:', error);
        if (!cancelled) {
          setLabOrders([]);
          setImagingOrders([]);
          setProcedureOrders([]);
          setMedicationOrders([]);
        }
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }

    loadEncounterOrders();

    return () => {
      cancelled = true;
    };
  }, [c.encounter_id, c.visit_id, ordersRefreshToken]);

  async function handleSendOrdersAndServices() {
    if (!c.encounter_id || !c.patient_id) {
      showToast({
        type: 'warning',
        title: 'Cannot Send Requests',
        message:
          'Encounter and patient identifiers are required before sending Orders & Services.',
      });
      return;
    }

    if (!staff?.staff_id) {
      showToast({
        type: 'warning',
        title: 'Cannot Send Requests',
        message:
          'Current staff profile is missing required ordering identifier.',
      });
      return;
    }

    const payload: SpecialtyOrdersPayload = {
      labOrders: draftLabOrders,
      radiologyOrders: draftRadiologyOrders,
      prescriptions: draftPrescriptions,
      procedureOrders: draftProcedureOrders,
      specialtyReferrals: draftSpecialtyReferrals,
    };

    if (draftOrderSelectionCount === 0) {
      showToast({
        type: 'warning',
        title: 'No Requests Selected',
        message:
          'Select at least one item in Orders & Services before sending.',
      });
      return;
    }

    setSendOrdersLoading(true);
    try {
      const submitted = await submitSpecialtyOrdersAndReferrals({
        patientPublicId: c.patient_id,
        encounterId: c.encounter_id,
        orderedByStaffId: staff.staff_id,
        orderedByStaffUuid: staff.id || staffId,
        currentSpecialty: currentSpecialtyKey,
        orders: payload,
        consultationId: c.id,
        diagnosisText: c.diagnosis || '',
        clinicalFindings: [
          c.chief_complaint,
          c.clinical_notes,
          c.examination_findings,
          c.treatment_plan,
        ]
          .filter(Boolean)
          .join('; '),
        patientName: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        patientEmrNumber: c.emr_number,
      });

      const sentCount =
        submitted.labCount +
        submitted.imagingCount +
        submitted.prescriptionCount +
        submitted.procedureCount +
        submitted.referralCount;

      showToast({
        type: 'success',
        title: 'Requests Sent',
        message: `${sentCount} Orders & Services request(s) sent successfully.`,
      });

      setDraftLabOrders([]);
      setDraftRadiologyOrders([]);
      setDraftPrescriptions([]);
      setDraftProcedureOrders([]);
      setDraftSpecialtyReferrals(createDefaultSpecialtyReferrals());
      setOrdersRefreshToken((v) => v + 1);
      setActiveTab('summary');
    } catch (error) {
      console.error('Failed to submit orders from specialty timeline:', error);
      showToast({
        type: 'error',
        title: 'Send Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not send one or more Orders & Services requests.',
      });
    } finally {
      setSendOrdersLoading(false);
    }
  }

  const handleCopy = (text: string, sectionId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(sectionId);
      setTimeout(() => setCopiedSection(null), 2000);
      showToast({
        type: 'success',
        title: 'Copied',
        message: 'Copied to clipboard',
      });
    });
  };

  const handleShareSummary = () => {
    const lines = [
      `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(),
      c.emr_number ? `EMR: ${c.emr_number}` : '',
      `${specialtyName} · ${fmtDate(c.consultation_date ?? c.created_at, true)}`,
      c.chief_complaint || c.complaints
        ? `Chief complaint: ${c.chief_complaint || c.complaints}`
        : '',
      c.diagnosis ? `Diagnosis: ${c.diagnosis}` : '',
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      showToast({
        type: 'success',
        title: 'Shared',
        message: 'Encounter summary copied — paste into email or chat.',
      });
    });
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const specialtyEntries = useMemo(() => {
    if (!c.specialty_data || typeof c.specialty_data !== 'object') return [];
    return Object.entries(c.specialty_data as Record<string, unknown>).filter(
      ([k]) => !INTERNAL_KEYS.has(k),
    );
  }, [c.specialty_data]);

  const examinationStructuredLabel = useMemo(
    () => structuredExaminationLabel(specialtyName),
    [specialtyName],
  );

  const icdCodes = useMemo(() => {
    if (!c.icd_codes || !Array.isArray(c.icd_codes)) return [];
    return c.icd_codes.map((icd, i) => ({
      code: typeof icd === 'string' ? icd : icd.code,
      description: typeof icd !== 'string' ? (icd.description ?? '') : '',
      isPrimary:
        typeof icd !== 'string' ? (icd.is_primary ?? i === 0) : i === 0,
    }));
  }, [c.icd_codes]);

  const referralUrgency = useMemo(
    () =>
      deriveReferralUrgency(
        [...labOrders, ...imagingOrders, ...procedureOrders].map(
          (o) => o.priority,
        ),
        c.chief_complaint || c.complaints,
      ),
    [
      labOrders,
      imagingOrders,
      procedureOrders,
      c.chief_complaint,
      c.complaints,
    ],
  );

  const tabItems = [
    { id: 'summary' as const, label: 'Summary', icon: Activity },
    {
      id: 'orders-services' as const,
      label: 'Orders & Services',
      icon: Send,
      count: draftOrderSelectionCount,
    },
    { id: 'doctor-notes' as const, label: 'Doctor Notes', icon: BookOpen },
    { id: 'treatment-plan' as const, label: 'Treatment Plan', icon: Pill },
    {
      id: 'lab-orders' as const,
      label: 'Lab Orders',
      icon: FileText,
      count: labOrders.length,
    },
    {
      id: 'imaging-orders' as const,
      label: 'Imaging Orders',
      icon: Activity,
      count: imagingOrders.length,
    },
    {
      id: 'procedure-orders' as const,
      label: 'Procedure Orders',
      icon: Layers,
      count: procedureOrders.length,
    },
    {
      id: 'medications' as const,
      label: 'Medications',
      icon: Tag,
      count: medicationOrders.length,
    },
    {
      id: 'care-plans' as const,
      label: 'Care Plans',
      icon: Heart,
      count: patientCarePlans.length,
    },
    {
      id: 'sessions' as const,
      label: 'Sessions',
      icon: CalendarPlus,
      count: patientSessions.length,
    },
    {
      id: 'history' as const,
      label: 'History',
      icon: Calendar,
      count: patientEncounters.length,
    },
    {
      id: 'addendum' as const,
      label: 'Addendum',
      icon: PenLine,
      count: safeAddendums.length,
    },
  ];

  const activeTabMeta =
    tabItems.find((tab) => tab.id === activeTab) || tabItems[0];

  const showDoctorNotes =
    activeTab === 'summary' || activeTab === 'doctor-notes';
  const showTreatment =
    activeTab === 'summary' || activeTab === 'treatment-plan';
  const showLabOrders = activeTab === 'summary' || activeTab === 'lab-orders';
  const showImagingOrders =
    activeTab === 'summary' || activeTab === 'imaging-orders';
  const showProcedureOrders =
    activeTab === 'summary' || activeTab === 'procedure-orders';
  const showAddendum = activeTab === 'summary' || activeTab === 'addendum';

  const isDentalSpecialty = useMemo(
    () => specialtyName.toLowerCase().includes('dent'),
    [specialtyName],
  );

  /** One timeline category: narrative + structured summary + template fields + dental record. */
  const showUnifiedExaminations = useMemo(
    () =>
      showDoctorNotes ||
      (showProcedureOrders &&
        (specialtyEntries.length > 0 ||
          (isDentalSpecialty && Boolean(c.encounter_id)))),
    [
      showDoctorNotes,
      showProcedureOrders,
      specialtyEntries.length,
      isDentalSpecialty,
      c.encounter_id,
    ],
  );

  function scrollToEncounterSection(id: string) {
    if (id === 'ecm-lab') setActiveTab('lab-orders');
    else if (id === 'ecm-imaging') setActiveTab('imaging-orders');
    else if (id === 'ecm-procedure') setActiveTab('procedure-orders');
    else if (id === 'ecm-addendum') setActiveTab('addendum');
    else if (id === 'ecm-sessions') setActiveTab('sessions');
    else if (id === 'ecm-careplans') setActiveTab('care-plans');
    else if (id === 'ecm-chief') {
      if (activeTab !== 'summary' && activeTab !== 'doctor-notes')
        setActiveTab('summary');
    } else if (id === 'ecm-diagnosis' || id === 'ecm-treatment') {
      if (activeTab !== 'summary' && activeTab !== 'treatment-plan')
        setActiveTab('summary');
    } else if (
      id === 'ecm-examinations' ||
      id === 'ecm-specialty' ||
      id === 'ecm-exam'
    ) {
      if (!['summary', 'doctor-notes', 'procedure-orders'].includes(activeTab))
        setActiveTab('summary');
    } else if (id === 'ecm-notes') {
      if (activeTab !== 'summary' && activeTab !== 'doctor-notes')
        setActiveTab('summary');
    }
    const scrollTargetId =
      id === 'ecm-exam' || id === 'ecm-specialty' ? 'ecm-examinations' : id;
    window.requestAnimationFrame(() => {
      window.setTimeout(
        () =>
          document
            .getElementById(scrollTargetId)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        90,
      );
    });
  }

  // Build encounter options for the shared layout selector
  const layoutEncounterOptions = patientEncounters.map((enc, index) => {
    const encounterDate = fmtDate(enc.consultation_date ?? enc.created_at);
    const visitCode =
      (enc.encounter_id && encounterNumberMap[enc.encounter_id]) ||
      enc.visit_id ||
      (enc.encounter_id
        ? `ENC-${enc.encounter_id.slice(0, 8).toUpperCase()}`
        : `Visit ${patientEncounters.length - index}`);
    return { id: enc.id || '', label: `${encounterDate} | ${visitCode}` };
  });

  // Build jump-to items for sidebar
  const layoutJumpToItems = [
    { id: 'ecm-chief', label: 'Chief Complaint' },
    { id: 'ecm-notes', label: 'Clinical Notes (HPI)' },
    ...(showUnifiedExaminations
      ? [{ id: 'ecm-examinations', label: 'Examinations' }]
      : []),
    { id: 'ecm-diagnosis', label: 'Diagnosis' },
    { id: 'ecm-treatment', label: 'Treatment Plan' },
    { id: 'ecm-lab', label: 'Lab Orders' },
    { id: 'ecm-imaging', label: 'Imaging Orders' },
    { id: 'ecm-procedure', label: 'Procedure Orders' },
    ...(patientSessions.length > 0
      ? [{ id: 'ecm-sessions', label: `Sessions (${patientSessions.length})` }]
      : []),
    ...(patientCarePlans.length > 0
      ? [{ id: 'ecm-careplans', label: `Care Plans (${patientCarePlans.length})` }]
      : []),
    { id: 'ecm-addendum', label: 'Addendum' },
  ];

  // Map icdCodes for layout
  const layoutDiagnosisCodes = icdCodes.map((icd) => ({
    code: icd.code,
    description: icd.description,
    isPrimary: icd.isPrimary,
  }));

  return (
    <>
    <EncounterDetailLayout
      mode="modal"
      patientName={`${c.first_name} ${c.last_name}`}
      emrNumber={c.emr_number || ''}
      initials={initials}
      specialtyName={specialtyName}
      theme={encounterTheme}
      encounterDate={fmtDate(c.consultation_date ?? c.created_at, true)}
      visitId={c.visit_id || undefined}
      status={normalizeConsultationStatus(c.status)}
      statusBadgeClass={sc.badge}
      doctorName={doctorName}
      diagnosisCodes={layoutDiagnosisCodes}
      jumpToItems={layoutJumpToItems}
      onJumpTo={scrollToEncounterSection}
      urgentAlert={
        (referralUrgency.level === 'high' || referralUrgency.level === 'stat') ? (
          <div className="p-4 mt-auto border-t border-rose-100 bg-rose-50/90">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Urgent alert</p>
                <p className="text-xs text-rose-900 font-semibold mt-0.5">
                  {referralUrgency.level === 'stat'
                    ? 'Stat priority requests are associated with this encounter.'
                    : 'High-priority clinical or order activity — review promptly.'}
                </p>
              </div>
            </div>
          </div>
        ) : undefined
      }
      onPrint={() => window.print()}
      onShare={handleShareSummary}
      onClose={onClose}
      isExpanded={isExpanded}
      onToggleExpand={() => setIsExpanded(!isExpanded)}
      headerActions={
        <>
          <button
            type="button"
            onClick={() => scrollToEncounterSection('ecm-addendum')}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold border border-slate-200 bg-white ${encounterTheme.text} hover:bg-slate-50 shadow-sm`}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            + Addendum Note
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setActionsMenuOpen((v) => !v)}
              className="hidden md:inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <MoreVertical className="w-3.5 h-3.5" />
              Actions
            </button>
            {actionsMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setActionsMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                  <button
                    type="button"
                    onClick={() => { scrollToEncounterSection('ecm-addendum'); setActionsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <PenLine className="h-4 w-4" />
                    Add Clinical Note
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('orders-services'); setActionsMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Orders & Services
                  </button>
                  {patientCarePlans.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('care-plans'); setActionsMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Heart className="h-4 w-4" />
                      Care Plans
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      }
      updatesCount={safeAddendums.length}
      encounterOptions={layoutEncounterOptions}
      selectedEncounterId={encounterFilterId}
      onSelectEncounter={(val) => {
        setEncounterFilterId(val);
        if (val !== 'all') {
          const selected = patientEncounters.find((enc) => enc.id === val);
          if (selected && selected.id !== c.id) onSelectEncounter(selected);
        }
      }}
      showAllEncountersOption
      workspaceTabs={tabItems}
      activeTabId={activeTab}
      onChangeTab={(id) => setActiveTab(id as CareTab)}
      footer={
        <footer className="shrink-0 border-t border-slate-200/90 bg-white px-5 md:px-7 py-4 flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex items-center justify-center rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-md transition-colors ${encounterTheme.primary} ${encounterTheme.primaryHover}`}
          >
            Close encounter
          </button>
        </footer>
      }
    >
                  {(activeTab === 'summary' ||
                    activeTab === 'doctor-notes') && (
                    <div
                      id="ecm-chief"
                      className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8 scroll-mt-28 print:mb-4 print:grid-cols-1"
                    >
                      <div
                        className={`lg:col-span-2 relative overflow-hidden rounded-2xl border ${encounterTheme.complaintCardAccent} bg-white shadow-sm p-6`}
                      >
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.16em] mb-3">
                          Chief complaint
                        </p>
                        <p className="text-lg font-semibold text-slate-900 leading-snug relative z-10 whitespace-pre-line">
                          {c.chief_complaint || c.complaints
                            ? `“${c.chief_complaint || c.complaints}”`
                            : '—'}
                        </p>
                        <div className="pointer-events-none absolute right-3 bottom-1 opacity-[0.06]">
                          <Activity className="w-28 h-28 text-slate-900" />
                        </div>
                      </div>
                      <div
                        className={`rounded-2xl bg-gradient-to-br ${encounterTheme.priorityFrom} ${encounterTheme.priorityTo} text-white shadow-md p-5 flex flex-col justify-center min-h-[120px]`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 mb-3">
                          Referral / order priority
                        </p>
                        <div className="flex items-center gap-3">
                          <TrendingUp className="w-9 h-9 shrink-0 opacity-90" />
                          <div>
                            <p className="text-2xl font-black tracking-tight">
                              {referralUrgency.label}
                            </p>
                            <p className="text-xs text-white/80 mt-1">
                              From encounter orders &amp; triage cues
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === 'history' ? (
                    <div className="space-y-3">
                      {patientEncounters.length > 0 ? (
                        patientEncounters.map((enc) => {
                          const isActive = enc.id === c.id;
                          const encDoctor = [enc.doctor_first, enc.doctor_last]
                            .filter(Boolean)
                            .join(' ');
                          const encSc = statusColors(enc.status);
                          return (
                            <button
                              key={enc.id}
                              onClick={() => {
                                if (!isActive) onSelectEncounter(enc);
                              }}
                              className={`w-full text-left bg-white rounded-xl border p-4 transition-all ${
                                isActive
                                  ? 'border-primary-500 shadow-sm'
                                  : 'border-slate-200 hover:border-primary-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${encSc.badge}`}
                                >
                                  {normalizeConsultationStatus(enc.status)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {fmtRelative(
                                    enc.consultation_date ?? enc.created_at,
                                  )}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-slate-800">
                                {fmtDate(
                                  enc.consultation_date ?? enc.created_at,
                                  true,
                                )}
                              </p>
                              {encDoctor && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Dr. {encDoctor}
                                </p>
                              )}
                              {(enc.chief_complaint || enc.complaints) && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                  {enc.chief_complaint || enc.complaints}
                                </p>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                          No encounter history available.
                        </div>
                      )}
                    </div>
                  ) : activeTab === 'medications' ? (
                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                            Medication Orders Requested by Doctors
                          </h4>
                        </div>
                        <div className="p-4 space-y-3">
                          {ordersLoading ? (
                            <p className="text-sm text-slate-500">
                              Loading medication orders...
                            </p>
                          ) : medicationOrders.length > 0 ? (
                            medicationOrders.map((order) => (
                              <div
                                key={order.prescription_id}
                                className="p-3 border border-slate-200 rounded-lg bg-white"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {order.drug_name || 'Medication'}
                                  </p>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${orderStatusBadgeClass(order.status)}`}
                                  >
                                    {order.status || 'Pending'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">
                                  {order.route
                                    ? `Route: ${order.route} • `
                                    : ''}
                                  {order.quantity_prescribed != null
                                    ? `Qty Prescribed: ${order.quantity_prescribed} • `
                                    : ''}
                                  {order.quantity_dispensed != null
                                    ? `Qty Dispensed: ${order.quantity_dispensed} • `
                                    : ''}
                                  Requested by:{' '}
                                  {order.ordered_by_name || 'Unknown clinician'}
                                  {order.created_at
                                    ? ` • ${fmtDate(order.created_at, true)}`
                                    : ''}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                  {[
                                    order.dosage || order.dose,
                                    order.frequency,
                                    order.duration,
                                  ]
                                    .filter(Boolean)
                                    .join(' • ') ||
                                    'No dosage instructions recorded.'}
                                </p>
                                {(order.instructions ||
                                  order.special_instructions) && (
                                  <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">
                                    {order.instructions ||
                                      order.special_instructions}
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">
                              No medication orders found for this encounter.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : activeTab === 'care-plans' ? (
                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                            Care Plans
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Longitudinal care plans for this patient in {specialtyName}
                          </p>
                        </div>
                        <div className="p-4 space-y-3">
                          {patientCarePlans.length > 0 ? (
                            patientCarePlans.map((plan) => (
                              <CarePlanSummaryCard key={plan.id} plan={plan} specialtyName={specialtyName} />
                            ))
                          ) : (
                            <div className="text-center py-8">
                              <Heart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                              <p className="text-sm text-slate-500">
                                No care plans found for this patient in {specialtyName}.
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                Care plans are created during consultation when a care plan is included.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : activeTab === 'sessions' ? (
                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                            Care Plan Sessions
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            All recorded sessions across care plans for this patient in {specialtyName}
                          </p>
                        </div>

                        {patientSessions.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {patientSessions.map((s) => {
                              const isCompleted = s.status === 'Completed';
                              const isMissed = s.status === 'Missed';
                              const isCancelled = s.status === 'Cancelled';
                              return (
                                <div
                                  key={s.id}
                                  className={`p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isCompleted ? 'bg-green-50/30' : ''}`}
                                  onClick={() => setSelectedSession(s)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                      isCompleted ? 'bg-green-100 text-green-700'
                                        : isMissed || isCancelled ? 'bg-red-100 text-red-700'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {s.session_number}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-slate-900">Session {s.session_number}</span>
                                        <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                                          isCompleted ? 'bg-green-100 text-green-700'
                                            : isMissed || isCancelled ? 'bg-red-100 text-red-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {s.status?.replace(/_/g, ' ')}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        <span className="font-semibold text-slate-600">{s.plan_name}</span>
                                        <span className="text-slate-400"> · </span>
                                        {s.plan_type?.replace(/_/g, ' ')}
                                      </p>
                                      {isCompleted && s.notes && (
                                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{s.notes}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {s.completed_date ? (
                                      <p className="text-xs text-slate-400">{fmtDate(s.completed_date)}</p>
                                    ) : s.scheduled_date ? (
                                      <p className="text-xs text-slate-400">{fmtDate(s.scheduled_date)}</p>
                                    ) : (
                                      <p className="text-xs text-slate-400">{fmtRelative(s.created_at)}</p>
                                    )}
                                    {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                    {(isMissed || isCancelled) && <X className="h-5 w-5 text-red-400" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <CalendarPlus className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="text-sm text-slate-500">
                              No sessions recorded for this patient in {specialtyName}.
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Sessions are created when care plan treatments are administered.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : activeTab === 'orders-services' ? (
                    <div className="space-y-4">
                      <div className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                              Orders & Services Request Form
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Use consultation order logic to send requests to
                              Pharmacy, Lab, Imaging, Procedures, and Referrals.
                            </p>
                          </div>
                          <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            Selected: {draftOrderSelectionCount}
                          </div>
                        </div>

                        <SpecialtyOrdersStep
                          currentSpecialty={currentSpecialtyKey}
                          labOrders={draftLabOrders}
                          radiologyOrders={draftRadiologyOrders}
                          prescriptions={draftPrescriptions}
                          procedureOrders={draftProcedureOrders}
                          onLabOrdersChange={setDraftLabOrders}
                          onRadiologyOrdersChange={setDraftRadiologyOrders}
                          onPrescriptionsChange={setDraftPrescriptions}
                          onProcedureOrdersChange={setDraftProcedureOrders}
                          specialtyReferrals={draftSpecialtyReferrals}
                          onSpecialtyReferralsChange={
                            setDraftSpecialtyReferrals
                          }
                          labTestOptions={labTestOptions}
                          imagingOptions={imagingOptions}
                          drugOptions={drugOptions}
                          procedureOptions={procedureOptions}
                          clinicalFindings={[
                            c.chief_complaint,
                            c.clinical_notes,
                            c.examination_findings,
                          ]
                            .filter(Boolean)
                            .join('; ')}
                          provisionalDiagnosis={c.diagnosis || ''}
                          patientName={`${c.first_name || ''} ${c.last_name || ''}`.trim()}
                          readOnly={false}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setDraftLabOrders([]);
                            setDraftRadiologyOrders([]);
                            setDraftPrescriptions([]);
                            setDraftProcedureOrders([]);
                            setDraftSpecialtyReferrals(
                              createDefaultSpecialtyReferrals(),
                            );
                          }}
                          className="px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                          disabled={sendOrdersLoading}
                        >
                          Clear Selection
                        </button>
                        <button
                          onClick={handleSendOrdersAndServices}
                          className="px-3 py-2 text-xs font-semibold text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60"
                          disabled={
                            sendOrdersLoading || draftOrderSelectionCount === 0
                          }
                        >
                          {sendOrdersLoading
                            ? 'Sending Requests...'
                            : 'Send Requests'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      {showDoctorNotes && (
                        <div id="ecm-notes" className="scroll-mt-28">
                          <TimelineSectionCard
                            icon={<BookOpen className="w-3 h-3" />}
                            title="Clinical Notes / History (HPI)"
                            color="blue"
                            rightElement={
                              c.clinical_notes ? (
                                <button
                                  onClick={() =>
                                    handleCopy(c.clinical_notes || '', 'notes')
                                  }
                                  className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1.5 text-xs uppercase font-bold tracking-wider"
                                  title="Copy to clipboard"
                                >
                                  {copiedSection === 'notes' ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                  {copiedSection === 'notes' ? (
                                    <span className="text-emerald-500">
                                      Copied
                                    </span>
                                  ) : (
                                    'Copy'
                                  )}
                                </button>
                              ) : undefined
                            }
                          >
                            {c.clinical_notes ||
                            c.history_of_present_illness ||
                            c.past_medical_history ||
                            c.family_history ||
                            c.social_history ||
                            c.review_of_systems ? (
                              <div className="space-y-4 rounded-xl bg-slate-100/90 border border-slate-200/90 border-l-4 border-l-slate-700 pl-4 pr-4 py-4">
                                {c.clinical_notes && (
                                  <div>
                                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                                      Clinical Notes
                                    </p>
                                    <p className="text-base text-slate-800 leading-relaxed whitespace-pre-line">
                                      {c.clinical_notes}
                                    </p>
                                  </div>
                                )}
                                {c.history_of_present_illness && (
                                  <div>
                                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                                      History of Present Illness
                                    </p>
                                    <p className="text-base text-slate-800 leading-relaxed whitespace-pre-line">
                                      {c.history_of_present_illness}
                                    </p>
                                  </div>
                                )}
                                {c.past_medical_history && (
                                  <div>
                                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                                      Past Medical History
                                    </p>
                                    <p className="text-base text-slate-800 leading-relaxed whitespace-pre-line">
                                      {c.past_medical_history}
                                    </p>
                                  </div>
                                )}
                                {c.family_history && (
                                  <div>
                                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                                      Family History
                                    </p>
                                    <p className="text-base text-slate-800 leading-relaxed whitespace-pre-line">
                                      {c.family_history}
                                    </p>
                                  </div>
                                )}
                                {c.social_history && (
                                  <div>
                                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                                      Social History
                                    </p>
                                    <p className="text-base text-slate-800 leading-relaxed whitespace-pre-line">
                                      {c.social_history}
                                    </p>
                                  </div>
                                )}
                                {c.review_of_systems && (
                                  <div>
                                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                                      Review of Systems
                                    </p>
                                    <p className="text-base text-slate-800 leading-relaxed whitespace-pre-line">
                                      {c.review_of_systems}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-base text-slate-400 italic">
                                Not recorded.
                              </p>
                            )}
                          </TimelineSectionCard>
                        </div>
                      )}

                      {showUnifiedExaminations && (
                        <div id="ecm-examinations" className="scroll-mt-28">
                          {(() => {
                            const summaryRaw = (
                              c.specialty_data as Record<string, unknown> | null
                            )?._exam_summary;
                            const specialtySummary =
                              typeof summaryRaw === 'string' ? summaryRaw : '';
                            const examNarrative =
                              c.examination_findings ||
                              c.physical_examination ||
                              '';
                            const narrativeDisplay =
                              examNarrative ||
                              (!examNarrative && specialtySummary
                                ? specialtySummary
                                : '');
                            const focusDisplay =
                              examNarrative &&
                              specialtySummary &&
                              specialtySummary.trim() !== examNarrative.trim()
                                ? specialtySummary
                                : examNarrative
                                  ? ''
                                  : '';
                            const showNarrativeBlock = showDoctorNotes;
                            const showTemplateBlock =
                              showProcedureOrders &&
                              specialtyEntries.length > 0;
                            const showDentalBlock =
                              showProcedureOrders &&
                              isDentalSpecialty &&
                              Boolean(c.encounter_id);

                            return (
                              <TimelineSectionCard
                                icon={<Stethoscope className="w-3 h-3" />}
                                title="Examinations"
                                color="teal"
                              >
                                <div className="space-y-6">
                                  {showNarrativeBlock && (
                                    <section className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
                                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                        Free-text findings
                                      </p>
                                      <div className="space-y-4">
                                        <div>
                                          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-teal-700">
                                            Examination narrative
                                          </p>
                                          {narrativeDisplay ? (
                                            <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                                              {narrativeDisplay}
                                            </p>
                                          ) : (
                                            <p className="text-sm italic text-slate-400">
                                              Not recorded.
                                            </p>
                                          )}
                                        </div>
                                        <div className="border-t border-slate-200 pt-4">
                                          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-teal-700">
                                            Structured summary (from template)
                                          </p>
                                          {focusDisplay ? (
                                            <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                                              {focusDisplay}
                                            </p>
                                          ) : (
                                            <p className="text-sm italic text-slate-400">
                                              {examNarrative
                                                ? 'No separate structured summary beyond the narrative above.'
                                                : 'No structured examination summary on file.'}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </section>
                                  )}

                                  {showTemplateBlock && (
                                    <section
                                      className={
                                        showNarrativeBlock
                                          ? 'border-t border-slate-200 pt-6'
                                          : ''
                                      }
                                    >
                                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                        {examinationStructuredLabel} —
                                        structured fields
                                      </p>
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {specialtyEntries.map(([key, val]) => {
                                          const rendered =
                                            renderSpecialtyValue(val);
                                          const isLong = rendered.length > 50;
                                          const label =
                                            resolveSpecialtyFieldLabel(
                                              key,
                                              c.specialty_data as Record<
                                                string,
                                                unknown
                                              >,
                                            );
                                          return (
                                            <div
                                              key={key}
                                              className={`rounded-lg border border-teal-100 bg-teal-50/90 px-4 py-3 ${
                                                isLong ? 'sm:col-span-2' : ''
                                              }`}
                                            >
                                              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-teal-700">
                                                {label}
                                              </p>
                                              <p className="text-base font-medium leading-snug whitespace-pre-line break-words text-slate-800">
                                                {rendered}
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </section>
                                  )}

                                  {showDentalBlock && (
                                    <section
                                      className={
                                        showNarrativeBlock || showTemplateBlock
                                          ? 'border-t border-slate-200 pt-6'
                                          : ''
                                      }
                                    >
                                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                        Dental chart &amp; encounter examination
                                      </p>
                                      {c.encounter_id ? (
                                        <DentalExamPanel
                                          encounterId={c.encounter_id}
                                        />
                                      ) : null}
                                    </section>
                                  )}

                                  {!showNarrativeBlock &&
                                  !showTemplateBlock &&
                                  !showDentalBlock ? (
                                    <p className="text-base italic text-slate-400">
                                      No examination content for this view.
                                    </p>
                                  ) : null}
                                </div>
                              </TimelineSectionCard>
                            );
                          })()}
                        </div>
                      )}

                      {showLabOrders && (
                        <div id="ecm-lab" className="scroll-mt-28">
                          <TimelineSectionCard
                            icon={<FileText className="w-3 h-3" />}
                            title={`Lab Orders Requested${labOrders.length > 0 ? ` — ${labOrders.length}` : ''}`}
                            color="indigo"
                          >
                            {!c.encounter_id ? (
                              <p className="text-base text-slate-400 italic">
                                No encounter link found for this consultation.
                              </p>
                            ) : ordersLoading ? (
                              <p className="text-base text-slate-400 italic">
                                Loading lab orders...
                              </p>
                            ) : labOrders.length > 0 ? (
                              <div className="space-y-4">
                                {labOrders.map((order) => {
                                  const hasLabResult = Boolean(
                                    order.lab_result_value ||
                                    order.lab_result_interpretation ||
                                    order.lab_result_comments ||
                                    order.lab_result_reported_at ||
                                    order.lab_result_status,
                                  );
                                  const isCritical = order.lab_result_is_critical === true;
                                  const isAbnormal = !isCritical && order.lab_result_is_abnormal === true;
                                  const cardBorder = isCritical
                                    ? 'border-red-200 bg-white'
                                    : isAbnormal
                                      ? 'border-amber-200 bg-white'
                                      : 'border-slate-200 bg-white';
                                  return (
                                    <div
                                      key={order.request_id}
                                      className={`rounded-xl border ${cardBorder} shadow-sm overflow-hidden`}
                                    >
                                      {/* Header bar */}
                                      <div className={`px-4 py-2.5 flex items-center justify-between gap-3 ${
                                        isCritical ? 'bg-red-50' : isAbnormal ? 'bg-amber-50' : 'bg-indigo-50/60'
                                      }`}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <p className="text-sm font-bold text-slate-900 truncate">
                                            {order.test_name || 'Lab test'}
                                          </p>
                                          {isCritical && (
                                            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-600 text-white">
                                              CRITICAL
                                            </span>
                                          )}
                                          {isAbnormal && (
                                            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500 text-white">
                                              ABNORMAL
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${orderStatusBadgeClass(order.status)}`}>
                                            {order.status || 'Pending'}
                                          </span>
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                            hasLabResult ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                          }`}>
                                            {hasLabResult ? order.lab_result_status || 'Result Available' : 'Awaiting Result'}
                                          </span>
                                        </div>
                                      </div>
                                      {/* Meta row */}
                                      <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                        {order.priority && <span>Priority: <span className="font-medium text-slate-700">{order.priority}</span></span>}
                                        <span>Requested by: <span className="font-medium text-slate-700">{order.ordered_by_name || 'Unknown clinician'}</span></span>
                                        {order.created_at && <span>{fmtDate(order.created_at, true)}</span>}
                                      </div>
                                      {/* Clinical notes */}
                                      {order.clinical_notes && (
                                        <div className="px-4 py-2 border-b border-slate-100">
                                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Clinical Notes</p>
                                          <p className="text-sm text-slate-700 whitespace-pre-line">{order.clinical_notes}</p>
                                        </div>
                                      )}
                                      {/* Result section */}
                                      {hasLabResult && (
                                        <div className={`px-4 py-4 space-y-3 ${isCritical ? 'bg-gradient-to-b from-red-50/50 to-white' : isAbnormal ? 'bg-gradient-to-b from-amber-50/50 to-white' : 'bg-gradient-to-b from-emerald-50/50 to-white'}`}>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className={`w-2 h-2 rounded-full ${isCritical ? 'bg-red-500' : isAbnormal ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                              <p className={`text-xs font-bold uppercase tracking-wider ${isCritical ? 'text-red-800' : isAbnormal ? 'text-amber-800' : 'text-emerald-800'}`}>Lab Result</p>
                                            </div>
                                            {order.lab_result_reported_at && (
                                              <span className="text-[11px] text-slate-400">{fmtDate(order.lab_result_reported_at, true)}</span>
                                            )}
                                          </div>
                                          {order.lab_result_value && (
                                            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Value</p>
                                              </div>
                                              <div className="px-3 py-2.5 flex items-baseline gap-2 flex-wrap">
                                                <span className={`text-lg font-bold ${isCritical ? 'text-red-700' : isAbnormal ? 'text-amber-700' : 'text-slate-900'}`}>
                                                  {order.lab_result_value}
                                                </span>
                                                {order.lab_result_unit && (
                                                  <span className="text-sm text-slate-500 font-medium">{order.lab_result_unit}</span>
                                                )}
                                                {order.lab_result_reference_range && (
                                                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                                    Ref: {order.lab_result_reference_range}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                          {order.lab_result_interpretation && (
                                            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Interpretation</p>
                                              </div>
                                              <div className="px-3 py-2.5">
                                                <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{order.lab_result_interpretation}</p>
                                              </div>
                                            </div>
                                          )}
                                          {order.lab_result_comments && (
                                            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Notes</p>
                                              </div>
                                              <div className="px-3 py-2.5">
                                                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{order.lab_result_comments}</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-base text-slate-400 italic">
                                No lab orders requested for this encounter.
                              </p>
                            )}
                          </TimelineSectionCard>
                        </div>
                      )}

                      {showImagingOrders && (
                        <div id="ecm-imaging" className="scroll-mt-28">
                          <TimelineSectionCard
                            icon={<Activity className="w-3 h-3" />}
                            title={`Imaging Orders Requested${imagingOrders.length > 0 ? ` — ${imagingOrders.length}` : ''}`}
                            color="amber"
                          >
                            {!c.encounter_id ? (
                              <p className="text-base text-slate-400 italic">
                                No encounter link found for this consultation.
                              </p>
                            ) : ordersLoading ? (
                              <p className="text-base text-slate-400 italic">
                                Loading imaging orders...
                              </p>
                            ) : imagingOrders.length > 0 ? (
                              <div className="space-y-4">
                                {imagingOrders.map((order) => {
                                  const hasImagingResult = Boolean(
                                    order.result_findings ||
                                    order.result_impression ||
                                    order.result_notes ||
                                    order.result_reported_at ||
                                    order.result_status ||
                                    (order.result_extra_fields && order.result_extra_fields.length > 0),
                                  );
                                  return (
                                    <div
                                      key={order.request_id}
                                      className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                                    >
                                      {/* Header bar */}
                                      <div className="px-4 py-2.5 bg-amber-50/60 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-sm font-bold text-slate-900 truncate">
                                            {order.imaging_name || 'Imaging study'}
                                          </p>
                                          {(order.body_part || order.imaging_type) && (
                                            <p className="text-xs text-slate-500 mt-0.5">
                                              {[order.body_part, order.imaging_type].filter(Boolean).join(' • ')}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${orderStatusBadgeClass(order.status)}`}>
                                            {order.status || 'Pending'}
                                          </span>
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                            hasImagingResult ? 'bg-sky-100 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                          }`}>
                                            {hasImagingResult ? order.result_status || 'Report Available' : 'Awaiting Report'}
                                          </span>
                                        </div>
                                      </div>
                                      {/* Meta row */}
                                      <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                        {order.priority && <span>Priority: <span className="font-medium text-slate-700">{order.priority}</span></span>}
                                        <span>Requested by: <span className="font-medium text-slate-700">{order.ordered_by_name || 'Unknown clinician'}</span></span>
                                        {order.created_at && <span>{fmtDate(order.created_at, true)}</span>}
                                      </div>
                                      {/* Clinical indication */}
                                      {(order.clinical_indication || order.notes) && (
                                        <div className="px-4 py-2 border-b border-slate-100">
                                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Clinical Indication</p>
                                          <p className="text-sm text-slate-700 whitespace-pre-line">{order.clinical_indication || order.notes}</p>
                                        </div>
                                      )}
                                      {/* Result / Report section */}
                                      {hasImagingResult && (
                                        <div className="px-4 py-4 bg-gradient-to-b from-sky-50/50 to-white space-y-3">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full bg-sky-500" />
                                              <p className="text-xs font-bold uppercase tracking-wider text-sky-800">Radiology Report</p>
                                            </div>
                                            {order.result_reported_at && (
                                              <span className="text-[11px] text-slate-400">
                                                {fmtDate(order.result_reported_at, true)}
                                              </span>
                                            )}
                                          </div>
                                          {order.result_findings && (
                                            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Findings</p>
                                              </div>
                                              <div className="px-3 py-2.5">
                                                <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{order.result_findings}</p>
                                              </div>
                                            </div>
                                          )}
                                          {order.result_impression && (
                                            <div className="rounded-lg border-2 border-sky-200 bg-white overflow-hidden">
                                              <div className="px-3 py-1.5 bg-sky-50 border-b border-sky-200">
                                                <p className="text-[11px] font-bold text-sky-700 uppercase tracking-wider">Impression</p>
                                              </div>
                                              <div className="px-3 py-2.5">
                                                <p className="text-sm text-slate-900 font-semibold whitespace-pre-line leading-relaxed">{order.result_impression}</p>
                                              </div>
                                            </div>
                                          )}
                                          {order.result_notes && (
                                            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Notes</p>
                                              </div>
                                              <div className="px-3 py-2.5">
                                                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{order.result_notes}</p>
                                              </div>
                                            </div>
                                          )}
                                          {order.result_extra_fields && order.result_extra_fields.length > 0 && (
                                            <div className="space-y-2 pt-1">
                                              {order.result_extra_fields.map((field) => (
                                                <div key={field.key} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                                  <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{field.label}</p>
                                                  </div>
                                                  <div className="px-3 py-2">
                                                    <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{field.value}</p>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-base text-slate-400 italic">
                                No imaging orders requested for this encounter.
                              </p>
                            )}
                          </TimelineSectionCard>
                        </div>
                      )}

                      {showProcedureOrders && (
                        <div id="ecm-procedure" className="scroll-mt-28">
                          <TimelineSectionCard
                            icon={<Layers className="w-3 h-3" />}
                            title={`Procedure Orders Requested${procedureOrders.length > 0 ? ` — ${procedureOrders.length}` : ''}`}
                            color="emerald"
                          >
                            {!c.encounter_id ? (
                              <p className="text-base text-slate-400 italic">
                                No encounter link found for this consultation.
                              </p>
                            ) : ordersLoading ? (
                              <p className="text-base text-slate-400 italic">
                                Loading procedure orders...
                              </p>
                            ) : procedureOrders.length > 0 ? (
                              <div className="space-y-4">
                                {procedureOrders.map((order) => {
                                  const hasResult = Boolean(order.findings || order.post_op_diagnosis);
                                  return (
                                    <div
                                      key={order.id}
                                      className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                                    >
                                      {/* Header bar */}
                                      <div className="px-4 py-2.5 bg-emerald-50/60 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-sm font-bold text-slate-900 truncate">
                                            {order.procedure_name || order.procedure_code || 'Procedure'}
                                          </p>
                                          {order.procedure_code && (
                                            <p className="text-xs font-mono text-slate-500 mt-0.5">{order.procedure_code}</p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${orderStatusBadgeClass(order.status)}`}>
                                            {order.status || 'Pending'}
                                          </span>
                                          {hasResult && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border bg-violet-100 text-violet-700 border-violet-200">
                                              Result Available
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {/* Meta row */}
                                      <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                        {order.priority && <span>Priority: <span className="font-medium text-slate-700">{order.priority}</span></span>}
                                        <span>Requested by: <span className="font-medium text-slate-700">{order.requested_by_name || 'Unknown clinician'}</span></span>
                                        {order.scheduled_date && <span>Scheduled: {fmtDate(order.scheduled_date, true)}</span>}
                                        {!order.scheduled_date && order.created_at && <span>{fmtDate(order.created_at, true)}</span>}
                                      </div>
                                      {/* Indication & notes */}
                                      {(order.indication || order.procedure_notes) && (
                                        <div className="px-4 py-2 border-b border-slate-100 space-y-2">
                                          {order.indication && (
                                            <div>
                                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Indication</p>
                                              <p className="text-sm text-slate-700 whitespace-pre-line">{order.indication}</p>
                                            </div>
                                          )}
                                          {order.procedure_notes && order.procedure_notes !== order.indication && (
                                            <div>
                                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Procedure Notes</p>
                                              <p className="text-sm text-slate-700 whitespace-pre-line">{order.procedure_notes}</p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {/* Result section */}
                                      {hasResult && (
                                        <div className="px-4 py-4 bg-gradient-to-b from-violet-50/50 to-white space-y-3">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full bg-violet-500" />
                                              <p className="text-xs font-bold uppercase tracking-wider text-violet-800">Procedure Result</p>
                                            </div>
                                            {order.actual_end_time && (
                                              <span className="text-[11px] text-slate-400">{fmtDate(order.actual_end_time, true)}</span>
                                            )}
                                          </div>
                                          {order.findings && (
                                            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Findings</p>
                                              </div>
                                              <div className="px-3 py-2.5">
                                                <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">{order.findings}</p>
                                              </div>
                                            </div>
                                          )}
                                          {order.post_op_diagnosis && (
                                            <div className="rounded-lg border-2 border-violet-200 bg-white overflow-hidden">
                                              <div className="px-3 py-1.5 bg-violet-50 border-b border-violet-200">
                                                <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Post-op Diagnosis</p>
                                              </div>
                                              <div className="px-3 py-2.5">
                                                <p className="text-sm text-slate-900 font-semibold whitespace-pre-line leading-relaxed">{order.post_op_diagnosis}</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-base text-slate-400 italic">
                                No procedure orders requested for this
                                encounter.
                              </p>
                            )}
                          </TimelineSectionCard>
                        </div>
                      )}

                      {showTreatment && (
                        <div id="ecm-diagnosis" className="scroll-mt-28">
                          <TimelineSectionCard
                            icon={<Tag className="w-3 h-3" />}
                            title="Diagnosis"
                            color="amber"
                          >
                            {c.diagnosis ? (
                              <div>
                                <p className="text-base font-semibold text-slate-800 leading-snug">
                                  {c.diagnosis}
                                </p>
                                {icdCodes.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {icdCodes.map((icd, i) => (
                                      <span
                                        key={i}
                                        title={icd.description}
                                        className={`text-sm px-3 py-1 rounded-lg font-mono font-bold ${
                                          icd.isPrimary
                                            ? 'bg-amber-200 text-amber-900 ring-1 ring-amber-300'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}
                                      >
                                        {icd.code}
                                        {icd.isPrimary && ' ★'}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {icdCodes[0]?.description && (
                                  <p className="text-sm text-slate-500 mt-2">
                                    {icdCodes[0].description}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-base text-slate-400 italic">
                                Not recorded.
                              </p>
                            )}
                          </TimelineSectionCard>
                        </div>
                      )}

                      {showTreatment && (
                        <div id="ecm-treatment" className="scroll-mt-28">
                          <TimelineSectionCard
                            icon={<Pill className="w-3 h-3" />}
                            title="Treatment Plan"
                            color="emerald"
                            rightElement={
                              c.treatment_plan ? (
                                <button
                                  onClick={() =>
                                    handleCopy(
                                      c.treatment_plan || '',
                                      'treatment',
                                    )
                                  }
                                  className="text-slate-400 hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-xs uppercase font-bold tracking-wider"
                                  title="Copy to clipboard"
                                >
                                  {copiedSection === 'treatment' ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                  {copiedSection === 'treatment' ? (
                                    <span className="text-emerald-500">
                                      Copied
                                    </span>
                                  ) : (
                                    'Copy'
                                  )}
                                </button>
                              ) : undefined
                            }
                          >
                            {c.treatment_plan ? (
                              <p className="text-base text-slate-800 leading-relaxed whitespace-pre-line">
                                {c.treatment_plan}
                              </p>
                            ) : (
                              <p className="text-base text-slate-400 italic">
                                Not recorded.
                              </p>
                            )}
                          </TimelineSectionCard>
                        </div>
                      )}

                      {showAddendum && (
                        <div id="ecm-addendum">
                          <TimelineSectionCard
                            icon={<PenLine className="w-3 h-3" />}
                            title="Addendum Notes"
                            color="violet"
                            isLast
                          >
                            {c.id && (
                              <AddendumTimeline
                                consultationId={c.id}
                                staffId={staffId}
                              />
                            )}
                          </TimelineSectionCard>
                        </div>
                      )}
                    </div>
                  )}
    </EncounterDetailLayout>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedSession(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={`px-6 py-4 ${encounterTheme.primary} text-white flex items-center justify-between`}>
              <div>
                <h3 className="text-lg font-bold">Session #{selectedSession.session_number}</h3>
                <p className="text-sm opacity-90">{selectedSession.plan_name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedSession.status === 'completed' ? 'bg-green-100 text-green-800' :
                  selectedSession.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  selectedSession.status === 'scheduled' ? 'bg-amber-100 text-amber-800' :
                  selectedSession.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {selectedSession.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <button onClick={() => setSelectedSession(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)] space-y-5">
              {/* Plan info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Plan Type</p>
                  <p className="text-sm font-medium text-slate-800">{selectedSession.plan_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Recorded By</p>
                  <p className="text-sm font-medium text-slate-800">{selectedSession.recorder_name || '—'}</p>
                </div>
                {selectedSession.scheduled_date && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Scheduled Date</p>
                    <p className="text-sm font-medium text-slate-800">{new Date(selectedSession.scheduled_date).toLocaleDateString()}</p>
                  </div>
                )}
                {selectedSession.completed_date && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Completed Date</p>
                    <p className="text-sm font-medium text-slate-800">{new Date(selectedSession.completed_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {/* Assessment */}
              {selectedSession.assessment && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assessment</h4>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{selectedSession.assessment}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedSession.notes && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{selectedSession.notes}</p>
                  </div>
                </div>
              )}

              {/* Plan for Next Session */}
              {selectedSession.plan_for_next && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Plan for Next Session</h4>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{selectedSession.plan_for_next}</p>
                  </div>
                </div>
              )}

              {/* Session Data */}
              {selectedSession.session_data && Object.keys(selectedSession.session_data).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Session Data</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    {Object.entries(selectedSession.session_data).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-3">
                        <span className="text-xs font-semibold text-slate-500 min-w-[120px] capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-sm text-slate-800">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// Compact timeline card — click to open encounter modal
// =============================================================================

interface TimelineCardProps {
  consultation: SpecialtyConsultationHistory;
  isLast: boolean;
  onClick: () => void;
  accent: SpecialtyEncounterTheme;
}

function TimelineCard({
  consultation: c,
  isLast,
  onClick,
  accent,
}: TimelineCardProps) {
  const initials =
    `${c.first_name?.charAt(0) ?? ''}${c.last_name?.charAt(0) ?? ''}`.toUpperCase();
  const doctorName = [c.doctor_first, c.doctor_last].filter(Boolean).join(' ');
  const sc = statusColors(c.status);
  const primaryIcd =
    Array.isArray(c.icd_codes) && c.icd_codes.length > 0
      ? typeof c.icd_codes[0] === 'string'
        ? c.icd_codes[0]
        : c.icd_codes[0].code
      : null;

  return (
    <div className="relative flex gap-3 sm:gap-4">
      <div className="flex flex-col items-center shrink-0 w-8 sm:w-10">
        <div
          className={`w-5 h-5 rounded-full ring-4 ${sc.dot === 'bg-emerald-500 border-emerald-600' ? 'ring-emerald-200' : sc.dot === 'bg-blue-500 border-blue-600' ? 'ring-blue-200' : 'ring-gray-200'} ${sc.dot.split(' ')[0]} shadow-sm z-10 shrink-0 mt-1`}
        />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gradient-to-b from-slate-300 to-slate-100 mt-1" />
        )}
      </div>

      <div className="flex-1 pb-4 min-w-0">
        <button
          type="button"
          onClick={onClick}
          className="w-full text-left bg-white rounded-2xl border border-slate-200/95 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] hover:shadow-[0_8px_28px_-8px_rgba(15,23,42,0.18)] hover:border-slate-300 transition-all duration-200 group"
        >
          <div className="px-5 py-4 flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full ${accent.softBg} flex items-center justify-center ${accent.text} font-black text-sm shrink-0 ring-2 ring-white shadow-sm`}
            >
              {initials || <User className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <span className="font-bold text-slate-900 text-base">
                  {c.first_name} {c.last_name}
                </span>
                <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                  {c.emr_number}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold border ${sc.badge}`}
                >
                  {normalizeConsultationStatus(c.status)}
                </span>
                {primaryIcd && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200 font-bold">
                    {primaryIcd}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {fmtDate(c.consultation_date ?? c.created_at, true)}
                </span>
                {doctorName && (
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Dr. {doctorName}
                  </span>
                )}
              </div>
              {(c.chief_complaint || c.complaints) && (
                <p className="text-sm text-slate-600 mt-1.5 line-clamp-2 leading-snug">
                  {c.chief_complaint || c.complaints}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 text-slate-300 group-hover:text-slate-700 transition-colors">
              <span
                className={`text-xs font-bold hidden group-hover:inline ${accent.text}`}
              >
                Open
              </span>
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Date group header
// =============================================================================

function PeriodHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="h-px flex-1 bg-slate-200/90" />
      <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-[0.2em] bg-white border border-slate-200/90 px-4 py-2 rounded-full shadow-sm">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-200/90" />
    </div>
  );
}

// =============================================================================
// Main Timeline Component
// =============================================================================

interface SpecialtyConsultationTimelineProps {
  history: SpecialtyConsultationHistory[];
  specialtyName: string;
  isDark?: boolean;
  /** When set, auto-open the encounter detail modal for this encounter ID on mount or when the prop changes. */
  initialSelectedEncounterId?: string | null;
  /** Callback when the auto-opened modal is closed — lets parent clear the initial selection state. */
  onInitialSelectionClosed?: () => void;
}

export default function SpecialtyConsultationTimeline({
  history,
  specialtyName,
  isDark = false,
  initialSelectedEncounterId,
  onInitialSelectionClosed,
}: SpecialtyConsultationTimelineProps) {
  const { staff } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPatientId, setFilterPatientId] = useState<string | null>(null);
  const [selectedConsultation, setSelectedConsultation] =
    useState<SpecialtyConsultationHistory | null>(null);

  // Auto-open encounter detail when initialSelectedEncounterId is provided
  useEffect(() => {
    if (!initialSelectedEncounterId) return;
    const match = history.find((h) => h.id === initialSelectedEncounterId);
    if (match) {
      setSelectedConsultation(match);
    }
  }, [initialSelectedEncounterId, history]);

  // Unique patients for filter pills
  const uniquePatients = useMemo(() => {
    const seen = new Set<string>();
    const pts: { id: string; name: string; emr: string }[] = [];
    for (const r of history) {
      if (r.patient_id && !seen.has(r.patient_id)) {
        seen.add(r.patient_id);
        pts.push({
          id: r.patient_id,
          name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
          emr: r.emr_number,
        });
      }
    }
    return pts.sort((a, b) => a.name.localeCompare(b.name));
  }, [history]);

  const filtered = useMemo(() => {
    let result = history;
    if (filterPatientId)
      result = result.filter((r) => r.patient_id === filterPatientId);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          (r.first_name ?? '').toLowerCase().includes(q) ||
          (r.last_name ?? '').toLowerCase().includes(q) ||
          (r.emr_number ?? '').toLowerCase().includes(q) ||
          (r.diagnosis ?? '').toLowerCase().includes(q) ||
          (r.chief_complaint ?? '').toLowerCase().includes(q) ||
          (r.doctor_first ?? '').toLowerCase().includes(q) ||
          (r.doctor_last ?? '').toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      const da = new Date(a.consultation_date ?? a.created_at ?? 0).getTime();
      const db = new Date(b.consultation_date ?? b.created_at ?? 0).getTime();
      return db - da;
    });
  }, [history, searchTerm, filterPatientId]);

  const grouped = useMemo(() => groupByPeriod(filtered), [filtered]);
  const listAccent = useMemo(
    () => getSpecialtyEncounterTheme(normalizeSpecialtyKey(specialtyName)),
    [specialtyName],
  );

  if (history.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-5 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <FileText className="h-10 w-10 text-gray-300" />
        </div>
        <p className="text-lg font-bold text-gray-500">
          No Consultation History
        </p>
        <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
          Completed {specialtyName} consultations will appear here as a
          chronological timeline.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className={`rounded-3xl border border-slate-200/80 bg-[#f4f5f7] shadow-[0_6px_40px_-12px_rgba(15,23,42,0.14)] p-5 md:p-6 space-y-4 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}
      >
        <div
          className={`rounded-2xl bg-white border border-slate-200/90 p-5 md:p-6 shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : ''}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl ${listAccent.softBg} flex items-center justify-center shrink-0 border border-slate-200/60`}
              >
                <Clock className={`h-6 w-6 ${listAccent.text}`} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] font-bold uppercase tracking-[0.18em] ${listAccent.text}`}
                >
                  {specialtyName}
                </p>
                <h3
                  className={`text-lg font-bold tracking-tight mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}
                >
                  {specialtyName} consultation timeline
                </h3>
                <p
                  className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  Premium encounter detail opens in a clinical workspace — tap a
                  row to review.
                </p>
              </div>
            </div>
            <div
              className={`rounded-2xl border px-5 py-3 text-center shrink-0 ${isDark ? 'bg-slate-900/60 border-slate-600' : `${listAccent.softBg} border-slate-200/80`}`}
            >
              <p
                className={`text-2xl font-black tabular-nums ${listAccent.text}`}
              >
                {history.length}
              </p>
              <p
                className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                Encounters
              </p>
            </div>
          </div>
          <div className="mt-5 relative">
            <Search
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            />
            <input
              type="text"
              placeholder="Search by patient, diagnosis, doctor, complaint..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-300'
              }`}
            />
          </div>
        </div>

        {/* Patient filter pills */}
        {uniquePatients.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <button
              onClick={() => setFilterPatientId(null)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                filterPatientId === null
                  ? `${listAccent.primary} text-white shadow-sm`
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Patients
            </button>
            {uniquePatients.slice(0, 12).map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  setFilterPatientId((prev) => (prev === p.id ? null : p.id))
                }
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  filterPatientId === p.id
                    ? `${listAccent.primary} text-white shadow-sm`
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p.name} <span className="opacity-60">({p.emr})</span>
              </button>
            ))}
            {uniquePatients.length > 12 && (
              <span className="text-xs text-gray-400">
                +{uniquePatients.length - 12} more — use search
              </span>
            )}
          </div>
        )}

        {/* Result count when filtered */}
        {(searchTerm || filterPatientId) && filtered.length > 0 && (
          <p className="text-xs text-gray-500 font-medium">
            Showing {filtered.length} of {history.length} encounters
          </p>
        )}

        {/* Empty filtered state */}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Search className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-semibold">No matching encounters</p>
            <p className="text-xs mt-1">
              Try a different search term or clear the patient filter.
            </p>
          </div>
        )}

        {/* Timeline body */}
        <div className="space-y-2">
          {Array.from(grouped.entries()).map(([period, records]) => (
            <div key={period}>
              <PeriodHeader label={period} />
              <div className="pl-0 sm:pl-0.5">
                {records.map((r, idx) => (
                  <TimelineCard
                    key={r.id}
                    consultation={r}
                    isLast={idx === records.length - 1}
                    onClick={() => setSelectedConsultation(r)}
                    accent={listAccent}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Encounter detail modal */}
      {selectedConsultation && (
        <EncounterDetailModal
          consultation={selectedConsultation}
          allHistory={history}
          specialtyName={specialtyName}
          staffId={staff?.id ?? ''}
          onClose={() => {
            setSelectedConsultation(null);
            if (initialSelectedEncounterId) onInitialSelectionClosed?.();
          }}
          onSelectEncounter={(enc) => setSelectedConsultation(enc)}
        />
      )}
    </>
  );
}
