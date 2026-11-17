// =============================================================================
// XENOCARE EMR - Admission Care Modal
// Replicates the PatientCarePanel UI design for In-Patient Admissions
// =============================================================================

import React, { useState, useEffect } from 'react';
import { formatStaffName } from '../../../utils/staffDisplay';
import {
  X,
  User,
  Building2,
  Bed,
  Calendar,
  Clock,
  Stethoscope,
  AlertTriangle,
  FileText,
  Activity,
  Phone,
  Heart,
  ShieldAlert,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  UserPlus,
  LogIn,
  LogOut,
  ArrowRightLeft,
  Thermometer,
  Droplets,
  Wind,
  Scale,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  History,
  StickyNote,
  Printer,
  Pill,
  ClipboardCheck,
  TrendingUp,
  Edit3,
  ChevronRight,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Fingerprint,
  Users,
  Scissors,
  Lock as LockIcon,
  Leaf,
  Beaker,
  Scan,
  Syringe,
  Apple,
  Target,
  Utensils,
  FlaskConical,
  ImageIcon,
  Sparkles,
  UtensilsCrossed,
  Salad,
  Coffee,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Cookie,
  ShieldCheck,
  Gauge,
  HeartPulse,
  Clipboard,
  type LucideIcon,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDetailedAge } from '../../patient-registration/dtos/patient.dto';
import { useWardRoundNotes } from '../hooks/useWardRounds';
import { usePatientAdmissions } from '../hooks/useAdmissions';
import { useEncounterDetails } from '../../clinical-consultation/hooks/useMedicalRecords';
import { supabase } from '../../../api/supabaseClient';
import { UniversalOrderButton } from '../../../components/orders/UniversalOrderButton';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getPatientOutstandingBalance,
  getPatientUnverifiedBills,
} from '../../billing/api/billing-order.api';
import { getNursingNotesByEncounter } from '../../nursing/api/nursing-notes.api';
import { getProceduresByAdmission } from '../api/procedures.api';
import {
  getVitals,
  getClinicalTimeline,
  createNursingCareRecord,
} from '../../nursing/api/nursing.api';
import type {
  AdmissionWithDetails,
  ActiveAdmissionView,
  WardRoundNote,
} from '../../../types/database.types';
import type {
  Vitals,
  TimelineEvent,
  CreateNursingCareDTO,
} from '../../nursing/dtos/nursing.dto';
import type { PatientDTO } from '../../patient-registration/dtos/patient.dto'; // Import PatientDTO
import DoctorNotesPanel from '../../nursing/components/DoctorNotesPanel';
import ShiftHandoverTab from '../../nursing/components/ShiftHandoverTab';
import NursingNotesTab from '../../nursing/components/NursingNotesTab';
import NursingCareForm from '../../nursing/components/NursingCareForm';
import MedicationAdministrationTab from '../../nursing/components/MedicationAdministrationTab';
import ProcedureNoteForm from './ProcedureNoteForm';
import { Button, Card, StatusBadge } from '../../../components/ui';
import AeTimeline from '../../ae/components/timeline/AeTimeline';

interface AdmissionCareModalProps {
  admission: AdmissionWithDetails | ActiveAdmissionView | null;
  isOpen: boolean;
  onClose: () => void;
  onTransfer?: () => void;
  onDischarge?: () => void;
  onWardRound?: () => void;
}

// =============================================================================
// Helper Functions & Constants
// =============================================================================

const acuityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700 border-green-200',
  moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const statusColors: Record<string, string> = {
  admitted: 'bg-green-100 text-green-700',
  under_observation: 'bg-blue-100 text-blue-700',
  critical: 'bg-red-100 text-red-700',
  stable: 'bg-green-100 text-green-700',
  improving: 'bg-emerald-100 text-emerald-700',
  discharged: 'bg-gray-100 text-gray-700',
  transferred: 'bg-blue-100 text-blue-700',
  deceased: 'bg-gray-800 text-white',
  absconded: 'bg-amber-100 text-amber-700',
};

