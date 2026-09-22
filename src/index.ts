#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { CDISCLibraryClient, CDISCLibraryError } from "./client.js";
import { loadSettings } from "./config.js";

const server = new McpServer({ name: "cdisc-library", version: "0.1.0" });

function client(): CDISCLibraryClient {
  return new CDISCLibraryClient(loadSettings());
}

/** Runs a tool handler, turning a CDISCLibraryError into an MCP tool error result. */
async function handle(fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    if (error instanceof CDISCLibraryError) {
      return { content: [{ type: "text" as const, text: error.message }], isError: true };
    }
    throw error;
  }
}

server.registerTool(
  "cdisc_get",
  {
    description:
      'Fetch any CDISC Library resource by path or href (e.g. "/mdr/products"). ' +
      "Use this to follow `_links` found in the result of other tools - " +
      "the CDISC Library API is hypermedia-driven and not every route has a dedicated tool.",
    inputSchema: { path: z.string() },
  },
  ({ path }) => handle(() => client().get(path))
);

server.registerTool(
  "list_product_families",
  {
    description:
      "List the top-level CDISC Library product families (standards, terminology, models).",
  },
  () => handle(() => client().listProductFamilies())
);

server.registerTool(
  "search_biomedical_concepts",
  {
    description: 'Search CDISC Biomedical Concepts by name (e.g. "blood pressure", "hemoglobin").',
    inputSchema: { query: z.string() },
  },
  ({ query }) => handle(() => client().searchBiomedicalConcepts(query))
);

server.registerTool(
  "get_biomedical_concept",
  {
    description: "Fetch a single CDISC Biomedical Concept by its short name/id.",
    inputSchema: { concept_id: z.string() },
  },
  ({ concept_id }) => handle(() => client().getBiomedicalConcept(concept_id))
);

server.registerTool(
  "get_ct_package",
  {
    description: 'Fetch a Controlled Terminology package, e.g. "sdtmct-2024-03-29".',
    inputSchema: { package: z.string() },
  },
  ({ package: pkg }) => handle(() => client().getCtPackage(pkg))
);

server.registerTool(
  "get_codelist",
  {
    description: "Fetch a single codelist from a Controlled Terminology package.",
    inputSchema: { package: z.string(), codelist_id: z.string() },
  },
  ({ package: pkg, codelist_id }) => handle(() => client().getCodelist(pkg, codelist_id))
);

async function main() {
  if (!process.env.CDISC_API_KEY) {
    console.error(
      "CDISC_API_KEY is not set. Obtain a key from " +
        "https://library.cdisc.org and set it in the environment or a .env file."
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("cdisc-library MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
