import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { YamtrackClient } from "./client.js";

const MEDIA_TYPES = [
  "tv",
  "movie",
  "anime",
  "manga",
  "game",
  "book",
  "comic",
  "boardgame",
  "season",
] as const;

const SEARCH_MEDIA_TYPES = [
  "tv",
  "movie",
  "anime",
  "manga",
  "game",
  "book",
  "comic",
  "boardgame",
] as const;

const STATUS_VALUES = [
  "Completed",
  "In progress",
  "Planning",
  "Paused",
  "Dropped",
] as const;

const LIST_STATUS = ["All", ...STATUS_VALUES] as const;

const HOME_SORT = [
  "upcoming",
  "recent",
  "completion",
  "episodes_left",
  "title",
] as const;

const PROGRESS_OP = ["increase", "decrease"] as const;

const SOURCES = [
  "tmdb",
  "mal",
  "igdb",
  "openlibrary",
  "mangaupdates",
  "comicvine",
  "custom",
] as const;

type ToolFn = (
  client: YamtrackClient,
  args: Record<string, unknown>,
) => Promise<unknown>;

// ponytail: LLM-response transformers — strip images, providers, frontend-only noise

type Rec = Record<string, unknown>;

function summarizeStatistics(raw: Rec): Rec {
  const sd = raw.status_distribution as Rec | undefined;
  const statusSummary: Record<string, number> = {};
  if (sd?.datasets && Array.isArray(sd.datasets)) {
    for (const ds of sd.datasets as Array<{ label: string; total: number }>) {
      statusSummary[ds.label] = ds.total;
    }
  }
  const avg = (raw.score_distribution as Rec)?.average_score;
  const consumption = ((raw.consumption_stats as Rec[]) ?? []).map(
    ({ color: _c, ...item }) => item,
  );
  return {
    media_count: raw.media_count,
    consumption_stats: consumption,
    score_average: avg,
    status_summary: statusSummary,
  };
}

function summarizeSearchResults(raw: Rec): Rec {
  const results = (raw.results ?? []) as Array<{ item: Rec; media: unknown }>;
  return {
    ...raw,
    results: results.map(({ item }) => ({
      title: item.title,
      media_id: item.media_id,
      source: item.source,
      media_type: item.media_type,
    })),
  };
}

function summarizeDetails(raw: Rec): Rec {
  const meta = (raw.metadata ?? raw) as Rec;
  const { image: _img, providers: _prov, ...metaRest } = meta;

  const seasons = ((meta.related as Rec | undefined)?.seasons ?? []) as Rec[];
  const recs = ((meta.related as Rec | undefined)?.recommendations ?? []) as Rec[];
  const links = (meta.external_links as Rec | undefined) ?? {};

  return {
    ...metaRest,
    external_links: links.IMDb ? { IMDb: links.IMDb } : undefined,
    seasons: seasons.map(({ image: _i, ...s }) => s),
    recommendations: recs.map(({ image: _i, ...r }) => r),
  };
}

function summarizeMediaEntry(entry: Rec): Rec {
  const { item, ...rest } = entry;
  const it = (item ?? {}) as Rec;
  const { image: _img, ...itemRest } = it;
  return { ...itemRest, ...rest };
}

function summarizeMediaList(raw: Rec): Rec {
  const results = (raw.results ?? []) as Rec[];
  return {
    ...raw,
    results: results.map(summarizeMediaEntry),
  };
}

