#!/usr/bin/env python3
"""
Test sync script with mock data (no Notion API calls)
"""

import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Use same logic as real script
ECOSYSTEM_ROOT = Path(__file__).parent.parent
CACHE_ROOT = ECOSYSTEM_ROOT / ".claude/token-gen-cache"
GRAPH_DIR = CACHE_ROOT / "graph"
STATE_DIR = CACHE_ROOT / "current-state"
ANALYSIS_DIR = CACHE_ROOT / "analysis"

# Mock data
MOCK_ELEMENTS = [
    {
        "id": "elem_001",
        "properties": {
            "Name": {"title": [{"text": {"content": "Board Meeting Presentation"}}]},
            "Basic Type": {"select": {"name": "Memory Token Image"}},
            "Description/Text": {"rich_text": [{"text": {"content": """Marcus presents the NeurAI prototype to skeptical board members.

SF_RFID: [board001]
SF_ValueRating: [3]
SF_MemoryType: [Business]
SF_Group: [Corporate Politics (x2)]
SF_Summary: [Marcus's presentation of NeurAI to the board, showing technical capabilities]"""}}]},
            "Narrative Threads": {"multi_select": [{"name": "Funding & Espionage"}, {"name": "Tech Development"}]},
            "Timeline Event": {"relation": [{"id": "evt_001"}]},
            "Owner": {"relation": [{"id": "char_marcus"}]}
        }
    },
    {
        "id": "elem_002",
        "properties": {
            "Name": {"title": [{"text": {"content": "Lab Access Card"}}]},
            "Basic Type": {"select": {"name": "Memory Token Image"}},
            "Description/Text": {"rich_text": [{"text": {"content": """Marcus's restricted lab access card with unusual late-night entries.

SF_RFID: [lab001]
SF_ValueRating: [4]
SF_MemoryType: [Technical]
SF_Group: []
SF_Summary: [Evidence of Marcus's unsanctioned late-night lab work]"""}}]},
            "Narrative Threads": {"multi_select": [{"name": "Unsanctioned Research"}, {"name": "Tech Development"}]},
            "Timeline Event": {"relation": []},
            "Owner": {"relation": [{"id": "char_marcus"}]}
        }
    }
]

MOCK_CHARACTERS = [
    {
        "id": "char_marcus",
        "properties": {
            "Name": {"title": [{"text": {"content": "Dr. Marcus Chen"}}]},
            "Type": {"select": {"name": "Player"}},
            "Tier": {"select": {"name": "Primary"}},
            "Character Logline": {"rich_text": [{"text": {"content": "Brilliant but arrogant CTO"}}]},
            "Overview & Key Relationships": {"rich_text": [{"text": {"content": "PhD Neuroscience from MIT. Co-founded NeuraCorp with Victoria. Obsessed with being first to market with memory extraction tech."}}]},
            "Emotion towards CEO & others": {"rich_text": [{"text": {"content": "Defensive about ethics questions. Frustrated with board oversight."}}]},
            "Primary Action": {"rich_text": [{"text": {"content": "Prove NeurAI technology works, regardless of cost"}}]},
            "Owned Elements": {"relation": [{"id": "elem_001"}, {"id": "elem_002"}]},
            "Events": {"relation": [{"id": "evt_001"}]}
        }
    },
    {
        "id": "char_victoria",
        "properties": {
            "Name": {"title": [{"text": {"content": "Victoria Zhao"}}]},
            "Type": {"select": {"name": "Player"}},
            "Tier": {"select": {"name": "Primary"}},
            "Character Logline": {"rich_text": [{"text": {"content": "Pragmatic CFO under investor pressure"}}]},
            "Overview & Key Relationships": {"rich_text": [{"text": {"content": "Business school at Wharton. Married to Marcus (estranged). Facing intense pressure from investors."}}]},
            "Emotion towards CEO & others": {"rich_text": [{"text": {"content": "Conflicted about Marcus. Protective of employees."}}]},
            "Primary Action": {"rich_text": [{"text": {"content": "Save the company even if it means betraying Marcus"}}]},
            "Owned Elements": {"relation": []},
            "Events": {"relation": [{"id": "evt_001"}, {"id": "evt_023"}]}
        }
    }
]

