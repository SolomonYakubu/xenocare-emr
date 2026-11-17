#!/usr/bin/env node
/**
 * Run this computer as the XenoCare server (macOS, Linux or Windows).
 *
 *   node scripts/local-db/host-server.mjs [--wait] [--no-provision] [--no-env]
 *
 * What it does:
 *   1. Waits for Docker Desktop (with --wait).
 *   2. Starts the local Supabase stack (`supabase start`).
 *   3. Provisions the database once if it is empty (--no-provision to skip).
 *   4. Writes this host's API URL/keys into `.env` for local development.
 *   5. Prints the LAN API URL + anon key other devices should use.
 *
 * The Supabase containers use `restart: unless-stopped`, so once this has run
 * they come back automatically when Docker Desktop starts. The app itself
 * stays a client.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEMO_LOGINS,
  ROOT,
  dockerReady,
  findDbContainer,
  isProvisioned,
  log,
  provisionDatabase,
  resolveDocker,
  resolveSupabase,
  run,
  startStack,
} from './provision.mjs';

const IS_WINDOWS = process.platform === 'win32';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const options = {
    waitSeconds: 0,
    provision: true,
    writeEnv: true,
    start: true,
    envOnly: false,
  };
  for (const arg of argv) {
    if (arg === '--wait') options.waitSeconds = 600;
    else if (arg.startsWith('--wait=')) {
      options.waitSeconds = Number(arg.split('=')[1]) || 600;
    } else if (arg === '--no-provision') options.provision = false;
    else if (arg === '--no-env') options.writeEnv = false;
    else if (arg === '--no-start') options.start = false;
    else if (arg === '--env-only') {
      options.envOnly = true;
      options.start = false;
      options.provision = false;
    } else if (arg === '--help' || arg === '-h') options.help = true;
  }
  return options;
}

async function waitForDocker(seconds) {
  if (seconds <= 0) return;
  const docker = resolveDocker();
  const started = new Date();
  while (true) {
    if (dockerReady(docker)) {
      log('==> Docker is ready');
      return;
    }
    if (Date.now() - started.getTime() > seconds * 1000) {
      throw new Error(
        `Docker did not start within ${seconds}s. Is Docker Desktop installed and set to start at sign-in?`,
      );
    }
    log('==> Waiting for Docker Desktop…');
    await sleep(10000);
  }
}

function statusEnv() {
  const supabase = resolveSupabase();
  const output = run(
    supabase.command,
    [...supabase.args, 'status', '-o', 'env'],
    { capture: true, shell: supabase.shell },
  );
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function friendlyHost() {
  const raw = os.hostname().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return raw.replace(/^-+|-+$/g, '') || 'xenocare-server';
}

function lanAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return [...new Set(addresses)];
}

function updateEnv(values) {
  const envPath = path.join(ROOT, '.env');
  let text = '';
  try {
    text = fs.readFileSync(envPath, 'utf8');
  } catch {
    text = '';
  }

  const set = (key, value) => {
    if (!value) return;
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    if (pattern.test(text)) {
      text = text.replace(pattern, () => line);
    } else {
      text = `${text.replace(/\s*$/, '')}\n${line}\n`;
    }
  };

  set('SUPABASE_URL', values.API_URL);
  set('SUPABASE_ANON_KEY', values.ANON_KEY);
  set('SUPABASE_SERVICE_ROLE_KEY', values.SERVICE_ROLE_KEY);

  fs.writeFileSync(envPath, text);
  log(`==> Updated ${envPath}`);
}

function writeServerInfo({ apiUrls, studioUrls, anonKey, apiUrl, friendlyNameUrl }) {
  const dir = path.join(os.homedir(), 'XenoCare');
  const file = path.join(dir, 'server-info.txt');
  const lines = [
    'XenoCare server',
    `Updated: ${new Date().toISOString()}`,
    '',
    `API (this computer): ${apiUrl}`,
    ...apiUrls.map((url) => `API (LAN):          ${url}`),
    `API (name):         ${friendlyNameUrl}`,
    ...studioUrls.map((url) => `Studio (LAN):       ${url}`),
    '',
    'On each client device:',
    '  1. Open XenoCare and choose "Server settings" on the login screen.',
    `  2. Server URL: ${apiUrls[0] || apiUrl}`,
    '  3. Anon key:  (see below)',
    '',
    'Anon key:',
    anonKey,
    '',
  ];
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  return file;
}

function printSummary({
  apiUrls,
  studioUrls,
  anonKey,
  apiUrl,
  dbContainer,
  friendlyNameUrl,
}) {
  const lanApi = apiUrls[0];
  const lanStudio = studioUrls[0];
  const line = '='.repeat(64);

  log('');
  log(line);
  log(' XenoCare server is running');
  log(line);
  log(` API (this PC) : ${apiUrl}`);
  if (lanApi) log(` API (LAN)     : ${lanApi}`);
  log(` API (name, if supported): ${friendlyNameUrl}`);
  if (lanStudio) log(` Studio (LAN)  : ${lanStudio}`);
  log(` Database      : ${dbContainer}`);
  log('');
  log(' On each client device:');
  log('   1. Open XenoCare and choose "Server settings" on the login screen.');
  log(`   2. Server URL: ${lanApi || 'http://<this-pc-ip>:54321'}`);
  log(`      optional name: ${friendlyNameUrl}`);
  log('   3. Anon key  : (below)');
  log('');
  log(' Anon key:');
  log(`   ${anonKey}`);
  log('');
  log(' Keep this computer awake while clients are connected.');

  if (IS_WINDOWS) {
    log('');
    log(' Windows firewall: allow inbound TCP 54321 and 54323 on the');
    log(' private network. Run once in an elevated PowerShell:');
    log(
      '   New-NetFirewallRule -DisplayName "XenoCare Server" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 54321,54323 -Profile Private',
    );
  }

  log(line);
  log('');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    log('Usage: node scripts/local-db/host-server.mjs [--wait[=seconds]]');
    log('         [--no-provision] [--no-env] [--env-only] [--no-start]');
    log('');
    log('  --wait        wait up to 10 minutes for Docker Desktop');
    log('  --no-provision  never create/seed the database automatically');
    log('  --no-env      leave .env untouched');
    log('  --env-only    only refresh .env from the running stack');
    return;
  }

  await waitForDocker(options.waitSeconds);

  if (options.envOnly) {
    const values = statusEnv();
    if (!values.API_URL || !values.ANON_KEY) {
      throw new Error('Supabase is not running. Start it first.');
    }
    updateEnv(values);
    return;
  }

  if (options.start) startStack();

  const docker = resolveDocker();
  if (!dockerReady(docker)) {
    throw new Error('Docker is not running. Start Docker Desktop and try again.');
  }

  let dbContainer = findDbContainer(docker);
  if (options.provision && !isProvisioned(docker, dbContainer)) {
    log('==> Database is empty, provisioning it now');
    const result = provisionDatabase({ start: false });
    dbContainer = result.container;
    log('');
    log(' Demo logins (password: Demo@123):');
    for (const [email, role] of DEMO_LOGINS) log(`   ${email} (${role})`);
  }

  const values = statusEnv();
  if (!values.API_URL || !values.ANON_KEY) {
    throw new Error('Could not read the local Supabase URL/keys.');
  }

  if (options.writeEnv) updateEnv(values);

  const lan = lanAddresses();
  const apiUrls = lan.map((ip) => `${values.API_URL.replace('127.0.0.1', ip)}`);
  const studioUrls = lan.map(
    (ip) => `${(values.STUDIO_URL || 'http://127.0.0.1:54323').replace('127.0.0.1', ip)}`,
  );

  const friendlyNameUrl = `http://${friendlyHost()}.local:${new URL(
    values.API_URL,
  ).port || '54321'}`;

  const infoFile = writeServerInfo({
    apiUrls,
    studioUrls,
    anonKey: values.ANON_KEY,
    apiUrl: values.API_URL,
    friendlyNameUrl,
  });

  printSummary({
    apiUrls,
    studioUrls,
    anonKey: values.ANON_KEY,
    apiUrl: values.API_URL,
    dbContainer,
    friendlyNameUrl,
  });
  log(`Saved join details to: ${infoFile}`);
}

main().catch((error) => {
  console.error(`\nXenoCare server failed to start: ${error.message}`);
  process.exit(1);
});
