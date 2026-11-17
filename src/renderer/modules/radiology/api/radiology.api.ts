import { supabase } from '../../../api/supabaseClient';
import {
  RadiologyRequestDTO,
  ImagingDTO,
  UpdateRadiologyRequestDTO,
  RadiologyRequestFilters,
  RadiologyStats,
  RadiologyRequestStatus,
  UploadScanImageDTO,
  CreateScanResultDTO,
  ScanImageDTO,
  normalizeImagingModality,
} from '../dtos/radiology.dto';
import { Staff, ImagingCatalogue } from '../../../types/database.types';
import { validateEncounterForModification } from '../../../lib/encounter/validation';
import { auditCreate, auditUpdate } from '../../../lib/audit';
import { createBillingOrder } from '../../billing/api/billing-order.api';
import { calculateNhisServiceCoverage } from '../../billing/utils/coverage.utils';
import { requestDeduper, DedupeKeys } from '../../../lib/requestDeduplication';

// =============================================================================
// Encounter Validation Helper
// =============================================================================

async function ensureEncounterActive(encounterId: string): Promise<void> {
  const validation = await validateEncounterForModification(encounterId);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Cannot modify data on this encounter');
  }
}

// =============================================================================
// Payment Verification Helper
// =============================================================================

const PAID_STATUSES = ['Paid', 'Paid_NHIS', 'Paid_Retainership'];

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function pickBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizeApiModality(
  modality: string | null | undefined,
): ImagingCatalogue['imaging_type'] {
  const normalized = normalizeImagingModality(modality);
  if (normalized) {
    return normalized;
  }

  if (!modality) {
    return 'Other';
  }

  return modality as ImagingCatalogue['imaging_type'];
}

export function normalizeImagingCatalogueRecord(
  item: Partial<ImagingDTO> & Record<string, unknown>,
): ImagingDTO | null {
  const imagingId = pickString(item.imaging_id, item.scan_id, item.id);
  const imagingName = pickString(
    item.imaging_name,
    item.scan_name,
    item.name,
    item.examination_name,
  );

  if (!imagingId || !imagingName) {
    return null;
  }

  const imagingCode =
    pickString(item.imaging_code, item.scan_code, item.code) || '';
  const imagingType = normalizeApiModality(
    pickString(item.imaging_type, item.scan_type, item.modality),
  );
  const price = pickNumber(item.price, item.cost) ?? 0;
  const nhisEligible =
    pickBoolean(item.nhis_eligible, item.nhis_covered, item.is_nhis_covered) ||
    false;
  const createdAt = pickString(item.created_at) || new Date().toISOString();
  const updatedAt = pickString(item.updated_at) || createdAt;
  const durationMinutes = pickNumber(item.duration_minutes) ?? 0;
  const nhisPercentage = pickNumber(item.nhis_percentage);
  const requiresNhisAuthorization = pickBoolean(
    item.requires_nhis_authorization,
  );

  return {
    imaging_id: imagingId,
    imaging_code: imagingCode,
    imaging_name: imagingName,
    imaging_type: imagingType,
    category: pickString(item.category) ?? null,
    body_part: pickString(item.body_part) ?? null,
    description: pickString(item.description) ?? null,
    preparation_instructions:
      pickString(item.preparation_instructions) ?? null,
    price,
    nhis_eligible: nhisEligible,
    nhis_percentage,
    duration_minutes: durationMinutes,
    is_active: pickBoolean(item.is_active) ?? true,
    requires_nhis_authorization: requiresNhisAuthorization,
    created_at: createdAt,
    updated_at: updatedAt,
    scan_id: imagingId,
    scan_code: imagingCode || undefined,
    scan_name: imagingName,
    scan_type: imagingType,
    cost: price,
    nhis_covered: nhisEligible,
  };
}

/**
 * Check if payment has been verified for a radiology request.
 * Looks up billing_items by service_reference_id and checks billing_order status.
 */
async function ensurePaymentVerified(requestId: string): Promise<void> {
  // Find billing item linked to this request
  const { data: billingItem, error: itemError } = await supabase
    .from('billing_items')
    .select('billing_order_id')
    .eq('service_reference_id', requestId)
    .maybeSingle();

  if (itemError) {
    console.error('Error checking billing item:', itemError);
    throw new Error('Unable to verify payment status. Please try again.');
  }

  // Billing must exist before scan workflow can proceed.
  if (!billingItem?.billing_order_id) {
    throw new Error(
      'No billing record found for this imaging request. Approve/accept request and complete billing first.',
    );
  }

  // Check if the billing order is paid
  const { data: billingOrder, error: orderError } = await supabase
    .from('billing_orders')
    .select('status')
    .eq('id', billingItem.billing_order_id)
    .single();

  if (orderError) {
    console.error('Error checking billing order:', orderError);
    throw new Error('Unable to verify payment status. Please try again.');
  }

  // Only block if billing exists but is not paid
  if (billingOrder && !PAID_STATUSES.includes(billingOrder.status)) {
    throw new Error(
      'Payment required. Please verify payment before proceeding with imaging.',
    );
  }
}

// All FK joins removed - PostgREST schema cache doesn't detect relationships properly
// Patient and staff data are hydrated separately after fetching
const RADIOLOGY_REQUEST_SELECT = `*`;

const RADIOLOGY_REQUEST_DETAIL_SELECT = `*`;

const STAFF_PROFILE_SELECT = `*`;

// Helper to check if a string is a valid UUID format
function isUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const isMissingTableError = (error: any, tableName: string) => {
  const message = String(error?.message || '');
  return (
    error?.code === '42P01' ||
    error?.status === 404 ||
    message.includes('does not exist') ||
    message.includes(tableName)
  );
};

