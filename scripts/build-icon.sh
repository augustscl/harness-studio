#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_directory}/.." && pwd)"
source_svg="${project_root}/build/icon.svg"
output_icns="${project_root}/build/icon.icns"

for required_tool in sips iconutil; do
  if ! command -v "${required_tool}" >/dev/null 2>&1; then
    echo "error: ${required_tool} is required to build the macOS icon" >&2
    exit 1
  fi
done

if [[ ! -f "${source_svg}" ]]; then
  echo "error: icon source not found at ${source_svg}" >&2
  exit 1
fi

temporary_root="$(mktemp -d /tmp/harness-studio-icon.XXXXXX)"
trap 'rm -rf "${temporary_root}"' EXIT

master_png="${temporary_root}/icon-1024.png"
iconset_directory="${temporary_root}/HarnessStudio.iconset"
verification_directory="${temporary_root}/Verification.iconset"
temporary_icns="${temporary_root}/icon.icns"
mkdir -p "${iconset_directory}"

sips --setProperty format png "${source_svg}" --out "${master_png}" >/dev/null

master_width="$(sips --getProperty pixelWidth "${master_png}" | awk '/pixelWidth/ { print $2 }')"
master_height="$(sips --getProperty pixelHeight "${master_png}" | awk '/pixelHeight/ { print $2 }')"
if [[ "${master_width}" != "1024" || "${master_height}" != "1024" ]]; then
  echo "error: SVG must render to 1024x1024 pixels; received ${master_width}x${master_height}" >&2
  exit 1
fi

icon_specs=(
  "icon_16x16.png:16"
  "icon_16x16@2x.png:32"
  "icon_32x32.png:32"
  "icon_32x32@2x.png:64"
  "icon_128x128.png:128"
  "icon_128x128@2x.png:256"
  "icon_256x256.png:256"
  "icon_256x256@2x.png:512"
  "icon_512x512.png:512"
  "icon_512x512@2x.png:1024"
)

for spec in "${icon_specs[@]}"; do
  filename="${spec%%:*}"
  pixels="${spec##*:}"
  sips --resampleHeightWidth "${pixels}" "${pixels}" \
    "${master_png}" \
    --out "${iconset_directory}/${filename}" >/dev/null
done

iconutil --convert icns "${iconset_directory}" --output "${temporary_icns}"
iconutil --convert iconset "${temporary_icns}" --output "${verification_directory}"

for spec in "${icon_specs[@]}"; do
  filename="${spec%%:*}"
  if [[ ! -f "${verification_directory}/${filename}" ]]; then
    echo "error: generated ICNS is missing ${filename}" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "${output_icns}")"
mv "${temporary_icns}" "${output_icns}"

echo "Created ${output_icns} from ${source_svg}"
echo "Verified ${#icon_specs[@]} standard macOS icon representations"
