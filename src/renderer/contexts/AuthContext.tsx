import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';
import {
  QUERY_CACHE_OWNER_KEY,
  clearPersistedQueryCache,
  queryClient as globalQueryClient,
} from '../api/queryClient';
import { Staff, UserRole } from '../types';
import { clearSessionData } from '../lib/cacheLayer';
import { clearFacilityInfoCache, loadFacilityInfo } from '../lib/facility';
import {
  getImagingCatalogue,
  getDrugCatalogue,
  getProcedureCatalogue,
  getLabTestCatalogue,
} from '../modules/clinical-consultation/api/consultation.api';
import { consultationKeys } from '../modules/clinical-consultation/hooks/useConsultation';
import { createScopedLogger } from '../utils/logger';
import {
  isEmergencyFeatureEnabled,
  isHygieneFeatureEnabled,
  isNhisFeatureEnabled,
  isSpecialtyModuleEnabled,
  SPECIALTY_CLINIC_MODULES,
} from '../config/features';

const log = createScopedLogger('Auth');

// =============================================================================
const HEARTBEAT_INTERVAL_MS = 1000 * 60 * 2;
// Types
// =============================================================================

interface AuthState {
  user: User | null;
  session: Session | null;
  staff: Staff | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  canAccessModule: (module: string) => boolean;
  canAccessConsultation: () => boolean;
  isGOPDDoctor: () => boolean;
  isSpecialist: (specialty?: string) => boolean;
  refreshStaff: () => Promise<void>;
}

// =============================================================================
// Module Access Mapping
// =============================================================================

// Departments that can access GOPD Consultation
export const GOPD_DEPARTMENTS = [
  'GOPD',
  'GOPD Clinic',
  'General Practice',
  'Internal Medicine',
  'Family Medicine',
  'General Outpatient',
  'OPD',
];

export const AE_DEPARTMENTS = [
  'Emergency',
  'Accident and Emergency',
  'Accident & Emergency',
  'A&E',
  'Emergency Medicine',
];

// Specialty departments (not GOPD)
export const SPECIALTY_DEPARTMENTS = [
  'Radiology',
  'Laboratory',
  'Physiotherapy',
  'Dental',
  'Ophthalmology',
  'Surgery',
  'Orthopaedics',
  'ENT',
  'Cardiology',
  'Neurology',
  'Neuropsychiatry',
  'Psychiatry',
  'Dermatology',
  'Paediatrics',
  'Obstetrics',
  'Gynaecology',
];

