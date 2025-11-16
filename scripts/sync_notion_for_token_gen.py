#!/usr/bin/env python3
"""
Sync Notion databases to token generation knowledge graph

This script builds a comprehensive, denormalized knowledge graph optimized
for AI agent navigation during interactive token creation sessions.

Fetches from:
- Elements database (existing tokens + all game elements)
- Characters database (complete backgrounds, relationships, arcs)
- Timeline database (chronological events with character POVs)

Outputs to .claude/token-gen-cache/:
- graph/ - Denormalized nodes (characters, timeline, narrative threads)
- current-state/ - Existing tokens organized by various axes
- analysis/ - Gap analysis, balance metrics, duplicate risks
- index.json - Master navigation file
"""

import requests
import json
import os
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Load environment variables from .env file if present
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
    print("Please either:")
    print("  1. Add NOTION_TOKEN to .env file in project root, OR")
    print("  2. Set environment variable: export NOTION_TOKEN='your_token_here'")
    exit(1)

# Database IDs
ELEMENTS_DATABASE_ID = "18c2f33d-583f-8020-91bc-d84c7dd94306"
CHARACTERS_DATABASE_ID = "18c2f33d-583f-8060-a6ab-de32ff06bca2"
TIMELINE_DATABASE_ID = "1b52f33d-583f-80de-ae5a-d20020c120dd"

# Output paths
ECOSYSTEM_ROOT = Path(__file__).parent.parent
CACHE_ROOT = ECOSYSTEM_ROOT / ".claude/token-gen-cache"
GRAPH_DIR = CACHE_ROOT / "graph"
STATE_DIR = CACHE_ROOT / "current-state"
ANALYSIS_DIR = CACHE_ROOT / "analysis"
WORK_SESSION_DIR = CACHE_ROOT / "work-session"

# Notion API headers
headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

# Scoring configuration (from backend config)
VALUE_RATING_MAP = {
    1: 100,
    2: 500,
    3: 1000,
    4: 5000,
    5: 10000
}

TYPE_MULTIPLIERS = {
    "Personal": 1.0,
    "Business": 3.0,
    "Technical": 5.0
}

def ensure_directories():
    """Create output directory structure"""
    for directory in [GRAPH_DIR, STATE_DIR, ANALYSIS_DIR, WORK_SESSION_DIR]:
        directory.mkdir(parents=True, exist_ok=True)

def fetch_database_with_pagination(database_id, filter_obj=None, sorts=None):
    """
    Fetch all pages from a Notion database with pagination

    Args:
        database_id: Notion database ID
        filter_obj: Optional filter object
        sorts: Optional sorts array

    Returns:
        List of all pages
    """
    url = f"https://api.notion.com/v1/databases/{database_id}/query"
    all_results = []
    has_more = True
    start_cursor = None

    query_data = {}
    if filter_obj:
        query_data["filter"] = filter_obj
    if sorts:
        query_data["sorts"] = sorts

    while has_more:
        if start_cursor:
            query_data["start_cursor"] = start_cursor

        try:
            resp = requests.post(url, headers=headers, json=query_data)
            resp.raise_for_status()
            data = resp.json()

            if "results" not in data:
                print(f"Error fetching from {database_id}: {data}")
                break

            all_results.extend(data["results"])
            has_more = data.get("has_more", False)
            start_cursor = data.get("next_cursor")

            print(f"  Fetched {len(all_results)} pages so far...")

        except requests.exceptions.RequestException as e:
            print(f"Error fetching from Notion: {e}")
            break

    return all_results

def safe_extract_text(prop, prop_type="rich_text"):
    """Safely extract text from Notion property"""
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

    # Concatenate all text blocks
    return "".join([block.get("text", {}).get("content", "") for block in data])

def safe_extract_select(prop):
    """Safely extract select property"""
    if not prop or not prop.get("select"):
        return None
    return prop["select"].get("name")

def safe_extract_multi_select(prop):
    """Safely extract multi-select property"""
    if not prop or not prop.get("multi_select"):
        return []
    return [opt.get("name") for opt in prop["multi_select"]]

