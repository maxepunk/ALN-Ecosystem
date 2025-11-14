#!/bin/bash
# One-time setup script for ALN Orchestrator
# Run this after cloning the repository

echo "🚀 ALN Orchestrator Setup Script"
echo "================================="

# Change to backend directory
cd "$(dirname "$0")/.." || exit 1

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null)
if [[ -z "$NODE_VERSION" ]]; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Check if VLC is installed
if ! command -v vlc &> /dev/null; then
    echo "⚠️  VLC is not installed. Install with: sudo apt-get install vlc"
    echo "   Continuing without VLC (degraded mode)..."
else
    echo "✅ VLC is installed"
fi

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpeg is not installed. Cannot generate test videos"
else
    echo "✅ ffmpeg is installed"
fi

# Install dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

# Build GM Scanner
echo ""
echo "🔨 Building GM Scanner..."
./scripts/build-scanner.sh

# Create required directories if they don't exist
echo ""
echo "📁 Creating directory structure..."
mkdir -p public/videos
mkdir -p storage/sessions
mkdir -p logs
mkdir -p scripts

# Generate test videos if ffmpeg is available and videos don't exist
if command -v ffmpeg &> /dev/null; then
    if [ ! -f "public/videos/test_2sec.mp4" ]; then
        echo ""
        echo "🎬 Generating test videos..."
        ffmpeg -f lavfi -i testsrc=duration=2:size=320x240:rate=1 \
               -c:v libx264 -pix_fmt yuv420p public/videos/test_2sec.mp4 -y 2>/dev/null
        echo "   ✅ test_2sec.mp4 created"

        ffmpeg -f lavfi -i testsrc=duration=30:size=320x240:rate=1 \
               -c:v libx264 -pix_fmt yuv420p public/videos/test_30sec.mp4 -y 2>/dev/null
        echo "   ✅ test_30sec.mp4 created"

        ffmpeg -f lavfi -i color=black:duration=5:size=320x240:rate=1 \
               -c:v libx264 -pix_fmt yuv420p public/videos/test_black.mp4 -y 2>/dev/null
        echo "   ✅ test_black.mp4 created"
    else
        echo ""
        echo "✅ Test videos already exist"
    fi
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "   ⚠️  Please edit .env to configure your environment"
fi

# Make scripts executable
chmod +x scripts/*.sh 2>/dev/null

echo ""
echo "✨ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env file with your configuration"
echo "   2. Start the system:"
echo "      - Quick start: npm start (uses PM2)"
echo "      - Development: npm run dev (interactive mode)"
echo "      - Custom: See npm run for all options"
echo ""
echo "🔍 Check system health: npm run health"
echo "🧪 Run tests: npm test"
echo "📚 Documentation: See README.md and DEPLOYMENT_GUIDE.md"