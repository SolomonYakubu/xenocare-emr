# XenoCare server package (Windows)

This builds the Windows server installer and the browser UI it serves.

## What the installer does

`release/server-build/XenoCare-Server-Setup-4.6.0.exe`

- Requires **Docker Desktop installed and running** (WSL 2 backend).
- Bundles Node.js, the Supabase CLI (pinned to **v2.75.0**, the version the
  local stack is tested with) and the browser build.
- Starts the Supabase stack, provisions the database only if it is empty
  (20 beds, demo users), opens firewall ports `8080`, `54321`, `54323`, and
  registers a start-at-sign-in web-server task.
- Serves the browser app at `http://<server-ip>:8080`.

## Logs

The setup writes:

- `C:\ProgramData\XenoCare\install.log`
- `C:\ProgramData\XenoCare\last-error.txt`
- `C:\ProgramData\XenoCare\docker-info.txt` when the engine does not respond

To rerun the setup manually after fixing Docker:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File "C:\Program Files\XenoCare Server\resources\server\scripts\server\install-server.ps1"
```

## Why the CLI is pinned

Supabase CLI v3 removed the `[inbucket]` section used by this project's
`supabase/config.toml` and refuses to start:

```
inbucket in supabase/config.toml is no longer supported. Use local_smtp instead.
```

The server therefore ships the v2.75 CLI. If the project moves to v3 later,
migrate `config.toml` first (`supabase config convert`) and then update the
download URL in `scripts/server/build-server-package.mjs`.

## Build

```bash
npm run build
node scripts/server/build-server-package.mjs
npx electron-builder build --config server-builder.yml --win --x64 \
  -c.npmRebuild=false --publish never
```

Health: `http://<server-ip>:8080/health`
