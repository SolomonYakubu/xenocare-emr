#!/usr/bin/env bash
# Compatibility wrapper. The cross-platform host script is host-server.mjs and
# runs on macOS, Linux and Windows (through Node).
#
#   ./scripts/local-db/host-server.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$ROOT/scripts/local-db/host-server.mjs" "$@"
