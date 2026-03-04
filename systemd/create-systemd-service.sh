#!/bin/bash

set -o errexit

# you probably want to run this script as root


cp auto-vc-status.service /etc/systemd/system/

# Reload systemd to recognize the new file
systemctl daemon-reload

# Enable the service (this creates the symlink automatically)
systemctl enable auto-vc-status

# Start the service
systemctl start auto-vc-status

# Check the status to ensure it's running
systemctl status auto-vc-status
