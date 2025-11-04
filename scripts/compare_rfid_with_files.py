#!/usr/bin/env python3
"""
Compare SF_RFID values from Notion with actual filenames to identify mismatches
"""

import requests
import json
import re
import os
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

# File paths
ECOSYSTEM_ROOT = Path("/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem")
ASSETS_IMAGES = ECOSYSTEM_ROOT / "aln-memory-scanner/assets/images"
ASSETS_AUDIO = ECOSYSTEM_ROOT / "aln-memory-scanner/assets/audio"
VIDEOS_DIR = ECOSYSTEM_ROOT / "backend/public/videos"

# Notion API headers
headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def parse_sf_rfid(description_text):
    """Extract SF_RFID from description."""
    pattern = r'SF_RFID:\s*\[([^\]]*)\]'
    match = re.search(pattern, description_text, re.IGNORECASE)
    if match:
        return match.group(1).strip().lower()
    return None

def get_prefix_from_filename(filename):
    """Get the prefix (before the dot) from a filename."""
    return Path(filename).stem.lower()

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
            break

        all_results.extend(data["results"])
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    return all_results

def main():
    print("=" * 80)
    print("RFID Mismatch Report")
    print("=" * 80)
    print()

    # Get all image/audio/video files
    all_files = []

    if ASSETS_IMAGES.exists():
        all_files.extend([(f, "image") for f in ASSETS_IMAGES.iterdir() if f.is_file()])

    if ASSETS_AUDIO.exists():
        all_files.extend([(f, "audio") for f in ASSETS_AUDIO.iterdir() if f.is_file()])

    if VIDEOS_DIR.exists():
        all_files.extend([(f, "video") for f in VIDEOS_DIR.iterdir() if f.is_file() and f.name != "idle-loop.mp4"])

    # Build a map of filename prefixes
    file_prefixes = {}
    for file_path, file_type in all_files:
        prefix = get_prefix_from_filename(file_path.name)
        if prefix not in file_prefixes:
            file_prefixes[prefix] = []
        file_prefixes[prefix].append((file_path.name, file_type))

    # Fetch tokens from Notion
    pages = fetch_all_memory_tokens()

    mismatches = []
    matches = []
    no_rfid = []

    for page in pages:
        props = page["properties"]

        # Get Name
        name_data = props.get("Name", {}).get("title", [])
        name = name_data[0]["text"]["content"] if name_data else "Untitled"

        # Get Description
        desc_data = props.get("Description/Text", {}).get("rich_text", [])
        description = "".join([block["text"]["content"] for block in desc_data]) if desc_data else ""

        # Parse SF_RFID
        sf_rfid = parse_sf_rfid(description)

        if not sf_rfid:
            no_rfid.append(name)
            continue

        # Get files from Notion
        files = props.get("Files & media", {}).get("files", [])
        notion_files = [f["name"] for f in files]

        # Check if SF_RFID matches any files
        if sf_rfid in file_prefixes:
            matches.append({
                "name": name,
                "sf_rfid": sf_rfid,
                "files": file_prefixes[sf_rfid]
            })
        else:
            # Check if Notion has file attachments with different prefixes
            file_prefixes_from_notion = [get_prefix_from_filename(f) for f in notion_files]
            unique_prefixes = set(file_prefixes_from_notion)

            if unique_prefixes:
                mismatches.append({
                    "name": name,
                    "sf_rfid": sf_rfid,
                    "notion_files": notion_files,
                    "actual_prefixes": unique_prefixes
                })
            else:
                # No files attached in Notion either
                matches.append({
                    "name": name,
                    "sf_rfid": sf_rfid,
                    "files": []
                })

    # Print report
    print(f"✓ MATCHED ({len(matches)} tokens)")
    print("-" * 80)
    for item in matches:
        if item["files"]:
            files_str = ", ".join([f"{f[0]} ({f[1]})" for f in item["files"]])
            print(f"{item['sf_rfid']}: {item['name']}")
            print(f"  Files: {files_str}")
        else:
            print(f"{item['sf_rfid']}: {item['name']} (no assets - OK)")
    print()

    print(f"⚠️  MISMATCHES ({len(mismatches)} tokens)")
    print("-" * 80)
    for item in mismatches:
        print(f"{item['sf_rfid']}: {item['name']}")
        print(f"  Notion SF_RFID: {item['sf_rfid']}")
        print(f"  Notion Files: {', '.join(item['notion_files'])}")
        print(f"  File Prefixes: {', '.join(item['actual_prefixes'])}")
        print()

    if no_rfid:
        print(f"✗ NO SF_RFID ({len(no_rfid)} tokens)")
        print("-" * 80)
        for name in no_rfid:
            print(f"  {name}")
        print()

    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Matched: {len(matches)}")
    print(f"Mismatched: {len(mismatches)}")
    print(f"No SF_RFID: {len(no_rfid)}")
    print()

    if mismatches:
        print("RECOMMENDATIONS:")
        print("1. Update SF_RFID in Notion descriptions to match actual filenames")
        print("2. OR rename files to match SF_RFID values in Notion")

if __name__ == "__main__":
    main()
