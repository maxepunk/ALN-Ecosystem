# Puzzles Database Schema

The Puzzles database contains all game puzzles, their elements, rewards, and narrative connections.

## Database ID
`1b62f33d-583f-80cc-87cf-d7d6c4b0b265`

## Properties

### Core Information

| Property | Type | Description |
|----------|------|-------------|
| **Puzzle** | Title | Puzzle name |
| **Status** | Status | Development status |
| **Description/Solution** | Text | Puzzle description and solution |
| **Critical Path** | Checkbox | Whether puzzle is essential to game flow |

### Status Options

**To Do:**
- **Idea/Placeholder** (gray)

**In Progress:**
- **Writing Complete** (blue)
- **Design Complete** (purple)
- **Source Prop/print** (purple)
- **In development** (orange)
- **Ready for Playtest** (yellow)
- **in space playtest ready** (blue)

**Complete:**
- **Done** (green)

### Relationships

| Property | Type | Related To | Description |
|----------|------|------------|-------------|
| **Parent item** | Relation | Puzzles (self) | Parent puzzle if this is a sub-puzzle |
| **Sub-Puzzles** | Relation | Puzzles (self) | Child puzzles |
| **Locked Item** | Relation | Elements | Element(s) that are locked/unlocked by this puzzle |
| **Puzzle Elements** | Relation | Elements | Elements required to solve this puzzle |
| **Rewards** | Relation | Elements | Elements rewarded upon puzzle completion |

### Derived Properties

| Property | Type | Description |
|----------|------|-------------|
| **Max Act Index** | Rollup | Highest act index of related puzzle elements |
| **Timing** | Formula | Calculated timing (e.g., "Act 1") based on Max Act Index |
| **Narrative Threads** | Rollup | Narrative threads from related elements |
| **Owner** | Rollup | Character owners from related elements |
| **Story Reveals** | Rollup | Story revelations from this puzzle |

### Additional Properties

| Property | Type | Description |
|----------|------|-------------|
| **Asset Link** | URL | Link to puzzle assets or resources |
| **Created time** | Created time | When entry was created |
| **Last edited time** | Last edited time | When entry was last modified |
| **Created by** | Created by | User who created entry |
| **Last edited by** | Last edited by | User who last edited entry |

## API Query Examples

### Get all puzzles
```python
puzzles = notion.databases.query(
    database_id="1b62f33d-583f-80cc-87cf-d7d6c4b0b265"
)
```

### Get puzzles by status
```python
in_dev_puzzles = notion.databases.query(
    database_id="1b62f33d-583f-80cc-87cf-d7d6c4b0b265",
    filter={
        "property": "Status",
        "status": {"equals": "In development"}
    }
)
```

### Get critical path puzzles
```python
critical_puzzles = notion.databases.query(
    database_id="1b62f33d-583f-80cc-87cf-d7d6c4b0b265",
    filter={
        "property": "Critical Path",
        "checkbox": {"equals": True}
    }
)
```

### Get puzzle with all related data
```python
# Get puzzle
puzzle = notion.pages.retrieve(page_id=puzzle_id)

# Get required elements
required_refs = puzzle["properties"]["Puzzle Elements"]["relation"]
required_elements = [notion.pages.retrieve(page_id=ref["id"]) for ref in required_refs]

# Get rewards
reward_refs = puzzle["properties"]["Rewards"]["relation"]
rewards = [notion.pages.retrieve(page_id=ref["id"]) for ref in reward_refs]

# Get locked item
locked_refs = puzzle["properties"]["Locked Item"]["relation"]
locked_items = [notion.pages.retrieve(page_id=ref["id"]) for ref in locked_refs]
```

## Accessing Property Values

```python
puzzle = notion.pages.retrieve(page_id=puzzle_id)

# Basic properties
name = puzzle["properties"]["Puzzle"]["title"][0]["text"]["content"] if puzzle["properties"]["Puzzle"]["title"] else ""
status = puzzle["properties"]["Status"]["status"]["name"] if puzzle["properties"]["Status"]["status"] else None
critical = puzzle["properties"]["Critical Path"]["checkbox"]

# Text properties
description = puzzle["properties"]["Description/Solution"]["rich_text"][0]["text"]["content"] if puzzle["properties"]["Description/Solution"]["rich_text"] else ""

# Relations
puzzle_elements = puzzle["properties"]["Puzzle Elements"]["relation"]
rewards = puzzle["properties"]["Rewards"]["relation"]
locked_items = puzzle["properties"]["Locked Item"]["relation"]
sub_puzzles = puzzle["properties"]["Sub-Puzzles"]["relation"]

# Rollups and formulas
max_act = puzzle["properties"]["Max Act Index"]["rollup"]["number"] if puzzle["properties"]["Max Act Index"]["rollup"] else None
timing = puzzle["properties"]["Timing"]["formula"]["string"] if puzzle["properties"]["Timing"]["formula"] else ""
```

## Common Patterns

### Building puzzle dependency tree
```python
def get_puzzle_tree(puzzle_id, notion, depth=0):
    puzzle = notion.pages.retrieve(page_id=puzzle_id)
    name = puzzle["properties"]["Puzzle"]["title"][0]["text"]["content"]
    
    result = {
        "name": name,
        "id": puzzle_id,
        "depth": depth,
        "sub_puzzles": []
    }
    
    # Get sub-puzzles
    sub_refs = puzzle["properties"]["Sub-Puzzles"]["relation"]
    for sub_ref in sub_refs:
        result["sub_puzzles"].append(get_puzzle_tree(sub_ref["id"], notion, depth + 1))
    
    return result
```

### Finding puzzle chains
```python
# Get all puzzles that reward elements
puzzles_with_rewards = notion.databases.query(
    database_id="1b62f33d-583f-80cc-87cf-d7d6c4b0b265",
    filter={
        "property": "Rewards",
        "relation": {"is_not_empty": True}
    }
)

# For each reward, find which puzzles require it
for puzzle in puzzles_with_rewards["results"]:
    reward_refs = puzzle["properties"]["Rewards"]["relation"]
    
    for reward_ref in reward_refs:
        # Query Elements database for puzzles requiring this reward
        requiring_puzzles = notion.databases.query(
            database_id="18c2f33d-583f-8020-91bc-d84c7dd94306",
            filter={
                "property": "url",
                "rich_text": {"equals": reward_ref["id"]}
            }
        )
```
