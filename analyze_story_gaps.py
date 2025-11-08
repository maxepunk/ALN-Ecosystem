#!/usr/bin/env python3
"""
Analyze gaps in About Last Night story elements.

This script:
1. Fetches all characters and their descriptions
2. Fetches all timeline events
3. Fetches all elements with narrative content
4. Identifies gaps where timeline events or character details aren't represented in elements
"""

import json
import os
from notion_client import Client
from pathlib import Path

# Load environment variables from .env file if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # dotenv not installed, will use system environment variables
    pass

# Configuration
NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
if not NOTION_TOKEN:
    print("Error: NOTION_TOKEN not found")
    print("Please either:")
    print("  1. Add NOTION_TOKEN to .env file in project root, OR")
    print("  2. Set environment variable: export NOTION_TOKEN='your_token_here'")
    exit(1)

NOTION_VERSION = "2022-06-28"

# Database IDs
ELEMENTS_DB_ID = "18c2f33d583f802091bcd84c7dd94306"
CHARACTERS_DB_ID = "18c2f33d583f8060a6abde32ff06bca2"
PUZZLES_DB_ID = "1b62f33d583f80cc87cfd7d6c4b0b265"
TIMELINE_DB_ID = "1b52f33d583f80deae5ad20020c120dd"

# Initialize client
notion = Client(auth=NOTION_TOKEN, notion_version=NOTION_VERSION)

def safe_get_text(prop_data, prop_type="title"):
    """Safely extract text from Notion property."""
    try:
        if prop_type == "title":
            if prop_data.get("title") and len(prop_data["title"]) > 0:
                return prop_data["title"][0]["text"]["content"]
        elif prop_type == "rich_text":
            if prop_data.get("rich_text") and len(prop_data["rich_text"]) > 0:
                return " ".join([block["text"]["content"] for block in prop_data["rich_text"]])
        elif prop_type == "select":
            if prop_data.get("select"):
                return prop_data["select"]["name"]
        elif prop_type == "multi_select":
            if prop_data.get("multi_select"):
                return [opt["name"] for opt in prop_data["multi_select"]]
        elif prop_type == "date":
            if prop_data.get("date"):
                return prop_data["date"]["start"]
        elif prop_type == "relation":
            if prop_data.get("relation"):
                return [rel["id"] for rel in prop_data["relation"]]
    except (KeyError, IndexError, TypeError):
        pass
    return None

def fetch_all_characters():
    """Fetch all characters from the Characters database."""
    print("Fetching characters...")
    characters = []
    has_more = True
    start_cursor = None

    while has_more:
        body = {}
        if start_cursor:
            body["start_cursor"] = start_cursor

        response = notion.request(
            path=f"databases/{CHARACTERS_DB_ID}/query",
            method="POST",
            body=body
        )

        for page in response["results"]:
            props = page["properties"]

            character = {
                "id": page["id"],
                "name": safe_get_text(props.get("Name", {}), "title") or "Unnamed",
                "description": safe_get_text(props.get("Description", {}), "rich_text"),
                "character_type": safe_get_text(props.get("Character Type", {}), "select"),
                "role": safe_get_text(props.get("Role", {}), "select"),
                "backstory": safe_get_text(props.get("Backstory", {}), "rich_text"),
                "motivations": safe_get_text(props.get("Motivations", {}), "rich_text"),
                "secrets": safe_get_text(props.get("Secrets", {}), "rich_text"),
                "owned_elements": safe_get_text(props.get("Owned Elements", {}), "relation") or [],
                "associated_elements": safe_get_text(props.get("Associated Elements", {}), "relation") or [],
            }

            characters.append(character)

        has_more = response["has_more"]
        start_cursor = response.get("next_cursor")

    print(f"Fetched {len(characters)} characters")
    return characters

def fetch_all_timeline_events():
    """Fetch all timeline events from the Timeline database."""
    print("Fetching timeline events...")
    events = []
    has_more = True
    start_cursor = None

    while has_more:
        body = {
            "sorts": [{"property": "Date", "direction": "ascending"}]
        }
        if start_cursor:
            body["start_cursor"] = start_cursor

        response = notion.request(
            path=f"databases/{TIMELINE_DB_ID}/query",
            method="POST",
            body=body
        )

        for page in response["results"]:
            props = page["properties"]

            event = {
                "id": page["id"],
                "name": safe_get_text(props.get("Event", {}), "title") or "Unnamed Event",
                "date": safe_get_text(props.get("Date", {}), "date"),
                "description": safe_get_text(props.get("Description", {}), "rich_text"),
                "characters_involved": safe_get_text(props.get("Characters Involved", {}), "relation") or [],
                "related_elements": safe_get_text(props.get("Related Elements", {}), "relation") or [],
                "location": safe_get_text(props.get("Location", {}), "rich_text"),
                "significance": safe_get_text(props.get("Significance", {}), "select"),
            }

            events.append(event)

        has_more = response["has_more"]
        start_cursor = response.get("next_cursor")

    print(f"Fetched {len(events)} timeline events")
    return events

