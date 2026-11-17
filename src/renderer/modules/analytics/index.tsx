import React, { useState } from 'react';
import {
  Users,
  Stethoscope,
  FlaskConical,
  Radio,
  Pill,
  DollarSign,
  Clock,
  TrendingUp,
  RefreshCw,
  BarChart3,
  Activity,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import { StatsCard, Card } from '../../components/ui/DataDisplay';
import { Button, Select } from '../../components/ui/FormElements';
import {
  SimpleBarChart,
  HorizontalBarChart,
  DonutChart,
  StatNumber,
} from './components/Charts';
import SummaryStats from './components/SummaryStats';
import ComprehensiveAnalytics from './components/ComprehensiveAnalytics';
import {
  useDashboardStats,
  usePatientTrends,
  useRevenueTrends,
  useDepartmentStats,
  useTopDiagnoses,
  useTopLabTests,
  useTopMedications,
} from './hooks/useAnalytics';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import BillingAnalytics from './components/BillingAnalytics';
import P1AnalyticsPage from './components/P1AnalyticsPage';

// =============================================================================
// Tab Types
// =============================================================================

type ReportTab =
  | 'comprehensive'
  | 'summary-stats'
  | 'encounter'
  | 'pharmacy'
  | 'billing'
  | 'operational';

// =============================================================================
// Encounter Stats Tab Props
// =============================================================================

interface EncounterStatsProps {
  stats: any;
  patientTrends: any;
  revenueTrends: any;
  departmentStats: any;
  topDiagnoses: any;
  topLabTests: any;
  topMedications: any;
  trendDays: number;
  setTrendDays: (days: number) => void;
  formatCurrency: (amount: number) => string;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  isLoading: boolean;
}

// =============================================================================
// Pharmacy Stats Tab Props
// =============================================================================

interface PharmacyStatsProps {
  stats: any;
  topMedications: any;
}

// =============================================================================
// Encounter Stats Tab
// =============================================================================

function EncounterStats({
  stats,
  patientTrends,
  revenueTrends,
  departmentStats,
  topDiagnoses,
  topLabTests,
  topMedications,
  trendDays,
  setTrendDays,
  formatCurrency,
  hasRole,
  isLoading,
}: EncounterStatsProps) {
  if (isLoading && !stats) {
    return (
      <div className="p-6">
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trend Filter */}
      <div className="flex justify-end">
        <Select
          value={trendDays.toString()}
          onChange={(e) => setTrendDays(parseInt(e.target.value, 10))}
          options={[
            { value: '7', label: 'Last 7 days' },
            { value: '14', label: 'Last 14 days' },
            { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' },
          ]}
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <StatsCard
          title="Total Patients"
          value={stats?.patients.total || 0}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="New Today"
          value={stats?.patients.newToday || 0}
          icon={Users}
          color="green"
        />
        <StatsCard
          title="Consultations Today"
          value={stats?.consultations.today || 0}
          icon={Stethoscope}
          color="purple"
        />
        <StatsCard
          title="Pending Labs"
          value={stats?.laboratory.pending || 0}
          icon={FlaskConical}
          color="yellow"
        />
        <StatsCard
          title="Pending Radiology"
          value={stats?.radiology.pending || 0}
          icon={Radio}
          color="cyan"
        />
        <StatsCard
          title="Pending Rx"
          value={stats?.pharmacy.pendingPrescriptions || 0}
          icon={Pill}
          color="pink"
        />
        <StatsCard
          title="Queue Waiting"
          value={stats?.queue.waiting || 0}
          icon={Clock}
          color="orange"
        />
        <StatsCard
          title="Served Today"
          value={stats?.queue.completedToday || 0}
          icon={Activity}
          color="emerald"
        />
      </div>

      {/* Financial Overview */}
      {hasRole(['super_admin', 'admin', 'billing_clerk']) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
            <StatNumber
              value={stats?.billing.revenueToday || 0}
              label="Today's Revenue"
              format="currency"
            />
          </Card>
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
            <StatNumber
              value={stats?.billing.revenueThisMonth || 0}
              label="This Month"
              format="currency"
            />
          </Card>
          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100">
            <StatNumber
              value={stats?.billing.outstanding || 0}
              label="Outstanding"
              format="currency"
            />
          </Card>
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100">
            <StatNumber
              value={stats?.consultations.thisMonth || 0}
              label="Consultations This Month"
            />
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">
              Patient Registrations
            </h3>
          </div>
          {patientTrends && patientTrends.length > 0 ? (
            <SimpleBarChart
              data={patientTrends}
              color="blue"
              height={180}
              formatValue={(v) => `${v} patients`}
            />
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </Card>

        {hasRole(['super_admin', 'admin', 'billing_clerk']) && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Revenue Trend</h3>
            </div>
            {revenueTrends && revenueTrends.length > 0 ? (
              <SimpleBarChart
                data={revenueTrends}
                color="green"
                height={180}
                formatValue={(v) => formatCurrency(v)}
              />
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <DonutChart
            title="Patient Gender Distribution"
            data={[
              {
                label: 'Male',
                value: stats?.patients.byGender.male || 0,
                color: '#3B82F6',
              },
              {
                label: 'Female',
                value: stats?.patients.byGender.female || 0,
                color: '#EC4899',
              },
            ]}
          />
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">
              Department Activity Today
            </h3>
          </div>
          {departmentStats && departmentStats.length > 0 ? (
            <HorizontalBarChart
              data={departmentStats.map((d: any) => ({
                label: d.department,
                value: d.count,
              }))}
              color="purple"
            />
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400">
              No activity today
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-gray-900">Top Diagnoses</h3>
          </div>
          {topDiagnoses && topDiagnoses.length > 0 ? (
            <HorizontalBarChart
              data={topDiagnoses.map((d: any) => ({
                label: d.diagnosis,
                value: d.count,
              }))}
              color="red"
            />
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </Card>
      </div>

      {/* Lab and Pharmacy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="h-5 w-5 text-cyan-600" />
            <h3 className="font-semibold text-gray-900">
              Most Ordered Lab Tests
            </h3>
          </div>
          {topLabTests && topLabTests.length > 0 ? (
            <HorizontalBarChart
              data={topLabTests.map((t: any) => ({
                label: t.test_name,
                value: t.count,
              }))}
              color="cyan"
            />
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">
              Most Dispensed Medications
            </h3>
          </div>
          {topMedications && topMedications.length > 0 ? (
            <HorizontalBarChart
              data={topMedications.map((m: any) => ({
                label: m.medication,
                value: m.count,
              }))}
              color="green"
            />
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </Card>
      </div>

      {/* Today's Summary */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          Today&apos;s Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {stats?.patients.newToday || 0}
            </p>
            <p className="text-xs text-gray-500">New Patients</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">
              {stats?.consultations.today || 0}
            </p>
            <p className="text-xs text-gray-500">Consultations</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-cyan-600">
              {stats?.laboratory.completedToday || 0}
            </p>
            <p className="text-xs text-gray-500">Labs Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-600">
              {stats?.radiology.completedToday || 0}
            </p>
            <p className="text-xs text-gray-500">Imaging Done</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {stats?.pharmacy.dispensedToday || 0}
            </p>
            <p className="text-xs text-gray-500">Rx Dispensed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">
              {stats?.queue.completedToday || 0}
            </p>
            <p className="text-xs text-gray-500">Patients Served</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600">
              {stats?.queue.waiting || 0}
            </p>
            <p className="text-xs text-gray-500">Currently Waiting</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-pink-600">
              {stats?.consultations.pending || 0}
            </p>
            <p className="text-xs text-gray-500">In Progress</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// =============================================================================
// Pharmacy Stats Tab
// =============================================================================

function PharmacyStats({ stats, topMedications }: PharmacyStatsProps) {
  return (
    <div className="space-y-6">
      {/* Pharmacy Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Dispensed Today"
          value={stats?.pharmacy.dispensedToday || 0}
          icon={Pill}
          color="green"
        />
        <StatsCard
          title="Pending Prescriptions"
          value={stats?.pharmacy.pendingPrescriptions || 0}
          icon={Clock}
          color="yellow"
        />
        <StatsCard
          title="Low Stock Items"
          value={stats?.pharmacy.lowStockItems || 0}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard title="Total Items" value={0} icon={Package} color="blue" />
      </div>

      {/* Most Dispensed */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Pill className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">
            Most Dispensed Medications
          </h3>
        </div>
        {topMedications && topMedications.length > 0 ? (
          <HorizontalBarChart
            data={topMedications.map((m: any) => ({
              label: m.medication,
              value: m.count,
            }))}
            color="green"
          />
        ) : (
          <div className="h-44 flex items-center justify-center text-gray-400">
            No data available
          </div>
        )}
      </Card>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function Analytics() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('comprehensive');
  const [trendDays, setTrendDays] = useState(30);

  const { data: stats, isLoading, refetch } = useDashboardStats();
  const { data: patientTrends } = usePatientTrends(trendDays);
  const { data: revenueTrends } = useRevenueTrends(trendDays);
  const { data: departmentStats } = useDepartmentStats();
  const { data: topDiagnoses } = useTopDiagnoses(5);
  const { data: topLabTests } = useTopLabTests(5);
  const { data: topMedications } = useTopMedications(5);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);

  const tabs = [
    { id: 'comprehensive', label: 'Dashboard' },
    { id: 'operational', label: 'Operations' },
    { id: 'summary-stats', label: 'Summary' },
    { id: 'encounter', label: 'Visits' },
    { id: 'pharmacy', label: 'Pharmacy' },
    { id: 'billing', label: 'Billing' },
  ];

  const reportTabs = (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <label
        htmlFor="analytics-report"
        className="text-xs font-medium text-slate-500"
      >
        Report
      </label>
      <select
        id="analytics-report"
        value={activeTab}
        onChange={(event) => setActiveTab(event.target.value as ReportTab)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-[#E9783F]"
      >
        {tabs.map((tab) => (
          <option key={tab.id} value={tab.id}>
            {tab.label}
          </option>
        ))}
      </select>
    </div>
  );

  // If on operational dashboard, render P1 Analytics full-page
  if (activeTab === 'operational') {
    return (
      <div className="h-full">
        {/* Mini Tab Bar to switch away from operational */}
        {reportTabs}
        <P1AnalyticsPage />
      </div>
    );
  }

  // If on comprehensive dashboard, render it full-page without the standard layout
  if (activeTab === 'comprehensive') {
    return (
      <div className="h-full">
        {/* Mini Tab Bar to switch away from comprehensive */}
        {reportTabs}
        <ComprehensiveAnalytics />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            REPORTS -{' '}
            {activeTab === 'summary-stats'
              ? 'SUMMARY STATS'
              : activeTab.toUpperCase()}
          </h1>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Tab Navigation */}
      {reportTabs}

      {/* Tab Content */}
      {activeTab === 'summary-stats' && <SummaryStats />}

      {activeTab === 'encounter' && (
        <EncounterStats
          stats={stats}
          patientTrends={patientTrends}
          revenueTrends={revenueTrends}
          departmentStats={departmentStats}
          topDiagnoses={topDiagnoses}
          topLabTests={topLabTests}
          topMedications={topMedications}
          trendDays={trendDays}
          setTrendDays={setTrendDays}
          formatCurrency={formatCurrency}
          hasRole={hasRole}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'pharmacy' && (
        <PharmacyStats stats={stats} topMedications={topMedications} />
      )}

      {activeTab === 'billing' && <BillingAnalytics />}
    </div>
  );
}
