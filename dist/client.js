/**
 * Thin client over the Yamtrack REST API.
 * Auth: a single static API key (the user's per-account token) sent as
 * `Authorization: Bearer <key>`. It is the same key used for the REST API and
 * integration webhooks. Read-only endpoints (search, details) work without it.
 */
export class YamtrackClient {
    baseUrl;
    access;
    constructor(opts) {
        this.baseUrl = (opts.baseUrl ??
            process.env.YAMTRACK_BASE_URL ??
            "http://localhost:8000/api").replace(/\/$/, "");
        this.access = opts.token ?? process.env.YAMTRACK_API_KEY;
    }
    buildUrl(path, query) {
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
    async http(method, path, query, body) {
        const headers = { "Content-Type": "application/json" };
        if (this.access)
            headers.Authorization = `Bearer ${this.access}`;
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
    async request(method, path, opts = {}) {
        return this.http(method, path, opts.query, opts.body);
    }
}
