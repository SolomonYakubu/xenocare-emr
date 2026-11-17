/**
 * =============================================================================
 * XENOCARE EMR - ENHANCED PATIENT PROFILE MODAL
 * Professional patient profile with XenoCare branding and comprehensive audit trail
 * Displays all patient activities, NHIS records, and clinical history
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Shield,
  Activity,
  Clock,
  FileText,
  Heart,
  Stethoscope,
  FlaskConical,
  Scan,
  Pill,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  History,
  Edit3,
  UserCheck,
  Building2,
  IdCard,
  Clipboard,
  TrendingUp,
  Filter,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Radio,
  Scissors,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/FormElements';
import { Tabs } from '../ui/DataDisplay';
import { supabase } from '../../api/supabaseClient';
import type { PatientDTO } from '../../modules/patient-registration/dtos/patient.dto';
import type {
  NhisProfile,
  NhisProfileStatus,
  NhisPatientOrigin,
  NhisSchemeType,
  NhisTariffGroup,
} from '../../modules/nhis/types';
import { isNhisFeatureEnabled } from '../../config/features';

// =============================================================================
// Types
// =============================================================================

interface EnhancedPatientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientDTO;
  nhisProfile?: NhisProfile | null;
  showEdit?: boolean;
  onEdit?: () => void;
}

interface AuditLogEntry {
  id: string;
  performed_at: string;
  action_type: string;
  table_name: string;
  description: string;
  user_name: string;
  user_role: string;
  changed_fields: string[];
  is_critical: boolean;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  ip_address?: string;
}

interface NhisActivityEntry {
  id: string;
  performed_at: string;
  action_type: string;
  event_type: string;
  user_name: string;
  auth_code?: string;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  reason?: string;
}

interface PatientEncounter {
  id: string;
  encounter_number: string;
  encounter_date: string;
  status: string;
  current_stage: string;
  diagnosis?: string;
  doctor_name?: string;
  department?: string;
}

// =============================================================================
// XenoCare brand colors
// =============================================================================

const BRAND_COLORS = {
  primary: '#4f46e5', // Indigo-600
  secondary: '#4338ca', // Indigo-700
  accent: '#818cf8', // Indigo-400
  success: '#2563eb', // Blue-600
  warning: '#D96A36', // Orange-600
  danger: '#dc2626', // Red-600
  background: '#f8fafc', // Slate-50
  cardBg: '#ffffff',
  border: '#e2e8f0', // Slate-200
  textPrimary: '#1e293b', // Slate-800
  textSecondary: '#64748b', // Slate-500
  textMuted: '#94a3b8', // Slate-400
};

// =============================================================================
// API Functions
// =============================================================================

const fetchPatientAuditTrail = async (
  patientId: string,
): Promise<AuditLogEntry[]> => {
  const { data, error } = await supabase.rpc('get_patient_audit_trail', {
    p_patient_id: patientId,
    p_limit: 200,
    p_offset: 0,
  });

  if (error) throw error;

  // Add generated IDs since the function doesn't return them
  return (data || []).map((row: Record<string, unknown>, index: number) => ({
    id: `audit-${patientId}-${index}-${row.performed_at}`,
    performed_at: row.performed_at,
    action_type: row.action_type,
    table_name: row.table_name,
    description: row.description,
    user_name: row.user_name,
    user_role: row.user_role,
    changed_fields: row.changed_fields || [],
    is_critical: row.is_critical || false,
    old_values: row.old_values,
    new_values: row.new_values,
  }));
};

const fetchPatientNhisActivity = async (
  patientId: string,
): Promise<NhisActivityEntry[]> => {
  // Get NHIS profile first
  const { data: profiles } = await supabase
    .from('nhis_profiles')
    .select('id')
    .eq('patient_id', patientId);

  if (!profiles || profiles.length === 0) return [];

  const { data, error } = await supabase.rpc('get_nhis_profile_activity', {
    p_profile_id: profiles[0].id,
    p_limit: 100,
  });

  if (error) throw error;

  // Add generated IDs since the function doesn't return them
  return (data || []).map((row: Record<string, unknown>, index: number) => ({
    id: `nhis-${profiles[0].id}-${index}-${row.performed_at}`,
    performed_at: row.performed_at,
    action_type: row.action_type,
    event_type: row.event_type,
    user_name: row.user_name,
    auth_code: row.auth_code,
    before_state: row.before_state,
    after_state: row.after_state,
    reason: row.reason,
  }));
};

const fetchPatientEncounters = async (
  patientId: string,
): Promise<PatientEncounter[]> => {
  const { data, error } = await supabase
    .from('visits')
    .select(
      `
      id,
      encounter_number,
      encounter_date,
      status,
      current_stage,
      diagnosis,
      doctor:staff(first_name, last_name),
      department
    `,
    )
    .eq('patient_id', patientId)
    .order('encounter_date', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (
    data?.map((visit) => {
      // Handle doctor relation - can be array or single object
      const doctorData = Array.isArray(visit.doctor)
        ? visit.doctor[0]
        : visit.doctor;
      return {
        id: visit.id,
        encounter_number: visit.encounter_number,
        encounter_date: visit.encounter_date,
        status: visit.status,
        current_stage: visit.current_stage,
        diagnosis: visit.diagnosis,
        doctor_name: doctorData
          ? `Dr. ${doctorData.first_name} ${doctorData.last_name}`
          : undefined,
        department: visit.department,
      };
    }) || []
  );
};

// =============================================================================
// Helper Functions
// =============================================================================

const formatAge = (dateOfBirth: string): string => {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    return `${age - 1} years`;
  }
  return `${age} years`;
};

const getActionTypeColor = (actionType: string): string => {
  switch (actionType.toLowerCase()) {
    case 'create':
      return 'bg-teal-100 text-teal-800';
    case 'update':
      return 'bg-blue-100 text-blue-800';
    case 'delete':
      return 'bg-red-100 text-red-800';
    case 'login':
      return 'bg-purple-100 text-purple-800';
    case 'verify':
    case 'approve':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'completed':
    case 'approved':
      return 'bg-blue-100 text-blue-800';
    case 'pending':
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// =============================================================================
// Components
// =============================================================================

function PatientHeader({ patient }: { patient: PatientDTO }) {
  // Build full name from parts
  const fullName = [patient.first_name, patient.middle_name, patient.surname]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="px-6 py-5 border-b border-slate-200/50"
      style={{
        background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%)`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Patient Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-900/30"
            style={{ backgroundColor: BRAND_COLORS.accent }}
          >
            {patient.first_name?.[0]}
            {patient.surname?.[0] || patient.first_name?.[1] || ''}
          </div>

          <div className="text-white">
            <h2 className="text-xl font-bold">{fullName}</h2>
            <div className="flex items-center gap-4 mt-1 text-sm opacity-90">
              <span className="flex items-center gap-1">
                <IdCard size={14} />
                EMR: {patient.emr_number || 'N/A'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {patient.date_of_birth && formatAge(patient.date_of_birth)} old
              </span>
              <span className="flex items-center gap-1">
                <User size={14} />
                {patient.gender}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div
            className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white border border-white/20 ${
              patient.status === 'Active' ? 'bg-blue-500' : 'bg-gray-500'
            }`}
          >
            {patient.status}
          </div>

          {/* XenoCare brand badge */}
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-white text-xs font-bold">
            XenoCare
          </div>
        </div>
      </div>
    </div>
  );
}

