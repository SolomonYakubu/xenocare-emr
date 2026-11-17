/**
 * Surgery Detail View Component
 * Comprehensive view for managing a single surgery
 */

import React, { useState, useEffect, useCallback } from 'react';
import { isNhisFeatureEnabled } from '../../../config/features';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Edit2,
  Play,
  Pause,
  CheckSquare,
  Activity,
  Syringe,
  Package,
  Clipboard,
  Save,
  Lock,
} from 'lucide-react';
import {
  useSurgeries,
  usePreopAssessments,
  useAnesthesiaRecords,
  useSurgeryConsumables,
} from '../hooks/useSurgery';
import {
  SurgeryWithDetails,
  SurgeryStatus,
  SurgeryPreopAssessment,
  SurgeryAnesthesiaRecord,
  SurgeryConsumable,
  getSurgeryStatusColor,
  getPriorityColor,
  getASADescription,
  getWoundClassificationDescription,
  canTransitionToStatus,
} from '../types/surgery.types';
import { SkeletonEncounterDetail } from '../../../components/ui/SkeletonLoader';

const SurgeryDetailView: React.FC = () => {
  const { surgeryId } = useParams<{ surgeryId: string }>();
  const navigate = useNavigate();

  const {
    getSurgeryById,
    updateSurgeryStatus,
    signOffSurgery,
    recordConsent,
    loading: surgeryLoading,
  } = useSurgeries();
  const { getAssessment } = usePreopAssessments();
  const { getRecord: getAnesthesiaRecord } = useAnesthesiaRecords();
  const { listConsumables } = useSurgeryConsumables();

  const [surgery, setSurgery] = useState<SurgeryWithDetails | null>(null);
  const [preopAssessment, setPreopAssessment] =
    useState<SurgeryPreopAssessment | null>(null);
  const [anesthesiaRecord, setAnesthesiaRecord] =
    useState<SurgeryAnesthesiaRecord | null>(null);
  const [consumables, setConsumables] = useState<SurgeryConsumable[]>([]);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'checklist' | 'preop' | 'intraop' | 'postop' | 'consumables'
  >('overview');
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  useEffect(() => {
    if (surgeryId) {
      loadSurgeryData();
    }
  }, [surgeryId]);

  const loadSurgeryData = async () => {
    if (!surgeryId) return;

    const [surgeryData, preopData, anesthesiaData, consumablesData] =
      await Promise.all([
        getSurgeryById(surgeryId),
        getAssessment(surgeryId),
        getAnesthesiaRecord(surgeryId),
        listConsumables(surgeryId),
      ]);

    setSurgery(surgeryData);
    setPreopAssessment(preopData);
    setAnesthesiaRecord(anesthesiaData);
    setConsumables(consumablesData);
  };

  const handleUpdateConsent = async (data: any) => {
    if (!surgeryId) return;
    const success = await recordConsent(surgeryId, {
      ...data,
      consent_obtained: true,
      consent_date: new Date().toISOString(),
    });
    if (success) {
      setIsConsentModalOpen(false);
      loadSurgeryData();
    }
  };

  const handleStatusTransition = async (newStatus: SurgeryStatus) => {
    if (!surgeryId) return;

    const success = await updateSurgeryStatus(surgeryId, newStatus);
    if (success) {
      loadSurgeryData();
    }
  };

  const handleSignOff = async (type: 'surgeon' | 'anesthetist' | 'nurse') => {
    if (!surgeryId) return;

    const success = await signOffSurgery(surgeryId, type);
    if (success) {
      loadSurgeryData();
    }
  };

  if (surgeryLoading && !surgery) {
    return <SkeletonEncounterDetail />;
  }

  if (!surgery) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Surgery not found
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">
                  {surgery.surgery_number}
                </h1>
                <span
                  className={`px-3 py-1 text-sm rounded-full ${getSurgeryStatusColor(
                    surgery.status,
                  )}`}
                >
                  {surgery.status.replace('_', ' ')}
                </span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(
                    surgery.priority,
                  )}`}
                >
                  {surgery.priority}
                </span>
                {surgery.is_locked && (
                  <span className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {surgery.primary_procedure}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!surgery.is_locked && (
              <>
                {surgery.status === 'Planned' && (
                  <button
                    onClick={() => handleStatusTransition('Pre_Op')}
                    disabled={!surgery.consent_obtained}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="h-4 w-4" />
                    Start Pre-Op
                  </button>
                )}
                {surgery.status === 'Pre_Op' && (
                  <button
                    onClick={() => handleStatusTransition('In_Theatre')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
                  >
                    <Activity className="h-4 w-4" />
                    Enter Theatre
                  </button>
                )}
                {surgery.status === 'In_Theatre' && (
                  <button
                    onClick={() => handleStatusTransition('Recovery')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                  >
                    <Pause className="h-4 w-4" />
                    Move to Recovery
                  </button>
                )}
                {surgery.status === 'Recovery' && (
                  <button
                    onClick={() => handleStatusTransition('Completed')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Complete Surgery
                  </button>
                )}
                {(surgery.status === 'Planned' ||
                  surgery.status === 'Pre_Op') && (
                  <button
                    onClick={() => handleStatusTransition('Cancelled')}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex space-x-6">
          {(
            [
              'overview',
              'checklist',
              'preop',
              'intraop',
              'postop',
              'consumables',
            ] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1).replace('op', '-Op')}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            surgery={surgery}
            preopAssessment={preopAssessment}
            onSignOff={handleSignOff}
            onRecordConsent={() => setIsConsentModalOpen(true)}
          />
        )}
        {activeTab === 'checklist' && <ChecklistTab surgery={surgery} />}
        {activeTab === 'preop' && (
          <PreopTab
            surgery={surgery}
            assessment={preopAssessment}
            onRefresh={loadSurgeryData}
          />
        )}
        {activeTab === 'intraop' && (
          <IntraopTab
            surgery={surgery}
            anesthesiaRecord={anesthesiaRecord}
            onRefresh={loadSurgeryData}
          />
        )}
        {activeTab === 'postop' && (
          <PostopTab surgery={surgery} onRefresh={loadSurgeryData} />
        )}
        {activeTab === 'consumables' && (
          <ConsumablesTab
            surgery={surgery}
            consumables={consumables}
            onRefresh={loadSurgeryData}
          />
        )}
      </div>

      {isConsentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Record Consent</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleUpdateConsent({
                  consent_type: formData.get('consent_type'),
                  consent_notes: formData.get('consent_notes'),
                  consent_obtained_by: 'System User',
                });
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consent Type
                </label>
                <select
                  name="consent_type"
                  className="w-full border rounded-lg p-2"
                  required
                >
                  <option value="Written">Written</option>
                  <option value="Verbal">Verbal</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Guardian">Guardian</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  name="consent_notes"
                  className="w-full border rounded-lg p-2"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConsentModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Consent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Checklist Tab
const ChecklistTab: React.FC<{
  surgery: SurgeryWithDetails;
}> = ({ surgery }) => {
  const navigate = useNavigate();
  const checklist = surgery.preop_checklist || {};

  // Helper to calculate progress
  const getStageStatus = (stage: 'sign_in' | 'time_out' | 'sign_out') => {
    if (checklist[stage]?.completed_at)
      return { text: 'Completed', color: 'text-green-600', icon: CheckCircle };
    // Simple logic: if previous stage is done, this one is pending/active.
    if (
      stage === 'sign_in' ||
      (stage === 'time_out' && checklist.sign_in?.completed_at) ||
      (stage === 'sign_out' && checklist.time_out?.completed_at)
    ) {
      return { text: 'Pending', color: 'text-orange-600', icon: Clock };
    }
    return { text: 'Not Started', color: 'text-gray-400', icon: AlertCircle };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          WHO Safe Surgery Checklist
        </h3>
        <button
          onClick={() => navigate(`/surgery/${surgery.id}/checklist`)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Clipboard className="h-4 w-4" />
          Launch Checklist
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['sign_in', 'time_out', 'sign_out'] as const).map((stage) => {
          const status = getStageStatus(stage);
          const StatusIcon = status.icon;
          return (
            <div
              key={stage}
              className={`p-4 rounded-lg border ${status.text === 'Completed' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 capitalize">
                  {stage.replace('_', ' ')}
                </h4>
                <StatusIcon className={`h-5 w-5 ${status.color}`} />
              </div>
              <p className={`text-sm ${status.color} font-medium`}>
                {status.text}
              </p>
              {checklist[stage]?.completed_at && (
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(checklist[stage]!.completed_at!).toLocaleString()}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
        <p>
          The WHO Safe Surgery Checklist identifies three phases of an
          operation, each corresponding to a specific period in the normal flow
          of work: Before the induction of anaesthesia ("Sign In"), before the
          incision of the skin ("Time Out") and before the patient leaves the
          operating room ("Sign Out").
        </p>
      </div>
    </div>
  );
};

