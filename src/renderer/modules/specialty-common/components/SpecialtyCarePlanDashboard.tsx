/**
 * =============================================================================
 * SPECIALTY CARE PLAN DASHBOARD
 * =============================================================================
 * Generic care plan dashboard for any specialty that has a care plan config.
 * Replaces the neuropsychiatry-specific PsychiatricCarePlanDashboard when used
 * in the SpecialtyClinicPage care_plans tab.
 *
 * Features:
 * - Lists all Active / On-Hold care plans for the specialty
 * - Session progress bar
 * - Goals & baseline data display
 * - Record Session modal
 * - Status update (Complete / On Hold / Cancel)
 * =============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Target,
  Activity,
  Plus,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '../../../components/ui/FormElements';
import { Modal } from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import {
  useActiveCarePlans,
  useCareplanSessions,
  useUpdateCareplanStatus,
  useCreateSession,
} from '../hooks/useSpecialtyClinic';
import { getCarePlanConfig } from '../constants/care-plans';
import { useAuth } from '../../../contexts/AuthContext';
import type {
  SpecialtyCareplan,
  CareplanSession,
} from '../dtos/specialty-clinic.dto';

// =============================================================================
// Sub-components
// =============================================================================

function SessionProgressBar({
  sessions,
  total,
  color,
}: {
  sessions: CareplanSession[];
  total: number | null;
  color: string;
}) {
  const completed = sessions.filter((s) => s.status === 'Completed').length;
  const displayTotal = total ?? Math.max(completed + 1, 1);
  const pct = Math.min(100, (completed / displayTotal) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{completed} sessions completed</span>
        {total ? (
          <span>{Math.max(0, total - completed)} remaining</span>
        ) : (
          <span>Ongoing</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: `var(--color-${color}-500, #6366f1)`,
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    On_Hold: 'bg-amber-100 text-amber-700 border-amber-300',
    Completed: 'bg-gray-100 text-gray-600 border-gray-300',
    Cancelled: 'bg-red-100 text-red-700 border-red-300',
  };
  const icons: Record<string, React.ReactNode> = {
    Active: <Activity className="w-3 h-3 inline mr-1" />,
    On_Hold: <Clock className="w-3 h-3 inline mr-1" />,
    Completed: <CheckCircle className="w-3 h-3 inline mr-1" />,
    Cancelled: <XCircle className="w-3 h-3 inline mr-1" />,
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status] ?? styles.Active}`}
    >
      {icons[status]}
      {status.replace('_', ' ')}
    </span>
  );
}

// =============================================================================
// Session Record Modal
// =============================================================================

interface SessionModalProps {
  plan: SpecialtyCareplan;
  existingSessions: CareplanSession[];
  staffId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function RecordSessionModal({
  plan,
  existingSessions,
  staffId,
  onClose,
  onSuccess,
}: SessionModalProps) {
  const { showToast } = useToast();
  const createSession = useCreateSession();
  const [notes, setNotes] = useState('');
  const [assessment, setAssessment] = useState('');
  const [planForNext, setPlanForNext] = useState('');

  const nextSessionNumber = existingSessions.length + 1;

  async function handleSubmit() {
    if (!notes.trim()) {
      showToast({
        type: 'warning',
        title: 'Notes required',
        message: 'Please enter session notes.',
      });
      return;
    }
    try {
      await createSession.mutateAsync({
        careplan_id: plan.id,
        session_number: nextSessionNumber,
        status: 'Completed',
        completed_date: new Date().toISOString(),
        session_data: {
          recorded_at: new Date().toISOString(),
        },
        notes: notes.trim(),
        assessment: assessment.trim() || undefined,
        plan_for_next: planForNext.trim() || undefined,
        recorded_by: staffId,
      });
      showToast({
        type: 'success',
        title: 'Session Recorded',
        message: `Session ${nextSessionNumber} recorded.`,
      });
      onSuccess();
      onClose();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to record session.',
      });
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Record Session ${nextSessionNumber}`}
      size="md"
    >
      <div className="space-y-4 p-1">
        <div>
          <p className="text-xs text-gray-500 mb-3">
            Plan:{' '}
            <span className="font-semibold text-gray-700">
              {plan.plan_name}
            </span>
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Session Notes <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was discussed / done in this session..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Assessment / Progress
          </label>
          <textarea
            rows={2}
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            placeholder="Patient progress, response to treatment..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Plan for Next Session
          </label>
          <textarea
            rows={2}
            value={planForNext}
            onChange={(e) => setPlanForNext(e.target.value)}
            placeholder="Goals and focus areas for next visit..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={createSession.isPending}
          >
            {createSession.isPending ? 'Saving...' : 'Save Session'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// Plan Card
// =============================================================================

function CarePlanCard({
  plan,
  color,
  staffId,
}: {
  plan: SpecialtyCareplan;
  color: string;
  staffId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const { showToast } = useToast();
  const updateStatus = useUpdateCareplanStatus();
  const { data: sessions = [], refetch: refetchSessions } = useCareplanSessions(
    expanded ? plan.id : undefined,
  );

  const { patient } = plan as any;
  const patientName = patient
    ? `${patient.first_name ?? ''} ${patient.surname ?? ''}`.trim()
    : 'Unknown Patient';
  const initials = patientName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleStatusChange(
    status: 'Active' | 'Completed' | 'Cancelled' | 'On_Hold',
  ) {
    try {
      await updateStatus.mutateAsync({ careplanId: plan.id, status });
      showToast({
        type: 'success',
        title: 'Updated',
        message: `Care plan marked as ${status.replace('_', ' ')}.`,
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Could not update status.',
      });
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        {/* Card header */}
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl bg-${color}-100 flex items-center justify-center text-${color}-700 font-bold text-sm shrink-0`}
              >
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900 text-sm">
                    {patientName}
                  </p>
                  {patient?.emr_number && (
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                      {patient.emr_number}
                    </span>
                  )}
                  <StatusBadge status={plan.status} />
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" />
                    {plan.plan_name}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {plan.frequency ?? 'Flexible'} ·{' '}
                    {plan.expected_duration ?? 'Ongoing'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
            >
              {expanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Goals chips */}
          {plan.goals && (plan.goals as unknown[]).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {(plan.goals as unknown[]).slice(0, 3).map((g, i) => (
                <span
                  key={i}
                  className={`text-xs px-2 py-0.5 rounded-full bg-${color}-50 text-${color}-700 border border-${color}-200`}
                >
                  <Target className="w-3 h-3 inline mr-0.5" />
                  {typeof g === 'string'
                    ? g
                    : typeof g === 'object' && g !== null
                      ? ((g as any).label ??
                        (g as any).value ??
                        JSON.stringify(g))
                      : String(g)}
                </span>
              ))}
              {(plan.goals as unknown[]).length > 3 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  +{(plan.goals as unknown[]).length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expanded section */}
        {expanded && (
          <div
            className={`border-t border-${color}-100 bg-${color}-50/30 px-5 py-4 space-y-4`}
          >
            {/* Session progress */}
            <SessionProgressBar
              sessions={sessions}
              total={plan.total_sessions ?? null}
              color={color}
            />

            {/* Diagnosis */}
            {plan.diagnosis && (plan.diagnosis as unknown[]).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Diagnoses
                </p>
                <div className="flex flex-wrap gap-1">
                  {(plan.diagnosis as unknown[]).map((d, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md"
                    >
                      {typeof d === 'string'
                        ? d
                        : typeof d === 'object' && d !== null
                          ? ((d as any).label ??
                            (d as any).value ??
                            JSON.stringify(d))
                          : String(d)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Baseline data */}
            {plan.baseline_data &&
              Object.keys(plan.baseline_data as object).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Baseline Information
                  </p>
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(
                      plan.baseline_data as Record<string, unknown>,
                    )
                      .filter(([, v]) => v != null && v !== '')
                      .map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <span className="text-gray-500 capitalize w-28 shrink-0">
                            {k.replace(/_/g, ' ')}:
                          </span>
                          <span className="text-gray-700 font-medium">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Session history — Physio-style */}
            {sessions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Session History
                </p>
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto rounded-lg border border-gray-100 bg-white">
                  {sessions.map((s) => {
                    const isCompleted = s.status === 'Completed';
                    const isMissed = s.status === 'Missed';
                    const isCancelled = s.status === 'Cancelled';
                    return (
                      <div
                        key={s.id}
                        className={`p-3 flex items-center justify-between hover:bg-gray-50 ${isCompleted ? 'bg-green-50/30' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            isCompleted ? 'bg-green-100 text-green-700'
                              : isMissed || isCancelled ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {s.session_number}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">Session {s.session_number}</span>
                              <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                                isCompleted ? 'bg-green-100 text-green-700'
                                  : isMissed || isCancelled ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {s.status?.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {isCompleted && s.notes && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{s.notes}</p>
                            )}
                            {!isCompleted && s.scheduled_date && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Scheduled: {format(new Date(s.scheduled_date), 'dd MMM yyyy')}
                              </p>
                            )}
                            {isCompleted && s.completed_date && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {format(new Date(s.completed_date), 'dd MMM yyyy, HH:mm')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
                          {(isMissed || isCancelled) && <XCircle className="h-5 w-5 text-red-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {plan.status === 'Active' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowSessionModal(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Record Session
                </Button>
              )}
              {plan.status === 'Active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('On_Hold')}
                >
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  On Hold
                </Button>
              )}
              {plan.status === 'On_Hold' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('Active')}
                >
                  <Activity className="w-3.5 h-3.5 mr-1" />
                  Reactivate
                </Button>
              )}
              {(plan.status === 'Active' || plan.status === 'On_Hold') && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange('Completed')}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    Mark Complete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange('Cancelled')}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1 text-red-500" />
                    Cancel Plan
                  </Button>
                </>
              )}
            </div>

            <p className="text-xs text-gray-400">
              Created{' '}
              {formatDistanceToNow(new Date(plan.created_at), {
                addSuffix: true,
              })}
              {(plan as any).creator &&
                ` by ${(plan as any).creator.first_name} ${(plan as any).creator.last_name}`}
            </p>
          </div>
        )}
      </div>

      {showSessionModal && (
        <RecordSessionModal
          plan={plan}
          existingSessions={sessions}
          staffId={staffId}
          onClose={() => setShowSessionModal(false)}
          onSuccess={() => refetchSessions()}
        />
      )}
    </>
  );
}

