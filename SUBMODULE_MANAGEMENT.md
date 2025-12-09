# ALN Ecosystem Submodule Management Guide

## Overview

The ALN Ecosystem uses git submodules to share code between multiple repositories. This document explains how we've configured branch tracking to simplify submodule synchronization.

## Repository Structure

```
ALN-Ecosystem/                      # Parent repository
├── ALN-TokenData/                 # Direct submodule (token definitions)
├── ALNScanner/                    # Scanner submodule
│   └── data/ → ALN-TokenData      # Nested submodule
└── aln-memory-scanner/            # Scanner submodule
    └── data/ → ALN-TokenData      # Nested submodule
```

## The Problem We Solved

Previously, each submodule pointed to a **specific commit**:
- Updating ALN-TokenData required manual updates in 4+ places
- Each scanner had different versions of token data
- Synchronization was a multi-step, error-prone process

## The Solution: Branch Tracking

We've configured all submodules to **track branches** instead of commits:
- All submodules follow the `main` branch
- Single command updates everything
- Consistent versions across all repositories

## Configuration Details

### What Changed in .gitmodules

Each submodule now has branch tracking configured:

```ini
[submodule "ALN-TokenData"]
    path = ALN-TokenData
    url = https://github.com/maxepunk/ALN-TokenData.git
    branch = main          # ← Tracks main branch
    update = merge         # ← Uses merge strategy for updates
```

This configuration is set for:
- `ALN-TokenData` (direct reference)
- `ALNScanner` (scanner repository)
- `aln-memory-scanner` (scanner repository)
- Nested `data` submodules within each scanner

## Quick Commands

### Daily Workflow

```bash
# Update everything to latest
npm run sync

# Check what versions you have
npm run sync:status

# Quick update and commit
npm run sync:quick
```

### Complete Sync Workflow

```bash
# 1. Setup branch tracking (one-time)
npm run sync:setup

# 2. Update all submodules to latest
npm run sync:update

# 3. Check status
npm run sync:status

# 4. Commit and push everything
npm run sync:push-all
```

## Command Reference

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run sync` | Full sync with smart commit | Daily updates |
| `npm run sync:setup` | Configure branch tracking | Initial setup |
| `npm run sync:update` | Update to latest branches | Pull latest changes |
| `npm run sync:status` | Show all submodule versions | Check current state |
| `npm run sync:fetch` | Fetch without updating | Preview available updates |
| `npm run sync:push` | Push with submodules | Deploy changes |
| `npm run sync:push-all` | Push all repos | Complete deployment |
| `npm run sync:quick` | Update and auto-commit | Quick sync |

## Detailed Workflows

### Making Changes to Token Data

1. **Edit tokens.json**:
   ```bash
   cd ALN-TokenData
   # Make your changes
   git add tokens.json
   git commit -m "Update token configuration"
   git push origin main
   ```

2. **Sync everywhere**:
   ```bash
   cd ..
   npm run sync        # Updates all references
   npm run sync:push-all  # Pushes to all repos
   ```

### Updating After Someone Else's Changes

```bash
# One command updates everything!
npm run sync
```

### Checking What Needs Updating

```bash
# See current versions
npm run sync:status

# Fetch updates without applying
npm run sync:fetch
npm run sync:status  # Now shows available updates
```

### Emergency: Reverting to Specific Commits

If branch tracking causes issues, you can revert to commit tracking:

```bash
# Remove branch tracking
git config -f .gitmodules --unset submodule.ALN-TokenData.branch

# Pin to specific commit
cd ALN-TokenData
git checkout abc1234  # Specific commit
cd ..
git add ALN-TokenData
git commit -m "Pin ALN-TokenData to abc1234"
```

## How Branch Tracking Works

### Traditional Submodules (Commit Tracking)
```
Repository → Submodule@abc1234 (frozen at specific commit)
```
- Predictable but requires manual updates
- Different repos can have different versions
- Cascading updates needed

### Branch Tracking Submodules
```
Repository → Submodule@main (follows branch HEAD)
```
- Always gets latest when updating
- All repos stay synchronized
- Single command updates

### Update Strategies

We use **merge** strategy:
- Updates attempt to merge changes
- Preserves local modifications
- Conflicts require manual resolution

Alternative **rebase** strategy:
- Replays local changes on top
- Cleaner history
- Higher conflict risk

## Troubleshooting

### Issue: Merge Conflicts During Update

```bash
# If sync fails with conflicts
cd ALN-TokenData  # Or whichever submodule
git status        # See conflicts
# Resolve conflicts manually
git add .
git commit
cd ..
npm run sync      # Continue sync
```

### Issue: Submodule Not Updating

```bash
# Force update to latest
git submodule update --remote --force --recursive

# Reset if needed
git submodule foreach --recursive 'git reset --hard origin/main'
```

### Issue: Wrong Branch Being Tracked

```bash
# Check current configuration
git config -f .gitmodules --get submodule.ALN-TokenData.branch

