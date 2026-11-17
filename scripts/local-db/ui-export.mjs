/**
 * Verifies PDF export and print wiring in the real desktop UI.
 *
 * Usage: node scripts/local-db/ui-export.mjs
 * Requires: `npm start` running against the local Supabase stack.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const electronPath = require('electron');
const WebSocket = require('ws');

const DEBUG_PORT = 9226;
const APP_URL = 'http://localhost:1212/index.html';
const EMAIL = 'admin@ndchospital.com';
const PASSWORD = 'Demo@123';
const DOWNLOADS = '/tmp/xeno-export-test';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(APP_URL);
      if (res.ok) return;
    } catch {
      /* retry */
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
      /* retry */
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
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function clickByText(cdp, text) {
  return evaluate(
    cdp,
    `(() => {
      const el = [...document.querySelectorAll('button')].find(
        (b) =>
          b.offsetParent !== null &&
          b.textContent.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}),
      );
      el?.click();
      return !!el;
    })()`,
  );
}

function pdfFiles() {
  if (!fs.existsSync(DOWNLOADS)) return [];
  return fs
    .readdirSync(DOWNLOADS)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .map((name) => ({
      name,
      size: fs.statSync(path.join(DOWNLOADS, name)).size,
    }));
}

async function waitForPdf(previous, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const files = pdfFiles().filter((f) => !previous.includes(f.name));
    if (files.length > 0 && files[0].size > 1000) return files[0];
    await sleep(500);
  }
  throw new Error('No PDF download appeared');
}

const results = [];
function check(label, ok, detail = '') {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

let child;
try {
  await waitForDevServer();
  fs.rmSync(DOWNLOADS, { recursive: true, force: true });
  fs.mkdirSync(DOWNLOADS, { recursive: true });
  fs.rmSync('/tmp/xeno-export-profile', { recursive: true, force: true });

  child = spawn(
    electronPath,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--user-data-dir=/tmp/xeno-export-profile',
      '.',
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, SKIP_DEVTOOLS: 'true' },
      stdio: 'ignore',
    },
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
  await waitFor(cdp, "!!window.__xenoNavigate", 60000, 'dashboard');

  await cdp
    .send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOADS,
    })
    .catch(() =>
      cdp.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: DOWNLOADS,
      }),
    );

  // Billing PDF export
  await evaluate(cdp, "window.__xenoNavigate('/billing')");
  await waitFor(cdp, "document.body.innerText.includes('Billing')", 20000, 'billing');
  await sleep(800);
  await evaluate(cdp, 'window.print = () => { window.__xenoPrinted = true; };');

  const beforeBilling = pdfFiles().map((f) => f.name);
  const opened = await clickByText(cdp, 'Export');
  await waitFor(cdp, "document.body.innerText.includes('PDF')", 15000, 'export preview');
  if (!opened) throw new Error('Export button not found on billing');

  await clickByText(cdp, 'PDF');
  const billingPdf = await waitForPdf(beforeBilling);
  check('Billing PDF export downloads', billingPdf.size > 1000, `${billingPdf.name} (${billingPdf.size} bytes)`);

  // The Print action also produces a PDF (same file name, so clear it first).
  for (const file of pdfFiles()) {
    fs.rmSync(path.join(DOWNLOADS, file.name), { force: true });
  }
  const beforePrint = [];
  await clickByText(cdp, 'Export');
  await waitFor(cdp, "document.body.innerText.includes('Print')", 15000, 'export preview again');
  await clickByText(cdp, 'Print');
  const printPdf = await waitForPdf(beforePrint);
  check('Billing print produces a PDF', printPdf.size > 1000, printPdf.name);

  // Medical records PDF export
  const beforeRecords = pdfFiles().map((f) => f.name);
  await evaluate(cdp, "window.__xenoNavigate('/medical-records')");
  await waitFor(cdp, "document.body.innerText.includes('Medical records')", 20000, 'medical records');
  await sleep(800);
  await evaluate(cdp, 'window.alert = (message) => { window.__lastAlert = message; };');
  await clickByText(cdp, 'Export');
  await waitFor(cdp, "document.body.innerText.includes('Select All')", 15000, 'export dialog');

  await clickByText(cdp, 'Select All');
  await sleep(400);
  const selection = await evaluate(
    cdp,
    `(() => {
      const match = document.body.innerText.match(/(\d+) of (\d+) selected/);
      const pdf = [...document.querySelectorAll('button')].find(
        (b) => b.offsetParent !== null && b.textContent.trim() === 'PDF',
      );
      const submit = [...document.querySelectorAll('button')].find(
        (b) => b.offsetParent !== null && b.textContent.includes('Export PDF'),
      );
      return {
        match: match ? match[0] : null,
        pdfFound: !!pdf,
        submitFound: !!submit,
        submitDisabled: submit?.disabled ?? null,
      };
    })()`,
  );
  console.log('Records selection state:', selection);
  await clickByText(cdp, 'PDF');
  await sleep(400);
  await clickByText(cdp, 'Export PDF');
  await sleep(1500);
  console.log(
    'Records export alert:',
    await evaluate(cdp, 'window.__lastAlert || null'),
  );
  const recordsPdf = await waitForPdf(beforeRecords);
  check(
    'Medical records PDF export downloads',
    recordsPdf.size > 1000,
    `${recordsPdf.name} (${recordsPdf.size} bytes)`,
  );

  cdp.close();
} finally {
  if (child) child.kill('SIGKILL');
  await sleep(1500);
  try {
    fs.rmSync('/tmp/xeno-export-profile', { recursive: true, force: true, maxRetries: 5 });
  } catch {
    /* ignore */
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} export checks passed`);
if (failed.length) process.exit(1);
