/**
 * Server Configuration Service
 *
 * Manages the connection configuration for client machines connecting
 * to a central Supabase server via Cloudflare Tunnel (*.trycloudflare.com).
 *
 * Configuration is stored in the user's app data directory and persists
 * across application restarts.
 *
 * SECURITY: Never stores or exposes service role key on client.
 */

import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import log from 'electron-log';
import { z } from 'zod';

export interface ServerConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serverName?: string;
  configuredAt?: string;
}

const CONFIG_FILENAME = 'server-config.json';
const DEFAULT_SERVER_NAME = 'EMR Server';
const MAX_SERVER_NAME_LENGTH = 120;

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT_MS = 8000;

const serverUrlSchema = z.string().trim().min(1).max(2048);
const serverNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SERVER_NAME_LENGTH)
  .optional();
const anonKeySchema = z.string().trim().min(1).optional();
const allowLocalSchema = z.boolean().optional();
const legacyServerHostSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9.-]+$/);
const serverConfigSchema = z.object({
  supabaseUrl: z.string().trim().min(1).max(2048),
  supabaseAnonKey: z.string().trim().min(1).max(4096),
  serverName: z.string().trim().min(1).max(MAX_SERVER_NAME_LENGTH).optional(),
  configuredAt: z.string().datetime().optional(),
});
const nullableServerConfigSchema = serverConfigSchema.nullable();
const serverConnectionResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  latency: z.number().int().nonnegative().optional(),
});
const serverUrlValidationResultSchema = z.object({
  valid: z.boolean(),
  error: z.string().optional(),
  normalized: z.string().optional(),
});
const serverConfigSaveResultSchema = z.object({
  success: z.boolean(),
  config: serverConfigSchema.nullable().optional(),
  error: z.string().optional(),
});
const serverModeResultSchema = z.object({
  isServer: z.boolean(),
  localUrl: z.string().optional(),
});
const serverHealthCheckResultSchema = serverConnectionResultSchema.extend({
  needsSetup: z.boolean(),
});

function parseInput<T>(
  schema: z.ZodType<T>,
  value: unknown,
  channel: string,
  field: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    log.warn(`[ServerConfig] ${channel} rejected invalid ${field} payload`);
    throw new Error(`Invalid ${field} payload`);
  }
  return parsed.data;
}

function parseOutput<T>(
  schema: z.ZodType<T>,
  value: unknown,
  channel: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    log.error(
      `[ServerConfig] ${channel} generated invalid response payload`,
      parsed.error.format(),
    );
    throw new Error(`Invalid ${channel} response payload`);
  }
  return parsed.data;
}

function resolveAnonKey(explicitAnonKey?: string): string | null {
  if (explicitAnonKey && explicitAnonKey.trim()) {
    return explicitAnonKey.trim();
  }

  const savedConfig = loadServerConfig();
  if (savedConfig?.supabaseAnonKey?.trim()) {
    return savedConfig.supabaseAnonKey.trim();
  }

  if (process.env.SUPABASE_ANON_KEY?.trim()) {
    return process.env.SUPABASE_ANON_KEY.trim();
  }

  return null;
}

function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, CONFIG_FILENAME);
}

/**
 * Load server configuration from disk
 */
export function loadServerConfig(): ServerConfig | null {
  try {
    const configPath = getConfigPath();

    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const parsed = serverConfigSchema.safeParse(JSON.parse(data));
      if (!parsed.success) {
        log.error(
          '[ServerConfig] Invalid configuration payload on disk:',
          parsed.error.format(),
        );
        return null;
      }
      const config = parsed.data;
      log.info('[ServerConfig] Loaded configuration from:', configPath);
      return config;
    }

    log.info('[ServerConfig] No configuration file found');
    return null;
  } catch (error) {
    log.error('[ServerConfig] Failed to load configuration:', error);
    return null;
  }
}

/**
 * Save server configuration to disk
 */
export function saveServerConfig(config: ServerConfig): boolean {
  try {
    const configPath = getConfigPath();
    const configDir = path.dirname(configPath);

    // Ensure directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Add timestamp
    config.configuredAt = new Date().toISOString();

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    log.info('[ServerConfig] Saved configuration to:', configPath);
    return true;
  } catch (error) {
    log.error('[ServerConfig] Failed to save configuration:', error);
    return false;
  }
}

/**
 * Delete server configuration
 */