def safe_extract_relation(prop):
    """Safely extract relation property IDs"""
    if not prop or not prop.get("relation"):
        return []
    return [ref.get("id") for ref in prop["relation"]]

def safe_extract_date(prop):
    """Safely extract date property"""
    if not prop or not prop.get("date"):
        return None
    date_obj = prop["date"]
    return {
        "start": date_obj.get("start"),
        "end": date_obj.get("end")
    }

def parse_sf_fields(description_text):
    """
    Parse SF_ fields from element description text

    Returns dict with SF_RFID, SF_ValueRating, SF_MemoryType, SF_Group, SF_Summary
    """
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
            elif field == 'SF_MemoryType':
                sf_data[field] = value if value else None
            elif field == 'SF_Group':
                sf_data[field] = value if value else ""
            elif field == 'SF_Summary':
                sf_data[field] = value if value else None
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
            elif field == 'SF_Summary':
                sf_data[field] = None

    return sf_data

def extract_display_text(description):
    """Extract display text (everything before SF_ fields)"""
    if not description:
        return ""

    sf_start = description.find('SF_')
    if sf_start > 0:
        return description[:sf_start].strip()
    return description.strip()

def calculate_token_value(rating, memory_type):
    """Calculate token point value based on rating and type"""
    if not rating or rating not in VALUE_RATING_MAP:
        rating = 1

    base_value = VALUE_RATING_MAP[rating]

    type_key = (memory_type or "Personal")
    multiplier = TYPE_MULTIPLIERS.get(type_key, 1.0)

    return int(base_value * multiplier)

def parse_group_multiplier(group_field):
    """Extract multiplier from group field like 'Group Name (x2)'"""
    if not group_field:
        return 1
    match = re.search(r'\(x(\d+)\)', group_field, re.IGNORECASE)
    return int(match.group(1)) if match else 1

def extract_group_name(group_field):
    """Extract group name without multiplier"""
    if not group_field:
        return None
    return re.sub(r'\s*\(x\d+\)', '', group_field, flags=re.IGNORECASE).strip() or None

def fetch_all_elements():
    """Fetch all elements from Notion"""
    print("\n=== Fetching Elements Database ===")
    elements = fetch_database_with_pagination(ELEMENTS_DATABASE_ID)
    print(f"✓ Fetched {len(elements)} elements")
    return elements

def fetch_all_characters():
    """Fetch all characters from Notion"""
    print("\n=== Fetching Characters Database ===")
    characters = fetch_database_with_pagination(CHARACTERS_DATABASE_ID)
    print(f"✓ Fetched {len(characters)} characters")
    return characters

def fetch_all_timeline():
    """Fetch all timeline events from Notion, sorted by date"""
    print("\n=== Fetching Timeline Database ===")
    timeline = fetch_database_with_pagination(
        TIMELINE_DATABASE_ID,
        sorts=[{"property": "Date", "direction": "ascending"}]
    )
    print(f"✓ Fetched {len(timeline)} timeline events")
    return timeline

