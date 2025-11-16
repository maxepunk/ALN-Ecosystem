# Security Notice

## About Last Night... Notion Integration - Private Project

This skill provides integration with the About Last Night... immersive game's Notion workspace. **This is a private project skill** that requires you to provide your own Notion integration token.

## Setting Up Your Integration Token

### 1. Create a Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "+ New integration"
3. Give it a name (e.g., "About Last Night Automation")
4. Select the workspace containing the About Last Night... databases
5. Copy the **Internal Integration Token** (starts with `secret_`)

### 2. Grant Database Access

After creating the integration, you must explicitly grant it access to each database:

1. Open each database in Notion:
   - Elements
   - Characters
   - Puzzles
   - Timeline

2. Click the "..." menu in the top right
3. Select "Add connections"
4. Find and select your integration by name
5. Repeat for all four databases

### 3. Configure Environment Variable

**Recommended: Use environment variables**

```bash
# Linux/macOS
export NOTION_TOKEN="secret_your_token_here"

# Or add to ~/.bashrc or ~/.zshrc for persistence
echo 'export NOTION_TOKEN="secret_your_token_here"' >> ~/.bashrc
```

**Alternative: Use .env file**

Create a `.env` file in the ALN-Ecosystem project root:

```env
NOTION_TOKEN=secret_your_token_here
```

The sync script automatically loads from `.env` if present (using python-dotenv).

## What This Token Grants Access To

The integration token you create will have access to the following databases (after you grant access):

- **Elements** (18c2f33d-583f-8020-91bc-d84c7dd94306)
- **Characters** (18c2f33d-583f-8060-a6ab-de32ff06bca2)
- **Puzzles** (1b62f33d-583f-80cc-87cf-d7d6c4b0b265)
- **Timeline** (1b52f33d-583f-80de-ae5a-d20020c120dd)

The token can:
- ✅ Read all data from these databases
- ✅ Query and filter database entries
- ✅ Read page contents and properties
- ✅ Update page properties (if integration permissions allow)
- ✅ Create new pages in these databases (if integration permissions allow)

## Security Best Practices

### ✅ DO:

- **Use environment variables** for token storage (never hardcode in scripts)
- **Keep this skill file private** (it contains database IDs and project structure)
- **Set minimal permissions** when creating integration (read-only if you only sync)
- **Use this token only** for your own About Last Night... project work
- **Store the skill** in a secure, private location
- **Revoke and recreate** tokens if they may have been exposed
- **Use separate tokens** for development and production environments

### ❌ DON'T:

- **Share this token** with untrusted third parties
- **Commit tokens to git** (use .env with .gitignore)
- **Share this skill file publicly** (e.g., GitHub, public forums)
- **Include tokens in client-side** web applications
- **Hardcode tokens** in Python scripts or configuration files
- **Reuse tokens** across multiple projects

## Revoking Access

If you need to revoke a token (e.g., it was accidentally exposed):

1. Go to https://www.notion.so/my-integrations
2. Find your integration (e.g., "About Last Night Automation")
3. Click on it to view details
4. Click "Show" next to Internal Integration Token
5. Click "Regenerate" to create a new token (invalidates old one)
6. Or click "Delete integration" to remove completely
7. Update your `NOTION_TOKEN` environment variable with the new token

## Using Tokens in Code

### Python Example (Recommended)

```python
import os
from notion_client import Client

# Load from environment
NOTION_TOKEN = os.environ.get("NOTION_TOKEN")

if not NOTION_TOKEN:
    print("Error: NOTION_TOKEN environment variable not set")
    print("Set it with: export NOTION_TOKEN='your_token_here'")
    exit(1)

# Initialize client
notion = Client(auth=NOTION_TOKEN)
```

### Python with .env File

```python
import os
from pathlib import Path
from notion_client import Client

# Load .env file
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass  # dotenv not installed, use system env vars

NOTION_TOKEN = os.environ.get("NOTION_TOKEN")

if not NOTION_TOKEN:
    raise ValueError("NOTION_TOKEN not found in environment or .env file")

notion = Client(auth=NOTION_TOKEN)
```

## Token Scopes and Permissions

Notion integrations have workspace-level permissions:

- **Read content**: Can read all shared databases and pages
- **Update content**: Can modify shared databases and pages
- **Insert content**: Can create new pages in shared databases

**Best Practice**: When creating your integration, select only the permissions you need. If you only sync data (read-only), don't grant insert/update permissions.

## Monitoring Token Usage

Notion doesn't provide detailed token usage logs, but you can:

1. Monitor your integration's activity in Notion's audit log (Enterprise feature)
2. Check "Last edited by" in database pages to see integration changes
3. Review your sync script logs for API calls

## Questions?

**If you're unsure about token security:**
- Keep tokens in environment variables or .env files (never in code)
- Never commit tokens to version control (add .env to .gitignore)
- Use different tokens for development and production
- Revoke and recreate tokens if they may have been exposed
- Keep this skill file private (it's project-specific)

## Additional Security Resources

- [Notion API Authorization](https://developers.notion.com/docs/authorization)
- [Notion Integration Security Best Practices](https://developers.notion.com/docs/create-a-notion-integration#give-your-integration-page-permissions)
- [Environment Variables Guide](https://12factor.net/config)
