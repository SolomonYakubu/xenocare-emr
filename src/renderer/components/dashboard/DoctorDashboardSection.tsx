// =============================================================================
// Doctor-Specific Dashboard Section
// Full doctor workspace: Quick Actions, My Queue, Pending Results
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Stethoscope,
  ChevronRight,
  FlaskConical,
  Scan,
  UserCheck,
  Users,
  ClipboardList,
  Bed,
  FolderSearch,
  Siren,
  Scissors,
} from 'lucide-react';
import { useAuth, AE_DEPARTMENTS } from '../../contexts/AuthContext';
import {
  isEmergencyFeatureEnabled,
  isSpecialtyClinicsEnabled,
} from '../../config/features';
import { supabase } from '../../api/supabaseClient';
import {
  EncounterDTO,
  useActiveEncounters,
  useStartConsultation,
} from '../../lib/workflow';
import { useToast } from '../ui/Toast';
import { useSpecialtyDashboard } from '../../modules/specialty-clinic/hooks/useSpecialtyDashboard';

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueuePatient {
  encounter_id: string;
  encounter?: EncounterDTO | null;
  queue_id?: string;
  patient_name: string;
  stage: string;
  visit_type: string;
  started_at: string;
  priority: string;
}

interface PendingOrder {
  id: string;
  type: 'lab' | 'radiology';
  test_name: string;
  patient_name: string;
  requested_at: string;
  status: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DoctorDashboardSection() {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isDoctor =
    staff?.role === 'doctor' || staff?.role === 'medical_director';
  const startConsultation = useStartConsultation();
  const [openingEncounterId, setOpeningEncounterId] = useState<string | null>(
    null,
  );

  const userDept = staff?.department?.toLowerCase() || '';
  const specialtyCode = (staff?.specialty_code || '').toUpperCase();
  // Only route to A&E if doctor is explicitly in an emergency department;
  // all other doctors (GOPD, specialty, unset) default to Consultation.
  const isAE =
    isEmergencyFeatureEnabled() &&
    AE_DEPARTMENTS.some(
    (dept) =>
      userDept.includes(dept.toLowerCase()) ||
      dept.toLowerCase().includes(userDept),
  );
  const isSpecialtyDoctor = Boolean(
    isSpecialtyClinicsEnabled() &&
      specialtyCode &&
      specialtyCode !== 'EMERGENCY' &&
      !isAE,
  );

  const { data: specialtyDashboard, isLoading: specialtyLoading } =
    useSpecialtyDashboard(isSpecialtyDoctor ? specialtyCode : null);

  const humanizeSpecialtyCode = (code: string) =>
    code
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const specialtyLabel =
    specialtyDashboard?.config.specialty_name ||
    (specialtyCode ? humanizeSpecialtyCode(specialtyCode) : 'Specialty');

  const primaryPath = isAE
    ? '/ae'
    : isSpecialtyDoctor
      ? `/specialty-clinic/${specialtyCode}`
      : '/consultation';
  const primaryLabel = isAE
    ? 'A&E'
    : isSpecialtyDoctor
      ? specialtyLabel
      : 'Consultation';
  const queuePanelLabel = isSpecialtyDoctor
    ? `${primaryLabel} Queue`
    : 'Consultation Queue';

  const { data: activeEncounters, isLoading: encountersLoading } =
    useActiveEncounters();

  const consultationReady = useMemo(() => {
    if (!activeEncounters || isAE) return [];
    const currentStaffId = staff?.id;

    return activeEncounters
      .filter((encounter) => {
        if (encounter.status !== 'Active') return false;
        if (encounter.queue_entry?.specialty_code) return false;

        const readyStages = [
          'consultation',
          'doctor_review',
          'lab_results',
          'radiology_results',
        ];
        if (!readyStages.includes(encounter.current_stage)) return false;

        if (encounter.queue_entry?.status === 'In Progress') {
          return encounter.queue_entry.assigned_to === currentStaffId;
        }

        return true;
      })
      .sort((left, right) => {
        const priorityOrder = { Emergency: 0, Urgent: 1, Normal: 2 } as const;
        const priorityDiff =
          priorityOrder[left.priority] - priorityOrder[right.priority];
        if (priorityDiff !== 0) return priorityDiff;

        return (
          new Date(left.registration_time).getTime() -
          new Date(right.registration_time).getTime()
        );
      });
  }, [activeEncounters, isAE, staff?.id]);

  const mapEncounterToQueuePatient = useCallback(
    (encounter: EncounterDTO): QueuePatient => {
      const firstName = encounter.patient?.first_name || '';
      const surname = encounter.patient?.surname || '';
      const queueStatus = encounter.queue_entry?.status;
      let stage = encounter.current_stage || 'consultation';

      if (queueStatus === 'Waiting') stage = 'queue_waiting';
      if (queueStatus === 'Called') stage = 'called';

      return {
        encounter_id: encounter.id,
        encounter,
        queue_id: encounter.queue_entry?.id,
        patient_name: `${firstName} ${surname}`.trim() || 'Unknown',
        stage,
        visit_type: encounter.visit_type || 'OPD',
        started_at: encounter.registration_time || encounter.created_at,
        priority: encounter.priority || 'Normal',
      };
    },
    [],
  );

  const normalizeName = (value?: string | null) =>
    (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const currentDoctorName = normalizeName(
    `${staff?.first_name || ''} ${staff?.last_name || ''}`,
  );

  const mapSpecialtyPatient = useCallback(
    (patient: {
      id: string;
      first_name: string;
      last_name: string;
      status: string;
      priority: string;
      created_at: string;
      encounter_id: string | null;
      visit_id: string | null;
    }): QueuePatient => ({
      encounter_id: patient.encounter_id || patient.visit_id || patient.id,
      queue_id: patient.id,
      encounter: null,
      patient_name:
        `${patient.first_name || ''} ${patient.last_name || ''}`.trim() ||
        'Unknown',
      stage: patient.status.toLowerCase().replace(/\s+/g, '_'),
      visit_type: primaryLabel,
      started_at: patient.created_at,
      priority: patient.priority || 'Normal',
    }),
    [primaryLabel],
  );

  const specialtyMyPatients = useMemo(() => {
    if (!isSpecialtyDoctor || !specialtyDashboard?.queue) return [];

    return specialtyDashboard.queue
      .filter((patient) => {
        if (patient.status !== 'In Progress') return false;
        const assignedDoctorName = normalizeName(
          `${patient.assigned_doctor_first || ''} ${patient.assigned_doctor_last || ''}`,
        );
        return assignedDoctorName === currentDoctorName;
      })
      .slice(0, 10)
      .map(mapSpecialtyPatient);
  }, [
    currentDoctorName,
    isSpecialtyDoctor,
    mapSpecialtyPatient,
    specialtyDashboard?.queue,
  ]);

  const specialtyQueue = useMemo(() => {
    if (!isSpecialtyDoctor || !specialtyDashboard?.queue) return [];

    return specialtyDashboard.queue
      .filter(
        (patient) =>
          patient.status === 'Waiting' || patient.status === 'Called',
      )
      .slice(0, 15)
      .map(mapSpecialtyPatient);
  }, [isSpecialtyDoctor, mapSpecialtyPatient, specialtyDashboard?.queue]);

  const myPatients = useMemo(() => {
    if (isSpecialtyDoctor) return specialtyMyPatients;

    return consultationReady
      .filter(
        (encounter) =>
          encounter.queue_entry?.assigned_to === staff?.id ||
          encounter.attending_doctor_id === staff?.id ||
          encounter.is_assigned_to_current_user === true,
      )
      .slice(0, 10)
      .map(mapEncounterToQueuePatient);
  }, [
    consultationReady,
    isSpecialtyDoctor,
    mapEncounterToQueuePatient,
    specialtyMyPatients,
    staff?.id,
  ]);

  const consultationQueue = useMemo(() => {
    if (isSpecialtyDoctor) return specialtyQueue;

    return consultationReady
      .filter(
        (encounter) =>
          encounter.queue_entry?.status !== 'In Progress' &&
          !encounter.queue_entry?.assigned_to &&
          encounter.attending_doctor_id !== staff?.id,
      )
      .slice(0, 15)
      .map(mapEncounterToQueuePatient);
  }, [
    consultationReady,
    isSpecialtyDoctor,
    mapEncounterToQueuePatient,
    specialtyQueue,
    staff?.id,
  ]);

  const handleOpenPatient = useCallback(
    async (patient: QueuePatient) => {
      if (isAE) {
        navigate('/ae');
        return;
      }

      if (isSpecialtyDoctor) {
        const launchId = patient.queue_id || patient.encounter_id;
        setOpeningEncounterId(launchId);
        navigate(primaryPath, {
          state: {
            dashboardQueueId: patient.queue_id,
            dashboardQueueAction:
              patient.stage === 'in_progress' ? 'resume' : 'start',
          },
        });
        return;
      }

      const encounter = patient.encounter;
      if (!encounter) {
        navigate(primaryPath);
        return;
      }
      const alreadyStarted =
        encounter.queue_entry?.status === 'In Progress' &&
        encounter.queue_entry.assigned_to === staff?.id;

      setOpeningEncounterId(encounter.id);

      try {
        if (!alreadyStarted) {
          const result = await startConsultation.mutateAsync({
            encounterId: encounter.id,
            doctorId: staff?.id,
          });

          if (!result.success) {
            showToast({
              type: 'error',
              title: 'Cannot Start Consultation',
              message:
                result.error ||
                'This patient may already be in consultation with another doctor.',
            });
            return;
          }
        }

        navigate('/consultation', {
          state: { dashboardEncounterId: encounter.id },
        });
      } catch (error: unknown) {
        showToast({
          type: 'error',
          title: 'Error',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to open consultation. Please try again.',
        });
      } finally {
        setOpeningEncounterId((currentId) =>
          currentId === encounter.id ? null : currentId,
        );
      }
    },
    [
      isAE,
      isSpecialtyDoctor,
      navigate,
      primaryPath,
      showToast,
      staff?.id,
      startConsultation,
    ],
  );

  // My pending lab/radiology results
  const { data: pendingResults = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['doctor-pending-results', staff?.id],
    queryFn: async () => {
      if (!staff?.id) return [];
      const results: PendingOrder[] = [];

      // Pending lab requests — ordered_by stores staff.id (UUID)
      // Status values: Pending, Accepted, Sample_Collected, Processing, Result_Ready
      const { data: labs } = await supabase
        .from('lab_requests')
        .select('id, test_name, patient_id, created_at, status')
        .eq('ordered_by', staff.id)
        .in('status', ['Pending', 'Accepted', 'Sample_Collected', 'Processing'])
        .order('created_at', { ascending: false })
        .limit(8);

      // Pending radiology — same pattern
      // Status values: Pending, Scheduled, In Progress, Imaging Completed
      const { data: rads } = await supabase
        .from('radiology_requests')
        .select('id, study_type, patient_id, created_at, status')
        .eq('ordered_by', staff.id)
        .in('status', ['Pending', 'Scheduled', 'In Progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      // Get patient names
      const allPatientIds = [
        ...new Set(
          [
            ...(labs || []).map((l) => l.patient_id),
            ...(rads || []).map((r) => r.patient_id),
          ].filter(Boolean),
        ),
      ];
      const patMap = new Map<string, string>();
      if (allPatientIds.length > 0) {
        const { data: patients } = await supabase
          .from('patients')
          .select('patient_id, first_name, surname')
          .in('patient_id', allPatientIds);
        (patients || []).forEach((p) => {
          patMap.set(p.patient_id, `${p.first_name} ${p.surname}`);
        });
      }

      (labs || []).forEach((l) => {
        results.push({
          id: l.id,
          type: 'lab',
          test_name: l.test_name || 'Lab Test',
          patient_name: patMap.get(l.patient_id) || 'Unknown',
          requested_at: l.created_at,
          status: l.status,
        });
      });

      (rads || []).forEach((r) => {
        results.push({
          id: r.id,
          type: 'radiology',
          test_name: r.study_type || 'Imaging',
          patient_name: patMap.get(r.patient_id) || 'Unknown',
          requested_at: r.created_at,
          status: r.status,
        });
      });

      return results;
    },
    enabled: !!staff?.id && isDoctor,
    refetchInterval: 60000,
  });

  if (!isDoctor) return null;

  const patientDataLoading = isSpecialtyDoctor
    ? specialtyLoading
    : encountersLoading;

  const formatStage = (stage: string) =>
    stage
      .split('_')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');

  const timeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const stageColor: Record<string, string> = {
    nursing_vitals: 'bg-pink-100 text-pink-700',
    queue_waiting: 'bg-amber-100 text-amber-700',
    called: 'bg-blue-100 text-blue-700',
    consultation: 'bg-indigo-100 text-indigo-700',
    in_consultation: 'bg-indigo-100 text-indigo-700',
    lab_pending: 'bg-yellow-100 text-yellow-700',
    pharmacy_pending: 'bg-emerald-100 text-emerald-700',
    payment: 'bg-cyan-100 text-cyan-700',
  };

  const LoadingSkeleton = () => (
    <div className="p-4 space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-100" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-slate-100 rounded w-1/3" />
            <div className="h-2.5 bg-slate-50 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  const PatientRow = ({
    patient: p,
    onClick,
  }: {
    patient: QueuePatient;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      disabled={openingEncounterId === (p.queue_id || p.encounter_id)}
      className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-[#e2f1f0] flex items-center justify-center text-[#11151C] font-bold text-xs flex-shrink-0">
          {p.patient_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">
            {p.patient_name}
          </p>
          <p className="text-xs text-slate-400">
            {p.visit_type} · {timeSince(p.started_at)} ago
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {(p.priority === 'Emergency' || p.priority === 'Urgent') && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
            {p.priority.toUpperCase()}
          </span>
        )}
        {openingEncounterId === (p.queue_id || p.encounter_id) ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
            Opening...
          </span>
        ) : (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${stageColor[p.stage] || 'bg-slate-100 text-slate-600'}`}
          >
            {formatStage(p.stage)}
          </span>
        )}
      </div>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* ── Quick Actions Row ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: primaryLabel,
            icon: isAE ? Siren : Stethoscope,
            path: primaryPath,
            color: 'bg-[#E9783F]',
          },
          {
            label: 'Medical Records',
            icon: FolderSearch,
            path: '/medical-records',
            color: 'bg-indigo-600',
          },
          {
            label: 'In-Patient',
            icon: Bed,
            path: '/in-patient',
            color: 'bg-cyan-600',
          },
          {
            label: 'Procedures',
            icon: Scissors,
            path: '/procedures',
            color: 'bg-rose-600',
          },
          {
            label: 'Surgery',
            icon: ClipboardList,
            path: '/surgery',
            color: 'bg-violet-600',
          },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
          >
            <div
              className={`w-9 h-9 rounded-lg ${action.color} flex items-center justify-center text-white flex-shrink-0`}
            >
              <action.icon size={16} />
            </div>
            <span className="font-semibold text-slate-700 text-xs group-hover:text-[#11151C] transition-colors truncate">
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── My Patients + Queue + Pending Results ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── My Patients (assigned to me) ──────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Stethoscope size={16} className="text-[#11151C]" />
              My Patients
              {myPatients.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-[#e2f1f0] text-[#11151C]">
                  {myPatients.length}
                </span>
              )}
            </h3>
            <button
              onClick={() => navigate(primaryPath)}
              className="text-xs font-bold text-[#11151C] hover:underline flex items-center gap-1"
            >
              Open {primaryLabel} <ChevronRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-50 max-h-[360px] overflow-auto">
            {patientDataLoading ? (
              <LoadingSkeleton />
            ) : myPatients.length > 0 ? (
              myPatients.map((p) => (
                <PatientRow
                  key={p.encounter_id}
                  patient={p}
                  onClick={() => {
                    void handleOpenPatient(p);
                  }}
                />
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <UserCheck size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">
                  No patients assigned to you
                </p>
                <button
                  onClick={() => navigate(primaryPath)}
                  className="mt-3 text-xs font-bold text-[#11151C] hover:underline"
                >
                  Go to {primaryLabel} →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Consultation Queue ────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users size={16} className="text-amber-500" />
              {queuePanelLabel}
              {consultationQueue.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                  {consultationQueue.length}
                </span>
              )}
            </h3>
            <button
              onClick={() => navigate(primaryPath)}
              className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-50 max-h-[360px] overflow-auto">
            {patientDataLoading ? (
              <LoadingSkeleton />
            ) : consultationQueue.length > 0 ? (
              consultationQueue.map((p) => (
                <PatientRow
                  key={p.encounter_id}
                  patient={p}
                  onClick={() => {
                    void handleOpenPatient(p);
                  }}
                />
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <Users size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">
                  No patients waiting in {primaryLabel}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Pending Results ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <FlaskConical size={16} className="text-amber-500" />
              Pending Results
              {pendingResults.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                  {pendingResults.length}
                </span>
              )}
            </h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-[360px] overflow-auto">
            {resultsLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse flex gap-3 items-center"
                  >
                    <div className="h-8 w-8 bg-slate-100 rounded" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-slate-100 rounded w-2/3" />
                      <div className="h-2.5 bg-slate-50 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingResults.length > 0 ? (
              pendingResults.map((r) => (
                <div
                  key={r.id}
                  className="px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    {r.type === 'lab' ? (
                      <FlaskConical
                        size={14}
                        className="text-yellow-500 mt-0.5 flex-shrink-0"
                      />
                    ) : (
                      <Scan
                        size={14}
                        className="text-purple-500 mt-0.5 flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {r.test_name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {r.patient_name} · {timeSince(r.requested_at)} ago
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 flex-shrink-0">
                      {r.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <FlaskConical
                  size={28}
                  className="mx-auto text-slate-300 mb-2"
                />
                <p className="text-sm text-slate-400">No pending results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
