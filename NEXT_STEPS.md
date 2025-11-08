# Story Gap Analysis - Next Steps

## Current Status

I've created the analysis tools but encountered a **403 Forbidden** error when trying to access your Notion databases. This means the integration token needs to be granted access to the databases.

## Files Created

1. **`analyze_story_gaps.py`** - Main analysis script that will:
   - Fetch all characters and their backstories
   - Fetch all timeline events
   - Fetch all elements with narrative content
   - Identify gaps where story information isn't discoverable by players
   - Generate a detailed character-by-character report

2. **`test_notion_access.py`** - Diagnostic script to verify database access

3. **`STORY_GAP_ANALYSIS_README.md`** - Complete documentation for running the analysis

## What You Need to Do

### Step 1: Grant Database Access

The integration token needs access to all four databases:

1. Visit https://www.notion.so/my-integrations
2. Find your integration (or create a new one)
3. Copy the Internal Integration Token
4. For **each** of these databases:
   - Elements
   - Characters
   - Puzzles
   - Timeline

   Do the following:
   - Open the database in Notion
   - Click the **"..."** menu (top right)
   - Select **"Add connections"**
   - Choose your integration from the list

### Step 2: Set the Notion Token

The scripts use the `NOTION_TOKEN` environment variable (same as the existing sync script).

**Option 1: Add to .env file (recommended)**
```bash
# Create or edit .env file in project root
echo "NOTION_TOKEN=your_token_here" >> .env
```

**Option 2: Set as environment variable**
```bash
export NOTION_TOKEN="your_token_here"
```

### Step 3: Verify Access

```bash
python3 test_notion_access.py
```

This will test access to all four databases. You should see:
```
✓ SUCCESS - Retrieved X page(s)
```

For each database.

### Step 4: Run the Analysis

Once all tests pass:

```bash
python3 analyze_story_gaps.py
```

This will generate:
- **Console output**: Detailed character-by-character gap analysis
- **`story_gaps_analysis.json`**: Raw data for further processing

## What the Analysis Will Show You

### 1. Timeline Events Not in Character Descriptions
Events that involve characters but aren't mentioned in their backstories. This helps ensure character descriptions are complete.

### 2. For Each Character:

**Timeline Events WITHOUT Elements**
- Critical gaps where events exist but players have no way to discover them
- These need new elements created (documents, photos, tokens, etc.)

**Character Details NOT Represented in Elements**
- Backstory, motivations, or secrets that aren't conveyed through game elements
- Helps identify what additional narrative items to create

## Example Output

```
### DETECTIVE SARAH COLE
--------------------------------------------------------------------------------
Elements owned: 12
Elements associated: 18
Timeline events involved in: 15

**Timeline Events WITHOUT Elements (3):**
  • Meeting with Confidential Informant
    Date: 2024-03-10
    Description: Cole meets with CI about warehouse operations
    → NEED: Create CI's business card or meeting notes element

  • Discovery of Hidden Evidence
    Date: 2024-03-14
    Description: Cole finds key evidence linking suspects
    → NEED: Create evidence bag or photo element

**Character Details NOT Represented in Elements (2):**
  • BACKSTORY: Former military police background...
    → NEED: Create military commendation or service record

  • SECRETS: Undisclosed conflict of interest...
    → NEED: Create compromising document or email
```

## After Running the Analysis

1. Review the gaps for each character
2. Prioritize which gaps are critical for player experience
3. Create new elements in your Elements database:
   - Link to Timeline Events (if event-specific)
   - Link to Character as Owner
   - Add narrative content that conveys the missing information
   - Link to appropriate Puzzles if needed
4. Run the analysis again to verify gaps are filled

## Troubleshooting

**Still getting 403 errors?**
- Double-check that you clicked "Add connections" for ALL four databases
- Verify the integration is in the workspace that contains these databases
- Try creating a fresh integration token

**Property not found errors?**
- Your database schema may differ from expected
- Check the property names in your databases
- Update the script to match your actual property names

**Need help?**
- Check `STORY_GAP_ANALYSIS_README.md` for detailed documentation
- The scripts have comments explaining each step
- Property names are defined in lines 76-84 (characters), 120-126 (events), 160-167 (elements)

## Questions?

Let me know if you need help:
- Configuring the Notion integration
- Interpreting the results
- Modifying the analysis logic
- Adding custom filters or queries