def build_character_graph(characters, elements):
    """
    Build denormalized character nodes with complete context

    Args:
        characters: List of character pages from Notion
        elements: List of element pages (to resolve owned elements)

    Returns:
        Dict of character_id -> character data
    """
    print("\n=== Building Character Graph ===")

    # Build element lookup
    element_lookup = {elem["id"]: elem for elem in elements}

    character_graph = {}

    for char in characters:
        props = char["properties"]
        char_id = char["id"]

        # Extract basic info
        name = safe_extract_text(props.get("Name"), "title")
        char_type = safe_extract_select(props.get("Type"))
        tier = safe_extract_select(props.get("Tier"))
        logline = safe_extract_text(props.get("Character Logline"))
        overview = safe_extract_text(props.get("Overview & Key Relationships"))
        emotions = safe_extract_text(props.get("Emotion towards CEO & others"))
        primary_action = safe_extract_text(props.get("Primary Action"))

        # Extract relations
        owned_element_ids = safe_extract_relation(props.get("Owned Elements"))
        event_ids = safe_extract_relation(props.get("Events"))

        # Resolve owned elements
        owned_elements = []
        for elem_id in owned_element_ids:
            elem = element_lookup.get(elem_id)
            if elem:
                elem_props = elem["properties"]
                elem_name = safe_extract_text(elem_props.get("Name"), "title")
                elem_type = safe_extract_select(elem_props.get("Basic Type"))
                elem_desc = safe_extract_text(elem_props.get("Description/Text"))

                # Parse SF fields if it's a memory token
                is_token = elem_type and "Memory Token" in elem_type
                sf_fields = parse_sf_fields(elem_desc) if is_token else {}

                elem_data = {
                    "id": elem_id,
                    "name": elem_name,
                    "type": elem_type,
                    "notion_page_id": elem_id
                }

                if is_token and sf_fields.get("SF_RFID"):
                    elem_data.update({
                        "token_id": sf_fields["SF_RFID"],
                        "value_rating": sf_fields.get("SF_ValueRating"),
                        "memory_type": sf_fields.get("SF_MemoryType"),
                        "group": sf_fields.get("SF_Group"),
                        "points": calculate_token_value(
                            sf_fields.get("SF_ValueRating"),
                            sf_fields.get("SF_MemoryType")
                        )
                    })

                owned_elements.append(elem_data)

        # Build character node
        slug = name.lower().replace(" ", "-").replace(".", "")

        character_node = {
            "id": char_id,
            "slug": slug,
            "name": name,
            "notion_page_id": char_id,
            "type": char_type,
            "tier": tier,
            "logline": logline,
            "background": {
                "overview": overview,
                "emotions": emotions,
                "primary_action": primary_action
            },
            "owned_elements": owned_elements,
            "timeline_event_ids": event_ids,
            "token_count": len([e for e in owned_elements if "token_id" in e]),
            "total_points": sum(e.get("points", 0) for e in owned_elements if "points" in e)
        }

        character_graph[slug] = character_node
        print(f"  ✓ {name}: {character_node['token_count']} tokens, {character_node['total_points']} points")

    return character_graph

def build_timeline_graph(timeline_events, elements, characters):
    """
    Build denormalized timeline nodes with event context

    Args:
        timeline_events: List of timeline pages from Notion
        elements: List of element pages (to resolve Memory/Evidence)
        characters: List of character pages (to resolve Characters Involved)

    Returns:
        List of timeline events (chronologically sorted)
    """
    print("\n=== Building Timeline Graph ===")

    # Build lookups
    element_lookup = {elem["id"]: elem for elem in elements}
    character_lookup = {char["id"]: char for char in characters}

    timeline_graph = []

    for event in timeline_events:
        props = event["properties"]
        event_id = event["id"]

        # Extract basic info
        description = safe_extract_text(props.get("Description"), "title")
        notes = safe_extract_text(props.get("Notes"))
        date_obj = safe_extract_date(props.get("Date"))

        # Extract relations
        character_ids = safe_extract_relation(props.get("Characters Involved"))
        memory_ids = safe_extract_relation(props.get("Memory/Evidence"))

        # Resolve characters
        characters_involved = []
        for char_id in character_ids:
            char = character_lookup.get(char_id)
            if char:
                char_props = char["properties"]
                characters_involved.append({
                    "id": char_id,
                    "name": safe_extract_text(char_props.get("Name"), "title"),
                    "slug": safe_extract_text(char_props.get("Name"), "title").lower().replace(" ", "-").replace(".", "")
                })

        # Resolve memory tokens/evidence
        linked_tokens = []
        for mem_id in memory_ids:
            elem = element_lookup.get(mem_id)
            if elem:
                elem_props = elem["properties"]
                elem_name = safe_extract_text(elem_props.get("Name"), "title")
                elem_type = safe_extract_select(elem_props.get("Basic Type"))
                elem_desc = safe_extract_text(elem_props.get("Description/Text"))

                # Parse SF fields
                sf_fields = parse_sf_fields(elem_desc)

                if sf_fields.get("SF_RFID"):
                    linked_tokens.append({
                        "element_id": mem_id,
                        "element_name": elem_name,
                        "token_id": sf_fields["SF_RFID"],
                        "type": elem_type
                    })

        # Build timeline node
        event_node = {
            "id": event_id,
            "notion_page_id": event_id,
            "date": date_obj.get("start") if date_obj else None,
            "title": description,
            "notes": notes,
            "characters_involved": characters_involved,
            "linked_tokens": linked_tokens,
            "has_tokens": len(linked_tokens) > 0
        }

        timeline_graph.append(event_node)

        status = "✓" if event_node["has_tokens"] else "⚠"
        print(f"  {status} {date_obj.get('start') if date_obj else 'NO DATE'}: {description[:60]}... ({len(linked_tokens)} tokens)")

    return timeline_graph

