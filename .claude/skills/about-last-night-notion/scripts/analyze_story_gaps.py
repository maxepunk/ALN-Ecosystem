#!/usr/bin/env python3
"""
analyze_story_gaps.py - Analyze story element gaps in About Last Night... databases

This script queries Characters, Timeline, and Elements databases to identify:
1. Timeline events not represented in character descriptions
2. Character background details not represented in narrative elements
3. Timeline events not represented in narrative elements

Usage:
    python analyze_story_gaps.py --output gaps_report.md

Requirements:
    pip install notion-client --break-system-packages
"""

import os
import json
import argparse
import sys
import requests
from typing import Dict, List, Set, Tuple
from collections import defaultdict

# Database IDs
CHARACTERS_DB = "18c2f33d-583f-8060-a6ab-de32ff06bca2"
TIMELINE_DB = "1b52f33d-583f-80de-ae5a-d20020c120dd"
ELEMENTS_DB = "18c2f33d-583f-8020-91bc-d84c7dd94306"

# Memory token types with narrative content
NARRATIVE_TYPES = [
    "Memory Token Image",
    "Memory Token Audio",
    "Memory Token Video",
    "Memory Token Audio + Image",
    "Document"
]


def get_notion_headers():
    """Get Notion API headers with authentication"""
    token = os.environ.get("NOTION_TOKEN")

    if not token:
        print("Error: NOTION_TOKEN environment variable not set")
        print("Please set your Notion integration token:")
        print("  export NOTION_TOKEN='your_token_here'")
        sys.exit(1)

    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }


def safe_get_title(page: Dict, property_name: str) -> str:
    """Safely extract title property"""
    title_array = page["properties"].get(property_name, {}).get("title", [])
    return title_array[0]["text"]["content"] if title_array else ""


def safe_get_text(page: Dict, property_name: str) -> str:
    """Safely extract rich text property"""
    text_array = page["properties"].get(property_name, {}).get("rich_text", [])
    if not text_array:
        return ""
    # Concatenate all text segments
    return "".join([segment["text"]["content"] for segment in text_array])


def safe_get_select(page: Dict, property_name: str) -> str:
    """Safely extract select property"""
    select_obj = page["properties"].get(property_name, {}).get("select")
    return select_obj["name"] if select_obj else ""


def safe_get_date(page: Dict, property_name: str) -> str:
    """Safely extract date property"""
    date_obj = page["properties"].get(property_name, {}).get("date")
    return date_obj["start"] if date_obj else ""


def safe_get_relation(page: Dict, property_name: str) -> List[str]:
    """Safely extract relation property as list of IDs"""
    return [ref["id"] for ref in page["properties"].get(property_name, {}).get("relation", [])]


def fetch_all_characters(headers: Dict) -> Dict[str, Dict]:
    """Fetch all characters and return as dict keyed by page ID"""
    print("Fetching all characters...")
    characters = {}

    # Manual pagination
    has_more = True
    start_cursor = None
    query_data = {}

    while has_more:
        if start_cursor:
            query_data["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{CHARACTERS_DB}/query",
            headers=headers,
            json=query_data
        )
        data = resp.json()

        if "results" not in data:
            print(f"Error fetching characters from Notion: {data}")
            sys.exit(1)

        for char in data["results"]:
            char_id = char["id"]
            characters[char_id] = {
                "id": char_id,
                "name": safe_get_title(char, "Name"),
                "type": safe_get_select(char, "Type"),
                "tier": safe_get_select(char, "Tier"),
                "logline": safe_get_text(char, "Character Logline"),
                "overview": safe_get_text(char, "Overview & Key Relationships"),
                "emotion": safe_get_text(char, "Emotion towards CEO & others"),
                "action": safe_get_text(char, "Primary Action"),
                "events": safe_get_relation(char, "Events"),
                "owned_elements": safe_get_relation(char, "Owned Elements"),
                "associated_elements": safe_get_relation(char, "Associated Elements")
            }

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    print(f"Found {len(characters)} characters")
    return characters


def fetch_all_timeline_events(headers: Dict) -> Dict[str, Dict]:
    """Fetch all timeline events and return as dict keyed by page ID"""
    print("Fetching all timeline events...")
    events = {}

    # Manual pagination
    has_more = True
    start_cursor = None
    query_data = {
        "sorts": [{"property": "Date", "direction": "ascending"}]
    }

    while has_more:
        if start_cursor:
            query_data["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{TIMELINE_DB}/query",
            headers=headers,
            json=query_data
        )
        data = resp.json()

        if "results" not in data:
            print(f"Error fetching timeline from Notion: {data}")
            sys.exit(1)

        for event in data["results"]:
            event_id = event["id"]
            events[event_id] = {
                "id": event_id,
                "description": safe_get_title(event, "Description"),
                "date": safe_get_date(event, "Date"),
                "notes": safe_get_text(event, "Notes"),
                "characters": safe_get_relation(event, "Characters Involved"),
                "memory_evidence": safe_get_relation(event, "Memory/Evidence")
            }

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    print(f"Found {len(events)} timeline events")
    return events