const fetchStaffByUser = async (userId: string, email?: string) => {
  const { data: staffRecord, error: staffError } = await supabase
    .from('staff')
    .select('id, staff_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (staffError) throw staffError;
  if (staffRecord) return staffRecord;

  if (email) {
    const { data: emailRecord, error: emailError } = await supabase
      .from('staff')
      .select('id, staff_id, role')
      .eq('email', email)
      .maybeSingle();

    if (emailError) throw emailError;
    return emailRecord || null;
  }

  return null;
};

/**
 * Hydrate radiology requests with patient data
 * Workaround for PostgREST FK relationship detection issues
 */
async function hydrateRadiologyPatients(
  requests: RadiologyRequestDTO[] = [],
): Promise<RadiologyRequestDTO[]> {
  if (!requests.length) {
    return requests;
  }

  // Get unique patient IDs
  const patientIds = Array.from(
    new Set(
      requests
        .map((req) => req.patient_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (!patientIds.length) {
    return requests;
  }

  // Fetch patient data
  const { data: patients, error } = await supabase
    .from('patients')
    .select(
      'patient_id, emr_number, first_name, surname, date_of_birth, gender',
    )
    .in('patient_id', patientIds);

  if (error) {
    console.error('Failed to fetch patient data:', error);
    return requests;
  }

  // Create lookup map
  const patientMap = new Map((patients || []).map((p) => [p.patient_id, p]));

  // Merge patient data into requests
  return requests.map((req) => ({
    ...req,
    patient: req.patient_id
      ? patientMap.get(req.patient_id) || req.patient
      : req.patient,
  })) as RadiologyRequestDTO[];
}

async function hydrateRadiologyStaff(
  requests: RadiologyRequestDTO[] = [],
): Promise<RadiologyRequestDTO[]> {
  if (!requests.length) {
    return requests;
  }

  const allIds = Array.from(
    new Set(
      requests
        .flatMap((request) => [request.ordered_by, request.performed_by])
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (!allIds.length) {
    return requests;
  }

  // Separate UUIDs from staff_id strings
  const uuidIds = allIds.filter(isUUID);
  const staffIdStrings = allIds.filter((id) => !isUUID(id));

  // Build and execute queries based on what we have
  const allStaff: Staff[] = [];

  if (uuidIds.length) {
    const { data, error } = await supabase
      .from('staff')
      .select(STAFF_PROFILE_SELECT)
      .in('id', uuidIds);
    if (error) throw error;
    if (data) allStaff.push(...(data as Staff[]));
  }

  if (staffIdStrings.length) {
    const { data, error } = await supabase
      .from('staff')
      .select(STAFF_PROFILE_SELECT)
      .in('staff_id', staffIdStrings);
    if (error) throw error;
    if (data) allStaff.push(...(data as Staff[]));
  }

  // Create maps for both id and staff_id lookups
  const staffByIdMap = new Map<string, Staff>();
  const staffByStaffIdMap = new Map<string, Staff>();
  allStaff.forEach((staff) => {
    if (staff.id) {
      staffByIdMap.set(staff.id, staff);
    }
    if (staff.staff_id) {
      staffByStaffIdMap.set(staff.staff_id, staff);
    }
  });

  return requests.map((request) => ({
    ...request,
    doctor: request.ordered_by
      ? (staffByIdMap.get(request.ordered_by) ??
        staffByStaffIdMap.get(request.ordered_by) ??
        request.doctor)
      : request.doctor,
    radiologist: request.performed_by
      ? (staffByIdMap.get(request.performed_by) ??
        staffByStaffIdMap.get(request.performed_by) ??
        request.radiologist)
      : request.radiologist,
  }));
}

/**
 * Hydrate radiology requests with scan_result data from scan_results table
 * Uses image_urls array from scan_results for image data
 */
async function hydrateRadiologyScanResults(
  requests: RadiologyRequestDTO[] = [],
): Promise<RadiologyRequestDTO[]> {
  if (!requests.length) {
    return requests;
  }

  // Get request IDs
  const requestIds = requests
    .map((req) => req.request_id)
    .filter((id): id is string => Boolean(id));

  if (!requestIds.length) {
    return requests;
  }

  const parseRecommendation = (
    recommendation: string | null | undefined,
    label: 'Technique' | 'Comparison',
  ) => {
    if (!recommendation) return null;
    const match = recommendation.match(
      new RegExp(`${label}:\\s*([^\\n]+)`, 'i'),
    );
    return match ? match[1].trim() : null;
  };

  // Fetch scan results
  const { data: scanResults, error: scanResultsError } = await supabase
    .from('scan_results')
    .select('*, radiologist:staff!radiologist_id(id, first_name, last_name)')
    .in('request_id', requestIds);

  if (scanResultsError) {
    console.error('Failed to fetch scan results:', scanResultsError);
    return requests;
  }

  // Fetch scan images
  let scanImagesData: any[] = [];
  const { data: scanImagesRows, error: scanImagesError } = await supabase
    .from('scan_images')
    .select('*')
    .in('scan_request_id', requestIds);

  if (scanImagesError) {
    if (!isMissingTableError(scanImagesError, 'scan_images')) {
      console.error('Failed to fetch scan images:', scanImagesError);
    }
  } else {
    scanImagesData = scanImagesRows || [];
  }

  const scanImagesByRequest = new Map<string, ScanImageDTO[]>();
  scanImagesData.forEach((img: any) => {
    const list = scanImagesByRequest.get(img.scan_request_id) || [];
    list.push({
      image_id: img.image_id || img.id,
      image_path: img.image_path,
      image_url: img.image_path,
      file_name: img.file_name,
      file_size: img.file_size,
      mime_type: img.mime_type,
      view_plane: img.view_plane,
      sequence_number: img.sequence_number,
      is_key_image: img.is_key_image,
      notes: img.notes,
    } as ScanImageDTO);
    scanImagesByRequest.set(img.scan_request_id, list);
  });

  // Create lookup map by request_id
  const scanResultMap = new Map(
    (scanResults || []).map((result) => [result.request_id, result]),
  );

  // Merge scan_result data into requests
  return requests.map((req) => {
    const scanResult = scanResultMap.get(req.request_id);

    let scanImages: ScanImageDTO[] =
      scanImagesByRequest.get(req.request_id) || [];
    if (!scanImages.length && scanResult?.image_urls?.length) {
      // Fallback to legacy image_urls array from scan_results
      scanImages = scanResult.image_urls.map(
        (url: string, idx: number) =>
          ({
            image_id: `${scanResult.id || scanResult.request_id}_${idx}`,
            image_path: url,
            image_url: url,
            description: `Image ${idx + 1}`,
            sequence_number: idx + 1,
            is_key_image: idx === 0,
          }) as ScanImageDTO,
      );
    }

    if (!scanResult && scanImages.length === 0) {
      return req;
    }

    const techniqueFromRecommendation = parseRecommendation(
      scanResult?.recommendation,
      'Technique',
    );
    const comparisonFromRecommendation = parseRecommendation(
      scanResult?.recommendation,
      'Comparison',
    );
    const technique =
      scanResult?.technique ||
      techniqueFromRecommendation ||
      req.technique ||
      null;
    const comparison =
      scanResult?.comparison ||
      comparisonFromRecommendation ||
      req.comparison ||
      null;

    const scanResultPayload = scanResult
      ? {
          scan_result_id: scanResult.id || scanResult.scan_result_id,
          scan_request_id: scanResult.request_id || scanResult.scan_request_id,
          report: scanResult.report ?? null,
          findings: scanResult.findings ?? null,
          impression: scanResult.impression ?? null,
          technique,
          comparison,
          urgency: scanResult.urgency || 'Normal',
          is_preliminary: scanResult.is_preliminary || false,
          notes: scanResult.notes ?? null,
          reported_by:
            scanResult.radiologist_id || scanResult.reported_by || null,
          reported_at:
            scanResult.report_date ||
            scanResult.reported_at ||
            scanResult.updated_at ||
            null,
          verified_by: scanResult.verified_by || null,
          verified_at: scanResult.verified_at || null,
          addendum: scanResult.addendum || null,
          addendum_by: scanResult.addendum_by || null,
          addendum_at: scanResult.addendum_at || null,
          created_at: scanResult.created_at,
          updated_at: scanResult.updated_at,
          reporter: scanResult.radiologist || scanResult.reporter,
          verifier: scanResult.verifier || null,
        }
      : req.scan_result;

    return {
      ...req,
      findings: scanResult?.findings || req.findings,
      impression: scanResult?.impression || req.impression,
      technique,
      comparison,
      scan_result: scanResultPayload,
      scan_images: scanImages,
      image_count: scanImages.length,
    } as RadiologyRequestDTO;
  });
}

/**
 * Hydrate radiology requests with imaging data from imaging_catalogue
 * This is a workaround for PostgREST FK relationship detection issues
 */
async function hydrateRadiologyImaging(
  requests: RadiologyRequestDTO[] = [],
): Promise<RadiologyRequestDTO[]> {
  if (!requests.length) {
    return requests;
  }

  // Get unique imaging IDs
  const imagingIds = Array.from(
    new Set(
      requests
        .map((req) => req.imaging_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (!imagingIds.length) {
    return requests;
  }

  // Fetch all imaging fields to satisfy ImagingCatalogue interface
  const { data: imagingData, error } = await supabase
    .from('imaging_catalogue')
    .select('*')
    .in('id', imagingIds);

  if (error) {
    console.error('Failed to fetch imaging data:', error);
    return requests;
  }

  // Create lookup map with proper ImagingCatalogue shape
  const imagingMap = new Map(
    (imagingData || []).map((img) => [
      img.id,
      {
        imaging_id: img.id,
        imaging_code: img.code,
        imaging_name: img.name,
        imaging_type: normalizeApiModality(img.modality),
        category: img.category,
        body_part: img.body_part,
        description: img.description,
        preparation_instructions: img.preparation_instructions,
        price: img.price ?? 0,
        nhis_eligible: img.is_nhis_covered ?? false,
        nhis_percentage: img.nhis_percentage,
        duration_minutes: img.duration_minutes ?? 0,
        is_active: img.is_active ?? true,
        created_at: img.created_at,
        updated_at: img.updated_at,
      } as ImagingCatalogue,
    ]),
  );

  // Merge imaging data into requests
  return requests.map((req) => ({
    ...req,
    imaging: req.imaging_id
      ? imagingMap.get(req.imaging_id) || req.imaging
      : req.imaging,
  }));
}

// =============================================================================
// API Functions
// =============================================================================

const buildPostgrestInFilter = (values: string[]) =>
  `(${values.map((value) => JSON.stringify(value)).join(',')})`;

const LEGACY_STATUS_VALUES = [
  'Pending',
  'Accepted',
  'In Progress',
  'Completed',
  'Reported',
  'Cancelled',
  'Rejected',
] as const;

const LEGACY_STATUS_FALLBACKS: Record<string, string[]> = {
  Ordered: ['Pending'],
  Scheduled: ['Pending'],
  'Imaging Completed': ['Completed'],
  'Awaiting Report': ['Completed'],
  'Preliminary Report': ['Reported'],
  'Final Report': ['Reported'],
};

const mapLegacyStatuses = (values: string[]) => {
  const mapped = values.flatMap((value) => {
    if ((LEGACY_STATUS_VALUES as readonly string[]).includes(value)) {
      return [value];
    }
    return LEGACY_STATUS_FALLBACKS[value] || [];
  });

  return Array.from(new Set(mapped));
};

const getLegacyStatusFallback = (
  status?: string,
  statuses?: string[],
): string[] | null => {
  if (statuses && statuses.length > 0) {
    const legacy = mapLegacyStatuses(statuses);
    return legacy.length > 0 ? legacy : null;
  }

  if (status) {
    const legacy = mapLegacyStatuses([status]);
    return legacy.length > 0 ? legacy : null;
  }

  return null;
};

const isInvalidStatusEnumError = (error: any) =>
  error?.code === '22P02' &&
  String(error?.message || '').includes('request_status');

const applyNhisPendingFilter = <T>(
  query: T,
  includeNhisPending: boolean,
): T => {
  if (includeNhisPending) return query;
  return (query as any).or(
    'nhis_approval_status.is.null,nhis_approval_status.neq.pending',
  ) as T;
};

const applyStatusFilter = <T>(
  query: T,
  status?: string,
  statuses?: string[],
): T => {
  const sanitizeStatusValue = (value: string) =>
    value.trim().replace(/^"(.*)"$/, '$1');

  if (statuses && statuses.length > 0) {
    const normalizedStatuses = statuses
      .map(sanitizeStatusValue)
      .filter((value) => value.length > 0);

    if (normalizedStatuses.length === 0) {
      return query;
    }

    if (normalizedStatuses.length === 1) {
      return (query as any).eq('status', normalizedStatuses[0]) as T;
    }
    return (query as any).filter(
      'status',
      'in',
      buildPostgrestInFilter(normalizedStatuses),
    ) as T;
  }

  if (status) {
    const normalizedStatus = sanitizeStatusValue(status);
    if (!normalizedStatus) {
      return query;
    }
    return (query as any).eq('status', normalizedStatus) as T;
  }

  return query;
};

/**
 * Get radiology requests with filters
 */
export async function getRadiologyRequests(
  filters: RadiologyRequestFilters = {},
) {
  const {
    page = 1,
    limit = 10,
    status,
    statuses,
    patient_id,
    imaging_id,
    modality,
    date_from,
    date_to,
    search,
    includeNhisPending = false, // Default: hide pending NHIS requests from Radiology queue
  } = filters;
  const offset = (page - 1) * limit;

  const buildQuery = (statusFilter?: string, statusFilters?: string[]) => {
    let query = supabase
      .from('radiology_requests')
      .select(RADIOLOGY_REQUEST_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter out pending NHIS requests unless explicitly included
    // These requests should only be visible in the NHIS Specialty Approval queue
    query = applyNhisPendingFilter(query, includeNhisPending);
    query = applyStatusFilter(query, statusFilter, statusFilters);

    if (patient_id) {
      query = query.eq('patient_id', patient_id);
    }

    if (imaging_id) {
      query = query.eq('imaging_id', imaging_id);
    }

    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    return query;
  };
  const { data, error, count } = await buildQuery(status, statuses);

  if (error) {
    if (isInvalidStatusEnumError(error)) {
      const legacyStatuses = getLegacyStatusFallback(status, statuses);
      if (legacyStatuses) {
        const fallback = await buildQuery(undefined, legacyStatuses);
        if (fallback.error) throw fallback.error;

        return await hydrateRadiologyResponse(
          fallback.data,
          fallback.count,
          page,
          limit,
          modality,
        );
      }
    }

    throw error;
  }

  return await hydrateRadiologyResponse(data, count, page, limit, modality);
}

const hydrateRadiologyResponse = async (
  data: RadiologyRequestDTO[] | null,
  count: number | null,
  page: number,
  limit: number,
  modality?: string,
) => {
  let hydratedData = (data as RadiologyRequestDTO[]) || [];

  // Hydrate patient, imaging, staff, and scan results data
  hydratedData = await hydrateRadiologyPatients(hydratedData);
  hydratedData = await hydrateRadiologyImaging(hydratedData);
  hydratedData = await hydrateRadiologyStaff(hydratedData);
  hydratedData = await hydrateRadiologyScanResults(hydratedData);

  // Filter by modality after hydration
  if (modality) {
    const normalizedFilter = normalizeApiModality(modality);
    hydratedData = hydratedData.filter(
      (req) =>
        normalizeApiModality(req.imaging?.imaging_type) === normalizedFilter,
    );
  }

  return {
    data: hydratedData,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
};

/**
 * Get a single radiology request
 */
export async function getRadiologyRequest(
  requestId: string,
): Promise<RadiologyRequestDTO> {
  const { data, error } = await supabase
    .from('radiology_requests')
    .select(RADIOLOGY_REQUEST_DETAIL_SELECT)
    .eq('request_id', requestId)
    .single();

  if (error) throw error;

  // Hydrate patient, imaging, staff, and scan results data
  let [hydrated] = await hydrateRadiologyPatients([
    data as RadiologyRequestDTO,
  ]);
  [hydrated] = await hydrateRadiologyImaging([hydrated]);
  [hydrated] = await hydrateRadiologyStaff([hydrated]);
  [hydrated] = await hydrateRadiologyScanResults([hydrated]);
  return hydrated;
}

/**
 * Update radiology request
 * Validates encounter is active before modification.
 */
export async function updateRadiologyRequest(
  data: UpdateRadiologyRequestDTO,
): Promise<RadiologyRequestDTO> {
  const { request_id, image_url, ...restData } = data;

  // Get current request to validate encounter and current status
  const { data: currentRequest } = await supabase
    .from('radiology_requests')
    .select('visit_id, encounter_id, patient_id, status')
    .eq('request_id', request_id)
    .single();

  // Validate encounter is active — but only for initial acceptance.
  // Radiology workflow (imaging, uploading, reporting) happens asynchronously
  // after the patient encounter, so downstream status transitions must not
  // be blocked by a closed encounter.
  const downstreamStatuses = [
    'Scheduled',
    'In Progress',
    'Imaging Completed',
    'Awaiting Report',
    'Preliminary Report',
    'Final Report',
    'Completed',
    'Reported',
  ];
  const currentStatus = currentRequest?.status || null;
  const isDownstreamTransition =
    currentStatus && downstreamStatuses.includes(currentStatus);

  if (!isDownstreamTransition) {
    const encounterId =
      currentRequest?.encounter_id || currentRequest?.visit_id;
    if (encounterId) {
      await ensureEncounterActive(encounterId);
    }
  }

  // Verify payment before transitioning into any processing/reporting state.
  const processingStatuses = [
    'In Progress',
    'Imaging Completed',
    'Awaiting Report',
    'Preliminary Report',
    'Final Report',
    'Completed',
    'Reported',
  ];
  const nextStatus = restData.status || null;
  const movingIntoProcessing = Boolean(
    nextStatus &&
    processingStatuses.includes(nextStatus) &&
    (!currentStatus || !processingStatuses.includes(currentStatus)),
  );

  if (movingIntoProcessing) {
    await ensurePaymentVerified(request_id);
  }

  // Map DTO fields to database column names
  const updateData: Record<string, any> = {
    ...restData,
  };

  // Map image_url to result_file_url (database column name)
  if (image_url !== undefined) {
    updateData.result_file_url = image_url;
  }

  // Get current user as radiologist if reporting
  if (updateData.status === 'Reported' || updateData.report) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const staffData = await fetchStaffByUser(
        user.id,
        user.email || undefined,
      );

      if (staffData?.staff_id) {
        // Use staff_id (VARCHAR) for performed_by FK, which references staff(staff_id)
        updateData.performed_by = staffData.staff_id;
      }
    }
  }

  const { data: request, error } = await supabase
    .from('radiology_requests')
    .update(updateData)
    .eq('request_id', request_id)
    .select(RADIOLOGY_REQUEST_SELECT)
    .single();

  if (error) throw error;

  // Hydrate patient, imaging, and staff data
  let [hydrated] = await hydrateRadiologyPatients([
    request as RadiologyRequestDTO,
  ]);
  [hydrated] = await hydrateRadiologyImaging([hydrated]);
  [hydrated] = await hydrateRadiologyStaff([hydrated]);
  return hydrated;
}

/**
 * Schedule imaging procedure
 */
export async function scheduleImaging(
  requestId: string,
  scheduledDate: string,
): Promise<RadiologyRequestDTO> {
  return updateRadiologyRequest({
    request_id: requestId,
    status: 'Scheduled',
    scheduled_date: scheduledDate,
  });
}

/**
 * Start imaging procedure
 */
export async function startImaging(
  requestId: string,
): Promise<RadiologyRequestDTO> {
  return updateRadiologyRequest({
    request_id: requestId,
    status: 'In Progress',
  });
}

/**
 * Complete imaging (image captured, pending report)
 */
export async function completeImaging(
  requestId: string,
  imageUrl?: string,
): Promise<RadiologyRequestDTO> {
  return updateRadiologyRequest({
    request_id: requestId,
    status: 'Imaging Completed',
    image_url: imageUrl,
  });
}

/**
 * Skip image upload and move directly to Awaiting Report
 */
export async function skipToAwaitingReport(
  requestId: string,
): Promise<RadiologyRequestDTO> {
  return updateRadiologyRequest({
    request_id: requestId,
    status: 'Awaiting Report',
  });
}

/**
 * Upload imaging files and move to Awaiting Report
 */
export async function uploadRadiologyImages(
  requestId: string,
  images: UploadScanImageDTO[],
): Promise<RadiologyRequestDTO> {
  if (!images.length) {
    throw new Error('No images provided for upload');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const staffRecord = await fetchStaffByUser(user.id, user.email || undefined);

  const uploadedBy = staffRecord?.id || null;
  const uploadedAt = new Date().toISOString();

  const insertRows = images.map((img) => ({
    scan_request_id: requestId,
    image_path: img.image_path,
    file_name: img.file_name || null,
    file_size: img.file_size || null,
    mime_type: img.mime_type || null,
    view_plane: img.view_plane || null,
    sequence_number: img.sequence_number || 1,
    is_key_image: img.is_key_image || false,
    notes: img.notes || null,
    uploaded_by: uploadedBy,
    upload_date: uploadedAt,
    created_at: uploadedAt,
  }));

  const { error: insertError } = await supabase
    .from('scan_images')
    .insert(insertRows);

  if (insertError) {
    if (isMissingTableError(insertError, 'scan_images')) {
      throw new Error(
        'scan_images table is missing. Run the scan_images SQL migration before uploading images.',
      );
    }
    throw insertError;
  }

  // Move request to Awaiting Report
  return updateRadiologyRequest({
    request_id: requestId,
    status: 'Awaiting Report',
  });
}

/**
 * Lightweight result returned by submitReport — contains only what
 * the mutation's onSuccess callback needs (patient_id for cache invalidation).
 * Avoids the ~5-round-trip getRadiologyRequest re-fetch.
 */
export interface SubmitReportResult {
  request_id: string;
  patient_id: string | null;
}

/**
 * Submit radiology report with full scan result data.
 * Saves to both radiology_requests and scan_results tables.
 *
 * Optimised write path (3 sequential batches instead of ~10 serial calls):
 *   Batch 1: auth.getUser() + SELECT scan_results existence check — in parallel
 *   Batch 2: fetchStaffByUser (needs user from batch 1)
 *   Batch 3: UPDATE radiology_requests + UPDATE/INSERT scan_results — in parallel
 *
 * The caller passes patientId so we never need to re-query the full request.
 */
export async function submitReport(
  requestId: string,
  reportData: CreateScanResultDTO,
  patientId?: string | null,
): Promise<SubmitReportResult> {
  const {
    findings,
    impression,
    technique,
    comparison,
    report,
    urgency = 'Normal',
    is_preliminary = false,
    notes,
    images = [],
  } = reportData;

  const imagePaths = images.map((img) => img.image_path);
  const performedAt = new Date().toISOString();
  const reportStatus = is_preliminary ? 'Preliminary Report' : 'Final Report';

  // Batch 1: auth + scan_results existence check in parallel
  const [
    {
      data: { user },
    },
    { data: existingScanResult },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('scan_results')
      .select('id')
      .eq('request_id', requestId)
      .maybeSingle(),
  ]);

  // Batch 2: fetch staff record (needs user from batch 1)
  let radiologistStaffUuid: string | null = null;
  let radiologistStaffId: string | null = null;
  if (user?.id) {
    const staffRecord = await fetchStaffByUser(
      user.id,
      user.email || undefined,
    );
    radiologistStaffUuid = staffRecord?.id || null;
    radiologistStaffId = staffRecord?.staff_id || null;
  }

  const scanResultData: Record<string, unknown> = {
    request_id: requestId,
    findings,
    impression,
    technique: technique || null,
    comparison: comparison || null,
    urgency: urgency || 'Normal',
    is_preliminary: is_preliminary || false,
    notes: notes || null,
    recommendation: technique
      ? `Technique: ${technique}${comparison ? `\nComparison: ${comparison}` : ''}`
      : comparison || null,
    report_date: performedAt,
    image_urls: imagePaths,
    updated_at: performedAt,
  };
  if (radiologistStaffUuid) {
    scanResultData.radiologist_id = radiologistStaffUuid;
  }

  const scanResultWrite = existingScanResult?.id
    ? supabase
        .from('scan_results')
        .update(scanResultData)
        .eq('id', existingScanResult.id)
    : supabase
        .from('scan_results')
        .insert({ ...scanResultData, created_at: performedAt });

  // Batch 3: both table writes in parallel
  const [{ error: requestError }, { error: scanError }] = await Promise.all([
    supabase
      .from('radiology_requests')
      .update({
        status: reportStatus,
        findings,
        impression,
        report: report || impression,
        result_file_url: imagePaths.length > 0 ? imagePaths[0] : null,
        performed_by: radiologistStaffId,
        performed_at: performedAt,
        updated_at: performedAt,
      })
      .eq('request_id', requestId),
    scanResultWrite,
  ]);

  if (requestError) throw requestError;
  if (scanError) throw scanError;

  return { request_id: requestId, patient_id: patientId ?? null };
}

/**
 * Finalize a preliminary report (verification)
 */
export async function finalizeReport(
  requestId: string,
): Promise<RadiologyRequestDTO> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const staffRecord = await fetchStaffByUser(user.id, user.email || undefined);

  if (!staffRecord || staffRecord.role !== 'radiologist') {
    throw new Error('Only radiologists can finalize reports');
  }

  const finalizedAt = new Date().toISOString();

  await supabase
    .from('scan_results')
    .update({
      is_preliminary: false,
      verified_by: staffRecord.id,
      verified_at: finalizedAt,
      updated_at: finalizedAt,
    })
    .eq('request_id', requestId);

  // Update request status
  await supabase
    .from('radiology_requests')
    .update({
      status: 'Final Report',
      updated_at: finalizedAt,
    })
    .eq('request_id', requestId);

  return getRadiologyRequest(requestId);
}

/**
 * Get radiology statistics
 */
export async function getRadiologyStats(
  includeNhisPending = false,
): Promise<RadiologyStats> {
  const today = new Date().toISOString().split('T')[0];

  const safeCount = async (
    statusValues: string[],
    options?: { since?: string },
  ) => {
    const applyQuery = (values: string[]) =>
      applyNhisPendingFilter(
        supabase
          .from('radiology_requests')
          .select('*', { count: 'exact', head: true })
          .filter('status', 'in', buildPostgrestInFilter(values)),
        includeNhisPending,
      );

    let query = applyQuery(statusValues);
    if (options?.since) {
      query = query.gte('updated_at', options.since) as typeof query;
    }

    const { count, error } = await query;
    if (!error) return count || 0;

    if (isInvalidStatusEnumError(error)) {
      const legacyValues = mapLegacyStatuses(statusValues);
      if (legacyValues.length === 0) return 0;

      let fallbackQuery = applyQuery(legacyValues);
      if (options?.since) {
        fallbackQuery = fallbackQuery.gte(
          'updated_at',
          options.since,
        ) as typeof fallbackQuery;
      }

      const { count: fallbackCount, error: fallbackError } =
        await fallbackQuery;
      if (fallbackError) throw fallbackError;
      return fallbackCount || 0;
    }

    throw error;
  };

  // Ordered (include legacy Pending)
  const ordered = await safeCount(['Ordered', 'Pending']);
  const scheduled = await safeCount(['Scheduled']);
  const inProgress = await safeCount(['In Progress']);
  const imagingCompleted = await safeCount(['Imaging Completed']);
  const awaitingReport = await safeCount(['Awaiting Report']);
  const preliminaryReport = await safeCount(['Preliminary Report']);
  const finalReport = await safeCount(['Final Report', 'Reported']);
  const reportedToday = await safeCount(['Final Report', 'Reported'], {
    since: today,
  });

  return {
    ordered,
    scheduled,
    in_progress: inProgress,
    imaging_completed: imagingCompleted,
    awaiting_report: awaitingReport,
    preliminary_report: preliminaryReport,
    final_report: finalReport,
    reported_today: reportedToday,
  };
}

/**
 * Get imaging catalogue
 */
export async function getImagingCatalogue(
  modality?: string,
): Promise<ImagingDTO[]> {
  let query = supabase
    .from('imaging_catalogue')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (modality) {
    query = query.eq('modality', normalizeApiModality(modality));
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || [])
    .map((item) =>
      normalizeImagingCatalogueRecord(
        item as Partial<ImagingDTO> & Record<string, unknown>,
      ),
    )
    .filter((item): item is ImagingDTO => item !== null);
}

/**
 * Get patient's radiology history
 */
export async function getPatientRadiologyHistory(
  patientId: string,
  limit: number = 10,
) {
  const { data, error } = await supabase
    .from('radiology_requests')
    .select(RADIOLOGY_REQUEST_SELECT)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Hydrate patient, imaging, staff, and scan results data
  let hydratedData = await hydrateRadiologyPatients(
    (data as RadiologyRequestDTO[]) || [],
  );
  hydratedData = await hydrateRadiologyImaging(hydratedData);
  hydratedData = await hydrateRadiologyStaff(hydratedData);
  hydratedData = await hydrateRadiologyScanResults(hydratedData);
  return hydratedData;
}

/**
 * Get pending requests
 */
export async function getPendingRadiologyRequests(patientId?: string) {
  let query = supabase
    .from('radiology_requests')
    .select(RADIOLOGY_REQUEST_SELECT)
    .in('status', ['Pending', 'In Progress', 'Completed'])
    .order('created_at', { ascending: true });

  if (patientId) {
    query = query.eq('patient_id', patientId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Hydrate patient, imaging, staff, and scan results data
  let hydratedData = await hydrateRadiologyPatients(
    (data as RadiologyRequestDTO[]) || [],
  );
  hydratedData = await hydrateRadiologyImaging(hydratedData);
  hydratedData = await hydrateRadiologyStaff(hydratedData);
  hydratedData = await hydrateRadiologyScanResults(hydratedData);
  return hydratedData;
}

// =============================================================================
// UUID Resolver Helpers
// =============================================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve external patient_id (e.g. PT-00001) to internal UUID (patients.id).
 */
async function resolvePatientUuid(identifier: string): Promise<string> {
  if (!identifier) {
    throw new Error('Patient identifier is required');
  }

  if (UUID_REGEX.test(identifier)) {
    const { data } = await supabase
      .from('patients')
      .select('id')
      .eq('id', identifier)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const { data } = await supabase
    .from('patients')
    .select('id')
    .eq('patient_id', identifier)
    .maybeSingle();

  if (!data?.id) {
    throw new Error(`Patient not found: ${identifier}`);
  }
  return data.id;
}

/**
 * Check if patient is NHIS eligible based on insurance type
 * DHML = Defence Health Maintenance Limited (default HMO for Military NHIS, NOT a separate category)
 */
function isNhisPatient(insuranceType: string | null | undefined): boolean {
  const normalized = (insuranceType || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
  return (
    normalized.includes('nhis') ||
    normalized === 'dhml' ||
    normalized === 'gifship'
  );
}

// =============================================================================
// Accept/Reject Radiology Request (Approval Workflow)
// =============================================================================

export interface AcceptRadiologyRequestDTO {
  request_id: string;
  scheduled_time?: string;
  notes?: string;
}

export interface RejectRadiologyRequestDTO {
  request_id: string;
  rejection_reason: string;
}

/**
 * Accept a radiology request and create billing order.
 * This is called when radiologist reviews and accepts a pending request.
 * Billing is ONLY created upon acceptance, not when the request is first ordered.
 */
export async function acceptRadiologyRequest(
  dto: AcceptRadiologyRequestDTO,
): Promise<RadiologyRequestDTO> {
  const { request_id, scheduled_time, notes } = dto;

  return requestDeduper.dedupe(
    DedupeKeys.acceptRadiologyRequest(request_id),
    async () => {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: staffData } = await supabase
        .from('staff')
        .select('id, staff_id')
        .eq('email', user.email)
        .single();

      // Get the radiology request (without FK join - PostgREST doesn't detect the relationship)
      const { data: radiologyRequest, error: fetchError } = await supabase
        .from('radiology_requests')
        .select('*')
        .eq('request_id', request_id)
        .single();

      if (fetchError) throw fetchError;
      if (!radiologyRequest) throw new Error('Radiology request not found');

      // Validate request is in Pending status
      if (radiologyRequest.status !== 'Pending') {
        throw new Error(
          `Cannot accept request with status: ${radiologyRequest.status}`,
        );
      }

      // NHIS gate: radiology approval cannot create billing while NHIS approval is unresolved.
      const nhisStatus = (radiologyRequest as any).nhis_approval_status as
        | string
        | null
        | undefined;
      if (
        nhisStatus === 'pending' ||
        nhisStatus === 'provisional' ||
        nhisStatus === 'rejected' ||
        nhisStatus === 'expired'
      ) {
        throw new Error(
          `Cannot accept this request while NHIS status is "${nhisStatus}". Resolve NHIS approval first.`,
        );
      }

      // Fetch imaging catalogue data separately (workaround for PostgREST FK detection)
      if (!radiologyRequest.imaging_id) {
        throw new Error('Imaging ID not found on request');
      }

      const { data: imaging, error: imagingError } = await supabase
        .from('imaging_catalogue')
        .select('*')
        .eq('id', radiologyRequest.imaging_id)
        .single();

      if (imagingError) throw imagingError;
      if (!imaging) {
        throw new Error('Imaging details not found in catalogue');
      }

      // Resolve patient UUID for billing
      const patientUuid = await resolvePatientUuid(radiologyRequest.patient_id);

      // Get visit/encounter insurance info
      const encounterId =
        radiologyRequest.encounter_id || radiologyRequest.visit_id;
      let insuranceType = '';
      if (encounterId) {
        const { data: visitData } = await supabase
          .from('visits')
          .select('insurance_type, payment_category')
          .eq('id', encounterId)
          .maybeSingle();
        insuranceType =
          visitData?.insurance_type || visitData?.payment_category || '';
      }

      const nextStatus = scheduled_time ? 'Scheduled' : 'Ordered';

      // Update request status to Ordered or Scheduled (acceptance step)
      const updateData: any = {
        status: nextStatus,
        accepted_by: staffData?.id,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (scheduled_time) {
        updateData.scheduled_date = scheduled_time;
      }

      if (notes) {
        updateData.clinical_history = `${radiologyRequest.clinical_history || ''}\n[Acceptance Note]: ${notes}`;
      }

      const { data: updatedRequest, error: updateError } = await supabase
        .from('radiology_requests')
        .update(updateData)
        .eq('request_id', request_id)
        .select(RADIOLOGY_REQUEST_SELECT)
        .single();

      if (updateError) throw updateError;

      // Calculate pricing and NHIS using the proper coverage utility
      // NHIS Price is the single source of truth for NHIS billing
      const coverage = calculateNhisServiceCoverage({
        insuranceType,
        serviceType: 'Radiology',
        regularPrice: imaging.nhis_price || imaging.price || 0,
        nhisPrice: imaging.nhis_price,
        isServiceNhisCovered: imaging.is_nhis_covered !== false,
        serviceNhisPercentage: imaging.nhis_percentage,
        quantity: 1,
      });

      // Create billing order NOW (upon acceptance)
      const serviceName = `Radiology: ${imaging.name}${radiologyRequest.body_part ? ` - ${radiologyRequest.body_part}` : ''}`;
      await createBillingOrder({
        patient_id: patientUuid,
        encounter_id: encounterId || undefined,
        source_module: 'radiology',
        service_reference_id: request_id,
        service_code: imaging.code,
        service_description: serviceName,
        service_name: serviceName,
        quantity: 1,
        unit_price: coverage.grossAmount,
        unit_cost: coverage.grossAmount,
        gross_amount: coverage.grossAmount,
        service_type: 'Radiology',
        nhis_covered: coverage.isNhis && imaging.is_nhis_covered !== false,
        nhis_percentage: coverage.nhisPercentage,
        nhis_payable: coverage.nhisPayable,
        patient_payable: coverage.patientPayable,
      });

      // Hydrate and return
      let [hydrated] = await hydrateRadiologyPatients([
        updatedRequest as RadiologyRequestDTO,
      ]);
      [hydrated] = await hydrateRadiologyImaging([hydrated]);
      [hydrated] = await hydrateRadiologyStaff([hydrated]);
      return hydrated;
    },
  );
}

/**
 * Reject a radiology request.
 * No billing is created for rejected requests.
 */
export async function rejectRadiologyRequest(
  dto: RejectRadiologyRequestDTO,
): Promise<RadiologyRequestDTO> {
  const { request_id, rejection_reason } = dto;

  return requestDeduper.dedupe(
    DedupeKeys.rejectRadiologyRequest(request_id),
    async () => {
      if (!rejection_reason?.trim()) {
        throw new Error('Rejection reason is required');
      }

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: staffData } = await supabase
        .from('staff')
        .select('id, staff_id')
        .eq('email', user.email)
        .single();

      // Validate request exists and is pending
      const { data: radiologyRequest, error: fetchError } = await supabase
        .from('radiology_requests')
        .select('status')
        .eq('request_id', request_id)
        .single();

      if (fetchError) throw fetchError;
      if (!radiologyRequest) throw new Error('Radiology request not found');

      if (radiologyRequest.status !== 'Pending') {
        throw new Error(
          `Cannot reject request with status: ${radiologyRequest.status}`,
        );
      }

      // Update request status to Rejected
      const { data: updatedRequest, error: updateError } = await supabase
        .from('radiology_requests')
        .update({
          status: 'Rejected',
          rejected_by: staffData?.id,
          rejected_at: new Date().toISOString(),
          rejection_reason,
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', request_id)
        .select(RADIOLOGY_REQUEST_SELECT)
        .single();

      if (updateError) throw updateError;

      // Hydrate and return - NO billing created for rejected requests
      let [hydrated] = await hydrateRadiologyPatients([
        updatedRequest as RadiologyRequestDTO,
      ]);
      [hydrated] = await hydrateRadiologyImaging([hydrated]);
      [hydrated] = await hydrateRadiologyStaff([hydrated]);
      return hydrated;
    },
  );
}

// =============================================================================
// Batch Accept/Reject Functions
// =============================================================================

export interface BatchAcceptRadiologyRequestsDTO {
  request_ids: string[];
  scheduled_time?: string;
  notes?: string;
}

export interface BatchRejectRadiologyRequestsDTO {
  request_ids: string[];
  rejection_reason: string;
}

export interface BatchResultDTO {
  successful: string[];
  failed: Array<{ request_id: string; error: string }>;
}

/**
 * Accept multiple radiology requests in a single operation.
 * Each request creates its own billing order.
 *
 * OPTIMIZED: Pre-fetches all data in bulk, then processes with Promise.allSettled
 */
export async function batchAcceptRadiologyRequests(
  dto: BatchAcceptRadiologyRequestsDTO,
): Promise<BatchResultDTO> {
  const { request_ids, scheduled_time, notes } = dto;
  const result: BatchResultDTO = { successful: [], failed: [] };

  if (request_ids.length === 0) {
    return result;
  }

  // Get current user once
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: staffData } = await supabase
    .from('staff')
    .select('id, staff_id')
    .eq('email', user.email)
    .single();

  // Pre-fetch all radiology requests
  const { data: radiologyRequests, error: fetchError } = await supabase
    .from('radiology_requests')
    .select('*')
    .in('request_id', request_ids);

  if (fetchError) {
    for (const id of request_ids) {
      result.failed.push({ request_id: id, error: fetchError.message });
    }
    return result;
  }

  const requestMap = new Map(
    radiologyRequests?.map((r) => [r.request_id, r]) || [],
  );

  // Collect imaging IDs for bulk fetch
  const imagingIds = [
    ...new Set(
      radiologyRequests?.map((r) => r.imaging_id).filter(Boolean) || [],
    ),
  ];

  // Pre-fetch all imaging catalogues
  const { data: imagings } =
    imagingIds.length > 0
      ? await supabase
          .from('imaging_catalogue')
          .select('*')
          .in('id', imagingIds)
      : { data: [] };

  const imagingMap = new Map(imagings?.map((i) => [i.id, i]) || []);

  // Collect encounter IDs for bulk insurance fetch
  const encounterIds = [
    ...new Set(
      radiologyRequests
        ?.map((r) => r.encounter_id || r.visit_id)
        .filter(Boolean) || [],
    ),
  ];

  // Pre-fetch all visit insurance info
  const { data: visits } =
    encounterIds.length > 0
      ? await supabase
          .from('visits')
          .select('id, insurance_type, payment_category')
          .in('id', encounterIds)
      : { data: [] };

  const visitMap = new Map(visits?.map((v) => [v.id, v]) || []);

  // Process each request
  const processingPromises = request_ids.map(
    async (
      request_id,
    ): Promise<{ id: string; success: boolean; error?: string }> => {
      try {
        const radiologyRequest = requestMap.get(request_id);
        if (!radiologyRequest) {
          return {
            id: request_id,
            success: false,
            error: 'Radiology request not found',
          };
        }

        if (radiologyRequest.status !== 'Pending') {
          return {
            id: request_id,
            success: false,
            error: `Cannot accept request with status: ${radiologyRequest.status}`,
          };
        }

        const nhisStatus = (radiologyRequest as any).nhis_approval_status as
          | string
          | null
          | undefined;
        if (
          nhisStatus === 'pending' ||
          nhisStatus === 'provisional' ||
          nhisStatus === 'rejected' ||
          nhisStatus === 'expired'
        ) {
          return {
            id: request_id,
            success: false,
            error: `NHIS status is "${nhisStatus}". Resolve NHIS approval before acceptance.`,
          };
        }

        const imaging = imagingMap.get(radiologyRequest.imaging_id);
        if (!imaging) {
          return {
            id: request_id,
            success: false,
            error: 'Imaging not found in catalogue',
          };
        }

        const encounterId =
          radiologyRequest.encounter_id || radiologyRequest.visit_id;
        const visit = encounterId ? visitMap.get(encounterId) : null;
        const insuranceType =
          visit?.insurance_type || visit?.payment_category || '';

        // Build update data
        const updateData: Record<string, unknown> = {
          status: scheduled_time ? 'Scheduled' : 'Ordered',
          accepted_by: staffData?.id,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (scheduled_time) {
          updateData.scheduled_date = scheduled_time;
        }

        if (notes) {
          updateData.clinical_history = `${radiologyRequest.clinical_history || ''}\n[Acceptance Note]: ${notes}`;
        }

        // Update request status
        const { error: updateError } = await supabase
          .from('radiology_requests')
          .update(updateData)
          .eq('request_id', request_id);

        if (updateError) {
          return { id: request_id, success: false, error: updateError.message };
        }

        // Calculate pricing and create billing
        // NHIS Price is the single source of truth for NHIS billing
        const coverage = calculateNhisServiceCoverage({
          insuranceType,
          serviceType: 'Radiology',
          regularPrice: imaging.nhis_price || imaging.price || 0,
          nhisPrice: imaging.nhis_price,
          isServiceNhisCovered: imaging.is_nhis_covered !== false,
          serviceNhisPercentage: imaging.nhis_percentage,
          quantity: 1,
        });

        const patientUuid = await resolvePatientUuid(
          radiologyRequest.patient_id,
        );
        const serviceName = `Radiology: ${imaging.name}${radiologyRequest.body_part ? ` - ${radiologyRequest.body_part}` : ''}`;

        await createBillingOrder({
          patient_id: patientUuid,
          encounter_id: encounterId || undefined,
          source_module: 'radiology',
          service_reference_id: request_id,
          service_code: imaging.code,
          service_description: serviceName,
          service_name: serviceName,
          quantity: 1,
          unit_price: coverage.grossAmount,
          unit_cost: coverage.grossAmount,
          gross_amount: coverage.grossAmount,
          service_type: 'Radiology',
          nhis_covered: coverage.isNhis,
          nhis_percentage: coverage.nhisPercentage,
          nhis_payable: coverage.nhisPayable,
          patient_payable: coverage.patientPayable,
        });

        return { id: request_id, success: true };
      } catch (error) {
        return {
          id: request_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Run all with proper error isolation
  const outcomes = await Promise.allSettled(processingPromises);

  for (const outcome of outcomes) {
    if (outcome.status === 'fulfilled') {
      const { id, success, error } = outcome.value;
      if (success) {
        result.successful.push(id);
      } else {
        result.failed.push({ request_id: id, error: error || 'Unknown error' });
      }
    } else {
      result.failed.push({
        request_id: 'unknown',
        error: outcome.reason?.message || 'Promise rejected',
      });
    }
  }

  return result;
}

/**
 * Reject multiple radiology requests in a single operation.
 * No billing is created for rejected requests.
 *
 * OPTIMIZED: Uses bulk .in() query instead of N sequential queries
 */
export async function batchRejectRadiologyRequests(
  dto: BatchRejectRadiologyRequestsDTO,
): Promise<BatchResultDTO> {
  const { request_ids, rejection_reason } = dto;
  const result: BatchResultDTO = { successful: [], failed: [] };

  if (request_ids.length === 0) {
    return result;
  }

  // Get current user once
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: staffData } = await supabase
    .from('staff')
    .select('id')
    .eq('email', user.email)
    .single();

  // Pre-fetch all requests to validate status
  const { data: existingRequests, error: fetchError } = await supabase
    .from('radiology_requests')
    .select('request_id, status')
    .in('request_id', request_ids);

  if (fetchError) {
    for (const id of request_ids) {
      result.failed.push({ request_id: id, error: fetchError.message });
    }
    return result;
  }

  // Separate valid from invalid requests
  const existingMap = new Map(
    existingRequests?.map((r) => [r.request_id, r.status]) || [],
  );
  const validIds: string[] = [];

  for (const id of request_ids) {
    const status = existingMap.get(id);
    if (!status) {
      result.failed.push({
        request_id: id,
        error: 'Radiology request not found',
      });
    } else if (status !== 'Pending') {
      result.failed.push({
        request_id: id,
        error: `Cannot reject request with status: ${status}`,
      });
    } else {
      validIds.push(id);
    }
  }

  // Bulk update all valid requests
  if (validIds.length > 0) {
    const { error: updateError } = await supabase
      .from('radiology_requests')
      .update({
        status: 'Rejected',
        rejected_by: staffData?.id,
        rejected_at: new Date().toISOString(),
        rejection_reason,
        updated_at: new Date().toISOString(),
      })
      .in('request_id', validIds);

    if (updateError) {
      for (const id of validIds) {
        result.failed.push({ request_id: id, error: updateError.message });
      }
    } else {
      result.successful = validIds;
    }
  }

  return result;
}

/**
 * Upload a single scan image to storage and return the path
 * Note: The RadiologyReportForm handles image uploads directly via uploadFile helper.
 * This function is kept for potential direct API usage.
 */
export async function uploadScanImages(
  dto: UploadScanImageDTO,
): Promise<string> {
  const { scan_request_id, image_path, file_name } = dto;

  // The UploadScanImageDTO already contains the uploaded image_path
  // This function is mainly for consistency - actual upload happens in the form
  // Return the image_path that was already set
  if (image_path) {
    return image_path;
  }

  // If no image_path, throw error
  throw new Error('No image path provided in UploadScanImageDTO');
}

// =============================================================================
// EXTERNAL RADIOLOGY — RESULT ENTRY
// =============================================================================
// The facility sends imaging studies out and receives a report later. This
// helper records the external result directly, without the internal
// scheduling/imaging/reporting state machine.
// =============================================================================

export interface ExternalRadiologyResultDTO {
  request_id: string;
  findings: string;
  impression: string;
  report?: string;
  image?: {
    file: File;
    url: string;
    name: string;
    size: number;
    mime_type: string;
  } | null;
}

export async function recordExternalRadiologyResult(
  dto: ExternalRadiologyResultDTO,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const staffRecord = await fetchStaffByUser(user.id, user.email || undefined);
  const now = new Date().toISOString();
  const reportText =
    dto.report ||
    [dto.findings, dto.impression].filter(Boolean).join('\n\n') ||
    'External report recorded';

  const { error: updateError } = await supabase
    .from('radiology_requests')
    .update({
      status: 'Final Report',
      findings: dto.findings || null,
      impression: dto.impression || null,
      report: reportText,
      result_file_url: dto.image?.url || null,
      performed_at: now,
      performed_by: staffRecord?.staff_id || null,
      report_uploaded_at: now,
      report_uploaded_by: staffRecord?.id || null,
      updated_at: now,
    })
    .eq('request_id', dto.request_id);

  if (updateError) throw updateError;


}
