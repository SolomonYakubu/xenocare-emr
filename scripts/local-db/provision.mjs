#!/usr/bin/env node
/**
 * Cross-platform database provisioner for XenoCare (macOS, Linux, Windows).
 *
 *   node scripts/local-db/provision.mjs
 *
 * Requirements:
 *   - Docker Desktop running
 *   - Supabase CLI (or npx): https://supabase.com/docs/guides/cli
 *
 * All SQL is executed with `psql` inside the Supabase database container, so
 * no local PostgreSQL client is needed. Destructive to the LOCAL database
 * only.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
const IS_WINDOWS = process.platform === 'win32';
const CONFIG_TOML = path.join(ROOT, 'supabase', 'config.toml');

export const SQL_STEPS = [
  { label: 'Resetting public schema', file: '00-reset.sql' },
  { label: 'Applying schema', file: 'schema.sql' },
  { label: 'Granting API roles', file: '02-grants.sql' },
  { label: 'Loading reference/seed data', file: 'seed-data.sql' },
  { label: 'Seeding the 20-bed board', file: '04-beds.sql' },
  { label: 'Creating demo users and staff', file: 'seed-admin.sql' },
  { label: 'Ensuring the radiology image bucket', file: '06-storage.sql' },
];

export const DEMO_LOGINS = [
  ['superadmin@ndchospital.com', 'super_admin'],
  ['admin@ndchospital.com', 'admin'],
  ['director@ndchospital.com', 'medical_director'],
  ['doctor@ndchospital.com', 'doctor / GOPD'],
  ['nurse@ndchospital.com', 'nurse'],
  ['lab@ndchospital.com', 'lab technician'],
  ['radiology@ndchospital.com', 'radiologist'],
  ['pharmacy@ndchospital.com', 'pharmacist'],
  ['billing@ndchospital.com', 'billing clerk'],
  ['reception@ndchospital.com', 'receptionist'],
];

function exists(candidate) {
  return candidate && fs.existsSync(candidate);
}

function canRun(command, args = ['--version'], shell = false) {
  const result = spawnSync(command, args, { stdio: 'ignore', shell });
  return !result.error;
}

export function log(message) {
  console.log(message);
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    ...options,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || `exit code ${result.status}`;
    throw new Error(
      `Command failed: ${command} ${args.join(' ')} (${detail})\n${result.stderr || ''}`,
    );
  }
  return (result.stdout || '').trim();
}

/**
 * Find the Supabase CLI. Falls back to `npx supabase` when it is not on PATH,
 * so a Windows host only needs Node + Docker Desktop.
 */
export function resolveSupabase() {
  if (exists(process.env.SUPABASE_BIN)) {
    return { command: process.env.SUPABASE_BIN, args: [] };
  }

  const candidates = ['supabase', 'supabase.exe', 'supabase.cmd'];
  if (IS_WINDOWS) {
    const home = os.homedir();
    candidates.push(
      path.join(home, 'scoop', 'shims', 'supabase.exe'),
      'C:\\ProgramData\\chocolatey\\bin\\supabase.exe',
      path.join(home, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Links', 'supabase.exe'),
    );
  } else {
    candidates.push(
      '/opt/homebrew/bin/supabase',
      '/opt/homebrew/opt/supabase/bin/supabase',
      '/usr/local/bin/supabase',
      '/usr/bin/supabase',
    );
  }

  for (const candidate of candidates) {
    const isPath = candidate.includes(path.sep) || candidate.includes('/');
    if (isPath && !exists(candidate)) continue;
    const shell = IS_WINDOWS && candidate.toLowerCase().endsWith('.cmd');
    if (canRun(candidate, ['--version'], shell)) {
      return { command: candidate, args: [], shell };
    }
  }

  const npx = IS_WINDOWS ? 'npx.cmd' : 'npx';
  if (canRun(npx, ['--version'], IS_WINDOWS)) {
    return { command: npx, args: ['--yes', 'supabase'], shell: IS_WINDOWS };
  }

  throw new Error(
    'Supabase CLI not found. Install it (scoop install supabase) or keep Node available for `npx supabase`.',
  );
}

export function resolveDocker() {
  if (exists(process.env.DOCKER_BIN)) return process.env.DOCKER_BIN;

  const candidates = ['docker', 'docker.exe'];
  if (IS_WINDOWS) {
    candidates.push(
      'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Docker', 'docker.exe'),
    );
  } else {
    candidates.push(
      '/usr/local/bin/docker',
      '/opt/homebrew/bin/docker',
      '/Applications/Docker.app/Contents/Resources/bin/docker',
    );
  }

  for (const candidate of candidates) {
    if (candidate.includes(path.sep) && !exists(candidate)) continue;
    if (canRun(candidate, ['--version'])) return candidate;
  }

  throw new Error(
    'Docker CLI not found. Install/start Docker Desktop and make sure `docker` is on PATH.',
  );
}

