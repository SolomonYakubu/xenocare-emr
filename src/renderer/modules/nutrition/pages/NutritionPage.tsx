/**
 * =============================================================================
 * NUTRITION MODULE PAGE
 * =============================================================================
 * Main entry point for nutrition services:
 * - Queue and referral intake
 * - Nutrition care plan and meal-plan prescription
 * - Follow-up session tracking
 * =============================================================================
 */

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Clock,
  Eye,
  Leaf,
  RefreshCw,
  Search,
  Users,
  ClipboardList,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../../../components/ui/FormElements';
import { Modal, StatsCard } from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { ReferralDetailsModal } from '../../../components/shared';
import PatientMedicalRecordsPanel from '../../../components/shared/PatientMedicalRecordsPanel';
import { SkeletonDashboard } from '../../../components/ui/SkeletonLoader';
import { useDepartmentQueue } from '../../queue/hooks/useQueue';
import type { QueueDTO } from '../../queue/dtos/queue.dto';
import {
  useCompleteRequest,
  useSpecialtyReferrals,
} from '../../clinical-requests/hooks/useClinicalRequests';
import type { ClinicalRequestWithDetailsDTO } from '../../clinical-requests/dtos/clinical-request.dto';
import {
  createBatchOrders,
} from '../../clinical-consultation/api/consultation.api';
import { useLabTestCatalogue } from '../../clinical-consultation/hooks/useConsultation';
import type { Priority } from '../../../types';
import NutritionPlanCreateModal from '../components/NutritionPlanCreateModal';
import NutritionCarePlanDashboard from '../components/NutritionCarePlanDashboard';
import { useNutritionStats } from '../hooks/useNutrition';

type ViewTab = 'queue' | 'referrals' | 'care_plans';

interface PlanPatientContext {
  patientId?: string;
  encounterId?: string;
  patientName?: string;
  emrNumber?: string;
  clinicalRequestId?: string;
}

interface LabOrderContext {
  patientId: string;
  encounterId: string;
  patientName?: string;
  emrNumber?: string;
}

const TABS: Array<{
  id: ViewTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'queue', label: 'Clinic Queue', icon: Users },
  { id: 'referrals', label: 'Referrals', icon: ArrowRight },
  { id: 'care_plans', label: 'Care Plans', icon: Leaf },
];

