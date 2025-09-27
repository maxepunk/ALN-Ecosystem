#!/bin/bash
# Setup git submodules to track branches instead of specific commits
# This enables single-command updates for all submodules

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Submodule Branch Tracking Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will configure all submodules to track their main branches"
echo "instead of specific commits, enabling easier synchronization."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Navigate to repository root
cd "$(git rev-parse --show-toplevel)"

echo "📝 Configuring main repository submodules..."

# Configure ALN-TokenData to track main branch
git config -f .gitmodules submodule.ALN-TokenData.branch main
git config -f .gitmodules submodule.ALN-TokenData.update merge
echo -e "${GREEN}✓${NC} ALN-TokenData configured"

# Configure ALNScanner to track main branch
git config -f .gitmodules submodule.ALNScanner.branch main
git config -f .gitmodules submodule.ALNScanner.update merge
echo -e "${GREEN}✓${NC} ALNScanner configured"

# Configure aln-memory-scanner to track main branch
git config -f .gitmodules submodule.aln-memory-scanner.branch main
git config -f .gitmodules submodule.aln-memory-scanner.update merge
echo -e "${GREEN}✓${NC} aln-memory-scanner configured"

echo ""
echo "📝 Configuring nested submodules in scanners..."

# Configure nested ALN-TokenData in ALNScanner
if [ -d "ALNScanner" ]; then
    cd ALNScanner
    if [ -f ".gitmodules" ]; then
        git config -f .gitmodules submodule.data.branch main
        git config -f .gitmodules submodule.data.update merge

        # Check if there are changes to commit
        if ! git diff --quiet .gitmodules; then
            git add .gitmodules
            git commit -m "chore: Configure data submodule to track main branch" || true
            echo -e "${YELLOW}⚠${NC} ALNScanner: .gitmodules updated (needs push)"
        else
            echo -e "${GREEN}✓${NC} ALNScanner: Already configured"
        fi
    fi
    cd ..
fi

# Configure nested ALN-TokenData in aln-memory-scanner
if [ -d "aln-memory-scanner" ]; then
    cd aln-memory-scanner
    if [ -f ".gitmodules" ]; then
        git config -f .gitmodules submodule.data.branch main
        git config -f .gitmodules submodule.data.update merge

        # Check if there are changes to commit
        if ! git diff --quiet .gitmodules; then
            git add .gitmodules
            git commit -m "chore: Configure data submodule to track main branch" || true
            echo -e "${YELLOW}⚠${NC} aln-memory-scanner: .gitmodules updated (needs push)"
        else
            echo -e "${GREEN}✓${NC} aln-memory-scanner: Already configured"
        fi
    fi
    cd ..
fi

echo ""
echo "📝 Committing main repository changes..."

# Commit main repo .gitmodules if changed
if ! git diff --quiet .gitmodules; then
    git add .gitmodules
    git commit -m "chore: Configure all submodules to track main branches

- Enables single-command updates with: git submodule update --remote --recursive
- Submodules now follow branch HEAD instead of specific commits
- Simplifies synchronization workflow"
    echo -e "${GREEN}✓${NC} Main repository .gitmodules updated"
else
    echo -e "${GREEN}✓${NC} Main repository already configured"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Branch tracking setup complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo "   1. Push scanner changes (if any):"
echo "      git submodule foreach 'git push origin main || :'"
echo ""
echo "   2. Push main repository:"
echo "      git push origin main"
echo ""
echo "   3. Update all submodules to latest:"
echo "      git submodule update --remote --recursive --merge"
echo ""
echo "🚀 Quick commands now available:"
echo "   npm run sync        # Update all submodules to latest"
echo "   npm run sync:status # Check submodule status"
echo "   npm run sync:push   # Push with submodule changes"
echo ""