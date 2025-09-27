<!-- Sync Impact Report
Version change: 1.1.0 → 1.1.1 (patch - clarification)
Modified principles: Principle IV - Minimal Infrastructure (network flexibility clarified)
Added sections: None (previously added Principle VI in v1.1.0)
Removed sections: None
Templates requiring updates:
  - ✅ plan-template.md (no changes needed)
  - ✅ spec-template.md (no changes needed)
  - ✅ tasks-template.md (no changes needed)
Follow-up TODOs: None
Previous change (v1.1.0): Added Principle VI - Subagent Execution Discipline
-->

# ALN Ecosystem Constitution

## Core Principles

### I. Component Independence
Each scanner (Player, GM) MUST maintain independent deployment capability. Scanners operate as standalone GitHub Pages applications with their own CI/CD pipelines. The orchestrator provides optional enhancement without breaking standalone functionality.

**Rationale**: Enables parallel development, independent testing, and gradual rollout of features without system-wide dependencies.

### II. Single Source of Truth
ALN-TokenData serves as the authoritative token database. All components MUST synchronize token data through git submodules or direct references. No component maintains its own token definitions outside the shared repository.

**Rationale**: Prevents data divergence and ensures consistency across all game components.

### III. Asymmetric Communication
Player scanners (PWA/ESP32) MUST use HTTP POST for orchestrator communication. GM stations MUST use WebSocket for bidirectional real-time synchronization. This pattern optimizes for hardware constraints and use cases.

**Rationale**: ESP32 devices have limited resources; HTTP is simpler and more battery-efficient. GM stations need real-time updates for scoring and state management.

### IV. Minimal Infrastructure
The system MUST run on consumer hardware (Raspberry Pi 4 minimum). All components MUST work offline after initial setup. Network configuration MUST adapt to any venue infrastructure - leveraging static IPs when network control permits for reliability, while maintaining full functionality on restricted networks (hotels, mobile hotspots) through dynamic discovery mechanisms.

**Rationale**: Immersive game environments often have limited connectivity and resources. Venues range from controlled home networks to restricted hotel conference centers. Adaptability ensures reliability across all deployment scenarios.

### V. Progressive Enhancement
Core gameplay MUST function without the orchestrator. Video playback and cross-station synchronization are additive features. Each component MUST gracefully handle orchestrator unavailability.

**Rationale**: System resilience is critical for live events. Features should enhance, not gatekeep, the core experience.

### VI. Subagent Execution Discipline
When using autonomous agents for implementation, the lead agent (you) MUST perform all research and understanding phases. Subagents MUST receive precise execution instructions based on completed research and REQUIRE subagent output with SPECIFIC references to work completed. The lead agent (you) MUST VERIFY the SUCCESSFUL and ACCURATE completion of the subagents' work and NEVER assume the report received from the subagent is accurate. Never combine research and execution in a single agent invocation, YOU must use your broader understanding and context of the project to SYNTHESIZE the research results to ensure correct takeaways are considered for the following implementation steps. Use PARALLEL EXECUTION ONLY for truly INDEPENDENT tasks, SEQUENTIAL to allow you to VERIFY and SYNTHESIZE the results to ENSURE successful execution of dependent operations.  
    - Parallel: Send a single message with multiple Task tool calls
    - Sequential: Send separate messages with individual Task tool calls
  
  You MUST follow Key Agent Prompting Principles
  1. Complete Context - Agents can't see what I see
  2. Exact Specifications - No ambiguity, no references to external docs
  3. Self-Contained Instructions - Everything needed in ONE prompt
  4. Verification Steps - Clear success criteria
  5. Error Handling - What to do if things go wrong

**Rationale**: Maintains visibility into research findings, enables course correction before execution, prevents blind delegation errors, and avoids agent overutilization on simple tasks.

## Deployment Strategy

### GitHub Pages Preservation
- Player Scanner (`aln-memory-scanner`) deploys to GitHub Pages via Actions
- GM Scanner (`ALNScanner`) maintains separate GitHub Pages deployment
- Token updates trigger automatic redeployment through submodule updates
- Each scanner repository maintains its own `.github/workflows/` directory

### Orchestrator Deployment
- Direct folder in ecosystem repository (not a submodule)
- **Primary deployment**: Plain Node.js with `npm start`
- **Process management**: SystemD or PM2 for production
- **Future option**: Docker support for containerized deployment
- VLC HTTP API for video control (separate process)

### Token Synchronization
- `sync.py` scripts in each scanner handle bidirectional updates
- Git submodule auto-update on parent repository changes
- Manual sync command: `python3 sync.py --deploy`
- Atomic updates ensure consistency across components

## Development Workflow

### Repository Structure
```
ALN-Ecosystem/              # Parent repository
├── aln-memory-scanner/     # SUBMODULE - Player scanner
├── ALNScanner/             # SUBMODULE - GM scanner
├── ALN-TokenData/          # SUBMODULE - Shared tokens
├── backend/                # DIRECT - Orchestrator server (repo: aln-orchestrator)
├── hardware/esp32/         # DIRECT - Hardware implementations
└── shared/                 # DIRECT - Shared utilities
```

### Change Management
1. **Token Updates**: Edit in any component's `data/tokens.json`, run sync script
2. **Scanner Features**: Develop in respective submodule, test standalone
3. **Orchestrator Features**: Develop in ecosystem repository
4. **Breaking Changes**: Document migration path, maintain backward compatibility

### Testing Requirements
- Each scanner MUST function independently in isolation
- Orchestrator MUST handle scanner version mismatches
- Network failure scenarios MUST be tested before deployment
- Session recovery MUST work after orchestrator restart

## Technical Standards

### API Contracts
- Player Scanner API: Simple HTTP POST with JSON responses
- GM Scanner Protocol: WebSocket with event-based messages
- Status codes MUST indicate busy/playing/logged states
- All timestamps MUST use ISO 8601 format

### Data Persistence
- Scanners use localStorage for offline operation
- Orchestrator uses JSON files for session logs
- No external database dependencies
- Session data MUST survive process restarts

### Security & Privacy
- No player PII collected or stored
- Team IDs are ephemeral session identifiers
- Network traffic on isolated game network only
- Admin interface requires password protection

## Governance

### Amendment Process
1. Propose changes via pull request to ecosystem repository
2. Test impact on all three scanners
3. Document migration path if breaking changes
4. Update version following semantic versioning

### Compliance Verification
- All pull requests MUST verify scanner independence
- Deployment workflows MUST remain functional
- Token synchronization MUST be tested
- Offline operation MUST be preserved

### Version Policy
- MAJOR: Breaking changes to scanner independence or communication protocols
- MINOR: New orchestrator features or scanner enhancements
- PATCH: Bug fixes and non-functional improvements

**Version**: 1.1.1 | **Ratified**: 2025-09-23 | **Last Amended**: 2025-09-24