// =============================================================================
// Main Dashboard
// =============================================================================

interface SpecialtyCarePlanDashboardProps {
  specialtyCode: string;
}

export default function SpecialtyCarePlanDashboard({
  specialtyCode,
}: SpecialtyCarePlanDashboardProps) {
  const [search, setSearch] = useState('');
  const [statusView, setStatusView] = useState<'active' | 'all'>('active');
  const { staff } = useAuth();
  const config = getCarePlanConfig(specialtyCode);
  const color = config?.color ?? 'blue';

  const statusFilter = statusView === 'all'
    ? (['Active', 'On_Hold', 'Completed', 'Cancelled'] as const)
    : undefined; // undefined → default Active/On_Hold

  const {
    data: plans = [],
    isLoading,
    refetch,
  } = useActiveCarePlans(specialtyCode, statusFilter as ('Active' | 'On_Hold' | 'Completed' | 'Cancelled')[] | undefined);

  const filtered = useMemo(() => {
    if (!search.trim()) return plans;
    const q = search.toLowerCase();
    return plans.filter((p) => {
      const { patient } = p as any;
      return (
        (patient?.first_name ?? '').toLowerCase().includes(q) ||
        (patient?.surname ?? '').toLowerCase().includes(q) ||
        (patient?.emr_number ?? '').toLowerCase().includes(q) ||
        p.plan_name.toLowerCase().includes(q)
      );
    });
  }, [plans, search]);

  if (!config) {
    return (
      <div className="text-center py-16 text-gray-400">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" />
        <p>Care plans are not configured for this specialty.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className={`bg-gradient-to-r from-${color}-700 to-${color}-500 rounded-xl p-5 shadow-lg`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {config.section_title} — {statusView === 'all' ? 'All Plans' : 'Active Plans'}
              </h3>
              <p className="text-xs text-white/70 mt-0.5">
                Longitudinal care plan tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-center">
              <p className="text-2xl font-black text-yellow-300">
                {plans.length}
              </p>
              <p className="text-xs font-bold text-white uppercase tracking-wider">
                {statusView === 'all' ? 'Total' : 'Active'}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 flex items-center justify-center transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Status filter toggle */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setStatusView('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              statusView === 'active'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
            }`}
          >
            Active / On Hold
          </button>
          <button
            onClick={() => setStatusView('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              statusView === 'all'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
            }`}
          >
            All Plans
          </button>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          <input
            type="text"
            placeholder="Search by patient name, patient number or plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/15 rounded-xl text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-white/30 transition-all"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div
            className={`w-16 h-16 mx-auto mb-4 rounded-xl bg-${color}-50 flex items-center justify-center`}
          >
            <ClipboardList className={`w-8 h-8 text-${color}-300`} />
          </div>
          <p className="text-lg font-bold text-gray-500">
            No Active Care Plans
          </p>
          <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
            Care plans are created automatically when a consultation with a care
            plan is submitted.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((plan) => (
            <CarePlanCard
              key={plan.id}
              plan={plan}
              color={color}
              staffId={staff?.id ?? ''}
            />
          ))}
        </div>
      )}
    </div>
  );
}
