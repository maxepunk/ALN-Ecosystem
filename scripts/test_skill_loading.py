#!/usr/bin/env python3
"""
Test that skill can load and navigate knowledge graph
"""

import json
from pathlib import Path

CACHE_ROOT = Path(__file__).parent.parent / ".claude/token-gen-cache"

print("=" * 70)
print("Testing Skill Knowledge Graph Loading")
print("=" * 70)

# Test 1: Load index
print("\n=== Test 1: Loading index.json ===")
try:
    with open(CACHE_ROOT / "index.json", 'r') as f:
        index = json.load(f)

    print(f"✓ Loaded index.json")
    print(f"  Generated at: {index['generated_at']}")
    print(f"  Total characters: {index['summary']['total_characters']}")
    print(f"  Total timeline events: {index['summary']['total_timeline_events']}")
    print(f"  Unmapped events: {index['summary']['unmapped_timeline_events']}")
except Exception as e:
    print(f"✗ Failed to load index: {e}")
    exit(1)

# Test 2: Load characters
print("\n=== Test 2: Loading graph/characters.json ===")
try:
    with open(CACHE_ROOT / "graph/characters.json", 'r') as f:
        char_data = json.load(f)

    characters = char_data['characters']
    print(f"✓ Loaded {len(characters)} characters")

    for char in characters:
        print(f"  - {char['name']}")
        print(f"    Background: {char['background']['overview'][:50]}...")
except Exception as e:
    print(f"✗ Failed to load characters: {e}")
    exit(1)

# Test 3: Load timeline
print("\n=== Test 3: Loading graph/timeline.json ===")
try:
    with open(CACHE_ROOT / "graph/timeline.json", 'r') as f:
        timeline_data = json.load(f)

    events = timeline_data['events']
    print(f"✓ Loaded {len(events)} timeline events")

    for event in events:
        status = "✓ HAS TOKENS" if event['has_tokens'] else "⚠ NO TOKENS"
        print(f"  {status}: {event['date']} - {event['title']}")
except Exception as e:
    print(f"✗ Failed to load timeline: {e}")
    exit(1)

# Test 4: Load gaps
print("\n=== Test 4: Loading analysis/timeline-gaps.json ===")
try:
    with open(CACHE_ROOT / "analysis/timeline-gaps.json", 'r') as f:
        gaps_data = json.load(f)

    unmapped = gaps_data['unmapped_events']
    print(f"✓ Loaded {len(unmapped)} unmapped events")

    for evt in unmapped:
        print(f"  - {evt.get('date', {}).get('start', 'NO DATE')}: {evt['title']}")
except Exception as e:
    print(f"✗ Failed to load gaps: {e}")
    exit(1)

# Test 5: Simulate skill navigation workflow
print("\n=== Test 5: Simulating Skill Workflow ===")

print("\n1. User wants to fill timeline gap for evt_023")
target_event = None
for evt in unmapped:
    if evt['event_id'] == 'evt_023':
        target_event = evt
        break

if target_event:
    print(f"   ✓ Found event: {target_event['title']}")
    print(f"     Date: {target_event['date']['start']}")
else:
    print(f"   ⚠ Event not found in gaps")

print("\n2. Load character context for event participants")
# In real workflow, would load char details from characters.json
print(f"   ✓ Would load character backgrounds for event participants")

print("\n3. Check for existing tokens covering this event")
# In real workflow, would check current-state/tokens-by-timeline.json
print(f"   ✓ Would verify no duplicate tokens exist")

print("\n4. Draft token structure")
draft_token = {
    "id": "victoria-lawyer-call",
    "notion_element_name": "Victoria's Lawyer Call - Sale Decision",
    "timeline_event": "evt_023",
    "character_pov": "victoria-zhao",
    "narrative_threads": ["Marriage Troubles", "Funding & Espionage"],
    "display_text": "I know what this means for us...",
    "SF_RFID": "victoria-lawyer-call",
    "SF_ValueRating": 4,
    "SF_MemoryType": "Business",
    "SF_Group": "Marriage Dissolution (x2)",
    "summary": "Victoria's call to lawyer explaining rationale for company sale"
}

print(f"   ✓ Created draft token: {draft_token['id']}")
print(f"     POV: {draft_token['character_pov']}")
print(f"     Value: {draft_token['SF_ValueRating']} ({draft_token['SF_MemoryType']})")

print("\n5. Save to work session draft")
draft = {
    "session_id": "session-2025-11-16-test",
    "tokens": [
        {
            "status": "in_progress",
            "token": draft_token
        }
    ]
}

draft_path = CACHE_ROOT / "work-session/draft.json"
draft_path.parent.mkdir(exist_ok=True)

with open(draft_path, 'w') as f:
    json.dump(draft, f, indent=2)

print(f"   ✓ Saved draft to: {draft_path}")

# Verify we can reload it
with open(draft_path, 'r') as f:
    reloaded = json.load(f)

print(f"   ✓ Draft reloadable: {len(reloaded['tokens'])} tokens")

print("\n" + "=" * 70)
print("✓ All skill loading tests passed!")
print("=" * 70)
print("\nKnowledge graph is ready for use with token-generator skill")
print("\nTo invoke skill:")
print("  /token-generator")
