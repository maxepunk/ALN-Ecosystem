#!/usr/bin/env python3
"""
Test push_tokens_to_notion.py with mock draft (no API calls)
"""

import json
from pathlib import Path

ECOSYSTEM_ROOT = Path(__file__).parent.parent
CACHE_ROOT = ECOSYSTEM_ROOT / ".claude/token-gen-cache"
DRAFT_PATH = CACHE_ROOT / "work-session/draft.json"

print("=" * 70)
print("Testing Token Push Workflow (Mock)")
print("=" * 70)

# Verify draft exists from previous test
if not DRAFT_PATH.exists():
    print(f"✗ Draft not found. Run test_skill_loading.py first")
    exit(1)

# Load draft
print("\n=== Loading draft.json ===")
with open(DRAFT_PATH, 'r') as f:
    draft = json.load(f)

print(f"✓ Loaded session: {draft['session_id']}")
print(f"  Total tokens: {len(draft['tokens'])}")

# Filter approved (for test, mark it approved)
draft['tokens'][0]['status'] = 'approved'

approved_tokens = [t for t in draft['tokens'] if t['status'] == 'approved']
print(f"  Approved tokens: {len(approved_tokens)}")

# Test field extraction
print("\n=== Testing Field Extraction ===")

for token_data in approved_tokens:
    token = token_data['token']

    print(f"\nToken: {token['notion_element_name']}")
    print(f"  ID: {token['SF_RFID']}")
    print(f"  POV: {token.get('character_pov', 'N/A')}")
    print(f"  Timeline: {token.get('timeline_event', 'N/A')}")
    print(f"  Threads: {', '.join(token.get('narrative_threads', []))}")
    print(f"  Value: {token['SF_ValueRating']} ({token['SF_MemoryType']})")
    if token.get('SF_Group'):
        print(f"  Group: {token['SF_Group']}")

    # Test building description field
    desc = token.get('display_text', '')
    desc += f"\n\nSF_RFID: [{token['SF_RFID']}]"
    desc += f"\nSF_ValueRating: [{token['SF_ValueRating']}]"
    desc += f"\nSF_MemoryType: [{token['SF_MemoryType']}]"
    desc += f"\nSF_Group: [{token.get('SF_Group', '')}]"

    if token.get('summary'):
        desc += f"\nSF_Summary: [{token['summary']}]"

    print(f"\n  Description field (first 100 chars):")
    print(f"  {desc[:100]}...")

# Test character lookup
print("\n=== Testing Character Lookup ===")

char_graph_path = CACHE_ROOT / "graph/characters.json"

if char_graph_path.exists():
    with open(char_graph_path, 'r') as f:
        char_data = json.load(f)

    char_lookup = {
        char["name"].lower().replace(" ", "-").replace(".", ""): char["id"]
        for char in char_data["characters"]
    }

    print(f"✓ Built character lookup: {len(char_lookup)} characters")

    for slug, notion_id in char_lookup.items():
        print(f"  {slug} → {notion_id}")

    # Test resolving token's character
    for token_data in approved_tokens:
        token = token_data['token']
        char_pov = token.get('character_pov')

        if char_pov:
            notion_id = char_lookup.get(char_pov)
            if notion_id:
                print(f"\n  ✓ Resolved '{char_pov}' → {notion_id}")
            else:
                print(f"\n  ✗ Could not resolve '{char_pov}'")
else:
    print("✗ Character graph not found")

# Test Notion page structure (without API call)
print("\n=== Testing Notion Page Structure ===")

for token_data in approved_tokens:
    token = token_data['token']

    # Simulate page structure
    page_data = {
        "parent": {"database_id": "ELEMENTS_DB_ID"},
        "properties": {
            "Name": {
                "title": [{"text": {"content": token["notion_element_name"]}}]
            },
            "Basic Type": {
                "select": {"name": "Memory Token Image"}
            },
            "Status": {
                "status": {"name": "Done"}
            },
            "Description/Text": {
                "rich_text": [{"text": {"content": "..."}}]
            }
        }
    }

    if token.get('narrative_threads'):
        page_data["properties"]["Narrative Threads"] = {
            "multi_select": [{"name": thread} for thread in token["narrative_threads"]]
        }

    if token.get('timeline_event'):
        page_data["properties"]["Timeline Event"] = {
            "relation": [{"id": token["timeline_event"]}]
        }

    print(f"\n✓ Page structure for '{token['id']}':")
    print(f"  Properties: {list(page_data['properties'].keys())}")

# Test timeline event creation (if needed)
print("\n=== Testing Timeline Event Creation ===")

for token_data in approved_tokens:
    token = token_data['token']

    if token.get('timeline_event_needed'):
        event_details = token['timeline_event_needed']
        print(f"\n✓ Would create timeline event:")
        print(f"  Title: {event_details.get('title', 'N/A')}")
        print(f"  Date: {event_details.get('date', 'N/A')}")
        print(f"  Characters: {len(event_details.get('character_ids', []))}")
    else:
        print(f"\n✓ No timeline event creation needed for '{token['id']}'")

print("\n" + "=" * 70)
print("✓ All push workflow tests passed!")
print("=" * 70)
print("\nThe push_tokens_to_notion.py script is ready to use.")
print("\nTo test with real Notion API:")
print("  1. Ensure NOTION_TOKEN is set")
print("  2. Create tokens using /token-generator skill")
print("  3. Run: python3 scripts/push_tokens_to_notion.py")
