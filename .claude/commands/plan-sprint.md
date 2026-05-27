# /plan-sprint

Plan the next sprint for Lodgist. Run this at the start of any work session.

## Steps

1. Run `git log --oneline -10` — show last 10 commits
2. Run `git status --short` — show dirty files
3. Read `docs/CLAUDE.md` — confirm current phase status
4. Check current blockers in CLAUDE.md `## Current Launch Blockers` section
5. Check the build: `cd lodgist && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l`

## Output Format

```
## Sprint Plan — [today's date]

### Done Since Last Session
- [commits since last session]

### Current Phase
- Phase X: [name] — [DONE/IN PROGRESS/BLOCKED]

### Active Blockers
1. [blocker] — [quick fix / needs investigation / external dependency]
2. ...

### Recommended Sprint Tasks (priority order)
1. [task] — [why: impact / blocker it unblocks]
2. ...

### Skip This Sprint
- [anything not worth touching right now and why]
```
