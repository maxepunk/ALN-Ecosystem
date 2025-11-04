# Timeline Database Schema

The Timeline database contains chronological events linking characters, memory tokens, and evidence.

## Database ID
`1b52f33d-583f-80de-ae5a-d20020c120dd`

## Properties

### Core Information

| Property | Type | Description |
|----------|------|-------------|
| **Description** | Title | Event description |
| **Date** | Date | When the event occurred |
| **Notes** | Text | Additional notes about the event |

### Relationships

| Property | Type | Related To | Description |
|----------|------|------------|-------------|
| **Characters Involved** | Relation | Characters | Characters present at this event |
| **Memory/Evidence** | Relation | Elements | Memory tokens or evidence related to this event |

### Derived Properties

| Property | Type | Description |
|----------|------|-------------|
| **mem type** | Rollup | Type of memory/evidence (rolled up from Elements) |

### Metadata

| Property | Type | Description |
|----------|------|-------------|
| **Created time** | Created time | When entry was created |
| **Last edited time** | Last edited time | When entry was last modified |
| **Created by** | Created by | User who created entry |
| **Last edited by** | Last edited by | User who last edited entry |

## API Query Examples

### Get all timeline events sorted by date
```python
timeline = notion.databases.query(
    database_id="1b52f33d-583f-80de-ae5a-d20020c120dd",
    sorts=[{"property": "Date", "direction": "ascending"}]
)
```

### Get events for a specific character
```python
character_events = notion.databases.query(
    database_id="1b52f33d-583f-80de-ae5a-d20020c120dd",
    filter={
        "property": "Characters Involved",
        "relation": {"contains": character_page_id}
    },
    sorts=[{"property": "Date", "direction": "ascending"}]
)
```

### Get events with memory tokens
```python
memory_events = notion.databases.query(
    database_id="1b52f33d-583f-80de-ae5a-d20020c120dd",
    filter={
        "property": "Memory/Evidence",
        "relation": {"is_not_empty": True}
    }
)
```

### Get events within date range
```python
night_of_party = notion.databases.query(
    database_id="1b52f33d-583f-80de-ae5a-d20020c120dd",
    filter={
        "and": [
            {
                "property": "Date",
                "date": {"on_or_after": "2024-03-15"}
            },
            {
                "property": "Date",
                "date": {"on_or_before": "2024-03-16"}
            }
        ]
    },
    sorts=[{"property": "Date", "direction": "ascending"}]
)
```

## Accessing Property Values

```python
event = notion.pages.retrieve(page_id=event_id)

# Basic properties
description = event["properties"]["Description"]["title"][0]["text"]["content"] if event["properties"]["Description"]["title"] else ""
notes = event["properties"]["Notes"]["rich_text"][0]["text"]["content"] if event["properties"]["Notes"]["rich_text"] else ""

# Date property
date_obj = event["properties"]["Date"]["date"]
if date_obj:
    start_date = date_obj["start"]
    end_date = date_obj.get("end")  # May be None for single-day events

# Relations
characters = event["properties"]["Characters Involved"]["relation"]
memories = event["properties"]["Memory/Evidence"]["relation"]
```

## Common Patterns

### Building character timelines
```python
def get_character_timeline(character_id, notion):
    """Get all events for a character, sorted chronologically"""
    events = notion.databases.query(
        database_id="1b52f33d-583f-80de-ae5a-d20020c120dd",
        filter={
            "property": "Characters Involved",
            "relation": {"contains": character_id}
        },
        sorts=[{"property": "Date", "direction": "ascending"}]
    )
    
    timeline = []
    for event in events["results"]:
        desc = event["properties"]["Description"]["title"][0]["text"]["content"]
        date = event["properties"]["Date"]["date"]["start"]
        timeline.append({"date": date, "description": desc})
    
    return timeline
```

### Finding related memories for an event
```python
def get_event_memories(event_id, notion):
    """Get all memory tokens/evidence for an event"""
    event = notion.pages.retrieve(page_id=event_id)
    memory_refs = event["properties"]["Memory/Evidence"]["relation"]
    
    memories = []
    for ref in memory_refs:
        memory = notion.pages.retrieve(page_id=ref["id"])
        name = memory["properties"]["Name"]["title"][0]["text"]["content"]
        basic_type = memory["properties"]["Basic Type"]["select"]["name"]
        memories.append({"name": name, "type": basic_type})
    
    return memories
```

### Cross-referencing characters and events
```python
def get_character_connections_via_events(char1_id, char2_id, notion):
    """Find events where two characters both appear"""
    # Get all events for first character
    char1_events = notion.databases.query(
        database_id="1b52f33d-583f-80de-ae5a-d20020c120dd",
        filter={
            "property": "Characters Involved",
            "relation": {"contains": char1_id}
        }
    )
    
    shared_events = []
    for event in char1_events["results"]:
        involved = [ref["id"] for ref in event["properties"]["Characters Involved"]["relation"]]
        if char2_id in involved:
            desc = event["properties"]["Description"]["title"][0]["text"]["content"]
            date = event["properties"]["Date"]["date"]["start"]
            shared_events.append({"description": desc, "date": date})
    
    return shared_events
```
