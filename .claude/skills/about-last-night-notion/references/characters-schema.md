# Characters Database Schema

The Characters database contains all player and NPC character profiles for the About Last Night... experience.

## Database ID
`18c2f33d-583f-8060-a6ab-de32ff06bca2`

## Properties

### Core Information

| Property | Type | Description |
|----------|------|-------------|
| **Name** | Title | Character name |
| **Type** | Select | Player or NPC |
| **Tier** | Select | Character importance tier |
| **Character Logline** | Text | One-line character summary |

### Type Options
- **Player** (blue) - Playable character
- **NPC** (pink) - Non-player character

### Tier Options
- **Primary** (gray) - Main character
- **Core** (yellow) - Core character
- **Secondary** (brown) - Supporting character
- **Tertiary** (green) - Minor character

### Character Details

| Property | Type | Description |
|----------|------|-------------|
| **Overview & Key Relationships** | Text | Detailed character background and relationships |
| **Emotion towards CEO & others** | Text | Character's feelings and motivations |
| **Primary Action** | Text | Character's main objective or action |

### Relationships

| Property | Type | Related To | Description |
|----------|------|------------|-------------|
| **Owned Elements** | Relation | Elements | Elements this character owns |
| **Associated Elements** | Relation | Elements | Elements associated with this character |
| **Character Puzzles** | Relation | Puzzles | Puzzles specific to this character |
| **Events** | Relation | Timeline | Timeline events this character is involved in |
| **Connections** | Rollup | (via relations) | Summary of character connections |

### Metadata

| Property | Type | Description |
|----------|------|-------------|
| **Created time** | Created time | When entry was created |
| **Last edited time** | Last edited time | When entry was last modified |

## API Query Examples

### Get all player characters
```python
players = notion.databases.query(
    database_id="18c2f33d-583f-8060-a6ab-de32ff06bca2",
    filter={
        "property": "Type",
        "select": {"equals": "Player"}
    }
)
```

### Get core characters
```python
core_chars = notion.databases.query(
    database_id="18c2f33d-583f-8060-a6ab-de32ff06bca2",
    filter={
        "property": "Tier",
        "select": {"equals": "Core"}
    }
)
```

### Get character with their owned elements
```python
# Get character
character = notion.pages.retrieve(page_id=character_id)

# Get owned elements
owned_refs = character["properties"]["Owned Elements"]["relation"]
owned_elements = []
for ref in owned_refs:
    element = notion.pages.retrieve(page_id=ref["id"])
    owned_elements.append(element)
```

## Accessing Property Values

```python
character = notion.pages.retrieve(page_id=character_id)

# Basic properties
name = character["properties"]["Name"]["title"][0]["text"]["content"]
char_type = character["properties"]["Type"]["select"]["name"] if character["properties"]["Type"]["select"] else None
tier = character["properties"]["Tier"]["select"]["name"] if character["properties"]["Tier"]["select"] else None

# Text properties
logline = character["properties"]["Character Logline"]["rich_text"][0]["text"]["content"] if character["properties"]["Character Logline"]["rich_text"] else ""
overview = character["properties"]["Overview & Key Relationships"]["rich_text"][0]["text"]["content"] if character["properties"]["Overview & Key Relationships"]["rich_text"] else ""

# Relations
owned_elements = character["properties"]["Owned Elements"]["relation"]
character_puzzles = character["properties"]["Character Puzzles"]["relation"]
events = character["properties"]["Events"]["relation"]
```