def fetch_all_elements():
    """Fetch all elements with narrative content from the Elements database."""
    print("Fetching elements...")
    elements = []
    has_more = True
    start_cursor = None

    while has_more:
        body = {}
        if start_cursor:
            body["start_cursor"] = start_cursor

        response = notion.request(
            path=f"databases/{ELEMENTS_DB_ID}/query",
            method="POST",
            body=body
        )

        for page in response["results"]:
            props = page["properties"]

            element = {
                "id": page["id"],
                "name": safe_get_text(props.get("Name", {}), "title") or "Unnamed",
                "basic_type": safe_get_text(props.get("Basic Type", {}), "select"),
                "description": safe_get_text(props.get("Description", {}), "rich_text"),
                "narrative": safe_get_text(props.get("Narrative", {}), "rich_text"),
                "content": safe_get_text(props.get("Content", {}), "rich_text"),
                "owner": safe_get_text(props.get("Owner", {}), "relation") or [],
                "timeline_event": safe_get_text(props.get("Timeline Event", {}), "relation") or [],
                "tags": safe_get_text(props.get("Tags", {}), "multi_select") or [],
            }

            elements.append(element)

        has_more = response["has_more"]
        start_cursor = response.get("next_cursor")

    print(f"Fetched {len(elements)} elements")
    return elements

def analyze_gaps(characters, timeline_events, elements):
    """Analyze gaps between character/timeline data and elements."""
    print("\nAnalyzing gaps...")

    # Create lookup dictionaries
    char_by_id = {c["id"]: c for c in characters}
    event_by_id = {e["id"]: e for e in timeline_events}

    # Build element coverage maps
    elements_by_character = {}
    elements_by_event = {}

    for element in elements:
        # Track elements associated with each character
        for char_id in element["owner"]:
            if char_id not in elements_by_character:
                elements_by_character[char_id] = []
            elements_by_character[char_id].append(element)

        # Track elements associated with each timeline event
        for event_id in element["timeline_event"]:
            if event_id not in elements_by_event:
                elements_by_event[event_id] = []
            elements_by_event[event_id].append(element)

    # Analyze gaps for each character
    character_gaps = {}

    for character in characters:
        char_id = character["id"]
        char_name = character["name"]

        gaps = {
            "character_name": char_name,
            "character_description": character["description"],
            "backstory": character["backstory"],
            "motivations": character["motivations"],
            "secrets": character["secrets"],
            "elements_owned": len(character["owned_elements"]),
            "elements_associated": len(character["associated_elements"]),
            "timeline_events_involved": [],
            "timeline_events_without_elements": [],
            "character_details_without_elements": [],
        }

        # Find timeline events involving this character
        for event in timeline_events:
            if char_id in event["characters_involved"]:
                event_info = {
                    "event_name": event["name"],
                    "date": event["date"],
                    "description": event["description"],
                    "has_elements": event["id"] in elements_by_event,
                    "element_count": len(elements_by_event.get(event["id"], [])),
                }

                gaps["timeline_events_involved"].append(event_info)

                # Check if this event has no elements
                if not event_info["has_elements"]:
                    gaps["timeline_events_without_elements"].append(event_info)

        # Check if character details are represented in elements
        owned_elements = elements_by_character.get(char_id, [])

        # Combine all narrative content from owned elements
        all_element_narratives = []
        for elem in owned_elements:
            if elem["description"]:
                all_element_narratives.append(elem["description"])
            if elem["narrative"]:
                all_element_narratives.append(elem["narrative"])
            if elem["content"]:
                all_element_narratives.append(elem["content"])

        combined_narrative = " ".join(all_element_narratives).lower()

        # Check if key character details are mentioned in elements
        character_details = {
            "backstory": character["backstory"],
            "motivations": character["motivations"],
            "secrets": character["secrets"],
        }

        for detail_type, detail_content in character_details.items():
            if detail_content and detail_content.strip():
                # Simple check: is any part of this detail mentioned in elements?
                # This is a heuristic - we're checking if key phrases appear
                # In a real analysis, you'd want more sophisticated text matching
                words = detail_content.lower().split()
                significant_words = [w for w in words if len(w) > 5]  # Words longer than 5 chars

                if significant_words:
                    matched = any(word in combined_narrative for word in significant_words[:5])  # Check first 5 significant words
                    if not matched:
                        gaps["character_details_without_elements"].append({
                            "type": detail_type,
                            "content": detail_content[:200] + "..." if len(detail_content) > 200 else detail_content
                        })

        character_gaps[char_name] = gaps

    # Find timeline events not mentioned in character descriptions
    events_not_in_char_descriptions = []

    for event in timeline_events:
        event_has_character_mention = False

        for char_id in event["characters_involved"]:
            character = char_by_id.get(char_id)
            if character:
                # Check if event is mentioned in character's description/backstory
                char_text = " ".join(filter(None, [
                    character.get("description", ""),
                    character.get("backstory", ""),
                    character.get("motivations", ""),
                    character.get("secrets", "")
                ])).lower()

                if event["name"].lower() in char_text:
                    event_has_character_mention = True
                    break

        if not event_has_character_mention and event["characters_involved"]:
            events_not_in_char_descriptions.append({
                "event_name": event["name"],
                "date": event["date"],
                "description": event["description"],
                "characters_involved_names": [
                    char_by_id[cid]["name"] for cid in event["characters_involved"]
                    if cid in char_by_id
                ]
            })

    return character_gaps, events_not_in_char_descriptions

