#!/bin/sh
set -eu

API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-}"
ESCAPED_API_BASE_URL=$(printf '%s' "$API_BASE_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')

RUNTIME_CONFIG_CONTENT=$(cat <<EOF
window.__XBP_RUNTIME_CONFIG__ = window.__XBP_RUNTIME_CONFIG__ || {};
window.__XBP_RUNTIME_CONFIG__.apiBaseUrl = "$ESCAPED_API_BASE_URL";
EOF
)

for TARGET_FILE in \
	"/usr/share/nginx/html/runtime-config.js"
do
	mkdir -p "$(dirname "$TARGET_FILE")"
	printf '%s\n' "$RUNTIME_CONFIG_CONTENT" > "$TARGET_FILE"
	chmod 0644 "$TARGET_FILE"
done
