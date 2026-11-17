// =============================================================================
// XENOCARE EMR - Executive Command Center
// Modern, high-visibility dashboard with KPIs and visual charts
// =============================================================================

import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Activity,
  Clock,
  UserCheck,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Stethoscope,
  FlaskConical,
  Pill,
  DollarSign,
  Bed,
  Thermometer,
  CheckCircle2,
  LayoutDashboard,
  ChevronRight,
  X,
  Building2,
  Circle,
  Camera,
  Upload,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEncounterStats, useWorkflowSubscription } from '../lib/workflow';
import { useBedAvailability } from '../modules/in-patient/hooks/useBeds';
import { useTimeTheme } from '../hooks/useTimeTheme';
import { supabase } from '../api/supabaseClient';
import {
  SkeletonDashboard,
  SkeletonStatsCard,
  SkeletonList,
} from '../components/ui/SkeletonLoader';
import { MyPatientsWidget } from '../components/dashboard/MyPatientsWidget';
import DoctorDashboardSection from '../components/dashboard/DoctorDashboardSection';
import NurseDashboardSection from '../components/dashboard/NurseDashboardSection';
import LabTechDashboardSection from '../components/dashboard/LabTechDashboardSection';
import RadiologistDashboardSection from '../components/dashboard/RadiologistDashboardSection';
import BillingClerkDashboardSection from '../components/dashboard/BillingClerkDashboardSection';
import { PageHeader } from '../components/ui/PageHeader';

// Type for online doctor
interface OnlineDoctor {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  last_activity: string;
  photo_url: string | null;
}

