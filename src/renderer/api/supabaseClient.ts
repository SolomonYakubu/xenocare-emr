import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  createTraceId,
  logOperationDuration,
  SLOW_ERROR_THRESHOLD_MS,
  SLOW_WARN_THRESHOLD_MS,
  type ObservabilityLevel,
} from '../utils/observability';

/**
 * Simple Supabase Client
 *
 * Uses environment variables directly from .env file.
 * No dynamic configuration - just straight env vars.
 */

// Prefer the server saved in the desktop app (LAN host), then env vars.
type RuntimeServerConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

declare global {
  interface Window {
    /** Injected by the browser web server (scripts/server/web-server.mjs). */
    __XENOCARE_CONFIG__?: RuntimeServerConfig;
  }
}

let runtimeServerConfig: RuntimeServerConfig | null = null;
try {
  if (typeof window !== 'undefined' && window.__XENOCARE_CONFIG__) {
    // Browser build: the web server injects the host's API URL and anon key.
    runtimeServerConfig = window.__XENOCARE_CONFIG__;
  } else if (
    typeof window !== 'undefined' &&
    window.electron?.serverConfig?.getSync
  ) {
    runtimeServerConfig = window.electron.serverConfig.getSync();
  }
} catch {
  runtimeServerConfig = null;
}

// Get the URL and key directly from environment variables
const SUPABASE_URL =
  runtimeServerConfig?.supabaseUrl ||
  process.env.SUPABASE_URL ||
  'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  runtimeServerConfig?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_REQUEST_TIMEOUT_MS = Number(
  process.env.SUPABASE_REQUEST_TIMEOUT_MS || 20000,
);
/** Storage uploads (large files) get a much longer timeout. */
const SUPABASE_UPLOAD_TIMEOUT_MS = Number(
  process.env.SUPABASE_UPLOAD_TIMEOUT_MS || 120000,
);
const SUPABASE_RETRY_ATTEMPTS = Math.max(
  1,
  Number(process.env.SUPABASE_RETRY_ATTEMPTS || 3),
);
const SUPABASE_SUCCESS_WARN_THRESHOLD_MS = Number(
  process.env.SUPABASE_SUCCESS_WARN_THRESHOLD_MS || 1500,
);
const SUPABASE_PERF_LOG = !['0', 'false', 'no'].includes(
  String(
    process.env.SUPABASE_PERF_LOG || process.env.NODE_ENV !== 'production',
  ).toLowerCase(),
);

type StorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createAuthStorage(): StorageAdapter {
  if (typeof window !== 'undefined') {
    try {
      const storage = window.sessionStorage;
      const probeKey = '__ndc_emr_supabase_storage_probe__';
      storage.setItem(probeKey, 'ok');
      storage.removeItem(probeKey);
      return storage;
    } catch {
      // Fall through to in-memory storage.
    }
  }

  const memoryStorage = new Map<string, string>();
  return {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStorage.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStorage.delete(key);
    },
  };
}

const authStorage = createAuthStorage();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return (
    name === 'aborterror' ||
    name === 'timeouterror' ||
    message.includes('aborted') ||
    message.includes('timed out') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('connection closed') ||
    message.includes('connection refused')
  );
}

function getRequestLabel(input: RequestInfo | URL): string {
  try {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  } catch {
    return 'unknown-request';
  }
}

function parseSupabaseRequestContext(requestLabel: string): {
  endpoint: string;
  resource?: string;
  patientId?: string;
  encounterId?: string;
} {
  try {
    const url = new URL(requestLabel);
    const endpoint = url.pathname;
    const patientRaw = url.searchParams.get('patient_id');
    const encounterRaw = url.searchParams.get('encounter_id');
    const normalize = (value: string | null): string | undefined => {
      if (!value) return undefined;
      const stripped = value
        .replace(/^eq\./, '')
        .replace(/^in\.\(/, '')
        .replace(/\)$/, '')
        .split(',')[0]
        .trim();
      return stripped || undefined;
    };
    return {
      endpoint,
      resource: endpoint.split('/').pop() || undefined,
      patientId: normalize(patientRaw),
      encounterId: normalize(encounterRaw),
    };
  } catch {
    return {
      endpoint: requestLabel,
    };
  }
}

function getSupabaseRequestLevel(params: {
  durationMs: number;
  status?: number;
  timedOut?: boolean;
  error?: unknown;
}): ObservabilityLevel {
  const { durationMs, status, timedOut, error } = params;

  if (timedOut || error) return 'error';
  if (typeof status === 'number') {
    if (status >= 500) return 'error';
    if (status >= 400) return 'warn';

    // Successful responses should not be noisy at the generic 500ms warn level.
    // Use a higher success-only threshold so normal reads remain info.
    if (durationMs >= SUPABASE_SUCCESS_WARN_THRESHOLD_MS) return 'warn';
    return 'info';
  }

  if (durationMs >= SLOW_ERROR_THRESHOLD_MS) return 'error';
  if (durationMs >= SLOW_WARN_THRESHOLD_MS) return 'warn';
  return 'info';
}

