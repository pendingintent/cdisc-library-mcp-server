# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An MCP server that exposes the [CDISC Library API](https://www.cdisc.org/cdisc-library) (clinical
data standards metadata: SDTM/ADaM/CDASH standards, Controlled Terminology, Biomedical Concepts)
to MCP clients such as Claude Code and Claude Desktop.

## Commands

```bash
# setup
npm install

# run the server (stdio transport)
npm run build && CDISC_API_KEY=... node dist/index.js

# development (no build step, runs src/index.ts directly)
npm run dev

# tests
npm test                                    # full suite (vitest)
npx vitest run -t "get raises on error status"   # single test by name

# type-check / build
npm run build

# package as an MCPB bundle (see README's "Packaging" section)
npm run package:mcpb
```

Requires a CDISC Library API key (from account settings at library.cdisc.org), set via
`CDISC_API_KEY` env var or a `.env` file — see `.env.example`. `CDISC_LIBRARY_BASE_URL`
defaults to `https://library.cdisc.org/api` and rarely needs overriding.

## Architecture

TypeScript/Node, chosen specifically so the server can ship as an MCPB extension with no
separate runtime install (Claude Desktop bundles Node on macOS/Windows). Three layers, each
in its own module under `src/`:

- `config.ts` — reads `CDISC_API_KEY`/`CDISC_LIBRARY_BASE_URL` from the environment (via
  `dotenv`) into a `Settings` object. Throws immediately if the API key is missing.
- `client.ts` — `CDISCLibraryClient`, an async `fetch()`-based wrapper around the API. This is
  the only module that knows about HTTP/auth; it's usable and tested independently of MCP.
  `get()` resolves every path against the configured base URL and rejects one that resolves to
  a different host, since the client attaches the API key to every request it sends.
- `index.ts` — the `McpServer` instance (from the `@modelcontextprotocol/sdk` package's server
  module) and the `registerTool()` calls for each of the 6 tools, connected over
  `StdioServerTransport`. Each tool opens a fresh `CDISCLibraryClient` per call rather than
  holding a long-lived connection.

`manifest.json` (repo root) is the MCPB manifest; `scripts/build-bundle.mjs` (invoked via
`npm run package:mcpb`) stages a clean, production-deps-only copy of the built server and packs
it into a `.mcpb` file with the `@anthropic-ai/mcpb` CLI.

**The CDISC Library API is hypermedia-driven (HATEOAS):** most JSON responses embed an `_links`
map pointing to related resources instead of exposing a flat, fully-enumerable route table. Two
consequences for how this codebase is shaped:

- `CDISCLibraryClient.get(path)` accepts either a path relative to the API root (`/mdr/products`)
  or a full href copied out of a previous response's `_links` — it strips the base URL prefix if
  present, so callers don't need to care which form they have.
- The `cdisc_get` MCP tool is a deliberate escape hatch: it exposes `get()` directly so an MCP
  client can navigate the API by following links, rather than requiring a dedicated method and
  tool for every possible route. Purpose-built methods/tools (`search_biomedical_concepts`,
  `get_ct_package`, `get_codelist`, ...) exist only for the handful of lookups worth a friendlier
  interface (e.g. `search_biomedical_concepts` fetches the BC catalog and filters by title,
  because the API itself has no substring-search endpoint for it).

Tests (`test/client.test.ts`) mock the HTTP layer with `undici`'s `MockAgent` and exercise
`CDISCLibraryClient` directly — they don't go through the MCP tool layer or hit the real API.
