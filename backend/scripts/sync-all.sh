#!/bin/bash
# Sync all submodules to their latest branch heads
# This script updates all submodules and commits the changes

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 ALN System Full Sync"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Navigate to repository root
cd "$(git rev-parse --show-toplevel)"

# Step 1: Fetch all updates
echo "📥 Fetching all remote updates..."
git fetch origin
git submodule foreach --recursive 'git fetch origin'
echo -e "${GREEN}✓${NC} All remotes fetched"
echo ""

# Step 2: Update all submodules to latest branch heads
echo "🔄 Updating submodules to latest branch heads..."
if git submodule update --remote --recursive --merge; then
    echo -e "${GREEN}✓${NC} All submodules updated"
else
    echo -e "${YELLOW}⚠${NC} Some submodules had merge conflicts"
    echo "   Resolve conflicts manually, then run this script again"
    exit 1
fi
echo ""

# Step 3: Check for changes in each submodule
echo "📊 Checking submodule status..."
CHANGES_FOUND=false

# Check ALN-TokenData
cd ALN-TokenData
if ! git diff --quiet HEAD origin/main; then
    echo -e "${YELLOW}●${NC} ALN-TokenData has updates"
    CHANGES_FOUND=true
else
    echo -e "${GREEN}✓${NC} ALN-TokenData is up to date"
fi
cd ..

# Check scanner submodules
for scanner in ALNScanner aln-memory-scanner; do
    if [ -d "$scanner" ]; then
        cd "$scanner"
        if ! git diff --quiet HEAD origin/main; then
            echo -e "${YELLOW}●${NC} $scanner has updates"
            CHANGES_FOUND=true
        else
            echo -e "${GREEN}✓${NC} $scanner is up to date"
        fi
        cd ..
    fi
done
echo ""

# Step 4: Commit changes if any
if [ "$CHANGES_FOUND" = true ]; then
    echo "💾 Committing submodule updates..."
    git add -A

    # Generate commit message with details
    COMMIT_MSG="chore: Sync all submodules to latest

Updated submodules:"

    # Add details for each submodule
    git submodule status --recursive | while read -r line; do
        COMMIT_MSG="$COMMIT_MSG
- $line"
    done

    git commit -m "$COMMIT_MSG" || {
        echo -e "${YELLOW}⚠${NC} No changes to commit"
    }
    echo -e "${GREEN}✓${NC} Changes committed"
else
    echo -e "${GREEN}✓${NC} No updates needed - all submodules are current"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Sync complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Status:"
git submodule status --recursive
echo ""
echo "💡 To push changes: git push origin main"