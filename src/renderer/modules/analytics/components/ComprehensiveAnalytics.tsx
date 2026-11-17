// =============================================================================
// XENOCARE EMR - Comprehensive Analytics Dashboard
// Professional analytics with REAL database data
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  Activity,
  DollarSign,
  Users,
  Stethoscope,
  Pill,
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  RefreshCw,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bed,
  PieChart,
} from 'lucide-react';

// Chart components
import {
  Bar3DChart,
  Pie3DChart,
  Area3DChart,
  KPICard,
  CompactListChart,
  TimeFrameSelector,
  formatCurrency,
  formatNumber,
  chartColors,
} from './AdvancedCharts';

// Hooks - All with REAL database data
import {
  useDashboardStats,
  useTopDiagnoses,
  useTopLabTests,
  useTopMedications,
  // Financial
  useDebtAging,
  useGrossNetRevenue,
  useCollectionEfficiency,
  useRevenueByServiceType,
  useMonthlyRevenueTrends,
  useRevenueByPaymentMethodRange,
  // Clinical
  useALOS,
  useBOR,
  usePatientVolume,
  useDoctorProductivity,
  useMonthlyPatientTrends,
  useQueueDistribution,
  // Pharmacy
  useDrugFinancials,
  useExpiryTracking,
  useTopDrugsByRevenue,
  useLowStockItems,
  useStockStatusSummary,
  // Lab
  useLabRevenue,
  useLabTAT,
  useAbnormalResults,
  useLabTestVolume,
  useLabWorkload,
} from '../hooks/useAnalytics';

// =============================================================================
// Helper Functions
// =============================================================================

function getDateFilters(timeFrame: string) {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  let startDate: string;

  switch (timeFrame) {
    case 'today':
      startDate = endDate;
      break;
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = yesterday.toISOString().split('T')[0];
      break;
    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
      break;
    case 'month':
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      startDate = monthAgo.toISOString().split('T')[0];
      break;
    case 'quarter':
      const quarterAgo = new Date(today);
      quarterAgo.setMonth(quarterAgo.getMonth() - 3);
      startDate = quarterAgo.toISOString().split('T')[0];
      break;
    case 'year':
      const yearAgo = new Date(today);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      startDate = yearAgo.toISOString().split('T')[0];
      break;
    default:
      startDate = new Date(today.setDate(today.getDate() - 30))
        .toISOString()
        .split('T')[0];
  }

  return { startDate, endDate };
}

function formatServiceLabel(service: string): string {
  const labels: Record<string, string> = {
    consultation: 'Consultation',
    laboratory: 'Laboratory',
    radiology: 'Radiology',
    pharmacy: 'Pharmacy',
    nursing: 'Nursing',
    procedure: 'Procedures',
    admission: 'Admission',
    surgery: 'Surgery',
    other: 'Other',
  };
  return labels[service?.toLowerCase()] || service || 'Other';
}

function getPaymentMethodColor(method: string): string {
  const colors: Record<string, string> = {
    Cash: chartColors.financial.cash,
    cash: chartColors.financial.cash,
    NHIS: chartColors.financial.nhis,
    nhis: chartColors.financial.nhis,
    POS: chartColors.financial.pos,
    pos: chartColors.financial.pos,
    Transfer: chartColors.financial.transfer,
    transfer: chartColors.financial.transfer,
    Bank_Transfer: chartColors.financial.transfer,
    Retainership: chartColors.financial.retainership,
    retainership: chartColors.financial.retainership,
    Insurance: chartColors.financial.insurance,
    insurance: chartColors.financial.insurance,
    Corporate: chartColors.financial.corporate,
    corporate: chartColors.financial.corporate,
  };
  return colors[method] || chartColors.primary[0];
}

// =============================================================================
// Simple Stat Card (for string values)
// =============================================================================

interface SimpleStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?:
    | 'blue'
    | 'green'
    | 'purple'
    | 'yellow'
    | 'red'
    | 'cyan'
    | 'pink'
    | 'indigo';
  subtitle?: string;
  trend?: { value: number; label: string };
}