// Overview Tab Component
interface OverviewTabProps {
  surgery: SurgeryWithDetails;
  preopAssessment: SurgeryPreopAssessment | null;
  onSignOff: (type: 'surgeon' | 'anesthetist' | 'nurse') => void;
  onRecordConsent: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  surgery,
  preopAssessment,
  onSignOff,
  onRecordConsent,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Patient & Procedure Info */}
    <div className="lg:col-span-2 space-y-6">
      {/* Patient Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Patient Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Patient Name" value={surgery.patient_name} />
          <InfoItem label="Patient number" value={surgery.patient_emr_number} />
          <InfoItem
            label="Insurance Type"
            value={surgery.patient_insurance_type}
          />
          {isNhisFeatureEnabled() && surgery.requires_nhis_approval && (
            <InfoItem
              label="NHIS Authorization"
              value={surgery.nhis_authorization_code || 'Pending'}
              highlight={!surgery.nhis_authorization_code}
            />
          )}
        </div>
      </div>

      {/* Procedure Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Procedure Details
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoItem
            label="Primary Procedure"
            value={surgery.primary_procedure}
          />
          <InfoItem label="Laterality" value={surgery.laterality || 'N/A'} />
          <InfoItem label="Body Site" value={surgery.body_site || 'N/A'} />
          <InfoItem
            label="Pre-Op Diagnosis"
            value={surgery.pre_op_diagnosis || 'N/A'}
          />
          <div className="col-span-2">
            <InfoItem label="Indication" value={surgery.indication} />
          </div>
        </div>
      </div>

      {/* Surgical Team */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Surgical Team
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <TeamMember
            role="Primary Surgeon"
            name={surgery.surgeon_name}
            signedOff={!!surgery.surgeon_signoff_at}
            canSignOff={
              !surgery.is_locked &&
              surgery.status === 'Completed' &&
              !surgery.surgeon_signoff_at
            }
            onSignOff={() => onSignOff('surgeon')}
          />
          <TeamMember
            role="Anesthetist"
            name={surgery.anesthetist_name}
            signedOff={!!surgery.anesthetist_signoff_at}
            canSignOff={
              !surgery.is_locked &&
              surgery.status === 'Completed' &&
              !surgery.anesthetist_signoff_at
            }
            onSignOff={() => onSignOff('anesthetist')}
          />
          {/* Add more team members as needed */}
        </div>
      </div>

      {/* WHO Checklist Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          WHO Safe Surgery Checklist
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <ChecklistPhase
            phase="Sign In"
            completed={!!surgery.preop_checklist.sign_in?.completed_at}
            completedAt={surgery.preop_checklist.sign_in?.completed_at}
          />
          <ChecklistPhase
            phase="Time Out"
            completed={!!surgery.preop_checklist.time_out?.completed_at}
            completedAt={surgery.preop_checklist.time_out?.completed_at}
          />
          <ChecklistPhase
            phase="Sign Out"
            completed={!!surgery.preop_checklist.sign_out?.completed_at}
            completedAt={surgery.preop_checklist.sign_out?.completed_at}
          />
        </div>
      </div>
    </div>

    {/* Sidebar - Timeline & Status */}
    <div className="space-y-6">
      {/* Schedule Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h3>
        <div className="space-y-3">
          <InfoItem
            label="Scheduled Date"
            value={surgery.scheduled_date || 'Not scheduled'}
          />
          <InfoItem
            label="Scheduled Time"
            value={surgery.scheduled_time?.substring(0, 5) || 'Not set'}
          />
          <InfoItem
            label="Theatre Room"
            value={
              surgery.theatre_room_name ||
              surgery.theatre_room ||
              'Not assigned'
            }
          />
          <InfoItem
            label="Est. Duration"
            value={
              surgery.scheduled_duration_minutes
                ? `${surgery.scheduled_duration_minutes} min`
                : 'Not estimated'
            }
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
        <div className="space-y-3">
          <TimelineItem
            label="Theatre Entry"
            time={surgery.theatre_entry_time}
          />
          <TimelineItem
            label="Anesthesia Start"
            time={surgery.anesthesia_start_time}
          />
          <TimelineItem label="Incision" time={surgery.incision_time} />
          <TimelineItem label="Closure" time={surgery.closure_time} />
          <TimelineItem
            label="Anesthesia End"
            time={surgery.anesthesia_end_time}
          />
          <TimelineItem label="Theatre Exit" time={surgery.theatre_exit_time} />
          <TimelineItem
            label="Recovery Start"
            time={surgery.recovery_start_time}
          />
          <TimelineItem label="Recovery End" time={surgery.recovery_end_time} />
        </div>
      </div>

      {/* Consent Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Consent</h3>
          {!surgery.consent_obtained && !surgery.is_locked && (
            <button
              onClick={onRecordConsent}
              className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100"
            >
              Record Consent
            </button>
          )}
        </div>
        {surgery.consent_obtained ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span>Consent obtained ({surgery.consent_type})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertTriangle className="h-5 w-5" />
            <span>Consent pending</span>
          </div>
        )}
      </div>

      {/* Pre-Op Assessment */}
      {preopAssessment && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Pre-Op Assessment
          </h3>
          <div className="space-y-2">
            <InfoItem
              label="ASA Classification"
              value={preopAssessment.asa_classification}
            />
            <p className="text-xs text-gray-500">
              {getASADescription(preopAssessment.asa_classification)}
            </p>
            <div className="pt-2">
              {preopAssessment.fit_for_surgery ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Fit for surgery</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Not cleared</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

// Pre-Op Tab (placeholder)
const PreopTab: React.FC<{
  surgery: SurgeryWithDetails;
  assessment: SurgeryPreopAssessment | null;
  onRefresh: () => void;
}> = ({ surgery, assessment }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => navigate(`/surgery/${surgery.id}/preop`)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {assessment ? (
            <Edit2 className="h-4 w-4" />
          ) : (
            <Clipboard className="h-4 w-4" />
          )}
          {assessment ? 'Edit Assessment' : 'Perform Assessment'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Pre-Operative Assessment
        </h3>
        {assessment ? (
          <div className="space-y-4">
            <InfoItem
              label="ASA Classification"
              value={assessment.asa_classification}
            />
            <p className="text-xs text-gray-500 ml-1">
              {getASADescription(assessment.asa_classification)}
            </p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <InfoItem
                label="Mallampati Class"
                value={assessment.mallampati_class || 'N/A'}
              />
              <InfoItem
                label="Fasting Hours"
                value={`${assessment.fasting_hours || 0} hrs`}
              />
              <InfoItem
                label="Fit for Surgery"
                value={assessment.fit_for_surgery ? 'Yes' : 'No'}
              />
              <InfoItem
                label="Blood Type"
                value={assessment.blood_type || 'Not documented'}
              />
              <InfoItem
                label="Crossmatch Ordered"
                value={assessment.crossmatch_ordered ? 'Yes' : 'No'}
              />
            </div>
            {assessment.clearance_notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-700">
                <p className="font-medium text-xs text-gray-500 mb-1">
                  Clearance Notes
                </p>
                {assessment.clearance_notes}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              No pre-operative assessment documented
            </p>
            <button
              onClick={() => navigate(`/surgery/${surgery.id}/preop`)}
              className="text-blue-600 font-medium hover:underline text-sm"
            >
              Start assessment now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Intra-Op Tab
const IntraopTab: React.FC<{
  surgery: SurgeryWithDetails;
  anesthesiaRecord: SurgeryAnesthesiaRecord | null;
  onRefresh: () => void;
}> = ({ surgery, anesthesiaRecord }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Intra-Operative Details
          </h3>
          {!surgery.is_locked && (
            <button
              onClick={() => navigate(`/surgery/${surgery.id}/intraop`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Edit2 className="h-4 w-4" />
              Edit Details
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InfoItem
            label="Position"
            value={surgery.patient_position || 'Not documented'}
          />
          <InfoItem
            label="Skin Prep"
            value={surgery.skin_prep || 'Not documented'}
          />
          <InfoItem
            label="Approach"
            value={surgery.approach || 'Not documented'}
          />
          <InfoItem
            label="Incision"
            value={surgery.incision || 'Not documented'}
          />
          <InfoItem
            label="Est. Blood Loss"
            value={
              surgery.estimated_blood_loss_ml
                ? `${surgery.estimated_blood_loss_ml} ml`
                : 'Not documented'
            }
          />
          <InfoItem
            label="Wound Classification"
            value={surgery.wound_classification || 'Not classified'}
          />
        </div>
        {surgery.findings && (
          <div className="mt-4">
            <InfoItem label="Findings" value={surgery.findings} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Anesthesia Record
          </h3>
          <button
            onClick={() => navigate(`/surgery/${surgery.id}/anesthesia`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Syringe className="h-4 w-4" />
            {anesthesiaRecord ? 'Edit Record' : 'Create Record'}
          </button>
        </div>

        {anesthesiaRecord ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoItem
                label="Anesthesia Type"
                value={anesthesiaRecord.anesthesia_type}
              />
              <InfoItem
                label="Airway Management"
                value={anesthesiaRecord.airway_management || 'N/A'}
              />
            </div>

            {anesthesiaRecord.vital_signs_log &&
              anesthesiaRecord.vital_signs_log.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    Latest Vitals
                  </p>
                  <div className="flex gap-4 p-3 bg-gray-50 rounded text-sm">
                    {(() => {
                      const latest =
                        anesthesiaRecord.vital_signs_log[
                          anesthesiaRecord.vital_signs_log.length - 1
                        ];
                      return (
                        <>
                          <div className="font-mono">{latest.time}</div>
                          <div className="font-semibold text-red-600">
                            BP {latest.bp_systolic}/{latest.bp_diastolic}
                          </div>
                          <div className="font-semibold text-green-600">
                            HR {latest.heart_rate}
                          </div>
                          <div className="font-semibold text-blue-600">
                            SpO2 {latest.spo2}%
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500">No anesthesia record documented</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Post-Op Tab
const PostopTab: React.FC<{
  surgery: SurgeryWithDetails;
  onRefresh: () => void;
}> = ({ surgery }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Post-Operative Details
        </h3>
        {!surgery.is_locked && (
          <button
            onClick={() => navigate(`/surgery/${surgery.id}/postop`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Edit2 className="h-4 w-4" />
            Edit Details
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InfoItem
          label="Post-Op Diagnosis"
          value={surgery.post_op_diagnosis || 'Same as pre-op'}
        />
        <InfoItem
          label="Recovery Location"
          value={surgery.recovery_location || 'Not documented'}
        />
        <InfoItem
          label="Disposition"
          value={surgery.disposition?.replace('_', ' ') || 'Not determined'}
        />
        <InfoItem
          label="Complications"
          value={surgery.postop_complications || 'None documented'}
        />
      </div>
      {surgery.postop_instructions && (
        <div className="mt-4">
          <InfoItem
            label="Post-Op Instructions"
            value={surgery.postop_instructions}
          />
        </div>
      )}
    </div>
  );
};

// Consumables Tab
const ConsumablesTab: React.FC<{
  surgery: SurgeryWithDetails;
  consumables: SurgeryConsumable[];
  onRefresh: () => void;
}> = ({ surgery, consumables }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Consumables & Implants
        </h3>
        {!surgery.is_locked && (
          <button
            onClick={() => navigate(`/surgery/${surgery.id}/consumables/new`)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            <Package className="h-4 w-4" />
            Add Item
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {consumables.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No consumables recorded
          </div>
        ) : (
          consumables.map((item) => (
            <div
              key={item.id}
              className="p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{item.item_name}</p>
                <p className="text-sm text-gray-500">
                  {item.category} • Qty: {item.quantity_used} {item.unit}
                  {item.is_implant && (
                    <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                      Implant
                    </span>
                  )}
                </p>
              </div>
              {item.total_cost && (
                <p className="font-medium text-gray-900">
                  ₦{item.total_cost.toLocaleString()}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Helper Components
const InfoItem: React.FC<{
  label: string;
  value: string | undefined | null;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p
      className={`text-sm font-medium ${
        highlight ? 'text-yellow-600' : 'text-gray-900'
      }`}
    >
      {value || '-'}
    </p>
  </div>
);

const TimelineItem: React.FC<{
  label: string;
  time: string | null;
}> = ({ label, time }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-medium text-gray-900">
      {time
        ? new Date(time).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '--:--'}
    </span>
  </div>
);

const TeamMember: React.FC<{
  role: string;
  name: string | undefined;
  signedOff: boolean;
  canSignOff: boolean;
  onSignOff: () => void;
}> = ({ role, name, signedOff, canSignOff, onSignOff }) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    <div>
      <p className="text-xs text-gray-500">{role}</p>
      <p className="text-sm font-medium text-gray-900">
        {name || 'Not assigned'}
      </p>
    </div>
    {signedOff ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : canSignOff ? (
      <button
        onClick={onSignOff}
        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Sign Off
      </button>
    ) : null}
  </div>
);

const ChecklistPhase: React.FC<{
  phase: string;
  completed: boolean;
  completedAt: string | undefined;
}> = ({ phase, completed, completedAt }) => (
  <div
    className={`p-3 rounded-lg text-center ${
      completed
        ? 'bg-green-50 border border-green-200'
        : 'bg-gray-50 border border-gray-200'
    }`}
  >
    <div className="flex items-center justify-center mb-1">
      {completed ? (
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : (
        <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
      )}
    </div>
    <p className="text-sm font-medium text-gray-900">{phase}</p>
    {completed && completedAt && (
      <p className="text-xs text-gray-500">
        {new Date(completedAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    )}
  </div>
);

export default SurgeryDetailView;