def fetch_narrative_elements(headers: Dict) -> Dict[str, Dict]:
    """Fetch all elements with narrative content"""
    print("Fetching narrative elements...")
    elements = {}

    # Build filter for narrative types
    filter_obj = {
        "or": [
            {"property": "Basic Type", "select": {"equals": elem_type}}
            for elem_type in NARRATIVE_TYPES
        ]
    }

    # Manual pagination
    has_more = True
    start_cursor = None
    query_data = {"filter": filter_obj}

    while has_more:
        if start_cursor:
            query_data["start_cursor"] = start_cursor

        resp = requests.post(
            f"https://api.notion.com/v1/databases/{ELEMENTS_DB}/query",
            headers=headers,
            json=query_data
        )
        data = resp.json()

        if "results" not in data:
            print(f"Error fetching elements from Notion: {data}")
            sys.exit(1)

        for element in data["results"]:
            elem_id = element["id"]
            elements[elem_id] = {
                "id": elem_id,
                "name": safe_get_title(element, "Name"),
                "basic_type": safe_get_select(element, "Basic Type"),
                "status": safe_get_select(element, "Status"),
                "description": safe_get_text(element, "Description/Text"),
                "owner": safe_get_relation(element, "Owner"),
                "timeline_event": safe_get_relation(element, "Timeline Event"),
                "narrative_threads": [opt["name"] for opt in element["properties"].get("Narrative Threads", {}).get("multi_select", [])]
            }

        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")

    print(f"Found {len(elements)} narrative elements")
    return elements


def analyze_timeline_not_in_characters(
    characters: Dict[str, Dict],
    timeline: Dict[str, Dict]
) -> Dict[str, List[Dict]]:
    """Find timeline events not mentioned in character descriptions"""
    print("\nAnalyzing timeline events not in character descriptions...")

    gaps = defaultdict(list)

    for event_id, event in timeline.items():
        # For each character involved in the event
        for char_id in event["characters"]:
            if char_id not in characters:
                continue

            char = characters[char_id]

            # Check if event description appears in character's text fields
            event_desc = event["description"].lower()
            event_notes = event["notes"].lower()

            # Search in all character text fields
            char_text = (
                char["logline"] + " " +
                char["overview"] + " " +
                char["emotion"] + " " +
                char["action"]
            ).lower()

            # Simple keyword search - check if key terms from event appear
            # Extract key terms (words longer than 3 chars, excluding common words)
            event_keywords = set()
            for word in event_desc.split():
                if len(word) > 3 and word not in ["the", "and", "with", "from", "that", "this", "their", "they", "have", "been"]:
                    event_keywords.add(word)

            # Check if any keywords appear in character text
            keywords_found = any(keyword in char_text for keyword in event_keywords)

            if not keywords_found and event["description"]:
                gaps[char_id].append({
                    "event_id": event_id,
                    "event_description": event["description"],
                    "date": event["date"],
                    "notes": event["notes"]
                })

    return gaps


def analyze_timeline_not_in_elements(
    timeline: Dict[str, Dict],
    elements: Dict[str, Dict]
) -> List[Dict]:
    """Find timeline events without associated narrative elements"""
    print("\nAnalyzing timeline events without narrative elements...")

    unrepresented_events = []

    for event_id, event in timeline.items():
        # Check if event has any memory/evidence elements
        if not event["memory_evidence"]:
            unrepresented_events.append({
                "event_id": event_id,
                "description": event["description"],
                "date": event["date"],
                "notes": event["notes"],
                "characters": [event_id for event_id in event["characters"]]
            })

    print(f"Found {len(unrepresented_events)} timeline events without narrative elements")
    return unrepresented_events


def analyze_character_details_not_in_elements(
    characters: Dict[str, Dict],
    elements: Dict[str, Dict]
) -> Dict[str, List[str]]:
    """Find character background details not in narrative elements"""
    print("\nAnalyzing character details not in narrative elements...")

    gaps = defaultdict(list)

    for char_id, char in characters.items():
        # Get all elements owned by or associated with this character
        char_element_ids = set(char["owned_elements"] + char["associated_elements"])

        # Collect all text from character's elements
        element_text = ""
        for elem_id in char_element_ids:
            if elem_id in elements:
                element_text += " " + elements[elem_id]["description"].lower()

        # Check character overview for details
        overview = char["overview"]
        if overview:
            # Split into sentences or key phrases
            sentences = overview.split(". ")

            for sentence in sentences:
                if len(sentence.strip()) > 20:  # Ignore very short fragments
                    # Check if sentence keywords appear in any element
                    sentence_keywords = set()
                    for word in sentence.lower().split():
                        if len(word) > 4:
                            sentence_keywords.add(word)

                    keywords_found = any(keyword in element_text for keyword in sentence_keywords)

                    if not keywords_found:
                        gaps[char_id].append(sentence.strip())

    return gaps


