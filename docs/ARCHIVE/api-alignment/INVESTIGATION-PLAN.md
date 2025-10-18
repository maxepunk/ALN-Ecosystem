# Scanner Module Detailed Investigation Plan

**Created**: 2025-09-29
**Status**: 🔄 Draft - Awaiting User Review & Approval
**Based On**: Cursory investigation findings (SCANNER-CURSORY-FINDINGS.md)

---

## Executive Summary

Based on cursory investigation, we've identified:
- **GM Scanner**: Heavy WebSocket usage with specific event format dependencies (HIGH RISK for breaking changes)
- **Player Scanner**: Simple HTTP integration with 3 endpoints (MEDIUM RISK)
- **Both**: Dual-mode architecture (standalone + networked)

This plan focuses on **tracing actual field usage** in responses to quantify breaking change risks.

---

## Investigation Objectives

1. **Identify every field accessed** from API responses in both scanners
2. **Document error handling patterns** (what fields are checked for errors?)
3. **Map breaking change impact** for each standardization option
4. **Understand standalone mode** fallback behavior
5. **Create migration complexity matrix** for decision-making

---

## Phase 1: GM Scanner Deep Dive

**Time Estimate**: 2-3 hours

### 1.1 WebSocket Event Response Parsing

**Target**: Understand exactly what fields are used from each event

#### A. `transaction:result` Event
**Code Location**: ALNScanner/index.html:5470-5493

**Tasks**:
- [ ] Find where `result` object is accessed
- [ ] Document all field accesses: `result.status`, `result.transactionId`, etc.
- [ ] Check if code handles wrapped vs unwrapped formats
- [ ] Identify error detection logic

**Method**: Search for `transaction:result` and trace variable usage

#### B. `score:updated` Event
**Code Location**: ALNScanner/index.html:5799-5806

**Tasks**:
- [ ] Document how `data.data` is accessed
- [ ] Find what score fields are used: `currentScore`, `bonusPoints`, `completedGroups`, etc.
- [ ] Check if wrapped format `{event, data, timestamp}` is required
- [ ] Trace to UI rendering code

**Method**: Search for `score:updated` and follow data flow to UI

#### C. `state:sync` and `state:update` Events
**Code Locations**: Lines 5856-5931 (state:sync), 5782-5785 (state:update)

**Tasks**:
- [ ] Document GameState fields accessed
- [ ] Check delta update handling in `state:update`
- [ ] Find admin panel display code
- [ ] Verify if full vs partial state matters

**Method**: Trace state object through admin panel update functions

#### D. Other WebSocket Events
**Events**: `video:status`, `group:completed`, `team:created`, `error`

**Tasks**:
- [ ] Document field usage for each
- [ ] Check error event structure expectations
- [ ] Verify video status value handling (playing, paused, idle, etc.)

### 1.2 HTTP Response Parsing

#### A. Session API Responses
**Code Locations**: Lines 1775-1786 (create), 1805-1810 (pause/resume)

**Tasks**:
- [ ] Trace session object usage: `data.id`, `data.status`
- [ ] Find where session data is displayed
- [ ] Check error handling: what fields indicate errors?

**Method**: Search for `currentSession` usage throughout codebase

#### B. Video Control Response
**Code Location**: Lines 1885+ (AdminModule.VideoController)

**Tasks**:
- [ ] Find response handling code (must be further down)
- [ ] Document what fields are checked
- [ ] Identify success/error detection logic

**Method**: Search for `/api/video/control` and trace response handling

### 1.3 Error Handling Analysis

**Tasks**:
- [ ] Search for `response.error` checks
- [ ] Search for `result.status === 'error'` checks
- [ ] Search for `data.code` or `error.code` usage
- [ ] Document error message display patterns

**Method**:
```bash
grep -n "\.error" ALNScanner/index.html | grep -v "console.error"
grep -n "status.*error\|error.*status" ALNScanner/index.html
```

### 1.4 Deliverables

- **GM-Scanner-API-Usage.md**: Complete field usage map
- **GM-Scanner-Error-Handling.md**: Error detection patterns
- **GM-Scanner-Breaking-Changes.md**: Risk matrix for each potential change

---

