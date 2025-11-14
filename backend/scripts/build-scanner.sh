#!/bin/bash
#
# GM Scanner Build Script
# Automatically builds ALNScanner before starting orchestrator
# Called by npm prestart hook
#

set -e  # Exit on error

SCANNER_DIR="../ALNScanner"

# Check if scanner directory exists
if [ ! -d "$SCANNER_DIR" ]; then
    echo "⚠️  ALNScanner directory not found at $SCANNER_DIR"
    echo "   Orchestrator will start without GM Scanner (degraded mode)"
    exit 0  # Don't fail - allow orchestrator to start
fi

echo "🔨 Building GM Scanner for orchestrator..."

cd "$SCANNER_DIR"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "   📦 Installing scanner dependencies..."
    npm ci --silent
else
    echo "   ✅ Scanner dependencies already installed"
fi

# Build scanner
echo "   🏗️  Building scanner with Vite..."
npm run build --silent

# Verify build output
if [ -f "dist/index.html" ]; then
    echo "   ✅ GM Scanner built successfully"
    echo "   📍 Available at: https://localhost:3000/gm-scanner/"
else
    echo "   ❌ Build failed - dist/index.html not found"
    exit 1
fi

cd - > /dev/null
