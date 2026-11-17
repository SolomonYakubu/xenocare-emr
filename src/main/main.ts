/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import 'dotenv/config'; // Load .env file first
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app, BrowserWindow, shell, ipcMain, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { z } from 'zod';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { registerICDHandlers } from './icdService';
import { registerAdminHandlers } from './adminService';
import {
  registerServerConfigHandlers,
  getEffectiveConfig,
} from './serverConfig';
import { registerAIHandlers } from './aiService';

function isEnvEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function buildStartupFailureHtml(title: string, detail: string): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const safeDetail = detail
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${safeTitle}</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #052e16 0%, #064e3b 50%, #111827 100%);
          color: #f8fafc;
          font-family: "Segoe UI", sans-serif;
          padding: 24px;
          box-sizing: border-box;
        }
        .panel {
          width: min(720px, 100%);
          background: rgba(15, 23, 42, 0.88);
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
        }
        h1 {
          margin: 0 0 12px;
          font-size: 28px;
        }
        p {
          margin: 0 0 12px;
          line-height: 1.6;
          color: #cbd5e1;
        }
        pre {
          margin: 16px 0 0;
          white-space: pre-wrap;
          word-break: break-word;
          background: rgba(2, 6, 23, 0.7);
          border-radius: 12px;
          padding: 16px;
          color: #e2e8f0;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <main class="panel">
        <h1>${safeTitle}</h1>
        <p>The application could not finish loading.</p>
        <p>See the Electron log for full details, then rebuild and retry.</p>
        <pre>${safeDetail}</pre>
      </main>
    </body>
  </html>`;
}

function formatRendererConsoleMessage(
  message: string,
  line: number,
  sourceId: string,
): string {
  const trimmedMessage = String(message || '').trim();
  const normalizedSource = String(sourceId || '').trim();
  const location = normalizedSource
    ? `${normalizedSource}${line > 0 ? `:${line}` : ''}`
    : line > 0
      ? `line ${line}`
      : 'unknown source';

  return `${trimmedMessage || '[no message]'} (${location})`;
}

// Initialize electron-log for both main and renderer processes
log.initialize();

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    if (!app.isPackaged) {
      log.info(
        '[Updater] Skip checkForUpdates because application is not packed',
      );
      return;
    }

    if (!isEnvEnabled(process.env.AUTO_UPDATE_ENABLED)) {
      log.info(
        '[Updater] Skip checkForUpdates because AUTO_UPDATE_ENABLED is not true',
      );
      return;
    }

    void autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      log.warn('[Updater] Auto update check failed:', error);
    });
  }
}

let mainWindow: BrowserWindow | null = null;

const safeFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._-]+$/);

const savePdfPayloadSchema = z.object({
  filename: safeFilenameSchema.refine(
    (name) => name.toLowerCase().endsWith('.pdf'),
    {
      message: 'PDF filename must end with .pdf',
    },
  ),
  data: z.array(z.number().int().min(0).max(255)).min(1).max(10_000_000),
});

const saveHtmlPayloadSchema = z.object({
  filename: safeFilenameSchema.refine(
    (name) =>
      name.toLowerCase().endsWith('.html') ||
      name.toLowerCase().endsWith('.htm'),
    {
      message: 'HTML filename must end with .html or .htm',
    },
  ),
  content: z.string().min(1).max(2_000_000),
});

const ipcExampleArgSchema = z.string().trim().min(1).max(200);

const fileOpenResultSchema = z.object({
  success: z.boolean(),
  path: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
});

function parseMainOutput<T>(
  schema: z.ZodType<T>,
  value: unknown,
  channel: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    log.error(
      `[IPC] Invalid ${channel} response payload`,
      parsed.error.format(),
    );
    throw new Error(`Invalid ${channel} response payload`);
  }
  return parsed.data;
}

function parseSafeFilename(rawFilename: string): string {
  const fileName = path.basename(rawFilename);
  if (fileName !== rawFilename) {
    throw new Error('Invalid filename payload');
  }
  return fileName;
}

ipcMain.on('ipc-example', async (event, rawArg: unknown) => {
  const parsedArg = ipcExampleArgSchema.safeParse(rawArg);
  if (!parsedArg.success) {
    log.warn('[IPC] Rejected invalid ipc-example payload');
    event.reply('ipc-example', 'IPC test: invalid payload');
    return;
  }

  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  log.debug(msgTemplate(parsedArg.data));
  event.reply('ipc-example', msgTemplate('pong'));
});

// IPC handler for saving and opening PDF files in system default viewer
ipcMain.handle('save-and-open-pdf', async (_event, rawPayload: unknown) => {
  try {
    const payload = savePdfPayloadSchema.parse(rawPayload);
    const filename = parseSafeFilename(payload.filename);

    // Create temp directory path
    const tempDir = path.join(os.tmpdir(), 'xenocare-receipts');

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create full file path
    const filePath = path.join(tempDir, filename);

    // Write the PDF data to file
    const buffer = Buffer.from(payload.data);
    fs.writeFileSync(filePath, buffer);

    // Open with system default PDF viewer
    await shell.openPath(filePath);

    return parseMainOutput(
      fileOpenResultSchema,
      { success: true, path: filePath },
      'save-and-open-pdf',
    );
  } catch (error) {
    log.error('Failed to save and open PDF:', error);
    return parseMainOutput(
      fileOpenResultSchema,
      { success: false, error: String(error) },
      'save-and-open-pdf',
    );
  }
});

ipcMain.handle('save-and-open-html', async (_event, rawPayload: unknown) => {
  try {
    const payload = saveHtmlPayloadSchema.parse(rawPayload);
    const filename = parseSafeFilename(payload.filename);

    // Create temp directory path
    const tempDir = path.join(os.tmpdir(), 'xenocare-forms');

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create full file path
    const filePath = path.join(tempDir, filename);

    // Write the HTML content to file
    fs.writeFileSync(filePath, payload.content, 'utf-8');

    // Open with system default browser
    await shell.openPath(filePath);

    return parseMainOutput(
      fileOpenResultSchema,
      { success: true, path: filePath },
      'save-and-open-html',
    );
  } catch (error) {
    log.error('Failed to save and open HTML:', error);
    return parseMainOutput(
      fileOpenResultSchema,
      { success: false, error: String(error) },
      'save-and-open-html',
    );
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  // Dev escape hatch: the extension download can hang on restricted networks,
  // which blocks window creation. Set SKIP_DEVTOOLS=true to boot without it.
  if (isEnvEnabled(process.env.SKIP_DEVTOOLS)) {
    return;
  }

  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch((err: Error) => log.error('Extension install failed:', err));
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const showStartupFailure = (title: string, detail: string) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const html = buildStartupFailureHtml(title, detail);
    void mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    );

    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  };

  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const initialWidth = Math.min(
    1600,
    Math.max(1280, Math.round(workArea.width * 0.92)),
  );
  const initialHeight = Math.min(
    1000,
    Math.max(820, Math.round(workArea.height * 0.92)),
  );

  mainWindow = new BrowserWindow({
    show: false,
    width: initialWidth,
    height: initialHeight,
    minWidth: 1100,
    minHeight: 720,
    icon: getAssetPath('xenocare-logo.png'),
    backgroundColor: '#006838', // XenoCare green - shows immediately while loading
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      webSecurity: true,
      backgroundThrottling: false, // Prevent throttling when window loses focus
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.webContents.on(
    'did-fail-load',
    (
      _event,
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
    ) => {
      log.error('[Window] Renderer load failed', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });

      if (isMainFrame) {
        showStartupFailure(
          'Renderer failed to load',
          `${errorDescription} (${validatedURL})`,
        );
      }
    },
  );

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('[Window] Renderer finished loading', {
      url: mainWindow?.webContents.getURL(),
    });
  });

  mainWindow.webContents.on(
    'console-message',
    (_event, level, message, line, sourceId) => {
      if (String(message || '').includes('[RendererConsole]')) {
        return;
      }

      const formatted = formatRendererConsoleMessage(message, line, sourceId);

      if (level >= 3) {
        log.error('[RendererConsole]', formatted);
        return;
      }

      if (level === 2) {
        log.warn('[RendererConsole]', formatted);
      }
    },
  );

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('[Window] Renderer process gone', details);
    showStartupFailure(
      'Renderer process exited unexpectedly',
      `${details.reason}${details.exitCode ? ` (exit code ${details.exitCode})` : ''}`,
    );
  });

  mainWindow.on('unresponsive', () => {
    log.warn('[Window] Main window became unresponsive');
  });

  // P1-05: Only open DevTools in debug/development mode.
  // In production builds DevTools are disabled to prevent inspection of
  // in-memory cache (MemoryCache) which holds PHI patient data.
  if (isDebug) {
    mainWindow.webContents.openDevTools();
  }

  // Show window immediately to avoid "not responding" perception
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (isEnvEnabled(process.env.START_MINIMIZED)) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Prevent renderer navigation to untrusted origins.
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = mainWindow?.webContents.getURL() || '';
    if (navigationUrl !== currentUrl) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    // Register server configuration handlers (for client setup)
    registerServerConfigHandlers();
    // Register ICD API handlers
    registerICDHandlers();
    // Register secure admin handlers (service role key operations)
    registerAdminHandlers();
    // Register AI Clinical Assistant handlers
    registerAIHandlers();

    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch((err: Error) => log.error('App ready failed:', err));
