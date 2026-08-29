# Process — skills, sessions, and continuity (owner-adopted 2026-08-29)

This file says how work runs for the remainder of the program. It
complements `docs/agents/issue-tracker.md`, `domain.md`, and
`triage-labels.md`, and the subagent policy recorded in PHASE3-STATUS
(which model and effort level to use for which kind of agent).

## 1. Skill map (mattpocock-skills, by trigger)

Each skill below has a defined trigger. Use the skill when its trigger
occurs.

| Skill | Trigger and instructions |
|---|---|
| `grill-with-docs` | Use for every phase-boundary definition session (ROADMAP §9.3) and every batch of owner questions. Do not use plain `grilling` for these: `grill-with-docs` runs the same interview AND records new or sharpened terms into `CONTEXT.md` as they settle. |
| `writing-for-agents` | Apply to every document an agent will consume. This includes: workflow subagent prompts, skill files, CLAUDE.md edits, the docs/agents files, and the future open-source documentation. See §3 below for what this means for workflow prompts. |
| `implement` (with `tdd` inside it and `code-review` at the end) | Use as the frame for every build stage (S-unit). The sequence it enforces: write tests first at the agreed seams → run typechecks and single test files often → run the full suite once at the end → run `code-review` → commit. The heavier mixed-model adversarial review still happens once per slice, at slice close. |
| `wait-what` | The owner's tool. When invoked, re-explain the current state in plain language, using the CONTEXT.md vocabulary. |
| `domain-modeling` | Use whenever a design discussion creates or sharpens a term. Update CONTEXT.md in the same session. |
| `wizard` | Use to build the guided setup scripts for steps only a human can do: the green-Pi setup (ROADMAP §3b) and the cutover-day runbook. |
| `resolving-merge-conflicts` | Use on merge-train day. The likely conflict source is submodule pins. |
| `prototype` (UI branch) | Use to mock up screens before they are built: the Phase-4 D-track four-domain wireframes (this can start any time — it needs no engine work), and each B page before its build. Standing rule: no screen is rebuilt without an approved design. |
| `prototype` (LOGIC branch) | Available if the owner wants to feel BILL's contagion math before the real module exists. The owner has declined this by default; the offer stands at about half a work session. |
| `diagnosing-bugs` | Use during on-device testing (Stages B and C) and for any production incident. |
| `research` | Use for questions about external facts (for example, Cloudflare DNS-01 details for spike S2). The result is a Markdown file with cited sources, committed to the repo. |
| `handoff` | Emergencies only: a stage must stop before it is finished. Change from the skill's default: commit the handoff file to the repo, then delete it when the next session has used it. (The skill saves to the OS temp directory; our containers erase that.) Rule 1 below is the normal continuity mechanism — not handoffs. |

Not wired in (our PHASE3-STATUS + slice-train system already covers
their jobs; available on request): `to-tickets`, `to-spec`, `triage`,
`wayfinder`, `ask-matt`, `teach`, `grill-me`.

## 2. Sessions, compaction, and continuity (five rules)

The working reality: this is one long-running remote session. When the
conversation grows too large, the harness replaces the history with a
summary ("compaction") and continues. Compaction loses detail. The
container itself can also restart, which kills running processes and
erases `/tmp`.

What survives all of this is the paper trail: design documents with
execution records, PHASE3-STATUS rows, and pushed commits. The paper
trail — not the compaction summary — is the continuity system. The five
rules:

1. **The stage is the unit.** A stage ends with: all tests green, the
   work committed and pushed, and the record updated. A finished stage
   is a safe place for compaction to happen. Never carry uncommitted
   work or an unrecorded decision toward a long-context horizon. If a
   stage runs long, commit the smallest complete piece first.
2. **Workflows carry the bulk reading and reviewing.** Subagents spend
   the tokens; their outputs land in files; the conclusions get folded
   into committed documents in the same context window. (Files in
   `/tmp` do not survive a container restart. The repo does.)
3. **Use `handoff` only for emergencies**, committed to the repo (see
   the table above).
4. **"Work session" is the estimate unit** (program §12.3): one
   stage-sized block of focused work — roughly one S-stage or one
   review round. See CONTEXT.md §1 for the three meanings of
   "session".
5. **Write for the cold agent.** The test for every execution record:
   a fresh agent, given only this record and the repo, could continue
   the work.

## 3. Workflow-prompt standards

Every prompt written for a workflow subagent must include:

- (a) The working-directory warning: work only under
  `/home/user/ALN-Ecosystem/`. The top-level `/home/user/ALNScanner`
  and `/home/user/ALN-TokenData` directories are stale clones and have
  already misled agents.
- (b) A completion criterion that demands full coverage, stated
  checkably. Good: "every command instance counted, and the count
  verified against a raw grep of the file." Bad: "produce a list."
  (A weakly bounded prompt caused a census agent to report 3 scenes
  where the file held 7.)
- (c) An evidence requirement: every claim cites a file and line.
- (d) A model and effort assignment from the subagent policy: Sonnet
  for parallel readers, Haiku for mechanical sweeps, Opus for refuters
  and security lenses, Fable for doctrine, parity, and synthesis legs.
- (e) A schema, so the agent returns structured data.
- (f) Vocabulary by reference, not restatement: use the CONTEXT.md
  terms as-is, and when an agent needs definitions, point it at
  `CONTEXT.md` (naming the relevant section) instead of paraphrasing
  them into the prompt. Shared terms recruit their full definitions;
  paraphrases drift.
- (g) State the positive behavior first; use a prohibition only as a
  hard guardrail paired with the positive (example: "work only under
  /home/user/ALN-Ecosystem/" leads; the stale-clone warning follows).

A count reported by a single reader is unverified. Confirm it with a
second independent leg or a direct read before it enters a design
document.

## 4. Writing standard for doctrine and glossary text (owner-directed 2026-08-29)

New future-facing documents — CONTEXT.md, this file, ROADMAP.md, and
everything written for the open-source era — use plain, clear language:
short sentences, active voice, one idea per sentence, no metaphors, no
compressed jargon chains. A newcomer must be able to read them.
Historical records (closed slice docs, status rows) are not rewritten;
they are records. New entries added to any document follow this
standard from now on.
