// =============================================================================
// NHIS Verification Panel Component
// Used for verifying NHIS patients and managing authorizations
// Includes integrated referral queue for external NHIS patient verification
// =============================================================================

import React, { useState, useEffect, useMemo, startTransition } from 'react';
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  User,
  Building2,
  FileText,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  Calendar,
  ListChecks,
  Phone,
  BadgeCheck,
  FileCheck,
  X,
  CreditCard,
  History,
  Info,
} from 'lucide-react';
import {
  useNhisProfileByPatient,
  useActiveAuthorization,
  useVerifyEncounter,
  useEmergencyOverride,
  useCreateAuthorization,
  useVerifyAuthorization,
  useEncounterNhisState,
  useReferralQueue,
  useReferralQueueStats,
  useProcessReferralQueue,
} from '../hooks';
import { usePatient } from '../../patient-registration/hooks/usePatient';
import type {
  NhisTariffGroup,
  NhisVerificationStatus,
  ReferralQueueItem,
} from '../types';
import { useAuth } from '../../../contexts/AuthContext';
import {
  AuthCodeInput,
  type AuthCodeVerificationResult,
} from './AuthCodeInput';
import {
  SkeletonList,
  SkeletonTable,
} from '../../../components/ui/SkeletonLoader';
import { PayerDetailsCard } from './PayerDetailsCard';
import type { PayerInfo } from '../../../types/database.types';
import { useToast } from '../../../components/ui/Toast';

interface NhisVerificationPanelProps {
  patientId: string;
  encounterId?: string; // Optional for queue requests
  onVerificationComplete?: () => void;
}

const TARIFF_GROUP_OPTIONS: { value: NhisTariffGroup; label: string }[] = [
  { value: 'Personnel', label: 'Personnel (Military)' },
  { value: 'Civilian_HMO', label: 'Civilian / HMO' },
  { value: 'Special', label: 'Special Category' },
  { value: 'Private', label: 'Private' },
];

/** Formats queue wait time from a timestamp into a human-readable string like "2h 35m" or "3d 5h" */
function formatQueueDuration(dateStr: string | null | undefined): {
  text: string;
  colorClass: string;
  minutes: number;
} {
  if (!dateStr) return { text: 'N/A', colorClass: 'text-gray-400', minutes: 0 };
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0)
    return { text: 'Just now', colorClass: 'text-green-600', minutes: 0 };
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);
  const mins = totalMinutes % 60;
  const remainHours = hours % 24;
  let text = '';
  if (days > 0) text = `${days}d ${remainHours}h`;
  else if (hours > 0) text = `${hours}h ${mins}m`;
  else text = `${mins}m`;
  // Color: green < 1h, amber < 4h, orange < 24h, red > 24h
  let colorClass = 'text-green-600 font-semibold';
  if (totalMinutes >= 60 && totalMinutes < 240)
    colorClass = 'text-amber-600 font-semibold';
  else if (totalMinutes >= 240 && totalMinutes < 1440)
    colorClass = 'text-orange-600 font-bold';
  else if (totalMinutes >= 1440) colorClass = 'text-red-600 font-bold';
  return { text, colorClass, minutes: totalMinutes };
}

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
      className={`${isExpired ? 'text-red-300 font-black' : isUrgent ? 'text-amber-300 font-bold' : 'text-white font-bold'} ${className}`}
    >
      {timeLeft}
    </span>
  );
}

function getStatusBadge(status: NhisVerificationStatus) {
  const statusConfig: Record<
    NhisVerificationStatus,
    { color: string; icon: React.ReactNode; label: string }
  > = {
    not_applicable: {
      color: 'bg-gray-100 text-gray-700',
      icon: null,
      label: 'Non-NHIS',
    },
    unverified: {
      color: 'bg-yellow-100 text-yellow-800',
      icon: <Clock size={14} />,
      label: 'Unverified',
    },
    blocked: {
      color: 'bg-red-100 text-red-800',
      icon: <XCircle size={14} />,
      label: 'Blocked',
    },
    verified: {
      color: 'bg-green-100 text-green-800',
      icon: <CheckCircle size={14} />,
      label: 'Verified',
    },
    expired: {
      color: 'bg-orange-100 text-orange-800',
      icon: <Clock size={14} />,
      label: 'Expired',
    },
    emergency_override: {
      color: 'bg-red-100 text-red-800',
      icon: <AlertTriangle size={14} />,
      label: 'Emergency Override',
    },
  };

  const config = statusConfig[status] || statusConfig.unverified;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function getQueueStatusBadge(status: string, isExpired: boolean) {
  if (isExpired && status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <AlertTriangle size={12} />
        Expired
      </span>
    );
  }

  const config: Record<string, { color: string; label: string }> = {
    pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
    in_review: { color: 'bg-blue-100 text-blue-800', label: 'In Review' },
    approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
    rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
  };

  const cfg = config[status] || config.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}
    >
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

function normalizeSearchValue(value: string | null | undefined): string {
  return (value || '').toLowerCase();
}

