/**
 * =============================================================================
 * NUTRITION CARE PLAN DASHBOARD
 * =============================================================================
 */

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Leaf,
  Plus,
  RefreshCw,
  Search,
  Target,
  XCircle,
  Printer,
  Archive,
  Eye,
  FlaskConical,
  Route,
  ListOrdered,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '../../../components/ui/FormElements';
import { Modal } from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import { ReferralDetailsModal } from '../../../components/shared';
import PatientMedicalRecordsPanel from '../../../components/shared/PatientMedicalRecordsPanel';
import { useClinicalRequest } from '../../clinical-requests/hooks/useClinicalRequests';
import {
  useAllNutritionCarePlans,
  useCreateNutritionSession,
  useNutritionCarePlanSessions,
  useUpdateNutritionCarePlanStatus,
} from '../hooks/useNutrition';
import NutritionSessionRecordModal from './NutritionSessionRecordModal';
import type {
  CareplanSession,
  SpecialtyCareplan,
} from '../../specialty-common/dtos/specialty-clinic.dto';

interface NutritionCarePlanDashboardProps {
  onCreatePlan?: () => void;
  initialSearch?: string;
}

function normalizeStatus(
  status: unknown,
): 'Active' | 'On_Hold' | 'Completed' | 'Cancelled' {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'active') return 'Active';
  if (normalized === 'on_hold') return 'On_Hold';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'Cancelled';
  }

  return 'Active';
}

function StatusBadge({ status }: { status: string }) {
  const displayStatus = normalizeStatus(status);
  const styles: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    On_Hold: 'bg-amber-100 text-amber-700 border-amber-300',
    Completed: 'bg-gray-100 text-gray-600 border-gray-300',
    Cancelled: 'bg-red-100 text-red-700 border-red-300',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${styles[displayStatus] || styles.Active}`}
    >
      {displayStatus.replace('_', ' ')}
    </span>
  );
}

function ProgressBar({
  sessions,
  total,
}: {
  sessions: CareplanSession[];
  total: number | null;
}) {
  const completed = sessions.filter(
    (session) => session.status === 'Completed',
  ).length;
  const denominator = total || Math.max(1, completed + 1);
  const percent = Math.min(100, (completed / denominator) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{completed} completed</span>
        {total ? (
          <span>{Math.max(0, total - completed)} remaining</span>
        ) : (
          <span>Ongoing</span>
        )}
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function SessionTimeline({ sessions }: { sessions: CareplanSession[] }) {
  if (sessions.length === 0) {
    return (
      <p className="text-xs text-gray-400">No sessions recorded yet.</p>
    );
  }

  return (
    <div className="relative pl-4">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-200" />
      <div className="space-y-2">
        {sessions.map((session) => {
          const done = session.status === 'Completed';
          return (
            <div
              key={session.id}
              className="relative rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <span
                className={`absolute -left-[13px] top-3 h-3 w-3 rounded-full border-2 ${
                  done
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'bg-white border-gray-300'
                }`}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-800">
                  Session {session.session_number}
                </span>
                <StatusBadge status={session.status} />
              </div>
              <div className="mt-1 text-[11px] text-gray-500 flex flex-wrap gap-2">
                {session.completed_date && (
                  <span>
                    {format(new Date(session.completed_date), 'dd MMM yyyy')}
                  </span>
                )}
                {session.assessment && (
                  <span className="truncate">{session.assessment}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskChip({ risk }: { risk: string | null }) {
  const normalized = (risk || 'moderate').toLowerCase();
  const styles =
    normalized === 'high'
      ? 'bg-red-100 text-red-700 border-red-300'
      : normalized === 'low'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
        : 'bg-amber-100 text-amber-700 border-amber-300';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold capitalize ${styles}`}
    >
      {normalized} risk
    </span>
  );
}

