#!/bin/bash

set -e

SERVICE_NAME="xbp-monitoring"
BINARY_NAME="xbp-monitoring"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/xbp-monitoring"
SERVICE_USER="xbp-monitoring"
SERVICE_GROUP="xbp-monitoring"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root or with sudo"
    exit 1
fi

echo "Installing ${SERVICE_NAME} as systemd service..."

if command -v cargo &> /dev/null; then
    echo "Building binary with cargo..."
    cargo build --release
    BINARY_PATH="target/release/${BINARY_NAME}"
else
    echo "Warning: cargo not found. Assuming binary exists at ./${BINARY_NAME}"
    BINARY_PATH="./${BINARY_NAME}"
fi

if [ ! -f "$BINARY_PATH" ]; then
    echo "Error: Binary not found at $BINARY_PATH"
    echo "Please build the binary first: cargo build --release"
    exit 1
fi

echo "Creating service user and group..."
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER" || true
fi

echo "Creating directories..."
mkdir -p "$CONFIG_DIR"
mkdir -p "$(dirname "$INSTALL_DIR")"

echo "Installing binary..."
cp "$BINARY_PATH" "$INSTALL_DIR/${BINARY_NAME}"
chmod +x "$INSTALL_DIR/${BINARY_NAME}"
chown root:root "$INSTALL_DIR/${BINARY_NAME}"

if [ -f "xbp.yaml" ]; then
    echo "Copying configuration file..."
    cp xbp.yaml "$CONFIG_DIR/xbp.yaml"
    chmod 644 "$CONFIG_DIR/xbp.yaml"
    chown root:root "$CONFIG_DIR/xbp.yaml"
else
    echo "Warning: xbp.yaml not found. You may need to create $CONFIG_DIR/xbp.yaml manually"
fi

echo "Creating systemd service file..."
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=XBP Monitoring - Synthetic monitoring service
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${CONFIG_DIR}
ExecStart=${INSTALL_DIR}/${BINARY_NAME} --file ${CONFIG_DIR}/xbp.yaml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

Environment="RUST_LOG=info"
Environment="OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317"
Environment="OTEL_EXPORTER_OTLP_PROTOCOL=grpc"
Environment="OTEL_EXPORTER_OTLP_TIMEOUT=10"

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "$SERVICE_FILE"

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling service..."
systemctl enable "$SERVICE_NAME"

echo "Starting service..."
systemctl start "$SERVICE_NAME"

echo ""
echo "Installation complete!"
echo ""
echo "Service status:"
systemctl status "$SERVICE_NAME" --no-pager -l || true
echo ""
echo "Useful commands:"
echo "  View logs:        journalctl -u ${SERVICE_NAME} -f"
echo "  Restart service:  systemctl restart ${SERVICE_NAME}"
echo "  Stop service:     systemctl stop ${SERVICE_NAME}"
echo "  Status:           systemctl status ${SERVICE_NAME}"
echo ""
echo "Configuration file: ${CONFIG_DIR}/xbp.yaml"
echo "Edit environment variables in: ${SERVICE_FILE}"
