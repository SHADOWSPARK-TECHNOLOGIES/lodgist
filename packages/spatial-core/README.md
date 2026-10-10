# @lodgist/spatial-core

Shared spatial tools, cross-reference, and provider registry for Lodgist. The package is private and is not published to npm.

## Pinning from shadow-engine.spy

Import this package. Do not copy tool handlers into the MCP server. The MCP process only adapts transport: it reads `listTools()`, calls `callTool(name, input, ctx)`, and returns the result.

The simplest pnpm pin is a git dependency on this subdirectory at a commit you have reviewed:

```
pnpm add @lodgist/spatial-core@github:SHADOWSPARK-TECHNOLOGIES/lodgist#<commit-sha>&path:packages/spatial-core
```

pnpm 10 fetches that commit and uses `packages/spatial-core` as the package root. A published tarball is unnecessary. Bump the pin by changing the commit SHA. Do not track `main`.

Stable entry (package root):

- `listTools()`
- `callTool(name, input, ctx)`
- `crossReference()`
- `providerRegistry()`
- `evidenceEnvelope()`

`ctx` carries server-side listings, `isPublicListing`, `env`, and `fetchImpl`. Tool inputs are listing ids and campus ids. Do not pass raw coordinates.

The 92-feature reconciliation lives in `docs/GEV_ADOPTION.md` at the lodgist repo root.
