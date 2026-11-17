// =============================================================================
// Radiologist Dashboard Section
// Focused radiology workspace: Queue, Reporting, Imaging Pipeline
// =============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ClipboardList,
  Clock,
  CheckCircle2,
  FileText,
  Image,
  Scan,
  Timer,
  CalendarClock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useRadiologyStats,
  useRadiologyRequests,
} from '../../modules/radiology/hooks/useRadiology';
import { SkeletonList } from '../ui/SkeletonLoader';

// ─── Component ───────────────────────────────────────────────────────────────

export default function RadiologistDashboardSection() {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isRadiologist = staff?.role === 'radiologist';

  const { data: radStats, isLoading: statsLoading } = useRadiologyStats();

  // Requests awaiting report (radiologist's primary workload)
  const { data: awaitingReport, isLoading: awaitingLoading } =
    useRadiologyRequests({ status: 'Awaiting Report', limit: 5 });

  // Requests currently being imaged
  const { data: inProgressReqs, isLoading: inProgressLoading } =
    useRadiologyRequests({ status: 'In Progress', limit: 5 });

  if (!isRadiologist) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Ordered':
        return 'bg-amber-50 text-amber-700';
      case 'Scheduled':
        return 'bg-blue-50 text-blue-700';
      case 'In Progress':
        return 'bg-indigo-50 text-indigo-700';
      case 'Imaging Completed':
      case 'Awaiting Report':
        return 'bg-cyan-50 text-cyan-700';
      case 'Preliminary Report':
        return 'bg-violet-50 text-violet-700';
      case 'Final Report':
      case 'Completed':
      case 'Reported':
        return 'bg-emerald-50 text-emerald-700';
      default:
        return 'bg-slate-50 text-slate-600';
    }
  };

  const formatTimeAgo = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  // Quick actions
  const quickActions = [
    {
      label: 'Radiology Queue',
      icon: Scan,
      path: '/radiology',
      color: 'from-indigo-500 to-indigo-600',
      description: 'All requests',
    },
    {
      label: 'Awaiting Report',
      icon: FileText,
      path: '/radiology',
      color: 'from-cyan-500 to-cyan-600',
      description: 'Need reporting',
      count: radStats?.awaiting_report,
    },
    {
      label: 'In Progress',
      icon: Image,
      path: '/radiology',
      color: 'from-violet-500 to-violet-600',
      description: 'Being imaged',
      count: radStats?.in_progress,
    },
    {
      label: 'Reported Today',
      icon: CheckCircle2,
      path: '/radiology',
      color: 'from-emerald-500 to-emerald-600',
      description: 'Completed today',
      count: radStats?.reported_today,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Radiology Stats Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* Ordered / Pending */}
        <button
          onClick={() => navigate('/radiology')}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col text-left hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <ClipboardList size={16} className="text-amber-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Ordered
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (radStats?.ordered ?? 0)}
          </p>
        </button>

        {/* Scheduled */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarClock size={16} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Scheduled
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (radStats?.scheduled ?? 0)}
          </p>
        </div>

        {/* In Progress */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Image size={16} className="text-indigo-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Imaging
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (radStats?.in_progress ?? 0)}
          </p>
        </div>

        {/* Imaging Completed */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-teal-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Imaged
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (radStats?.imaging_completed ?? 0)}
          </p>
        </div>

        {/* Awaiting Report */}
        <button
          onClick={() => navigate('/radiology')}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col text-left hover:border-cyan-300 transition-colors"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
              <FileText size={16} className="text-cyan-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Awaiting
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (radStats?.awaiting_report ?? 0)}
          </p>
        </button>

        {/* Preliminary Report */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Timer size={16} className="text-violet-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Prelim
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (radStats?.preliminary_report ?? 0)}
          </p>
        </div>

        {/* Final Report */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Scan size={16} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Final
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (radStats?.final_report ?? 0)}
          </p>
        </div>

        {/* Reported Today */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-green-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Today
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (radStats?.reported_today ?? 0)}
          </p>
        </div>
      </div>

      {/* ─── Quick Actions ────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              {(action.count ?? 0) > 0 && (
                <span className="mt-1.5 text-[10px] font-black tracking-widest bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md leading-none">
                  {action.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Two-Column: Awaiting Report + In Progress ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Awaiting Report */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-cyan-600" />
              <h3 className="font-bold text-slate-800 text-sm">
                Awaiting Report
              </h3>
              {radStats && radStats.awaiting_report > 0 && (
                <span className="bg-cyan-100 text-cyan-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {radStats.awaiting_report}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/radiology')}
              className="text-xs font-bold text-[#11151C] hover:underline flex items-center gap-1"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
            {awaitingLoading ? (
              <div className="p-4">
                <SkeletonList count={4} />
              </div>
            ) : awaitingReport && awaitingReport.data.length > 0 ? (
              awaitingReport.data.map((req) => (
                <div
                  key={req.request_id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/radiology')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center text-white shrink-0">
                      <Scan size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {req.imaging?.imaging_name ||
                          req.imaging_type ||
                          'Imaging'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 truncate">
                          {req.patient
                            ? `${req.patient.first_name} ${req.patient.surname}`
                            : 'Unknown'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock size={10} />
                          {formatTimeAgo(
                            req.performed_at ||
                              req.request_date ||
                              req.created_at,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {req.priority === 'Urgent' && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700">
                        Urgent
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${getStatusColor(req.status)}`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <FileText size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">
                  No scans awaiting report
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Completed imaging will appear here for reporting
                </p>
              </div>
            )}
          </div>
        </div>

        {/* In Progress / Currently Imaging */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Image size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">
                Currently Imaging
              </h3>
              {radStats && radStats.in_progress > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {radStats.in_progress}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/radiology')}
              className="text-xs font-bold text-[#11151C] hover:underline flex items-center gap-1"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
            {inProgressLoading ? (
              <div className="p-4">
                <SkeletonList count={3} />
              </div>
            ) : inProgressReqs && inProgressReqs.data.length > 0 ? (
              inProgressReqs.data.map((req) => (
                <div
                  key={req.request_id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/radiology')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center text-white shrink-0">
                      <Image size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {req.imaging?.imaging_name ||
                          req.imaging_type ||
                          'Imaging'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 truncate">
                          {req.patient
                            ? `${req.patient.first_name} ${req.patient.surname}`
                            : 'Unknown'}
                        </span>
                        {req.body_part && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-[10px] text-slate-400">
                              {req.body_part}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {req.priority === 'Urgent' && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700">
                        Urgent
                      </span>
                    )}
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      Imaging
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <Image size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">
                  No imaging in progress
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Active scans will appear here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Radiology Pipeline Summary ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">
          Radiology queue
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Ordered / Pending',
              value: radStats?.ordered ?? 0,
              color: '#f59e0b',
            },
            {
              label: 'Scheduled',
              value: radStats?.scheduled ?? 0,
              color: '#3b82f6',
            },
            {
              label: 'Being Imaged',
              value: radStats?.in_progress ?? 0,
              color: '#6366f1',
            },
            {
              label: 'Imaging Done',
              value: radStats?.imaging_completed ?? 0,
              color: '#14b8a6',
            },
            {
              label: 'Awaiting Report',
              value: radStats?.awaiting_report ?? 0,
              color: '#06b6d4',
            },
            {
              label: 'Preliminary Report',
              value: radStats?.preliminary_report ?? 0,
              color: '#8b5cf6',
            },
            {
              label: 'Final Report',
              value: radStats?.final_report ?? 0,
              color: '#10b981',
            },
            {
              label: 'Reported Today',
              value: radStats?.reported_today ?? 0,
              color: '#22c55e',
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-slate-50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  {row.label}
                </span>
              </div>
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
