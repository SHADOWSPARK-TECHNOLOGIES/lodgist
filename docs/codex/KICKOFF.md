# Codex kickoff: Lodgist web
Owner-approved scope: source-preserving engineering and tests on clean branches only, not production merge/deploy or payment collection.
Repository: SHADOWSPARK-TECHNOLOGIES/lodgist
Read `AGENTS.md`, `docs/codex/EXECUTION_CONTRACT_2026-11-07.md` and `.agents/skills/codex-evidence-loop/SKILL.md` from branch `agent/codex-evidence-loop-20261107`.
Start **Loop 0** read-only. Verify current PR #132 SHA and full checks, PRs #128/#130/#131, Railway production-vs-preview deployed SHAs, actual Postgres DB isolation, branch/wt status, and release issue #129.
Do not run mutating tests against preview until its DB is proven separate from production. No real payment pilot, bank/beneficiary adjustment, migration, deployment or merge.
After Loop 0, prioritize the single blocker that can be fixed on an isolated branch, produce focused tests, independent reviewer evidence, draft PR and a dated report. Escalate owner-only gates as BLOCKED.
Report exact commands and results, never inferred passing tests.
