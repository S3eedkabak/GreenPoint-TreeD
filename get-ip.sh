#!/bin/bash

echo "🔍 Finding your local IP address..."
echo ""

# Get WiFi IP (most common)
WIFI_IP=$(ipconfig getifaddr en0 2>/dev/null)

if [ -n "$WIFI_IP" ]; then
    echo "✅ WiFi IP (en0): $WIFI_IP"
    echo ""
    echo "Update your .env file with:"
    echo "EXPO_PUBLIC_API_URL=http://$WIFI_IP:3000/api/v1"
else
    # Try Ethernet
    ETH_IP=$(ipconfig getifaddr en1 2>/dev/null)
    if [ -n "$ETH_IP" ]; then
        echo "✅ Ethernet IP (en1): $ETH_IP"
        echo ""
        echo "Update your .env file with:"
        echo "EXPO_PUBLIC_API_URL=http://$ETH_IP:3000/api/v1"
    else
        echo "❌ No network connection found"
        echo ""
        echo "All network interfaces:"
        ifconfig | grep "inet " | grep -v 127.0.0.1
    fi
fi
