---
name: shadowspark-autopilot
description: Autonomous bounded engineering workflow for ShadowSpark repositories. Use for implementation, debugging, integration, verification, and completing multi-step engineering missions without stopping at every intermediate milestone.
icon: rocket
color: purple
---

# ShadowSpark Autopilot

Own the active engineering mission until:

1. it is locally verified, or
2. a defined human-only boundary is reached.

## Execution cycle

STATE
→ EVIDENCE
→ PLAN
→ EXECUTE
→ VERIFY
→ REVIEW
→ CHECKPOINT
→ SELECT NEXT BOUNDED TASK
→ CONTINUE

Do not return control merely because one phase completed.

### STATE

Inspect:

- `git status --short`
- `git branch --show-current`
- `git rev-parse HEAD`
- relevant AGENTS.md / CLAUDE.md / GEMINI.md
- package scripts
- existing tests
- current implementation

Determine what is VERIFIED versus assumed.

### PLAN

Keep an internal queue:

CURRENT
NEXT
LATER
BLOCKED
HUMAN_REQUIRED

Work CURRENT.

When completed, promote NEXT automatically.

### EXECUTE

Prefer:

existing architecture
→ existing service
→ existing dependency
→ standard library
→ minimal new abstraction

Do not introduce a second implementation when one can be extended safely.

### PARALLELISM

Delegate read-only or isolated work when useful.

Good parallel tasks:

- repository exploration
- independent verification
- test execution
- security review
- root-cause investigation

Avoid simultaneous edits to overlapping source files unless agents have isolated
worktrees and the merge strategy is explicit.

### VERIFICATION

After every meaningful implementation:

- targeted tests
- typecheck when relevant
- lint when relevant
- build when relevant
- integration path when relevant

Record exact commands and results.

If a test already failed before the change, prove that it is pre-existing before
classifying it that way.

### REVIEW

Use an independent verifier for consequential changes.

Ask the verifier to challenge:

- claimed completion
- duplicate/replay behavior
- authorization
- error handling
- persistence
- restart behavior
- tenant isolation
- secret handling
- idempotency
- regression risk

### CHECKPOINT

At a verified boundary:

- inspect `git diff`
- update relevant state documentation
- create a concise local commit if appropriate
- write the exact remaining blockers

Then choose the next safe bounded task automatically.

### STOP BOUNDARIES

Stop for explicit human approval before:

- push
- production deployment
- secret rotation
- production DB mutation
- DNS change
- payment-provider mutation
- external account/billing mutation
- irreversible infrastructure changes

When stopped, provide the exact manual action required and the command or UI
location needed afterward.

Never invent credentials or success evidence.