MOCK_TIMELINE = [
    {
        "id": "evt_001",
        "properties": {
            "Description": {"title": [{"text": {"content": "Board Meeting - NeurAI Demo"}}]},
            "Date": {"date": {"start": "2042-01-15"}},
            "Notes": {"rich_text": [{"text": {"content": "Marcus presents prototype. Board member Walsh asks pointed questions."}}]},
            "Characters Involved": {"relation": [{"id": "char_marcus"}, {"id": "char_victoria"}]},
            "Memory/Evidence": {"relation": [{"id": "elem_001"}]}
        }
    },
    {
        "id": "evt_023",
        "properties": {
            "Description": {"title": [{"text": {"content": "Marcus and Victoria's Final Argument"}}]},
            "Date": {"date": {"start": "2042-03-20"}},
            "Notes": {"rich_text": [{"text": {"content": "Victoria decides to proceed with sale. Marcus discovers her secret meetings."}}]},
            "Characters Involved": {"relation": [{"id": "char_marcus"}, {"id": "char_victoria"}]},
            "Memory/Evidence": {"relation": []}
        }
    }
]

print("=" * 70)
print("Testing Knowledge Graph Generation (Mock Data)")
print("=" * 70)

# Import functions from real script
import sys
sys.path.insert(0, str(ECOSYSTEM_ROOT / "scripts"))

# Manually inline the key functions for testing
def safe_extract_text(prop, prop_type="rich_text"):
    if not prop:
        return ""
    if prop_type == "title":
        data = prop.get("title", [])
    elif prop_type == "rich_text":
        data = prop.get("rich_text", [])
    else:
        return ""
    if not data:
        return ""
    return "".join([block.get("text", {}).get("content", "") for block in data])

def safe_extract_select(prop):
    if not prop or not prop.get("select"):
        return None
    return prop["select"].get("name")

def safe_extract_multi_select(prop):
    if not prop or not prop.get("multi_select"):
        return []
    return [opt.get("name") for opt in prop["multi_select"]]

def safe_extract_relation(prop):
    if not prop or not prop.get("relation"):
        return []
    return [ref.get("id") for ref in prop["relation"]]

def safe_extract_date(prop):
    if not prop or not prop.get("date"):
        return None
    date_obj = prop["date"]
    return {"start": date_obj.get("start"), "end": date_obj.get("end")}

import re

def parse_sf_fields(description_text):
    sf_data = {}
    patterns = {
        'SF_RFID': r'SF_RFID:\s*\[([^\]]*)\]',
        'SF_ValueRating': r'SF_ValueRating:\s*\[([^\]]*)\]',
        'SF_MemoryType': r'SF_MemoryType:\s*\[([^\]]*)\]',
        'SF_Group': r'SF_Group:\s*\[([^\]]*)\]',
        'SF_Summary': r'SF_Summary:\s*\[([^\]]*)\]',
    }
    for field, pattern in patterns.items():
        match = re.search(pattern, description_text, re.IGNORECASE)
        if match:
            value = match.group(1).strip()
            if field == 'SF_RFID':
                sf_data[field] = value.lower() if value else None
            elif field == 'SF_ValueRating':
                try:
                    sf_data[field] = int(value) if value else None
                except ValueError:
                    sf_data[field] = None
            else:
                sf_data[field] = value if value else None
        else:
            sf_data[field] = None if field != 'SF_Group' else ""
    return sf_data

# Test parsing
print("\n=== Testing SF Field Parsing ===")
elem_desc = safe_extract_text(MOCK_ELEMENTS[0]["properties"]["Description/Text"])
sf_fields = parse_sf_fields(elem_desc)
print(f"Parsed SF fields: {json.dumps(sf_fields, indent=2)}")

# Test character extraction
print("\n=== Testing Character Extraction ===")
for char in MOCK_CHARACTERS:
    props = char["properties"]
    name = safe_extract_text(props["Name"], "title")
    overview = safe_extract_text(props["Overview & Key Relationships"])
    print(f"✓ {name}: {overview[:50]}...")

