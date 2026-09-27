# Railway CLI Recovery Contract
Contract ID: RC-RAILWAY-001
Status: ACTIVE
Companion: docs/CONTEXT-TRANSFER.md §Layer 4 (FORBIDDEN)
Scope: Track A (Lodgist) and Track B (ShadowSpark) — both use Railway CLI
Supersedes: ad-hoc Node/railway troubleshooting

## 1. Purpose
Encode the crash-recovery procedure for the Railway CLI as a contract, not a
troubleshooting note. Any agent that hits a Railway crash must read this file
before retrying any command.

## 2. Pre-flight (run before ANY railway command)

```bash
# 2.1 Node version — Railway TS SDK requires Node 22+
node --version        # must satisfy >=22.0.0
# If below 22: mise use -g node@22 && hash -r

# 2.2 CLI present and resolvable
command -v railway || { echo "NOT_INSTALLED"; exit 1; }
railway --version

# 2.3 Auth state (do NOT print token values)
railway whoami >/dev/null 2>&1 || echo "NOT_AUTHENTICATED"
```

If any of 2.1–2.3 fail, follow §3 before any project-scoped command.

## 3. Recovery procedure (on crash / NOT_AUTHENTICATED / NOT_LINKED)

Railway's own use-railway skill defines the auto-recovery semantics. Honor them:

| Symptom | Action | Source |
|---|---|---|
| `command not found` | `npm i -g @railway/cli` then `hash -r` | use-railway SKILL.md |
| `NOT_AUTHENTICATED` | `railway login` (interactive) OR set `RAILWAY_TOKEN` (project-scoped) / `RAILWAY_API_TOKEN` (account-scoped) | use-railway SKILL.md |
| `NOT_LINKED` / "No project linked" | `railway list` → `railway link` | use-railway SKILL.md |
| `OAUTH_INSUFFICIENT_GRANT` | Do NOT loop login. Check IDs, workspace membership, integration grant scope. | use-railway SKILL.md |
| CLI crashes (segfault / core dump) | See §4 — do not blind-retry | this contract |
| `--json` output crashes or truncates | See §5 — buffer discipline | this contract |

## 4. Crash recovery (segfault / SIGSEGV / core dump)

Known class: `railway up` and adjacent commands have crashed with
`panic: runtime error: invalid memory address or nil pointer dereference`
and `[signal SIGSEGV: segmentation violation]` (railwayapp/cli #229).

```bash
# 4.1 Identify what crashed (Omarchy crash-watch reads systemd coredump)
coredumpctl list --since "30 min ago" | grep -i railway
coredumpctl info $(coredumpctl list --since "30 min ago" --no-pager \
  | grep -i railway | tail -1 | awk '{print $5}')

# 4.2 Fix root cause (one of two, in order of likelihood)
#   (a) Node version below what the CLI expects
node --version    # if <22: upgrade before anything else
#   (b) Partial/corrupt global install
npm uninstall -g @railway/cli
npm i -g @railway/cli
hash -r
railway --version

# 4.3 Prove stability with a lightweight command BEFORE retrying the crashed one
railway whoami
railway status       # no --json
```

Do NOT re-run the command that crashed until 4.3 returns clean. If it crashes
again, open a fresh issue at railwayapp/cli with the `coredumpctl info` output
(redact tokens).

## 5. `--json` buffer discipline

`railway status --json` and similar commands can emit large payloads (full
commit messages, service lists). On constrained shells this has produced
truncation or downstream parse failures.

Rule: if you need JSON, pipe through a size bound and validate parseability.

```bash
railway status --json | head -c 200000 | jq . >/dev/null \
  && echo "PARSE_OK" || echo "PARSE_FAIL"
```

If `PARSE_FAIL`, do not attempt to "fix" the JSON. Fall back to non-JSON
output and parse that. Treat the `--json` flag as best-effort, not guaranteed.

## 6. Agent tooling (install once, per agent)

```bash
railway setup agent              # idempotent: skills + MCP + auth check
railway skills install           # ~/.agents/skills + tool paths
railway skills install --agent cursor   # targeted
railway mcp install              # hosted MCP via CLI login
```

Supported agent targets: `claude-code`, `cursor`, `codex`, `opencode`,
`copilot`, `factory-droid`.

## 7. Safety rules (inherit from CONTEXT-TRANSFER Layer 4)

- `railway delete --yes` requires a written project/service name list
  from a human, in the same turn, before execution. No exceptions.
- Never print token values. `railway whoami` is safe; `railway variables`
  may not be — redact.
- Prefer `--json` on `railway add` (database and service) for deterministic
  parsing: `railway add --database <type> --json`.
- Before retrying `railway add`, run `railway service list --json` to verify
  the previous attempt did not land.

## 8. Verification loop (append to CONTEXT-TRANSFER §9 after any recovery)

After recovery, append to §9 Changelog:
`YYYY-MM-DD HH:MM | Railway CLI recovered — cause: <node_version|reinstall|other> | cmd: <command> | exit: <code>`

## 9. Non-goals
- This contract does NOT authorize any destructive Railway operation.
- This contract does NOT replace `CONTEXT-TRANSFER.md` Layer 4 gates.
- This contract does NOT install Railway Agent; use direct CLI for
  deterministic ops. Use `railway agent` only on explicit request.
