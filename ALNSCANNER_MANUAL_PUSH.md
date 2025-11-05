# ALNScanner Submodule Manual Push Instructions

**Date:** 2025-11-05
**Status:** ⚠️ Local commits need manual push to remote

---

## Current Situation

The ALNScanner submodule has **2 new local commits** that complete Phase 2 frontend work:

### Commits Pending Push

1. **21a4b81** - `feat(P1.4): implement frontend socket cleanup and reconnection handling`
   - Socket cleanup before new connection
   - Listener removal on reconnection
   - beforeunload handler for clean disconnect
   - Files: `js/network/orchestratorClient.js`, `index.html`

2. **18d45bd** - `feat(P0.2): implement offline queue ACK confirmation (frontend)`
   - HTTP batch endpoint usage with batchId
   - Wait for batch:ack WebSocket event before clearing queue
   - Idempotency and retry safety
   - File: `js/network/networkedQueueManager.js`

---

## Why Manual Push Is Required

The ALNScanner submodule uses GitHub HTTPS authentication:
```
origin: https://github.com/maxepunk/ALNScanner.git
```

The git proxy only has authorization for the parent repository (ALN-Ecosystem), not for submodules. Therefore, the submodule must be pushed manually with GitHub credentials.

---

## How To Push Manually

### Option 1: GitHub CLI (Recommended)
```bash
cd /home/user/ALN-Ecosystem/ALNScanner

# Authenticate with GitHub
gh auth login

# Push to main branch
git checkout -b main
git push origin HEAD:main
```

### Option 2: Personal Access Token
```bash
cd /home/user/ALN-Ecosystem/ALNScanner

# Create a Personal Access Token (PAT) at:
# https://github.com/settings/tokens
# Scope needed: repo (Full control of private repositories)

# Checkout main and push with token:
git checkout -b main
git push https://[YOUR_TOKEN]@github.com/maxepunk/ALNScanner.git HEAD:main
```

### Option 3: Git Credential Manager
```bash
cd /home/user/ALN-Ecosystem/ALNScanner

# Configure credential helper (if not already configured)
git config credential.helper store

# Checkout and push (will prompt for credentials)
git checkout -b main
git push origin HEAD:main
# Enter GitHub username and Personal Access Token when prompted
```

### Option 4: SSH (if SSH key configured)
```bash
cd /home/user/ALN-Ecosystem/ALNScanner

# Change remote to SSH
git remote set-url origin git@github.com:maxepunk/ALNScanner.git

# Checkout and push
git checkout -b main
git push origin HEAD:main

# Revert back to HTTPS if needed
git remote set-url origin https://github.com/maxepunk/ALNScanner.git
```

---

## Verification After Push

After successfully pushing the submodule, verify with:

```bash
# In ALNScanner directory
cd /home/user/ALN-Ecosystem/ALNScanner
git status
# Should show: "Your branch is up to date with 'origin/main'"

# In parent directory
cd /home/user/ALN-Ecosystem
git status
# Should show: "nothing to commit, working tree clean"
```

---

## What If I Don't Push Now?

**The work is still safe!** The parent repository tracks the specific submodule commit hash (18d45bd).

**Impacts of not pushing immediately:**
- ✅ Local work is safe and committed
- ✅ Parent repo references correct commits
- ⚠️ Others can't fetch the submodule commits from GitHub until pushed
- ⚠️ `git submodule update --remote` won't see these commits yet
- ⚠️ CI/CD pipelines may fail if they try to fetch the submodule

**When you're ready to push:**
Just follow the manual push instructions above. The commits are safely stored locally in the ALNScanner submodule.

---

## Parent Repository Status ✅

**Branch:** `claude/merge-orchestrator-auth-fixes-011CUqZktJWU9nUsv2AuLzBc`

**Latest Commit:** `bc3904b0` - chore: update ALNScanner submodule with P1.4 and P0.2 frontend implementations

**Submodule Reference:** Parent repo correctly references commit `18d45bd`

**Verification:**
```bash
cd /home/user/ALN-Ecosystem
git ls-tree HEAD ALNScanner
# Output: 160000 commit 18d45bd... ALNScanner
# ✅ Parent tracks correct submodule commit
```

