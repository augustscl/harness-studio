#!/usr/bin/env bash
set -euo pipefail

app_path="${1:-release/mac-arm64/Harness Studio.app}"
app_path="$(cd -P "$(dirname "$app_path")" && pwd -P)/$(basename "$app_path")"
app_executable="$app_path/Contents/MacOS/Harness Studio"
runtime_modules="$app_path/Contents/Resources/app/node_modules"
smoke_root="$(mktemp -d /tmp/harness-studio-packaged-smoke.XXXXXX)"
user_data="$smoke_root/user-data"
app_pid=""
engine_pid=""
engine_url=""

cleanup() {
  if [[ -n "$app_pid" ]] && kill -0 "$app_pid" 2>/dev/null; then
    kill -TERM "$app_pid" 2>/dev/null || true
    for _ in {1..40}; do
      kill -0 "$app_pid" 2>/dev/null || break
      sleep 0.25
    done
  fi
  rm -rf "$smoke_root"
}
trap cleanup EXIT

test -x "$app_executable"
mkdir -p "$user_data"

env -i \
  HOME="$HOME" \
  USER="${USER:-}" \
  LOGNAME="${LOGNAME:-}" \
  PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
  SHELL="/bin/zsh" \
  TMPDIR="${TMPDIR:-/tmp}" \
  LANG="${LANG:-en_US.UTF-8}" \
  "$app_executable" \
  "--user-data-dir=$user_data" \
  >"$smoke_root/app-output.log" 2>&1 &
app_pid="$!"

engine_log="$user_data/logs/harness-engine.log"
for _ in {1..360}; do
  kill -0 "$app_pid" 2>/dev/null || {
    echo 'Packaged application exited before Harness became ready.' >&2
    sed -n '1,160p' "$smoke_root/app-output.log" >&2
    exit 1
  }
  if [[ -f "$engine_log" ]]; then
    engine_url="$(sed -nE 's/^dsh web: (http:\/\/127\.0\.0\.1:[0-9]+)$/\1/p' "$engine_log" | tail -1)"
    [[ -n "$engine_url" ]] && break
  fi
  sleep 0.25
done

test -n "$engine_url"
port="${engine_url##*:}"
engine_pid="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN | head -1)"
test -n "$engine_pid"

page="$smoke_root/harness.html"
curl --fail --silent --show-error --max-time 5 "$engine_url" > "$page"
grep -q '__DSH_BOOT__' "$page"

profiles_modules="$user_data/dsh/profiles/node_modules"
first_link="$(find "$profiles_modules" -maxdepth 1 -type l -print -quit)"
test -n "$first_link"
if find "$profiles_modules" -maxdepth 1 -type l ! -exec test -e {} \; -print -quit | grep -q .; then
  echo 'Packaged Harness created a broken runtime dependency link.' >&2
  exit 1
fi

while IFS= read -r link; do
  target="$(readlink "$link")"
  case "$target" in
    "$runtime_modules"/*) ;;
    *)
      echo "Runtime link points outside the application bundle: $link -> $target" >&2
      exit 1
      ;;
  esac
done < <(find "$profiles_modules" -maxdepth 1 -type l -print)

sleep 2
kill -0 "$engine_pid"
kill -TERM "$app_pid"

for _ in {1..60}; do
  if ! kill -0 "$app_pid" 2>/dev/null && ! kill -0 "$engine_pid" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

if kill -0 "$app_pid" 2>/dev/null || kill -0 "$engine_pid" 2>/dev/null; then
  echo 'Packaged application left a process running after quit.' >&2
  exit 1
fi

if lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | grep -q .; then
  echo "Packaged application left loopback port $port open after quit." >&2
  exit 1
fi

app_pid=""
echo "Packaged smoke passed: $engine_url closed cleanly"
