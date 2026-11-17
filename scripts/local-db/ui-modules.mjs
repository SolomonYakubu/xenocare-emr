/**
 * Electron module sweep — visits every active route and verifies the
 * simplified radiology and bed-only in-patient surfaces.
 *
 * Usage: node scripts/local-db/ui-modules.mjs
 * Requires: `npm start` running and the local Supabase stack up.
 */
import fs from 'fs';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const electronPath = require('electron');
const WebSocket = require('ws');

const DEBUG_PORT = 9224;
const APP_URL = 'http://localhost:1212/index.html';
const EMAIL = 'admin@ndchospital.com';
const PASSWORD = 'Demo@123';

const env = Object.fromEntries(
  fs
    .readFileSync(process.env.SB_ENV_FILE || '/tmp/xeno-db/sb.env', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);

const svc = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ACTIVE_ROUTES = [
  ['Dashboard', '/'],
  ['Patients', '/registration'],
  ['Medical Records', '/medical-records'],
  ['Encounters', '/encounter'],
  ['OPD Consultation', '/consultation'],
  ['Specialty Clinics', '/specialty-clinic'],
  ['Nursing', '/nursing'],
  ['Pharmacy', '/pharmacy'],
  ['Laboratory', '/lab'],
  ['Radiology', '/radiology'],
  ['In-patients', '/in-patient'],
  ['Surgery', '/surgery'],
  ['Procedures', '/procedures'],
  ['ANC', '/anc'],
  ['Nutrition', '/nutrition'],
  ['Clinical Requests', '/clinical-requests'],
  ['Queue', '/queue'],
  ['Billing', '/billing'],
  ['Customer Service', '/customer-service'],
  ['Medical Reports', '/medical-reports'],
  ['Inventory', '/inventory'],
  ['Configurations', '/configurations'],
  ['Staff', '/staff'],
  ['Messages', '/messaging'],
  ['Records History', '/records-history'],
  ['Analytics', '/analytics'],
  ['Profile', '/profile'],
  ['Sync Center', '/sync-center'],
];

const HIDDEN_LABELS = [
  'NHIS',
  'Dental',
  'Ophthalmology',
  'Physiotherapy',
  'A&E',
  'Hygiene',
  'Military',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
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

async function screenshot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`/tmp/xeno-ui-${name}.png`, Buffer.from(data, 'base64'));
}

