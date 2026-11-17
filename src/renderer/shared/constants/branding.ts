/**
 * =============================================================================
 * XenoCare — Central Application Branding
 *
 * Single source of truth for the APPLICATION brand (the software product).
 * The FACILITY brand (the hospital/clinic using the software) is configurable
 * and lives in src/renderer/lib/facility.ts — printed documents should use
 * the facility info, app chrome (login, sidebar, titles) uses these constants.
 * =============================================================================
 */

export const APP_NAME = 'XenoCare';
export const APP_NAME_UPPER = 'XENOCARE';
export const APP_FULL_NAME = 'XenoCare';
export const APP_TAGLINE = 'Clinical systems, connected.';
export const APP_VENDOR = 'XenoCare';
export const APP_VENDOR_SHORT = 'XenoCare';
export const APP_POWERED_BY = 'XenoCare';
export const APP_WEBSITE = '';

/**
 * XenoCare conventional palette (from the corporate wordmark):
 * deep navy is the primary brand colour, orange is the accent.
 */
export const APP_PRIMARY_COLOR_RGB: [number, number, number] = [17, 21, 28];
export const APP_PRIMARY_COLOR_HEX = '#11151C';
export const APP_ACCENT_COLOR_RGB: [number, number, number] = [255, 90, 31];
export const APP_ACCENT_COLOR_HEX = '#E9783F';

/** Clinical green retained by existing document themes (RGB for jsPDF). */
export const APP_BRAND_COLOR_RGB: [number, number, number] = [22, 101, 52];
export const APP_BRAND_COLOR_HEX = '#166534';

/**
 * Shape shared by facility-aware print/export templates.
 * Values come from getFacilityBrand() in lib/facility.ts.
 */
export interface FacilityBrand {
  /** Short facility name, e.g. "XenoCare Medical Centre" */
  name: string;
  /** Full/official facility name */
  fullName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    text: string;
    textLight: string;
    background: string;
    border: string;
  };
  /** Logo URL for print/export headers (may be empty). */
  logo: string;
}

export const DEFAULT_FACILITY_TAGLINE = 'Excellence in Healthcare';

export const FACILITY_BRAND_COLORS: FacilityBrand['colors'] = {
  primary: '#166534', // Green-800 — existing clinical document palette
  secondary: '#15803d', // Green-700
  accent: '#22c55e', // Green-500
  success: '#16a34a', // Green-600 (semantic)
  warning: '#D96A36', // Orange-600 (semantic)
  danger: '#dc2626', // Red-600 (semantic)
  text: '#111827', // Gray-900
  textLight: '#6b7280', // Gray-500
  background: '#ffffff',
  border: '#e5e7eb', // Gray-200
};
