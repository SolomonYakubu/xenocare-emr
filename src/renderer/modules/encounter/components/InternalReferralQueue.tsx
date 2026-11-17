/**
 * =============================================================================
 * XENOCARE EMR - INTERNAL REFERRAL QUEUE
 *
 * Component for Encounter Office to view and manage internal referrals.
 * Features:
 * - View pending referrals from doctors
 * - Book appointments for specialty clinic visits
 * - Create new encounters when patient pays
 * - View referral details including source consultation info
 * =============================================================================
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  isNhisCategory,
  isNhisFeatureEnabled,
} from '../../../config/features';
import {
  ArrowRight,
  Calendar,
  Clock,
  User,
  Stethoscope,
  Building2,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Plus,
  FileText,
  Phone,
  CreditCard,
  Send,
  Eye,
  AlertTriangle,
  Loader2,
  CalendarPlus,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  CalendarCheck,
  CalendarX,
  Users,
  BarChart3,
  HelpCircle,
  BookOpen,
  X,
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Select } from '../../../components/ui/FormElements';
import { Modal } from '../../../components/ui/Modal';
import { Card, EmptyState } from '../../../components/ui/DataDisplay';
import EncounterForm from './EncounterForm';
import {
  internalReferralKeys,
  usePendingReferrals,
  useReferralDetail,
  useBookReferralAppointment,
  useCancelReferral,
} from '../hooks/useInternalReferral';
import type {
  PendingReferral,
  ReferralFilters,
  ReferralWorkflowStatus,
  ReferralUrgency,
} from '../api/internal-referral.api';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../api/supabaseClient';
import { useDebounce } from '../../../hooks/useDebounce';

// =============================================================================
// Types
// =============================================================================

interface InternalReferralQueueProps {
  onEncounterCreated?: (encounterId: string, encounterNumber: string) => void;
}

type ViewMode = 'queue' | 'detail';

// =============================================================================
// Helper Components
// =============================================================================

function UrgencyBadge({ urgency }: { urgency: ReferralUrgency }) {
  const styles = {
    Emergency: 'bg-red-100 text-red-800 border-red-200',
    Urgent: 'bg-orange-100 text-orange-800 border-orange-200',
    Routine: 'bg-green-100 text-green-800 border-green-200',
  };

  return (
    <span
      className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${styles[urgency] || styles.Routine}`}
    >
      {urgency}
    </span>
  );
}

function StatusBadge({ status }: { status: ReferralWorkflowStatus }) {
  const styles: Record<string, string> = {
    Pending_Encounter_Office: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Appointment_Booked: 'bg-blue-100 text-blue-800 border-blue-200',
    Encounter_Created: 'bg-green-100 text-green-800 border-green-200',
    Completed: 'bg-gray-100 text-gray-800 border-gray-200',
    Cancelled: 'bg-red-100 text-red-800 border-red-200',
    Missed: 'bg-red-50 text-red-700 border-red-200',
  };

  const labels: Record<string, string> = {
    Pending_Encounter_Office: 'Pending',
    Appointment_Booked: 'Appointment Booked',
    Encounter_Created: 'Encounter Created',
    Completed: 'Completed',
    Cancelled: 'Cancelled',
    Missed: 'Missed Appointment',
  };

  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || styles.Pending_Encounter_Office}`}
    >
      {labels[status] || status}
    </span>
  );
}

function SpecialtyBadge({ specialty }: { specialty: string | null }) {
  if (!specialty) return null;

  const styles: Record<string, string> = {
    dental: 'bg-amber-50 text-amber-700 border-amber-200',
    ophthalmology: 'bg-blue-50 text-blue-700 border-blue-200',
    physiotherapy: 'bg-green-50 text-green-700 border-green-200',
    cardiology: 'bg-red-50 text-red-700 border-red-200',
    orthopaedics: 'bg-gray-50 text-gray-700 border-gray-200',
    dermatology: 'bg-pink-50 text-pink-700 border-pink-200',
    urology: 'bg-purple-50 text-purple-700 border-purple-200',
    gastroenterology: 'bg-orange-50 text-orange-700 border-orange-200',
    nephrology: 'bg-teal-50 text-teal-700 border-teal-200',
    paediatrics: 'bg-sky-50 text-sky-700 border-sky-200',
    neurosurgery: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    neurology: 'bg-violet-50 text-violet-700 border-violet-200',
    neuropsychiatry: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    general_surgery: 'bg-slate-50 text-slate-700 border-slate-200',
    surgery: 'bg-slate-50 text-slate-700 border-slate-200',
    gynaecology: 'bg-rose-50 text-rose-700 border-rose-200',
    oral_maxillofacial: 'bg-amber-50 text-amber-800 border-amber-200',
    pulmonology: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    endocrinology: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    plastic_surgery: 'bg-pink-50 text-pink-600 border-pink-200',
    nutrition: 'bg-lime-50 text-lime-700 border-lime-200',
    ent: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  };

  const labels: Record<string, string> = {
    dental: '🦷 Dental',
    ophthalmology: '👁️ Ophthalmology',
    physiotherapy: '💪 Physiotherapy',
    cardiology: '❤️ Cardiology',
    orthopaedics: '🦴 Orthopaedics',
    dermatology: '🩹 Dermatology',
    urology: '🔬 Urology',
    gastroenterology: '🔬 Gastroenterology',
    nephrology: '🫘 Nephrology',
    paediatrics: '👶 Paediatrics',
    neurosurgery: '🧠 Neurosurgery',
    neurology: '🧠 Neurology',
    neuropsychiatry: '🧠 Neuropsychiatry',
    general_surgery: '🔪 General Surgery',
    surgery: '🔪 Surgery',
    gynaecology: '🩺 Gynaecology',
    oral_maxillofacial: '😁 Oral & Maxillofacial',
    pulmonology: '🫁 Pulmonology',
    endocrinology: '🔬 Endocrinology',
    plastic_surgery: '✨ Plastic Surgery',
    nutrition: '🥗 Nutrition',
    ent: '👂 ENT',
  };

  const key = specialty.toLowerCase();
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[key] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
    >
      {labels[key] || specialty}
    </span>
  );
}

/** Shows a Follow-Up pill for Follow-Up bookings; falls back to SpecialtyBadge for referrals. */
function ReferralTypeBadge({
  referral,
}: {
  referral: { request_type?: string; specialty_module?: string | null };
}) {
  if (referral.request_type === 'Follow-Up') {
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded border bg-purple-50 text-purple-700 border-purple-200">
        🔄 Follow-Up
      </span>
    );
  }
  return <SpecialtyBadge specialty={referral.specialty_module ?? null} />;
}

