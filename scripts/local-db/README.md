# Local Docker backend (Supabase) for XenoCare

This folder contains everything needed to run the EMR against a **local Supabase stack in Docker** instead of a hosted project.

## What is here

| File | Purpose |
| --- | --- |
| `schema.sql` | Consolidated, working `public` schema (tables, functions, triggers, RLS, indexes) reconstructed from the repo's migrations plus compatibility fixes. |
| `seed-data.sql` | Reference/demo data: facilities, departments, clinics, lab/imaging/drug/procedure catalogues, wards/beds, specialty & clinical templates, config. |
| `seed-admin.sql` | Demo auth users + staff records (password `Demo@123`), plus GoTrue/facility fixes. |
| `provision.mjs` | Cross-platform reset + schema + seed + users (runs SQL inside the DB container). **Destructive to the local DB only.** |
| `host-server.mjs` | Starts the stack, seeds only if empty, writes `.env`, prints LAN join details. |
| `provision.sh` / `host-server.sh` | Thin wrappers kept for macOS/Linux muscle memory. |
| `00-reset.sql` … `06-storage.sql` | The reset/grants/beds/storage steps, shared by every platform. |
| `install-server-task.ps1` | Windows: firewall rules + start-at-sign-in task + first run. |
| `write-env.sh` | Writes the local Supabase URL and keys into the repo `.env`. |
| `e2e-flow.mjs` | End-to-end workflow test against the local API (12 phases, every module). |
| `ui-smoke.mjs` | Electron login/dashboard smoke test. |
| `ui-modules.mjs` | Electron sweep of every active module route, bed CRUD and external radiology. |
| `ui-roles.mjs` | Signs in as every demo role and walks that role's modules. |
| `ui-lan.mjs` | Verifies LAN server save/clear and the login-only XenoCare lockup. |
| `host-server.sh` | Starts the stack as a LAN server and prints join details. |

## Prerequisites

