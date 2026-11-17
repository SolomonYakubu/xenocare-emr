#!/usr/bin/env bash
# Write local Supabase credentials into the repo .env
# Requires the local stack to be running: `supabase start`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/opt/supabase/bin:/usr/local/bin:$PATH"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install with: brew install supabase/tap/supabase" >&2
  exit 1
fi

eval "$(supabase status -o env)"

export LOCAL_API_URL="$API_URL"
export LOCAL_ANON_KEY="$ANON_KEY"
export LOCAL_SERVICE_KEY="$SERVICE_ROLE_KEY"

python3 - <<'PY'
import os
import re

path = ".env"
try:
    text = open(path).read()
except FileNotFoundError:
    text = ""


def set_value(key: str, value: str) -> None:
    global text
    line = f"{key}={value}"
    if re.search(rf"^{re.escape(key)}=.*$", text, re.M):
        text = re.sub(rf"^{re.escape(key)}=.*$", lambda _: line, text, flags=re.M)
    else:
        text = text.rstrip("\n") + "\n" + line + "\n"


set_value("SUPABASE_URL", os.environ["LOCAL_API_URL"])
set_value("SUPABASE_ANON_KEY", os.environ["LOCAL_ANON_KEY"])
set_value("SUPABASE_SERVICE_ROLE_KEY", os.environ["LOCAL_SERVICE_KEY"])

open(path, "w").write(text)
print("Updated .env with local Supabase credentials")
print(f"  SUPABASE_URL={os.environ['LOCAL_API_URL']}")
PY