def extract_narrative_threads(elements):
    """
    Extract unique narrative threads and build thread context

    Args:
        elements: List of element pages from Notion

    Returns:
        Dict of thread_name -> thread data
    """
    print("\n=== Extracting Narrative Threads ===")

    thread_elements = defaultdict(list)

    for elem in elements:
        props = elem["properties"]
        threads = safe_extract_multi_select(props.get("Narrative Threads"))
        elem_name = safe_extract_text(props.get("Name"), "title")
        elem_type = safe_extract_select(props.get("Basic Type"))
        elem_desc = safe_extract_text(props.get("Description/Text"))

        # Parse SF fields if memory token
        is_token = elem_type and "Memory Token" in elem_type
        sf_fields = parse_sf_fields(elem_desc) if is_token else {}

        for thread in threads:
            elem_data = {
                "element_id": elem["id"],
                "element_name": elem_name,
                "type": elem_type,
                "is_token": is_token
            }

            if is_token and sf_fields.get("SF_RFID"):
                elem_data.update({
                    "token_id": sf_fields["SF_RFID"],
                    "value_rating": sf_fields.get("SF_ValueRating"),
                    "memory_type": sf_fields.get("SF_MemoryType"),
                    "points": calculate_token_value(
                        sf_fields.get("SF_ValueRating"),
                        sf_fields.get("SF_MemoryType")
                    )
                })

            thread_elements[thread].append(elem_data)

    # Build thread nodes
    thread_graph = {}

    for thread_name, elements_list in thread_elements.items():
        slug = thread_name.lower().replace(" ", "-").replace("&", "and")
        token_count = len([e for e in elements_list if e["is_token"]])
        total_points = sum(e.get("points", 0) for e in elements_list if "points" in e)

        thread_node = {
            "name": thread_name,
            "slug": slug,
            "elements": elements_list,
            "token_count": token_count,
            "total_points": total_points,
            "element_count": len(elements_list)
        }

        thread_graph[slug] = thread_node
        print(f"  ✓ {thread_name}: {token_count} tokens, {total_points} points")

    return thread_graph

def build_correspondences(timeline_graph, elements):
    """
    Build bidirectional mapping between timeline events and tokens

    Returns:
        Dict with timeline_to_tokens, tokens_to_timeline, orphaned_tokens, unmapped_events
    """
    print("\n=== Building Correspondences ===")

    timeline_to_tokens = {}
    tokens_to_timeline = defaultdict(list)

    # Build timeline -> tokens mapping
    for event in timeline_graph:
        event_id = event["id"]
        token_ids = [t["token_id"] for t in event["linked_tokens"]]
        timeline_to_tokens[event_id] = token_ids

        # Reverse mapping
        for token_id in token_ids:
            tokens_to_timeline[token_id].append(event_id)

    # Find orphaned tokens (tokens without timeline events)
    all_tokens = []
    for elem in elements:
        props = elem["properties"]
        elem_type = safe_extract_select(props.get("Basic Type"))

        if elem_type and "Memory Token" in elem_type:
            elem_desc = safe_extract_text(props.get("Description/Text"))
            sf_fields = parse_sf_fields(elem_desc)

            if sf_fields.get("SF_RFID"):
                all_tokens.append({
                    "token_id": sf_fields["SF_RFID"],
                    "element_id": elem["id"],
                    "element_name": safe_extract_text(props.get("Name"), "title")
                })

    orphaned_tokens = [
        t for t in all_tokens
        if t["token_id"] not in tokens_to_timeline
    ]

    # Find unmapped events (events without tokens)
    unmapped_events = [
        {
            "event_id": e["id"],
            "date": e["date"],
            "title": e["title"],
            "characters": [c["name"] for c in e["characters_involved"]]
        }
        for e in timeline_graph
        if not e["has_tokens"]
    ]

    print(f"  ✓ {len(timeline_to_tokens)} events mapped to tokens")
    print(f"  ✓ {len(tokens_to_timeline)} unique tokens mapped to timeline")
    print(f"  ⚠ {len(orphaned_tokens)} orphaned tokens (no timeline event)")
    print(f"  ⚠ {len(unmapped_events)} unmapped events (no tokens)")

    return {
        "timeline_to_tokens": timeline_to_tokens,
        "tokens_to_timeline": dict(tokens_to_timeline),
        "orphaned_tokens": orphaned_tokens,
        "unmapped_events": unmapped_events
    }

