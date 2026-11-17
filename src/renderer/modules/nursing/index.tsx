import React, { useMemo, useState } from 'react';
import {
  Heart,
  Plus,
  Activity,
  Clock,
  AlertTriangle,
  Users,
  UserCheck,
  Play,
  RefreshCw,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  ClipboardList,
  FileText,
  Stethoscope,
  TrendingUp,
  ArrowRightLeft,
  Search,
  Eye,
  ChevronDown,
} from 'lucide-react';
import {
  Button,
  StatsCard,
  Card,
  DataTable,
  EmptyState,
  Tabs,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { SkeletonCard, SkeletonList } from '../../components/ui/SkeletonLoader';
import NursingCareList from './components/NursingCareList';
import NursingCareForm from './components/NursingCareForm';
import PatientCarePanel from './components/PatientCarePanel';
import {
  useNursingCareRecords,
  useNursingCareStats,
  useCreateNursingCareRecord,
  useUpdateNursingCareRecord,
  useDeleteNursingCareRecord,
  usePatientsRequiringCare,
  useNursingQueue,
  useNursingQueueCount,
  useCallNursingQueuePatient,
  useStartServingPatient,
  useCompleteNursingQueue,
  useConsultedPatients,
} from './hooks/useNursing';
import {
  NursingCareDTO,
  CreateNursingCareDTO,
  CareType,
} from './dtos/nursing.dto';
import {
  PatientDTO,
  formatPatientName,
} from '../patient-registration/dtos/patient.dto';
import {
  useTransitionEncounter,
  useActiveEncounters,
} from '../../lib/workflow';
import type { NursingQueuePatient } from './api/nursing.api';
import { useTimeTheme } from '../../hooks/useTimeTheme';
import { InlineGuidance } from '../../components/guidance/InlineGuidance';
import { ConsultationClinicalAlerts } from '../../components/clinical/ConsultationClinicalAlerts';

// =============================================================================
// Component
// =============================================================================

export default function NursingCare() {
  // Toast notifications
  const { showToast } = useToast();

  // State - Simplified for patient-first design
  const [activeTab, setActiveTab] = useState<'queue' | 'care-records'>('queue');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NursingCareDTO | null>(
    null,
  );
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(
    null,
  );
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(
    null,
  );
  const [selectedPriority, setSelectedPriority] = useState<string>('Normal');

  // Patient Care Panel state
  const [isPatientPanelOpen, setIsPatientPanelOpen] = useState(false);

  // Search and filters
  const [queueSearch, setQueueSearch] = useState('');
  const [page, setPage] = useState(1);
  const [careTypeFilter, setCareTypeFilter] = useState<CareType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const { data: recordsData, isLoading } = useNursingCareRecords({
    page,
    limit: 10,
    care_type: careTypeFilter || undefined,
    search: searchQuery || undefined,
  });

  const { data: stats } = useNursingCareStats();
  const { data: patientsRequiringCare } = usePatientsRequiringCare();
  const { data: activeEncounters } = useActiveEncounters();
  const { data: nursingQueue, isLoading: queueLoading } = useNursingQueue();
  const { data: queueCount } = useNursingQueueCount();

  const createRecord = useCreateNursingCareRecord();
  const updateRecord = useUpdateNursingCareRecord();
  const deleteRecord = useDeleteNursingCareRecord();
  const transitionEncounter = useTransitionEncounter();
  const callPatient = useCallNursingQueuePatient();
  const startServing = useStartServingPatient();
  const completeQueue = useCompleteNursingQueue();

  // Filter queue by search
  const filteredQueue = useMemo(() => {
    if (!nursingQueue) return [];
    if (!queueSearch.trim()) return nursingQueue;

    const search = queueSearch.toLowerCase();
    return nursingQueue.filter((item) => {
      const patient = Array.isArray(item.patient)
        ? item.patient[0]
        : item.patient;
      const fullName =
        `${patient?.first_name || ''} ${patient?.surname || ''}`.toLowerCase();
      const emr = (patient?.emr_number || '').toLowerCase();
      return fullName.includes(search) || emr.includes(search);
    });
  }, [nursingQueue, queueSearch]);

  // Handler for deleting a record
  const handleDeleteRecord = (record: NursingCareDTO) => {
    if (
      window.confirm(
        `Are you sure you want to delete this ${record.care_type} record?`,
      )
    ) {
      deleteRecord.mutate(record.care_id, {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: 'Record Deleted',
            message: 'Nursing care record deleted successfully',
          });
        },
        onError: (error) => {
          showToast({
            type: 'error',
            title: 'Delete Failed',
            message: 'Failed to delete nursing record',
          });
          console.error('Failed to delete nursing record:', error);
        },
      });
    }
  };

  // Handlers
  const handleNewRecord = (
    patient?: PatientDTO,
    visitId?: string | null,
    queueId?: string | null,
    encounterId?: string | null,
  ) => {
    setEditingRecord(null); // Clear any editing record when creating new
    setSelectedPatient(patient || null);
    setSelectedVisitId(visitId || null);
    setSelectedQueueId(queueId || null);
    setSelectedEncounterId(encounterId || null);
    setIsFormOpen(true);
  };

  const handleViewRecord = (record: NursingCareDTO) => {
    // Open detail view modal (could be implemented later)
    showToast({
      type: 'info',
      title: 'View Record',
      message: `Viewing vitals for ${record.patient ? formatPatientName(record.patient) : 'Unknown Patient'}`,
    });
  };

  const handleEditRecord = (record: NursingCareDTO) => {
    // Set the record being edited
    setEditingRecord(record);

    // Pre-fill patient context from the record
    if (record.patient) {
      setSelectedPatient({
        patient_id: record.patient_id,
        ...record.patient,
      } as PatientDTO);
    }

    // Set encounter/visit context
    setSelectedEncounterId(record.encounter_id || null);
    setSelectedVisitId(record.visit_id || null);
    setSelectedQueueId(null); // No queue ID when editing existing record

    // Open the form in edit mode
    setIsFormOpen(true);
  };

  const handleCreateRecord = (data: CreateNursingCareDTO) => {
    // FIRE-AND-FORGET: Close form immediately, optimistic update handles UI
    // Server sync happens in background via onSettled

    // Close form INSTANTLY - user sees immediate feedback
    setIsFormOpen(false);
    setSelectedPatient(null);
    setSelectedVisitId(null);
    setSelectedQueueId(null);
    setSelectedEncounterId(null);

    // Fire mutations in background (don't await)
    createRecord.mutate(data, {
      onSuccess: () => {
        showToast({
          type: 'success',
          title: 'Vitals Saved',
          message: 'Patient vitals recorded successfully',
        });

        // Complete queue entry using the queue_id from form data (preferred)
        // or fall back to finding it from the queue list
        const queueIdToComplete =
          data.queue_id ||
          nursingQueue?.find(
            (q) => q.patient_id === data.patient_id && q.status !== 'Completed',
          )?.id;

        if (queueIdToComplete) {
          completeQueue.mutate(queueIdToComplete);
          console.log(
            '[Nursing] Queue entry completed, patient routed to Consultation',
          );
        }

        // Find the encounter to check its current stage before transitioning
        const encounter = activeEncounters?.find(
          (e) =>
            e.visit_id === data.visit_id || e.patient_id === data.patient_id,
        );

        // Only transition if the patient is NOT already in consultation or later stages
        const stagesNeedingTransition = [
          'nursing_vitals',
          'queue_waiting',
          'payment',
        ];
        const shouldTransition =
          encounter &&
          stagesNeedingTransition.includes(encounter.current_stage);

        if (shouldTransition && data.visit_id) {
          transitionEncounter.mutate({
            visit_id: data.visit_id,
            next_stage: 'consultation',
            notes: 'Vitals recorded, ready for consultation',
          });
          console.log('[Nursing] Workflow transitioned to consultation');
        } else if (shouldTransition && encounter) {
          transitionEncounter.mutate({
            visit_id: encounter.visit_id,
            next_stage: 'consultation',
            notes: 'Vitals recorded, ready for consultation',
          });
          console.log(
            '[Nursing] Workflow transitioned to consultation (from encounter)',
          );
        } else if (encounter) {
          console.log(
            `[Nursing] Skipping transition - patient already in ${encounter.current_stage} stage`,
          );
        }
      },
      onError: (error) => {
        showToast({
          type: 'error',
          title: 'Save Failed',
          message: 'Failed to save vitals. Please try again.',
        });
        console.error('Failed to create nursing record:', error);
        // Error already rolled back via optimistic update's onError
      },
    });
  };

  const handleUpdateRecord = (data: CreateNursingCareDTO) => {
    if (!editingRecord) return;

    // Close form immediately for better UX
    setIsFormOpen(false);
    setEditingRecord(null);
    setSelectedPatient(null);
    setSelectedVisitId(null);
    setSelectedQueueId(null);
    setSelectedEncounterId(null);

    // Fire update mutation
    updateRecord.mutate(
      {
        care_id: editingRecord.care_id,
        ...data,
      },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: 'Vitals Updated',
            message: 'Nursing care record updated successfully',
          });
        },
        onError: (error) => {
          showToast({
            type: 'error',
            title: 'Update Failed',
            message: 'Failed to update nursing record. Please try again.',
          });
          console.error('Failed to update nursing record:', error);
        },
      },
    );
  };

  const handleFilterChange = (type: CareType | '') => {
    setCareTypeFilter(type);
    setPage(1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Helper to get patient from queue item (handles array or object)
  const getPatientFromQueueItem = (queueItem: NursingQueuePatient) => {
    const patient = Array.isArray(queueItem.patient)
      ? queueItem.patient[0]
      : queueItem.patient;
    return patient;
  };

  // Queue handlers
  const handleCallPatient = async (queueId: string) => {
    try {
      await callPatient.mutateAsync(queueId);
    } catch (error) {
      console.error('Failed to call patient:', error);
    }
  };

  const openVitalsFormForQueuePatient = (queueItem: NursingQueuePatient) => {
    const patient = getPatientFromQueueItem(queueItem);
    const encounter = activeEncounters?.find(
      (e) => e.id === queueItem.visit_id,
    );

    if (!patient) return;

    handleNewRecord(
      patient as PatientDTO,
      queueItem.visit_id,
      queueItem.id,
      encounter?.id || queueItem.encounter_id || null,
    );
  };

  const handleStartService = (queueItem: NursingQueuePatient) => {
    // Open immediately to avoid UI lag, then mark serving in background.
    openVitalsFormForQueuePatient(queueItem);

    startServing.mutate(queueItem.id, {
      onError: (error) => {
        console.error('Failed to start serving patient:', error);
        showToast({
          type: 'warning',
          title: 'Queue sync delayed',
          message:
            'Vitals form opened, but queue serving status will retry in background.',
        });
      },
    });
  };

  const handleRecordVitalsForQueuePatient = (
    queueItem: NursingQueuePatient,
  ) => {
    if (queueItem.status === 'Waiting') {
      handleStartService(queueItem);
      return;
    }

    openVitalsFormForQueuePatient(queueItem);
  };

  // Handler to open patient care panel (patient-first design)
  const handleOpenPatientPanel = (queueItem: NursingQueuePatient) => {
    const patient = getPatientFromQueueItem(queueItem);
    // Find encounter from active encounters - queue.visit_id is UUID matching visits.id
    const encounter = activeEncounters?.find(
      (e) => e.id === queueItem.visit_id,
    );

    if (patient) {
      setSelectedPatient(patient as PatientDTO);
      setSelectedVisitId(queueItem.visit_id || null);
      setSelectedQueueId(queueItem.id);
      setSelectedEncounterId(encounter?.id || queueItem.encounter_id || null); // Use encounter.id (UUID) from EncounterDTO
      setSelectedPriority(queueItem.priority || 'Normal');
      setIsPatientPanelOpen(true);
    }
  };

  // Handler to open patient care panel from care records (NursingCareDTO)
  const handleOpenPatientPanelFromRecord = (record: NursingCareDTO) => {
    if (record.patient) {
      setSelectedPatient(record.patient as PatientDTO);
      setSelectedVisitId(record.visit_id || null);
      setSelectedQueueId(null); // Care records don't have a queue ID
      setSelectedEncounterId(record.encounter_id || null);
      setSelectedPriority('Normal');
      setIsPatientPanelOpen(true);
    }
  };

  // Close patient panel
  const handleClosePatientPanel = () => {
    setIsPatientPanelOpen(false);
    setSelectedPatient(null);
    setSelectedVisitId(null);
    setSelectedQueueId(null);
    setSelectedEncounterId(null);
    setSelectedPriority('Normal');
  };

  // Tab definitions - Simplified to just Queue and Records
  const tabs = [
    { id: 'queue', label: 'Patient Queue', icon: UserCheck, count: queueCount },
    {
      id: 'care-records',
      label: 'Care Records',
      icon: Activity,
      count: stats?.today,
    },
  ];

  // Helper to calculate wait time
  const getWaitTime = (arrivalTime: string): string => {
    const arrival = new Date(arrivalTime);
    const now = new Date();
    const diffMs = now.getTime() - arrival.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  // Priority badge styling
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Emergency':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Get time-based theme
  const {
    timeOfDay,
    greeting,
    colors: themeColors,
    isNightMode,
  } = useTimeTheme();

  // Get time icon based on time of day
  const TimeIcon = useMemo(() => {
    switch (timeOfDay) {
      case 'morning':
        return Sunrise;
      case 'afternoon':
        return Sun;
      case 'evening':
        return Sunset;
      case 'night':
        return Moon;
      default:
        return Sun;
    }
  }, [timeOfDay]);

  // Dynamic header gradient based on time
  const headerGradient = useMemo(() => {
    return `bg-gradient-to-r ${themeColors.header.gradient}`;
  }, [themeColors]);

  return (
    <div
      className={`space-y-8 px-4 pb-10 sm:px-6 lg:px-8 ${isNightMode ? 'bg-slate-900' : ''}`}
    >
      {/* Header */}
      <div
        className={`${headerGradient} rounded-2xl p-7 text-white relative overflow-hidden sm:p-8`}
      >
        {/* Decorative elements */}
        <div
          className={`absolute top-0 right-0 w-48 h-48 ${themeColors.header.decorativeCircle} rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/2`}
        />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 ${themeColors.header.decorativeCircle} rounded-xl backdrop-blur-sm`}
            >
              <Heart className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Nursing Care
              </h1>
              <p
                className={`mt-1 text-sm ${themeColors.accent.muted} flex items-center gap-2`}
              >
                <TimeIcon className="h-4 w-4" />
                Select a patient to record vitals, notes, and care
              </p>
            </div>
          </div>
          <Button
            icon={Plus}
            onClick={() => setIsFormOpen(true)}
            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            Quick Record
          </Button>
        </div>
      </div>

      {selectedPatient && (
        <ConsultationClinicalAlerts
          patientIdForLookup={selectedPatient.patient_id}
          encounter={{
            priority:
              selectedPriority !== 'Normal' ? selectedPriority : undefined,
            chief_complaint: null,
          }}
          isNightMode={isNightMode}
        />
      )}

      {/* Stats Row - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
        <StatsCard
          title="Waiting"
          value={queueCount || 0}
          icon={UserCheck}
          variant="success"
        />
        <StatsCard
          title="Today's Records"
          value={stats?.today || 0}
          icon={Activity}
        />
        <StatsCard
          title="Upcoming"
          value={stats?.upcoming_care || 0}
          icon={Users}
          variant="info"
        />
      </div>

      {/* Simple Tab Toggle */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-primary-700 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={18} />
              <span className="font-medium">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    isActive ? 'bg-white/20' : 'bg-gray-100'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <details
        className={`group rounded-xl border shadow-sm ${
          isNightMode
            ? 'border-slate-700 bg-slate-800/80'
            : 'border-gray-200 bg-white/90'
        }`}
      >
        <summary
          className={`flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold sm:px-5 [&::-webkit-details-marker]:hidden ${
            isNightMode ? 'text-slate-100' : 'text-gray-800'
          }`}
        >
          <span>Nursing tips &amp; guidance</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform group-open:rotate-180" />
        </summary>
        <div
          className={`space-y-3 border-t px-4 pb-4 pt-3 sm:px-5 ${
            isNightMode ? 'border-slate-700' : 'border-gray-100'
          }`}
        >
          {activeTab === 'queue' && (
            <InlineGuidance
              module="nursing"
              id="queue-guidance"
              title="Vitals & triage"
              message="Open a patient to see allergies and urgency above. Capture vitals and prepare for consultation."
            />
          )}
          {activeTab === 'care-records' && (
            <InlineGuidance
              module="nursing"
              id="records-guidance"
              title="Care history"
              message="Past nursing notes, observation charts, and treatment administration."
            />
          )}
        </div>
      </details>

      {/* Queue Tab Content */}
      {activeTab === 'queue' && (
        <div className="space-y-5">
          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients by name or patient number..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-700 focus:border-primary-700"
              />
            </div>
            <div className="text-sm text-gray-500">
              {filteredQueue.length} patient
              {filteredQueue.length !== 1 ? 's' : ''} in queue
            </div>
          </div>

          {/* Patient Queue Table */}
          {!filteredQueue || filteredQueue.length === 0 ? (
            <Card>
              <EmptyState
                icon={<UserCheck size={32} />}
                title="No patients waiting"
                description={
                  queueSearch
                    ? 'No patients match your search'
                    : 'Patients will appear here after payment verification'
                }
              />
            </Card>
          ) : (
            <DataTable
              data={filteredQueue}
              keyField="id"
              isLoading={queueLoading}
              columns={[
                {
                  key: 'ticket_no',
                  header: 'Ticket #',
                  render: (item: NursingQueuePatient) => {
                    return (
                      <span className="font-bold text-primary-700 text-lg">
                        {item.ticket_number || '-'}
                      </span>
                    );
                  },
                },
                {
                  key: 'patient',
                  header: 'Patient',
                  render: (item: NursingQueuePatient) => {
                    const patient = Array.isArray(item.patient)
                      ? item.patient[0]
                      : item.patient;
                    return (
                      <button
                        onClick={() => handleOpenPatientPanel(item)}
                        className="flex items-center gap-3 text-left hover:bg-green-50 -m-2 p-2 rounded-lg transition-colors group"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center font-semibold text-sm text-green-600">
                          {patient?.first_name?.charAt(0)}
                          {patient?.surname?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 group-hover:text-primary-700 underline-offset-2 group-hover:underline">
                            {patient
                              ? `${patient.first_name} ${patient.surname}`
                              : 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {patient?.contact_phone || 'No phone'}
                          </div>
                        </div>
                      </button>
                    );
                  },
                },
                {
                  key: 'priority',
                  header: 'Priority',
                  render: (item: NursingQueuePatient) => (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        item.priority === 'Emergency'
                          ? 'bg-red-100 text-red-700'
                          : item.priority === 'Urgent'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {item.priority !== 'Normal' && (
                        <AlertTriangle size={12} />
                      )}
                      {item.priority}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (item: NursingQueuePatient) => {
                    const isCalled = !!item.called_at;
                    return (
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isCalled
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {isCalled ? 'Called' : item.status}
                      </span>
                    );
                  },
                },
                {
                  key: 'wait_time',
                  header: 'Wait Time',
                  render: (item: NursingQueuePatient) => (
                    <span className="text-gray-600 flex items-center gap-1">
                      <Clock size={14} />
                      {getWaitTime(item.created_at)}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  className: 'text-right',
                  render: (item: NursingQueuePatient) => {
                    return (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          onClick={() => handleOpenPatientPanel(item)}
                        >
                          Open
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Play}
                          onClick={() =>
                            handleRecordVitalsForQueuePatient(item)
                          }
                          disabled={startServing.isPending}
                        >
                          Vitals
                        </Button>
                      </div>
                    );
                  },
                },
              ]}
            />
          )}

          {/* Patients Requiring Care */}
          {patientsRequiringCare && patientsRequiringCare.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="text-orange-500" size={20} />
                  Patients Requiring Care
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {patientsRequiringCare.slice(0, 6).map((item: any) => (
                  <div
                    key={item.care_id}
                    className="p-4 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
                    onClick={() => {
                      if (item.patient) {
                        setSelectedPatient(item.patient as PatientDTO);
                        setIsFormOpen(true);
                      }
                    }}
                  >
                    <div className="font-medium text-gray-900">
                      {item.patient
                        ? formatPatientName(item.patient)
                        : 'Unknown'}
                    </div>
                    <div className="text-sm text-orange-600 mt-1">
                      {item.care_type} - Overdue
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Due:{' '}
                      {new Date(item.next_care_time).toLocaleTimeString(
                        'en-US',
                        { hour: '2-digit', minute: '2-digit' },
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Care Records Tab */}
      {activeTab === 'care-records' && (
        <Card>
          <NursingCareList
            records={recordsData?.data || []}
            isLoading={isLoading}
            onView={handleViewRecord}
            onEdit={handleEditRecord}
            onDelete={handleDeleteRecord}
            onOpenPatientPanel={handleOpenPatientPanelFromRecord}
            page={page}
            totalPages={recordsData?.totalPages || 1}
            onPageChange={setPage}
            onSearch={handleSearch}
            careTypeFilter={careTypeFilter}
            onCareTypeFilterChange={handleFilterChange}
          />
        </Card>
      )}

      {/* Patient Care Panel (Slide-out) */}
      {isPatientPanelOpen && (
        <PatientCarePanel
          patient={selectedPatient}
          encounterId={selectedEncounterId}
          visitId={selectedVisitId}
          queueId={selectedQueueId}
          priority={selectedPriority}
          onClose={handleClosePatientPanel}
          onVitalsSaved={() => {
            if (selectedQueueId) {
              completeQueue.mutate(selectedQueueId);
            }
            showToast({
              type: 'success',
              title: 'Vitals Saved',
              message: 'Patient vitals recorded successfully',
            });
          }}
          isCreatingRecord={createRecord.isPending}
          onCreateRecord={handleCreateRecord}
          editingRecord={editingRecord}
        />
      )}

      {/* Quick Record Form Modal */}
      <NursingCareForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingRecord(null);
          setSelectedPatient(null);
          setSelectedVisitId(null);
          setSelectedQueueId(null);
          setSelectedEncounterId(null);
        }}
        onSubmit={editingRecord ? handleUpdateRecord : handleCreateRecord}
        isLoading={
          editingRecord ? updateRecord.isPending : createRecord.isPending
        }
        preselectedPatient={selectedPatient}
        visitId={selectedVisitId}
        queueId={selectedQueueId}
        encounterId={selectedEncounterId}
        editingRecord={editingRecord}
      />
    </div>
  );
}
