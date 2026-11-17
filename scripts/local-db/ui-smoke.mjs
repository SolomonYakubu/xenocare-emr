/**
 * Electron UI smoke test for the local Docker backend.
 *
 * Launches a second Electron instance against the already-running webpack dev
 * server (http://localhost:1212), logs in as the demo admin through the real
 * login form, and verifies the dashboard renders.
 *
 * Usage: node scripts/local-db/ui-smoke.mjs
 * Requires: `npm start` running (dev server on port 1212) and local Supabase up.
 */
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');
const electronPath = require('electron');
const WebSocket = require('ws');

const DEBUG_PORT = 9223;
const APP_URL = 'http://localhost:1212/index.html';
const EMAIL = 'admin@ndchospital.com';
const PASSWORD = 'Demo@123';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Click a button by its visible text using trusted CDP input. */
async function clickButtonByText(cdp, text) {
  const point = await evaluate(
    cdp,
    `(() => {
      const el = [...document.querySelectorAll('button')].find((b) =>
        b.textContent.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}),
      );
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        hit: hit ? hit.tagName + ':' + (hit.textContent || '').trim().slice(0, 24) : null,
        inside: Boolean(hit && (el === hit || el.contains(hit))),
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      };
    })()`,
  );
  if (!point) return false;
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  await sleep(400);
  return true;
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

async function screenshot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const path = `/tmp/xeno-ui-${name}.png`;
  fs.writeFileSync(path, Buffer.from(data, 'base64'));
  return path;
}

async function waitFor(cdp, expression, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression)) return true;
    await sleep(750);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

