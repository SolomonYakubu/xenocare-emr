#!/usr/bin/env node
/**
 * Serve the XenoCare web build to browsers on the LAN.
 *
 *   node scripts/server/web-server.mjs [--port 8080]
 *
 * The Supabase URL and anon key are injected into the page at runtime, so the
 * same build works on any server. Defaults come from .env; when the URL points
 * at localhost it is rewritten to this machine's LAN address so browsers on
 * other devices can reach the API.
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);

function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

function readEnv() {
  const values = {};
  try {
    const text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) values[match[1]] = match[2].replace(/^"|"$/g, '');
    }
  } catch {
    /* no .env */
  }
  return values;
}

function lanAddresses() {
  const result = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) result.push(entry.address);
    }
  }
  return [...new Set(result)];
}

const env = readEnv();
const port = Number(arg('port', process.env.WEB_PORT || 8080));
const root = path.resolve(
  arg('root', path.join(ROOT, 'release', 'app', 'dist', 'renderer')),
);
const lan = lanAddresses();
const primaryLan = lan[0] || '127.0.0.1';

let apiUrl =
  arg('api-url', process.env.SUPABASE_URL || env.SUPABASE_URL || '');
let anonKey = arg(
  'anon-key',
  process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '',
);

if (apiUrl) {
  apiUrl = apiUrl.replace('127.0.0.1', primaryLan).replace('localhost', primaryLan);
}
if (!apiUrl || !anonKey) {
  console.error(
    'Missing Supabase URL/anon key. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env or pass --api-url/--anon-key.',
  );
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function configScript() {
  return `window.__XENOCARE_CONFIG__ = ${JSON.stringify({
    supabaseUrl: apiUrl,
    supabaseAnonKey: anonKey,
  })};`;
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': status === 200 ? 'no-cache' : 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'local'}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/config.js') {
    return send(res, 200, configScript(), MIME['.js']);
  }

  if (pathname === '/process-shim.js') {
    return send(
      res,
      200,
      'window.process = window.process || { env: {} };\nwindow.global = window.global || window;\n',
      MIME['.js'],
    );
  }

  if (pathname === '/health') {
    return send(res, 200, 'ok');
  }

  if (pathname === '/') pathname = '/index.html';

  const file = path.join(root, pathname);
  if (!file.startsWith(root)) return send(res, 403, 'Forbidden');

  if (pathname === '/index.html') {
    try {
      let html = fs.readFileSync(file, 'utf8');
      if (!html.includes('/config.js')) {
        html = html.replace(
          '</head>',
          '  <script src="/process-shim.js"></script>\n  <script src="/config.js"></script>\n</head>',
        );
      }
      return send(res, 200, html, MIME['.html']);
    } catch {
      return send(
        res,
        500,
        'Web build not found. Run `npm run build` first (expected at release/app/dist/renderer).',
      );
    }
  }

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return send(
      res,
      200,
      fs.readFileSync(file),
      MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    );
  }

  // SPA fallback for client-side routes.
  if (!path.extname(pathname)) {
    try {
      let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
      html = html.replace(
        '</head>',
        '  <script src="/process-shim.js"></script>\n  <script src="/config.js"></script>\n</head>',
      );
      return send(res, 200, html, MIME['.html']);
    } catch {
      /* fall through */
    }
  }

  return send(res, 404, 'Not found');
});

server.listen(port, '0.0.0.0', () => {
  console.log('');
  console.log(' XenoCare web server');
  console.log(` Local : http://127.0.0.1:${port}`);
  for (const ip of lan) console.log(` LAN   : http://${ip}:${port}`);
  console.log(` API   : ${apiUrl}`);
  console.log('');
  console.log(' Clients open the LAN URL in a browser.');
});
