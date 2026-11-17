const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const WEB_PORT = 8080;
let webProcess = null;

function serverRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'server')
    : path.join(__dirname, '..', 'release', 'server');
}

function startWebServer() {
  // The scheduled task may already be serving; do not start a duplicate.
  const check = http.get(
    { host: '127.0.0.1', port: WEB_PORT, path: '/health', timeout: 1200 },
    (res) => {
      res.resume();
      if (res.statusCode !== 200) spawnWebServer();
    },
  );
  check.on('timeout', () => { check.destroy(); spawnWebServer(); });
  check.on('error', () => spawnWebServer());
}

function spawnWebServer() {
  const root = serverRoot();
  const node = path.join(root, 'node', 'node.exe');
  const script = path.join(root, 'scripts', 'server', 'web-server.mjs');
  const web = path.join(root, 'web');
  const fs = require('fs');
  if (!fs.existsSync(node) || !fs.existsSync(script)) return;
  webProcess = spawn(
    node,
    [script, '--port', String(WEB_PORT), '--root', web],
    { cwd: root, detached: false, windowsHide: true, stdio: 'ignore' },
  );
  webProcess.on('exit', () => { webProcess = null; });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 460,
    height: 340,
    resizable: false,
    title: 'XenoCare Server',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(
    'data:text/html;charset=utf-8,' +
      encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
      <style>
        body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;padding:28px;color:#11151c;background:#f7f6f3}
        h1{font-size:20px;margin:0 0 6px} p{color:#5b6470;font-size:13px;margin:0 0 18px;line-height:1.5}
        .box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px}
        .status{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
        .dot{width:8px;height:8px;border-radius:50%;background:#94a3b8}
        .dot.on{background:#16a34a} .dot.off{background:#dc2626}
        button{width:100%;border:0;border-radius:10px;background:#e9783f;color:#fff;font-weight:700;font-size:14px;padding:11px;cursor:pointer}
        code{font-size:12px;color:#334155}
      </style></head><body>
      <h1>XenoCare Server</h1>
      <p>Keep this computer awake while staff are connected.</p>
      <div class="box">
        <div class="status"><span id="dot" class="dot"></span><span id="label">Checking server...</span></div>
        <p style="margin:10px 0 0"><code id="url">http://localhost:${WEB_PORT}</code></p>
      </div>
      <button id="open">Open XenoCare in browser</button>
      <script>
        const dot=document.getElementById('dot'),label=document.getElementById('label');
        function check(){
          fetch('http://127.0.0.1:${WEB_PORT}/health').then(r=>{
            dot.className='dot '+(r.ok?'on':'off');
            label.textContent=r.ok?'Server is running':'Server is starting...';
          }).catch(()=>{dot.className='dot off';label.textContent='Server is not running'});
        }
        check(); setInterval(check,5000);
        document.getElementById('open').onclick=()=>{location.href='http://127.0.0.1:${WEB_PORT}'};
      </script></body></html>`),
  );
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  startWebServer();
  setTimeout(createWindow, 1500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
