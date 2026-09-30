#!/usr/bin/env bash
# Dev preview on :8080. Vite hot-reloads source edits; no restart needed.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
exec npx vite --port 8080 --host