def analyze_scoring_distribution(elements, thread_graph):
    """
    Analyze point distribution across various axes

    Returns:
        Dict with scoring statistics
    """
    print("\n=== Analyzing Scoring Distribution ===")

    # Extract all tokens
    tokens = []
    for elem in elements:
        props = elem["properties"]
        elem_type = safe_extract_select(props.get("Basic Type"))

        if elem_type and "Memory Token" in elem_type:
            elem_desc = safe_extract_text(props.get("Description/Text"))
            sf_fields = parse_sf_fields(elem_desc)

            if sf_fields.get("SF_RFID"):
                tokens.append({
                    "token_id": sf_fields["SF_RFID"],
                    "rating": sf_fields.get("SF_ValueRating"),
                    "memory_type": sf_fields.get("SF_MemoryType"),
                    "group": sf_fields.get("SF_Group"),
                    "points": calculate_token_value(
                        sf_fields.get("SF_ValueRating"),
                        sf_fields.get("SF_MemoryType")
                    )
                })

    # Total points
    total_points = sum(t["points"] for t in tokens)

    # By memory type
    by_type = defaultdict(lambda: {"count": 0, "points": 0})
    for token in tokens:
        mem_type = token["memory_type"] or "Personal"
        by_type[mem_type]["count"] += 1
        by_type[mem_type]["points"] += token["points"]

    # By rating
    by_rating = defaultdict(lambda: {"count": 0, "points": 0})
    for token in tokens:
        rating = token["rating"] or 1
        by_rating[rating]["count"] += 1
        by_rating[rating]["points"] += token["points"]

    # By narrative thread
    by_thread = {
        thread_name: {
            "count": data["token_count"],
            "points": data["total_points"]
        }
        for thread_name, data in thread_graph.items()
    }

    # Group analysis
    groups = defaultdict(list)
    for token in tokens:
        if token["group"]:
            group_name = extract_group_name(token["group"])
            if group_name:
                groups[group_name].append(token)

    group_analysis = {}
    for group_name, group_tokens in groups.items():
        multiplier = parse_group_multiplier(group_tokens[0]["group"]) if group_tokens else 1
        group_points = sum(t["points"] for t in group_tokens)
        bonus = (multiplier - 1) * group_points

        group_analysis[group_name] = {
            "token_count": len(group_tokens),
            "multiplier": multiplier,
            "total_points": group_points,
            "completion_bonus": bonus
        }

    print(f"  ✓ Total tokens: {len(tokens)}")
    print(f"  ✓ Total points: {total_points:,}")
    print(f"  ✓ {len(groups)} groups identified")

    return {
        "total_tokens": len(tokens),
        "total_points": total_points,
        "by_memory_type": dict(by_type),
        "by_rating": dict(by_rating),
        "by_thread": by_thread,
        "groups": group_analysis
    }

