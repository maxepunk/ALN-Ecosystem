#!/usr/bin/env python3
"""
Sync Notion Elements database to tokens.json

This script:
1. Queries Notion for Memory Token elements (Image, Audio, Video, Audio+Image types)
2. Parses SF_ fields from Description/Text field
3. Checks filesystem for image/audio/video assets
4. Generates tokens.json with proper structure
"""

import requests
import json
import os
import re
from pathlib import Path

# Load environment variables from .env file if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # dotenv not installed, will use system environment variables
    pass

# Notion API setup
NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
if not NOTION_TOKEN:
    print("Error: NOTION_TOKEN not found")
    print("Please either:")
    print("  1. Add NOTION_TOKEN to .env file in project root, OR")
    print("  2. Set environment variable: export NOTION_TOKEN='your_token_here'")
    exit(1)

ELEMENTS_DATABASE_ID = "18c2f33d-583f-8020-91bc-d84c7dd94306"

# File paths (relative to ALN-Ecosystem root)
ECOSYSTEM_ROOT = Path("/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem")
ASSETS_IMAGES = ECOSYSTEM_ROOT / "aln-memory-scanner/assets/images"
ASSETS_AUDIO = ECOSYSTEM_ROOT / "aln-memory-scanner/assets/audio"
VIDEOS_DIR = ECOSYSTEM_ROOT / "backend/public/videos"
TOKENS_JSON = ECOSYSTEM_ROOT / "ALN-TokenData/tokens.json"

# Notion API headers
headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def parse_sf_fields(description_text):
    """
    Parse SF_ fields from description text.

    Expected format:
    SF_RFID: [value]
    SF_ValueRating: [value]
    SF_MemoryType: [value]
    SF_Group: [value]
    """
    sf_data = {}

    # Pattern to match SF_FieldName: [value] or SF_FieldName: [ value ]
    patterns = {
        'SF_RFID': r'SF_RFID:\s*\[([^\]]*)\]',
        'SF_ValueRating': r'SF_ValueRating:\s*\[([^\]]*)\]',
        'SF_MemoryType': r'SF_MemoryType:\s*\[([^\]]*)\]',
        'SF_Group': r'SF_Group:\s*\[([^\]]*)\]',
    }

    for field, pattern in patterns.items():
        match = re.search(pattern, description_text, re.IGNORECASE)
        if match:
            value = match.group(1).strip()

            # Convert to appropriate type
            if field == 'SF_RFID':
                sf_data[field] = value.lower() if value else None
            elif field == 'SF_ValueRating':
                try:
                    sf_data[field] = int(value) if value else None
                except ValueError:
                    sf_data[field] = None
            elif field == 'SF_MemoryType':
                sf_data[field] = value if value else None
            elif field == 'SF_Group':
                sf_data[field] = value if value else ""
        else:
            # Set defaults
            if field == 'SF_RFID':
                sf_data[field] = None
            elif field == 'SF_ValueRating':
                sf_data[field] = None
            elif field == 'SF_MemoryType':
                sf_data[field] = None
            elif field == 'SF_Group':
                sf_data[field] = ""

    return sf_data

def find_asset_file(rfid, directory, extensions):
    """
    Find an asset file with given RFID and possible extensions.
    Returns relative path from aln-memory-scanner or None.
    """
    if not rfid:
        return None

    for ext in extensions:
        # Try exact case match
        file_path = directory / f"{rfid}{ext}"
        if file_path.exists():
            # Return relative path from aln-memory-scanner
            if "images" in str(directory):
                return f"assets/images/{rfid}{ext}"
            elif "audio" in str(directory):
                return f"assets/audio/{rfid}{ext}"

    # Try case-insensitive match
    if directory.exists():
        for file in directory.iterdir():
            if file.stem.lower() == rfid.lower() and file.suffix.lower() in [ext.lower() for ext in extensions]:
                # Return relative path
                if "images" in str(directory):
                    return f"assets/images/{file.name}"
                elif "audio" in str(directory):
                    return f"assets/audio/{file.name}"

    return None

def find_video_file(rfid):
    """
    Find a video file in backend/public/videos.
    Returns just the filename (not full path) or None.
    """
    if not rfid:
        return None

    # Try exact case match
    video_path = VIDEOS_DIR / f"{rfid}.mp4"
    if video_path.exists():
        return f"{rfid}.mp4"

    # Try case-insensitive match
    if VIDEOS_DIR.exists():
        for file in VIDEOS_DIR.iterdir():
            if file.stem.lower() == rfid.lower() and file.suffix.lower() == ".mp4":
                return file.name

    return None