function register(
  server: McpServer,
  name: string,
  description: string,
  schema: Record<string, z.ZodTypeAny>,
  fn: ToolFn,
  client: YamtrackClient,
): void {
  server.registerTool(name, { description, inputSchema: schema }, async (args) => {
    const result = await fn(client, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}

export function registerTools(server: McpServer, client: YamtrackClient): void {
  // --- Search & Browse ---
  register(
    server,
    "search_media",
    "Search external providers for media by title.",
    {
      query: z.string().describe("Search query."),
      media_type: z.enum(SEARCH_MEDIA_TYPES).describe("Type of media to search for."),
      source: z
        .enum(SOURCES)
        .optional()
        .describe("Provider source (defaults to the media type's default)."),
      page: z.coerce.number().int().positive().optional().describe("Page number."),
    },
    async (c, a) => {
      const raw = await c.request("GET", "/search/", {
        query: {
          q: a.query,
          media_type: a.media_type,
          source: a.source,
          page: a.page,
        },
      });
      return summarizeSearchResults(raw as Rec);
    },
    client,
  );

  register(
    server,
    "get_details",
    "Get metadata for a media item from a provider.",
    {
      source: z.enum(SOURCES).describe("Provider source."),
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      media_id: z.string().describe("Provider media id."),
      season_number: z.coerce
        .number()
        .int()
        .optional()
        .describe("Season number (tv only)."),
    },
    async (c, a) => {
      let raw: unknown;
      if (a.media_type === "tv" && a.season_number !== undefined) {
        raw = await c.request(
          "GET",
          `/details/${a.source}/tv/${a.media_id}/season/${a.season_number}/`,
        );
      } else {
        raw = await c.request(
          "GET",
          `/details/${a.source}/${a.media_type}/${a.media_id}/`,
        );
      }
      return summarizeDetails(raw as Rec);
    },
    client,
  );

  // --- Tracked Media ---
  register(
    server,
    "list_tracked_media",
    "List the authenticated user's tracked media.",
    {
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      status: z
        .enum(LIST_STATUS)
        .optional()
        .describe("Filter by status (All by default)."),
      sort: z
        .string()
        .optional()
        .describe(
          "Sort field: score, title, progress, start_date, end_date, or any item field.",
        ),
      search: z.string().optional().describe("Case-insensitive title substring."),
      page: z.coerce.number().int().positive().optional(),
      per_page: z.coerce.number().int().positive().optional(),
    },
    async (c, a) => {
      const raw = await c.request("GET", `/media/${a.media_type}/`, {
        query: {
          status: a.status,
          sort: a.sort,
          search: a.search,
          page: a.page,
          per_page: a.per_page,
        },
      });
      return summarizeMediaList(raw as Rec);
    },
    client,
  );

  register(
    server,
    "get_home",
    "Dashboard with in-progress and planning items.",
    {
      sort: z
        .enum(HOME_SORT)
        .optional()
        .describe("upcoming (default), recent, completion, episodes_left, title."),
    },
    async (c, a) => {
      const raw = await c.request("GET", "/home/", { query: { sort: a.sort } });
      const out = { ...(raw as Rec) };
      for (const key of Object.keys(out)) {
        const section = out[key] as Rec | undefined;
        if (!section || typeof section !== "object") continue;
        for (const sub of Object.keys(section)) {
          const group = section[sub] as Rec | undefined;
          if (group?.items && Array.isArray(group.items)) {
            group.items = group.items.map(summarizeMediaEntry);
          }
        }
      }
      return out;
    },
    client,
  );

  register(
    server,
    "get_history",
    "Change history for a tracked media item.",
    {
      source: z.enum(SOURCES).describe("Provider source."),
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      media_id: z.string().describe("Provider media id."),
      season_number: z.coerce.number().int().optional(),
      episode_number: z.coerce.number().int().optional(),
    },
    async (c, a) => {
      return c.request("GET", `/history/${a.source}/${a.media_type}/${a.media_id}/`, {
        query: { season_number: a.season_number, episode_number: a.episode_number },
      });
    },
    client,
  );

  // --- Actions ---
  register(
    server,
    "create_entry",
    "Start tracking media from an external provider by id.",
    {
      media_id: z.string().describe("Provider media id."),
      source: z.enum(SOURCES).describe("Provider source."),
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      status: z.enum(STATUS_VALUES).optional(),
      score: z.coerce.number().min(0).max(10).optional(),
      progress: z.coerce.number().int().min(0).optional(),
      notes: z.string().optional(),
      start_date: z.string().optional().describe("Start date/time (ISO 8601)."),
      end_date: z.string().optional().describe("End date/time (ISO 8601)."),
    },
    async (c, a) => {
      const body: Record<string, unknown> = {
        media_id: a.media_id,
        source: a.source,
        media_type: a.media_type,
      };
      if (a.status !== undefined) body.status = a.status;
      if (a.score !== undefined) body.score = a.score;
      if (a.progress !== undefined) body.progress = a.progress;
      if (a.notes !== undefined) body.notes = a.notes;
      if (a.start_date !== undefined) body.start_date = a.start_date;
      if (a.end_date !== undefined) body.end_date = a.end_date;
      return c.request("POST", `/media/${a.media_type}/create/`, { body });
    },
    client,
  );

  register(
    server,
    "manual_create",
    "Create a media entry manually (no external provider).",
    {
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      title: z.string().describe("Title of the media."),
      status: z.enum(STATUS_VALUES).optional(),
      progress: z.coerce.number().int().min(0).optional(),
    },
    async (c, a) => {
      const body: Record<string, unknown> = {
        media_type: a.media_type,
        title: a.title,
      };
      if (a.status !== undefined) body.status = a.status;
      if (a.progress !== undefined) body.progress = a.progress;
      return c.request("POST", "/media/manual/create/", { body });
    },
    client,
  );

  register(
    server,
    "update_entry",
    "Update a tracked media item (status, score, progress, notes).",
    {
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      instance_id: z.coerce.number().int().describe("Tracked item instance id."),
      status: z.enum(STATUS_VALUES).optional(),
      score: z.coerce.number().min(0).max(10).optional(),
      progress: z.coerce.number().int().min(0).optional(),
      notes: z.string().optional(),
      start_date: z.string().optional().describe("Start date/time (ISO 8601)."),
      end_date: z.string().optional().describe("End date/time (ISO 8601)."),
    },
    async (c, a) => {
      const body: Record<string, unknown> = {};
      if (a.status !== undefined) body.status = a.status;
      if (a.score !== undefined) body.score = a.score;
      if (a.progress !== undefined) body.progress = a.progress;
      if (a.notes !== undefined) body.notes = a.notes;
      if (a.start_date !== undefined) body.start_date = a.start_date;
      if (a.end_date !== undefined) body.end_date = a.end_date;
      return c.request("PATCH", `/media/${a.media_type}/${a.instance_id}/`, { body });
    },
    client,
  );

  register(
    server,
    "update_progress",
    "Increase or decrease progress on a tracked item.",
    {
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      instance_id: z.coerce.number().int().describe("Tracked item instance id."),
      operation: z.enum(PROGRESS_OP).describe("increase or decrease."),
    },
    async (c, a) => {
      return c.request("POST", `/media/${a.media_type}/${a.instance_id}/progress/`, {
        body: { operation: a.operation },
      });
    },
    client,
  );

  register(
    server,
    "update_score",
    "Update the score (0-10) of a tracked item.",
    {
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      instance_id: z.coerce.number().int().describe("Tracked item instance id."),
      score: z.coerce.number().min(0).max(10).describe("Score from 0 to 10."),
    },
    async (c, a) => {
      return c.request("POST", `/media/${a.media_type}/${a.instance_id}/score/`, {
        body: { score: a.score },
      });
    },
    client,
  );

  register(
    server,
    "delete_entry",
    "Delete a tracked media item.",
    {
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      instance_id: z.coerce.number().int().describe("Tracked item instance id."),
    },
    async (c, a) => {
      return c.request("DELETE", `/media/${a.media_type}/${a.instance_id}/delete/`);
    },
    client,
  );

  register(
    server,
    "sync_metadata",
    "Re-sync metadata for a media item from its provider.",
    {
      source: z.enum(SOURCES).describe("Provider source."),
      media_type: z.enum(MEDIA_TYPES).describe("Type of media."),
      media_id: z.string().describe("Provider media id."),
    },
    async (c, a) => {
      return c.request("POST", `/sync/${a.source}/${a.media_type}/${a.media_id}/`);
    },
    client,
  );

  register(
    server,
    "create_episode",
    "Mark an episode as watched.",
    {
      media_id: z.string().describe("Provider media id."),
      source: z.enum(SOURCES).describe("Provider source."),
      season_number: z.coerce.number().int().describe("Season number."),
      episode_number: z.coerce.number().int().describe("Episode number."),
      end_date: z.string().optional().describe("Watch date/time (ISO 8601)."),
    },
    async (c, a) => {
      return c.request("POST", "/episodes/", {
        body: {
          media_id: a.media_id,
          source: a.source,
          season_number: a.season_number,
          episode_number: a.episode_number,
          ...(a.end_date !== undefined ? { end_date: a.end_date } : {}),
        },
      });
    },
    client,
  );

  register(
    server,
    "get_statistics",
    "Aggregated statistics for the authenticated user.",
    {
      start_date: z.string().optional().describe("Start date YYYY-MM-DD or 'all'."),
      end_date: z.string().optional().describe("End date YYYY-MM-DD or 'all'."),
    },
    async (c, a) => {
      const raw = await c.request("GET", "/statistics/", {
        query: { "start-date": a.start_date, "end-date": a.end_date },
      });
      return summarizeStatistics(raw as Record<string, unknown>);
    },
    client,
  );

  register(
    server,
    "get_me",
    "Get the currently authenticated user.",
    {},
    async (c) => {
      const raw = (await c.request("GET", "/auth/me/")) as Rec;
      const { token: _t, ...rest } = raw;
      return rest;
    },
    client,
  );
}
