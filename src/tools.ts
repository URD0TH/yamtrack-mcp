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
      return c.request("GET", "/search/", {
        query: {
          q: a.query,
          media_type: a.media_type,
          source: a.source,
          page: a.page,
        },
      });
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
      if (a.media_type === "tv" && a.season_number !== undefined) {
        return c.request(
          "GET",
          `/details/${a.source}/tv/${a.media_id}/season/${a.season_number}/`,
        );
      }
      return c.request("GET", `/details/${a.source}/${a.media_type}/${a.media_id}/`);
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
      return c.request("GET", `/media/${a.media_type}/`, {
        query: {
          status: a.status,
          sort: a.sort,
          search: a.search,
          page: a.page,
          per_page: a.per_page,
        },
      });
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
    async (c, a) => c.request("GET", "/home/", { query: { sort: a.sort } }),
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
      return c.request("GET", "/statistics/", {
        query: { "start-date": a.start_date, "end-date": a.end_date },
      });
    },
    client,
  );

  register(
    server,
    "get_me",
    "Get the currently authenticated user.",
    {},
    async (c) => c.request("GET", "/auth/me/"),
    client,
  );
}
