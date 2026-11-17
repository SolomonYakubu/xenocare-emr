/**
 * UX audit for the patient-facing forms.
 *
 * Opens registration and admission, measures overflow, field counts, visible
 * steps and the Tab order, and saves screenshots for review.
 *
 * Usage: node scripts/local-db/ui-form-audit.mjs
 * Requires: `npm start` running.
 */
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const electronPath = require('electron');
const WebSocket = require('ws');

const DEBUG_PORT = 9225;
const APP_URL = 'http://localhost:1212/index.html';
const EMAIL = 'admin@ndchospital.com';
const PASSWORD = 'Demo@123';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(APP_URL, { method: 'GET' });
      if (res.ok) return;
    } catch {
      /* keep waiting */
    }
    await sleep(1000);
  }
  throw new Error('Dev server not reachable');
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

async function waitFor(cdp, expression, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression).catch(() => false)) return;
    await sleep(400);
  }
  const text = await evaluate(cdp, 'document.body.innerText').catch(() => '');
  throw new Error(
    `Timed out waiting for ${label}\n--- page text ---\n${String(text).slice(-600)}`,
  );
}

async function screenshot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`/tmp/xeno-audit-${name}.png`, Buffer.from(data, 'base64'));
}

async function pressTab(cdp) {
  const base = {
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
  };
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(120);
}

async function measure(cdp, label) {
  const data = await evaluate(
    cdp,
    `(() => {
      const root = document.documentElement;
      const fields = [...document.querySelectorAll('input, select, textarea')]
        .filter((el) => el.offsetParent !== null);
      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        document: { w: root.scrollWidth, h: root.scrollHeight },
        fields: fields.length,
        buttons: [...document.querySelectorAll('button')]
          .filter((b) => b.offsetParent !== null).length,
        pageText: document.body.innerText.length,
      };
    })()`,
  );
  console.log(label, data);
  return data;
}

let child;
try {
  await waitForDevServer();
  fs.rmSync('/tmp/xeno-form-audit-profile', { recursive: true, force: true });
  child = spawn(
    electronPath,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--user-data-dir=/tmp/xeno-form-audit-profile',
      '.',
    ],
    { cwd: process.cwd(), env: { ...process.env, SKIP_DEVTOOLS: 'true' }, stdio: 'ignore' },
  );

  const page = await getPageTarget();
  const cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.ready;
  await waitFor(cdp, "document.body.innerText.includes('Welcome back')", 30000, 'login');

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
  await waitFor(cdp, "document.body.innerText.includes('Dashboard')", 60000, 'dashboard');

  // Registration form
  await evaluate(cdp, "window.__xenoNavigate('/registration')");
  await waitFor(cdp, "document.body.innerText.toLowerCase().includes('register new patient')", 20000, 'registration page');
  await screenshot(cdp, 'registration-page');
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Register new patient')); b?.click(); return !!b; })()",
  );
  await waitFor(cdp, "document.body.innerText.toLowerCase().includes('personal information')", 15000, 'registration form');
  await sleep(600);
  await measure(cdp, 'Registration:');
  await screenshot(cdp, 'registration');

  const regSteps = await evaluate(cdp, 'document.body.innerText.includes("Next Step")');
  console.log('Registration uses a Next Step wizard:', regSteps);

  // Tab order through the first fields
  const tabOrder = await evaluate(
    cdp,
    `(() => {
      const first = document.querySelector('input[name="surname"]');
      first?.focus();
      return {
        start: document.activeElement?.name || document.activeElement?.id || null,
      };
    })()`,
  );
  const sequence = [tabOrder.start];
  for (let i = 0; i < 8; i += 1) {
    await pressTab(cdp);
    sequence.push(
      await evaluate(
        cdp,
        'document.activeElement?.name || document.activeElement?.id || document.activeElement?.tagName',
      ),
    );
  }
  console.log('Tab order from surname:', sequence.join(' -> '));

  await evaluate(
    cdp,
    "(() => { const b=document.querySelector('button[aria-label=\"Close\"]') || [...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Cancel'); b?.click(); return true; })()",
  );
  await sleep(500);

  // Admission form
  await evaluate(cdp, "window.__xenoNavigate('/in-patient')");
  await waitFor(cdp, "document.body.innerText.toLowerCase().includes('in-patients')", 20000, 'in-patient');
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('New Admission')); b?.click(); return !!b; })()",
  );
  await waitFor(cdp, "document.body.innerText.toLowerCase().includes('clinical details')", 15000, 'admission form');
  await sleep(500);
  await measure(cdp, 'Admission:');
  await screenshot(cdp, 'admission');

  await evaluate(
    cdp,
    `(() => {
      const input = document.querySelector('input[placeholder*="EMR"]');
      input?.focus();
      return document.activeElement?.placeholder || null;
    })()`,
  );
  const admSeq = [];
  for (let i = 0; i < 8; i += 1) {
    await pressTab(cdp);
    admSeq.push(
      await evaluate(
        cdp,
        'document.activeElement?.getAttribute("placeholder") || document.activeElement?.name || document.activeElement?.textContent?.trim().slice(0,20) || document.activeElement?.tagName',
      ),
    );
  }
  console.log('Tab order from admission search:', admSeq.join(' -> '));

  cdp.close();
} finally {
  if (child) child.kill('SIGKILL');
  await sleep(1500);
  try {
    fs.rmSync('/tmp/xeno-form-audit-profile', { recursive: true, force: true, maxRetries: 5 });
  } catch {
    /* ignore */
  }
}
