/**
 * Role sweep — signs in as every demo role, checks its sidebar surface and
 * walks every module that role can see.
 *
 * Usage: node scripts/local-db/ui-roles.mjs
 * Requires: `npm start` running and the local Supabase stack up.
 */
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const electronPath = require('electron');
const WebSocket = require('ws');

const DEBUG_PORT = 9225;
const APP_URL = 'http://localhost:1212/index.html';
const PASSWORD = 'Demo@123';

const ROLES = [
  {
    email: 'superadmin@ndchospital.com',
    name: 'super_admin',
    must: ['Patients', 'Billing & Payments', 'Staff', 'Configurations', 'Analytics'],
    mustNot: [],
  },
  {
    email: 'admin@ndchospital.com',
    name: 'admin',
    must: ['Patients', 'Billing & Payments', 'Staff', 'Configurations', 'Analytics'],
    mustNot: [],
  },
  {
    email: 'director@ndchospital.com',
    name: 'medical_director',
    must: ['Consultation', 'Analytics', 'Staff', 'Medical Records'],
    mustNot: ['Billing & Payments', 'Configurations', 'Inventory'],
  },
  {
    email: 'doctor@ndchospital.com',
    name: 'doctor',
    must: ['Consultation', 'Visits', 'Medical Records'],
    mustNot: ['Billing & Payments', 'Pharmacy', 'Laboratory', 'Configurations'],
  },
  {
    email: 'nurse@ndchospital.com',
    name: 'nurse',
    must: ['Nursing Care', 'In-patients', 'Medical Records'],
    mustNot: ['Billing & Payments', 'Consultation', 'Pharmacy', 'Laboratory'],
  },
  {
    email: 'lab@ndchospital.com',
    name: 'lab_technician',
    must: ['Laboratory', 'Medical Records'],
    mustNot: ['Billing & Payments', 'Pharmacy', 'Consultation'],
  },
  {
    email: 'radiology@ndchospital.com',
    name: 'radiologist',
    must: ['Radiology', 'Medical Records'],
    mustNot: ['Billing & Payments', 'Laboratory', 'Consultation'],
  },
  {
    email: 'pharmacy@ndchospital.com',
    name: 'pharmacist',
    must: ['Pharmacy', 'Medical Records'],
    mustNot: ['Billing & Payments', 'Laboratory', 'Consultation'],
  },
  {
    email: 'billing@ndchospital.com',
    name: 'billing_clerk',
    must: ['Billing & Payments', 'Medical Records'],
    mustNot: ['Consultation', 'Laboratory', 'Pharmacy'],
  },
  {
    email: 'reception@ndchospital.com',
    name: 'receptionist',
    must: ['Patients', 'Visits', 'Customer Service'],
    mustNot: ['Billing & Payments', 'Consultation', 'Pharmacy'],
  },
];

const HIDDEN = [
  'NHIS',
  'Dental',
  'Ophthalmology',
  'Physiotherapy',
  'A&E',
  'Hygiene',
  'Military',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevServer() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(APP_URL);
      if (res.ok) return;
    } catch {
      /* wait */
    }
    await sleep(1000);
  }
  throw new Error('Dev server not reachable');
}

async function getPageTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      const targets = await res.json();
      const page = targets.find(
        (t) => t.type === 'page' && t.url.includes('localhost:1212'),
      );
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      /* wait */
    }
    await sleep(500);
  }
  throw new Error('Electron debugging target not found');
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
        'evaluate failed',
    );
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression)) return;
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function login(cdp, email) {
  await waitFor(cdp, "!!document.querySelector('#email')", 30000, 'login form');
  await evaluate(
    cdp,
    `(() => {
      const setValue = (selector, value) => {
        const el = document.querySelector(selector);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setValue('#email', ${JSON.stringify(email)});
      setValue('#password', ${JSON.stringify(PASSWORD)});
      document.querySelector('button[type="submit"]').click();
      return true;
    })()`,
  );
  await waitFor(
    cdp,
    "document.body.innerText.includes('Dashboard') && !!window.__xenoNavigate",
    60000,
    `dashboard for ${email}`,
  );
}

async function resetSession(cdp) {
  await evaluate(
    cdp,
    "try { sessionStorage.clear(); localStorage.clear(); } catch (e) {} window.location.reload();",
  );
  await waitFor(cdp, "!!document.querySelector('#email')", 30000, 'login after reset');
  await sleep(1200);
}

let child;
try {
  await waitForDevServer();
  child = spawn(
    electronPath,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--user-data-dir=/tmp/xeno-ui-roles-profile',
      '.',
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        SKIP_DEVTOOLS: 'true',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
      stdio: 'ignore',
    },
  );

  const target = await getPageTarget();
  const cdp = createCdp(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Runtime.enable');

  const report = [];

  for (const role of ROLES) {
    const errors = [];
    try {
      await login(cdp, role.email);

      const links = await evaluate(
        cdp,
        "Array.from(document.querySelectorAll('aside a')).map((a) => ({ label: (a.textContent || '').trim(), href: a.getAttribute('href') })).filter((a) => a.href)",
      );
      const labels = links.map((l) => l.label);

      for (const expected of role.must) {
        if (!labels.includes(expected)) errors.push(`missing "${expected}"`);
      }
      for (const forbidden of role.mustNot) {
        if (labels.includes(forbidden)) errors.push(`unexpected "${forbidden}"`);
      }
      for (const hidden of HIDDEN) {
        if (labels.includes(hidden)) errors.push(`hidden "${hidden}" visible`);
      }

      for (const link of links) {
        await evaluate(cdp, `window.__xenoNavigate(${JSON.stringify(link.href)})`);
        await sleep(700);
        const text = (await evaluate(cdp, 'document.body.innerText')) || '';
        if (
          text.includes('Access Denied') ||
          text.includes("don't have permission") ||
          text.includes('Failed to load module')
        ) {
          errors.push(`route ${link.href} blocked`);
        }
      }

      // Sign out resets the session so the next role starts clean.
      await resetSession(cdp);
    } catch (error) {
      errors.push(error.message);
      // Best effort reset for the next role.
      try {
        await evaluate(
          cdp,
          "try { sessionStorage.clear(); localStorage.clear(); } catch (e) {} window.location.reload();",
        );
        await sleep(2500);
      } catch {
        /* ignore */
      }
    }

    report.push({ role: role.name, email: role.email, errors });
    console.log(
      `${errors.length === 0 ? 'PASS' : 'FAIL'}  ${role.name} (${role.email})${
        errors.length ? ` — ${errors.join('; ')}` : ''
      }`,
    );
  }

  const failed = report.filter((row) => row.errors.length);
  console.log(`\n${report.length - failed.length}/${report.length} roles passed`);
  if (failed.length) process.exitCode = 1;
  cdp.close();
} finally {
  if (child) child.kill('SIGTERM');
}
