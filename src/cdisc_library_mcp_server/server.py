from typing import Any

from mcp.server.mcpserver import MCPServer

from cdisc_library_mcp_server.client import CDISCLibraryClient
from cdisc_library_mcp_server.config import load_settings

mcp = MCPServer("cdisc-library")


def _client() -> CDISCLibraryClient:
    return CDISCLibraryClient(load_settings())


@mcp.tool()
async def cdisc_get(path: str) -> dict[str, Any]:
    """Fetch any CDISC Library resource by path or href (e.g. "/mdr/products").

    Use this to follow `_links` found in the result of other tools -
    the CDISC Library API is hypermedia-driven and not every route has a
    dedicated tool.
    """
    async with _client() as client:
        return await client.get(path)


@mcp.tool()
async def list_product_families() -> dict[str, Any]:
    """List the top-level CDISC Library product families (standards, terminology, models)."""
    async with _client() as client:
        return await client.list_product_families()


@mcp.tool()
async def search_biomedical_concepts(query: str) -> dict[str, Any]:
    """Search CDISC Biomedical Concepts by name (e.g. "blood pressure", "hemoglobin")."""
    async with _client() as client:
        return await client.search_biomedical_concepts(query)


@mcp.tool()
async def get_biomedical_concept(concept_id: str) -> dict[str, Any]:
    """Fetch a single CDISC Biomedical Concept by its short name/id."""
    async with _client() as client:
        return await client.get_biomedical_concept(concept_id)


@mcp.tool()
async def get_ct_package(package: str) -> dict[str, Any]:
    """Fetch a Controlled Terminology package, e.g. "sdtmct-2024-03-29"."""
    async with _client() as client:
        return await client.get_ct_package(package)


@mcp.tool()
async def get_codelist(package: str, codelist_id: str) -> dict[str, Any]:
    """Fetch a single codelist from a Controlled Terminology package."""
    async with _client() as client:
        return await client.get_codelist(package, codelist_id)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
