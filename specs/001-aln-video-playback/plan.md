
# Implementation Plan: ALN Video Playback System Integration

**Branch**: `001-aln-video-playback` | **Date**: 2025-09-24 | **Spec**: `/specs/001-aln-video-playback/spec.md`
**Input**: Feature specification from `/specs/001-aln-video-playback/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Complete the integration of the ALN Video Playback and State Synchronization System by implementing the remaining components identified in PRD_ADDENDUM_COMPLETE.md. The system uses Node.js/Express for the orchestrator backend with Socket.io for WebSocket communication, integrates with existing scanner submodules, and adds network flexibility for deployment in any venue environment without requiring router configuration.

## Technical Context
**Language/Version**: Node.js 20+ or 22+ (ES6 modules), JavaScript (ES2020+), C++ (ESP32 Arduino)  
**Primary Dependencies**: Express.js (HTTP API), Socket.io (WebSocket), axios (VLC control), node-persist (session storage)  
**Storage**: JSON files for session persistence, localStorage for scanner state, SD card for ESP32 assets  
**Testing**: Jest for backend, manual integration testing for scanners  
**Target Platform**: Raspberry Pi 4 (orchestrator), Web browsers (scanners), ESP32 (hardware)
**Project Type**: web (backend + frontend scanners)  
**Performance Goals**: <100ms API response time, support 10 player devices + 5 GM stations concurrently  
**Constraints**: Must work offline after setup, runs on Raspberry Pi (100MB RAM), battery-efficient ESP32  
**Scale/Scope**: ~48 hours implementation, 9 major integration components, 3 existing scanner repos

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Component Independence Gate
- [x] Each scanner maintains standalone functionality without orchestrator
- [x] GitHub Pages deployment preserved for existing scanners
- [x] No hard dependencies between scanners

### Single Source of Truth Gate
- [x] Token data only modified through ALN-TokenData submodule
- [x] Sync mechanisms preserve data consistency
- [ ] No local token definitions outside shared repository - NEEDS FIX: Backend has hardcoded tokens

### Communication Pattern Gate
- [x] Player scanners use simple HTTP POST (no WebSocket)
- [x] GM stations use WebSocket for real-time sync
- [x] Fallback modes handle orchestrator unavailability

### Infrastructure Simplicity Gate
- [x] Runs on Raspberry Pi 4 or equivalent
- [x] Works offline after initial setup
- [x] Minimal external dependencies (no databases required)

### Progressive Enhancement Gate
- [x] Core gameplay functions without video/sync features
- [x] Features are additive, not required
- [x] Graceful degradation on component failure

### Subagent Execution Gate
- [x] Research phases handled by lead agent, not delegated
- [x] Subagents receive precise execution instructions only
- [x] Agent usage reserved for complex multi-step tasks
- [x] Parallel execution only for truly independent operations

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - Backend orchestrator with frontend scanners

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Lead agent performs research directly** (per Constitution VI):
   - Use Grep/Glob to search codebase for existing patterns
   - Read relevant files to understand current implementation
   - WebSearch for best practices if technology choices unclear
   - Document findings without delegating to subagents
   - CRITICAL: Never delegate research to maintain visibility

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy for Integration Phase**:
- Load `.specify/templates/tasks-template.md` as base
- Focus on integration work from PRD_ADDENDUM_COMPLETE.md
- Priority on fixing constitutional violations first

**Task Categories**:
1. **Git Submodule Setup** (CRITICAL - 4 hours)
   - Configure nested submodules for scanners
   - Add direct ALN-TokenData for backend
   - Verify recursive updates work

2. **Backend Token Loading Fix** (CRITICAL - 2 hours)
   - Remove hardcoded tokens from config
   - Implement filesystem loading from ALN-TokenData
   - Add fallback paths

3. **Network Flexibility** (HIGH - 3 hours)
   - Create DiscoveryService with mDNS/UDP
   - Update backend to display IPs on startup
   - Add config pages to scanners

4. **Player Scanner Integration** (10 hours)
   - Create orchestratorIntegration.js
   - Implement offline queue (100 transactions)
   - Add config.html for network setup
   - Connection status indicators

5. **GM Scanner Integration** (12 hours)
   - Create orchestratorWebSocket.js
   - Implement Socket.io client
   - Full state sync on reconnect
   - Video playback indicators

6. **Admin Interface Enhancement** (6 hours)
   - Video control panel
   - Session management
   - Device monitoring
   - Activity logging

**Ordering Strategy**:
- Constitutional violations first (token loading)
- Foundation before features (submodules → network → scanners)
- Parallel where possible (scanner integrations can be concurrent)
- Mark [P] for parallel execution

**Estimated Output**: 35-40 numbered tasks covering:
- Submodule configuration (3-4 tasks)
- Backend fixes (4-5 tasks)  
- Network flexibility (5-6 tasks)
- Scanner integrations (15-20 tasks)
- Admin interface (5-7 tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan
**SCOPE**: ESP32 implementation excluded from current phase

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Backend hardcoded tokens | Legacy from initial development | Must be fixed - not justified, priority #1 fix |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (1 violation to fix)
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

**Integration Deliverables**:
- [x] research.md - Integration requirements documented
- [x] data-model.md - Data structures defined
- [x] contracts/openapi.yaml - HTTP API contracts
- [x] contracts/websocket-events.md - WebSocket protocol
- [x] quickstart.md - Testing and deployment guide
- [x] CLAUDE.md - Updated with correct project structure

---
*Based on ALN Ecosystem Constitution v1.1.0 - See `.specify/memory/constitution.md`*
