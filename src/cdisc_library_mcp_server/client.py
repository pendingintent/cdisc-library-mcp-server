from typing import Any

import httpx

from cdisc_library_mcp_server.config import Settings


class CDISCLibraryError(RuntimeError):
    """Raised when the CDISC Library API returns an error response."""


class CDISCLibraryClient:
    """Thin async wrapper around the CDISC Library REST API.

    The API is hypermedia-driven: most resources embed an `_links` map
    pointing to related resources. `get()` accepts either a path relative
    to the API root (e.g. "/mdr/products") or a full href taken from a
    previous response's `_links`, so callers can navigate the API without
    the client hardcoding every route.
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        self._client = httpx.AsyncClient(
            base_url=settings.base_url,
            headers={"api-key": settings.api_key, "Accept": "application/json"},
            timeout=30.0,
        )

    async def __aenter__(self) -> "CDISCLibraryClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """GET a path or href from the CDISC Library API and return parsed JSON."""
        if path.startswith(self._settings.base_url):
            path = path[len(self._settings.base_url) :]
        response = await self._client.get(path, params=params)
        if response.status_code >= 400:
            raise CDISCLibraryError(
                f"CDISC Library API request to {path!r} failed with "
                f"{response.status_code}: {response.text[:500]}"
            )
        return response.json()

    _COSMOS_V2_PREFIX = "/cosmos/v2"

    async def _get_cosmos(self, path: str) -> dict[str, Any]:
        """GET a path or href from the COSMoS v2 sub-API (BC / SDTM / CRF specializations).

        Hrefs embedded in COSMoS v2 responses (e.g. "/mdr/bc/biomedicalconcepts/C105585")
        are relative to the /cosmos/v2 sub-root rather than the API root that `get()`
        otherwise assumes for hrefs, so this prefixes them before delegating to `get()`.
        """
        if not path.startswith(self._COSMOS_V2_PREFIX):
            path = f"{self._COSMOS_V2_PREFIX}{path}"
        return await self.get(path)

    async def search_biomedical_concepts(self, query: str) -> dict[str, Any]:
        """Search the Biomedical Concepts catalog by name/synonym substring."""
        catalog = await self._get_cosmos("/mdr/bc/biomedicalconcepts")
        items = catalog.get("_links", {}).get("biomedicalConcepts", [])
        needle = query.lower()
        matches = [item for item in items if needle in item.get("title", "").lower()]
        return {"query": query, "matches": matches}

    async def get_biomedical_concept(self, concept_id: str) -> dict[str, Any]:
        """Fetch a single Biomedical Concept by its short name/id.

        The catalog only exposes concepts via `_links` hrefs (e.g.
        "/mdr/bc/biomedicalconcepts/C105585"), not a predictable
        `/biomedicalconcepts/{id}` route, so this resolves `concept_id` against
        the catalog's titles and follows the matching href.
        """
        catalog = await self._get_cosmos("/mdr/bc/biomedicalconcepts")
        items = catalog.get("_links", {}).get("biomedicalConcepts", [])
        needle = concept_id.lower().replace(" ", "").replace("_", "").replace("-", "")
        for item in items:
            title = item.get("title", "")
            if title.lower().replace(" ", "") == needle:
                return await self._get_cosmos(item["href"])
        raise CDISCLibraryError(f"No Biomedical Concept found matching {concept_id!r}")

    async def list_product_families(self) -> dict[str, Any]:
        """List the top-level product families (standards, terminology, models, ...)."""
        return await self.get("/mdr/products")

    async def get_ct_package(self, package: str) -> dict[str, Any]:
        """Fetch a specific Controlled Terminology package, e.g. 'sdtmct-2024-03-29'."""
        return await self.get(f"/mdr/ct/packages/{package}")

    async def get_codelist(self, package: str, codelist_id: str) -> dict[str, Any]:
        """Fetch a single codelist from a Controlled Terminology package."""
        return await self.get(f"/mdr/ct/packages/{package}/codelists/{codelist_id}")
