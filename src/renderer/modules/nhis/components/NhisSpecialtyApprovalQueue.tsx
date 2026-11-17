// =============================================================================
// NHIS Specialty Approval Queue Component — XenoCare Branded
// =============================================================================
// Displays internal specialty referrals (Dental, Ophthalmology, Physiotherapy, etc.)
// that require NHIS authorization before the patient can be seen at the specialty clinic.
//
// Workflow:
// 1. Doctor refers NHIS patient to specialty clinic
// 2. Referral appears here for NHIS desk approval
// 3. NHIS officer approves (regular or provisional)
// 4. Patient then appears in specialty clinic queue
// =============================================================================

import React, { useState, useEffect, startTransition } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Stethoscope,
  Calendar,
  CalendarCheck,
  FileText,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Shield,
  Search,
  Eye,
  Smile,
  Activity,
  Hourglass,
  ArrowRight,
  Scissors,
  Building2,
  X,
  Hash,
  Info,
  Maximize2,
  Minimize2,
  FlaskConical,
  ScanLine,
  Plus,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { Button } from '../../../components/ui/FormElements';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import { supabase } from '../../../api/supabaseClient';
import { formatDetailedAge } from '../../patient-registration/dtos/patient.dto';
import { SkeletonList } from '../../../components/ui/SkeletonLoader';
import { useBookedNhisReferrals } from '../hooks/useNhis';
import type { BookedNhisReferral } from '../api/nhis.api';
import { PayerDetailsCard } from './PayerDetailsCard';
import type { PayerInfo } from '../../../types/database.types';
import { formatClinicalTextForDisplay } from '../../../utils/clinicalTextFormatter';

// =============================================================================
// Types
// =============================================================================

interface PatientBioData {
  patient_category: string | null;
  title: string | null;
  rank: string | null;
  service_number: string | null;
  military_branch: string | null;
  date_of_birth: string | null;
  emr_number: string | null;
  gender: string | null;
  residential_address: string | null;
  nhis_number: string | null;
  hmo_scheme: string | null;
  payer_info: PayerInfo | null;
  insurance_type: string | null;
}

interface InvestigationData {
  labRequests: Array<{
    test_name: string;
    status: string;
    result: string | null;
    result_notes: string | null;
  }>;
  radiologyRequests: Array<{
    imaging_type: string;
    body_part: string | null;
    status: string;
    findings: string | null;
    impression: string | null;
  }>;
}

interface SpecialtyReferralItem {
  id: string;
  patient_id: string;
  patient_name: string;
  emr_number: string;
  encounter_id: string;
  encounter_number?: string; // Human-readable encounter number (e.g., "ENC-00001")
  specialty: string;
  referral_reason: string;
  clinical_notes?: string;
  clinical_findings?: string;
  provisional_diagnosis?: string;
  urgency: 'Routine' | 'Urgent' | 'Stat' | 'Emergency';
  referred_by: string;
  referred_by_name?: string;
  referred_at: string;
  nhis_status: 'pending' | 'approved' | 'provisional' | 'rejected';
  nhis_authorization_id?: string;
  nhis_approval_notes?: string;
  approved_by?: string;
  approved_at?: string;
}

interface NhisSpecialtyApprovalQueueProps {
  items?: SpecialtyReferralItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onApprove?: (
    item: SpecialtyReferralItem,
    isProvisional: boolean,
    notes?: string,
    authorizationCode?: string,
  ) => Promise<void>;
  onReject?: (item: SpecialtyReferralItem, reason: string) => Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

const SPECIALTY_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  dental: {
    icon: Smile,
    label: 'Dental',
    color: 'text-amber-600 bg-amber-100',
  },
  ophthalmology: {
    icon: Eye,
    label: 'Ophthalmology',
    color: 'text-blue-600 bg-blue-100',
  },
  physiotherapy: {
    icon: Activity,
    label: 'Physiotherapy',
    color: 'text-green-600 bg-green-100',
  },
  cardiology: {
    icon: Stethoscope,
    label: 'Cardiology',
    color: 'text-red-600 bg-red-100',
  },
  orthopaedics: {
    icon: Stethoscope,
    label: 'Orthopaedics',
    color: 'text-gray-600 bg-gray-100',
  },
  dermatology: {
    icon: Stethoscope,
    label: 'Dermatology',
    color: 'text-pink-600 bg-pink-100',
  },
  urology: {
    icon: Activity,
    label: 'Urology',
    color: 'text-purple-600 bg-purple-100',
  },
  gastroenterology: {
    icon: Activity,
    label: 'Gastroenterology',
    color: 'text-orange-600 bg-orange-100',
  },
  nephrology: {
    icon: Stethoscope,
    label: 'Nephrology',
    color: 'text-teal-600 bg-teal-100',
  },
  paediatrics: {
    icon: Stethoscope,
    label: 'Paediatrics',
    color: 'text-sky-600 bg-sky-100',
  },
  neurosurgery: {
    icon: Stethoscope,
    label: 'Neurosurgery',
    color: 'text-indigo-600 bg-indigo-100',
  },
  neurology: {
    icon: Stethoscope,
    label: 'Neurology',
    color: 'text-violet-600 bg-violet-100',
  },
  neuropsychiatry: {
    icon: Stethoscope,
    label: 'Neuropsychiatry',
    color: 'text-fuchsia-600 bg-fuchsia-100',
  },
  general_surgery: {
    icon: Scissors,
    label: 'General Surgery',
    color: 'text-slate-600 bg-slate-100',
  },
  gynaecology: {
    icon: Stethoscope,
    label: 'Gynaecology',
    color: 'text-rose-600 bg-rose-100',
  },
  oral_maxillofacial: {
    icon: Smile,
    label: 'Oral & Maxillofacial',
    color: 'text-amber-700 bg-amber-100',
  },
  pulmonology: {
    icon: Stethoscope,
    label: 'Pulmonology',
    color: 'text-cyan-600 bg-cyan-100',
  },
  endocrinology: {
    icon: Activity,
    label: 'Endocrinology',
    color: 'text-emerald-600 bg-emerald-100',
  },
  plastic_surgery: {
    icon: Stethoscope,
    label: 'Plastic Surgery',
    color: 'text-pink-500 bg-pink-100',
  },
  nutrition: {
    icon: Stethoscope,
    label: 'Nutrition',
    color: 'text-lime-700 bg-lime-100',
  },
  ent: {
    icon: Stethoscope,
    label: 'ENT (Ear, Nose, Throat)',
    color: 'text-yellow-600 bg-yellow-100',
  },
  other: {
    icon: Stethoscope,
    label: 'Other',
    color: 'text-gray-600 bg-gray-100',
  },
};