---

## Implementation Summary

### P1.4: Frontend Socket Cleanup ✅

**Files Modified:**
- `ALNScanner/js/network/orchestratorClient.js` - 3 methods enhanced
- `ALNScanner/index.html` - beforeunload handler added

**What It Does:**
- Cleans up old socket before creating new connection
- Removes all listeners before registering new ones
- Enhanced cleanup() method with proper socket disposal
- beforeunload handler for clean disconnect on page close

**Benefits:**
- No ghost connections (multiple sockets per device)
- No listener accumulation (fixes MaxListenersExceeded)
- Clean reconnection after network failures
- Immediate server-side cleanup on tab close

---

### P0.2: Offline Queue ACK ✅

**Files Modified:**
- `ALNScanner/js/network/networkedQueueManager.js` - syncQueue() rewritten, 2 methods added

**What It Does:**
- Generates unique batchId for each queue sync
- POST to `/api/scan/batch` instead of individual WebSocket emits
- Waits for `batch:ack` WebSocket event before clearing queue
- Preserves queue on failure for retry

**Benefits:**
- Queue only cleared AFTER server confirms receipt
- No data loss on network failures
- Idempotency prevents duplicate processing
- Timeout handling (60s) ensures no infinite waits

---

## Testing Validation

### P1.4 Manual Test Plan

**Ghost Connection Prevention:**
```
1. Open GM Scanner → Check server: 1 socket
2. Refresh page 5 times
3. Check server → Should still be 1 socket (not 6!)
4. Close tab
5. Wait 2 seconds
6. Check server → Should be 0 sockets
```

**Reconnection:**
```
1. Open GM Scanner, scan 3 tokens
2. Disable network (DevTools → Offline)
3. Wait 10 seconds
4. Enable network
5. Verify: Scanner reconnects automatically
6. Verify: No duplicate listeners warning in console
```

---

### P0.2 Manual Test Plan

**Queue Preservation on Failure:**
```
1. Open GM Scanner
2. Disable network
3. Scan 3 tokens (queued locally)
4. Enable network
5. Stop backend server (simulate failure)
6. Click "Upload Queue"
7. Verify: Upload fails, queue PRESERVED
8. Start backend server
9. Click "Upload Queue" again
10. Verify: Same 3 tokens uploaded (idempotency works)
```

**ACK-Based Clearing:**
```
1. Open GM Scanner
2. Disable network
3. Scan 3 tokens
4. Enable network
5. Click "Upload Queue"
6. Monitor console logs
7. Verify: "Batch uploaded successfully"
8. Verify: "Received batch:ack from server"
9. Verify: "Batch acknowledged by server - clearing queue"
10. Verify: Queue cleared ONLY after ACK received
```

---

## Next Steps

1. **Push ALNScanner Submodule** (Manual - see options above)
   - Choose one of the 4 push methods
   - Verify successful push
   - Time: ~5-10 minutes

2. **Test with Physical Devices** (Recommended)
   - Deploy updated ALNScanner to test server
   - Test P1.4: Refresh page, check ghost connections
   - Test P0.2: Scan offline, upload queue
   - Verify both features work end-to-end

3. **Update Production** (When ready)
   - Deploy backend (already complete from Phase 2)
   - Deploy ALNScanner (after push)
   - Have all GMs refresh browsers (clear cache)
   - Monitor for connection stability

---

## Commit Hashes Reference

```
ALNScanner Submodule:
18d45bd - feat(P0.2): implement offline queue ACK confirmation (frontend)
21a4b81 - feat(P1.4): implement frontend socket cleanup and reconnection handling
74954a9 - docs: comprehensive CLAUDE.md reorganization and enhancement (base)

Parent Repo:
bc3904b0 - chore: update ALNScanner submodule with P1.4 and P0.2 frontend implementations
d8690763 - docs: add comprehensive implementation status and progress validation
e14fe015 - docs: add comprehensive ALNScanner work redo guide
64d47b26 - fix: reset ALNScanner submodule to available remote commit
```

---

**Prepared by:** Claude Code
**Date:** 2025-11-05
**Phase:** 2 Frontend Complete (P1.4 + P0.2)
**Status:** Ready for manual push to remote
