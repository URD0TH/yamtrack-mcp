# Tools

All 15 tools map 1:1 to the Yamtrack REST API documented in
[wiki/API.md](https://github.com/FuzzyGrim/Yamtrack/wiki/API). Use the exact
tool names and enum values below — the server validates against them.

## Search & Browse (read-only, no auth required)

| Tool | Parameters | Description |
|------|-----------|-------------|
| `search_media` | `query`, `media_type`, `page`, `source` | Search external providers for media |
| `get_details` | `source`, `media_type`, `media_id`, `season_number` | Get metadata from a provider |

## Tracked Media

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_tracked_media` | `media_type`, `status`, `sort`, `search`, `page`, `per_page` | List the user's tracked media |
| `get_home` | `sort` | Dashboard with in-progress and planning items |
| `get_history` | `source`, `media_type`, `media_id`, `season_number`, `episode_number` | Change history for an item |
| `get_me` | – | Current authenticated user |

## Actions

| Tool | Parameters | Description |
|------|-----------|-------------|
| `create_entry` | `media_id`, `source`, `media_type`, `status`, `score`, `progress`, `notes`, `start_date`, `end_date` | Start tracking new media from a provider |
| `manual_create` | `media_type`, `title`, `status`, `progress` | Create a custom/manual entry (no provider) |
| `update_entry` | `media_type`, `instance_id`, `status`, `score`, `progress`, `notes`, `start_date`, `end_date` | Update a tracked item |
| `update_progress` | `media_type`, `instance_id`, `operation` | Increase or decrease progress |
| `update_score` | `media_type`, `instance_id`, `score` | Update score (0–10) |
| `delete_entry` | `media_type`, `instance_id` | Stop tracking an item |
| `create_episode` | `media_id`, `source`, `season_number`, `episode_number`, `end_date` | Mark an episode watched (re-send with `end_date` to correct the watch date) |
| `sync_metadata` | `source`, `media_type`, `media_id` | Re-sync metadata from its provider |

## Statistics

| Tool | Parameters | Description |
|------|-----------|-------------|
| `get_statistics` | `start_date`, `end_date` | Aggregated stats and activity data (`all` for a full range) |

## Enums

Use these exact string values; the server rejects anything else.

- `media_type` ∈ {`tv`, `movie`, `anime`, `manga`, `game`, `book`, `comic`,
  `boardgame`, `season`}
- `status` ∈ {`Completed`, `In progress`, `Planning`, `Paused`, `Dropped`}
- `source` ∈ {`tmdb`, `mal`, `igdb`, `openlibrary`, `mangaupdates`,
  `comicvine`, `custom`}

## Notes

- `search_media` and `get_details` work **without** authentication.
- Every other tool needs the static API key forwarded as
  `Authorization: Bearer <key>` (see `references/install.md`).
- For TV/anime progress, prefer `create_episode` (records the watch date) over
  raw `update_progress` when you want accurate history.