function SimpleStatCard({
  title,
  value,
  icon,
  color = 'blue',
  subtitle,
  trend,
}: SimpleStatCardProps) {

  return (
    <div className="min-h-[104px] rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      {trend && (
        <p className="mt-1 text-xs font-medium text-slate-500">
          {trend.value} {trend.label}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

type ViewMode =
  | 'overview'
  | 'clinical'
  | 'financial'
  | 'operations'
  | 'pharmacy'
  | 'laboratory';

export default function ComprehensiveAnalytics() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [timeFrame, setTimeFrame] = useState('month');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filters = useMemo(() => getDateFilters(timeFrame), [timeFrame]);
  const currentYear = new Date().getFullYear();

  // Core stats
  const {
    data: dashboardStats,
    refetch: refetchDashboard,
    isLoading: loadingDashboard,
  } = useDashboardStats();

  // Top lists
  const { data: topDiagnoses } = useTopDiagnoses(8);
  const { data: topLabTests } = useTopLabTests(8);
  const { data: topMedications } = useTopMedications(8);

  // Financial
  const { data: debtAging } = useDebtAging();
  const { data: grossNet } = useGrossNetRevenue(filters);
  const { data: collectionEfficiency } = useCollectionEfficiency(filters);
  const { data: revenueByService } = useRevenueByServiceType(filters);
  const { data: monthlyRevenue } = useMonthlyRevenueTrends(currentYear);
  const { data: revenueByPayment } = useRevenueByPaymentMethodRange(filters);

  // Clinical
  const { data: alos } = useALOS(filters);
  const { data: bor } = useBOR();
  const { data: patientVolume } = usePatientVolume(filters);
  const { data: doctorProductivity } = useDoctorProductivity(filters);
  const { data: monthlyPatients } = useMonthlyPatientTrends(currentYear);
  const { data: queueDistribution } = useQueueDistribution();

  // Pharmacy
  const { data: drugFinancials } = useDrugFinancials(filters);
  const { data: expiryTracking } = useExpiryTracking();
  const { data: topDrugs } = useTopDrugsByRevenue(filters, 10);
  const { data: lowStock } = useLowStockItems(50);
  const { data: stockStatus } = useStockStatusSummary();

  // Lab
  const { data: labRevenue } = useLabRevenue(filters);
  const { data: labTAT } = useLabTAT(filters);
  const { data: abnormalResults } = useAbnormalResults(filters);
  const { data: labTestVolume } = useLabTestVolume(filters, 10);
  const { data: labWorkload } = useLabWorkload();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchDashboard();
    setIsRefreshing(false);
  };

  const renderViewTabs = () => (
    <div className="flex flex-wrap gap-x-6 border-b border-slate-200">
      {[
        { id: 'overview', label: 'Overview' },
        { id: 'clinical', label: 'Clinical' },
        { id: 'financial', label: 'Financial' },
        { id: 'operations', label: 'Operations' },
        { id: 'pharmacy', label: 'Pharmacy' },
        { id: 'laboratory', label: 'Laboratory' },
      ].map(({ id, label }) => (
        <button
          key={id}
          onClick={() => setViewMode(id as ViewMode)}
          className={`-mb-px whitespace-nowrap border-b-2 px-1 py-2.5 text-sm font-semibold transition-colors ${
            viewMode === id
              ? 'border-[#E9783F] text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
  // =============================================================================
  // OVERVIEW DASHBOARD
  // =============================================================================
  const renderOverview = () => (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-4">
        <KPICard
          title="Total Patients"
          value={dashboardStats?.patients.total || 0}
          icon={<Users className="w-5 h-5" />}
          color="blue"
          subtitle={`${dashboardStats?.patients.newToday || 0} new today`}
        />
        <KPICard
          title="Consultations"
          value={dashboardStats?.consultations.thisMonth || 0}
          icon={<Stethoscope className="w-5 h-5" />}
          color="green"
          subtitle={`${dashboardStats?.consultations.today || 0} today`}
        />
        <KPICard
          title="Revenue (Month)"
          value={dashboardStats?.billing.revenueThisMonth || 0}
          format="currency"
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
          subtitle={`${formatCurrency(dashboardStats?.billing.revenueToday || 0)} today`}
        />
        <KPICard
          title="Outstanding"
          value={dashboardStats?.billing.outstanding || 0}
          format="currency"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="yellow"
        />
        <KPICard
          title="Lab Tests"
          value={dashboardStats?.laboratory.totalThisMonth || 0}
          icon={<FlaskConical className="w-5 h-5" />}
          color="purple"
          subtitle={`${dashboardStats?.laboratory.pending || 0} pending`}
        />
        <SimpleStatCard
          title="Lab Avg TAT"
          value={`${dashboardStats?.operational.labAverageTurnaroundHours || 0} hrs`}
          icon={<Clock className="w-5 h-5" />}
          color="indigo"
          subtitle={`${dashboardStats?.operational.labWithinTargetRate || 0}% within 2.5h target`}
        />
        <SimpleStatCard
          title="Consult Wait"
          value={`${dashboardStats?.operational.consultationAverageWaitMinutes || 0} min`}
          icon={<Activity className="w-5 h-5" />}
          color="yellow"
          subtitle={`Target ${dashboardStats?.operational.consultationWaitTargetMinutes || 30} min`}
        />
        <KPICard
          title="Prescriptions"
          value={dashboardStats?.pharmacy.dispensedToday || 0}
          icon={<Pill className="w-5 h-5" />}
          color="cyan"
          subtitle={`${dashboardStats?.pharmacy.pendingPrescriptions || 0} pending`}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Patients Trend */}
        <Area3DChart
          data={
            monthlyPatients?.map((m) => ({
              label: m.month,
              value: m.newPatients + m.visits,
            })) || []
          }
          title="Patient Volume Trends"
          subtitle={`${currentYear} - Total Activity`}
          height={280}
        />

        {/* Monthly Revenue Trend */}
        <Area3DChart
          data={
            monthlyRevenue?.map((m) => ({
              label: m.month,
              value: m.revenue,
            })) || []
          }
          title="Revenue Trends"
          subtitle={`${currentYear} - Monthly Revenue`}
          height={280}
          formatValue={formatCurrency}
          color={chartColors.primary[1]}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Revenue by Service */}
        <Pie3DChart
          data={
            revenueByService?.slice(0, 6).map((s, i) => ({
              label: formatServiceLabel(s.service),
              value: s.net,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Revenue by Service"
          subtitle="Top 6 services"
        />

        {/* Revenue by Payment Method */}
        <Pie3DChart
          data={
            revenueByPayment?.map((p) => ({
              label: p.method,
              value: p.amount,
              color: getPaymentMethodColor(p.method),
            })) || []
          }
          title="Revenue by Payment"
          subtitle="Payment method breakdown"
        />

        {/* Patient Volume by Type */}
        <Pie3DChart
          data={
            patientVolume?.map((p, i) => ({
              label: p.type,
              value: p.count,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Patient Volume"
          subtitle="By visit type"
        />
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CompactListChart
          data={
            topDiagnoses?.slice(0, 6).map((d, i) => ({
              label: d.diagnosis?.substring(0, 30) || 'Unknown',
              value: d.count,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Top Diagnoses"
          maxItems={6}
        />
        <CompactListChart
          data={
            topLabTests?.slice(0, 6).map((t, i) => ({
              label: t.test_name?.substring(0, 30) || 'Unknown',
              value: t.count,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Top Lab Tests"
          maxItems={6}
        />
        <CompactListChart
          data={
            topMedications?.slice(0, 6).map((m, i) => ({
              label: m.medication?.substring(0, 30) || 'Unknown',
              value: m.count,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Top Medications"
          maxItems={6}
        />
      </div>

      {/* Fair Doctor Performance (All Doctors) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">
              Doctor Performance (Fair Tracking)
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Active doctors are scored by throughput and consultation wait
              time. Inactive doctors are retained with a neutral score.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Doctors tracked</p>
            <p className="text-xl font-bold text-gray-900">
              {dashboardStats?.operational.doctorPerformance?.length || 0}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Doctor
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Consultations
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Avg Wait
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Fair Score
                </th>
              </tr>
            </thead>
            <tbody>
              {dashboardStats?.operational.doctorPerformance?.map(
                (doctor, i) => (
                  <tr
                    key={doctor.doctorId}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{
                            backgroundColor:
                              chartColors.primary[
                                i % chartColors.primary.length
                              ],
                          }}
                        >
                          {doctor.doctorName?.replace('Dr. ', '').charAt(0) ||
                            '?'}
                        </div>
                        <span className="font-medium text-gray-900">
                          {doctor.doctorName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          doctor.status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {doctor.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {doctor.consultations}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {doctor.avgConsultationWaitMinutes === null
                        ? 'N/A'
                        : `${doctor.avgConsultationWaitMinutes} min`}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2 py-1 rounded-full text-sm font-semibold ${
                          doctor.performanceScore >= 75
                            ? 'bg-green-100 text-green-700'
                            : doctor.performanceScore >= 50
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {doctor.performanceScore}
                      </span>
                    </td>
                  </tr>
                ),
              )}
              {(!dashboardStats?.operational.doctorPerformance ||
                dashboardStats.operational.doctorPerformance.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No doctor performance data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // =============================================================================
  // CLINICAL DASHBOARD
  // =============================================================================
  const renderClinical = () => (
    <div className="space-y-6">
      {/* Clinical KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SimpleStatCard
          title="ALOS"
          value={`${alos?.overall || 0} days`}
          icon={<Clock className="w-5 h-5" />}
          subtitle="Avg Length of Stay"
          color="blue"
        />
        <SimpleStatCard
          title="Bed Occupancy"
          value={`${bor?.overall || 0}%`}
          icon={<Bed className="w-5 h-5" />}
          subtitle={`${bor?.occupiedBeds || 0}/${bor?.totalBeds || 0} beds`}
          color={bor?.overall && bor.overall > 80 ? 'red' : 'green'}
        />
        <KPICard
          title="Queue Waiting"
          value={queueDistribution?.reduce((sum, d) => sum + d.waiting, 0) || 0}
          icon={<Users className="w-5 h-5" />}
          color="yellow"
        />
        <KPICard
          title="In Progress"
          value={
            queueDistribution?.reduce((sum, d) => sum + d.inProgress, 0) || 0
          }
          icon={<Activity className="w-5 h-5" />}
          color="blue"
        />
        <KPICard
          title="Admissions"
          value={dashboardStats?.admissions || 0}
          icon={<Building2 className="w-5 h-5" />}
          subtitle="Today"
          color="purple"
        />
        <KPICard
          title="Discharges"
          value={dashboardStats?.discharges || 0}
          icon={<CheckCircle className="w-5 h-5" />}
          subtitle="Today"
          color="green"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bed Occupancy by Ward */}
        <Bar3DChart
          data={
            bor?.byWard?.map((w) => ({
              label: w.ward?.substring(0, 15) || 'Unknown',
              value: w.rate,
              color:
                w.rate > 80
                  ? chartColors.status.danger
                  : w.rate > 60
                    ? chartColors.status.warning
                    : chartColors.status.success,
            })) || []
          }
          title="Bed Occupancy by Ward"
          subtitle="Occupancy rate %"
          formatValue={(v) => `${v}%`}
        />

        {/* Queue by Department */}
        <Bar3DChart
          data={
            queueDistribution?.slice(0, 8).map((d, i) => ({
              label: d.department?.substring(0, 12) || 'Unknown',
              value: d.waiting + d.inProgress,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Queue by Department"
          subtitle="Waiting + In Progress"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Volume by Type */}
        <Pie3DChart
          data={
            patientVolume?.map((p, i) => ({
              label: p.type,
              value: p.count,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Patient Volume Distribution"
          subtitle="OPD, SOPD, IPD, Emergency"
        />

        {/* ALOS by Ward */}
        <Bar3DChart
          data={
            alos?.byWard?.slice(0, 6).map((w, i) => ({
              label: w.ward?.substring(0, 15) || 'Unknown',
              value: w.alos,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="ALOS by Ward"
          subtitle="Average Length of Stay (days)"
          formatValue={(v) => `${v} days`}
        />
      </div>

      {/* Doctor Productivity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 text-lg mb-4">
          Doctor Productivity
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Doctor
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Consultations
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {doctorProductivity?.slice(0, 10).map((doc, i) => (
                <tr
                  key={doc.doctorId}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{
                          backgroundColor:
                            chartColors.primary[i % chartColors.primary.length],
                        }}
                      >
                        {doc.doctorName?.charAt(0) || '?'}
                      </div>
                      <span className="font-medium text-gray-900">
                        {doc.doctorName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {doc.consultations}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-green-600">
                    {formatCurrency(doc.revenue)}
                  </td>
                </tr>
              ))}
              {(!doctorProductivity || doctorProductivity.length === 0) && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">
                    No data available for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // =============================================================================
  // FINANCIAL DASHBOARD
  // =============================================================================
  const renderFinancial = () => (
    <div className="space-y-6">
      {/* Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Gross Revenue"
          value={grossNet?.gross || 0}
          format="currency"
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          title="Net Revenue"
          value={grossNet?.net || 0}
          format="currency"
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          title="Discounts"
          value={grossNet?.discounts || 0}
          format="currency"
          icon={<TrendingDown className="w-5 h-5" />}
          subtitle={`${grossNet?.discountRate || 0}% of gross`}
          color="yellow"
        />
        <KPICard
          title="Outstanding"
          value={collectionEfficiency?.outstanding || 0}
          format="currency"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
        <SimpleStatCard
          title="Collection Rate"
          value={`${collectionEfficiency?.efficiency || 0}%`}
          icon={<Activity className="w-5 h-5" />}
          color={
            collectionEfficiency?.efficiency &&
            collectionEfficiency.efficiency > 80
              ? 'green'
              : 'yellow'
          }
        />
        <KPICard
          title="Total Collected"
          value={collectionEfficiency?.collected || 0}
          format="currency"
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Revenue Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <Area3DChart
          data={
            monthlyRevenue?.map((m) => ({
              label: m.month,
              value: m.revenue,
            })) || []
          }
          title="Monthly Revenue"
          subtitle={`${currentYear} - Billed Revenue`}
          height={280}
          formatValue={formatCurrency}
        />

        {/* Revenue by Payment Method */}
        <Bar3DChart
          data={
            revenueByPayment?.map((p) => ({
              label: p.method,
              value: p.amount,
              color: getPaymentMethodColor(p.method),
            })) || []
          }
          title="Revenue by Payment Method"
          subtitle="Payment breakdown"
          formatValue={formatCurrency}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Service */}
        <Bar3DChart
          data={
            revenueByService?.slice(0, 8).map((s, i) => ({
              label: formatServiceLabel(s.service),
              value: s.net,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Revenue by Service"
          subtitle="Net revenue by department"
          formatValue={formatCurrency}
        />

        {/* Debt Aging */}
        <Bar3DChart
          data={
            debtAging?.map((d, i) => ({
              label: d.bucket,
              value: d.amount,
              color:
                i === 0
                  ? chartColors.status.success
                  : i === 1
                    ? chartColors.status.warning
                    : i === 2
                      ? chartColors.status.danger
                      : '#7C3AED',
            })) || []
          }
          title="Debt Aging Report"
          subtitle="Outstanding by age bucket"
          formatValue={formatCurrency}
        />
      </div>

      {/* Detailed Collections Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 text-lg mb-4">
          Revenue by Service Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Service
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Transactions
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Gross
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Net
                </th>
              </tr>
            </thead>
            <tbody>
              {revenueByService?.map((s, i) => (
                <tr
                  key={s.service}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            chartColors.primary[i % chartColors.primary.length],
                        }}
                      />
                      <span className="font-medium">
                        {formatServiceLabel(s.service)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">{s.count}</td>
                  <td className="py-3 px-4 text-right">
                    {formatCurrency(s.gross)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-green-600">
                    {formatCurrency(s.net)}
                  </td>
                </tr>
              ))}
              {(!revenueByService || revenueByService.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No data available for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // =============================================================================
  // OPERATIONS DASHBOARD
  // =============================================================================
  const renderOperations = () => (
    <div className="space-y-6">
      {/* Operations KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Queue Today"
          value={
            queueDistribution?.reduce(
              (sum, d) => sum + d.waiting + d.inProgress + d.completed,
              0,
            ) || 0
          }
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <SimpleStatCard
          title="Avg Wait Time"
          value={`${Math.round((queueDistribution?.reduce((sum, d) => sum + d.avgWaitMinutes, 0) || 0) / (queueDistribution?.length || 1))} min`}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
        />
        <KPICard
          title="Lab Pending"
          value={labWorkload?.pending || 0}
          icon={<FlaskConical className="w-5 h-5" />}
          color="purple"
        />
        <KPICard
          title="Lab Completed"
          value={labWorkload?.completed || 0}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
        <SimpleStatCard
          title="Bed Occupancy"
          value={`${bor?.overall || 0}%`}
          icon={<Bed className="w-5 h-5" />}
          color={bor?.overall && bor.overall > 80 ? 'red' : 'green'}
        />
        <KPICard
          title="Low Stock Items"
          value={lowStock?.length || 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Queue & Wait Times */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Bar3DChart
          data={
            queueDistribution?.slice(0, 8).map((d) => ({
              label: d.department?.substring(0, 12) || 'Unknown',
              value: d.avgWaitMinutes,
              color:
                d.avgWaitMinutes > 30
                  ? chartColors.status.danger
                  : d.avgWaitMinutes > 15
                    ? chartColors.status.warning
                    : chartColors.status.success,
            })) || []
          }
          title="Average Wait Time by Department"
          subtitle="Minutes"
          formatValue={(v) => `${v} min`}
        />

        <Pie3DChart
          data={[
            {
              label: 'Waiting',
              value:
                queueDistribution?.reduce((sum, d) => sum + d.waiting, 0) || 0,
              color: chartColors.status.warning,
            },
            {
              label: 'In Progress',
              value:
                queueDistribution?.reduce((sum, d) => sum + d.inProgress, 0) ||
                0,
              color: chartColors.status.info,
            },
            {
              label: 'Completed',
              value:
                queueDistribution?.reduce((sum, d) => sum + d.completed, 0) ||
                0,
              color: chartColors.status.success,
            },
          ]}
          title="Queue Status Distribution"
          subtitle="Today's queue"
        />
      </div>

      {/* Lab Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Pie3DChart
          data={[
            {
              label: 'Pending',
              value: labWorkload?.pending || 0,
              color: chartColors.status.warning,
            },
            {
              label: 'Sample Collected',
              value: labWorkload?.sampleCollected || 0,
              color: chartColors.status.info,
            },
            {
              label: 'In Progress',
              value: labWorkload?.inProgress || 0,
              color: chartColors.primary[0],
            },
            {
              label: 'Completed',
              value: labWorkload?.completed || 0,
              color: chartColors.status.success,
            },
          ]}
          title="Lab Workload"
          subtitle="Today's lab requests"
        />

        {/* Stock Status */}
        <Pie3DChart
          data={[
            {
              label: 'In Stock',
              value: stockStatus?.inStock || 0,
              color: chartColors.status.success,
            },
            {
              label: 'Low Stock',
              value: stockStatus?.lowStock || 0,
              color: chartColors.status.warning,
            },
            {
              label: 'Out of Stock',
              value: stockStatus?.outOfStock || 0,
              color: chartColors.status.danger,
            },
          ]}
          title="Inventory Status"
          subtitle="Pharmacy stock levels"
        />
      </div>

      {/* Department Queue Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 text-lg mb-4">
          Department Queue Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Department
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Waiting
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  In Progress
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Completed
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Avg Wait
                </th>
              </tr>
            </thead>
            <tbody>
              {queueDistribution?.map((d) => (
                <tr
                  key={d.department}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4 font-medium">{d.department}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
                      {d.waiting}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {d.inProgress}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      {d.completed}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {d.avgWaitMinutes} min
                  </td>
                </tr>
              ))}
              {(!queueDistribution || queueDistribution.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No queue data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // =============================================================================
  // PHARMACY DASHBOARD
  // =============================================================================
  const renderPharmacy = () => (
    <div className="space-y-6">
      {/* Pharmacy KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Drug Revenue"
          value={drugFinancials?.totalRevenue || 0}
          format="currency"
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          title="Drug Cost"
          value={drugFinancials?.totalCost || 0}
          format="currency"
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
        />
        <SimpleStatCard
          title="Gross Margin"
          value={`${drugFinancials?.marginPercentage || 0}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          subtitle={formatCurrency(drugFinancials?.grossMargin || 0)}
          color="green"
        />
        <KPICard
          title="Low Stock"
          value={stockStatus?.lowStock || 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="yellow"
        />
        <KPICard
          title="Out of Stock"
          value={stockStatus?.outOfStock || 0}
          icon={<XCircle className="w-5 h-5" />}
          color="red"
        />
        <KPICard
          title="Expiring Soon"
          value={
            (expiryTracking?.within30.count || 0) +
            (expiryTracking?.expired.count || 0)
          }
          icon={<Clock className="w-5 h-5" />}
          subtitle="Within 30 days"
          color="red"
        />
      </div>

      {/* Revenue Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drug Revenue by Category */}
        <Bar3DChart
          data={
            drugFinancials?.byCategory?.slice(0, 8).map((c, i) => ({
              label: c.category?.substring(0, 15) || 'Other',
              value: c.revenue,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Revenue by Drug Category"
          subtitle="Top categories"
          formatValue={formatCurrency}
        />

        {/* Margin by Category */}
        <Bar3DChart
          data={
            drugFinancials?.byCategory?.slice(0, 8).map((c) => ({
              label: c.category?.substring(0, 15) || 'Other',
              value: c.marginPercent,
              color:
                c.marginPercent > 30
                  ? chartColors.status.success
                  : c.marginPercent > 15
                    ? chartColors.status.warning
                    : chartColors.status.danger,
            })) || []
          }
          title="Margin % by Category"
          subtitle="Profit margin analysis"
          formatValue={(v) => `${v}%`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Status */}
        <Pie3DChart
          data={[
            {
              label: 'In Stock',
              value: stockStatus?.inStock || 0,
              color: chartColors.status.success,
            },
            {
              label: 'Low Stock',
              value: stockStatus?.lowStock || 0,
              color: chartColors.status.warning,
            },
            {
              label: 'Out of Stock',
              value: stockStatus?.outOfStock || 0,
              color: chartColors.status.danger,
            },
          ]}
          title="Stock Status"
          subtitle={`Total: ${stockStatus?.totalItems || 0} items`}
        />

        {/* Expiry Status */}
        <Pie3DChart
          data={[
            {
              label: 'Expired',
              value: expiryTracking?.expired.count || 0,
              color: '#7C3AED',
            },
            {
              label: 'Within 30 days',
              value: expiryTracking?.within30.count || 0,
              color: chartColors.status.danger,
            },
            {
              label: 'Within 60 days',
              value: expiryTracking?.within60.count || 0,
              color: chartColors.status.warning,
            },
            {
              label: 'Within 90 days',
              value: expiryTracking?.within90.count || 0,
              color: chartColors.status.info,
            },
          ]}
          title="Expiry Tracking"
          subtitle={`Total at risk: ${formatCurrency((expiryTracking?.expired.value || 0) + (expiryTracking?.within30.value || 0))}`}
        />
      </div>

      {/* Top Drugs Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 text-lg mb-4">
          Top Drugs by Revenue
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Drug Name
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Qty Sold
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Revenue
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Margin
                </th>
              </tr>
            </thead>
            <tbody>
              {topDrugs?.map((d, i) => (
                <tr
                  key={d.name}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            chartColors.primary[i % chartColors.primary.length],
                        }}
                      />
                      <span className="font-medium">{d.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">{d.quantity}</td>
                  <td className="py-3 px-4 text-right font-medium text-green-600">
                    {formatCurrency(d.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatCurrency(d.margin)}
                  </td>
                </tr>
              ))}
              {(!topDrugs || topDrugs.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No data available for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock && lowStock.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <h3 className="font-semibold text-red-900 text-lg mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Low Stock Alert ({lowStock.length} items)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStock.slice(0, 9).map((item) => (
              <div
                key={item.name}
                className="bg-white rounded-lg p-3 border border-red-100"
              >
                <p className="font-medium text-gray-900 truncate">
                  {item.name}
                </p>
                <p className="text-sm text-red-600">
                  Stock: {item.currentStock} / Reorder: {item.reorderLevel}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // =============================================================================
  // LABORATORY DASHBOARD
  // =============================================================================
  const renderLaboratory = () => (
    <div className="space-y-6">
      {/* Lab KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Lab Revenue"
          value={labRevenue?.total || 0}
          format="currency"
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <SimpleStatCard
          title="Avg TAT"
          value={`${labTAT?.averageHours || 0} hrs`}
          icon={<Clock className="w-5 h-5" />}
          subtitle={`${labTAT?.averageMinutes || 0} min`}
          color="blue"
        />
        <SimpleStatCard
          title="TAT Compliance"
          value={`${labTAT?.complianceRate || 0}%`}
          icon={<CheckCircle className="w-5 h-5" />}
          subtitle="Meeting 2hr target"
          color={
            labTAT?.complianceRate && labTAT.complianceRate > 80
              ? 'green'
              : 'yellow'
          }
        />
        <KPICard
          title="Total Tests"
          value={abnormalResults?.total || 0}
          icon={<FlaskConical className="w-5 h-5" />}
          color="purple"
        />
        <SimpleStatCard
          title="Abnormal Rate"
          value={`${abnormalResults?.abnormalRate || 0}%`}
          icon={<AlertTriangle className="w-5 h-5" />}
          subtitle={`${abnormalResults?.abnormal || 0} abnormal`}
          color="yellow"
        />
        <KPICard
          title="Critical"
          value={abnormalResults?.critical || 0}
          icon={<XCircle className="w-5 h-5" />}
          subtitle={`${abnormalResults?.criticalRate || 0}‰`}
          color="red"
        />
      </div>

      {/* Revenue Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Category */}
        <Bar3DChart
          data={
            labRevenue?.byCategory?.slice(0, 8).map((c, i) => ({
              label: c.category,
              value: c.revenue,
              color: chartColors.primary[i % chartColors.primary.length],
            })) || []
          }
          title="Revenue by Test Category"
          subtitle="Lab test categories"
          formatValue={formatCurrency}
        />

        {/* TAT Distribution */}
        <Bar3DChart
          data={[
            {
              label: '< 1 hr',
              value: labTAT?.distribution?.under1hr || 0,
              color: chartColors.status.success,
            },
            {
              label: '1-2 hr',
              value: labTAT?.distribution?.['1to2hr'] || 0,
              color: chartColors.status.info,
            },
            {
              label: '2-4 hr',
              value: labTAT?.distribution?.['2to4hr'] || 0,
              color: chartColors.status.warning,
            },
            {
              label: '4-8 hr',
              value: labTAT?.distribution?.['4to8hr'] || 0,
              color: '#E9783F',
            },
            {
              label: '> 8 hr',
              value: labTAT?.distribution?.over8hr || 0,
              color: chartColors.status.danger,
            },
          ]}
          title="TAT Distribution"
          subtitle="Turnaround time buckets"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lab Workload */}
        <Pie3DChart
          data={[
            {
              label: 'Pending',
              value: labWorkload?.pending || 0,
              color: chartColors.status.warning,
            },
            {
              label: 'Sample Collected',
              value: labWorkload?.sampleCollected || 0,
              color: chartColors.status.info,
            },
            {
              label: 'In Progress',
              value: labWorkload?.inProgress || 0,
              color: chartColors.primary[0],
            },
            {
              label: 'Completed',
              value: labWorkload?.completed || 0,
              color: chartColors.status.success,
            },
          ]}
          title="Today's Workload"
          subtitle="Lab request status"
        />

        {/* Results Distribution */}
        <Pie3DChart
          data={[
            {
              label: 'Normal',
              value: abnormalResults?.normal || 0,
              color: chartColors.status.success,
            },
            {
              label: 'Abnormal',
              value: abnormalResults?.abnormal || 0,
              color: chartColors.status.warning,
            },
            {
              label: 'Critical',
              value: abnormalResults?.critical || 0,
              color: chartColors.status.danger,
            },
          ]}
          title="Results Distribution"
          subtitle="Normal vs Abnormal"
        />
      </div>

      {/* Test Volume Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 text-lg mb-4">
          Test Volume & Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Test Name
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Count
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Revenue
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Avg TAT
                </th>
              </tr>
            </thead>
            <tbody>
              {labTestVolume?.map((t, i) => (
                <tr
                  key={t.testName}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            chartColors.primary[i % chartColors.primary.length],
                        }}
                      />
                      <span className="font-medium">{t.testName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">{t.count}</td>
                  <td className="py-3 px-4 text-right font-medium text-green-600">
                    {formatCurrency(t.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-1 rounded-full text-sm ${
                        t.avgTAT < 60
                          ? 'bg-green-100 text-green-800'
                          : t.avgTAT < 120
                            ? 'bg-blue-100 text-blue-800'
                            : t.avgTAT < 240
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {t.avgTAT} min
                    </span>
                  </td>
                </tr>
              ))}
              {(!labTestVolume || labTestVolume.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No data available for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Analytics
            </h1>
            <p className="text-gray-500 mt-1">
              Clinic performance and trends
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Time Frame Selector */}
            <TimeFrameSelector
              value={timeFrame}
              onChange={setTimeFrame}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
                { value: 'quarter', label: 'This Quarter' },
                { value: 'year', label: 'This Year' },
              ]}
            />

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>

          </div>
        </div>

        {/* View Tabs */}
        <div className="mt-6">{renderViewTabs()}</div>
      </div>

      {/* Loading State */}
      {loadingDashboard && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Dashboard Content */}
      {!loadingDashboard && (
        <>
          {viewMode === 'overview' && renderOverview()}
          {viewMode === 'clinical' && renderClinical()}
          {viewMode === 'financial' && renderFinancial()}
          {viewMode === 'operations' && renderOperations()}
          {viewMode === 'pharmacy' && renderPharmacy()}
          {viewMode === 'laboratory' && renderLaboratory()}
        </>
      )}
    </div>
  );
}
