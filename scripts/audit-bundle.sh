#!/usr/bin/env bash
set -euo pipefail

app_path="${1:-release/mac-arm64/Harness Studio.app}"
info_plist="$app_path/Contents/Info.plist"
runtime_root="$app_path/Contents/Resources/app"

test -d "$app_path"
test -f "$info_plist"
test -x "$app_path/Contents/MacOS/Harness Studio"
test -f "$runtime_root/node_modules/@deepseek-ai/dsh/lib/bin.js"
test -f "$app_path/Contents/Resources/runtime/dsh-bootstrap.cjs"
test -f "$runtime_root/LICENSE"
test -f "$runtime_root/THIRD_PARTY.md"

node scripts/audit-runtime-closure.mjs "$app_path"

bundle_id="$(plutil -extract CFBundleIdentifier raw "$info_plist")"
minimum_system="$(plutil -extract LSMinimumSystemVersion raw "$info_plist")"
test "$bundle_id" = "com.harnessstudio.desktop"
test "$minimum_system" = "12.0"

file "$app_path/Contents/MacOS/Harness Studio" | grep -q 'arm64'

pty_module="$(find "$runtime_root/node_modules" -path '*/node-pty/build/Release/pty.node' -print -quit)"
spawn_helper="$(find "$runtime_root/node_modules" -path '*/node-pty/prebuilds/darwin-arm64/spawn-helper' -print -quit)"
test -n "$pty_module"
test -n "$spawn_helper"
test -x "$spawn_helper"
file "$pty_module" | grep -q 'arm64'
file "$spawn_helper" | grep -q 'arm64'

fuse_output="$(./node_modules/.bin/electron-fuses read --app "$app_path")"
echo "$fuse_output" | grep -q 'RunAsNode is Enabled'

dsh_version="$(
  ELECTRON_RUN_AS_NODE=1 "$app_path/Contents/MacOS/Harness Studio" \
    --expose-internals \
    "$app_path/Contents/Resources/runtime/dsh-bootstrap.cjs" \
    "$runtime_root/node_modules/@deepseek-ai/dsh/lib/bin.js" \
    --version
)"
test "$dsh_version" = "0.1.1-rc.2"

if find "$runtime_root" -path "$runtime_root/node_modules" -prune -o -name '.env*' -print | grep -q .; then
  echo 'Unexpected environment file found in the application bundle.' >&2
  exit 1
fi

echo "Bundle audit passed: $app_path"