async function waitFor(cdp, expression, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression)) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function ensurePendingRadiologyRequest() {
  const { data: pending } = await svc
    .from('radiology_requests')
    .select('request_id,patient_id,status')
    .eq('status', 'Pending')
    .limit(1)
    .maybeSingle();
  if (pending) return pending;

  const { data: visit } = await svc
    .from('visits')
    .select('id,patient_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: imaging } = await svc
    .from('imaging_catalogue')
    .select('id,name,modality')
    .limit(1)
    .maybeSingle();
  if (!visit || !imaging) return null;

  const { data: patient } = await svc
    .from('patients')
    .select('patient_id,id')
    .eq('id', visit.patient_id)
    .maybeSingle();
  const { data: doctor } = await svc
    .from('staff')
    .select('staff_id')
    .eq('role', 'doctor')
    .limit(1)
    .maybeSingle();

  const { data: created } = await svc
    .from('radiology_requests')
    .insert({
      encounter_id: visit.id,
      patient_id: patient?.patient_id,
      imaging_id: imaging.id,
      imaging_type: imaging.modality || 'X-Ray',
      body_part: 'Chest',
      clinical_indication: 'UI module sweep',
      ordered_by: doctor?.staff_id,
      priority: 'Normal',
      status: 'Pending',
    })
    .select('request_id,patient_id,status')
    .single();
  return created;
}

async function patientNameForRequest(request) {
  if (!request?.patient_id) return '';
  const { data } = await svc
    .from('patients')
    .select('first_name,surname')
    .eq('patient_id', request.patient_id)
    .maybeSingle();
  return data ? `${data.first_name} ${data.surname}`.trim() : '';
}

let child;
try {
  await waitForDevServer();
  const pendingRequest = await ensurePendingRadiologyRequest();
  const pendingPatientName = await patientNameForRequest(pendingRequest);

  child = spawn(
    electronPath,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--user-data-dir=/tmp/xeno-ui-modules-profile',
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
  await cdp.send('Page.enable');

  await waitFor(
    cdp,
    "!!document.querySelector('#email')",
    30000,
    'login form',
  );
  await evaluate(
    cdp,
    `(() => {
      const setValue = (selector, value) => {
        const el = document.querySelector(selector);
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setValue('#email', ${JSON.stringify(EMAIL)});
      setValue('#password', ${JSON.stringify(PASSWORD)});
      document.querySelector('button[type="submit"]').click();
      return true;
    })()`,
  );

  await waitFor(
    cdp,
    "document.body.innerText.includes('Dashboard') && !!window.__xenoNavigate",
    60000,
    'dashboard + navigation hook',
  );

  const shellText = await evaluate(cdp, 'document.body.innerText');
  const leaked = HIDDEN_LABELS.filter((label) => shellText.includes(label));
  if (leaked.length) throw new Error(`Hidden modules still visible: ${leaked.join(', ')}`);

  const results = [];
  for (const [label, path] of ACTIVE_ROUTES) {
    await evaluate(cdp, `window.__xenoNavigate(${JSON.stringify(path)})`);
    await sleep(path === '/radiology' || path === '/in-patient' ? 1600 : 900);
    await screenshot(
      cdp,
      `page-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    );
    const text = (await evaluate(cdp, 'document.body.innerText')) || '';
    const failures = [
      'Access Denied',
      "don't have permission",
      'Something went wrong',
      'Failed to load module',
      'is not defined',
    ].filter((needle) => text.includes(needle));
    const visibleText = await evaluate(
      cdp,
      `(() => {
        const vw = window.innerWidth;
        const leaves = [...document.querySelectorAll('body *')].filter(
          (el) => el.children.length === 0,
        );
        return leaves
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              rect.right > 0 &&
              rect.left < vw &&
              style.visibility !== 'hidden' &&
              style.display !== 'none'
            );
          })
          .map((el) => el.textContent || '')
          .join(' ');
      })()`,
    );
    if (/\bNHIS\b|\bNHIA\b/.test(visibleText)) {
      failures.push(`shows NHIS: ${(visibleText.match(/.{0,50}NHIS.{0,50}/i) || [''])[0]}`);
    }
    const overflow = await evaluate(
      cdp,
      '({ doc: document.documentElement.scrollWidth, win: window.innerWidth })',
    );
    if (overflow.doc > overflow.win + 1) {
      failures.push(`overflows horizontally (${overflow.doc}px > ${overflow.win}px)`);
    }
    if (failures.length || text.trim().length < 40) {
      results.push({ label, path, ok: false, reason: failures.join(', ') || 'empty page' });
    } else {
      results.push({ label, path, ok: true });
    }
  }

  // Responsive pass: no page may overflow horizontally at common widths.
  for (const width of [1440, 1024]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const [label, path] of ACTIVE_ROUTES) {
      await evaluate(cdp, `window.__xenoNavigate(${JSON.stringify(path)})`);
      await sleep(700);
      const o = await evaluate(
        cdp,
        '({ doc: document.documentElement.scrollWidth, win: window.innerWidth })',
      );
      if (o.doc > o.win + 1) {
        results.push({
          label: `${label} @${width}px`,
          path,
          ok: false,
          reason: `overflows horizontally (${o.doc}px > ${o.win}px)`,
        });
      }
    }
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  // Pharmacy drug catalogue must not expose NHIS/NHIA when the feature is off.
  await evaluate(cdp, "window.__xenoNavigate('/pharmacy')");
  await sleep(1400);
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Drug Catalogue'); b?.click(); return !!b; })()",
  );
  await waitFor(
    cdp,
    "document.body.innerText.includes('Drug Catalogue')",
    15000,
    'drug catalogue',
  );
  await sleep(600);
  await screenshot(cdp, 'pharmacy-catalogue');
  const catalogueText = await evaluate(cdp, 'document.body.innerText');
  if (/NHIS|NHIA/.test(catalogueText)) {
    throw new Error('NHIS/NHIA is still visible in the drug catalogue');
  }
  results.push({ label: 'Pharmacy catalogue without NHIS', path: '/pharmacy', ok: true });

  // Radiology external result flow
  await evaluate(cdp, "window.__xenoNavigate('/radiology')");
  await sleep(1800);
  await screenshot(cdp, 'radiology');
  const radiologyText = await evaluate(cdp, 'document.body.innerText');
  if (!radiologyText.includes('External Radiology')) {
    throw new Error('External Radiology workspace did not render');
  }
  const opened = await evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Enter result');
      if (!button) return false;
      button.click();
      return true;
    })()`,
  );
  if (opened) {
    await waitFor(
      cdp,
      "document.body.innerText.includes('Save result')",
      10000,
      'external result modal',
    );
    await evaluate(
      cdp,
      `(() => {
        const areas = [...document.querySelectorAll('textarea')];
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        const fill = (el, value) => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };
        fill(areas[0], 'UI sweep findings: no acute abnormality.');
        fill(areas[1], 'Normal external study.');
        const save = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Save result'));
        save.click();
        return true;
      })()`,
    );
    await waitFor(
      cdp,
      "!document.body.innerText.includes('Save result')",
      20000,
      'result save',
    );
  } else {
    results.push({ label: 'Radiology result entry', path: '/radiology', ok: false, reason: 'no pending result button' });
  }

  // In-patient must be bed-only
  await evaluate(cdp, "window.__xenoNavigate('/in-patient')");
  await sleep(1500);
  await screenshot(cdp, 'inpatient-beds');
  const inpatientText = await evaluate(cdp, 'document.body.innerText');
  for (const needle of ['Ward Dashboard', 'Add Ward', 'Select a Ward', '0/130']) {
    if (inpatientText.includes(needle)) {
      results.push({ label: 'In-patient bed-only', path: '/in-patient', ok: false, reason: `still shows ${needle}` });
    }
  }
  if (!inpatientText.includes('Bed 1')) {
    results.push({ label: 'In-patient bed-only', path: '/in-patient', ok: false, reason: '20-bed board not visible' });
  }

  // Bed CRUD: add -> rename -> remove through the Manage beds panel.
  const bedName = `Bed ${Date.now().toString().slice(-4)}`;
  const renamedBed = `${bedName}A`;
  await evaluate(cdp, "window.__xenoNavigate('/in-patient')");
  await sleep(1200);
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Manage beds')); b?.click(); return !!b; })()",
  );
  await waitFor(
    cdp,
    "document.body.innerText.includes('Add a bed')",
    10000,
    'bed manager panel',
  );
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Add a bed')); b?.click(); return !!b; })()",
  );
  await waitFor(
    cdp,
    "!!document.querySelector('input[placeholder=\"e.g. B-101\"]')",
    10000,
    'bed editor',
  );
  await evaluate(
    cdp,
    `(() => {
      const el = document.querySelector('input[placeholder="e.g. B-101"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(bedName)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const save = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Add bed');
      save?.click();
      return true;
    })()`,
  );
  await waitFor(
    cdp,
    `document.body.innerText.includes(${JSON.stringify(bedName)})`,
    15000,
    'new bed in manager',
  );

  await evaluate(
    cdp,
    `(() => {
      const row = [...document.querySelectorAll('button')].find(
        (b) =>
          (b.getAttribute('aria-label') || '').includes(${JSON.stringify(bedName)}),
      );
      row?.click();
      return !!row;
    })()`,
  );
  await waitFor(
    cdp,
    "document.body.innerText.includes('Save changes')",
    10000,
    'edit bed modal',
  );
  await evaluate(
    cdp,
    `(() => {
      const el = document.querySelector('input[placeholder="e.g. B-101"]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(renamedBed)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const save = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save changes');
      save?.click();
      return true;
    })()`,
  );
  await waitFor(
    cdp,
    `document.body.innerText.includes(${JSON.stringify(renamedBed)})`,
    15000,
    'renamed bed in manager',
  );

  await evaluate(
    cdp,
    `(() => {
      const row = [...document.querySelectorAll('button')].find(
        (b) =>
          (b.getAttribute('aria-label') || '').includes(${JSON.stringify(renamedBed)}),
      );
      row?.click();
      return !!row;
    })()`,
  );
  await waitFor(
    cdp,
    "document.body.innerText.includes('Remove bed')",
    10000,
    'remove bed action',
  );
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Remove bed')); b?.click(); return !!b; })()",
  );
  await sleep(300);
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Tap again to remove')); b?.click(); return !!b; })()",
  );
  await waitFor(
    cdp,
    `!document.body.innerText.includes(${JSON.stringify(renamedBed)})`,
    15000,
    'bed removed',
  );
  await evaluate(
    cdp,
    "(() => { const b=document.querySelector('button[aria-label=\"Close bed manager\"]'); b?.click(); return !!b; })()",
  );
  results.push({ label: 'Bed CRUD (add, rename, remove)', path: '/in-patient', ok: true });

  // Removed routes should redirect home
  for (const removed of ['/ae', '/hygiene']) {
    await evaluate(cdp, `window.__xenoNavigate(${JSON.stringify(removed)})`);
    await sleep(800);
    const text = await evaluate(cdp, 'document.body.innerText');
    if (text.includes('Access Denied')) {
      results.push({ label: `Removed ${removed}`, path: removed, ok: false, reason: 'Access Denied' });
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\nModule sweep:');
  for (const row of results) {
    console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.label} (${row.path})${row.reason ? ` — ${row.reason}` : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (pendingPatientName) {
    console.log(`Radiology result target: ${pendingPatientName}`);
  }

  cdp.close();
  if (failed.length) process.exitCode = 1;
} finally {
  if (child) child.kill('SIGTERM');
}
