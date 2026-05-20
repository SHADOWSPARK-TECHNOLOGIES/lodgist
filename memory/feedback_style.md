---
name: feedback-style
description: How the founder expects work to be structured and communicated
metadata:
  type: feedback
---

Lead with the best answer, then tradeoffs, then exact next action. No preamble.

Always separate: quick patch / proper fix / long-term architecture — these are distinct categories the founder uses explicitly.

For architecture tasks: best option first → alternatives → risks → implementation order.

For debugging: rank hypotheses by probability → exact files and commands → verification steps.

For implementation: objective → files/systems affected → dependencies → failure modes → step-by-step → verification checklist.

**Why:** Stated explicitly in CLAUDE.md and confirmed by working style.

**How to apply:** Before every significant response, check which category it falls into and structure accordingly. Never pad with explanations the user didn't ask for.
