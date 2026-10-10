# github.authkey — post-rotation remediation

The path is not in the tree at the current branch tip. The local file was not read and was not deleted from disk. Rotation has not been done. History still contains the blob.

## Where it is reachable

- Added in `5fcfea4a636614da36536088e3da47e6215d6d55` (`fix(lodgist): add prisma client dependency and simplify vercel build`, 2026-05-20).
- Removed from the tree in `38710ab0737fda236a43462da994989d85d6ff71` on `agent/cursor-lodgist`.
- Still present on `origin/main`, local `main`, `origin/dev`, `origin/agent/cursor-lodgist` (until that remote is updated), and `origin/v0/morontomornica3-4799-89a99b5e`.
- No tags contain the adding commit.

## After the credential is rotated

1. Confirm the old credential no longer authenticates.
2. History rewrite is a separate explicit approval. Do not filter the repo until every clone and the remote are ready to reset.
3. Suggested rewrite, only after that approval: `git filter-repo --path github.authkey --invert-paths`, then force-push each affected remote ref. That is not part of this branch's local work.
4. Until the rewrite, treat every clone of `main` as holding the old credential.