def analyze_narrative_value(elements, timeline_graph):
    """
    Analyze detective mode vs blackmarket mode balance

    Returns:
        Dict with narrative value analysis
    """
    print("\n=== Analyzing Narrative Value (Detective Mode Balance) ===")

    # Extract tokens with timeline context
    tokens_with_context = []

    for elem in elements:
        props = elem["properties"]
        elem_type = safe_extract_select(props.get("Basic Type"))

        if elem_type and "Memory Token" in elem_type:
            elem_desc = safe_extract_text(props.get("Description/Text"))
            sf_fields = parse_sf_fields(elem_desc)

            if sf_fields.get("SF_RFID"):
                # Check if linked to timeline
                timeline_ids = safe_extract_relation(props.get("Timeline Event"))

                tokens_with_context.append({
                    "token_id": sf_fields["SF_RFID"],
                    "rating": sf_fields.get("SF_ValueRating", 1),
                    "points": calculate_token_value(
                        sf_fields.get("SF_ValueRating"),
                        sf_fields.get("SF_MemoryType")
                    ),
                    "has_timeline": len(timeline_ids) > 0,
                    "summary": sf_fields.get("SF_Summary"),
                    "has_summary": bool(sf_fields.get("SF_Summary"))
                })

    # Categorize tokens
    narrative_critical = [t for t in tokens_with_context if t["has_timeline"]]
    narrative_dead_ends = [t for t in tokens_with_context if not t["has_timeline"]]

    # Distribution by value
    def categorize_by_value(tokens):
        high = [t for t in tokens if t["rating"] >= 4]
        mid = [t for t in tokens if 2 <= t["rating"] <= 3]
        low = [t for t in tokens if t["rating"] == 1]
        return {"high_4_5": len(high), "mid_2_3": len(mid), "low_1": len(low)}

    critical_dist = categorize_by_value(narrative_critical)
    dead_end_dist = categorize_by_value(narrative_dead_ends)

    print(f"  ✓ Narrative critical tokens: {len(narrative_critical)}")
    print(f"    - High value (4-5): {critical_dist['high_4_5']}")
    print(f"    - Mid value (2-3): {critical_dist['mid_2_3']}")
    print(f"    - Low value (1): {critical_dist['low_1']}")
    print(f"  ✓ Narrative dead-ends: {len(narrative_dead_ends)}")
    print(f"    - High value (4-5): {dead_end_dist['high_4_5']}")

    return {
        "narrative_critical_tokens": {
            "total": len(narrative_critical),
            "distribution_by_value": critical_dist
        },
        "narrative_dead_ends": {
            "total": len(narrative_dead_ends),
            "distribution_by_value": dead_end_dist
        },
        "tokens_with_summaries": len([t for t in tokens_with_context if t["has_summary"]]),
        "tokens_without_summaries": len([t for t in tokens_with_context if not t["has_summary"]])
    }

def build_index(character_graph, timeline_graph, thread_graph, correspondences, scoring_dist):
    """
    Build master index.json for agent navigation

    Returns:
        Dict with complete navigation structure
    """
    print("\n=== Building Master Index ===")

    index = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "summary": {
            "total_characters": len(character_graph),
            "total_narrative_threads": len(thread_graph),
            "total_timeline_events": len(timeline_graph),
            "total_existing_tokens": scoring_dist["total_tokens"],
            "unmapped_timeline_events": len(correspondences["unmapped_events"]),
            "orphaned_tokens": len(correspondences["orphaned_tokens"])
        },
        "navigation": {
            "characters": {
                "path": "graph/characters.json",
                "index": {
                    slug: {
                        "id": data["id"],
                        "name": data["name"],
                        "token_count": data["token_count"],
                        "total_points": data["total_points"]
                    }
                    for slug, data in character_graph.items()
                }
            },
            "narrative_threads": {
                "path": "graph/narrative-threads.json",
                "index": {
                    slug: {
                        "name": data["name"],
                        "token_count": data["token_count"],
                        "total_points": data["total_points"]
                    }
                    for slug, data in thread_graph.items()
                }
            },
            "timeline": {
                "path": "graph/timeline.json",
                "total_events": len(timeline_graph),
                "events_with_tokens": len([e for e in timeline_graph if e["has_tokens"]]),
                "events_without_tokens": len([e for e in timeline_graph if not e["has_tokens"]])
            }
        },
        "quick_stats": {
            "scoring": {
                "total_points_available": scoring_dist["total_points"],
                "by_type": scoring_dist["by_memory_type"],
                "by_rating": scoring_dist["by_rating"]
            },
            "groups": {
                "total_groups": len(scoring_dist["groups"]),
                "total_bonus_available": sum(g["completion_bonus"] for g in scoring_dist["groups"].values())
            }
        },
        "files": {
            "graph": {
                "characters": "graph/characters.json",
                "timeline": "graph/timeline.json",
                "narrative_threads": "graph/narrative-threads.json",
                "correspondences": "graph/correspondences.json"
            },
            "current_state": {
                "all_tokens": "current-state/all-tokens.json",
                "tokens_by_timeline": "current-state/tokens-by-timeline.json",
                "tokens_by_character": "current-state/tokens-by-character.json",
                "tokens_by_thread": "current-state/tokens-by-thread.json"
            },
            "analysis": {
                "timeline_gaps": "analysis/timeline-gaps.json",
                "orphaned_tokens": "analysis/orphaned-tokens.json",
                "narrative_value": "analysis/narrative-value.json",
                "scoring_distribution": "analysis/scoring-distribution.json"
            }
        }
    }

    print(f"  ✓ Index created with {len(index['navigation'])} navigation sections")

    return index

