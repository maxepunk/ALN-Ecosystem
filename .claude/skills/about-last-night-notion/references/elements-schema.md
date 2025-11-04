# Elements Database Schema

The Elements database contains all physical items, props, memory tokens, documents, and set dressing for the About Last Night... experience.

## Database ID
`18c2f33d-583f-8020-91bc-d84c7dd94306`

## Properties

### Core Identification

| Property | Type | Description |
|----------|------|-------------|
| **Name** | Title | Element name/identifier |
| **Basic Type** | Select | Primary classification of the element |
| **Status** | Status | Production/development status |

### Basic Type Options

The "Basic Type" property categorizes elements:

- **Set Dressing** (blue) - Environmental/decorative items
- **Prop** (green) - Interactive physical props
- **Memory Token Image** (purple) - RFID memory token with image
- **Memory Token Audio** (yellow) - RFID memory token with audio
- **Memory Token Video** (red) - RFID memory token with video
- **Document** (brown) - Paper documents, printouts
- **Memory Token Audio + Image** (gray) - RFID token with both image and audio
- **Memory Token (Audio)** (orange) - Audio-only memory token
- **Physical** (pink) - Physical game elements
- **Clue** (default) - Evidence or clue items

### Content & Media

| Property | Type | Description |
|----------|------|-------------|
| **Description/Text** | Text | Detailed description or text content |
| **Files & media** | Files | Attached images, audio, video, documents |
| **Content Link** | URL | Link to external content or assets |

### Relationships

| Property | Type | Related To | Description |
|----------|------|------------|-------------|
| **Owner** | Relation | Characters | Character(s) who own this element |
| **Associated Characters** | Rollup | Characters | All characters associated (via Owner relation) |
| **Container** | Relation | Elements (self) | Parent container if this element is contained within another |
| **Contents** | Relation | Elements (self) | Child elements contained within this element |
| **Required For (Puzzle)** | Relation | Puzzles | Puzzles that require this element to solve |
| **Rewarded by (Puzzle)** | Relation | Puzzles | Puzzles that reward this element upon completion |
| **Container Puzzle** | Relation | Puzzles | Puzzle(s) that unlock this element's container |
| **Timeline Event** | Relation | Timeline | Timeline events associated with this element |

### Narrative & Gameplay

| Property | Type | Description |
|----------|------|-------------|
| **Narrative Threads** | Multi-select | Story threads this element connects to |
| **First Available** | Select | When element becomes available (Act 0, Act 1, Act 2) |
| **Act Index** | Formula | Numeric act index (-1, 0, 1, 2) |
| **Critical Path** | Checkbox | Whether element is essential to game flow |
| **Container?** | Formula | Calculated: whether this element contains other elements |
| **Puzzle Chain** | Rollup | Chains of puzzles this element is part of |

### Production Tracking

| Property | Type | Description |
|----------|------|-------------|
| **Production/Puzzle Notes** | Text | Production notes, design decisions |
| **Created time** | Created time | When entry was created |
| **Last edited time** | Last edited time | When entry was last modified |
| **Created by** | Created by | User who created entry |
| **Last edited by** | Last edited by | User who last edited entry |

## Narrative Threads Options

Elements can be tagged with multiple narrative threads:

- **Funding & Espionage**
- **Underground Parties**
- **Memory Drug**
- **Marriage Troubles**
- **Ephemeral Echo**
- **Tech Development**
- **Advanced Technology**
- **Emergent Third Path**
- **Blackmail**
- **Unsanctioned Research**
- **Class Conflicts**
- **Murder Timeline**
- **Investigative Journalism**
- **The Senate Testimony**

## Status Options

Organized by lifecycle stage:

**To Do:**
- **AISLOP** (gray)
- **Idea/Placeholder**

**In Progress:**
- **in space playtest ready** (blue)
- **In development** (orange)
- **Writing Complete** (blue)
- **Design Complete** (purple)
- **Source Prop/print** (purple)
- **Ready for Playtest** (yellow)

