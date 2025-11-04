# Security Notice

## Pre-Configured Integration Token

This skill includes a pre-configured Notion integration token for convenient access to the About Last Night... databases:

```
YOUR_NOTION_TOKEN_HERE
```

## What This Token Grants Access To

This integration token has been granted access to the following databases:
- **Elements** (18c2f33d-583f-8020-91bc-d84c7dd94306)
- **Characters** (18c2f33d-583f-8060-a6ab-de32ff06bca2)
- **Puzzles** (1b62f33d-583f-80cc-87cf-d7d6c4b0b265)
- **Timeline** (1b52f33d-583f-80de-ae5a-d20020c120dd)

The token can:
- ✅ Read all data from these databases
- ✅ Query and filter database entries
- ✅ Read page contents and properties
- ✅ Update page properties
- ✅ Create new pages in these databases

## Security Best Practices

### ✅ DO:
- Keep this skill file private
- Use this token only for your own About Last Night... project work
- Store the skill in a secure location
- Use environment variables when sharing code with others

### ❌ DON'T:
- Share this skill file publicly (e.g., GitHub, public forums)
- Include this token in any public repositories
- Share the token with untrusted third parties
- Use this token in client-side web applications

## Revoking Access

If you need to revoke this token:

1. Go to https://www.notion.so/my-integrations
2. Find the "About Last Night Automation" integration
3. Click on it to view details
4. Click "Revoke" or "Delete" to disable the token
5. Create a new integration if you need continued access

## Alternative: Environment Variables

For production use or when sharing code, always use environment variables:

```python
import os
NOTION_TOKEN = os.environ.get("NOTION_TOKEN")

if not NOTION_TOKEN:
    print("Error: NOTION_TOKEN environment variable not set")
    exit(1)

notion = Client(auth=NOTION_TOKEN)
```

Set the environment variable:
```bash
export NOTION_TOKEN="YOUR_NOTION_TOKEN_HERE"
```

## Why Is the Token Included?

The token is included in this skill for convenience when working with AI agents and automation scripts. Since this is a private project skill, the token enables immediate functionality without additional setup steps.

However, always be mindful of where this skill file is stored and who has access to it.

## Questions?

If you're unsure about token security:
- Keep the token in this private skill file only
- Never commit it to version control
- Use environment variables when sharing code
- Revoke and recreate tokens if they may have been exposed