def generate_report(
    characters: Dict[str, Dict],
    timeline: Dict[str, Dict],
    elements: Dict[str, Dict],
    timeline_gaps: Dict[str, List[Dict]],
    element_gaps: Dict[str, List[str]],
    unrepresented_events: List[Dict]
) -> str:
    """Generate a markdown report of all gaps"""

    lines = []
    lines.append("# About Last Night... Story Element Gaps Analysis\n")
    lines.append("This report identifies story elements that need to be created to fully tell the story.\n")
    lines.append("---\n\n")

    # Section 1: Timeline events without elements
    lines.append("## Timeline Events Without Narrative Elements\n")
    lines.append("These events exist in the timeline but have no associated memory tokens or documents.\n\n")

    if unrepresented_events:
        for event in unrepresented_events:
            lines.append(f"### {event['description']}\n")
            lines.append(f"- **Date:** {event['date']}\n")
            if event['notes']:
                lines.append(f"- **Notes:** {event['notes']}\n")
            lines.append(f"- **Characters Involved:** {len(event['characters'])} character(s)\n")
            lines.append("\n")
    else:
        lines.append("✓ All timeline events have associated elements!\n\n")

    lines.append("---\n\n")

    # Section 2: Character-by-character gaps
    lines.append("## Character-by-Character Analysis\n")
    lines.append("For each character, this section shows:\n")
    lines.append("1. Timeline events they're involved in but not mentioned in their character description\n")
    lines.append("2. Character background details not represented in any narrative element\n\n")

    # Sort characters by tier and name
    tier_order = {"Primary": 0, "Core": 1, "Secondary": 2, "Tertiary": 3}
    sorted_chars = sorted(
        characters.values(),
        key=lambda c: (tier_order.get(c["tier"], 99), c["name"])
    )

    for char in sorted_chars:
        char_id = char["id"]

        # Check if this character has any gaps
        has_timeline_gaps = char_id in timeline_gaps and timeline_gaps[char_id]
        has_element_gaps = char_id in element_gaps and element_gaps[char_id]

        if not has_timeline_gaps and not has_element_gaps:
            continue  # Skip characters with no gaps

        lines.append(f"### {char['name']}\n")
        lines.append(f"**Type:** {char['type']} | **Tier:** {char['tier']}\n\n")

        if char['logline']:
            lines.append(f"*{char['logline']}*\n\n")

        # Timeline gaps
        if has_timeline_gaps:
            lines.append("#### Timeline Events Not in Character Description\n\n")
            for event_data in timeline_gaps[char_id]:
                lines.append(f"- **{event_data['date']}:** {event_data['event_description']}\n")
                if event_data['notes']:
                    lines.append(f"  - *Notes:* {event_data['notes']}\n")
            lines.append("\n")

        # Element gaps
        if has_element_gaps:
            lines.append("#### Character Details Not in Narrative Elements\n\n")
            for detail in element_gaps[char_id][:10]:  # Limit to first 10
                lines.append(f"- {detail}\n")
            if len(element_gaps[char_id]) > 10:
                lines.append(f"- *...and {len(element_gaps[char_id]) - 10} more details*\n")
            lines.append("\n")

        lines.append("---\n\n")

    # Summary statistics
    lines.append("## Summary Statistics\n\n")
    lines.append(f"- **Total Characters:** {len(characters)}\n")
    lines.append(f"- **Total Timeline Events:** {len(timeline)}\n")
    lines.append(f"- **Total Narrative Elements:** {len(elements)}\n")
    lines.append(f"- **Characters with Gaps:** {len(set(list(timeline_gaps.keys()) + list(element_gaps.keys())))}\n")
    lines.append(f"- **Timeline Events Without Elements:** {len(unrepresented_events)}\n")

    return "".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Analyze story element gaps in About Last Night... databases"
    )
    parser.add_argument(
        "--output",
        default="gaps_report.md",
        help="Output file path (default: gaps_report.md)"
    )

    args = parser.parse_args()

    # Get Notion API headers
    headers = get_notion_headers()

    # Fetch all data
    characters = fetch_all_characters(headers)
    timeline = fetch_all_timeline_events(headers)
    elements = fetch_narrative_elements(headers)

    # Analyze gaps
    timeline_gaps = analyze_timeline_not_in_characters(characters, timeline)
    unrepresented_events = analyze_timeline_not_in_elements(timeline, elements)
    element_gaps = analyze_character_details_not_in_elements(characters, elements)

    # Generate report
    print("\nGenerating report...")
    report = generate_report(
        characters,
        timeline,
        elements,
        timeline_gaps,
        element_gaps,
        unrepresented_events
    )

    # Write to file
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\n✓ Analysis complete! Report written to {args.output}")
    print("\nNext steps:")
    print("1. Review the report to understand gaps")
    print("2. Create new Elements for unrepresented timeline events")
    print("3. Add narrative content to existing Elements for character details")
    print("4. Update character descriptions to reference timeline events")


if __name__ == "__main__":
    main()