**Complete:**
- **Done** (green)

## API Query Examples

### Get all Memory Tokens
```python
memory_tokens = notion.databases.query(
    database_id="18c2f33d-583f-8020-91bc-d84c7dd94306",
    filter={
        "or": [
            {"property": "Basic Type", "select": {"equals": "Memory Token Image"}},
            {"property": "Basic Type", "select": {"equals": "Memory Token Audio"}},
            {"property": "Basic Type", "select": {"equals": "Memory Token Video"}},
            {"property": "Basic Type", "select": {"equals": "Memory Token Audio + Image"}}
        ]
    }
)
```

### Get elements owned by a character
```python
character_elements = notion.databases.query(
    database_id="18c2f33d-583f-8020-91bc-d84c7dd94306",
    filter={
        "property": "Owner",
        "relation": {"contains": character_page_id}
    }
)
```

### Get Act 1 elements
```python
act1_elements = notion.databases.query(
    database_id="18c2f33d-583f-8020-91bc-d84c7dd94306",
    filter={
        "property": "First Available",
        "select": {"equals": "Act 1"}
    }
)
```

### Get elements by narrative thread
```python
funding_elements = notion.databases.query(
    database_id="18c2f33d-583f-8020-91bc-d84c7dd94306",
    filter={
        "property": "Narrative Threads",
        "multi_select": {"contains": "Funding & Espionage"}
    }
)
```

## Accessing Property Values

```python
# Get element by ID
element = notion.pages.retrieve(page_id=element_id)

# Access basic properties
name = element["properties"]["Name"]["title"][0]["text"]["content"] if element["properties"]["Name"]["title"] else ""
basic_type = element["properties"]["Basic Type"]["select"]["name"] if element["properties"]["Basic Type"]["select"] else None
status = element["properties"]["Status"]["status"]["name"] if element["properties"]["Status"]["status"] else None

# Access relations
owner_refs = element["properties"]["Owner"]["relation"]  # List of {id: "page_id"}
container_ref = element["properties"]["Container"]["relation"]  # Can be empty list or single item

# Access files
files = element["properties"]["Files & media"]["files"]
for file in files:
    if file["type"] == "file":
        url = file["file"]["url"]
        name = file["name"]
    elif file["type"] == "external":
        url = file["external"]["url"]

# Access text
description = element["properties"]["Description/Text"]["rich_text"][0]["text"]["content"] if element["properties"]["Description/Text"]["rich_text"] else ""

# Access formulas
act_index = element["properties"]["Act Index"]["formula"]["number"]  # Can be None

# Access multi-select
narrative_threads = [opt["name"] for opt in element["properties"]["Narrative Threads"]["multi_select"]]
```

## Common Patterns

### Finding containers and their contents
```python
# Get all containers (elements that contain other elements)
containers = notion.databases.query(
    database_id="18c2f33d-583f-8020-91bc-d84c7dd94306",
    filter={
        "property": "Contents",
        "relation": {"is_not_empty": True}
    }
)

# For each container, get its contents
for container in containers["results"]:
    content_refs = container["properties"]["Contents"]["relation"]
    for content_ref in content_refs:
        content = notion.pages.retrieve(page_id=content_ref["id"])
        # Process content...
```

### Getting puzzle-related elements
```python
# Elements required for puzzles
puzzle_elements = notion.databases.query(
    database_id="18c2f33d-583f-8020-91bc-d84c7dd94306",
    filter={
        "property": "Required For (Puzzle)",
        "relation": {"is_not_empty": True}
    }
)

# Elements rewarded by puzzles
reward_elements = notion.databases.query(
    database_id="18c2f33d-583f-8020-91bc-d84c7dd94306",
    filter={
        "property": "Rewarded by (Puzzle)",
        "relation": {"is_not_empty": True}
    }
)
```
