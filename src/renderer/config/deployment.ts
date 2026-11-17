/**
 * Deployment-specific identity for MUHEDA CLINIC.
 *
 * The application brand remains XenoCare/XenoCare. These values only describe
 * the facility that owns this installation and are used as a safe fallback
 * until the facility row is loaded from the database.
 */
export const DEPLOYMENT = {
  facilityCode: 'MHC',
  facilityName: 'MUHEDA CLINIC',
  facilityShortName: 'MUHEDA',
  facilityType: 'clinic',
  address: 'Jos, Plateau State',
  city: '',
  state: '',
  country: 'Nigeria',
  emrPrefix: 'MHC',
  emrPadding: 6,
} as const;

export const DEPLOYMENT_FACILITY_ADDRESS = [
  DEPLOYMENT.address,
  DEPLOYMENT.city,
  DEPLOYMENT.state,
  DEPLOYMENT.country,
]
  .filter(Boolean)
  .join(', ');
