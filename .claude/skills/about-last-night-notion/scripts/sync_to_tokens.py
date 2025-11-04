#!/usr/bin/env python3
"""
sync_to_tokens.py - Sync About Last Night... Elements database to tokens.json

This script queries the Notion Elements database for memory tokens and generates
a tokens.json file in the format used by the About Last Night... application.

The script includes a pre-configured Notion integration token with access to
the About Last Night... databases. No setup required!

Usage:
    python sync_to_tokens.py --output tokens.json
    python sync_to_tokens.py --output tokens.json --filter-status "Done"

Requirements:
    pip install notion-client --break-system-packages

Environment Variables (Optional):
    NOTION_TOKEN - Override the pre-configured token if needed
"""

import os
import json
import argparse
import sys
from typing import Dict, List, Optional
from notion_client import Client
from notion_client.helpers import iterate_paginated_api
from notion_client import APIErrorCode, APIResponseError

# Database ID for Elements
ELEMENTS_DB = "18c2f33d-583f-8020-91bc-d84c7dd94306"

# Memory token types to include
MEMORY_TOKEN_TYPES = [
    "Memory Token Image",
    "Memory Token Audio",
    "Memory Token Video",
    "Memory Token Audio + Image"
]


def init_notion_client():
    """Initialize Notion client with authentication"""
    # Pre-configured token for About Last Night... databases
    DEFAULT_TOKEN = "YOUR_NOTION_TOKEN_HERE"
    
    # Use environment variable if set, otherwise use pre-configured token
    token = os.environ.get("NOTION_TOKEN", DEFAULT_TOKEN)
    
    if not token:
        print("Error: No Notion token available")
        print("Either set NOTION_TOKEN environment variable or use the pre-configured token")
        sys.exit(1)
    
    return Client(auth=token)


def safe_get_title(page: Dict, property_name: str) -> str:
    """Safely extract title property"""
    title_array = page["properties"].get(property_name, {}).get("title", [])
    return title_array[0]["text"]["content"] if title_array else ""


def safe_get_select(page: Dict, property_name: str) -> Optional[str]:
    """Safely extract select property"""
    select_obj = page["properties"].get(property_name, {}).get("select")
    return select_obj["name"] if select_obj else None


def extract_rfid_from_name(name: str) -> Optional[str]:
    """
    Extract RFID identifier from element name.
    
    Assumes format like "hos001" or "534e2b02" at start of name,
    or extracts alphanumeric identifiers.
    """
    if not name:
        return None
    
    # Try to extract first alphanumeric segment
    import re
    match = re.match(r'^([a-zA-Z0-9]+)', name.strip())
    if match:
        return match.group(1).lower()
    
    return None


