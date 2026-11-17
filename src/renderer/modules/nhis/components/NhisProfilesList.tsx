// =============================================================================
// NHIS Profiles List Component
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Search,
  Shield,
  User,
  Building2,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  Edit,
  RefreshCw,
  Plus,
  Filter,
  ChevronDown,
  Save,
  X,
  FlaskConical,
  Radio,
  Pill,
  Scissors,
  Stethoscope,
  FileText,
  Eye,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatDetailedAge } from '../../patient-registration/dtos/patient.dto';
import { useNhisProfiles, useUpdateNhisProfile } from '../hooks';
import type {
  NhisProfile,
  NhisPatientOrigin,
  NhisSchemeType,
  NhisProfileStatus,
  NhisTariffGroup,
} from '../types';
import { supabase } from '../../../api/supabaseClient';
import { SkeletonList } from '../../../components/ui/SkeletonLoader';
import EnhancedPatientProfileModal from '../../../components/shared/EnhancedPatientProfileModal';
import type { PatientDTO } from '../../patient-registration/dtos/patient.dto';

// State for the consolidated profile modal
interface ProfileModalState {
  patient: PatientDTO;
  nhisProfile: NhisProfile;
}

const ORIGIN_OPTIONS: { value: NhisPatientOrigin | ''; label: string }[] = [
  { value: '', label: 'All Origins' },
  { value: 'internal', label: 'Internal' },
  { value: 'referred', label: 'Referred' },
];

const SCHEME_OPTIONS: { value: NhisSchemeType | ''; label: string }[] = [
  { value: '', label: 'All Schemes' },
  { value: 'Personnel', label: 'Personnel' },
  { value: 'Civilian_NHIS', label: 'Civilian NHIS' },
  { value: 'HMO_Private', label: 'HMO Private' },
  { value: 'Special', label: 'Special' },
];

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
      className={`${isExpired ? 'text-red-600 font-black' : isUrgent ? 'text-orange-600 font-bold' : 'text-green-600 font-bold'} ${className}`}
    >
      {timeLeft}
    </span>
  );
}