function PatientInfo({ patient }: { patient: PatientDTO }) {
  function InfoItem({
    icon: Icon,
    label,
    value,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value?: string;
  }) {
    return (
      <div className="flex items-center gap-3 py-2.5">
        <div
          className="p-2 rounded-xl"
          style={{ backgroundColor: `${BRAND_COLORS.primary}12` }}
        >
          <Icon size={16} style={{ color: BRAND_COLORS.primary }} />
        </div>
        <div>
          <p
            className="text-xs font-medium"
            style={{ color: BRAND_COLORS.textSecondary }}
          >
            {label}
          </p>
          <p
            className="text-sm font-medium"
            style={{ color: BRAND_COLORS.textPrimary }}
          >
            {value || 'Not provided'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-1">
      <InfoItem
        icon={Phone}
        label="Phone Number"
        value={patient.contact_phone ?? undefined}
      />
      <InfoItem icon={Mail} label="Email" value={patient.email ?? undefined} />
      <InfoItem
        icon={MapPin}
        label="Address"
        value={patient.residential_address ?? undefined}
      />
      <InfoItem
        icon={Heart}
        label="Blood Group"
        value={patient.blood_group ?? undefined}
      />
      <InfoItem
        icon={Shield}
        label="Insurance Type"
        value={patient.insurance_type ?? undefined}
      />
      <InfoItem
        icon={Calendar}
        label="Date of Birth"
        value={
          patient.date_of_birth
            ? format(new Date(patient.date_of_birth), 'PPP')
            : undefined
        }
      />
    </div>
  );
}

function AuditTrail({ patientId }: { patientId: string }) {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['patient-audit-trail', patientId],
    queryFn: () => fetchPatientAuditTrail(patientId),
    staleTime: 30000,
  });

  const filteredLogs = auditLogs.filter((log) => {
    const matchesFilter = filter === 'all' || log.action_type === filter;
    const matchesSearch =
      searchTerm === '' ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-4">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Search size={16} style={{ color: BRAND_COLORS.textSecondary }} />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        >
          <option value="all">All Actions</option>
          <option value="create">Created</option>
          <option value="update">Updated</option>
          <option value="delete">Deleted</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw
            className="animate-spin"
            size={20}
            style={{ color: BRAND_COLORS.primary }}
          />
          <span className="ml-2" style={{ color: BRAND_COLORS.textSecondary }}>
            Loading audit trail...
          </span>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: BRAND_COLORS.textSecondary }}
            >
              <Activity className="mx-auto mb-2 opacity-50" size={32} />
              <p>No activity records found</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-xl border transition-colors ${log.is_critical ? 'ring-2 ring-red-200' : 'hover:bg-slate-50/50'}`}
                style={{
                  backgroundColor: BRAND_COLORS.cardBg,
                  borderColor: log.is_critical ? '#fecaca' : BRAND_COLORS.border,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getActionTypeColor(log.action_type)}`}
                      >
                        {log.action_type.toUpperCase()}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: BRAND_COLORS.textSecondary }}
                      >
                        {log.table_name.replace('_', ' ')}
                      </span>
                      {log.is_critical && (
                        <AlertCircle size={14} className="text-red-500" />
                      )}
                    </div>

                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: BRAND_COLORS.textPrimary }}
                    >
                      {log.description}
                    </p>

                    <div
                      className="flex items-center gap-3 text-xs"
                      style={{ color: BRAND_COLORS.textSecondary }}
                    >
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {log.user_name} ({log.user_role})
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDistanceToNow(new Date(log.performed_at), {
                          addSuffix: true,
                        })}
                      </span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                    </div>

                    {log.changed_fields && log.changed_fields.length > 0 && (
                      <div className="mt-2">
                        <p
                          className="text-xs font-medium mb-1"
                          style={{ color: BRAND_COLORS.textSecondary }}
                        >
                          Changed Fields:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {log.changed_fields.map((field) => (
                            <span
                              key={field}
                              className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                            >
                              {field.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <p
                      className="text-xs"
                      style={{ color: BRAND_COLORS.textSecondary }}
                    >
                      {format(new Date(log.performed_at), 'MMM dd, HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NhisActivity({ patientId }: { patientId: string }) {
  const { data: nhisLogs = [], isLoading } = useQuery({
    queryKey: ['patient-nhis-activity', patientId],
    queryFn: () => fetchPatientNhisActivity(patientId),
    staleTime: 30000,
  });

  return (
    <div className="p-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw
            className="animate-spin"
            size={20}
            style={{ color: BRAND_COLORS.primary }}
          />
          <span className="ml-2" style={{ color: BRAND_COLORS.textSecondary }}>
            Loading NHIS activity...
          </span>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {nhisLogs.length === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: BRAND_COLORS.textSecondary }}
            >
              <Shield className="mx-auto mb-2 opacity-50" size={32} />
              <p>No NHIS activity found</p>
            </div>
          ) : (
            nhisLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl border hover:bg-slate-50/50 transition-colors"
                style={{
                  backgroundColor: BRAND_COLORS.cardBg,
                  borderColor: BRAND_COLORS.border,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getActionTypeColor(log.action_type)}`}
                      >
                        {log.action_type.toUpperCase()}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: BRAND_COLORS.textSecondary }}
                      >
                        {log.event_type}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-3 text-xs mb-2"
                      style={{ color: BRAND_COLORS.textSecondary }}
                    >
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {log.user_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDistanceToNow(new Date(log.performed_at), {
                          addSuffix: true,
                        })}
                      </span>
                      {log.auth_code && (
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          Code: {log.auth_code}
                        </span>
                      )}
                    </div>

                    {log.reason && (
                      <p
                        className="text-sm italic"
                        style={{ color: BRAND_COLORS.textSecondary }}
                      >
                        "{log.reason}"
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p
                      className="text-xs"
                      style={{ color: BRAND_COLORS.textSecondary }}
                    >
                      {format(new Date(log.performed_at), 'MMM dd, HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EncounterHistory({ patientId }: { patientId: string }) {
  const { data: encounters = [], isLoading } = useQuery({
    queryKey: ['patient-encounters', patientId],
    queryFn: () => fetchPatientEncounters(patientId),
    staleTime: 60000,
  });

  return (
    <div className="p-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw
            className="animate-spin"
            size={20}
            style={{ color: BRAND_COLORS.primary }}
          />
          <span className="ml-2" style={{ color: BRAND_COLORS.textSecondary }}>
            Loading encounters...
          </span>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {encounters.length === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: BRAND_COLORS.textSecondary }}
            >
              <Stethoscope className="mx-auto mb-2 opacity-50" size={32} />
              <p>No encounters found</p>
            </div>
          ) : (
            encounters.map((encounter) => (
              <div
                key={encounter.id}
                className="p-3 rounded-xl border hover:bg-slate-50/50 transition-colors"
                style={{
                  backgroundColor: BRAND_COLORS.cardBg,
                  borderColor: BRAND_COLORS.border,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="font-medium"
                        style={{ color: BRAND_COLORS.textPrimary }}
                      >
                        {encounter.encounter_number}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(encounter.status)}`}
                      >
                        {encounter.status}
                      </span>
                    </div>

                    <div
                      className="space-y-1 text-sm"
                      style={{ color: BRAND_COLORS.textSecondary }}
                    >
                      {encounter.current_stage && (
                        <p>
                          Stage:{' '}
                          <span className="font-medium">
                            {encounter.current_stage}
                          </span>
                        </p>
                      )}
                      {encounter.department && (
                        <p>
                          Department:{' '}
                          <span className="font-medium">
                            {encounter.department}
                          </span>
                        </p>
                      )}
                      {encounter.doctor_name && (
                        <p>
                          Doctor:{' '}
                          <span className="font-medium">
                            {encounter.doctor_name}
                          </span>
                        </p>
                      )}
                      {encounter.diagnosis && (
                        <p>
                          Diagnosis:{' '}
                          <span className="font-medium">
                            {encounter.diagnosis}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className="text-sm font-medium"
                      style={{ color: BRAND_COLORS.textPrimary }}
                    >
                      {format(
                        new Date(encounter.encounter_date),
                        'MMM dd, yyyy',
                      )}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: BRAND_COLORS.textSecondary }}
                    >
                      {formatDistanceToNow(new Date(encounter.encounter_date), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// NHIS Details Component - Comprehensive NHIS Profile Information
// =============================================================================

function RealTimeCountdown({
  targetDate,
  className = '',
}: {
  targetDate: string | Date | null | undefined;
  className?: string;
}) {
  const [timeLeft, setTimeLeft] = useState<string>('Calculating...');

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft('N/A');
      return;
    }

    const calculateTimeLeft = () => {
      const expiry = new Date(targetDate);
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();

      if (isNaN(expiry.getTime())) {
        setTimeLeft('Invalid Date');
        return;
      }

      if (diff <= 0) {
        const diffDays = Math.abs(Math.floor(diff / (1000 * 60 * 60 * 24)));
        setTimeLeft(`EXPIRED (${diffDays}d ago)`);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      if (days > 0) {
        setTimeLeft(
          `${days}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s remaining`,
        );
      } else {
        setTimeLeft(
          `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s left`,
        );
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const isExpired = timeLeft.includes('EXPIRED');
  const isUrgent =
    (timeLeft.includes('0h') || !timeLeft.includes('d')) && !isExpired;

  return (
    <span
      className={`${isExpired ? 'text-red-600 font-black' : isUrgent ? 'text-orange-600 font-bold' : 'text-blue-600 font-bold'} ${className}`}
    >
      {timeLeft}
    </span>
  );
}

function NhisDetails({
  patient,
  nhisProfile,
}: {
  patient: PatientDTO;
  nhisProfile?: NhisProfile | null;
}) {
  // Fetch NHIS profile if not provided
  const { data: fetchedProfile } = useQuery({
    queryKey: ['patient-nhis-profile', patient.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nhis_profiles')
        .select(
          `
          *,
          patient:patients(*),
          verified_by_staff:staff!nhis_profiles_verified_by_fkey(id, first_name, last_name)
        `,
        )
        .eq('patient_id', patient.id)
        .single();

      if (error) return null;
      return data as NhisProfile;
    },
    enabled: !nhisProfile && !!patient.id,
    staleTime: 30000,
  });

  const profile = nhisProfile || fetchedProfile;

  // Fetch approved NHIS services
  const { data: approvedServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['patient-nhis-approved-services', patient.id],
    queryFn: async () => {
      const services: Array<{
        id: string;
        type: 'lab' | 'radiology' | 'pharmacy' | 'procedure' | 'specialty';
        name: string;
        encounter_number?: string;
        amount?: number;
        approved_at?: string;
        auth_code?: string;
      }> = [];

      // Fetch lab services
      const { data: labData } = await supabase
        .from('lab_requests')
        .select(
          'id, test_name, created_at, total_price, encounter:visits!encounter_id(encounter_number)',
        )
        .eq('patient_id', patient.id)
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (labData || []).forEach((s: Record<string, unknown>) => {
        services.push({
          id: s.id,
          type: 'lab',
          name: s.test_name || 'Lab Test',
          encounter_number: s.encounter?.encounter_number,
          amount: s.total_price,
          approved_at: s.created_at,
        });
      });

      // Fetch radiology services
      const { data: radiologyData } = await supabase
        .from('radiology_requests')
        .select(
          'id, exam_type, created_at, estimated_cost, encounter:visits!encounter_id(encounter_number)',
        )
        .eq('patient_id', patient.id)
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (radiologyData || []).forEach((s: Record<string, unknown>) => {
        services.push({
          id: s.id,
          type: 'radiology',
          name: s.exam_type || 'Radiology Exam',
          encounter_number: s.encounter?.encounter_number,
          amount: s.estimated_cost,
          approved_at: s.created_at,
        });
      });

      // Fetch pharmacy services
      const { data: pharmacyData } = await supabase
        .from('prescriptions')
        .select(
          'id, created_at, total_amount, encounter:visits!encounter_id(encounter_number)',
        )
        .eq('patient_id', patient.id)
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (pharmacyData || []).forEach((s: Record<string, unknown>) => {
        services.push({
          id: s.id,
          type: 'pharmacy',
          name: 'Prescription',
          encounter_number: s.encounter?.encounter_number,
          amount: s.total_amount,
          approved_at: s.created_at,
        });
      });

      // Fetch procedure services
      const { data: procedureData } = await supabase
        .from('clinical_requests')
        .select(
          'id, procedure_name, created_at, request_type, encounter:visits!clinical_requests_encounter_id_fkey(encounter_number)',
        )
        .eq('patient_id', patient.id)
        .in('request_type', ['Procedure', 'Surgery'])
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (procedureData || []).forEach((s: Record<string, unknown>) => {
        services.push({
          id: s.id,
          type: 'procedure',
          name: s.procedure_name || s.request_type || 'Procedure',
          encounter_number: s.encounter?.encounter_number,
          amount: 0,
          approved_at: s.created_at,
        });
      });

      // Fetch specialty referrals
      const { data: specialtyData } = await supabase
        .from('clinical_requests')
        .select(
          'id, specialty_module, review_notes, approved_at, created_at, encounter:visits!clinical_requests_encounter_id_fkey(encounter_number)',
        )
        .eq('patient_id', patient.id)
        .eq('request_type', 'Referral')
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (specialtyData || []).forEach((s: Record<string, unknown>) => {
        const authMatch = s.review_notes?.match(/\[AUTH CODE:\s*([^\]]+)\]/i);
        services.push({
          id: s.id,
          type: 'specialty',
          name: `${s.specialty_module || 'Specialty'} Referral`,
          encounter_number: s.encounter?.encounter_number,
          approved_at: s.approved_at || s.created_at,
          auth_code: authMatch ? authMatch[1].trim() : undefined,
        });
      });

      return services.sort(
        (a, b) =>
          new Date(b.approved_at || 0).getTime() -
          new Date(a.approved_at || 0).getTime(),
      );
    },
    enabled: !!patient.id,
    staleTime: 30000,
  });

  const getOriginBadge = (origin: NhisPatientOrigin) => {
    const config: Record<NhisPatientOrigin, { color: string; label: string }> =
      {
        internal: { color: 'bg-blue-100 text-blue-800', label: 'Internal' },
        referred: { color: 'bg-orange-100 text-orange-800', label: 'Referred' },
      };
    const { color, label } = config[origin] || config.internal;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const getSchemeBadge = (scheme: NhisSchemeType) => {
    const config: Record<NhisSchemeType, { color: string; label: string }> = {
      Personnel: { color: 'bg-indigo-100 text-indigo-800', label: 'Personnel' },
      Civilian_NHIS: {
        color: 'bg-purple-100 text-purple-800',
        label: 'Civilian NHIS',
      },
      HMO_Private: { color: 'bg-cyan-100 text-cyan-800', label: 'HMO Private' },
      Special: { color: 'bg-yellow-100 text-yellow-800', label: 'Special' },
    };
    const { color, label } = config[scheme] || {
      color: 'bg-gray-100 text-gray-800',
      label: scheme,
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const getProfileStatusBadge = (status: NhisProfileStatus) => {
    const config: Record<NhisProfileStatus, { color: string; label: string }> =
      {
        active: { color: 'text-blue-600', label: 'Active' },
        inactive: { color: 'text-gray-600', label: 'Inactive' },
        suspended: { color: 'text-orange-600', label: 'Suspended' },
        expired: { color: 'text-red-600', label: 'Expired' },
      };
    const { color, label } = config[status] || config.inactive;
    return (
      <span className={`inline-flex items-center gap-1 text-sm ${color}`}>
        {status === 'active' ? (
          <CheckCircle size={14} />
        ) : (
          <XCircle size={14} />
        )}
        {label}
      </span>
    );
  };

  if (!profile) {
    return (
      <div className="p-6">
        <div
          className="text-center py-12"
          style={{ color: BRAND_COLORS.textSecondary }}
        >
          <Shield className="mx-auto mb-4 opacity-50" size={48} />
          <p className="text-lg font-medium">No NHIS Profile Found</p>
          <p className="text-sm mt-2">
            This patient does not have an NHIS enrollment record
          </p>
        </div>
      </div>
    );
  }

  const isReferred =
    profile.patient_origin === 'referred' ||
    patient.nhis_patient_source === 'Referral';

  return (
    <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(90vh-250px)]">
      {/* Referral Banner - Only for Referred Patients */}
      {isReferred && (
        <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200">
          <div className="bg-orange-600 px-4 py-2 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Clock size={14} className="animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest">
                Referral Validity
              </span>
            </div>
            <div className="text-sm font-black">
              <RealTimeCountdown
                targetDate={
                  profile.referral_expiry_date ||
                  (profile.referral_date
                    ? new Date(
                        new Date(profile.referral_date).getTime() +
                          30 * 24 * 60 * 60 * 1000,
                      ).toISOString()
                    : null)
                }
                className="text-white"
              />
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-black text-orange-800/40 uppercase block mb-1">
                  Referring Facility
                </label>
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-orange-600" />
                  <p className="font-bold text-orange-950 text-sm">
                    {profile.referring_facility_name || 'N/A'}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-orange-800/40 uppercase block mb-1">
                  Referral Code
                </label>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-orange-600" />
                  <p className="font-mono font-black text-orange-950">
                    {profile.referral_code || 'N/A'}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-orange-800/40 uppercase block mb-1">
                  Referral Date
                </label>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-orange-600" />
                  <p className="font-bold text-orange-950 text-sm">
                    {profile.referral_date
                      ? format(new Date(profile.referral_date), 'dd MMM yyyy')
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {profile.referral_reason && (
              <div className="bg-white/60 p-3 rounded-xl border border-orange-100">
                <label className="text-xs font-black text-orange-800/40 uppercase block mb-1">
                  Clinical Basis
                </label>
                <p className="text-sm text-orange-900 font-medium">
                  "{profile.referral_reason}"
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* NHIS Configuration */}
      <section>
        <h3
          className="text-xs font-black uppercase tracking-widest mb-3"
          style={{ color: BRAND_COLORS.textSecondary }}
        >
          NHIS Configuration
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase block">
              Enrollee ID
            </label>
            <p className="font-mono font-bold text-blue-600">
              {profile.enrollee_id || 'N/A'}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase block">
              Patient Origin
            </label>
            {getOriginBadge(profile.patient_origin)}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase block">
              Scheme Type
            </label>
            {getSchemeBadge(profile.scheme_type)}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase block">
              Tariff Group
            </label>
            <p className="font-bold text-gray-900 text-sm">
              {profile.tariff_group}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase block">
              Status
            </label>
            {getProfileStatusBadge(profile.status)}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase block">
              Verification Date
            </label>
            <p className="font-bold text-gray-900 text-sm">
              {profile.verified_at
                ? format(new Date(profile.verified_at), 'dd MMM yyyy')
                : 'Unverified'}
            </p>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase block">
              HMO / Provider
            </label>
            <p className="font-bold text-gray-900 text-sm">
              {profile.provider_name || patient.insurance_type || 'N/A'}
            </p>
          </div>
        </div>
      </section>

      {/* Next of Kin */}
      <section>
        <h3
          className="text-xs font-black uppercase tracking-widest mb-3"
          style={{ color: BRAND_COLORS.textSecondary }}
        >
          Next of Kin
        </h3>
        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
              NOK Name
            </label>
            <p className="font-bold text-slate-800 text-sm">
              {patient.nok_name || 'N/A'}
            </p>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
              Relationship
            </label>
            <p className="font-bold text-slate-800 text-sm">
              {patient.nok_relationship || 'N/A'}
            </p>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
              NOK Contact
            </label>
            <p className="font-mono font-bold text-slate-800 text-sm">
              {patient.nok_phone || 'N/A'}
            </p>
          </div>
        </div>
      </section>

      {/* Verification Audit */}
      {(profile.verified_by || profile.verification_notes) && (
        <section>
          <h3
            className="text-xs font-black uppercase tracking-widest mb-3"
            style={{ color: BRAND_COLORS.textSecondary }}
          >
            Verification Audit
          </h3>
          <div className="bg-blue-50 rounded-xl border border-blue-100 overflow-hidden">
            <div className="flex items-center gap-3 p-3 bg-blue-100/30 border-b border-blue-100/50">
              <CheckCircle size={16} className="text-blue-500" />
              <p className="text-xs text-blue-800 font-bold">
                Verified by{' '}
                {profile.verified_by_staff
                  ? `${profile.verified_by_staff.first_name} ${profile.verified_by_staff.last_name}`
                  : `Staff ID: ${profile.verified_by || 'NHIS System'}`}{' '}
                on{' '}
                {profile.verified_at
                  ? format(new Date(profile.verified_at), 'PPp')
                  : 'N/A'}
              </p>
            </div>
            {profile.verification_notes && (
              <div className="p-3 bg-white/60">
                <p className="text-sm text-blue-900 font-medium italic">
                  "{profile.verification_notes}"
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* NHIS Approved Services */}
      <section>
        <h3
          className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2"
          style={{ color: BRAND_COLORS.textSecondary }}
        >
          <FileText size={14} style={{ color: BRAND_COLORS.primary }} />
          NHIS Approved Services
          {approvedServices.length > 0 && (
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
              {approvedServices.length}
            </span>
          )}
        </h3>

        {servicesLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw
              className="animate-spin"
              size={20}
              style={{ color: BRAND_COLORS.primary }}
            />
            <span className="ml-2" style={{ color: BRAND_COLORS.textSecondary }}>
              Loading services...
            </span>
          </div>
        ) : approvedServices.length === 0 ? (
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 text-center">
            <p className="text-sm text-gray-500">
              No NHIS approved services yet
            </p>
          </div>
        ) : (
          <div className="bg-slate-50/30 rounded-xl border border-slate-200 overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-black text-slate-600 uppercase">
                      Service
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-black text-slate-600 uppercase">
                      Type
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-black text-slate-600 uppercase">
                      Encounter
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-black text-slate-600 uppercase">
                      Amount
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-black text-slate-600 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {approvedServices.map((service) => (
                    <tr
                      key={`${service.type}-${service.id}`}
                      className="hover:bg-slate-50/50"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {service.type === 'lab' && (
                            <FlaskConical size={12} className="text-blue-600" />
                          )}
                          {service.type === 'radiology' && (
                            <Radio size={12} className="text-teal-600" />
                          )}
                          {service.type === 'pharmacy' && (
                            <Pill size={12} className="text-amber-600" />
                          )}
                          {service.type === 'procedure' && (
                            <Scissors size={12} className="text-rose-600" />
                          )}
                          {service.type === 'specialty' && (
                            <Stethoscope
                              size={12}
                              className="text-purple-600"
                            />
                          )}
                          <span className="font-medium text-gray-900 truncate max-w-[150px] text-xs">
                            {service.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase
                          ${service.type === 'lab' ? 'bg-blue-100 text-blue-700' : ''}
                          ${service.type === 'radiology' ? 'bg-teal-100 text-teal-700' : ''}
                          ${service.type === 'pharmacy' ? 'bg-amber-100 text-amber-700' : ''}
                          ${service.type === 'procedure' ? 'bg-rose-100 text-rose-700' : ''}
                          ${service.type === 'specialty' ? 'bg-purple-100 text-purple-700' : ''}
                        `}
                        >
                          {service.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">
                        {service.encounter_number || 'â€”'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-700 text-xs">
                        {service.amount
                          ? `â‚¦${service.amount.toLocaleString('en-NG')}`
                          : 'â€”'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {service.approved_at
                          ? format(new Date(service.approved_at), 'dd MMM yy')
                          : 'â€”'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-100/50 px-3 py-2 flex items-center justify-between border-t border-slate-200">
              <span className="text-xs text-slate-600 font-bold">
                Total: {approvedServices.length} services
              </span>
              <span
                className="font-mono font-black text-sm"
                style={{ color: BRAND_COLORS.primary }}
              >
                â‚¦
                {approvedServices
                  .reduce((sum, s) => sum + (s.amount || 0), 0)
                  .toLocaleString('en-NG')}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function EnhancedPatientProfileModal({
  isOpen,
  onClose,
  patient,
  nhisProfile,
  showEdit = true,
  onEdit,
}: EnhancedPatientProfileModalProps) {
  const [activeTab, setActiveTab] = useState('info');

  const tabs = [
    { id: 'info', label: 'Patient Info', icon: User },
    { id: 'nhis-details', label: 'NHIS Details', icon: Shield },
    { id: 'audit', label: 'Activity Log', icon: History },
    { id: 'nhis', label: 'NHIS Activity', icon: Activity },
    { id: 'encounters', label: 'Encounters', icon: Stethoscope },
  ].filter(
    (tab) =>
      isNhisFeatureEnabled() || (tab.id !== 'nhis-details' && tab.id !== 'nhis'),
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="2xl" noPadding>
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="relative">
          <PatientHeader patient={patient} />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Bar */}
        <div
          className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50"
        >
          <div className="text-sm text-slate-500">
            Patient Profile & Activity Management
          </div>

          <div className="flex items-center gap-2">
            {showEdit && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex items-center gap-2"
              >
                <Edit3 size={14} />
                Edit Patient
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download size={14} />
              Export
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all duration-200 relative ${
                  activeTab === tab.id
                    ? 'text-indigo-600 bg-indigo-50/80 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-slate-50'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'info' && (
            <div className="h-full overflow-y-auto">
              <PatientInfo patient={patient} />
            </div>
          )}

          {activeTab === 'nhis-details' && (
            <div className="h-full overflow-y-auto">
              <NhisDetails patient={patient} nhisProfile={nhisProfile} />
            </div>
          )}

          {activeTab === 'audit' && patient.id && (
            <div className="h-full overflow-y-auto">
              <AuditTrail patientId={patient.id} />
            </div>
          )}

          {activeTab === 'nhis' && patient.id && (
            <div className="h-full overflow-y-auto">
              <NhisActivity patientId={patient.id} />
            </div>
          )}

          {activeTab === 'encounters' && patient.id && (
            <div className="h-full overflow-y-auto">
              <EncounterHistory patientId={patient.id} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50 text-slate-500"
        >
          <div className="flex items-center gap-4">
            <span>© {new Date().getFullYear()} XenoCare</span>
            <span>•</span>
            <span>Patient Data Management System</span>
          </div>

          <div className="flex items-center gap-1">
            <span>Powered by</span>
            <span className="font-bold text-indigo-600">
              XenoCare
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