async function getResponsePayloadBytes(
  response: Response,
  allowBodyEstimate: boolean,
): Promise<number | undefined> {
  const payloadBytesHeader = response.headers.get('content-length');
  const payloadBytes = payloadBytesHeader ? Number(payloadBytesHeader) : NaN;
  if (Number.isFinite(payloadBytes)) {
    return payloadBytes;
  }

  if (!allowBodyEstimate) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }

  try {
    const text = await response.clone().text();
    return new TextEncoder().encode(text).length;
  } catch {
    return undefined;
  }
}

const resilientFetch: typeof fetch = async (input, init) => {
  let lastError: unknown;
  const requestLabel = getRequestLabel(input);
  const traceId = createTraceId('Supabase', 'request');
  const requestContext = parseSupabaseRequestContext(requestLabel);

  for (let attempt = 1; attempt <= SUPABASE_RETRY_ATTEMPTS; attempt += 1) {
    const method = (init?.method || 'GET').toUpperCase();
    const startedAt = Date.now();
    const isWriteRequest = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const isStorageUpload =
      method === 'POST' &&
      typeof input === 'string' &&
      input.includes('/storage/v1/object/');
    const timeoutMs = isStorageUpload
      ? SUPABASE_UPLOAD_TIMEOUT_MS
      : SUPABASE_REQUEST_TIMEOUT_MS;
    const hasExternalSignal = Boolean(init?.signal);
    const controller = hasExternalSignal ? null : new AbortController();
    const timeoutId = controller
      ? setTimeout(
          () =>
            controller.abort(
              new DOMException(
                `Supabase request timed out after ${timeoutMs}ms`,
                'TimeoutError',
              ),
            ),
          timeoutMs,
        )
      : null;

    try {
      const response = await fetch(input, {
        ...init,
        signal: init?.signal || controller?.signal,
      });

      // Retry transient server-side failures.
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < SUPABASE_RETRY_ATTEMPTS
      ) {
        const durationMs = Date.now() - startedAt;
        const payloadBytes = await getResponsePayloadBytes(response, true);
        if (SUPABASE_PERF_LOG || durationMs >= 500) {
          logOperationDuration({
            module: 'Supabase',
            action: 'request',
            step: `attempt_${attempt}`,
            duration_ms: durationMs,
            level_override: getSupabaseRequestLevel({
              durationMs,
              status: response.status,
            }),
            trace_id: traceId,
            patient_id: requestContext.patientId,
            encounter_id: requestContext.encounterId,
            endpoint: requestContext.endpoint,
            resource: requestContext.resource,
            method,
            request: requestLabel,
            status: response.status,
            payload_bytes: payloadBytes,
            attempt,
            retrying: true,
          });
        }
        await sleep(200 * attempt);
        continue;
      }

      const durationMs = Date.now() - startedAt;
      const shouldLog =
        SUPABASE_PERF_LOG ||
        durationMs >= 500 ||
        response.status >= 400 ||
        isWriteRequest;
      if (shouldLog) {
        const payloadBytes = await getResponsePayloadBytes(
          response,
          durationMs >= 500 || response.status >= 400 || isWriteRequest,
        );
        logOperationDuration({
          module: 'Supabase',
          action: 'request',
          step: `attempt_${attempt}`,
          duration_ms: durationMs,
          level_override: getSupabaseRequestLevel({
            durationMs,
            status: response.status,
          }),
          trace_id: traceId,
          patient_id: requestContext.patientId,
          encounter_id: requestContext.encounterId,
          endpoint: requestContext.endpoint,
          resource: requestContext.resource,
          method,
          request: requestLabel,
          status: response.status,
          payload_bytes: payloadBytes,
          attempt,
          retrying: false,
          write_request: isWriteRequest,
        });
      }

      return response;
    } catch (error) {
      lastError = error;
      const timedOut = Boolean(
        controller?.signal.aborted && !init?.signal?.aborted,
      );
      const durationMs = Date.now() - startedAt;
      if (SUPABASE_PERF_LOG || durationMs >= 500 || timedOut) {
        logOperationDuration({
          module: 'Supabase',
          action: 'request',
          step: `attempt_${attempt}`,
          duration_ms: durationMs,
          level_override: getSupabaseRequestLevel({
            durationMs,
            timedOut,
            error,
          }),
          trace_id: traceId,
          patient_id: requestContext.patientId,
          encounter_id: requestContext.encounterId,
          endpoint: requestContext.endpoint,
          resource: requestContext.resource,
          method,
          request: requestLabel,
          attempt,
          timed_out: timedOut,
          retrying: attempt < SUPABASE_RETRY_ATTEMPTS,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (
        attempt >= SUPABASE_RETRY_ATTEMPTS ||
        (!timedOut && !isRetryableNetworkError(error))
      ) {
        throw error;
      }
      await sleep(200 * attempt);
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Supabase request failed');
};

// Create the supabase client
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    global: {
      fetch: resilientFetch,
    },
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // Disable URL detection - not needed in Electron
    },
  },
);

/**
 * Get the current Supabase URL (useful for debugging)
 */
export function getSupabaseUrl(): string {
  return SUPABASE_URL;
}

/**
 * Check if supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
}

/**
 * Check if supabase client has valid config
 */
export function isSupabaseInitialized(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}