export const MODULE_ACCESS: Record<string, UserRole[]> = {
  dashboard: [
    'super_admin',
    'admin',
    'medical_director',
    'doctor',
    'nurse',
    'receptionist',
    'lab_technician',
    'radiologist',
    'pharmacist',
    'billing_clerk',
    'cashier',
    'customer_service',
    'inventory_manager',
    'config_admin',
  ],
  registration: [
    'super_admin',
    'admin',
    'medical_director',
    'nurse',
    'receptionist',
  ],
  encounter: [
    'super_admin',
    'admin',
    'medical_director',
    'doctor',
    'nurse',
    'receptionist',
  ],
  // Medical Records: Unified patient records for ALL clinicians
  'medical-records': [
    'super_admin',
    'admin',
    'medical_director',
    'doctor',
    'nurse',
    'lab_technician',
    'radiologist',
    'pharmacist',
    'billing_clerk',
    'cashier',
  ],
  // Consultation: GOPD doctors only (department check done separately)
  consultation: ['super_admin', 'admin', 'medical_director', 'doctor'],
  // Specialty Clinic: SOPD doctors (non-GOPD) - department check done separately
  'specialty-clinic': ['super_admin', 'admin', 'medical_director', 'doctor'],
  nursing: ['super_admin', 'admin', 'medical_director', 'nurse'],
  lab: ['super_admin', 'admin', 'medical_director', 'lab_technician'],
  radiology: ['super_admin', 'admin', 'medical_director', 'radiologist'],
  'in-patient': ['super_admin', 'admin', 'medical_director', 'doctor', 'nurse'],
  // Surgery/Theatre Module
  surgery: ['super_admin', 'admin', 'medical_director', 'doctor', 'nurse'],
  // Hygiene & Infection Control Module
  hygiene: ['super_admin', 'admin', 'medical_director', 'nurse'],
  procedures: ['super_admin', 'admin', 'medical_director', 'doctor', 'nurse'],
  // Dental: Only dentists and admins
  dental: [
    'super_admin',
    'admin',
    'medical_director',
    'doctor', // Will be filtered by department
  ],
  // Ophthalmology: Only ophthalmologists and admins
  ophthalmology: [
    'super_admin',
    'admin',
    'medical_director',
    'doctor', // Will be filtered by department
  ],
  // Physiotherapy: Only physiotherapists and admins
  physiotherapy: [
    'super_admin',
    'admin',
    'medical_director',
    'doctor', // Will be filtered by department
    'nurse', // Physio nurses
  ],
  nutrition: ['super_admin', 'admin', 'medical_director', 'nurse'],
  'clinical-requests': [
    'super_admin',
    'admin',
    'medical_director',
    'nurse',
    'receptionist',
  ],
  pharmacy: ['super_admin', 'admin', 'medical_director', 'pharmacist'],
  queue: [
    'super_admin',
    'admin',
    'receptionist',
    'nurse',
    'doctor',
    'lab_technician',
    'radiologist',
    'pharmacist',
    'billing_clerk',
    'cashier',
    'customer_service',
  ],
  billing: ['super_admin', 'admin', 'billing_clerk', 'cashier'],
  'customer-service': [
    'super_admin',
    'admin',
    'customer_service',
    'receptionist',
  ],
  'medical-reports': [
    'super_admin',
    'admin',
    'medical_director',
    'doctor',
    'nurse',
  ],
  inventory: ['super_admin', 'admin', 'inventory_manager'],
  configurations: ['super_admin', 'admin', 'config_admin'],
  staff: ['super_admin', 'admin', 'medical_director', 'config_admin'],
  // Messaging: All authenticated staff can access messaging
  messaging: [
    'super_admin',
    'admin',
    'medical_director',
    'doctor',
    'nurse',
    'receptionist',
    'lab_technician',
    'radiologist',
    'pharmacist',
    'billing_clerk',
    'cashier',
    'customer_service',
    'inventory_manager',
    'config_admin',
  ],
  analytics: ['super_admin', 'admin', 'medical_director'],
  // Records History: Admin-level access for browsing and exporting all clinical records
  'records-history': ['super_admin', 'admin', 'medical_director'],
  admin: ['super_admin', 'admin'],
  // NHIS Module
  nhis: [
    'super_admin',
    'admin',
    'medical_director',
    'nurse',
    'billing_clerk',
    'cashier',
    'receptionist',
  ],
  // Accident & Emergency Module
  emergency: ['super_admin', 'admin', 'medical_director', 'doctor', 'nurse'],
  // Antenatal Care Module
  // Full: OBGYN/ANC doctors, midwives/nurses. Limited: emergency (read-only pregnancy data).
  // Admin: receptionist for encounter creation & scheduling.
  anc: [
    'super_admin',
    'admin',
    'medical_director',
    'doctor',
    'nurse',
    'receptionist',
  ],
};

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =============================================================================
// Provider
// =============================================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  // Guard flag: prevents session re-fetch after signOut (avoids re-login race)
  const isSigningOutRef = useRef(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // 1. Query for Session
  const { data: sessionData, isLoading: isSessionLoading } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      // If we're in the middle of signing out, return null immediately
      // This prevents the query from re-fetching a stale session
      if (isSigningOutRef.current) {
        return null;
      }
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
      } catch (err) {
        // Network errors during session check are not fatal — the user
        // simply isn't authenticated yet.  Return null so the app renders
        // the login screen instead of crashing.
        if (
          err instanceof Error &&
          (err.name === 'AbortError' ||
            err.name === 'TimeoutError' ||
            err.message.toLowerCase().includes('failed to fetch') ||
            err.message.toLowerCase().includes('networkerror') ||
            err.message.toLowerCase().includes('connection refused') ||
            err.message.toLowerCase().includes('aborted') ||
            err.message.toLowerCase().includes('net::err_'))
        ) {
          console.warn(
            '[Auth] Network error during session check, treating as unauthenticated:',
            err.message,
          );
          return null;
        }
        throw err;
      }
    },
    // Auth state must reflect the current session immediately. Reusing
    // previous query data during key transitions causes login redirects to
    // evaluate against stale pre-login state until a full reload.
    placeholderData: () => undefined,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // 2. Query for Staff (dependent on session)
  const { data: staff, isLoading: isStaffLoading } = useQuery({
    queryKey: ['auth', 'staff', sessionData?.user?.id],
    queryFn: async () => {
      if (!sessionData?.user?.id) return null;

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('user_id', sessionData.user.id)
        .single();

      if (error) throw error;
      return data as Staff;
    },
    enabled: !!sessionData?.user?.id,
    // Do not inherit previous auth-scoped data here. The global query client
    // uses placeholderData: previousData for UX, but auth guards need precise
    // current-user state rather than transitional placeholder values.
    placeholderData: () => undefined,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  // 3. Auth State Subscription
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore events while signing out to prevent race conditions
      if (isSigningOutRef.current) {
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        queryClient.setQueryData(['auth', 'session'], session);
        queryClient.invalidateQueries({ queryKey: ['auth', 'staff'] });
        // Remove any pre-auth empty catalogue data from the in-memory cache
        // so they are fully refetched (not just marked stale) with the
        // authenticated JWT. Pairs with enabled: !!staff?.staff_id guards on
        // each catalogue hook to prevent pre-login fetches entirely.
        queryClient.removeQueries({ queryKey: ['catalogues'] });
        queryClient.removeQueries({ queryKey: ['radiology', 'catalogue'] });
        // Warm up all 4 order catalogues immediately after login so the first
        // wizard open is instant rather than showing a loading spinner.
        // Promise.allSettled — failures are silent (components will refetch).
        if (event === 'SIGNED_IN') {
          void Promise.allSettled([
            globalQueryClient.prefetchQuery({
              queryKey: consultationKeys.catalogues.imaging,
              queryFn: getImagingCatalogue,
              staleTime: 0,
            }),
            globalQueryClient.prefetchQuery({
              queryKey: consultationKeys.catalogues.lab,
              queryFn: getLabTestCatalogue,
              staleTime: 0,
            }),
            globalQueryClient.prefetchQuery({
              queryKey: consultationKeys.catalogues.procedures,
              queryFn: getProcedureCatalogue,
              staleTime: 0,
            }),
            globalQueryClient.prefetchQuery({
              queryKey: consultationKeys.catalogues.drugs,
              queryFn: getDrugCatalogue,
              staleTime: 0,
            }),
          ]);
        }
      } else if (event === 'SIGNED_OUT') {
        queryClient.setQueryData(['auth', 'session'], null);
        queryClient.removeQueries({ queryKey: ['auth', 'staff'] });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Derived State
  const hasUsableStaff = Boolean(staff);
  const isLoading =
    isSigningIn ||
    isSessionLoading ||
    (Boolean(sessionData?.user) && !hasUsableStaff && isStaffLoading);
  const isAuthenticated = Boolean(sessionData?.user) && hasUsableStaff;

  useEffect(() => {
    if (isSigningIn && isAuthenticated) {
      setIsSigningIn(false);
    }
  }, [isSigningIn, isAuthenticated]);

  // Ensure persisted query cache remains isolated per authenticated user.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userId = sessionData?.user?.id;
    if (!userId) return;

    const previousOwner = window.localStorage.getItem(QUERY_CACHE_OWNER_KEY);
    if (previousOwner && previousOwner !== userId) {
      // Different user logged in — wipe the React Query snapshot so
      // User B never sees User A's data from the persisted cache.
      clearPersistedQueryCache();
      queryClient.clear();
    }

    window.localStorage.setItem(QUERY_CACHE_OWNER_KEY, userId);
  }, [sessionData?.user?.id, queryClient]);

  // 4. Heartbeat for online status tracking
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatAtRef = useRef<number>(0);

  useEffect(() => {
    if (!staff?.id) return;

    const sendHeartbeat = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastHeartbeatAtRef.current < HEARTBEAT_INTERVAL_MS) {
        return;
      }

      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      lastHeartbeatAtRef.current = now;
      await supabase
        .from('staff')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', staff.id);
    };

    const onVisibilityOrFocus = () => {
      void sendHeartbeat(false);
    };

    // Send one immediate heartbeat on login to mark active quickly.
    void sendHeartbeat(true);

    // Warm the facility-info cache so print/PDF templates can use it sync.
    void loadFacilityInfo();

    heartbeatRef.current = setInterval(() => {
      void sendHeartbeat(false);
    }, HEARTBEAT_INTERVAL_MS);

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onVisibilityOrFocus);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityOrFocus);
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onVisibilityOrFocus);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      }
    };
  }, [staff?.id]);

  // Sign in
  const signIn = async (email: string, password: string) => {
    setIsSigningIn(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const signedInUserId = data.session?.user?.id;
      if (signedInUserId && typeof window !== 'undefined') {
        const previousOwner = window.localStorage.getItem(
          QUERY_CACHE_OWNER_KEY,
        );
        if (previousOwner && previousOwner !== signedInUserId) {
          clearPersistedQueryCache();
          queryClient.clear();
        }
        window.localStorage.setItem(QUERY_CACHE_OWNER_KEY, signedInUserId);
      }

      // Fetch staff record BEFORE touching the cache so both session and
      // staff can be written synchronously in one batch.  This avoids the
      // intermediate render where session exists but staff doesn't (which
      // makes isLoading=true and shows the login skeleton).
      let staffRecord: Staff | null = null;
      if (signedInUserId) {
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('user_id', signedInUserId)
          .single();
        if (staffError) throw staffError;
        staffRecord = staffData as Staff;
      }

      // Write both session AND staff into cache synchronously so the very
      // next React render sees isAuthenticated=true.  setQueryData is
      // synchronous — no intermediate loading state.
      queryClient.setQueryData(['auth', 'session'], data.session);
      if (signedInUserId && staffRecord) {
        queryClient.setQueryData(
          ['auth', 'staff', signedInUserId],
          staffRecord,
        );
      }

      // Update last login (fire-and-forget)
      void supabase
        .from('staff')
        .update({ last_login: new Date().toISOString() })
        .eq('email', email);

      return { error: null };
    } catch (error) {
      setIsSigningIn(false);
      log.error('[AuthContext] signIn error:', error);
      return { error: error as Error };
    }
  };

  // Sign out - robust cleanup that prevents re-login race condition
  const signOut = async () => {
    // 1. Set guard FIRST to prevent session query from re-fetching
    isSigningOutRef.current = true;

    // 2. Immediately clear React Query auth state (prevents UI flash)
    queryClient.setQueryData(['auth', 'session'], null);
    queryClient.removeQueries({ queryKey: ['auth', 'staff'] });

    // 3. Sign out from Supabase using 'local' scope (avoids 403 on global)
    // This clears in-memory session + localStorage tokens
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      log.warn('[AuthContext] signOut error (proceeding with cleanup)', {
        error: err,
      });
    }

    // 4. Clear auth-scoped volatile cache, but keep persisted non-volatile data
    // for fast same-user re-login experience.
    queryClient.removeQueries({ queryKey: ['auth'] });
    queryClient.removeQueries({ queryKey: ['notifications'] });
    queryClient.removeQueries({ queryKey: ['messaging'] });
    log.info('[AuthContext] Cleared auth/notification cache on logout');

    // 5. Selectively clear session data from in-memory cache AND all
    // user-specific IndexedDB named stores so a subsequent user on the same
    // machine never sees this user's patients, encounters, orders, or billing.
    clearSessionData();
    clearFacilityInfoCache();

    // 6. Reset the guard after a brief delay (allows clean re-login later)
    setTimeout(() => {
      isSigningOutRef.current = false;
    }, 500);

    // Skip health check in dev mode (env vars present)
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      return;
    }

    // Trigger server health check on logout (production only)
    // This ensures the setup screen shows if server has become unreachable
    try {
      if (window.electron?.serverConfig) {
        const healthResult = await window.electron.serverConfig.healthCheck();
        if (!healthResult.success) {
          log.warn(
            '[AuthContext] Server unreachable on logout, will show setup screen',
          );
          // The ConfigContext will handle showing the setup screen on reload
          setTimeout(() => window.location.reload(), 100);
        }
      }
    } catch (err) {
      log.error('[AuthContext] Health check on logout failed', err);
    }
  };

  // Check role
  const hasRole = useCallback(
    (roles: UserRole | UserRole[]): boolean => {
      if (!staff) return false;
      const roleArray = Array.isArray(roles) ? roles : [roles];
      return roleArray.includes(staff.role);
    },
    [staff],
  );

  // Check if user is a GOPD doctor (can access Consultation)
  const isGOPDDoctor = useCallback((): boolean => {
    if (!staff) return false;

    // Super admin, admin, medical_director always have access
    if (['super_admin', 'admin', 'medical_director'].includes(staff.role)) {
      return true;
    }

    // For doctors, check department and specialty
    if (staff.role === 'doctor') {
      const userDept = staff.department?.toLowerCase() || '';
      const userSpecialty = (staff.specialty_code || '').toUpperCase();

      // Explicit GOPD department match
      if (
        GOPD_DEPARTMENTS.some(
          (dept) =>
            userDept.includes(dept.toLowerCase()) ||
            dept.toLowerCase().includes(userDept),
        )
      ) {
        return true;
      }

      // Explicitly A&E → not GOPD
      if (AE_DEPARTMENTS.some((d) => userDept.includes(d.toLowerCase()))) {
        return false;
      }
      if (userSpecialty === 'EMERGENCY') {
        return false;
      }

      // All other doctors (including specialists) can access GOPD Consultation
      // GOPD is the default and most common workflow
      return true;
    }

    return false;
  }, [staff]);

  // Check if user can access GOPD Consultation module
  const canAccessConsultation = useCallback((): boolean => {
    return isGOPDDoctor();
  }, [isGOPDDoctor]);

  // Check if user is a specialist (not GOPD)
  const isSpecialist = useCallback(
    (specialty?: string): boolean => {
      if (!staff) return false;

      // Only doctors can be specialists
      if (staff.role !== 'doctor') return false;

      const userSpecialtyCode = (staff.specialty_code || '').toLowerCase();
      const userDept = staff.department?.toLowerCase() || '';

      // If specific specialty requested, check for match
      if (specialty) {
        const specialtyLower = specialty.toLowerCase();
        return (
          userSpecialtyCode === specialtyLower ||
          userDept.includes(specialtyLower)
        );
      }

      // Primary check: explicit specialty assignment from staff profile.
      if (staff.specialty_code) {
        return true;
      }

      // Fallback: infer from department name for legacy records.
      return SPECIALTY_DEPARTMENTS.some((dept) =>
        userDept.includes(dept.toLowerCase()),
      );
    },
    [staff],
  );

  // Check module access with department awareness
  const canAccessModule = useCallback(
    (module: string): boolean => {
      if (!staff) return false;
      const allowedRoles = MODULE_ACCESS[module];
      if (!allowedRoles) return false;

      // Feature-flagged surfaces are unavailable regardless of role.
      if (
        (SPECIALTY_CLINIC_MODULES as readonly string[]).includes(module) &&
        !isSpecialtyModuleEnabled(module)
      ) {
        return false;
      }
      if (!isNhisFeatureEnabled() && module === 'nhis') return false;
      if (!isEmergencyFeatureEnabled() && module === 'emergency') return false;
      if (!isHygieneFeatureEnabled() && module === 'hygiene') return false;

      // Basic role check
      if (!allowedRoles.includes(staff.role)) return false;

      // Department-specific checks for certain modules
      switch (module) {
        case 'consultation':
          // Only GOPD doctors can access consultation
          return isGOPDDoctor();

        case 'specialty-clinic':
          // Specialty clinic is for SOPD (non-GOPD) doctors
          // Admins, medical directors can always access
          if (['super_admin', 'admin', 'medical_director'].includes(staff.role))
            return true;
          // Doctors in specialty departments (SOPD)
          if (staff.role === 'doctor') {
            // Assigned specialty_code is authoritative for specialty-clinic access.
            if (staff.specialty_code) {
              return true;
            }

            // Legacy fallback for records without specialty_code.
            return !isGOPDDoctor() || isSpecialist();
          }
          return false;

        case 'dental':
          // Admins and dental department
          if (['super_admin', 'admin', 'medical_director'].includes(staff.role))
            return true;
          if (staff.role === 'doctor') {
            const specialtyCode = (staff.specialty_code || '').toUpperCase();
            const department = staff.department?.toLowerCase() || '';
            return (
              specialtyCode === 'DENTAL' ||
              specialtyCode === 'ORAL_AND_MAXILLOFACIAL_SURGERY' ||
              department.includes('dental')
            );
          }
          return false;

        case 'ophthalmology':
          // Admins and ophthalmology department
          if (['super_admin', 'admin', 'medical_director'].includes(staff.role))
            return true;
          if (staff.role === 'doctor') {
            const specialtyCode = (staff.specialty_code || '').toUpperCase();
            const dept = staff.department?.toLowerCase() || '';
            return (
              specialtyCode === 'OPHTHALMOLOGY' ||
              dept.includes('ophthalmology') ||
              dept.includes('eye')
            );
          }
          return false;

        case 'physiotherapy':
          // Admins and physiotherapy department
          if (['super_admin', 'admin', 'medical_director'].includes(staff.role))
            return true;
          if (staff.role === 'doctor' || staff.role === 'nurse') {
            const specialtyCode = (staff.specialty_code || '').toUpperCase();
            const dept = staff.department?.toLowerCase() || '';
            return (
              specialtyCode === 'PHYSIOTHERAPY' ||
              dept.includes('physio') ||
              dept.includes('rehabilitation')
            );
          }
          return false;

        default:
          return true;
      }
    },
    [staff, isGOPDDoctor, isSpecialist],
  );

  // Refresh staff details
  const refreshStaff = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'staff'] });
  }, [queryClient]);

  const value = useMemo<AuthContextType>(
    () => ({
      user: sessionData?.user || null,
      session: sessionData || null,
      staff: staff || null,
      isLoading,
      isAuthenticated,
      signIn,
      signOut,
      hasRole,
      canAccessModule,
      canAccessConsultation,
      isGOPDDoctor,
      isSpecialist,
      refreshStaff,
    }),
    [
      sessionData,
      staff,
      isLoading,
      isAuthenticated,
      hasRole,
      canAccessModule,
      canAccessConsultation,
      isGOPDDoctor,
      isSpecialist,
      refreshStaff,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// =============================================================================
// Role Check Hook
// =============================================================================

export function useRole(roles: UserRole | UserRole[]): boolean {
  const { hasRole } = useAuth();
  return hasRole(roles);
}

// =============================================================================
// Module Access Hook
// =============================================================================

export function useModuleAccess(module: string): boolean {
  const { canAccessModule } = useAuth();
  return canAccessModule(module);
}

// =============================================================================
// GOPD/Consultation Access Hook
// =============================================================================

export function useGOPDAccess(): boolean {
  const { isGOPDDoctor } = useAuth();
  return isGOPDDoctor();
}

// =============================================================================
// Specialist Access Hook
// =============================================================================

export function useSpecialistAccess(specialty?: string): boolean {
  const { isSpecialist } = useAuth();
  return isSpecialist(specialty);
}
