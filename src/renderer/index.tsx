import { createRoot } from 'react-dom/client';
import App from './App';
import { applyStoredAppearance } from './hooks/useAppearance';
import { isVersionConflictError } from './lib/errors/errorNormalization';
import { AppBootBoundary, AppBootFailure } from './components/AppBootBoundary';

function normalizeBootError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  return new Error('Unknown renderer startup error');
}

/** Network/timeout errors should not crash the renderer on boot. */
function isTransientNetworkError(value: unknown): boolean {
  const name =
    value instanceof Error ? value.name.toLowerCase() : '';
  const msg =
    value instanceof Error
      ? value.message.toLowerCase()
      : typeof value === 'string'
        ? value.toLowerCase()
        : '';
  if (!name && !msg) return false;
  return (
    name === 'aborterror' ||
    name === 'timeouterror' ||
    name === 'typeerror' && msg.includes('failed to fetch') ||
    msg.includes('aborted') ||
    msg.includes('timeout') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('connection closed') ||
    msg.includes('connection refused') ||
    msg.includes('fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('net::err_')
  );
}

if (typeof window !== 'undefined') {
  const bootDeadline = Date.now() + 15000;
  window.addEventListener('unhandledrejection', (event) => {
    if (!isVersionConflictError(event.reason)) return;

    // Avoid noisy global error popups for stale optimistic-lock writes.
    event.preventDefault();
    console.info(
      '[ErrorSuppression] Ignored stale version conflict rejection.',
    );
  });

  window.addEventListener('error', (event) => {
    if (!isVersionConflictError(event.error || event.message)) return;

    event.preventDefault();
    console.info(
      '[ErrorSuppression] Ignored stale version conflict error event.',
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isVersionConflictError(event.reason)) return;
    if (Date.now() > bootDeadline) return;
    if (isTransientNetworkError(event.reason)) {
      event.preventDefault();
      console.warn('[RendererBoot] Transient network error during startup (non-fatal):', event.reason);
      return;
    }

    event.preventDefault();
    const error = normalizeBootError(event.reason);
    console.error('[RendererBoot] Fatal unhandled rejection during startup:', error);
    root.render(<AppBootFailure error={error} />);
  });

  window.addEventListener('error', (event) => {
    if (isVersionConflictError(event.error || event.message)) return;
    if (Date.now() > bootDeadline) return;
    if (isTransientNetworkError(event.error || event.message)) {
      event.preventDefault();
      console.warn('[RendererBoot] Transient network error during startup (non-fatal):', event.error || event.message);
      return;
    }

    event.preventDefault();
    const error = normalizeBootError(event.error || event.message);
    console.error('[RendererBoot] Fatal error during startup:', error);
    root.render(<AppBootFailure error={error} />);
  });
}

// Apply the saved text size / density before the first paint of the app.
applyStoredAppearance();

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

// Always render the App - ConfigProvider will handle setup if needed
root.render(
  <AppBootBoundary>
    <App />
  </AppBootBoundary>,
);
