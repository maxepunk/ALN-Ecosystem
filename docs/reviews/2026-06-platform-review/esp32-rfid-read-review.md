# ESP32 RFID Read-Path Review — Reliability Analysis

**Date:** 2026-06-10
**Scope:** `arduino-cyd-player-scanner/ALNScanner_v5/` — `hal/RFIDReader.h`, `hal/NDEFParser.h`, `config.h`, `Application.h` (processRFIDScan), `ui/UIStateMachine.h`
**Symptom under investigation:** janky scanning in real games — frequent COMM FAILED / READ FAILED; players must reposition tokens repeatedly until a read lands.
**Note:** the troubleshooting-table reference to plan `/root/.claude/plans/bright-hopping-rossum.md R4` is NOT available in this environment; all analysis below is from code. The dangling reference should be replaced with a pointer to this review.

---

## 1. Read-path trace (boot → poll → detect → select → NDEF → result)

### Boot / init (`RFIDReader::begin()`, RFIDReader.h:755-847)

- Soft-SPI pins configured (SCK=22, MOSI=27, MISO=35, SS=3 — kills Serial RX). Soft reset, then:
  - `TModeReg=0x00` — timer OFF by default ("TIMER-FIX" beep mitigation, :786)
  - `TPrescalerReg=0xA9`, `TReload=0x03E8` → 25 ms hardware exchange timeout (:787-789)
  - `TxASKReg=0x40` — Force 100% ASK (:793)
  - `ModeReg=0x3D` — CRC preset 0x6363 (:796)
  - **`RFCfgReg=0x70` — RxGain = 48 dB, MAXIMUM** (:801). *The "common fix" of maximizing receiver gain is already in place — this hypothesis is refuted by code.*
  - `RxThresholdReg=0x84` (MinLevel=8, CollLevel=4 — chip reset default, i.e. effectively untuned) (:804)
  - `ModGsPReg=0x3F` (:807) — **no-op**: with Force100ASK set, TX drivers switch fully off during modulation pauses; ModGsP is only consulted when Force100ASK=0.
  - **`GsNReg` and `CWGsPReg` are never written** → TX drive strength stays at chip reset defaults (GsN=0x88, CWGsP=0x20 — roughly mid-strength). RX gain is maxed but **TX field strength is not.**
  - Antenna NOT enabled at boot (deferred, beep mitigation) (:816).

### Poll cadence (`Application::processRFIDScan()`, Application.h:458-556)

Guards: `_rfidInitialized` (:460), `_ui->isBlockingRFID()` (:464 — blocks during DISPLAYING_TOKEN / SHOWING_STATUS / PROCESSING_VIDEO; SCAN_FAILED deliberately does **not** block, UIStateMachine.h:284-288), and rate limit `RFID_SCAN_INTERVAL_MS=500` (:468, config.h:36).

### Detect (`detectCard()`, RFIDReader.h:849-921)

1. `enableRFField()` — TxControlReg=0x83, then `delay(ANTENNA_SETTLE_MS=5)` only on OFF→ON transition (:727-739). **The field is OFF the rest of the time** (disabled at the end of every poll), so every poll is a cold-field start: the tag must charge up and boot within ~5 ms before the WUPA frame.
2. Retry loop, MAX_RETRIES=3 (config.h:51):
   - `requestA()` sends **WUPA** (wakes IDLE *and* HALT cards) (:375-397).
   - **Attempt-1 timeout fast-path** (:871-876): `STATUS_TIMEOUT && attempt==1` → field off, return **`NoCard`** — silent, no retry spent. *This means the single most common weak-coupling failure signature (no decodable ATQA → timeout) gets exactly ONE WUPA shot per 500 ms and is never retried.*
   - Any other failure (WUPA error on attempt 1, or any failure on attempts ≥2) → `delay(RETRY_DELAY_MS=100)` and retry **within the same field session** (field stays on — good).
   - WUPA OK → `select()` full anticollision/select cascade (:399-564; BCC verified :471-475; collisions returned as-is, no bit-level resolution — fine for one-card-at-a-time gameplay).
   - Select OK → **`Detected`**, field left ON for the NDEF phase.