## Phase 2: Player Scanner Deep Dive

**Time Estimate**: 1-2 hours

### 2.1 Scan Response Usage

**Code Location**: Need to find in aln-memory-scanner/index.html

**Tasks**:
- [ ] Search index.html for orchestratorIntegration usage
- [ ] Find where scan response is handled
- [ ] Document field accesses: `status`, `videoPlaying`, `mediaAssets`, etc.
- [ ] Trace to UI feedback code

**Method**:
```bash
grep -n "orchestratorIntegration\|scanToken" aln-memory-scanner/index.html
grep -n "videoPlaying\|mediaAssets" aln-memory-scanner/index.html
```

### 2.2 Status Values in Use

**Tasks**:
- [ ] Find all checks for `response.status` values
- [ ] Document UI behavior for: 'accepted', 'rejected', 'queued'
- [ ] Check if any other status values are handled
- [ ] Verify `waitTime` usage for rejected scans

### 2.3 Batch Response Parsing

**Code Location**: orchestratorIntegration.js:108-139

**Current Code**:
```javascript
const response = await fetch(`${this.baseUrl}/api/scan/batch`, {...});
if (response.ok) {
  console.log('Batch processed successfully');
  // No response parsing visible
}
```

**Tasks**:
- [ ] Verify if batch response data is actually used
- [ ] Check if `results` array is accessed anywhere
- [ ] Document if this is fire-and-forget

### 2.4 Error Handling

**Tasks**:
- [ ] Check orchestratorIntegration.js error catches
- [ ] Find error display in index.html
- [ ] Document what constitutes an "error" vs "queued" vs "rejected"

### 2.5 Deliverables

- **Player-Scanner-API-Usage.md**: Complete field usage map
- **Player-Scanner-Error-Handling.md**: Error detection patterns
- **Player-Scanner-Breaking-Changes.md**: Risk matrix

---

## Phase 3: Breaking Change Risk Matrix

**Time Estimate**: 1 hour

### 3.1 Create Comprehensive Matrix

For each API endpoint/event, document:

| API Endpoint/Event | Current Format | Fields Actually Used | Required? | Breaking Risk | Migration Notes |
|--------------------|----------------|---------------------|-----------|---------------|-----------------|
| POST /api/scan | Pattern A | status, videoPlaying, ... | Yes | HIGH | ... |
| transaction:result | ? | status, transactionId, ... | Yes | HIGH | ... |
| score:updated | Wrapped | data.data.currentScore, ... | Yes | HIGH | ... |
| ... | ... | ... | ... | ... | ... |

### 3.2 Categorize Changes by Impact

**Format-Level Changes**:
- Envelope structure (wrapped vs unwrapped)
- Status field presence (`status` vs `success` vs none)
- Error field structure

**Field-Level Changes**:
- Removing fields
- Renaming fields
- Changing field types
- Adding required fields

**Impact Levels**:
- 🔴 **BREAKING**: Scanner code will fail
- 🟡 **DEGRADED**: Scanner works but loses functionality
- 🟢 **COMPATIBLE**: Scanner works unchanged

---

## Phase 4: Standardization Scenario Analysis

**Time Estimate**: 1 hour

### 4.1 For Each Response Format (A, B, C, D)

**If we standardize everything to Pattern X**:

1. **GM Scanner Changes**:
   - List every code change needed
   - Estimate lines of code affected
   - Note testing requirements

2. **Player Scanner Changes**:
   - List every code change needed
   - Estimate lines of code affected
   - Note testing requirements

3. **Rollout Strategy**:
   - Can we support both formats during migration?
   - Need v1/v2 API versioning?
   - Coordinated release required?
   - Backward compatibility period?

### 4.2 Hybrid Approaches

**Option 1**: Different formats for different domains
- Keep Pattern A for scan operations (domain-specific)
- Keep Pattern B for transactions
- Standardize errors only

**Option 2**: Gradual migration
- v1 API: Current formats
- v2 API: Standardized formats
- Deprecation timeline

**Option 3**: Additive standardization
- Add standard fields alongside existing ones
- Deprecate old fields over time
- No breaking changes

---

## Phase 5: Documentation & Recommendations

**Time Estimate**: 1-2 hours

