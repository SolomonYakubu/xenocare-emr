#!/usr/bin/env node
/**
 * Assemble the Windows server package:
 *   release/server/  (web build, Node, Supabase CLI, provisioning scripts)
 *
 * Run after `npm run build`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'release', 'server');
const WEB_SRC = path.join(ROOT, 'release', 'app', 'dist', 'renderer');
const TMP = '/tmp/xeno-server-build';

const NODE_ZIP =
  'https://nodejs.org/dist/v20.19.5/node-v20.19.5-win-x64.zip';
// Pin the CLI version used by the tested local stack. v3 rejects the
// current [inbucket] config section, so the server ships the matching v2 CLI.
const SUPABASE_TAR =
  'https://github.com/supabase/cli/releases/download/v2.75.0/supabase_windows_amd64.tar.gz';

function sh(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 1_000_000) return;
  console.log(`Downloading ${url}`);
  sh('curl', ['-L', '--fail', '--retry', '3', '-o', file, url]);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

if (!fs.existsSync(path.join(WEB_SRC, 'index.html'))) {
  throw new Error('Web build missing. Run `npm run build` first.');
}

console.log('Copying web build');
copy(WEB_SRC, path.join(OUT, 'web'));

console.log('Copying provisioning and server scripts');
copy(
  path.join(ROOT, 'scripts', 'local-db'),
  path.join(OUT, 'scripts', 'local-db'),
);
copy(
  path.join(ROOT, 'scripts', 'server', 'web-server.mjs'),
  path.join(OUT, 'scripts', 'server', 'web-server.mjs'),
);
copy(
  path.join(ROOT, 'scripts', 'server', 'install-server.ps1'),
  path.join(OUT, 'scripts', 'server', 'install-server.ps1'),
);
copy(
  path.join(ROOT, 'supabase', 'config.toml'),
  path.join(OUT, 'supabase', 'config.toml'),
);

console.log('Fetching Node.js and Supabase CLI (Windows x64)');
const nodeZip = path.join(TMP, 'node.zip');
const supabaseTar = path.join(TMP, 'supabase-2.75.tar.gz');
const supabaseExtract = path.join(TMP, 'supabase-2.75');
download(NODE_ZIP, nodeZip);
download(SUPABASE_TAR, supabaseTar);
fs.rmSync(supabaseExtract, { recursive: true, force: true });
fs.mkdirSync(supabaseExtract, { recursive: true });
sh('tar', ['-xzf', supabaseTar, '-C', supabaseExtract]);

fs.mkdirSync(path.join(OUT, 'node'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'bin'), { recursive: true });
sh('unzip', ['-o', '-j', nodeZip, 'node-v20.19.5-win-x64/node.exe', '-d', path.join(OUT, 'node')]);
const extractedSupabase = path.join(supabaseExtract, 'supabase.exe');
if (!fs.existsSync(extractedSupabase)) {
  throw new Error('supabase.exe was not found in the CLI archive');
}
fs.copyFileSync(extractedSupabase, path.join(OUT, 'bin', 'supabase.exe'));

fs.writeFileSync(
  path.join(OUT, 'start-server.cmd'),
  `@echo off\r
setlocal\r
set "ROOT=%~dp0"\r
set "PATH=%ROOT%node;%ROOT%bin;%PATH%"\r
"%ROOT%node\\node.exe" "%ROOT%scripts\\server\\web-server.mjs" --port 8080 --root "%ROOT%web"\r
`,
);

fs.writeFileSync(
  path.join(OUT, 'README.txt'),
  `XenoCare Server (Windows)

Requirements:
  - Docker Desktop installed and running (WSL 2 backend)
  - Internet access on first start (Docker images are pulled once)

Run:
  1. Run the installer, or copy this folder to the server PC.
  2. Run install-server.ps1 in an elevated PowerShell:
       powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\server\\install-server.ps1
  3. The script starts the database, provisions it if empty, opens the firewall
     and starts the web server.

Clients open:
  http://<server-ip>:8080

The anon key and IPs are printed at the end and saved to
%USERPROFILE%\\XenoCare\\server-info.txt.
`,
);

console.log(`Server package ready: ${OUT}`);
