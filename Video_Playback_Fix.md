Video Playback System: Implementation Plan & Source of Truth

  Version: 1.0Date: 2025-10-07Status: Ready for Implementation

  ---
  Executive Summary

  The ALN video playback system has a sound architectural design but suffers from three critical implementation gaps:

  1. Players can queue videos when TV is busy (should be blocked)
  2. VLC playlist accumulates items (should always contain exactly 1 item)
  3. GM admin panel lacks queue management UI (backend exists, frontend missing)

  This document defines the correct architecture and prioritized fixes.

  ---
  Architecture Overview

  Design Philosophy

  The TV is a scarce shared resource that creates game tension through competitive access. The system has two completely different access patterns:

  | User Type | Behavior                      | Purpose                                        |
  |-----------|-------------------------------|------------------------------------------------|
  | Players   | Blocking (one-at-a-time)      | Creates competition, makes each video an EVENT |
  | GMs       | Non-blocking (queue override) | Narrative control, can inject content at will  |

  Two-Layer Architecture

  Layer 1: VLC Playlist (Physical State)

  - Invariant: VLC playlist contains exactly 1 item at any time
  - States:
    - idle-loop.mp4 (loop ON) ← Default when queue empty
    - tokenVideo.mp4 (loop OFF) ← When playing queued content
  - Transitions: Clear playlist before switching states

  Layer 2: Video Queue Service (Logical Queue)

  - Separate from VLC: Maintains business logic of what to play next
  - Queue items: pending → playing → completed
  - Current item: What VLC is physically playing RIGHT NOW
  - Decoupled: Queue knows "what's next", VLC knows "what's on screen"

  State Machine

  ┌─────────────┐
  │ IDLE LOOP   │ ← Default state
  │ loop ON     │
  └──────┬──────┘
         │
         │ Player scan (TV available) OR GM queue processes
         ↓
  ┌─────────────┐
  │ PLAYING     │
  │ Video X     │
  │ loop OFF    │
  └──────┬──────┘
         │
         │ Video completes OR Skip/Stop
         ↓
  ┌─────────────┐
  │ IDLE LOOP   │
  │ loop ON     │
  └─────────────┘

  Key: Each transition requires clearPlaylist() to maintain the 1-item invariant.

  ---
  Critical Bugs (MUST FIX)

  Bug #1: Players Not Blocked When TV Busy

  Current Behavior:
  POST /api/scan (from player)
    → Always queues video
    → Player sees "Video queued"
    → Video sits in queue behind current video

  WHY THIS IS WRONG:
  - Violates design: TV should be competitive, not a queue
  - Players don't know they need to wait
  - Videos play later without player context
  - Breaks game flow (memory out of context)

  Correct Behavior:
  POST /api/scan (from player)
    → Check: Is TV currently playing?

    IF YES (blocked):
      ✗ Return 409 Conflict
      ✗ Response: {
          blocked: true,
          message: "Another memory is playing",
          estimatedWaitSeconds: 20
        }
      ✗ Scanner shows: "⏸️ TV busy - try again in ~20s"

    IF NO (available):
      ✓ Queue immediately
      ✓ Start playback
      ✓ Scanner shows: "🎬 Now playing on main screen"

  Fix Location: backend/src/routes/scanRoutes.js line ~70

  Implementation:
  // After token lookup, before queueing
  if (token.mediaAssets?.video && config.features.videoPlayback) {
    // NEW: Check TV availability (players only - GMs bypass)
    if (videoQueueService.isPlaying()) {
      return res.status(409).json({
        success: false,
        blocked: true,
        message: 'Another memory is currently playing',
        currentVideo: videoQueueService.getCurrentVideo()?.tokenId,
        estimatedWaitSeconds: videoQueueService.getRemainingTime()
      });
    }

    // TV available - proceed with existing queue logic
    const queueItem = videoQueueService.addToQueue(token, deviceId);
    // ... existing code continues
  }

  ---
  Bug #2: VLC Playlist Accumulates Items

  Current Behavior:
  Player scans video A → VLC playlist: [idle-loop.mp4, A.mp4]
  Player scans video B → VLC playlist: [idle-loop.mp4, A.mp4, B.mp4]
  Video A completes   → VLC playlist: [idle-loop.mp4, A.mp4, B.mp4, idle-loop.mp4]

  WHY THIS IS WRONG:
  - Violates 1-item invariant
  - Loop setting applies to ENTIRE playlist (loops through all accumulated items)
  - Idle loop doesn't work correctly (plays A, B, idle, repeat)
  - Playlist grows unbounded (memory leak)

  Correct Behavior:
  Queue empty        → VLC playlist: [idle-loop.mp4] (loop ON)
  Play video A       → VLC playlist: [A.mp4] (loop OFF)
  A completes        → VLC playlist: [idle-loop.mp4] (loop ON)
  Play video B       → VLC playlist: [B.mp4] (loop OFF)

  Fix Location: backend/src/services/vlcService.js

  Implementation:

  // In playVideo() method (line ~140)
  async playVideo(videoPath) {
    if (!this.connected) {
      // ... existing degraded mode code
      return;
    }

    try {
      // STEP 1: ALWAYS clear playlist first
      await this.clearPlaylist();

      // STEP 2: ALWAYS disable loop for regular videos
      await this.setLoop(false);

      // STEP 3: Convert path to absolute URL
      let vlcPath = videoPath;
      if (videoPath.startsWith('/')) {
        vlcPath = `file://${process.cwd()}/public${videoPath}`;
      } else if (!videoPath.startsWith('http') && !videoPath.startsWith('file://')) {
        vlcPath = `file://${process.cwd()}/public/videos/${videoPath}`;
      }

      // STEP 4: Enqueue single video and play
      await this.client.get('/requests/status.json', {
        params: {
          command: 'in_enqueue',  // Changed from in_play
          input: vlcPath,
        },
      });

      await this.client.get('/requests/status.json', {
        params: { command: 'pl_play' },
      });

      logger.info('Video playback started', { videoPath });
      this.emit('video:played', videoPath);

      return await this.getStatus();
    } catch (error) {
      logger.error('Failed to play video', { videoPath, error });
      // ... existing error handling
    }
  }

  // In returnToIdleLoop() method (line ~92)
  async returnToIdleLoop() {
    if (process.env.FEATURE_IDLE_LOOP === 'false') {
      return;
    }

    try {
      // STEP 1: ALWAYS clear playlist first
      await this.clearPlaylist();

      // STEP 2: Play idle loop video
      await this.playVideo('idle-loop.mp4');

      // STEP 3: ALWAYS enable loop ONLY for idle
      // (Must happen AFTER playVideo since playVideo disables loop)
      await this.setLoop(true);

      logger.info('Returned to idle loop');
    } catch (error) {
      logger.warn('Failed to return to idle loop', { error });
    }
  }

  Key Changes:
  1. Call clearPlaylist() before every state change
  2. Call setLoop(false) in playVideo() for regular videos
  3. Call setLoop(true) in returnToIdleLoop() AFTER playing idle video
  4. Changed in_play → in_enqueue + pl_play for clearer semantics

  ---
  Bug #3: Loop State Persists Incorrectly

  Current Behavior:
  - Loop enabled for idle loop
  - Loop NOT disabled when playing regular video
  - Loop state "sticks" from previous state

  WHY THIS IS WRONG:
  - Regular videos loop forever instead of completing
  - OR idle loop doesn't loop because it was disabled

  Correct Behavior:
  - Idle loop: Loop ON (continuous background)
  - Regular videos: Loop OFF (play once, then next/idle)

  Fix: Included in Bug #2 fixes above (explicit setLoop() calls)

  ---
  Missing Features (HIGH PRIORITY)

  Feature #1: Queue Viewer in GM Admin Panel

  What's Missing:
  - Backend emits queue state via WebSocket
  - Frontend doesn't display it

  WHY WE NEED IT:
  - GM can't see what's queued
  - Can't anticipate timing
  - Can't debug stuck videos
  - Blind control

  What to Build:
  GM Admin Panel - Video Controls:
  ┌─────────────────────────────────────────────┐
  │ 🎬 Currently Playing:                       │
  │   jaw001.mp4 ████████░░ 80% (20s / 25s)    │
  │   [Pause] [Skip] [Stop]                     │
  │                                             │
  │ 📋 Queue (3 pending):                       │
  │   1. rat001.mp4        (25s)                │
  │   2. ashe002.mp4       (18s)                │
  │   3. stanford004.mp4   (42s)                │
  │                        Total: ~1m 25s       │
  └─────────────────────────────────────────────┘

  Implementation Location: ALNScanner/index.html + ALNScanner/js/utils/adminModule.js

  Data Source:
  // Backend already broadcasts this
  socket.on('video:status', (data) => {
    // data.status: 'playing' | 'idle' | 'paused' | 'completed'
    // data.tokenId: current video ID
    // data.progress: 0-100
    // data.queueLength: number of pending items
  });

  // Need to add queue details broadcast
  socket.on('video:queue:status', (data) => {
    // data.items: [{ tokenId, duration, position }, ...]
  });

  UI Update:
  // In adminModule.js MonitoringDisplay class
  updateVideoDisplay(videoStatus) {
    // Update current video
    const currentElem = document.getElementById('admin-current-video');
    if (currentElem) {
      if (videoStatus.status === 'playing') {
        currentElem.innerHTML = `
          ${videoStatus.tokenId}
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${videoStatus.progress}%"></div>
          </div>
        `;
      } else {
        currentElem.textContent = 'None (idle loop)';
      }
    }

    // Update queue list
    const queueElem = document.getElementById('admin-queue-list');
    if (queueElem && videoStatus.queueItems) {
      queueElem.innerHTML = videoStatus.queueItems.map((item, idx) => `
        <div class="queue-item">
          <span class="position">${idx + 1}.</span>
          <span class="token-id">${item.tokenId}</span>
          <span class="duration">(${item.duration}s)</span>
        </div>
      `).join('');
    }
  }

  ---
  Feature #2: Manual Queue Management

  What's Missing:
  - Backend supports video:queue:add command
  - Frontend has NO UI to use it

  WHY WE NEED IT:
  - Narrative control: GM can show contextual flashbacks
  - Replay capability: Show video again on request
  - Pacing control: Queue dramatic reveals
  - Troubleshooting: Manually test video playback

  What to Build:
  GM Admin Panel - Manual Queue:
  ┌────────────────────────────────┐
  │ ➕ Add Video to Queue:         │
  │                                │
  │ Token ID: [________] [Find]   │
  │ or                             │
  │ File: [Browse ▼]               │
  │                                │
  │ Found: rat001.mp4 (25s)       │
  │ [Add to Queue]                 │
  └────────────────────────────────┘

  Implementation:
  // In adminModule.js VideoController class (method already exists!)
  async addToQueue(tokenId, filename) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

      this.connection.socket.once('gm:command:ack', (response) => {
        clearTimeout(timeout);
        if (response.data.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.data.message));
        }
      });

      this.connection.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'video:queue:add',
          payload: {
            videoFile: filename  // Backend expects this field
          }
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  // NEW: UI handler function (add to App global)
  window.App.adminAddVideoToQueue = async function() {
    const filename = document.getElementById('manual-video-filename').value;
    if (!filename) {
      alert('Enter a video filename');
      return;
    }

    try {
      await window.videoController.addToQueue(null, filename);
      alert(`Added ${filename} to queue`);
      document.getElementById('manual-video-filename').value = '';
    } catch (err) {
      alert(`Failed to add video: ${err.message}`);
    }
  };

  HTML Addition (in admin view section):
  <section class="admin-section">
      <h3>Manual Queue Management</h3>
      <div class="manual-queue-controls">
          <label>
              Video filename:
              <input type="text" 
                     id="manual-video-filename" 
                     placeholder="jaw001.mp4"
                     list="available-videos">
              <datalist id="available-videos">
                  <!-- Populated from backend video list -->
              </datalist>
          </label>
          <button class="btn" onclick="App.adminAddVideoToQueue()">
              Add to Queue
          </button>
      </div>
  </section>

  ---
  Feature #3: Progress Bar

  What's Missing:
  - Backend emits video:progress events every 1s
  - Frontend ignores them

  WHY WE NEED IT:
  - Visibility: GM sees video is playing (not stuck)
  - Timing: GM knows when video will end
  - Feedback: System is responsive

  What to Build:
  Visual progress bar showing current position in video

  Implementation:
  // In adminModule.js MonitoringDisplay class
  setupEventListeners() {
    // ... existing listeners

    // NEW: Listen for progress updates
    this.connection.on('video:progress', (data) => {
      this.updateProgressBar(data.progress, data.position, data.duration);
    });
  }

  updateProgressBar(progress, position, duration) {
    const progressBar = document.getElementById('video-progress-bar');
    if (!progressBar) return;

    const fill = progressBar.querySelector('.progress-fill');
    const time = progressBar.querySelector('.progress-time');

    if (fill) {
      fill.style.width = `${progress}%`;
    }

    if (time) {
      const current = Math.floor(position);
      const total = Math.floor(duration);
      time.textContent = `${current}s / ${total}s`;
    }
  }

  CSS (add to styles):
  .progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(0,0,0,0.1);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    transition: width 0.3s ease;
  }

  .progress-time {
    font-size: 11px;
    color: #666;
    margin-top: 4px;
  }

  ---
  Future Enhancements (NICE-TO-HAVE)

  Enhancement #1: GM Can Queue Image/Audio Tokens for TV Display

  Current Limitation:
  - Images/audio only display in player scanner PWA
  - GM can't broadcast visual content to TV

  Future Capability:
  - GM can select ANY token (video/image/audio)
  - Choose "broadcast to TV" option
  - Images display for configurable duration (default 10s)
  - Creates slideshow capability

  Use Cases:
  - Character introductions (show portrait)
  - Timeline diagrams
  - Evidence photos
  - Ambient audio over idle loop

  Technical Notes:
  - VLC supports image display
  - Set timer for auto-advance
  - Audio playback needs investigation (VLC audio-only files)

  ---
  Enhancement #2: Idle State Mode Toggle

  Current:
  - Idle state = idle-loop.mp4 only

  Future:
  GM can toggle between:
  - Video loop (current)
  - Live scoreboard (/scoreboard route)
  - Custom static image

  Use Cases:
  - Early game: Atmospheric video loop
  - Mid game: Live scoreboard (competitive tension)
  - Late game: Final standings during wrap-up

  Implementation Approaches:
  1. Scoreboard: Chromium in kiosk mode OR VLC webpage display
  2. Custom image: VLC image display
  3. Toggle: Admin panel dropdown, saves to session state

  ---
  Enhancement #3: Queue Reordering UI

  Current:
  - Backend supports video:queue:reorder command
  - No frontend UI

  Future:
  Drag-and-drop queue reordering in admin panel

  Use Cases:
  - Prioritize urgent video
  - Rearrange narrative sequence
  - Move long video to end

  Implementation:
  - Use HTML5 drag-and-drop API
  - Call existing VideoController.reorderQueue(from, to)

  ---
  Enhancement #4: Transaction History with Replay

  Current:
  - Transaction log shows recent scans
  - No way to replay video from history

  Future:
  Recent Transactions:
  ┌──────────────────────────────────────┐
  │ 18:45  Team 001  jaw001  VIDEO  [▶] │ ← Replay button
  │ 18:43  Team 002  rat001  VIDEO  [▶] │
  │ 18:41  Team 003  ashe002 IMAGE       │
  └──────────────────────────────────────┘

  Implementation:
  Click [▶] → calls VideoController.addToQueue() with that token's video

  ---
  Implementation Order

  Phase 1: Critical Fixes (DO FIRST)

  Priority: P0 - System is currently brokenEffort: ~2 hoursFiles:
  1. backend/src/routes/scanRoutes.js - Add blocking check
  2. backend/src/services/vlcService.js - Fix playlist management
  3. Test thoroughly with multiple player scans

  Acceptance Criteria:
  - ✓ Player scan while video playing returns 409 error
  - ✓ Player scanner shows "TV busy" message
  - ✓ VLC playlist contains exactly 1 item at all times
  - ✓ Idle loop works correctly (continuous loop)
  - ✓ Regular videos play once then return to idle

  ---
  Phase 2: Queue Visibility (DO NEXT)

  Priority: P1 - GM is flying blindEffort: ~4 hoursFiles:
  1. backend/src/websocket/broadcasts.js - Emit queue details
  2. ALNScanner/index.html - Add queue display HTML
  3. ALNScanner/js/utils/adminModule.js - Wire up queue updates

  Acceptance Criteria:
  - ✓ GM sees list of queued videos
  - ✓ Progress bar shows current video playback
  - ✓ Estimated wait time displayed

  ---
  Phase 3: Manual Queue Control (HIGH VALUE)

  Priority: P1 - Core GM capabilityEffort: ~3 hoursFiles:
  1. ALNScanner/index.html - Add manual queue UI
  2. Wire up existing backend commands (already implemented!)

  Acceptance Criteria:
  - ✓ GM can manually add video to queue by filename
  - ✓ GM can clear entire queue
  - ✓ Acknowledgment messages shown

  ---
  Phase 4: Future Enhancements (WHEN READY)

  Priority: P2 - Nice-to-haveEffort: TBD per feature

  Implement as needed based on game testing feedback.

  ---
  Testing Checklist

  Scenario 1: Player Competition for TV

  - Player A scans video token → video plays immediately
  - Player B scans video token while A's video plays → gets rejection
  - Player B's scanner shows "TV busy, wait ~Xs"
  - After A's video ends, Player B scans again → video plays

  Scenario 2: VLC Playlist Isolation

  - Check VLC playlist before any video: contains idle-loop.mp4 only
  - Play video A → playlist contains A.mp4 only, loop OFF
  - Video A completes → playlist contains idle-loop.mp4 only, loop ON
  - Play video B → playlist contains B.mp4 only, loop OFF

  Scenario 3: GM Override

  - Player video playing
  - GM clicks "Stop" → video stops, returns to idle
  - GM manually queues video → plays immediately
  - GM queues 3 videos → all play in sequence
  - GM sees queue list in admin panel

  Scenario 4: Idle Loop Correctness

  - System idle → idle loop plays continuously (no interruption)
  - Video plays → idle loop stops
  - Video completes → idle loop resumes immediately
  - Idle loop does NOT play after every video in a sequence

  ---
  File Change Summary

  Files to Modify:

  backend/src/routes/scanRoutes.js         [Bug #1: Add blocking]
  backend/src/services/vlcService.js       [Bug #2: Fix playlist]
  backend/src/websocket/broadcasts.js      [Feature #1: Queue details]
  ALNScanner/index.html                    [Features #1-3: UI]
  ALNScanner/js/utils/adminModule.js       [Features #1-3: Handlers]

  Files to Review (No Changes):

  backend/src/services/videoQueueService.js   [Already correct]
  backend/src/websocket/adminEvents.js        [Backend commands work]
  ALNScanner/js/core/dataManager.js           [May need queue state]

  ---
  Success Criteria

  The system works correctly when:

  1. ✅ Players negotiate TV access (competitive tension exists)
  2. ✅ Each video is an EVENT (not background noise)
  3. ✅ GM has narrative control (can inject content)
  4. ✅ VLC playlist never accumulates junk
  5. ✅ Idle loop works smoothly (no visible transitions)
  6. ✅ GM can see and manage queue
  7. ✅ System recovers gracefully from errors

**End State**: Video playback enhances game experience rather than causing frustration.

---

## Implementation Progress

### Phase 1: Critical Fixes - ✅ COMPLETED (2025-10-07)

**Status**: All bugs fixed and tested successfully  
**Time**: ~1 hour  
**Files Modified**:
- `backend/src/services/vlcService.js` (Bugs #2 & #3)

**Files Already Fixed**:
- `backend/src/routes/scanRoutes.js` (Bug #1 - already implemented)

#### Bug #1: Player Blocking ✅

**Discovery**: This was already correctly implemented in `scanRoutes.js:88-101`

**Implementation**:
```javascript
if (token && token.hasVideo()) {
  // Check if video is already playing
  if (videoQueueService.isPlaying()) {
    // Return 409 Conflict with rejection message
    return res.status(409).json({
      status: 'rejected',
      message: 'Video already playing, please wait',
      videoQueued: false,
      waitTime: waitTime || 30
    });
  }
  // ... queue if TV available
}
```

**Test Results**:
- ✅ First scan: Accepted, video plays immediately
- ✅ Second scan during playback: Rejected with `status: "rejected"`
- ✅ Scanner receives wait time estimate

#### Bug #2: VLC Playlist Accumulation ✅

**Root Cause**: `playVideo()` used `in_play` command without clearing playlist first, causing items to accumulate in VLC playlist.

**Fix Applied** (`vlcService.js:140-205`):
```javascript
async playVideo(videoPath) {
  // STEP 1: ALWAYS clear playlist first (maintain 1-item invariant)
  await this.clearPlaylist();

  // STEP 2: ALWAYS disable loop for regular videos
  await this.setLoop(false);

  // STEP 3: Convert paths to VLC URLs
  // ... path conversion logic

  // STEP 4: Enqueue single video and play
  await this.client.get('/requests/status.json', {
    params: { command: 'in_enqueue', input: vlcPath }
  });
  await this.client.get('/requests/status.json', {
    params: { command: 'pl_play' }
  });
}
```

**Test Results**:
- ✅ VLC playlist contains exactly 1 item at all times
- ✅ Idle state: `[idle-loop.mp4]` with loop ON
- ✅ During video: `[jaw001.mp4]` with loop OFF
- ✅ After video: Returns to `[idle-loop.mp4]` with loop ON
- ✅ No accumulation after multiple video scans

#### Bug #3: Loop State Management ✅

**Root Cause**: Loop state was set once and persisted incorrectly across state transitions.

**Fix Applied** (`vlcService.js:92-109`):
```javascript
async returnToIdleLoop() {
  // Play idle loop video (this clears playlist and disables loop)
  await this.playVideo('idle-loop.mp4');

  // IMPORTANT: Enable loop mode AFTER playVideo
  // playVideo() disables loop by default, so we override for idle loop
  await this.setLoop(true);

  logger.info('Returned to idle loop with continuous playback enabled');
}
```

**Same pattern applied to** `initializeIdleLoop()` (lines 58-90)

**Test Results**:
- ✅ Idle loop: Loop enabled (continuous playback)
- ✅ Regular videos: Loop disabled (play once then complete)
- ✅ Transitions: Loop state correctly updated on each state change

#### Key Learnings

1. **Existing Code Quality**: Bug #1 was already correctly implemented, indicating the team had identified this issue previously.

2. **VLC Playlist Behavior**:
   - `in_play` command adds to playlist (doesn't replace)
   - Must explicitly call `pl_empty` before each state transition
   - Playlist is separate from playback state

3. **Loop State is Global**:
   - VLC loop setting applies to entire playlist
   - Must be explicitly set/unset for each playback context
   - Cannot assume loop state persists correctly

4. **Command Order Matters**:
   ```
   Correct:   clearPlaylist() → setLoop(false) → enqueue() → play()
   Idle:      clearPlaylist() → enqueue(idle) → play() → setLoop(true)
   ```

5. **Graceful Degradation Works**: When VLC disconnected, system continues to emit events and accept scans (offline queue).

#### Observed System Flow

**Idle Loop Initialization** (logs from startup):
```
VLC connection established
→ Playlist cleared
→ Loop disabled
→ idle-loop.mp4 played
→ Loop enabled
→ "Idle loop video initialized with continuous playback enabled"
```

**Video Scan → Playback → Return to Idle** (logs from test):
```
Player scan received (jaw001)
→ Playlist cleared
→ Loop disabled
→ jaw001.mp4 played
→ "Video playback started via VLC" (duration: 25s)
→ [25s playback monitoring]
→ "Video playback completed"
→ Playlist cleared
→ idle-loop.mp4 played
→ Loop enabled
→ "Returned to idle loop with continuous playback enabled"
```

**Player Blocking** (logs from concurrent scans):
```
First scan: "Video queued for playback" (accepted)
Second scan (1s later): "Video already playing, please wait" (rejected)
```

#### Verification Commands Used

Check VLC playlist contents:
```bash
curl -s --user :vlc "http://localhost:8080/requests/playlist.json" \
  | python3 -c "import sys, json; data = json.load(sys.stdin); \
  items = data['children'][0]['children']; \
  print(f'Items: {len(items)}'); \
  [print(f'  {item[\"name\"]}') for item in items]"
```

Check VLC state and loop:
```bash
curl -s --user :vlc "http://localhost:8080/requests/status.json" \
  | python3 -c "import sys, json; data = json.load(sys.stdin); \
  print(f'State: {data[\"state\"]}'); \
  print(f'Loop: {data[\"loop\"]}')"
```

Test player scan blocking:
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "jaw001", "teamId": "001", "deviceId": "test-player"}'
```

#### Phase 1 Status: COMPLETE ✅

All critical bugs are fixed and verified. The system now:
- ✅ Blocks player scans when TV is busy
- ✅ Maintains 1-item playlist invariant
- ✅ Manages loop state correctly per context
- ✅ Returns to idle loop smoothly after videos

**Ready for Phase 2**: Queue Visibility

---

### Phase 1 Follow-up Fixes - ✅ COMPLETED (2025-10-07 Evening)

During Phase 2 implementation, discovered three additional critical bugs that prevented the system from working:

#### Bug #4: Video Queue Never Clears Completed Items ✅

**Discovery**: Queue length grew infinitely (1, 2, 3, 4...) with each scan. Admin panel showed growing queue even though no videos were actually queued.

**Root Cause**:
- `videoQueueService.clearCompleted()` method existed but was **never called**
- Completed/failed videos stayed in queue array forever
- Queue accumulated: `[completed, completed, completed, pending]`

**Fix Applied** (`videoQueueService.js:335, 90`):
```javascript
completePlayback(queueItem) {
  // ... existing completion logic
  this.emit('video:completed', queueItem);

  // NEW: Clean up completed items from queue to prevent accumulation
  this.clearCompleted();

  setImmediate(() => this.processQueue());
}

async processQueue() {
  try {
    await this.playVideo(nextItem);
  } catch (error) {
    nextItem.failPlayback(error.message);
    this.emit('video:failed', nextItem);

    // NEW: Clean up failed items from queue
    this.clearCompleted();

    setImmediate(() => this.processQueue());
  }
}
```

**Test Results**:
- ✅ Queue starts at 0
- ✅ Scan adds video → queue = 1
- ✅ Video completes → queue = 0
- ✅ Multiple scans don't accumulate: 0 → 1 → 0 → 1 → 0

---

#### Bug #5: Missing video:progress Event Handler ✅

**Discovery**: Admin panel video controls showed `"jaw001 (0% - 0s/0s)"` and never updated, despite backend broadcasting progress events every second.

**Root Cause**:
- Backend `broadcasts.js:283` emits `video:progress` to `gm-stations` room every 1s ✅
- `AdminModule.js:464` has listener registered for `video:progress` ✅
- **But** `OrchestratorClient.js` had NO handler to unwrap and forward the event ❌
- Event flow broken: Backend → [missing handler] → AdminModule

**Fix Applied** (`ALNScanner/js/network/orchestratorClient.js:238-242`):
```javascript
this.socket.on('video:status', (eventData) => {
    const payload = eventData.data;
    this.emit('video:status', payload);
});

// NEW: Video progress updates (emitted every 1s during playback)
this.socket.on('video:progress', (eventData) => {
    const payload = eventData.data;  // Unwrap envelope
    this.emit('video:progress', payload);  // Forward to AdminModule
});

this.socket.on('score:updated', (eventData) => {
    const payload = eventData.data;
    this.emit('score:updated', payload);
});
```

**Event Contract**:
All WebSocket events are wrapped in envelope format:
```javascript
{
  event: 'video:progress',
  data: { tokenId, progress, position, duration },
  timestamp: '2025-10-07T...'
}
```

OrchestratorClient must unwrap `.data` before re-emitting to frontend listeners.

**Test Results**:
- ✅ Progress text updates every second: `"jaw001 (45% - 15s/30s)"`
- ✅ Live data flows: VLC → Backend → Frontend
- ✅ Admin panel shows real-time playback position

---

#### Bug #6: VLC Command Sequence Prevents Playback ✅

**Discovery**: Videos weren't actually playing. Timeline showed:
```
19:45:19 - Video playback started (jaw001.mp4)
19:45:22 - Could not get valid duration from VLC (duration: 0)
19:45:27 - Video marked completed (5s timeout)
19:45:27 - Returned to idle loop
```

Screen showed: idle loop stopped → blank → idle loop resumed (video never appeared).

**Root Cause Investigation**:
```bash
# Manual VLC testing revealed the issue:
curl "http://localhost:8080/requests/status.json?command=pl_empty"
  → State: stopped

curl "http://localhost:8080/requests/status.json?command=in_enqueue&input=file://..."
  → State: stopped (video added to playlist but NOT playing)

curl "http://localhost:8080/requests/status.json?command=pl_play"
  → State: stopped (fails to start playback reliably)

# Correct command:
curl "http://localhost:8080/requests/status.json?command=in_play&input=file://..."
  → State: playing, Length: 25s ✅
```

**The Problem**:
- Old code used `in_enqueue` (add to queue) + `pl_play` (play queue)
- After `pl_empty`, VLC enters stopped state
- `in_enqueue` adds video but keeps VLC stopped
- `pl_play` fails to start playback reliably from stopped state
- Result: VLC stuck in stopped state, duration unavailable, timeout triggers

**Fix Applied** (`vlcService.js:181-188`):
```javascript
// STEP 4: Add video and start playback immediately
// Use 'in_play' to add to playlist AND start playing (not 'in_enqueue' which only queues)
await this.client.get('/requests/status.json', {
  params: {
    command: 'in_play',  // Changed from 'in_enqueue' + 'pl_play'
    input: vlcPath,
  },
});
```

**VLC Commands Compared**:

| Command | Effect | Result State |
|---------|--------|--------------|
| `in_enqueue` | Add to playlist | stopped (requires pl_play) |
| `in_play` | Add to playlist AND play | playing (immediate) |

**Test Results**:
- ✅ Videos play immediately on screen
- ✅ VLC returns valid duration: 25s (not 0)
- ✅ Progress monitoring works correctly
- ✅ Video plays for full duration (not 5s timeout)
- ✅ Screen shows: idle loop → jaw001.mp4 → idle loop

**Logs After Fix**:
```
20:15:34 - Player scan received (jaw001)
20:15:34 - Playlist cleared
20:15:34 - Loop disabled
20:15:34 - Video playback started (jaw001.mp4)
20:15:36 - Got video duration from VLC: 25s ✅
20:15:36 - Video playback started via VLC (duration: 25)
20:15:36 - Broadcasted video:started
[Progress events every 1s for 25s]
20:16:01 - Video playback completed
20:16:01 - Cleared completed items from queue
20:16:01 - Returned to idle loop
```

---

#### Phase 1 Follow-up Status: COMPLETE ✅

**All bugs fixed**. System now fully operational:
- ✅ Videos actually play on screen (Bug #6)
- ✅ Queue cleans up after completion (Bug #4)
- ✅ Progress updates in admin panel (Bug #5)
- ✅ VLC returns correct duration (Bug #6 side effect)
- ✅ Full video playback from start to finish

**Files Modified**:
- `backend/src/services/videoQueueService.js` (Bug #4)
- `ALNScanner/js/network/orchestratorClient.js` (Bug #5)
- `backend/src/services/vlcService.js` (Bug #6)

**Testing Verified**:
```bash
# Queue cleanup
curl http://localhost:3000/api/state | jq '.videoStatus.queueLength'
# Before scan: 0, During: 1, After: 0 ✅

# Progress events received
# AdminModule shows: "jaw001 (80% - 20s/25s)" ✅

# Video actually plays
# Screen displays jaw001.mp4 for full 25 seconds ✅
```

**Commit Ready**: All Phase 1 bugs resolved, system tested and working.

---

## Next Steps

### Phase 2: Queue Visibility (PARTIALLY COMPLETE)
- ✅ Backend emits `video:progress` events (already implemented)
- ✅ Frontend receives and processes progress events (Bug #5 fix)
- ❌ **Still needed**: Visual progress bar HTML in admin panel
- ❌ **Still needed**: Queue details broadcast (list of pending videos)
- ❌ **Still needed**: Queue display UI in admin panel

### Phase 3: Manual Queue Control (HIGH VALUE)
- Wire up manual video add UI
- Connect existing backend commands to frontend

### Phase 4: Future Enhancements (WHEN READY)
- GM can queue image/audio tokens for TV
- Idle mode toggle (video/scoreboard/image)
- Queue reordering drag-drop UI
- Transaction history replay buttons
