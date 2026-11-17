// =============================================================================
// Lab Technician Dashboard Section
// Focused lab workspace: Pending Orders, Processing, Results, Quick Actions
// =============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  ClipboardList,
  CheckCircle2,
  FlaskConical,
  Microscope,
  TestTubes,
  Timer,
  Beaker,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLabStats, useLabRequests } from '../../modules/lab/hooks/useLab';
import { SkeletonList } from '../ui/SkeletonLoader';

// ─── Component ───────────────────────────────────────────────────────────────

export default function LabTechDashboardSection() {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isLabTech = staff?.role === 'lab_technician';

  const { data: labStats, isLoading: statsLoading } = useLabStats();

  // Fetch active lab requests (not completed) for queue preview
  const { data: pendingRequests, isLoading: pendingLoading } = useLabRequests({
    status: 'Pending',
    limit: 5,
  });
  const { data: processingRequests, isLoading: processingLoading } =
    useLabRequests({ status: 'In Progress', limit: 5 });

  if (!isLabTech) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-50 text-amber-700';
      case 'Accepted':
        return 'bg-blue-50 text-blue-700';
      case 'Sample Collected':
      case 'Sample_Collected':
        return 'bg-cyan-50 text-cyan-700';
      case 'In Progress':
      case 'Processing':
        return 'bg-indigo-50 text-indigo-700';
      case 'Result_Ready':
        return 'bg-emerald-50 text-emerald-700';
      default:
        return 'bg-slate-50 text-slate-600';
    }
  };

  const getPriorityColor = (priority: string | undefined) => {
    if (priority?.toLowerCase() === 'urgent') return 'bg-red-100 text-red-700';
    return '';
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  // Quick actions relevant to lab
  const quickActions = [
    {
      label: 'Lab Queue',
      icon: FlaskConical,
      path: '/lab',
      color: 'from-yellow-500 to-yellow-600',
      description: 'All requests',
    },
    {
      label: 'Pending',
      icon: ClipboardList,
      path: '/lab',
      color: 'from-amber-500 to-amber-600',
      description: 'Awaiting action',
      count: labStats?.pending,
    },
    {
      label: 'Processing',
      icon: Beaker,
      path: '/lab',
      color: 'from-indigo-500 to-indigo-600',
      description: 'In progress',
      count: labStats?.processing,
    },
    {
      label: 'Results',
      icon: CheckCircle2,
      path: '/lab',
      color: 'from-emerald-500 to-emerald-600',
      description: 'Completed today',
      count: labStats?.completed_today,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Lab Stats Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Pending */}
        <button
          onClick={() => navigate('/lab')}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col text-left hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <ClipboardList size={16} className="text-amber-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Pending
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (labStats?.pending ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Awaiting action
          </p>
        </button>

        {/* Sample Collected */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
              <TestTubes size={16} className="text-cyan-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Samples
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (labStats?.sample_collected ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Collected
          </p>
        </div>

        {/* Processing */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Beaker size={16} className="text-indigo-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Processing
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (labStats?.processing ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            In progress
          </p>
        </div>

        {/* Result Ready */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Ready
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (labStats?.result_ready ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Results ready
          </p>
        </div>

        {/* Completed Today */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Microscope size={16} className="text-green-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Done
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (labStats?.completed_today ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Completed today
          </p>
        </div>

        {/* Avg Turnaround */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
              <Timer size={16} className="text-slate-500" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              TAT
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (labStats?.average_turnaround ?? '—')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Avg turnaround
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

      {/* ─── Two-Column: Pending Orders + Processing ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pending Lab Orders */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardList size={18} className="text-amber-600" />
              <h3 className="font-bold text-slate-800 text-sm">
                Pending Orders
              </h3>
              {labStats && labStats.pending > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {labStats.pending}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/lab')}
              className="text-xs font-bold text-[#11151C] hover:underline flex items-center gap-1"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
            {pendingLoading ? (
              <div className="p-4">
                <SkeletonList count={4} />
              </div>
            ) : pendingRequests && pendingRequests.data.length > 0 ? (
              pendingRequests.data.map((req) => (
                <div
                  key={req.request_id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/lab')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white shrink-0">
                      <FlaskConical size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {req.test?.test_name || 'Lab Test'}
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
                          {formatTimeAgo(req.request_date || req.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {req.priority === 'Urgent' && (
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${getPriorityColor(req.priority)}`}
                      >
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
                <ClipboardList
                  size={32}
                  className="text-slate-200 mx-auto mb-3"
                />
                <p className="text-sm font-medium text-slate-500">
                  No pending orders
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  New lab requests will appear here
                </p>
              </div>
            )}
          </div>
        </div>

        {/* In Progress / Processing */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Beaker size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm">
                Currently Processing
              </h3>
              {labStats && labStats.processing > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {labStats.processing}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/lab')}
              className="text-xs font-bold text-[#11151C] hover:underline flex items-center gap-1"
            >
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
            {processingLoading ? (
              <div className="p-4">
                <SkeletonList count={3} />
              </div>
            ) : processingRequests && processingRequests.data.length > 0 ? (
              processingRequests.data.map((req) => (
                <div
                  key={req.request_id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/lab')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center text-white shrink-0">
                      <Beaker size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {req.test?.test_name || 'Lab Test'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 truncate">
                          {req.patient
                            ? `${req.patient.first_name} ${req.patient.surname}`
                            : 'Unknown'}
                        </span>
                        {req.technician && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-[10px] text-slate-400">
                              By: {req.technician.first_name}
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
                      Processing
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <Beaker size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">
                  Nothing in progress
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Samples being processed will appear here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Lab Pipeline Summary ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">
          Lab queue
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Pending Requests',
              value: labStats?.pending ?? 0,
              color: '#f59e0b',
            },
            {
              label: 'Samples Collected',
              value: labStats?.sample_collected ?? 0,
              color: '#06b6d4',
            },
            {
              label: 'Being Processed',
              value: labStats?.processing ?? 0,
              color: '#6366f1',
            },
            {
              label: 'Results Ready',
              value: labStats?.result_ready ?? 0,
              color: '#10b981',
            },
            {
              label: 'Completed Today',
              value: labStats?.completed_today ?? 0,
              color: '#22c55e',
            },
            {
              label: 'Rejected Today',
              value: labStats?.rejected_today ?? 0,
              color: '#ef4444',
            },
            {
              label: 'Avg Turnaround',
              value: labStats?.average_turnaround ?? '—',
              color: '#64748b',
            },
            {
              label: 'Accepted',
              value: labStats?.accepted ?? 0,
              color: '#3b82f6',
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