def generate_report(character_gaps, events_not_in_char_descriptions):
    """Generate a formatted report of the gaps."""
    print("\n" + "="*80)
    print("ABOUT LAST NIGHT - STORY ELEMENT GAPS ANALYSIS")
    print("="*80)

    # Section 1: Timeline events not in character descriptions
    if events_not_in_char_descriptions:
        print("\n## TIMELINE EVENTS NOT REPRESENTED IN CHARACTER DESCRIPTIONS")
        print("-" * 80)
        print(f"\nFound {len(events_not_in_char_descriptions)} timeline events that are not mentioned")
        print("in the descriptions of the characters involved:\n")

        for event in events_not_in_char_descriptions:
            print(f"Event: {event['event_name']}")
            print(f"  Date: {event['date']}")
            print(f"  Characters Involved: {', '.join(event['characters_involved_names'])}")
            if event['description']:
                desc = event['description'][:150] + "..." if len(event['description']) > 150 else event['description']
                print(f"  Description: {desc}")
            print()
    else:
        print("\n## TIMELINE EVENTS NOT REPRESENTED IN CHARACTER DESCRIPTIONS")
        print("-" * 80)
        print("\n✓ All timeline events are mentioned in character descriptions!\n")

    # Section 2: Character-by-character gap analysis
    print("\n## CHARACTER-BY-CHARACTER GAP ANALYSIS")
    print("="*80)

    for char_name, gaps in sorted(character_gaps.items()):
        print(f"\n### {char_name.upper()}")
        print("-" * 80)

        # Summary stats
        print(f"Elements owned: {gaps['elements_owned']}")
        print(f"Elements associated: {gaps['elements_associated']}")
        print(f"Timeline events involved in: {len(gaps['timeline_events_involved'])}")

        # Timeline events without elements
        if gaps['timeline_events_without_elements']:
            print(f"\n**Timeline Events WITHOUT Elements ({len(gaps['timeline_events_without_elements'])}):**")
            for event in gaps['timeline_events_without_elements']:
                print(f"  • {event['event_name']}")
                if event['date']:
                    print(f"    Date: {event['date']}")
                if event['description']:
                    desc = event['description'][:150] + "..." if len(event['description']) > 150 else event['description']
                    print(f"    Description: {desc}")
        else:
            print("\n✓ All timeline events have associated elements")

        # Character details without elements
        if gaps['character_details_without_elements']:
            print(f"\n**Character Details NOT Represented in Elements ({len(gaps['character_details_without_elements'])}):**")
            for detail in gaps['character_details_without_elements']:
                print(f"  • {detail['type'].upper()}:")
                print(f"    {detail['content']}")
        else:
            print("\n✓ Character details appear to be represented in elements")

        print()

    print("="*80)
    print("END OF REPORT")
    print("="*80)

def main():
    """Main execution function."""
    try:
        # Fetch all data
        characters = fetch_all_characters()
        timeline_events = fetch_all_timeline_events()
        elements = fetch_all_elements()

        # Analyze gaps
        character_gaps, events_not_in_char_descriptions = analyze_gaps(
            characters, timeline_events, elements
        )

        # Generate report
        generate_report(character_gaps, events_not_in_char_descriptions)

        # Save raw data for further analysis
        output_data = {
            "character_gaps": character_gaps,
            "events_not_in_char_descriptions": events_not_in_char_descriptions,
        }

        with open("/home/user/ALN-Ecosystem/story_gaps_analysis.json", "w") as f:
            json.dump(output_data, f, indent=2)

        print("\n✓ Raw analysis data saved to story_gaps_analysis.json")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
