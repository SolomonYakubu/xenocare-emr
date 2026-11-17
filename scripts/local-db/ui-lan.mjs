/**
 * Verifies the LAN "join a server" path in the real desktop app.
 *
 * Launches an isolated Electron profile (so the main app's saved server is
 * untouched), then exercises the preload API the login screen uses:
 * validateUrl -> saveUrl -> getSync -> clear.
 *
 * Usage: node scripts/local-db/ui-lan.mjs
 * Requires: `npm start` running (dev server on port 1212).
 */
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const electronPath = require('electron');
const WebSocket = require('ws');

const DEBUG_PORT = 9224;
const APP_URL = 'http://localhost:1212/index.html';
const PROFILE = '/tmp/xeno-lan-test-profile';
const LAN_URL = 'http://192.168.1.50:54321';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readAnonKey() {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  const env = fs.readFileSync('.env', 'utf8');
  const match = env.match(/^SUPABASE_ANON_KEY=(.*)$/m);
  return match ? match[1].trim() : '';
}

async function waitForDevServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(APP_URL, { method: 'GET' });
      if (res.ok) return true;
    } catch {
      /* keep waiting */
    }
    await sleep(1000);
  }
  throw new Error(`Dev server not reachable at ${APP_URL}`);
}

async function getPageTarget(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      const targets = await res.json();
      const page = targets.find(
        (t) => t.type === 'page' && t.url.includes('localhost:1212'),
      );
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      /* keep waiting */
    }
    await sleep(500);
  }
  throw new Error('Electron remote debugging target not found');
}

function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  const opened = new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  return {
    ready: opened,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      ws.close();
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        'Runtime.evaluate failed',
    );
  }
  return result.result?.value;
}

let child;
const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

try {
  await waitForDevServer();
  fs.rmSync(PROFILE, { recursive: true, force: true });

  child = spawn(
    electronPath,
    [`--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${PROFILE}`, '.'],
    {
      cwd: process.cwd(),
      env: { ...process.env, SKIP_DEVTOOLS: 'true' },
      stdio: 'ignore',
    },
  );

  const page = await getPageTarget();
  const cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.ready;

  // Wait for the login screen to paint.
  for (let i = 0; i < 60; i += 1) {
    const ready = await evaluate(
      cdp,
      "!!document.body && document.body.innerText.includes('Welcome back')",
    ).catch(() => false);
    if (ready) break;
    await sleep(500);
  }

  // Login screen should carry the XenoCare lockup and no legacy wordmark.
  const loginBrand = await evaluate(
    cdp,
    `(() => ({
      marks: document.querySelectorAll(
        '[aria-label="XenoCare"], img[alt="XenoCare"]',
      ).length,
      wordmark: document.body.innerText.includes('XENOCARE'),
      legacy: /xenolink/i.test(document.body.innerText),
    }))()`,
  );
  const { data: loginPng } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
  });
  fs.writeFileSync(
    '/tmp/xeno-ui-login-brand.png',
    Buffer.from(loginPng, 'base64'),
  );

  check(
    'XenoCare lockup on login screen',
    loginBrand?.marks > 0 && loginBrand?.wordmark === true,
    `${loginBrand?.marks} mark(s), wordmark=${loginBrand?.wordmark}`,
  );
  check('No legacy Xenolink brand text', loginBrand?.legacy === false);

  const valid = await evaluate(
    cdp,
    `window.electron.serverConfig.validateUrl(${JSON.stringify(LAN_URL)}, true)`,
  );
  check('LAN IP accepted by validator', valid?.valid === true, valid?.error || '');

  const blocked = await evaluate(
    cdp,
    `window.electron.serverConfig.validateUrl(${JSON.stringify(LAN_URL)}, false)`,
  );
  check(
    'LAN IP rejected without local opt-in',
    blocked?.valid === false,
    blocked?.error || '',
  );

  const anonKey = readAnonKey();
  const saved = await evaluate(
    cdp,
    `window.electron.serverConfig.saveUrl(${JSON.stringify(LAN_URL)}, 'LAN test', ${JSON.stringify(anonKey)})`,
  );
  check(
    'saveUrl persists LAN server',
    saved?.success === true && saved?.config?.supabaseUrl === LAN_URL,
    saved?.error || saved?.config?.supabaseUrl || '',
  );

  const sync = await evaluate(cdp, 'window.electron.serverConfig.getSync()');
  check(
    'getSync returns saved LAN server',
    sync?.supabaseUrl === LAN_URL && !!sync?.supabaseAnonKey,
    sync?.supabaseUrl || '',
  );

  const cleared = await evaluate(cdp, 'window.electron.serverConfig.clear()');
  const after = await evaluate(cdp, 'window.electron.serverConfig.getSync()');
  check(
    'clear() falls back to environment server',
    after?.supabaseUrl !== LAN_URL,
    `cleared=${cleared} now=${after?.supabaseUrl || 'env'}`,
  );

  // Drive the actual login-screen controls, not just the IPC layer.
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Server settings')); b?.click(); return !!b; })()",
  );
  for (let i = 0; i < 40; i += 1) {
    const open = await evaluate(
      cdp,
      "document.body.innerText.includes('Save & reconnect')",
    ).catch(() => false);
    if (open) break;
    await sleep(250);
  }
  await evaluate(
    cdp,
    `(() => {
      const set = (el, value) => {
        const proto = el.tagName === 'TEXTAREA'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(
        document.querySelector('input[placeholder="http://192.168.1.10:54321"]'),
        'http://127.0.0.1:54321',
      );
      set(document.querySelector('textarea'), ${JSON.stringify(anonKey)});
      return true;
    })()`,
  );
  await sleep(400);
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Save & reconnect')); b?.click(); return !!b; })()",
  ).catch(() => {});

  // The page reloads into the newly saved server.
  let uiSaved = false;
  for (let i = 0; i < 80; i += 1) {
    try {
      const state = await evaluate(
        cdp,
        `(() => ({
          login: document.body.innerText.includes('Welcome back'),
          modal: document.body.innerText.includes('Save & reconnect'),
        }))()`,
      );
      if (state?.login && !state?.modal) {
        const syncLocal = await evaluate(
          cdp,
          'window.electron.serverConfig.getSync()',
        );
        uiSaved = syncLocal?.supabaseUrl === 'http://127.0.0.1:54321';
        break;
      }
    } catch {
      /* context reloading */
    }
    await sleep(500);
  }
  check('Login-screen save reconnects to the new server', uiSaved);

  await evaluate(cdp, 'window.electron.serverConfig.clear()').catch(() => {});
  cdp.close();
} finally {
  if (child) child.kill('SIGKILL');
  await sleep(1500);
  try {
    fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    /* Chromium may still hold a lock; a stale temp profile is harmless. */
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} LAN checks passed`);
if (failed.length) process.exit(1);
