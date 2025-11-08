#!/usr/bin/env python3
"""
Diagnostic script to test Notion API access.
Run this first to verify your token and database permissions.
"""

from notion_client import Client
from pathlib import Path
import os
import sys

# Load environment variables from .env file if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # dotenv not installed, will use system environment variables
    pass

# Get token from environment
NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
if not NOTION_TOKEN:
    print("Error: NOTION_TOKEN not found")
    print("Please either:")
    print("  1. Add NOTION_TOKEN to .env file in project root, OR")
    print("  2. Set environment variable: export NOTION_TOKEN='your_token_here'")
    sys.exit(1)

# Database IDs (with dashes)
ELEMENTS_DB_ID = "18c2f33d-583f-8020-91bc-d84c7dd94306"
CHARACTERS_DB_ID = "18c2f33d-583f-8060-a6ab-de32ff06bca2"
PUZZLES_DB_ID = "1b62f33d-583f-80cc-87cf-d7d6c4b0b265"
TIMELINE_DB_ID = "1b52f33d-583f-80de-ae5a-d20020c120dd"

databases = {
    "Elements": ELEMENTS_DB_ID,
    "Characters": CHARACTERS_DB_ID,
    "Puzzles": PUZZLES_DB_ID,
    "Timeline": TIMELINE_DB_ID
}

def test_access():
    """Test access to all databases."""
    notion = Client(auth=NOTION_TOKEN)

    print("=" * 80)
    print("NOTION API ACCESS TEST")
    print("=" * 80)
    print(f"\nToken: {NOTION_TOKEN[:20]}...{NOTION_TOKEN[-10:]}")
    print()

    all_passed = True

    for name, db_id in databases.items():
        print(f"Testing {name} database...")
        print(f"  ID: {db_id}")

        try:
            # Try to query the database
            response = notion.request(
                path=f"databases/{db_id}/query",
                method="POST",
                body={"page_size": 1}
            )

            count = len(response.get("results", []))
            total = response.get("has_more", False)

            print(f"  ✓ SUCCESS - Retrieved {count} page(s)")

            # Get first result properties to show available fields
            if response.get("results"):
                props = response["results"][0]["properties"]
                print(f"  Available properties: {', '.join(list(props.keys())[:10])}")

        except Exception as e:
            print(f"  ✗ FAILED - {str(e)}")
            all_passed = False

        print()

    print("=" * 80)
    if all_passed:
        print("✓ ALL TESTS PASSED - You can run analyze_story_gaps.py")
        return 0
    else:
        print("✗ SOME TESTS FAILED")
        print("\nTroubleshooting:")
        print("1. Go to https://www.notion.so/my-integrations")
        print("2. Verify your integration exists and is active")
        print("3. For each failed database:")
        print("   - Open the database in Notion")
        print("   - Click '...' menu → 'Add connections'")
        print("   - Select your integration")
        print("4. Run this script again")
        return 1

if __name__ == "__main__":
    sys.exit(test_access())
