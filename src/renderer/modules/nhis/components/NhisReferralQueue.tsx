// =============================================================================
// NHIS Referral Queue Component
// Displays pending external referral verification requests for NHIS officers
// Shows comprehensive patient bio + clinical data for proper NHIS processing
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Building2,
  Calendar,
  FileText,
  RefreshCw,
  ChevronRight,
  Shield,
  Search,
  Filter,
  X,
  Stethoscope,
  Info,
  Heart,
  Activity,
  Clipboard,
  BedDouble,
  Phone,
  Hash,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { SkeletonTable } from '../../../components/ui/SkeletonLoader';
import { PayerDetailsCard } from './PayerDetailsCard';
import type { PayerInfo } from '../../../types/database.types';

// Types
interface ReferralQueueItem {
  id: string;
  patient_id: string;
  request_type: string;
  referral_code: string | null;
  referral_date: string | null;
  referral_source: string | null;
  referral_facility_nhis_id: string | null;
  clinical_basis: string | null;
  referring_clinician: string | null;
  days_since_referral: number | null;
  is_expired: boolean;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  priority: 'normal' | 'urgent' | 'emergency';
  requested_by: string | null;
  requested_at: string;
  request_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  processing_notes: string | null;
  rejection_reason: string | null;
  authorization_id: string | null;
  // Clinic selection for external NHIS (encounter created after approval)
  target_clinic_id?: string | null;
  target_doctor_id?: string | null;
  visit_type?: string | null;
  chief_complaint?: string | null;
  encounter_id?: string | null;

  // ============ CLINICAL DATA FIELDS (for NHIS officer review) ============
  diagnosis?: string | null;
  diagnosis_codes?: string[] | null;
  examination_findings?: string | null;
  history_of_present_illness?: string | null;
  clinical_notes?: string | null;
  treatment_plan?: string | null;
  service_type?: string | null;
  service_name?: string | null;
  urgency?: string | null;
  estimated_cost?: number | null;
  source_encounter_id?: string | null;
  requesting_doctor_id?: string | null;
  specialty_module?: string | null;
  admission_type?: string | null;
  level_of_care?: string | null;
  expected_duration?: string | null;

  // Joined patient data with NHIS details from registration
  patient?: {
    id: string;
    first_name: string;
    middle_name?: string | null;
    surname: string;
    emr_number: string;
    service_number?: string | null;
    phone?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    residential_address?: string | null;
    // Patient Category & Type
    patient_category?: string | null;
    patient_type?: string | null;
    insurance_type?: string | null;
    // Military/Service Info
    rank?: string | null;
    unit?: string | null;
    military_branch?: string | null;
    title?: string | null;
    course?: string | null;
    occupation?: string | null;
    employer?: string | null;
    // NHIS Details from registration
    nhis_number?: string | null;
    nhis_patient_source?: string | null;
    // External Referral from registration
    referral_code?: string | null;
    referring_facility_name?: string | null;
    referring_facility_nhis_id?: string | null;
    referral_date?: string | null;
    referral_reason?: string | null;
    referral_status?: string | null;
    referral_expiry_date?: string | null;
    clinical_summary?: string | null;
    // HMO/Payer Info (JSONB)
    payer_info?: {
      scheme?: string;
      enrolee_id?: string;
      relationship?: string;
      expiration_date?: string;
      principal_name?: string;
      principal_rank?: string;
      principal_service_number?: string;
      principal_unit?: string;
    } | null;
  };
  // Joined clinic data
  target_clinic?: {
    id: string;
    clinic_name: string;
    clinic_code: string;
  };
  // Joined doctor data
  target_doctor?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  // Joined requesting doctor data
  requesting_doctor?: {
    id: string;
    first_name: string;
    last_name: string;
    department?: string;
  };
  // Joined staff data
  requester?: {
    first_name: string;
    last_name: string;
  };
  processor?: {
    first_name: string;
    last_name: string;
  };
}

interface NhisReferralQueueProps {
  queueItems?: ReferralQueueItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onProcessItem?: (
    itemId: string,
    action: 'approve' | 'reject',
    data: any,
  ) => Promise<void>;
  showHeader?: boolean;
  showStats?: boolean;
  /** Filter queue items by request_type (e.g. 'external_referral'). If not set, all types shown. */
  requestTypeFilter?: string | string[];
}