def fetch_all_memory_tokens():
    """Fetch all memory token elements from Notion."""
    query_data = {
        "filter": {
            "or": [
                {"property": "Basic Type", "select": {"equals": "Memory Token Image"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Audio"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Video"}},
                {"property": "Basic Type", "select": {"equals": "Memory Token Audio + Image"}}
            ]
        }
    }

    # Fetch all pages with pagination
    all_results = []
    has_more = True
    start_cursor = None

    while has_more:
        if start_cursor:
            query_data["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{ELEMENTS_DATABASE_ID}/query",
            headers=headers,
            json=query_data
        )
        data = resp.json()

        if "results" not in data:
            print(f"Error fetching from Notion: {data}")
            break

        all_results.extend(data["results"])
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    return all_results

def process_token(page):
    """Process a single Notion page into a token entry."""
    props = page["properties"]

    # Get Name
    name_data = props.get("Name", {}).get("title", [])
    name = name_data[0]["text"]["content"] if name_data else "Untitled"

    # Get Basic Type
    basic_type_data = props.get("Basic Type", {}).get("select")
    basic_type = basic_type_data["name"] if basic_type_data else None

    # Get Description/Text
    desc_data = props.get("Description/Text", {}).get("rich_text", [])
    description = ""
    if desc_data:
        description = "".join([block["text"]["content"] for block in desc_data])

    # Parse SF_ fields
    sf_data = parse_sf_fields(description)

    if not sf_data.get('SF_RFID'):
        print(f"⚠️  Skipping {name}: No SF_RFID found in description")
        return None

    rfid = sf_data['SF_RFID']

    # Find assets
    image_file = find_asset_file(rfid, ASSETS_IMAGES, ['.bmp', '.jpg', '.png', '.jpeg'])
    audio_file = find_asset_file(rfid, ASSETS_AUDIO, ['.mp3', '.wav', '.ogg'])
    video_file = find_video_file(rfid)

    # Use placeholder if no image found
    if not image_file:
        placeholder_path = ASSETS_IMAGES / "placeholder.bmp"
        if placeholder_path.exists():
            image_file = "assets/images/placeholder.bmp"

    # Build token entry
    token_entry = {
        "image": image_file,
        "audio": audio_file,
        "video": video_file,
        "processingImage": None,  # Default to None
        "SF_RFID": rfid,
        "SF_ValueRating": sf_data.get('SF_ValueRating'),
        "SF_MemoryType": sf_data.get('SF_MemoryType'),
        "SF_Group": sf_data.get('SF_Group', "")
    }

    # Set processingImage only if video exists
    if video_file and image_file:
        token_entry["processingImage"] = image_file
        token_entry["image"] = None  # Video tokens don't have image, only processingImage

    return rfid, token_entry

def main():
    print("=" * 60)
    print("Syncing Notion Elements to tokens.json")
    print("=" * 60)
    print()

    # Verify directories exist
    print("Checking directories...")
    for path, name in [
        (ASSETS_IMAGES, "aln-memory-scanner/assets/images"),
        (ASSETS_AUDIO, "aln-memory-scanner/assets/audio"),
        (VIDEOS_DIR, "backend/public/videos"),
    ]:
        if path.exists():
            print(f"✓ {name}")
        else:
            print(f"✗ {name} (NOT FOUND)")
    print()

    # Fetch tokens from Notion
    print("Fetching memory tokens from Notion...")
    pages = fetch_all_memory_tokens()
    print(f"Found {len(pages)} memory token elements in Notion")
    print()

    # Process tokens
    tokens = {}
    skipped = []

    print("Processing tokens...")
    for page in pages:
        result = process_token(page)
        if result:
            rfid, token_entry = result
            tokens[rfid] = token_entry

            # Get name for logging
            name_data = page["properties"].get("Name", {}).get("title", [])
            name = name_data[0]["text"]["content"] if name_data else "Untitled"

            # Log what was found (show actual filenames)
            assets = []
            if token_entry["image"]:
                assets.append(token_entry["image"])
            if token_entry["audio"]:
                assets.append(token_entry["audio"])
            if token_entry["video"]:
                assets.append(token_entry["video"])
            if token_entry["processingImage"]:
                assets.append(f"processingImage: {token_entry['processingImage']}")

            assets_str = ", ".join(assets) if assets else "no assets"
            print(f"✓ {rfid}: {name} ({assets_str})")
        else:
            name_data = page["properties"].get("Name", {}).get("title", [])
            name = name_data[0]["text"]["content"] if name_data else "Untitled"
            skipped.append(name)

    print()
    print(f"Processed {len(tokens)} tokens")
    if skipped:
        print(f"Skipped {len(skipped)} tokens without SF_RFID:")
        for name in skipped:
            print(f"  - {name}")
    print()

    # Sort tokens by RFID for cleaner output
    sorted_tokens = dict(sorted(tokens.items()))

    # Write to tokens.json
    print(f"Writing to {TOKENS_JSON}...")
    with open(TOKENS_JSON, 'w') as f:
        json.dump(sorted_tokens, f, indent=2)

    print()
    print("=" * 60)
    print(f"✓ Successfully synced {len(sorted_tokens)} tokens to tokens.json")
    print("=" * 60)

if __name__ == "__main__":
    main()