3. All 3 attempts exhausted → field off, `_stats.failedScans++`, return **`CommFailed`** → UI shows **"COMM FAILED"** (Application.h:483-488).

### NDEF (`extractNDEFText()` → `extractNDEFTextInternal()`, RFIDReader.h:650-723, 923-944)

1. SAK≠0x00 → immediate `""` (non-NTAG) → surfaces as **"READ FAILED"**.
2. Retry loop (MAX_RETRIES=3): `readPagesFast(3,10)` — single FAST_READ (0x3A), 32 data + 2 CRC bytes (:620-648). On success bytes go to `hal::parseNDEFText()` (NDEFParser.h:31). Parse failure (malformed TLV / wrong TNF / not a 'T' record / bad text bounds) also retries.
3. Between attempts: `delay(100)` then **reSelect recovery** — WUPA + `select()` (:709-718). If reSelect fails it *still* proceeds to the next FAST_READ ("next FAST_READ will try anyway").
4. All attempts exhausted → `""` → **"READ FAILED"** (Application.h:499-504).
5. On success only: `haltA()`; always: field off + `silenceSPIPins()` (:937-942).
6. Parse succeeded but tokenId not in DB → **"UNKNOWN TOKEN"** (Application.h:516-521).

### Failure-exit map

| User-visible | Producing path |
|---|---|
| *(silence — nothing happens)* | `NoCard`: single WUPA timed out on a cold field (RFIDReader.h:871). **Most marginal-coupling misses land here**, invisible to the player and to stats. |
| **COMM FAILED** | `detectCard` exhausted 3 attempts after at least one non-timeout/post-attempt-1 failure (:920) |
| **READ FAILED** | non-NTAG SAK (:661-664), or FAST_READ/parse failed 3× (:721) |
| **UNKNOWN TOKEN** | NDEF parsed but tokenId not in local DB (Application.h:516) — *can also be produced by an undetected bit-corrupt read parsing to a wrong string; see Bug B1* |

---

## 2. Ranked candidate root causes

### RC1 — Cold-field single-shot WUPA: field duty-cycling starves the tag, and the one poll that happens gets no retry — **HIGH confidence**

Evidence: `disableRFField()` at the end of every poll (RFIDReader.h:873, 915, 940); `ANTENNA_SETTLE_MS=5` (config.h:53) is the *only* energize time the tag gets before WUPA; attempt-1 timeout → `NoCard` with zero retries (RFIDReader.h:871-876); poll period 500 ms (config.h:36).

