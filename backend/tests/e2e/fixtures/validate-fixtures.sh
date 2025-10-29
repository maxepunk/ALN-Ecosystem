#!/bin/bash
# Validation script for E2E test fixtures
# Run this to verify all fixtures are present and valid

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==================================="
echo "E2E Test Fixtures Validation"
echo "==================================="
echo ""

# Check JSON validity
echo "[1/6] Validating test-tokens.json..."
if python3 -m json.tool test-tokens.json > /dev/null 2>&1; then
    TOKEN_COUNT=$(python3 -c "import json; print(len(json.load(open('test-tokens.json'))))")
    echo "  ✓ Valid JSON with $TOKEN_COUNT tokens"
else
    echo "  ✗ FAILED: Invalid JSON"
    exit 1
fi

# Check video files
echo ""
echo "[2/6] Checking video files..."
for video in test_10sec.mp4 test_30sec.mp4 idle_loop_test.mp4; do
    VIDEO_PATH="test-videos/$video"
    if [ ! -f "$VIDEO_PATH" ]; then
        echo "  ✗ FAILED: Missing $video"
        exit 1
    fi

    # Check video properties
    if ffprobe -v error -show_streams "$VIDEO_PATH" | grep -q "codec_name=h264"; then
        DURATION=$(ffprobe -v error -show_format "$VIDEO_PATH" | grep duration= | cut -d= -f2)
        SIZE=$(ls -lh "$VIDEO_PATH" | awk '{print $5}')
        echo "  ✓ $video ($DURATION sec, $SIZE)"
    else
        echo "  ✗ FAILED: $video is not valid H.264"
        exit 1
    fi
done

# Check image files
echo ""
echo "[3/6] Checking image files..."
for image in test-assets/images/*.jpg; do
    if [ ! -f "$image" ]; then
        echo "  ✗ FAILED: Missing $(basename $image)"
        exit 1
    fi
    SIZE=$(ls -lh "$image" | awk '{print $5}')
    echo "  ✓ $(basename $image) ($SIZE)"
done

# Check audio file
echo ""
echo "[4/6] Checking audio file..."
AUDIO_PATH="test-assets/audio/test_audio.mp3"
if [ ! -f "$AUDIO_PATH" ]; then
    echo "  ✗ FAILED: Missing test_audio.mp3"
    exit 1
fi

if ffprobe -v error -show_streams "$AUDIO_PATH" | grep -q "codec_name=mp3"; then
    DURATION=$(ffprobe -v error -show_format "$AUDIO_PATH" | grep duration= | cut -d= -f2)
    SIZE=$(ls -lh "$AUDIO_PATH" | awk '{print $5}')
    echo "  ✓ test_audio.mp3 ($DURATION sec, $SIZE)"
else
    echo "  ✗ FAILED: test_audio.mp3 is not valid MP3"
    exit 1
fi

# Check total size
echo ""
echo "[5/6] Checking total fixture size..."
TOTAL_SIZE=$(du -sh . | awk '{print $1}')
echo "  Total size: $TOTAL_SIZE"

# Size warning if > 1MB
SIZE_BYTES=$(du -sb . | awk '{print $1}')
if [ $SIZE_BYTES -gt 1048576 ]; then
    echo "  ⚠ Warning: Fixtures exceed 1MB (may slow down tests)"
fi

# Verify token data structure
echo ""
echo "[6/6] Validating token data structure..."
python3 << 'PYEOF'
import json
import sys

with open('test-tokens.json', 'r') as f:
    tokens = json.load(f)

required_fields = ['image', 'audio', 'video', 'processingImage', 'SF_RFID', 'SF_ValueRating', 'SF_MemoryType', 'SF_Group']
media_types = {'Personal', 'Business', 'Technical'}

errors = []
for token_id, token in tokens.items():
    # Check all required fields present
    for field in required_fields:
        if field not in token:
            errors.append(f"Token {token_id} missing field: {field}")

    # Check SF_RFID matches key
    if token.get('SF_RFID') != token_id:
        errors.append(f"Token {token_id} has mismatched SF_RFID: {token.get('SF_RFID')}")

    # Check rating is 1-5
    rating = token.get('SF_ValueRating')
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        errors.append(f"Token {token_id} has invalid rating: {rating}")

    # Check memory type is valid
    mem_type = token.get('SF_MemoryType')
    if mem_type not in media_types:
        errors.append(f"Token {token_id} has invalid memory type: {mem_type}")

if errors:
    print("  ✗ FAILED: Validation errors found:")
    for error in errors:
        print(f"    - {error}")
    sys.exit(1)
else:
    print("  ✓ All tokens have valid structure")
    print(f"  ✓ {len(tokens)} tokens validated")
PYEOF

if [ $? -ne 0 ]; then
    exit 1
fi

echo ""
echo "==================================="
echo "✓ All fixtures validated successfully"
echo "==================================="
echo ""
echo "Summary:"
echo "  - $TOKEN_COUNT tokens"
echo "  - 3 video files (test_10sec, test_30sec, idle_loop_test)"
echo "  - 4 image files (test_image, 3x processing images)"
echo "  - 1 audio file (test_audio)"
echo "  - Total size: $TOTAL_SIZE"
echo ""