function NhisBadge({
  insuranceType,
  nhisApprovalStatus,
}: {
  insuranceType: string | null;
  nhisApprovalStatus: string | null;
}) {
  if (!isNhisFeatureEnabled()) return null;
  const isNhis = insuranceType?.toLowerCase().includes('nhis');
  if (!isNhis) return null;

  const statusStyles: Record<string, string> = {
    pending: 'bg-orange-100 text-orange-800 border-orange-300',
    approved: 'bg-green-100 text-green-800 border-green-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
    not_required: 'bg-gray-100 text-gray-600 border-gray-300',
  };

  const statusLabels: Record<string, string> = {
    pending: 'NHIS Pending',
    approved: 'NHIS Approved',
    rejected: 'NHIS Rejected',
    not_required: 'NHIS N/A',
  };

  const status = nhisApprovalStatus?.toLowerCase() || 'pending';
  return (
    <span
      className={`px-2 py-0.5 text-xs font-bold rounded border ${statusStyles[status] || statusStyles.pending}`}
    >
      {statusLabels[status] || `NHIS: ${nhisApprovalStatus}`}
    </span>
  );
}

// =============================================================================
// Stats Cards with Specialty Breakdown
// =============================================================================

const SPECIALTY_LABELS: Record<string, { emoji: string; label: string }> = {
  dental: { emoji: '🦷', label: 'Dental' },
  ophthalmology: { emoji: '👁️', label: 'Ophthalmology' },
  physiotherapy: { emoji: '💪', label: 'Physiotherapy' },
  cardiology: { emoji: '❤️', label: 'Cardiology' },
  orthopaedics: { emoji: '🦴', label: 'Orthopaedics' },
  dermatology: { emoji: '🩹', label: 'Dermatology' },
  urology: { emoji: '🔬', label: 'Urology' },
  gastroenterology: { emoji: '🔬', label: 'Gastroenterology' },
  nephrology: { emoji: '🫘', label: 'Nephrology' },
  paediatrics: { emoji: '👶', label: 'Paediatrics' },
  neurosurgery: { emoji: '🧠', label: 'Neurosurgery' },
  neurology: { emoji: '🧠', label: 'Neurology' },
  neuropsychiatry: { emoji: '🧠', label: 'Neuropsychiatry' },
  general_surgery: { emoji: '🔪', label: 'General Surgery' },
  surgery: { emoji: '🔪', label: 'Surgery' },
  gynaecology: { emoji: '🩺', label: 'Gynaecology' },
  oral_maxillofacial: { emoji: '😁', label: 'Oral & Maxillofacial' },
  pulmonology: { emoji: '🫁', label: 'Pulmonology' },
  endocrinology: { emoji: '🔬', label: 'Endocrinology' },
  plastic_surgery: { emoji: '✨', label: 'Plastic Surgery' },
  nutrition: { emoji: '🥗', label: 'Nutrition' },
  ent: { emoji: '👂', label: 'ENT' },
};

// =============================================================================
// Stats Cards — Dynamic (computed from filtered referrals)
// =============================================================================

interface ReferralStatsCardsProps {
  referrals: PendingReferral[];
  isLoading: boolean;
  departmentLabel?: string;
}

