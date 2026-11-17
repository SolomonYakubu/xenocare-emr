/**
 * Verifies the browser (web) build against the LAN web server.
 *
 * Usage:
 *   node scripts/server/web-server.mjs --port 8080   # in another terminal
 *   node scripts/local-db/ui-web.mjs
 */
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const electronPath = require('electron');
const WebSocket = require('ws');

const DEBUG_PORT = 9232;
const WEB_URL = process.env.WEB_URL || 'http://127.0.0.1:8080/';
const APP_DIR = '/tmp/xeno-web-test-app';
const EMAIL = 'admin@ndchospital.com';
const PASSWORD = 'Demo@123';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    try {
      const res = await fetch(`${WEB_URL}health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`Web server not reachable at ${WEB_URL}`);
}

async function getPageTarget() {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      const targets = await res.json();
      const page = targets.find(
        (t) => t.type === 'page' && t.url.includes('8080'),
      );
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      /* retry */
    }
    await sleep(400);
  }
  throw new Error('Web test target not found');
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

async function waitFor(cdp, expression, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression).catch(() => false)) return;
    await sleep(600);
  }
  const text = await evaluate(cdp, 'document.body.innerText').catch(() => '');
  throw new Error(
    `Timed out waiting for ${label}\n--- page ---\n${String(text).slice(-500)}`,
  );
}

async function screenshot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`/tmp/xeno-web-${name}.png`, Buffer.from(data, 'base64'));
}

let child;
try {
  await waitForServer();

  fs.rmSync(APP_DIR, { recursive: true, force: true });
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(
    `${APP_DIR}/package.json`,
    JSON.stringify({ name: 'xeno-web-test', main: 'main.js' }),
  );
  fs.writeFileSync(
    `${APP_DIR}/main.js`,
    `const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1280, height: 900 });
  win.loadURL(${JSON.stringify(WEB_URL)});
});
app.on('window-all-closed', () => app.quit());
`,
  );

  child = spawn(
    electronPath,
    [`--remote-debugging-port=${DEBUG_PORT}`, APP_DIR],
    { stdio: 'ignore', env: { ...process.env } },
  );

  const page = await getPageTarget();
  const cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.ready;

  await waitFor(
    cdp,
    "document.body.innerText.includes('Welcome back')",
    30000,
    'web login',
  );
  await screenshot(cdp, 'login');

  const hasServerButton = await evaluate(
    cdp,
    "document.body.innerText.includes('Server settings')",
  );
  console.log(
    hasServerButton
      ? 'FAIL  Server settings should be hidden in the browser'
      : 'PASS  Server settings hidden in the browser',
  );

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
      set(document.querySelector('#email'), ${JSON.stringify(EMAIL)});
      set(document.querySelector('#password'), ${JSON.stringify(PASSWORD)});
      document.querySelector('button[type="submit"]').click();
      return true;
    })()`,
  );

  await waitFor(
    cdp,
    "document.body.innerText.toLowerCase().includes('dashboard') && document.body.innerText.includes('Patients')",
    60000,
    'web dashboard',
  );
  await screenshot(cdp, 'dashboard');
  console.log('PASS  Browser login and dashboard');

  cdp.close();
} finally {
  if (child) child.kill('SIGKILL');
  await sleep(1200);
  try {
    fs.rmSync(APP_DIR, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    /* ignore */
  }
}
