# cdisc-library-mcp-server

An [MCP](https://modelcontextprotocol.io) server that exposes the
[CDISC Library API](https://www.cdisc.org/cdisc-library) to MCP clients (Claude
Code, Claude Desktop, etc.) — standards metadata, Controlled Terminology, and
Biomedical Concepts.

## Tools

| Tool | Description |
| --- | --- |
| `cdisc_get(path)` | Fetch any CDISC Library resource by path or href (e.g. `/mdr/products`). Use this to follow `_links` returned by other tools. |
| `list_product_families()` | List the top-level product families (standards, terminology, models). |
| `search_biomedical_concepts(query)` | Search Biomedical Concepts by name (e.g. "blood pressure"). |
| `get_biomedical_concept(concept_id)` | Fetch a single Biomedical Concept by its short name/id. |
| `get_ct_package(package)` | Fetch a Controlled Terminology package, e.g. `sdtmct-2024-03-29`. |
| `get_codelist(package, codelist_id)` | Fetch a single codelist from a Controlled Terminology package. |

## Requirements

- Node.js 18+
- A CDISC Library API key (see Setup below)

## Setup

1. Get an API key from https://library.cdisc.org (account settings).
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and set `CDISC_API_KEY`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CDISC_API_KEY` | yes | — | API key from library.cdisc.org |
| `CDISC_LIBRARY_BASE_URL` | no | `https://library.cdisc.org/api` | Override for a different environment |

## Running standalone

```bash
npm run build
npm start
```

This starts the server on stdio and is mainly useful for manual smoke-testing;
in normal use an MCP client launches it for you (see below).

## Using it from Claude Code

Build the project, then register it:

```bash
npm run build
claude mcp add cdisc-library \
  --env CDISC_API_KEY=your-api-key-here \
  -- node /path/to/cdisc-library-mcp-server/dist/index.js
```

Or add it directly to `.mcp.json` / `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cdisc-library": {
      "command": "node",
      "args": ["/path/to/cdisc-library-mcp-server/dist/index.js"],
      "env": { "CDISC_API_KEY": "your-api-key-here" }
    }
  }
}
```

## Development

```bash
npm run build   # compile TypeScript to dist/
npm test        # run the vitest suite
npm run dev     # run src/index.ts directly via tsx, for iteration
```

## Project structure

```
src/
  config.ts   # Settings from CDISC_API_KEY / CDISC_LIBRARY_BASE_URL
  client.ts   # CDISCLibraryClient — thin fetch()-based wrapper around the API
  index.ts    # McpServer instance and registerTool() definitions
test/
  client.test.ts   # CDISCLibraryClient tests, HTTP mocked with undici's MockAgent
scripts/
  build-bundle.mjs   # stages and packs the MCPB bundle (see Packaging below)
```

## API notes

The CDISC Library API is hypermedia-driven (HATEOAS): most responses embed an
`_links` map pointing to related resources instead of the client hardcoding
every route. The `cdisc_get` tool accepts any path or href so clients can walk
the API from `/mdr/products` outward; a handful of other tools wrap common
lookups (Biomedical Concepts, Controlled Terminology packages/codelists) that
are worth a friendlier interface. `CDISCLibraryClient.get()` only follows hrefs
that resolve to the configured CDISC Library host — an absolute URL pointing
elsewhere is rejected before the request is made, since the client attaches
the API key to every request it sends.

## Distribution

For the first packaged version (MCPB), this server is distributed as a
**local** bundle rather than a remote-hosted server: each user supplies their
own `CDISC_API_KEY`, which matches per-user CDISC Library entitlements more
directly than a single centrally-held key would. Revisit remote hosting later
if that licensing model changes.

The server is implemented in TypeScript/Node rather than Python specifically
so it can ship as an MCPB: Claude Desktop bundles a Node.js runtime on macOS
and Windows, so a Node-based extension installs with no separate runtime
dependency, unlike Python (which would need either the `uv` runtime or a
per-platform vendored build).

## Packaging (MCPB)

```bash
npm run package:mcpb
```

This builds the project, stages a clean bundle directory (`.mcpb-build/`,
gitignored) containing the compiled server plus only its production
dependencies, validates `manifest.json` against the MCPB schema, and packs
everything into `cdisc-library-mcp-server.mcpb` at the repo root using the
[`@anthropic-ai/mcpb`](https://github.com/modelcontextprotocol/mcpb) CLI.

To install it: open Claude Desktop → Settings → Extensions → Advanced settings →
Install Extension, and select the generated `.mcpb` file. You'll be prompted
for your CDISC Library API key, which Claude Desktop stores using OS-level
secure storage (Keychain on macOS, Credential Manager on Windows) rather than
in a plaintext config file.

## License

[MIT](LICENSE)