const URGENCY_COLORS: Record<string, string> = {
  Routine: 'bg-gray-100 text-gray-700',
  Urgent: 'bg-orange-100 text-orange-700',
  Stat: 'bg-red-100 text-red-700',
  Emergency: 'bg-red-200 text-red-800',
};

const PROVISIONAL_REASONS = [
  'NHIS HQ delay in issuing authorization code',
  'Emergency care required',
  'After hours - NHIS portal unavailable',
  'System connectivity issues',
  'Awaiting confirmation from HMO',
  'Other (specify in notes)',
];

function normalizeSearchValue(value: string | null | undefined): string {
  return (value || '').toLowerCase();
}

// =============================================================================
// Component
// =============================================================================

export function NhisSpecialtyApprovalQueue({
  items = [],
  isLoading = false,
  onRefresh,
  onApprove,
  onReject,
}: NhisSpecialtyApprovalQueueProps) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'referrals' | 'booked'>(
    'referrals',
  );
  const [processingId, setProcessingId] = useState<string | null>(null);

  // New Booking State
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  // Booking Form State
  const [bookingPatientSearch, setBookingPatientSearch] = useState('');
  const [bookingSelectedPatient, setBookingSelectedPatient] =
    useState<any>(null); // Ideally proper type
  const [bookingSpecialty, setBookingSpecialty] = useState<string>('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [bookingUrgency, setBookingUrgency] = useState('Routine');

  // Detail Modal State for Booked Items (Read-only view)
  const [viewBookingModalOpen, setViewBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<BookedNhisReferral | null>(null);

  // Modal states
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<SpecialtyReferralItem | null>(null);
  const [isProvisional, setIsProvisional] = useState(false);
  const [provisionalReason, setProvisionalReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  const toggleSection = (key: string) => {
    setCollapsedSections((prev: Record<string, boolean>) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Booked NHIS referrals (view-only section)
  const { data: bookedNhisReferrals = [], isLoading: isLoadingBooked } =
    useBookedNhisReferrals();

  // Group booked referrals by specialty
  const bookedBySpecialty = React.useMemo(() => {
    const groups: Record<string, BookedNhisReferral[]> = {};
    for (const ref of bookedNhisReferrals) {
      const key = ref.specialty_module || 'other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(ref);
    }
    return groups;
  }, [bookedNhisReferrals]);

  // Extra Data State
  const [patientBio, setPatientBio] = useState<PatientBioData | null>(null);
  const [investigationData, setInvestigationData] = useState<InvestigationData>(
    { labRequests: [], radiologyRequests: [] },
  );
  const [bioLoading, setBioLoading] = useState(false);

  // Fetch extra data when modal opens
  React.useEffect(() => {
    if (!selectedItem || !selectedItem.patient_id) return;

    // Debug: Log the selected item to see what diagnosis fields are available
    const loadData = async () => {
      setBioLoading(true);
      try {
        // 1. Fetch Patient Bio
        const { data: bio } = await supabase
          .from('patients')
          .select(
            'patient_category, title, rank, service_number, military_branch, date_of_birth, emr_number, gender, residential_address, nhis_number, hmo_scheme, payer_info, insurance_type',
          )
          .eq('id', selectedItem.patient_id)
          .single();
        setPatientBio(bio);

        // 2. Fetch Investigations
        // Fetch lab requests
        let labQuery = supabase
          .from('lab_requests')
          .select('request_id, status, result, result_notes, test_id')
          .order('created_at', { ascending: false });

        if (selectedItem.encounter_id) {
          labQuery = labQuery.eq('encounter_id', selectedItem.encounter_id);
        } else {
          labQuery = labQuery
            .eq('patient_id', selectedItem.patient_id)
            .limit(10);
        }
        const { data: labData } = await labQuery;

        // Enrich Lab Test Names
        const testIds = (labData || [])
          .map((lr: any) => lr.test_id)
          .filter(Boolean);
        const testMap: Record<string, string> = {};
        if (testIds.length > 0) {
          const { data: tests } = await supabase
            .from('lab_test_catalogue')
            .select('id, name')
            .in('id', testIds);
          (tests || []).forEach((t: any) => {
            testMap[t.id] = t.name;
          });
        }

        // Fetch radiology requests
        let radQuery = supabase
          .from('radiology_requests')
          .select(
            'request_id, status, findings, impression, imaging_id, imaging_type, body_part',
          )
          .order('created_at', { ascending: false });

        if (selectedItem.encounter_id) {
          radQuery = radQuery.eq('encounter_id', selectedItem.encounter_id);
        } else {
          radQuery = radQuery
            .eq('patient_id', selectedItem.patient_id)
            .limit(10);
        }
        const { data: radData } = await radQuery;

        // Enrich Radiology Names
        const imgIds = (radData || [])
          .map((rr: any) => rr.imaging_id)
          .filter(Boolean);
        const imgMap: Record<
          string,
          { modality: string; body_part: string | null; name: string }
        > = {};
        if (imgIds.length > 0) {
          const { data: imgs } = await supabase
            .from('imaging_catalogue')
            .select('id, modality, body_part, name')
            .in('id', imgIds);
          (imgs || []).forEach((im: any) => {
            imgMap[im.id] = {
              modality: im.modality,
              body_part: im.body_part,
              name: im.name,
            };
          });
        }

        setInvestigationData({
          labRequests: (labData || []).map((lr: any) => ({
            test_name: testMap[lr.test_id] || 'Unknown Test',
            status: lr.status || 'Pending',
            result: lr.result,
            result_notes: lr.result_notes,
          })),
          radiologyRequests: (radData || []).map((rr: any) => {
            const cat = imgMap[rr.imaging_id];
            return {
              imaging_type: cat?.modality || rr.imaging_type || 'Unknown',
              body_part: cat?.body_part || rr.body_part || null,
              status: rr.status || 'Pending',
              findings: rr.findings,
              impression: rr.impression,
            };
          }),
        });
      } catch (err) {
        console.error('Error fetching approval data', err);
      } finally {
        setBioLoading(false);
      }
    };

    loadData();
  }, [selectedItem]);

  // Filter items
  const filteredItems = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      normalizeSearchValue(item.patient_name).includes(query) ||
      normalizeSearchValue(item.emr_number).includes(query) ||
      normalizeSearchValue(item.encounter_number).includes(query) ||
      normalizeSearchValue(item.referred_by_name).includes(query) ||
      normalizeSearchValue(item.specialty).includes(query);
    const matchesSpecialty =
      specialtyFilter === 'all' || item.specialty === specialtyFilter;
    return matchesSearch && matchesSpecialty && item.nhis_status === 'pending';
  });

  // Filter Bookings
  const filteredBookings = bookedNhisReferrals.filter((item) => {
    const query = bookingSearchQuery.toLowerCase();
    const searchMatch =
      !bookingSearchQuery ||
      normalizeSearchValue(item.patient_name).includes(query) ||
      normalizeSearchValue(item.emr_number).includes(query) ||
      normalizeSearchValue(item.specialty_module).includes(query);

    // Optional: Add specialty filter if needed, or reuse the main one but ensure it's not confusing
    // For now just search.
    return searchMatch;
  });

  // Stats
  const pendingCount = items.filter((i) => i.nhis_status === 'pending').length;
  const urgentCount = items.filter(
    (i) =>
      i.nhis_status === 'pending' &&
      (i.urgency === 'Urgent' || i.urgency === 'Emergency'),
  ).length;
  const selectedClinicalFindings = formatClinicalTextForDisplay(
    selectedItem?.clinical_findings,
  );
  const selectedProvisionalDiagnosis = formatClinicalTextForDisplay(
    selectedItem?.provisional_diagnosis,
  );

  const handleOpenApproveModal = (item: SpecialtyReferralItem) => {
    startTransition(() => {
      setSelectedItem(item);
      setIsProvisional(false);
      setProvisionalReason('');
      setApprovalNotes('');
      setAuthorizationCode('');
      setApproveModalOpen(true);
    });
  };

  const handleOpenRejectModal = (item: SpecialtyReferralItem) => {
    startTransition(() => {
      setSelectedItem(item);
      setRejectionReason('');
      setRejectModalOpen(true);
    });
  };

  type ApprovalModalSnapshot = {
    item: SpecialtyReferralItem;
    isProvisional: boolean;
    provisionalReason: string;
    approvalNotes: string;
    authorizationCode: string;
  };

  type RejectModalSnapshot = {
    item: SpecialtyReferralItem;
    rejectionReason: string;
  };

  const closeApproveModal = () => {
    setApproveModalOpen(false);
    setSelectedItem(null);
  };

  const closeRejectModal = () => {
    setRejectModalOpen(false);
    setSelectedItem(null);
  };

  const restoreApproveModal = (
    snapshot: ApprovalModalSnapshot,
    message: string,
  ) => {
    startTransition(() => {
      setSelectedItem(snapshot.item);
      setIsProvisional(snapshot.isProvisional);
      setProvisionalReason(snapshot.provisionalReason);
      setApprovalNotes(snapshot.approvalNotes);
      setAuthorizationCode(snapshot.authorizationCode);
      setApproveModalOpen(true);
    });
    showToast({
      title: 'Error',
      message,
      type: 'error',
    });
  };

  const restoreRejectModal = (
    snapshot: RejectModalSnapshot,
    message: string,
  ) => {
    startTransition(() => {
      setSelectedItem(snapshot.item);
      setRejectionReason(snapshot.rejectionReason);
      setRejectModalOpen(true);
    });
    showToast({
      title: 'Error',
      message,
      type: 'error',
    });
  };

  const handleApprove = async () => {
    if (!selectedItem || !onApprove) return;

    if (isProvisional && !provisionalReason) {
      showToast({
        title: 'Reason Required',
        message: 'Please select a reason for provisional approval',
        type: 'error',
      });
      return;
    }

    // Authorization code is required for regular approval
    if (!isProvisional && !authorizationCode.trim()) {
      showToast({
        title: 'Authorization Code Required',
        message:
          'Please enter the NHIS authorization code for regular approval',
        type: 'error',
      });
      return;
    }

    setProcessingId(selectedItem.id);
    const snapshot: ApprovalModalSnapshot = {
      item: selectedItem,
      isProvisional,
      provisionalReason,
      approvalNotes,
      authorizationCode,
    };

    startTransition(() => {
      closeApproveModal();
    });
    showToast({
      title: 'Processing',
      message: isProvisional
        ? 'Provisional approval is being processed.'
        : 'Referral approval is being processed.',
      type: 'info',
    });

    try {
      const notes = isProvisional ? provisionalReason : approvalNotes;
      await onApprove(
        selectedItem,
        isProvisional,
        notes,
        isProvisional ? undefined : authorizationCode,
      );
      showToast({
        title: isProvisional ? 'Provisionally Approved' : 'Approved',
        message: `Referral to ${SPECIALTY_CONFIG[selectedItem.specialty]?.label || selectedItem.specialty} has been ${isProvisional ? 'provisionally ' : ''}approved. Patient will now appear in the specialty queue.`,
        type: 'success',
      });
    } catch (error) {
      restoreApproveModal(
        snapshot,
        error instanceof Error ? error.message : 'Failed to approve referral',
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || !onReject || !rejectionReason.trim()) return;

    setProcessingId(selectedItem.id);
    const snapshot: RejectModalSnapshot = {
      item: selectedItem,
      rejectionReason,
    };

    startTransition(() => {
      closeRejectModal();
    });
    showToast({
      title: 'Processing',
      message: 'Referral rejection is being processed.',
      type: 'info',
    });

    try {
      await onReject(selectedItem, rejectionReason);
      showToast({
        title: 'Referral Rejected',
        message: 'The specialty referral has been rejected.',
        type: 'info',
      });
    } catch (error) {
      restoreRejectModal(
        snapshot,
        error instanceof Error ? error.message : 'Failed to reject referral',
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('referrals')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'referrals'
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} />
            <span>Referral Queue</span>
            {pendingCount > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('booked')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'booked'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarCheck size={16} />
            <span>Bookings</span>
            {bookedNhisReferrals.length > 0 && (
              <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {bookedNhisReferrals.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'referrals' && urgentCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-full border border-red-100 shadow-sm">
              <AlertTriangle size={14} className="animate-pulse" />
              <span className="text-xs font-bold">{urgentCount} Urgent</span>
            </div>
          )}
          {activeTab === 'referrals' && onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all shadow-sm"
              title="Refresh queue"
            >
              <RefreshCw size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Filters (Only for Referrals) */}
      {activeTab === 'referrals' && (
        <div className="flex items-center gap-6 bg-white rounded-xl border-2 border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name or patient number..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
            />
          </div>
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="px-4 py-3 border-2 border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-primary-700 focus:border-primary-700 min-w-[200px] font-medium"
          >
            <option value="all">All Specialties</option>
            {Object.entries(SPECIALTY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ================================================================= */}
      {/* BOOKED APPOINTMENTS — List View & New Booking                     */}
      {/* ================================================================= */}
      {activeTab === 'booked' && (
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={bookingSearchQuery}
                onChange={(e) => setBookingSearchQuery(e.target.value)}
                placeholder="Search bookings by patient, EMR, or specialty..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <button
              onClick={() => setBookingModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-95"
            >
              <Plus size={16} />
              Book Appointment
            </button>
          </div>

          {/* Bookings Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {isLoadingBooked ? (
              <div className="p-4">
                <SkeletonList count={5} />
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <CalendarCheck size={48} className="mx-auto mb-3 opacity-20" />
                <p className="font-medium text-gray-600">No bookings found</p>
                <p className="text-sm mt-1">
                  Try adjusting your search or create a new appointment
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">
                        Patient Details
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">
                        Specialty Clinic
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">
                        Appointment
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">
                        Status
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredBookings.map((ref) => {
                      const specialtyConfig =
                        SPECIALTY_CONFIG[ref.specialty_module] ||
                        SPECIALTY_CONFIG.other;
                      const SpecIcon = specialtyConfig.icon;

                      return (
                        <tr
                          key={ref.id}
                          onClick={() => {
                            setSelectedBooking(ref);
                            setViewBookingModalOpen(true);
                          }}
                          className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">
                                {ref.patient_name}
                              </span>
                              <span className="font-mono text-xs text-gray-500 mt-0.5">
                                {ref.emr_number}
                              </span>
                              {ref.nhis_number && (
                                <span className="inline-flex mt-1 text-xs font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit">
                                  NHIS: {ref.nhis_number}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-1.5 rounded-lg ${specialtyConfig.color.split(' ')[1]} shrink-0`}
                              >
                                <SpecIcon
                                  size={14}
                                  className={
                                    specialtyConfig.color.split(' ')[0]
                                  }
                                />
                              </div>
                              <span
                                className={`font-semibold text-sm ${specialtyConfig.color.split(' ')[0]}`}
                              >
                                {specialtyConfig.label}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-gray-500 pl-8">
                              Ref: Dr. {ref.referred_by_name}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {ref.appointment_date ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-gray-900">
                                  <Calendar
                                    size={12}
                                    className="text-gray-400"
                                  />
                                  {format(
                                    parseISO(ref.appointment_date),
                                    'dd MMM yyyy',
                                  )}
                                </div>
                                {ref.appointment_time && (
                                  <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium ml-4">
                                    <Clock size={10} />
                                    {ref.appointment_time}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">
                                Not scheduled
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span
                                className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                  ref.urgency === 'Emergency'
                                    ? 'bg-red-50 text-red-700 border border-red-100'
                                    : ref.urgency === 'Urgent'
                                      ? 'bg-orange-50 text-orange-700 border border-orange-100'
                                      : 'bg-green-50 text-green-700 border border-green-100'
                                }`}
                              >
                                {ref.urgency}
                              </span>
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                Awaiting Encounter
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              className="text-blue-600 hover:text-blue-800 text-xs font-bold hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBooking(ref);
                                setViewBookingModalOpen(true);
                              }}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Queue List - Pending Approval Table (Only for Referrals) */}
      {activeTab === 'referrals' && (
        <>
          {isLoading ? (
            <SkeletonList count={5} />
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-700/10 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-primary-700" />
              </div>
              <p className="text-gray-800 font-bold text-lg">
                No Pending Referrals
              </p>
              <p className="text-sm text-gray-500 mt-1">
                All specialty referrals have been processed
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs w-[180px]">
                        Patient
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">
                        Target Specialty
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs">
                        Referred By
                      </th>
                      <th className="px-6 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((item) => {
                      const specialtyConfig =
                        SPECIALTY_CONFIG[item.specialty] ||
                        SPECIALTY_CONFIG.other;
                      const SpecialtyIcon = specialtyConfig.icon;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50/80 transition-colors group"
                        >
                          {/* Patient Column */}
                          <td className="px-6 py-4 align-top">
                            <div className="flex flex-col">
                              <span
                                className="font-bold text-gray-900 line-clamp-1"
                                title={item.patient_name}
                              >
                                {item.patient_name}
                              </span>
                              <span className="font-mono text-xs text-gray-500 mt-0.5">
                                {item.emr_number}
                              </span>
                              <span className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                <Clock size={10} />
                                <span>
                                  {formatDistanceToNow(
                                    new Date(item.referred_at),
                                    { addSuffix: true },
                                  )}
                                </span>
                              </span>
                            </div>
                          </td>

                          {/* Specialty Column */}
                          <td className="px-6 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-1.5 rounded-lg ${specialtyConfig.color.split(' ')[1]} shrink-0`}
                              >
                                <SpecialtyIcon
                                  size={14}
                                  className={
                                    specialtyConfig.color.split(' ')[0]
                                  }
                                />
                              </div>
                              <div>
                                <p
                                  className={`font-semibold text-sm ${specialtyConfig.color.split(' ')[0]}`}
                                >
                                  {specialtyConfig.label}
                                </p>
                                {item.encounter_number && (
                                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                                    {item.encounter_number}
                                  </p>
                                )}
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold mt-1 ${
                                    item.urgency === 'Emergency'
                                      ? 'bg-red-50 text-red-700'
                                      : item.urgency === 'Urgent'
                                        ? 'bg-orange-50 text-orange-700'
                                        : 'bg-green-50 text-green-700'
                                  }`}
                                >
                                  {item.urgency}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Referred By */}
                          <td className="px-6 py-4 align-top">
                            <div className="flex items-center gap-2 text-gray-700">
                              <User
                                size={14}
                                className="text-gray-400 shrink-0"
                              />
                              <span className="font-medium text-xs">
                                Dr. {item.referred_by_name || 'Unknown'}
                              </span>
                            </div>
                            {/* Compact Clinical Summary */}
                            {(item.provisional_diagnosis ||
                              item.referral_reason) && (
                              <p
                                className="text-xs text-gray-500 mt-1 line-clamp-1 max-w-[200px]"
                                title={
                                  formatClinicalTextForDisplay(
                                    item.provisional_diagnosis,
                                  ) || item.referral_reason
                                }
                              >
                                {formatClinicalTextForDisplay(
                                  item.provisional_diagnosis,
                                ) || item.referral_reason}
                              </p>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 align-top text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenRejectModal(item)}
                                disabled={processingId === item.id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Reject Referral"
                              >
                                <XCircle size={18} />
                              </button>
                              <button
                                onClick={() => handleOpenApproveModal(item)}
                                disabled={processingId === item.id}
                                className="px-3 py-1.5 bg-primary-700 text-white text-xs font-medium rounded-lg hover:bg-primary-800 shadow-sm flex items-center gap-1.5 transition-all"
                              >
                                {processingId === item.id ? (
                                  <RefreshCw
                                    size={12}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <CheckCircle size={12} />
                                )}
                                Process
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Approve Modal — XenoCare Branded */}
      {approveModalOpen && selectedItem && (
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 ${isExpanded ? 'p-0' : ''}`}
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <div
            className={`bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isExpanded ? 'w-full h-full fixed inset-0 rounded-none' : 'w-full max-w-6xl h-[90vh] rounded-xl'}`}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-primary-700 to-[#008545] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center p-1.5 backdrop-blur-sm border border-white/10">
                  
                </div>
                <div className="border-l border-white/20 pl-4">
                  <h3 className="text-lg font-bold text-white tracking-tight leading-tight">
                    Approve Specialty Referral
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-semibold text-green-50">
                      {selectedItem.patient_name}
                    </span>
                    <span className="text-white/30">•</span>
                    <span className="font-mono text-xs bg-white/10 px-2 py-0.5 rounded text-white border border-white/10">
                      {selectedItem.emr_number}
                    </span>
                    <span className="text-white/30">•</span>
                    {(() => {
                      const now = new Date();
                      const then = new Date(selectedItem.referred_at);
                      const diffMs = now.getTime() - then.getTime();
                      const totalMins = Math.floor(diffMs / 60000);
                      const hours = Math.floor(totalMins / 60);
                      const days = Math.floor(hours / 24);
                      const mins = totalMins % 60;
                      const remainHours = hours % 24;
                      let durText = '';
                      if (days > 0)
                        durText = `${days}d ${remainHours}h waiting`;
                      else if (hours > 0)
                        durText = `${hours}h ${mins}m waiting`;
                      else durText = `${mins}m waiting`;
                      return (
                        <span className="text-xs font-semibold text-amber-200 bg-white/10 px-2 py-0.5 rounded border border-white/10 flex items-center gap-1">
                          <Clock size={10} />
                          {durText}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/10 rounded-lg text-green-100 hover:text-white transition-colors"
                  title={isExpanded ? 'Exit Full Screen' : 'Full Screen'}
                >
                  {isExpanded ? (
                    <Minimize2 size={18} />
                  ) : (
                    <Maximize2 size={18} />
                  )}
                </button>
                <button
                  onClick={() => setApproveModalOpen(false)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body — Split Layout */}
            <div
              className={`flex-1 overflow-hidden flex ${isExpanded ? 'flex-row' : 'flex-col lg:flex-row'}`}
            >
              {/* LEFT PANEL: Clinical Info & Summary */}
              <div
                className={`overflow-y-auto border-r border-gray-100 bg-gray-50/30 ${isExpanded ? 'w-1/2' : 'w-full lg:w-[55%]'}`}
              >
                <div className="p-5 space-y-4">
                  {/* Patient Bio-Data — Collapsible */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggleSection('bio')}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 flex items-center gap-2 hover:from-gray-100 hover:to-gray-150 transition-colors"
                    >
                      <User size={14} className="text-primary-700" />
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex-1 text-left">
                        Patient Bio-Data
                      </span>
                      {bioLoading && (
                        <RefreshCw
                          size={12}
                          className="text-gray-400 animate-spin"
                        />
                      )}
                      <ChevronDown
                        size={14}
                        className={`text-gray-400 transition-transform ${collapsedSections.bio ? '-rotate-90' : ''}`}
                      />
                    </button>
                    {!collapsedSections.bio && (
                      <div className="p-4 grid grid-cols-3 gap-x-4 gap-y-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Full Name
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-0.5">
                            {selectedItem.patient_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            EMR NUMBER
                          </p>
                          <p className="text-sm font-bold text-primary-700 mt-0.5 font-mono">
                            {patientBio?.emr_number || selectedItem.emr_number}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Category
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">
                            {patientBio?.patient_category || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Age/DOB
                          </p>
                          <p className="text-sm text-gray-900 mt-0.5">
                            {patientBio?.date_of_birth
                              ? `${formatDetailedAge(patientBio.date_of_birth)}`
                              : 'N/A'}
                          </p>
                        </div>
                        {patientBio?.rank && (
                          <div className="col-span-2">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Rank & Service
                            </p>
                            <p className="text-sm text-gray-900 mt-0.5">
                              {patientBio.rank}{' '}
                              {patientBio.service_number
                                ? `(${patientBio.service_number})`
                                : ''}
                            </p>
                          </div>
                        )}
                        {patientBio?.nhis_number && (
                          <div className="col-span-3 pt-2 mt-1 border-t border-gray-100">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                  NHIS Number
                                </p>
                                <p className="text-sm font-bold text-emerald-700 mt-0.5 font-mono">
                                  {patientBio.nhis_number}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                  HMO Scheme
                                </p>
                                <p className="text-sm text-gray-900 mt-0.5">
                                  {patientBio.hmo_scheme || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payer / Scheme Details */}
                  <PayerDetailsCard
                    payerInfo={patientBio?.payer_info as PayerInfo | null}
                    nhisNumber={patientBio?.nhis_number}
                    insuranceType={patientBio?.insurance_type}
                    patientCategory={patientBio?.patient_category}
                    hmoScheme={patientBio?.hmo_scheme}
                    compact
                  />

                  {/* Referral Summary (Existing) */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                      <Stethoscope size={14} className="text-primary-700" />
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Referral Summary
                      </span>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Target Specialty
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {(() => {
                            const sc =
                              SPECIALTY_CONFIG[selectedItem.specialty] ||
                              SPECIALTY_CONFIG.other;
                            const SI = sc.icon;
                            return (
                              <SI
                                size={16}
                                className={sc.color.split(' ')[0]}
                              />
                            );
                          })()}
                          <span className="text-sm font-bold text-gray-800">
                            {SPECIALTY_CONFIG[selectedItem.specialty]?.label ||
                              selectedItem.specialty}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Urgency Level
                        </p>
                        <span
                          className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${URGENCY_COLORS[selectedItem.urgency]}`}
                        >
                          {selectedItem.urgency}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Referring Doctor
                        </p>
                        <p className="text-sm text-gray-900 mt-1 font-medium flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          Dr. {selectedItem.referred_by_name || 'Unknown'}{' '}
                          (Consultant)
                        </p>
                      </div>
                      {/* Show diagnosis information with multiple fallbacks */}
                      {(selectedProvisionalDiagnosis ||
                        selectedItem.referral_reason ||
                        selectedClinicalFindings) && (
                        <div className="col-span-2">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {selectedProvisionalDiagnosis
                              ? 'Provisional Diagnosis'
                              : 'Clinical Indication / Diagnosis'}
                          </p>
                          <div className="text-sm text-gray-800 bg-primary-700/5 rounded-lg p-2 border border-primary-700/10 mt-1 font-medium">
                            {selectedProvisionalDiagnosis ||
                              selectedItem.referral_reason ||
                              selectedClinicalFindings}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clinical Details (Enriched) */}
                  <div className="bg-white rounded-xl border border-primary-700/20 overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggleSection('clinical')}
                      className="w-full px-4 py-2.5 bg-primary-700/5 border-b border-primary-700/15 flex items-center gap-2 hover:bg-primary-700/10 transition-colors"
                    >
                      <FileText size={14} className="text-primary-700" />
                      <span className="text-xs font-bold text-primary-700 uppercase tracking-wider flex-1 text-left">
                        Clinical Details
                      </span>
                      <ChevronDown
                        size={14}
                        className={`text-primary-700/40 transition-transform ${collapsedSections.clinical ? '-rotate-90' : ''}`}
                      />
                    </button>
                    {!collapsedSections.clinical && (
                      <div className="p-4 space-y-4">
                        {selectedClinicalFindings && (
                          <div>
                            <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider mb-1">
                              Clinical Findings
                            </p>
                            <div className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100 leading-relaxed font-medium">
                              {selectedClinicalFindings}
                            </div>
                          </div>
                        )}
                        {selectedProvisionalDiagnosis && (
                          <div>
                            <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider mb-1">
                              Provisional Diagnosis
                            </p>
                            <div className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100 font-medium">
                              {selectedProvisionalDiagnosis}
                            </div>
                          </div>
                        )}

                        {/* Reason for Referral */}
                        {selectedItem.referral_reason && (
                          <div>
                            <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider mb-1">
                              Reason for Referral
                            </p>
                            <div className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100 leading-relaxed font-medium">
                              {selectedItem.referral_reason}
                            </div>
                          </div>
                        )}

                        {/* Clinical Notes */}
                        {selectedItem.clinical_notes && (
                          <div>
                            <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider mb-1">
                              Clinical Notes
                            </p>
                            <div className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100 leading-relaxed">
                              {selectedItem.clinical_notes}
                            </div>
                          </div>
                        )}

                        {!selectedClinicalFindings &&
                          !selectedProvisionalDiagnosis && (
                            <div className="text-center py-6">
                              <Activity className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                              <p className="text-sm text-gray-400 italic">
                                No detailed clinical data provided by referring
                                doctor.
                              </p>
                            </div>
                          )}
                      </div>
                    )}
                  </div>

                  {/* Investigations — Collapsible (NEW) */}
                  <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggleSection('investigations')}
                      className="w-full px-4 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-2 hover:bg-blue-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1">
                          <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center border border-white z-10">
                            <FlaskConical size={10} className="text-blue-700" />
                          </div>
                          <div className="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center border border-white">
                            <ScanLine size={10} className="text-indigo-700" />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider text-left">
                          Investigations
                        </span>
                      </div>

                      <div className="flex-1" />

                      {investigationData.labRequests.length +
                        investigationData.radiologyRequests.length >
                        0 && (
                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full scale-90">
                          {investigationData.labRequests.length +
                            investigationData.radiologyRequests.length}{' '}
                          Results
                        </span>
                      )}
                      {bioLoading && (
                        <RefreshCw
                          size={12}
                          className="text-blue-400 animate-spin ml-2"
                        />
                      )}
                      <ChevronDown
                        size={14}
                        className={`text-blue-400 transition-transform ml-2 ${collapsedSections.investigations ? '-rotate-90' : ''}`}
                      />
                    </button>
                    {!collapsedSections.investigations && (
                      <div className="p-4 space-y-4">
                        {investigationData.labRequests.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {/* <FlaskConical size={13} className="text-purple-600" /> */}
                              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                                Laboratory
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {investigationData.labRequests.map((lr, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-purple-100 hover:bg-purple-50/50 transition-colors"
                                >
                                  <span className="text-sm text-gray-800 font-medium">
                                    {lr.test_name}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                        lr.status?.toLowerCase() === 'completed'
                                          ? 'bg-green-100 text-green-700'
                                          : lr.status?.toLowerCase() ===
                                              'in_progress'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {lr.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {investigationData.radiologyRequests.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              {/* <ScanLine size={13} className="text-indigo-600" /> */}
                              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                Imaging
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {investigationData.radiologyRequests.map(
                                (rr, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-gray-50 rounded-lg px-3 py-2 border border-indigo-100 hover:bg-indigo-50/50 transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-800 font-medium">
                                        {rr.imaging_type}
                                        {rr.body_part
                                          ? ` — ${rr.body_part}`
                                          : ''}
                                      </span>
                                      <span
                                        className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                          rr.status?.toLowerCase() ===
                                          'completed'
                                            ? 'bg-green-100 text-green-700'
                                            : rr.status?.toLowerCase() ===
                                                'in_progress'
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-amber-100 text-amber-700'
                                        }`}
                                      >
                                        {rr.status}
                                      </span>
                                    </div>
                                    {rr.findings && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Findings: {rr.findings}
                                      </p>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                        {investigationData.labRequests.length === 0 &&
                          investigationData.radiologyRequests.length === 0 &&
                          !bioLoading && (
                            <div className="flex flex-col items-center justify-center py-4 bg-gray-50/50 rounded-lg">
                              <FlaskConical
                                size={20}
                                className="text-gray-300 mb-2"
                              />
                              <p className="text-sm text-gray-400 italic">
                                No investigation requests found
                              </p>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT PANEL: Logic & Actions */}
              <div
                className={`overflow-y-auto bg-white flex flex-col ${isExpanded ? 'w-1/2' : 'w-full lg:w-[45%]'}`}
              >
                <div className="p-6 space-y-5 flex-1">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Shield size={18} className="text-primary-700" />
                    <div>
                      <h4 className="font-bold text-gray-800">
                        Authorization Decision
                      </h4>
                      <p className="text-xs text-gray-400">
                        Select approval type and provide required codes.
                      </p>
                    </div>
                  </div>

                  {/* Approval Type Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                      Approval Mode
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsProvisional(false)}
                        className={`p-3 rounded-xl border-2 transition-all text-left relative overflow-hidden group ${
                          !isProvisional
                            ? 'border-primary-700 bg-primary-700/5'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex flex-col gap-1 relative z-10">
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-bold text-sm ${!isProvisional ? 'text-primary-700' : 'text-gray-600'}`}
                            >
                              Regular
                            </span>
                            {!isProvisional && (
                              <CheckCircle
                                size={16}
                                className="text-primary-700"
                              />
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            Official Code
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsProvisional(true)}
                        className={`p-3 rounded-xl border-2 transition-all text-left relative overflow-hidden group ${
                          isProvisional
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex flex-col gap-1 relative z-10">
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-bold text-sm ${isProvisional ? 'text-amber-700' : 'text-gray-600'}`}
                            >
                              Provisional
                            </span>
                            {isProvisional && (
                              <Hourglass size={16} className="text-amber-600" />
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            Pending Code
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Form Content */}
                  <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-200 space-y-4">
                    {/* Authorization Code (for regular approval) */}
                    {!isProvisional && (
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                          Authorization Code{' '}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Hash
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          />
                          <input
                            type="text"
                            value={authorizationCode}
                            onChange={(e) =>
                              setAuthorizationCode(e.target.value.toUpperCase())
                            }
                            placeholder="Enter NHIS Code"
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-700 focus:border-primary-700 font-mono uppercase text-sm shadow-sm"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5 ml-1">
                          Format: Usually starts with HMO code or State ID.
                        </p>
                      </div>
                    )}

                    {/* Provisional Reason */}
                    {isProvisional && (
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                          Reason for Provisional{' '}
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={provisionalReason}
                          onChange={(e) => setProvisionalReason(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm shadow-sm"
                        >
                          <option value="">Select reason...</option>
                          {PROVISIONAL_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Internal Notes{' '}
                        <span className="text-gray-300">(Optional)</span>
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        placeholder="Add notes for audit trail..."
                        rows={2}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-700 focus:border-primary-700 text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Impact Info */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3">
                    <div className="mt-0.5">
                      <Info size={16} className="text-blue-500" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-blue-700">
                        Workflow Impact
                      </h5>
                      <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                        Approving this referral will immediately allow the
                        patient to be seen at the{' '}
                        <strong>
                          {SPECIALTY_CONFIG[selectedItem.specialty]?.label}
                        </strong>{' '}
                        clinic.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Actions (Sticky) */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setApproveModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processingId !== null}
                    className={`flex-1 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${
                      isProvisional
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:to-amber-700'
                        : 'bg-gradient-to-r from-primary-700 to-[#008545] hover:to-primary-800'
                    }`}
                  >
                    {processingId ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />{' '}
                        Processing...
                      </>
                    ) : isProvisional ? (
                      <>
                        <Hourglass size={18} /> Confirm Provisional
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} /> Approve Referral
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* NEW BOOKING MODAL                                                 */}
      {/* ================================================================= */}
      {bookingModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-blue-600 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                  <CalendarCheck size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    New Specialty Booking
                  </h3>
                  <p className="text-sm text-blue-100">
                    Schedule an appointment for an NHIS patient
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBookingModalOpen(false)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Patient Search */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Patient Search <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search by Name, EMR, or NHIS Number..."
                    value={bookingPatientSearch}
                    onChange={(e) => setBookingPatientSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                  Start typing to find a registered NHIS patient.
                </p>
              </div>

              {/* Specialty & Urgency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Target Specialty <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bookingSpecialty}
                    onChange={(e) => setBookingSpecialty(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Select Specialty...</option>
                    {Object.entries(SPECIALTY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Urgency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={bookingUrgency}
                    onChange={(e) => setBookingUrgency(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    {Object.keys(URGENCY_COLORS).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Appointment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Time <span className="text-gray-300">(Optional)</span>
                  </label>
                  <input
                    type="time"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Booking Note / Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  placeholder="Brief reason for this appointment..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3">
                <Info size={16} className="text-blue-500 mt-0.5" />
                <div>
                  <p className="text-xs text-blue-700 font-bold">Next Steps</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Booking this appointment will place the patient in the
                    "Bookings" list. An encounter must then be created by
                    Nursing/Records before clinical documentation can begin.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-end justify-end gap-3 shrink-0">
              <button
                onClick={() => setBookingModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  showToast({
                    title: 'Booking Created',
                    message: 'Appointment booked successfully (Mock)',
                    type: 'success',
                  });
                  setBookingModalOpen(false);
                }}
                className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <CalendarCheck size={16} />
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* VIEW BOOKING DETAIL MODAL (Read Only)                             */}
      {/* ================================================================= */}
      {viewBookingModalOpen && selectedBooking && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <div className="bg-white shadow-2xl overflow-hidden flex flex-col w-full max-w-4xl h-[85vh] rounded-xl">
            {/* Header */}
            <div className="px-6 py-4 bg-blue-600 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                  <User size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Booking Details
                  </h3>
                  <div className="flex items-center gap-2 text-blue-100 text-sm">
                    <span className="font-semibold text-white">
                      {selectedBooking.patient_name}
                    </span>
                    <span>•</span>
                    <span className="font-mono bg-white/10 px-1.5 rounded">
                      {selectedBooking.emr_number}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewBookingModalOpen(false)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Patient & Appointment Info */}
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <CalendarCheck size={14} /> Appointment Info
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-500">Date</span>
                        <span className="text-sm font-bold text-gray-900">
                          {selectedBooking.appointment_date
                            ? format(
                                parseISO(selectedBooking.appointment_date),
                                'dd MMM yyyy',
                              )
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-500">Time</span>
                        <span className="text-sm font-bold text-gray-900">
                          {selectedBooking.appointment_time || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-500">
                          Target Clinic
                        </span>
                        <span className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {
                            SPECIALTY_CONFIG[
                              selectedBooking.specialty_module || 'other'
                            ]?.label
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-500">Urgency</span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${URGENCY_COLORS[selectedBooking.urgency] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {selectedBooking.urgency}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <User size={14} /> Patient Identifiers
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-400 uppercase">
                          Full Name
                        </p>
                        <p className="font-semibold text-gray-900">
                          {selectedBooking.patient_name}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 uppercase">
                            Patient number
                          </p>
                          <p className="font-mono text-sm font-bold text-gray-700">
                            {selectedBooking.emr_number}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase">
                            NHIS Number
                          </p>
                          <p className="font-mono text-sm font-bold text-emerald-600">
                            {selectedBooking.nhis_number || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Clinical Content */}
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm h-full">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <FileText size={14} /> Referral Details
                    </h4>

                    <div className="space-y-5">
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">
                          Reason for Referral / Booking
                        </p>
                        <p className="text-sm text-gray-800 leading-relaxed font-medium">
                          {selectedBooking.referral_reason ||
                            'No specific reason provided.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                          <User size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">
                            Referred By
                          </p>
                          <p className="text-xs text-gray-500">
                            Dr. {selectedBooking.referred_by_name}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100">
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle
                            size={18}
                            className="text-amber-600 shrink-0 mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-bold text-amber-800">
                              Action Required
                            </p>
                            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                              An encounter has not been created for this booking
                              yet. Please proceed to the{' '}
                              <strong>Patient Records</strong> or{' '}
                              <strong>Nursing Station</strong> module/station to
                              initiate the visit encounter. Once created, the
                              referral will appear in the "Referral Queue" for
                              NHIS approval.
                            </p>
                            {/* Placeholder for future "Create Encounter" action */}
                            <button
                              disabled
                              className="mt-3 px-4 py-2 bg-amber-200 text-amber-800 text-xs font-bold rounded-lg opacity-50 cursor-not-allowed w-full"
                            >
                              Create Encounter (Not Available Here)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal — XenoCare Branded */}
      {rejectModalOpen && selectedItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setRejectModalOpen(false)}
          />

          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                  <XCircle size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Reject Specialty Referral
                  </h3>
                  <p className="text-sm text-red-100">
                    {selectedItem.patient_name} —{' '}
                    {SPECIALTY_CONFIG[selectedItem.specialty]?.label}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to reject the referral for{' '}
                <strong className="text-gray-900">
                  {selectedItem.patient_name}
                </strong>{' '}
                to{' '}
                <strong className="text-gray-900">
                  {SPECIALTY_CONFIG[selectedItem.specialty]?.label}
                </strong>
                ? This will notify the referring doctor.
              </p>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this referral is being rejected..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processingId !== null}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {processingId ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />{' '}
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle size={14} /> Reject Referral
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NhisSpecialtyApprovalQueue;
