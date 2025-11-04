---
name: about-last-night-notion
description: Comprehensive guide for working with the About Last Night... Notion workspace databases. Use this skill when working with Elements, Characters, Puzzles, or Timeline databases for the About Last Night immersive crime thriller project. Enables database queries, relationship mapping, token synchronization, and automated workflows using the Notion API.
---

# About Last Night... Notion Integration Skill

This skill provides comprehensive guidance for working with the About Last Night... immersive crime thriller project's Notion workspace, which consists of four interconnected databases that manage game elements, characters, puzzles, and timeline events.

## Database Overview

The About Last Night... project uses four primary databases:

1. **Elements** - Physical items, props, memory tokens, documents, and set dressing
2. **Characters** - Player and NPC character profiles with relationships
3. **Puzzles** - Game puzzles with their requirements, rewards, and narrative connections
4. **Timeline** - Chronological events linking characters and evidence

### Database Relationships

These databases are heavily interconnected through Notion relations:

```
Elements ←→ Characters (via "Owner" and "Associated Elements")
Elements ←→ Puzzles (via "Required For", "Rewarded by", "Container Puzzle")
Elements ←→ Timeline (via "Timeline Event")
Characters ←→ Puzzles (via "Character Puzzles")
Characters ←→ Timeline (via "Characters Involved")
Puzzles ←→ Timeline (implicitly through Elements)
```

## Getting Started with the Notion API

### Authentication Setup

**⚠️ SECURITY NOTICE:** This skill includes a pre-configured integration token for the About Last Night... databases. This token grants full access to the shared databases. Keep this skill private and do not share it with untrusted parties. See [SECURITY_NOTICE.md](SECURITY_NOTICE.md) for complete security guidance.

**Pre-configured Integration Token:**
```python
NOTION_TOKEN = "YOUR_NOTION_TOKEN_HERE"
```

This token is already configured and ready to use. The integration has been granted access to all four About Last Night... databases.

**For Production Use:**
For production applications or when sharing code, use environment variables instead:
```python
import os
NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "YOUR_NOTION_TOKEN_HERE")
```

**Creating Your Own Integration (Optional):**
If you need to create a new integration:
1. Go to https://www.notion.so/my-integrations
2. Click "+ New integration"
3. Give it a name (e.g., "About Last Night Automation")
4. Select the workspace containing the About Last Night... databases
5. Copy the Internal Integration Token
6. Share each database with the integration via "..." → "Add connections"

### API Version Note

**Current Notion API Version:** The latest version is `2025-09-03`, which introduced significant changes:
- Databases and data sources are now separate concepts
- Use `/v1/data_sources/{data_source_id}/query` instead of `/v1/databases/{database_id}/query`
- Properties and schemas are now associated with data sources, not databases directly

**For compatibility:** This skill uses the older `2022-06-28` API version in examples, which is more stable and widely documented. Specify the API version in your requests:

```python
headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",  # or "2025-09-03" for latest
    "Content-Type": "application/json"
}
```

### Installing SDKs

**Python:**
```bash
pip install notion-client --break-system-packages
```

**JavaScript/Node.js:**
```bash
npm install @notionhq/client
```

## Database Schemas

For detailed schema information including all properties, types, and relationships for each database, see:
- [references/elements-schema.md](references/elements-schema.md) - Elements database schema
- [references/characters-schema.md](references/characters-schema.md) - Characters database schema  
- [references/puzzles-schema.md](references/puzzles-schema.md) - Puzzles database schema
- [references/timeline-schema.md](references/timeline-schema.md) - Timeline database schema

## Common Use Cases

### 1. Syncing Elements to tokens.json

A common workflow is synchronizing the Elements database to a `tokens.json` file for use in external applications. See [scripts/sync_to_tokens.py](scripts/sync_to_tokens.py) for a complete implementation.

**Key considerations:**
- Filter Elements by "Basic Type" property (Memory Token Image, Memory Token Audio, Memory Token Video)
- Map Notion properties to JSON structure
- Handle file attachments and media URLs
- Use custom "SF_RFID" identifier from Element names or properties

