// =============================================================================
// NHIS Approvals List Component
// =============================================================================

import React, { useState, useMemo, useEffect, startTransition } from 'react';
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  AlertTriangle,
  User,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileText,
  Stethoscope,
  X,
  Hash,
  CalendarDays,
  MessageSquare,
  BadgeCheck,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Activity,
  Clipboard,
  StickyNote,
  Eye,
  LayoutList,
} from 'lucide-react';
import { useNhisApprovals, useProcessApprovalDecision } from '../hooks';
import type { NhisApprovalStatus, NhisApprovalFilters } from '../types';
import { useAuth } from '../../../contexts/AuthContext';
import { SkeletonTable } from '../../../components/ui/SkeletonLoader';
import { usePatient } from '../../patient-registration/hooks/usePatient';
import { PayerDetailsCard } from './PayerDetailsCard';
import type { PayerInfo } from '../../../types/database.types';
import { useToast } from '../../../components/ui/Toast';
import { formatClinicalTextForDisplay } from '../../../utils/clinicalTextFormatter';

// XenoCare Logo component

// Format currency in Naira
const formatCurrency = (amount: number) =>
  `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const STATUS_OPTIONS: { value: NhisApprovalStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'provisional', label: 'Provisional' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

const SERVICE_TYPE_OPTIONS = [
  { value: '', label: 'All Services' },
  { value: 'lab_request', label: 'Lab Request' },
  { value: 'radiology_request', label: 'Radiology' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'admission', label: 'Admission' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'physiotherapy_plan', label: 'Physiotherapy Plan' },
  { value: 'physiotherapy_plan_extension', label: 'Physio Plan Extension' },
];

function getStatusBadge(status: NhisApprovalStatus) {
  const config: Record<
    NhisApprovalStatus,
    { color: string; dotColor: string; icon: React.ReactNode; label: string }
  > = {
    not_required: {
      color: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200',
      dotColor: 'bg-gray-400',
      icon: null,
      label: 'Not Required',
    },
    pending: {
      color: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      dotColor: 'bg-amber-500 animate-pulse',
      icon: <Clock size={12} />,
      label: 'Pending',
    },
    provisional: {
      color: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
      dotColor: 'bg-sky-500',
      icon: <ShieldAlert size={12} />,
      label: 'Provisional',
    },
    approved: {
      color: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
      dotColor: 'bg-emerald-500',
      icon: <CheckCircle size={12} />,
      label: 'Approved',
    },
    rejected: {
      color: 'bg-red-50 text-red-700 ring-1 ring-red-200',
      dotColor: 'bg-red-500',
      icon: <XCircle size={12} />,
      label: 'Rejected',
    },
    expired: {
      color: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
      dotColor: 'bg-orange-500',
      icon: <Clock size={12} />,
      label: 'Expired',
    },
  };

  const { color, dotColor, icon, label } = config[status] || config.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}

// ── Clinical Info Block ──
function ClinicalInfoBlock({
  icon,
  label,
  content,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  content: string;
  variant?: 'primary' | 'amber' | 'default';
}) {
  const bgMap = {
    primary: 'bg-primary-700/[0.03] border-primary-700/10',
    amber: 'bg-amber-50/70 border-amber-200/60',
    default: 'bg-gray-50/80 border-gray-200/60',
  };
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
        {icon}
        {label}
      </label>
      <div
        className={`text-sm text-gray-800 whitespace-pre-wrap p-3.5 rounded-lg border leading-relaxed ${bgMap[variant]}`}
      >
        {content}
      </div>
    </div>
  );
}

// ── Decision Option Card ──
function DecisionOption({
  value,
  selected,
  onSelect,
  icon,
  title,
  description,
  color,
}: {
  value: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'amber' | 'green' | 'red';
}) {
  const colorMap = {
    amber: {
      selected:
        'border-amber-400 bg-amber-50/80 shadow-sm ring-1 ring-amber-200/50',
      hover: 'border-gray-200 hover:border-amber-200 hover:bg-amber-50/30',
      icon: 'text-amber-600',
      title: 'text-amber-800',
      desc: 'text-amber-600/80',
      radio: 'text-amber-500 focus:ring-amber-400',
    },
    green: {
      selected:
        'border-emerald-400 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-200/50',
      hover:
        'border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/30',
      icon: 'text-emerald-600',
      title: 'text-emerald-800',
      desc: 'text-emerald-600/80',
      radio: 'text-emerald-500 focus:ring-emerald-400',
    },
    red: {
      selected:
        'border-red-400 bg-red-50/80 shadow-sm ring-1 ring-red-200/50',
      hover: 'border-gray-200 hover:border-red-200 hover:bg-red-50/30',
      icon: 'text-red-500',
      title: 'text-red-700',
      desc: 'text-red-500/80',
      radio: 'text-red-500 focus:ring-red-400',
    },
  };
  const c = colorMap[color];
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-150 ${
        selected ? c.selected : c.hover
      }`}
    >
      <input
        type="radio"
        name="decision"
        value={value}
        checked={selected}
        onChange={onSelect}
        className={`mt-1 ${c.radio}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={c.icon}>{icon}</span>
          <span className={`font-semibold text-sm ${c.title}`}>{title}</span>
        </div>
        <p className={`text-[11px] mt-0.5 leading-relaxed ${c.desc}`}>
          {description}
        </p>
      </div>
    </label>
  );
}

interface ApprovalDecisionModalProps {
  approval: {
    id: string;
    service_name: string | null;
    service_type?: string;
    service_category?: string;
    patient_id?: string;
    patient?: { first_name: string; surname: string; patient_id?: string };
    patient_name?: string;
    patient_emr_number?: string;
    encounter?: { encounter_number?: string };
    clinical_findings?: string | null;
    provisional_diagnosis?: string | null;
    clinical_justification?: string | null;
    request_reason?: string | null;
    estimated_cost?: number | null;
  };
  onClose: () => void;
  onDecision: (
    decision: 'approved' | 'rejected' | 'provisional',
    notes?: string,
    reason?: string,
    authCode?: string,
    authDate?: string,
  ) => Promise<void>;
  isProcessing: boolean;
  initialDraft?: ApprovalDecisionDraft | null;
}

type ApprovalDecisionValue = 'approved' | 'rejected' | 'provisional';

type ApprovalDecisionDraft = {
  decision: ApprovalDecisionValue;
  notes: string;
  reason: string;
  authorizationCode: string;
  authorizationDate: string;
};

const DEFAULT_APPROVAL_DRAFT: ApprovalDecisionDraft = {
  decision: 'provisional',
  notes: '',
  reason: '',
  authorizationCode: '',
  authorizationDate: '',
};

function ApprovalDecisionModal({
  approval,
  onClose,
  onDecision,
  isProcessing,
  initialDraft,
}: ApprovalDecisionModalProps) {
  const [decision, setDecision] = useState<ApprovalDecisionValue>(
    initialDraft?.decision || DEFAULT_APPROVAL_DRAFT.decision,
  );
  const [notes, setNotes] = useState(
    initialDraft?.notes || DEFAULT_APPROVAL_DRAFT.notes,
  );
  const [reason, setReason] = useState(
    initialDraft?.reason || DEFAULT_APPROVAL_DRAFT.reason,
  );
  const [authorizationCode, setAuthorizationCode] = useState(
    initialDraft?.authorizationCode || DEFAULT_APPROVAL_DRAFT.authorizationCode,
  );
  const [authorizationDate, setAuthorizationDate] = useState(
    initialDraft?.authorizationDate || DEFAULT_APPROVAL_DRAFT.authorizationDate,
  );

  // Fetch full patient data for payer details
  const patientUuid =
    approval.patient_id || (approval.patient as any)?.id || '';
  const { data: fullPatient } = usePatient(patientUuid);

  const patientName =
    approval.patient_name ||
    (approval.patient
      ? `${approval.patient.first_name} ${approval.patient.surname}`
      : 'Unknown Patient');

  const serviceTypeLabel =
    approval.service_type
      ?.replace('_', ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()) || '';
  const serviceCategoryLabel = approval.service_category
    ? approval.service_category.charAt(0).toUpperCase() +
      approval.service_category.slice(1)
    : '';
  const clinicalFindingsDisplay = formatClinicalTextForDisplay(
    approval.clinical_findings,
  );
  const provisionalDiagnosisDisplay = formatClinicalTextForDisplay(
    approval.provisional_diagnosis,
  );
  const requestReasonDisplay = formatClinicalTextForDisplay(
    approval.request_reason,
  );
  const clinicalJustificationDisplay = formatClinicalTextForDisplay(
    approval.clinical_justification,
  );

  useEffect(() => {
    const draft = initialDraft || DEFAULT_APPROVAL_DRAFT;
    setDecision(draft.decision);
    setNotes(draft.notes);
    setReason(draft.reason);
    setAuthorizationCode(draft.authorizationCode);
    setAuthorizationDate(draft.authorizationDate);
  }, [approval.id, initialDraft]);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[6px] z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col ring-1 ring-black/5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex-shrink-0 bg-gradient-to-r from-primary-700 via-primary-700 to-emerald-600 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjwvcGF0dGVybj48L2RlZnM+PC9zdmc+')] opacity-10" />
            <div className="relative flex items-center justify-between px-7 py-4">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <Shield size={18} className="text-white/80" />
                    NHIS Service Authorization
                  </h2>
                  <p className="text-white/60 text-xs mt-0.5 font-medium">
                    XenoCare
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── Service & Patient Summary Strip ── */}
          <div className="flex-shrink-0 bg-white border-b border-gray-100 px-7 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-5 flex-1 min-w-0">
                {/* Service */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-primary-700/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="h-5 w-5 text-primary-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {approval.service_name || 'Unknown Service'}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-semibold uppercase text-gray-600">
                        {serviceTypeLabel}
                      </span>
                      {serviceCategoryLabel && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary-700/5 rounded text-[10px] font-semibold uppercase text-primary-700">
                          {serviceCategoryLabel}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-gray-200 flex-shrink-0" />

                {/* Patient */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {patientName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {approval.patient_emr_number && (
                        <span className="font-mono text-primary-700 font-semibold">
                          {approval.patient_emr_number}
                        </span>
                      )}
                      {(approval as any).encounter?.encounter_number && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="font-mono text-gray-500">
                            Enc: {(approval as any).encounter.encounter_number}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost */}
              {approval.estimated_cost != null && approval.estimated_cost > 0 && (
                <div className="flex-shrink-0 bg-gradient-to-br from-primary-700/10 to-emerald-50 px-4 py-2.5 rounded-xl border border-primary-700/15">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">
                    Est. Cost
                  </p>
                  <p className="text-lg font-bold text-primary-700 tabular-nums">
                    {formatCurrency(approval.estimated_cost)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto bg-gray-50/50">
            <div className="px-7 py-5">
              <div className="grid grid-cols-5 gap-5">
                {/* ── Left: Clinical Info (3 cols) ── */}
                <div className="col-span-3 space-y-4">
                  {/* Payer Details */}
                  <PayerDetailsCard
                    payerInfo={fullPatient?.payer_info as PayerInfo | null}
                    nhisNumber={fullPatient?.nhis_number}
                    insuranceType={fullPatient?.insurance_type}
                    patientCategory={fullPatient?.patient_category}
                    compact
                  />

                  {/* Clinical Details Card */}
                  <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                      <Activity size={15} className="text-primary-700" />
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Clinical Information
                      </h4>
                    </div>
                    <div className="p-5 space-y-4">
                      {clinicalFindingsDisplay && (
                        <ClinicalInfoBlock
                          icon={<Clipboard size={13} className="text-primary-700" />}
                          label="Clinical Findings"
                          content={clinicalFindingsDisplay}
                          variant="primary"
                        />
                      )}
                      {provisionalDiagnosisDisplay && (
                        <ClinicalInfoBlock
                          icon={<Stethoscope size={13} className="text-amber-600" />}
                          label="Provisional Diagnosis"
                          content={provisionalDiagnosisDisplay}
                          variant="amber"
                        />
                      )}
                      {requestReasonDisplay && (
                        <ClinicalInfoBlock
                          icon={<MessageSquare size={13} className="text-blue-600" />}
                          label="Reason for Request"
                          content={requestReasonDisplay}
                          variant="default"
                        />
                      )}
                      {clinicalJustificationDisplay && (
                        <ClinicalInfoBlock
                          icon={<FileText size={13} className="text-gray-500" />}
                          label="Clinical Justification"
                          content={clinicalJustificationDisplay}
                          variant="default"
                        />
                      )}
                      {!clinicalFindingsDisplay &&
                        !provisionalDiagnosisDisplay &&
                        !requestReasonDisplay &&
                        !clinicalJustificationDisplay && (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                              <FileText className="text-gray-300" size={24} />
                            </div>
                            <p className="text-sm font-medium text-gray-400">
                              No clinical information provided
                            </p>
                            <p className="text-xs text-gray-300 mt-1">
                              The requesting clinician did not attach clinical details
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* ── Right: Decision Panel (2 cols) ── */}
                <div className="col-span-2 space-y-4">
                  {/* Decision Options */}
                  <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                      <Shield size={15} className="text-primary-700" />
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Authorization Decision
                      </h4>
                    </div>
                    <div className="p-4 space-y-2">
                      {/* Provisional */}
                      <DecisionOption
                        value="provisional"
                        selected={decision === 'provisional'}
                        onSelect={() => setDecision('provisional')}
                        icon={<ShieldAlert size={18} />}
                        title="Provisional Approval"
                        description="Internal pre-approval. Services remain pending until official NHIS code is entered."
                        color="amber"
                      />
                      {/* Full Authorization */}
                      <DecisionOption
                        value="approved"
                        selected={decision === 'approved'}
                        onSelect={() => setDecision('approved')}
                        icon={<ShieldCheck size={18} />}
                        title="Full Authorization"
                        description="Official NHIS authorization code received. Fully unlocks all related services."
                        color="green"
                      />
                      {/* Reject */}
                      <DecisionOption
                        value="rejected"
                        selected={decision === 'rejected'}
                        onSelect={() => setDecision('rejected')}
                        icon={<ShieldX size={18} />}
                        title="Reject Request"
                        description="Deny this authorization. A reason must be provided."
                        color="red"
                      />
                    </div>
                  </div>

                  {/* Conditional Fields */}
                  {decision === 'rejected' && (
                    <div className="bg-white rounded-xl border border-red-200/80 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-red-100 bg-red-50/50">
                        <XCircle size={14} className="text-red-500" />
                        <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider">
                          Rejection Details
                        </h4>
                      </div>
                      <div className="p-4">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Rejection Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Provide the reason for rejecting this request..."
                          className="w-full px-3.5 py-2.5 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-red-400 text-sm resize-none bg-red-50/30 placeholder:text-red-300"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  {decision === 'approved' && (
                    <div className="bg-white rounded-xl border border-primary-700/15 shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-primary-700/10 bg-primary-700/[0.03]">
                        <BadgeCheck size={14} className="text-primary-700" />
                        <h4 className="text-xs font-bold text-primary-700 uppercase tracking-wider">
                          Authorization Details
                        </h4>
                      </div>
                      <div className="p-4 space-y-3.5">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
                            <Hash size={12} className="text-primary-700" />
                            NHIS Authorization Code <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={authorizationCode}
                            onChange={(e) => setAuthorizationCode(e.target.value)}
                            placeholder="e.g., NHIS-AUTH-2026-XXXX"
                            className="w-full px-3.5 py-2.5 border border-primary-700/20 rounded-lg focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm bg-primary-700/[0.02] font-mono tracking-wide"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
                            <CalendarDays size={12} className="text-primary-700" />
                            Authorization Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={authorizationDate}
                            onChange={(e) => setAuthorizationDate(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-primary-700/20 rounded-lg focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5">
                      <StickyNote size={12} className="text-gray-400" />
                      Additional Notes
                      <span className="text-gray-300 font-normal ml-1">(Optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional remarks or observations..."
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm resize-none placeholder:text-gray-300"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-white px-7 py-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gray-400 font-medium">
                XenoCare — NHIS Service Authorization
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    onDecision(decision, notes, reason, authorizationCode, authorizationDate)
                  }
                  disabled={
                    isProcessing ||
                    (decision === 'rejected' && !reason.trim()) ||
                    (decision === 'approved' && (!authorizationCode.trim() || !authorizationDate))
                  }
                  className={`flex items-center gap-2 px-6 py-2 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm ${
                    decision === 'approved'
                      ? 'bg-gradient-to-r from-primary-700 to-emerald-600 hover:from-primary-800 hover:to-emerald-700'
                      : decision === 'provisional'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                        : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : decision === 'approved' ? (
                    <>
                      <ShieldCheck size={16} />
                      Authorize Service
                    </>
                  ) : decision === 'provisional' ? (
                    <>
                      <ShieldAlert size={16} />
                      Grant Provisional
                    </>
                  ) : (
                    <>
                      <ShieldX size={16} />
                      Reject Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function NhisApprovalsList() {
  const { staff } = useAuth();
  const { showToast } = useToast();
  const [filters, setFilters] = useState<NhisApprovalFilters>({
    status: undefined,
    service_type: undefined,
    exclude_category: 'specialty', // Specialty referrals are handled in the dedicated Specialty Referrals sub-tab
    page: 1,
    limit: 20,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = searchQuery.trim();

  // Build effective filters including search
  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      search: debouncedSearch || undefined,
    }),
    [filters, debouncedSearch],
  );

  const [selectedApproval, setSelectedApproval] = useState<{
    id: string;
    service_name: string | null;
    service_type?: string;
    service_category?: string;
    patient_id?: string;
    patient?: { first_name: string; surname: string };
    patient_name?: string;
    patient_emr_number?: string;
    clinical_findings?: string | null;
    provisional_diagnosis?: string | null;
    clinical_justification?: string | null;
    request_reason?: string | null;
    estimated_cost?: number | null;
    encounter?: { encounter_number?: string };
  } | null>(null);
  const [selectedApprovalDraft, setSelectedApprovalDraft] =
    useState<ApprovalDecisionDraft | null>(null);

  const { data, isLoading, refetch } = useNhisApprovals(effectiveFilters);
  const processDecisionMutation = useProcessApprovalDecision();

  // Client-side filtering for patient name (server handles service_name via ilike)
  const approvals = useMemo(() => {
    const items = data?.data || [];
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter((a: any) => {
      const patientName =
        `${a.patient?.first_name || ''} ${a.patient?.surname || ''}`.toLowerCase();
      const emr = (
        a.patient?.emr_number ||
        a.patient?.patient_id ||
        ''
      ).toLowerCase();
      const serviceName = (a.service_name || '').toLowerCase();
      return (
        patientName.includes(q) || emr.includes(q) || serviceName.includes(q)
      );
    });
  }, [data?.data, debouncedSearch]);
  const totalCount = debouncedSearch ? approvals.length : data?.count || 0;
  const totalPages = Math.ceil(
    (data?.count || 0) / (effectiveFilters.limit || 20),
  );

  const handleDecision = async (
    decision: 'approved' | 'rejected' | 'provisional',
    notes?: string,
    reason?: string,
    authCode?: string,
    authDate?: string,
  ) => {
    if (!selectedApproval) return;

    const approvalSnapshot = selectedApproval;
    const draftSnapshot: ApprovalDecisionDraft = {
      decision,
      notes: notes || '',
      reason: reason || '',
      authorizationCode: authCode || '',
      authorizationDate: authDate || '',
    };

    startTransition(() => {
      setSelectedApproval(null);
      setSelectedApprovalDraft(draftSnapshot);
    });

    showToast({
      type: 'info',
      title: 'Processing',
      message:
        decision === 'approved'
          ? 'Full authorization is being processed.'
          : decision === 'provisional'
            ? 'Provisional approval is being processed.'
            : 'Rejection is being processed.',
    });

    try {
      await processDecisionMutation.mutateAsync({
        approval_id: approvalSnapshot.id,
        decision,
        decided_by: staff?.id || '',
        decision_notes: notes,
        rejection_reason: reason,
        authorization_code: authCode,
        authorization_date: authDate,
      });

      setSelectedApprovalDraft(null);
      showToast({
        type: 'success',
        title:
          decision === 'approved'
            ? 'Authorized'
            : decision === 'provisional'
              ? 'Provisionally Approved'
              : 'Rejected',
        message:
          decision === 'approved'
            ? 'NHIS authorization completed.'
            : decision === 'provisional'
              ? 'Provisional NHIS approval granted.'
              : 'NHIS approval request rejected.',
      });
    } catch (error) {
      startTransition(() => {
        setSelectedApproval(approvalSnapshot);
        setSelectedApprovalDraft(draftSnapshot);
      });
      showToast({
        type: 'error',
        title: 'Decision Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to process approval decision',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFilters({ ...filters, page: 1 });
                }}
                placeholder="Search by service name or patient..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm bg-gray-50/50 placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={filters.status || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    status: (e.target.value as NhisApprovalStatus) || undefined,
                    page: 1,
                  })
                }
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm bg-white font-medium text-gray-700"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <select
                value={filters.service_type || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    service_type: e.target.value || undefined,
                    page: 1,
                  })
                }
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 text-sm bg-white font-medium text-gray-700"
              >
                {SERVICE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Result count */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <LayoutList size={13} />
            {totalCount} {totalCount === 1 ? 'request' : 'requests'}
          </div>
        </div>
      </div>

      {/* ── Approvals Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={5} columns={4} />
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-gray-500">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <ClipboardCheck size={32} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-600 text-base">
              No approval requests
            </p>
            <p className="text-sm text-gray-400 mt-1">
              NHIS approval requests will appear here when services are ordered
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Requested
                    </th>
                    <th className="px-5 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {approvals.map((approval) => (
                    <tr
                      key={approval.id}
                      className="hover:bg-primary-700/[0.02] transition-colors group"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-primary-700/10 to-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User size={15} className="text-primary-700" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {approval.patient?.first_name}{' '}
                              {approval.patient?.surname}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">
                              {(approval as any).encounter?.encounter_number ||
                                approval.patient?.patient_emr_number ||
                                '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[260px]">
                          {approval.service_name}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">
                          {approval.service_type.replace(/_/g, ' ')}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-sm text-gray-700">
                          {new Date(approval.requested_at).toLocaleDateString(
                            'en-GB',
                            { day: '2-digit', month: 'short', year: 'numeric' },
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          {approval.requested_by_staff?.first_name}{' '}
                          {approval.requested_by_staff?.last_name}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-center">
                        {getStatusBadge(approval.status)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        {['pending', 'provisional'].includes(
                          approval.status,
                        ) ? (
                          <button
                            onClick={() => {
                              startTransition(() => {
                                setSelectedApproval(approval);
                                setSelectedApprovalDraft(null);
                              });
                            }}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 shadow-sm hover:shadow ${
                              approval.status === 'provisional'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : 'bg-primary-700/5 text-primary-700 border-primary-700/20 hover:bg-primary-700/10'
                            }`}
                          >
                            {approval.status === 'provisional' ? (
                              <>
                                <Hash size={12} />
                                Enter Code
                              </>
                            ) : (
                              <>
                                <Eye size={12} />
                                Review
                              </>
                            )}
                          </button>
                        ) : approval.status === 'rejected' &&
                          approval.rejection_reason ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-red-500 cursor-help"
                            title={approval.rejection_reason}
                          >
                            <AlertTriangle size={14} />
                            <span className="hidden xl:inline">See reason</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
                <p className="text-xs text-gray-500 font-medium">
                  {((filters.page || 1) - 1) * (filters.limit || 20) + 1}–
                  {Math.min(
                    (filters.page || 1) * (filters.limit || 20),
                    totalCount,
                  )}{' '}
                  of {totalCount}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setFilters({ ...filters, page: (filters.page || 1) - 1 })
                    }
                    disabled={(filters.page || 1) <= 1}
                    className="p-1.5 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 py-1 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg tabular-nums">
                    {filters.page || 1} / {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setFilters({ ...filters, page: (filters.page || 1) + 1 })
                    }
                    disabled={(filters.page || 1) >= totalPages}
                    className="p-1.5 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Decision Modal */}
      {selectedApproval && (
        <ApprovalDecisionModal
          approval={selectedApproval}
          onClose={() => {
            setSelectedApproval(null);
            setSelectedApprovalDraft(null);
          }}
          onDecision={handleDecision}
          isProcessing={processDecisionMutation.isPending}
          initialDraft={selectedApprovalDraft}
        />
      )}
    </div>
  );
}

export default NhisApprovalsList;
