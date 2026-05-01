#!/bin/sh
set -eu

TARGET_FILE="/usr/share/nginx/html/dashboard/runtime-config.js"
API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-}"
ESCAPED_API_BASE_URL=$(printf '%s' "$API_BASE_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > "$TARGET_FILE" <<EOF
window.__XBP_RUNTIME_CONFIG__ = window.__XBP_RUNTIME_CONFIG__ || {};
window.__XBP_RUNTIME_CONFIG__.apiBaseUrl = "$ESCAPED_API_BASE_URL";
EOF

chmod 0644 "$TARGET_FILE"