// Mock data for demonstration
const MOCK_QUEUE_ITEMS: ReferralQueueItem[] = [
  {
    id: '1',
    patient_id: 'p1',
    request_type: 'external_referral',
    referral_code: 'REF-2026-001234',
    referral_date: '2026-01-20',
    referral_source: 'General Hospital Lagos',
    referral_facility_nhis_id: 'NHIS-GHL-001',
    clinical_basis: 'Chronic hypertension requiring specialist consultation',
    referring_clinician: 'Dr. Adebayo Johnson',
    days_since_referral: 9,
    is_expired: false,
    status: 'pending',
    priority: 'normal',
    requested_by: 'staff1',
    requested_at: '2026-01-29T08:30:00Z',
    request_notes: 'Patient presented with referral letter',
    processed_by: null,
    processed_at: null,
    processing_notes: null,
    rejection_reason: null,
    authorization_id: null,
    patient: {
      id: 'p1',
      first_name: 'Chukwuemeka',
      surname: 'Okonkwo',
      emr_number: 'EMR-2026-0042',
      phone: '08012345678',
    },
    requester: {
      first_name: 'Mary',
      last_name: 'Records',
    },
  },
  {
    id: '2',
    patient_id: 'p2',
    request_type: 'external_referral',
    referral_code: 'REF-2025-009876',
    referral_date: '2025-12-15',
    referral_source: 'Federal Medical Centre Abuja',
    referral_facility_nhis_id: 'NHIS-FMC-ABJ',
    clinical_basis: 'Post-surgical follow-up for appendectomy',
    referring_clinician: 'Dr. Fatima Mohammed',
    days_since_referral: 45,
    is_expired: true,
    status: 'pending',
    priority: 'normal',
    requested_by: 'staff2',
    requested_at: '2026-01-29T09:15:00Z',
    request_notes: null,
    processed_by: null,
    processed_at: null,
    processing_notes: null,
    rejection_reason: null,
    authorization_id: null,
    patient: {
      id: 'p2',
      first_name: 'Aisha',
      surname: 'Bello',
      emr_number: 'EMR-2026-0089',
      phone: '08098765432',
    },
    requester: {
      first_name: 'John',
      last_name: 'FrontDesk',
    },
  },
  {
    id: '3',
    patient_id: 'p3',
    request_type: 'external_referral',
    referral_code: 'REF-2026-000555',
    referral_date: '2026-01-25',
    referral_source: 'University Teaching Hospital Ibadan',
    referral_facility_nhis_id: 'NHIS-UTH-IBD',
    clinical_basis: 'Diabetic retinopathy - requires ophthalmology review',
    referring_clinician: 'Dr. Oluwaseun Adeleke',
    days_since_referral: 4,
    is_expired: false,
    status: 'pending',
    priority: 'urgent',
    requested_by: 'staff1',
    requested_at: '2026-01-29T07:45:00Z',
    request_notes: 'Urgent case - patient has deteriorating vision',
    processed_by: null,
    processed_at: null,
    processing_notes: null,
    rejection_reason: null,
    authorization_id: null,
    patient: {
      id: 'p3',
      first_name: 'Emmanuel',
      surname: 'Nwachukwu',
      emr_number: 'EMR-2026-0156',
      service_number: 'N/12345/2020',
      phone: '07033334444',
    },
    requester: {
      first_name: 'Mary',
      last_name: 'Records',
    },
  },
];

