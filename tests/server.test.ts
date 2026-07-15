import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { YamtrackClient } from "../src/client.js";
import { registerTools } from "../src/tools.js";
import { MockYamtrack } from "./mock-api.js";

interface Harness {
  mcp: Client;
  mock: MockYamtrack;
  stop: () => Promise<void>;
}

async function makeHarness(clientOpts: {
  token?: string;
  username?: string;
  password?: string;
  handler?: (req: import("./mock-api.js").RecordedRequest) => {
    status: number;
    body: unknown;
  };
}): Promise<Harness> {
  const mock = new MockYamtrack();
  await mock.start(clientOpts.handler);

  const client = new YamtrackClient({
    baseUrl: mock.baseUrl,
    token: clientOpts.token,
    username: clientOpts.username,
    password: clientOpts.password,
  });

  const server = new McpServer({ name: "yamtrack", version: "0.1.0" });
  registerTools(server, client);

  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test", version: "1" });
  await server.connect(serverT);
  await mcp.connect(clientT);

  return {
    mcp,
    mock,
    stop: async () => {
      await mcp.close();
      await server.close();
      await mock.stop();
    },
  };
}

function text(result: unknown): string {
  const r = result as { content?: { type: string; text: string }[] };
  return r.content?.[0]?.text ?? "";
}

describe("tool registry", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await makeHarness({});
  });
  afterEach(() => h.stop());

  it("lists all 15 tools", async () => {
    const { tools } = await h.mcp.listTools();
    expect(tools).toHaveLength(15);
  });
});

describe("read-only tools", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await makeHarness({});
  });
  afterEach(() => h.stop());

  it("search_media hits /search/ without auth", async () => {
    const res = await h.mcp.callTool({
      name: "search_media",
      arguments: { query: "spider", media_type: "movie", source: "tmdb", page: 1 },
    });
    expect(h.mock.requests[0].path).toBe("/api/search/");
    expect(h.mock.requests[0].query).toMatchObject({
      q: "spider",
      media_type: "movie",
      source: "tmdb",
      page: "1",
    });
    expect(h.mock.requests[0].auth).toBeUndefined();
    expect(text(res)).toContain("spider");
  });

  it("get_details with season uses the season path", async () => {
    await h.mcp.callTool({
      name: "get_details",
      arguments: {
        source: "tmdb",
        media_type: "tv",
        media_id: "123",
        season_number: 2,
      },
    });
    expect(h.mock.requests[0].path).toBe("/api/details/tmdb/tv/123/season/2/");
  });

  it("get_details without season uses the item path", async () => {
    await h.mcp.callTool({
      name: "get_details",
      arguments: { source: "mal", media_type: "anime", media_id: "9" },
    });
    expect(h.mock.requests[0].path).toBe("/api/details/mal/anime/9/");
  });
});

describe("write tools", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await makeHarness({ token: "static-token" });
  });
  afterEach(() => h.stop());

  it("create_entry POSTs to /media/<type>/create/ with bearer auth", async () => {
    await h.mcp.callTool({
      name: "create_entry",
      arguments: {
        media_id: "555",
        source: "tmdb",
        media_type: "movie",
        status: "Completed",
        score: 8,
      },
    });
    expect(h.mock.requests[0].method).toBe("POST");
    expect(h.mock.requests[0].path).toBe("/api/media/movie/create/");
    expect(h.mock.requests[0].auth).toBe("Bearer static-token");
    expect(h.mock.requests[0].body).toMatchObject({
      media_id: "555",
      source: "tmdb",
      status: "Completed",
      score: 8,
    });
  });

  it("update_progress posts the operation", async () => {
    await h.mcp.callTool({
      name: "update_progress",
      arguments: { media_type: "tv", instance_id: 7, operation: "increase" },
    });
    expect(h.mock.requests[0].path).toBe("/api/media/tv/7/progress/");
    expect(h.mock.requests[0].body).toMatchObject({ operation: "increase" });
  });

  it("update_entry PATCHes with only provided fields", async () => {
    await h.mcp.callTool({
      name: "update_entry",
      arguments: { media_type: "book", instance_id: 3, score: 10 },
    });
    expect(h.mock.requests[0].method).toBe("PATCH");
    expect(h.mock.requests[0].path).toBe("/api/media/book/3/");
    expect(h.mock.requests[0].body).toEqual({ score: 10 });
  });

  it("delete_entry sends DELETE", async () => {
    await h.mcp.callTool({
      name: "delete_entry",
      arguments: { media_type: "game", instance_id: 4 },
    });
    expect(h.mock.requests[0].method).toBe("DELETE");
    expect(h.mock.requests[0].path).toBe("/api/media/game/4/delete/");
  });

  it("get_statistics forwards date filters", async () => {
    await h.mcp.callTool({
      name: "get_statistics",
      arguments: { start_date: "2024-01-01", end_date: "2024-12-31" },
    });
    expect(h.mock.requests[0].path).toBe("/api/statistics/");
    expect(h.mock.requests[0].query).toMatchObject({
      "start-date": "2024-01-01",
      "end-date": "2024-12-31",
    });
  });
});

describe("authentication", () => {
  it("mints a JWT from username/password and sends it", async () => {
    const h = await makeHarness({
      username: "u",
      password: "p",
      handler: (req) => {
        if (req.path === "/api/token/") {
          return { status: 200, body: { access: "fresh-access", refresh: "r" } };
        }
        return { status: 200, body: { ok: true } };
      },
    });
    await h.mcp.callTool({
      name: "create_entry",
      arguments: { media_id: "1", source: "tmdb", media_type: "movie" },
    });
    const login = h.mock.requests.find((r) => r.path === "/api/token/");
    expect(login?.body).toMatchObject({ username: "u", password: "p" });
    expect(h.mock.requests.at(-1)?.auth).toBe("Bearer fresh-access");
    await h.stop();
  });

  it("auto-refreshes a JWT on 401", async () => {
    const h = await makeHarness({
      username: "u",
      password: "p",
      handler: (req) => {
        if (req.path === "/api/token/") {
          return { status: 200, body: { access: "old-access", refresh: "r" } };
        }
        if (req.path === "/api/token/refresh/") {
          return { status: 200, body: { access: "new-access" } };
        }
        // First protected call 401s, refresh succeeds, retry 200s.
        if (req.auth === "Bearer new-access") {
          return { status: 200, body: { ok: true } };
        }
        return { status: 401, body: { detail: "expired" } };
      },
    });
    const res = await h.mcp.callTool({
      name: "list_tracked_media",
      arguments: { media_type: "movie" },
    });
    const attempts = h.mock.requests.filter((r) => r.path === "/api/media/movie/");
    expect(attempts).toHaveLength(2);
    expect(attempts[0].auth).toBe("Bearer old-access");
    expect(attempts[1].auth).toBe("Bearer new-access");
    expect(text(res)).toContain("ok");
    await h.stop();
  });

  it("returns a tool error when auth is missing for a protected call", async () => {
    const h = await makeHarness({
      handler: (req) => {
        if (req.path.includes("/create/") && !req.auth) {
          return { status: 401, body: { detail: "auth required" } };
        }
        return { status: 200, body: { ok: true } };
      },
    });
    const res = (await h.mcp.callTool({
      name: "create_entry",
      arguments: { media_id: "1", source: "tmdb", media_type: "movie" },
    })) as { isError?: boolean; content?: { text: string }[] };
    expect(res.isError).toBe(true);
    expect(res.content?.[0]?.text ?? "").toContain("401");
    await h.stop();
  });
});
