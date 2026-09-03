# Bluetooth Audio Stability & Simplification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove dead combine-sink code (hardware can't support dual A2DP), fix WirePlumber config that's being silently overridden, and improve BT health checking to detect broken audio paths.

**Architecture:** The Pi's BCM43455 BT radio supports only ONE A2DP stream at a time — a second device falls back to HFP (mono 16kHz). The combine-sink feature (dual BT speakers via pw-loopback) is dead code. With the new physical setup (1 wired speaker via HDMI + 1 BT speaker), the combine-sink code adds complexity and generates error log spam. Separately, WirePlumber's lua device rules override our custom conf file, making `_enforceA2DPProfile()` a band-aid for a config bug. Fix the config so WirePlumber handles profile selection correctly, then simplify the service code.

**Tech Stack:** Node.js (backend services), WirePlumber/PipeWire (system config), Jest (unit/integration tests), Playwright (E2E)

**Root cause findings from investigation:**
- `pactl list cards` shows `bluez5.auto-connect = "[ hfp_hf hsp_hs a2dp_sink ]"` despite our conf setting `[ a2dp_sink ]` — the lua rule at `/usr/share/wireplumber/bluetooth.lua.d/50-bluez-config.lua:87` overrides monitor-level properties
- SBC-XQ codec is available on both speakers but disabled (commented out in default WirePlumber config, our conf doesn't enable it)
- `_enforceA2DPProfile()` hardcodes `a2dp-sink` (plain SBC) — never tries `a2dp-sink-sbc_xq`
- `checkHealth()` only verifies "adapter powered on?" — doesn't check that connected devices have A2DP profiles or PipeWire sinks
- CPU governor is `ondemand` — can downclock to 1500 MHz between audio bursts on a dedicated appliance
- PipeWire RT scheduling is actually fine (rtkit grants SCHED_RR 20 to data-loop threads)

---

## Phase 1: System Configuration (no code tests needed)

### Task 1: Fix WirePlumber BT config

**Files:**
- Modify: `/usr/share/wireplumber/bluetooth.lua.d/50-bluez-config.lua` (3 lines)
- Keep: `/etc/wireplumber/wireplumber.conf.d/50-aln-bluetooth.conf` (monitor-level properties still useful)

**IMPORTANT:** WirePlumber 0.4.13 uses Lua-based config for device rules. Our existing `.conf` file sets `monitor.bluez.properties` (monitor-level) which works for `bluez5.roles`, but per-device `auto-connect` is set in the Lua rules at `/usr/share/wireplumber/bluetooth.lua.d/50-bluez-config.lua:87` and overrides monitor-level properties. The `.conf` format does NOT support `monitor.bluez.rules` on WP 0.4 — that's WP 0.5 syntax. Since this is a dedicated appliance, we edit the system Lua file directly (3 targeted line changes).

**Step 1: Edit the Lua config to fix auto-connect and enable SBC-XQ**

In `/usr/share/wireplumber/bluetooth.lua.d/50-bluez-config.lua`, make 3 changes:

Change line 8 from:
```lua
  --["bluez5.enable-sbc-xq"] = true,
```
to:
```lua
  ["bluez5.enable-sbc-xq"] = true,
```

Change line 87 from:
```lua
      ["bluez5.auto-connect"]  = "[ hfp_hf hsp_hs a2dp_sink ]",
```
to:
```lua
      ["bluez5.auto-connect"]  = "[ a2dp_sink ]",
```

Uncomment line 105 to prefer A2DP profile on connect:
```lua
      ["device.profile"] = "a2dp-sink",
```

**Step 2: Restart WirePlumber to apply**

```bash
systemctl --user restart wireplumber
sleep 2
```

**Step 3: Verify the config took effect**

```bash
# Reconnect BT speaker and check
bluetoothctl disconnect 2C:81:BF:0D:E4:C1
sleep 2
bluetoothctl connect 2C:81:BF:0D:E4:C1
sleep 3
# Should show ONLY a2dp_sink in auto-connect, and A2DP profile active
pactl list cards | grep -A5 "bluez_card.2C" | grep -E "auto-connect|Active"
```

Expected: `bluez5.auto-connect = "[ a2dp_sink ]"` and `Active Profile: a2dp-sink` (or `a2dp-sink-sbc_xq` if SBC-XQ negotiated)

**Step 4: Verify SBC-XQ codec selection**

```bash
pactl list cards | grep -A30 "bluez_card.2C" | grep "Profile"
```

Expected: `a2dp-sink-sbc_xq` profile should be available. If the speaker negotiates it, the active profile will show `a2dp-sink-sbc_xq`.

**VERIFICATION GATE:** Task 6 (converting _enforceA2DPProfile to verify-only) MUST NOT proceed until this task's verification passes. If WirePlumber still shows HFP/HSP profiles after these changes, keep the enforcement mechanism as a fallback.

### Task 2: Set CPU governor to performance

**Files:**
- Create: `/etc/systemd/system/cpu-performance.service` (systemd unit for persistence)

**Step 1: Set governor immediately**

```bash
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

**Step 2: Create systemd service for persistence across reboots**

Create `/etc/systemd/system/cpu-performance.service`:

```ini
[Unit]
Description=Set CPU governor to performance
After=sysinit.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

**Step 3: Enable the service**

```bash
sudo systemctl daemon-reload
sudo systemctl enable cpu-performance.service
```

**Step 4: Verify**

```bash
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
```

Expected: `performance`

---

## Phase 2: Remove Combine-Sink (backend code)

### Task 3: Remove combine-sink from audioRoutingService

**Files:**
- Modify: `backend/src/services/audioRoutingService.js`
- Modify: `backend/tests/unit/services/audioRoutingService.test.js`

**Step 1: Remove combine-sink state from constructor**

In `audioRoutingService.js` constructor (lines 69-73), remove:

```javascript
    // Combine-sink state
    this._combineSinkActive = false;
    this._combineSinkPids = [];
    this._combineSinkProcs = [];
    this._combineSinkModuleId = null;
```

**Step 2: Remove combine-sink cleanup from `cleanup()` (line 154-155)**

Remove:
```javascript
    // Tear down combine-sink processes
    this._killCombineSinkProcs();
```

**Step 3: Remove combine-sink reset from `reset()` (lines 169-172)**

Remove:
```javascript
    this._combineSinkActive = false;
    this._combineSinkPids = [];
    this._combineSinkProcs = [];
    this._combineSinkModuleId = null;
```

**Step 4: Remove `'combine'` from `classifySink()` (lines 239-240)**

Remove:
```javascript
    if (name === 'combine-bt' || name === 'aln-combine') {
      return 'combine';
    }
```

**Step 5: Remove `combineSinkActive` from `getState()` (line 307)**

Change:
```javascript
      combineSinkActive: this._combineSinkActive,
```
To remove that line. Keep `routes`, `defaultSink`, `ducking`, `availableSinks`.

**Step 6: Simplify `getRoutingStatus()` — use `getAvailableSinks()` instead of `getAvailableSinksWithCombine()`**

In `getRoutingStatus()` (line 327), change:
```javascript
      availableSinks: await this.getAvailableSinksWithCombine(),
```
to:
```javascript
      availableSinks: await this.getAvailableSinks(),
```

**Step 7: Simplify `_buildAvailableSinksSnapshot()` — remove combine-sink filtering and virtual entry**

Replace `_buildAvailableSinksSnapshot()` (lines 625-646) with:

```javascript
  _buildAvailableSinksSnapshot(rawSinks) {
    return rawSinks.filter(s => s.name !== 'auto_null');
  }
```

**Step 8: Remove all combine-sink methods**

Delete these methods entirely:
- `createCombineSink()` (lines 513-587)
- `destroyCombineSink()` (lines 594-615)
- `getAvailableSinksWithCombine()` (lines 652-655)
- `_onBtSinkChanged()` (lines 664-680)
- `_debouncedBtSinkChanged()` (lines 688-696)
- `_onCombineLoopbackExit()` (lines 704-728)
- `_killCombineSinkProcs()` (lines 734-750)

**Step 9: Remove `_debouncedBtSinkChanged()` calls from `startSinkMonitor()`**

In `startSinkMonitor()`, remove the 4 calls to `this._debouncedBtSinkChanged()` (lines 1128, 1132, 1138, 1142). Keep the sink:added/sink:removed event emissions and `_onSinkAdded()` call.

**Step 10: Remove `_btSinkDebounceTimer` from constructor and cleanup, and `BT_SINK_DEBOUNCE` constant**

Constructor (line 67): remove `this._btSinkDebounceTimer = null;`
`cleanup()` (lines 148-151): remove the btSinkDebounceTimer clearTimeout block.
Line 56: remove `const BT_SINK_DEBOUNCE = 300;` (only used by removed `_debouncedBtSinkChanged`).

**Step 11: Remove `_isHighQualitySink()` method** (line 1300 area)

This was only used by `createCombineSink()`.

**Step 12: Remove 'combine' type from `_generateSinkLabel()` (line 1339 area)**

Remove the `if (type === 'combine')` block (lines 1339-1341).

**Step 13: Remove `spawn` import (confirmed unused after combine removal)**

Line 15: remove `const { spawn } = require('child_process');`

`spawn` is only used by `createCombineSink()` (line 555). All other process spawning uses `ProcessMonitor` or `execFileAsync`.

**Step 14: Remove `'pw-loopback'` from `_killStaleMonitors()` (line 762)**

Change:
```javascript
    for (const processName of ['pactl subscribe', 'pw-loopback']) {
```
to:
```javascript
    for (const processName of ['pactl subscribe']) {
```

After removing combine-sink, there will never be pw-loopback processes to clean up.

**Step 15: Update JSDoc header comment** (line 11)

Change:
```javascript
 * Uses spawn for pw-loopback (combine-sink) and ProcessMonitor for pactl subscribe.
```
to:
```javascript
 * Uses ProcessMonitor for pactl subscribe.
```

**Step 16: Run unit tests**

```bash
cd backend && npm run test:unit -- --testPathPattern="audioRoutingService" --verbose
```

Expected: Some tests will fail (combine-sink tests reference removed code). Fix in next steps.

**Step 17: Remove combine-sink unit tests**

In `backend/tests/unit/services/audioRoutingService.test.js`, remove the entire `describe('combine-sink management')` block (starts around line 1432).

**Step 18: Update `getState()` mock assertions in other test files**

In these files, remove `combineSinkActive: false` from `getState()` mock return values:
- `tests/unit/websocket/phase1-broadcasts.test.js:101`
- `tests/unit/websocket/phase2-broadcasts.test.js:103`
- `tests/unit/websocket/broadcasts.test.js:531,607`
- `tests/unit/websocket/broadcasts-environment.test.js:74`
- `tests/unit/services/getState.test.js` (search for `combineSinkActive` — both the mock return AND the assertion)

Note: `cueEngineService.test.js` does NOT reference `combineSinkActive` — no changes needed there.

**Step 19: Run all unit tests to verify**

```bash
cd backend && npm run test:unit
```

Expected: All pass (1557 baseline minus removed combine tests)

**Step 20: Commit**

```bash
git add -p backend/src/services/audioRoutingService.js backend/tests/
git commit -m "refactor: remove combine-sink (hardware only supports 1 A2DP stream)"
```

### Task 4: Remove combine-sink from commandExecutor, broadcasts, contracts, and config-tool

**Files:**
- Modify: `backend/src/services/commandExecutor.js`
- Modify: `backend/src/websocket/broadcasts.js`
- Modify: `backend/contracts/asyncapi.yaml`
- Modify: `backend/contracts/openapi.yaml`
- Modify: `backend/tests/unit/services/commandExecutor.test.js`
- Modify: `backend/tests/unit/websocket/broadcasts*.test.js`
- Modify: `backend/tests/contract/websocket/phase1-events.test.js`

**Step 1: Remove combine commands from `commandExecutor.js`**

Remove from `SERVICE_DEPENDENCIES` (lines 57-58):
```javascript
  'audio:combine:create': 'audio',
  'audio:combine:destroy': 'audio',
```

Remove cases (lines 431-443):
```javascript
      case 'audio:combine:create': { ... }
      case 'audio:combine:destroy': { ... }
```

**Step 2: Remove combine events from `broadcasts.js` listener list (line 503)**

Change the event list to remove `'combine-sink:created', 'combine-sink:destroyed'`:
```javascript
    for (const event of ['routing:changed', 'routing:applied', 'routing:fallback', 'sink:added', 'sink:removed', 'ducking:changed']) {
```

**Step 3: Update asyncapi.yaml**

Remove these lines/sections:
- `audio:combine:create` and `audio:combine:destroy` from gm:command action enum (~lines 1349-1354, 1410-1411)
- `combineSinkActive` from audio state description (~line 2004)

**Step 4: Update openapi.yaml**

Remove combine-sink reference from audio state description (~line 1376).

**Step 5: Remove `'combine-bt'` from config-tool sink option arrays**

Three files hardcode `'combine-bt'` in dropdown options:

`config-tool/public/js/sections/audio.js` line 9:
Change `const SINK_OPTIONS = ['hdmi', 'bluetooth', 'combine-bt'];` to `const SINK_OPTIONS = ['hdmi', 'bluetooth'];`
Also line 88: remove `'combine-bt'` from the options array.

`config-tool/public/js/components/commandForm.js` line 267:
Change `const sinks = ['(default)', 'hdmi', 'bluetooth', 'combine-bt'];` to `const sinks = ['(default)', 'hdmi', 'bluetooth'];`

`config-tool/public/js/components/cueEditor.js` line 26:
Change `const SINK_OPTIONS = ['(default)', 'hdmi', 'bluetooth', 'combine-bt'];` to `const SINK_OPTIONS = ['(default)', 'hdmi', 'bluetooth'];`

**Step 6: Remove combine-sink tests from commandExecutor tests**

In `tests/unit/services/commandExecutor.test.js`, remove test cases for `audio:combine:create` and `audio:combine:destroy`.

**Step 7: Remove combine-sink integration tests (keep ducking/volume/routing)**

In `tests/integration/audio-routing-phase3.test.js`:
- Remove the `describe('Combine-Sink Management')` block (line 167-229)
- Remove the combine-sink state reset in `beforeEach` (lines 48-51: `audioRoutingService._combineSinkActive = false;` etc.)
- KEEP: `describe('Ducking Engine')` (line 62), `describe('Per-Stream Volume')` (line 233), `describe('Routing Inheritance')` (line 269)

**Step 8: Update contract test data**

In `tests/contract/websocket/phase1-events.test.js` line 116, change `target: 'combine-bt'` to `target: 'hdmi'` (misleading test data after removal).

**Step 9: Update any remaining broadcast test mocks**

Search remaining test files for `combine-sink:created`, `combine-sink:destroyed`, and remove.

**Step 10: Run all tests**

```bash
cd backend && npm test
```

Expected: All unit + contract tests pass.

**Step 11: Commit**

```bash
git add -p backend/src/services/commandExecutor.js backend/src/websocket/broadcasts.js backend/contracts/ backend/tests/ config-tool/public/js/
git commit -m "refactor: remove combine-sink from commands, broadcasts, contracts, and config-tool"
```

### Task 5: Remove combine-sink from GM Scanner

**Files:**
- Modify: `ALNScanner/src/admin/AudioController.js` (line 27, comment only)
- Check: `ALNScanner/tests/unit/admin/MonitoringDisplay-phase3.test.js`
- Check: `ALNScanner/tests/unit/ui/renderers/EnvironmentRenderer.test.js`

**Step 1: Update AudioController comment**

Line 27, change:
```javascript
   * @param {string} sink - PipeWire sink name (e.g., 'bluez_output.AA_BB_CC_DD_EE_FF.1', 'hdmi', 'combine-bt')
```
to:
```javascript
   * @param {string} sink - PipeWire sink name (e.g., 'bluez_output.AA_BB_CC_DD_EE_FF.1', 'hdmi')
```

**Step 2: Check and update GM Scanner tests**

Review `MonitoringDisplay-phase3.test.js` and `EnvironmentRenderer.test.js` for `combine` references. Remove `combineSinkActive` from mock state objects.

**Step 3: Run GM Scanner tests**

```bash
cd ALNScanner && npm test
```

Expected: All pass (1116 baseline)

**Step 4: Commit**

```bash
git add ALNScanner/
git commit -m "refactor: remove combine-sink references from GM Scanner"
```

---

## Phase 3: BT Service Improvements

### Task 6: Change `_enforceA2DPProfile()` to verification

**Files:**
- Modify: `backend/src/services/bluetoothService.js`
- Modify: `backend/tests/unit/services/bluetoothService.test.js`

Now that WirePlumber config is fixed (Task 1), `_enforceA2DPProfile()` should VERIFY the profile is correct rather than FORCE a specific one. This catches cases where WirePlumber selects HFP despite our config (e.g., device doesn't support A2DP).

**Step 1: Write failing test for verification behavior**

Add to `bluetoothService.test.js`:

```javascript
describe('_verifyA2DPProfile', () => {
  it('should log warning when card has no A2DP profile', async () => {
    // pactl list cards returns only HFP profiles
    bluetoothService._execFile = jest.fn().mockResolvedValue(
      'Active Profile: headset-head-unit\n\tProfiles:\n\t\theadset-head-unit: Headset\n'
    );
    const warnSpy = jest.spyOn(logger, 'warn');

    await bluetoothService._verifyA2DPProfile('AA:BB:CC:DD:EE:FF');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('not on A2DP'),
      expect.any(Object)
    );
  });

  it('should not warn when A2DP profile is active', async () => {
    bluetoothService._execFile = jest.fn().mockResolvedValue(
      'Active Profile: a2dp-sink\n'
    );
    const warnSpy = jest.spyOn(logger, 'warn');

    await bluetoothService._verifyA2DPProfile('AA:BB:CC:DD:EE:FF');

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should accept a2dp-sink-sbc_xq as valid A2DP', async () => {
    bluetoothService._execFile = jest.fn().mockResolvedValue(
      'Active Profile: a2dp-sink-sbc_xq\n'
    );
    const warnSpy = jest.spyOn(logger, 'warn');

    await bluetoothService._verifyA2DPProfile('AA:BB:CC:DD:EE:FF');

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest --testPathPattern="bluetoothService" --verbose -t "verifyA2DPProfile"
```

Expected: FAIL — `_verifyA2DPProfile` doesn't exist yet.

**Step 3: Replace `_enforceA2DPProfile` with `_verifyA2DPProfile`**

In `bluetoothService.js`, replace `_enforceA2DPProfile()` (lines 344-354) with:

```javascript
  /**
   * Verify that a connected device is using an A2DP profile (not HFP/HSP).
   * Logs a warning if the device ended up on a headset profile, which would
   * produce mono 16kHz audio. Does NOT force a profile change — WirePlumber
   * config should handle profile selection correctly.
   * @param {string} address - Bluetooth MAC address
   */
  async _verifyA2DPProfile(address) {
    const cardName = `bluez_card.${address.replace(/:/g, '_')}`;
    try {
      const stdout = await this._execFile('pactl', ['list', 'cards']);
      // Find the active profile for this card
      const cardIdx = stdout.indexOf(cardName);
      if (cardIdx === -1) return; // Card not in PipeWire yet (normal during connect)

      const afterCard = stdout.slice(cardIdx);
      const activeMatch = afterCard.match(/Active Profile:\s*(.+)/);
      if (!activeMatch) return;

      const activeProfile = activeMatch[1].trim();
      if (activeProfile.startsWith('a2dp-sink')) {
        logger.debug('BT device on A2DP profile', { address, profile: activeProfile });
      } else {
        logger.warn('BT device not on A2DP profile — audio may be mono/low quality', {
          address,
          activeProfile,
          expected: 'a2dp-sink*',
        });
      }
    } catch (err) {
      logger.debug('Could not verify A2DP profile (non-fatal)', {
        address, error: err.message,
      });
    }
  }
```

**Step 4: Update callers**

Replace both calls to `_enforceA2DPProfile` with `_verifyA2DPProfile`:
- Line 300 (in `pairDevice`): `await this._verifyA2DPProfile(address);`
- Line 331 (in `connectDevice`): `await this._verifyA2DPProfile(address);`

**Step 5: Run tests**

```bash
cd backend && npx jest --testPathPattern="bluetoothService" --verbose
```

Expected: New tests pass. Existing `_enforceA2DPProfile` tests will fail — update them.

**Step 6: Update existing tests**

Rename/update any tests that reference `_enforceA2DPProfile` to use `_verifyA2DPProfile`. The old tests asserted that `pactl set-card-profile` was called — the new tests should assert log output instead.

**Step 7: Run full unit suite**

```bash
cd backend && npm run test:unit
```

Expected: All pass.

**Step 8: Commit**

```bash
git add backend/src/services/bluetoothService.js backend/tests/
git commit -m "refactor: replace _enforceA2DPProfile with _verifyA2DPProfile

WirePlumber config now handles profile selection. Service verifies
the result instead of forcing a profile that may conflict."
```

### Task 7: Enhance BT health check to verify A2DP transport

**Files:**
- Modify: `backend/src/services/bluetoothService.js`
- Modify: `backend/tests/unit/services/bluetoothService.test.js`

**Step 1: Write failing test**

```javascript
describe('checkHealth — A2DP transport verification', () => {
  it('should report healthy when adapter on and connected device has A2DP sink', async () => {
    bluetoothService._execFile = jest.fn()
      .mockResolvedValueOnce('Powered: yes')  // bluetoothctl show
      .mockResolvedValueOnce('65\talsa_output.hdmi\tPipeWire\n72\tbluez_output.AA_BB.1\tPipeWire\ts16le 2ch 48000Hz\tSUSPENDED');  // pactl list sinks short
    bluetoothService._cachedDeviceStates = new Map([
      ['AA:BB:CC:DD:EE:FF', { connected: true, paired: true, name: 'Speaker' }],
    ]);

    const result = await bluetoothService.checkHealth();

    expect(result).toBe(true);
    expect(registry.report).toHaveBeenCalledWith('bluetooth', 'healthy', expect.any(String));
  });

  it('should report degraded when connected device has no PipeWire sink', async () => {
    bluetoothService._execFile = jest.fn()
      .mockResolvedValueOnce('Powered: yes')  // bluetoothctl show
      .mockResolvedValueOnce('65\talsa_output.hdmi\tPipeWire');  // no BT sink
    bluetoothService._cachedDeviceStates = new Map([
      ['AA:BB:CC:DD:EE:FF', { connected: true, paired: true, name: 'Speaker' }],
    ]);

    const result = await bluetoothService.checkHealth();

    expect(result).toBe(true); // adapter is on, so true
    expect(registry.report).toHaveBeenCalledWith('bluetooth', 'healthy',
      expect.stringContaining('no PipeWire sink'));
  });

  it('should not check sinks when no devices connected', async () => {
    bluetoothService._execFile = jest.fn()
      .mockResolvedValueOnce('Powered: yes');
    bluetoothService._cachedDeviceStates = new Map();

    await bluetoothService.checkHealth();

    // Only one call (bluetoothctl show), no pactl call
    expect(bluetoothService._execFile).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && npx jest --testPathPattern="bluetoothService" -t "A2DP transport" --verbose
```

Expected: FAIL

**Step 3: Enhance `checkHealth()`**

Replace `checkHealth()` in `bluetoothService.js`:

```javascript
  async checkHealth() {
    const available = await this.isAvailable();
    if (!available) {
      registry.report('bluetooth', 'down', 'No adapter or adapter powered off');
      return false;
    }

    // Check if connected devices have PipeWire sinks
    const connectedDevices = [...this._cachedDeviceStates.entries()]
      .filter(([, state]) => state.connected);

    if (connectedDevices.length === 0) {
      registry.report('bluetooth', 'healthy', 'Adapter available (no devices connected)');
      return true;
    }

    // Verify PipeWire has BT sinks for connected devices
    try {
      const sinkList = await this._execFile('pactl', ['list', 'sinks', 'short']);
      const hasBtSink = sinkList.includes('bluez_output');

      if (hasBtSink) {
        registry.report('bluetooth', 'healthy', 'Adapter available, BT audio active');
      } else {
        registry.report('bluetooth', 'healthy',
          `Adapter available, ${connectedDevices.length} device(s) connected but no PipeWire sink`);
        logger.warn('BT device connected but no PipeWire audio sink', {
          devices: connectedDevices.map(([addr, s]) => ({ address: addr, name: s.name })),
        });
      }
    } catch {
      registry.report('bluetooth', 'healthy', 'Adapter available (PipeWire check failed)');
    }

    return true;
  }
```

**Step 4: Run tests**

```bash
cd backend && npx jest --testPathPattern="bluetoothService" --verbose
```

Expected: All pass.

**Step 5: Run full test suite**

```bash
cd backend && npm run test:unit
```

Expected: All pass.

**Step 6: Commit**

```bash
git add backend/src/services/bluetoothService.js backend/tests/
git commit -m "feat: BT health check verifies PipeWire sink for connected devices"
```

---

## Phase 4: Documentation & Integration Tests

### Task 8: Update documentation

**Files:**
- Modify: `CLAUDE.md` (root)
- Modify: `backend/CLAUDE.md`
- Modify: `ALNScanner/CLAUDE.md`
- Modify: `docs/preflight-checklist.md`

**Step 1: Update root CLAUDE.md**

Remove or update:
- Line 254: Remove "combine-bt virtual sink (dual BT speakers)" from Phase 3 features description

**Step 2: Update backend CLAUDE.md**

- Phase 3 section (line 453+): Remove combine-sink paragraph, keep ducking engine and routing inheritance
- Remove `audio:combine:create` and `audio:combine:destroy` from gm:command actions table (lines 469-470)
- Update key files line (482): Remove "(combine-sink + ducking)" — just "ducking"
- Remove the IMPORTANT note about `createCombineSink()` using `_execFile()` (line 455)

**Step 3: Update ALNScanner/CLAUDE.md**

Line 705: Remove "combine-bt sinks" from AudioController description. Change to reference HDMI and Bluetooth sinks only.

**Step 4: Update preflight-checklist**

Remove section 7.6 ("pw-loopback (PipeWire Virtual Sinks)") entirely — lines 663-672.
Also remove `pw-loopback` from the binary check lists at lines 832 and 1627.

**Step 5: Commit**

```bash
git add CLAUDE.md backend/CLAUDE.md ALNScanner/CLAUDE.md docs/preflight-checklist.md
git commit -m "docs: remove combine-sink references from documentation"
```

### Task 9: Run integration and E2E tests

**Step 1: Run integration tests**

```bash
cd backend && npm run test:integration
```

Expected: Pass (combine-sink integration tests removed in Task 4).

**Step 2: Run E2E tests (if orchestrator running)**

```bash
cd backend && npm run test:e2e
```

Expected: Pass (E2E doesn't test combine-sink directly — but verify no regressions).

**Step 3: Manual smoke test**

```bash
# Test BT audio with MaxEBeats
pw-play --target bluez_output.2C_81_BF_0D_E4_C1.1 /usr/share/sounds/freedesktop/stereo/bell.oga

# Test HDMI audio
pw-play --target alsa_output.platform-107c701400.hdmi.hdmi-stereo /usr/share/sounds/freedesktop/stereo/bell.oga

# Check health endpoint
curl -k https://localhost:3000/health | python3 -m json.tool
```

### Task 10: Final commit with all changes

Only if there are uncommitted fixes from test runs:

```bash
git add -A
git commit -m "fix: address test failures from BT simplification"
```

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| WirePlumber config | `auto-connect` overridden by lua rules, SBC-XQ disabled | Lua config fixed (3 line edits in `50-bluez-config.lua`) |
| CPU governor | `ondemand` (1500-2400 MHz) | `performance` (locked 2400 MHz) |
| Combine-sink | ~250 lines, 8 methods, 2 commands, spawns pw-loopback | Removed entirely (backend + config-tool + docs) |
| `_enforceA2DPProfile()` | Forces `a2dp-sink` profile (fights WirePlumber) | `_verifyA2DPProfile()` — checks and warns (gated on Task 1 verification) |
| `checkHealth()` | "Is adapter powered on?" | Also verifies connected devices have PipeWire sinks |
| `getState()` | Returns `combineSinkActive` | Field removed |
| Config-tool | Dropdown includes `combine-bt` | Removed from 3 files |
| Preflight checklist | Lists `pw-loopback` as required | Section removed |

**Lines removed:** ~350 (combine-sink code + tests + docs + config-tool)
**Lines added:** ~40 (verify profile + enhanced health check)
**Net simplification:** ~310 lines removed