function ReferralStatsCards({
  referrals,
  isLoading,
  departmentLabel,
}: ReferralStatsCardsProps) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const stats = useMemo(() => {
    const pending = referrals.filter(
      (r) =>
        r.referral_workflow_status === 'Pending_Encounter_Office' ||
        !r.referral_workflow_status,
    ).length;
    const booked = referrals.filter(
      (r) => r.referral_workflow_status === 'Appointment_Booked',
    ).length;
    const todayAppts = referrals.filter(
      (r) => r.appointment_date && r.appointment_date.split('T')[0] === today,
    ).length;
    const urgent = referrals.filter(
      (r) => r.urgency === 'Urgent' || r.urgency === 'Emergency',
    ).length;

    return { pending, booked, todayAppts, urgent, total: referrals.length };
  }, [referrals, today]);

  if (isLoading) {
    return (
      <div className="mb-4 grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white p-3.5 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Pending Review', value: stats.pending, lightColor: 'bg-amber-50', textColor: 'text-amber-700', icon: Clock },
    { label: 'Booked', value: stats.booked, lightColor: 'bg-blue-50', textColor: 'text-blue-700', icon: CalendarCheck },
    { label: "Today's Appts", value: stats.todayAppts, lightColor: 'bg-green-50', textColor: 'text-green-700', icon: Calendar },
    { label: 'Urgent / Emergency', value: stats.urgent, lightColor: 'bg-red-50', textColor: 'text-red-700', icon: AlertTriangle },
  ];

  return (
    <div className="mb-4 grid grid-cols-4 gap-3">
      {cards.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-gray-100 bg-white p-3.5 transition-all hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.lightColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.textColor}`} />
            </div>
            <div>
              <div className={`text-xl font-bold ${stat.textColor}`}>{stat.value}</div>
              <div className="text-[11px] font-medium text-gray-400">{stat.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Referral Card
// =============================================================================

interface ReferralCardProps {
  referral: PendingReferral;
  onSelect: () => void;
  onBookAppointment: () => void;
  onCreateEncounter: () => void;
  isSelected: boolean;
}

function ReferralCard({
  referral,
  onSelect,
  onBookAppointment,
  onCreateEncounter,
  isSelected,
}: ReferralCardProps) {
  const patientName = [
    referral.patient_rank,
    referral.patient_first_name,
    referral.patient_middle_name,
    referral.patient_surname,
  ]
    .filter(Boolean)
    .join(' ');

  const referringDoctor = [
    referral.referring_doctor_first_name,
    referral.referring_doctor_last_name,
  ]
    .filter(Boolean)
    .join(' ');

  const isPending =
    referral.referral_workflow_status === 'Pending_Encounter_Office';
  const isAppointmentBooked =
    referral.referral_workflow_status === 'Appointment_Booked';
  const isExplicitlyMissed = referral.referral_workflow_status === 'Missed';
  const isPastAppointment =
    referral.appointment_date &&
    new Date(referral.appointment_date) <
      new Date(new Date().setHours(0, 0, 0, 0));
  // Treat booked appointments with past dates as effectively missed
  const isMissed = isExplicitlyMissed || (isAppointmentBooked && isPastAppointment);
  const isScheduledForToday =
    !referral.appointment_date ||
    new Date().toISOString().split('T')[0] ===
      referral.appointment_date.split('T')[0];

  return (
    <div
      className={`bg-white rounded-lg border-2 p-4 transition-all cursor-pointer hover:shadow-md ${
        isSelected ? 'border-primary-700 shadow-md' : 'border-gray-200'
      } ${
        referral.urgency === 'Emergency'
          ? 'border-l-4 border-l-red-500'
          : referral.urgency === 'Urgent'
            ? 'border-l-4 border-l-orange-500'
            : isMissed
              ? 'border-l-4 border-l-red-500 bg-red-50/30'
              : ''
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary-700/10 flex items-center justify-center">
            <User size={20} className="text-primary-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{patientName}</h3>
            <p className="text-xs text-gray-500">{referral.emr_number}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <UrgencyBadge urgency={referral.urgency} />
          <StatusBadge status={referral.referral_workflow_status} />
          <NhisBadge
            insuranceType={referral.insurance_type}
            nhisApprovalStatus={referral.nhis_approval_status}
          />
        </div>
      </div>

      {/* Referral Info */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <Send size={14} className="text-gray-400" />
          <span className="text-gray-600">
            {referral.request_type === 'Follow-Up'
              ? 'Returning to:'
              : 'Referred to:'}
          </span>
          <ReferralTypeBadge referral={referral} />
          {referral.request_type === 'Follow-Up'
            ? referral.source_clinic_name && (
                <span className="text-gray-700 font-medium">
                  {referral.source_clinic_name}
                </span>
              )
            : referral.target_department_name && (
                <span className="text-gray-700 font-medium">
                  {referral.target_department_name}
                </span>
              )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Stethoscope size={14} className="text-gray-400" />
          <span className="text-gray-600">By:</span>
          <span className="text-gray-700">{referringDoctor || 'Unknown'}</span>
          {referral.source_clinic_name && (
            <span className="text-gray-500">
              ({referral.source_clinic_name})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-gray-600">Referred:</span>
          <span className="text-gray-700">
            {format(parseISO(referral.referral_date), 'dd MMM yyyy')}
          </span>
          <span className="text-gray-400">
            (
            {formatDistanceToNow(parseISO(referral.referral_date), {
              addSuffix: true,
            })}
            )
          </span>
        </div>

        {referral.appointment_date && (
          <div
            className={`flex items-center gap-2 text-sm p-2 rounded ${isMissed ? 'bg-red-50' : 'bg-blue-50'}`}
          >
            {isMissed ? (
              <CalendarX size={14} className="text-red-600" />
            ) : (
              <CalendarPlus size={14} className="text-blue-600" />
            )}
            <span
              className={`${isMissed ? 'text-red-800' : 'text-blue-800'} font-medium`}
            >
              {isMissed ? 'Missed: ' : 'Appointment: '}
              {format(parseISO(referral.appointment_date), 'dd MMM yyyy')}
              {referral.appointment_time && ` at ${referral.appointment_time}`}
            </span>
          </div>
        )}
      </div>

      {/* Reason Preview */}
      {referral.referral_reason && (
        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-3 line-clamp-2">
          <span className="font-medium text-gray-700">Reason:</span>{' '}
          {referral.referral_reason}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="flex-1"
        >
          <Eye size={14} className="mr-1" />
          View Details
        </Button>

        {(isPending || isMissed) && (
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onBookAppointment();
            }}
            className={`flex-1 ${isMissed ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <CalendarPlus size={14} className="mr-1" />
            {isMissed ? 'Reschedule' : 'Book Appointment'}
          </Button>
        )}

        {isAppointmentBooked && !isPastAppointment && (
          <div className="flex-1 flex flex-col gap-1">
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCreateEncounter();
              }}
              disabled={!isScheduledForToday}
              className="w-full bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} className="mr-1" />
              Create Encounter
            </Button>
            {!isScheduledForToday && referral.appointment_date && (
              <div className="flex justify-between items-center">
                <p className="text-xs text-amber-600">
                  Scheduled:{' '}
                  {format(parseISO(referral.appointment_date), 'dd MMM yyyy')}
                </p>
                {/* Allow rescheduling if appointment is in the past or future but not created yet */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookAppointment();
                  }}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Reschedule
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Book Appointment Modal (supports existing referrals AND general patients)
// =============================================================================

interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  referral?: PendingReferral | null;
  onBooked: () => void;
  existingReferrals?: PendingReferral[];
}

function BookAppointmentModal({
  isOpen,
  onClose,
  referral: initialReferral,
  onBooked,
}: BookAppointmentModalProps) {
  // The selected patient (either from search or pre-loaded from initialReferral)
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  // Existing referral linked to that patient (if any)
  const [selectedReferral, setSelectedReferral] =
    useState<PendingReferral | null>(initialReferral || null);
  // List of that patient's pending referrals from DB
  const [patientReferrals, setPatientReferrals] = useState<PendingReferral[]>(
    [],
  );
  // Booking fields
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [notes, setNotes] = useState('');
  // Direct booking (no existing referral) fields
  const [directDepartmentId, setDirectDepartmentId] = useState('');
  const [directUrgency, setDirectUrgency] =
    useState<ReferralUrgency>('Routine');
  const [directReason, setDirectReason] = useState('');
  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Patient search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { staff } = useAuth();
  const bookMutation = useBookReferralAppointment();
  const queryClient = useQueryClient();

  // When modal opens with a pre-selected referral, set patient info from it
  useEffect(() => {
    if (initialReferral) {
      setSelectedReferral(initialReferral);
      setSelectedPatient({
        id: initialReferral.patient_id,
        first_name: initialReferral.patient_first_name,
        surname: initialReferral.patient_surname,
        emr_number: initialReferral.emr_number,
      });
    }
  }, [initialReferral]);

  // Fetch departments once for direct booking dropdown
  useEffect(() => {
    if (isOpen && departments.length === 0) {
      supabase
        .from('departments')
        .select('id, name')
        .eq('status', 'Active')
        .order('name')
        .then(({ data }) => {
          if (data) setDepartments(data);
        });
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (!initialReferral) {
        setSelectedPatient(null);
        setSelectedReferral(null);
        setPatientReferrals([]);
      }
      setAppointmentDate('');
      setAppointmentTime('');
      setNotes('');
      setDirectDepartmentId('');
      setDirectUrgency('Routine');
      setDirectReason('');
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, initialReferral]);

  // Patient search
  useEffect(() => {
    if (!debouncedSearch || selectedPatient) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    supabase
      .from('patients')
      .select('id, first_name, surname, emr_number, patient_category, gender')
      .or(
        `first_name.ilike.%${debouncedSearch}%,surname.ilike.%${debouncedSearch}%,emr_number.ilike.%${debouncedSearch}%`,
      )
      .limit(8)
      .then(({ data }) => {
        setSearchResults(data || []);
        setIsSearching(false);
      });
  }, [debouncedSearch, selectedPatient]);

  // When a patient is picked, look up their pending referrals from DB
  const handlePatientSelect = async (patient: any) => {
    setSelectedPatient(patient);
    setSearchQuery('');
    setSearchResults([]);

    // Fetch this patient's pending / booked referrals
    const { data } = await supabase
      .from('clinical_requests')
      .select(
        `
        id, request_number, created_at, urgency, specialty_module,
        referral_workflow_status, appointment_date, appointment_time,
        clinical_reason,
        target_department:departments!target_department_id(id, name, code),
        requesting_doctor:staff!requesting_doctor_id(first_name, last_name),
        patient:patients!patient_id(id, emr_number, first_name, surname)
      `,
      )
      .eq('patient_id', patient.id)
      .in('request_type', ['Referral', 'Follow-Up'])
      .not('status', 'in', '("Cancelled","Rejected")')
      .or(
        'referral_workflow_status.in.(Pending_Encounter_Office,Appointment_Booked),referral_workflow_status.is.null',
      )
      .order('created_at', { ascending: false })
      .limit(10);

    const mapped: PendingReferral[] = (data || []).map(
      (r: any) =>
        ({
          referral_id: r.id,
          referral_number: r.request_number,
          referral_date: r.created_at,
          request_type: 'Referral' as const,
          urgency: r.urgency,
          specialty_module: r.specialty_module,
          referral_workflow_status:
            r.referral_workflow_status || 'Pending_Encounter_Office',
          appointment_date: r.appointment_date,
          appointment_time: r.appointment_time,
          referral_reason: r.clinical_reason,
          patient_id: patient.id,
          emr_number: patient.emr_number,
          patient_first_name: patient.first_name,
          patient_surname: patient.surname,
          target_department_id: r.target_department?.id,
          target_department_name: r.target_department?.name,
          referring_doctor_first_name: r.requesting_doctor?.first_name,
          referring_doctor_last_name: r.requesting_doctor?.last_name,
        }) as PendingReferral,
    );

    setPatientReferrals(mapped);
    // Auto-select if exactly one referral
    if (mapped.length === 1) setSelectedReferral(mapped[0]);
    else setSelectedReferral(null);
  };

  const isDirectBooking =
    selectedPatient && !selectedReferral && patientReferrals.length === 0;
  const canSubmit =
    selectedPatient &&
    appointmentDate &&
    (selectedReferral || (isDirectBooking && directDepartmentId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      if (selectedReferral) {
        // Book against existing referral
        await bookMutation.mutateAsync({
          referralId: selectedReferral.referral_id,
          appointmentDate,
          appointmentTime: appointmentTime || null,
          notes: notes || null,
          bookedBy: staff?.id,
        });
      } else {
        // Direct booking: encounter_id is NOT NULL on clinical_requests, so we
        // first create a lightweight placeholder visit (status='Created'), then
        // use its UUID as encounter_id. The placeholder is upgraded to a full
        // encounter when the patient physically arrives and is checked in.
        const bookingRef = `BOOKING-${Date.now().toString(36).toUpperCase()}`;
        const { data: visitData, error: visitError } = await supabase
          .from('visits')
          .insert({
            visit_id: bookingRef,
            patient_id: selectedPatient.id,
            visit_type: 'Direct Appointment',
            status: 'Created',
            start_time: appointmentDate
              ? new Date(
                  `${appointmentDate}T${appointmentTime || '08:00'}`,
                ).toISOString()
              : new Date().toISOString(),
            encounter_date:
              appointmentDate || new Date().toISOString().split('T')[0],
            payer_type: 'private',
            registered_by: staff?.id || null,
          })
          .select('id')
          .single();
        if (visitError)
          throw new Error(`Booking failed (visit): ${visitError.message}`);

        const { error } = await supabaseAdmin.from('clinical_requests').insert({
          patient_id: selectedPatient.id,
          encounter_id: visitData.id,
          request_type: 'Referral',
          urgency: directUrgency,
          clinical_reason: directReason || 'Direct appointment booking',
          notes: notes || null,
          target_department_id: directDepartmentId || null,
          status: 'Approved',
          referral_workflow_status: 'Appointment_Booked',
          appointment_date: appointmentDate,
          appointment_time: appointmentTime || null,
          requesting_doctor_id: staff?.id || null,
          appointment_booked_by: staff?.id || null,
          appointment_booked_at: new Date().toISOString(),
          created_by: staff?.id || null,
        });
        if (error) throw new Error(`Booking failed: ${error.message}`);
        queryClient.invalidateQueries({ queryKey: internalReferralKeys.all });
      }

      onBooked();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to book appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Book Appointment"
      size="md"
      className="animate-fade-in-scale"
    >
      <div className="space-y-4">
        {/* ── Patient search (only when no patient pre-selected) ── */}
        {!selectedPatient && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Patient <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or patient number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-700 focus:border-transparent"
              />
            </div>
            {isSearching && (
              <p className="text-xs text-gray-400 mt-1">Searching...</p>
            )}
            {searchResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handlePatientSelect(p)}
                    className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                  >
                    <p className="font-medium text-sm text-gray-900">
                      {p.first_name} {p.surname}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.emr_number} · {p.gender}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Selected patient card ── */}
        {selectedPatient && (
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-700/10 flex items-center justify-center shrink-0">
                <User size={16} className="text-primary-700" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  {selectedPatient.first_name} {selectedPatient.surname}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedPatient.emr_number}
                </p>
              </div>
            </div>
            {!initialReferral && (
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setSelectedReferral(null);
                  setPatientReferrals([]);
                }}
                className="text-xs text-primary-700 hover:underline"
              >
                Change
              </button>
            )}
          </div>
        )}

        {/* ── Referral selector (when patient has multiple pending referrals) ── */}
        {selectedPatient && patientReferrals.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link to Referral <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {patientReferrals.map((r) => (
                <div
                  key={r.referral_id}
                  onClick={() => setSelectedReferral(r)}
                  className={`px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                    selectedReferral?.referral_id === r.referral_id
                      ? 'border-primary-700 bg-primary-700/5 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium">
                    {r.target_department_name ||
                      r.specialty_module ||
                      'General'}
                  </span>
                  <span className="text-gray-400 ml-2 text-xs">
                    #{r.referral_number}
                  </span>
                  <span
                    className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${r.urgency === 'Emergency' ? 'bg-red-100 text-red-700' : r.urgency === 'Urgent' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {r.urgency}
                  </span>
                </div>
              ))}
              <div
                onClick={() => setSelectedReferral(null)}
                className={`px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                  !selectedReferral
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-dashed border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-600'
                }`}
              >
                + Book as new direct appointment instead
              </div>
            </div>
          </div>
        )}

        {/* ── Direct booking fields (no existing referral) ── */}
        {selectedPatient && !selectedReferral && (
          <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
              <CalendarPlus size={13} />
              {patientReferrals.length === 0
                ? 'No pending referral — booking directly for this patient'
                : 'Creating a new direct appointment'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Department / Clinic <span className="text-red-500">*</span>
                </label>
                <select
                  value={directDepartmentId}
                  onChange={(e) => setDirectDepartmentId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-700 focus:border-transparent"
                >
                  <option value="">Select department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Urgency
                </label>
                <select
                  value={directUrgency}
                  onChange={(e) =>
                    setDirectUrgency(e.target.value as ReferralUrgency)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-700"
                >
                  <option value="Routine">Routine</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={directReason}
                  onChange={(e) => setDirectReason(e.target.value)}
                  placeholder="Brief reason..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-700"
                />
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appointment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                disabled={!selectedPatient}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-700 focus:border-transparent disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appointment Time
              </label>
              <input
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                disabled={!selectedPatient}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-700 focus:border-transparent disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={!selectedPatient}
              placeholder="Any notes about the appointment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-700 focus:border-transparent disabled:opacity-50"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit || isSubmitting || bookMutation.isPending}
            >
              {isSubmitting || bookMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <CalendarPlus size={16} className="mr-2" />
                  Book Appointment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// =============================================================================
// Referral Detail Panel
// =============================================================================

interface ReferralDetailPanelProps {
  referral: PendingReferral;
  onClose: () => void;
  onBookAppointment: () => void;
  onCreateEncounter: () => void;
  onCancel: () => void;
}

function ReferralDetailPanel({
  referral,
  onClose,
  onBookAppointment,
  onCreateEncounter,
  onCancel,
}: ReferralDetailPanelProps) {
  const patientName = [
    referral.patient_rank,
    referral.patient_first_name,
    referral.patient_middle_name,
    referral.patient_surname,
  ]
    .filter(Boolean)
    .join(' ');

  const referringDoctor = [
    referral.referring_doctor_first_name,
    referral.referring_doctor_last_name,
  ]
    .filter(Boolean)
    .join(' ');

  const isPending =
    referral.referral_workflow_status === 'Pending_Encounter_Office';
  const isAppointmentBooked =
    referral.referral_workflow_status === 'Appointment_Booked';
  const isScheduledForToday =
    !referral.appointment_date ||
    new Date().toISOString().split('T')[0] ===
      referral.appointment_date.split('T')[0];

  return (
    <div className="bg-white rounded-lg border shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-primary-700 text-white px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold">Referral Details</h3>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
          <XCircle size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* Patient Information */}
        <div className="bg-gray-50 rounded-lg p-4 border">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <User size={16} />
            Patient Information
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium text-gray-900">{patientName}</p>
            </div>
            <div>
              <p className="text-gray-500">Patient number</p>
              <p className="font-medium text-gray-900">{referral.emr_number}</p>
            </div>
            <div>
              <p className="text-gray-500">Gender</p>
              <p className="font-medium text-gray-900">
                {referral.gender || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium text-gray-900">
                {referral.patient_phone || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Category</p>
              <p className="font-medium text-gray-900">
                {referral.patient_category || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Insurance</p>
              <p className="font-medium text-gray-900">
                {!isNhisFeatureEnabled() &&
                isNhisCategory(referral.insurance_type)
                  ? 'Private'
                  : referral.insurance_type || 'N/A'}
              </p>
            </div>
            {isNhisFeatureEnabled() &&
              referral.insurance_type?.toLowerCase().includes('nhis') && (
              <div className="col-span-2">
                <p className="text-gray-500">NHIS Verification</p>
                <div className="mt-1">
                  <NhisBadge
                    insuranceType={referral.insurance_type}
                    nhisApprovalStatus={referral.nhis_approval_status}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Referral Information */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Send size={16} />
            Referral Information
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Referral Number</span>
              <span className="font-mono font-medium text-blue-900">
                {referral.referral_number}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Status</span>
              <StatusBadge status={referral.referral_workflow_status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Urgency</span>
              <UrgencyBadge urgency={referral.urgency} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">
                {referral.request_type === 'Follow-Up' ? 'Type' : 'Specialty'}
              </span>
              <ReferralTypeBadge referral={referral} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">
                {referral.request_type === 'Follow-Up'
                  ? 'Returning To'
                  : 'Target Department'}
              </span>
              <span className="font-medium text-blue-900">
                {referral.request_type === 'Follow-Up'
                  ? referral.source_clinic_name || 'Same Clinic'
                  : referral.target_department_name || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-700">Date Referred</span>
              <span className="font-medium text-blue-900">
                {format(parseISO(referral.referral_date), 'dd MMM yyyy HH:mm')}
              </span>
            </div>
          </div>
        </div>

        {/* Referring Doctor */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
            <Stethoscope size={16} />
            Referring Doctor
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-green-700">Doctor</span>
              <span className="font-medium text-green-900">
                {referringDoctor || 'Unknown'}
              </span>
            </div>
            {referral.referring_doctor_specialty && (
              <div className="flex items-center justify-between">
                <span className="text-green-700">Specialty</span>
                <span className="font-medium text-green-900">
                  {referral.referring_doctor_specialty}
                </span>
              </div>
            )}
            {referral.source_department_name && (
              <div className="flex items-center justify-between">
                <span className="text-green-700">Department</span>
                <span className="font-medium text-green-900">
                  {referral.source_department_name}
                </span>
              </div>
            )}
            {referral.source_clinic_name && (
              <div className="flex items-center justify-between">
                <span className="text-green-700">Clinic</span>
                <span className="font-medium text-green-900">
                  {referral.source_clinic_name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Referral Reason */}
        {referral.referral_reason && (
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Reason for Referral
            </h4>
            <p className="text-sm text-yellow-800 whitespace-pre-wrap">
              {referral.referral_reason}
            </p>
          </div>
        )}

        {/* Referral Notes */}
        {referral.referral_notes && (
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h4 className="font-semibold text-gray-900 mb-2">
              Additional Notes
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {referral.referral_notes}
            </p>
          </div>
        )}

        {/* Original Encounter Info */}
        {referral.original_encounter_number && (
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <Stethoscope size={16} />
              Original Consultation
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-purple-700">Encounter Number</span>
                <span className="font-mono font-medium text-purple-900">
                  {referral.original_encounter_number}
                </span>
              </div>
              {referral.original_encounter_date && (
                <div className="flex items-center justify-between">
                  <span className="text-purple-700">Date</span>
                  <span className="font-medium text-purple-900">
                    {format(
                      parseISO(referral.original_encounter_date),
                      'dd MMM yyyy',
                    )}
                  </span>
                </div>
              )}
              {referral.original_chief_complaint && (
                <div className="mt-2">
                  <p className="text-purple-700 mb-1">Chief Complaint</p>
                  <p className="text-purple-900">
                    {referral.original_chief_complaint}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Appointment Info (if booked) */}
        {referral.appointment_date && (
          <div className="bg-blue-100 rounded-lg p-4 border border-blue-300">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Calendar size={16} />
              Scheduled Appointment
            </h4>
            <div className="space-y-1 text-sm">
              <p className="text-blue-800">
                <span className="font-medium">Date:</span>{' '}
                {format(
                  parseISO(referral.appointment_date),
                  'EEEE, dd MMMM yyyy',
                )}
              </p>
              {referral.appointment_time && (
                <p className="text-blue-800">
                  <span className="font-medium">Time:</span>{' '}
                  {referral.appointment_time}
                </p>
              )}
              {referral.booked_by_first_name && (
                <p className="text-blue-700 text-xs mt-2">
                  Booked by {referral.booked_by_first_name}{' '}
                  {referral.booked_by_last_name}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 bg-gray-50 border-t flex gap-2">
        {isPending && (
          <>
            <Button
              variant="primary"
              onClick={onBookAppointment}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <CalendarPlus size={16} className="mr-2" />
              Book Appointment
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <XCircle size={16} className="mr-2" />
              Cancel
            </Button>
          </>
        )}

        {isAppointmentBooked && (
          <div className="flex-1 flex flex-col gap-1">
            <Button
              variant="primary"
              onClick={onCreateEncounter}
              disabled={!isScheduledForToday}
              className="w-full bg-primary-700 hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} className="mr-2" />
              Create Encounter
            </Button>
            {!isScheduledForToday && referral.appointment_date && (
              <p className="text-xs text-center text-amber-600">
                Encounter can only be created on{' '}
                {format(
                  parseISO(referral.appointment_date),
                  'EEEE, dd MMM yyyy',
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component (Updated Table View)
// =============================================================================

export function InternalReferralQueue({
  onEncounterCreated,
}: InternalReferralQueueProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('queue');
  const [selectedReferral, setSelectedReferral] =
    useState<PendingReferral | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // departmentFilter values: 'all' | 'sm:{specialty_module}' | 'dn:{target_department_name}'
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Modal States
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isEncounterFormOpen, setIsEncounterFormOpen] = useState(false);
  const [patientForEncounter, setPatientForEncounter] = useState<any>(null);
  const [referralForEncounter, setReferralForEncounter] =
    useState<PendingReferral | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Only filter by status at API level — keeps all dept/search filtering client-side
  const apiFilters: ReferralFilters = useMemo(
    () => ({
      workflowStatus:
        statusFilter !== 'all'
          ? (statusFilter as ReferralWorkflowStatus)
          : undefined,
    }),
    [statusFilter],
  );

  const {
    data: allReferrals = [],
    isLoading,
    refetch,
  } = usePendingReferrals(apiFilters);

  // Build department dropdown options dynamically from actual referral data
  const departmentOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    allReferrals.forEach((r) => {
      // Specialty clinic entries (use specialty_module as key)
      if (r.specialty_module) {
        const key = `sm:${r.specialty_module}`;
        if (!seen.has(key)) {
          seen.add(key);
          const config = SPECIALTY_LABELS[r.specialty_module.toLowerCase()];
          options.push({
            value: key,
            label: config
              ? `${config.emoji} ${config.label}`
              : r.specialty_module,
          });
        }
      }
      // Non-specialty department entries (use target_department_name as key)
      if (!r.specialty_module && r.target_department_name) {
        const key = `dn:${r.target_department_name}`;
        if (!seen.has(key)) {
          seen.add(key);
          options.push({ value: key, label: `🏥 ${r.target_department_name}` });
        }
      }
    });

    // Sort: specialties first, then departments, both alphabetically
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [allReferrals]);

  // Client-side filtering by dept + search
  const referrals = useMemo(() => {
    // Client-side safety: exclude bookings that already have an encounter created
    // (server query filters by referral_workflow_status, but this catches edge cases
    // where stale cache data still includes a record whose status was just updated)
    let filtered = allReferrals.filter((r) => !r.referral_encounter_id);

    if (departmentFilter !== 'all') {
      if (departmentFilter.startsWith('sm:')) {
        const module = departmentFilter.slice(3);
        filtered = filtered.filter((r) => r.specialty_module === module);
      } else if (departmentFilter.startsWith('dn:')) {
        const deptName = departmentFilter.slice(3);
        filtered = filtered.filter(
          (r) => r.target_department_name === deptName,
        );
      }
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter((r) => {
        const fullName =
          `${r.patient_first_name || ''} ${r.patient_surname || ''}`.toLowerCase();
        const emr = (r.emr_number || '').toLowerCase();
        return fullName.includes(q) || emr.includes(q);
      });
    }

    return filtered;
  }, [allReferrals, departmentFilter, debouncedSearch]);

  // Label for stats card header
  const selectedDeptName = useMemo(() => {
    if (departmentFilter === 'all') return 'All Departments';
    const opt = departmentOptions.find((o) => o.value === departmentFilter);
    return opt?.label || 'Selected Department';
  }, [departmentFilter, departmentOptions]);
  const cancelMutation = useCancelReferral();

  const handleSelectReferral = (referral: PendingReferral) => {
    setSelectedReferral(referral);
    setViewMode('detail');
  };

  const handleBookAppointment = (referral?: PendingReferral) => {
    if (referral) setSelectedReferral(referral);
    setIsBookModalOpen(true);
  };

  const handleCreateEncounter = (referral: PendingReferral) => {
    setReferralForEncounter(referral);
    setPatientForEncounter({
      id: referral.patient_id,
      patient_id: referral.emr_number,
      first_name: referral.patient_first_name,
      last_name: referral.patient_surname,
      emr_number: referral.emr_number,
      date_of_birth: referral.date_of_birth || undefined,
      phone: referral.patient_phone || undefined,
      patient_category: referral.patient_category || undefined,
      insurance_type: referral.insurance_type || undefined,
    });
    setIsEncounterFormOpen(true);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Appointment Bookings
          </h2>
          <p className="text-xs text-gray-400">
            Manage referrals &amp; book appointments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide((p) => !p)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              showGuide
                ? 'border-primary-700 bg-primary-700/5 text-primary-700'
                : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <HelpCircle size={14} />
            {showGuide ? 'Hide Guide' : 'How it works'}
          </button>
          <button
            onClick={() => {
              setSelectedReferral(null);
              setIsBookModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-primary-800 transition-colors"
          >
            <CalendarPlus size={14} />
            Book Appointment
          </button>
        </div>
      </div>

      {/* User Guide */}
      {showGuide && (
        <div className="rounded-xl border border-primary-700/20 bg-primary-700/5 p-4 relative">
          <button
            onClick={() => setShowGuide(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-primary-700" />
            <h3 className="text-sm font-semibold text-gray-900">Quick Guide — How Booking Works</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white text-[10px] font-bold">1</div>
              <div>
                <p className="text-xs font-semibold text-gray-800">Doctor Refers Patient</p>
                <p className="text-[11px] text-gray-500 mt-0.5">A doctor creates an internal referral to a specialty clinic during consultation. It appears here as <span className="font-medium text-amber-600">Pending Review</span>.</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white text-[10px] font-bold">2</div>
              <div>
                <p className="text-xs font-semibold text-gray-800">Book an Appointment</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Click a referral, then <span className="font-medium text-blue-600">Book Appointment</span> to assign a date &amp; time. Or use the button above to book directly.</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white text-[10px] font-bold">3</div>
              <div>
                <p className="text-xs font-semibold text-gray-800">Patient Arrives &amp; Pays</p>
                <p className="text-[11px] text-gray-500 mt-0.5">When the patient comes in, click <span className="font-medium text-green-600">Create Encounter</span> to start their specialty visit and initiate billing.</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white text-[10px] font-bold">4</div>
              <div>
                <p className="text-xs font-semibold text-gray-800">Track &amp; Filter</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Use the status and specialty filters to find referrals. Click any row to see full details, reschedule, or cancel.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReferralStatsCards
        referrals={referrals}
        isLoading={isLoading}
        departmentLabel={selectedDeptName}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by patient name or patient number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-primary-700 focus:ring-1 focus:ring-primary-700/20 transition-colors placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700/20"
        >
          <option value="all">All Status</option>
          <option value="Pending_Encounter_Office">Pending Review</option>
          <option value="Appointment_Booked">Appointment Booked</option>
        </select>

        {/* Department / Specialty Filter */}
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700/20 max-w-[220px]"
        >
          <option value="all">All Specialties</option>
          {departmentOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
        </button>

        {/* Active filter chips */}
        {(statusFilter !== 'all' || departmentFilter !== 'all' || debouncedSearch) && (
          <div className="flex items-center gap-1.5 ml-1">
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-700/10 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                {statusFilter === 'Pending_Encounter_Office' ? 'Pending' : 'Booked'}
                <button onClick={() => setStatusFilter('all')}><XCircle size={12} /></button>
              </span>
            )}
            {departmentFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                {selectedDeptName}
                <button onClick={() => setDepartmentFilter('all')}><XCircle size={12} /></button>
              </span>
            )}
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                &ldquo;{debouncedSearch}&rdquo;
                <button onClick={() => setSearchQuery('')}><XCircle size={12} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Main List */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/50">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl bg-white border border-gray-100 p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                      <div className="h-2.5 bg-gray-200 rounded w-1/4" />
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 mb-4">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">No referrals found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or book a new appointment</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {referrals.map((referral) => {
                const isSelected = selectedReferral?.referral_id === referral.referral_id;
                const patientName = [referral.patient_first_name, referral.patient_surname].filter(Boolean).join(' ');
                const initials = [referral.patient_first_name?.[0], referral.patient_surname?.[0]].filter(Boolean).join('').toUpperCase();
                const referringDoc = [referral.referring_doctor_first_name, referral.referring_doctor_last_name].filter(Boolean).join(' ');

                return (
                  <div
                    key={referral.referral_id}
                    onClick={() => handleSelectReferral(referral)}
                    className={`group rounded-xl border bg-white p-3.5 cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'border-primary-700 ring-1 ring-primary-700/20 shadow-sm' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Patient Avatar */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-700/10 text-xs font-bold text-primary-700">
                        {initials || '?'}
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900 truncate">{patientName}</span>
                          <span className="text-[11px] text-gray-400 font-mono">{referral.emr_number}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          {referral.referral_date && (
                            <span className="inline-flex items-center gap-1">
                              <Clock size={11} className="text-gray-400" />
                              {format(parseISO(referral.referral_date), 'dd MMM yyyy, HH:mm')}
                            </span>
                          )}
                          {referringDoc && (
                            <span className="inline-flex items-center gap-1">
                              <Stethoscope size={11} className="text-gray-400" />
                              Dr. {referringDoc}
                            </span>
                          )}
                          {referral.appointment_date && (
                            <span className="inline-flex items-center gap-1 text-blue-600">
                              <CalendarCheck size={11} />
                              Appt: {format(parseISO(referral.appointment_date), 'dd MMM, HH:mm')}
                            </span>
                          )}
                        </div>
                        {referral.referral_reason && (
                          <p className="text-[11px] text-gray-400 mt-1 truncate max-w-[500px]">
                            {referral.referral_reason}
                          </p>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <ReferralTypeBadge referral={referral} />
                        <StatusBadge status={referral.referral_workflow_status} />
                        <UrgencyBadge urgency={referral.urgency} />
                      </div>

                      {/* Action */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectReferral(referral);
                        }}
                        className="ml-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {viewMode === 'detail' && selectedReferral && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setViewMode('queue')}
          >
            <div
              className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl animate-fade-in-scale"
              onClick={(e) => e.stopPropagation()}
            >
              <ReferralDetailPanel
                referral={selectedReferral}
                onClose={() => setViewMode('queue')}
                onBookAppointment={() =>
                  handleBookAppointment(selectedReferral)
                }
                onCreateEncounter={() =>
                  handleCreateEncounter(selectedReferral)
                }
                onCancel={() => {}}
              />
            </div>
          </div>
        )}
      </div>

      <BookAppointmentModal
        isOpen={isBookModalOpen}
        onClose={() => {
          setIsBookModalOpen(false);
        }}
        referral={selectedReferral}
        existingReferrals={referrals}
        onBooked={() => {
          refetch();
          setViewMode('queue');
        }}
      />

      {/* Encounter Form Modal */}
      {isEncounterFormOpen && (
        <EncounterForm
          isOpen={isEncounterFormOpen}
          onClose={() => {
            setIsEncounterFormOpen(false);
            setReferralForEncounter(null);
            setPatientForEncounter(null);
          }}
          onSuccess={() => {
            setIsEncounterFormOpen(false);
            setReferralForEncounter(null);
            setPatientForEncounter(null);
            // Close detail panel and clear selected referral so stale data
            // (with old referral_workflow_status) doesn't show "Create Encounter" again
            setSelectedReferral(null);
            setViewMode('queue');
            refetch();
          }}
          preSelectedPatient={patientForEncounter || undefined}
          referralContext={
            referralForEncounter
              ? {
                  referralId: referralForEncounter.referral_id,
                  referringDoctorId:
                    referralForEncounter.referring_doctor_id || '',
                  referringDoctorName: [
                    referralForEncounter.referring_doctor_first_name,
                    referralForEncounter.referring_doctor_last_name,
                  ]
                    .filter(Boolean)
                    .join(' '),
                  referralReason: referralForEncounter.referral_reason || '',
                  specialtyModule: referralForEncounter.specialty_module || '',
                  sourceClinicName:
                    referralForEncounter.source_clinic_name || undefined,
                  isFollowUp: referralForEncounter.request_type === 'Follow-Up',
                  followUpNotes:
                    referralForEncounter.referral_notes ||
                    referralForEncounter.referral_reason ||
                    undefined,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

export default InternalReferralQueue;
