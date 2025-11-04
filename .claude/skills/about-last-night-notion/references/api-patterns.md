# Common Notion API Patterns

This document provides reusable patterns for working with the About Last Night... Notion databases.

## Table of Contents

1. [Initialization and Setup](#initialization-and-setup)
2. [Database Queries](#database-queries)
3. [Page Operations](#page-operations)
4. [Handling Relations](#handling-relations)
5. [Property Access Patterns](#property-access-patterns)
6. [Pagination](#pagination)
7. [Error Handling](#error-handling)

## Initialization and Setup

### Python Setup
```python
import os
from notion_client import Client
from notion_client.helpers import iterate_paginated_api

# Pre-configured token for About Last Night... databases
NOTION_TOKEN = "YOUR_NOTION_TOKEN_HERE"

# Or use environment variable if you prefer
# NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "YOUR_NOTION_TOKEN_HERE")

# Initialize client
notion = Client(auth=NOTION_TOKEN)

# Database IDs
ELEMENTS_DB = "18c2f33d-583f-8020-91bc-d84c7dd94306"
CHARACTERS_DB = "18c2f33d-583f-8060-a6ab-de32ff06bca2"
PUZZLES_DB = "1b62f33d-583f-80cc-87cf-d7d6c4b0b265"
TIMELINE_DB = "1b52f33d-583f-80de-ae5a-d20020c120dd"
```

### JavaScript Setup
```javascript
const { Client } = require("@notionhq/client");

// Pre-configured token for About Last Night... databases
const NOTION_TOKEN = "YOUR_NOTION_TOKEN_HERE";

// Or use environment variable if you prefer
// const NOTION_TOKEN = process.env.NOTION_TOKEN || "YOUR_NOTION_TOKEN_HERE";

const notion = new Client({ auth: NOTION_TOKEN });

const ELEMENTS_DB = "18c2f33d-583f-8020-91bc-d84c7dd94306";
const CHARACTERS_DB = "18c2f33d-583f-8060-a6ab-de32ff06bca2";
const PUZZLES_DB = "1b62f33d-583f-80cc-87cf-d7d6c4b0b265";
const TIMELINE_DB = "1b52f33d-583f-80de-ae5a-d20020c120dd";
```

## Database Queries

### Simple Filter
```python
# Get all memory tokens
memory_tokens = notion.databases.query(
    database_id=ELEMENTS_DB,
    filter={
        "property": "Basic Type",
        "select": {"equals": "Memory Token Image"}
    }
)
```

### Compound Filter (AND)
```python
# Get done memory tokens from Act 1
results = notion.databases.query(
    database_id=ELEMENTS_DB,
    filter={
        "and": [
            {
                "property": "Basic Type",
                "select": {"equals": "Memory Token Image"}
            },
            {
                "property": "Status",
                "status": {"equals": "Done"}
            },
            {
                "property": "First Available",
                "select": {"equals": "Act 1"}
            }
        ]
    }
)
```

### Compound Filter (OR)
```python
# Get all memory token types
results = notion.databases.query(
    database_id=ELEMENTS_DB,
    filter={
        "or": [
            {"property": "Basic Type", "select": {"equals": "Memory Token Image"}},
            {"property": "Basic Type", "select": {"equals": "Memory Token Audio"}},
            {"property": "Basic Type", "select": {"equals": "Memory Token Video"}}
        ]
    }
)
```

### Filter by Relation
```python
# Get elements owned by a specific character
elements = notion.databases.query(
    database_id=ELEMENTS_DB,
    filter={
        "property": "Owner",
        "relation": {"contains": character_page_id}
    }
)

# Get elements with any owner
elements_with_owner = notion.databases.query(
    database_id=ELEMENTS_DB,
    filter={
        "property": "Owner",
        "relation": {"is_not_empty": True}
    }
)
```

### Filter by Date
```python
# Get recent timeline events
recent_events = notion.databases.query(
    database_id=TIMELINE_DB,
    filter={
        "property": "Date",
        "date": {"on_or_after": "2024-03-01"}
    }
)

# Get events within a range
range_events = notion.databases.query(
    database_id=TIMELINE_DB,
    filter={
        "and": [
            {"property": "Date", "date": {"on_or_after": "2024-03-15"}},
            {"property": "Date", "date": {"on_or_before": "2024-03-16"}}
        ]
    }
)
```

### Filter by Last Edited Time (Change Detection)
```python
from datetime import datetime, timedelta

# Get items edited in last 24 hours
yesterday = (datetime.now() - timedelta(days=1)).isoformat()
recent_changes = notion.databases.query(
    database_id=ELEMENTS_DB,
    filter={
        "timestamp": "last_edited_time",
        "last_edited_time": {"after": yesterday}
    }
)
```

### Sorting Results
```python
# Sort by date ascending
sorted_events = notion.databases.query(
    database_id=TIMELINE_DB,
    sorts=[{"property": "Date", "direction": "ascending"}]
)

# Multiple sort criteria
sorted_elements = notion.databases.query(
    database_id=ELEMENTS_DB,
    sorts=[
        {"property": "First Available", "direction": "ascending"},
        {"property": "Name", "direction": "ascending"}
    ]
)
```

## Page Operations

### Get Page by ID
```python
page = notion.pages.retrieve(page_id=page_id)
```

### Create Page
```python
new_element = notion.pages.create(
    parent={"database_id": ELEMENTS_DB},
    properties={
        "Name": {
            "title": [{"text": {"content": "New Element"}}]
        },
        "Basic Type": {
            "select": {"name": "Prop"}
        },
        "Status": {
            "status": {"name": "Idea/Placeholder"}
        }
    }
)
```

### Update Page
```python
updated_page = notion.pages.update(
    page_id=page_id,
    properties={
        "Status": {"status": {"name": "Done"}},
        "Critical Path": {"checkbox": True}
    }
)
```

### Update Relations
```python
# Add a relation
notion.pages.update(
    page_id=element_id,
    properties={
        "Owner": {
            "relation": [{"id": character_id}]
        }
    }
)

# Add multiple relations
notion.pages.update(
    page_id=puzzle_id,
    properties={
        "Puzzle Elements": {
            "relation": [
                {"id": element_id_1},
                {"id": element_id_2},
                {"id": element_id_3}
            ]
        }
    }
)
```

## Handling Relations

### Get Related Pages
```python
def get_related_pages(page, relation_property, notion):
    """Get all pages related via a relation property"""
    relation_refs = page["properties"][relation_property]["relation"]
    
    related_pages = []
    for ref in relation_refs:
        related_page = notion.pages.retrieve(page_id=ref["id"])
        related_pages.append(related_page)
    
    return related_pages

# Usage
element = notion.pages.retrieve(page_id=element_id)
owners = get_related_pages(element, "Owner", notion)
```

### Batch Fetch Relations
```python
def batch_fetch_relations(page, relation_property, notion):
    """More efficient relation fetching using concurrent requests"""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    relation_refs = page["properties"][relation_property]["relation"]
    
    def fetch_page(page_id):
        return notion.pages.retrieve(page_id=page_id)
    
    related_pages = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_page, ref["id"]): ref for ref in relation_refs}
        for future in as_completed(futures):
            related_pages.append(future.result())
    
    return related_pages
```

## Property Access Patterns

### Safe Property Access
```python
def safe_get_title(page, property_name):
    """Safely get title property"""
    title_array = page["properties"].get(property_name, {}).get("title", [])
    return title_array[0]["text"]["content"] if title_array else ""

def safe_get_rich_text(page, property_name):
    """Safely get rich text property"""
    rich_text = page["properties"].get(property_name, {}).get("rich_text", [])
    return rich_text[0]["text"]["content"] if rich_text else ""

def safe_get_select(page, property_name):
    """Safely get select property"""
    select_obj = page["properties"].get(property_name, {}).get("select")
    return select_obj["name"] if select_obj else None

def safe_get_multi_select(page, property_name):
    """Safely get multi-select property"""
    multi_select = page["properties"].get(property_name, {}).get("multi_select", [])
    return [opt["name"] for opt in multi_select]

def safe_get_relation(page, property_name):
    """Safely get relation property"""
    return page["properties"].get(property_name, {}).get("relation", [])
```

### Extract All Property Values
```python
def extract_element_data(element):
    """Extract all relevant data from an element page"""
    return {
        "id": element["id"],
        "name": safe_get_title(element, "Name"),
        "basic_type": safe_get_select(element, "Basic Type"),
        "status": element["properties"]["Status"]["status"]["name"] if element["properties"]["Status"]["status"] else None,
        "description": safe_get_rich_text(element, "Description/Text"),
        "first_available": safe_get_select(element, "First Available"),
        "narrative_threads": safe_get_multi_select(element, "Narrative Threads"),
        "owner_ids": [ref["id"] for ref in safe_get_relation(element, "Owner")],
        "files": element["properties"]["Files & media"]["files"],
        "created_time": element["created_time"],
        "last_edited_time": element["last_edited_time"]
    }
```

## Pagination

### Manual Pagination
```python
def get_all_results(database_id, notion, filter_obj=None):
    """Get all results from a database with manual pagination"""
    all_results = []
    has_more = True
    start_cursor = None
    
    while has_more:
        query_params = {"database_id": database_id}
        if filter_obj:
            query_params["filter"] = filter_obj
        if start_cursor:
            query_params["start_cursor"] = start_cursor
        
        response = notion.databases.query(**query_params)
        all_results.extend(response["results"])
        
        has_more = response["has_more"]
        start_cursor = response.get("next_cursor")
    
    return all_results
```

### Using Helper Functions
```python
from notion_client.helpers import iterate_paginated_api

# Iterate through all results
all_elements = []
for element in iterate_paginated_api(
    notion.databases.query,
    database_id=ELEMENTS_DB
):
    all_elements.append(element)

# Or collect all at once
from notion_client.helpers import collect_paginated_api

all_elements = collect_paginated_api(
    notion.databases.query,
    database_id=ELEMENTS_DB,
    filter={"property": "Status", "status": {"equals": "Done"}}
)
```

## Error Handling

### Complete Error Handling Pattern
```python
from notion_client import APIErrorCode, APIResponseError
import time

def safe_notion_request(func, *args, max_retries=3, **kwargs):
    """Execute a Notion API request with error handling and retries"""
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        
        except APIResponseError as error:
            if error.code == APIErrorCode.ObjectNotFound:
                print(f"Error: Object not found. Check ID and permissions.")
                return None
            
            elif error.code == APIErrorCode.RateLimited:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"Rate limited. Waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            
            elif error.code == APIErrorCode.ValidationError:
                print(f"Validation error: {error.message}")
                return None
            
            else:
                print(f"API Error: {error.code} - {error.message}")
                if attempt == max_retries - 1:
                    raise
                time.sleep(1)
                continue
        
        except Exception as e:
            print(f"Unexpected error: {e}")
            if attempt == max_retries - 1:
                raise
            time.sleep(1)
            continue
    
    return None

# Usage
result = safe_notion_request(
    notion.databases.query,
    database_id=ELEMENTS_DB,
    filter={"property": "Status", "status": {"equals": "Done"}}
)
```

## Complete Example: Character Analysis

```python
def analyze_character(character_id, notion):
    """Complete analysis of a character and their connections"""
    
    # Get character
    character = safe_notion_request(notion.pages.retrieve, page_id=character_id)
    if not character:
        return None
    
    # Extract basic info
    name = safe_get_title(character, "Name")
    char_type = safe_get_select(character, "Type")
    tier = safe_get_select(character, "Tier")
    
    # Get owned elements
    owned_refs = safe_get_relation(character, "Owned Elements")
    owned_elements = []
    for ref in owned_refs:
        element = safe_notion_request(notion.pages.retrieve, page_id=ref["id"])
        if element:
            owned_elements.append({
                "name": safe_get_title(element, "Name"),
                "type": safe_get_select(element, "Basic Type")
            })
    
    # Get timeline events
    events = safe_notion_request(
        notion.databases.query,
        database_id=TIMELINE_DB,
        filter={"property": "Characters Involved", "relation": {"contains": character_id}},
        sorts=[{"property": "Date", "direction": "ascending"}]
    )
    
    timeline = []
    if events:
        for event in events["results"]:
            timeline.append({
                "description": safe_get_title(event, "Description"),
                "date": event["properties"]["Date"]["date"]["start"] if event["properties"]["Date"]["date"] else None
            })
    
    # Get puzzles
    puzzle_refs = safe_get_relation(character, "Character Puzzles")
    puzzles = []
    for ref in puzzle_refs:
        puzzle = safe_notion_request(notion.pages.retrieve, page_id=ref["id"])
        if puzzle:
            puzzles.append(safe_get_title(puzzle, "Puzzle"))
    
    return {
        "name": name,
        "type": char_type,
        "tier": tier,
        "owned_elements": owned_elements,
        "timeline": timeline,
        "puzzles": puzzles
    }
```