let child;
try {
  await waitForDevServer();
  console.log('Dev server reachable');

  child = spawn(
    electronPath,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--user-data-dir=/tmp/xeno-ui-smoke-profile',
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
    "!!document.querySelector('#email') && !!document.querySelector('#password')",
    30000,
    'login form',
  );

  await screenshot(cdp, 'login');
  // LAN join settings should be reachable before login.
  await evaluate(
    cdp,
    "(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Server settings')); b?.click(); return !!b; })()",
  );
  await waitFor(
    cdp,
    "document.body.innerText.includes('Save & reconnect') && document.body.innerText.toLowerCase().includes('anon key')",
    10000,
    'server settings modal',
  );
  await screenshot(cdp, 'server-settings');
  await evaluate(
    cdp,
    "(() => { const b=document.querySelector('button[aria-label=\"Close server settings\"]'); b?.click(); return !!b; })()",
  );

  const title = await evaluate(cdp, 'document.title');
  console.log('Window title:', title);

  await evaluate(
    cdp,
    `(() => {
      const setValue = (selector, value) => {
        const el = document.querySelector(selector);
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        ).set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setValue('#email', ${JSON.stringify(EMAIL)});
      setValue('#password', ${JSON.stringify(PASSWORD)});
      document.querySelector('button[type="submit"]').click();
      return true;
    })()`,
  );

  const outcome = await (async () => {
    const start = Date.now();
    while (Date.now() - start < 60000) {
      const text = await evaluate(cdp, 'document.body.innerText');
      const lower = (text || '').toLowerCase();
      if (lower.includes('dashboard') && lower.includes('patients')) {
        return { ok: true, text };
      }
      if (
        lower.includes('invalid email or password') ||
        lower.includes('database error') ||
        lower.includes('failed to fetch')
      ) {
        return { ok: false, text };
      }
      await sleep(1000);
    }
    return { ok: false, text: await evaluate(cdp, 'document.body.innerText') };
  })();

  if (!outcome.ok) {
    console.error('UI login failed. Visible text:');
    console.error((outcome.text || '').slice(0, 1200));
    process.exitCode = 1;
  } else {
    console.log('UI login succeeded');
    console.log('Dashboard rendered for', EMAIL);
    await screenshot(cdp, 'dashboard');
    await evaluate(
      cdp,
      "document.querySelector('main')?.scrollTo(0, document.querySelector('main').scrollHeight)",
    );
    await sleep(600);
    await screenshot(cdp, 'dashboard-bottom');
    await evaluate(cdp, "document.querySelector('main')?.scrollTo(0, 0)");
    const metrics = await evaluate(
      cdp,
      '({ innerWidth, innerHeight, docWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth })',
    );
    console.log('Viewport metrics:', metrics);

    const shellText = await evaluate(cdp, 'document.body.innerText');
    const hidden = [
      'NHIS',
      'Dental',
      'Ophthalmology',
      'Physiotherapy',
      'Military',
    ];
    const leaked = hidden.filter((label) => shellText.includes(label));
    if (leaked.length) {
      console.error('Hidden areas still visible:', leaked);
      process.exitCode = 1;
    } else {
      console.log('Hidden areas absent from navigation:', hidden.join(', '));
    }

    // Appearance: text size, compact tables, reset.
    const avatarPoint = await evaluate(
      cdp,
      `(() => {
        const b = document.querySelector('button[aria-label="Open user menu"]');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`,
    );
    if (avatarPoint) {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: avatarPoint.x,
        y: avatarPoint.y,
        button: 'left',
        clickCount: 1,
      });
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: avatarPoint.x,
        y: avatarPoint.y,
        button: 'left',
        clickCount: 1,
      });
    }
    await waitFor(
      cdp,
      "document.body.innerText.toLowerCase().includes('text size')",
      10000,
      'user menu appearance controls',
    );
    await sleep(900);
    await screenshot(cdp, 'appearance');


    await evaluate(
      cdp,
      `(() => {
        const slider = document.querySelector('input[aria-label="Text size"]');
        if (!slider) return false;
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        ).set;
        setter.call(slider, '20');
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`,
    );
    await sleep(400);
    const textState = await evaluate(
      cdp,
      `(() => ({
        size: getComputedStyle(document.documentElement).fontSize,
        stored: JSON.parse(localStorage.getItem('xenocare.appearance.v1') || '{}'),
      }))()`,
    );
    if (textState.size === '20px' && textState.stored.textSize === 20) {
      console.log('Text size applied and persisted:', textState.size);
    } else {
      console.error('Text size preference failed:', textState);
      process.exitCode = 1;
    }

    const compactClicked = await clickButtonByText(cdp, 'Compact tables');
    const compactOn = await evaluate(
      cdp,
      "document.documentElement.classList.contains('ui-compact')",
    );
    if (compactClicked && compactOn) {
      console.log('Compact tables preference applied');
    } else {
      console.error('Compact tables preference failed');
      process.exitCode = 1;
    }

    await clickButtonByText(cdp, 'Reset appearance');
    const resetState = await evaluate(
      cdp,
      `({
        size: getComputedStyle(document.documentElement).fontSize,
        compact: document.documentElement.classList.contains('ui-compact'),
      })`,
    );
    if (resetState.size === '16px' && !resetState.compact) {
      console.log('Appearance reset to defaults');
    } else {
      console.error('Appearance reset failed:', resetState);
      process.exitCode = 1;
    }

    if (avatarPoint) {
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: avatarPoint.x,
        y: avatarPoint.y,
        button: 'left',
        clickCount: 1,
      });
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: avatarPoint.x,
        y: avatarPoint.y,
        button: 'left',
        clickCount: 1,
      });
      await sleep(300);
    }

    // Open the patient list and registration form to verify field hiding.
    await evaluate(
      cdp,
      "(() => { const link = [...document.querySelectorAll('a')].find((a) => a.textContent.trim().startsWith('Patients')); link?.click(); return Boolean(link); })()",
    );
    await waitFor(
      cdp,
      "document.body.innerText.includes('Register new patient')",
      20000,
      'patients page',
    );
    await sleep(700);
    await screenshot(cdp, 'patients');

    await evaluate(
      cdp,
      "(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Register new patient')); btn?.click(); return Boolean(btn); })()",
    );
    await waitFor(
      cdp,
      "document.body.innerText.includes('First Name') && document.body.innerText.includes('Surname')",
      20000,
      'patient form',
    );
    await sleep(900);
    await screenshot(cdp, 'patient-form');

    const formText = await evaluate(cdp, 'document.body.innerText');
    const hiddenFields = [
      'Military',
      'NHIS',
      'Service Number',
      'Service number',
      'Paramilitary',
      'DHML',
    ];
    const leakedFields = hiddenFields.filter((label) =>
      formText.includes(label),
    );
    if (leakedFields.length) {
      console.error('Hidden fields still visible in patient form:', leakedFields);
      process.exitCode = 1;
    } else {
      console.log('Hidden patient fields absent:', hiddenFields.join(', '));
    }
  }

  cdp.close();
} finally {
  if (child) child.kill('SIGTERM');
}