export function deleteServerConfig(): boolean {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      log.info('[ServerConfig] Deleted configuration');
    }
    return true;
  } catch (error) {
    log.error('[ServerConfig] Failed to delete configuration:', error);
    return false;
  }
}

/**
 * Validate server URL format
 * - Must be HTTPS (except for localhost in dev mode or trycloudflare.com)
 * - Must not be localhost or private IP on production
 */
export function validateServerUrl(
  url: string,
  allowLocal: boolean = false,
): {
  valid: boolean;
  error?: string;
  normalized?: string;
} {
  try {
    // Trim and normalize
    const trimmed = url.trim();
    if (!trimmed) {
      return { valid: false, error: 'Server URL is required' };
    }

    // Parse URL
    const parsed = new URL(trimmed);

    // Check protocol
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    const hostname = parsed.hostname.toLowerCase();
    const isCloudflare = hostname.endsWith('.trycloudflare.com');

    // Block localhost/local IPs unless explicitly allowed (dev mode)
    if (!allowLocal) {
      // Block localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return {
          valid: false,
          error:
            'Localhost is not allowed. Please use the server URL provided by your admin.',
        };
      }

      // Block private IP ranges
      const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (ipMatch) {
        const [, a, b] = ipMatch.map(Number);
        // 10.x.x.x
        if (a === 10) {
          return {
            valid: false,
            error:
              'Private network IPs are not allowed. Please use the server URL provided by your admin.',
          };
        }
        // 172.16.x.x - 172.31.x.x
        if (a === 172 && b >= 16 && b <= 31) {
          return {
            valid: false,
            error:
              'Private network IPs are not allowed. Please use the server URL provided by your admin.',
          };
        }
        // 192.168.x.x
        if (a === 192 && b === 168) {
          return {
            valid: false,
            error:
              'Private network IPs are not allowed. Please use the server URL provided by your admin.',
          };
        }
      }

      // Require HTTPS for production URLs, but allow HTTP for Cloudflare tunnels
      // Cloudflare tunnel handles the HTTPS termination
      if (parsed.protocol !== 'https:' && !isCloudflare) {
        return {
          valid: false,
          error: 'Server URL must use HTTPS for security',
        };
      }
    }

    // Return normalized URL (without trailing slash)
    const normalized = `${parsed.protocol}//${parsed.host}`;
    return { valid: true, normalized };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid URL format. Example: http://xxxx.trycloudflare.com',
    };
  }
}

/**
 * Test connection to a Supabase server via URL
 * Works with Cloudflare Tunnel URLs (*.trycloudflare.com)
 */
async function testServerConnection(serverUrl: string): Promise<{
  success: boolean;
  error?: string;
  latency?: number;
}> {
  const startTime = Date.now();

  try {
    // Validate URL first
    const validation = validateServerUrl(serverUrl, true); // Allow local for testing
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const url = `${validation.normalized}/rest/v1/`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      CONNECTION_TIMEOUT_MS,
    );

    log.info('[ServerConfig] Testing connection to:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    // Any response (including 400/401 "Missing API key") means server is reachable
    // Supabase returns various status codes, all indicate the server is up
    log.info(
      '[ServerConfig] Connection test result:',
      response.status,
      'latency:',
      latency,
    );
    return { success: true, latency };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    log.error('[ServerConfig] Connection test failed:', error.message);

    if (error.name === 'AbortError') {
      return {
        success: false,
        error: `Connection timed out after ${CONNECTION_TIMEOUT_MS / 1000} seconds. The server may be offline or the URL may have changed.`,
        latency,
      };
    }

    // DNS resolution failure
    if (error.code === 'ENOTFOUND' || error.message?.includes('getaddrinfo')) {
      return {
        success: false,
        error:
          'Server not found. The tunnel URL may have expired or changed. Please get the new URL from your admin.',
        latency,
      };
    }

    // Connection refused
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Connection refused. The server may be offline.',
        latency,
      };
    }

    // SSL/TLS errors
    if (
      error.code === 'CERT_HAS_EXPIRED' ||
      error.message?.includes('certificate')
    ) {
      return {
        success: false,
        error: 'SSL certificate error. Please contact your admin.',
        latency,
      };
    }

    return {
      success: false,
      error:
        error.message ||
        'Failed to connect to server. Please check the URL and try again.',
      latency,
    };
  }
}

