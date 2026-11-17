import React, { lazy, Suspense, useEffect } from 'react';
import {
  MemoryRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  queryClient,
  prefetchCommonData,
  setupPersistentQueryCache,
} from './api/queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PatientEncounterProvider } from './contexts/PatientEncounterContext';
import { ConfigProvider } from './contexts/ConfigContext';
import { GuidanceProvider } from './contexts/GuidanceContext';
import { ToastProvider } from './components/ui/Toast';
import { MessageNotificationProvider } from './modules/messaging/components/MessageNotificationProvider';
import { GlobalNotificationProvider } from './components/notifications/GlobalNotificationProvider';
import { EmrNotificationToastStack } from './components/notifications/EmrNotificationToastStack';
import { ProtectedRoute, ModuleRoute } from './components/auth/ProtectedRoute';
import Layout from './shared/Layout';
import { GlobalLoading } from './components/ui/GlobalLoading';
import { GlobalMutationSyncIndicator } from './components/ui/GlobalMutationSyncIndicator';
import { runIndexedDbMaintenance } from './lib/offline/storage/maintenance';
import { setupRealtimeInvalidation } from './lib/realtimeInvalidation';
import { createScopedLogger } from './utils/logger';
import {
  isEmergencyFeatureEnabled,
  isHygieneFeatureEnabled,
  isNhisFeatureEnabled,
  isSpecialtyClinicsEnabled,
  isDentalEnabled,
  isOphthalmologyEnabled,
  isPhysiotherapyEnabled,
} from './config/features';
import './App.css';

const log = createScopedLogger('App');

const APP_ICON = require('../../assets/xenocare-logo.png');

// =============================================================================
// Lazy-loaded modules for code splitting (reduces initial bundle by ~60%)
// =============================================================================
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const SyncCenter = lazy(() => import('./pages/SyncCenter'));

// Core modules - lazy loaded
const PatientRegistration = lazy(
  () => import('./modules/patient-registration'),
);
const ClinicalConsultation = lazy(
  () => import('./modules/clinical-consultation'),
);
const EncounterCentricView = lazy(() =>
  import('./modules/clinical-consultation/components/medical-records').then(
    (m) => ({ default: m.EncounterCentricView }),
  ),
);
const MedicalRecordsModule = lazy(() => import('./modules/medical-records'));
const NursingCare = lazy(() => import('./modules/nursing'));
const Pharmacy = lazy(() => import('./modules/pharmacy'));
const Laboratory = lazy(() => import('./modules/lab'));
const Radiology = lazy(
  () => import('./modules/radiology/ExternalRadiology'),
);
const QueueManagement = lazy(() => import('./modules/queue'));
const Billing = lazy(() => import('./modules/billing'));
const Analytics = lazy(() => import('./modules/analytics'));
const MedicalReports = lazy(() => import('./modules/medical-reports'));
const CustomerService = lazy(() => import('./modules/customer-service'));
const Inventory = lazy(() => import('./modules/inventory'));
const Configurations = lazy(() => import('./modules/configurations'));
const StaffList = lazy(() => import('./modules/staff'));
const Encounter = lazy(() => import('./modules/encounter'));
const InPatientPage = lazy(() =>
  import('./modules/in-patient').then((m) => ({ default: m.InPatientPage })),
);
const ProceduresPage = lazy(() =>
  import('./modules/procedure').then((m) => ({ default: m.ProceduresPage })),
);
const ClinicalRequestsPage = lazy(() =>
  import('./modules/clinical-requests').then((m) => ({
    default: m.ClinicalRequestsPage,
  })),
);

// Specialty modules
const DentalPage = lazy(() => import('./modules/dental'));
const OphthalmologyPage = lazy(() => import('./modules/ophthalmology'));
const PhysiotherapyPage = lazy(() => import('./modules/physiotherapy'));
const SpecialtyClinicPage = lazy(() => import('./modules/specialty-clinic'));
const NutritionPage = lazy(() => import('./modules/nutrition'));

// Surgery and Hygiene modules
const SurgeryModule = lazy(() =>
  import('./modules/surgery').then((m) => ({ default: m.SurgeryModule })),
);
const HygieneModule = lazy(() =>
  import('./modules/hygiene').then((m) => ({ default: m.HygieneModule })),
);