def build_current_state_files(elements, timeline_graph, character_graph, thread_graph):
    """
    Build current-state files organizing existing tokens by various axes

    Returns:
        Dict with all_tokens, tokens_by_timeline, tokens_by_character, tokens_by_thread
    """
    print("\n=== Building Current State Files ===")

    # Extract all tokens
    all_tokens = {}

    for elem in elements:
        props = elem["properties"]
        elem_type = safe_extract_select(props.get("Basic Type"))

        if elem_type and "Memory Token" in elem_type:
            elem_desc = safe_extract_text(props.get("Description/Text"))
            sf_fields = parse_sf_fields(elem_desc)

            if sf_fields.get("SF_RFID"):
                token_id = sf_fields["SF_RFID"]

                all_tokens[token_id] = {
                    "token_id": token_id,
                    "element_id": elem["id"],
                    "element_name": safe_extract_text(props.get("Name"), "title"),
                    "type": elem_type,
                    "display_text": extract_display_text(elem_desc),
                    "SF_ValueRating": sf_fields.get("SF_ValueRating"),
                    "SF_MemoryType": sf_fields.get("SF_MemoryType"),
                    "SF_Group": sf_fields.get("SF_Group"),
                    "SF_Summary": sf_fields.get("SF_Summary"),
                    "points": calculate_token_value(
                        sf_fields.get("SF_ValueRating"),
                        sf_fields.get("SF_MemoryType")
                    ),
                    "narrative_threads": safe_extract_multi_select(props.get("Narrative Threads")),
                    "timeline_event_ids": safe_extract_relation(props.get("Timeline Event")),
                    "owner_ids": safe_extract_relation(props.get("Owner"))
                }

    # Organize by timeline
    tokens_by_timeline = defaultdict(list)
    for token_id, token in all_tokens.items():
        for event_id in token["timeline_event_ids"]:
            tokens_by_timeline[event_id].append(token)

    # Add event metadata
    tokens_by_timeline_with_meta = {}
    for event in timeline_graph:
        event_id = event["id"]
        tokens = tokens_by_timeline.get(event_id, [])
        tokens_by_timeline_with_meta[event_id] = {
            "event_date": event["date"],
            "event_title": event["title"],
            "tokens": tokens
        }

    # Organize by character
    tokens_by_character = {}
    for char_slug, char_data in character_graph.items():
        char_id = char_data["id"]
        char_tokens = [
            token for token in all_tokens.values()
            if char_id in token["owner_ids"]
        ]

        if char_tokens:
            tokens_by_character[char_slug] = {
                "character_name": char_data["name"],
                "character_id": char_id,
                "tokens": char_tokens
            }

    # Organize by thread
    tokens_by_thread = {}
    for thread_slug, thread_data in thread_graph.items():
        thread_name = thread_data["name"]
        thread_tokens = [
            token for token in all_tokens.values()
            if thread_name in token["narrative_threads"]
        ]

        if thread_tokens:
            tokens_by_thread[thread_slug] = {
                "thread_name": thread_name,
                "tokens": thread_tokens
            }

    print(f"  ✓ {len(all_tokens)} total tokens")
    print(f"  ✓ {len(tokens_by_timeline_with_meta)} timeline events with tokens")
    print(f"  ✓ {len(tokens_by_character)} characters with tokens")
    print(f"  ✓ {len(tokens_by_thread)} narrative threads with tokens")

    return {
        "all_tokens": all_tokens,
        "tokens_by_timeline": tokens_by_timeline_with_meta,
        "tokens_by_character": tokens_by_character,
        "tokens_by_thread": tokens_by_thread
    }

