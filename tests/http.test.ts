import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startHttpServer } from "../src/index.js";
import { MockYamtrack } from "./mock-api.js";

interface Harness {
  client: Client;
  mock: MockYamtrack;
  stop: () => Promise<void>;
}

async function makeHttpHarness(opts: {
  authHeader?: string;
  startupToken?: string;
}): Promise<Harness> {
  const mock = new MockYamtrack();
  await mock.start();

  const server = startHttpServer({
    baseUrl: mock.baseUrl,
    token: opts.startupToken,
    port: 0,
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;

  const client = new Client({ name: "test", version: "1" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${port}/mcp`),
    opts.authHeader
      ? { requestInit: { headers: { Authorization: opts.authHeader } } }
      : {},
  );
  await client.connect(transport);

  return {
    client,
    mock,
    stop: async () => {
      await client.close();
      server.close();
      await mock.stop();
    },
  };
}

describe("http transport", () => {
  let h: Harness;
  afterEach(async () => {
    await h?.stop();
  });

  it("forwards the Authorization header as bearer to the API", async () => {
    h = await makeHttpHarness({ authHeader: "Bearer http-token" });
    await h.client.callTool({
      name: "create_entry",
      arguments: { media_id: "1", source: "tmdb", media_type: "movie" },
    });
    expect(h.mock.requests[0].auth).toBe("Bearer http-token");
  });

  it("falls back to the startup token when no header is sent", async () => {
    h = await makeHttpHarness({ startupToken: "startup-token" });
    await h.client.callTool({
      name: "create_entry",
      arguments: { media_id: "2", source: "tmdb", media_type: "movie" },
    });
    expect(h.mock.requests[0].auth).toBe("Bearer startup-token");
  });
});
