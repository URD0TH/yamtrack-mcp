import http from "node:http";

export interface RecordedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  auth: string | undefined;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

/** Minimal in-process Yamtrack REST API mock for integration tests. */
export class MockYamtrack {
  public requests: RecordedRequest[] = [];
  public port = 0;
  private server?: http.Server;
  private handler?: (req: RecordedRequest) => MockResponse;

  async start(handler?: (req: RecordedRequest) => MockResponse): Promise<void> {
    this.handler = handler;
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        let body: unknown = null;
        const raw = Buffer.concat(chunks).toString();
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = raw;
          }
        }
        const recorded: RecordedRequest = {
          method: req.method ?? "",
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
          body,
          auth: req.headers.authorization,
        };
        this.requests.push(recorded);

        const out = this.handler?.(recorded) ?? { status: 200, body: recorded };
        res.writeHead(out.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(out.body ?? null));
      });
    });
    this.server = server;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    this.port = typeof addr === "object" && addr ? addr.port : 0;
  }

  get baseUrl(): string {
    return `http://localhost:${this.port}/api`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }
}
