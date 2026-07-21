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
  });

  const server = new McpServer({ name: "yamtrack", version: "0.1.2" });
  registerTools(server, client);

  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test", version: "0.1.2" });
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

  it("create_episode sends end_date when provided", async () => {
    await h.mcp.callTool({
      name: "create_episode",
      arguments: {
        media_id: "999",
        source: "tmdb",
        season_number: 1,
        episode_number: 1,
        end_date: "2024-01-02T12:30:00Z",
      },
    });
    expect(h.mock.requests[0].path).toBe("/api/episodes/");
    expect(h.mock.requests[0].body).toMatchObject({
      media_id: "999",
      source: "tmdb",
      season_number: 1,
      episode_number: 1,
      end_date: "2024-01-02T12:30:00Z",
    });
  });

  it("create_episode omits end_date when not provided", async () => {
    await h.mcp.callTool({
      name: "create_episode",
      arguments: {
        media_id: "999",
        source: "tmdb",
        season_number: 1,
        episode_number: 1,
      },
    });
    expect(h.mock.requests[0].body).not.toHaveProperty("end_date");
  });
});

describe("read-only tools", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await makeHarness({});
  });
  afterEach(() => h.stop());

  it("search_media hits /search/ without auth", async () => {
    await h.stop();
    h = await makeHarness({
      handler: (_req) => ({
        status: 200,
        body: {
          page: 1,
          results: [
            {
              item: {
                title: "Spider-Man",
                media_id: 557,
                source: "tmdb",
                media_type: "movie",
                image: "http://x",
              },
              media: null,
            },
          ],
        },
      }),
    });
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
    const parsed = JSON.parse(text(res));
    expect(parsed.results[0].title).toBe("Spider-Man");
    expect(parsed.results[0]).not.toHaveProperty("image");
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
    await h.stop();
    h = await makeHarness({
      handler: () => ({
        status: 200,
        body: {
          metadata: {
            title: "Stranger Things",
            image: "http://x",
            providers: { US: { flatrate: [] } },
            external_links: {
              IMDb: "http://imdb.com/x",
              Wikidata: "http://wikidata.org/x",
            },
            related: {
              seasons: [{ season_number: 1, image: "http://x" }],
              recommendations: [{ title: "FROM", image: "http://x" }],
            },
          },
        },
      }),
    });
    const res = await h.mcp.callTool({
      name: "get_details",
      arguments: { source: "mal", media_type: "anime", media_id: "9" },
    });
    expect(h.mock.requests[0].path).toBe("/api/details/mal/anime/9/");
    const parsed = JSON.parse(text(res));
    expect(parsed).not.toHaveProperty("providers");
    expect(parsed).not.toHaveProperty("image");
    expect(parsed.seasons[0]).not.toHaveProperty("image");
    expect(parsed.recommendations[0]).not.toHaveProperty("image");
    expect(parsed.external_links.IMDb).toBeDefined();
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
      media_type: "movie",
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

describe("LLM transformers", () => {
  it("search_media strips images and media from results", async () => {
    const h = await makeHarness({
      handler: () => ({
        status: 200,
        body: {
          page: 1,
          total_results: 2,
          results: [
            {
              item: {
                title: "Inception",
                media_id: 27205,
                source: "tmdb",
                media_type: "movie",
                image: "http://image.tmdb.org/poster.jpg",
              },
              media: { something: "extra" },
            },
            {
              item: {
                title: "Interstellar",
                media_id: 157336,
                source: "tmdb",
                media_type: "movie",
                image: "http://image.tmdb.org/poster2.jpg",
              },
              media: null,
            },
          ],
        },
      }),
    });
    const res = await h.mcp.callTool({
      name: "search_media",
      arguments: { query: "nolan", media_type: "movie" },
    });
    const parsed = JSON.parse(text(res));
    expect(parsed.results).toHaveLength(2);
    for (const r of parsed.results) {
      expect(r).toHaveProperty("title");
      expect(r).toHaveProperty("media_id");
      expect(r).toHaveProperty("source");
      expect(r).toHaveProperty("media_type");
      expect(r).not.toHaveProperty("image");
      expect(r).not.toHaveProperty("media");
    }
    expect(parsed.results[0].title).toBe("Inception");
    await h.stop();
  });

  it("get_details strips image, providers, and images from seasons/recommendations", async () => {
    const h = await makeHarness({
      handler: () => ({
        status: 200,
        body: {
          metadata: {
            title: "Breaking Bad",
            image: "http://x/poster.jpg",
            providers: { US: { flatrate: [] } },
            external_links: {
              IMDb: "http://imdb.com/x",
              Wikidata: "http://wikidata.org/x",
            },
            related: {
              seasons: [
                { season_number: 1, image: "http://x/s1.jpg" },
                { season_number: 2, image: "http://x/s2.jpg" },
              ],
              recommendations: [
                { title: "Better Call Saul", image: "http://x/bcs.jpg" },
              ],
            },
          },
        },
      }),
    });
    const res = await h.mcp.callTool({
      name: "get_details",
      arguments: { source: "tmdb", media_type: "tv", media_id: "1396" },
    });
    const parsed = JSON.parse(text(res));
    expect(parsed).not.toHaveProperty("image");
    expect(parsed).not.toHaveProperty("providers");
    expect(parsed.title).toBe("Breaking Bad");
    expect(parsed.seasons).toHaveLength(2);
    expect(parsed.seasons[0]).not.toHaveProperty("image");
    expect(parsed.recommendations).toHaveLength(1);
    expect(parsed.recommendations[0]).not.toHaveProperty("image");
    expect(parsed.external_links).toEqual({ IMDb: "http://imdb.com/x" });
    await h.stop();
  });

  it("list_tracked_media flattens item wrapper and strips images", async () => {
    const h = await makeHarness({
      handler: () => ({
        status: 200,
        body: {
          count: 1,
          results: [
            {
              id: 1,
              item: {
                id: 2,
                media_id: "550",
                source: "tmdb",
                media_type: "movie",
                title: "Fight Club",
                image: "http://x/poster.jpg",
              },
              status: "Completed",
              score: "9.0",
            },
          ],
        },
      }),
    });
    const res = await h.mcp.callTool({
      name: "list_tracked_media",
      arguments: { media_type: "movie" },
    });
    const parsed = JSON.parse(text(res));
    const entry = parsed.results[0];
    expect(entry.title).toBe("Fight Club");
    expect(entry.media_id).toBe("550");
    expect(entry.status).toBe("Completed");
    expect(entry).not.toHaveProperty("image");
    expect(entry).not.toHaveProperty("item");
    await h.stop();
  });

  it("get_home strips images from all section items", async () => {
    const h = await makeHarness({
      handler: () => ({
        status: 200,
        body: {
          in_progress: {
            season: {
              items: [
                {
                  id: 1,
                  item: {
                    id: 2,
                    media_id: "66732",
                    source: "tmdb",
                    media_type: "season",
                    title: "Stranger Things",
                    image: "http://x/poster.jpg",
                    season_number: 1,
                  },
                  status: "In progress",
                },
              ],
              total: 1,
            },
          },
          planning: {},
        },
      }),
    });
    const res = await h.mcp.callTool({
      name: "get_home",
      arguments: {},
    });
    const parsed = JSON.parse(text(res));
    const entry = parsed.in_progress.season.items[0];
    expect(entry.title).toBe("Stranger Things");
    expect(entry).not.toHaveProperty("image");
    expect(entry).not.toHaveProperty("item");
    await h.stop();
  });

  it("get_statistics strips chart noise and keeps aggregates", async () => {
    const h = await makeHarness({
      handler: () => ({
        status: 200,
        body: {
          media_count: { total: 5, movie: 3, tv: 2 },
          media_type_distribution: {
            labels: ["Movie", "TV"],
            datasets: [{ data: [3, 2], backgroundColor: ["#f97316", "#10b981"] }],
          },
          score_distribution: {
            labels: ["0", "1", "2"],
            datasets: [{ label: "Movie", data: [0, 0, 1] }],
            average_score: 8.5,
          },
          status_distribution: {
            labels: ["Movie", "TV"],
            datasets: [
              { label: "Completed", data: [2, 1], total: 3 },
              { label: "In progress", data: [1, 1], total: 2 },
            ],
          },
          status_pie_chart_data: {
            labels: ["Completed", "In progress"],
            datasets: { data: [3, 2] },
          },
          consumption_stats: [
            {
              media_type: "movie",
              value: 3,
              descriptor: "Movies watched",
              color: "#f97316",
            },
          ],
          activity_data: { some: "chart" },
        },
      }),
    });
    const res = await h.mcp.callTool({
      name: "get_statistics",
      arguments: { start_date: "all", end_date: "all" },
    });
    const parsed = JSON.parse(text(res));
    expect(parsed).toHaveProperty("media_count");
    expect(parsed.media_count.total).toBe(5);
    expect(parsed).toHaveProperty("score_average", 8.5);
    expect(parsed).toHaveProperty("status_summary");
    expect(parsed.status_summary).toEqual({ Completed: 3, "In progress": 2 });
    expect(parsed.consumption_stats[0]).not.toHaveProperty("color");
    expect(parsed).not.toHaveProperty("activity_data");
    expect(parsed).not.toHaveProperty("media_type_distribution");
    expect(parsed).not.toHaveProperty("score_distribution");
    expect(parsed).not.toHaveProperty("status_distribution");
    expect(parsed).not.toHaveProperty("status_pie_chart_data");
    await h.stop();
  });

  it("get_me strips the API token from response", async () => {
    const h = await makeHarness({
      handler: () => ({
        status: 200,
        body: {
          id: 1,
          username: "testapi",
          email: "",
          token: "super-secret-key",
          profile_private: true,
        },
      }),
    });
    const res = await h.mcp.callTool({ name: "get_me", arguments: {} });
    const parsed = JSON.parse(text(res));
    expect(parsed.username).toBe("testapi");
    expect(parsed).not.toHaveProperty("token");
    await h.stop();
  });

  it("get_history returns raw timeline without transformation", async () => {
    const h = await makeHarness({
      handler: () => ({
        status: 200,
        body: {
          timeline: [
            {
              id: 1,
              date: "2024-01-01T00:00:00Z",
              changes: [{ field: "score", new: 9 }],
            },
          ],
          total: 1,
        },
      }),
    });
    const res = await h.mcp.callTool({
      name: "get_history",
      arguments: { source: "tmdb", media_type: "movie", media_id: "550" },
    });
    const parsed = JSON.parse(text(res));
    expect(parsed.timeline).toHaveLength(1);
    expect(parsed.timeline[0].changes[0].field).toBe("score");
    await h.stop();
  });
});

describe("authentication", () => {
  it("sends the static API key as a Bearer token", async () => {
    const h = await makeHarness({ token: "static-token" });
    await h.mcp.callTool({
      name: "create_entry",
      arguments: { media_id: "1", source: "tmdb", media_type: "movie" },
    });
    expect(h.mock.requests[0].auth).toBe("Bearer static-token");
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
