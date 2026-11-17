/**
 * =============================================================================
 * XenoCare — Facility Info (configurable facility identity)
 *
 * The facility (hospital/clinic) name shown on printed documents, receipts and
 * report headers is configurable: it comes from the default row of the
 * `facilities` table and can be edited in Configurations → Facility Settings.
 *
 * Print templates are synchronous, so this module keeps a warmed in-memory
 * cache (loaded after login and after settings edits). Sync getters fall back
 * to the XenoCare app brand until the facility row has loaded.
 * =============================================================================
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';
import {
  APP_FULL_NAME,
  DEFAULT_FACILITY_TAGLINE,
  FACILITY_BRAND_COLORS,
  FacilityBrand,
} from '../shared/constants/branding';
import { createScopedLogger } from '../utils/logger';
import { DEPLOYMENT } from '../config/deployment';

const log = createScopedLogger('Facility');

export interface FacilityInfo {
  id: string | null;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  website: string;
}

const DEFAULT_FACILITY_INFO: FacilityInfo = {
  id: null,
  name: DEPLOYMENT.facilityName,
  address: DEPLOYMENT.address,
  city: DEPLOYMENT.city,
  state: DEPLOYMENT.state,
  country: DEPLOYMENT.country,
  phone: '',
  email: '',
  website: '',
};

let cachedFacility: FacilityInfo | null = null;
let inflight: Promise<FacilityInfo> | null = null;

interface FacilityRow {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

function mapRow(row: FacilityRow): FacilityInfo {
  return {
    id: row.id,
    name: row.name || DEPLOYMENT.facilityName,
    address: row.address || DEPLOYMENT.address,
    city: row.city || DEPLOYMENT.city,
    state: row.state || DEPLOYMENT.state,
    country: row.country || DEPLOYMENT.country,
    phone: row.phone || '',
    email: row.email || '',
    website: row.website || '',
  };
}

/**
 * Fetch the default facility and warm the sync cache.
 * Safe to call repeatedly; concurrent calls share one request.
 */
export function loadFacilityInfo(force = false): Promise<FacilityInfo> {
  if (cachedFacility && !force) return Promise.resolve(cachedFacility);
  if (inflight && !force) return inflight;

  inflight = (async () => {
    try {
      const { data: preferredFacility, error: preferredError } = await supabase
        .from('facilities')
        .select('id, name, address, city, state, country, phone, email, website')
        .eq('is_active', true)
        .eq('code', DEPLOYMENT.facilityCode)
        .maybeSingle();

      if (preferredError) throw preferredError;

      let facilityRow = preferredFacility as FacilityRow | null;
      if (!facilityRow) {
        const { data: fallbackFacility, error: fallbackError } = await supabase
          .from('facilities')
          .select(
            'id, name, address, city, state, country, phone, email, website',
          )
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (fallbackError) throw fallbackError;
        facilityRow = (fallbackFacility as FacilityRow | null) ?? null;
      }

      cachedFacility = facilityRow ? mapRow(facilityRow) : DEFAULT_FACILITY_INFO;
    } catch (err) {
      log.warn('Could not load facility info, using app brand fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
      cachedFacility = cachedFacility ?? DEFAULT_FACILITY_INFO;
    } finally {
      inflight = null;
    }
    return cachedFacility as FacilityInfo;
  })();

  return inflight;
}

/** Update the cache directly (e.g. right after saving Facility Settings). */
export function setFacilityInfoCache(info: FacilityInfo): void {
  cachedFacility = info;
}

/** Clear the cache (e.g. on sign-out). */
export function clearFacilityInfoCache(): void {
  cachedFacility = null;
}

/** Synchronous accessor for print/PDF templates. Warmed after login. */
export function getFacilityInfo(): FacilityInfo {
  return cachedFacility ?? DEFAULT_FACILITY_INFO;
}

/** Facility display name (falls back to the XenoCare app name). */
export function getFacilityName(): string {
  return getFacilityInfo().name;
}

/** Full postal-style address composed from the facility row parts. */
export function getFacilityAddress(): string {
  const info = getFacilityInfo();
  return [info.address, info.city, info.state, info.country]
    .filter(Boolean)
    .join(', ');
}

/**
 * Facility brand object for print/export templates (same shape as the
 * legacy hardcoded brand it replaces).
 */
export function getFacilityBrand(logo = ''): FacilityBrand {
  const info = getFacilityInfo();
  return {
    name: info.name,
    fullName: info.name,
    tagline: DEFAULT_FACILITY_TAGLINE,
    address: getFacilityAddress(),
    phone: info.phone,
    email: info.email,
    website: info.website,
    colors: FACILITY_BRAND_COLORS,
    logo,
  };
}

export const facilityQueryKeys = {
  info: ['facility-info'] as const,
};

/** React hook for components that render the facility identity. */
export function useFacilityInfo(): {
  facility: FacilityInfo;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: facilityQueryKeys.info,
    queryFn: () => loadFacilityInfo(true),
    staleTime: 5 * 60 * 1000,
  });

  return {
    facility: data ?? cachedFacility ?? DEFAULT_FACILITY_INFO,
    isLoading,
  };
}

/** Full app title used for browser/Electron window titles. */
export const APP_WINDOW_TITLE = APP_FULL_NAME;