- Docker Desktop running
- Supabase CLI: `brew install supabase/tap/supabase`
- PostgreSQL 17 client tools: `brew install postgresql@17`
- Node.js 20 for the app (the repo's webpack config is Node 20/CommonJS friendly)

## Quick start

```bash
# 1. Start Docker, then provision the database (schema + seed + demo users)
./scripts/local-db/provision.sh

# 2. Point the desktop app at the local stack
./scripts/local-db/write-env.sh

# 3. Start the app (Node 20 + the config workarounds used in this repo)
export PATH="$HOME/.nvm/versions/node/v20.19.5/bin:$PATH"
export TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}'
export SKIP_DEVTOOLS=true
npm start

# 4. In another terminal, run the full workflow test
node scripts/local-db/e2e-flow.mjs

# 5. Optional: drive the real Electron login form (app must be running)
node scripts/local-db/ui-smoke.mjs

# 6. Sweep every active module route and test radiology + bed-only in-patient
node scripts/local-db/ui-modules.mjs

# 7. Sign in as every role and verify its surface
node scripts/local-db/ui-roles.mjs

# 8. Verify joining a LAN server from the login screen
node scripts/local-db/ui-lan.mjs
```

Local services:

- API: `http://127.0.0.1:54321`
- Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

## Run one computer as the server (LAN)

The desktop app is a client. The server is the local Supabase stack (Postgres,
Auth, REST, Storage, Realtime) running in Docker. The host scripts below start
that stack, create/seed the database if it is empty, and print the LAN details.

### Windows server (recommended path)

Prerequisites on the server PC:

- **Docker Desktop** with the WSL 2 backend, and
  *Settings → General → Start Docker Desktop when you sign in* enabled.
- **Node.js 20 LTS** on PATH.
- **Supabase CLI**: `scoop install supabase`. If it is not installed, the
  scripts fall back to `npx supabase` (Node must be available).
- A **static IP** (or DHCP reservation) for the server PC.

One-time setup, from the repository folder in an **elevated PowerShell**:

```powershell
npm install
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\local-db\install-server-task.ps1
```

That script:

1. Allows inbound TCP `54321` (API) and `54323` (Studio) on the private network.
2. Registers a **XenoCare Server** scheduled task that runs at sign-in and
   starts the stack (with a 45 s delay for Docker Desktop).
3. Starts the stack now, provisions the database **only if it is empty**, and
   prints the LAN URL + anon key.
4. Saves the same details to `%USERPROFILE%\XenoCare\server-info.txt`.

Manual commands if you prefer not to install the task:

```powershell
npm run db:host            # start stack, seed only if empty, print details
npm run db:host -- --wait  # wait up to 10 min for Docker Desktop first
npm run db:provision       # force a full reset + reseed (destructive, local)
```

What is automatic after setup:

- At sign-in the task waits for Docker, runs `supabase start` (idempotent), and
  provisions the database only when `public.patients` is missing.
- The containers use `restart: unless-stopped`, so Docker brings them back
  automatically after a reboot or Docker Desktop restart.

What is **not** automatic:

- Docker Desktop itself must be set to start at sign-in; if the PC boots
  without anyone signing in, the task never runs (enable auto-login, or run
  Docker/Postgres as a proper Windows service for unattended servers).
- The app installer does not ship the server scripts — run them from the
  repository checkout on the server PC.
- The desktop app never creates the server; it only connects to one.

Notes:

- For a friendlier address, rename the server PC (for example
  `xenocare-server`) and try `http://xenocare-server.local:54321`. This uses
  mDNS and depends on the network; if the name does not resolve, use the IP
  address or add a DNS/hosts entry on your router. The IP is always shown
  first and is the reliable option.
- The host must allow incoming TCP on `54321` (API) and `54323` (Studio).
- Set the Windows network profile to **Private**; the firewall rules are
  scoped to private networks.
- Keep the host awake while clients are connected (disable sleep, or enable
  "Keep awake" in Docker Desktop).
- The client reads the saved server at startup, so no rebuild is needed.
- LAN traffic is plain HTTP; use a tunnel/HTTPS for anything beyond a trusted
  network. The anon key is public by design — RLS enforces access.
- macOS/Linux hosts run the same cross-platform scripts:
  `npm run db:host` or `./scripts/local-db/host-server.sh`.

## Demo logins

Password for all accounts: `Demo@123`

| Email | Role |
| --- | --- |
| `superadmin@ndchospital.com` | super admin |
| `admin@ndchospital.com` | admin |
| `director@ndchospital.com` | medical director |
| `doctor@ndchospital.com` | doctor (GOPD) |
| `nurse@ndchospital.com` | nurse |
| `lab@ndchospital.com` | lab technician |
| `radiology@ndchospital.com` | radiologist |
| `pharmacy@ndchospital.com` | pharmacist |
| `billing@ndchospital.com` | billing clerk |
| `reception@ndchospital.com` | receptionist |

## What the E2E test covers

1. Registration + encounter + consultation fee + billing queue ticket
2. Billing verification via `verify_payment_and_route` → receipt + auto-route to Nursing
3. Nursing vitals + triage → Consultation queue
4. Consultation + lab / pharmacy / radiology orders
5. Lab: accept → charge → pay → sample → result
6. Pharmacy: accept → charge → pay → dispense
7. Radiology: accept → charge → pay → perform → final report
8. Encounter closure + medical records + receipts reconciliation
9. Messaging + notifications
10. Specialty templates, ANC, A&E and audit-log smoke checks

Every phase asserts database state, not just HTTP success.

## Notes / design decisions

- **Migration auto-run is disabled** in `supabase/config.toml` (`[db.migrations] enabled = false`). The original late migrations assume a pre-existing schema and fail on a blank database. The canonical schema is `schema.sql`; the original files remain in `supabase/migrations` for reference.
- `edge_runtime` and `analytics` are disabled in `supabase/config.toml`; the edge runtime tries to fetch from `deno.land` at boot and blocks startup on restricted networks.
- `provision.sh` drops and recreates the `public` schema. It also recreates the `vector` and `pg_trgm` extensions in `public` because the EMR schema uses `public.vector` and `public.gin_trgm_ops`.
- Several repo migrations were written against an older schema. The compatibility fixes required for a clean boot are baked into `schema.sql`:
  - `verify_payment_and_route`: uuid/text casts, enum casts, and sequence-based receipt numbers
  - `prevent_closed_encounter_modification`: uuid encounter lookup
  - audit triggers: valid `audit_action` enum values, correct vitals/prescription columns, RLS-safe (`SECURITY DEFINER`)
  - `log_comprehensive_audit`: generic record id extraction for tables without an `id` column
  - messaging RLS: authenticated send/update policies for `staff_messages` and `message_recipients`
  - drug catalogue: keeps `generic_name`, `strength`, `drug_type`, `category` columns used by the pharmacy UI
- `staff.facility_id` must be set for facility-scoped RLS on encounters; `seed-admin.sql` assigns all demo staff to the `MHC` facility.
- `supabase stop` / `supabase start` preserves the database volume. `provision.sh` resets it.
