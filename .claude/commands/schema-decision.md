# /schema-decision

Before changing the Prisma schema, run this audit and decision framework.

## Pre-flight

1. Read `packages/db/prisma/schema.prisma` — print relevant models
2. Run `cd lodgist && npx prisma migrate status 2>&1` — pending migrations
3. Check for related seed files: `ls packages/db/prisma/seed*`

## Decision Framework

For each proposed schema change, answer:

**Is it additive?**
- Adding a new model → YES (safe)
- Adding an optional field with `?` or `@default` → YES (safe)
- Renaming a field → NO (blast radius: all queries using that field)
- Dropping a field → NO (data loss risk)
- Changing a field type → NO (migration complexity)

**Migration strategy:**
- Safe additive: `prisma migrate dev --name <descriptive-name>` locally, then `prisma migrate deploy` on Neon
- Breaking change: plan a two-phase migration (add new → migrate data → drop old)
- Neon-specific: use DIRECT_URL for migrations, not the pooler URL

## Output Format

```
## Schema Decision

### Proposed Change
[describe the change]

### Safety Assessment
- Additive: YES / NO
- Data loss risk: NONE / LOW / HIGH
- Affects existing queries: [list files that query changed model]

### Migration Command
[exact command to run]

### Rollback Plan
[how to undo if it goes wrong]

### Verification
[SQL query or Prisma query to confirm change applied]
```