export default function NutritionPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { staff } = useAuth();
  const { data: labTestsData } = useLabTestCatalogue();

  const [activeTab, setActiveTab] = useState<ViewTab>('queue');
  const [searchTerm, setSearchTerm] = useState('');
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planContext, setPlanContext] = useState<PlanPatientContext | null>(
    null,
  );

  const [patientRecordsModalOpen, setPatientRecordsModalOpen] = useState(false);
  const [selectedPatientForRecords, setSelectedPatientForRecords] = useState<{
    patientId: string;
    patientName: string;
  } | null>(null);

  const [selectedReferral, setSelectedReferral] =
    useState<ClinicalRequestWithDetailsDTO | null>(null);
  const [referralDetailsModalOpen, setReferralDetailsModalOpen] =
    useState(false);

  const [labOrderModalOpen, setLabOrderModalOpen] = useState(false);
  const [labOrderContext, setLabOrderContext] =
    useState<LabOrderContext | null>(null);
  const [selectedLabTestId, setSelectedLabTestId] = useState('');
  const [labPriority, setLabPriority] = useState<Priority>('Normal');
  const [labClinicalNotes, setLabClinicalNotes] = useState('');
  const [isSubmittingLabOrder, setIsSubmittingLabOrder] = useState(false);

  const { data: stats, isLoading: statsLoading } = useNutritionStats();
  const {
    data: queueData,
    isLoading: queueLoading,
    refetch: refetchQueue,
  } = useDepartmentQueue('Nutrition');

  const {
    data: referralsData,
    isLoading: referralsLoading,
    refetch: refetchReferrals,
  } = useSpecialtyReferrals('nutrition', [
    'Pending',
    'Approved',
    'In_Progress',
  ]);

  const labTests = useMemo(
    () => (Array.isArray(labTestsData) ? labTestsData : []),
    [labTestsData],
  );

  const queueDataNormalized = useMemo<QueueDTO[]>(
    () => (Array.isArray(queueData) ? (queueData as QueueDTO[]) : []),
    [queueData],
  );

  const referrals = useMemo<ClinicalRequestWithDetailsDTO[]>(
    () =>
      Array.isArray(referralsData)
        ? (referralsData as ClinicalRequestWithDetailsDTO[])
        : [],
    [referralsData],
  );

  const completeRequestMutation = useCompleteRequest();

  const filteredQueue = useMemo(() => {
    if (!searchTerm.trim()) return queueDataNormalized;

    const query = searchTerm.toLowerCase();
    return queueDataNormalized.filter((queueItem) => {
      const fullName =
        `${queueItem.patient?.first_name || ''} ${queueItem.patient?.surname || ''}`.toLowerCase();
      const emrNumber = String(
        queueItem.patient?.emr_number || '',
      ).toLowerCase();
      return fullName.includes(query) || emrNumber.includes(query);
    });
  }, [queueDataNormalized, searchTerm]);

  const filteredReferrals = useMemo(() => {
    if (!searchTerm.trim()) return referrals;

    const query = searchTerm.toLowerCase();
    return referrals.filter((referral) => {
      const patientName = String(referral.patient_name || '').toLowerCase();
      const reason = String(referral.clinical_reason || '').toLowerCase();
      return patientName.includes(query) || reason.includes(query);
    });
  }, [referrals, searchTerm]);

  function openPatientRecords(patientId: string, patientName: string) {
    setSelectedPatientForRecords({ patientId, patientName });
    setPatientRecordsModalOpen(true);
  }

  function openCreatePlan(context?: PlanPatientContext) {
    setPlanContext(context || null);
    setPlanModalOpen(true);
  }

  function resetLabOrderForm() {
    setSelectedLabTestId('');
    setLabPriority('Normal');
    setLabClinicalNotes('');
  }

  function openLabOrder(context: {
    patientId?: string;
    encounterId?: string;
    patientName?: string;
    emrNumber?: string;
  }) {
    if (!context.patientId || !context.encounterId) {
      showToast({
        type: 'warning',
        title: 'Encounter required',
        message:
          'A valid encounter is required before placing lab orders from Nutrition.',
      });
      return;
    }

    setLabOrderContext({
      patientId: context.patientId,
      encounterId: context.encounterId,
      patientName: context.patientName,
      emrNumber: context.emrNumber,
    });
    setLabOrderModalOpen(true);
  }

  async function handleSubmitLabOrder() {
    if (!labOrderContext) return;

    const orderedBy = staff?.staff_id || staff?.id || '';
    if (!orderedBy) {
      showToast({
        type: 'error',
        title: 'Staff context missing',
        message: 'Could not determine ordering staff for this request.',
      });
      return;
    }

    if (!selectedLabTestId) {
      showToast({
        type: 'error',
        title: 'Lab test required',
        message: 'Select a laboratory test before submitting.',
      });
      return;
    }

    const selectedTest = labTests.find((test) => test.test_id === selectedLabTestId);

    try {
      setIsSubmittingLabOrder(true);
      await createBatchOrders({
        consultationId: null,
        patientId: labOrderContext.patientId,
        encounterId: labOrderContext.encounterId,
        orderedBy,
        labOrders: [
          {
            test_id: selectedLabTestId,
            test_name: selectedTest?.test_name,
            priority: labPriority,
            clinical_notes: labClinicalNotes.trim() || undefined,
          },
        ],
        radiologyOrders: [],
        procedureOrders: [],
        prescriptions: [],
        patientName: labOrderContext.patientName,
        patientEmrNumber: labOrderContext.emrNumber,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lab'] }),
        queryClient.invalidateQueries({
          queryKey: ['patientHistory', labOrderContext.patientId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['clinical-timeline', labOrderContext.encounterId],
        }),
      ]);

      showToast({
        type: 'success',
        title: 'Lab request submitted',
        message: `${selectedTest?.test_name || 'Lab test'} has been sent to Laboratory.`,
      });

      setLabOrderModalOpen(false);
      setLabOrderContext(null);
      resetLabOrderForm();
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to submit lab request',
        message:
          error instanceof Error
            ? error.message
            : 'Please try again.',
      });
    } finally {
      setIsSubmittingLabOrder(false);
    }
  }

  async function handlePlanCreated(payload: {
    patientId: string;
    clinicalRequestId?: string;
  }) {
    if (payload.clinicalRequestId && staff?.id) {
      try {
        await completeRequestMutation.mutateAsync({
          id: payload.clinicalRequestId,
          completion: { reviewed_by: staff.id },
        });
        refetchReferrals();
      } catch (error) {
        showToast({
          type: 'warning',
          title: 'Referral update failed',
          message:
            error instanceof Error
              ? error.message
              : 'Care plan created, but referral could not be marked complete.',
        });
      }
    }

    refetchQueue();
  }

  return (
    <div className="py-8 px-5 sm:px-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nutrition</h1>
          <p className="text-gray-600">
            Nutrition assessment, therapeutic meal plans, and adherence follow-up
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => openCreatePlan()}
        >
          <Plus className="w-4 h-4 mr-1" />
          New Care Plan
        </Button>
      </div>

      {/* Quick Stats */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          <StatsCard
            title="Active Plans"
            value={stats.active_care_plans}
            icon={Leaf}
            color="green"
          />
          <StatsCard
            title="High-Risk Patients"
            value={stats.high_risk_patients}
            icon={AlertTriangle}
            color="red"
          />
          <StatsCard
            title="Follow-ups (30d)"
            value={stats.followups_this_month}
            icon={ClipboardList}
            color="blue"
          />
          <StatsCard
            title="Avg Adherence"
            value={`${stats.average_adherence_rate}%`}
            icon={Clock}
            color="yellow"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'queue' && queueDataNormalized.length > 0 && (
                  <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    {queueDataNormalized.length}
                  </span>
                )}
                {tab.id === 'referrals' && referrals.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {referrals.length}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab !== 'care_plans' && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patient name, patient number, or referral reason..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                activeTab === 'queue' ? refetchQueue() : refetchReferrals()
              }
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh
            </Button>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900">Waiting Queue</h4>
                <p className="text-sm text-green-700">
                  Patients waiting for nutrition assessment will appear here after payment verification.
                </p>
              </div>
            </div>

            {/* Queue Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Nutrition Waiting Queue</h3>
                <Button variant="outline" size="sm" onClick={() => refetchQueue()}>
                  <RefreshCw size={14} className="mr-2" />
                  Refresh
                </Button>
              </div>

              {queueLoading ? (
                <SkeletonDashboard />
              ) : filteredQueue.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">
                    No patients in nutrition queue
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Patients waiting for nutrition assessment will appear here.
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Patient
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Wait Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredQueue.map((item) => {
                      const patientName =
                        `${item.patient?.first_name || ''} ${item.patient?.surname || ''}`.trim();
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                <span className="text-emerald-700 font-semibold text-sm">
                                  {item.ticket_number}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">
                                  {patientName || 'Unknown Patient'}
                                </span>
                                <div className="text-xs text-gray-500">
                                  EMR: {item.patient?.emr_number || 'N/A'}
                                  {item.patient?.gender ? ` · ${item.patient.gender}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.status === 'Waiting'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : item.status === 'In Progress'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock size={14} />
                              {item.created_at
                                ? formatDistanceToNow(new Date(item.created_at), {
                                    addSuffix: true,
                                  })
                                : '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  openPatientRecords(
                                    item.patient_id,
                                    patientName || 'Patient',
                                  )
                                }
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Records
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDashboardSearchTerm(item.patient?.emr_number || '');
                                  setActiveTab('care_plans');
                                }}
                              >
                                <ClipboardList className="w-4 h-4 mr-1" />
                                Past Plans
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  openLabOrder({
                                    patientId: item.patient_id,
                                    encounterId: item.encounter?.id || item.visit_id,
                                    patientName,
                                    emrNumber: item.patient?.emr_number || '',
                                  })
                                }
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Request Lab
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() =>
                                  openCreatePlan({
                                    patientId: item.patient_id,
                                    encounterId: item.encounter?.id || item.visit_id,
                                    patientName,
                                    emrNumber: item.patient?.emr_number || '',
                                  })
                                }
                              >
                                <Leaf className="w-4 h-4 mr-1" />
                                Meal Plan
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'referrals' && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <ArrowRight className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Incoming Referrals</h4>
                <p className="text-sm text-blue-700">
                  Patients referred to the Nutrition department from GOPD or other clinics.
                </p>
              </div>
            </div>

            {/* Referrals Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Nutrition Referrals Queue</h3>
                <Button variant="outline" size="sm" onClick={() => refetchReferrals()}>
                  <RefreshCw size={14} className="mr-2" />
                  Refresh
                </Button>
              </div>

              {referralsLoading ? (
                <SkeletonDashboard />
              ) : filteredReferrals.length === 0 ? (
                <div className="p-8 text-center">
                  <ArrowRight className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">
                    No pending nutrition referrals
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Patients referred from consultations will appear here
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Patient
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Urgency
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Referred By
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        When
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReferrals.map((referral) => {
                      const urgency = referral.urgency || 'Routine';
                      const urgencyColors: Record<string, { bg: string; text: string }> = {
                        Routine: { bg: 'bg-gray-100', text: 'text-gray-800' },
                        Urgent: { bg: 'bg-orange-100', text: 'text-orange-800' },
                        Stat: { bg: 'bg-red-100', text: 'text-red-800' },
                        Emergency: { bg: 'bg-red-100', text: 'text-red-800' },
                      };
                      const urgencyColor = urgencyColors[urgency] || urgencyColors.Routine;

                      return (
                        <tr key={referral.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">
                                {referral.patient_name || 'Unknown Patient'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {referral.emr_number}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${urgencyColor.bg} ${urgencyColor.text}`}>
                              {urgency}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-600 text-sm">
                              {referral.requesting_doctor_name || 'Unknown'}
                              {referral.requesting_department_name
                                ? ` · ${referral.requesting_department_name}`
                                : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm">
                            {referral.created_at
                              ? formatDistanceToNow(new Date(referral.created_at), { addSuffix: true })
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedReferral(referral);
                                  setReferralDetailsModalOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDashboardSearchTerm(referral.emr_number || '');
                                  setActiveTab('care_plans');
                                }}
                              >
                                <ClipboardList className="w-4 h-4 mr-1" />
                                Past Plans
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  openLabOrder({
                                    patientId: referral.patient_id,
                                    encounterId: referral.encounter_id,
                                    patientName: referral.patient_name,
                                    emrNumber: referral.emr_number,
                                  })
                                }
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Request Lab
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() =>
                                  openCreatePlan({
                                    patientId: referral.patient_id,
                                    encounterId: referral.encounter_id,
                                    patientName: referral.patient_name,
                                    emrNumber: referral.emr_number,
                                    clinicalRequestId: referral.id,
                                  })
                                }
                              >
                                <Leaf className="w-4 h-4 mr-1" />
                                Meal Plan
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'care_plans' && (
          <NutritionCarePlanDashboard
            onCreatePlan={() => openCreatePlan()}
            initialSearch={dashboardSearchTerm}
          />
        )}
      </div>

      {patientRecordsModalOpen && selectedPatientForRecords && (
        <Modal
          isOpen
          onClose={() => setPatientRecordsModalOpen(false)}
          title={`Patient Records - ${selectedPatientForRecords.patientName}`}
          size="xl"
        >
          <PatientMedicalRecordsPanel
            patientId={selectedPatientForRecords.patientId}
          />
        </Modal>
      )}

      {referralDetailsModalOpen && selectedReferral && (
        <ReferralDetailsModal
          referral={selectedReferral}
          isOpen
          onClose={() => {
            setReferralDetailsModalOpen(false);
            setSelectedReferral(null);
          }}
          specialty="nutrition"
          onStartExam={() => {
            setReferralDetailsModalOpen(false);
            setSelectedReferral(null);
          }}
        />
      )}

      <NutritionPlanCreateModal
        isOpen={planModalOpen}
        onClose={() => {
          setPlanModalOpen(false);
          setPlanContext(null);
        }}
        patientContext={planContext}
        onCreated={handlePlanCreated}
      />

      {labOrderModalOpen && labOrderContext && (
        <Modal
          isOpen
          onClose={() => {
            setLabOrderModalOpen(false);
            setLabOrderContext(null);
            resetLabOrderForm();
          }}
          title={`Request Lab - ${labOrderContext.patientName || 'Patient'}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Lab Test
                </label>
                <select
                  value={selectedLabTestId}
                  onChange={(event) => setSelectedLabTestId(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select lab test</option>
                  {labTests.map((test) => (
                    <option key={test.test_id} value={test.test_id}>
                      {test.test_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={labPriority}
                  onChange={(event) => setLabPriority(event.target.value as Priority)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Stat">Stat</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Clinical Notes (optional)
              </label>
              <textarea
                rows={3}
                value={labClinicalNotes}
                onChange={(event) => setLabClinicalNotes(event.target.value)}
                placeholder="Enter clinical indication or nutrition-related rationale"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setLabOrderModalOpen(false);
                  setLabOrderContext(null);
                  resetLabOrderForm();
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSubmitLabOrder}
                disabled={isSubmittingLabOrder || !selectedLabTestId}
              >
                {isSubmittingLabOrder ? 'Submitting...' : 'Submit Lab Request'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
