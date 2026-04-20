#!/bin/bash

# ============================================================
# Scalability Test Wrapper
# Runs concurrent client levels: 100, 500, 1000, 2000
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

node tests/load/scalability-test.js