/**
 * Check if running as server (has local Supabase) or client
 */
async function detectServerMode(): Promise<{
  isServer: boolean;
  localUrl?: string;
}> {
  // Check if local Supabase is running
  try {
    const result = await testServerConnection('http://127.0.0.1:54321');
    if (result.success) {
      return { isServer: true, localUrl: 'http://127.0.0.1:54321' };
    }
  } catch {
    // Local Supabase not running
  }

  return { isServer: false };
}

/**
 * Get effective configuration (from file or environment)
 * Priority: Saved config first (user may have updated URL), then env vars as fallback
 */
export function getEffectiveConfig(): ServerConfig | null {
  // First check saved configuration (user's saved URL takes priority)
  const savedConfig = loadServerConfig();
  if (savedConfig?.supabaseUrl && savedConfig?.supabaseAnonKey) {
    return savedConfig;
  }

  // Fall back to environment variables (development mode)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    };
  }

  return null;
}

/**
 * Register IPC handlers for server configuration
 */
export function registerServerConfigHandlers(): void {
  // Synchronous read used by the renderer before creating the Supabase client.
  ipcMain.on('serverConfig:getSync', (event) => {
    event.returnValue = getEffectiveConfig();
  });

  // LAN addresses so a host can tell other machines how to join.
  ipcMain.handle('serverConfig:lanInfo', async () => {
    const addresses: string[] = [];
    const interfaces = os.networkInterfaces();
    Object.values(interfaces).forEach((entries) => {
      (entries || []).forEach((entry) => {
        if (entry.family === 'IPv4' && !entry.internal) {
          addresses.push(entry.address);
        }
      });
    });
    return {
      addresses,
      port: 54321,
      apiUrls: addresses.map((ip) => `http://${ip}:54321`),
    };
  });

  // Get current configuration
  ipcMain.handle('serverConfig:get', async () => {
    return parseOutput(
      nullableServerConfigSchema,
      getEffectiveConfig(),
      'serverConfig:get',
    );
  });

  // Check if configuration is needed
  ipcMain.handle('serverConfig:needsSetup', async () => {
    const config = getEffectiveConfig();
    return parseOutput(
      z.boolean(),
      !config || !config.supabaseUrl || !config.supabaseAnonKey,
      'serverConfig:needsSetup',
    );
  });

  // Test connection to a server URL
  ipcMain.handle(
    'serverConfig:testConnection',
    async (_event, rawServerUrl: unknown) => {
      const serverUrl = parseInput(
        serverUrlSchema,
        rawServerUrl,
        'serverConfig:testConnection',
        'serverUrl',
      );
      const result = await testServerConnection(serverUrl);
      return parseOutput(
        serverConnectionResultSchema,
        result,
        'serverConfig:testConnection',
      );
    },
  );

  // Validate URL format
  ipcMain.handle(
    'serverConfig:validateUrl',
    async (_event, rawUrl: unknown, rawAllowLocal?: unknown) => {
      const url = parseInput(
        serverUrlSchema,
        rawUrl,
        'serverConfig:validateUrl',
        'url',
      );
      const allowLocal =
        rawAllowLocal === undefined
          ? false
          : parseInput(
              allowLocalSchema,
              rawAllowLocal,
              'serverConfig:validateUrl',
              'allowLocal',
            );
      return parseOutput(
        serverUrlValidationResultSchema,
        validateServerUrl(url, allowLocal),
        'serverConfig:validateUrl',
      );
    },
  );

  // Save new configuration with URL
  ipcMain.handle(
    'serverConfig:saveUrl',
    async (
      _event,
      rawServerUrl: unknown,
      rawServerName?: unknown,
      rawAnonKey?: unknown,
    ) => {
      const serverUrl = parseInput(
        serverUrlSchema,
        rawServerUrl,
        'serverConfig:saveUrl',
        'serverUrl',
      );
      const serverName =
        rawServerName === undefined
          ? undefined
          : parseInput(
              serverNameSchema,
              rawServerName,
              'serverConfig:saveUrl',
              'serverName',
            );
      const anonKey =
        rawAnonKey === undefined
          ? undefined
          : parseInput(
              anonKeySchema,
              rawAnonKey,
              'serverConfig:saveUrl',
              'supabaseAnonKey',
            );

      // Validate URL
      const validation = validateServerUrl(serverUrl, true); // Allow local for dev
      if (!validation.valid) {
        return parseOutput(
          serverConfigSaveResultSchema,
          { success: false, error: validation.error },
          'serverConfig:saveUrl',
        );
      }

      const resolvedAnonKey = resolveAnonKey(anonKey);
      if (!resolvedAnonKey) {
        return parseOutput(
          serverConfigSaveResultSchema,
          {
            success: false,
            error:
              'Supabase anon key is not configured. Set SUPABASE_ANON_KEY or provide a key during setup.',
          },
          'serverConfig:saveUrl',
        );
      }

      const config: ServerConfig = {
        supabaseUrl: validation.normalized!,
        supabaseAnonKey: resolvedAnonKey,
        serverName: serverName || DEFAULT_SERVER_NAME,
      };

      const success = saveServerConfig(config);
      return parseOutput(
        serverConfigSaveResultSchema,
        {
          success,
          config: success ? config : null,
          error: success ? undefined : 'Failed to save configuration',
        },
        'serverConfig:saveUrl',
      );
    },
  );

  // Legacy save handler (for backward compatibility with IP-based config)
  ipcMain.handle(
    'serverConfig:save',
    async (
      _event,
      rawServerHost: unknown,
      rawServerName?: unknown,
      rawAnonKey?: unknown,
    ) => {
      const serverHost = parseInput(
        legacyServerHostSchema,
        rawServerHost,
        'serverConfig:save',
        'serverHost',
      );
      const serverName =
        rawServerName === undefined
          ? undefined
          : parseInput(
              serverNameSchema,
              rawServerName,
              'serverConfig:save',
              'serverName',
            );
      const anonKey =
        rawAnonKey === undefined
          ? undefined
          : parseInput(
              anonKeySchema,
              rawAnonKey,
              'serverConfig:save',
              'supabaseAnonKey',
            );

      const resolvedAnonKey = resolveAnonKey(anonKey);
      if (!resolvedAnonKey) {
        return parseOutput(
          serverConfigSaveResultSchema,
          {
            success: false,
            config: null,
            error:
              'Supabase anon key is not configured. Set SUPABASE_ANON_KEY or provide a key during setup.',
          },
          'serverConfig:save',
        );
      }

      const config: ServerConfig = {
        supabaseUrl: `http://${serverHost}:54321`,
        supabaseAnonKey: resolvedAnonKey,
        serverName: serverName || `${DEFAULT_SERVER_NAME} (${serverHost})`,
      };

      const success = saveServerConfig(config);
      return parseOutput(
        serverConfigSaveResultSchema,
        {
          success,
          config: success ? config : null,
          error: success ? undefined : 'Failed to save configuration',
        },
        'serverConfig:save',
      );
    },
  );

  // Clear configuration (reset to setup mode)
  ipcMain.handle('serverConfig:clear', async () => {
    return parseOutput(z.boolean(), deleteServerConfig(), 'serverConfig:clear');
  });

  // Detect if this machine is the server
  ipcMain.handle('serverConfig:detectMode', async () => {
    const mode = await detectServerMode();
    return parseOutput(serverModeResultSchema, mode, 'serverConfig:detectMode');
  });

  // Get the configuration file path (for debugging)
  ipcMain.handle('serverConfig:getPath', async () => {
    return parseOutput(
      z.string().min(1),
      getConfigPath(),
      'serverConfig:getPath',
    );
  });

  // Health check - quick connectivity test for current or specified URL
  ipcMain.handle(
    'serverConfig:healthCheck',
    async (_event, rawServerUrl?: unknown) => {
      // Use provided URL or fall back to configured URL
      let urlToCheck =
        rawServerUrl === undefined
          ? undefined
          : parseInput(
              serverUrlSchema,
              rawServerUrl,
              'serverConfig:healthCheck',
              'serverUrl',
            );

      if (!urlToCheck) {
        const config = getEffectiveConfig();
        if (!config?.supabaseUrl) {
          return parseOutput(
            serverHealthCheckResultSchema,
            { success: false, error: 'No server configured', needsSetup: true },
            'serverConfig:healthCheck',
          );
        }
        urlToCheck = config.supabaseUrl;
      }

      const result = await testServerConnection(urlToCheck);
      return parseOutput(
        serverHealthCheckResultSchema,
        { ...result, needsSetup: false },
        'serverConfig:healthCheck',
      );
    },
  );

  log.info('[ServerConfig] IPC handlers registered');
}
