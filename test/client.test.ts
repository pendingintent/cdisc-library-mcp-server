import { MockAgent, setGlobalDispatcher } from "undici";
import { afterEach, beforeEach, expect, test } from "vitest";

import { CDISCLibraryClient, CDISCLibraryError } from "../src/client.js";

const SETTINGS = { apiKey: "test-key", baseUrl: "https://library.cdisc.org/api" };

const BC_CATALOG = {
  _links: {
    biomedicalConcepts: [
      { title: "Systolic Blood Pressure", href: "/mdr/bc/biomedicalconcepts/C1" },
      { title: "Heart Rate", href: "/mdr/bc/biomedicalconcepts/C2" },
    ],
  },
};

let agent: MockAgent;

beforeEach(() => {
  agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
});

afterEach(async () => {
  agent.assertNoPendingInterceptors();
  await agent.close();
});

function client(): CDISCLibraryClient {
  return new CDISCLibraryClient(SETTINGS);
}

test("get sends the api-key header", async () => {
  const pool = agent.get("https://library.cdisc.org");
  let seenHeader: string | undefined;
  pool
    .intercept({
      path: "/api/mdr/products",
      method: "GET",
      headers: (headers) => {
        seenHeader = headers["api-key"] as string | undefined;
        return true;
      },
    })
    .reply(200, { _links: {} });

  const result = await client().get("/mdr/products");

  expect(result).toEqual({ _links: {} });
  expect(seenHeader).toBe("test-key");
});

test("get raises on error status", async () => {
  agent
    .get("https://library.cdisc.org")
    .intercept({ path: "/api/mdr/nope", method: "GET" })
    .reply(404, "not found");

  await expect(client().get("/mdr/nope")).rejects.toThrow(CDISCLibraryError);
});

test("get resolves a relative path under the configured base path", async () => {
  agent
    .get("https://library.cdisc.org")
    .intercept({ path: "/api/mdr/products", method: "GET" })
    .reply(200, {});

  await expect(client().get("/mdr/products")).resolves.toEqual({});
});

test("get accepts a full href on the same host", async () => {
  agent
    .get("https://library.cdisc.org")
    .intercept({ path: "/api/mdr/products", method: "GET" })
    .reply(200, {});

  await expect(client().get("https://library.cdisc.org/api/mdr/products")).resolves.toEqual({});
});

test("get rejects an absolute URL on a different host", async () => {
  await expect(client().get("https://attacker.example/x")).rejects.toThrow(CDISCLibraryError);
});

test("get raises when the response exceeds the size guard", async () => {
  const oversized = { data: "x".repeat(CDISCLibraryClient.MAX_RESPONSE_BYTES + 1) };
  agent
    .get("https://library.cdisc.org")
    .intercept({ path: "/api/mdr/ct/packages/big", method: "GET" })
    .reply(200, oversized);

  await expect(client().get("/mdr/ct/packages/big")).rejects.toThrow(CDISCLibraryError);
});

test("search_biomedical_concepts filters by title", async () => {
  agent
    .get("https://library.cdisc.org")
    .intercept({ path: "/api/cosmos/v2/mdr/bc/biomedicalconcepts", method: "GET" })
    .reply(200, BC_CATALOG);

  const result = await client().searchBiomedicalConcepts("blood pressure");

  expect(result.matches).toHaveLength(1);
  expect(result.matches[0]?.href).toBe("/mdr/bc/biomedicalconcepts/C1");
});

test("the BC catalog is fetched once per client", async () => {
  let callCount = 0;
  agent
    .get("https://library.cdisc.org")
    .intercept({
      path: "/api/cosmos/v2/mdr/bc/biomedicalconcepts",
      method: "GET",
      headers: () => {
        callCount += 1;
        return true;
      },
    })
    .reply(200, BC_CATALOG)
    // a single interceptor is one-shot by default; allow it to match again so a
    // regression (catalog re-fetched) surfaces as a wrong call count rather than
    // an unrelated "no matching interceptor" error.
    .persist();

  const c = client();
  await c.searchBiomedicalConcepts("blood pressure");
  await c.searchBiomedicalConcepts("heart rate");

  expect(callCount).toBe(1);
});

test("get_biomedical_concept resolves an href from the catalog", async () => {
  const pool = agent.get("https://library.cdisc.org");
  pool
    .intercept({ path: "/api/cosmos/v2/mdr/bc/biomedicalconcepts", method: "GET" })
    .reply(200, BC_CATALOG);
  pool
    .intercept({ path: "/api/cosmos/v2/mdr/bc/biomedicalconcepts/C1", method: "GET" })
    .reply(200, { title: "Systolic Blood Pressure" });

  const result = await client().getBiomedicalConcept("SystolicBloodPressure");

  expect(result).toEqual({ title: "Systolic Blood Pressure" });
});

test("get_biomedical_concept raises when there is no match", async () => {
  agent
    .get("https://library.cdisc.org")
    .intercept({ path: "/api/cosmos/v2/mdr/bc/biomedicalconcepts", method: "GET" })
    .reply(200, BC_CATALOG);

  await expect(client().getBiomedicalConcept("nonexistent-concept")).rejects.toThrow(
    CDISCLibraryError
  );
});