### 5.1 Complete Analysis Document (02-scanner-analysis.md)

**Structure**:
```markdown
# Scanner API Analysis

## GM Scanner
### WebSocket Events
- transaction:result: [field usage, breaking change risk]
- score:updated: [...]
...

### HTTP Endpoints
- POST /api/session: [field usage, breaking change risk]
...

### Error Handling
- Checks response.error: [yes/no]
- Checks response.status: [yes/no]
...

## Player Scanner
### HTTP Endpoints
- POST /api/scan: [field usage, breaking change risk]
...

## Breaking Change Matrix
[Complete table from Phase 3]

## Standardization Scenarios
[Analysis from Phase 4]

## Recommendations
[Specific recommendations with rationale]
```

### 5.2 Update INDEX.md

Mark scanner analysis as complete, update status

---

## Investigation Methods & Tools

### Code Search Commands

```bash
# Find all field accesses on response objects
grep -n "response\.\|result\.\|data\." ALNScanner/index.html

# Find error checks
grep -n "\.error\|\.status.*error" ALNScanner/index.html aln-memory-scanner/index.html

# Find status value checks
grep -n "status.*===\|===.*status" ALNScanner/index.html aln-memory-scanner/index.html

# Find video-related code
grep -n "videoPlaying\|mediaAssets" aln-memory-scanner/index.html
```

### Manual Tracing

1. Find API call (fetch or socket.emit)
2. Find response/result handler
3. Trace variable through code
4. Document every property access (use . or [])
5. Note conditional checks (if, switch, ternary)

### Documentation Template

For each API interaction:
```markdown
### [Endpoint/Event Name]

**Scanner**: GM / Player
**Type**: HTTP / WebSocket
**Location**: file:line

**Request Format**:
```javascript
{...}
```

**Response Format** (as documented):
```javascript
{...}
```

**Actual Field Usage**:
- `response.field1` - Used in line X for Y purpose
- `response.field2` - Used in line Z for W purpose
- ...

**Error Detection**:
- Checks: `response.error`, `response.status === 'error'`, HTTP status
- Displays: [how error is shown to user]

**Breaking Change Risk**: 🔴/🟡/🟢
**Reason**: [specific fields that would break]
```

---

## Success Criteria

Investigation complete when:
- [ ] Every WebSocket event handler traced
- [ ] Every HTTP endpoint response traced
- [ ] All field accesses documented
- [ ] Error handling patterns mapped
- [ ] Breaking change matrix complete
- [ ] Standardization scenarios analyzed
- [ ] Recommendations drafted
- [ ] User approval received

---

## Estimated Timeline

| Phase | Focus | Time | Dependencies |
|-------|-------|------|--------------|
| 1 | GM Scanner | 2-3h | - |
| 2 | Player Scanner | 1-2h | - |
| 3 | Risk Matrix | 1h | Phases 1, 2 |
| 4 | Scenarios | 1h | Phase 3 |
| 5 | Documentation | 1-2h | Phases 1-4 |
| **Total** | **Full Investigation** | **6-9 hours** | User approval |

---

## User Review Questions

**Scope**:
1. Does this plan address the right level of detail?
2. Are there additional aspects to investigate?
3. Should we prioritize one scanner over the other?

**Approach**:
4. Is manual code tracing the right method, or should we run the scanners?
5. Should we test API changes before deciding?
6. Any automated testing we should leverage?

**Deliverables**:
7. Are the proposed documents sufficient for decision-making?
8. Need any additional visualizations (diagrams, flowcharts)?
9. Should we include implementation estimates in the analysis?

**Timeline**:
10. Is 6-9 hours acceptable for this phase?
11. Need results faster? (Can we parallelize or reduce scope?)
12. Any hard deadlines to consider?

---

## Next Steps (Pending Approval)

1. User reviews this plan
2. User provides feedback / approves
3. Execute investigation phases
4. Present findings
5. Discuss standardization options
6. Make decisions → Document in 04-alignment-decisions.md
7. Create refactor plan → 05-refactor-plan.md

---

*Plan Status*: 🔄 Draft - Awaiting User Review & Approval
*Created*: 2025-09-29
*Ready to Execute*: Pending user feedback