def write_json(path, data):
    """Write JSON file with pretty formatting"""
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"  ✓ Wrote {path}")

def main():
    print("=" * 70)
    print("Syncing Notion to Token Generation Knowledge Graph")
    print("=" * 70)

    # Ensure directories exist
    ensure_directories()

    # Fetch all data from Notion
    elements = fetch_all_elements()
    characters = fetch_all_characters()
    timeline = fetch_all_timeline()

    # Build graph nodes
    character_graph = build_character_graph(characters, elements)
    timeline_graph = build_timeline_graph(timeline, elements, characters)
    thread_graph = extract_narrative_threads(elements)

    # Build correspondences
    correspondences = build_correspondences(timeline_graph, elements)

    # Build current state files
    current_state = build_current_state_files(elements, timeline_graph, character_graph, thread_graph)

    # Run analyses
    scoring_dist = analyze_scoring_distribution(elements, thread_graph)
    narrative_value = analyze_narrative_value(elements, timeline_graph)

    # Build master index
    index = build_index(character_graph, timeline_graph, thread_graph, correspondences, scoring_dist)

    # Write all output files
    print("\n=== Writing Output Files ===")

    # Graph files
    write_json(GRAPH_DIR / "characters.json", {"characters": list(character_graph.values())})
    write_json(GRAPH_DIR / "timeline.json", {"events": timeline_graph})
    write_json(GRAPH_DIR / "narrative-threads.json", {"threads": list(thread_graph.values())})
    write_json(GRAPH_DIR / "correspondences.json", correspondences)

    # Current state files
    write_json(STATE_DIR / "all-tokens.json", current_state["all_tokens"])
    write_json(STATE_DIR / "tokens-by-timeline.json", current_state["tokens_by_timeline"])
    write_json(STATE_DIR / "tokens-by-character.json", current_state["tokens_by_character"])
    write_json(STATE_DIR / "tokens-by-thread.json", current_state["tokens_by_thread"])

    # Analysis files
    write_json(ANALYSIS_DIR / "timeline-gaps.json", {
        "unmapped_events": correspondences["unmapped_events"]
    })
    write_json(ANALYSIS_DIR / "orphaned-tokens.json", {
        "orphaned_tokens": correspondences["orphaned_tokens"]
    })
    write_json(ANALYSIS_DIR / "narrative-value.json", narrative_value)
    write_json(ANALYSIS_DIR / "scoring-distribution.json", scoring_dist)

    # Master index
    write_json(CACHE_ROOT / "index.json", index)

    print("\n" + "=" * 70)
    print("✓ Knowledge graph sync complete!")
    print("=" * 70)
    print(f"\nCache location: {CACHE_ROOT}")
    print(f"Total characters: {len(character_graph)}")
    print(f"Total timeline events: {len(timeline_graph)}")
    print(f"Total narrative threads: {len(thread_graph)}")
    print(f"Total existing tokens: {scoring_dist['total_tokens']}")
    print(f"\n⚠ Timeline gaps: {len(correspondences['unmapped_events'])} events without tokens")
    print(f"⚠ Orphaned tokens: {len(correspondences['orphaned_tokens'])} tokens without timeline")
    print("\nReady for token generation workflow!")

if __name__ == "__main__":
    main()