function getStatusBadge(status: string, isExpired: boolean) {
  if (isExpired && status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <AlertTriangle size={12} />
        Expired Referral
      </span>
    );
  }

  const config: Record<
    string,
    { color: string; icon: React.ReactNode; label: string }
  > = {
    pending: {
      color: 'bg-yellow-100 text-yellow-800',
      icon: <Clock size={12} />,
      label: 'Pending',
    },
    in_review: {
      color: 'bg-blue-100 text-blue-800',
      icon: <FileText size={12} />,
      label: 'In Review',
    },
    approved: {
      color: 'bg-green-100 text-green-800',
      icon: <CheckCircle size={12} />,
      label: 'Approved',
    },
    rejected: {
      color: 'bg-red-100 text-red-800',
      icon: <XCircle size={12} />,
      label: 'Rejected',
    },
    expired: {
      color: 'bg-gray-100 text-gray-800',
      icon: <Clock size={12} />,
      label: 'Expired',
    },
  };

  const cfg = config[status] || config.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function getPriorityBadge(priority: string) {
  const config: Record<string, string> = {
    normal: 'bg-gray-100 text-gray-700',
    urgent: 'bg-orange-100 text-orange-800',
    emergency: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${config[priority] || config.normal}`}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

export function NhisReferralQueue({
  queueItems = MOCK_QUEUE_ITEMS,
  isLoading = false,
  onRefresh,
  onProcessItem,
  showHeader = true,
  showStats = true,
  requestTypeFilter,
}: NhisReferralQueueProps) {
  const { user, staff } = useAuth();
  const [selectedItem, setSelectedItem] = useState<ReferralQueueItem | null>(
    null,
  );
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'process' | 'view'>('process');

  // Processing form state
  const [authCode, setAuthCode] = useState('');
  const [processingNotes, setProcessingNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [tariffGroup, setTariffGroup] = useState<string>('Civilian_HMO');

  const departmentName = staff?.department?.toLowerCase() || '';
  const isEncounterOffice = departmentName.includes('encounter');
  const canProcessQueue = !!user && !isEncounterOffice;

  useEffect(() => {
    if (selectedItem) {
      setProcessingNotes(selectedItem.processing_notes || '');
      setRejectionReason(selectedItem.rejection_reason || '');
      setAuthCode('');
      setTariffGroup('Civilian_HMO');
    }
  }, [selectedItem]);

  // Filter items by request_type (client-side safety net), status, and search
  const filteredItems = queueItems.filter((item) => {
    // Apply request_type filter if provided
    if (requestTypeFilter) {
      const allowedTypes = Array.isArray(requestTypeFilter)
        ? requestTypeFilter
        : [requestTypeFilter];
      if (!allowedTypes.includes(item.request_type)) return false;
    }
    const matchesStatus =
      filterStatus === 'all' || item.status === filterStatus;
    const matchesSearch =
      !searchQuery ||
      item.patient?.first_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      item.patient?.surname
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      item.patient?.emr_number
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      item.referral_code?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Sort by requested_at (FIFO)
  const sortedItems = [...filteredItems].sort(
    (a, b) =>
      new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime(),
  );

  const handleApprove = async (item: ReferralQueueItem) => {
    if (!canProcessQueue) {
      alert('You only have view access to this queue.');
      return;
    }
    if (item.is_expired) {
      alert(
        'Cannot approve expired referrals. Referral is older than 30 days.',
      );
      return;
    }

    setProcessingId(item.id);
    try {
      if (onProcessItem) {
        await onProcessItem(item.id, 'approve', {
          auth_code: authCode || undefined,
          notes: processingNotes || undefined,
          p_tariff_group: tariffGroup as any,
        });
      }
      setSelectedItem(null);
      setAuthCode('');
      setProcessingNotes('');
      setTariffGroup('Civilian_HMO');
    } catch (error) {
      console.error('Error approving referral:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item: ReferralQueueItem) => {
    if (!canProcessQueue) {
      alert('You only have view access to this queue.');
      return;
    }
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessingId(item.id);
    try {
      if (onProcessItem) {
        await onProcessItem(item.id, 'reject', {
          notes: processingNotes || undefined,
          rejection_reason: rejectionReason,
        });
      }
      setSelectedItem(null);
      setRejectionReason('');
      setProcessingNotes('');
    } catch (error) {
      console.error('Error rejecting referral:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const isViewOnly =
    modalMode === 'view' ||
    !canProcessQueue ||
    (selectedItem && selectedItem.status !== 'pending');

  if (isLoading) {
    return <SkeletonTable rows={5} columns={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Referral Verification Queue
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Process external NHIS referral requests (First Come, First Served)
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient name, patient number, or referral code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-2xl font-bold text-yellow-700">
              {queueItems.filter((i) => i.status === 'pending').length}
            </p>
            <p className="text-sm text-yellow-600">Pending</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-2xl font-bold text-red-700">
              {
                queueItems.filter((i) => i.is_expired && i.status === 'pending')
                  .length
              }
            </p>
            <p className="text-sm text-red-600">Expired Referrals</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-2xl font-bold text-green-700">
              {queueItems.filter((i) => i.status === 'approved').length}
            </p>
            <p className="text-sm text-green-600">Approved Today</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-2xl font-bold text-gray-700">
              {queueItems.filter((i) => i.status === 'rejected').length}
            </p>
            <p className="text-sm text-gray-600">Rejected</p>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">
              Queue ({sortedItems.length} items)
            </h3>
          </div>
        </div>

        {sortedItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Shield size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No referral requests in queue</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedItems.map((item, index) => (
              <div
                key={item.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  item.is_expired ? 'bg-red-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Queue Position & Patient Info */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-400 mb-1">
                        #{index + 1}
                      </span>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          item.priority === 'urgent'
                            ? 'bg-orange-100'
                            : item.priority === 'emergency'
                              ? 'bg-red-100'
                              : 'bg-gray-100'
                        }`}
                      >
                        <User
                          size={20}
                          className={
                            item.priority === 'urgent'
                              ? 'text-orange-600'
                              : item.priority === 'emergency'
                                ? 'text-red-600'
                                : 'text-gray-600'
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          {item.patient?.surname}, {item.patient?.first_name}
                        </span>
                        {getPriorityBadge(item.priority)}
                        {getStatusBadge(item.status, item.is_expired)}
                      </div>

                      <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                        <span className="font-mono">
                          {item.patient?.emr_number}
                        </span>
                        {item.patient?.service_number && (
                          <>
                            <span>•</span>
                            <span>{item.patient.service_number}</span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 size={12} />
                          {item.referral_source || 'Unknown Facility'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          Referral:{' '}
                          {item.referral_date
                            ? new Date(item.referral_date).toLocaleDateString()
                            : 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Requested:{' '}
                          {new Date(item.requested_at).toLocaleString()}
                        </span>
                        <span
                          className={`flex items-center gap-1 ${
                            item.is_expired
                              ? 'text-red-600 font-medium'
                              : (item.days_since_referral || 0) > 25
                                ? 'text-orange-600'
                                : ''
                          }`}
                        >
                          <Clock size={12} />
                          {item.days_since_referral} days ago
                          {item.is_expired && ' (EXPIRED)'}
                        </span>
                      </div>

                      {item.clinical_basis && (
                        <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <strong>Clinical Basis:</strong> {item.clinical_basis}
                        </p>
                      )}

                      {/* Target Clinic - where patient will be seen after approval */}
                      {item.target_clinic && (
                        <div className="mt-2 flex items-center gap-2 text-sm bg-blue-50 p-2 rounded border border-blue-200">
                          <Stethoscope size={14} className="text-blue-600" />
                          <span className="text-blue-800">
                            <strong>Target Clinic:</strong>{' '}
                            {item.target_clinic.clinic_name} (
                            {item.target_clinic.clinic_code})
                          </span>
                          {item.target_doctor && (
                            <span className="text-blue-700">
                              • Dr. {item.target_doctor.first_name}{' '}
                              {item.target_doctor.last_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {item.status === 'pending' && canProcessQueue && (
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setModalMode('process');
                        }}
                        className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                      >
                        Process
                        <ChevronRight size={16} />
                      </button>
                    )}
                    {item.status === 'pending' && !canProcessQueue && (
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setModalMode('view');
                        }}
                        className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        View Details
                        <Info size={16} />
                      </button>
                    )}
                    {item.status === 'approved' && (
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setModalMode('view');
                        }}
                        className="text-green-700 text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100"
                      >
                        <CheckCircle size={16} />
                        View Approved
                      </button>
                    )}
                    {item.status === 'rejected' && (
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setModalMode('view');
                        }}
                        className="text-red-700 text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100"
                      >
                        <XCircle size={16} />
                        View Rejected
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processing Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSelectedItem(null)}
          />

          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-600 to-green-700 rounded-t-xl">
              <h3 className="text-lg font-bold text-white">
                {isViewOnly
                  ? 'Referral Details'
                  : 'Process Referral Verification'}
              </h3>
              <p className="text-sm text-white/80">
                {isViewOnly
                  ? 'View request details and processing outcome'
                  : 'Review and approve/reject external NHIS referral'}
              </p>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Expiry Warning */}
              {selectedItem.is_expired && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-600 mt-0.5" size={20} />
                    <div>
                      <h4 className="font-semibold text-red-800">
                        Referral Expired
                      </h4>
                      <p className="text-sm text-red-700 mt-1">
                        This referral is {selectedItem.days_since_referral} days
                        old (exceeded 30-day limit). It cannot be approved. You
                        may only reject it.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Processing Outcome */}
              {selectedItem.status !== 'pending' && (
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                  <h4 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                    <CheckCircle size={16} />
                    Processing Outcome
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className="ml-2 font-medium capitalize">
                        {selectedItem.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Processed At:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.processed_at
                          ? new Date(selectedItem.processed_at).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Processed By:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.processor
                          ? `${selectedItem.processor.first_name} ${selectedItem.processor.last_name}`
                          : 'N/A'}
                      </span>
                    </div>
                    {selectedItem.rejection_reason && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Rejection Reason:</span>
                        <p className="mt-1 font-medium text-red-700">
                          {selectedItem.rejection_reason}
                        </p>
                      </div>
                    )}
                    {selectedItem.processing_notes && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Processing Notes:</span>
                        <p className="mt-1 font-medium">
                          {selectedItem.processing_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User size={16} />
                  Patient Bio Data
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Full Name:</span>
                    <span className="ml-2 font-medium">
                      {selectedItem.patient?.title
                        ? `${selectedItem.patient.title} `
                        : ''}
                      {selectedItem.patient?.surname},{' '}
                      {selectedItem.patient?.first_name}{' '}
                      {selectedItem.patient?.middle_name || ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Hash size={12} className="text-gray-400" />
                    <span className="text-gray-500">Patient number:</span>
                    <span className="ml-2 font-mono font-medium">
                      {selectedItem.patient?.emr_number}
                    </span>
                  </div>
                  {selectedItem.patient?.gender && (
                    <div>
                      <span className="text-gray-500">Gender:</span>
                      <span className="ml-2 font-medium capitalize">
                        {selectedItem.patient?.gender}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.date_of_birth && (
                    <div>
                      <span className="text-gray-500">Date of Birth:</span>
                      <span className="ml-2 font-medium">
                        {new Date(
                          selectedItem.patient?.date_of_birth,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.phone && (
                    <div className="flex items-center gap-1">
                      <Phone size={12} className="text-gray-400" />
                      <span className="text-gray-500">Phone:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.phone}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.residential_address && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Address:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.residential_address}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.patient_category && (
                    <div>
                      <span className="text-gray-500">Category:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.patient_category}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.patient_type && (
                    <div>
                      <span className="text-gray-500">Patient Type:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.patient_type}
                      </span>
                    </div>
                  )}
                  {/* Military/Service Info */}
                  {selectedItem.patient?.service_number && (
                    <div>
                      <span className="text-gray-500">Service No:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.service_number}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.rank && (
                    <div>
                      <span className="text-gray-500">Rank:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.rank}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.unit && (
                    <div>
                      <span className="text-gray-500">Unit:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.unit}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.military_branch && (
                    <div>
                      <span className="text-gray-500">Branch:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.military_branch}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.course && (
                    <div>
                      <span className="text-gray-500">Course:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.course}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.occupation && (
                    <div>
                      <span className="text-gray-500">Occupation:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.occupation}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.employer && (
                    <div>
                      <span className="text-gray-500">Employer:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.employer}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* NHIS/HMO Information Section */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <CreditCard size={16} />
                  NHIS / HMO Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedItem.patient?.insurance_type && (
                    <div>
                      <span className="text-gray-600">Insurance Type:</span>
                      <span className="ml-2 font-medium text-green-800">
                        {selectedItem.patient?.insurance_type}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.nhis_number && (
                    <div>
                      <span className="text-gray-600">NHIS Number:</span>
                      <span className="ml-2 font-mono font-medium text-green-700">
                        {selectedItem.patient?.nhis_number}
                      </span>
                    </div>
                  )}
                  {selectedItem.patient?.nhis_patient_source && (
                    <div>
                      <span className="text-gray-600">Patient Source:</span>
                      <span className="ml-2 font-medium">
                        {selectedItem.patient?.nhis_patient_source}
                      </span>
                    </div>
                  )}
                </div>
                {/* Full Payer Details Card */}
                <div className="mt-3">
                  <PayerDetailsCard
                    payerInfo={
                      selectedItem.patient?.payer_info as PayerInfo | null
                    }
                    nhisNumber={selectedItem.patient?.nhis_number}
                    insuranceType={selectedItem.patient?.insurance_type}
                    patientCategory={selectedItem.patient?.patient_category}
                    compact
                  />
                </div>
                {/* External Referral Info from registration */}
                {selectedItem.patient?.referring_facility_name && (
                  <div className="mt-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700 font-semibold mb-2">
                      External Referral (from Registration):
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Facility:</span>
                        <span className="ml-1 font-medium">
                          {selectedItem.patient?.referring_facility_name}
                        </span>
                      </div>
                      {selectedItem.patient?.referring_facility_nhis_id && (
                        <div>
                          <span className="text-gray-600">
                            Facility NHIS ID:
                          </span>
                          <span className="ml-1 font-mono font-medium">
                            {selectedItem.patient?.referring_facility_nhis_id}
                          </span>
                        </div>
                      )}
                      {selectedItem.patient?.referral_code && (
                        <div>
                          <span className="text-gray-600">Referral Code:</span>
                          <span className="ml-1 font-mono font-medium">
                            {selectedItem.patient?.referral_code}
                          </span>
                        </div>
                      )}
                      {selectedItem.patient?.referral_date && (
                        <div>
                          <span className="text-gray-600">Referral Date:</span>
                          <span className="ml-1 font-medium">
                            {new Date(
                              selectedItem.patient?.referral_date,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {selectedItem.patient?.referral_status && (
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <span className="ml-1 font-medium">
                            {selectedItem.patient?.referral_status}
                          </span>
                        </div>
                      )}
                      {selectedItem.patient?.referral_expiry_date && (
                        <div>
                          <span className="text-gray-600">Expiry:</span>
                          <span className="ml-1 font-medium">
                            {new Date(
                              selectedItem.patient?.referral_expiry_date,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {selectedItem.patient?.referral_reason && (
                        <div className="col-span-2">
                          <span className="text-gray-600">Reason:</span>
                          <span className="ml-1 font-medium">
                            {selectedItem.patient?.referral_reason}
                          </span>
                        </div>
                      )}
                      {selectedItem.patient?.clinical_summary && (
                        <div className="col-span-2">
                          <span className="text-gray-600">
                            Clinical Summary:
                          </span>
                          <p className="mt-1 font-medium text-gray-800">
                            {selectedItem.patient?.clinical_summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CLINICAL DATA SECTION - REQUIRED FOR NHIS PROCESSING */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                  <Activity size={16} />
                  Clinical Information (From Consultation)
                </h4>
                <div className="space-y-3 text-sm">
                  {/* Chief Complaint */}
                  {selectedItem.chief_complaint && (
                    <div className="bg-white p-3 rounded border border-purple-100">
                      <span className="font-semibold text-purple-700 flex items-center gap-1 mb-1">
                        <Clipboard size={14} />
                        Chief Complaint:
                      </span>
                      <p className="text-gray-800">
                        {selectedItem.chief_complaint}
                      </p>
                    </div>
                  )}

                  {/* Diagnosis */}
                  {selectedItem.diagnosis && (
                    <div className="bg-white p-3 rounded border border-purple-100">
                      <span className="font-semibold text-purple-700 flex items-center gap-1 mb-1">
                        <Heart size={14} />
                        Diagnosis:
                      </span>
                      <p className="text-gray-800">{selectedItem.diagnosis}</p>
                      {selectedItem.diagnosis_codes &&
                        selectedItem.diagnosis_codes.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {selectedItem.diagnosis_codes.map((code, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-mono"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  )}

                  {/* Examination Findings */}
                  {selectedItem.examination_findings && (
                    <div className="bg-white p-3 rounded border border-purple-100">
                      <span className="font-semibold text-purple-700 flex items-center gap-1 mb-1">
                        <Stethoscope size={14} />
                        General Examination Findings:
                      </span>
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {selectedItem.examination_findings}
                      </p>
                    </div>
                  )}

                  {/* History of Present Illness */}
                  {selectedItem.history_of_present_illness && (
                    <div className="bg-white p-3 rounded border border-purple-100">
                      <span className="font-semibold text-purple-700 mb-1">
                        History of Present Illness:
                      </span>
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {selectedItem.history_of_present_illness}
                      </p>
                    </div>
                  )}

                  {/* Treatment Plan */}
                  {selectedItem.treatment_plan && (
                    <div className="bg-white p-3 rounded border border-purple-100">
                      <span className="font-semibold text-purple-700 mb-1">
                        Treatment Plan:
                      </span>
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {selectedItem.treatment_plan}
                      </p>
                    </div>
                  )}

                  {/* Clinical Notes */}
                  {selectedItem.clinical_notes && (
                    <div className="bg-white p-3 rounded border border-purple-100">
                      <span className="font-semibold text-purple-700 mb-1">
                        Additional Clinical Notes:
                      </span>
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {selectedItem.clinical_notes}
                      </p>
                    </div>
                  )}

                  {/* Clinical Basis / Reason for Referral */}
                  {selectedItem.clinical_basis && (
                    <div className="bg-white p-3 rounded border border-purple-100">
                      <span className="font-semibold text-purple-700 mb-1">
                        Reason for Referral/Service:
                      </span>
                      <p className="text-gray-800">
                        {selectedItem.clinical_basis}
                      </p>
                    </div>
                  )}

                  {/* No clinical data warning */}
                  {!selectedItem.diagnosis &&
                    !selectedItem.examination_findings &&
                    !selectedItem.chief_complaint &&
                    !selectedItem.clinical_basis && (
                      <div className="text-center py-4 text-purple-600">
                        <Info size={20} className="mx-auto mb-2" />
                        <p className="text-sm">
                          No clinical data available for this request
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Service Details (for internal requests) */}
              {(selectedItem.service_type ||
                selectedItem.service_name ||
                selectedItem.admission_type) && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <BedDouble size={16} />
                    Service/Admission Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedItem.service_type && (
                      <div>
                        <span className="text-gray-600">Service Type:</span>
                        <span className="ml-2 font-medium capitalize">
                          {selectedItem.service_type}
                        </span>
                      </div>
                    )}
                    {selectedItem.service_name && (
                      <div>
                        <span className="text-gray-600">Service Name:</span>
                        <span className="ml-2 font-medium">
                          {selectedItem.service_name}
                        </span>
                      </div>
                    )}
                    {selectedItem.urgency && (
                      <div>
                        <span className="text-gray-600">Urgency:</span>
                        <span
                          className={`ml-2 font-medium ${
                            selectedItem.urgency === 'Emergency'
                              ? 'text-red-600'
                              : selectedItem.urgency === 'Urgent'
                                ? 'text-orange-600'
                                : 'text-gray-700'
                          }`}
                        >
                          {selectedItem.urgency}
                        </span>
                      </div>
                    )}
                    {selectedItem.estimated_cost && (
                      <div>
                        <span className="text-gray-600">Estimated Cost:</span>
                        <span className="ml-2 font-medium">
                          ₦{selectedItem.estimated_cost.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedItem.admission_type && (
                      <div>
                        <span className="text-gray-600">Admission Type:</span>
                        <span className="ml-2 font-medium">
                          {selectedItem.admission_type}
                        </span>
                      </div>
                    )}
                    {selectedItem.level_of_care && (
                      <div>
                        <span className="text-gray-600">Level of Care:</span>
                        <span className="ml-2 font-medium">
                          {selectedItem.level_of_care}
                        </span>
                      </div>
                    )}
                    {selectedItem.expected_duration && (
                      <div>
                        <span className="text-gray-600">
                          Expected Duration:
                        </span>
                        <span className="ml-2 font-medium">
                          {selectedItem.expected_duration}
                        </span>
                      </div>
                    )}
                    {selectedItem.specialty_module && (
                      <div>
                        <span className="text-gray-600">Specialty:</span>
                        <span className="ml-2 font-medium capitalize">
                          {selectedItem.specialty_module}
                        </span>
                      </div>
                    )}
                    {selectedItem.requesting_doctor && (
                      <div className="col-span-2">
                        <span className="text-gray-600">
                          Requesting Doctor:
                        </span>
                        <span className="ml-2 font-medium">
                          Dr. {selectedItem.requesting_doctor.first_name}{' '}
                          {selectedItem.requesting_doctor.last_name}
                          {selectedItem.requesting_doctor.department &&
                            ` (${selectedItem.requesting_doctor.department})`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Referral Details */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <FileText size={16} />
                  Referral Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Referral Code:</span>
                    <span className="ml-2 font-mono font-medium">
                      {selectedItem.referral_code || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Referral Date:</span>
                    <span className="ml-2 font-medium">
                      {selectedItem.referral_date
                        ? new Date(
                            selectedItem.referral_date,
                          ).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Referring Facility:</span>
                    <span className="ml-2 font-medium">
                      {selectedItem.referral_source || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Referring Clinician:</span>
                    <span className="ml-2 font-medium">
                      {selectedItem.referring_clinician || 'N/A'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Clinical Basis:</span>
                    <p className="mt-1 font-medium">
                      {selectedItem.clinical_basis || 'N/A'}
                    </p>
                  </div>

                  {/* Target Clinic Display - where the patient wants to be seen */}
                  {selectedItem.target_clinic && (
                    <div className="col-span-2 bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Stethoscope className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold text-blue-800">
                          Target Clinic for Encounter
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Clinic:</span>
                          <span className="ml-2 font-medium text-blue-900">
                            {selectedItem.target_clinic.clinic_name}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Code:</span>
                          <span className="ml-2 font-mono font-medium text-blue-900">
                            {selectedItem.target_clinic.clinic_code}
                          </span>
                        </div>
                        {selectedItem.target_doctor && (
                          <div className="col-span-2">
                            <span className="text-gray-600">
                              Assigned Doctor:
                            </span>
                            <span className="ml-2 font-medium text-blue-900">
                              Dr. {selectedItem.target_doctor.first_name}{' '}
                              {selectedItem.target_doctor.last_name}
                            </span>
                          </div>
                        )}
                        {selectedItem.chief_complaint && (
                          <div className="col-span-2">
                            <span className="text-gray-600">
                              Chief Complaint:
                            </span>
                            <span className="ml-2 font-medium text-blue-900">
                              {selectedItem.chief_complaint}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-blue-700 italic">
                        ✓ An encounter will be automatically created for this
                        clinic upon approval
                      </p>
                    </div>
                  )}

                  <div className="col-span-2">
                    <span className="text-gray-600">Days Since Referral:</span>
                    <span
                      className={`ml-2 font-bold ${
                        selectedItem.is_expired
                          ? 'text-red-600'
                          : (selectedItem.days_since_referral || 0) > 25
                            ? 'text-orange-600'
                            : 'text-green-600'
                      }`}
                    >
                      {selectedItem.days_since_referral} days
                      {selectedItem.is_expired
                        ? ' (EXPIRED - Cannot Approve)'
                        : (selectedItem.days_since_referral || 0) > 25
                          ? ' (Expiring Soon)'
                          : ' (Valid)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Authorization Code / Referral Code (for approval) */}
              {!selectedItem.is_expired && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {selectedItem.request_type === 'external_referral'
                      ? 'Referral Code (Optional - auto-generated if empty)'
                      : 'Authorization Code (Optional - auto-generated if empty)'}
                  </label>
                  <input
                    type="text"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder={
                      selectedItem.request_type === 'external_referral'
                        ? 'e.g. REF-2026-XXXXX'
                        : 'e.g. AUTH-2026-XXXXX'
                    }
                    disabled={isViewOnly}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                  />
                </div>
              )}

              {/* Processing Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Processing Notes
                </label>
                <textarea
                  value={processingNotes}
                  onChange={(e) => setProcessingNotes(e.target.value)}
                  placeholder="Add any notes about this verification..."
                  rows={2}
                  disabled={isViewOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                />
              </div>

              {/* Rejection Reason (required for rejection) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason{' '}
                  {selectedItem.is_expired
                    ? '(Required)'
                    : '(Required if rejecting)'}
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejection..."
                  rows={2}
                  disabled={isViewOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-between">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {isViewOnly ? 'Close' : 'Cancel'}
              </button>

              {!isViewOnly && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReject(selectedItem)}
                    disabled={
                      processingId === selectedItem.id ||
                      !rejectionReason.trim()
                    }
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === selectedItem.id ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <XCircle size={16} />
                    )}
                    Reject
                  </button>

                  {!selectedItem.is_expired && (
                    <button
                      onClick={() => handleApprove(selectedItem)}
                      disabled={processingId === selectedItem.id}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === selectedItem.id ? (
                        <RefreshCw className="animate-spin" size={16} />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      Approve & Create Authorization
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NhisReferralQueue;