// Chart colors - Professional palette
const CHART_COLORS = {
  primary: '#006400', // primary-700
  secondary: '#3B82F6', // info-500
  success: '#22C55E', // success-500
  warning: '#F59E0B', // warning-500
  danger: '#EF4444', // danger-500
  cyan: '#06B6D4',
  pink: '#EC4899',
  slate: '#64748B',
  indigo: '#6366F1',
};
const getTimeOfDay = () => {
  const hours = new Date().getHours();
  if (hours < 12) return 'Morning';
  if (hours < 16) return 'Afternoon';
  return 'Evening';
};
export default function Dashboard() {
  const { staff } = useAuth();
  const { isNightMode, themeMode, colors: themeColors } = useTimeTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: stats, isLoading, error, refetch } = useEncounterStats();
  const { data: bedAvailability = [] } = useBedAvailability();

  // State for doctors modal
  const [showDoctorsModal, setShowDoctorsModal] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real-time workflow changes for live updates
  useWorkflowSubscription();

  // Fetch online doctors when modal is open
  const { data: onlineDoctors, isLoading: doctorsLoading } = useQuery({
    queryKey: ['online-doctors'],
    queryFn: async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('staff')
        .select(
          'id, staff_id, first_name, last_name, department, last_activity, photo_url',
        )
        .eq('role', 'doctor')
        .eq('is_active', true)
        .gte('last_activity', fiveMinutesAgo)
        .order('last_activity', { ascending: false });

      if (error) throw error;
      return data as OnlineDoctor[];
    },
    enabled: showDoctorsModal,
    refetchInterval: showDoctorsModal ? 30000 : false,
  });

  // Upload photo mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({
      doctorId,
      photoBase64,
    }: {
      doctorId: string;
      photoBase64: string;
    }) => {
      const { error } = await supabase
        .from('staff')
        .update({ photo_url: photoBase64 })
        .eq('id', doctorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-doctors'] });
      setUploadingFor(null);
    },
  });

  // Handle photo upload
  const handlePhotoUpload = (
    doctorId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        uploadPhotoMutation.mutate({ doctorId, photoBase64: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove photo
  const handleRemovePhoto = async (doctorId: string) => {
    const { error } = await supabase
      .from('staff')
      .update({ photo_url: null })
      .eq('id', doctorId);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['online-doctors'] });
    }
  };

  // Theme configuration
  const theme = useMemo(
    () => ({
      bg: isNightMode ? 'bg-slate-950' : 'bg-[#F2F4F7]',
      cardBg: isNightMode ? 'bg-slate-900' : 'bg-white',
      cardBgAlt: isNightMode ? 'bg-slate-800/50' : 'bg-slate-50',
      text: isNightMode ? 'text-white' : 'text-slate-900',
      textMuted: isNightMode ? 'text-slate-400' : 'text-slate-500',
      textSubtle: isNightMode ? 'text-slate-500' : 'text-slate-400',
      border: isNightMode ? 'border-slate-800' : 'border-slate-200',
      shadow: isNightMode ? '' : 'shadow-sm',
      shadowHover: isNightMode ? '' : 'hover:shadow-md transition-shadow',
    }),
    [isNightMode],
  );

  // Computed metrics
  const metrics = useMemo(() => {
    if (!stats) return null;

    const totalActive = stats.active || 0;
    const completed = stats.completed || 0;
    const totalToday = stats.total_today || 0;
    const inConsultation = stats.in_consultation || 0;
    const activeDoctors = stats.active_doctors || 0;

    // Workflow stages - Using precise real-time counters
    const registration = stats.by_stage?.registration || 0;
    const triage = stats.triage_queue || 0;
    const labPending = stats.lab_pending || 0;
    const pharmacyPending = stats.pharmacy_queued || 0;
    const billingPending = stats.billing_pending || 0;

    // Completion rate
    const completionRate =
      totalToday > 0 ? Math.round((completed / totalToday) * 100) : 0;

    // Bed stats come from the live bed board, not ward capacity.
    const liveBeds = bedAvailability as Array<{ status?: string }>;
    const occupiedBeds = liveBeds.length
      ? liveBeds.filter(
          (bed) => String(bed.status || '').toLowerCase() === 'occupied',
        ).length
      : stats.occupied_beds || 0;
    const totalBeds = liveBeds.length || stats.total_beds || 0;
    const bedOccupancy =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      totalToday,
      totalActive,
      completed,
      inConsultation,
      activeDoctors,
      completionRate,
      registration,
      triage,
      labPending,
      pharmacyPending,
      billingPending,
      occupiedBeds,
      totalBeds,
      bedOccupancy,
      admitted: stats.admitted || 0,
      avgWait: stats.consultation_average_wait_minutes || 0,
      waitTarget: stats.consultation_wait_target_minutes || 30,
      inactiveDoctors: stats.inactive_doctors || 0,
      doctorPerformance: stats.doctor_performance || [],
    };
  }, [stats, bedAvailability]);

  // Chart data for patient flow
  const patientFlowData = useMemo(() => {
    if (!metrics) return [];
    return [
      {
        name: 'Registration',
        value: metrics.registration,
        color: CHART_COLORS.slate,
      },
      { name: 'Triage', value: metrics.triage, color: CHART_COLORS.pink },
      {
        name: 'Consultation',
        value: metrics.inConsultation,
        color: CHART_COLORS.primary,
      },
      {
        name: 'Lab/Tests',
        value: metrics.labPending,
        color: CHART_COLORS.warning,
      },
      {
        name: 'Pharmacy',
        value: metrics.pharmacyPending,
        color: CHART_COLORS.success,
      },
      {
        name: 'Billing',
        value: metrics.billingPending,
        color: CHART_COLORS.cyan,
      },
    ];
  }, [metrics]);

  const isDoctor =
    staff?.role === 'doctor' || staff?.role === 'medical_director';
  const isNurse = staff?.role === 'nurse';
  const isLabTech = staff?.role === 'lab_technician';
  const isRadiologist = staff?.role === 'radiologist';
  const isBillingClerk = staff?.role === 'billing_clerk';

  // Quick navigation modules
  const allModules = [
    {
      title: 'Registration',
      icon: Users,
      path: '/registration',
      color: 'from-info-500 to-info-600',
      count: metrics?.registration,
      doctorVisible: false,
    },
    {
      title: 'Nursing',
      icon: Thermometer,
      path: '/nursing',
      color: 'from-pink-500 to-pink-600',
      count: metrics?.triage,
      doctorVisible: false,
    },
    {
      title: 'Doctor',
      icon: Stethoscope,
      path: '/doctor',
      color: 'from-primary-500 to-primary-600',
      count: metrics?.inConsultation,
      doctorVisible: true,
    },
    {
      title: 'Laboratory',
      icon: FlaskConical,
      path: '/lab',
      color: 'from-warning-500 to-warning-600',
      count: metrics?.labPending,
      doctorVisible: true,
    },
    {
      title: 'Pharmacy',
      icon: Pill,
      path: '/pharmacy',
      color: 'from-success-500 to-success-600',
      count: metrics?.pharmacyPending,
      doctorVisible: false,
    },
    {
      title: 'Billing',
      icon: DollarSign,
      path: '/billing',
      color: 'from-cyan-500 to-cyan-600',
      count: metrics?.billingPending,
      doctorVisible: false,
    },
  ];
  const modules = isDoctor
    ? allModules.filter((m) => m.doctorVisible)
    : allModules;

  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.bg} p-6`}>
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} font-sans`}>
      <div className="max-w-[1440px] mx-auto px-6 py-6 pb-12 flex flex-col xl:flex-row gap-6">
        {/* ===================== LEFT COLUMN ===================== */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Greeting Banner */}
          <div className="bg-white rounded-xl p-5 shadow-sm flex items-center justify-between border border-slate-100 relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-slate-400 font-medium text-sm mb-2">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Welcome back.
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-slate-500">
                {isDoctor ? (
                  <>
                    You have{' '}
                    <strong className="text-slate-700">
                      {metrics?.inConsultation || 0} active patients
                    </strong>{' '}
                    and{' '}
                    <strong className="text-slate-700">
                      {metrics?.labPending || 0} pending lab results
                    </strong>
                    .
                  </>
                ) : isNurse ? (
                  <>
                    You have{' '}
                    <strong className="text-slate-700">
                      {metrics?.triage || 0} patients in triage
                    </strong>{' '}
                    and{' '}
                    <strong className="text-slate-700">
                      {metrics?.totalActive || 0} active visits
                    </strong>{' '}
                    today.
                  </>
                ) : isLabTech ? (
                  <>
                    You have{' '}
                    <strong className="text-slate-700">
                      {metrics?.labPending || 0} pending lab requests
                    </strong>{' '}
                    to process today.
                  </>
                ) : isRadiologist ? (
                  <>You have imaging requests to review and report on today.</>
                ) : isBillingClerk ? (
                  <>You have pending payments to verify and process today.</>
                ) : (
                  <>
                    You have{' '}
                    <strong className="text-slate-700">
                      {metrics?.labPending || 0} pending lab results
                    </strong>{' '}
                    and{' '}
                    <strong className="text-slate-700">
                      {metrics?.triage || 0} patients in triage
                    </strong>{' '}
                    today.
                  </>
                )}
              </p>
            </div>

          </div>

          {/* Doctor-Specific Dashboard Section */}
          <DoctorDashboardSection />

          {/* Nurse-Specific Dashboard Section */}
          <NurseDashboardSection />

          {/* Lab Technician Dashboard Section */}
          <LabTechDashboardSection />

          {/* Radiologist Dashboard Section */}
          <RadiologistDashboardSection />

          {/* Billing Clerk Dashboard Section */}
          <BillingClerkDashboardSection />

          {/* Admin/Management views — hidden for role-specific dashboards */}
          {!isDoctor &&
            !isNurse &&
            !isLabTech &&
            !isRadiologist &&
            !isBillingClerk && (
              <>
                {/* 6 Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
                  {/* Total Patients */}
                  <div className="bg-white p-3 xl:p-4 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex flex-nowrap items-center gap-1.5 text-slate-400 font-bold text-[10px] md:text-xs tracking-wider uppercase min-w-0 flex-1 overflow-hidden">
                        <Users
                          size={14}
                          className="text-[#11151C] shrink-0 min-w-[14px]"
                        />
                        <span className="truncate">Patients</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {metrics?.totalToday?.toLocaleString() || 0}
                    </p>
                  </div>

                  {/* Attended Route */}
                  <div className="bg-white p-3 xl:p-4 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex flex-nowrap items-center gap-1.5 text-slate-400 font-bold text-[10px] md:text-xs tracking-wider uppercase min-w-0 flex-1 overflow-hidden">
                        <Stethoscope
                          size={14}
                          className="text-[#11151C] shrink-0 min-w-[14px]"
                        />
                        <span className="truncate">Attended</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {metrics?.totalActive?.toLocaleString() || 0}
                    </p>
                  </div>

                  {/* Discharged */}
                  <div className="bg-white p-3 xl:p-4 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex flex-nowrap items-center gap-1.5 text-slate-400 font-bold text-[10px] md:text-xs tracking-wider uppercase min-w-0 flex-1 overflow-hidden">
                        <CheckCircle2
                          size={14}
                          className="text-slate-400 shrink-0 min-w-[14px]"
                        />
                        <span className="truncate">Discharged</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {metrics?.completed?.toLocaleString() || 0}
                    </p>
                  </div>

                  {/* Online Doctors */}
                  <button
                    onClick={() => setShowDoctorsModal(true)}
                    className="bg-white p-3 xl:p-4 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between text-left hover:border-[#11151C] transition-colors cursor-pointer group overflow-hidden"
                  >
                    <div className="flex justify-between items-center mb-3 w-full">
                      <div className="flex flex-nowrap items-center gap-1.5 text-slate-400 font-bold text-[10px] md:text-xs tracking-wider uppercase group-hover:text-[#11151C] min-w-0 flex-1 overflow-hidden">
                        <div className="relative flex h-2 w-2 shrink-0 min-w-[8px]">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                        </div>
                        <span className="truncate">Doctors</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {metrics?.activeDoctors || 0}
                    </p>
                  </button>

                  {/* Wait Time */}
                  <div className="bg-white p-3 xl:p-4 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex flex-nowrap items-center gap-1.5 text-slate-400 font-bold text-[10px] md:text-xs tracking-wider uppercase min-w-0 flex-1 overflow-hidden">
                        <Clock
                          size={14}
                          className="text-red-400 shrink-0 min-w-[14px]"
                        />
                        <span className="truncate">Wait Time</span>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 mt-auto overflow-hidden">
                      <p className="text-2xl font-bold text-slate-800 truncate">
                        {metrics?.avgWait || 0}
                      </p>
                      <span className="text-sm font-semibold text-slate-400 shrink-0">
                        m
                      </span>
                    </div>
                  </div>

                  {/* Beds */}
                  <div className="bg-white p-3 xl:p-4 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex flex-nowrap items-center gap-1.5 text-slate-400 font-bold text-[10px] md:text-xs tracking-wider uppercase min-w-0 flex-1 overflow-hidden">
                        <Bed
                          size={14}
                          className="text-slate-400 shrink-0 min-w-[14px]"
                        />
                        <span className="truncate">Beds used</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {metrics?.occupiedBeds || 0}
                      <span className="text-sm font-semibold text-slate-400">
                        {' '}/ {metrics?.totalBeds || 0}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Patient flow */}
                <div>
                  <div className="flex items-center justify-between mb-4 mt-2">
                    <h3 className="font-bold text-slate-800 text-lg">
                      Patient flow
                    </h3>
                    <button
                      onClick={() => navigate('/queue')}
                      className="text-sm font-bold text-[#11151C] hover:underline"
                    >
                      View all
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        name: 'Registration',
                        icon: Users,
                        sub: 'Front desk',
                        load: metrics?.registration || 0,
                        color: '#11151C',
                      },
                      {
                        name: 'Triage',
                        icon: Activity,
                        sub: 'Vitals',
                        load: metrics?.triage || 0,
                        color: '#94a3b8',
                      },
                      {
                        name: 'Consultation',
                        icon: Stethoscope,
                        sub: 'With doctor',
                        load: metrics?.inConsultation || 0,
                        color: '#c53030',
                      },
                    ].map((stage) => {
                      return (
                        <div
                          key={stage.name}
                          className="rounded-xl border border-slate-100 bg-white px-3.5 py-3"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <h4 className="truncate text-sm font-semibold text-slate-700">
                              {stage.name}
                            </h4>
                            <span className="font-display text-lg font-bold text-slate-900">
                              {stage.load}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {stage.sub}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Split (Department Activity + Rest of Workflows) */}
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg mb-6">
                      Department Activity
                    </h3>
                    <div className="space-y-6">
                      {[
                        {
                          name: 'Consultation',
                          users: 'Doctors seeing patients',
                          load: metrics?.inConsultation || 0,
                          color: '#11151C',
                        },
                        {
                          name: 'Nursing/Triage',
                          users: 'Patients being triaged',
                          load: metrics?.triage || 0,
                          color: '#94a3b8',
                        },
                        {
                          name: 'Laboratory',
                          users: 'Pending lab tests',
                          load: metrics?.labPending || 0,
                          color: '#11151C',
                        },
                        {
                          name: 'Pharmacy',
                          users: 'Prescriptions to dispense',
                          load: metrics?.pharmacyPending || 0,
                          color: '#11151C',
                        },
                        {
                          name: 'Billing',
                          users: 'Bills awaiting payment',
                          load: metrics?.billingPending || 0,
                          color: '#475569',
                        },
                      ].map((dept) => (
                        <div
                          key={dept.name}
                          className="flex justify-between items-center group cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-1.5 h-10 rounded-full"
                              style={{ backgroundColor: dept.color }}
                            />
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm group-hover:text-[#11151C] transition-colors">
                                {dept.name}
                              </h4>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {dept.users}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-slate-800 text-lg">
                              {dept.load}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
        </div>
      </div>

      {/* ADDITIONAL REQUIRED VIEWS (Re-captured from original) */}
      <div className="max-w-[1440px] mx-auto px-6 pb-10 flex flex-col gap-6">
        {/* Quick Access Modules — admin/management only */}
        {!isDoctor &&
          !isNurse &&
          !isLabTech &&
          !isRadiologist &&
          !isBillingClerk && (
            <div className="mb-2">
              <h3 className="text-sm font-bold text-slate-800 mb-4">
                Quick Access
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {modules.map((module) => (
                  <button
                    key={module.title}
                    onClick={() => navigate(module.path)}
                    className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white px-3 py-4 transition-colors hover:border-slate-300 group"
                  >
                    <div
                      className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${module.color} text-white`}
                    >
                      <module.icon size={18} />
                    </div>
                    <span className="font-bold text-slate-700 text-xs">
                      {module.title}
                    </span>
                    {(module.count || 0) > 0 && (
                      <span className="mt-2 text-[10px] font-black tracking-widest bg-slate-100 text-slate-600 px-2 py-1 rounded-md leading-none">
                        {module.count} PENDING
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Today's Clinical Snapshot Summary Table */}
        {/* Today's Clinical Snapshot — admin/management only */}
        {!isDoctor &&
          !isNurse &&
          !isLabTech &&
          !isRadiologist &&
          !isBillingClerk && (
            <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6 mb-2">
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                Today's Clinical Snapshot
              </h3>
              <p className="text-xs text-slate-400 mb-6 font-medium">
                A quick summary of today's operations across all departments at
                a glance
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
                {[
                  { label: 'Registered today', value: metrics?.totalToday || 0 },
                  { label: 'Being attended', value: metrics?.totalActive || 0 },
                  { label: 'Discharged', value: metrics?.completed || 0 },
                  {
                    label: 'Discharge rate',
                    value: `${metrics?.completionRate || 0}%`,
                  },
                  { label: 'In triage', value: metrics?.triage || 0 },
                  {
                    label: 'In consultation',
                    value: metrics?.inConsultation || 0,
                  },
                  { label: 'Lab pending', value: metrics?.labPending || 0 },
                  {
                    label: 'Pharmacy queued',
                    value: metrics?.pharmacyPending || 0,
                  },
                  { label: 'Bills pending', value: metrics?.billingPending || 0 },
                  { label: 'Admitted', value: metrics?.admitted || 0 },
                  {
                    label: 'Beds in use',
                    value: `${metrics?.occupiedBeds || 0} / ${metrics?.totalBeds || 0}`,
                  },
                  {
                    label: 'Average wait',
                    value: `${metrics?.avgWait || 0} min`,
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
          )}

        {/* Doctor Performance — admin/management only */}
        {!isDoctor &&
          !isNurse &&
          !isLabTech &&
          !isRadiologist &&
          !isBillingClerk && (
            <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-1">
                Doctors today
              </h3>
              <p className="text-xs text-slate-400 mb-4 font-medium">
                Consultations completed and average wait.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Doctor
                      </th>
                      <th className="text-right py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Consults
                      </th>
                      <th className="text-right py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Avg Wait
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(metrics?.doctorPerformance || [])
                      .slice(0, 20)
                      .map((doc) => (
                        <tr
                          key={doc.doctor_id}
                          className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3 px-3 text-sm font-bold text-slate-700">
                            {doc.doctor_name}
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-bold text-slate-800">
                            {doc.consultations}
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-medium text-slate-600">
                            {doc.avg_wait_minutes === null
                              ? 'N/A'
                              : `${doc.avg_wait_minutes} min`}
                          </td>
                        </tr>
                      ))}
                    {(metrics?.doctorPerformance || []).length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-sm font-medium text-slate-500 bg-slate-50 rounded-b-xl"
                        >
                          No doctor performance data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>

      {/* Online Doctors Modal */}
      {showDoctorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDoctorsModal(false)}
          />

          {/* Modal */}
          <div
            className={`relative w-full max-w-lg ${theme.cardBg} rounded-xl ${theme.shadow} overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <UserCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${theme.text}`}>
                    Doctors Online
                  </h2>
                  <p className={`text-sm ${theme.textMuted}`}>
                    {onlineDoctors?.length || 0} doctor
                    {(onlineDoctors?.length || 0) !== 1 ? 's' : ''} currently
                    active
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDoctorsModal(false)}
                className={`p-2 rounded-xl ${theme.cardBgAlt} hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {doctorsLoading ? (
                <div className="py-4 px-2">
                  <SkeletonList count={3} />
                </div>
              ) : onlineDoctors && onlineDoctors.length > 0 ? (
                <div className="space-y-3">
                  {onlineDoctors.map((doctor) => {
                    const lastActive = new Date(doctor.last_activity);
                    const minutesAgo = Math.floor(
                      (Date.now() - lastActive.getTime()) / 60000,
                    );
                    const isGOPD =
                      doctor.department?.toLowerCase().includes('gopd') ||
                      doctor.department
                        ?.toLowerCase()
                        .includes('general outpatient') ||
                      doctor.department?.toLowerCase().includes('outpatient');
                    const isCurrentUser = staff?.id === doctor.id;

                    return (
                      <div
                        key={doctor.id}
                        className={`flex items-center justify-between p-4 rounded-xl ${theme.cardBgAlt} hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar with online indicator and upload option */}
                          <div className="relative group">
                            {doctor.photo_url ? (
                              <img
                                src={doctor.photo_url}
                                alt={`Dr. ${doctor.first_name}`}
                                className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
                                {doctor.first_name?.[0]}
                                {doctor.last_name?.[0]}
                              </div>
                            )}
                            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-success-500 border-2 border-white dark:border-slate-800 rounded-full flex items-center justify-center">
                              <Circle className="w-2 h-2 fill-current text-white" />
                            </span>

                            {/* Upload overlay - only show for current user or super_admin */}
                            {(isCurrentUser ||
                              staff?.role === 'super_admin') && (
                              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  id={`photo-upload-${doctor.id}`}
                                  onChange={(e) =>
                                    handlePhotoUpload(doctor.id, e)
                                  }
                                />
                                <label
                                  htmlFor={`photo-upload-${doctor.id}`}
                                  className="cursor-pointer"
                                >
                                  <Camera className="w-5 h-5 text-white" />
                                </label>
                              </div>
                            )}
                          </div>

                          {/* Doctor info */}
                          <div>
                            <p className={`font-semibold ${theme.text}`}>
                              Dr. {doctor.first_name} {doctor.last_name}
                              {isCurrentUser && (
                                <span className="text-xs text-primary-500 ml-2">
                                  (You)
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span className={`text-sm ${theme.textMuted}`}>
                                {doctor.department || 'Not assigned'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status badges and actions */}
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-end gap-2">
                            {isGOPD && (
                              <span className="px-2.5 py-1 text-xs font-bold bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400 rounded-full">
                                GOPD
                              </span>
                            )}
                            <span className={`text-xs ${theme.textSubtle}`}>
                              {minutesAgo === 0
                                ? 'Just now'
                                : `${minutesAgo}m ago`}
                            </span>
                          </div>

                          {/* Photo actions - only for self or super_admin */}
                          {(isCurrentUser || staff?.role === 'super_admin') &&
                            doctor.photo_url && (
                              <button
                                onClick={() => handleRemovePhoto(doctor.id)}
                                className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
                                title="Remove photo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <UserCheck className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className={`font-medium ${theme.text}`}>
                    No Doctors Online
                  </p>
                  <p className={`text-sm ${theme.textMuted} mt-1`}>
                    No doctors have been active in the last 5 minutes
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className={`px-6 py-4 border-t ${theme.border} bg-slate-50 dark:bg-slate-800/50`}
            >
              <p className={`text-xs ${theme.textMuted} text-center`}>
                Showing doctors active within the last 5 minutes •
                Auto-refreshes every 30 seconds
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
