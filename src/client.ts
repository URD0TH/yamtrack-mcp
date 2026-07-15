export interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
}

/**
 * Thin client over the Yamtrack REST API.
 * Auth: a static API token (YAMTRACK_JWT / --token) or username+password
 * (mints a JWT and auto-refreshes it on 401).
 */
export class YamtrackClient {
  private baseUrl: string;
  private access?: string;
  private refresh?: string;
  private username?: string;
  private password?: string;

  constructor(opts: {
    baseUrl?: string;
    token?: string;
    username?: string;
    password?: string;
  }) {
    this.baseUrl = (
      opts.baseUrl ??
      process.env.YAMTRACK_BASE_URL ??
      "http://localhost:8000/api"
    ).replace(/\/+$/, "");
    this.access = opts.token ?? process.env.YAMTRACK_JWT;
    this.username = opts.username;
    this.password = opts.password;
  }

  private async login(): Promise<void> {
    if (!this.username || !this.password) {
      throw new Error(
        "Authentication required. Provide --token/YAMTRACK_JWT or --username/--password.",
      );
    }
    const data = (await this.http("POST", "/token/", undefined, {
      username: this.username,
      password: this.password,
    })) as { access?: string; refresh?: string };
    this.access = data.access;
    this.refresh = data.refresh;
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async http(
    method: string,
    path: string,
    query?: Record<string, unknown>,
    body?: unknown,
  ): Promise<unknown> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.access) headers.Authorization = `Bearer ${this.access}`;

    const res = await fetch(this.buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const detail = data && typeof data === "object" ? JSON.stringify(data) : text;
      throw new Error(`Yamtrack API ${res.status}: ${detail}`);
    }
    return data;
  }

  async request(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<unknown> {
    if (!this.access) {
      if (this.username && this.password) {
        await this.login();
      }
      // Read-only endpoints (search, details) work without auth.
    }

    try {
      return await this.http(method, path, opts.query, opts.body);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith("Yamtrack API 401") &&
        this.refresh
      ) {
        const refreshed = await fetch(this.buildUrl("/token/refresh/"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: this.refresh }),
        });
        if (refreshed.ok) {
          const data = (await refreshed.json()) as { access: string };
          this.access = data.access;
          return await this.http(method, path, opts.query, opts.body);
        }
      }
      throw err;
    }
  }
}
