# Phase 4.5: Test Suite Investigation & Architecture Design

**Created**: 2025-09-30
**Status**: 📋 PLANNED - Ready to Execute
**Critical Insight**: Tests are part of the contract. Must investigate and redesign test suite BEFORE creating refactor plan.

---

## Why This Phase Exists

**Problem Identified**:
- Current test suite likely confused (follows confused architecture)
- Tests may validate WRONG behaviors (old patterns we're fixing)
- Contract-First requires Test-First (tests validate contracts)
- Can't safely refactor without knowing test implications

**Original Plan** (WRONG ORDER):
```
Contracts → Refactor Plan → Implement → Fix Tests
```

**Corrected Plan** (RIGHT ORDER):
```
Contracts → Test Investigation → Test Architecture → Refactor Plan (w/tests) → Implement + Tests Together
```

**Why This Matters**:
- Tests that validate wrong behaviors will fight correct refactoring
- Missing tests mean no validation of contract compliance
- Need to know test effort BEFORE planning refactor
- Tests are executable specifications of our 12 decisions

---

## Investigation Objectives

1. **Inventory Current Tests**: Catalog all existing tests, frameworks, structure
2. **Map Tests to APIs**: Which of our 29 APIs have tests? Which don't?
3. **Identify Test Confusion**: Tests validating old/wrong behaviors per our decisions
4. **Gap Analysis**: What SHOULD be tested based on Contract-First decisions
5. **Test Architecture Design**: How to structure tests for contract validation
6. **Integration Strategy**: How tests change alongside refactoring

---

## Step-by-Step Process

### Step 1: Current Test Inventory (30 minutes)

**Objective**: Find and catalog everything that exists

**Actions**:
```bash
# Explore backend test structure
ls -la backend/tests/
find backend/tests/ -name "*.test.js" -o -name "*.spec.js"
cat backend/package.json | grep test  # Check test scripts
```

**Document In**: `docs/api-alignment/work/TEST-INVENTORY.md`

**Capture**:
- Test file locations
- Test frameworks used (Jest, Mocha, etc.)
- Test organization (unit, integration, contract, e2e?)
- Test run commands
- Dependencies (testing libraries)
- Total test count

---

### Step 2: Test Coverage Analysis (60 minutes)

**Objective**: Map existing tests to our 29 APIs and 12 decisions

**Actions**:
- Read each test file
- Map tests to specific APIs (HTTP endpoints, WebSocket events)
- Identify tests validating behaviors we're CHANGING (per 12 decisions)
- Identify tests validating behaviors we're KEEPING
- Identify missing tests (APIs with no coverage)

**Document In**: `docs/api-alignment/05-test-analysis.md`

**Structure**:
```markdown
## WebSocket Event Tests

### transaction:new
- ✅ **Existing Test**: tests/websocket/transaction.test.js:45-67
- ⚠️ **Problem**: Tests unwrapped format (Decision 2 changes to wrapped)
- 🔄 **Action Required**: Update test to expect wrapped format

### state:update
- ✅ **Existing Test**: tests/websocket/state.test.js:120-145
- ❌ **Problem**: Tests wrong behavior (Decision 6 eliminates this event)
- 🔄 **Action Required**: DELETE test entirely

## HTTP Endpoint Tests

### POST /api/scan
- ✅ **Existing Test**: tests/routes/scan.test.js:30-55
- ⚠️ **Problem**: Tests old response format (Decision 3 changes format)
- 🔄 **Action Required**: Update response assertions

### POST /api/session
- ✅ **Existing Test**: tests/routes/session.test.js:10-35
- ✅ **Correct**: Already tests RESTful format (matches Decision 3)
- ✅ **Action Required**: None - keep as-is

## Missing Tests

### video:status Event
- ❌ **No Test Found**
- 🆕 **Action Required**: Create test validating Decision 5 contract
```

**Deliverable**: Complete mapping of all 29 APIs showing:
- Existing tests (with file:line references)
- Tests that need updating (validate wrong behaviors)
- Tests that need deleting (validate eliminated features)
- Tests that are correct (validate right behaviors)
- Missing tests (gaps in coverage)

---

### Step 3: Test Architecture Design (30 minutes)

**Objective**: Design how tests should validate contracts

**Actions**:
- Decide on test framework strategy (keep existing or modernize?)
- Design test organization structure
- Define contract validation approach
- Plan integration with OpenAPI/AsyncAPI

**Document In**: `docs/api-alignment/06-test-architecture.md`

**Key Decisions to Make**:

1. **Test Layers**:
   - Contract Tests (validate OpenAPI/AsyncAPI specs)
   - Integration Tests (end-to-end flows)
   - Unit Tests (individual components)

2. **Contract Validation**:
   - Use existing test framework or add contract testing library?
   - Options: `jest-openapi`, `chai-openapi`, `swagger-mock-validator`
   - How to validate WebSocket AsyncAPI contracts?

3. **Test Organization**:
   ```
   backend/tests/
   ├── contract/           # OpenAPI/AsyncAPI validation
   │   ├── http.test.js    # All HTTP endpoints vs OpenAPI
   │   └── websocket.test.js  # All WebSocket events vs AsyncAPI
   ├── integration/        # End-to-end flows
   │   ├── scan-flow.test.js
   │   └── session-flow.test.js
   └── unit/              # Component tests
       ├── services/
       └── models/
   ```

4. **Test Patterns**:
   ```javascript
   // Contract Test Pattern
   describe('POST /api/scan', () => {
     it('response matches OpenAPI contract', async () => {
       const response = await request(app).post('/api/scan').send(validRequest);
       expect(response).toMatchApiSchema(openapi, '/api/scan', 'post');
     });
   });

   // Integration Test Pattern
   describe('Video Playback Flow', () => {
     it('triggers video on token scan with video', async () => {
       // Test complete flow per contracts
     });
   });
   ```

**Deliverable**: Clear test architecture aligned with Contract-First approach

---

### Step 4: Update Investigation Documents (15 minutes)

**Actions**:
- Update `00-INDEX.md` with Phase 4.5 status
- Add test investigation to progress tracking
- Document test effort estimates

---

## Expected Deliverables

### New Files Created:

1. **`work/TEST-INVENTORY.md`**
   - Raw catalog of all existing tests
   - Test framework details
   - Test commands and scripts

2. **`05-test-analysis.md`**
   - Mapping: 29 APIs → Test Status
   - Tests needing updates (validate wrong behaviors)
   - Tests needing deletion (validate eliminated features)
   - Missing tests (coverage gaps)
   - Breaking change impacts on tests

3. **`06-test-architecture.md`**
   - New test structure design
   - Contract validation strategy
   - Test framework decisions
   - Test patterns and examples

4. **Updated: `00-INDEX.md`**
   - Phase 4.5 added to timeline
   - Progress tracking updated

---

## Integration with Overall Plan

**Updated Project Timeline**:

```
✅ Phase 1: Backend API Analysis (01-current-state.md)
✅ Phase 2: Scanner Investigation (02-scanner-analysis.md)
✅ Phase 3: Alignment Matrix (03-alignment-matrix.md)
✅ Phase 4: Design Decisions (04-alignment-decisions.md)
🔄 Phase 4.5: Test Investigation & Architecture (THIS PHASE)
   ├── work/TEST-INVENTORY.md
   ├── 05-test-analysis.md
   └── 06-test-architecture.md
⏳ Phase 5: Create Contracts (backend/contracts/)
   ├── openapi.yaml (with test examples)
   └── asyncapi.yaml (with test examples)
⏳ Phase 6: Refactor Plan (07-refactor-plan.md)
   ├── Code changes (backend + scanners)
   ├── Test changes (update, delete, create)
   └── Migration strategy
⏳ Phase 7: Implementation
   ├── Code + Tests together
   └── Contract validation
```

**Why This Order**:
1. Decisions define what to build ✅
2. **Test investigation defines what to validate** ← We are here
3. Contracts formalize decisions + test requirements
4. Refactor plan includes code + test changes
5. Implementation follows plan with tests

---

## Success Criteria

Phase 4.5 complete when:
- [ ] All existing tests inventoried in TEST-INVENTORY.md
- [ ] All 29 APIs mapped to test status in 05-test-analysis.md
- [ ] All tests needing changes identified with reasons
- [ ] All missing tests identified
- [ ] Test architecture designed in 06-test-architecture.md
- [ ] Contract validation strategy defined
- [ ] Test effort estimated for refactor plan
- [ ] 00-INDEX.md updated with Phase 4.5 status

---

## Estimated Timeline

| Step | Activity | Time | Output |
|------|----------|------|--------|
| 1 | Test Inventory | 30 min | work/TEST-INVENTORY.md |
| 2 | Test Coverage Analysis | 60 min | 05-test-analysis.md |
| 3 | Test Architecture Design | 30 min | 06-test-architecture.md |
| 4 | Update Docs | 15 min | 00-INDEX.md |
| **Total** | **Phase 4.5** | **2.25 hours** | 3 documents + updated index |

---

## Critical Reminder

**Tests are part of the contract, not an afterthought.**

Every test that validates the wrong behavior will:
- Block correct refactoring
- Require debugging (why is "correct" code failing tests?)
- Waste time

Every missing test means:
- No validation of contract compliance
- Bugs slip through
- Manual testing required

Spending 2 hours now investigating tests will save many hours during refactoring.

---

*Status*: 📋 PLANNED - Ready to Execute
*Next Action*: Begin Step 1 - Test Inventory
*Created*: 2025-09-30
