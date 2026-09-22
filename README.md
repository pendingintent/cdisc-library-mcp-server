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

- Python 3.11+
- A CDISC Library API key (see Setup below)

## Setup

1. Get an API key from https://library.cdisc.org (account settings).
2. Create a virtualenv and install the project:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   ```

3. Copy `env.example` to `.env` and set `CDISC_API_KEY`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CDISC_API_KEY` | yes | — | API key from library.cdisc.org |
| `CDISC_LIBRARY_BASE_URL` | no | `https://library.cdisc.org/api` | Override for a different environment |

## Running standalone

```bash
python -m cdisc_library_mcp_server
```

This starts the server on stdio and is mainly useful for manual smoke-testing;
in normal use an MCP client launches it for you (see below).

## Using it from Claude Code

Register the server, pointing at this project's venv Python:

```bash
claude mcp add cdisc-library \
  --env CDISC_API_KEY=your-api-key-here \
  -- /path/to/cdisc-library-mcp-server/.venv/bin/python -m cdisc_library_mcp_server
```

Or add it directly to `.mcp.json` / `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cdisc-library": {
      "command": "/path/to/cdisc-library-mcp-server/.venv/bin/python",
      "args": ["-m", "cdisc_library_mcp_server"],
      "env": { "CDISC_API_KEY": "your-api-key-here" }
    }
  }
}
```

## Development

```bash
pytest          # run tests
ruff check .    # lint
```

## Project structure

```
src/cdisc_library_mcp_server/
  config.py   # Settings from CDISC_API_KEY / CDISC_LIBRARY_BASE_URL
  client.py   # CDISCLibraryClient — async httpx wrapper around the API
  server.py   # MCPServer instance and @mcp.tool() definitions
tests/
  test_client.py   # CDISCLibraryClient tests, HTTP mocked with respx
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

## License

[MIT](LICENSE)