**Example mapping:**
```python
# Notion Element → tokens.json entry
{
    "534e2b02": {  # SF_RFID from Element
        "image": "assets/images/534e2b02.jpg",  # From Files & media
        "audio": "assets/audio/534e2b02.mp3",    # From Files & media
        "video": None,
        "processingImage": None,
        "SF_RFID": "534e2b02",
        "SF_ValueRating": 3,          # Custom property
        "SF_MemoryType": "Technical", # Derived from properties
        "SF_Group": ""                # From Element grouping
    }
}
```

### 2. Querying Related Data

To understand puzzle requirements and rewards:

```python
from notion_client import Client
notion = Client(auth=NOTION_TOKEN)

# Query a puzzle and its related elements
puzzle_response = notion.databases.query(
    database_id=PUZZLES_DATABASE_ID,
    filter={
        "property": "Puzzle",
        "title": {"contains": "Coat Check"}
    }
)

# Get the puzzle page
puzzle = puzzle_response["results"][0]

# Access relations
required_elements = puzzle["properties"]["Puzzle Elements"]["relation"]
rewards = puzzle["properties"]["Rewards"]["relation"]
```

### 3. Building Relationship Maps

To visualize character-element connections:

```python
# Get all characters
characters = notion.databases.query(database_id=CHARACTERS_DATABASE_ID)

for char in characters["results"]:
    name = char["properties"]["Name"]["title"][0]["text"]["content"]
    owned_elements = char["properties"]["Owned Elements"]["relation"]
    
    # Fetch each owned element
    for element_ref in owned_elements:
        element = notion.pages.retrieve(page_id=element_ref["id"])
        element_name = element["properties"]["Name"]["title"][0]["text"]["content"]
        print(f"{name} owns: {element_name}")
```

### 4. Timeline Event Analysis

To get events for a specific character:

```python
timeline_events = notion.databases.query(
    database_id=TIMELINE_DATABASE_ID,
    filter={
        "property": "Characters Involved",
        "relation": {"contains": character_page_id}
    },
    sorts=[{"property": "Date", "direction": "ascending"}]
)
```

## Database IDs

To work with these databases, you'll need their IDs. There are two ways to get them:

### Method 1: From the URL
When viewing a database in Notion, the URL format is:
```
https://www.notion.so/{workspace}/{DATABASE_ID}?v={view_id}
```

The DATABASE_ID is the 32-character identifier (with or without dashes).

### Method 2: Using the API
Search for databases by name:
```python
results = notion.search(
    filter={"property": "object", "value": "database"},
    query="About Last Night"
)
```

**Current Database IDs** (as of this skill creation):
- **Elements:** `18c2f33d-583f-8020-91bc-d84c7dd94306`
- **Characters:** `18c2f33d-583f-8060-a6ab-de32ff06bca2`
- **Puzzles:** `1b62f33d-583f-80cc-87cf-d7d6c4b0b265`
- **Timeline:** `1b52f33d-583f-80de-ae5a-d20020c120dd`

*Note: These IDs may change if databases are recreated. Always verify in your workspace.*

## Working with Properties

### Property Type Reference

Different property types require different API approaches:

**Title:** `page["properties"]["Name"]["title"][0]["text"]["content"]`

**Select:** `page["properties"]["Status"]["select"]["name"]`

**Multi-select:** `[opt["name"] for opt in page["properties"]["Tags"]["multi_select"]]`

**Relation:** `page["properties"]["Owner"]["relation"]` (returns array of page references)

**Rollup:** `page["properties"]["Puzzle Chain"]["rollup"]` (varies by rollup type)

**Formula:** `page["properties"]["Act Index"]["formula"]["number"]`

**Checkbox:** `page["properties"]["Critical Path"]["checkbox"]`

**Date:** `page["properties"]["Date"]["date"]["start"]`

**Files:** `page["properties"]["Files & media"]["files"]`

### Filtering and Sorting

Use the database query endpoint with filters:

```python
notion.databases.query(
    database_id=ELEMENTS_DATABASE_ID,
    filter={
        "and": [
            {
                "property": "Basic Type",
                "select": {"equals": "Memory Token Image"}
            },
            {
                "property": "Status",
                "status": {"equals": "Done"}
            }
        ]
    },
    sorts=[
        {"property": "Last edited time", "direction": "descending"}
    ]
)
```

