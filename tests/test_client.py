import httpx
import pytest
import respx

from cdisc_library_mcp_server.client import CDISCLibraryClient, CDISCLibraryError
from cdisc_library_mcp_server.config import Settings

SETTINGS = Settings(api_key="test-key", base_url="https://library.cdisc.org/api")

BC_CATALOG = {
    "_links": {
        "biomedicalConcepts": [
            {"title": "Systolic Blood Pressure", "href": "/mdr/bc/biomedicalconcepts/C1"},
            {"title": "Heart Rate", "href": "/mdr/bc/biomedicalconcepts/C2"},
        ]
    }
}


@pytest.fixture
async def client():
    async with CDISCLibraryClient(SETTINGS) as c:
        yield c


@respx.mock
async def test_get_sends_api_key_header(client):
    route = respx.get("https://library.cdisc.org/api/mdr/products").mock(
        return_value=httpx.Response(200, json={"_links": {}})
    )

    result = await client.get("/mdr/products")

    assert result == {"_links": {}}
    assert route.calls.last.request.headers["api-key"] == "test-key"


@respx.mock
async def test_get_raises_on_error_status(client):
    respx.get("https://library.cdisc.org/api/mdr/nope").mock(
        return_value=httpx.Response(404, text="not found")
    )

    with pytest.raises(CDISCLibraryError):
        await client.get("/mdr/nope")


@respx.mock
async def test_get_strips_full_base_url_prefix(client):
    route = respx.get("https://library.cdisc.org/api/mdr/products").mock(
        return_value=httpx.Response(200, json={})
    )

    await client.get("https://library.cdisc.org/api/mdr/products")

    assert route.called


@respx.mock
async def test_search_biomedical_concepts_filters_by_title(client):
    respx.get("https://library.cdisc.org/api/cosmos/v2/mdr/bc/biomedicalconcepts").mock(
        return_value=httpx.Response(200, json=BC_CATALOG)
    )

    result = await client.search_biomedical_concepts("blood pressure")

    assert len(result["matches"]) == 1
    assert result["matches"][0]["href"] == "/mdr/bc/biomedicalconcepts/C1"


@respx.mock
async def test_get_biomedical_concept_resolves_href_from_catalog(client):
    respx.get("https://library.cdisc.org/api/cosmos/v2/mdr/bc/biomedicalconcepts").mock(
        return_value=httpx.Response(200, json=BC_CATALOG)
    )
    respx.get("https://library.cdisc.org/api/cosmos/v2/mdr/bc/biomedicalconcepts/C1").mock(
        return_value=httpx.Response(200, json={"title": "Systolic Blood Pressure"})
    )

    result = await client.get_biomedical_concept("SystolicBloodPressure")

    assert result == {"title": "Systolic Blood Pressure"}


@respx.mock
async def test_get_biomedical_concept_raises_when_no_match(client):
    respx.get("https://library.cdisc.org/api/cosmos/v2/mdr/bc/biomedicalconcepts").mock(
        return_value=httpx.Response(200, json=BC_CATALOG)
    )

    with pytest.raises(CDISCLibraryError):
        await client.get_biomedical_concept("nonexistent-concept")