function getOriginBadge(origin: NhisPatientOrigin) {
  const config: Record<NhisPatientOrigin, { color: string; label: string }> = {
    internal: { color: 'bg-blue-100 text-blue-800', label: 'Internal' },
    referred: { color: 'bg-orange-100 text-orange-800', label: 'Referred' },
  };

  const { color, label } = config[origin] || config.internal;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function getSchemeBadge(scheme: NhisSchemeType) {
  const config: Record<NhisSchemeType, { color: string; label: string }> = {
    Personnel: { color: 'bg-green-100 text-green-800', label: 'Personnel' },
    Civilian_NHIS: {
      color: 'bg-purple-100 text-purple-800',
      label: 'Civilian NHIS',
    },
    HMO_Private: { color: 'bg-cyan-100 text-cyan-800', label: 'HMO Private' },
    Special: { color: 'bg-yellow-100 text-yellow-800', label: 'Special' },
  };

  const { color, label } = config[scheme] || config.Personnel;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function getStatusBadge(status: NhisProfileStatus) {
  const config: Record<NhisProfileStatus, { color: string; label: string }> = {
    active: { color: 'text-green-600', label: 'Active' },
    inactive: { color: 'text-gray-600', label: 'Inactive' },
    suspended: { color: 'text-orange-600', label: 'Suspended' },
    expired: { color: 'text-red-600', label: 'Expired' },
  };

  const { color, label } = config[status] || config.inactive;
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${color}`}>
      {status === 'active' ? <CheckCircle size={14} /> : <XCircle size={14} />}
      {label}
    </span>
  );
}

interface ProfileDetailModalProps {
  profile: NhisProfile;
  onClose: () => void;
}

function ProfileDetailModal({ profile, onClose }: ProfileDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateProfileMutation = useUpdateNhisProfile();

  // Fetch approved NHIS services for this patient
  const { data: approvedServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ['patient-nhis-approved-services', profile.patient_id],
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
        .eq('patient_id', profile.patient_id)
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (labData || []).forEach((s: any) => {
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
        .eq('patient_id', profile.patient_id)
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (radiologyData || []).forEach((s: any) => {
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
        .eq('patient_id', profile.patient_id)
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (pharmacyData || []).forEach((s: any) => {
        services.push({
          id: s.id,
          type: 'pharmacy',
          name: 'Prescription',
          encounter_number: s.encounter?.encounter_number,
          amount: s.total_amount,
          approved_at: s.created_at,
        });
      });

      // Fetch procedure services from clinical_requests (Procedure/Surgery type)
      // NOTE: procedure_requests table doesn't have nhis_approval_status or estimated_cost
      const { data: procedureData } = await supabase
        .from('clinical_requests')
        .select(
          'id, procedure_name, created_at, request_type, encounter:visits!clinical_requests_encounter_id_fkey(encounter_number)',
        )
        .eq('patient_id', profile.patient_id)
        .in('request_type', ['Procedure', 'Surgery'])
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (procedureData || []).forEach((s: any) => {
        services.push({
          id: s.id,
          type: 'procedure',
          name: s.procedure_name || s.request_type || 'Procedure',
          encounter_number: s.encounter?.encounter_number,
          amount: 0, // clinical_requests doesn't have cost field
          approved_at: s.created_at,
        });
      });

      // Fetch specialty referrals
      const { data: specialtyData } = await supabase
        .from('clinical_requests')
        .select(
          'id, specialty_module, review_notes, approved_at, created_at, encounter:visits!clinical_requests_encounter_id_fkey(encounter_number)',
        )
        .eq('patient_id', profile.patient_id)
        .eq('request_type', 'Referral')
        .eq('nhis_approval_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      (specialtyData || []).forEach((s: any) => {
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

      // Sort by date
      return services.sort(
        (a, b) =>
          new Date(b.approved_at || 0).getTime() -
          new Date(a.approved_at || 0).getTime(),
      );
    },
    enabled: !!profile.patient_id,
    staleTime: 30000,
  });

  // Form States
  const [enrolleeId, setEnrolleeId] = useState(profile.enrollee_id || '');
  const [schemeType, setSchemeType] = useState<NhisSchemeType>(
    profile.scheme_type,
  );
  const [tariffGroup, setTariffGroup] = useState<NhisTariffGroup>(
    profile.tariff_group,
  );
  const [providerName, setProviderName] = useState(profile.provider_name || '');
  const [status, setStatus] = useState<NhisProfileStatus>(profile.status);
  const [planCategory, setPlanCategory] = useState(profile.plan_category || '');
  const [verificationNotes, setVerificationNotes] = useState(
    profile.verification_notes || '',
  );

  // Referral states (if editing allowed)
  const [referralCode, setReferralCode] = useState(profile.referral_code || '');
  const [referringFacility, setReferringFacility] = useState(
    profile.referring_facility_name || '',
  );
  const [referralReason, setReferralReason] = useState(
    profile.referral_reason || '',
  );

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        profileId: profile.id,
        dto: {
          enrollee_id: enrolleeId,
          scheme_type: schemeType,
          tariff_group: tariffGroup,
          provider_name: providerName,
          status,
          plan_category: planCategory,
          verification_notes: verificationNotes,
          referral_code: referralCode,
          referring_facility_name: referringFacility,
          referral_reason: referralReason,
        },
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert('Failed to update profile. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-8 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                <Shield size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">
                  NHIS Profile Record
                </h2>
                <p className="text-blue-100 font-medium">
                  Deep patient enrollment & insurance metadata
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <XCircle size={24} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
          {/* Patient Info */}
          <section>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
              Patient Identity
            </h3>
            <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-blue-100 rounded-[1.5rem] flex items-center justify-center shrink-0">
                  <User size={40} className="text-blue-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                      Full Name
                    </label>
                    <p className="font-bold text-gray-900 text-lg">
                      {profile.patient?.surname}, {profile.patient?.first_name}{' '}
                      {profile.patient?.middle_name || ''}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                      Patient number
                    </label>
                    <p className="font-mono font-black text-blue-600 text-lg tracking-tighter">
                      {profile.patient?.emr_number}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                      NHIS Number
                    </label>
                    <p className="font-mono font-black text-teal-600 text-lg">
                      {profile.patient?.nhis_number || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Basic Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase block">
                    Gender
                  </label>
                  <p className="font-bold text-gray-700">
                    {profile.patient?.gender || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase block">
                    Age
                  </label>
                  <p className="font-bold text-gray-700">
                    {formatDetailedAge(profile.patient?.date_of_birth)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase block">
                    Blood Group
                  </label>
                  <p className="font-bold text-red-600">
                    {profile.patient?.blood_group || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase block">
                    Contact Phone
                  </label>
                  <p className="font-bold text-gray-700">
                    {profile.patient?.contact_phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase block">
                    Email
                  </label>
                  <p className="font-bold text-gray-700 truncate text-xs">
                    {(profile.patient as any)?.email || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Referral Context (Moved to Top for Visibility) */}
          {(profile.patient_origin === 'referred' ||
            profile.patient?.nhis_patient_source === 'Referral') && (
            <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-amber-50 rounded-[2rem] border border-orange-200">
              {/* Expiry Banner */}
              <div className="bg-orange-600 px-6 py-2 flex items-center justify-between text-white">
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
                      profile.patient?.referral_expiry_date ||
                      (profile.referral_date || profile.patient?.referral_date
                        ? new Date(
                            new Date(
                              profile.referral_date ||
                                profile.patient?.referral_date!,
                            ).getTime() +
                              30 * 24 * 60 * 60 * 1000,
                          ).toISOString()
                        : null)
                    }
                    className="text-white"
                  />
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-xs font-black text-orange-800/40 uppercase block mb-1">
                      Referring Facility
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={referringFacility}
                        onChange={(e) => setReferringFacility(e.target.value)}
                        className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-orange-600" />
                        <p className="font-bold text-orange-950">
                          {profile.referring_facility_name ||
                            profile.patient?.referring_facility_name ||
                            'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-black text-orange-800/40 uppercase block mb-1">
                      Referral Code
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                        className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-orange-600" />
                        <p className="font-mono font-black text-orange-950 text-base">
                          {profile.referral_code ||
                            profile.patient?.referral_code ||
                            'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-black text-orange-800/40 uppercase block mb-1">
                      Referral Date
                    </label>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-orange-600" />
                      <p className="font-bold text-orange-950 font-mono">
                        {profile.referral_date || profile.patient?.referral_date
                          ? new Date(
                              profile.referral_date ||
                                profile.patient?.referral_date!,
                            ).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {(profile.referral_reason ||
                  profile.patient?.referral_reason ||
                  isEditing) && (
                  <div className="bg-white/60 p-4 rounded-xl border border-orange-100 shadow-sm">
                    <label className="text-xs font-black text-orange-800/40 uppercase block mb-2">
                      Clinical Basis / Referral Reason
                    </label>
                    {isEditing ? (
                      <textarea
                        value={referralReason}
                        onChange={(e) => setReferralReason(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 border border-orange-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500 bg-white resize-none"
                      />
                    ) : (
                      <p className="text-sm text-orange-900 font-medium leading-relaxed">
                        {profile.referral_reason ||
                          profile.patient?.referral_reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Location & Address */}
          <section>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
              Location & Logistics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                  Residential Address
                </label>
                <p className="font-medium text-gray-700 text-sm">
                  {profile.patient?.residential_address || 'N/A'}
                </p>
              </div>
              <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">
                  State / LGA
                </label>
                <p className="font-bold text-gray-700 text-sm">
                  {profile.patient?.state_of_origin && profile.patient?.lga
                    ? `${profile.patient.state_of_origin} / ${profile.patient.lga}`
                    : profile.patient?.state_of_origin || 'N/A'}
                </p>
              </div>
            </div>
          </section>

          {/* Next of Kin */}
          <section>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
              Next of Kin
            </h3>
            <div className="bg-emerald-50/30 p-6 rounded-[2rem] border border-emerald-100/50 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-xs font-bold text-emerald-800/40 uppercase block mb-1">
                  NOK Name
                </label>
                <p className="font-bold text-emerald-900">
                  {profile.patient?.nok_name || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-800/40 uppercase block mb-1">
                  Relationship
                </label>
                <p className="font-bold text-emerald-900">
                  {profile.patient?.nok_relationship || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-800/40 uppercase block mb-1">
                  NOK Contact
                </label>
                <p className="font-mono font-bold text-emerald-900">
                  {profile.patient?.nok_phone || 'N/A'}
                </p>
              </div>
            </div>
          </section>

          {/* NHIS Info */}
          <section>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
              NHIS Configuration
            </h3>
            <div
              className={`grid grid-cols-2 md:grid-cols-4 gap-6 ${isEditing ? 'bg-blue-50/50 p-6 rounded-xl border border-blue-100' : ''}`}
            >
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">
                  Enrollee ID
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={enrolleeId}
                    onChange={(e) => setEnrolleeId(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                ) : (
                  <p className="font-mono font-bold text-blue-600 text-base">
                    {profile.enrollee_id || 'N/A'}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">
                  Patient Origin
                </label>
                <div className="pt-1">
                  {getOriginBadge(profile.patient_origin)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">
                  Scheme Type
                </label>
                {isEditing ? (
                  <select
                    value={schemeType}
                    onChange={(e) =>
                      setSchemeType(e.target.value as NhisSchemeType)
                    }
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Personnel">Personnel</option>
                    <option value="Civilian_NHIS">Civilian NHIS</option>
                    <option value="HMO_Private">HMO Private</option>
                    <option value="Special">Special</option>
                  </select>
                ) : (
                  <div className="pt-1">
                    {getSchemeBadge(profile.scheme_type)}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">
                  Tariff Group
                </label>
                {isEditing ? (
                  <select
                    value={tariffGroup}
                    onChange={(e) =>
                      setTariffGroup(e.target.value as NhisTariffGroup)
                    }
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Civilian_HMO">Civilian HMO</option>
                    <option value="Personnel">Personnel</option>
                    <option value="Special">Special</option>
                    <option value="Private">Private</option>
                  </select>
                ) : (
                  <p className="font-bold text-gray-900">
                    {profile.tariff_group}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">
                  Status
                </label>
                {isEditing ? (
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as NhisProfileStatus)
                    }
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="expired">Expired</option>
                  </select>
                ) : (
                  <div className="pt-1">{getStatusBadge(profile.status)}</div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">
                  Verification Date
                </label>
                <p className="font-bold text-gray-900">
                  {profile.verified_at
                    ? new Date(profile.verified_at).toLocaleDateString()
                    : 'Unverified'}
                </p>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase block">
                  HMO / Provider
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    placeholder="Enter HMO or Provider name"
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                ) : (
                  <p className="font-bold text-gray-900">
                    {profile.provider_name ||
                      (profile.patient?.patient_category === 'Military'
                        ? 'Defence Health Maintenance Limited'
                        : (profile.patient as any)?.payer_info?.scheme) ||
                      'N/A'}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Registration / Identity Extensions */}
          <section>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">
              Registration Detail Records
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
              {profile.patient?.patient_category === 'Military' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase block">
                      Service Number
                    </label>
                    <p className="font-mono font-black text-slate-700">
                      {(profile.patient as any).service_number || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase block">
                      Rank
                    </label>
                    <p className="font-bold text-slate-700">
                      {(profile.patient as any).rank || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase block">
                      Military Branch
                    </label>
                    <p className="font-bold text-slate-700">
                      {(profile.patient as any).military_branch || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase block">
                      Unit
                    </label>
                    <p className="font-bold text-slate-700">
                      {(profile.patient as any).unit || 'N/A'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase block">
                      Occupation
                    </label>
                    <p className="font-bold text-slate-700">
                      {(profile.patient as any).occupation || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase block">
                      Employer
                    </label>
                    <p className="font-bold text-slate-700">
                      {(profile.patient as any).employer || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase block">
                      Patient Type
                    </label>
                    <p className="font-bold text-slate-700">
                      {(profile.patient as any).patient_type || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase block">
                      Insurance Type
                    </label>
                    <p className="font-bold text-slate-700">
                      {(profile.patient as any).insurance_type || 'N/A'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Verification Audit */}
          {(profile.verified_by || profile.verification_notes || isEditing) && (
            <section className="pt-4 space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">
                Verification Audit
              </h3>

              <div className="bg-emerald-50 rounded-xl border border-emerald-100 overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-emerald-100/30 border-b border-emerald-100/50">
                  <CheckCircle size={18} className="text-emerald-500" />
                  <p className="text-xs text-emerald-800 font-bold">
                    Verified by{' '}
                    {profile.verified_by_staff
                      ? `${profile.verified_by_staff.first_name} ${profile.verified_by_staff.last_name}`
                      : `Staff ID: ${profile.verified_by || 'NHIS System'}`}{' '}
                    on{' '}
                    {profile.verified_at
                      ? new Date(profile.verified_at).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>

                {(profile.verification_notes || isEditing) && (
                  <div className="p-4 bg-white/60">
                    <label className="text-xs font-black text-emerald-800/40 uppercase block mb-1">
                      Verification / Processing Notes
                    </label>
                    {isEditing ? (
                      <textarea
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        placeholder="Add internal processing remarks..."
                        rows={2}
                        className="w-full px-4 py-3 border border-emerald-200 rounded-xl text-sm italic font-medium focus:ring-2 focus:ring-emerald-500 bg-white resize-none"
                      />
                    ) : (
                      <p className="text-sm text-emerald-900 font-medium italic">
                        "{profile.verification_notes}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* NHIS Approved Services */}
          <section className="pt-4 space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <FileText size={14} className="text-teal-600" />
              NHIS Approved Services
              {approvedServices.length > 0 && (
                <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  {approvedServices.length}
                </span>
              )}
            </h3>

            {servicesLoading ? (
              <SkeletonList count={5} />
            ) : approvedServices.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 text-center">
                <p className="text-sm text-gray-500">
                  No NHIS approved services yet
                </p>
              </div>
            ) : (
              <div className="bg-teal-50/30 rounded-[2rem] border border-teal-100 overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-teal-100/50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-black text-teal-800 uppercase">
                          Service
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-black text-teal-800 uppercase">
                          Type
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-black text-teal-800 uppercase">
                          Encounter
                        </th>
                        <th className="text-right px-4 py-2 text-xs font-black text-teal-800 uppercase">
                          Amount
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-black text-teal-800 uppercase">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-100">
                      {approvedServices.map((service) => (
                        <tr
                          key={`${service.type}-${service.id}`}
                          className="hover:bg-teal-50/50"
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {service.type === 'lab' && (
                                <FlaskConical
                                  size={14}
                                  className="text-blue-600"
                                />
                              )}
                              {service.type === 'radiology' && (
                                <Radio size={14} className="text-green-600" />
                              )}
                              {service.type === 'pharmacy' && (
                                <Pill size={14} className="text-amber-600" />
                              )}
                              {service.type === 'procedure' && (
                                <Scissors size={14} className="text-rose-600" />
                              )}
                              {service.type === 'specialty' && (
                                <Stethoscope
                                  size={14}
                                  className="text-purple-600"
                                />
                              )}
                              <span className="font-medium text-gray-900 truncate max-w-[200px]">
                                {service.name}
                              </span>
                            </div>
                            {service.auth_code && (
                              <span className="text-xs text-teal-600 font-mono ml-6">
                                Auth: {service.auth_code}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase
                              ${service.type === 'lab' ? 'bg-blue-100 text-blue-700' : ''}
                              ${service.type === 'radiology' ? 'bg-green-100 text-green-700' : ''}
                              ${service.type === 'pharmacy' ? 'bg-amber-100 text-amber-700' : ''}
                              ${service.type === 'procedure' ? 'bg-rose-100 text-rose-700' : ''}
                              ${service.type === 'specialty' ? 'bg-purple-100 text-purple-700' : ''}
                            `}
                            >
                              {service.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-600">
                            {service.encounter_number || '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-gray-700">
                            {service.amount
                              ? `₦${service.amount.toLocaleString('en-NG')}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-600">
                            {service.approved_at
                              ? new Date(
                                  service.approved_at,
                                ).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: '2-digit',
                                })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Services Summary */}
                <div className="bg-teal-100/50 px-4 py-3 flex items-center justify-between border-t border-teal-100">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-teal-800 font-bold">
                      Total: {approvedServices.length} services
                    </span>
                    <span className="text-gray-500">
                      Lab:{' '}
                      {approvedServices.filter((s) => s.type === 'lab').length}{' '}
                      | Radiology:{' '}
                      {
                        approvedServices.filter((s) => s.type === 'radiology')
                          .length
                      }{' '}
                      | Pharmacy:{' '}
                      {
                        approvedServices.filter((s) => s.type === 'pharmacy')
                          .length
                      }{' '}
                      | Procedures:{' '}
                      {
                        approvedServices.filter((s) => s.type === 'procedure')
                          .length
                      }{' '}
                      | Specialty:{' '}
                      {
                        approvedServices.filter((s) => s.type === 'specialty')
                          .length
                      }
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Total Value:</span>
                    <span className="ml-2 font-mono font-black text-teal-700">
                      ₦
                      {approvedServices
                        .reduce((sum, s) => sum + (s.amount || 0), 0)
                        .toLocaleString('en-NG')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="p-8 border-t border-gray-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-2 px-8 py-4 text-gray-700 font-bold border border-gray-300 rounded-xl hover:bg-white transition-all"
              >
                <X size={18} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-8 py-4 text-gray-700 font-bold border border-gray-300 rounded-xl hover:bg-white transition-all"
              >
                Close Profile
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Edit size={18} />
                Modify Record
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function NhisProfilesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [originFilter, setOriginFilter] = useState<NhisPatientOrigin | ''>('');
  const [schemeFilter, setSchemeFilter] = useState<NhisSchemeType | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProfileModal, setSelectedProfileModal] =
    useState<ProfileModalState | null>(null);

  const {
    data: profilesData,
    isLoading,
    refetch,
  } = useNhisProfiles({
    search: searchQuery || undefined,
    patient_origin: originFilter || undefined,
    scheme_type: schemeFilter || undefined,
  });

  const profiles = profilesData?.data || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">NHIS Profiles</h2>
          <p className="text-sm text-gray-500">
            Manage patient NHIS enrollment records
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus size={18} />
            New Profile
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64 relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by name, enrollee ID, or patient number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter size={18} />
            Filters
            <ChevronDown
              size={16}
              className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Patient Origin
              </label>
              <select
                value={originFilter}
                onChange={(e) =>
                  setOriginFilter(e.target.value as NhisPatientOrigin | '')
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {ORIGIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Scheme Type
              </label>
              <select
                value={schemeFilter}
                onChange={(e) =>
                  setSchemeFilter(e.target.value as NhisSchemeType | '')
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {SCHEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Profiles Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <SkeletonList count={5} />
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Shield size={48} className="mb-4 opacity-50" />
            <p className="font-medium">No profiles found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Patient
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Origin
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Scheme
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tariff Group
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {profile.patient?.first_name}{' '}
                          {profile.patient?.surname}
                        </p>
                        <p className="text-xs text-gray-500">
                          {profile.patient?.emr_number ||
                            profile.patient?.patient_id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getOriginBadge(profile.patient_origin)}
                  </td>
                  <td className="px-4 py-3">
                    {getSchemeBadge(profile.scheme_type)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{profile.tariff_group}</span>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(profile.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (profile.patient) {
                          setSelectedProfileModal({
                            patient: profile.patient as PatientDTO,
                            nhisProfile: profile,
                          });
                        }
                      }}
                      className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm font-medium"
                      title="View Full Profile"
                    >
                      <Eye size={16} />
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Enhanced Patient Profile Modal with NHIS Details */}
      {selectedProfileModal && (
        <EnhancedPatientProfileModal
          isOpen={!!selectedProfileModal}
          onClose={() => setSelectedProfileModal(null)}
          patient={selectedProfileModal.patient}
          nhisProfile={selectedProfileModal.nhisProfile}
          showEdit={false}
        />
      )}
    </div>
  );
}

export default NhisProfilesList;
