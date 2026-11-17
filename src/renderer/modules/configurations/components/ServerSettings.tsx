/**
 * Server Settings Component
 *
 * Displays current server configuration and allows changing the server connection.
 * This can be accessed from the Configurations module or app settings.
 *
 * Now supports Cloudflare Tunnel URLs (*.trycloudflare.com)
 */

import React, { useState, useEffect } from 'react';
import {
  Server,
  Wifi,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { getSupabaseUrl } from '../../../api/supabaseClient';
import { useServerConfig } from '../../../contexts/ConfigContext';
import { SkeletonCard } from '../../../components/ui/SkeletonLoader';

interface ServerInfo {
  supabaseUrl: string;
  serverName?: string;
  configuredAt?: string;
}

interface ConnectionStatus {
  connected: boolean;
  latency?: number;
  error?: string;
}

export default function ServerSettings() {
  const { showServerSetup } = useServerConfig();
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServerInfo();
  }, []);

  const loadServerInfo = async () => {
    setLoading(true);
    try {
      if (window.electron?.serverConfig) {
        const config = await window.electron.serverConfig.get();
        setServerInfo(config);
      } else {
        // Development mode - use environment
        setServerInfo({
          supabaseUrl: getSupabaseUrl(),
          serverName: 'Development Server',
        });
      }
    } catch (error) {
      console.error('Failed to load server info:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!serverInfo?.supabaseUrl) return;

    setTesting(true);
    setConnectionStatus(null);

    try {
      if (window.electron?.serverConfig) {
        // Use the URL directly for connection test
        const result = await window.electron.serverConfig.testConnection(
          serverInfo.supabaseUrl,
        );
        setConnectionStatus({
          connected: result.success,
          latency: result.latency,
          error: result.error,
        });
      } else {
        // Development fallback - simple fetch test
        const start = Date.now();
        const response = await fetch(`${serverInfo.supabaseUrl}/rest/v1/`, {
          method: 'HEAD',
        });
        setConnectionStatus({
          connected: response.ok,
          latency: Date.now() - start,
        });
      }
    } catch (error: any) {
      setConnectionStatus({
        connected: false,
        error: error.message || 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleUpdateServer = () => {
    // Use the ConfigContext's showServerSetup for manual updates
    showServerSetup('manual-update');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const extractHostname = (url?: string) => {
    if (!url) return 'Not configured';
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  };

  const isCloudflareUrl = (url?: string) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.hostname.includes('trycloudflare.com');
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <SkeletonCard lines={4} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Server className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Server Connection
            </h2>
            <p className="text-sm text-gray-500">
              Connect this computer to the hospital server
            </p>
          </div>
        </div>
      </div>

      {/* Server Info */}
      <div className="p-6 space-y-6">
        {/* Cloudflare Tunnel Info */}
        {isCloudflareUrl(serverInfo?.supabaseUrl) && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <div className="font-medium text-blue-800">
                  Cloudflare Tunnel Connection
                </div>
                <p className="text-sm text-blue-600">
                  Connected via Cloudflare Tunnel. If the server restarts, the
                  URL may change. Contact your administrator (Musa) for the new
                  URL if connection fails.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connection Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Server Name</div>
            <div className="font-medium text-gray-900">
              {serverInfo?.serverName || 'EMR Server'}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Server Host</div>
            <div className="font-mono text-gray-900 text-sm truncate">
              {extractHostname(serverInfo?.supabaseUrl)}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg col-span-1 md:col-span-2">
            <div className="text-sm text-gray-500 mb-1">Server URL</div>
            <div className="font-mono text-sm text-gray-900 break-all">
              {serverInfo?.supabaseUrl || 'Not configured'}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Configured On</div>
            <div className="text-gray-900">
              {formatDate(serverInfo?.configuredAt)}
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {connectionStatus && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 ${
              connectionStatus.connected
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {connectionStatus.connected ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div>
              <div
                className={`font-medium ${
                  connectionStatus.connected ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {connectionStatus.connected ? 'Connected' : 'Connection Failed'}
              </div>
              <div
                className={`text-sm ${
                  connectionStatus.connected ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {connectionStatus.connected
                  ? `Response time: ${connectionStatus.latency}ms`
                  : connectionStatus.error}
              </div>
              {!connectionStatus.connected &&
                isCloudflareUrl(serverInfo?.supabaseUrl) && (
                  <p className="text-sm text-red-600 mt-2">
                    The tunnel URL may have changed. Click "Update Server URL"
                    to enter the new URL.
                  </p>
                )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={testConnection}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            onClick={handleUpdateServer}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Update Server URL
          </button>
        </div>

        {/* Help Text */}
        <div className="text-sm text-gray-500 pt-2 border-t border-gray-100">
          <p>
            If you're having connection issues, contact your administrator for
            the current server URL. The URL typically looks like:{' '}
            <code className="bg-gray-100 px-1 rounded">
              http://xxxx.trycloudflare.com
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
