#!/usr/bin/env python3
"""
Push approved tokens from draft.json to Notion

This script:
1. Reads work-session/draft.json
2. Creates Notion Element pages for approved tokens
3. Optionally creates new timeline events for identified gaps
4. Links tokens to characters, timeline events, and narrative threads

After running this, you must run sync_notion_to_tokens.py to:
- Generate NeurAI BMP display images
- Update tokens.json for gameplay
"""

import requests
import json
import os
from pathlib import Path
from datetime import datetime

# Load environment variables
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

# Notion API setup
NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
if not NOTION_TOKEN:
    print("Error: NOTION_TOKEN not found")
    exit(1)

# Database IDs
ELEMENTS_DATABASE_ID = "18c2f33d-583f-8020-91bc-d84c7dd94306"
CHARACTERS_DATABASE_ID = "18c2f33d-583f-8060-a6ab-de32ff06bca2"
TIMELINE_DATABASE_ID = "1b52f33d-583f-80de-ae5a-d20020c120dd"

# Paths
ECOSYSTEM_ROOT = Path(__file__).parent.parent
CACHE_ROOT = ECOSYSTEM_ROOT / ".claude/token-gen-cache"
DRAFT_PATH = CACHE_ROOT / "work-session/draft.json"

# Notion API headers
headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

def load_draft():
    """Load draft.json work session"""
    if not DRAFT_PATH.exists():
        print(f"Error: No draft found at {DRAFT_PATH}")
        print("\nPlease create tokens using the token-generator skill first:")
        print("  /token-generator")
        exit(1)

    with open(DRAFT_PATH, 'r') as f:
        return json.load(f)

def load_character_lookup():
    """Load character slug -> Notion page ID lookup"""
    char_graph_path = CACHE_ROOT / "graph/characters.json"

    if not char_graph_path.exists():
        print(f"Error: Character graph not found at {char_graph_path}")
        print("Run sync_notion_for_token_gen.py first")
        exit(1)

    with open(char_graph_path, 'r') as f:
        data = json.load(f)

    return {
        char["slug"]: char["id"]
        for char in data["characters"]
    }

def infer_basic_type(token):
    """
    Infer Notion Basic Type from token metadata

    For now, default to "Memory Token Image"
    User can adjust in Notion based on actual media type
    """
    # Could be enhanced to check if video/audio specified
    return "Memory Token Image"

def build_description_field(token):
    """
    Build Notion Description/Text field with display text + SF_ fields
    """
    desc = token.get("display_text", "")

    # Append SF_ fields
    desc += f"\n\nSF_RFID: [{token['SF_RFID']}]"
    desc += f"\nSF_ValueRating: [{token['SF_ValueRating']}]"
    desc += f"\nSF_MemoryType: [{token['SF_MemoryType']}]"
    desc += f"\nSF_Group: [{token.get('SF_Group', '')}]"

    if token.get('summary'):
        desc += f"\nSF_Summary: [{token['summary']}]"

    return desc

def create_timeline_event(event_details):
    """
    Create new timeline event in Notion

    Args:
        event_details: Dict with date, title, notes, character_ids

    Returns:
        Created page ID
    """
    print(f"\n  Creating timeline event: {event_details['title']}")

    # Build page data
    page_data = {
        "parent": {"database_id": TIMELINE_DATABASE_ID},
        "properties": {
            "Description": {
                "title": [{"text": {"content": event_details["title"]}}]
            }
        }
    }

    # Add date if provided
    if event_details.get("date"):
        page_data["properties"]["Date"] = {
            "date": {"start": event_details["date"]}
        }

    # Add notes if provided
    if event_details.get("notes"):
        page_data["properties"]["Notes"] = {
            "rich_text": [{"text": {"content": event_details["notes"]}}]
        }

    # Add character relations if provided
    if event_details.get("character_ids"):
        page_data["properties"]["Characters Involved"] = {
            "relation": [{"id": char_id} for char_id in event_details["character_ids"]]
        }

    # Create page
    resp = requests.post(
        "https://api.notion.com/v1/pages",
        headers=headers,
        json=page_data
    )

    if resp.status_code != 200:
        print(f"  ✗ Failed to create timeline event: {resp.text}")
        return None

    created_page = resp.json()
    print(f"  ✓ Created timeline event: {created_page['id']}")
    return created_page["id"]

def create_notion_element(token, char_lookup):
    """
    Create Notion Element page for token

    Args:
        token: Token data from draft.json
        char_lookup: Dict mapping character slug -> Notion page ID

    Returns:
        Created page ID or None if failed
    """
    print(f"\n  Creating Notion element: {token['notion_element_name']}")

    # Resolve character page ID
    char_pov = token.get("character_pov")
    owner_id = char_lookup.get(char_pov) if char_pov else None

    if char_pov and not owner_id:
        print(f"  ⚠ Warning: Character '{char_pov}' not found in lookup")

    # Build page data
    page_data = {
        "parent": {"database_id": ELEMENTS_DATABASE_ID},
        "properties": {
            "Name": {
                "title": [{"text": {"content": token["notion_element_name"]}}]
            },
            "Basic Type": {
                "select": {"name": infer_basic_type(token)}
            },
            "Status": {
                "status": {"name": "Done"}
            },
            "Description/Text": {
                "rich_text": [{"text": {"content": build_description_field(token)}}]
            }
        }
    }

    # Add owner relation
    if owner_id:
        page_data["properties"]["Owner"] = {
            "relation": [{"id": owner_id}]
        }

    # Add narrative threads
    if token.get("narrative_threads"):
        page_data["properties"]["Narrative Threads"] = {
            "multi_select": [{"name": thread} for thread in token["narrative_threads"]]
        }

    # Add timeline event relation
    if token.get("timeline_event"):
        page_data["properties"]["Timeline Event"] = {
            "relation": [{"id": token["timeline_event"]}]
        }

    # Create page
    resp = requests.post(
        "https://api.notion.com/v1/pages",
        headers=headers,
        json=page_data
    )

    if resp.status_code != 200:
        print(f"  ✗ Failed to create element: {resp.text}")
        return None

    created_page = resp.json()
    print(f"  ✓ Created element: {created_page['id']}")
    print(f"    Token ID: {token['SF_RFID']}")
    print(f"    Value: {token['SF_ValueRating']} ({token['SF_MemoryType']})")
    if token.get('SF_Group'):
        print(f"    Group: {token['SF_Group']}")

    return created_page["id"]

