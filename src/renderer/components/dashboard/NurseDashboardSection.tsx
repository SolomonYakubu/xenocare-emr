// =============================================================================
// Nurse-Specific Dashboard Section
// Focused nursing workspace: Queue, Vitals, Critical Alerts, Quick Actions
// =============================================================================

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bed,
  ChevronRight,
  ClipboardList,
  Clock,
  Heart,
  Siren,
  Thermometer,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isEmergencyFeatureEnabled } from '../../config/features';
import { useEncounterStats } from '../../lib/workflow';
import {
  useNursingStatsNew,
  useNursingQueue,
  useCriticalVitals,
} from '../../modules/nursing/hooks/useNursing';
import { SkeletonList } from '../ui/SkeletonLoader';

// ─── Component ───────────────────────────────────────────────────────────────

export default function NurseDashboardSection() {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isNurse = staff?.role === 'nurse';

  const { data: nursingStats, isLoading: statsLoading } = useNursingStatsNew();
  const { data: queuePatients, isLoading: queueLoading } = useNursingQueue();
  const { data: criticalVitals, isLoading: criticalLoading } =
    useCriticalVitals();
  const { data: encounterStats } = useEncounterStats();

  // Only waiting/in-progress patients for the queue preview
  const activeQueue = useMemo(() => {
    if (!queuePatients) return [];
    return queuePatients
      .filter((p) => p.status === 'Waiting' || p.status === 'In Progress')
      .slice(0, 8);
  }, [queuePatients]);

  if (!isNurse) return null;

  // ─── Quick Actions ─────────────────────────────────────────────────────────
  const quickActions = [
    {
      label: 'Nursing Queue',
      icon: ClipboardList,
      path: '/nursing',
      color: 'from-pink-500 to-pink-600',
      description: 'Triage & vitals',
    },
    {
      label: 'In-Patient',
      icon: Bed,
      path: '/in-patient',
      color: 'from-violet-500 to-violet-600',
      description: 'Bed management',
    },
    {
      label: 'A&E',
      icon: Siren,
      path: '/ae',
      color: 'from-red-500 to-red-600',
      description: 'Emergency dept',
    },
    {
      label: 'Patients',
      icon: Users,
      path: '/patients',
      color: 'from-blue-500 to-blue-600',
      description: 'Patient records',
    },
    {
      label: 'Encounters',
      icon: Activity,
      path: '/encounters',
      color: 'from-teal-500 to-teal-600',
      description: 'Active encounters',
    },
    {
      label: 'ANC',
      icon: Heart,
      path: '/anc',
      color: 'from-rose-400 to-rose-500',
      description: 'Antenatal care',
    },
  ].filter(
    (action) => isEmergencyFeatureEnabled() || action.path !== '/ae',
  );

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'emergency':
        return 'bg-red-100 text-red-700';
      case 'urgent':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Waiting':
        return 'bg-amber-50 text-amber-700';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700';
      case 'Called':
        return 'bg-cyan-50 text-cyan-700';
      default:
        return 'bg-slate-50 text-slate-600';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Nursing Stats Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* Waiting in Queue */}
        <button
          onClick={() => navigate('/nursing')}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col text-left hover:border-pink-300 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
              <Users size={16} className="text-pink-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Queue
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (nursingStats?.waitingQueue ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Patients waiting
          </p>
        </button>

        {/* In Progress */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <UserCheck size={16} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Serving
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (nursingStats?.inProgressQueue ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Being attended
          </p>
        </div>

        {/* Vitals Recorded Today */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Thermometer size={16} className="text-teal-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Vitals
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (nursingStats?.todayVitals ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Recorded today
          </p>
        </div>

        {/* Critical Alerts */}
        <button
          onClick={() => navigate('/nursing')}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col text-left hover:border-red-300 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Critical
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (nursingStats?.criticalVitals ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Alerts today
          </p>
        </button>

        {/* Completed Today */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Activity size={16} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Done
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (nursingStats?.completedToday ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Completed today
          </p>
        </div>
      </div>

      {/* ─── Quick Actions ────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex flex-col items-center justify-center py-4 px-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 bg-gradient-to-br ${action.color} text-white shadow-sm`}
              >
                <action.icon size={18} />
              </div>
              <span className="font-bold text-slate-700 text-xs">
                {action.label}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {action.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Two-Column: Queue + Critical Alerts ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Nursing Queue */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-pink-600" />
              <h3 className="font-bold text-slate-800 text-sm">
                Nursing Queue
              </h3>
              {nursingStats && nursingStats.waitingQueue > 0 && (
                <span className="bg-pink-100 text-pink-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {nursingStats.waitingQueue} waiting
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/nursing')}
              className="text-xs font-bold text-[#11151C] hover:underline flex items-center gap-1"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
            {queueLoading ? (
              <div className="p-4">
                <SkeletonList count={4} />
              </div>
            ) : activeQueue.length > 0 ? (
              activeQueue.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/nursing')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-pink-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {patient.ticket_number}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {patient.patient?.first_name} {patient.patient?.surname}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400">
                          {patient.visit?.visit_type || 'Visit'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock size={10} />
                          {formatTimeAgo(patient.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {patient.priority !== 'Normal' && (
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${getPriorityColor(patient.priority)}`}
                      >
                        {patient.priority}
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${getStatusColor(patient.status)}`}
                    >
                      {patient.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <ClipboardList
                  size={32}
                  className="text-slate-200 mx-auto mb-3"
                />
                <p className="text-sm font-medium text-slate-500">
                  No patients in queue
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  New patients will appear here after registration
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Critical Vitals Alerts */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              <h3 className="font-bold text-slate-800 text-sm">
                Critical Vitals Alerts
              </h3>
              {criticalVitals && criticalVitals.length > 0 && (
                <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {criticalVitals.length}
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
            {criticalLoading ? (
              <div className="p-4">
                <SkeletonList count={3} />
              </div>
            ) : criticalVitals && criticalVitals.length > 0 ? (
              criticalVitals.slice(0, 8).map((vital) => (
                <div
                  key={vital.vitals_id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-red-50/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {vital.patient
                        ? `${vital.patient.first_name} ${vital.patient.surname}`
                        : 'Unknown Patient'}
                    </p>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1">
                      {vital.temperature != null && (
                        <span className="text-[10px] text-slate-500">
                          Temp:{' '}
                          <strong className="text-red-600">
                            {vital.temperature}°C
                          </strong>
                        </span>
                      )}
                      {vital.blood_pressure_systolic != null && (
                        <span className="text-[10px] text-slate-500">
                          BP:{' '}
                          <strong className="text-red-600">
                            {vital.blood_pressure_systolic}/
                            {vital.blood_pressure_diastolic}
                          </strong>
                        </span>
                      )}
                      {vital.pulse != null && (
                        <span className="text-[10px] text-slate-500">
                          Pulse:{' '}
                          <strong className="text-red-600">
                            {vital.pulse}
                          </strong>
                        </span>
                      )}
                      {vital.oxygen_saturation != null && (
                        <span className="text-[10px] text-slate-500">
                          SpO2:{' '}
                          <strong className="text-red-600">
                            {vital.oxygen_saturation}%
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-2">
                    <span className="bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                      Critical
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {formatTimeAgo(vital.date_recorded)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <Heart size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">
                  No critical alerts
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  All patient vitals are within normal range
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Nursing Activity Summary ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">
          Today's Nursing Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
          {[
            {
              label: 'Patients in triage',
              value: encounterStats?.triage_queue ?? 0,
            },
            {
              label: 'Vitals recorded today',
              value: nursingStats?.todayVitals ?? 0,
            },
            {
              label: 'Critical vitals today',
              value: nursingStats?.criticalVitals ?? 0,
            },
            {
              label: 'Queue completed today',
              value: nursingStats?.completedToday ?? 0,
            },
            {
              label: 'Patients currently admitted',
              value: encounterStats?.admitted ?? 0,
            },
            {
              label: 'Beds occupied / total',
              value: `${encounterStats?.occupied_beds ?? 0} / ${encounterStats?.total_beds ?? 0}`,
            },
            {
              label: 'Avg wait (check-in to consult)',
              value: `${encounterStats?.consultation_average_wait_minutes ?? 0} min`,
            },
            {
              label: 'Total patients today',
              value: encounterStats?.total_today ?? 0,
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-3 rounded-lg transition-colors"
            >
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                {row.label}
              </span>
              <span className="text-sm font-black text-slate-800 ml-2 whitespace-nowrap">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