function PlanCard({ plan }: { plan: SpecialtyCareplan }) {
  const [expanded, setExpanded] = useState(false);
  const [viewPlanModalOpen, setViewPlanModalOpen] = useState(false);
  const [showLabsModal, setShowLabsModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [sessionModalState, setSessionModalState] = useState<{
    session: CareplanSession;
  } | null>(null);

  const { showToast } = useToast();
  const updateStatus = useUpdateNutritionCarePlanStatus();
  const createSession = useCreateNutritionSession();

  const {
    data: sessions = [],
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useNutritionCarePlanSessions(expanded ? plan.id : undefined);

  const patient = (plan as any).patient as
    | {
        first_name?: string;
        surname?: string;
        emr_number?: string;
      }
    | undefined;

  const patientName =
    `${patient?.first_name || ''} ${patient?.surname || ''}`.trim() ||
    'Unknown Patient';
  const baseline = (plan.baseline_data || {}) as Record<string, any>;
  const sourceReferralId = String(
    baseline.source_referral_request_id || baseline.clinical_request_id || '',
  ).trim();
  const { data: linkedReferral } = useClinicalRequest(sourceReferralId, {
    enabled: showReferralModal && !!sourceReferralId,
  });
  const riskLevel = String(baseline.malnutrition_risk || 'moderate');
  const dietType = String(baseline.diet_type || 'not specified').replace(
    /_/g,
    ' ',
  );
  const planStatus = normalizeStatus(plan.status);

  const mealSchedule = baseline.meal_schedule || {};

  async function handleStatusChange(
    status: 'Active' | 'Completed' | 'Cancelled' | 'On_Hold',
  ) {
    try {
      await updateStatus.mutateAsync({ planId: plan.id, status });
      showToast({
        type: 'success',
        title: 'Plan updated',
        message: `Plan marked as ${status.replace('_', ' ')}.`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Update failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not update plan status.',
      });
    }
  }

  async function handleRecordSession() {
    const completedCount = sessions.filter(
      (session) => session.status === 'Completed',
    ).length;
    const nextSessionNumber = completedCount + 1;
    const existingScheduled = sessions.find(
      (session) =>
        session.session_number === nextSessionNumber &&
        session.status === 'Scheduled',
    );

    try {
      const session =
        existingScheduled ||
        (await createSession.mutateAsync({
          careplan_id: plan.id,
          session_number: nextSessionNumber,
          scheduled_date: new Date().toISOString(),
        }));

      setSessionModalState({ session });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Session init failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not initialize a follow-up session.',
      });
    }
  }

  function handleDocumentOpen(autoPrint: boolean = false) {
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) {
      showToast({
        type: 'error',
        title: 'Print Blocked',
        message: 'Please allow popups to open the meal plan document.',
      });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Nutrition Meal Plan - ${patientName}</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #111827; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #84cc16; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { color: #4d7c0f; margin: 0 0 10px 0; font-size: 24px; }
            .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f3f4f6; padding: 20px; border-radius: 8px; }
            .info-item { margin: 0; }
            .info-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; }
            .info-val { font-size: 16px; font-weight: 500; }
            .section { margin-bottom: 30px; }
            .section h2 { font-size: 18px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 15px; }
            .goals-list { list-style-type: none; padding: 0; }
            .goals-list li { position: relative; padding-left: 20px; margin-bottom: 8px; }
            .goals-list li::before { content: "•"; position: absolute; left: 0; color: #84cc16; font-weight: bold; }
            .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
            .metric-card { border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; text-align: center; }
            .metric-val { font-size: 20px; font-weight: bold; color: #4d7c0f; margin-top: 5px; }
            .meal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .meal-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; }
            .meal-label { font-size: 13px; font-weight: bold; color: #475569; margin-bottom: 4px; text-transform: uppercase; }
            .meal-val { font-size: 14px; white-space: pre-wrap; color: #1e293b; }
            .alert-box { padding: 12px; border-radius: 6px; margin-bottom: 15px; }
            .alert-red { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
            .alert-blue { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
            .footer { margin-top: 50px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: right;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #84cc16; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print Document</button>
          </div>

          <div class="header">
            <h1>Nutrition Care Plan</h1>
            <p style="color: #6b7280; margin: 0;">${plan.plan_name}</p>
          </div>

          <div class="patient-info">
            <div class="info-item">
              <div class="info-label">Patient Name</div>
              <div class="info-val">${patientName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Patient number</div>
              <div class="info-val">${patient?.emr_number || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Diet Type</div>
              <div class="info-val" style="text-transform: capitalize;">${dietType}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Date Created</div>
              <div class="info-val">${format(new Date(plan.created_at), 'dd MMM yyyy')}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Duration</div>
              <div class="info-val">${plan.expected_duration || 'Ongoing'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Frequency</div>
              <div class="info-val">${plan.frequency || 'N/A'}</div>
            </div>
          </div>

          <div class="section">
            <h2>Targets & Baselines</h2>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="info-label">Current Weight</div>
                <div class="metric-val">${baseline.current_weight_kg ? baseline.current_weight_kg + ' kg' : '-'}</div>
              </div>
              <div class="metric-card">
                <div class="info-label">Daily Calories</div>
                <div class="metric-val">${baseline.calorie_target_kcal ? baseline.calorie_target_kcal + ' kcal' : '-'}</div>
              </div>
              <div class="metric-card">
                <div class="info-label">Daily Protein</div>
                <div class="metric-val">${baseline.protein_target_g ? baseline.protein_target_g + ' g' : '-'}</div>
              </div>
            </div>
          </div>

          ${(baseline.dietary_restrictions || baseline.supplements) ? `
          <div class="section">
            <h2>Important Needs</h2>
            ${baseline.dietary_restrictions ? `<div class="alert-box alert-red"><strong>Dietary Restrictions:</strong><br/>${baseline.dietary_restrictions}</div>` : ''}
            ${baseline.supplements ? `<div class="alert-box alert-blue"><strong>Supplements:</strong><br/>${baseline.supplements}</div>` : ''}
          </div>
          ` : ''}

          <div class="section">
            <h2>Prescribed Meal Plan</h2>
            <div class="meal-grid">
              ${mealSchedule.breakfast ? `<div class="meal-card"><div class="meal-label">Breakfast</div><div class="meal-val">${mealSchedule.breakfast}</div></div>` : ''}
              ${mealSchedule.mid_morning_snack ? `<div class="meal-card"><div class="meal-label">Morning Snack</div><div class="meal-val">${mealSchedule.mid_morning_snack}</div></div>` : ''}
              ${mealSchedule.lunch ? `<div class="meal-card"><div class="meal-label">Lunch</div><div class="meal-val">${mealSchedule.lunch}</div></div>` : ''}
              ${mealSchedule.evening_snack ? `<div class="meal-card"><div class="meal-label">Afternoon Snack</div><div class="meal-val">${mealSchedule.evening_snack}</div></div>` : ''}
              ${mealSchedule.dinner ? `<div class="meal-card"><div class="meal-label">Dinner</div><div class="meal-val">${mealSchedule.dinner}</div></div>` : ''}
              ${mealSchedule.bedtime_snack ? `<div class="meal-card"><div class="meal-label">Bedtime Snack</div><div class="meal-val">${mealSchedule.bedtime_snack}</div></div>` : ''}
            </div>
            ${Object.values(mealSchedule).every(v => !v) ? '<p style="color: #64748b;">No specific meal plan recorded.</p>' : ''}
          </div>

          ${
            (plan.goals?.length || 0) > 0
              ? `
              <div class="section">
                <h2>Plan Goals (Guidelines)</h2>
                <ul class="goals-list">
                  ${(plan.goals || []).map((g) => `<li>${String(g)}</li>`).join('')}
                </ul>
              </div>
              `
              : ''
          }

          <div class="section">
            <h2>Meal Adjustments & Notes</h2>
            <p style="white-space: pre-wrap;">${baseline.notes ? String(baseline.notes) : 'No specific meal adjustment notes provided.'}</p>
          </div>

          <div class="footer">
            <p>Generated by EMR System on ${format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            <p>This is a generated meal and nutrition care plan summary.</p>
          </div>

          ${autoPrint ? `
          <script>
            // Auto-trigger print dialog after images load if any, but a small delay is safe
            setTimeout(() => { window.print(); }, 500);
          </script>
          ` : ''}
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full text-left px-4 py-4 hover:bg-gray-50"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {patientName}
                </p>
                {patient?.emr_number && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-mono">
                    {patient.emr_number}
                  </span>
                )}
                <StatusBadge status={plan.status} />
                <RiskChip risk={riskLevel} />
              </div>

              <p className="text-xs text-gray-500 mt-1">{plan.plan_name}</p>

              <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                <span className="capitalize">Diet: {dietType}</span>
                {plan.frequency && <span>{plan.frequency}</span>}
                {plan.expected_duration && (
                  <span>{plan.expected_duration}</span>
                )}
              </div>

              <div className="mt-3 max-w-md">
                <ProgressBar
                  sessions={sessions}
                  total={plan.total_sessions || null}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden md:block">
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-xs font-medium text-gray-700">
                  {format(new Date(plan.created_at), 'dd MMM yyyy')}
                </p>
              </div>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </button>

        {expanded && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-gray-500 mb-1">Current Weight</p>
                <p className="font-semibold text-gray-800">
                  {baseline.current_weight_kg
                    ? `${baseline.current_weight_kg} kg`
                    : 'Not set'}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-gray-500 mb-1">Target Calories</p>
                <p className="font-semibold text-gray-800">
                  {baseline.calorie_target_kcal
                    ? `${baseline.calorie_target_kcal} kcal`
                    : 'Not set'}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-gray-500 mb-1">Protein Target</p>
                <p className="font-semibold text-gray-800">
                  {baseline.protein_target_g
                    ? `${baseline.protein_target_g} g`
                    : 'Not set'}
                </p>
              </div>
            </div>

            {Object.values(mealSchedule).some((v) => !!v) && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Prescribed Meal Plan
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 text-sm">
                  {mealSchedule.breakfast && (
                    <div>
                      <p className="font-semibold text-gray-600 mb-1 text-xs uppercase">Breakfast</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{mealSchedule.breakfast}</p>
                    </div>
                  )}
                  {mealSchedule.mid_morning_snack && (
                    <div>
                      <p className="font-semibold text-gray-600 mb-1 text-xs uppercase">Morning Snack</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{mealSchedule.mid_morning_snack}</p>
                    </div>
                  )}
                  {mealSchedule.lunch && (
                    <div>
                      <p className="font-semibold text-gray-600 mb-1 text-xs uppercase">Lunch</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{mealSchedule.lunch}</p>
                    </div>
                  )}
                  {mealSchedule.evening_snack && (
                    <div>
                      <p className="font-semibold text-gray-600 mb-1 text-xs uppercase">Afternoon Snack</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{mealSchedule.evening_snack}</p>
                    </div>
                  )}
                  {mealSchedule.dinner && (
                    <div>
                      <p className="font-semibold text-gray-600 mb-1 text-xs uppercase">Dinner</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{mealSchedule.dinner}</p>
                    </div>
                  )}
                  {mealSchedule.bedtime_snack && (
                    <div>
                      <p className="font-semibold text-gray-600 mb-1 text-xs uppercase">Bedtime Snack</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{mealSchedule.bedtime_snack}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(plan.goals?.length || 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Goals
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(plan.goals || []).map((goal, index) => (
                    <span
                      key={`${plan.id}-goal-${index}`}
                      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300"
                    >
                      <Target className="w-3 h-3 mr-1" />
                      {String(goal)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Sessions
              </p>
              {sessionsLoading ? (
                <p className="text-xs text-gray-400">Loading sessions...</p>
              ) : (
                <SessionTimeline sessions={sessions} />
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {planStatus === 'Active' && (
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleRecordSession}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Record Follow-up
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewPlanModalOpen(true)}
                className="text-gray-700 bg-white"
              >
                <Eye className="w-3.5 h-3.5 mr-1" />
                View Meal Plan
              </Button>

              {sourceReferralId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReferralModal(true)}
                >
                  <Route className="w-3.5 h-3.5 mr-1" />
                  Referral Details
                </Button>
              )}

              {plan.encounter_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLabsModal(true)}
                >
                  <FlaskConical className="w-3.5 h-3.5 mr-1" />
                  Doctor Lab Orders
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDocumentOpen(true)}
                className="text-gray-700 bg-white"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Print Plan
              </Button>

              {planStatus === 'Active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('On_Hold')}
                >
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  On Hold
                </Button>
              )}

              {planStatus === 'On_Hold' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('Active')}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Reactivate
                </Button>
              )}

              {(planStatus === 'Active' || planStatus === 'On_Hold') && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange('Completed')}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Complete Plan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange('Cancelled')}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" />
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
            </p>
          </div>
        )}
      </div>

      {viewPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Leaf className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Prescribed Meal Plan
                  </h2>
                  <p className="text-xs text-gray-500">
                    {patientName}
                    {patient?.emr_number ? ` • ${patient.emr_number}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewPlanModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-gray-50 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wide">Target Calories</span>
                  <div className="text-lg font-semibold text-gray-900 mt-1">
                    {baseline.calorie_target_kcal ? `${baseline.calorie_target_kcal} kcal` : 'Not set'}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wide">Protein Target</span>
                  <div className="text-lg font-semibold text-gray-900 mt-1">
                    {baseline.protein_target_g ? `${baseline.protein_target_g} g` : 'Not set'}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wide">Diet Type</span>
                  <div className="text-lg font-semibold text-gray-900 mt-1 capitalize">
                    {dietType}
                  </div>
                </div>
              </div>

              {(baseline.dietary_restrictions || baseline.supplements) && (
                <div className="space-y-3">
                  {baseline.dietary_restrictions && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-sm">
                      <strong>Dietary Restrictions:</strong><br/>
                      {baseline.dietary_restrictions}
                    </div>
                  )}
                  {baseline.supplements && (
                    <div className="p-3 bg-blue-50 border border-blue-100 text-blue-800 rounded-lg text-sm">
                      <strong>Supplements:</strong><br/>
                      {baseline.supplements}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-semibold text-gray-800">Daily Schedule</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                  <div className="p-4 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Breakfast</h4>
                      <p className="text-gray-900 text-sm whitespace-pre-wrap">{mealSchedule.breakfast || <span className="text-gray-400 italic">No entry</span>}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Morning Snack</h4>
                      <p className="text-gray-900 text-sm whitespace-pre-wrap">{mealSchedule.mid_morning_snack || <span className="text-gray-400 italic">No entry</span>}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Lunch</h4>
                      <p className="text-gray-900 text-sm whitespace-pre-wrap">{mealSchedule.lunch || <span className="text-gray-400 italic">No entry</span>}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Afternoon Snack</h4>
                      <p className="text-gray-900 text-sm whitespace-pre-wrap">{mealSchedule.evening_snack || <span className="text-gray-400 italic">No entry</span>}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Dinner</h4>
                      <p className="text-gray-900 text-sm whitespace-pre-wrap">{mealSchedule.dinner || <span className="text-gray-400 italic">No entry</span>}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Bedtime Snack</h4>
                      <p className="text-gray-900 text-sm whitespace-pre-wrap">{mealSchedule.bedtime_snack || <span className="text-gray-400 italic">No entry</span>}</p>
                    </div>
                  </div>
                </div>
              </div>

              {baseline.notes && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 text-sm">
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-2 block">Meal Adjustments & Notes</span>
                  <p className="text-gray-800 whitespace-pre-wrap">{baseline.notes}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 bg-white shrink-0 flex justify-end gap-3 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => setViewPlanModalOpen(false)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => handleDocumentOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {sessionModalState && (
        <NutritionSessionRecordModal
          careplan={plan}
          session={sessionModalState.session}
          careplanId={plan.id}
          onClose={() => setSessionModalState(null)}
          onCompleted={() => {
            setSessionModalState(null);
            refetchSessions();
          }}
        />
      )}

      {showLabsModal && (
        <Modal
          isOpen
          onClose={() => setShowLabsModal(false)}
          title={`Lab Orders - ${patientName}`}
          size="xl"
        >
          <PatientMedicalRecordsPanel
            patientId={plan.patient_id}
            encounterId={plan.encounter_id || undefined}
            defaultTab="labs"
            showHeader={false}
            maxHeight="70vh"
          />
        </Modal>
      )}

      {showReferralModal && linkedReferral && (
        <ReferralDetailsModal
          referral={linkedReferral}
          isOpen
          onClose={() => setShowReferralModal(false)}
          onStartExam={() => setShowReferralModal(false)}
          specialty="nutrition"
        />
      )}
    </>
  );
}

export default function NutritionCarePlanDashboard({
  onCreatePlan,
  initialSearch = '',
}: NutritionCarePlanDashboardProps) {
  const [search, setSearch] = useState(initialSearch);
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('timeline');

  React.useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setShowCompleted(true); // Automatically show past plans when a direct search is routed
    }
  }, [initialSearch]);

  const {
    data: allPlans = [],
    isLoading,
    refetch,
  } = useAllNutritionCarePlans();

  const hasActiveLikePlan = useMemo(
    () =>
      allPlans.some((plan) =>
        ['Active', 'On_Hold'].includes(normalizeStatus(plan.status)),
      ),
    [allPlans],
  );

  React.useEffect(() => {
    if (showCompleted || allPlans.length === 0) return;
    if (!hasActiveLikePlan) {
      setShowCompleted(true);
    }
  }, [allPlans.length, hasActiveLikePlan, showCompleted]);

  const plansToDisplay = useMemo(() => {
    return allPlans.filter(
      (p) =>
        showCompleted ||
        ['Active', 'On_Hold'].includes(normalizeStatus(p.status)),
    );
  }, [allPlans, showCompleted]);

  const filteredPlans = useMemo(() => {
    if (!search.trim()) return plansToDisplay;

    const query = search.toLowerCase();
    return plansToDisplay.filter((plan) => {
      const patient = (plan as any).patient as
        | { first_name?: string; surname?: string; emr_number?: string }
        | undefined;

      const patientName =
        `${patient?.first_name || ''} ${patient?.surname || ''}`.toLowerCase();
      const emrNumber = String(patient?.emr_number || '').toLowerCase();
      const planName = plan.plan_name.toLowerCase();

      return (
        patientName.includes(query) ||
        emrNumber.includes(query) ||
        planName.includes(query)
      );
    });
  }, [plansToDisplay, search]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-500 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Nutrition Care Plans
              </h3>
              <p className="text-xs text-white/80 mt-0.5">
                Meal plans, targets, and longitudinal follow-up sessions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCreatePlan && (
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={onCreatePlan}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                New Plan
              </Button>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col md:flex-row gap-3 items-center">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by patient or plan"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-white/20 bg-white/10 text-sm text-white placeholder-white/60 focus:ring-2 focus:ring-white/40"
            />
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg bg-white/10 border border-white/20 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-white text-emerald-700'
                    : 'text-white/90 hover:text-white'
                }`}
              >
                <Route className="w-3.5 h-3.5" />
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white text-emerald-700'
                    : 'text-white/90 hover:text-white'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                Cards
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-white/90 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded border-white/30 text-emerald-600 bg-white/10 focus:ring-emerald-500 focus:ring-offset-emerald-700"
              />
              Show completed plans
            </label>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 rounded-xl bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">
            {search
              ? 'No care plans match this search'
              : showCompleted
                ? 'No nutrition care plans available'
                : 'No active nutrition care plans'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Create a meal plan from queue/referral entries or start a new plan.
          </p>
          {onCreatePlan && (
            <div className="mt-4">
              <Button
                variant="primary"
                size="sm"
                onClick={onCreatePlan}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create Nutrition Plan
              </Button>
            </div>
          )}
        </div>
      ) : (
        viewMode === 'timeline' ? (
          <div className="relative pl-6 space-y-3">
            <div className="absolute left-[10px] top-2 bottom-2 w-px bg-gray-200" />
            {filteredPlans.map((plan) => (
              <div key={plan.id} className="relative">
                <span className="absolute -left-[20px] top-6 h-3.5 w-3.5 rounded-full border-2 border-emerald-500 bg-white" />
                <PlanCard plan={plan} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )
      )}

      {!isLoading && plansToDisplay.length > 0 && (
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Showing {filteredPlans.length} of {plansToDisplay.length}{' '}
          {showCompleted ? 'total' : 'active'} plans.
        </div>
      )}
    </div>
  );
}