def get_file_info(files: List[Dict], file_type: str) -> Optional[str]:
    """
    Extract file path/URL for a specific file type from files property.
    
    Args:
        files: List of file objects from Notion
        file_type: Type to filter for ('image', 'audio', 'video')
    
    Returns:
        Relative file path or None
    """
    for file in files:
        name = file.get("name", "").lower()
        
        # Check file extension
        if file_type == "image" and any(name.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
            # Extract filename and build relative path
            filename = file.get("name")
            return f"assets/images/{filename}"
        
        elif file_type == "audio" and any(name.endswith(ext) for ext in ['.mp3', '.wav', '.ogg', '.m4a']):
            filename = file.get("name")
            return f"assets/audio/{filename}"
        
        elif file_type == "video" and any(name.endswith(ext) for ext in ['.mp4', '.mov', '.avi', '.webm']):
            filename = file.get("name")
            return filename  # Videos may be in root based on example
    
    return None


def determine_memory_type(element: Dict) -> str:
    """
    Determine memory type based on element properties.
    
    Returns one of: "Technical", "Business", "Personal"
    """
    # This is a simplified heuristic - adjust based on your actual data
    narrative_threads = [opt["name"] for opt in element["properties"].get("Narrative Threads", {}).get("multi_select", [])]
    
    # Map narrative threads to memory types
    if any(thread in ["Tech Development", "Advanced Technology", "Unsanctioned Research"] for thread in narrative_threads):
        return "Technical"
    elif any(thread in ["Funding & Espionage", "Class Conflicts"] for thread in narrative_threads):
        return "Business"
    else:
        return "Personal"


def determine_value_rating(element: Dict) -> int:
    """
    Determine value rating (1-5) based on element properties.
    
    Returns integer 1-5.
    """
    # This is a simplified heuristic - adjust based on your actual data
    critical_path = element["properties"].get("Critical Path", {}).get("checkbox", False)
    first_available = safe_get_select(element, "First Available")
    
    # Higher rating for critical path items
    if critical_path:
        return 5
    # Earlier act items might be more valuable
    elif first_available == "Act 0":
        return 4
    elif first_available == "Act 1":
        return 3
    elif first_available == "Act 2":
        return 2
    else:
        return 1


def determine_group(element: Dict) -> str:
    """
    Determine group/category for the token.
    
    Returns group name or empty string.
    """
    # Extract from description or notes if available
    # This is a placeholder - adjust based on your actual grouping logic
    description = element["properties"].get("Description/Text", {}).get("rich_text", [])
    if description and len(description) > 0:
        text = description[0]["text"]["content"]
        # Look for group markers in description
        if "Marcus Sucks" in text:
            return "Marcus Sucks (x2)"
    
    return ""


def element_to_token(element: Dict) -> Optional[tuple]:
    """
    Convert a Notion element to a token.json entry.
    
    Returns:
        Tuple of (rfid, token_data) or None if element should be skipped
    """
    name = safe_get_title(element, "Name")
    basic_type = safe_get_select(element, "Basic Type")
    
    # Skip if not a memory token type
    if basic_type not in MEMORY_TOKEN_TYPES:
        return None
    
    # Extract RFID identifier
    rfid = extract_rfid_from_name(name)
    if not rfid:
        print(f"Warning: Could not extract RFID from element name: {name}")
        return None
    
    # Get files
    files = element["properties"].get("Files & media", {}).get("files", [])
    
    # Determine what media is present based on type
    image_path = None
    audio_path = None
    video_path = None
    processing_image = None
    
    if basic_type == "Memory Token Image":
        image_path = get_file_info(files, "image")
    elif basic_type == "Memory Token Audio":
        audio_path = get_file_info(files, "audio")
    elif basic_type == "Memory Token Video":
        video_path = get_file_info(files, "video")
        # Video tokens often have a processing/thumbnail image
        processing_image = get_file_info(files, "image")
    elif basic_type == "Memory Token Audio + Image":
        image_path = get_file_info(files, "image")
        audio_path = get_file_info(files, "audio")
    
    # Build token data
    token_data = {
        "image": image_path,
        "audio": audio_path,
        "video": video_path,
        "processingImage": processing_image,
        "SF_RFID": rfid,
        "SF_ValueRating": determine_value_rating(element),
        "SF_MemoryType": determine_memory_type(element),
        "SF_Group": determine_group(element)
    }
    
    return (rfid, token_data)


def fetch_memory_tokens(notion: Client) -> List[Dict]:
    """
    Query Notion Elements database for all memory tokens.
    
    Returns:
        List of element pages
    """
    print("Querying Notion Elements database...")
    
    try:
        # Build filter for memory token types
        filter_obj = {
            "or": [
                {"property": "Basic Type", "select": {"equals": token_type}}
                for token_type in MEMORY_TOKEN_TYPES
            ]
        }
        
        # Get all results with pagination
        elements = []
        for element in iterate_paginated_api(
            notion.databases.query,
            database_id=ELEMENTS_DB,
            filter=filter_obj
        ):
            elements.append(element)
        
        print(f"Found {len(elements)} memory token elements")
        return elements
    
    except APIResponseError as error:
        if error.code == APIErrorCode.ObjectNotFound:
            print("Error: Elements database not found or not shared with integration")
            print("Make sure to share the database with your integration in Notion")
        else:
            print(f"API Error: {error}")
        sys.exit(1)


def generate_tokens_json(elements: List[Dict]) -> Dict:
    """
    Generate tokens.json structure from elements.
    
    Returns:
        Dictionary ready to be serialized to JSON
    """
    tokens = {}
    skipped = 0
    
    for element in elements:
        result = element_to_token(element)
        if result:
            rfid, token_data = result
            tokens[rfid] = token_data
        else:
            skipped += 1
    
    if skipped > 0:
        print(f"Skipped {skipped} elements (couldn't extract RFID or not memory token)")
    
    return tokens


def write_tokens_file(tokens: Dict, output_path: str):
    """Write tokens dictionary to JSON file"""
    print(f"Writing {len(tokens)} tokens to {output_path}...")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(tokens, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully wrote tokens.json with {len(tokens)} entries")


def main():
    parser = argparse.ArgumentParser(
        description="Sync About Last Night... Elements database to tokens.json"
    )
    parser.add_argument(
        "--output",
        default="tokens.json",
        help="Output file path (default: tokens.json)"
    )
    parser.add_argument(
        "--filter-status",
        help="Optional: Only include elements with this status (e.g., 'Done')"
    )
    
    args = parser.parse_args()
    
    # Initialize Notion client
    notion = init_notion_client()
    
    # Fetch memory tokens
    elements = fetch_memory_tokens(notion)
    
    # Filter by status if specified
    if args.filter_status:
        print(f"Filtering by status: {args.filter_status}")
        elements = [
            e for e in elements
            if safe_get_select(e, "Status") == args.filter_status
        ]
        print(f"Filtered to {len(elements)} elements with status '{args.filter_status}'")
    
    # Generate tokens.json structure
    tokens = generate_tokens_json(elements)
    
    # Write to file
    write_tokens_file(tokens, args.output)
    
    print("\n✓ Sync complete!")
    print(f"\nTo use this data, copy {args.output} to your application directory.")
    print("Remember to also sync the actual media files referenced in the paths.")


if __name__ == "__main__":
    main()