def archive_draft(draft):
    """Archive completed draft to archive directory"""
    archive_dir = CACHE_ROOT / "work-session/archive"
    archive_dir.mkdir(parents=True, exist_ok=True)

    session_id = draft.get("session_id", "unknown")
    archive_path = archive_dir / f"{session_id}.json"

    with open(archive_path, 'w') as f:
        json.dump(draft, f, indent=2)

    print(f"\n✓ Archived session to: {archive_path}")

def main():
    print("=" * 70)
    print("Pushing Tokens to Notion")
    print("=" * 70)

    # Load draft
    print("\nLoading draft.json...")
    draft = load_draft()

    session_id = draft.get("session_id", "unknown")
    focus = draft.get("focus", "No focus specified")

    print(f"✓ Loaded session: {session_id}")
    print(f"  Focus: {focus}")

    # Filter approved tokens
    all_tokens = draft.get("tokens", [])
    approved_tokens = [t for t in all_tokens if t.get("status") == "approved"]

    print(f"\nTokens in session:")
    print(f"  Total: {len(all_tokens)}")
    print(f"  Approved: {len(approved_tokens)}")
    print(f"  In progress: {len([t for t in all_tokens if t.get('status') == 'in_progress'])}")
    print(f"  Concept: {len([t for t in all_tokens if t.get('status') == 'concept'])}")

    if len(approved_tokens) == 0:
        print("\n⚠ No approved tokens found. Nothing to sync.")
        print("\nUse the token-generator skill to approve tokens:")
        print("  /token-generator")
        exit(0)

    # Load character lookup
    print("\nLoading character lookup...")
    char_lookup = load_character_lookup()
    print(f"✓ Loaded {len(char_lookup)} characters")

    # Confirm with user
    print("\n" + "=" * 70)
    print(f"Ready to create {len(approved_tokens)} Notion elements")
    print("=" * 70)

    for i, token_data in enumerate(approved_tokens, 1):
        token = token_data["token"]
        print(f"\n{i}. {token['notion_element_name']}")
        print(f"   Token ID: {token['SF_RFID']}")
        print(f"   POV: {token.get('character_pov', 'N/A')}")

    response = input("\nProceed with creation? (yes/no): ").strip().lower()

    if response not in ['yes', 'y']:
        print("\nAborted. No changes made to Notion.")
        exit(0)

    # Process tokens
    print("\n" + "=" * 70)
    print("Creating Notion Elements")
    print("=" * 70)

    created_count = 0
    failed_count = 0
    timeline_events_created = []

    for token_data in approved_tokens:
        token = token_data["token"]

        # Check if we need to create timeline event first
        if token.get("timeline_event_needed"):
            event_details = token["timeline_event_needed"]
            event_id = create_timeline_event(event_details)

            if event_id:
                # Update token to reference new event
                token["timeline_event"] = event_id
                timeline_events_created.append(event_id)
            else:
                print(f"  ⚠ Failed to create timeline event, proceeding without it")

        # Create element
        element_id = create_notion_element(token, char_lookup)

        if element_id:
            created_count += 1
        else:
            failed_count += 1

    # Summary
    print("\n" + "=" * 70)
    print("Sync Complete")
    print("=" * 70)

    print(f"\n✓ Created {created_count} Notion elements")
    if timeline_events_created:
        print(f"✓ Created {len(timeline_events_created)} timeline events")
    if failed_count > 0:
        print(f"✗ Failed to create {failed_count} elements")

    # Archive draft
    if created_count > 0:
        response = input("\nArchive this session? (yes/no): ").strip().lower()

        if response in ['yes', 'y']:
            archive_draft(draft)

            # Clear draft.json
            with open(DRAFT_PATH, 'w') as f:
                json.dump({
                    "session_id": f"session-{datetime.utcnow().strftime('%Y-%m-%d-%H%M')}",
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "focus": "",
                    "tokens": []
                }, f, indent=2)

            print("✓ Cleared draft.json for next session")

    # Next steps
    print("\n" + "=" * 70)
    print("Next Steps")
    print("=" * 70)
    print("\n1. Generate NeurAI display images and update tokens.json:")
    print("   python3 scripts/sync_notion_to_tokens.py")
    print("\n2. Refresh knowledge graph for token-generator:")
    print("   python3 scripts/sync_notion_for_token_gen.py")
    print("\n3. Commit to git:")
    print("   git add ALN-TokenData/tokens.json")
    print("   git commit -m 'feat: add new memory tokens'")
    print("   git push")

if __name__ == "__main__":
    main()