// A&E module
const AeModule = lazy(() => import('./modules/ae'));

// ANC module
const AncModule = lazy(() => import('./modules/anc'));

// NHIS module
const NhisModule = lazy(() => import('./modules/nhis'));

// Messaging module
const MessagingModule = lazy(() => import('./modules/messaging'));

// Records History module
const RecordsHistoryModule = lazy(() => import('./modules/records-history'));

function FeatureGate({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return enabled ? <>{children}</> : <Navigate to="/" replace />;
}

// Loading fallback component for lazy-loaded modules
function ModuleLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        <span className="text-sm text-gray-500">Loading module...</span>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    document.title = 'XenoCare';
    let iconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      document.head.appendChild(iconLink);
    }
    iconLink.type = 'image/png';
    iconLink.href = APP_ICON;

    setupPersistentQueryCache();
    const cleanupRealtime = setupRealtimeInvalidation();

    const runStartupPrefetch = async () => {
      try {
        await prefetchCommonData();
      } catch (error) {
        log.warn('Startup prefetch failed', { error });
      }
    };

    const runStorageMaintenance = async () => {
      try {
        await runIndexedDbMaintenance();
      } catch (error) {
        log.warn('IndexedDB maintenance failed', { error });
      }
    };

    void runStartupPrefetch();

    void runStorageMaintenance();
    const timer = window.setInterval(
      () => {
        void runStorageMaintenance();
      },
      2 * 60 * 1000,
    );

    return () => {
      window.clearInterval(timer);
      if (cleanupRealtime) cleanupRealtime();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <GuidanceProvider>
          <GlobalLoading />
          <GlobalMutationSyncIndicator />
          <AuthProvider>
            <PatientEncounterProvider>
              <ToastProvider>
                <GlobalNotificationProvider>
                  <EmrNotificationToastStack />
                  <MessageNotificationProvider>
                    <Router>
                      <Suspense fallback={<ModuleLoadingFallback />}>
                        <Routes>
                          {/* Public Route - Login */}
                          <Route path="/login" element={<LoginPage />} />

                          {/* Protected Routes - Require Authentication */}
                          <Route
                            path="/"
                            element={
                              <ProtectedRoute>
                                <Layout />
                              </ProtectedRoute>
                            }
                          >
                            <Route index element={<Dashboard />} />
                            <Route path="profile" element={<Profile />} />
                            <Route
                              path="sync-center"
                              element={
                                <ProtectedRoute>
                                  <SyncCenter />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="registration"
                              element={
                                <ModuleRoute module="registration">
                                  <PatientRegistration />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="encounter"
                              element={
                                <ModuleRoute module="encounter">
                                  <Encounter />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="consultation"
                              element={
                                <ModuleRoute module="consultation">
                                  <ClinicalConsultation />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="specialty-clinic"
                              element={
                                <FeatureGate enabled={isSpecialtyClinicsEnabled()}>
                                  <ModuleRoute module="specialty-clinic">
                                    <SpecialtyClinicPage />
                                  </ModuleRoute>
                                </FeatureGate>
                              }
                            />
                            {/* Unified Medical Records - Accessible to ALL clinicians */}
                            <Route
                              path="medical-records"
                              element={
                                <ModuleRoute module="medical-records">
                                  <MedicalRecordsModule />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="medical-records/:patientId"
                              element={
                                <ModuleRoute module="medical-records">
                                  <EncounterCentricView />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="nursing"
                              element={
                                <ModuleRoute module="nursing">
                                  <NursingCare />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="pharmacy"
                              element={
                                <ModuleRoute module="pharmacy">
                                  <Pharmacy />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="lab"
                              element={
                                <ModuleRoute module="lab">
                                  <Laboratory />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="radiology"
                              element={
                                <ModuleRoute module="radiology">
                                  <Radiology />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="in-patient"
                              element={
                                <ModuleRoute module="in-patient">
                                  <InPatientPage />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="surgery/*"
                              element={
                                <ModuleRoute module="surgery">
                                  <SurgeryModule />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="hygiene/*"
                              element={
                                <FeatureGate enabled={isHygieneFeatureEnabled()}>
                                  <ModuleRoute module="hygiene">
                                    <HygieneModule />
                                  </ModuleRoute>
                                </FeatureGate>
                              }
                            />
                            <Route
                              path="procedures"
                              element={
                                <ModuleRoute module="procedures">
                                  <ProceduresPage />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="clinical-requests"
                              element={
                                <ModuleRoute module="clinical-requests">
                                  <ClinicalRequestsPage />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="ae"
                              element={
                                <FeatureGate enabled={isEmergencyFeatureEnabled()}>
                                  <ModuleRoute module="emergency">
                                    <AeModule />
                                  </ModuleRoute>
                                </FeatureGate>
                              }
                            />
                            <Route
                              path="anc"
                              element={
                                <ModuleRoute module="anc">
                                  <AncModule />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="dental"
                              element={
                                <FeatureGate enabled={isDentalEnabled()}>
                                  <ModuleRoute module="dental">
                                    <DentalPage />
                                  </ModuleRoute>
                                </FeatureGate>
                              }
                            />
                            <Route
                              path="ophthalmology"
                              element={
                                <FeatureGate enabled={isOphthalmologyEnabled()}>
                                  <ModuleRoute module="ophthalmology">
                                    <OphthalmologyPage />
                                  </ModuleRoute>
                                </FeatureGate>
                              }
                            />
                            <Route
                              path="physiotherapy"
                              element={
                                <FeatureGate enabled={isPhysiotherapyEnabled()}>
                                  <ModuleRoute module="physiotherapy">
                                    <PhysiotherapyPage />
                                  </ModuleRoute>
                                </FeatureGate>
                              }
                            />
                            <Route
                              path="nutrition"
                              element={
                                <ModuleRoute module="nutrition">
                                  <NutritionPage />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="specialty-clinic/:specialtyCode?"
                              element={
                                <FeatureGate enabled={isSpecialtyClinicsEnabled()}>
                                  <ModuleRoute module="specialty-clinic">
                                    <SpecialtyClinicPage />
                                  </ModuleRoute>
                                </FeatureGate>
                              }
                            />
                            <Route
                              path="queue"
                              element={
                                <ModuleRoute module="queue">
                                  <QueueManagement />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="billing"
                              element={
                                <ModuleRoute module="billing">
                                  <Billing />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="nhis"
                              element={
                                isNhisFeatureEnabled() ? (
                                  <ModuleRoute module="nhis">
                                    <NhisModule />
                                  </ModuleRoute>
                                ) : (
                                  <Navigate to="/" replace />
                                )
                              }
                            />
                            <Route
                              path="records-history"
                              element={
                                <ModuleRoute module="records-history">
                                  <RecordsHistoryModule />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="analytics"
                              element={
                                <ModuleRoute module="analytics">
                                  <Analytics />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="medical-reports"
                              element={
                                <ModuleRoute module="medical-reports">
                                  <MedicalReports />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="customer-service"
                              element={
                                <ModuleRoute module="customer-service">
                                  <CustomerService />
                                </ModuleRoute>
                              }
                            />
                            {/* Redirect old /cashier route to /billing */}
                            <Route
                              path="cashier"
                              element={<Navigate to="/billing" replace />}
                            />
                            <Route
                              path="inventory"
                              element={
                                <ModuleRoute module="inventory">
                                  <Inventory />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="configurations"
                              element={
                                <ModuleRoute module="configurations">
                                  <Configurations />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="staff"
                              element={
                                <ModuleRoute module="staff">
                                  <StaffList />
                                </ModuleRoute>
                              }
                            />
                            <Route
                              path="messaging"
                              element={
                                <ProtectedRoute>
                                  <MessagingModule />
                                </ProtectedRoute>
                              }
                            />
                          </Route>

                          {/* Catch all - redirect to login */}
                          <Route
                            path="*"
                            element={<Navigate to="/login" replace />}
                          />
                        </Routes>
                      </Suspense>
                    </Router>
                  </MessageNotificationProvider>
                </GlobalNotificationProvider>
              </ToastProvider>
            </PatientEncounterProvider>
          </AuthProvider>
        </GuidanceProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