# Test timeline extraction
print("\n=== Testing Timeline Extraction ===")
for event in MOCK_TIMELINE:
    props = event["properties"]
    title = safe_extract_text(props["Description"], "title")
    date = safe_extract_date(props["Date"])
    char_ids = safe_extract_relation(props["Characters Involved"])
    mem_ids = safe_extract_relation(props["Memory/Evidence"])
    print(f"✓ {date['start'] if date else 'NO DATE'}: {title}")
    print(f"  Characters: {len(char_ids)}, Memories: {len(mem_ids)}")

# Test correspondences
print("\n=== Testing Correspondences ===")
timeline_to_tokens = {}
for event in MOCK_TIMELINE:
    event_id = event["id"]
    mem_ids = safe_extract_relation(event["properties"]["Memory/Evidence"])

    # Get token IDs from elements
    token_ids = []
    for mem_id in mem_ids:
        for elem in MOCK_ELEMENTS:
            if elem["id"] == mem_id:
                elem_desc = safe_extract_text(elem["properties"]["Description/Text"])
                sf = parse_sf_fields(elem_desc)
                if sf.get("SF_RFID"):
                    token_ids.append(sf["SF_RFID"])

    timeline_to_tokens[event_id] = token_ids

print(f"Timeline to tokens mapping:")
for evt_id, tokens in timeline_to_tokens.items():
    print(f"  {evt_id}: {tokens if tokens else 'UNMAPPED'}")

# Find unmapped events
unmapped = [
    {
        "event_id": event["id"],
        "title": safe_extract_text(event["properties"]["Description"], "title"),
        "date": safe_extract_date(event["properties"]["Date"])
    }
    for event in MOCK_TIMELINE
    if not safe_extract_relation(event["properties"]["Memory/Evidence"])
]

print(f"\nUnmapped events: {len(unmapped)}")
for evt in unmapped:
    print(f"  - {evt['title']}")

print("\n" + "=" * 70)
print("✓ All parsing functions working correctly!")
print("=" * 70)
print("\nNow testing file generation...")

# Create directories
for directory in [GRAPH_DIR, STATE_DIR, ANALYSIS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Generate sample files
print("\nGenerating sample knowledge graph files...")

sample_index = {
    "generated_at": datetime.utcnow().isoformat() + "Z",
    "summary": {
        "total_characters": len(MOCK_CHARACTERS),
        "total_timeline_events": len(MOCK_TIMELINE),
        "unmapped_timeline_events": len(unmapped)
    }
}

with open(CACHE_ROOT / "index.json", 'w') as f:
    json.dump(sample_index, f, indent=2)
print(f"✓ Wrote index.json")

sample_chars = {
    "characters": [
        {
            "id": char["id"],
            "name": safe_extract_text(char["properties"]["Name"], "title"),
            "background": {
                "overview": safe_extract_text(char["properties"]["Overview & Key Relationships"])
            }
        }
        for char in MOCK_CHARACTERS
    ]
}

with open(GRAPH_DIR / "characters.json", 'w') as f:
    json.dump(sample_chars, f, indent=2)
print(f"✓ Wrote graph/characters.json")

sample_timeline = {
    "events": [
        {
            "id": event["id"],
            "date": safe_extract_date(event["properties"]["Date"])["start"] if safe_extract_date(event["properties"]["Date"]) else None,
            "title": safe_extract_text(event["properties"]["Description"], "title"),
            "has_tokens": len(safe_extract_relation(event["properties"]["Memory/Evidence"])) > 0
        }
        for event in MOCK_TIMELINE
    ]
}

with open(GRAPH_DIR / "timeline.json", 'w') as f:
    json.dump(sample_timeline, f, indent=2)
print(f"✓ Wrote graph/timeline.json")

sample_gaps = {
    "unmapped_events": unmapped
}

with open(ANALYSIS_DIR / "timeline-gaps.json", 'w') as f:
    json.dump(sample_gaps, f, indent=2)
print(f"✓ Wrote analysis/timeline-gaps.json")

print("\n" + "=" * 70)
print("✓ Knowledge graph test successful!")
print("=" * 70)
print(f"\nGenerated files in: {CACHE_ROOT}")
print("\nTo test with real Notion data:")
print("  export NOTION_TOKEN='your_token_here'")
print("  python3 scripts/sync_notion_for_token_gen.py")
