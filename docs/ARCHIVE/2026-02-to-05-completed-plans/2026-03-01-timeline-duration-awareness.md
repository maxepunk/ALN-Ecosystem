# Timeline Duration Awareness

**Date:** 2026-03-01
**Status:** Design approved
**Scope:** config-tool timeline editor + asset API

## Problem

The compound cue timeline editor renders all blocks at the same fixed width regardless of whether the action is a 30-second sound, a 2-minute video, or an instantaneous lighting change. Users can't see overlaps, can't gauge timing relationships, and have to guess at how entries interact.

Additionally, the ruler (second markings) overlaps the first row of blocks, making the top entry unreadable.

## Design

### 1. Server-side duration extraction

Add `duration` field to asset API responses (`GET /api/assets/sounds`, `GET /api/assets/videos`) by running `ffprobe` on each file:

```
ffprobe -v quiet -print_format json -show_format <file>
```

Response shape:
```json
{
  "name": "tension.wav",
  "size": 1024000,
  "modified": "2026-03-01T...",
  "duration": 4.2,
  "usedBy": ["tension-hit"]
}
```

- Duration is extracted per-request (ffprobe is ~20-50ms per file, dozens of files max)
- If ffprobe fails, `duration: null` — UI treats as unknown

### 2. Client-side duration lookup

Export `getAssetDuration(action, filename)` from `commandForm.js`:
- `sound:play` → search `soundsCache` by filename
- `video:queue:add` → search `videosCache` by filename
- Returns duration float or `null`

No extra fetching needed — `ensureAssets()` already loads and caches these lists.

### 3. Timeline visual rendering

**A. Fix ruler overlap.** Increase top padding so the first block row clears the ruler completely.

**B. Proportional block widths:**
- `sound:play` / `video:queue:add` with known file → width = `duration * pxPerSec`
- Everything else (instantaneous, no file selected, unknown) → width = `1 * pxPerSec`

**C. Lane packing.** Replace one-row-per-entry with Gantt-style lane packing:
1. Sort entries by `at` time
2. For each entry, find first lane where it doesn't overlap existing blocks (compare `at` against `at + blockDuration` of lane occupants)
3. If no lane fits, create a new one

Non-overlapping entries share rows. Vertical stacking means concurrent activity.

**D. Live updates.** Changing file selection in inline editor triggers `refreshTimeline()` (already wired via `editorCtx.markDirty()`), so block width updates immediately.

**E. Improved auto-duration.** Change from `max(entry.at)` to `max(entry.at + entryDuration)` so a 30s sound at t=5s shows auto-duration of 35s, not 5s.

## Files to modify

| File | Change |
|------|--------|
| `config-tool/lib/routes.js` | Add ffprobe duration extraction to asset listing |
| `config-tool/public/js/components/commandForm.js` | Export `getAssetDuration()` helper |
| `config-tool/public/js/components/timelineView.js` | Proportional blocks, lane packing, ruler fix, auto-duration |

## Out of scope

- Caching ffprobe results (not needed at this scale)
- Duration display in asset manager or cue entry list
- Sound completion tracking in the backend
