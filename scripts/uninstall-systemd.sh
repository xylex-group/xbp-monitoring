#!/bin/bash

set -e

SERVICE_NAME="xbp-monitoring"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/xbp-monitoring"
SERVICE_USER="xbp-monitoring"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root or with sudo"
    exit 1
fi

echo "Uninstalling ${SERVICE_NAME}..."

if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "Stopping service..."
    systemctl stop "$SERVICE_NAME"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME"; then
    echo "Disabling service..."
    systemctl disable "$SERVICE_NAME"
fi

if [ -f "$SERVICE_FILE" ]; then
    echo "Removing systemd service file..."
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
fi

if [ -f "$INSTALL_DIR/${SERVICE_NAME}" ]; then
    echo "Removing binary..."
    rm -f "$INSTALL_DIR/${SERVICE_NAME}"
fi

read -p "Remove configuration directory ${CONFIG_DIR}? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "$CONFIG_DIR" ]; then
        echo "Removing configuration directory..."
        rm -rf "$CONFIG_DIR"
    fi
fi

read -p "Remove service user ${SERVICE_USER}? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if id "$SERVICE_USER" &>/dev/null; then
        echo "Removing service user..."
        userdel "$SERVICE_USER" || true
    fi
fi

echo "Uninstallation complete!"
