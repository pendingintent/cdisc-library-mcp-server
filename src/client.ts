import type { Settings } from "./config.js";

/** Raised when the CDISC Library API returns an error response. */
export class CDISCLibraryError extends Error {}

interface BcCatalogLink {
  title?: string;
  href: string;
}

interface CosmosResponse {
  _links?: {
    biomedicalConcepts?: BcCatalogLink[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const COSMOS_V2_PREFIX = "/cosmos/v2";

/**
 * Thin async wrapper around the CDISC Library REST API.
 *
 * The API is hypermedia-driven: most resources embed an `_links` map pointing
 * to related resources. `get()` accepts either a path relative to the API
 * root (e.g. "/mdr/products") or a full href taken from a previous response's
 * `_links`, so callers can navigate the API without the client hardcoding
 * every route.
 */
export class CDISCLibraryClient {
  /**
   * Responses larger than this are rejected rather than handed back whole,
   * since an unbounded payload (e.g. a full CT package) can be megabytes of
   * JSON dumped straight into the caller's context.
   */
  static readonly MAX_RESPONSE_BYTES = 500_000;

  private readonly settings: Settings;
  private readonly baseUrl: URL;
  private bcCatalog: CosmosResponse | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
    this.baseUrl = new URL(settings.baseUrl);
  }

  /**
   * Resolve `path` the same way httpx's `AsyncClient(base_url=...)` does: a
   * relative path is appended after the base URL's own path segment (so
   * "/mdr/products" against a base of ".../api" becomes ".../api/mdr/products"),
   * not resolved as an RFC 3986 root-relative reference against the origin
   * (which would drop "/api" entirely — that's *not* what the Python client did).
   * An absolute URL (a full href copied from a previous response) is used as-is.
   */
  private resolveUrl(path: string): URL {
    try {
      return new URL(path);
    } catch {
      const basePath = this.baseUrl.pathname.replace(/\/$/, "");
      return new URL(`${basePath}${path}`, this.baseUrl.origin);
    }
  }

  /**
   * GET a path or href from the CDISC Library API and return parsed JSON.
   *
   * `path` may be a full href taken from a previous response's `_links` (the
   * API is hypermedia-driven, so this is the common case for anything but the
   * first request). Every path is resolved against the configured base URL
   * and rejected if it resolves to a different host — otherwise the API key
   * header set below would be sent to whatever host a crafted or
   * compromised `_links` href pointed at.
   */
  async get(path: string): Promise<CosmosResponse> {
    const url = this.resolveUrl(path);
    if (url.host !== this.baseUrl.host) {
      throw new CDISCLibraryError(
        `Refusing to fetch '${path}': host '${url.host}' is not the configured ` +
          `CDISC Library host ('${this.baseUrl.host}').`
      );
    }

    const response = await fetch(url, {
      headers: {
        "api-key": this.settings.apiKey,
        Accept: "application/json",
      },
      // undici's fetch defaults to a 300s body/headers timeout; match httpx's 30s instead
      // so a stalled API response doesn't hang an MCP tool call for minutes.
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new CDISCLibraryError(
        `CDISC Library API request to '${path}' failed with ${response.status}: ${body}`
      );
    }

    const text = await response.text();
    if (Buffer.byteLength(text) > CDISCLibraryClient.MAX_RESPONSE_BYTES) {
      throw new CDISCLibraryError(
        `Response from '${path}' is ${Buffer.byteLength(text)} bytes, over the ` +
          `${CDISCLibraryClient.MAX_RESPONSE_BYTES}-byte guard. Use a more specific tool or a ` +
          "narrower query instead of fetching the whole resource."
      );
    }

    return JSON.parse(text) as CosmosResponse;
  }

  /**
   * GET a path or href from the COSMoS v2 sub-API (BC / SDTM / CRF specializations).
   *
   * Hrefs embedded in COSMoS v2 responses (e.g. "/mdr/bc/biomedicalconcepts/C105585")
   * are relative to the /cosmos/v2 sub-root rather than the API root that `get()`
   * otherwise assumes for hrefs, so this prefixes them before delegating to `get()`.
   */
  private async getCosmos(path: string): Promise<CosmosResponse> {
    const prefixed = path.startsWith(COSMOS_V2_PREFIX) ? path : `${COSMOS_V2_PREFIX}${path}`;
    return this.get(prefixed);
  }

  /**
   * Fetch the Biomedical Concepts catalog, memoized for this client's lifetime.
   *
   * `searchBiomedicalConcepts` and `getBiomedicalConcept` both need the full
   * catalog to do a client-side title match, since the API has no
   * substring-search endpoint for it. Without caching, every call re-fetches it.
   */
  private async getBcCatalog(): Promise<CosmosResponse> {
    if (this.bcCatalog === null) {
      this.bcCatalog = await this.getCosmos("/mdr/bc/biomedicalconcepts");
    }
    return this.bcCatalog;
  }

  /** Search the Biomedical Concepts catalog by name/synonym substring. */
  async searchBiomedicalConcepts(query: string): Promise<{ query: string; matches: BcCatalogLink[] }> {
    const catalog = await this.getBcCatalog();
    const items = catalog._links?.biomedicalConcepts ?? [];
    const needle = query.toLowerCase();
    const matches = items.filter((item) => (item.title ?? "").toLowerCase().includes(needle));
    return { query, matches };
  }

  /**
   * Fetch a single Biomedical Concept by its short name/id.
   *
   * The catalog only exposes concepts via `_links` hrefs (e.g.
   * "/mdr/bc/biomedicalconcepts/C105585"), not a predictable
   * `/biomedicalconcepts/{id}` route, so this resolves `conceptId` against
   * the catalog's titles and follows the matching href.
   */
  async getBiomedicalConcept(conceptId: string): Promise<CosmosResponse> {
    const catalog = await this.getBcCatalog();
    const items = catalog._links?.biomedicalConcepts ?? [];
    const needle = conceptId.toLowerCase().replaceAll(" ", "").replaceAll("_", "").replaceAll("-", "");
    for (const item of items) {
      const title = (item.title ?? "").toLowerCase().replaceAll(" ", "");
      if (title === needle) {
        return this.getCosmos(item.href);
      }
    }
    throw new CDISCLibraryError(`No Biomedical Concept found matching '${conceptId}'`);
  }

  /** List the top-level product families (standards, terminology, models, ...). */
  async listProductFamilies(): Promise<CosmosResponse> {
    return this.get("/mdr/products");
  }

  /** Fetch a specific Controlled Terminology package, e.g. 'sdtmct-2024-03-29'. */
  async getCtPackage(pkg: string): Promise<CosmosResponse> {
    return this.get(`/mdr/ct/packages/${pkg}`);
  }

  /** Fetch a single codelist from a Controlled Terminology package. */
  async getCodelist(pkg: string, codelistId: string): Promise<CosmosResponse> {
    return this.get(`/mdr/ct/packages/${pkg}/codelists/${codelistId}`);
  }
}