const roundTypeColors: Record<string, string> = {
  morning: 'bg-amber-100 text-amber-700',
  evening: 'bg-indigo-100 text-indigo-700',
  night: 'bg-purple-100 text-purple-700',
  consultant: 'bg-blue-100 text-blue-700',
  multidisciplinary: 'bg-green-100 text-green-700',
  teaching: 'bg-cyan-100 text-cyan-700',
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateOnly = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const calculateLOS = (admissionDate: string | null | undefined) => {
  if (!admissionDate) return 'N/A';
  const start = new Date(admissionDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
};

const isActiveAdmissionView = (
  admission: AdmissionWithDetails | ActiveAdmissionView,
): admission is ActiveAdmissionView => {
  return 'admission_id' in admission;
};

// Helper to format date/time
function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number | null | undefined): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

// Vitals Tab Content Component (Replicated from PatientCarePanel)
function VitalsTabContent({
  encounterId,
  patientId,
  isWritable = false,
  isVitalsFormOpen,
  setIsVitalsFormOpen,
  handleVitalsSubmit,
  isCreatingRecord,
  patient,
  visitId,
  queueId,
  editingRecord,
  vitalsRecords,
  vitalsLoading,
}: {
  encounterId: string | null | undefined;
  patientId: string | undefined;
  isWritable?: boolean;
  isVitalsFormOpen: boolean;
  setIsVitalsFormOpen: (open: boolean) => void;
  handleVitalsSubmit: (data: CreateNursingCareDTO) => Promise<void>;
  isCreatingRecord: boolean;
  patient: any; // Using any to be flexible with patient object structure
  visitId: string | null;
  queueId: string | null;
  editingRecord?: any;
  vitalsRecords: Vitals[] | undefined;
  vitalsLoading: boolean;
}) {
  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header with Record Button */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            Vital Signs & Measurements
          </h3>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">
            {vitalsRecords?.length || 0} Clinical Observations recorded
          </p>
        </div>
        <Button
          variant="primary"
          icon={isWritable ? Heart : LockIcon}
          onClick={() => setIsVitalsFormOpen(true)}
          disabled={!isWritable}
          className="rounded-lg"
          title={
            !isWritable
              ? 'Cannot record vitals for closed encounters'
              : undefined
          }
        >
          {isWritable ? 'Record New Vitals' : 'View Only Mode'}
        </Button>
      </div>
      {/* Vitals Records */}
      {vitalsLoading ? (
        <Card>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-700" />
          </div>
        </Card>
      ) : vitalsRecords && vitalsRecords.length > 0 ? (
        <div className="space-y-4">
          {vitalsRecords.map((vitals, idx) => (
            <Card key={vitals.vitals_id || idx}>
              <div className="space-y-4">
                {/* Vitals Header */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-lg ${vitals.is_critical ? 'bg-red-100' : 'bg-green-100'}`}
                    >
                      <Heart
                        className={`h-5 w-5 ${vitals.is_critical ? 'text-red-600' : 'text-green-600'}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Vitals Record #{vitalsRecords.length - idx}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDateTime(vitals.date_recorded)}
                      </p>
                    </div>
                  </div>
                  {vitals.is_critical && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Critical
                    </span>
                  )}
                </div>

                {/* Vitals Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {vitals.blood_pressure_systolic &&
                    vitals.blood_pressure_diastolic && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <Heart size={12} />
                          Blood Pressure
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          {vitals.blood_pressure_systolic}/
                          {vitals.blood_pressure_diastolic}
                          <span className="text-sm text-gray-500 ml-1">
                            mmHg
                          </span>
                        </p>
                      </div>
                    )}
                  {vitals.pulse && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Activity size={12} />
                        Pulse Rate
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.pulse}
                        <span className="text-sm text-gray-500 ml-1">bpm</span>
                      </p>
                    </div>
                  )}
                  {vitals.temperature && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Thermometer size={12} />
                        Temperature
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.temperature}
                        <span className="text-sm text-gray-500 ml-1">°C</span>
                      </p>
                    </div>
                  )}
                  {vitals.respiratory_rate && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Activity size={12} />
                        Respiratory Rate
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.respiratory_rate}
                        <span className="text-sm text-gray-500 ml-1">/min</span>
                      </p>
                    </div>
                  )}
                  {vitals.oxygen_saturation && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Activity size={12} />
                        SpO2
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.oxygen_saturation}
                        <span className="text-sm text-gray-500 ml-1">%</span>
                      </p>
                    </div>
                  )}
                  {vitals.weight && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Scale size={12} />
                        Weight
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.weight}
                        <span className="text-sm text-gray-500 ml-1">kg</span>
                      </p>
                    </div>
                  )}
                  {vitals.height && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Scale size={12} />
                        Height
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.height}
                        <span className="text-sm text-gray-500 ml-1">cm</span>
                      </p>
                    </div>
                  )}
                  {/* Notes if available */}
                  {vitals.notes && (
                    <div className="col-span-full p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium text-amber-800">
                        Notes:
                      </p>
                      <p className="text-sm text-amber-700">{vitals.notes}</p>
                    </div>
                  )}
                </div>

                {/* Recorded by */}
                {vitals.nurse && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-200">
                    <User size={12} />
                    <span>
                      Recorded by: {vitals.nurse.first_name}{' '}
                      {vitals.nurse.last_name}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No Vital Signs Recorded</p>
            <p className="text-sm mt-1">
              {isWritable
                ? 'Click "Record Vitals" to capture vital signs for this encounter'
                : 'No vital signs have been recorded for this encounter'}
            </p>
          </div>
        </Card>
      )}

      {/* Vitals Form Modal - Only available for writable encounters */}
      {isWritable && (
        <NursingCareForm
          isOpen={isVitalsFormOpen}
          onClose={() => setIsVitalsFormOpen(false)}
          onSubmit={handleVitalsSubmit}
          isLoading={isCreatingRecord}
          preselectedPatient={patient}
          visitId={visitId}
          queueId={queueId}
          encounterId={encounterId}
          editingRecord={editingRecord}
        />
      )}
    </div>
  );
}

// =============================================================================
// Timeline Category Configuration & Structured Detail Renderer
// =============================================================================

const TIMELINE_CATEGORY_CONFIG: Record<
  string,
  {
    icon: LucideIcon;
    color: string;        // Tailwind color name (e.g. 'blue', 'emerald')
    label: string;
    dotClass: string;
    badgeClass: string;
    accentClass: string;
  }
> = {
  consultation: {
    icon: Stethoscope,
    color: 'blue',
    label: 'Consultation',
    dotClass: 'bg-blue-500 ring-blue-200',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    accentClass: 'border-l-blue-500',
  },
  ward_round: {
    icon: ClipboardCheck,
    color: 'indigo',
    label: 'Ward Round',
    dotClass: 'bg-indigo-500 ring-indigo-200',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    accentClass: 'border-l-indigo-500',
  },
  nursing_note: {
    icon: StickyNote,
    color: 'emerald',
    label: 'Nursing Note',
    dotClass: 'bg-emerald-500 ring-emerald-200',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentClass: 'border-l-emerald-500',
  },
  vital: {
    icon: HeartPulse,
    color: 'red',
    label: 'Vitals',
    dotClass: 'bg-red-500 ring-red-200',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    accentClass: 'border-l-red-500',
  },
  nutrition_plan: {
    icon: Apple,
    color: 'lime',
    label: 'Nutrition Plan',
    dotClass: 'bg-lime-500 ring-lime-200',
    badgeClass: 'bg-lime-50 text-lime-700 border-lime-200',
    accentClass: 'border-l-lime-500',
  },
  nutrition_session: {
    icon: Utensils,
    color: 'teal',
    label: 'Nutrition Session',
    dotClass: 'bg-teal-500 ring-teal-200',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    accentClass: 'border-l-teal-500',
  },
  nutrition_order: {
    icon: FlaskConical,
    color: 'fuchsia',
    label: 'Nutrition Lab',
    dotClass: 'bg-fuchsia-500 ring-fuchsia-200',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    accentClass: 'border-l-fuchsia-500',
  },
  lab: {
    icon: Beaker,
    color: 'purple',
    label: 'Laboratory',
    dotClass: 'bg-purple-500 ring-purple-200',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    accentClass: 'border-l-purple-500',
  },
  pharmacy: {
    icon: Pill,
    color: 'amber',
    label: 'Pharmacy',
    dotClass: 'bg-amber-500 ring-amber-200',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    accentClass: 'border-l-amber-500',
  },
  radiology: {
    icon: ImageIcon,
    color: 'cyan',
    label: 'Radiology',
    dotClass: 'bg-cyan-500 ring-cyan-200',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    accentClass: 'border-l-cyan-500',
  },
  procedure: {
    icon: Scissors,
    color: 'rose',
    label: 'Procedure',
    dotClass: 'bg-rose-500 ring-rose-200',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    accentClass: 'border-l-rose-500',
  },
  medication: {
    icon: Syringe,
    color: 'orange',
    label: 'Medication',
    dotClass: 'bg-orange-500 ring-orange-200',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    accentClass: 'border-l-orange-500',
  },
};

const DEFAULT_CATEGORY_CONFIG = {
  icon: FileText,
  color: 'slate',
  label: 'Event',
  dotClass: 'bg-slate-500 ring-slate-200',
  badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
  accentClass: 'border-l-slate-500',
};

/** Tiny helper: render a label ➜ value row inside a structured detail block */
function DetailRow({ label, value, icon: Icon, className = '' }: { label: string; value: React.ReactNode; icon?: LucideIcon; className?: string }) {
  if (!value) return null;
  return (
    <div className={`flex items-start gap-2 text-[13px] leading-relaxed ${className}`}>
      {Icon && <Icon size={14} className="mt-0.5 shrink-0 text-slate-400" />}
      <span className="font-semibold text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}

/** Tiny helper: render a small colored pill badge */
function MetaPill({ children, className = 'bg-slate-100 text-slate-600' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${className}`}>
      {children}
    </span>
  );
}

/**
 * Renders structured detail content for each timeline event category.
 * Uses meta fields instead of dumping plain-text descriptions.
 */
function TimelineEventDetails({ event }: { event: TimelineEvent }) {
  const m = event.meta || {};

  switch (event.category) {
    // ── Consultation ─────────────────────────────────────────────────
    case 'consultation':
      return (
        <div className="space-y-2.5">
          {m.complaints && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Presenting Complaint:</span> <span className="text-slate-700">{m.complaints}</span></div>
          )}
          {m.assessment && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Clinical Assessment:</span> <span className="text-slate-700">{m.assessment}</span></div>
          )}
          {m.diagnosis_text && m.diagnosis_text !== m.assessment && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Working Diagnosis:</span> <span className="text-slate-700">{m.diagnosis_text}</span></div>
          )}
        </div>
      );

    // ── Ward Round ───────────────────────────────────────────────────
    case 'ward_round':
      return (
        <div className="space-y-2.5">
          {m.subjective_notes && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Patient Update:</span> <span className="text-slate-700">{m.subjective_notes}</span></div>
          )}
          {m.assessment && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Clinical Assessment:</span> <span className="text-slate-700">{m.assessment}</span></div>
          )}
          {m.plan && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Management Plan:</span> <span className="text-slate-700">{m.plan}</span></div>
          )}
        </div>
      );

    // ── Vitals (pill-badge grid) ─────────────────────────────────────
    case 'vital':
      return (
        <div className="flex flex-wrap gap-2 mt-1">
          {m.blood_pressure && <MetaPill className="bg-red-50 text-red-700"><Gauge size={10} /> Blood Pressure: {m.blood_pressure}</MetaPill>}
          {m.temperature && <MetaPill className="bg-orange-50 text-orange-700"><Thermometer size={10} /> Temperature: {m.temperature}°C</MetaPill>}
          {m.pulse && <MetaPill className="bg-pink-50 text-pink-700"><HeartPulse size={10} /> Heart Rate: {m.pulse}</MetaPill>}
          {m.oxygen_saturation && <MetaPill className="bg-sky-50 text-sky-700"><Droplets size={10} /> Oxygen Saturation: {m.oxygen_saturation}%</MetaPill>}
          {m.respiratory_rate && <MetaPill className="bg-teal-50 text-teal-700"><Wind size={10} /> Respiratory Rate: {m.respiratory_rate}</MetaPill>}
          {m.weight && <MetaPill className="bg-slate-100 text-slate-700"><Scale size={10} /> Weight: {m.weight}kg</MetaPill>}
        </div>
      );

    // ── Nutrition Plan (structured grid) ─────────────────────────────
    case 'nutrition_plan': {
      const baseline = m.baseline_data || {};
      const meals = baseline.meal_schedule || {};
      const diagnoses = Array.isArray(m.diagnosis) ? m.diagnosis.filter(Boolean).join(', ') : '';
      const goals = Array.isArray(m.goals) ? m.goals.filter(Boolean) : [];

      return (
        <div className="space-y-3">
          {/* Plan name & status */}
          {m.plan_name && (
            <div className="text-sm font-bold text-slate-800">{m.plan_name}</div>
          )}

          {/* Key info grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <DetailRow icon={Salad} label="Prescribed Diet:" value={baseline.diet_type?.replace(/_/g, ' ')} />
            <DetailRow icon={FileText} label="Clinical Diagnosis:" value={diagnoses} />
            <DetailRow icon={ShieldAlert} label="Dietary Restrictions:" value={baseline.dietary_restrictions} />
            <DetailRow icon={Sparkles} label="Nutrition Supplements:" value={baseline.supplements} />
          </div>

          {/* Nutritional targets */}
          {(baseline.calorie_target_kcal || baseline.protein_target_g || baseline.fluid_target_ml) && (
            <div className="flex flex-wrap gap-2">
              {baseline.calorie_target_kcal && <MetaPill className="bg-amber-50 text-amber-700"><Target size={10} /> Daily Calorie Target: {baseline.calorie_target_kcal} kcal</MetaPill>}
              {baseline.protein_target_g && <MetaPill className="bg-rose-50 text-rose-700"><Target size={10} /> Daily Protein Target: {baseline.protein_target_g} g</MetaPill>}
              {baseline.fluid_target_ml && <MetaPill className="bg-sky-50 text-sky-700"><Droplets size={10} /> Daily Fluid Target: {baseline.fluid_target_ml} ml</MetaPill>}
            </div>
          )}

          {/* Meal schedule grid */}
          {Object.values(meals).some(Boolean) && (
            <div className="bg-white/70 rounded-lg border border-slate-100 p-3.5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Meal Schedule</div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                {meals.breakfast && <DetailRow icon={Coffee} label="Breakfast:" value={meals.breakfast} />}
                {meals.mid_morning_snack && <DetailRow icon={Cookie} label="AM Snack:" value={meals.mid_morning_snack} />}
                {meals.lunch && <DetailRow icon={UtensilsCrossed} label="Lunch:" value={meals.lunch} />}
                {meals.evening_snack && <DetailRow icon={Cookie} label="PM Snack:" value={meals.evening_snack} />}
                {meals.dinner && <DetailRow icon={Sunset} label="Dinner:" value={meals.dinner} />}
                {meals.bedtime_snack && <DetailRow icon={Moon} label="Bedtime:" value={meals.bedtime_snack} />}
              </div>
            </div>
          )}

          {/* Goals */}
          {goals.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Care Goals</div>
              <div className="flex flex-wrap gap-2">
                {goals.map((g: string, i: number) => (
                  <MetaPill key={i} className="bg-lime-50 text-lime-700"><Target size={10} /> {g}</MetaPill>
                ))}
              </div>
            </div>
          )}

          {/* Counselling notes */}
          {baseline.counseling_notes && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Dietitian Counselling Notes:</span> <span className="text-slate-600 italic">{baseline.counseling_notes}</span></div>
          )}
        </div>
      );
    }

    // ── Nutrition Session ────────────────────────────────────────────
    case 'nutrition_session':
      return (
        <div className="space-y-2.5">
          {m.plan_name && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Linked Nutrition Plan:</span> <span className="text-slate-700">{m.plan_name}</span></div>
          )}
          {m.assessment && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Session Assessment:</span> <span className="text-slate-700">{m.assessment}</span></div>
          )}
          {m.notes && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Session Notes:</span> <span className="text-slate-700">{m.notes}</span></div>
          )}
          {m.meal_plan_adjustments && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Meal Plan Adjustments:</span> <span className="text-slate-700">{m.meal_plan_adjustments}</span></div>
          )}
          <div className="flex flex-wrap gap-2">
            {m.barriers && <MetaPill className="bg-amber-50 text-amber-700"><AlertTriangle size={10} /> {m.barriers}</MetaPill>}
            {m.gastrointestinal_symptoms && <MetaPill className="bg-red-50 text-red-700"><Activity size={10} /> Gastrointestinal Symptoms: {m.gastrointestinal_symptoms}</MetaPill>}
          </div>
          {m.plan_for_next && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Next Follow-up Plan:</span> <span className="text-slate-700">{m.plan_for_next}</span></div>
          )}
        </div>
      );

    // ── Lab / Nutrition Order ────────────────────────────────────────
    case 'lab':
    case 'nutrition_order':
      return (
        <div className="space-y-2.5">
          {m.result && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Result Summary:</span> <span className="text-slate-700">{String(m.result).substring(0, 200)}{String(m.result).length > 200 ? '…' : ''}</span></div>
          )}
          {m.clinical_notes && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Clinical Context:</span> <span className="text-slate-700">{m.clinical_notes}</span></div>
          )}
        </div>
      );

    // ── Pharmacy ─────────────────────────────────────────────────────
    case 'pharmacy':
      return (
        <div className="flex flex-wrap gap-2 mt-1">
          {m.drug_name && <MetaPill className="bg-amber-50 text-amber-700"><Pill size={10} /> {m.drug_name}</MetaPill>}
          {m.dosage && <MetaPill className="bg-slate-100 text-slate-600">{m.dosage}</MetaPill>}
          {m.frequency && <MetaPill className="bg-slate-100 text-slate-600">{m.frequency}</MetaPill>}
          {m.route && <MetaPill className="bg-slate-100 text-slate-600">{m.route}</MetaPill>}
          {m.duration && <MetaPill className="bg-slate-100 text-slate-600">{m.duration}</MetaPill>}
        </div>
      );

    // ── Radiology ────────────────────────────────────────────────────
    case 'radiology':
      return (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {m.imaging_type && <MetaPill className="bg-cyan-50 text-cyan-700"><ImageIcon size={10} /> {m.imaging_type}</MetaPill>}
            {m.body_part && <MetaPill className="bg-slate-100 text-slate-600">{m.body_part}</MetaPill>}
          </div>
          {m.clinical_indication && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Reason for Imaging:</span> <span className="text-slate-700">{m.clinical_indication}</span></div>
          )}
        </div>
      );

    // ── Procedure ────────────────────────────────────────────────────
    case 'procedure':
      return (
        <div className="space-y-2.5">
          {m.procedure_name && (
            <div className="text-sm font-bold text-slate-800">{m.procedure_name}</div>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <DetailRow label="Reason for Procedure:" value={m.indication} />
            <DetailRow label="Anesthesia Type:" value={m.anesthesia_type} />
            <DetailRow label="Pre-Procedure Diagnosis:" value={m.pre_procedure_diagnosis} />
            <DetailRow label="Post-Procedure Diagnosis:" value={m.post_procedure_diagnosis} />
          </div>
          {m.procedure_notes && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Procedure Notes:</span> <span className="text-slate-700">{String(m.procedure_notes).substring(0, 300)}{String(m.procedure_notes).length > 300 ? '…' : ''}</span></div>
          )}
          {m.findings && (
            <div className="text-[13px] leading-relaxed"><span className="font-semibold text-slate-500">Procedure Findings:</span> <span className="text-slate-700">{String(m.findings).substring(0, 300)}{String(m.findings).length > 300 ? '…' : ''}</span></div>
          )}
          {m.complications && (
            <div className="text-[13px] leading-relaxed text-red-600"><span className="font-semibold">Recorded Complications:</span> {m.complications}</div>
          )}
          <div className="flex flex-wrap gap-2">
            {m.priority && (
              <MetaPill className={m.priority === 'emergency' ? 'bg-red-100 text-red-700' : m.priority === 'urgent' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                {String(m.priority).toUpperCase()}
              </MetaPill>
            )}
            {m.estimated_blood_loss_ml > 0 && (
              <MetaPill className="bg-red-50 text-red-600">Blood Loss: {m.estimated_blood_loss_ml}ml</MetaPill>
            )}
          </div>
        </div>
      );

    // ── Medication (eMAR) ────────────────────────────────────────────
    case 'medication':
      return (
        <div className="flex flex-wrap gap-2 mt-1">
          {m.medication_name && <MetaPill className="bg-orange-50 text-orange-700"><Syringe size={10} /> {m.medication_name}</MetaPill>}
          {m.dose && <MetaPill className="bg-slate-100 text-slate-600">{m.dose}</MetaPill>}
          {m.route && <MetaPill className="bg-slate-100 text-slate-600">{m.route}</MetaPill>}
          {m.status && (
            <MetaPill className={
              m.status === 'given' || m.status === 'administered' ? 'bg-green-50 text-green-700' :
              m.status === 'missed' ? 'bg-red-50 text-red-700' :
              m.status === 'refused' ? 'bg-amber-50 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }>
              {m.status === 'given' || m.status === 'administered' ? '✓' : m.status === 'missed' ? '✗' : '○'} {m.status}
            </MetaPill>
          )}
        </div>
      );

    // ── Nursing Note ─────────────────────────────────────────────────
    case 'nursing_note':
      return (
        <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
          {m.content || m.notes || event.description}
        </div>
      );

    // ── Default fallback ─────────────────────────────────────────────
    default:
      return (
        <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
          {event.description}
        </p>
      );
  }
}

// Overview Tab Content Component (Replicated from PatientCarePanel)
function OverviewTabContent({
  patient,
  latestVitals,
  timeline = [],
  timelineLoading = false,
}: {
  patient: any;
  latestVitals: Vitals | null;
  timeline?: TimelineEvent[];
  timelineLoading?: boolean;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Vitals Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Heart size={20} className="text-red-600" />
              </div>
              <h4 className="font-bold text-gray-900">Latest Vitals</h4>
            </div>
            {latestVitals && (
              <span
                className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  latestVitals.is_critical
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {latestVitals.is_critical ? 'Review Required' : 'Stable'}
              </span>
            )}
          </div>

          {latestVitals ? (
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block">
                  Blood Pressure
                </span>
                <span className="font-mono text-lg font-bold text-gray-800">
                  {latestVitals.blood_pressure_systolic}/
                  {latestVitals.blood_pressure_diastolic}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block">
                  Pulse Rate
                </span>
                <span className="font-mono text-lg font-bold text-gray-800">
                  {latestVitals.pulse}{' '}
                  <small className="text-xs font-sans text-gray-400 uppercase tracking-normal">
                    bpm
                  </small>
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block">
                  Temperature
                </span>
                <span className="font-mono text-lg font-bold text-gray-800">
                  {latestVitals.temperature}°C
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block">
                  SpO2
                </span>
                <span className="font-mono text-lg font-bold text-gray-800">
                  {latestVitals.oxygen_saturation}%
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-gray-50 flex items-center gap-2">
                <Clock size={12} className="text-gray-400" />
                <span className="text-xs text-gray-400 italic">
                  Last taken: {formatDateTime(latestVitals.date_recorded)}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="text-xs text-gray-400">No vitals recorded yet</p>
            </div>
          )}
        </div>

        {/* Quick Alerts Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-50 rounded-lg">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <h4 className="font-bold text-gray-900">Patient Alerts</h4>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-600" />
                <span className="text-xs uppercase font-bold text-red-600 tracking-widest">
                  Allergies
                </span>
              </div>
              <p className="text-sm font-bold text-red-900">
                {patient.known_allergies?.length
                  ? patient.known_allergies.join(', ')
                  : (patient as { no_known_allergies?: boolean })
                        .no_known_allergies
                    ? 'No Known Allergies'
                    : 'Allergy status not recorded'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-gray-400" />
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest">
                  Next of Kin
                </span>
              </div>
              <p className="text-xs text-gray-700 font-medium">
                {patient.nok_name || 'Not provided'} •{' '}
                {patient.nok_phone || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Primary Section - Full Width Clinical Timeline (Modern Design)  */}
      {/* ================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 flex items-center justify-between">
          <h4 className="font-bold text-gray-900 flex items-center gap-2.5 text-base">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <History size={16} className="text-blue-600" />
            </div>
            Clinical Timeline
          </h4>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              {timeline.length} event{timeline.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {timelineLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-blue-100" />
                <Loader2 size={28} className="absolute inset-0 m-auto animate-spin text-blue-500" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-400 animate-pulse">
                Loading Timeline…
              </p>
            </div>
          ) : timeline.length > 0 ? (
            <div className="relative">
              {/* Gradient vertical spine */}
              <div className="absolute left-[23px] top-4 bottom-4 w-px bg-gradient-to-b from-blue-200 via-slate-200 to-transparent hidden sm:block" />

              <div className="space-y-4">
                {timeline.map((event, idx) => {
                  const cfg = TIMELINE_CATEGORY_CONFIG[event.category] || DEFAULT_CATEGORY_CONFIG;
                  const CategoryIcon = cfg.icon;
                  const ts = new Date(event.timestamp);

                  return (
                    <div
                      key={event.id || idx}
                      className="relative flex gap-4 items-stretch group"
                    >
                      {/* ── Left column: icon indicator ── */}
                      <div className="flex flex-col items-center shrink-0 z-10">
                        <div
                          className={`
                            w-[46px] h-[46px] rounded-xl flex items-center justify-center
                            border border-white shadow-sm ring-1 ${cfg.dotClass}
                            group-hover:shadow-md transition-shadow
                          `}
                        >
                          <CategoryIcon size={18} className="text-white" />
                        </div>
                      </div>

                      {/* ── Right column: content card ── */}
                      <div
                        className={`
                          flex-1 min-w-0 bg-white rounded-xl border border-slate-200/80
                          border-l-[3px] ${cfg.accentClass}
                          shadow-[0_1px_3px_rgba(0,0,0,0.04)]
                          group-hover:shadow-md group-hover:border-slate-300/80
                          transition-all duration-200
                          p-5
                        `}
                      >
                        {/* Card header */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`
                                inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold
                                tracking-wider px-3 py-1.5 rounded-md border
                                ${cfg.badgeClass}
                              `}
                            >
                              <CategoryIcon size={12} />
                              {event.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400">
                            <span className="flex items-center gap-1 font-medium">
                              <User size={10} />
                              {event.author}
                            </span>
                            <span className="font-semibold text-slate-500">
                              {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-slate-400 uppercase text-[11px]">
                              {ts.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Structured content per category */}
                        <TimelineEventDetails event={event} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <div className="p-4 bg-slate-50 rounded-2xl mb-4">
                <History size={40} className="opacity-40" />
              </div>
              <p className="text-sm font-medium text-slate-400">No clinical activity recorded yet</p>
              <p className="text-xs text-slate-300 mt-1">Events will appear here as care is documented</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Timeline node colors per round type */
const roundTypeNodeColors: Record<
  string,
  { ring: string; dot: string; bg: string }
> = {
  morning: { ring: 'ring-amber-300', dot: 'bg-amber-500', bg: 'bg-amber-50' },
  evening: {
    ring: 'ring-indigo-300',
    dot: 'bg-indigo-500',
    bg: 'bg-indigo-50',
  },
  night: { ring: 'ring-purple-300', dot: 'bg-purple-500', bg: 'bg-purple-50' },
  consultant: { ring: 'ring-blue-300', dot: 'bg-blue-500', bg: 'bg-blue-50' },
  multidisciplinary: {
    ring: 'ring-green-300',
    dot: 'bg-green-500',
    bg: 'bg-green-50',
  },
  teaching: { ring: 'ring-cyan-300', dot: 'bg-cyan-500', bg: 'bg-cyan-50' },
};

const conditionColors: Record<string, string> = {
  stable: 'bg-green-100 text-green-700',
  improving: 'bg-emerald-100 text-emerald-700',
  critical: 'bg-red-100 text-red-700',
  guarded: 'bg-amber-100 text-amber-700',
  fair: 'bg-blue-100 text-blue-700',
  poor: 'bg-orange-100 text-orange-700',
  deteriorating: 'bg-red-100 text-red-700',
};

const WardRoundTimelineCard: React.FC<{
  note: WardRoundNote;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}> = ({ note, isExpanded, onToggle, isLast }) => {
  const vitals = note.vital_signs as Record<string, number | string> | null;
  const nodeColor =
    roundTypeNodeColors[note.round_type] || roundTypeNodeColors.morning;
  const conditionCls =
    conditionColors[(note.patient_condition || '').toLowerCase()] ||
    'bg-slate-100 text-slate-600';
  const timeStr = new Date(note.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const physicianName = note.attending_physician
    ? formatStaffName(note.attending_physician.first_name, note.attending_physician.last_name, (note.attending_physician as any).role, 'Unknown Physician')
    : 'Unknown Physician';

  const hasSoap =
    note.subjective_notes ||
    note.objective_findings ||
    note.assessment ||
    note.plan;
  const hasVitals = vitals && Object.keys(vitals).length > 0;

  return (
    <div className="relative flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center flex-shrink-0 w-10">
        <div
          className={`w-5 h-5 rounded-full ring-4 ${nodeColor.ring} ${nodeColor.dot} shadow-sm z-10 flex-shrink-0 mt-1`}
        />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gradient-to-b from-slate-300 to-slate-100 mt-1" />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 pb-6 min-w-0">
        <div
          onClick={onToggle}
          className={`bg-white border rounded-xl shadow-sm cursor-pointer transition-all hover:shadow-md ${
            isExpanded
              ? 'border-blue-200 shadow-md ring-1 ring-blue-100'
              : 'border-slate-200'
          }`}
        >
          {/* Card header */}
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide flex-shrink-0 ${roundTypeColors[note.round_type] || 'bg-gray-100 text-gray-700'}`}
              >
                {note.round_type.replace('_', ' ')}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {physicianName}
                </p>
                <p className="text-xs text-slate-400">{timeStr}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {note.patient_condition && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${conditionCls}`}
                >
                  {note.patient_condition}
                </span>
              )}
              {isExpanded ? (
                <ChevronUp size={16} className="text-slate-400" />
              ) : (
                <ChevronDown size={16} className="text-slate-400" />
              )}
            </div>
          </div>

          {/* Collapsed preview — show first line of assessment or subjective */}
          {!isExpanded && (note.assessment || note.subjective_notes) && (
            <div className="px-4 pb-3 -mt-1">
              <p className="text-xs text-slate-500 line-clamp-1">
                {note.assessment || note.subjective_notes}
              </p>
            </div>
          )}

          {/* Expanded content */}
          {isExpanded && (
            <div className="border-t border-slate-100 px-4 py-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Vitals row */}
              {hasVitals && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {vitals.temperature && (
                    <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">
                      <Thermometer className="h-3.5 w-3.5 text-red-400 mx-auto mb-0.5" />
                      <p className="text-xs font-bold text-red-700">
                        {vitals.temperature}°C
                      </p>
                      <p className="text-[9px] text-red-400">Temp</p>
                    </div>
                  )}
                  {vitals.pulse && (
                    <div className="bg-pink-50 border border-pink-100 rounded-lg px-3 py-2 text-center">
                      <Heart className="h-3.5 w-3.5 text-pink-400 mx-auto mb-0.5" />
                      <p className="text-xs font-bold text-pink-700">
                        {vitals.pulse} bpm
                      </p>
                      <p className="text-[9px] text-pink-400">Pulse</p>
                    </div>
                  )}
                  {(vitals.blood_pressure_systolic || vitals.bp_systolic) && (
                    <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-center">
                      <Droplets className="h-3.5 w-3.5 text-purple-400 mx-auto mb-0.5" />
                      <p className="text-xs font-bold text-purple-700">
                        {vitals.blood_pressure_systolic || vitals.bp_systolic}/
                        {vitals.blood_pressure_diastolic || vitals.bp_diastolic}
                      </p>
                      <p className="text-[9px] text-purple-400">BP mmHg</p>
                    </div>
                  )}
                  {vitals.respiratory_rate && (
                    <div className="bg-cyan-50 border border-cyan-100 rounded-lg px-3 py-2 text-center">
                      <Wind className="h-3.5 w-3.5 text-cyan-400 mx-auto mb-0.5" />
                      <p className="text-xs font-bold text-cyan-700">
                        {vitals.respiratory_rate}/min
                      </p>
                      <p className="text-[9px] text-cyan-400">Resp</p>
                    </div>
                  )}
                  {vitals.oxygen_saturation && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-center">
                      <Activity className="h-3.5 w-3.5 text-blue-400 mx-auto mb-0.5" />
                      <p className="text-xs font-bold text-blue-700">
                        {vitals.oxygen_saturation}%
                      </p>
                      <p className="text-[9px] text-blue-400">SpO₂</p>
                    </div>
                  )}
                  {vitals.weight && (
                    <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-center">
                      <Scale className="h-3.5 w-3.5 text-green-400 mx-auto mb-0.5" />
                      <p className="text-xs font-bold text-green-700">
                        {vitals.weight} kg
                      </p>
                      <p className="text-[9px] text-green-400">Weight</p>
                    </div>
                  )}
                </div>
              )}

              {/* SOAP Notes */}
              {hasSoap && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {note.subjective_notes && (
                    <div className="border-l-4 border-blue-400 bg-blue-50/50 p-3 rounded-r-lg">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">
                        S — Subjective
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {note.subjective_notes}
                      </p>
                    </div>
                  )}
                  {note.objective_findings && (
                    <div className="border-l-4 border-green-400 bg-green-50/50 p-3 rounded-r-lg">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-green-500 mb-1">
                        O — Objective
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {note.objective_findings}
                      </p>
                    </div>
                  )}
                  {note.assessment && (
                    <div className="border-l-4 border-amber-400 bg-amber-50/50 p-3 rounded-r-lg">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">
                        A — Assessment
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {note.assessment}
                      </p>
                    </div>
                  )}
                  {note.plan && (
                    <div className="border-l-4 border-purple-400 bg-purple-50/50 p-3 rounded-r-lg">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500 mb-1">
                        P — Plan
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {note.plan}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* New orders */}
              {note.new_orders && note.new_orders.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">
                    New Orders
                  </p>
                  <div className="space-y-1">
                    {note.new_orders.map((order, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle2
                          size={14}
                          className="text-emerald-500 flex-shrink-0"
                        />
                        <span className="text-slate-700">
                          {order.description}
                        </span>
                        {order.urgency && order.urgency !== 'routine' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-bold uppercase">
                            {order.urgency}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nursing instructions */}
              {note.nursing_instructions && (
                <div className="bg-sky-50 border border-sky-100 rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 mb-1">
                    Nursing Instructions
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {note.nursing_instructions}
                  </p>
                </div>
              )}

              {/* Discharge planning */}
              {(note.estimated_discharge_date ||
                note.discharge_planning_notes) && (
                <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 mb-1">
                    Discharge Planning
                  </p>
                  {note.estimated_discharge_date && (
                    <p className="text-sm text-slate-700">
                      Est. Discharge:{' '}
                      <strong>
                        {formatDateOnly(note.estimated_discharge_date)}
                      </strong>
                    </p>
                  )}
                  {note.discharge_planning_notes && (
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                      {note.discharge_planning_notes}
                    </p>
                  )}
                </div>
              )}

              {/* Footer meta */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <span>Recorded {formatDate(note.created_at)}</span>
                {note.participants && note.participants.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {note.participants.length} participant
                    {note.participants.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function ClinicalNotesSection({
  consultation,
  isLoading,
}: {
  consultation: any;
  isLoading: boolean;
}) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    subjective: true,
    objective: true,
    assessment: true,
    plan: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-xl">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">
          No clinical notes documented yet
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Doctor's consultation notes will appear here
        </p>
      </div>
    );
  }

  const soapSections = [
    {
      key: 'subjective',
      letter: 'S',
      title: 'Subjective',
      color: 'bg-blue-600',
      content:
        consultation.subjective ||
        consultation.complaints ||
        consultation.history_of_present_illness,
    },
    {
      key: 'objective',
      letter: 'O',
      title: 'Objective',
      color: 'bg-teal-600',
      content:
        consultation.objective ||
        consultation.examination_findings ||
        consultation.physical_examination,
    },
    {
      key: 'assessment',
      letter: 'A',
      title: 'Assessment',
      color: 'bg-amber-600',
      content:
        consultation.assessment ||
        consultation.diagnosis ||
        consultation.diagnosis_text,
    },
    {
      key: 'plan',
      letter: 'P',
      title: 'Plan',
      color: 'bg-purple-600',
      content:
        consultation.plan ||
        consultation.treatment_plan ||
        consultation.recommendations,
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 bg-gray-50/50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Clinical Consultation Notes
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Date:{' '}
                <span className="font-medium text-slate-700">
                  {consultation.created_at
                    ? new Date(consultation.created_at).toLocaleDateString(
                        'en-GB',
                        { day: '2-digit', month: 'short', year: 'numeric' },
                      )
                    : 'N/A'}
                </span>
              </p>
            </div>
            <button className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1 shadow-sm transition-colors">
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {soapSections.map((section) => (
            <div key={section.key} className="mb-4">
              <button
                onClick={() => toggleSection(section.key)}
                className="flex items-center gap-3 w-full text-left group"
              >
                <span
                  className={`w-8 h-8 ${section.color} text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-sm transition-transform group-hover:scale-105`}
                >
                  {section.letter}
                </span>
                <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide flex-1">
                  {section.title}
                </h3>
                {expandedSections[section.key] ? (
                  <ChevronDown size={16} className="text-slate-400" />
                ) : (
                  <ChevronRight size={16} className="text-slate-400" />
                )}
              </button>

              {expandedSections[section.key] && (
                <div className="mt-3 pl-11">
                  <p className="text-[15px] font-medium text-slate-800 leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                    {section.content || (
                      <span className="text-slate-400 italic">
                        Not documented
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {(consultation.clinical_notes ||
          consultation.differential_diagnosis) && (
          <div className="border-t border-gray-100 px-5 py-4 bg-slate-50/50 space-y-4">
            {consultation.differential_diagnosis && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-500" />
                  Differential Diagnosis
                </h4>
                <p className="text-sm text-slate-600">
                  {consultation.differential_diagnosis}
                </p>
              </div>
            )}
            {consultation.clinical_notes && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Edit3 size={14} className="text-blue-500" />
                  Additional Notes
                </h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {consultation.clinical_notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TreatmentPlanSection({
  treatmentPlans,
  consultation,
  isLoading,
}: {
  treatmentPlans: any[];
  consultation: any;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-xl">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const plan = consultation?.treatment_plan || consultation?.plan;
  const recommendations = consultation?.recommendations;
  const followUp = consultation?.follow_up_notes;

  if (
    !plan &&
    !recommendations &&
    (!treatmentPlans || treatmentPlans.length === 0)
  ) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
        <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">
          No treatment plan documented
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Treatment plans will appear here when created
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {plan && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-green-50/50 px-5 py-4 border-b border-green-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-green-600" />
              Treatment Plan
            </h3>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {plan}
            </p>
          </div>
        </div>
      )}

      {recommendations && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-blue-50/50 px-5 py-4 border-b border-blue-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Recommendations
            </h3>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {recommendations}
            </p>
          </div>
        </div>
      )}

      {followUp && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-purple-50/50 px-5 py-4 border-b border-purple-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Follow-up Instructions
            </h3>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {followUp}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MedicationsSection({
  prescriptions,
  isLoading,
}: {
  prescriptions: any[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-xl">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!prescriptions || prescriptions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
        <Pill className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">No medications prescribed</p>
        <p className="text-sm text-gray-400 mt-1">
          Prescriptions will appear here when ordered
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-emerald-50/50 px-5 py-4 border-b border-emerald-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Pill className="h-5 w-5 text-emerald-600" />
          Active Medications
        </h3>
        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
          {prescriptions.length} medication
          {prescriptions.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {prescriptions.map((rx: any, idx: number) => (
          <div
            key={rx.id || idx}
            className="p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">
                    {rx.drug_name || rx.medication_name}
                  </h4>
                  {rx.dispensed && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <CheckCircle2 size={10} />
                      Dispensed
                    </span>
                  )}
                  {rx.status && rx.status !== 'active' && (
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        rx.status === 'completed'
                          ? 'bg-gray-100 text-gray-600'
                          : rx.status === 'cancelled'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {rx.status}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                  <span className="font-medium bg-gray-100 px-2 py-0.5 rounded">
                    {rx.dosage}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>{rx.frequency}</span>
                  <span className="text-gray-300">•</span>
                  <span>{rx.duration}</span>
                </div>
                {rx.instructions && (
                  <p className="mt-2 text-sm text-gray-500 italic bg-slate-50 p-2 rounded border border-slate-100">
                    {rx.instructions}
                  </p>
                )}
              </div>
              {rx.quantity && (
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-700 block">
                    Qty: {rx.quantity}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NursingNotesSection({
  nursingNotes,
  isLoading,
}: {
  nursingNotes: any[];
  isLoading: boolean;
}) {
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-xl">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!nursingNotes || nursingNotes.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
        <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">No nursing notes recorded</p>
        <p className="text-sm text-gray-400 mt-1">
          Nursing assessments and notes will appear here
        </p>
      </div>
    );
  }

  const noteTypeColors: Record<string, string> = {
    assessment: 'bg-blue-100 text-blue-700 border-l-blue-500',
    progress: 'bg-green-100 text-green-700 border-l-green-500',
    intervention: 'bg-purple-100 text-purple-700 border-l-purple-500',
    medication: 'bg-emerald-100 text-emerald-700 border-l-emerald-500',
    vital_signs: 'bg-red-100 text-red-700 border-l-red-500',
    shift_handover: 'bg-amber-100 text-amber-700 border-l-amber-500',
  };

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {nursingNotes.map((note: any) => {
        const isExpanded = expandedNoteId === note.id;
        const colorClass =
          noteTypeColors[note.note_type] ||
          'bg-gray-100 text-gray-700 border-l-gray-500';

        return (
          <div
            key={note.id}
            className={`bg-white border border-gray-200 border-l-4 ${colorClass.split(' ').pop()} rounded-r-lg shadow-sm overflow-hidden transition-all duration-200`}
          >
            <button
              onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wide ${colorClass.split(' ').slice(0, 2).join(' ')}`}
                  >
                    {(note.note_type || 'note').replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-gray-500 font-medium">
                    {new Date(note.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {note.nurse_name && (
                    <span className="text-sm text-gray-400">
                      by{' '}
                      <span className="text-gray-600 font-medium">
                        {note.nurse_name}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp size={16} className="text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 pt-1">
                {note.content && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </p>
                )}
                {note.vital_signs && (
                  <div className="grid grid-cols-4 gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                    {note.vital_signs.temperature && (
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">
                          {note.vital_signs.temperature}°C
                        </span>
                      </div>
                    )}
                    {note.vital_signs.pulse && (
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-pink-500" />
                        <span className="text-sm font-medium">
                          {note.vital_signs.pulse} bpm
                        </span>
                      </div>
                    )}
                    {note.vital_signs.blood_pressure && (
                      <div className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium">
                          {note.vital_signs.blood_pressure}
                        </span>
                      </div>
                    )}
                    {note.vital_signs.oxygen_saturation && (
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">
                          SpO₂: {note.vital_signs.oxygen_saturation}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

type TabType =
  | 'overview'
  | 'vitals'
  | 'clinical-notes'
  | 'treatment-plan'
  | 'medications'
  | 'nursing-notes'
  | 'ward-rounds'
  | 'procedures'
  | 'handover'
  | 'transfers'
  | 'discharge'
  | 'notes'
  | 'history'
  | 'ae-records';

export const AdmissionCareModal: React.FC<AdmissionCareModalProps> = ({
  admission,
  isOpen,
  onClose,
  onTransfer,
  onDischarge,
  onWardRound,
}) => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);
  const [selectedHistoryAdmission, setSelectedHistoryAdmission] =
    useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVitalsFormOpen, setIsVitalsFormOpen] = useState(false); // New State
  const [isRecordingProcedure, setIsRecordingProcedure] = useState(false); // Procedure Mode

  // Data fetching logic similar to EnhancedAdmissionDetailsModal
  const originalAdmissionId = admission
    ? isActiveAdmissionView(admission)
      ? admission.admission_id
      : admission.id
    : '';
  const admissionId = selectedHistoryAdmission?.id || originalAdmissionId;
  const patientId = admission
    ? isActiveAdmissionView(admission)
      ? admission.patient_id || ''
      : (admission as AdmissionWithDetails).patient?.id || ''
    : '';
  const initialPendingBillsData =
    admission && isActiveAdmissionView(admission)
      ? {
          pendingTotal: admission.pending_bills_total || 0,
          pendingCount: admission.pending_bills_count || 0,
        }
      : undefined;
  const admissionDataForHooks = admission as unknown as Record<string, unknown>;
  const encounterIdForHooks = admission
    ? (admissionDataForHooks.encounter_id as string) || ''
    : '';

  // Data fetching logic
  const {
    data: wardRoundNotes,
    isLoading: loadingRounds,
    refetch: refetchRounds,
  } = useWardRoundNotes(admissionId);
  const {
    data: procedures,
    isLoading: loadingProcedures,
    refetch: refetchProcedures,
  } = useQuery({
    queryKey: ['procedures', admissionId],
    queryFn: () => getProceduresByAdmission(admissionId),
    enabled: !!admissionId,
  });

  // Robustly resolve encounter ID for documentation

  // If admission link is missing, try to find the latest active encounter for this patient
  const { data: fallbackEncounter } = useQuery({
    queryKey: ['latest-encounter-fallback', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data } = await supabase
        .from('visits')
        .select('id')
        .eq('patient_id', patientId)
        .eq('status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!patientId && !encounterIdForHooks,
  });

  const activeEncounterId = encounterIdForHooks || fallbackEncounter?.id || '';

  const { data: patientAdmissions, isLoading: loadingHistory } =
    usePatientAdmissions(patientId || '');
  const { data: encounterDetails, isLoading: loadingEncounter } =
    useEncounterDetails(activeEncounterId);

  // New Hooks for Parity
  const {
    data: vitalsRecords,
    isLoading: vitalsLoading,
    refetch: refetchVitals,
  } = useQuery({
    queryKey: ['encounter-vitals-global', activeEncounterId],
    queryFn: () => getVitals({ encounter_id: activeEncounterId }),
    enabled: !!activeEncounterId,
  });

  const { data: timelineEvents, isLoading: timelineLoading } = useQuery({
    queryKey: ['clinical-timeline', activeEncounterId],
    queryFn: () => getClinicalTimeline(activeEncounterId),
    enabled: !!activeEncounterId,
  });

  const { data: pendingBillsSummary, isLoading: loadingPendingBills } =
    useQuery({
      queryKey: ['admission-care-pending-bills', patientId],
      queryFn: async () => {
        const [pendingTotal, unverifiedBills] = await Promise.all([
          getPatientOutstandingBalance(patientId),
          getPatientUnverifiedBills(patientId),
        ]);

        return {
          pendingTotal,
          pendingCount: unverifiedBills.unverifiedCount,
        };
      },
      enabled: !!patientId,
      initialData: initialPendingBillsData,
    });

  useEffect(() => {
    if (!activeEncounterId) return;

    const invalidateTimeline = () => {
      queryClient.invalidateQueries({
        queryKey: ['clinical-timeline', activeEncounterId],
      });
    };

    const timelineRealtimeChannel = supabase
      .channel(`admission-care-timeline-${activeEncounterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'specialty_careplans',
          filter: `encounter_id=eq.${activeEncounterId}`,
        },
        invalidateTimeline,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'careplan_sessions',
        },
        invalidateTimeline,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lab_requests',
          filter: `encounter_id=eq.${activeEncounterId}`,
        },
        invalidateTimeline,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nursing_notes',
          filter: `encounter_id=eq.${activeEncounterId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['clinical-timeline', activeEncounterId] });
          queryClient.invalidateQueries({ queryKey: ['nursing-notes', activeEncounterId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nursing_notes',
          filter: `encounter_id=eq.${activeEncounterId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['clinical-timeline', activeEncounterId] });
          queryClient.invalidateQueries({ queryKey: ['nursing-notes', activeEncounterId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(timelineRealtimeChannel);
    };
  }, [activeEncounterId, queryClient]);

  const { data: nursingNotes, isLoading: loadingNursingNotes } = useQuery({
    queryKey: ['nursing-notes', encounterIdForHooks],
    queryFn: async () => {
      if (!encounterIdForHooks) return [];
      try {
        return await getNursingNotesByEncounter(encounterIdForHooks);
      } catch (error) {
        console.error(
          '[AdmissionCareModal] Error fetching nursing notes:',
          error,
        );
        return [];
      }
    },
    enabled: !!encounterIdForHooks,
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedHistoryAdmission(null);
      setActiveTab('overview');
    }
  }, [isOpen, originalAdmissionId]);

  if (!isOpen || !admission) return null;

  // Data Extraction
  const isView = isActiveAdmissionView(admission);
  const patientName = isView
    ? `${admission.first_name} ${admission.last_name}`
    : (admission as AdmissionWithDetails).patient
      ? `${(admission as AdmissionWithDetails).patient?.first_name} ${(admission as AdmissionWithDetails).patient?.surname}`
      : 'Unknown Patient';
  const hospitalId = isView
    ? admission.hospital_id
    : (admission as AdmissionWithDetails).patient?.emr_number || 'N/A';
  const wardName = isView
    ? (admission as ActiveAdmissionView).ward_name || 'Unassigned'
    : (admission as AdmissionWithDetails).current_ward?.name || 'Unassigned';
  const bedNumber = isView
    ? (admission as ActiveAdmissionView).bed_number || 'N/A'
    : (admission as AdmissionWithDetails).current_bed?.bed_number || 'N/A';

  const patientSex = isView
    ? (admission as ActiveAdmissionView).gender || 'Unknown'
    : (admission as AdmissionWithDetails).patient?.gender || 'Unknown';

  const patientDob = isView
    ? (admission as ActiveAdmissionView).date_of_birth
    : (admission as AdmissionWithDetails).patient?.date_of_birth;
  const patientAge = formatDetailedAge(patientDob);

  const admissionDate = admission.admission_date;
  const admissionNumber = admission.admission_number;
  const admittingDiagnosis = admission.admitting_diagnosis;
  const admissionData = admission as unknown as Record<string, unknown>;
  const chiefComplaint = admissionData.chief_complaint as string | null;
  const admissionType = admission.admission_type;
  const acuityLevel = admission.acuity_level;
  const admissionStatus = admission.admission_status;
  const isolationRequired =
    (admissionData.isolation_required as boolean) || false;
  const isolationType = admissionData.isolation_type as string | null;
  const expectedDischargeDate = admission.expected_discharge_date;

  // Care Team
  const admittingDoctorFirstName = admissionData.admitting_doctor_first_name as
    | string
    | null;
  const admittingDoctorLastName = admissionData.admitting_doctor_last_name as
    | string
    | null;
  const admittingDoctorName = admittingDoctorFirstName
    ? `Dr. ${admittingDoctorFirstName} ${admittingDoctorLastName}`
    : null;
  const primaryNurseFirstName = admissionData.primary_nurse_first_name as
    | string
    | null;
  const primaryNurseLastName = admissionData.primary_nurse_last_name as
    | string
    | null;

  // Stats
  const isDischargedAdmission = [
    'discharged',
    'transferred',
    'deceased',
    'absconded',
  ].includes(admissionStatus || '');
  const lengthOfStayDays = admissionData.length_of_stay_days as number | null;

  // Discharge & Transfer fields
  const transferCount = (admissionData.transfer_count as number) ?? 0;
  const actualDischargeDate = admissionData.actual_discharge_date as
    | string
    | null;
  const dischargeType = admissionData.discharge_type as string | null;
  const dischargeSummary = admissionData.discharge_summary as string | null;
  const dischargeDisposition = admissionData.discharge_disposition as
    | string
    | null;
  const dischargeInstructions = admissionData.discharge_instructions as
    | string
    | null;
  const dischargeDiagnosis = admissionData.discharge_diagnosis as string | null;
  const dischargedByName = admissionData.discharged_by_name as string | null;
  const notes = admissionData.notes as string | null;
  const totalAdmissions = patientAdmissions?.length || 1;
  const pendingBillsTotal = pendingBillsSummary?.pendingTotal || 0;
  const pendingBillsCount = pendingBillsSummary?.pendingCount || 0;
  const hasPendingBills = pendingBillsTotal > 0 || pendingBillsCount > 0;

  const calculateLOSValue = () => {
    if (lengthOfStayDays)
      return `${lengthOfStayDays} day${lengthOfStayDays !== 1 ? 's' : ''}`;
    if (admissionDate) {
      if (isDischargedAdmission && admissionData.actual_discharge_date) {
        const start = new Date(admissionDate);
        const end = new Date(admissionData.actual_discharge_date as string);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      }
      return calculateLOS(admissionDate);
    }
    return 'N/A';
  };

  // Construct helper objects for child components
  const patientObject = {
    id: patientId, // UUID
    patient_id: hospitalId,
    first_name: isView
      ? admission.first_name
      : (admission as AdmissionWithDetails).patient?.first_name,
    surname: isView
      ? admission.last_name
      : (admission as AdmissionWithDetails).patient?.surname,
    gender: patientSex,
    date_of_birth: patientDob,
    known_allergies: [],
    nok_name: 'N/A',
    nok_phone: 'N/A',
    patient_category: 'Standard',
    emr_number: hospitalId,
  };

  const handleVitalsSubmit = async (data: CreateNursingCareDTO) => {
    console.log('Creating vitals:', data);
    try {
      await createNursingCareRecord(data);
      refetchVitals();
      setIsVitalsFormOpen(false);
    } catch (error) {
      console.error('Failed to create vitals', error);
    }
  };

  // Tab config
  const tabs: {
    id: TabType;
    label: string;
    icon: any;
    count?: number;
    show: boolean;
    color?: string;
  }[] = [
    {
      id: 'overview',
      label: 'Summary',
      icon: LayoutDashboard,
      color: 'blue',
      show: true,
    },
    {
      id: 'vitals',
      label: 'Care & Vitals',
      icon: Heart,
      color: 'red',
      count: vitalsRecords?.length || 0,
      show: true,
    },
    {
      id: 'clinical-notes',
      label: 'Doctor Notes',
      icon: Stethoscope,
      color: 'emerald',
      show: true,
    },
    {
      id: 'treatment-plan',
      label: 'Treatment Plan',
      icon: ClipboardCheck,
      show: true,
    },
    {
      id: 'medications',
      label: 'Medications',
      icon: Pill,
      count: encounterDetails?.prescriptions?.length || 0,
      show: true,
    },
    {
      id: 'nursing-notes',
      label: 'Nursing Progress',
      icon: ClipboardList,
      color: 'amber',
      count: nursingNotes?.length || 0,
      show: true,
    },
    {
      id: 'ward-rounds',
      label: 'Ward Rounds',
      icon: Activity,
      count: wardRoundNotes?.length || 0,
      show: true,
    },
    {
      id: 'procedures',
      label: 'Procedures',
      icon: Scissors,
      count: procedures?.length || 0,
      show: true,
    },
    {
      id: 'handover',
      label: 'Handover',
      icon: ArrowRightLeft,
      color: 'purple',
      show: true,
    },
    { id: 'transfers', label: 'Transfers', icon: ArrowRightLeft, show: true },
    {
      id: 'discharge',
      label: 'Discharge',
      icon: LogOut,
      show: isDischargedAdmission,
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: StickyNote,
      show: !!admissionData.notes,
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      count: patientAdmissions?.length || 0,
      show: true,
    },
    { id: 'ae-records', label: 'A&E Records', icon: Activity, show: true },
  ];

  if (isRecordingProcedure) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center font-sans">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <div className="relative w-full h-[98vh] max-w-[98vw] bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <ProcedureNoteForm
            admission={admission as AdmissionWithDetails}
            onSuccess={() => {
              setIsRecordingProcedure(false);
              refetchProcedures();
            }}
            onCancel={() => setIsRecordingProcedure(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center font-sans">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full bg-slate-50 shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200 ${
          isExpanded
            ? 'max-w-[99vw] h-[98vh] rounded-lg'
            : 'max-w-7xl h-[90vh] rounded-xl'
        }`}
      >
        {/* SIDE NAVIGATION */}
        <div className="w-52 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          {/* Brand */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Bed size={16} />
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-900 tracking-tight leading-none uppercase">
                In-Patient
              </h1>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">
                Admission Care
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">
            {tabs
              .filter((t) => t.show)
              .map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all group ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      size={15}
                      className={
                        isActive
                          ? 'text-blue-400'
                          : 'text-slate-400 group-hover:text-slate-900'
                      }
                    />
                    <span
                      className={`text-xs font-medium ${isActive ? 'text-slate-50' : 'text-slate-600 group-hover:text-slate-900'}`}
                    >
                      {tab.label}
                    </span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-blue-500/20 text-blue-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>

          {/* Sidebar Footer */}
          <div className="px-3 py-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
            >
              <X size={12} />
              Close
            </button>
          </div>
        </div>

        {/* MAIN BODY */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
          {/* HEADER */}
          <header className="bg-white px-6 py-3 border-b border-slate-200 flex items-center justify-between z-10 flex-shrink-0">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center font-serif text-lg font-bold text-slate-400 border border-slate-200">
                  <User size={22} />
                </div>
                {acuityLevel && (
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded ${acuityColors[acuityLevel] || 'bg-gray-100'} border-2 border-white flex items-center justify-center`}
                    title={`Acuity: ${acuityLevel}`}
                  >
                    <Activity size={8} />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    {patientName}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isDischargedAdmission
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {admissionStatus?.replace(/_/g, ' ') || 'ADMITTED'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <User size={12} className="text-slate-400" />
                    {patientSex} • {patientAge}
                  </span>
                  <span className="flex items-center gap-1">
                    <Fingerprint size={12} className="text-slate-400" />
                    ID: {hospitalId}
                  </span>
                  <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                    <ClipboardCheck size={12} className="text-blue-500" />
                    ADM: {admissionNumber || 'N/A'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 size={12} className="text-slate-400" />
                    {wardName}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="mr-3 px-3 border-r border-slate-100 text-right hidden lg:block">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Length of Stay
                </p>
                <p className="text-base font-bold text-slate-800">
                  {calculateLOSValue()}
                </p>
              </div>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all"
                title={isExpanded ? 'Restore' : 'Fullscreen'}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              {onDischarge && !isDischargedAdmission && (
                <button
                  onClick={onDischarge}
                  className="h-9 px-4 rounded-lg shadow-sm bg-amber-600 text-white hover:bg-amber-700 text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <LogOut size={14} />
                  Discharge
                </button>
              )}

              {/* Unified Order Button — same GOPD QuickOrderModal */}
              {!isDischargedAdmission && activeEncounterId && (
                <UniversalOrderButton
                  encounterId={activeEncounterId}
                  patientId={hospitalId}
                  patientName={patientName}
                  patientEmrNumber={hospitalId}
                  encounterType="In-Patient"
                  hasActiveAdmission
                  onOrdersCreated={() => {
                    queryClient.invalidateQueries({ queryKey: ['clinical-timeline', activeEncounterId] });
                  }}
                />
              )}
            </div>
          </header>

          {/* MAIN SCROLLABLE CONTENT */}
          <main className="flex-1 overflow-y-auto custom-scrollbar p-5">
            <div className="max-w-full mx-auto space-y-5">
              {/* Status Bar */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Location Card */}
                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Bed className="text-blue-600 h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                        Current Location
                      </p>
                      <h3 className="text-base font-bold text-slate-900">
                        {wardName}
                      </h3>
                      <p className="text-xs font-medium text-slate-500">
                        Bed {bedNumber}
                      </p>
                    </div>
                  </div>

                  {/* Alert Card */}
                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${isolationRequired ? 'bg-red-50' : 'bg-green-50'}`}
                    >
                      <ShieldAlert
                        className={`${isolationRequired ? 'text-red-600' : 'text-green-600'} h-5 w-5`}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                        Infection Control
                      </p>
                      <h3
                        className={`text-base font-bold ${isolationRequired ? 'text-red-700' : 'text-slate-900'}`}
                      >
                        {isolationRequired
                          ? 'Isolation Required'
                          : 'Standard Precautions'}
                      </h3>
                      {isolationRequired && (
                        <p className="text-xs font-medium text-red-600">
                          {isolationType}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${hasPendingBills ? 'bg-red-50' : 'bg-emerald-50'}`}
                    >
                      {loadingPendingBills ? (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                      ) : hasPendingBills ? (
                        <AlertCircle className="text-red-600 h-5 w-5" />
                      ) : (
                        <CheckCircle2 className="text-emerald-600 h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                        Pending Bills
                      </p>
                      <h3
                        className={`text-base font-bold ${hasPendingBills ? 'text-red-700' : 'text-slate-900'}`}
                      >
                        {formatCurrency(pendingBillsTotal)}
                      </h3>
                      <p
                        className={`text-xs font-medium ${hasPendingBills ? 'text-red-600' : 'text-emerald-600'}`}
                      >
                        {hasPendingBills
                          ? `${pendingBillsCount} open bill${pendingBillsCount === 1 ? '' : 's'}`
                          : 'No open bills'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Area */}
              <div className="min-h-[200px]">
                {activeTab === 'overview' && (
                  <OverviewTabContent
                    patient={patientObject}
                    latestVitals={vitalsRecords?.[0] || null}
                    timeline={timelineEvents}
                    timelineLoading={timelineLoading}
                  />
                )}

                {activeTab === 'vitals' && (
                  <VitalsTabContent
                    encounterId={encounterIdForHooks}
                    patientId={patientId}
                    isWritable={!isDischargedAdmission}
                    isVitalsFormOpen={isVitalsFormOpen}
                    setIsVitalsFormOpen={setIsVitalsFormOpen}
                    handleVitalsSubmit={handleVitalsSubmit}
                    isCreatingRecord={false}
                    patient={patientObject}
                    visitId={encounterDetails?.visit_id || null}
                    queueId={null}
                    vitalsRecords={vitalsRecords}
                    vitalsLoading={vitalsLoading}
                  />
                )}

                {activeTab === 'clinical-notes' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Stethoscope size={20} className="text-blue-500" />
                        <h3 className="text-lg font-bold text-slate-800">
                          Doctor's Consultation Notes
                        </h3>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded tracking-tighter">
                        PHYSICIAN NOTES
                      </span>
                    </div>
                    <DoctorNotesPanel
                      encounterId={activeEncounterId}
                      patientId={patientId}
                      patientName={patientName}
                    />
                  </div>
                )}

                {activeTab === 'handover' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <ShiftHandoverTab
                      encounterId={activeEncounterId}
                      patientId={patientId}
                      patientName={patientName}
                    />
                  </div>
                )}

                {activeTab === 'treatment-plan' && (
                  <TreatmentPlanSection
                    treatmentPlans={[]}
                    consultation={encounterDetails?.consultation}
                    isLoading={loadingEncounter}
                  />
                )}

                {activeTab === 'medications' && (
                  <MedicationAdministrationTab
                    encounterId={activeEncounterId}
                    patientId={patientId}
                    patientName={patientName}
                    prescriptions={encounterDetails?.prescriptions || []}
                    nursingNotes={encounterDetails?.nursing_notes || []}
                    isLoading={loadingEncounter}
                  />
                )}

                {activeTab === 'nursing-notes' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList size={20} className="text-blue-600" />
                        <h3 className="text-lg font-bold text-slate-800">
                          Nursing Documentation
                        </h3>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded tracking-tighter">
                        FULL CARE LOG
                      </span>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden min-h-[300px] p-3">
                      <NursingNotesTab
                        encounterId={activeEncounterId}
                        patientId={patientId}
                        patientName={patientName}
                        compact
                        // Force show header to ensure 'Add' button is visible if compact hides it in some scenarios
                        hideHeader={false}
                        hideStats
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'procedures' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scissors size={20} className="text-blue-600" />
                        <h3 className="text-lg font-bold text-slate-800">
                          Procedures & Surgeries
                        </h3>
                      </div>
                      {!isDischargedAdmission && (
                        <button
                          onClick={() => setIsRecordingProcedure(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          <Scissors size={16} />
                          Record Procedure
                        </button>
                      )}
                    </div>

                    {loadingProcedures ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="animate-spin text-blue-600" />
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {procedures?.map((proc: any) => {
                          const surgeonName = proc.surgeon
                            ? `Dr. ${proc.surgeon.first_name || ''} ${proc.surgeon.last_name || ''}`.trim()
                            : 'Not assigned';
                          const statusColors: Record<string, string> = {
                            completed:
                              'bg-green-100 text-green-700 border-green-200',
                            scheduled:
                              'bg-blue-100 text-blue-700 border-blue-200',
                            in_progress:
                              'bg-amber-100 text-amber-700 border-amber-200',
                            cancelled: 'bg-red-100 text-red-700 border-red-200',
                            pre_op:
                              'bg-purple-100 text-purple-700 border-purple-200',
                          };
                          const statusCls =
                            statusColors[proc.status] ||
                            'bg-gray-100 text-gray-700 border-gray-200';

                          return (
                            <div
                              key={proc.id}
                              className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
                            >
                              {/* Header */}
                              <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-4 border-b border-slate-100">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                      <Scissors
                                        size={18}
                                        className="text-blue-500"
                                      />
                                      {proc.procedure_name}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                      <span className="flex items-center gap-1">
                                        <Clock size={13} />
                                        {new Date(
                                          proc.created_at,
                                        ).toLocaleString()}
                                      </span>
                                      {proc.procedure_number && (
                                        <>
                                          <span>•</span>
                                          <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                                            {proc.procedure_number}
                                          </span>
                                        </>
                                      )}
                                      <span>•</span>
                                      <span
                                        className={`capitalize px-2 py-0.5 rounded-full text-xs font-bold border ${statusCls}`}
                                      >
                                        {proc.status?.replace('_', ' ')}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-bold text-slate-800">
                                      {surgeonName}
                                    </p>
                                    <p className="text-xs text-blue-600 font-medium">
                                      Primary Surgeon
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Body - All operative details */}
                              <div className="px-5 py-4 space-y-4">
                                {/* Priority & Anesthesia Row */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                      Priority
                                    </p>
                                    <p
                                      className={`text-sm font-bold capitalize ${
                                        proc.priority === 'emergency'
                                          ? 'text-red-600'
                                          : proc.priority === 'urgent'
                                            ? 'text-amber-600'
                                            : 'text-slate-700'
                                      }`}
                                    >
                                      {proc.priority || 'Routine'}
                                    </p>
                                  </div>
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                      Anesthesia
                                    </p>
                                    <p className="text-sm font-semibold text-slate-700 capitalize">
                                      {proc.anesthesia_type || 'Not specified'}
                                    </p>
                                  </div>
                                  {proc.estimated_blood_loss_ml !== undefined &&
                                    proc.estimated_blood_loss_ml !== null && (
                                      <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">
                                          Est. Blood Loss
                                        </p>
                                        <p className="text-sm font-bold text-red-700">
                                          {proc.estimated_blood_loss_ml} ml
                                        </p>
                                      </div>
                                    )}
                                  {(proc.actual_start_time ||
                                    proc.actual_end_time) && (
                                    <div className="bg-slate-50 rounded-lg p-3">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Duration
                                      </p>
                                      <p className="text-sm font-semibold text-slate-700">
                                        {proc.actual_duration_minutes
                                          ? `${proc.actual_duration_minutes} min`
                                          : proc.actual_end_time
                                            ? new Date(
                                                proc.actual_end_time,
                                              ).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })
                                            : 'In progress'}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Pre-Operative Section */}
                                {(proc.pre_procedure_diagnosis ||
                                  proc.indication) && (
                                  <div className="border-l-4 border-blue-300 pl-4 space-y-2">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-blue-600">
                                      Pre-Operative
                                    </h5>
                                    {proc.indication && (
                                      <div>
                                        <p className="text-xs text-slate-400 font-medium">
                                          Indication
                                        </p>
                                        <p className="text-sm text-slate-700">
                                          {proc.indication}
                                        </p>
                                      </div>
                                    )}
                                    {proc.pre_procedure_diagnosis && (
                                      <div>
                                        <p className="text-xs text-slate-400 font-medium">
                                          Pre-Op Diagnosis
                                        </p>
                                        <p className="text-sm text-slate-700">
                                          {proc.pre_procedure_diagnosis}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Operative Details Section */}
                                {(proc.procedure_notes ||
                                  proc.findings ||
                                  proc.technique_description) && (
                                  <div className="border-l-4 border-emerald-300 pl-4 space-y-2">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                                      Operative Details
                                    </h5>
                                    {proc.procedure_notes && (
                                      <div>
                                        <p className="text-xs text-slate-400 font-medium">
                                          Procedure Notes
                                        </p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">
                                          {proc.procedure_notes}
                                        </p>
                                      </div>
                                    )}
                                    {proc.findings && (
                                      <div>
                                        <p className="text-xs text-slate-400 font-medium">
                                          Findings
                                        </p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                          {proc.findings}
                                        </p>
                                      </div>
                                    )}
                                    {proc.technique_description && (
                                      <div>
                                        <p className="text-xs text-slate-400 font-medium">
                                          Technique
                                        </p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                          {proc.technique_description}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Complications */}
                                {proc.complications && (
                                  <div className="border-l-4 border-red-300 pl-4">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-red-600">
                                      Complications
                                    </h5>
                                    <p className="text-sm text-red-700 mt-1">
                                      {proc.complications}
                                    </p>
                                  </div>
                                )}

                                {/* Post-Operative Section */}
                                {(proc.post_procedure_diagnosis ||
                                  proc.post_op_diagnosis ||
                                  proc.post_op_instructions) && (
                                  <div className="border-l-4 border-amber-300 pl-4 space-y-2">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-amber-600">
                                      Post-Operative
                                    </h5>
                                    {(proc.post_procedure_diagnosis ||
                                      proc.post_op_diagnosis) && (
                                      <div>
                                        <p className="text-xs text-slate-400 font-medium">
                                          Post-Op Diagnosis
                                        </p>
                                        <p className="text-sm text-slate-700">
                                          {proc.post_procedure_diagnosis ||
                                            proc.post_op_diagnosis}
                                        </p>
                                      </div>
                                    )}
                                    {proc.post_op_instructions && (
                                      <div>
                                        <p className="text-xs text-slate-400 font-medium">
                                          Post-Op Instructions
                                        </p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-amber-50 p-3 rounded-lg border border-amber-100">
                                          {proc.post_op_instructions}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Anesthesia Notes */}
                                {proc.anesthesia_notes && (
                                  <div className="border-l-4 border-purple-300 pl-4">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-purple-600">
                                      Anesthesia Notes
                                    </h5>
                                    <p className="text-sm text-slate-700 mt-1">
                                      {proc.anesthesia_notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {(!procedures || procedures.length === 0) && (
                          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                            <Scissors className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 font-medium">
                              No procedures recorded yet.
                            </p>
                            {!isDischargedAdmission && (
                              <button
                                onClick={() => setIsRecordingProcedure(true)}
                                className="mt-2 text-blue-600 hover:underline text-sm font-medium"
                              >
                                Record First Procedure
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'ward-rounds' &&
                  (() => {
                    // Group notes by date for timeline sections
                    const sorted = [...(wardRoundNotes || [])].sort((a, b) => {
                      if (a.round_date > b.round_date) return -1;
                      if (a.round_date < b.round_date) return 1;
                      return (
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime()
                      );
                    });
                    const grouped: Record<string, WardRoundNote[]> = {};
                    for (const n of sorted) {
                      const key = n.round_date?.slice(0, 10) || 'unknown';
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(n);
                    }
                    const dateGroups = Object.entries(grouped);

                    return (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Header bar */}
                        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-blue-800 rounded-xl px-5 py-4 flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              <Activity size={20} className="text-blue-300" />
                              Ward Rounds Timeline
                            </h3>
                            <p className="text-xs text-slate-300 mt-0.5">
                              {sorted.length} round
                              {sorted.length !== 1 ? 's' : ''} recorded
                              {dateGroups.length > 0 &&
                                ` across ${dateGroups.length} day${dateGroups.length !== 1 ? 's' : ''}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {onWardRound &&
                              hasRole([
                                'doctor',
                                'medical_director',
                                'super_admin',
                              ]) &&
                              !isDischargedAdmission && (
                                <button
                                  onClick={onWardRound}
                                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-400 transition-colors text-sm font-medium flex items-center gap-2 shadow-lg shadow-blue-900/30"
                                >
                                  <Activity size={16} />
                                  Add Round Note
                                </button>
                              )}
                            <button
                              onClick={() => refetchRounds()}
                              className="p-2 text-slate-300 hover:text-white transition-colors"
                            >
                              <RefreshCw
                                size={18}
                                className={loadingRounds ? 'animate-spin' : ''}
                              />
                            </button>
                          </div>
                        </div>

                        {loadingRounds ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-blue-600" />
                          </div>
                        ) : sorted.length === 0 ? (
                          <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
                            <Activity className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-500 font-medium">
                              No ward rounds recorded yet
                            </p>
                            {onWardRound && !isDischargedAdmission && (
                              <button
                                onClick={onWardRound}
                                className="mt-3 text-blue-600 hover:underline text-sm font-medium"
                              >
                                Record First Ward Round
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {dateGroups.map(([dateKey, notes]) => (
                              <div key={dateKey}>
                                {/* Date group header */}
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                                    <Calendar
                                      size={12}
                                      className="inline mr-1.5 -mt-0.5"
                                    />
                                    {new Date(
                                      `${dateKey}T00:00:00`,
                                    ).toLocaleDateString('en-GB', {
                                      weekday: 'short',
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </div>
                                  <div className="flex-1 h-px bg-slate-200" />
                                  <span className="text-[11px] text-slate-400 font-medium">
                                    {notes.length} round
                                    {notes.length !== 1 ? 's' : ''}
                                  </span>
                                </div>

                                {/* Timeline cards for this date */}
                                <div className="ml-1">
                                  {notes.map((note, idx) => (
                                    <WardRoundTimelineCard
                                      key={note.id}
                                      note={note}
                                      isExpanded={expandedRoundId === note.id}
                                      onToggle={() =>
                                        setExpandedRoundId(
                                          expandedRoundId === note.id
                                            ? null
                                            : note.id,
                                        )
                                      }
                                      isLast={idx === notes.length - 1}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* Transfers Tab */}
                {activeTab === 'transfers' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Bed Transfer History
                      </h3>
                      {onTransfer && !isDischargedAdmission && (
                        <button
                          onClick={onTransfer}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          Transfer Bed
                        </button>
                      )}
                    </div>

                    {transferCount > 0 ? (
                      <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                        <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                        <p className="text-slate-600 font-medium">
                          {transferCount} transfer(s) recorded
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Transfer history details coming soon
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                        <ArrowRightLeft className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">
                          No bed transfers recorded
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                          Patient has been in the same location since admission
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Discharge Tab */}
                {activeTab === 'discharge' && isDischargedAdmission && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                          <LogOut className="h-5 w-5 text-slate-600" />
                          Discharge Information
                        </h3>
                      </div>
                      <div className="p-5 space-y-6">
                        {/* Discharge Details Grid */}
                        <div className="grid grid-cols-3 gap-6">
                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                              Discharge Date & Time
                            </p>
                            <p className="text-lg font-semibold text-slate-900 mt-1">
                              {formatDate(actualDischargeDate)}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                              Discharge Type
                            </p>
                            <p className="text-lg font-semibold text-slate-900 mt-1 capitalize">
                              {dischargeType?.replace(/_/g, ' ') || 'N/A'}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                              Discharged By
                            </p>
                            <p className="text-lg font-semibold text-slate-900 mt-1">
                              {dischargedByName || 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Discharge Diagnosis */}
                        {dischargeDiagnosis && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">
                              Discharge Diagnosis
                            </p>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <p className="text-sm text-slate-900">
                                {dischargeDiagnosis}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Discharge Summary */}
                        {dischargeSummary && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">
                              Discharge Summary
                            </p>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                {dischargeSummary}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Discharge Instructions */}
                        {dischargeInstructions && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">
                              Discharge Instructions
                            </p>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                {dischargeInstructions}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Disposition */}
                        {dischargeDisposition && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">
                              Disposition
                            </p>
                            <p className="text-sm font-medium text-slate-900 capitalize">
                              {dischargeDisposition.replace(/_/g, ' ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes Tab */}
                {activeTab === 'notes' && notes && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="bg-yellow-50 px-5 py-4 border-b border-yellow-100">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                          <StickyNote className="h-5 w-5 text-yellow-600" />
                          Admission Notes
                        </h3>
                      </div>
                      <div className="p-5">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {notes}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* A&E Records Tab */}
                {activeTab === 'ae-records' && (
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-600" />
                        A&E Encounter Timeline
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Complete chronological audit of patient A&E records
                        prior to admission.
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <AeTimeline encounterId={activeEncounterId} />
                    </div>
                  </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <History className="h-5 w-5 text-purple-600" />
                        Patient Admission History
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                          {totalAdmissions} total
                        </span>
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Click on any admission to view its details
                      </p>
                    </div>

                    {loadingHistory ? (
                      <div className="flex items-center justify-center py-12 bg-white rounded-xl">
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                      </div>
                    ) : patientAdmissions && patientAdmissions.length > 0 ? (
                      <div className="space-y-3">
                        {patientAdmissions.map((historyAdmission: any) => {
                          const isCurrent =
                            historyAdmission.id === originalAdmissionId;
                          const isSelected = selectedHistoryAdmission
                            ? historyAdmission.id ===
                              selectedHistoryAdmission.id
                            : isCurrent;
                          const histStatus =
                            historyAdmission.admission_status || 'admitted';

                          return (
                            <button
                              key={historyAdmission.id}
                              onClick={() => {
                                if (isCurrent) {
                                  setSelectedHistoryAdmission(null);
                                } else {
                                  setSelectedHistoryAdmission(historyAdmission);
                                }
                                setActiveTab('overview');
                              }}
                              className={`w-full text-left bg-white rounded-xl p-4 shadow-sm border transition-all hover:shadow-md ${
                                isSelected
                                  ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/30'
                                  : 'hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-sm font-semibold text-slate-900">
                                      {historyAdmission.admission_number}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[histStatus] || 'bg-gray-100 text-gray-700'}`}
                                    >
                                      {histStatus
                                        .replace('_', ' ')
                                        .toUpperCase()}
                                    </span>
                                    {isCurrent && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                        CURRENT
                                      </span>
                                    )}
                                    {isSelected && (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                        VIEWING
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-xs text-slate-500">
                                        Admitted
                                      </p>
                                      <p className="font-medium text-slate-900">
                                        {formatDateOnly(
                                          historyAdmission.admission_date,
                                        )}
                                      </p>
                                    </div>
                                    {historyAdmission.actual_discharge_date && (
                                      <div>
                                        <p className="text-xs text-slate-500">
                                          Discharged
                                        </p>
                                        <p className="font-medium text-slate-900">
                                          {formatDateOnly(
                                            historyAdmission.actual_discharge_date,
                                          )}
                                        </p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs text-slate-500">
                                        Type
                                      </p>
                                      <p className="font-medium text-slate-900 capitalize">
                                        {historyAdmission.admission_type?.replace(
                                          '_',
                                          ' ',
                                        ) || 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500">
                                        Diagnosis
                                      </p>
                                      <p className="font-medium text-slate-900 truncate">
                                        {historyAdmission.admitting_diagnosis ||
                                          'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="ml-4 flex-shrink-0">
                                  <span
                                    className={`text-xs font-medium ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}
                                  >
                                    {isSelected
                                      ? 'Currently viewing'
                                      : 'Click to view'}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-white rounded-xl">
                        <History className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">
                          No admission history found
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                          This is the patient's first admission
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* FOOTER */}
          <footer className="bg-white border-t border-slate-200 px-8 py-3 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest flex-shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                System Online
              </div>
              <span>Enc: {encounterIdForHooks || 'NEW'}</span>
            </div>
            <div>XenoCare • In-Patient Module</div>
          </footer>
        </div>
      </div>
    </div>
  );
};