export function NhisVerificationPanel({
  patientId,
  encounterId = '',
  onVerificationComplete,
}: NhisVerificationPanelProps) {
  const { user, staff } = useAuth();
  const { showToast } = useToast();

  // Queue state - using real API
  const [selectedQueueItem, setSelectedQueueItem] =
    useState<ReferralQueueItem | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState(false); // Controls when to show full form
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueMode, setQueueMode] = useState<'process' | 'view'>('process');

  // Request type filter: show all, external only, or internal only
  const [filterRequestType, setFilterRequestType] = useState<string>('all');

  // Fetch real queue data — include BOTH external_referral and internal_nhis_approval
  const {
    data: queueData,
    isLoading: queueLoading,
    refetch: refetchQueue,
  } = useReferralQueue({
    status: filterStatus as any,
    request_type:
      filterRequestType === 'all'
        ? ['external_referral', 'internal_nhis_approval']
        : filterRequestType,
  });
  const { data: queueStats } = useReferralQueueStats();
  const processQueueMutation = useProcessReferralQueue();

  // Queue items from API
  const queueItems = queueData?.data || [];

  // Form state
  const [authCode, setAuthCode] = useState('');
  const [tariffGroup, setTariffGroup] =
    useState<NhisTariffGroup>('Civilian_HMO');
  const [referralSource, setReferralSource] = useState('');
  const [clinicalBasis, setClinicalBasis] = useState('');
  const [referringClinician, setReferringClinician] = useState('');
  const [referralDate, setReferralDate] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [showEmergencyOverride, setShowEmergencyOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingNotes, setProcessingNotes] = useState('');
  const [authVerificationResult, setAuthVerificationResult] =
    useState<AuthCodeVerificationResult | null>(null);

  // Determine active patient ID - from queue selection or prop
  const activePatientId = selectedQueueItem?.patient_id || patientId;

  const { data: fullPatient } = usePatient(activePatientId);
  const { data: nhisProfile, isLoading: profileLoading } =
    useNhisProfileByPatient(activePatientId);
  const { data: activeAuth, isLoading: authLoading } =
    useActiveAuthorization(activePatientId);
  const {
    data: encounterState,
    isLoading: stateLoading,
    refetch: refetchState,
  } = useEncounterNhisState(encounterId || '');

  const verifyEncounterMutation = useVerifyEncounter();
  const emergencyOverrideMutation = useEmergencyOverride();
  const createAuthMutation = useCreateAuthorization();
  const verifyAuthMutation = useVerifyAuthorization();

  const isLoading = profileLoading || authLoading || stateLoading;
  const currentStatus =
    encounterState?.nhis_verification_status || 'unverified';
  const isReferred =
    nhisProfile?.patient_origin === 'referred' || !!selectedQueueItem;

  // ==========================================================================
  // Existing Valid Referral Detection
  // For external referral patients who already have a valid referral code
  // (not yet expired - within 30 days), auto-populate and skip re-entry
  // ==========================================================================
  const existingValidReferral = useMemo(() => {
    // Try to find referral data from patient record or NHIS profile
    const existingCode =
      fullPatient?.referral_code || nhisProfile?.referral_code;
    const existingDate =
      fullPatient?.referral_date || nhisProfile?.referral_date;
    const existingSource =
      fullPatient?.referring_facility_name ||
      nhisProfile?.referring_facility_name;

    if (!existingCode || !existingDate) return null;

    // Check if referral is still within 30-day validity
    const refDate = new Date(existingDate);
    const today = new Date();
    const diffTime = today.getTime() - refDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 30 || diffDays < 0) return null; // Expired or future date

    return {
      code: existingCode,
      date: existingDate,
      source: existingSource || '',
      daysRemaining: 30 - diffDays,
      daysElapsed: diffDays,
    };
  }, [fullPatient, nhisProfile]);

  // Distinguish between external referrals and internal NHIS approval requests
  // External referrals: patient referred from another facility with referral documentation
  // Internal NHIS approval: internal patient going to a specialty clinic, needs NHIS authorization
  const isExternalReferral =
    selectedQueueItem?.request_type === 'external_referral' ||
    (!selectedQueueItem &&
      (fullPatient?.nhis_patient_source === 'Referral' ||
        nhisProfile?.patient_origin === 'referred'));
  const isInternalNhisApproval =
    selectedQueueItem?.request_type === 'internal_nhis_approval';

  const departmentName = staff?.department?.toLowerCase() || '';
  const isEncounterOffice = departmentName.includes('encounter');
  const canProcessQueue = !!user && !isEncounterOffice;

  // Filter queue items by search (API already handles status filter, we add client-side search)
  const filteredQueueItems = useMemo(() => {
    if (!queueItems.length) return [];

    let filtered = queueItems;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          normalizeSearchValue(item.patient?.first_name).includes(query) ||
          normalizeSearchValue(item.patient?.surname).includes(query) ||
          normalizeSearchValue(item.patient?.emr_number).includes(query) ||
          normalizeSearchValue(item.referral_code).includes(query) ||
          normalizeSearchValue(item.patient?.nhis_number).includes(query),
      );
    }

    // Ensure FIFO ordering (oldest first)
    return [...filtered].sort(
      (a, b) =>
        new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime(),
    );
  }, [queueItems, searchQuery]);

  // Pre-fill form when queue item is selected
  // Cascades: queue item data → patient record → NHIS profile
  // For external referrals with existing valid referral, auto-populate from patient record
  useEffect(() => {
    if (selectedQueueItem) {
      // Use queue item data first, then fall back to existing patient/profile referral data
      setReferralSource(
        selectedQueueItem.referral_source ||
          existingValidReferral?.source ||
          fullPatient?.referring_facility_name ||
          nhisProfile?.referring_facility_name ||
          '',
      );
      setClinicalBasis(selectedQueueItem.clinical_basis || '');
      setReferringClinician(selectedQueueItem.referring_clinician || '');
      setReferralDate(
        selectedQueueItem.referral_date ||
          existingValidReferral?.date ||
          fullPatient?.referral_date ||
          nhisProfile?.referral_date ||
          '',
      );
      const mergedReferralCode =
        selectedQueueItem.referral_code ||
        existingValidReferral?.code ||
        fullPatient?.referral_code ||
        nhisProfile?.referral_code ||
        '';

      setReferralCode(mergedReferralCode);
      // Auto-populate Auth Code with Referral Code if available
      if (mergedReferralCode) {
        setAuthCode(mergedReferralCode);
      }

      setProcessingNotes(selectedQueueItem.processing_notes || '');
      setRejectionReason(selectedQueueItem.rejection_reason || '');
      setError(null);
    }
  }, [selectedQueueItem, existingValidReferral, fullPatient, nhisProfile]);

  // Auto-set tariff group based on profile
  useEffect(() => {
    if (nhisProfile?.tariff_group) {
      setTariffGroup(nhisProfile.tariff_group);
    }
  }, [nhisProfile]);

  // Auto-fill auth code from active authorization
  useEffect(() => {
    if (activeAuth?.auth_code) {
      setAuthCode(activeAuth.auth_code);
      // Set verification result for existing active auth
      setAuthVerificationResult({
        status: 'verified',
        payer: 'NHIS',
        issueDate: activeAuth.created_at,
        expiryDate: activeAuth.expiry_date,
        coverageDetails: 'Active authorization - covers requested services',
      });
    }
  }, [activeAuth]);

  // Verification function for the AuthCodeInput
  const handleAuthCodeVerification = async (
    code: string,
  ): Promise<AuthCodeVerificationResult> => {
    try {
      // Reset previous result
      setAuthVerificationResult(null);

      // For now, we'll do a simple verification by checking if the code exists
      // In a real implementation, this would call an NHIS verification API

      // Check if it matches an existing active auth
      if (activeAuth?.auth_code === code) {
        const verificationResult: AuthCodeVerificationResult = {
          status: 'verified',
          payer: 'NHIS',
          issueDate: activeAuth.created_at,
          expiryDate: activeAuth.expiry_date,
          coverageDetails: 'Active authorization - covers requested services',
        };
        setAuthVerificationResult(verificationResult);
        return verificationResult;
      }

      // Mock verification logic based on code patterns
      const upperCode = code.toUpperCase().trim();

      // Simulate different verification scenarios
      if (upperCode.includes('EXPIRED') || upperCode.includes('OLD')) {
        const result: AuthCodeVerificationResult = {
          status: 'expired',
          payer: 'NHIS',
          hmo: 'Sample HMO',
          issueDate: '2025-12-01',
          expiryDate: '2026-01-01',
          errorMessage: 'This authorization code has expired',
        };
        setAuthVerificationResult(result);
        return result;
      }

      if (upperCode.includes('INVALID') || upperCode.includes('FAKE')) {
        const result: AuthCodeVerificationResult = {
          status: 'not_found',
          errorMessage: 'Authorization code not found in NHIS database',
        };
        setAuthVerificationResult(result);
        return result;
      }

      if (upperCode.includes('USED') || upperCode.includes('EXHAUSTED')) {
        const result: AuthCodeVerificationResult = {
          status: 'already_used',
          payer: 'NHIS',
          issueDate: '2026-01-01',
          expiryDate: '2026-03-01',
          errorMessage: 'This authorization has been fully utilized',
          authorizationLimit: 100000,
          usedAmount: 100000,
        };
        setAuthVerificationResult(result);
        return result;
      }

      if (upperCode.includes('NOTCOVERED') || upperCode.includes('WRONG')) {
        const result: AuthCodeVerificationResult = {
          status: 'not_covered',
          payer: 'NHIS',
          hmo: 'Sample HMO',
          issueDate: '2026-02-01',
          expiryDate: '2026-04-01',
          errorMessage:
            'This authorization does not cover the requested service type',
        };
        setAuthVerificationResult(result);
        return result;
      }

      // Default: assume valid if minimum requirements met
      if (code.length >= 6) {
        const result: AuthCodeVerificationResult = {
          status: 'verified',
          payer: 'NHIS',
          hmo: upperCode.includes('HMO') ? 'Sample HMO' : 'NHIA',
          issueDate: '2026-02-01',
          expiryDate: '2026-04-01',
          coverageDetails:
            'Covers requested services - consultation and basic procedures',
          authorizationLimit: 150000,
          usedAmount: 25000,
        };
        setAuthVerificationResult(result);
        return result;
      }
      const result: AuthCodeVerificationResult = {
        status: 'error',
        errorMessage:
          'Authorization code is too short (minimum 6 characters required)',
      };
      setAuthVerificationResult(result);
      return result;
    } catch (error) {
      const errorResult: AuthCodeVerificationResult = {
        status: 'error',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Verification failed - please try again',
      };
      setAuthVerificationResult(errorResult);
      return errorResult;
    }
  };

  // Clear verification result when auth code changes manually (not from active auth)
  useEffect(() => {
    if (authCode !== activeAuth?.auth_code && authVerificationResult) {
      setAuthVerificationResult(null);
    }
  }, [authCode, activeAuth?.auth_code, authVerificationResult]);

  const handleVerifyEncounter = async () => {
    // If no encounter ID, we can't verify it, but we might be authorizing for future
    if (!encounterId) {
      // Just return or show info, button shouldn't be active if we rely on encounterId
      setError(
        'No active encounter to verify. Please create an authorization/ticket instead.',
      );
      return;
    }

    if (!activeAuth?.id) {
      setError(
        'No active authorization found. Please create or verify an authorization first.',
      );
      return;
    }

    setError(null);
    try {
      const result = await verifyEncounterMutation.mutateAsync({
        encounter_id: encounterId,
        auth_id: activeAuth.id,
        verified_by: user?.id || '',
        tariff_group: tariffGroup,
      });

      if (result.success) {
        refetchState();
        onVerificationComplete?.();
      } else {
        setError(result.error || 'Verification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  // Handle pre-filling form from queue (with cascade from existing patient referral data)
  React.useEffect(() => {
    if (selectedQueueItem) {
      setReferralSource(
        selectedQueueItem.referral_source ||
          existingValidReferral?.source ||
          fullPatient?.referring_facility_name ||
          nhisProfile?.referring_facility_name ||
          '',
      );
      setReferralCode(
        selectedQueueItem.referral_code ||
          existingValidReferral?.code ||
          fullPatient?.referral_code ||
          nhisProfile?.referral_code ||
          '',
      );
      setReferralDate(
        selectedQueueItem.referral_date ||
          existingValidReferral?.date ||
          fullPatient?.referral_date ||
          nhisProfile?.referral_date ||
          '',
      );
      setClinicalBasis(selectedQueueItem.clinical_basis || '');
      setReferringClinician(selectedQueueItem.referring_clinician || '');
    }
  }, [selectedQueueItem, existingValidReferral, fullPatient, nhisProfile]);

  const closeQueueModal = () => {
    setSelectedQueueItem(null);
    setShowVerificationForm(false);
    setQueueMode('process');
    resetForm();
  };

  type QueueModalSnapshot = {
    item: ReferralQueueItem;
    queueMode: 'process' | 'view';
    authCode: string;
    tariffGroup: NhisTariffGroup;
    referralSource: string;
    clinicalBasis: string;
    referringClinician: string;
    referralDate: string;
    referralCode: string;
    rejectionReason: string;
    processingNotes: string;
    authVerificationResult: AuthCodeVerificationResult | null;
  };

  const createQueueModalSnapshot = (): QueueModalSnapshot | null => {
    if (!selectedQueueItem) {
      return null;
    }

    return {
      item: selectedQueueItem,
      queueMode,
      authCode,
      tariffGroup,
      referralSource,
      clinicalBasis,
      referringClinician,
      referralDate,
      referralCode,
      rejectionReason,
      processingNotes,
      authVerificationResult,
    };
  };

  const restoreQueueModalSnapshot = (
    snapshot: QueueModalSnapshot,
    message: string,
  ) => {
    startTransition(() => {
      setSelectedQueueItem(snapshot.item);
      setShowVerificationForm(true);
      setQueueMode(snapshot.queueMode);
      setAuthCode(snapshot.authCode);
      setTariffGroup(snapshot.tariffGroup);
      setReferralSource(snapshot.referralSource);
      setClinicalBasis(snapshot.clinicalBasis);
      setReferringClinician(snapshot.referringClinician);
      setReferralDate(snapshot.referralDate);
      setReferralCode(snapshot.referralCode);
      setRejectionReason(snapshot.rejectionReason);
      setProcessingNotes(snapshot.processingNotes);
      setAuthVerificationResult(snapshot.authVerificationResult);
      setError(message);
    });
  };

  const handleCreateAndVerifyAuth = async () => {
    if (!canProcessQueue) {
      setError('You only have view access to this queue.');
      return;
    }
    // 30-Day Expiry Check - ONLY for External Referrals (not internal NHIS approvals)
    if (isExternalReferral && (referralSource || referralDate)) {
      if (!referralDate) {
        setError('Referral Date is required for validity calculation.');
        return;
      }
      const refDate = new Date(referralDate);
      const today = new Date();
      // Calculate difference in days
      const diffTime = Math.abs(today.getTime() - refDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // If date is in future, it's invalid
      if (refDate > today) {
        setError('Referral Date cannot be in the future.');
        return;
      }

      if (diffDays > 30) {
        setError(
          `Referral expired (${diffDays} days). Valid only for 30 days. NHIS Admin override required.`,
        );
        return;
      }
    }

    // Authorization code is required for external referrals but optional for internal NHIS approvals
    if (!authCode.trim() && !isInternalNhisApproval) {
      setError('Authorization code is required for external referrals');
      return;
    }

    setError(null);
    try {
      // If processing a queue item, use the queue processing API
      if (selectedQueueItem) {
        const snapshot = createQueueModalSnapshot();
        const queueLabel =
          selectedQueueItem.request_type === 'internal_nhis_approval'
            ? 'Internal approval is being processed.'
            : 'Referral approval is being processed.';

        startTransition(() => {
          closeQueueModal();
        });
        showToast({
          type: 'success',
          title: 'Processing',
          message: queueLabel,
        });

        try {
          const result = await processQueueMutation.mutateAsync({
            queue_id: selectedQueueItem.id,
            action: 'approve',
            processed_by: user?.id || '',
            processing_notes: processingNotes,
            auth_code: authCode,
            tariff_group: tariffGroup,
            // Send manual overrides
            referral_source: referralSource,
            referral_code: authCode,
            referral_date: referralDate,
            referral_reason: clinicalBasis,
            referring_clinician: referringClinician,
          });

          if (result?.success) {
            showToast({
              type: 'success',
              title: 'Approved',
              message:
                selectedQueueItem.request_type === 'internal_nhis_approval'
                  ? 'Internal approval completed.'
                  : 'Referral approved successfully.',
            });
          } else {
            const message = result?.error || 'Failed to approve referral';
            if (snapshot) {
              restoreQueueModalSnapshot(snapshot, message);
            } else {
              setError(message);
            }
            showToast({ type: 'error', title: 'Approval Failed', message });
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Failed to approve referral';
          if (snapshot) {
            restoreQueueModalSnapshot(snapshot, message);
          } else {
            setError(message);
          }
          showToast({ type: 'error', title: 'Approval Failed', message });
        }
        return;
      }

      // Standard authorization flow (non-queue)
      const newAuth = await createAuthMutation.mutateAsync({
        patient_id: activePatientId,
        nhis_profile_id: nhisProfile?.id,
        auth_code: authCode,
        source:
          isReferred || referralSource
            ? 'external_referral'
            : 'internal_enrollee',
        // Pass external referral details
        referral_source: referralSource,
        clinical_basis: clinicalBasis,
        referring_clinician: referringClinician,
        referral_date: referralDate,
        referral_code: authCode,
        processing_notes: processingNotes,
      } as any);

      // Verify authorization
      await verifyAuthMutation.mutateAsync({
        auth_id: newAuth.id,
        verified_by: user?.id || '',
      });

      // Now verify encounter
      if (encounterId) {
        const result = await verifyEncounterMutation.mutateAsync({
          encounter_id: encounterId,
          auth_id: newAuth.id,
          verified_by: user?.id || '',
          tariff_group: tariffGroup,
        });

        if (result.success) {
          refetchState();
          // Clear queue selection on success
          setSelectedQueueItem(null);
          resetForm();
          onVerificationComplete?.();
        } else {
          setError(result.error || 'Verification failed');
        }
      } else {
        // Just notify success - authorization created for future use
        setSelectedQueueItem(null);
        resetForm();
        onVerificationComplete?.();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create authorization',
      );
    }
  };

  const handleRejectReferral = async () => {
    if (!canProcessQueue) {
      setError('You only have view access to this queue.');
      return;
    }
    if (!selectedQueueItem) {
      setError('No queue item selected');
      return;
    }

    if (!rejectionReason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setError(null);
    const snapshot = createQueueModalSnapshot();
    try {
      startTransition(() => {
        closeQueueModal();
      });
      showToast({
        type: 'info',
        title: 'Processing',
        message: 'Referral rejection is being processed.',
      });

      await processQueueMutation.mutateAsync({
        queue_id: selectedQueueItem.id,
        action: 'reject',
        processed_by: user?.id || '',
        processing_notes: processingNotes,
        rejection_reason: rejectionReason,
      });

      showToast({
        type: 'success',
        title: 'Rejected',
        message: 'Referral rejected successfully.',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to reject referral';
      if (snapshot) {
        restoreQueueModalSnapshot(snapshot, message);
      } else {
        setError(message);
      }
      showToast({ type: 'error', title: 'Rejection Failed', message });
    }
  };

  const resetForm = () => {
    setAuthCode('');
    setReferralSource('');
    setClinicalBasis('');
    setReferringClinician('');
    setReferralDate('');
    setReferralCode('');
    setRejectionReason('');
    setProcessingNotes('');
    setError(null);
    setAuthVerificationResult(null);
  };

  const handleCancelSelection = () => {
    closeQueueModal();
  };

  const handleEmergencyOverride = async () => {
    if (!emergencyReason.trim()) {
      setError('Emergency reason is required');
      return;
    }

    setError(null);
    try {
      const result = await emergencyOverrideMutation.mutateAsync({
        encounter_id: encounterId,
        override_by: user?.id || '',
        reason: emergencyReason,
      });

      if (result.success) {
        refetchState();
        setShowEmergencyOverride(false);
        onVerificationComplete?.();
      } else {
        setError(result.error || 'Emergency override failed');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Emergency override failed',
      );
    }
  };

  if (isLoading && selectedQueueItem) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <SkeletonList count={4} />
      </div>
    );
  }

  // Calculate queue stats
  const pendingCount = queueItems.filter((i) => i.status === 'pending').length;
  const expiredCount = queueItems.filter(
    (i) => i.is_expired && i.status === 'pending',
  ).length;

  const isViewOnly =
    queueMode === 'view' ||
    !canProcessQueue ||
    !!(selectedQueueItem && selectedQueueItem.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Referral Queue Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden">
        {/* ── Queue Header ── */}
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-700/10 to-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <ListChecks size={20} className="text-primary-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">
                  Incoming Verification Queue
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Incoming requests from encounter section
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {/* Stat pills */}
              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-1 py-1 border border-gray-100">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {pendingCount} Pending
                </span>
                {(queueStats as any)?.internal_pending > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {(queueStats as any).internal_pending} Internal
                  </span>
                )}
                {expiredCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {expiredCount} Expired
                  </span>
                )}
              </div>
              <button
                onClick={() => refetchQueue()}
                disabled={queueLoading}
                className="p-2 text-gray-400 hover:text-primary-700 hover:bg-primary-700/5 rounded-lg transition-all"
                title="Refresh queue"
              >
                <RefreshCw
                  size={16}
                  className={`${queueLoading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient, patient number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 bg-white placeholder:text-gray-400"
            />
          </div>
          <select
            value={filterRequestType}
            onChange={(e) => setFilterRequestType(e.target.value)}
            className="appearance-none px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 bg-white font-medium text-gray-600 pr-8"
          >
            <option value="all">All Types</option>
            <option value="external_referral">External Referrals</option>
            <option value="internal_nhis_approval">Internal Approvals</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 bg-white font-medium text-gray-600 pr-8"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* ── Queue Table ── */}
        <div className="max-h-[600px] overflow-y-auto">
          {queueLoading && queueItems.length === 0 ? (
            <SkeletonTable rows={5} columns={4} />
          ) : filteredQueueItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                <Shield size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-500 text-sm">
                No verification requests
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Requests from encounters will appear here
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 w-14 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Type & Source
                  </th>
                  <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredQueueItems.map((item, index) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      startTransition(() => {
                        setSelectedQueueItem(item);
                        setShowVerificationForm(true);
                        setQueueMode(
                          item.status === 'pending' && canProcessQueue
                            ? 'process'
                            : 'view',
                        );
                      });
                    }}
                    className={`hover:bg-primary-700/[0.02] cursor-pointer transition-colors group ${
                      selectedQueueItem?.id === item.id
                        ? 'bg-primary-700/[0.04] ring-1 ring-inset ring-primary-700/10'
                        : ''
                    } ${item.is_expired ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 rounded-md text-[11px] font-bold text-gray-500">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-primary-700/10 to-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <User size={15} className="text-primary-700" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors text-sm">
                            {item.patient?.surname}, {item.patient?.first_name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-400 font-mono">
                              {item.patient?.emr_number}
                            </span>
                            {item.patient?.nhis_number && (
                              <span className="text-[10px] text-primary-700 bg-primary-700/5 px-1.5 py-0.5 rounded font-semibold">
                                {item.patient.nhis_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5 items-start">
                        <div className="flex items-center gap-1.5">
                          {item.request_type === 'internal_nhis_approval' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                              <span className="w-1 h-1 rounded-full bg-blue-500" />
                              Internal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200/60">
                              <span className="w-1 h-1 rounded-full bg-orange-500" />
                              External
                            </span>
                          )}
                          {item.priority !== 'normal' && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                item.priority === 'urgent'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                                  : 'bg-red-50 text-red-700 border-red-200/60'
                              }`}
                            >
                              {item.priority.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span
                          className="text-xs text-gray-400 truncate max-w-[180px]"
                          title={
                            item.referral_source ||
                            item.target_clinic?.clinic_name
                          }
                        >
                          {item.referral_source ||
                            item.target_clinic?.clinic_name ||
                            '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        {getQueueStatusBadge(item.status, item.is_expired)}
                        <div className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Clock size={10} className="flex-shrink-0" />
                          <span>{formatQueueDuration(item.requested_at).text}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 border shadow-sm hover:shadow ${
                          item.status === 'pending'
                            ? 'bg-primary-700/5 text-primary-700 border-primary-700/20 hover:bg-primary-700/10'
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {item.status === 'pending' ? (
                          <>
                            <ShieldCheck size={12} />
                            Verify
                          </>
                        ) : (
                          <>
                            <ChevronRight size={12} />
                            View
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Verification Form - REDESIGNED MODERN MODAL */}
      {((selectedQueueItem && showVerificationForm) ||
        (patientId && !selectedQueueItem)) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => !selectedQueueItem && onVerificationComplete?.()}
          />

          <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col ring-1 ring-black/5">
            {/* Modal Header */}
            <div className="px-8 py-6 bg-gradient-to-r from-primary-700 to-[#008545] border-b border-green-800 flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-6">
                {/* NDC Branding */}
                <div className="hidden sm:flex items-center gap-4 border-r border-white/20 pr-6">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center p-1.5 backdrop-blur-sm border border-white/10 shadow-inner">
                    
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-tight text-white">
                      XENOCARE
                    </h4>
                    <span className="text-xs font-bold tracking-widest text-[#fbbf24] uppercase">
                      EMR System
                    </span>
                  </div>
                </div>

                {/* Context Title & Avatar */}
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-black/10 border border-white/10 ${
                      isInternalNhisApproval
                        ? 'bg-blue-600 text-white'
                        : isExternalReferral
                          ? 'bg-orange-500 text-white'
                          : 'bg-white/20 text-white backdrop-blur-md'
                    }`}
                  >
                    {isInternalNhisApproval ? (
                      <Shield size={24} />
                    ) : (
                      <Building2 size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight drop-shadow-sm">
                      {selectedQueueItem
                        ? isViewOnly
                          ? isInternalNhisApproval
                            ? 'Internal Approval Details'
                            : 'Referral Review'
                          : isInternalNhisApproval
                            ? 'Process Internal Approval'
                            : 'Process External Referral'
                        : 'NHIS Verification'}
                    </h3>
                    <div className="flex items-center gap-2 text-green-50 mt-1 text-sm">
                      {fullPatient ? (
                        <>
                          <span className="font-semibold">
                            {fullPatient.surname}, {fullPatient.first_name}
                          </span>
                          <span className="text-white/40">•</span>
                          <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white text-xs border border-white/10">
                            {fullPatient.emr_number}
                          </span>
                        </>
                      ) : selectedQueueItem ? (
                        <>
                          <span className="font-semibold">
                            {selectedQueueItem.patient?.surname},{' '}
                            {selectedQueueItem.patient?.first_name}
                          </span>
                          <span className="text-white/40">•</span>
                          <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white text-xs border border-white/10">
                            {selectedQueueItem.patient?.emr_number}
                          </span>
                        </>
                      ) : (
                        <span className="text-green-100 italic">
                          Verifying patient eligibility & status
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCancelSelection}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 shadow-lg hover:shadow-xl active:scale-95"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="overflow-y-auto p-10 custom-scrollbar bg-gray-50/50">
              <div className="space-y-10 max-w-6xl mx-auto">
                {/* Referral Expiry Warning Banner - Prominently Displayed at Top */}
                {isExternalReferral &&
                  (fullPatient?.referral_date ||
                    nhisProfile?.referral_date ||
                    referralDate) && (
                    <div className="bg-red-600 rounded-xl p-4 shadow-lg shadow-red-200 text-white flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                          <Clock size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white/80 uppercase tracking-wider">
                            Referral Validity
                          </p>
                          <p className="font-bold text-lg leading-none mt-0.5">
                            Expires In
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-black tracking-tight font-mono">
                          <RealTimeCountdown
                            targetDate={(() => {
                              const rDate =
                                fullPatient?.referral_date ||
                                nhisProfile?.referral_date ||
                                referralDate;
                              if (!rDate) return null;
                              const d = new Date(rDate);
                              d.setDate(d.getDate() + 30);
                              return d;
                            })()}
                          />
                        </span>
                      </div>
                    </div>
                  )}

                {/* Status Banners */}
                {selectedQueueItem &&
                  selectedQueueItem.status !== 'pending' && (
                    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm flex items-start gap-5">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          selectedQueueItem.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {selectedQueueItem.status === 'approved' ? (
                          <CheckCircle size={24} />
                        ) : (
                          <XCircle size={24} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4
                            className={`text-base font-bold capitalize ${
                              selectedQueueItem.status === 'approved'
                                ? 'text-emerald-900'
                                : 'text-red-900'
                            }`}
                          >
                            Request {selectedQueueItem.status}
                          </h4>
                          <span className="text-xs text-gray-400 font-medium">
                            {selectedQueueItem.processed_at
                              ? new Date(
                                  selectedQueueItem.processed_at,
                                ).toLocaleString()
                              : ''}
                          </span>
                        </div>

                        <div className="prose prose-sm max-w-none">
                          {selectedQueueItem.status === 'rejected' && (
                            <p className="text-red-700 bg-red-50 p-3 rounded-xl border border-red-100 text-sm">
                              <span className="font-bold">
                                Rejection Reason:
                              </span>{' '}
                              {selectedQueueItem.rejection_reason}
                            </p>
                          )}
                          {selectedQueueItem.processing_notes && (
                            <p className="text-gray-600 bg-gray-50/50 p-3 rounded-xl text-sm mt-2">
                              <span className="font-bold">Notes:</span>{' '}
                              {selectedQueueItem.processing_notes}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            Processed by{' '}
                            {selectedQueueItem.processor
                              ? `${selectedQueueItem.processor.first_name} ${selectedQueueItem.processor.last_name}`
                              : 'Unknown Admin'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Internal Approval Context Card */}
                {isInternalNhisApproval && selectedQueueItem && (
                  <div className="relative overflow-hidden bg-white rounded-xl border border-blue-100 shadow-sm group hover:shadow-md transition-shadow duration-300">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 to-indigo-600" />
                    <div className="p-6 pl-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Shield size={18} />
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                            Internal Approval Request
                          </h4>
                        </div>
                        {/* Time in Queue Badge */}
                        {(() => {
                          const dur = formatQueueDuration(
                            selectedQueueItem.requested_at,
                          );
                          return (
                            <span
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${dur.colorClass} ${
                                dur.minutes >= 1440
                                  ? 'bg-red-50 ring-1 ring-red-200'
                                  : dur.minutes >= 240
                                    ? 'bg-orange-50 ring-1 ring-orange-200'
                                    : dur.minutes >= 60
                                      ? 'bg-amber-50 ring-1 ring-amber-100'
                                      : 'bg-green-50 ring-1 ring-green-100'
                              }`}
                            >
                              <Clock size={14} />
                              <span>{dur.text} in queue</span>
                            </span>
                          );
                        })()}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Request Type
                          </span>
                          <p className="font-bold text-gray-800 text-sm">
                            Internal NHIS Approval
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Target Clinic
                          </span>
                          <p className="font-bold text-blue-700 text-sm flex items-center gap-1.5">
                            <Building2 size={14} />
                            {selectedQueueItem.target_clinic?.clinic_name ||
                              selectedQueueItem.visit_type ||
                              selectedQueueItem.chief_complaint ||
                              'Specialty Clinic'}
                          </p>
                          {selectedQueueItem.target_clinic?.clinic_code && (
                            <span className="text-xs font-mono text-gray-400 mt-0.5 block">
                              {selectedQueueItem.target_clinic.clinic_code}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Requested Date
                          </span>
                          <p className="font-bold text-gray-800 text-sm">
                            {new Date(
                              selectedQueueItem.requested_at,
                            ).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <span className="text-xs text-gray-400 mt-0.5 block">
                            {new Date(
                              selectedQueueItem.requested_at,
                            ).toLocaleTimeString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Assigned Doctor
                          </span>
                          <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                            <User size={14} />
                            {selectedQueueItem.target_doctor
                              ? `Dr. ${selectedQueueItem.target_doctor.first_name} ${selectedQueueItem.target_doctor.last_name}`
                              : selectedQueueItem.requesting_doctor
                                ? `Dr. ${selectedQueueItem.requesting_doctor.first_name} ${selectedQueueItem.requesting_doctor.last_name}`
                                : 'Not assigned'}
                          </p>
                        </div>
                      </div>

                      {/* Request Notes */}
                      {selectedQueueItem.request_notes && (
                        <div className="mt-5 pt-4 border-t border-gray-100">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                            Request Notes
                          </span>
                          <p className="text-sm text-gray-600 font-medium italic bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                            "{selectedQueueItem.request_notes}"
                          </p>
                        </div>
                      )}

                      {selectedQueueItem.clinical_basis && (
                        <div className="mt-5 pt-4 border-t border-gray-100">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                            Clinical Reason
                          </span>
                          <p className="text-sm text-gray-600 font-medium italic bg-gray-50 p-4 rounded-xl border border-gray-100">
                            "{selectedQueueItem.clinical_basis}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Patient & Authorization Info - Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* NHIS Profile Info */}
                  {(nhisProfile || fullPatient) && (
                    <div className="col-span-1 md:col-span-7 bg-white rounded-xl p-6 border border-gray-100 shadow-sm flex flex-col">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <BadgeCheck size={16} className="text-green-700" />
                        Identity & Payer
                      </h4>
                      <div className="grid grid-cols-2 gap-y-6 gap-x-4 flex-1">
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase block mb-1">
                            Patient Name
                          </span>
                          <span className="font-bold text-gray-800 text-sm">
                            {fullPatient?.patient_category === 'Military' &&
                            fullPatient?.rank
                              ? `${fullPatient.rank} `
                              : ''}
                            {fullPatient?.first_name}{' '}
                            {fullPatient?.middle_name
                              ? `${fullPatient?.middle_name} `
                              : ''}
                            {fullPatient?.surname}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase block mb-1">
                            Category
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${
                              fullPatient?.patient_category === 'Military'
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : fullPatient?.patient_category === 'Civilian'
                                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                                  : (fullPatient?.patient_category as string) ===
                                      'Dependent'
                                    ? 'bg-purple-50 text-purple-700 border-purple-100'
                                    : 'bg-gray-50 text-gray-700 border-gray-100'
                            }`}
                          >
                            {fullPatient?.patient_category || 'Uncategorized'}
                          </span>
                        </div>
                        {fullPatient?.patient_category === 'Military' &&
                          (fullPatient as any)?.arm_of_service && (
                            <div>
                              <span className="text-xs font-semibold text-gray-400 uppercase block mb-1">
                                Service
                              </span>
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold border bg-gray-50 text-gray-800 border-gray-100">
                                {(fullPatient as any).arm_of_service}
                              </span>
                            </div>
                          )}
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase block mb-1">
                            Patient number
                          </span>
                          <span className="font-mono font-bold text-gray-700 text-sm">
                            {fullPatient?.emr_number || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase block mb-1">
                            NHIS Number
                          </span>
                          <span className="font-mono font-bold text-primary-700 text-sm">
                            {fullPatient?.nhis_number || 'N/A'}
                          </span>
                        </div>
                      </div>
                      {/* Full Payer Details Card */}
                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <PayerDetailsCard
                          payerInfo={
                            fullPatient?.payer_info as PayerInfo | null
                          }
                          nhisNumber={fullPatient?.nhis_number}
                          insuranceType={fullPatient?.insurance_type}
                          patientCategory={fullPatient?.patient_category}
                          compact
                        />
                      </div>
                    </div>
                  )}

                  {/* Active Authorization / Eligibility */}
                  {activeAuth && (
                    <div
                      className={`col-span-1 md:col-span-5 rounded-xl p-6 shadow-sm border flex flex-col justify-between ${
                        existingValidReferral
                          ? 'bg-green-50 border-green-200'
                          : 'bg-emerald-50 border-emerald-100'
                      }`}
                    >
                      <div>
                        <h4
                          className={`text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2 ${
                            existingValidReferral
                              ? 'text-green-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          <Shield size={16} />
                          {existingValidReferral
                            ? 'Approved Auth'
                            : 'Existing Auth'}
                        </h4>

                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-xs font-extrabold uppercase block opacity-60 ${
                              existingValidReferral
                                ? 'text-green-800'
                                : 'text-emerald-800'
                            }`}
                          >
                            Authorization Code
                          </span>
                          <span
                            className={`font-mono font-black text-2xl tracking-tight ${
                              existingValidReferral
                                ? 'text-green-900'
                                : 'text-emerald-900'
                            }`}
                          >
                            {activeAuth.auth_code}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-black/5 flex justify-between items-end">
                        <div className="text-xs font-medium opacity-80">
                          Expires in:
                        </div>
                        <RealTimeCountdown
                          targetDate={activeAuth.expiry_date}
                          className={`text-sm font-bold ${
                            existingValidReferral
                              ? 'text-green-800'
                              : 'text-emerald-800'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* External Referral Context Card */}
                {isExternalReferral && (
                  <div className="relative overflow-hidden bg-white rounded-xl border border-gray-100 shadow-sm group hover:shadow-md transition-shadow duration-300">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary-700 to-[#008545]" />
                    <div className="p-6 pl-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-50 rounded-lg text-primary-700">
                            <Building2 size={18} />
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                            External Referral Data
                          </h4>
                        </div>
                        {/* Time in Queue Badge */}
                        {selectedQueueItem &&
                          (() => {
                            const dur = formatQueueDuration(
                              selectedQueueItem.requested_at,
                            );
                            return (
                              <span
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${dur.colorClass} ${
                                  dur.minutes >= 1440
                                    ? 'bg-red-50 ring-1 ring-red-200'
                                    : dur.minutes >= 240
                                      ? 'bg-orange-50 ring-1 ring-orange-200'
                                      : dur.minutes >= 60
                                        ? 'bg-amber-50 ring-1 ring-amber-100'
                                        : 'bg-green-50 ring-1 ring-green-100'
                                }`}
                              >
                                <Clock size={14} />
                                <span>{dur.text} in queue</span>
                              </span>
                            );
                          })()}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Referring Facility
                          </span>
                          <p className="font-bold text-gray-800 text-sm leading-snug">
                            {fullPatient?.referring_facility_name ||
                              nhisProfile?.referring_facility_name ||
                              referralSource ||
                              'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Referral / Auth Code
                          </span>
                          <p className="font-mono font-bold text-gray-800 text-sm bg-gray-50 inline-block px-2 py-0.5 rounded border border-gray-100">
                            {authCode || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Issue Date
                          </span>
                          <p className="font-bold text-gray-800 text-sm">
                            {fullPatient?.referral_date ||
                            nhisProfile?.referral_date ||
                            referralDate
                              ? new Date(
                                  fullPatient?.referral_date ||
                                    nhisProfile?.referral_date ||
                                    referralDate ||
                                    '',
                                ).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Target Clinic
                          </span>
                          <p className="font-bold text-blue-700 text-sm flex items-center gap-1.5">
                            <Building2 size={14} />
                            {selectedQueueItem?.target_clinic?.clinic_name ||
                              selectedQueueItem?.visit_type ||
                              'Not specified'}
                          </p>
                          {selectedQueueItem?.target_doctor && (
                            <span className="text-xs text-gray-500 mt-0.5 block flex items-center gap-1">
                              <User size={10} /> Dr.{' '}
                              {selectedQueueItem.target_doctor.first_name}{' '}
                              {selectedQueueItem.target_doctor.last_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {(clinicalBasis ||
                        fullPatient?.referral_reason ||
                        nhisProfile?.referral_reason) && (
                        <div className="mt-6 pt-5 border-t border-gray-100">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                            Clinical Indication
                          </span>
                          <p className="text-sm text-gray-600 font-medium italic bg-gray-50 p-4 rounded-xl border border-gray-100">
                            "
                            {clinicalBasis ||
                              fullPatient?.referral_reason ||
                              nhisProfile?.referral_reason}
                            "
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column - Form Inputs */}
                  <div className="lg:col-span-12 space-y-8">
                    {/* Status & Alerts Section */}
                    <div className="flex flex-col gap-4">
                      {selectedQueueItem?.is_expired && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-4">
                          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                            <AlertTriangle className="text-red-600" size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-red-800">
                              Referral Expired
                            </h4>
                            <p className="text-sm text-red-700">
                              This referral is over 30 days old. Policy requires
                              rejection or admin override.
                            </p>
                          </div>
                        </div>
                      )}

                      {isExternalReferral &&
                        !selectedQueueItem?.is_expired &&
                        existingValidReferral && (
                          <div className="p-5 bg-green-50 border border-green-200 rounded-xl flex items-start gap-4 shadow-sm">
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                              <CheckCircle
                                className="text-green-600"
                                size={20}
                              />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-green-900">
                                Valid Referral & Authorization Found
                              </h4>
                              <p className="text-sm text-green-700 mt-1 leading-relaxed">
                                A valid referral code{' '}
                                <span className="font-mono font-black bg-green-100 px-1.5 rounded text-green-800">
                                  {existingValidReferral.code}
                                </span>{' '}
                                exists. It has{' '}
                                <span className="font-bold">
                                  {existingValidReferral.daysRemaining} days
                                  remaining
                                </span>{' '}
                                (valid within 30-day window).
                              </p>
                              <p className="text-sm text-green-600 mt-2 font-medium flex items-center gap-1.5">
                                <Shield size={14} />
                                Patient does not need to re-enter authorization
                                code — existing code is still valid.
                              </p>
                              <p className="text-xs text-green-500 mt-1 italic">
                                All fields have been auto-populated from patient
                                record.
                              </p>
                            </div>
                          </div>
                        )}

                      {/* Active Auth Still Valid — Patient doesn't need new auth code */}
                      {activeAuth &&
                        !existingValidReferral &&
                        !selectedQueueItem?.is_expired && (
                          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 shadow-sm">
                            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                              <Shield className="text-emerald-600" size={18} />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-emerald-900 text-sm">
                                Active Authorization Detected
                              </h4>
                              <p className="text-xs text-emerald-700 mt-1">
                                Auth code{' '}
                                <span className="font-mono font-bold bg-emerald-100 px-1.5 rounded">
                                  {activeAuth.auth_code}
                                </span>{' '}
                                is active and has not expired.
                                {activeAuth.expiry_date && (
                                  <>
                                    {' '}
                                    Expires:{' '}
                                    <RealTimeCountdown
                                      targetDate={activeAuth.expiry_date}
                                      className="text-emerald-600 font-bold"
                                    />
                                  </>
                                )}
                              </p>
                              <p className="text-xs text-emerald-600 mt-1 font-medium">
                                No new authorization code needed — auto-filled
                                from existing record.
                              </p>
                            </div>
                          </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Column 1: Core Verification */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
                          Primary Verification
                        </h4>

                        <div className="space-y-4">
                          <AuthCodeInput
                            value={authCode}
                            onChange={setAuthCode}
                            onVerify={handleAuthCodeVerification}
                            verificationResult={authVerificationResult}
                            disabled={
                              selectedQueueItem?.is_expired || isViewOnly
                            }
                            required={
                              !isInternalNhisApproval &&
                              !(existingValidReferral || activeAuth)
                            }
                            label={`Authorization Code ${
                              isInternalNhisApproval
                                ? '(Optional for Internal)'
                                : existingValidReferral ||
                                    (activeAuth &&
                                      authCode === activeAuth.auth_code)
                                  ? '✓ AUTO-FILLED — STILL VALID'
                                  : ''
                            }`}
                            placeholder={
                              selectedQueueItem?.is_expired
                                ? 'N/A - EXPIRED'
                                : isInternalNhisApproval
                                  ? 'Optional for internal patients'
                                  : 'Enter authorization code (e.g., NHIS/AUTH/25/00341)'
                            }
                            showValidIcon={
                              !!(
                                activeAuth && authCode === activeAuth.auth_code
                              )
                            }
                            className=""
                          />
                        </div>

                        <div className="pt-4 space-y-4">
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
                            Internal Notes
                          </label>
                          <textarea
                            value={processingNotes}
                            onChange={(e) => setProcessingNotes(e.target.value)}
                            placeholder="Optional internal remarks..."
                            rows={3}
                            disabled={isViewOnly}
                            className="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm resize-none disabled:opacity-60 placeholder:text-gray-300"
                          />
                        </div>
                      </div>

                      {/* Column 2: External Source Info (only for external referrals) */}
                      <div className="space-y-6">
                        {isExternalReferral ? (
                          <>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
                              Referral Meta-Data
                            </h4>

                            <div
                              className={`p-6 rounded-xl border space-y-5 shadow-sm ${
                                existingValidReferral
                                  ? 'bg-green-50/30 border-green-100'
                                  : 'bg-white border-gray-100'
                              }`}
                            >
                              <div className="grid grid-cols-1 gap-5">
                                <div>
                                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Referring Facility
                                  </label>
                                  <input
                                    type="text"
                                    value={referralSource}
                                    onChange={(e) =>
                                      setReferralSource(e.target.value)
                                    }
                                    disabled={isViewOnly}
                                    className={`w-full px-4 py-3 border rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-gray-50 disabled:text-gray-500 ${
                                      existingValidReferral && referralSource
                                        ? 'bg-green-50/50 border-green-200 text-green-800'
                                        : 'bg-white border-gray-200'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Referral Date{' '}
                                    {!existingValidReferral && (
                                      <span className="text-red-500">*</span>
                                    )}
                                  </label>
                                  <input
                                    type="date"
                                    value={referralDate}
                                    onChange={(e) =>
                                      setReferralDate(e.target.value)
                                    }
                                    disabled={isViewOnly}
                                    className={`w-full px-4 py-3 border rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-gray-50 disabled:text-gray-500 ${
                                      existingValidReferral && referralDate
                                        ? 'bg-green-50/50 border-green-200 text-green-800'
                                        : 'bg-white border-gray-200'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Referring Clinician
                                  </label>
                                  <input
                                    type="text"
                                    value={referringClinician}
                                    onChange={(e) =>
                                      setReferringClinician(e.target.value)
                                    }
                                    placeholder="Name of the referring doctor"
                                    disabled={isViewOnly}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-gray-50 disabled:text-gray-500"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Clinical Basis
                                  </label>
                                  <textarea
                                    value={clinicalBasis}
                                    onChange={(e) =>
                                      setClinicalBasis(e.target.value)
                                    }
                                    placeholder="Reason for referral..."
                                    rows={2}
                                    disabled={isViewOnly}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
                              Request Details
                            </h4>

                            <div className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm space-y-6">
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                  Clinical Basis / Reason
                                </label>
                                <textarea
                                  value={clinicalBasis}
                                  onChange={(e) =>
                                    setClinicalBasis(e.target.value)
                                  }
                                  placeholder="Reason for consultation..."
                                  rows={3}
                                  disabled={isViewOnly}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-gray-50 disabled:text-gray-500 resize-none placeholder:text-gray-300"
                                />
                              </div>
                              {selectedQueueItem?.request_notes && (
                                <div>
                                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Request Notes
                                  </label>
                                  <p className="text-sm text-gray-700 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 italic">
                                    "{selectedQueueItem.request_notes}"
                                  </p>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* Rejection Handling */}
                        {selectedQueueItem && !isViewOnly && (
                          <div className="space-y-4 pt-4 border-t border-gray-100">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
                              Rejection Reason
                            </h4>
                            <div className="group">
                              <textarea
                                value={rejectionReason}
                                onChange={(e) =>
                                  setRejectionReason(e.target.value)
                                }
                                placeholder="If rejecting, please state the reason here..."
                                rows={2}
                                disabled={isViewOnly}
                                className="w-full px-4 py-4 bg-red-50/50 border border-red-100 rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-400 transition-all text-sm resize-none placeholder:text-red-300 text-red-700 font-medium"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-4 animate-shake shadow-sm">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                      <XCircle className="text-red-500" size={20} />
                    </div>
                    <p className="text-red-800 text-sm font-bold">{error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="shrink-0 p-6 px-8 flex flex-wrap gap-4 items-center bg-white border-t border-gray-100 z-10">
              <div className="flex gap-4 w-full sm:w-auto ml-auto">
                <button
                  onClick={handleCancelSelection}
                  className="px-8 py-3.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm"
                >
                  {isViewOnly ? 'Close Details' : 'Cancel'}
                </button>

                {selectedQueueItem && !isViewOnly && (
                  <button
                    onClick={handleRejectReferral}
                    disabled={!rejectionReason.trim()}
                    className="px-8 py-3.5 bg-white border border-red-100 text-red-600 rounded-xl font-bold hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2"
                  >
                    <XCircle size={18} />
                    Reject
                  </button>
                )}

                {selectedQueueItem?.is_expired !== true && !isViewOnly && (
                  <button
                    onClick={handleCreateAndVerifyAuth}
                    disabled={
                      createAuthMutation.isPending ||
                      (!authCode.trim() && !isInternalNhisApproval) ||
                      !!(
                        selectedQueueItem &&
                        isExternalReferral &&
                        !referralDate
                      )
                    }
                    className="flex-1 sm:flex-none px-10 py-3.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl font-bold hover:scale-[1.01] shadow-lg shadow-green-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                  >
                    {createAuthMutation.isPending ? (
                      <RefreshCw className="animate-spin" size={18} />
                    ) : (
                      <BadgeCheck size={18} />
                    )}
                    {selectedQueueItem
                      ? 'Approve & Verify'
                      : 'Create & Verify Authorization'}
                  </button>
                )}

                {!selectedQueueItem && (
                  <button
                    onClick={() => setShowEmergencyOverride(true)}
                    disabled={!encounterId}
                    className="px-6 py-3.5 border border-amber-200 bg-amber-50 text-amber-700 rounded-xl font-bold hover:bg-amber-100 transition-all disabled:opacity-30 flex items-center gap-2"
                  >
                    <AlertTriangle size={18} />
                    Override
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NhisVerificationPanel;
