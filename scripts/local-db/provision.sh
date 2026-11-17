#!/usr/bin/env bash
# Compatibility wrapper. The cross-platform provisioner is provision.mjs and
# runs on macOS, Linux and Windows (through Node).
#
#   ./scripts/local-db/provision.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$ROOT/scripts/local-db/provision.mjs" "$@"
