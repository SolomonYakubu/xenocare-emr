// =============================================================================
// Billing Clerk Dashboard Section
// Focused billing workspace: Revenue KPIs, Payment Queue, Quick Actions
// =============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Banknote,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isNhisFeatureEnabled } from '../../config/features';
import { useBillingStats } from '../../modules/billing/hooks/useBilling';
import {
  useBillingOrderStats,
  useBillingQueue,
} from '../../modules/billing/hooks/useBillingOrders';
import { SkeletonList } from '../ui/SkeletonLoader';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatTimeAgo = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function BillingClerkDashboardSection() {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const isBillingClerk = staff?.role === 'billing_clerk';

  const { data: billingStats, isLoading: statsLoading } = useBillingStats();
  const { data: orderStats, isLoading: orderStatsLoading } =
    useBillingOrderStats();
  const { data: billingQueue, isLoading: queueLoading } = useBillingQueue();

  if (!isBillingClerk) return null;

  // Quick actions for billing clerk
  const quickActions = [
    {
      label: 'Payment Queue',
      icon: CreditCard,
      path: '/billing',
      color: 'from-teal-500 to-teal-600',
      description: 'Verify payments',
      count: orderStats?.pending_count,
    },
    {
      label: 'Invoices',
      icon: Receipt,
      path: '/billing',
      color: 'from-blue-500 to-blue-600',
      description: 'All invoices',
      count: billingStats?.invoices_today,
    },
    {
      label: 'Receipts',
      icon: Banknote,
      path: '/billing',
      color: 'from-emerald-500 to-emerald-600',
      description: 'View receipts',
    },
    {
      label: 'Registration',
      icon: Users,
      path: '/registration',
      color: 'from-indigo-500 to-indigo-600',
      description: 'Patient lookup',
    },
  ];

  // Top queue items (up to 6)
  const topQueue = billingQueue?.slice(0, 6) ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Revenue KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* Invoiced Today */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Receipt size={16} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Invoiced
            </span>
          </div>
          <p className="text-lg font-bold text-slate-800">
            {statsLoading
              ? '—'
              : formatCurrency(billingStats?.invoiced_today ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Today</p>
        </div>

        {/* Collected Today */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Collected
            </span>
          </div>
          <p className="text-lg font-bold text-slate-800">
            {statsLoading
              ? '—'
              : formatCurrency(billingStats?.payments_today ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Today</p>
        </div>

        {/* Pending Queue */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock size={16} className="text-amber-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Pending
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {orderStatsLoading ? '—' : (orderStats?.pending_count ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Orders</p>
        </div>

        {/* Pending Amount */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <DollarSign size={16} className="text-orange-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Pending ₦
            </span>
          </div>
          <p className="text-lg font-bold text-slate-800">
            {orderStatsLoading
              ? '—'
              : formatCurrency(orderStats?.pending_amount ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Unpaid</p>
        </div>

        {/* Paid Today Count */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Banknote size={16} className="text-green-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Verified
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {orderStatsLoading ? '—' : (orderStats?.paid_today_count ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Today</p>
        </div>

        {/* Paid Today Amount */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-teal-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Paid ₦
            </span>
          </div>
          <p className="text-lg font-bold text-slate-800">
            {orderStatsLoading
              ? '—'
              : formatCurrency(orderStats?.paid_today_amount ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Today</p>
        </div>

        {/* Outstanding */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              O/S
            </span>
          </div>
          <p className="text-lg font-bold text-slate-800">
            {statsLoading
              ? '—'
              : formatCurrency(billingStats?.outstanding ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Outstanding</p>
        </div>

        {/* Overdue */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-rose-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Overdue
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {statsLoading ? '—' : (billingStats?.overdue_invoices ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Invoices</p>
        </div>
      </div>

      {/* ─── Payment Method Breakdown ──────────────────────────────────── */}
      {orderStats?.by_payment_method &&
        orderStats.by_payment_method.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              Today's Collections by Method
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {orderStats.by_payment_method.map((pm) => (
                <div
                  key={pm.method}
                  className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                    <CreditCard size={14} className="text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">
                      {pm.method}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {pm.count} txns · {formatCurrency(pm.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* ─── Quick Actions ────────────────────────────────────────────── */}
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

      {/* ─── Payment Queue ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-teal-600" />
            <h3 className="font-bold text-slate-800 text-sm">Payment Queue</h3>
            {orderStats && orderStats.pending_count > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                {orderStats.pending_count}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/billing')}
            className="text-xs font-bold text-[#11151C] hover:underline flex items-center gap-1"
          >
            View All <ChevronRight size={14} />
          </button>
        </div>

        <div className="divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
          {queueLoading ? (
            <div className="p-4">
              <SkeletonList count={5} />
            </div>
          ) : topQueue.length > 0 ? (
            topQueue.map((item) => (
              <div
                key={`${item.patient_id}-${item.visit_id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => navigate('/billing')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white shrink-0 text-xs font-bold">
                    {item.patient?.first_name?.[0]}
                    {item.patient?.surname?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {item.patient
                        ? `${item.patient.first_name} ${item.patient.surname}`
                        : 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">
                        {item.pending_count} pending order
                        {item.pending_count !== 1 ? 's' : ''}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        {formatTimeAgo(item.visit?.start_time)}
                      </span>
                      {isNhisFeatureEnabled() && item.is_nhis && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                            NHIS
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">
                      {formatCurrency(item.total_balance)}
                    </p>
                    <p className="text-[10px] text-slate-400">Balance</p>
                  </div>
                  {item.visit?.priority === 'Emergency' && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700">
                      Urgent
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center">
              <CheckCircle2 size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">
                No pending payments
              </p>
              <p className="text-xs text-slate-400 mt-1">
                All billing orders have been processed
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Revenue by Department ────────────────────────────────────── */}
      {orderStats?.by_source_module &&
        orderStats.by_source_module.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              Revenue by Department
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {orderStats.by_source_module.map((dept) => (
                <div
                  key={dept.module}
                  className="bg-slate-50 rounded-xl px-4 py-3"
                >
                  <p className="text-xs font-bold text-slate-700 capitalize">
                    {dept.module}
                  </p>
                  <p className="text-lg font-bold text-slate-800 mt-1">
                    {formatCurrency(dept.amount)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {dept.count} order{dept.count !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
