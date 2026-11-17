// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  // ICD API - proxied through main process to avoid CORS
  icd: {
    search: (keyword: string, maxResults?: number) =>
      ipcRenderer.invoke('icd:search', keyword, maxResults),
    getCode: (code: string) => ipcRenderer.invoke('icd:getCode', code),
    getStatus: () => ipcRenderer.invoke('icd:status'),
  },
  // PDF operations
  pdf: {
    saveAndOpen: (filename: string, data: number[]) =>
      ipcRenderer.invoke('save-and-open-pdf', { filename, data }),
  },
  // HTML operations (for forms/documents)
  html: {
    saveAndOpen: (filename: string, content: string) =>
      ipcRenderer.invoke('save-and-open-html', { filename, content }),
  },
  // Admin operations (secure - service role key stays in main process)
  admin: {
    isAvailable: () => ipcRenderer.invoke('admin:isAvailable'),
    createUser: (params: {
      email: string;
      password: string;
      fullName: string;
      role: string;
    }) => ipcRenderer.invoke('admin:createUser', params),
    deleteUser: (userId: string) =>
      ipcRenderer.invoke('admin:deleteUser', userId),
    updateUser: (params: {
      userId: string;
      email?: string;
      password?: string;
      userMetadata?: Record<string, unknown>;
    }) => ipcRenderer.invoke('admin:updateUser', params),
  },
  // Server configuration (for client setup)
  serverConfig: {
    get: () => ipcRenderer.invoke('serverConfig:get'),
    getSync: () => ipcRenderer.sendSync('serverConfig:getSync'),
    lanInfo: () => ipcRenderer.invoke('serverConfig:lanInfo'),
    needsSetup: () => ipcRenderer.invoke('serverConfig:needsSetup'),
    testConnection: (serverUrl: string) =>
      ipcRenderer.invoke('serverConfig:testConnection', serverUrl),
    validateUrl: (url: string, allowLocal?: boolean) =>
      ipcRenderer.invoke('serverConfig:validateUrl', url, allowLocal),
    saveUrl: (serverUrl: string, serverName?: string, anonKey?: string) =>
      ipcRenderer.invoke(
        'serverConfig:saveUrl',
        serverUrl,
        serverName,
        anonKey,
      ),
    save: (serverIp: string, serverName?: string, anonKey?: string) =>
      ipcRenderer.invoke('serverConfig:save', serverIp, serverName, anonKey),
    clear: () => ipcRenderer.invoke('serverConfig:clear'),
    detectMode: () => ipcRenderer.invoke('serverConfig:detectMode'),
    getPath: () => ipcRenderer.invoke('serverConfig:getPath'),
    healthCheck: (serverUrl?: string) =>
      ipcRenderer.invoke('serverConfig:healthCheck', serverUrl),
  },
  // AI Clinical Assistant
  ai: {
    query: (request: unknown) => ipcRenderer.invoke('ai:query', request),
    queryStream: (request: unknown) =>
      ipcRenderer.invoke('ai:query-stream', request),
    onStreamChunk: (
      callback: (data: {
        chunk: string;
        done: boolean;
        error?: string;
      }) => void,
    ) => {
      const handler = (
        _evt: IpcRendererEvent,
        data: { chunk: string; done: boolean; error?: string },
      ) => callback(data);
      ipcRenderer.on('ai:stream-chunk', handler);
      return () => {
        ipcRenderer.removeListener('ai:stream-chunk', handler);
      };
    },
    search: (request: unknown) => ipcRenderer.invoke('ai:search', request),
    draftNote: (request: unknown) =>
      ipcRenderer.invoke('ai:draftNote', request),
    reviewConsultation: (request: unknown) =>
      ipcRenderer.invoke('ai:review-consultation', request),
    embedPatient: (patientId: string) =>
      ipcRenderer.invoke('ai:embedPatient', patientId),
    health: () => ipcRenderer.invoke('ai:health'),
    config: () => ipcRenderer.invoke('ai:config'),
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