Mechanism: the RF field is on for roughly 5 ms settle + one WUPA window (≤25 ms timer) per 500 ms — a ~2-6% duty cycle. Each poll the NTAG must charge from zero and answer the **first** WUPA frame. It is well known (and the reason the stock MFRC522 library's examples effectively probe twice) that the first REQA/WUPA after field-on is frequently missed by a tag still ramping, especially at marginal coupling. A missed WUPA here is classified `NoCard` → the player sees *nothing* for another 500 ms, repositions the token, and the cycle repeats — exactly the reported "wave it around until it lands" behavior. The CYD+RC522 rig already has marginal coupling (the module sits behind/beside the case), so the cold-start miss rate is the dominant term.

### RC2 — Retry ladders fight the ISO 14443-3 state machine: WUPA-based recovery burns attempts deterministically — **HIGH confidence**

Evidence: `detectCard` retries restart at `requestA()` (RFIDReader.h:869); NDEF reSelect does WUPA+select and proceeds to FAST_READ even when reSelect failed (:709-718).

Mechanism: WUPA only elicits a response from IDLE/HALT cards. A card in READY (WUPA answered, select's reply lost reader-side) or ACTIVE (selected, FAST_READ reply lost reader-side) does **not** answer WUPA — it silently drops back to IDLE. So after a reader-side decode failure:

- `detectCard` attempt 2's WUPA gets a guaranteed timeout (it merely knocks the card READY→IDLE); only attempt 3 can actually re-detect. MAX_RETRIES=3 therefore yields **one** real second chance.
- NDEF retry: the card is ACTIVE; reSelect's WUPA knocks it to IDLE and times out; the code then runs FAST_READ against an unselected card — guaranteed failure, burning attempt 2; attempt 3's reSelect finally works. **3 nominal attempts ≈ 1-2 effective attempts**, so "retries never recover" in the field logs is partially structural, not RF.

(Side note: when the *card* missed the reader's frame instead, it stays in its old state and the current sequence happens to work — so behavior is coin-flip depending on which side dropped the frame. That matches the erratic field experience.)

### RC3 — TX drive not maximized (GsN/CWGsP at reset defaults) while RxGain already is — **MEDIUM confidence**

Evidence: `begin()` sets RxGain=max (RFIDReader.h:801) and writes the irrelevant `ModGsPReg` (:807, no-op under Force100ASK :793), but never touches `GsNReg` (reset 0x88) or `CWGsPReg` (reset 0x20). The carrier the tag harvests power from is weaker than the chip can produce. With a marginal mechanical layout, raising CW conductance (e.g. `GsNReg=0xF4`, `CWGsPReg=0x3F`) directly enlarges the usable coupling volume and shortens tag charge-up — compounding with RC1. This is the TX-side sibling of the "set gain to 48 dB" folk fix; the RX side was already done.

### RC4 — Received-frame integrity is never verified (CRC_A unchecked) — **MEDIUM confidence as a *symptom contributor*, certain as a defect**

Evidence: `transceiveData(..., bool checkCRC=false)` — the parameter is declared (RFIDReader.h:117, 275) and **never used in the body**; `RxModeReg` is never written (RxCRCEn=0). The 2 CRC_A bytes of FAST_READ (:671 buffer sized 34) and SAK responses are received and ignored. Only parity (ErrorReg 0x13 check, :350) and the anticollision BCC (:471) guard integrity.

Mechanism: at marginal coupling, multi-bit errors that happen to preserve per-byte parity pass straight into the NDEF parser. Outcomes: parse rejects garbage → counted as a retry/READ FAILED; or worse, garbage parses to a plausible wrong string → **"UNKNOWN TOKEN" on a good token**. The troubleshooting table's "UNKNOWN TOKEN on real game cards → suspect DB sync" row has a second, unlisted cause.

### RC5 — Retry pacing wastes the window: RETRY_DELAY_MS=100 has no protocol justification — **MEDIUM confidence**

Evidence: config.h:52 ("community-standard for NTAG state recovery" — that figure applies to *re-energize after field-off*; here the field stays ON across retries, the tag is powered, and state recovery needs ~ms). Each failed scan burns up to ~300-400 ms in delays inside one 500 ms poll slot, with the field on (beep exposure) yet only ~1-2 effective attempts (RC2). Shorter spacing (10-20 ms) would fit 5+ attempts in less wall-clock and less field-on time.

### RC6 — 500 ms beep-mitigation interval as a multiplier — **MEDIUM confidence (multiplier, not root)**

Evidence: config.h:36; Application.h:468. The interval itself is tolerable *if* each poll were high-yield. Combined with RC1's per-poll miss probability, expected time-to-success = 500 ms / P(hit). If P(hit) at marginal coupling is ~30%, mean latency ~1.7 s with high variance — perceived as "janky". Fixing RC1-RC3 raises P(hit); shrinking the interval is the riskier lever (more SPI traffic → more GPIO27 beep) and should be last.

### RC7 — Soft-SPI timing — **LOW confidence (likely NOT a contributor)**

Evidence: RFIDReader.h:158-187 — 2 µs phases inside `portENTER_CRITICAL` per byte (~100-150 kHz effective, MFRC522 tolerates 10 MHz; mode-0 phases respected; per-byte critical section prevents preemption-induced glitches). `OPERATION_DELAY_US=10` around SS. This is conservative and sound. Slow SPI lengthens the ComIrq polling loop granularity (~0.3 ms/iteration) but the 25 ms hardware timer governs the exchange, not SPI speed. The MOSI-held-LOW beep mitigation (:749-751) only applies between transactions and is irrelevant to SPI mode-0 correctness. No action needed.

---

## 3. Proposed experiments / changes (ordered by expected value)

### (a) Safe-to-implement-now code improvements

**P1. Double-probe WUPA before declaring NoCard** *(addresses RC1 — highest EV)*
- Change: in `detectCard`, on attempt-1 WUPA timeout, wait ~5 ms and send one more WUPA before returning `NoCard`. Optionally shorten the hardware timer reload for polling WUPAs (ATQA arrives in ~100 µs; a 5 ms timeout instead of 25 ms more than pays for the second probe).
- Expected: large reduction in silent misses; tags caught on the second frame after cold-field boot. This is the single highest-EV change.
- Risk: idle field-on time per poll changes from ~30 ms to ~15 ms (with shortened timer) or ~60 ms (without). With the shortened timer, beep exposure *decreases*. Low risk.
- Verify on device: serial `RFID_STATS` (see §4) before/after — watch `noCardPolls` vs `wupaHits` ratio while holding a token at a fixed marginal position; count taps-to-success over 20 trials. Listen for beep change while idle (no token) for 60 s.

**P2. Fix retry structure for the ISO state machine** *(RC2)*
- Change: (i) in `detectCard` retries, on WUPA timeout when attempt>1, immediately send a second WUPA (first one may have only knocked READY→IDLE) instead of burning the attempt; (ii) in NDEF reSelect, if `requestA` times out, retry `requestA` once before `select`, and if reSelect still fails, **skip** the doomed FAST_READ and go straight to the next recovery cycle.
- Expected: 3 nominal retries become ~3 effective; "retries never recover" logs should largely disappear for transient blips.
- Risk: none to beeping (same exchanges, reordered). Low.
- Verify: NDEF_DEBUG capture during a session — `[NDEF-RETRY] Recovered on attempt 2` should appear where `[NDEF-FAIL]` did; track `recoveredOnAttempt[]` histogram.

**P3. Verify CRC_A on FAST_READ (and SAK) responses** *(RC4 — also Bug B1)*
- Change: after a successful FAST_READ transceive, run the 32 data bytes through `calculateCRC` and compare to the 2 trailing bytes; mismatch → treat as failed attempt (retry). Same (cheap) for the 3-byte SAK response.
- Expected: converts silent corruption into retries; eliminates corrupt-read "UNKNOWN TOKEN"s; failure attribution becomes trustworthy.
- Risk: none (pure validation; CRC coprocessor already used for TX). Adds ~1 ms per read.
- Verify: add a `crcRejects` counter; nonzero values during a session confirm corruption was passing through before.

**P4. Raise ANTENNA_SETTLE_MS 5 → 20-30** *(RC1)*
- Change: config.h:53 constant only.
- Expected: tags reliably booted before the first WUPA; complements P1.
- Risk: +15-25 ms unmodulated carrier per poll. The carrier itself is not the documented beep source (GPIO27 SPI switching is), but "RF field off when idle" is listed as a mitigation, so confirm by ear. Low.
- Verify: A/B 5 vs 25 ms, 20 taps each at fixed marginal position; record `wupaHits`/tap.

**P5. RETRY_DELAY_MS 100 → 15, MAX_RETRIES 3 → 5** *(RC5)*
- Expected: more effective attempts per poll, lower failure latency, less total field-on time per failed poll.
- Risk: low; retries already run with field on. Watch beep during a deliberately failed scan (token at extreme edge).
- Verify: time-to-success distribution; `[RFID-RETRY]`/`[NDEF-RETRY]` recovery-attempt histogram.

**P6. Move `TModeReg=0x00` to all transceive exits** *(Bug B3 hygiene; keeps the TIMER-FIX invariant honest)* — trivial, no measurable risk.

### (b) Parameter A/B experiments needing hardware trials

**E1. Maximize TX drive: `GsNReg=0xF4`, `CWGsPReg=0x3F` in `begin()`** *(RC3)*
- Rationale: stronger carrier → more tag power at the same physical placement; directly widens the sweet spot players are hunting for.
- Expected: noticeably larger reliable-read zone; faster tag charge-up (synergy with P1/P4).
- Risk: marginally more RC522 module heat; possible over-coupling/detune at zero distance (test token flat on the pad); beep risk low — the documented coupling path is the GPIO27 SPI trace, not the antenna, but verify by ear since the field also got blamed historically.
- Verify: map read-success vs token offset (center, 1 cm, 2 cm, 45° tilt) before/after, 10 trials each cell.

**E2. RxThreshold sweep: 0x84 → 0x55 / 0x44** 
- Rationale: MinLevel=8 (reset default) ignores weak subcarrier; lowering it lets marginal responses decode.
- Expected: fewer attempt-1 timeouts at distance; possible increase in noise artifacts.
- Risk: phantom/garbled detections — **only run after P3 (CRC check)** so garbage is caught; watch `collisionErrors`/`crcRejects`.
- Verify: same offset map as E1; compare `crcRejects` rate between threshold values.

**E3. Hot-retry window after any failure** *(RC1+RC6)*
- Rationale: after `CommFailed`/READ FAILED, the player is actively holding/adjusting the token. Keep the field ON and poll every ~50 ms for the 1.5 s SCAN_FAILED window instead of returning to 500 ms cold polls.
- Expected: the "reposition until it lands" loop resolves within the failure screen instead of across many seconds.
- Risk: **highest beep risk of all proposals** — sustained field + frequent SPI bursts is exactly what the 500 ms interval mitigates. Must be A/B'd by ear in a quiet room. Gate it behind a config.txt flag (`HOT_RETRY=true`) so it can be disabled in the field.
- Verify: taps-to-success and time-to-success on 20 marginal-placement trials; subjective beep rating idle/active.

**E4. RFID_SCAN_INTERVAL_MS 500 → 250 (with P1's shortened WUPA timer)** — only if P1-P5+E1 leave residual jank; re-run the original beep assessment that produced the 500 ms figure.

---

## 4. Instrumentation upgrades

Current state: `RFIDStats` (RFIDReader.h:29-37) is collected but **never surfaced** — `getStats()` has zero callers; the `STATUS` serial command (Application.h:976-997) prints only connection/queue/heap. `DEAD_CODE_ANALYSIS.txt` even proposes deleting `resetStats()`. Effectively the device has scan-quality telemetry that no one can see.

1. **`RFID_STATS` serial command** (and append the same block to `STATUS`): print totalScans, successfulScans, failedScans, retryCount, collisionErrors, timeoutErrors, crcErrors, plus the new counters below; accept `RFID_STATS:RESET`.
2. **Per-stage failure histogram** — extend `RFIDStats`:
   - `noCardPolls`, `wupaHits`, `wupaRetrySaves` (P1 second-probe successes), `selectFails`, `fastReadFails`, `parseFails`, `crcRejects` (P3), `unknownToken`, `commFailedShown`, `readFailedShown`
   - `recoveredOnAttempt[MAX_RETRIES]` histograms for detect and NDEF separately — this is the direct measure of whether P2 works.
3. **Machine-parseable per-scan outcome line** (always-on, INFO level — Serial TX survives RFID mode):
   `[SCAN-METRIC] outcome=<ok|comm|read|unknown> stage=<wupa|select|fastread|parse|db> attempts=<n> dur_ms=<t>` — one line per non-NoCard poll. A whole session becomes `grep '\[SCAN-METRIC\]'` + a 10-line awk into success rate, retry distribution, and per-stage failure shares; this makes every A/B in §3 measurable with the existing passive-capture recipe (`stty … raw && cat /dev/ttyUSB0 | tee session.log` — do NOT use `arduino-cli monitor`, per the GPIO3 contention warning).
4. **NDEF_DEBUG additions**: on each FAST_READ failure log the MFRC522 `ErrorReg` value and FIFO level alongside the status code (currently only the status enum is printed, RFIDReader.h:636); on parse failure the raw 32 bytes are already dumped — keep that.
5. **RSSI proxy — honest limitation**: the MFRC522 has no signal-strength register. Best available proxies: (a) attempts-to-success per scan (free with #2), (b) `crcRejects`+parity-error rate as a link-quality indicator, (c) an offline "gain-step-down probe" diagnostic command (re-read at RxGain 33 dB; success there = strong coupling) — useful on the bench, too slow for live scans.
6. **Periodic stats heartbeat**: every 60 s while idle, emit one `[RFID-STATS] …` summary line so a session log carries trend data even if no one runs commands.

---

## 5. Outright bugs (vs. tuning)

- **B1 — `checkCRC` parameter is dead; received CRC_A never verified anywhere.** `transceiveData` declares `bool checkCRC=false` (RFIDReader.h:117, 275) and the body contains no implementation; `RxModeReg` (hardware RxCRCEn) is never enabled. FAST_READ data (34-byte buffer incl. 2 CRC bytes, :671) and SAK responses are consumed unvalidated. Parity catches only odd-bit-per-byte errors. Consequence: corrupt reads can surface as wrong tokenIds ("UNKNOWN TOKEN" on good tokens) or be misattributed. This is a correctness defect, not tuning. Fix = P3.
- **B2 — `RFIDStats` is write-only telemetry.** Collected (:892-917, :688) but unreachable by any command or screen; additionally inconsistent: `failedScans` increments only on detect exhaustion, never on NDEF failure; `retryCount` accrues only on *successful* recoveries, so the worst scans (failures) contribute zero retry data. Fix = §4.
- **B3 — TIMER-FIX invariant broken on every error path.** `TModeReg=0x00` (timer off, beep mitigation) executes only on the full-success exit of `transceiveData` (:370); the timeout (:318, :327), collision (:346), error (:352), and NO_ROOM (:359) exits all leave `TModeReg=0x80`. Since the idle `NoCard` poll exits via the timeout path, the timer the mitigation is supposed to keep "off by default" is in fact left enabled after the very first idle poll. Functionally near-benign (TAuto is one-shot) but it contradicts the documented mitigation; trivial fix (P6).
- **B4 — `detectCard` can report COMM FAILED with no card present.** The fast-path (:871) covers only `STATUS_TIMEOUT && attempt==1`; a noise-induced `STATUS_ERROR`/`STATUS_COLLISION` on attempt 1 with an empty field enters the retry ladder and ends in a user-visible "COMM FAILED". Cosmetic-to-confusing; cheap to gate (require at least one WUPA success before classifying CommFailed).
- **B5 — `rxAlign` ignored in multi-byte `readRegister`** (:220-232): parameter accepted, alignment mask never applied. Latent (all current callers pass 0), but a trap for future bit-oriented anticollision work.
- **B6 — NDEF reSelect knowingly proceeds against an unselected card** (:714-718): when reSelect fails, the next FAST_READ is a guaranteed-failure attempt charged against MAX_RETRIES. Combined with RC2's WUPA state-machine mismatch this is deterministic attempt-burning, not a tolerable fallback. Fix = P2(ii).
- **Doc bug** — the CLAUDE.md troubleshooting row for "SCAN FAILED repeats on good tokens" points to a nonexistent local plan file (`/root/.claude/plans/bright-hopping-rossum.md R4`); should point at a checked-in document (e.g., this review).

---

## Summary verdict

The receiver gain folk-fix is already applied (RxGain=48 dB max). The dominant reliability losses are structural: a ~2-6% RF-field duty cycle with a single un-retried WUPA per 500 ms cold start (RC1), retry ladders that fight the ISO 14443-3 state machine and reduce 3 retries to ~1 effective (RC2), and an un-maximized TX carrier (RC3) — compounded by a data-integrity hole (B1) that both corrupts outcomes and pollutes the diagnosis. P1+P2+P3 are safe, beep-neutral, and should be implemented first; E1 (TX drive) is the highest-value hardware A/B; E3 (hot-retry window) has the biggest upside but carries the real beep-regression risk and must be field-flagged.
