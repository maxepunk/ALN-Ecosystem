# About Last Night - Story Gap Analysis

## Purpose

This analysis identifies gaps in your narrative elements by cross-referencing:
- Character descriptions and backstories
- Timeline events
- Physical elements that players discover

## Setup Required

### 1. Notion Integration Access

The integration token must have access to all four databases:

1. Go to https://www.notion.so/my-integrations
2. Find or create an integration
3. Copy the Internal Integration Token
4. For EACH database (Elements, Characters, Puzzles, Timeline):
   - Open the database in Notion
   - Click "..." menu → "Add connections"
   - Select your integration

### 2. Verify Database IDs

The script uses these database IDs (update if needed):

```python
ELEMENTS_DB_ID = "18c2f33d-583f-8020-91bc-d84c7dd94306"
CHARACTERS_DB_ID = "18c2f33d-583f-8060-a6ab-de32ff06bca2"
PUZZLES_DB_ID = "1b62f33d-583f-80cc-87cf-d7d6c4b0b265"
TIMELINE_DB_ID = "1b52f33d-583f-80de-ae5a-d20020c120dd"
```

To get database IDs from URLs:
- Database URL: `https://www.notion.so/{workspace}/{DATABASE_ID}?v={view_id}`
- The DATABASE_ID is the 32-character identifier

### 3. Set Notion Token

The scripts use the `NOTION_TOKEN` environment variable (same as the existing `sync_notion_to_tokens.py` script).

**Option 1: Add to .env file (recommended)**
```bash
echo "NOTION_TOKEN=your_token_here" >> .env
```

**Option 2: Set as environment variable**
```bash
export NOTION_TOKEN="your_token_here"
```

## Running the Analysis

```bash
# Install dependencies
pip install notion-client --break-system-packages

# Run analysis
python3 analyze_story_gaps.py
```

## Output

The script generates:

1. **Console Report**: Character-by-character analysis showing:
   - Timeline events without corresponding elements
   - Character details not represented in elements
   - Coverage statistics

2. **JSON File** (`story_gaps_analysis.json`): Raw data for further processing

## What the Analysis Finds

### Timeline Events Not in Character Descriptions
Events that involve characters but aren't mentioned in their backstory/description.

### Character-by-Character Gaps

For each character:
- **Timeline Events WITHOUT Elements**: Events involving this character that don't have associated physical elements players can discover
- **Character Details NOT Represented in Elements**: Backstory, motivations, or secrets that aren't conveyed through any game elements

## Example Output

```
### DETECTIVE MORGAN
--------------------------------------------------------------------------------
Elements owned: 5
Elements associated: 12
Timeline events involved in: 8

**Timeline Events WITHOUT Elements (2):**
  • Confrontation at the warehouse
    Date: 2024-03-15
    Description: Morgan confronts the suspect...

**Character Details NOT Represented in Elements (1):**
  • BACKSTORY:
    Former military background and training in forensics...
```

## Interpreting Results

**High Priority**: Timeline events without elements are critical - players can't discover story information that isn't represented in physical game elements.

**Medium Priority**: Character details without elements may be acceptable for minor background information, but key motivations and secrets should have corresponding elements.

## Next Steps

After running the analysis:

1. Review gaps for each character
2. Identify which gaps need new elements
3. Create new elements in the Elements database
4. Link new elements to:
   - Timeline events (Timeline Event relation)
   - Characters (Owner relation)
   - Appropriate puzzles

## Troubleshooting

**403 Errors**: Integration doesn't have access to databases
- Solution: Share all four databases with the integration

**Property Not Found**: Database schema has changed
- Solution: Update property names in the script (lines 73-81, 114-120, 150-157)

**Empty Results**: Filters too restrictive or no data
- Solution: Check database content in Notion