export function dockerReady(docker) {
  const result = spawnSync(docker, ['info'], { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function projectId() {
  try {
    const toml = fs.readFileSync(CONFIG_TOML, 'utf8');
    return /^project_id\s*=\s*"([^"]+)"/m.exec(toml)?.[1] || 'xenocare-emr';
  } catch {
    return 'xenocare-emr';
  }
}

/**
 * Locate the Postgres container created by `supabase start`.
 */
export function findDbContainer(docker) {
  if (process.env.DB_CONTAINER) return process.env.DB_CONTAINER;

  const names = run(docker, [
    'ps',
    '--filter',
    'name=supabase_db_',
    '--format',
    '{{.Names}}',
  ], { capture: true })
    .split(/\r?\n/)
    .filter(Boolean);

  if (names.length === 0) {
    throw new Error(
      'The Supabase database container is not running. Run `supabase start` first.',
    );
  }

  const preferred = `supabase_db_${projectId()}`;
  return names.includes(preferred) ? preferred : names[0];
}

export function isProvisioned(docker, container) {
  try {
    const result = run(
      docker,
      [
        'exec',
        container,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-tAc',
        "select to_regclass('public.patients') is not null;",
      ],
      { capture: true },
    );
    return result.toLowerCase().includes('t');
  } catch {
    return false;
  }
}

function runSqlFile(docker, container, file) {
  const local = path.join(HERE, file);
  if (!fs.existsSync(local)) throw new Error(`SQL file not found: ${local}`);

  const remote = `/tmp/xeno-${path.basename(file)}`;
  run(docker, ['cp', local, `${container}:${remote}`]);
  run(docker, [
    'exec',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    remote,
  ]);
}

export function startStack() {
  const supabase = resolveSupabase();
  const args = [...supabase.args, 'start'];
  log('==> Starting Supabase (Docker)');
  run(supabase.command, args, { shell: supabase.shell });
}

/**
 * Reset and seed the local database. Assumes the stack is already running
 * unless `start` is true.
 */
export function provisionDatabase({ start = true, ifEmpty = false } = {}) {
  if (start) startStack();

  const docker = resolveDocker();
  if (!dockerReady(docker)) {
    throw new Error('Docker is not running. Start Docker Desktop and try again.');
  }

  const container = findDbContainer(docker);
  if (ifEmpty && isProvisioned(docker, container)) {
    log('==> Database already provisioned, nothing to do');
    return { provisioned: false, container };
  }

  for (const step of SQL_STEPS) {
    log(`==> ${step.label}`);
    runSqlFile(docker, container, step.file);
  }

  log('==> Refreshing PostgREST schema cache');
  run(docker, [
    'exec',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-c',
    "NOTIFY pgrst, 'reload schema';",
  ]);

  log('');
  log('Done. Demo logins (password: Demo@123):');
  for (const [email, role] of DEMO_LOGINS) {
    log(`  ${email.padEnd(28)} (${role})`);
  }
  log('');
  log('Verify with:  npm run db:test');
  return { provisioned: true, container };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    log('Usage: node scripts/local-db/provision.mjs [--skip-start] [--if-empty]');
    return;
  }
  provisionDatabase({
    start: !args.includes('--skip-start'),
    ifEmpty: args.includes('--if-empty'),
  });
}

const invokedDirectly =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(`\nProvisioning failed: ${error.message}`);
    process.exit(1);
  }
}