**Important:** Use the property TYPE in your filter (e.g., `"select"`, `"status"`, `"checkbox"`), not just `"property"`.

## Pagination

Notion API returns results in pages (max 100 items). Always handle pagination:

```python
from notion_client.helpers import iterate_paginated_api

# Automatically handles pagination
all_elements = []
for element in iterate_paginated_api(
    notion.databases.query,
    database_id=ELEMENTS_DATABASE_ID
):
    all_elements.append(element)
```

## Error Handling

Always wrap API calls in try-except blocks:

```python
from notion_client import APIErrorCode, APIResponseError

try:
    result = notion.databases.query(database_id=database_id)
except APIResponseError as error:
    if error.code == APIErrorCode.ObjectNotFound:
        print("Database not found or not shared with integration")
    elif error.code == APIErrorCode.RateLimited:
        print("Rate limited - wait before retrying")
    else:
        print(f"API Error: {error}")
```

## Rate Limits

Notion API has rate limits:
- **3 requests per second** per integration
- Implement exponential backoff for retries
- Cache results when possible

## Best Practices

1. **Fetch Fresh Schema Information:** Database schemas evolve. Before implementing automation, fetch the current schema:
   ```python
   database = notion.databases.retrieve(database_id=DATABASE_ID)
   properties = database["properties"]
   ```

2. **Handle Missing Properties Gracefully:** Not all elements will have all properties filled:
   ```python
   title_array = element["properties"]["Name"]["title"]
   name = title_array[0]["text"]["content"] if title_array else "Untitled"
   ```

3. **Use Rollup Properties:** Rollup properties automatically aggregate related data. Example: `"Narrative Threads"` in Puzzles rolls up from related Elements.

4. **Respect Relations:** When creating/updating pages, maintain referential integrity. If an Element references a Character, ensure that Character exists.

5. **Batch Operations:** For bulk updates, batch API calls and implement rate limiting.

6. **Test with Filters:** Before processing all records, test your queries with filters to work with smaller datasets.

## Automated Workflows

### Watch for Changes

To detect database changes:
1. Store last sync timestamp
2. Query with `last_edited_time` filter
3. Process only changed/new items

```python
notion.databases.query(
    database_id=ELEMENTS_DATABASE_ID,
    filter={
        "timestamp": "last_edited_time",
        "last_edited_time": {"after": last_sync_time}
    }
)
```

### Webhooks (Enterprise Only)

For real-time updates, Notion Enterprise supports webhooks, but they're not available for most integrations. Use polling instead.

## Troubleshooting

**"Object not found" errors:**
- Verify database is shared with integration
- Check database ID is correct
- Ensure integration has proper permissions

**"body failed validation" errors:**
- Check property types in your filter/query
- Verify property names match exactly (case-sensitive)
- Review Notion API version compatibility

**Empty results:**
- Check filter logic (use `"or"` for multiple conditions on same property)
- Verify data exists that matches your filter
- Try querying without filters first

**Property access errors:**
- Use `get()` method: `element["properties"].get("Name", {})`
- Check if property exists in schema before accessing
- Handle empty arrays/objects

## Additional Resources

- [Notion API Documentation](https://developers.notion.com/)
- [Notion SDK for Python](https://github.com/ramnes/notion-sdk-py)
- [Notion SDK for JavaScript](https://github.com/makenotion/notion-sdk-js)
- [references/api-patterns.md](references/api-patterns.md) - Common API patterns and examples
- [scripts/sync_to_tokens.py](scripts/sync_to_tokens.py) - Complete token sync implementation

## Quick Reference

```python
# Initialize client
from notion_client import Client

# Pre-configured token for About Last Night... databases
NOTION_TOKEN = "YOUR_NOTION_TOKEN_HERE"
notion = Client(auth=NOTION_TOKEN)

# Query database
results = notion.databases.query(database_id=DB_ID)

# Get page
page = notion.pages.retrieve(page_id=PAGE_ID)

# Update page
notion.pages.update(
    page_id=PAGE_ID,
    properties={"Status": {"status": {"name": "Done"}}}
)

# Create page
notion.pages.create(
    parent={"database_id": DB_ID},
    properties={"Name": {"title": [{"text": {"content": "New Item"}}]}}
)
```