# Change branch
git config -f .gitmodules submodule.ALN-TokenData.branch develop
git add .gitmodules
git commit -m "Track develop branch"
```

### Issue: Need Specific Version for Production

```bash
# Tag a release in ALN-TokenData
cd ALN-TokenData
git tag v1.0.0
git push origin v1.0.0

# Track the tag instead of branch
cd ..
git config -f .gitmodules submodule.ALN-TokenData.branch v1.0.0
```

## Making Code Changes to Submodules (PR Workflow)

When making **code changes** (not just token data updates) to a submodule like `aln-memory-scanner` or `ALNScanner`, use a feature branch workflow:

### Step 1: Create Feature Branch in Submodule

```bash
cd aln-memory-scanner  # or ALNScanner

# Create and checkout feature branch
git checkout -b feature/my-feature-name

# Make your changes
# ... edit files ...

# Commit changes
git add .
git commit -m "feat: Description of changes"
```

### Step 2: Push Feature Branch and Create PR

```bash
# Push feature branch to submodule's remote
git push -u origin feature/my-feature-name

# Create PR via GitHub CLI or web UI
# PR: feature/my-feature-name → main
```

### Step 3: Update Parent Repository Reference

```bash
cd ..  # Back to ALN-Ecosystem

# The parent now references the feature branch commit
git add aln-memory-scanner
git commit -m "chore: Update submodule to feature branch for testing"
git push
```

### Step 4: After Submodule PR is Merged

```bash
cd aln-memory-scanner
git checkout main
git pull origin main

cd ..
git add aln-memory-scanner
git commit -m "chore: Update submodule to merged main"
git push
```

### Example: Full Workflow

```bash
# 1. Feature branch in submodule
cd aln-memory-scanner
git checkout -b feature/url-parameter-handling
# ... make changes ...
git add index.html
git commit -m "feat: Add URL parameter handling for NFC deep linking"
git push -u origin feature/url-parameter-handling

# 2. Create PR for submodule (GitHub web or API)
# https://github.com/maxepunk/ALNPlayerScan/compare/main...feature/url-parameter-handling

# 3. Update parent to reference feature branch (for testing)
cd ..
git add aln-memory-scanner
git commit -m "chore: Test submodule feature branch"
git push

# 4. After submodule PR merged, update parent to main
cd aln-memory-scanner
git checkout main && git pull
cd ..
git add aln-memory-scanner
git commit -m "chore: Update submodule after PR merge"
git push
```

### Why Use Feature Branches for Code Changes?

| Direct Push to Main | Feature Branch + PR |
|---------------------|---------------------|
| No code review | Code review before merge |
| No CI checks | CI runs on PR |
| Hard to revert | Easy to revert PR |
| No discussion thread | PR provides discussion |
| Risk of breaking changes | Protected main branch |

**Rule of thumb:**
- **Token data updates** → Direct push to main is OK
- **Code changes** → Always use feature branch + PR

## Best Practices

### DO:
- ✅ Run `npm run sync` regularly
- ✅ Check `sync:status` before making changes
- ✅ Commit submodule updates with descriptive messages
- ✅ Test after syncing
- ✅ Use tags for production releases
- ✅ Use feature branches for code changes to submodules
- ✅ Create PRs for submodule code changes

### DON'T:
- ❌ Make changes directly in nested submodules
- ❌ Force push to submodule repositories
- ❌ Ignore merge conflicts
- ❌ Mix branch tracking and commit tracking
- ❌ Forget to push submodule changes
- ❌ Push code changes directly to main in submodules (use PRs)

## Architecture Benefits

### Before Branch Tracking
- 🔴 4+ manual commits for one change
- 🔴 Version mismatches common
- 🔴 Complex update procedures
- 🔴 Easy to forget a repository

### After Branch Tracking
- 🟢 Single command updates
- 🟢 Automatic synchronization
- 🟢 Consistent versions
- 🟢 Simple workflow

## Scripts Reference

### setup-branch-tracking.sh
- Configures all submodules for branch tracking
- Updates nested .gitmodules files
- One-time setup script

### sync-all.sh
- Fetches all updates
- Updates to latest branch heads
- Commits changes automatically
- Shows detailed status

## Migration Notes

### For Existing Clones
```bash
# Run setup script
npm run sync:setup

# Update to latest
npm run sync

# Verify
npm run sync:status
```

### For New Clones
```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/maxepunk/ALN-Ecosystem.git

# Setup is already done, just sync
cd ALN-Ecosystem/backend
npm run sync
```

## Summary

Branch tracking transforms submodule management from a complex multi-step process to simple single commands:

| Task | Before | After |
|------|--------|-------|
| Update all | 10+ commands | `npm run sync` |
| Check status | Navigate each repo | `npm run sync:status` |
| Deploy changes | Push each manually | `npm run sync:push-all` |

The system now maintains consistency automatically while preserving the flexibility to pin specific versions when needed.